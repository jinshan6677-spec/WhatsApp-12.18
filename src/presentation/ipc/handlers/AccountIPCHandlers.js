/**
 * Account IPC Handlers
 * 
 * Handles IPC communication for account management operations:
 * - Account CRUD operations
 * - Account switching
 * - Account status and monitoring
 * 
 * @module presentation/ipc/handlers/AccountIPCHandlers
 */

'use strict';

const { ipcMain, BrowserWindow } = require('electron');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const {
  validateAccountConfig,
  validateAccountId,
  handleNetworkFailure,
  validateOperationSafety
} = require('../../../utils/ValidationHelper');

// Store references for cleanup
let _accountManager = null;
let _viewManager = null;
let _mainWindow = null;

/**
 * Open account configuration dialog
 * @param {string|null} accountId - Account ID for editing, null for creating
 */
function openAccountDialog(accountId = null) {
  const dialogWindow = new BrowserWindow({
    width: 700,
    height: 800,
    minWidth: 600,
    minHeight: 700,
    parent: _mainWindow.getWindow(),
    modal: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../../../single-window/renderer', 'preload-main.js')
    }
  });

  // Build URL with account ID if editing
  let url = `file://${path.join(__dirname, '../../../single-window/renderer', 'accountDialog.html')}`;
  if (accountId) {
    url += `?accountId=${encodeURIComponent(accountId)}`;
  }

  dialogWindow.loadURL(url);

  // Show when ready
  dialogWindow.once('ready-to-show', () => {
    dialogWindow.show();
  });

  // Clean up on close
  dialogWindow.on('closed', async () => {
    // Refresh account list in main window
    try {
      const accounts = await _accountManager.getAccountsSorted();
      const accountsData = accounts.map(account => account.toJSON());
      _mainWindow.sendToRenderer('accounts-updated', accountsData);
    } catch (error) {
      console.error('[IPC:Account] Failed to refresh account list after dialog close:', error);
    }
  });
}

/**
 * Register account IPC handlers
 * @param {Object} dependencies - Handler dependencies
 */
