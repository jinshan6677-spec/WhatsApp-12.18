/**
 * IP Information Module for Sidebar
 * Handles fetching and rendering IP/network information for accounts
 * 
 * @module sidebar/ipInfo
 */

'use strict';

// ============================================================================
// Module Dependencies
// ============================================================================

/**
 * Get utils module
 * @returns {Object} Utils module
 */
function getUtils() {
  if (typeof window !== 'undefined' && window.SidebarUtils) {
    return window.SidebarUtils;
  }
  if (typeof require !== 'undefined') {
    return require('./utils');
  }
  throw new Error('Utils module not available');
}

/**
 * Get state module
 * @returns {Object} State module
 */
function getState() {
  if (typeof window !== 'undefined' && window.SidebarState) {
    return window.SidebarState;
  }
  if (typeof require !== 'undefined') {
    return require('./state');
  }
  throw new Error('State module not available');
}

// ============================================================================
// Cache
// ============================================================================

/** @type {{ip: string|null, time: number}} Local IP cache */
let _localIPCache = { ip: null, time: 0 };

// ============================================================================
// IP Information Functions
// ============================================================================

/**
 * Fetch and render IP information for an account
 * @param {Object} account - Account object
 * @param {HTMLElement} item - Account item element
 */
async function fetchAndRenderIPInfo(account, item) {
  if (!account || !item) return;
  if (typeof window === 'undefined' || !window.electronAPI) return;

  // Check if IP info container already exists
  let ipContainer = item.querySelector('.account-ip-info');
  if (!ipContainer) {
    ipContainer = document.createElement('div');
    ipContainer.className = 'account-ip-info';

    // Insert after info block but before actions
    const infoBlock = item.querySelector('.account-info');
    if (infoBlock) {
      infoBlock.appendChild(ipContainer);
    }
  }

  // Render loading state initially if empty
  if (!ipContainer.hasChildNodes()) {
    const loadingRow = document.createElement('div');
    loadingRow.className = 'ip-row';

    const loadingText = document.createElement('span');
    loadingText.className = 'loading-dots';
    loadingText.textContent = '获取IP信息';
    loadingRow.appendChild(loadingText);

    // Always show shield icon
    const envIcon = createEnvInfoIcon(account);
    envIcon.classList.add('inline-shield');
    loadingRow.appendChild(envIcon);

    ipContainer.appendChild(loadingRow);
  }

  try {
    // Fetch network info from main process
    const result = await window.electronAPI.invoke('env:get-account-network-info', account.id);

    if (result.success) {
      // Inject account into result for renderIPDetails to use
      result._account = account;
      renderIPDetails(ipContainer, result, account);
      account.lastIPInfo = result;
      account.lastIPInfoTimestamp = Date.now();
    } else {
      renderIPError(ipContainer, result.error, result.message, account);
    }
  } catch (error) {
    console.error(`[Sidebar] Failed to fetch IP info for account ${account.id}:`, error);
    // Show actual error message for debugging
    const errorMsg = error.message && error.message.includes('No handler')
      ? '需重启应用'
      : (error.message || '获取失败');
    renderIPError(ipContainer, errorMsg, error.message, account);
  }
}

/**
 * Render IP details into container (Simplified Version)
 * @param {HTMLElement} container - Container element
 * @param {Object} info - IP info object
 * @param {Object} account - Account object
 */
function renderIPDetails(container, info, account) {
  container.innerHTML = '';

  // Simplification: One compact row
  const row = document.createElement('div');
  row.className = 'ip-row compact';

  // Icon instead of Tag
  const iconSpan = document.createElement('span');
  iconSpan.className = `ip-icon ${info.isProxy ? 'proxy' : 'local'}`;
  // Use simple visual indicators: Plane for proxy, House for local
  iconSpan.textContent = info.isProxy ? '✈️' : '🏠';
  row.appendChild(iconSpan);

  // IP Address (Masked by default)
  const ipSpan = document.createElement('span');
  ipSpan.className = 'ip-address';
  const fullIP = info.ip;
  // Simple mask: last two segments
  const maskedIP = info.ip.replace(/\.\d+\.\d+$/, '.*.*').replace(/:\w+:\w+$/, ':*:*');
  ipSpan.textContent = maskedIP;
  ipSpan.dataset.full = fullIP;
  ipSpan.dataset.masked = maskedIP;
  ipSpan.dataset.visible = 'false';
  ipSpan.title = '点击切换显示完整IP';

  const toggleVisibility = (e) => {
    e.stopPropagation();
    const isVisible = ipSpan.dataset.visible === 'true';
    if (isVisible) {
      ipSpan.textContent = ipSpan.dataset.masked;
      ipSpan.dataset.visible = 'false';
    } else {
      ipSpan.textContent = ipSpan.dataset.full;
      ipSpan.dataset.visible = 'true';
    }
  };
  ipSpan.addEventListener('click', toggleVisibility);
  row.appendChild(ipSpan);

  // Shield Icon (Environment Info) - Placed after IP
  const targetAccount = account || info._account;
  if (targetAccount) {
    const envIcon = createEnvInfoIcon(targetAccount);
    envIcon.classList.add('inline-shield');
    row.appendChild(envIcon);
  }

  // Location - add to IP title for hover display
  if (info.location) {
    const country = info.location.country || info.location.countryCode || '';
    const city = info.location.city ? `, ${info.location.city}` : '';
    const fullLocation = `${country}${city}`;

    // Update IP title to include location
    ipSpan.title = `点击切换显示完整IP\n位置: ${fullLocation}`;
  }

  container.appendChild(row);
}

