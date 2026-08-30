// 小游戏加载器模块
// 沿用「小游戏合集」验证过的方案：单文件 HTML 游戏，
// 点击时 fetch 内容注入沙盒 iframe，跟主页面 DOM/JS 完全隔离，
// 用完关掉即释放，不占用主运行时资源。

export const builtInGames = [
  {
    name: '贪吃蛇',
    icon: '🐍',
    file: 'https://cdn.jsdelivr.net/gh/Uharasakura/-@main/Gluttonous_Snake.html',
    description: '经典贪吃蛇游戏',
  },
  {
    name: '种田',
    icon: '🌾',
    file: 'https://cdn.jsdelivr.net/gh/Uharasakura/-@main/Farming.html',
    description: '休闲种田游戏',
  },
  {
    name: '飞行棋',
    icon: '✈️',
    file: 'https://cdn.jsdelivr.net/gh/Uharasakura/-@main/Flight_chess.html',
    description: '经典飞行棋游戏',
  },
  {
    name: 'Nyan Cat',
    icon: '🐱',
    file: 'https://cdn.jsdelivr.net/gh/Uharasakura/-@main/Nyan_Cat.html',
    description: '彩虹猫跑酷游戏',
  },
  {
    name: '扫雷',
    icon: '💣',
    file: 'https://cdn.jsdelivr.net/gh/Uharasakura/-@main/minesweeper.html',
    description: '经典扫雷游戏',
  },
  {
    name: '数独',
    icon: '🔢',
    file: 'https://cdn.jsdelivr.net/gh/Uharasakura/-@main/shudoku.html',
    description: '数独益智游戏',
  },
];

export function gamesListHTML(customGames = []) {
  const builtin = builtInGames.map(g => ({ ...g, custom: false }));
  const custom = customGames.map((g, i) => ({ ...g, custom: true, customIndex: i }));
  const all = [...builtin, ...custom];
  if (!all.length) {
    return `<div class="wh-games-empty">还没有游戏，点下面"添加外链游戏"试试</div>`;
  }
  return all
    .map(
      g => `
      <div class="wh-game-item" data-game="${escapeAttr(g.file)}" data-name="${escapeAttr(g.name)}" title="${escapeAttr(g.description || '')}" ${g.custom ? `data-custom-index="${g.customIndex}"` : ''}>
        ${g.custom ? `<button class="wh-game-del" data-custom-index="${g.customIndex}" title="删除">×</button>` : ''}
        ${renderIcon(g.icon)}
        <div class="wh-game-name">${escapeHtml(g.name)}</div>
      </div>`,
    )
    .join('');
}

function renderIcon(icon) {
  if (icon && typeof icon === 'string' && icon.startsWith('data:image')) {
    return `<img class="wh-game-icon-img" src="${icon}" alt="">`;
  }
  return `<div class="wh-game-icon">${icon || '🎮'}</div>`;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}

// 把游戏 HTML 加载进传入的 iframe。
// iframe 需要提前设好 sandbox 属性。
export async function loadGameIntoIframe(iframe, url, name) {
  iframe.srcdoc = loadingHTML(name);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const html = await response.text();

    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
    const needsJQuery = html.includes('$(') || html.includes('jQuery(') || html.includes('$.');

    let headContent = `<base href="${baseUrl}">`;
    if (needsJQuery) {
      headContent += `<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>`;
    }
    // 不强制 overflow:hidden —— 像飞行棋这种内容比较长、需要上下滚动才能看全的游戏，
    // 强制隐藏滚动会把下面的内容裁掉。只统一去掉默认边距、让宽度撑满。
    headContent += `<style>
      html, body { margin:0!important; padding:0!important; width:100%!important; }
      body { min-height:100%; overflow-x:hidden; -webkit-overflow-scrolling:touch; }
      canvas { max-width:100%!important; height:auto!important; }
    </style>`;

    let finalHtml = html;
    if (html.includes('<head>')) {
      finalHtml = html.replace('<head>', '<head>' + headContent);
    } else if (html.includes('<html>')) {
      finalHtml = html.replace('<html>', '<html><head>' + headContent + '</head>');
    } else {
      finalHtml = headContent + html;
    }

    iframe.srcdoc = finalHtml;
  } catch (error) {
    iframe.srcdoc = errorHTML(name, url);
  }
}

function loadingHTML(name) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;font-family:sans-serif;text-align:center;padding:20px;background:#f8f5f0;">
      <div style="font-size:40px;margin-bottom:14px;">🎮</div>
      <h3 style="color:#8a6d5c;margin:0 0 6px;">正在加载游戏...</h3>
      <p style="color:#888;font-size:13px;margin:0;">${escapeHtml(name)}</p>
      <div style="margin-top:18px;width:32px;height:32px;border:3px solid #eee;border-top:3px solid #8a6d5c;border-radius:50%;animation:wh-spin 1s linear infinite;"></div>
      <style>@keyframes wh-spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}</style>
    </div>
  `;
}

function errorHTML(name, url) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;font-family:sans-serif;text-align:center;padding:20px;background:#f8f5f0;">
      <h3 style="color:#c0392b;margin:0 0 10px;">🚫 游戏加载失败</h3>
      <p style="color:#888;font-size:13px;">无法加载：${escapeHtml(name)}</p>
      <a href="${url}" target="_blank" style="margin-top:14px;padding:8px 16px;background:#8a6d5c;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;">在新窗口打开</a>
    </div>
  `;
}
