// 伴窝 / Wayhouse
// 骨架版本 v0.3：
// 1. 魔法棒扩展菜单里加入口（跟玩伴小屋同位置）
// 2. 悬浮球入口：可拖拽、可上传 PNG 头像、圆形/方形可切换、大小可调
// 3. 小游戏加载器：iframe 沙盒方式，跟主运行时隔离，避免卡顿

import { builtInGames, gamesListHTML, loadGameIntoIframe } from './src/games.js';

const MODULE_NAME = 'wayhouse';
const MENU_ID = 'wayhouse-menu-item';
const MENU_SELECTORS = [
  '#extensionsMenu',
  '#extensionMenuItems',
  '.extensions_block',
  '#extension_settings',
  '#extensionsMenuList',
];

const DEFAULT_SETTINGS = {
  floatingBallEnabled: true,
  floatingBallX: 18,
  floatingBallY: 160,
  floatingBallSize: 56,
  floatingBallShape: 'circle', // 'circle' | 'square'
  floatingBallImage: '', // base64 dataURL，用户自己传的图
  customGames: [], // 用户自己添加的外链游戏 {name, icon, file, description}
};

function getContext() {
  return SillyTavern.getContext();
}

function getSettings() {
  const { extensionSettings } = getContext();
  if (!extensionSettings[MODULE_NAME]) {
    extensionSettings[MODULE_NAME] = structuredClone(DEFAULT_SETTINGS);
  }
  // 补齐新增字段，兼容老设置
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (extensionSettings[MODULE_NAME][key] === undefined) {
      extensionSettings[MODULE_NAME][key] = DEFAULT_SETTINGS[key];
    }
  }
  return extensionSettings[MODULE_NAME];
}

function saveSettings() {
  getContext().saveSettingsDebounced();
}

let panel = null;
let isVisible = false;
let floatBall = null;

function createPanel() {
  const cfg = getSettings();
  panel = document.createElement('div');
  panel.id = 'wayhouse-panel';
  panel.innerHTML = `
    <div class="wayhouse-header">
      <span>伴窝 · Wayhouse</span>
      <button class="wayhouse-close" title="关闭">×</button>
    </div>
    <div class="wayhouse-tabs">
      <button class="wh-tab active" data-tab="home">主页</button>
      <button class="wh-tab" data-tab="games">小游戏</button>
    </div>
    <div class="wayhouse-body">
      <div class="wh-section" data-section="home">
        <p>骨架已跑通 ✅</p>
        <p style="opacity:.6;font-size:12px;margin-bottom:14px;">功能正在搭建中……</p>

        <div class="wayhouse-settings-block">
          <div class="wayhouse-settings-title">悬浮球设置</div>

          <label class="wayhouse-row">
            <span>开启悬浮球</span>
            <input type="checkbox" id="wh-float-enabled" ${cfg.floatingBallEnabled ? 'checked' : ''}>
          </label>

          <div class="wayhouse-row">
            <span>形状</span>
            <select id="wh-float-shape">
              <option value="circle" ${cfg.floatingBallShape === 'circle' ? 'selected' : ''}>圆形</option>
              <option value="square" ${cfg.floatingBallShape === 'square' ? 'selected' : ''}>方形</option>
            </select>
          </div>

          <div class="wayhouse-row">
            <span>大小 <b id="wh-float-size-val">${cfg.floatingBallSize}px</b></span>
            <input type="range" id="wh-float-size" min="36" max="120" step="2" value="${cfg.floatingBallSize}">
          </div>

          <div class="wayhouse-row">
            <span>自定义图片</span>
            <label class="wayhouse-upload-btn">
              选择 PNG
              <input type="file" id="wh-float-image" accept="image/png,image/jpeg" hidden>
            </label>
          </div>

          <div class="wayhouse-row" ${cfg.floatingBallImage ? '' : 'style="display:none"'} id="wh-float-clear-row">
            <span></span>
            <button class="wayhouse-clear-btn" id="wh-float-clear">清除图片</button>
          </div>
        </div>
      </div>

      <div class="wh-section" data-section="games" style="display:none">
        <div class="wh-games-grid" id="wh-games-grid">${gamesListHTML(cfg.customGames)}</div>
        <button class="wayhouse-upload-btn wh-add-game-btn" id="wh-add-game">+ 添加外链游戏</button>

        <div class="wh-game-frame-wrap" id="wh-game-frame-wrap" style="display:none">
          <div class="wh-game-frame-header">
            <button class="wh-game-back" id="wh-game-back">← 返回列表</button>
            <span class="wh-game-title" id="wh-game-title"></span>
          </div>
          <iframe
            class="wh-game-iframe"
            id="wh-game-iframe"
            frameborder="0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-orientation-lock allow-popups allow-modals allow-downloads"
            allow="accelerometer; gyroscope; gamepad; fullscreen; autoplay"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>
      </div>
    </div>
  `;
  panel.querySelector('.wayhouse-close').addEventListener('click', hidePanel);
  bindSettingsUI(panel);
  bindTabsUI(panel);
  bindGamesUI(panel);
  document.body.appendChild(panel);
}