/**
 * Render IP error state
 * @param {HTMLElement} container - Container element
 * @param {string} message - Error message
 * @param {string} fullError - Full error message for tooltip
 * @param {Object} account - Account object
 */
function renderIPError(container, message, fullError, account) {
  container.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'ip-row compact';
  if (fullError) row.title = fullError;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'ip-icon error';
  iconSpan.textContent = '⚠️';
  row.appendChild(iconSpan);

  const metaSpan = document.createElement('span');
  metaSpan.className = 'ip-meta';
  metaSpan.textContent = message;
  row.appendChild(metaSpan);

  // Shield Icon
  if (account) {
    const envIcon = createEnvInfoIcon(account);
    envIcon.classList.add('inline-shield');
    row.appendChild(envIcon);
  }

  container.appendChild(row);
}

/**
 * Create environment info icon button
 * @param {Object} account - Account object
 * @returns {HTMLElement} Button element
 */
function createEnvInfoIcon(account) {
  const btn = document.createElement('button');
  btn.className = 'account-env-icon';
  btn.setAttribute('aria-label', '环境信息');
  btn.title = '加载中…';
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22S20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"></path><path d="M9 12L11 14L15 10"></path></svg>';

  const updateTooltip = async () => {
    const ua = await getAccountUA(account.id);
    const localIP = await getLocalPublicIP(false);
    const proxyInfo = await getProxyIPInfo(account);
    const proxyIP = proxyInfo && proxyInfo.isProxy ? (proxyInfo.ip || '') : '直连';

    // Parse simplified UA
    let simpleUA = '默认';
    if (ua) {
      const isWin = ua.includes('Windows');
      const isMac = ua.includes('Macintosh');
      const isLinux = ua.includes('Linux');
      const os = isWin ? 'Win' : (isMac ? 'Mac' : (isLinux ? 'Linux' : 'OS'));

      const chromeMatch = ua.match(/Chrome\/(\d+)/);
      const browser = chromeMatch ? `Chrome ${chromeMatch[1]}` : 'Browser';
      simpleUA = `${os} / ${browser}`;
    }

    const tip = `代理 IP：${proxyIP}\n本机 IP：${localIP || '获取中...'}\n运行环境：${simpleUA}\n\n完整 UA：\n${ua}`;

    if (btn.dataset.originalTitle) {
      btn.dataset.originalTitle = tip;
    } else {
      btn.title = tip;
    }
  };

  btn.addEventListener('mouseover', (e) => {
    if (!e.isTrusted) return;
    const loadingText = 'UA/IP加载中…';
    if (btn.dataset.originalTitle) {
      btn.dataset.originalTitle = loadingText;
      btn.removeAttribute('title');
    } else {
      btn.title = loadingText;
    }
    setTimeout(() => {
      const evt = new MouseEvent('mouseover', { bubbles: true });
      btn.dispatchEvent(evt);
    }, 0);
    updateTooltip().then(() => {
      const evt2 = new MouseEvent('mouseover', { bubbles: true });
      btn.dispatchEvent(evt2);
    });
  });

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    await updateTooltip();
    const evt = new MouseEvent('mouseover', { bubbles: true });
    btn.dispatchEvent(evt);
    setTimeout(() => {
      const outEvt = new MouseEvent('mouseout', { bubbles: true });
      btn.dispatchEvent(outEvt);
    }, 2000);
  });

  return btn;
}

/**
 * Get local public IP with caching
 * @param {boolean} force - Force refresh cache
 * @returns {Promise<string|null>} Local IP or null
 */
async function getLocalPublicIP(force = false) {
  if (typeof window === 'undefined' || !window.electronAPI) return null;

  const now = Date.now();
  if (!force && _localIPCache.ip && now - _localIPCache.time < 60000) {
    return _localIPCache.ip;
  }

  try {
    const res = await window.electronAPI.invoke('env:detect-network');
    if (res && res.success) {
      _localIPCache = { ip: res.ip, time: Date.now() };
      return res.ip;
    }
  } catch (e) {
    console.error('[Sidebar] Failed to get local IP:', e);
  }
  return _localIPCache.ip;
}