function register(dependencies) {
  const { accountManager, viewManager, mainWindow } = dependencies;

  _accountManager = accountManager;
  _viewManager = viewManager;
  _mainWindow = mainWindow;

  // Get a single account by ID
  ipcMain.handle('get-account', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }
      const account = await accountManager.getAccount(accountId);
      if (!account) {
        return null;
      }
      return account.toJSON();
    } catch (error) {
      console.error('[IPC:Account] Failed to get account:', error);
      return null;
    }
  });

  // Get list of all accounts
  ipcMain.handle('get-accounts', async () => {
    try {
      const accounts = await accountManager.getAccountsSorted();
      return accounts.map(account => account.toJSON());
    } catch (error) {
      console.error('[IPC:Account] Failed to get accounts:', error);
      return [];
    }
  });

  // Get list of all accounts with status
  ipcMain.handle('account:list', async () => {
    try {
      const accounts = await accountManager.getAccountsSorted();

      const accountsWithStatus = accounts.map(account => {
        const viewState = viewManager.getViewState(account.id);
        const isActive = viewManager.getActiveAccountId() === account.id;

        return {
          ...account.toJSON(),
          viewStatus: viewState ? viewState.status : 'not_created',
          isActive,
          isLoaded: viewState ? viewState.isLoaded : false,
          loginStatus: viewState ? viewState.loginStatus : false,
          connectionStatus: viewState ? viewState.connectionStatus : 'offline',
          connectionError: viewState ? viewState.connectionError : null
        };
      });

      return { success: true, accounts: accountsWithStatus };
    } catch (error) {
      console.error('[IPC:Account] Failed to list accounts:', error);
      return { success: false, error: error.message };
    }
  });

  // Get runtime WhatsApp profile info for an account
  ipcMain.handle('account:get-profile', async (_event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }
      const viewState = viewManager.getViewState(accountId);
      if (!viewState) {
        return { success: false, error: `View state for account ${accountId} not found` };
      }
      return {
        success: true,
        profile: {
          phoneNumber: viewState.phoneNumber || null,
          profileName: viewState.profileName || null,
          avatarUrl: viewState.avatarUrl || null
        }
      };
    } catch (error) {
      console.error('[IPC:Account] Failed to get account profile:', error);
      return { success: false, error: error.message };
    }
  });

  // Update account profile from WhatsApp Web (called from BrowserView preload)
  ipcMain.handle('view:update-profile', async (_event, data) => {
    try {
      const { accountId, profileName, phoneNumber, avatarUrl } = data || {};

      if (!accountId) {
        throw new Error('Account ID is required');
      }

      console.log(`[IPC:Account] Received profile update for ${accountId}:`, {
        profileName,
        phoneNumber,
        hasAvatar: !!avatarUrl
      });

      // Update viewState (runtime state)
      const viewState = viewManager.getViewState(accountId);
      if (viewState) {
        if (profileName) viewState.profileName = profileName;
        if (phoneNumber) viewState.phoneNumber = phoneNumber;
        if (avatarUrl) viewState.avatarUrl = avatarUrl;
      }

      // 1. Notify renderer about the profile update (UI update)
      mainWindow.sendToRenderer('view-manager:account-profile-updated', {
        accountId,
        profileName: profileName || null,
        phoneNumber: phoneNumber || null,
        avatarUrl: avatarUrl || null
      });

      // 2. Persist to disk via AccountManager
      // Only persist phoneNumber, profileName, avatarUrl if they are present
      const updates = {};
      if (profileName) updates.profileName = profileName;
      if (phoneNumber) updates.phoneNumber = phoneNumber;
      if (avatarUrl) updates.avatarUrl = avatarUrl;

      if (Object.keys(updates).length > 0) {
        // We do this asynchronously to not block the UI update
        accountManager.updateAccount(accountId, updates)
          .then(() => console.log(`[IPC:Account] Persisted profile updates for ${accountId}`))
          .catch(err => console.error(`[IPC:Account] Failed to persist profile updates for ${accountId}:`, err));
      }

      return { success: true };
    } catch (error) {
      console.error('[IPC:Account] Failed to update account profile:', error);
      return { success: false, error: error.message };
    }
  });

  // Update account unread count from WhatsApp Web
  ipcMain.handle('view:update-unread-count', async (_event, data) => {
    try {
      const { accountId, unreadCount } = data || {};

      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Update viewState (runtime state)
      const viewState = viewManager.getViewState(accountId);
      if (viewState) {
        viewState.unreadCount = unreadCount;
      }

      // Notify renderer about the unread count update
      mainWindow.sendToRenderer('view-manager:unread-count-updated', {
        accountId,
        unreadCount
      });

      return { success: true };
    } catch (error) {
      console.error('[IPC:Account] Failed to update unread count:', error);
      return { success: false, error: error.message };
    }
  });



  // Open account dialog for creating
  ipcMain.on('account:create', () => {
    openAccountDialog(null);
  });

  // Create a new account
  ipcMain.handle('create-account', async (event, config) => {
    try {


      const accountConfig = {
        id: uuidv4(),
        name: config.name ? config.name.trim() : '',
        phoneNumber: (config.phoneNumber || '').trim(),
        note: config.note || '',
        translation: config.translation || {
          enabled: false, targetLanguage: 'zh-CN', engine: 'google',
          autoTranslate: false, translateInput: false, friendSettings: {}
        },
        sessionDir: `session-data/account-${uuidv4()}`,
        createdAt: new Date(),
        lastActiveAt: null,
        autoStart: config.autoStart || false
      };

      const validation = validateAccountConfig(accountConfig);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      const result = await accountManager.createAccount(accountConfig);
      if (!result.success) {
        return { success: false, errors: result.errors };
      }

      const updatedAccounts = await accountManager.loadAccounts();
      mainWindow.sendToRenderer('accounts-updated', updatedAccounts.map(acc => acc.toJSON()));

      return { success: true, account: result.account.toJSON() };
    } catch (error) {
      console.error('[IPC:Account] Failed to create account:', error);
      return { success: false, errors: [error.message] };
    }
  });

  // Update an existing account
  ipcMain.handle('update-account', async (event, accountId, updates) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const existingAccount = await accountManager.getAccount(accountId);
      if (!existingAccount) {
        throw new Error(`Account ${accountId} not found`);
      }



      const accountUpdates = {};
      if (updates.name !== undefined) accountUpdates.name = updates.name ? updates.name.trim() : '';
      if (updates.phoneNumber !== undefined) accountUpdates.phoneNumber = (updates.phoneNumber || '').trim();
      if (updates.note !== undefined) accountUpdates.note = updates.note;

      if (updates.translation !== undefined) accountUpdates.translation = updates.translation;
      if (updates.autoStart !== undefined) accountUpdates.autoStart = updates.autoStart;

      const result = await accountManager.updateAccount(accountId, accountUpdates);
      if (!result.success) {
        throw new Error(result.errors.join(', '));
      }



      // Handle translation config changes
      if (updates.translation && viewManager.hasView(accountId)) {
        try {
          const translationResult = await viewManager.updateTranslationConfig(accountId, updates.translation);
          if (translationResult.success) {
            console.log(`[IPC:Account] Translation config updated for account ${accountId}`);
          } else {
            console.warn(`[IPC:Account] Failed to update translation config for account ${accountId}: ${translationResult.error}`);
          }
        } catch (translationError) {
          console.error(`[IPC:Account] Error updating translation config for account ${accountId}:`, translationError);
        }
      }

      const updatedAccounts = await accountManager.loadAccounts();
      mainWindow.sendToRenderer('accounts-updated', updatedAccounts.map(acc => acc.toJSON()));

      return { success: true, account: result.account.toJSON() };
    } catch (error) {
      console.error('[IPC:Account] Failed to update account:', error);
      return { success: false, errors: [error.message] };
    }
  });

  // Delete an account
  ipcMain.handle('delete-account', async (event, accountId, options = {}) => {
    try {
      const idValidation = validateAccountId(accountId);
      if (!idValidation.valid) {
        throw new Error(idValidation.error);
      }

      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const isActive = viewManager.getActiveAccountId() === accountId;
      const viewState = viewManager.getViewState(accountId);
      const safetyCheck = validateOperationSafety('delete-account', {
        isActive,
        hasUnsavedData: viewState && viewState.isLoaded
      });

      if (safetyCheck.warnings.length > 0) {
        console.warn('[IPC:Account] Delete account warnings:', safetyCheck.warnings);
      }

      if (viewManager.hasView(accountId)) {
        await viewManager.destroyView(accountId);
      }

      const deleteOptions = {
        deleteUserData: options.deleteUserData !== false,
        userDataPath: options.userDataPath
      };

      const result = await accountManager.deleteAccount(accountId, deleteOptions);
      if (!result.success) {
        throw new Error(result.errors.join(', '));
      }

      if (isActive) {
        const remainingAccounts = await accountManager.loadAccounts();
        if (remainingAccounts.length > 0) {
          await viewManager.showView(remainingAccounts[0].id);
        } else {
          console.log('[IPC:Account] No accounts remaining after deletion');
          if (viewManager.hasView(accountId)) {
            await viewManager.destroyView(accountId);
          }
          try {
            viewManager._saveActiveAccountId();
          } catch (stateError) {
            console.warn('[IPC:Account] Failed to save cleared active account state:', stateError);
          }
        }
      }

      const updatedAccounts = await accountManager.loadAccounts();
      mainWindow.sendToRenderer('accounts-updated', updatedAccounts.map(acc => acc.toJSON()));

      return { success: true };
    } catch (error) {
      console.error('[IPC:Account] Failed to delete account:', error);
      return { success: false, error: error.message };
    }
  });

  // Switch to a different account view
  ipcMain.handle('switch-account', async (event, accountId) => {
    try {
      const idValidation = validateAccountId(accountId);
      if (!idValidation.valid) {
        throw new Error(idValidation.error);
      }

      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const viewCount = viewManager.getViewCount();
      const safetyCheck = validateOperationSafety('switch-account', {
        viewCount,
        accountExists: true
      });

      if (safetyCheck.warnings.length > 0) {
        console.warn('[IPC:Account] Switch account warnings:', safetyCheck.warnings);
      }

      const result = await viewManager.switchView(accountId, {
        createIfMissing: true,
        viewConfig: {
          url: 'https://web.whatsapp.com',
          translation: account.translation
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to switch view');
      }

      await accountManager.updateAccount(accountId, { lastActiveAt: new Date() });

      mainWindow.sendToRenderer('account:active-changed', {
        accountId,
        previousAccountId: result.previousAccountId
      });

      return { success: true, accountId, alreadyActive: result.alreadyActive || false };
    } catch (error) {
      console.error('[IPC:Account] Failed to switch account:', error);

      if (error.code || error.errno) {
        const failureInfo = handleNetworkFailure(error, { accountId, operation: 'switch-account' });
        console.error('[IPC:Account] Network failure details:', failureInfo.technicalDetails);
        return { success: false, error: failureInfo.userMessage, retryable: failureInfo.retryable };
      }

      return { success: false, error: error.message };
    }
  });

  // Switch to account by index
  ipcMain.handle('switch-account-by-index', async (event, index) => {
    try {
      if (typeof index !== 'number' || index < 0) {
        throw new Error('Invalid index');
      }

      const accounts = await accountManager.getAccountsSorted();
      if (index >= accounts.length) {
        return { success: false, error: 'Account index out of range' };
      }

      const account = accounts[index];
      return await ipcMain.emit('switch-account', event, account.id);
    } catch (error) {
      console.error('[IPC:Account] Failed to switch account by index:', error);
      return { success: false, error: error.message };
    }
  });

  // Switch to next account
  ipcMain.handle('switch-to-next-account', async () => {
    try {
      const result = await viewManager.switchToNextView();

      if (result.success && result.accountId && !result.alreadyActive) {
        await accountManager.updateAccount(result.accountId, { lastActiveAt: new Date() });
        mainWindow.sendToRenderer('account:active-changed', { accountId: result.accountId });
      }

      return result;
    } catch (error) {
      console.error('[IPC:Account] Failed to switch to next account:', error);
      return { success: false, error: error.message };
    }
  });

  // Switch to previous account
  ipcMain.handle('switch-to-previous-account', async () => {
    try {
      const result = await viewManager.switchToPreviousView();

      if (result.success && result.accountId && !result.alreadyActive) {
        await accountManager.updateAccount(result.accountId, { lastActiveAt: new Date() });
        mainWindow.sendToRenderer('account:active-changed', { accountId: result.accountId });
      }

      return result;
    } catch (error) {
      console.error('[IPC:Account] Failed to switch to previous account:', error);
      return { success: false, error: error.message };
    }
  });

  // Get current active account
  ipcMain.handle('account:get-active', async () => {
    try {
      const activeAccountId = viewManager.getActiveAccountId();
      if (!activeAccountId) {
        return { success: true, accountId: null };
      }
      const account = await accountManager.getAccount(activeAccountId);
      return { success: true, accountId: activeAccountId, account: account ? account.toJSON() : null };
    } catch (error) {
      console.error('[IPC:Account] Failed to get active account:', error);
      return { success: false, error: error.message };
    }
  });

  // Reorder accounts in sidebar
  ipcMain.handle('account:reorder', async (event, accountIds) => {
    try {
      if (!Array.isArray(accountIds)) {
        throw new Error('Account IDs must be an array');
      }

      const result = await accountManager.reorderAccounts(accountIds);
      if (!result.success) {
        throw new Error(result.errors.join(', '));
      }

      const updatedAccounts = await accountManager.loadAccounts();
      mainWindow.sendToRenderer('accounts-updated', updatedAccounts.map(acc => acc.toJSON()));

      return { success: true };
    } catch (error) {
      console.error('[IPC:Account] Failed to reorder accounts:', error);
      return { success: false, errors: [error.message] };
    }
  });

  // Reorder accounts via drag and drop
  ipcMain.handle('reorder-accounts', async (event, { accountId, targetAccountId, insertBefore }) => {
    try {
      if (!accountId || !targetAccountId) {
        throw new Error('Both accountId and targetAccountId are required');
      }

      const accounts = await accountManager.getAccountsSorted();
      const accountIds = accounts.map(acc => acc.id);

      const draggedIndex = accountIds.indexOf(accountId);
      const targetIndex = accountIds.indexOf(targetAccountId);

      if (draggedIndex === -1 || targetIndex === -1) {
        throw new Error('Account not found');
      }

      accountIds.splice(draggedIndex, 1);
      const newTargetIndex = insertBefore ? targetIndex : targetIndex + 1;
      accountIds.splice(newTargetIndex > draggedIndex ? newTargetIndex - 1 : newTargetIndex, 0, accountId);

      const result = await accountManager.reorderAccounts(accountIds);
      if (!result.success) {
        throw new Error(result.errors.join(', '));
      }

      mainWindow.sendToRenderer('accounts-updated', accounts.map(acc => acc.toJSON()));

      return { success: true };
    } catch (error) {
      console.error('[IPC:Account] Failed to reorder accounts via drag and drop:', error);
      return { success: false, errors: [error.message] };
    }
  });

  // Open an account
  ipcMain.handle('open-account', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const result = await viewManager.openAccount(accountId, {
        url: 'https://web.whatsapp.com',
        translation: account.translation
      });

      if (result.success) {
        await accountManager.updateAccount(accountId, { lastActiveAt: new Date() });
        mainWindow.sendToRenderer('account:opened', { accountId, timestamp: Date.now() });
      }

      return result;
    } catch (error) {
      console.error('[IPC:Account] Failed to open account:', error);
      return { success: false, error: error.message };
    }
  });

  // Close an account
  ipcMain.handle('close-account', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const result = await viewManager.closeAccount(accountId);

      if (result.success) {
        mainWindow.sendToRenderer('account:closed', { accountId, timestamp: Date.now() });
      }

      return result;
    } catch (error) {
      console.error('[IPC:Account] Failed to close account:', error);
      return { success: false, error: error.message };
    }
  });

  // Get account status
  ipcMain.handle('get-account-status', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const status = viewManager.getAccountRunningStatus(accountId);
      const isRunning = viewManager.isAccountRunning(accountId);
      const viewState = viewManager.getViewState(accountId);

      return {
        success: true,
        accountId,
        status,
        isRunning,
        details: viewState ? {
          isVisible: viewState.isVisible,
          isLoaded: viewState.isLoaded,
          loginStatus: viewState.loginStatus,
          connectionStatus: viewState.connectionStatus,
          error: viewState.errorInfo || null
        } : null
      };
    } catch (error) {
      console.error('[IPC:Account] Failed to get account status:', error);
      return { success: false, error: error.message };
    }
  });

  // Get all account statuses
  ipcMain.handle('get-all-account-statuses', async () => {
    try {
      const accounts = await accountManager.getAccountsSorted();
      const statuses = {};

      for (const account of accounts) {
        statuses[account.id] = {
          status: viewManager.getAccountRunningStatus(account.id),
          isRunning: viewManager.isAccountRunning(account.id)
        };
      }

      return { success: true, statuses };
    } catch (error) {
      console.error('[IPC:Account] Failed to get all account statuses:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC:Account] Account handlers registered');
}

/**
 * Unregister account IPC handlers
 */
function unregister() {
  ipcMain.removeHandler('get-account');
  ipcMain.removeHandler('get-accounts');
  ipcMain.removeHandler('account:list');
  ipcMain.removeHandler('account:get-profile');
  ipcMain.removeHandler('create-account');
  ipcMain.removeHandler('update-account');
  ipcMain.removeHandler('delete-account');
  ipcMain.removeHandler('switch-account');
  ipcMain.removeHandler('switch-account-by-index');
  ipcMain.removeHandler('switch-to-next-account');
  ipcMain.removeHandler('switch-to-previous-account');
  ipcMain.removeHandler('account:get-active');
  ipcMain.removeHandler('account:get-profile');
  ipcMain.removeHandler('view:update-profile');
  ipcMain.removeHandler('view:update-unread-count');
  ipcMain.removeHandler('view:mark-all-read');
  ipcMain.removeHandler('account:reorder');
  ipcMain.removeHandler('reorder-accounts');
  ipcMain.removeHandler('open-account');
  ipcMain.removeHandler('close-account');
  ipcMain.removeHandler('get-account-status');
  ipcMain.removeHandler('get-all-account-statuses');
  ipcMain.removeAllListeners('account:create');

  _accountManager = null;
  _viewManager = null;
  _mainWindow = null;

  console.log('[IPC:Account] Account handlers unregistered');
}

module.exports = {
  register,
  unregister
};