function bindTabsUI(root) {
  root.querySelectorAll('.wh-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.wh-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      root.querySelectorAll('.wh-section').forEach(sec => {
        sec.style.display = sec.dataset.section === tab ? 'flex' : 'none';
      });
    });
  });
}

function bindGamesUI(root) {
  const cfg = getSettings();
  const grid = root.querySelector('#wh-games-grid');
  const frameWrap = root.querySelector('#wh-game-frame-wrap');
  const iframe = root.querySelector('#wh-game-iframe');
  const titleEl = root.querySelector('#wh-game-title');

  grid.addEventListener('click', e => {
    const item = e.target.closest('.wh-game-item');
    if (!item) return;
    const url = item.dataset.game;
    const name = item.dataset.name;
    grid.style.display = 'none';
    root.querySelector('#wh-add-game').style.display = 'none';
    frameWrap.style.display = 'flex';
    titleEl.textContent = name;
    loadGameIntoIframe(iframe, url, name);
  });

  root.querySelector('#wh-game-back').addEventListener('click', () => {
    frameWrap.style.display = 'none';
    grid.style.display = 'grid';
    root.querySelector('#wh-add-game').style.display = '';
    iframe.srcdoc = '';
  });

  root.querySelector('#wh-add-game').addEventListener('click', () => {
    const name = prompt('游戏名称:');
    if (!name) return;
    const icon = prompt('游戏图标(emoji，可留空):') || '🎮';
    const url = prompt('游戏链接(单文件 HTML 地址):');
    if (!url) return;
    cfg.customGames.push({ name, icon, file: url, description: name });
    saveSettings();
    grid.innerHTML = gamesListHTML(cfg.customGames);
  });
}

function bindSettingsUI(root) {
  const cfg = getSettings();

  root.querySelector('#wh-float-enabled').addEventListener('change', e => {
    cfg.floatingBallEnabled = e.target.checked;
    saveSettings();
    syncFloatBall();
  });

  root.querySelector('#wh-float-shape').addEventListener('change', e => {
    cfg.floatingBallShape = e.target.value;
    saveSettings();
    syncFloatBall();
  });

  const sizeInput = root.querySelector('#wh-float-size');
  const sizeLabel = root.querySelector('#wh-float-size-val');
  sizeInput.addEventListener('input', e => {
    const size = Number(e.target.value);
    cfg.floatingBallSize = size;
    sizeLabel.textContent = size + 'px';
    saveSettings();
    syncFloatBall();
  });

  root.querySelector('#wh-float-image').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    resizeImageToDataURL(file, 256).then(dataUrl => {
      cfg.floatingBallImage = dataUrl;
      saveSettings();
      syncFloatBall();
      const clearRow = root.querySelector('#wh-float-clear-row');
      if (clearRow) clearRow.style.display = '';
    });
  });

  root.querySelector('#wh-float-clear').addEventListener('click', () => {
    cfg.floatingBallImage = '';
    saveSettings();
    syncFloatBall();
    root.querySelector('#wh-float-clear-row').style.display = 'none';
    root.querySelector('#wh-float-image').value = '';
  });
}

// 把用户传的图压缩到指定最大边长，避免存进设置里的 base64 太大
function resizeImageToDataURL(file, maxSize) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showPanel() {
  if (!panel) createPanel();
  panel.style.display = 'flex';
  isVisible = true;
}

function hidePanel() {
  if (panel) panel.style.display = 'none';
  isVisible = false;
}

function togglePanel() {
  isVisible ? hidePanel() : showPanel();
}

// ===== 魔法棒扩展菜单项（跟玩伴小屋同位置） =====
let menuRetries = 0;
let menuRetryTimer = null;

function addMenuItem() {
  if (menuRetryTimer) { clearTimeout(menuRetryTimer); menuRetryTimer = null; }
  menuRetries = 0;
  tryInjectMenu();
}

function tryInjectMenu() {
  if (document.querySelector('#' + MENU_ID)) {
    installMenuObserver();
    return;
  }
  let menu = null;
  for (const sel of MENU_SELECTORS) {
    const found = document.querySelector(sel);
    if (found) { menu = found; break; }
  }
  if (menu) {
    appendMenuItem(menu);
    installMenuObserver();
    return;
  }
  menuRetries++;
  if (menuRetries < 30) {
    const delay = menuRetries < 5 ? 1000 : menuRetries < 15 ? 2000 : 3000;
    menuRetryTimer = setTimeout(tryInjectMenu, delay);
  } else {
    console.warn('[伴窝] 未找到扩展菜单容器，停止注入。');
  }
}

