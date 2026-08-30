// 独立 API 设置模块
// 借鉴 SullyOS 的思路：baseUrl/apiKey/model 三件套存成"预设"，
// 可以存多个、随时切换；拉模型列表时做宽松解析，兼容各种中转站返回格式。

// ===== 字符串清理 =====
// 手机上复制粘贴容易带零宽字符/多余空格，处理接口地址、密钥时统一清一遍。
const INVISIBLE_EDGE_CHARS = /^[\s\u200B-\u200D\u2060\uFEFF]+|[\s\u200B-\u200D\u2060\uFEFF]+$/g;

export function cleanText(value) {
  return String(value ?? '').replace(INVISIBLE_EDGE_CHARS, '');
}

export function normalizeBaseUrl(value) {
  return cleanText(value).replace(/\/+$/, '');
}

// ===== 拉取模型列表返回值解析 =====
// 不同中转站 /models 接口返回的形状不太一样：
// 纯数组 / {data:[...]} / {models:[...]} / 数组里塞的是对象而不是字符串……
// 这里统一收敛成字符串数组，遇到脏数据直接跳过，不让页面崩掉。
const MODEL_ID_KEYS = ['id', 'model', 'name', 'model_name', 'slug'];

export function normalizeModelIds(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const item of value) {
    let candidate = item;
    if (item && typeof item === 'object') {
      candidate = MODEL_ID_KEYS.map(key => item[key]).find(v => typeof v === 'string');
    }
    if (typeof candidate !== 'string') continue;
    const id = candidate.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function extractModelIds(data) {
  if (Array.isArray(data)) return normalizeModelIds(data);
  if (!data || typeof data !== 'object') return [];
  const nested = data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : undefined;
  const candidates = [data.data, data.models, nested?.models, nested?.data];
  for (const candidate of candidates) {
    const models = normalizeModelIds(candidate);
    if (models.length > 0) return models;
  }
  return [];
}

// 拉取模型列表。OpenAI 兼容接口标准路径是 {baseUrl}/models
export async function fetchModelList(baseUrl, apiKey) {
  const url = normalizeBaseUrl(baseUrl);
  if (!url) return { ok: false, models: [], error: '请先填写接口地址' };
  try {
    const response = await fetch(url + '/models', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + cleanText(apiKey),
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    const models = extractModelIds(data);
    if (models.length === 0) return { ok: false, models: [], error: '拉到了但解析不出模型，可能是格式不兼容' };
    return { ok: true, models, error: null };
  } catch (err) {
    return { ok: false, models: [], error: '连接失败：' + (err?.message || String(err)) };
  }
}

// 按关键字筛选模型列表（不区分大小写，子串匹配）
export function filterModels(models, keyword) {
  const q = cleanText(keyword).toLowerCase();
  if (!q) return models;
  return models.filter(m => m.toLowerCase().includes(q));
}

// ===== 预设 CRUD（操作外部传入的 presets 数组，纯函数，方便接入现有 settings） =====
export function createPreset(name, config) {
  return {
    id: 'preset_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name: cleanText(name) || '未命名预设',
    baseUrl: normalizeBaseUrl(config.baseUrl),
    apiKey: cleanText(config.apiKey),
    model: cleanText(config.model),
  };
}

// ===== 实际生成调用 =====
// mode === 'main'：走酒馆自己的生成通道，不需要我们管密钥。
//   注意：这里用的 context.generateQuietPrompt 是酒馆扩展常见的静默生成接口，
//   具体方法名要在真机联调时确认一下是否是当前酒馆版本可用的那个，
//   如果对不上，看酒馆扩展 API 文档换成对应的生成函数即可，逻辑框架不用动。
// mode === 'custom'：走用户自己配的 OpenAI 兼容接口。
export async function generateWithApiConfig(apiConfig, promptText, context) {
  if (apiConfig.mode === 'custom') {
    const preset = (apiConfig.presets || []).find(p => p.id === apiConfig.activePresetId);
    if (!preset) return { ok: false, text: '', error: '还没有选中任何自定义预设' };
    try {
      const response = await fetch(normalizeBaseUrl(preset.baseUrl) + '/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + cleanText(preset.apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: preset.model,
          messages: [{ role: 'user', content: promptText }],
        }),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content ?? '';
      return { ok: true, text, error: null };
    } catch (err) {
      return { ok: false, text: '', error: '生成失败：' + (err?.message || String(err)) };
    }
  }

  // 跟随主设置
  try {
    if (typeof context?.generateQuietPrompt === 'function') {
      const text = await context.generateQuietPrompt(promptText);
      return { ok: true, text: text || '', error: null };
    }
    return { ok: false, text: '', error: '当前酒馆版本没找到可用的生成接口，需要联调确认' };
  } catch (err) {
    return { ok: false, text: '', error: '生成失败：' + (err?.message || String(err)) };
  }
}
