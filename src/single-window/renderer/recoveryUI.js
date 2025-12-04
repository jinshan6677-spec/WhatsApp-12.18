/**
 * Recovery UI - User interface for recovery operations
 * 
 * Provides UI components for:
 * - Session data recovery
 * - Account reset
 * - Manual reconnection
 * - Recovery status display
 */

/**
 * Show recovery options dialog for an account
 * @param {string} accountId - Account ID
 * @param {Object} accountInfo - Account information
 */
async function showRecoveryDialog(accountId, accountInfo) {
  const dialog = document.createElement('div');
  dialog.className = 'recovery-dialog-overlay';
  dialog.innerHTML = `
    <div class="recovery-dialog">
      <div class="recovery-dialog-header">
        <h2>恢复选项</h2>
        <button class="recovery-dialog-close" aria-label="关闭">&times;</button>
      </div>
      <div class="recovery-dialog-body">
        <div class="recovery-account-info">
          <strong>${accountInfo.name || '账号'}</strong>
          <span class="recovery-account-id">${accountId}</span>
        </div>
        
        <div class="recovery-options">
          <div class="recovery-option">
            <h3>重新连接</h3>
            <p>尝试重新连接到 WhatsApp Web，不会丢失数据。</p>
            <button class="recovery-btn recovery-reconnect" data-action="reconnect">
              立即重新连接
            </button>
          </div>

          <div class="recovery-option">
            <h3>恢复会话数据</h3>
            <p>尝试恢复损坏的会话数据。将创建备份。</p>
            <button class="recovery-btn recovery-recover" data-action="recover">
              恢复会话
            </button>
          </div>

          <div class="recovery-option recovery-option-warning">
            <h3>重置账号</h3>
            <p>清除所有会话数据并重新开始。您需要重新扫描二维码。</p>
            <button class="recovery-btn recovery-reset" data-action="reset">
              重置账号
            </button>
          </div>
        </div>

        <div class="recovery-status" style="display: none;">
          <div class="recovery-status-message"></div>
          <div class="recovery-status-progress">
            <div class="recovery-progress-bar"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Handle close button
  const closeBtn = dialog.querySelector('.recovery-dialog-close');
  closeBtn.addEventListener('click', () => {
    dialog.remove();
  });

  // Handle overlay click
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });

  // Handle recovery actions
  const reconnectBtn = dialog.querySelector('[data-action="reconnect"]');
  const recoverBtn = dialog.querySelector('[data-action="recover"]');
  const resetBtn = dialog.querySelector('[data-action="reset"]');
  const statusDiv = dialog.querySelector('.recovery-status');
  const statusMessage = dialog.querySelector('.recovery-status-message');

  reconnectBtn.addEventListener('click', async () => {
    await handleReconnect(accountId, statusDiv, statusMessage, dialog);
  });

  recoverBtn.addEventListener('click', async () => {
    await handleRecoverSession(accountId, statusDiv, statusMessage, dialog);
  });

  resetBtn.addEventListener('click', async () => {
    await handleResetAccount(accountId, accountInfo, statusDiv, statusMessage, dialog);
  });
}

/**
 * Handle reconnect action
 * @param {string} accountId - Account ID
 * @param {HTMLElement} statusDiv - Status container element
 * @param {HTMLElement} statusMessage - Status message element
 * @param {HTMLElement} dialog - Dialog element
 */
async function handleReconnect(accountId, statusDiv, statusMessage, dialog) {
  try {
    // Show status
    statusDiv.style.display = 'block';
    statusMessage.textContent = '正在尝试重新连接...';
    statusMessage.className = 'recovery-status-message recovery-status-info';

    // Call IPC
    const result = await window.electronAPI.recovery.reconnect(accountId);

    if (result.success) {
      statusMessage.textContent = '重新连接成功！';
      statusMessage.className = 'recovery-status-message recovery-status-success';
      
      // Close dialog after delay
      setTimeout(() => {
        dialog.remove();
      }, 2000);
    } else {
      statusMessage.textContent = `重新连接失败：${result.error}`;
      statusMessage.className = 'recovery-status-message recovery-status-error';
    }
  } catch (error) {
    statusMessage.textContent = `错误：${error.message}`;
    statusMessage.className = 'recovery-status-message recovery-status-error';
  }
}

/**
 * Handle recover session action
 * @param {string} accountId - Account ID
 * @param {HTMLElement} statusDiv - Status container element
 * @param {HTMLElement} statusMessage - Status message element
 * @param {HTMLElement} dialog - Dialog element
 */
async function handleRecoverSession(accountId, statusDiv, statusMessage, dialog) {
  try {
    // Show status
    statusDiv.style.display = 'block';
    statusMessage.textContent = '正在恢复会话数据...';
    statusMessage.className = 'recovery-status-message recovery-status-info';

    // Call IPC with options
    const result = await window.electronAPI.recovery.recoverSession(accountId, {
      createBackup: true,
      preserveSettings: true
    });

    if (result.success) {
      statusMessage.textContent = '会话数据恢复成功！';
      statusMessage.className = 'recovery-status-message recovery-status-success';
      
      if (result.backupPath) {
        statusMessage.textContent += ` 备份已创建：${result.backupPath}`;
      }
      
      // Close dialog after delay
      setTimeout(() => {
        dialog.remove();
      }, 3000);
    } else {
      statusMessage.textContent = `恢复失败：${result.error}`;
      statusMessage.className = 'recovery-status-message recovery-status-error';
    }
  } catch (error) {
    statusMessage.textContent = `错误：${error.message}`;
    statusMessage.className = 'recovery-status-message recovery-status-error';
  }
}

/**
 * Handle reset account action
 * @param {string} accountId - Account ID
 * @param {Object} accountInfo - Account information
 * @param {HTMLElement} statusDiv - Status container element
 * @param {HTMLElement} statusMessage - Status message element
 * @param {HTMLElement} dialog - Dialog element
 */
async function handleResetAccount(accountId, accountInfo, statusDiv, statusMessage, dialog) {
  // Show confirmation dialog
  const confirmed = confirm(
    `确定要重置"${accountInfo.name || '此账号'}"吗？\n\n` +
    '这将：\n' +
    '- 清除所有会话数据\n' +
    '- 退出 WhatsApp 登录\n' +
    '- 需要重新扫描二维码\n\n' +
    '重置前将创建备份。'
  );

  if (!confirmed) {
    return;
  }

  try {
    // Show status
    statusDiv.style.display = 'block';
    statusMessage.textContent = '正在重置账号...';
    statusMessage.className = 'recovery-status-message recovery-status-info';

    // Call IPC with options
    const result = await window.electronAPI.recovery.resetAccount(accountId, {
      createBackup: true,
      preserveSettings: true,
      reloadView: true
    });

    if (result.success) {
      statusMessage.textContent = '账号重置成功！';
      statusMessage.className = 'recovery-status-message recovery-status-success';
      
      if (result.backupPath) {
        statusMessage.textContent += ` 备份已创建：${result.backupPath}`;
      }
      
      // Close dialog after delay
      setTimeout(() => {
        dialog.remove();
      }, 3000);
    } else {
      statusMessage.textContent = `重置失败：${result.error}`;
      statusMessage.className = 'recovery-status-message recovery-status-error';
    }
  } catch (error) {
    statusMessage.textContent = `错误：${error.message}`;
    statusMessage.className = 'recovery-status-message recovery-status-error';
  }
}

/**
 * Add recovery button to account item
 * @param {HTMLElement} accountItem - Account item element
 * @param {string} accountId - Account ID
 * @param {Object} accountInfo - Account information
 */
function addRecoveryButton(accountItem, accountId, accountInfo) {
  // Check if button already exists
  if (accountItem.querySelector('.account-recovery-btn')) {
    return;
  }

  const recoveryBtn = document.createElement('button');
  recoveryBtn.className = 'account-recovery-btn';
  recoveryBtn.title = 'Recovery Options';
  recoveryBtn.innerHTML = '🔧';
  recoveryBtn.setAttribute('aria-label', 'Recovery options');

  recoveryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showRecoveryDialog(accountId, accountInfo);
  });

  // Add to account actions
  const actionsDiv = accountItem.querySelector('.account-actions');
  if (actionsDiv) {
    actionsDiv.appendChild(recoveryBtn);
  }
}

/**
 * Show recovery status indicator
 * @param {string} accountId - Account ID
 * @param {Object} status - Recovery status
 */
function showRecoveryStatus(accountId, status) {
  const accountItem = document.querySelector(`[data-account-id="${accountId}"]`);
  if (!accountItem) return;

  // Remove existing status indicator
  const existingIndicator = accountItem.querySelector('.recovery-status-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }

  // Create status indicator
  if (status.hasAutoReconnect || status.reconnectionAttempts > 0) {
    const indicator = document.createElement('div');
    indicator.className = 'recovery-status-indicator';
    
    if (status.hasAutoReconnect) {
      indicator.innerHTML = '🔄';
      indicator.title = 'Auto-reconnecting...';
    } else if (status.reconnectionAttempts > 0) {
      indicator.innerHTML = `⚠️ ${status.reconnectionAttempts}`;
      indicator.title = `${status.reconnectionAttempts} reconnection attempts`;
    }

    const accountInfo = accountItem.querySelector('.account-info');
    if (accountInfo) {
      accountInfo.appendChild(indicator);
    }
  }
}

/**
 * Initialize recovery UI
 */
function initializeRecoveryUI() {
  // Listen for recovery events from main process
  if (window.electronAPI && window.electronAPI.recovery) {
    // Session recovered event
    window.electronAPI.on('recovery:session-recovered', (data) => {
      console.log('Session recovered:', data);
      showNotification('Session Recovered', `Session data recovered for account ${data.accountId}`);
    });

    // Account reset event
    window.electronAPI.on('recovery:account-reset', (data) => {
      console.log('Account reset:', data);
      showNotification('Account Reset', `Account ${data.accountId} has been reset`);
    });

    // Reconnected event
    window.electronAPI.on('recovery:reconnected', (data) => {
      console.log('Reconnected:', data);
      showNotification('Reconnected', `Account ${data.accountId} reconnected successfully`);
    });

    // Status changed event
    window.electronAPI.on('recovery:status-changed', (data) => {
      console.log('Recovery status changed:', data);
      showRecoveryStatus(data.accountId, data);
    });
  }

  console.log('[RecoveryUI] Recovery UI initialized');
}

/**
 * Show notification
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 */
function showNotification(title, message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'recovery-notification';
  notification.innerHTML = `
    <div class="recovery-notification-title">${title}</div>
    <div class="recovery-notification-message">${message}</div>
  `;

  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.classList.add('recovery-notification-fade-out');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showRecoveryDialog,
    addRecoveryButton,
    showRecoveryStatus,
    initializeRecoveryUI
  };
}