function appendMenuItem(menu) {
  if (document.querySelector('#' + MENU_ID)) return;
  const wrap = document.createElement('div');
  wrap.className = 'extension_container interactable';
  wrap.tabIndex = 0;
  wrap.innerHTML = `
    <div class="list-group-item flex-container flexGap5 interactable" id="${MENU_ID}" title="伴窝">
      <div class="fa-fw fa-solid fa-house extensionsMenuExtensionButton"></div>
      <span>伴窝</span>
    </div>
  `;
  wrap.querySelector('#' + MENU_ID).addEventListener('click', togglePanel);
  menu.appendChild(wrap);
}

let menuObserver = null;
function installMenuObserver() {
  if (menuObserver) return;
  menuObserver = new MutationObserver(() => {
    if (document.querySelector('#' + MENU_ID)) return;
    for (const sel of MENU_SELECTORS) {
      const found = document.querySelector(sel);
      if (found) { appendMenuItem(found); break; }
    }
  });
  menuObserver.observe(document.body, { childList: true, subtree: true });
}

// ===== 悬浮球 =====
function clampFloatPosition(x, y, size) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 8;
  const nx = Number.isFinite(x) ? x : DEFAULT_SETTINGS.floatingBallX;
  const ny = Number.isFinite(y) ? y : DEFAULT_SETTINGS.floatingBallY;
  return {
    x: Math.max(margin, Math.min(nx, Math.max(margin, vw - size - margin))),
    y: Math.max(margin, Math.min(ny, Math.max(margin, vh - size - margin))),
  };
}

function createFloatBall() {
  floatBall = document.createElement('div');
  floatBall.id = 'wayhouse-float-ball';
  document.body.appendChild(floatBall);
  bindFloatBallDrag(floatBall);
}

function renderFloatBall() {
  if (!floatBall) return;
  const cfg = getSettings();
  const size = cfg.floatingBallSize;
  Object.assign(floatBall.style, {
    width: size + 'px',
    height: size + 'px',
    borderRadius: cfg.floatingBallShape === 'circle' ? '50%' : '14px',
  });
  floatBall.innerHTML = cfg.floatingBallImage
    ? `<img src="${cfg.floatingBallImage}" alt="伴窝">`
    : `<span class="wayhouse-float-fallback">🏠</span>`;
  const pos = clampFloatPosition(cfg.floatingBallX, cfg.floatingBallY, size);
  floatBall.style.left = pos.x + 'px';
  floatBall.style.top = pos.y + 'px';
}

function syncFloatBall() {
  const cfg = getSettings();
  if (!cfg.floatingBallEnabled) {
    if (floatBall) floatBall.style.display = 'none';
    return;
  }
  if (!floatBall) createFloatBall();
  floatBall.style.display = 'flex';
  renderFloatBall();
}

function bindFloatBallDrag(btn) {
  let dragging = false;
  let moved = false;
  let startX = 0, startY = 0, originX = 0, originY = 0;

  btn.addEventListener('pointerdown', e => {
    if (e.button != null && e.button !== 0) return;
    const rect = btn.getBoundingClientRect();
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    originX = rect.left;
    originY = rect.top;
    btn.classList.add('dragging');
    try { btn.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });

  btn.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    const cfg = getSettings();
    const pos = clampFloatPosition(originX + dx, originY + dy, cfg.floatingBallSize);
    btn.style.left = pos.x + 'px';
    btn.style.top = pos.y + 'px';
    e.preventDefault();
  });

  const finish = e => {
    if (!dragging) return;
    dragging = false;
    btn.classList.remove('dragging');
    try { btn.releasePointerCapture(e.pointerId); } catch (err) {}
    const cfg = getSettings();
    const rect = btn.getBoundingClientRect();
    const pos = clampFloatPosition(rect.left, rect.top, cfg.floatingBallSize);
    cfg.floatingBallX = pos.x;
    cfg.floatingBallY = pos.y;
    saveSettings();
    if (!moved) togglePanel();
  };
  btn.addEventListener('pointerup', finish);
  btn.addEventListener('pointercancel', finish);

  window.addEventListener('resize', () => renderFloatBall());
}

function init() {
  addMenuItem();
  syncFloatBall();
  console.info('[伴窝] 扩展已加载:', MODULE_NAME);
}

function start() {
  if (typeof SillyTavern === 'undefined') {
    setTimeout(start, 500);
    return;
  }
  const context = SillyTavern.getContext();
  if (context?.eventSource?.on) {
    context.eventSource.on(context.event_types.APP_READY, init);
  } else {
    setTimeout(init, 1000);
  }
}

start();
