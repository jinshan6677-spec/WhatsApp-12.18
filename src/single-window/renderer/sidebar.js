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
  let searchDebounceTimer = null;

  // Render version for preventing race conditions
  let renderVersion = 0;

  // Selection mode state
  let selectionMode = false;
  let selectedAccountIds = new Set();

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

    // Search input with debounce to prevent race conditions
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        filterQuery = e.target.value.trim().toLowerCase();
        // Debounce search to prevent excessive rerenders and race conditions
        if (searchDebounceTimer) {
          clearTimeout(searchDebounceTimer);
        }
        searchDebounceTimer = setTimeout(() => {
          searchDebounceTimer = null;
          renderAccountList();
        }, 150); // 150ms debounce
      });
    }

    // Sidebar toggle button
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    if (sidebarToggleBtn) {
      sidebarToggleBtn.addEventListener('click', toggleSidebar);
    }

    // Batch start button
    const batchStartBtn = document.getElementById('batch-start');
    if (batchStartBtn) {
      batchStartBtn.addEventListener('click', handleBatchStartAll);
    }

    // Selection mode button
    const selectionModeBtn = document.getElementById('selection-mode-btn');
    if (selectionModeBtn) {
      selectionModeBtn.addEventListener('click', toggleSelectionMode);
    }

    // Selection action bar buttons
    const selectionActionBar = document.getElementById('selection-action-bar');
    if (selectionActionBar) {
      selectionActionBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.selection-btn');
        if (!btn) return;
        const action = btn.dataset.action;
        switch (action) {
          case 'select-all':
            selectAllAccounts();
            break;
          case 'start-selected':
            handleBatchStartSelected();
            break;
          case 'delete-selected':
            handleBatchDeleteSelected();
            break;
          case 'cancel':
            toggleSelectionMode();
            break;
        }
      });
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
      window.electronAPI.on('view-manager:unread-count-updated', handleUnreadCountUpdated);

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

    // Increment render version to cancel any pending stale renders
    const currentRenderVersion = ++renderVersion;

    // Clear existing items
    const existingItems = accountList.querySelectorAll('.account-item');
    existingItems.forEach((item) => item.remove());

    // Filter accounts - also search profileName for real WhatsApp nickname
    const filteredAccounts = accounts.filter(account => {
      if (!filterQuery) return true;
      const name = (account.name || '').toLowerCase();
      const profileName = (account.profileName || '').toLowerCase();
      const phone = (account.phoneNumber || '').toLowerCase();
      const note = (account.note || '').toLowerCase();
      return name.includes(filterQuery) || profileName.includes(filterQuery) || phone.includes(filterQuery) || note.includes(filterQuery);
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

    // Check if this render is still valid (not superseded by a newer render)
    if (currentRenderVersion !== renderVersion) {
      console.log(`[Sidebar] Aborting stale render (version ${currentRenderVersion}, current ${renderVersion})`);
      return;
    }

    // Sort accounts by order
    const sortedAccounts = [...filteredAccounts].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 999;
      const orderB = b.order !== undefined ? b.order : 999;
      return orderA - orderB;
    });

    // Final check before DOM mutation
    if (currentRenderVersion !== renderVersion) {
      console.log(`[Sidebar] Aborting stale render before DOM update (version ${currentRenderVersion}, current ${renderVersion})`);
      return;
    }

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
   * @param {Object} account - Account object
   * @param {Object} options - Options
   * @param {boolean} options.skipIPFetch - Whether to skip IP fetching (default: false)
   */
  function createAccountItem(account, options = {}) {
    const { skipIPFetch = false } = options;
    const item = document.createElement('div');
    item.className = 'account-item';

    // Add logged-in class for compact styling
    if (account.loginStatus === true) {
      item.classList.add('loggedin');
    }
    item.dataset.accountId = account.id;
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `切换到 ${account.name}`);

    if (account.id === activeAccountId) {
      item.classList.add('active');
    }

    // Selection mode checkbox
    if (selectionMode) {
      item.classList.add('in-selection-mode');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'selection-checkbox';
      checkbox.checked = selectedAccountIds.has(account.id);
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
          selectedAccountIds.add(account.id);
          item.classList.add('selected');
        } else {
          selectedAccountIds.delete(account.id);
          item.classList.remove('selected');
        }
      });
      item.appendChild(checkbox);

      if (selectedAccountIds.has(account.id)) {
        item.classList.add('selected');
      }
    }

    // Avatar container
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'account-avatar-container';

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'account-avatar';
    // Only show initial and color if there is a name
    if (account.name || account.profileName) {
      avatar.textContent = getAccountInitial(account.name || account.profileName);
      avatar.style.background = getAccountColor(account.id);
    }
    // Otherwise leave empty with default gray background

    // Status Dot (Online/Offline indicator on avatar)
    const statusDot = document.createElement('div');
    statusDot.className = 'status-dot';
    renderStatusDot(account, statusDot);

    avatarContainer.appendChild(avatar);
    avatarContainer.appendChild(statusDot);

    // Unread Badge
    renderUnreadBadge(account, avatarContainer);

    // Info
    const info = document.createElement('div');
    info.className = 'account-info';

    const header = document.createElement('div');
    header.className = 'account-header';

    const name = document.createElement('div');
    name.className = 'account-name';
    const displayName = account.name || '';
    name.textContent = displayName;
    if (!displayName) name.innerHTML = '&nbsp;'; // Maintain height
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
    collapsedName.textContent = account.note || account.profileName || account.name || '';
    if (!collapsedName.textContent) collapsedName.innerHTML = '&nbsp;';
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
    item.addEventListener('click', () => {
      // In selection mode, clicking the card toggles the selection
      if (selectionMode) {
        const checkbox = item.querySelector('.selection-checkbox');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          if (checkbox.checked) {
            selectedAccountIds.add(account.id);
            item.classList.add('selected');
          } else {
            selectedAccountIds.delete(account.id);
            item.classList.remove('selected');
          }
        }
        return;
      }
      handleAccountSelect(account.id);
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        // In selection mode, Enter/Space toggles selection
        if (selectionMode) {
          const checkbox = item.querySelector('.selection-checkbox');
          if (checkbox) {
            checkbox.checked = !checkbox.checked;
            if (checkbox.checked) {
              selectedAccountIds.add(account.id);
              item.classList.add('selected');
            } else {
              selectedAccountIds.delete(account.id);
              item.classList.remove('selected');
            }
          }
          return;
        }
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

    // Fetch and render IP info (skip if requested to use cached IP)
    if (!skipIPFetch) {
      setTimeout(() => fetchAndRenderIPInfo(account, item), 10); // Non-blocking
    }

    return item;
  }

  /**
   * Handle unread count updated event
   */
  function handleUnreadCountUpdated(data) {
    const { accountId, unreadCount } = data || {};

    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      account.unreadCount = unreadCount;
    }

    if (!accountList) return;
    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (!item) return;

    const avatarContainer = item.querySelector('.account-avatar-container');
    if (avatarContainer) {
      renderUnreadBadge(account, avatarContainer);
    }
  }

  /**
   * Render unread badge on avatar
   */
  function renderUnreadBadge(account, container) {
    if (!account || !container) return;

    let badge = container.querySelector('.unread-badge');
    const count = parseInt(account.unreadCount || 0, 10);

    if (count > 0) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'unread-badge';
        container.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      if (badge) {
        badge.style.display = 'none';
      }
    }
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

    const displayName = account.profileName || account.name || '';

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
      } else if (displayName) {
        avatarEl.textContent = getAccountInitial(displayName);
        avatarEl.style.background = getAccountColor(account.id);
      } else {
        avatarEl.textContent = '';
        avatarEl.style.background = ''; // Revert to default
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
      const txt = account.note || account.profileName || account.name || '';
      collapsedNameEl.textContent = txt;
      if (!txt) collapsedNameEl.innerHTML = '&nbsp;';
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

    // Initial render with shield icon if not already present (for loading state)
    // But wait, renderIPDetails clears innerHTML. 
    // We want the shield to be always visible? 
    // If IP is loading, we might want to show shield too.
    // Let's skip pre-rendering shield for now to avoid complexity, assume IP loads fast.
    // Or we can render a placeholder.

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
      // Show actual error message for debugging (e.g., "No handler registered")
      const errorMsg = error.message && error.message.includes('No handler')
        ? '需重启应用'
        : (error.message || '获取失败');
      renderIPError(ipContainer, errorMsg, error.message, account);
    }
  }

  /**
   * Render IP details into container (Simplified Version)
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

    // Shield Icon (Environment Info) - Placed after IP
    // Support passing account via info._account (legacy/injected) or direct argument
    const targetAccount = account || info._account;
    if (targetAccount) {
      const envIcon = createEnvInfoIcon(targetAccount);
      envIcon.classList.add('inline-shield');
      row.appendChild(envIcon);
    }

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

  let _localIPCache = { ip: null, time: 0 };

  async function getLocalPublicIP(force = false) {
    if (!window.electronAPI) return null;
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
    } catch (e) { }
    return _localIPCache.ip;
  }

  async function getAccountUA(accountId) {
    if (!window.electronAPI) return navigator.userAgent;
    try {
      const res = await window.electronAPI.getFingerprint(accountId);
      if (res && res.success && res.config) {
        const cfg = res.config;
        return cfg.userAgent || (cfg.navigator && cfg.navigator.userAgent) || navigator.userAgent;
      }
    } catch (e) { }
    return navigator.userAgent;
  }

  async function getProxyIPInfo(account) {
    if (!window.electronAPI) return null;
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
    } catch (e) { }
    return account.lastIPInfo || null;
  }

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
      btn.title = 'UA/IP加载中…';
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
      {
        label: '环境设置',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22S20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"></path><path d="M9 12L11 14L15 10"></path></svg>`,
        action: () => openEnvironmentPanel(account.id)
      },
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

    // Position menu - ensure it stays within the sidebar to avoid being covered by BrowserView
    const rect = menu.getBoundingClientRect();
    const sidebar = document.getElementById('sidebar');
    const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : { right: window.innerWidth, left: 0 };

    let x = e.clientX;
    let y = e.clientY;

    // Ensure menu doesn't extend beyond sidebar's right edge (BrowserView would cover it)
    const maxX = sidebarRect.right - rect.width - 4; // 4px padding from edge
    if (x + rect.width > sidebarRect.right) {
      x = Math.max(sidebarRect.left + 4, maxX);
    }

    // Vertical bounds check
    if (y + rect.height > window.innerHeight) {
      y = window.innerHeight - rect.height - 4;
    }
    if (y < 0) y = 4;

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
      const defaultConfig = {
        name: '',
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
   * Open environment settings panel for an account
   * Sets the account and expands the environment panel
   */
  function openEnvironmentPanel(accountId) {
    // Set the account for the environment settings panel
    if (window.EnvironmentSettingsPanel) {
      window.EnvironmentSettingsPanel.setAccount(accountId);
    }
    // Expand the environment panel using the global method
    if (window.TranslatePanelLayout && window.TranslatePanelLayout.openEnvironmentPanel) {
      window.TranslatePanelLayout.openEnvironmentPanel();
    }
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
   * 优化：增量更新，只对新账号获取IP信息，避免不必要的资源浪费
   */
  function handleAccountsUpdated(accountsData) {
    const newAccounts = accountsData || [];

    // 创建旧账号的ID集合和状态映射，用于识别新增账号和保留运行状态
    const oldAccountIds = new Set(accounts.map(acc => acc.id));
    const oldAccountStatusMap = new Map();
    const oldAccountIPMap = new Map();

    accounts.forEach(acc => {
      oldAccountStatusMap.set(acc.id, {
        runningStatus: acc.runningStatus,
        isRunning: acc.isRunning,
        loginStatus: acc.loginStatus,
        hasQRCode: acc.hasQRCode,
        connectionStatus: acc.connectionStatus,
        status: acc.status
      });
      // 保留已有账号的IP信息缓存
      if (acc.lastIPInfo) {
        oldAccountIPMap.set(acc.id, acc.lastIPInfo);
      }
    });

    // 识别新增的账号
    const newAccountIds = [];

    // 合并新账号数据，保留旧账号的运行状态和IP信息
    accounts = newAccounts.map(newAccount => {
      const oldStatus = oldAccountStatusMap.get(newAccount.id);
      const oldIPInfo = oldAccountIPMap.get(newAccount.id);

      // 标记这是一个新账号
      if (!oldAccountIds.has(newAccount.id)) {
        newAccountIds.push(newAccount.id);
      }

      if (oldStatus) {
        // 保留运行状态相关字段和IP信息
        return {
          ...newAccount,
          runningStatus: oldStatus.runningStatus,
          isRunning: oldStatus.isRunning,
          loginStatus: oldStatus.loginStatus !== undefined ? oldStatus.loginStatus : newAccount.loginStatus,
          hasQRCode: oldStatus.hasQRCode !== undefined ? oldStatus.hasQRCode : newAccount.hasQRCode,
          connectionStatus: oldStatus.connectionStatus || newAccount.connectionStatus,
          status: oldStatus.status || newAccount.status,
          lastIPInfo: oldIPInfo || null // 保留已有的IP信息缓存
        };
      }
      return newAccount;
    });

    if (updateTimers.has('accountList')) {
      clearTimeout(updateTimers.get('accountList'));
    }

    // 如果没有新增账号，只需要更新已有账号的DOM元素（不重新获取IP）
    if (newAccountIds.length === 0 && oldAccountIds.size === accounts.length) {
      updateTimers.set(
        'accountList',
        setTimeout(() => {
          updateExistingAccountsDOM();
          updateTimers.delete('accountList');
        }, DEBOUNCE_DELAY)
      );
    } else {
      // 有新增或删除账号时，需要完整渲染，但标记新账号以便只对它们获取IP
      updateTimers.set(
        'accountList',
        setTimeout(() => {
          renderAccountListIncremental(newAccountIds);
          updateTimers.delete('accountList');
        }, DEBOUNCE_DELAY)
      );
    }
  }

  /**
   * Update existing accounts' DOM elements without full re-rendering
   * 只更新备注、名称等属性，不重新获取IP信息
   */
  function updateExistingAccountsDOM() {
    if (!accountList) return;

    accounts.forEach(account => {
      const item = accountList.querySelector(`[data-account-id="${account.id}"]`);
      if (!item) return;

      // 更新名称
      const nameEl = item.querySelector('.account-name');
      if (nameEl) {
        const displayName = account.profileName || account.name || '';
        nameEl.textContent = displayName;
        if (!displayName) nameEl.innerHTML = '&nbsp;';
      }

      // 更新备注（只在非编辑状态下更新）
      const noteEl = item.querySelector('.account-note');
      if (noteEl && document.activeElement !== noteEl) {
        noteEl.textContent = account.note || '';
      }

      // 更新电话号码
      const phoneEl = item.querySelector('.account-phone');
      if (phoneEl) {
        if (account.phoneNumber) {
          phoneEl.textContent = account.phoneNumber;
          phoneEl.style.display = '';
        } else {
          phoneEl.style.display = 'none';
        }
      }

      // 更新折叠显示名称
      const collapsedNameEl = item.querySelector('.account-collapsed-name');
      if (collapsedNameEl) {
        const txt = account.note || account.profileName || account.name || '';
        collapsedNameEl.textContent = txt;
        if (!txt) collapsedNameEl.innerHTML = '&nbsp;';
      }

      // 同步状态
      syncAccountStatusWithRunningStatus(account);
    });

    console.log(`[Sidebar] Updated ${accounts.length} accounts' DOM without IP refresh`);
  }

  /**
   * Render account list with incremental IP fetching
   * 只对新增账号获取IP信息，已有账号使用缓存的IP信息
   * @param {string[]} newAccountIds - 新增账号的ID列表
   */
  async function renderAccountListIncremental(newAccountIds) {
    if (!accountList) return;

    // Increment render version to cancel any pending stale renders
    const currentRenderVersion = ++renderVersion;

    // Clear existing items
    const existingItems = accountList.querySelectorAll('.account-item');
    existingItems.forEach((item) => item.remove());

    // Filter accounts
    const filteredAccounts = accounts.filter(account => {
      if (!filterQuery) return true;
      const name = (account.name || '').toLowerCase();
      const profileName = (account.profileName || '').toLowerCase();
      const phone = (account.phoneNumber || '').toLowerCase();
      const note = (account.note || '').toLowerCase();
      return name.includes(filterQuery) || profileName.includes(filterQuery) || phone.includes(filterQuery) || note.includes(filterQuery);
    });

    // Show/hide empty state
    if (filteredAccounts.length === 0) {
      if (emptyState) {
        emptyState.classList.remove('hidden');
        if (accounts.length > 0) {
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
    if (window.electronAPI) {
      try {
        const statusResult = await window.electronAPI.getAllAccountStatuses();
        if (statusResult && statusResult.success && statusResult.statuses) {
          mergeRunningStatuses(statusResult.statuses);
          syncAccountStatusesWithRunningStatus();
        }
      } catch (error) {
        console.error('Failed to get account statuses:', error);
      }
    }

    // Check if this render is still valid
    if (currentRenderVersion !== renderVersion) {
      console.log(`[Sidebar] Aborting stale render (version ${currentRenderVersion}, current ${renderVersion})`);
      return;
    }

    // Sort accounts by order
    const sortedAccounts = [...filteredAccounts].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 999;
      const orderB = b.order !== undefined ? b.order : 999;
      return orderA - orderB;
    });

    // Final check before DOM mutation
    if (currentRenderVersion !== renderVersion) {
      console.log(`[Sidebar] Aborting stale render before DOM update (version ${currentRenderVersion}, current ${renderVersion})`);
      return;
    }

    const fragment = document.createDocumentFragment();
    const newAccountIdsSet = new Set(newAccountIds);

    sortedAccounts.forEach((account) => {
      const accountItem = createAccountItemIncremental(account, newAccountIdsSet.has(account.id));
      fragment.appendChild(accountItem);
    });

    accountList.appendChild(fragment);

    // Status recovery
    setTimeout(() => {
      sortedAccounts.forEach((account) => {
        syncAccountStatusWithRunningStatus(account);
        if (account.loginStatus === true) {
          updateAccountStatus(account.id, 'online');
        }
      });
      console.log(`[Sidebar] Status recovery completed for ${sortedAccounts.length} accounts (${newAccountIds.length} new)`);
    }, 100);
  }

  /**
   * Create an account item element with incremental IP fetching
   * @param {Object} account - Account object
   * @param {boolean} isNewAccount - Whether this is a newly added account
   */
  function createAccountItemIncremental(account, isNewAccount) {
    // 对于已有账号且有缓存IP信息，跳过IP获取
    const hasCachedIP = !isNewAccount && account.lastIPInfo;
    const item = createAccountItem(account, { skipIPFetch: hasCachedIP });

    // 对于已有账号，使用缓存的IP信息渲染
    if (hasCachedIP) {
      // 创建IP容器并渲染缓存的IP信息
      let ipContainer = item.querySelector('.account-ip-info');
      if (!ipContainer) {
        ipContainer = document.createElement('div');
        ipContainer.className = 'account-ip-info';
        const infoBlock = item.querySelector('.account-info');
        if (infoBlock) {
          infoBlock.appendChild(ipContainer);
        }
      }
      if (account.lastIPInfo.success !== false) {
        renderIPDetails(ipContainer, account.lastIPInfo, account);
        console.log(`[Sidebar] Using cached IP info for account ${account.id}`);
      }
    } else if (isNewAccount) {
      console.log(`[Sidebar] Fetching IP info for new account ${account.id}`);
      // 新账号已在 createAccountItem 中自动获取IP
    }

    return item;
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

    // Toggle loggedin class dynamically when status changes
    if (account.loginStatus === true) {
      item.classList.add('loggedin');
    } else {
      item.classList.remove('loggedin');
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

    // Refresh IP info for this account after view is opened/restarted
    // This ensures IP display updates when proxy settings have changed
    refreshAccountIPInfo(accountId);
  }

  /**
   * Refresh IP information for a specific account
   * Used after view restart to update IP display when proxy settings have changed
   * @param {string} accountId - Account ID to refresh IP info for
   */
  async function refreshAccountIPInfo(accountId) {
    if (!accountList || !window.electronAPI) return;

    const item = accountList.querySelector(`[data-account-id="${accountId}"]`);
    if (!item) return;

    const account = accounts.find(acc => acc.id === accountId);
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
    const collapsedWidth = 80;
    const expandedWidth = 219;
    const newWidth = newState ? collapsedWidth : expandedWidth;

    sidebar.dataset.collapsed = String(newState);

    // Update CSS variables for sidebar width
    // 关键修复：始终设置所有相关的CSS变量，确保状态切换时宽度正确
    document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
    document.documentElement.style.setProperty('--sidebar-collapsed-width', `${collapsedWidth}px`);
    document.documentElement.style.setProperty('--sidebar-expanded-width', `${expandedWidth}px`);

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
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return;

      const collapsedWidth = 80;
      const expandedWidth = 219;

      if (savedState === 'true') {
        // Restore collapsed state
        sidebar.dataset.collapsed = 'true';

        // 关键修复：确保两种状态的CSS变量都正确设置
        // 即使是收起状态，也要设置展开宽度，以便后续展开时使用
        document.documentElement.style.setProperty('--sidebar-width', `${collapsedWidth}px`);
        document.documentElement.style.setProperty('--sidebar-collapsed-width', `${collapsedWidth}px`);
        document.documentElement.style.setProperty('--sidebar-expanded-width', `${expandedWidth}px`);

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
      } else {
        // Restore expanded state (or default state)
        sidebar.dataset.collapsed = 'false';

        // 确保展开状态的CSS变量正确
        document.documentElement.style.setProperty('--sidebar-width', `${expandedWidth}px`);
        document.documentElement.style.setProperty('--sidebar-collapsed-width', `${collapsedWidth}px`);
        document.documentElement.style.setProperty('--sidebar-expanded-width', `${expandedWidth}px`);

        // Update toggle button title
        const toggleBtn = document.getElementById('sidebar-toggle');
        if (toggleBtn) {
          toggleBtn.title = '收起侧边栏';
        }

        // Notify main process about the expanded state
        if (window.electronAPI) {
          window.electronAPI.invoke('resize-sidebar', expandedWidth).catch(err => {
            console.warn('Failed to invoke resize-sidebar:', err);
          });

          window.electronAPI.send('sidebar-resized', expandedWidth);

          console.log(`[Sidebar] Restored expanded state, width: ${expandedWidth}px`);
        }
      }
    } catch (e) {
      console.warn('Failed to restore sidebar state:', e);
    }
  }

  /**
   * Toggle selection mode on/off
   */
  function toggleSelectionMode() {
    selectionMode = !selectionMode;
    selectedAccountIds.clear();

    const selectionModeBtn = document.getElementById('selection-mode-btn');
    const selectionActionBar = document.getElementById('selection-action-bar');

    if (selectionModeBtn) {
      selectionModeBtn.classList.toggle('active', selectionMode);
    }

    if (selectionActionBar) {
      selectionActionBar.classList.toggle('hidden', !selectionMode);
    }

    // Re-render account list to show/hide checkboxes
    renderAccountList();

    console.log(`[Sidebar] Selection mode: ${selectionMode ? 'ON' : 'OFF'}`);
  }

  /**
   * Select all accounts
   */
  function selectAllAccounts() {
    const allSelected = selectedAccountIds.size === accounts.length;

    if (allSelected) {
      // Deselect all
      selectedAccountIds.clear();
    } else {
      // Select all
      accounts.forEach(account => {
        selectedAccountIds.add(account.id);
      });
    }

    // Update UI
    updateSelectionUI();
  }

  /**
   * Update selection UI for all accounts
   */
  function updateSelectionUI() {
    if (!accountList) return;

    accounts.forEach(account => {
      const item = accountList.querySelector(`[data-account-id="${account.id}"]`);
      if (!item) return;

      const isSelected = selectedAccountIds.has(account.id);
      item.classList.toggle('selected', isSelected);

      const checkbox = item.querySelector('.selection-checkbox');
      if (checkbox) {
        checkbox.checked = isSelected;
      }
    });
  }

  /**
   * Handle batch start all accounts
   * 按照账号列表从上到下的顺序启动（按 order 属性升序排序）
   */
  async function handleBatchStartAll() {
    if (!window.electronAPI) return;

    // 获取未运行的账号，并按 order 排序
    const notRunningAccounts = accounts
      .filter(acc => !acc.isRunning && acc.runningStatus !== 'loading')
      .sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        return orderA - orderB;
      });

    if (notRunningAccounts.length === 0) {
      console.log('[Sidebar] All accounts are already running');
      return;
    }

    console.log(`[Sidebar] Batch starting ${notRunningAccounts.length} accounts (in list order)...`);

    // Start accounts sequentially with a small delay between each
    for (const account of notRunningAccounts) {
      try {
        updateAccountRunningStatus(account.id, 'loading');
        await window.electronAPI.invoke('open-account', account.id);
        console.log(`[Sidebar] Started account ${account.id}`);
        // Small delay between account starts to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Sidebar] Failed to start account ${account.id}:`, error);
        updateAccountRunningStatus(account.id, 'error');
      }
    }
  }

  /**
   * Handle batch start selected accounts
   * 按照账号列表从上到下的顺序启动（按 order 属性升序排序）
   */
  async function handleBatchStartSelected() {
    if (!window.electronAPI || selectedAccountIds.size === 0) return;

    // 获取选中且未运行的账号，并按 order 排序
    const selectedAccounts = accounts
      .filter(acc =>
        selectedAccountIds.has(acc.id) && !acc.isRunning && acc.runningStatus !== 'loading'
      )
      .sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        return orderA - orderB;
      });

    if (selectedAccounts.length === 0) {
      console.log('[Sidebar] No selected accounts to start');
      return;
    }

    console.log(`[Sidebar] Batch starting ${selectedAccounts.length} selected accounts (in list order)...`);

    for (const account of selectedAccounts) {
      try {
        updateAccountRunningStatus(account.id, 'loading');
        await window.electronAPI.invoke('open-account', account.id);
        console.log(`[Sidebar] Started account ${account.id}`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Sidebar] Failed to start account ${account.id}:`, error);
        updateAccountRunningStatus(account.id, 'error');
      }
    }

    // Exit selection mode after operation
    toggleSelectionMode();
  }

  /**
   * Handle batch delete selected accounts
   */
  async function handleBatchDeleteSelected() {
    if (!window.electronAPI || selectedAccountIds.size === 0) return;

    const selectedCount = selectedAccountIds.size;
    const confirmed = confirm(`确定要删除选中的 ${selectedCount} 个账号吗？\n\n这将删除账号配置但保留会话数据。`);

    if (!confirmed) return;

    console.log(`[Sidebar] Batch deleting ${selectedCount} accounts...`);

    const idsToDelete = [...selectedAccountIds];
    for (const accountId of idsToDelete) {
      try {
        await window.electronAPI.invoke('delete-account', accountId);
        console.log(`[Sidebar] Deleted account ${accountId}`);
      } catch (error) {
        console.error(`[Sidebar] Failed to delete account ${accountId}:`, error);
      }
    }

    // Exit selection mode after operation
    toggleSelectionMode();
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
    toggleSidebar,
    toggleSelectionMode,
    handleBatchStartAll
  };
})();