/**
 * Get account User-Agent
 * @param {string} accountId - Account ID
 * @returns {Promise<string>} User-Agent string
 */
async function getAccountUA(accountId) {
  if (typeof window === 'undefined' || !window.electronAPI) {
    return typeof navigator !== 'undefined' ? navigator.userAgent : '';
  }

  try {
    const res = await window.electronAPI.getFingerprint(accountId);
    if (res && res.success && res.config) {
      const cfg = res.config;
      return cfg.userAgent || (cfg.navigator && cfg.navigator.userAgent) || navigator.userAgent;
    }
  } catch (e) {
    console.error('[Sidebar] Failed to get account UA:', e);
  }
  return typeof navigator !== 'undefined' ? navigator.userAgent : '';
}

/**
 * Get proxy IP info for account with caching
 * @param {Object} account - Account object
 * @returns {Promise<Object|null>} IP info or null
 */
async function getProxyIPInfo(account) {
  if (typeof window === 'undefined' || !window.electronAPI) return null;

  const now = Date.now();
  if (account.lastIPInfo && account.lastIPInfoTimestamp && now - account.lastIPInfoTimestamp < 60000) {
    return account.lastIPInfo;
  }

  try {
    const res = await window.electronAPI.invoke('env:get-account-network-info', account.id);
    if (res && res.success) {
      account.lastIPInfo = res;
      account.lastIPInfoTimestamp = Date.now();
      return res;
    }
  } catch (e) {
    console.error('[Sidebar] Failed to get proxy IP info:', e);
  }
  return account.lastIPInfo || null;
}

/**
 * Refresh IP information for a specific account
 * Used after view restart to update IP display when proxy settings have changed
 * @param {string} accountId - Account ID to refresh IP info for
 */
async function refreshAccountIPInfo(accountId) {
  if (typeof document === 'undefined') return;

  const accountList = document.getElementById('account-list');
  if (!accountList) return;
  if (typeof window === 'undefined' || !window.electronAPI) return;

  const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
  if (!item) return;

  const state = getState();
  const account = state.getAccountById(accountId);
  if (!account) return;

  // Clear cached IP info to force refresh
  delete account.lastIPInfo;

  // Find or create IP container
  let ipContainer = item.querySelector('.account-ip-info');
  if (!ipContainer) {
    ipContainer = document.createElement('div');
    ipContainer.className = 'account-ip-info';
    const infoBlock = item.querySelector('.account-info');
    if (infoBlock) {
      infoBlock.appendChild(ipContainer);
    }
  }

  // Show loading state, keep shield icon visible
  ipContainer.innerHTML = '';
  const loadingRow = document.createElement('div');
  loadingRow.className = 'ip-row';
  const loadingText = document.createElement('span');
  loadingText.className = 'loading-dots';
  loadingText.textContent = '更新IP信息';
  loadingRow.appendChild(loadingText);
  const envIcon = createEnvInfoIcon(account);
  envIcon.classList.add('inline-shield');
  loadingRow.appendChild(envIcon);
  ipContainer.appendChild(loadingRow);

  // Delay slightly to ensure the view's proxy is fully configured
  setTimeout(async () => {
    try {
      const result = await window.electronAPI.invoke('env:get-account-network-info', accountId);

      if (result.success) {
        renderIPDetails(ipContainer, result, account);
        account.lastIPInfo = result;
        account.lastIPInfoTimestamp = Date.now();
        console.log(`[Sidebar] IP info refreshed for account ${accountId}:`, result.ip, result.isProxy ? '(proxy)' : '(local)');
      } else {
        renderIPError(ipContainer, result.error, result.message, account);
        console.warn(`[Sidebar] Failed to refresh IP info for account ${accountId}:`, result.error);
      }
    } catch (error) {
      console.error(`[Sidebar] Error refreshing IP info for account ${accountId}:`, error);
      const errorMsg = error.message && error.message.includes('No handler')
        ? '需重启应用'
        : (error.message || '获取失败');
      renderIPError(ipContainer, errorMsg, error.message, account);
    }
  }, 500); // Small delay to ensure proxy is active
}

// ============================================================================
// Exports
// ============================================================================

const ipInfoExports = {
  // Main functions
  fetchAndRenderIPInfo,
  renderIPDetails,
  renderIPError,
  createEnvInfoIcon,
  // IP retrieval
  getLocalPublicIP,
  getAccountUA,
  getProxyIPInfo,
  // Refresh
  refreshAccountIPInfo
};

// Export for CommonJS (Node.js/testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ipInfoExports;
}

// Export for browser global (IIFE pattern)
if (typeof window !== 'undefined') {
  window.SidebarIPInfo = ipInfoExports;
}
