(function () {
  'use strict';

  const panel = document.getElementById('translate-panel');
  if (!panel) return;

  // Translation settings
  const translatePlaceholderEl = document.getElementById('translate-panel-placeholder');
  const translateSettingsHost = document.getElementById('translate-settings-host');
  const translatePanelBody = document.getElementById('translate-panel-body');
  const environmentPanelBody = document.getElementById('environment-panel-body');

  // Menu buttons
  const menuButtons = panel.querySelectorAll('.panel-menu-btn[data-panel]');

  const DEFAULT_WIDTHS = {
    expanded: 420,
    collapsed: 56
  };

  let widths = { ...DEFAULT_WIDTHS };
  let currentState = 'expanded';

  const translateSettingsPanel = new TranslateSettingsPanel({
    host: translateSettingsHost,
    placeholderEl: translatePlaceholderEl,
    onCollapse: () => toggleSection('translate'),
    getActiveChatInfo: fetchActiveChatInfo,
    applyConfigToView
  });

  init();

  async function init() {
    applyWidths(DEFAULT_WIDTHS);
    const layout = await loadLayout();
    if (layout?.state) {
      currentState = layout.state;
    }
    if (layout?.widths) {
      applyWidths(layout.widths);
    }

    // 强制面板默认展开
    currentState = 'expanded';

    console.log('[translatePanelLayout] Initializing with state:', currentState);
    console.log('[translatePanelLayout] Panel width:', widths.expanded);

    applyState(currentState, { notify: false });
    notifyMain();

    await translateSettingsPanel.init();

    const activeAccountId = await getActiveAccountId();
    if (activeAccountId) {
      await translateSettingsPanel.setAccount(activeAccountId);
    } else {
      translateSettingsPanel.setAccount(null);
    }

    if (window.EnvironmentSettingsPanel) {
      if (activeAccountId) {
        window.EnvironmentSettingsPanel.setAccount(activeAccountId);
      } else {
        window.EnvironmentSettingsPanel.setAccount(null);
      }
    }

    bindSectionToggles();
    bindPanelCollapse();
    subscribeAccountEvents();
  }

  function applyWidths(newWidths) {
    widths = { ...widths, ...newWidths };
    const root = document.documentElement;
    root.style.setProperty('--translate-panel-width-expanded', `${widths.expanded}px`);
    root.style.setProperty('--translate-panel-width-collapsed', `${widths.collapsed}px`);
  }

  let currentActivePanel = 'translate'; // 记录当前激活的面板

  function bindSectionToggles() {
    menuButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetPanel = btn.getAttribute('data-panel');
        handlePanelClick(targetPanel);
      });
    });


  }

  function bindPanelCollapse() {
    // Handled in bindSectionToggles
  }

  function handlePanelClick(targetPanel) {
    // 如果点击的是当前已激活的面板
    if (currentActivePanel === targetPanel && currentState === 'expanded') {
      // 收起面板
      setState('collapsed');
    } else {
      // 如果面板是收起的，先展开
      if (currentState === 'collapsed') {
        setState('expanded');
      }
      // 切换到目标面板
      switchPanel(targetPanel);
    }
  }

  function switchPanel(targetPanel) {
    // 更新当前激活的面板
    currentActivePanel = targetPanel;

    // Update menu button states
    menuButtons.forEach((btn) => {
      if (btn.getAttribute('data-panel') === targetPanel) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    translatePanelBody.style.display = targetPanel === 'translate' ? 'flex' : 'none';
    if (targetPanel === 'translate') {
      // 强制回流以修复滚动条可能消失的问题
      void translatePanelBody.offsetHeight;
    }

    if (environmentPanelBody) {
      // 环境面板需要 flex 布局以支持内部滚动和固定底部
      environmentPanelBody.style.display = targetPanel === 'environment' ? 'flex' : 'none';
    }

    // 切换面板模式类，用于调整宽度
    if (targetPanel === 'environment') {
      panel.classList.add('env-mode');
      // 通知主进程更新宽度，以便调整 BrowserView 大小
      // 环境设置面板宽度调整为与翻译设置面板一致 (420px)
      if (window.electronAPI?.notifyTranslationPanelResized) {
        window.electronAPI.notifyTranslationPanelResized({
          state: currentState,
          width: DEFAULT_WIDTHS.expanded,
          widths: { ...widths, expanded: DEFAULT_WIDTHS.expanded }
        });
      }
    } else {
      panel.classList.remove('env-mode');
      // 恢复翻译面板宽度
      if (window.electronAPI?.notifyTranslationPanelResized) {
        window.electronAPI.notifyTranslationPanelResized({
          state: currentState,
          width: DEFAULT_WIDTHS.expanded,
          widths: { ...widths, expanded: DEFAULT_WIDTHS.expanded }
        });
      }
    }
  }

  function setState(state) {
    applyState(state, { notify: true });
  }

  function applyState(state, { notify } = { notify: true }) {
    const nextState = widths[state] ? state : 'expanded';
    currentState = nextState;
    panel.setAttribute('data-state', nextState);
    if (notify) {
      notifyMain();
    }
  }

  function notifyMain() {
    if (!window.electronAPI?.notifyTranslationPanelResized) return;
    window.electronAPI.notifyTranslationPanelResized({
      state: currentState,
      width: getWidthForState(currentState),
      widths
    });
  }

  function getWidthForState(state) {
    return widths[state] || widths.expanded;
  }

  async function loadLayout() {
    try {
      if (!window.electronAPI?.getTranslationPanelLayout) return null;
      const result = await window.electronAPI.getTranslationPanelLayout();
      if (result?.success && result.layout) {
        return result.layout;
      }
    } catch (error) {
      console.warn('[translatePanelLayout] Failed to load layout:', error);
    }
    return null;
  }

  async function getActiveAccountId() {
    try {
      if (!window.electronAPI?.getActiveAccount) return null;
      const res = await window.electronAPI.getActiveAccount();
      return res?.accountId || null;
    } catch (error) {
      console.warn('[translatePanelLayout] Failed to get active account:', error);
      return null;
    }
  }

  function subscribeAccountEvents() {
    if (!window.electronAPI?.on) return;

    window.electronAPI.on('view-manager:view-switched', (data) => {
      if (data?.toAccountId) {
        translateSettingsPanel.setAccount(data.toAccountId);
        window.EnvironmentSettingsPanel?.setAccount(data.toAccountId);
      }
    });

    window.electronAPI.on('account:active-changed', (data) => {
      if (data?.accountId) {
        translateSettingsPanel.setAccount(data.accountId);
        window.EnvironmentSettingsPanel?.setAccount(data.accountId);
      }
    });

    window.electronAPI.on('translation-config-updated', (data) => {
      if (data?.accountId) {
        translateSettingsPanel.setAccount(data.accountId);
      }
    });

    // 监听聊天切换事件，更新当前联系人配置
    window.electronAPI.on('translation:chat-switched', () => {
      console.log('[translatePanelLayout] Received chat-switched event, updating contact info');
      translateSettingsPanel.loadCurrentFriendConfig();
    });

    // 备选方案：定期检查联系人变化（每3秒）
    let lastContactId = null;
    setInterval(async () => {
      // 只在好友独立配置启用时检查
      const friendIndependent = document.querySelector('#friendIndependent');
      if (!friendIndependent || !friendIndependent.checked) {
        return;
      }

      try {
        const info = await fetchActiveChatInfo();
        const currentContactId = info?.contactId;

        if (currentContactId && currentContactId !== lastContactId) {
          console.log('[translatePanelLayout] Contact changed detected:', lastContactId, '->', currentContactId);
          lastContactId = currentContactId;
          translateSettingsPanel.loadCurrentFriendConfig();
        } else if (!currentContactId) {
          lastContactId = null;
        }
      } catch (error) {
        console.warn('[translatePanelLayout] Error checking contact change:', error);
      }
    }, 3000);
  }

  async function fetchActiveChatInfo() {
    try {
      if (!window.electronAPI?.getActiveChatInfo) return {};
      const res = await window.electronAPI.getActiveChatInfo();
      if (res?.success) {
        return res.data || {};
      }
    } catch (error) {
      console.warn('[translatePanelLayout] Failed to fetch chat info:', error);
    }
    return {};
  }

  function applyConfigToView(accountId, config) {
    if (!window.electronAPI?.applyTranslationConfig) {
      return Promise.resolve({ success: true });
    }
    return window.electronAPI.applyTranslationConfig(accountId, config);
  }
})();
