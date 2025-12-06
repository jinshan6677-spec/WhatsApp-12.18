/**
 * Sidebar component for account management
 * Handles account list rendering, selection, and CRUD operations
 *
 * 设计目标：
 * - KISS：集中管理账号状态和视图渲染，避免散落的 DOM 操作
 * - DRY：账号行的操作按钮和状态展示只实现一份渲染逻辑
 * - 单一职责：事件 -> 更新内存状态 -> 渲染 UI
 */

(function () {
  'use strict';

  // State
  let accounts = [];
  let activeAccountId = null;

  // DOM elements
  const accountList = document.getElementById('account-list');
  const emptyState = document.getElementById('empty-state');
  const addAccountBtn = document.getElementById('add-account');
  const searchInput = document.getElementById('account-search');

  // Search state
  let filterQuery = '';

  // Debounce for high-frequency updates (e.g. accounts-updated)
  const updateTimers = new Map();
  const DEBOUNCE_DELAY = 100; // ms

  /**
   * Initialize the sidebar component
   */
  function init() {
    setupEventListeners();
    loadAccounts();
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Add account button
    if (addAccountBtn) {
      addAccountBtn.addEventListener('click', handleAddAccount);
    }

    // Search input
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        filterQuery = e.target.value.trim().toLowerCase();
        renderAccountList();
      });
    }

    // Sidebar toggle button
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    if (sidebarToggleBtn) {
      sidebarToggleBtn.addEventListener('click', toggleSidebar);
    }

    // Restore sidebar collapsed state from localStorage
    restoreSidebarState();

    // Listen for account updates from main process
    if (window.electronAPI) {
      window.electronAPI.on('accounts-updated', handleAccountsUpdated);
      window.electronAPI.on('account-switched', handleAccountSwitched);
      window.electronAPI.on('account-status-changed', handleAccountStatusChanged);
      window.electronAPI.on('account:active-changed', handleActiveAccountChanged);

      // View manager events（登录/连接状态）
      window.electronAPI.on('view-manager:view-loading', handleViewLoading);
      window.electronAPI.on('view-manager:view-ready', handleViewReady);
      window.electronAPI.on('view-manager:view-error', handleViewError);
      window.electronAPI.on('view-manager:login-status-changed', handleLoginStatusChanged);
      window.electronAPI.on('view-manager:view-crashed', handleViewCrashed);
      window.electronAPI.on('view-manager:connection-status-changed', handleConnectionStatusChanged);
      window.electronAPI.on('view-manager:account-profile-updated', handleAccountProfileUpdated);

      // Manual account control events（打开/关闭账号）
      window.electronAPI.on('view-manager:account-opening', handleAccountOpening);
      window.electronAPI.on('view-manager:account-opened', handleAccountOpened);
      window.electronAPI.on('view-manager:account-open-failed', handleAccountOpenFailed);
      window.electronAPI.on('view-manager:account-closing', handleAccountClosing);
      window.electronAPI.on('view-manager:account-closed', handleAccountClosed);
      window.electronAPI.on('view-manager:account-close-failed', handleAccountCloseFailed);
    }
  }

  /**
   * Load accounts from main process
   */
  async function loadAccounts() {
    if (!window.electronAPI || !accountList) return;

    try {
      const accountsData = await window.electronAPI.invoke('get-accounts');
      accounts = accountsData || [];

      // Get active account
      const activeResult = await window.electronAPI.invoke('account:get-active');
      if (activeResult && activeResult.success && activeResult.accountId) {
        activeAccountId = activeResult.accountId;
      }

      // Get running status for all accounts
      const statusResult = await window.electronAPI.invoke('get-all-account-statuses');
      if (statusResult && statusResult.success && statusResult.statuses) {
        mergeRunningStatuses(statusResult.statuses);
      }

      // Get login status for all accounts (important for logged-in accounts)
      await refreshLoginStatusesForAllAccounts();

      await renderAccountList();
    } catch (error) {
      console.error('Failed to load accounts:', error);
      showError('加载账号失败');
    }
  }

  /**
   * Merge running status info into current accounts
   */
  function mergeRunningStatuses(statuses) {
    accounts.forEach((account) => {
      const statusInfo = statuses[account.id];
      if (statusInfo) {
        // 只有当状态确实发生变化时才更新，避免不必要的状态重置
        const oldStatus = account.runningStatus;
        const oldIsRunning = account.isRunning;
        const newStatus = statusInfo.status;
        const newIsRunning = !!statusInfo.isRunning;

        // 特殊保护：如果账号已经是 connected 状态，不要用 loading 状态覆盖
        // 这可以防止新账号创建过程中错误地影响已有账号的状态
        if (oldStatus === 'connected' && newStatus === 'loading') {
          console.warn(`[Sidebar] Protecting account ${account.id} from incorrect status change: connected -> loading`);
          return; // 跳过这次更新
        }

        // 检查状态是否真的发生了变化
        const statusChanged = oldStatus !== newStatus || oldIsRunning !== newIsRunning;

        if (statusChanged) {
          account.runningStatus = newStatus;
          account.isRunning = newIsRunning;

          // 记录状态变化，便于调试
          if (oldStatus === 'connected' && newStatus !== 'connected') {
            console.warn(`[Sidebar] Account ${account.id} status changed from ${oldStatus} to ${newStatus}`);
          }
        }
      }
    });
  }

  /**
   * 刷新所有账号的登录状态
   */
  async function refreshLoginStatusesForAllAccounts() {
    if (!window.electronAPI) return;

    for (const account of accounts) {
      try {
        // 获取账号的登录状态
        const loginResult = await window.electronAPI.getLoginStatus(account.id);
        if (loginResult && loginResult.success) {
          account.loginStatus = loginResult.isLoggedIn;
          account.hasQRCode = loginResult.hasQRCode;
          account.loginInfo = loginResult.loginInfo;
          console.log(`[Sidebar] Refreshed login status for account ${account.id}:`, {
            isLoggedIn: loginResult.isLoggedIn,
            hasQRCode: loginResult.hasQRCode
          });
        }
      } catch (error) {
        console.warn(`[Sidebar] Failed to get login status for account ${account.id}:`, error);
        // 设置默认值
        account.loginStatus = false;
        account.hasQRCode = false;
      }
    }
  }

  /**
   * 同步单个账号状态与运行状态，确保状态一致性
   * 优化状态优先级：登录状态 > 运行状态 > 默认状态
   */
  function syncAccountStatusWithRunningStatus(account) {
    if (!account) return;

    const runningStatus = account.runningStatus || 'not_started';
    const currentStatus = account.status || 'offline';
    const loginStatus = account.loginStatus;
    const hasQRCode = account.hasQRCode;
    const connectionDetails = account.connectionDetails || {};

    // 根据状态优先级确定正确的显示状态
    let correctStatus = currentStatus;
    let statusReason = '';

    // 第一优先级：明确的登录状态
    if (loginStatus === true) {
      // 仅当账号视图正在运行时，才将显示状态设为在线并修正运行状态
      if (account.isRunning) {
        correctStatus = 'online';
        statusReason = 'logged in';
        if (runningStatus === 'loading') {
          account.runningStatus = 'connected';
          account.isRunning = true;
          console.log(`[Sidebar] Updated running status for logged-in account ${account.id} to 'connected'`);
        }
      } else {
        // 视图已关闭时，不应强制切换为运行中，保持离线与可“打开”按钮
        correctStatus = 'offline';
        statusReason = 'logged in (view closed)';
        if (runningStatus !== 'not_started') {
          account.runningStatus = 'not_started';
          account.isRunning = false;
        }
      }
    } else if (loginStatus === false) {
      // 明确未登录的账号
      if (hasQRCode) {
        correctStatus = 'offline';
        statusReason = 'logged out with QR';
      } else {
        correctStatus = 'offline';
        statusReason = 'logged out';
      }
    }
    // 第二优先级：明确的连接状态
    else if (connectionDetails.needsQRScan === true) {
      correctStatus = 'offline';
      statusReason = 'needs QR scan';
    } else if (connectionDetails.isLoggedIn === true) {
      correctStatus = 'online';
      statusReason = 'connection details show logged in';
    }
    // 第三优先级：运行状态
    else {
      switch (runningStatus) {
        case 'connected':
          correctStatus = 'online';
          statusReason = 'running status connected';
          break;
        case 'loading':
          correctStatus = 'loading';
          statusReason = 'running status loading';
          break;
        case 'error':
          correctStatus = 'error';
          statusReason = 'running status error';
          break;
        case 'not_started':
          correctStatus = 'offline';
          statusReason = 'running status not started';
          break;
        default:
          correctStatus = 'offline';
          statusReason = 'unknown running status';
      }
    }

    // 只有在状态不一致时才更新
    if (currentStatus !== correctStatus) {
      console.log(`[Sidebar] Syncing account ${account.id} status from '${currentStatus}' to '${correctStatus}' (${statusReason}, running: ${runningStatus}, loggedIn: ${loginStatus}, hasQR: ${hasQRCode})`);
      account.status = correctStatus;

      // 立即更新UI中的状态，确保状态同步
      updateAccountStatus(account.id, correctStatus);
    }
  }

  /**
   * 同步所有账号状态与运行状态，确保状态一致性
   */
  function syncAccountStatusesWithRunningStatus() {
    accounts.forEach((account) => {
      syncAccountStatusWithRunningStatus(account);
    });
  }

  /**
   * Render the account list
   * 使用 document fragment 做批量更新，减少重排
   */
  async function renderAccountList() {
    if (!accountList) return;

    // Clear existing items
    const existingItems = accountList.querySelectorAll('.account-item');
    existingItems.forEach((item) => item.remove());

    // Filter accounts
    const filteredAccounts = accounts.filter(account => {
      if (!filterQuery) return true;
      const name = (account.name || '').toLowerCase();
      const phone = (account.phoneNumber || '').toLowerCase();
      const note = (account.note || '').toLowerCase();
      return name.includes(filterQuery) || phone.includes(filterQuery) || note.includes(filterQuery);
    });

    // Show/hide empty state (based on filter result)
    if (filteredAccounts.length === 0) {
      if (emptyState) {
        // If we have accounts but filtered to 0, show "no results" state?
        // For now just show empty state or maybe a specific "no results" state
        emptyState.classList.remove('hidden');
        if (accounts.length > 0) {
          // Optional: Change empty state text for search results
          const emptyText = emptyState.querySelector('p');
          if (emptyText) emptyText.textContent = '没有找到匹配的账号';
        }
      }
      return;
    }

    if (emptyState) {
      emptyState.classList.add('hidden');
    }

    // Ensure running status is up-to-date
    // 修复：避免用可能不完整的状态信息覆盖已有状态
    if (window.electronAPI) {
      try {
        const statusResult = await window.electronAPI.getAllAccountStatuses();
        if (statusResult && statusResult.success && statusResult.statuses) {
          // 先记录当前状态，用于调试
          const beforeStatuses = {};
          accounts.forEach(acc => {
            beforeStatuses[acc.id] = {
              runningStatus: acc.runningStatus,
              isRunning: acc.isRunning
            };
          });

          mergeRunningStatuses(statusResult.statuses);
          // 同步账号状态与运行状态
          syncAccountStatusesWithRunningStatus();

          // 记录状态变化，便于调试
          Object.keys(beforeStatuses).forEach(accountId => {
            const before = beforeStatuses[accountId];
            const after = accounts.find(acc => acc.id === accountId);
            if (after && before.runningStatus === 'connected' && after.runningStatus === 'loading') {
              console.warn(`[Sidebar] Account ${accountId} status was incorrectly changed from connected to loading during status sync`);
            }
          });
        }
      } catch (error) {
        console.error('Failed to get account statuses:', error);
      }
    }

    // Sort accounts by order
    const sortedAccounts = [...filteredAccounts].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 999;
      const orderB = b.order !== undefined ? b.order : 999;
      return orderA - orderB;
    });

    const fragment = document.createDocumentFragment();

    sortedAccounts.forEach((account) => {
      const accountItem = createAccountItem(account);
      fragment.appendChild(accountItem);
    });

    accountList.appendChild(fragment);

    // DOM更新完成后，确保所有账号状态正确显示
    // 这对于页面刷新和排序后的状态恢复特别重要
    setTimeout(() => {
      sortedAccounts.forEach((account) => {
        // 确保账号状态与运行状态同步
        syncAccountStatusWithRunningStatus(account);

        // 如果账号已登录，确保显示在线状态
        if (account.loginStatus === true) {
          updateAccountStatus(account.id, 'online');
        }
      });

      console.log(`[Sidebar] Status recovery completed for ${sortedAccounts.length} accounts`);
    }, 100); // 短暂延迟确保DOM完全更新
  }

  /**
   * Create an account item element
   */
  /**
   * Create an account item element
   */
  function createAccountItem(account) {
    const item = document.createElement('div');
    item.className = 'account-item';
    item.dataset.accountId = account.id;
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `切换到 ${account.name}`);

    if (account.id === activeAccountId) {
      item.classList.add('active');
    }

    // Avatar container
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'account-avatar-container';

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'account-avatar';
    avatar.textContent = getAccountInitial(account.name);
    avatar.style.background = getAccountColor(account.id);

    // Status Dot (Online/Offline indicator on avatar)
    const statusDot = document.createElement('div');
    statusDot.className = 'status-dot';
    renderStatusDot(account, statusDot);

    avatarContainer.appendChild(avatar);
    avatarContainer.appendChild(statusDot);

    // Info
    const info = document.createElement('div');
    info.className = 'account-info';

    const header = document.createElement('div');
    header.className = 'account-header';

    const name = document.createElement('div');
    name.className = 'account-name';
    name.textContent = account.name || '未命名账号';
    // Removed title

    header.appendChild(name);

    // Secondary info (Phone + Note)
    const secondary = document.createElement('div');
    secondary.className = 'account-secondary';

    // Phone Number
    const phoneEl = document.createElement('div');
    phoneEl.className = 'account-phone';
    if (account.phoneNumber) {
      phoneEl.textContent = account.phoneNumber;
      // Removed title
      phoneEl.onclick = (e) => {
        e.stopPropagation();
        copyToClipboard(account.phoneNumber, phoneEl);
      };
    } else {
      phoneEl.style.display = 'none';
    }
    secondary.appendChild(phoneEl);

    // Note (Editable)
    const noteEl = document.createElement('div');
    noteEl.className = 'account-note';
    noteEl.contentEditable = true;
    noteEl.textContent = account.note || '';
    // Removed redundant title for note

    // Stop propagation for click to prevent selecting account
    noteEl.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Handle Note Save
    noteEl.addEventListener('blur', () => {
      const newNote = noteEl.textContent.trim();
      if (newNote !== (account.note || '')) {
        saveAccountNote(account.id, newNote);
        account.note = newNote; // Optimistic update

        // Update collapsed display name immediately
        const collapsedNameEl = item.querySelector('.account-collapsed-name');
        if (collapsedNameEl) {
          collapsedNameEl.textContent = newNote || account.profileName || account.name || '未命名';
        }
      }
    });

    // Auto-save on mouse leave (as requested)
    noteEl.addEventListener('mouseleave', () => {
      if (document.activeElement === noteEl) {
        noteEl.blur();
      }
    });

    // Handle Enter key to save
    noteEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        noteEl.blur();
      }
    });

    secondary.appendChild(noteEl);

    info.appendChild(header);
    info.appendChild(secondary);

    // Collapsed display name (shows note or nickname when sidebar is collapsed)
    const collapsedName = document.createElement('div');
    collapsedName.className = 'account-collapsed-name';
    // Priority: note > profileName > name
    collapsedName.textContent = account.note || account.profileName || account.name || '未命名';
    info.appendChild(collapsedName);

    // Quick Actions (Hover only)
    const actions = document.createElement('div');
    actions.className = 'account-actions';

    // 确保已登录账号的运行状态正确
    if (account.loginStatus === true && (account.runningStatus === 'loading' || account.runningStatus === 'not_started')) {
      account.runningStatus = 'connected';
      account.isRunning = true;
    }

    renderQuickActions(account, actions);

    // Assemble
    item.appendChild(avatarContainer);
    item.appendChild(info);
    item.appendChild(actions);

    // Selection handlers
    item.addEventListener('click', () => handleAccountSelect(account.id));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleAccountSelect(account.id);
      }
    });

    // Context Menu
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      handleContextMenu(e, account);
    });

    // Apply profile info (真实头像 / 昵称 / 号码）如果已知
    applyAccountProfileToItem(account, item);

    // Fetch and render IP info
    setTimeout(() => fetchAndRenderIPInfo(account, item), 10); // Non-blocking

    return item;
  }

  /**
   * 根据账号 profile 信息更新账号项的头像 / 名称 / 号码展示
   * @param {Object} account - 账号对象
   * @param {HTMLElement} item - 对应的账号 DOM 节点
   */
  /**
   * 根据账号 profile 信息更新账号项的头像 / 名称 / 号码展示
   * @param {Object} account - 账号对象
   * @param {HTMLElement} item - 对应的账号 DOM 节点
   */
  function applyAccountProfileToItem(account, item) {
    if (!account || !item) return;

    const displayName = account.profileName || account.name || '未命名账号';

    // 更新名称
    const nameEl = item.querySelector('.account-name');
    if (nameEl) {
      nameEl.textContent = displayName;
      // Removed redundant title
    }

    // 更新头像
    const avatarEl = item.querySelector('.account-avatar');
    if (avatarEl) {
      // 清理旧内容
      avatarEl.textContent = '';
      const existingImg = avatarEl.querySelector('img');
      if (existingImg) {
        existingImg.remove();
      }
      avatarEl.style.background = '';

      if (account.avatarUrl) {
        const img = document.createElement('img');
        img.src = account.avatarUrl;
        img.alt = displayName;
        img.className = 'account-avatar-image';
        avatarEl.appendChild(img);
      } else {
        avatarEl.textContent = getAccountInitial(displayName);
        avatarEl.style.background = getAccountColor(account.id);
      }
    }

    // 更新号码和备注
    const secondaryEl = item.querySelector('.account-secondary');
    if (secondaryEl) {
      // Update Phone
      let phoneEl = secondaryEl.querySelector('.account-phone');
      if (!phoneEl) {
        phoneEl = document.createElement('div');
        phoneEl.className = 'account-phone';
        secondaryEl.insertBefore(phoneEl, secondaryEl.firstChild);
      }

      if (account.phoneNumber) {
        phoneEl.textContent = account.phoneNumber;
        // Removed redundant title
        phoneEl.style.display = '';
        phoneEl.onclick = (e) => {
          e.stopPropagation();
          copyToClipboard(account.phoneNumber, phoneEl);
        };
      } else {
        phoneEl.style.display = 'none';
      }

      // Update Note (only if not currently focused to avoid overwriting user input)
      let noteEl = secondaryEl.querySelector('.account-note');
      if (noteEl && document.activeElement !== noteEl) {
        noteEl.textContent = account.note || '';
      }
    }

    // Update collapsed display name (priority: note > profileName > name)
    const collapsedNameEl = item.querySelector('.account-collapsed-name');
    if (collapsedNameEl) {
      collapsedNameEl.textContent = account.note || account.profileName || account.name || '未命名';
    }
  }

  /**
   * Fetch and render IP information for an account
   * @param {Object} account - Account object
   * @param {HTMLElement} item - Account item element
   */
  async function fetchAndRenderIPInfo(account, item) {
    if (!account || !item || !window.electronAPI) return;

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
      ipContainer.innerHTML = '<div class="ip-row"><span class="loading-dots">获取IP信息</span></div>';
    }

    try {
      // Fetch network info from main process
      const result = await window.electronAPI.invoke('env:get-account-network-info', account.id);

      if (result.success) {
        renderIPDetails(ipContainer, result);
        // Cache result on account object if needed for avoiding re-fetch too often
        account.lastIPInfo = result;
      } else {
        renderIPError(ipContainer, result.error);
      }
    } catch (error) {
      console.error(`[Sidebar] Failed to fetch IP info for account ${account.id}:`, error);
      // Show actual error message for debugging (e.g., "No handler registered")
      const errorMsg = error.message && error.message.includes('No handler')
        ? '需重启应用'
        : (error.message || '获取失败');
      renderIPError(ipContainer, errorMsg, error.message);
    }
  }

  /**
   * Render IP details into container (Simplified Version)
   */
  function renderIPDetails(container, info) {
    container.innerHTML = '';

    // Simplification: One compact row
    const row = document.createElement('div');
    row.className = 'ip-row compact';

    // Icon instead of Tag
    const iconSpan = document.createElement('span');
    iconSpan.className = `ip-icon ${info.isProxy ? 'proxy' : 'local'}`;
    // Use simple visual indicators: Plane for proxy, House for local
    iconSpan.textContent = info.isProxy ? '✈️' : '🏠';
    // Removed redundant title
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

    // Location
    if (info.location) {
      // Just set tooltips for row or ipSpan, don't show text
      // Requirement: hover IP -> show "Vietnam, Nha Trang"
      // So we append the location info to the IP's title, OR we keep the flag.
      // User said: "I hope when mouse move to IP show... Vietnam, Nha Trang" and "No need to display VN Vietnam directly"

      const country = info.location.country || info.location.countryCode || '';
      const city = info.location.city ? `, ${info.location.city}` : '';
      const fullLocation = `${country}${city}`;

      // Update IP title to include location
      ipSpan.title = `点击切换显示完整IP\n位置: ${fullLocation}`;

      // OPTIONAL: If user wants NO text "VN Vietnam" displayed at all, we remove the locSpan creation.
      // Based on: "不需要直接显示VN Vietnam" (No need to display VN Vietnam directly)
      // So we ONLY show IP and Icon.

      // However, user screenshot shows flag? No, user screenshot shows "183.80.*.* VN Vietnam" and says "Don't want this".
      // So we just remove the location span entirely from visual flow.
    }

    container.appendChild(row);
  }

  function renderIPError(container, message, fullError) {
    container.innerHTML = `<div class="ip-row compact" title="${fullError || ''}"><span class="ip-icon error">⚠️</span> <span class="ip-meta">${message}</span></div>`;
  }

  function getFlagEmoji(countryCode) {
    if (!countryCode) return '';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  }

  /**
   * 渲染账号的状态展示（文本 + class + tooltip）
   * 统一处理 loginStatus / connectionStatus / hasQRCode / error 等字段
   */
  function renderStatusDot(account, dotElement) {
    if (!dotElement || !account) return;

    const statusValue = account.status || account.connectionStatus || 'offline';
    const loginStatus = account.loginStatus;
    const hasQRCode = account.hasQRCode;
    const details = account.connectionDetails;
    const error = account.connectionError;

    dotElement.className = 'status-dot';

    if (statusValue === 'offline' && (loginStatus === false || hasQRCode || (details && details.needsQRScan))) {
      dotElement.classList.add('warning');
      dotElement.title = '需要登录';
    } else if (statusValue === 'online') {
      dotElement.classList.add('online');
      // No title for online
    } else if (statusValue === 'loading') {
      dotElement.classList.add('loading');
      // No title for loading (animation implies it)
    } else if (statusValue === 'error') {
      dotElement.classList.add('error');
      dotElement.title = (error && error.message) || '连接错误';
    } else {
      dotElement.classList.add('offline');
      // No title for offline
    }
  }
  /**
   * Render quick actions (Open/Close)
   */
  function renderQuickActions(account, actions) {
    if (!actions || !account) return;

    actions.innerHTML = '';

    const runningStatus = account.runningStatus || 'not_started';
    const isRunning = !!account.isRunning;

    // Only show primary action button
    const actionBtn = document.createElement('button');
    actionBtn.className = 'action-btn';

    if (runningStatus === 'not_started' || !isRunning) {
      actionBtn.innerHTML = '▶'; // Play icon
      actionBtn.title = '打开账号';
      actionBtn.classList.add('start');
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleOpenAccount(account.id);
      });
      actions.appendChild(actionBtn);
    } else if (runningStatus === 'loading') {
      const spinner = document.createElement('div');
      spinner.className = 'mini-spinner';
      actions.appendChild(spinner);
    } else if (runningStatus === 'connected' || isRunning) {
      actionBtn.innerHTML = '⏹'; // Stop icon
      actionBtn.title = '关闭账号';
      actionBtn.classList.add('stop');
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCloseAccount(account.id);
      });
      actions.appendChild(actionBtn);
    } else if (runningStatus === 'error') {
      actionBtn.innerHTML = '↻'; // Retry icon
      actionBtn.title = '重试';
      actionBtn.classList.add('retry');
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleRetryAccount(account.id);
      });
      actions.appendChild(actionBtn);
    }
  }

  /**
   * Handle Context Menu
   */
  function handleContextMenu(e, account) {
    // Remove existing context menus
    const existing = document.querySelectorAll('.custom-context-menu');
    existing.forEach(el => el.remove());

    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';

    const options = [
      { label: '打开账号', icon: '▶', action: () => handleOpenAccount(account.id), visible: !account.isRunning },
      { label: '关闭账号', icon: '⏹', action: () => handleCloseAccount(account.id), visible: account.isRunning },
      { label: '编辑账号', icon: '⚙️', action: () => handleEditAccount(account.id) },
      { label: '环境设置', icon: '🌐', action: () => window.EnvironmentSettingsPanel?.open(account.id) },
      { label: '复制号码', icon: '📋', action: () => copyToClipboard(account.phoneNumber), visible: !!account.phoneNumber },
      { type: 'separator' },
      { label: '删除账号', icon: '🗑️', action: () => handleDeleteAccount(account.id), danger: true }
    ];

    options.forEach(opt => {
      if (opt.visible === false) return;

      if (opt.type === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'menu-separator';
        menu.appendChild(sep);
        return;
      }

      const item = document.createElement('div');
      item.className = 'menu-item';
      if (opt.danger) item.classList.add('danger');

      item.innerHTML = `<span class="menu-icon">${opt.icon}</span><span class="menu-label">${opt.label}</span>`;
      item.addEventListener('click', () => {
        opt.action();
        menu.remove();
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);

    // Position menu
    const rect = menu.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;

    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width;
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Close on click outside
    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    };
    // Delay to prevent immediate closing
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  function copyToClipboard(text, element) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      console.log('Copied to clipboard');
      if (element) {
        const originalColor = element.style.color;
        element.style.color = '#25d366'; // Success color

        // Show simplified feedback
        const originalText = element.textContent;
        element.textContent = '已复制';

        setTimeout(() => {
          element.style.color = originalColor;
          element.textContent = originalText;
        }, 1000);
      }
    });
  }

  /**
   * Save account note
   */
  async function saveAccountNote(accountId, note) {
    if (!window.electronAPI) return;

    // Anti-debounce: cancel existing timer for this account if any
    const timerKey = `note-${accountId}`;
    if (updateTimers.has(timerKey)) {
      clearTimeout(updateTimers.get(timerKey));
    }

    // Set new timer
    const timerId = setTimeout(async () => {
      try {
        await window.electronAPI.invoke('update-account', accountId, { note });
        console.log(`[Sidebar] Note saved for account ${accountId}`);
      } catch (error) {
        console.error('Failed to save note:', error);
        // Optionally revert UI if failed
      } finally {
        updateTimers.delete(timerKey);
      }
    }, 300); // 300ms debounce

    updateTimers.set(timerKey, timerId);
  }

  /**
   * Get the first letter of account name for avatar
   */
  function getAccountInitial(name) {
    if (!name) return '?';
    return String(name).charAt(0).toUpperCase();
  }

  /**
   * Generate a consistent color for an account based on its ID
   */
  function getAccountColor(accountId) {
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)'
    ];

    if (!accountId) {
      return colors[0];
    }

    let hash = 0;
    for (let i = 0; i < accountId.length; i++) {
      hash = accountId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  /**
   * Get human-readable status text
   */
  function getStatusText(status) {
    const statusMap = {
      online: '在线',
      offline: '离线',
      error: '错误',
      loading: '加载中...'
    };
    return statusMap[status] || '未知';
  }

  /**
   * Handle account selection
   */
  async function handleAccountSelect(accountId) {
    if (!window.electronAPI) return;
    if (accountId === activeAccountId) {
      return;
    }

    try {
      const accountStatus = await window.electronAPI.getAccountStatus(accountId);
      if (!accountStatus || !accountStatus.isRunning) {
        console.log('Account is not running, cannot switch');
        return;
      }

      // Optimistic UI
      setActiveAccount(accountId);

      await window.electronAPI.invoke('switch-account', accountId);
    } catch (error) {
      console.error('Failed to switch account:', error);
      showError('切换账号失败');
      setActiveAccount(activeAccountId);
    }
  }

  /**
   * Set the active account in the UI
   */
  function setActiveAccount(accountId) {
    activeAccountId = accountId;

    if (!accountList) return;

    const items = accountList.querySelectorAll('.account-item');
    items.forEach((item) => {
      if (item.dataset.accountId === accountId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * Handle add account button click - Quick add with default settings
   */
  async function handleAddAccount() {
    if (!window.electronAPI) {
      showError('无法连接到主进程');
      return;
    }

    try {
      const defaultAccountName = generateDefaultAccountName();

      const defaultConfig = {
        name: defaultAccountName,
        note: '',
        autoStart: false,
        translation: {
          enabled: true,
          engine: 'google',
          targetLanguage: 'zh-CN',
          autoTranslate: false,
          translateInput: false,
          friendSettings: {}
        }
      };

      const result = await window.electronAPI.invoke('create-account', defaultConfig);
      if (result && result.success) {
        console.log('Account created successfully:', result.account);
        // 列表会通过 accounts-updated 事件刷新
      } else {
        const errorMessage = result && result.errors ? result.errors.join(', ') : '创建账号失败';
        showError(errorMessage);
      }
    } catch (error) {
      console.error('Failed to create account:', error);
      showError(`创建账号失败: ${error.message}`);
    }
  }

  /**
   * Generate default account name in format "账号 N"
   */
  function generateDefaultAccountName() {
    const existingNames = accounts.map((acc) => acc.name);
    let counter = 1;
    let defaultName = `账号 ${counter}`;

    while (existingNames.includes(defaultName)) {
      counter += 1;
      defaultName = `账号 ${counter}`;
    }

    return defaultName;
  }

  /**
   * Handle edit account button click
   */
  function handleEditAccount(accountId) {
    if (!window.electronAPI) return;
    window.electronAPI.send('account:edit', accountId);
  }

  /**
   * Handle delete account button click
   */
  async function handleDeleteAccount(accountId) {
    if (!window.electronAPI) return;

    const account = accounts.find((acc) => acc.id === accountId);
    const accountName = account ? account.name : '此账号';

    const confirmed = confirm(
      `确定要删除账号 "${accountName}" 吗？\n\n这将删除账号配置但保留会话数据。`
    );

    if (!confirmed) return;

    try {
      await window.electronAPI.invoke('delete-account', accountId);
      // 列表会通过 accounts-updated 事件刷新
    } catch (error) {
      console.error('Failed to delete account:', error);
      showError('删除账号失败');
    }
  }

  /**
   * Handle open account button click
   */
  async function handleOpenAccount(accountId) {
    if (!window.electronAPI) return;

    try {
      updateAccountRunningStatus(accountId, 'loading');

      const result = await window.electronAPI.invoke('open-account', accountId);
      if (!result || !result.success) {
        throw new Error((result && result.error) || '打开账号失败');
      }

      console.log(`Account ${accountId} opened successfully`);
    } catch (error) {
      console.error('Failed to open account:', error);
      updateAccountRunningStatus(accountId, 'error');
      showError(`打开账号失败: ${error.message}`);
    }
  }

  /**
   * Handle close account button click
   */
  async function handleCloseAccount(accountId) {
    if (!window.electronAPI) return;

    try {
      updateAccountRunningStatus(accountId, 'loading');

      const result = await window.electronAPI.invoke('close-account', accountId);
      if (!result || !result.success) {
        throw new Error((result && result.error) || '关闭账号失败');
      }

      console.log(`Account ${accountId} closed successfully`);
    } catch (error) {
      console.error('Failed to close account:', error);
      updateAccountRunningStatus(accountId, 'error');
      showError(`关闭账号失败: ${error.message}`);
    }
  }

  /**
   * Handle retry account button click (after error)
   */
  async function handleRetryAccount(accountId) {
    await handleOpenAccount(accountId);
  }

  /**
   * Update account running status in UI（只更新按钮区，不重渲染整行）
   */
  /**
   * Update account running status in UI（只更新按钮区，不重渲染整行）
   */
  function updateAccountRunningStatus(accountId, runningStatus) {
    const account = accounts.find((acc) => acc.id === accountId);
    if (!account) return;

    account.runningStatus = runningStatus;
    account.isRunning = runningStatus !== 'not_started' && runningStatus !== 'error';

    // 同步更新显示状态，确保一致性
    syncAccountStatusWithRunningStatus(account);

    if (!accountList) return;

    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (!item) return;

    // Update actions
    const actions = item.querySelector('.account-actions');
    if (actions) {
      renderQuickActions(account, actions);
    }

    // Update status dot
    const statusDot = item.querySelector('.status-dot');
    if (statusDot) {
      renderStatusDot(account, statusDot);
    }
  }

  /**
   * Handle accounts updated event from main process
   * 使用防抖避免频繁重渲染
   * 修复：保留已有账号的运行状态，避免状态丢失
   */
  function handleAccountsUpdated(accountsData) {
    const newAccounts = accountsData || [];

    // 创建旧账号状态的映射，用于保留运行状态
    const oldAccountStatusMap = new Map();
    accounts.forEach(acc => {
      oldAccountStatusMap.set(acc.id, {
        runningStatus: acc.runningStatus,
        isRunning: acc.isRunning,
        loginStatus: acc.loginStatus,
        hasQRCode: acc.hasQRCode,
        connectionStatus: acc.connectionStatus,
        status: acc.status
      });
    });

    // 合并新账号数据，保留旧账号的运行状态
    accounts = newAccounts.map(newAccount => {
      const oldStatus = oldAccountStatusMap.get(newAccount.id);
      if (oldStatus) {
        // 保留运行状态相关字段
        return {
          ...newAccount,
          runningStatus: oldStatus.runningStatus,
          isRunning: oldStatus.isRunning,
          loginStatus: oldStatus.loginStatus !== undefined ? oldStatus.loginStatus : newAccount.loginStatus,
          hasQRCode: oldStatus.hasQRCode !== undefined ? oldStatus.hasQRCode : newAccount.hasQRCode,
          connectionStatus: oldStatus.connectionStatus || newAccount.connectionStatus,
          status: oldStatus.status || newAccount.status
        };
      }
      return newAccount;
    });

    if (updateTimers.has('accountList')) {
      clearTimeout(updateTimers.get('accountList'));
    }

    updateTimers.set(
      'accountList',
      setTimeout(() => {
        renderAccountList();
        updateTimers.delete('accountList');
      }, DEBOUNCE_DELAY)
    );
  }

  /**
   * Handle account switched event from main process
   */
  function handleAccountSwitched(accountId) {
    setActiveAccount(accountId);
  }

  /**
   * Handle active account changed event from main process
   */
  function handleActiveAccountChanged(data) {
    const { accountId } = data;
    setActiveAccount(accountId);
  }

  /**
   * Handle account status changed event from main process
   */
  function handleAccountStatusChanged(data) {
    const { accountId, status } = data;
    updateAccountStatus(accountId, status);
  }



  /**
   * Handle view loading event
   */
  function handleViewLoading(data) {
    const { accountId } = data;
    console.log(`[Sidebar] handleViewLoading for ${accountId}`);
    updateAccountStatus(accountId, 'loading');
  }

  /**
   * Handle view ready event
   */
  function handleViewReady(data) {
    const { accountId, loginStatus, connectionStatus } = data;

    console.log(`[Sidebar] handleViewReady for ${accountId}:`, {
      loginStatus,
      connectionStatus
    });

    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      if (loginStatus !== undefined) {
        account.loginStatus = loginStatus;
      }
      if (connectionStatus) {
        account.connectionStatus = connectionStatus;
      }
    }

    if (connectionStatus) {
      updateAccountStatus(accountId, connectionStatus);
    } else if (loginStatus) {
      updateAccountStatus(accountId, 'online');
    } else {
      updateAccountStatus(accountId, 'offline');
    }
  }

  /**
   * Handle view error event
   */
  function handleViewError(data) {
    const { accountId, error } = data;

    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      account.connectionStatus = 'error';
      account.connectionError = error;
    }

    updateAccountStatus(accountId, 'error');

    console.error(`View error for account ${accountId}:`, error);
  }

  /**
   * Handle login status changed event
   */
  function handleLoginStatusChanged(data) {
    const { accountId, isLoggedIn, hasQRCode, loginInfo } = data;

    console.log(`[Sidebar] handleLoginStatusChanged for ${accountId}:`, {
      isLoggedIn,
      hasQRCode,
      loginInfo
    });

    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      account.loginStatus = isLoggedIn;
      account.hasQRCode = hasQRCode;
      account.loginInfo = loginInfo;
    }

    if (isLoggedIn) {
      // 已登录账号，确保运行状态也是connected
      if (account) {
        account.runningStatus = 'connected';
        account.isRunning = true;
      }
      updateAccountStatus(accountId, 'online');
    } else if (hasQRCode) {
      updateAccountStatus(accountId, 'offline');
    } else {
      // 基于运行状态决定显示状态，而不是可能过时的account.status
      const runningStatus = account ? account.runningStatus : 'not_started';
      if (runningStatus === 'connected') {
        updateAccountStatus(accountId, 'online');
      } else if (runningStatus === 'loading') {
        updateAccountStatus(accountId, 'loading');
      } else if (runningStatus === 'error') {
        updateAccountStatus(accountId, 'error');
      } else {
        updateAccountStatus(accountId, 'offline');
      }
    }
  }

  /**
   * Handle view crashed event
   */
  function handleViewCrashed(data) {
    const { accountId, error } = data;

    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      account.connectionStatus = 'error';
      account.connectionError = error;
    }

    updateAccountStatus(accountId, 'error');
    console.error(`View crashed for account ${accountId}:`, error);
    showError(`账号 "${getAccountName(accountId)}" 已崩溃，请重新加载。`);
  }

  /**
   * Handle connection status changed event
   */
  function handleConnectionStatusChanged(data) {
    const { accountId, connectionStatus, error, details, isLoggedIn, hasQRCode } = data;

    console.log(`[Sidebar] handleConnectionStatusChanged for ${accountId}:`, {
      connectionStatus,
      isLoggedIn,
      hasQRCode,
      details
    });

    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      account.connectionStatus = connectionStatus;
      account.connectionError = error || null;
      account.connectionDetails = details || null;
      if (isLoggedIn !== undefined) {
        account.loginStatus = isLoggedIn;
      }
      if (hasQRCode !== undefined) {
        account.hasQRCode = hasQRCode;
      }
    }

    updateAccountStatus(accountId, connectionStatus);

    console.log(
      `Connection status changed for account ${accountId}:`,
      connectionStatus,
      details
    );
  }

  /**
   * Handle account profile updated event (avatar / name / phone)
   */
  function handleAccountProfileUpdated(data) {
    const { accountId, phoneNumber, profileName, avatarUrl } = data || {};

    console.log('[Sidebar] account-profile-updated', data);

    const account = accounts.find((acc) => acc.id === accountId);
    if (!account) {
      return;
    }

    if (phoneNumber) {
      account.phoneNumber = phoneNumber;
    }
    if (profileName) {
      account.profileName = profileName;
    }
    if (avatarUrl) {
      account.avatarUrl = avatarUrl;
    }

    if (!accountList) return;
    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (!item) return;

    applyAccountProfileToItem(account, item);
  }

  /**
   * Update account status in UI（集中管理 DOM 更新）
   */
  function updateAccountStatus(accountId, status) {
    const account = accounts.find((acc) => acc.id === accountId);
    if (!account) {
      console.warn(`[Sidebar] Account ${accountId} not found when updating status to '${status}'`);
      return;
    }

    // 验证状态值的有效性
    const validStatuses = ['online', 'offline', 'loading', 'error'];
    if (!validStatuses.includes(status)) {
      console.error(`[Sidebar] Invalid status '${status}' for account ${accountId}. Valid statuses: ${validStatuses.join(', ')}`);
      return;
    }

    // 优化状态更新逻辑 - 优先考虑登录状态
    const loginStatus = account.loginStatus;
    const hasQRCode = account.hasQRCode;
    const currentRunningStatus = account.runningStatus || 'not_started';

    // 如果账号已登录，优先显示在线状态，即使运行状态不匹配
    if (loginStatus === true && status === 'online') {
      // 已登录账号可以设置为在线， regardless of running status
      console.log(`[Sidebar] Setting online status for logged-in account ${accountId}`);
    }
    // 如果账号有二维码或明确未登录，允许设置为离线
    else if ((loginStatus === false || hasQRCode) && status === 'offline') {
      // 未登录账号可以设置为离线
      console.log(`[Sidebar] Setting offline status for non-logged-in account ${accountId}`);
    }
    // 对于loading状态，只在没有明确登录状态时才检查运行状态
    else if (status === 'loading' && loginStatus !== true && loginStatus !== false) {
      // 只有在登录状态不明确时才检查运行状态
      if (currentRunningStatus !== 'loading') {
        console.log(`[Sidebar] Status mismatch for account ${accountId}: requested '${status}' but running status is '${currentRunningStatus}'. Will sync status.`);
        // 不跳过更新，而是同步状态
        syncAccountStatusWithRunningStatus(account);
        return;
      }
    }
    // 对于error状态，允许设置
    else if (status === 'error') {
      // 错误状态总是允许设置
      console.log(`[Sidebar] Setting error status for account ${accountId}`);
    }

    const oldStatus = account.status;
    account.status = status;

    // 只有状态真正改变时才记录日志
    if (oldStatus !== status) {
      console.log(`[Sidebar] Account ${accountId} status changed from '${oldStatus}' to '${status}'`);
    }

    if (!accountList) return;

    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (!item) {
      console.warn(`[Sidebar] Account item for ${accountId} not found in DOM when updating status`);
      return;
    }

    // 更新头像上的状态点，而不是创建额外的状态元素
    const statusDot = item.querySelector('.status-dot');
    if (statusDot) {
      renderStatusDot(account, statusDot);
    }
  }



  /**
   * Get account name by ID
   */
  function getAccountName(accountId) {
    const account = accounts.find((acc) => acc.id === accountId);
    return account ? account.name : '未知账号';
  }

  /**
   * Handle account opening event
   */
  function handleAccountOpening(data) {
    const { accountId } = data;
    updateAccountRunningStatus(accountId, 'loading');
  }

  /**
   * Handle account opened event
   */
  function handleAccountOpened(data) {
    const { accountId } = data;
    updateAccountRunningStatus(accountId, 'connected');
  }

  /**
   * Handle account open failed event
   */
  function handleAccountOpenFailed(data) {
    const { accountId, error } = data;
    updateAccountRunningStatus(accountId, 'error');
    showError(`打开账号失败: ${error}`);
  }

  /**
   * Handle account closing event
   */
  function handleAccountClosing(data) {
    const { accountId } = data;
    updateAccountRunningStatus(accountId, 'loading');
  }

  /**
   * Handle account closed event
   */
  function handleAccountClosed(data) {
    const { accountId } = data;
    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      account.loginStatus = false;
      account.hasQRCode = false;
      account.connectionStatus = 'offline';
      account.status = 'offline';
    }
    updateAccountRunningStatus(accountId, 'not_started');
  }

  /**
   * Handle account close failed event
   */
  function handleAccountCloseFailed(data) {
    const { accountId, error } = data;
    updateAccountRunningStatus(accountId, 'error');
    showError(`关闭账号失败: ${error}`);
  }

  /**
   * Show error message to user
   * 这里保持 alert 行为以避免改变用户当前体验
   */
  function showError(message) {
    console.error(message);
    alert(message);
  }

  /**
   * Toggle sidebar collapsed state
   */
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const isCollapsed = sidebar.dataset.collapsed === 'true';
    const newState = !isCollapsed;
    const newWidth = newState ? 80 : 219;

    sidebar.dataset.collapsed = String(newState);

    // Update CSS variables for sidebar width
    document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
    document.documentElement.style.setProperty('--sidebar-collapsed-width', `${newWidth}px`);

    // Update toggle button title
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.title = newState ? '展开侧边栏' : '收起侧边栏';
    }

    // Save state to localStorage
    try {
      localStorage.setItem('sidebar-collapsed', String(newState));
    } catch (e) {
      console.warn('Failed to save sidebar state:', e);
    }

    // Notify main process about sidebar resize for BrowserView adjustment
    if (window.electronAPI) {
      // Use both methods for compatibility
      // 1. Primary: invoke resize-sidebar handler
      window.electronAPI.invoke('resize-sidebar', newWidth).catch(err => {
        console.warn('Failed to invoke resize-sidebar:', err);
      });

      // 2. Fallback: send sidebar-resized event
      window.electronAPI.send('sidebar-resized', newWidth);

      console.log(`[Sidebar] Toggled to ${newState ? 'collapsed' : 'expanded'}, width: ${newWidth}px`);
    }
  }

  /**
   * Restore sidebar collapsed state from localStorage
   */
  function restoreSidebarState() {
    try {
      const savedState = localStorage.getItem('sidebar-collapsed');
      if (savedState === 'true') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
          const collapsedWidth = 80;
          sidebar.dataset.collapsed = 'true';

          // Update CSS variables for sidebar width
          document.documentElement.style.setProperty('--sidebar-width', `${collapsedWidth}px`);
          document.documentElement.style.setProperty('--sidebar-collapsed-width', `${collapsedWidth}px`);

          // Update toggle button title
          const toggleBtn = document.getElementById('sidebar-toggle');
          if (toggleBtn) {
            toggleBtn.title = '展开侧边栏';
          }

          // Notify main process about the collapsed state
          if (window.electronAPI) {
            // Use both methods for compatibility
            window.electronAPI.invoke('resize-sidebar', collapsedWidth).catch(err => {
              console.warn('Failed to invoke resize-sidebar:', err);
            });

            // Fallback: send sidebar-resized event
            window.electronAPI.send('sidebar-resized', collapsedWidth);

            console.log(`[Sidebar] Restored collapsed state, width: ${collapsedWidth}px`);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to restore sidebar state:', e);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for testing or external access
  window.sidebar = {
    loadAccounts,
    renderAccountList,
    setActiveAccount,
    getAccounts: () => accounts,
    getActiveAccountId: () => activeAccountId,
    renderQuickActions,
    syncAccountStatusesWithRunningStatus,
    toggleSidebar
  };
})();
