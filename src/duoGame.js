// 双人游戏骨架模块
// 这里只搭"外壳"：模型分配、主角色/NPC 管理、记忆注入开关、通用决策函数。
// 具体棋类/游戏本体逻辑等拿到真实游戏代码后再接进来调用这些函数。

import { generateWithApiConfig } from './apiConfig.js';

// ===== 存档识别 =====
// 每个存档（角色卡 + 当前聊天记录的组合）独立一份配置。
// 注意：context.characterId / context.chatId 的具体字段名要在真机联调时核实一下，
// 不同酒馆版本字段可能不完全一样，这里先按常见命名写，取不到就退化成一个全局兜底 key。
export function getScopeKey(context) {
  try {
    const charId = context?.characterId ?? context?.this_chid ?? 'nochar';
    const chatId = context?.chatId ?? context?.getCurrentChatId?.() ?? 'nochat';
    return `char:${charId}__chat:${chatId}`;
  } catch (e) {
    return 'default';
  }
}

// ===== 每存档配置的默认结构 =====
function createDefaultScopeConfig() {
  return {
    moveModelPresetId: null, // null = 跟随主设置
    talkModelPresetId: null,
    protagonist: { name: '', note: '' },
    npcs: [], // [{id, name, note}]
    memory: {
      gameToMemory: null, // null = 还没问过；true/false = 用户选过的答案
      memoryToGame: null,
      asked: false,
    },
  };
}

export function getScopeConfig(duoSettings, scopeKey) {
  if (!duoSettings.scopes[scopeKey]) {
    duoSettings.scopes[scopeKey] = createDefaultScopeConfig();
  }
  const cfg = duoSettings.scopes[scopeKey];
  // 兼容旧数据补字段
  if (!cfg.protagonist) cfg.protagonist = { name: '', note: '' };
  if (!Array.isArray(cfg.npcs)) cfg.npcs = [];
  if (!cfg.memory) cfg.memory = { gameToMemory: null, memoryToGame: null, asked: false };
  return cfg;
}

// ===== NPC 管理（纯数据操作，UI 层调用） =====
export function addNpc(scopeConfig, name, note) {
  scopeConfig.npcs.push({
    id: 'npc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name,
    note: note || '',
  });
}

export function updateNpc(scopeConfig, id, name, note) {
  const npc = scopeConfig.npcs.find(n => n.id === id);
  if (npc) {
    npc.name = name;
    npc.note = note || '';
  }
}

export function removeNpc(scopeConfig, id) {
  scopeConfig.npcs = scopeConfig.npcs.filter(n => n.id !== id);
}

// ===== 通用决策函数 =====
// role: 'move'（走棋/日常决策，建议配便宜快模型） | 'talk'（对话，建议配贵一点的模型）
// apiConfig 是伴窝设置里的顶层 apiConfig（含 presets 数组），
// 这里根据 scopeConfig 里记录的 presetId 临时"借用"那套配置去发请求，
// 不影响用户在"接口"Tab 里正在编辑/激活的那套。
export async function decide(role, scopeConfig, apiConfig, promptText, context) {
  const presetId = role === 'talk' ? scopeConfig.talkModelPresetId : scopeConfig.moveModelPresetId;

  if (!presetId) {
    // 没单独指定，跟随主设置
    return generateWithApiConfig({ mode: 'main' }, promptText, context);
  }

  const preset = (apiConfig.presets || []).find(p => p.id === presetId);
  if (!preset) {
    return { ok: false, text: '', error: `${role === 'talk' ? '对话' : '走棋'}模型指定的预设已被删除，请重新分配` };
  }

  return generateWithApiConfig(
    { mode: 'custom', presets: apiConfig.presets, activePresetId: presetId },
    promptText,
    context,
  );
}

// ===== 记忆注入询问状态 =====
// 每个存档第一次进入双人游戏时该弹一次；用户选过之后记下来，不用每次都问。
export function needsMemoryPrompt(scopeConfig) {
  return !scopeConfig.memory.asked;
}

export function setMemoryChoice(scopeConfig, gameToMemory, memoryToGame) {
  scopeConfig.memory.gameToMemory = gameToMemory;
  scopeConfig.memory.memoryToGame = memoryToGame;
  scopeConfig.memory.asked = true;
}
