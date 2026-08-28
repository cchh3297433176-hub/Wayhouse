// 伴窝 / Wayhouse
// 最小可用版本：验证扩展能被 SillyTavern 正确加载，
// 并在扩展菜单里弹出一个空面板。后续功能都在此基础上迭代。

const MODULE_NAME = 'wayhouse';

let panel = null;
let isVisible = false;

function createPanel() {
  panel = document.createElement('div');
  panel.id = 'wayhouse-panel';
  panel.innerHTML = `
    <div class="wayhouse-header">
      <span>伴窝 · Wayhouse</span>
      <button class="wayhouse-close" title="关闭">×</button>
    </div>
    <div class="wayhouse-body">
      <p>骨架已跑通 ✅</p>
      <p style="opacity:.6;font-size:12px;">功能正在搭建中……</p>
    </div>
  `;
  panel.querySelector('.wayhouse-close').addEventListener('click', hidePanel);
  document.body.appendChild(panel);
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

function createButton() {
  if (document.querySelector('#wayhouse-button')) return;

  const button = document.createElement('div');
  Object.assign(button, {
    id: 'wayhouse-button',
    className: 'menu_button menu_button_icon',
    innerHTML: '🏠',
    title: '伴窝',
    onclick: togglePanel,
  });

  const targets = ['#extensionsMenuButton', '#rm_button_panel', 'body'];
  for (const target of targets) {
    const container = document.querySelector(target);
    if (container) {
      if (target === '#extensionsMenuButton') {
        container.parentNode.insertBefore(button, container.nextSibling);
      } else {
        container.appendChild(button);
        if (target === 'body') {
          Object.assign(button.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: '9999',
            background: '#8a6d5c',
            color: '#fff',
            padding: '10px',
            borderRadius: '50%',
            cursor: 'pointer',
          });
        }
      }
      break;
    }
  }
}

function init() {
  createButton();
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
