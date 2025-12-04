/**
 * View IPC Handlers
 * 
 * Handles IPC communication for view management operations:
 * - View status and bounds
 * - View reload and URL loading
 * - Login status monitoring
 * - Connection status monitoring
 * - Session management
 * 
 * @module presentation/ipc/handlers/ViewIPCHandlers
 */

'use strict';

const { ipcMain } = require('electron');

// Store references for cleanup
let _accountManager = null;
let _viewManager = null;
let _mainWindow = null;

/**
 * Register view IPC handlers
 * @param {Object} dependencies - Handler dependencies
 */
function register(dependencies) {
  const { accountManager, viewManager, mainWindow } = dependencies;
  
  _accountManager = accountManager;
  _viewManager = viewManager;
  _mainWindow = mainWindow;

  // Get view status for an account
  ipcMain.handle('account:view-status', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const viewState = viewManager.getViewState(accountId);
      
      if (!viewState) {
        return { success: true, exists: false, status: 'not_created' };
      }

      return {
        success: true,
        exists: true,
        status: viewState.status,
        isVisible: viewState.isVisible,
        isLoaded: viewState.isLoaded,
        loginStatus: viewState.loginStatus,
        connectionStatus: viewState.connectionStatus,
        connectionError: viewState.connectionError,
        errorInfo: viewState.errorInfo || null
      };
    } catch (error) {
      console.error('[IPC:View] Failed to get view status:', error);
      return { success: false, error: error.message };
    }
  });

  // Reload a view
  ipcMain.handle('account:reload-view', async (event, accountId, ignoreCache = false) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      if (!viewManager.hasView(accountId)) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      const success = await viewManager.reloadView(accountId, ignoreCache);
      if (!success) {
        throw new Error('Failed to reload view');
      }

      return { success: true, accountId };
    } catch (error) {
      console.error('[IPC:View] Failed to reload view:', error);
      return { success: false, error: error.message };
    }
  });

  // Recreate a view (destroy and create again)
  ipcMain.handle('account:recreate-view', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // If exists, destroy first
      if (_viewManager.hasView(accountId)) {
        const destroyed = await _viewManager.destroyView(accountId);
        if (!destroyed) {
          throw new Error('Failed to destroy existing view');
        }
      }

      // Create new view and show
      await _viewManager.createView(accountId, { url: 'https://web.whatsapp.com' });
      const shown = await _viewManager.showView(accountId);
      if (!shown) {
        throw new Error('Failed to show recreated view');
      }

      return { success: true, accountId };
    } catch (error) {
      console.error('[IPC:View] Failed to recreate view:', error);
      return { success: false, error: error.message };
    }
  });

  // Get login status for an account
  ipcMain.handle('account:login-status', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const loginStatus = viewManager.getLoginStatus(accountId);
      const viewState = viewManager.getViewState(accountId);
      
      return {
        success: true,
        accountId,
        isLoggedIn: loginStatus || false,
        loginInfo: viewState ? viewState.loginInfo : null
      };
    } catch (error) {
      console.error('[IPC:View] Failed to get login status:', error);
      return { success: false, error: error.message };
    }
  });

  // Load a specific URL in a view
  ipcMain.handle('account:load-url', async (event, accountId, url) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }
      if (!url) {
        throw new Error('URL is required');
      }

      if (!viewManager.hasView(accountId)) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      const success = await viewManager.loadURL(accountId, url);
      if (!success) {
        throw new Error('Failed to load URL');
      }

      return { success: true, accountId, url };
    } catch (error) {
      console.error('[IPC:View] Failed to load URL:', error);
      return { success: false, error: error.message };
    }
  });

  // Get current view bounds
  ipcMain.handle('get-view-bounds', () => {
    try {
      const window = mainWindow.getWindow();
      if (!window || window.isDestroyed()) {
        return { success: false, error: 'Window not available' };
      }

      const windowBounds = window.getContentBounds();
      const sidebarWidth = mainWindow.getSidebarWidth();
      const translationPanel = mainWindow.getTranslationPanelLayout();

      const viewBounds = {
        x: sidebarWidth,
        y: 0,
        width: windowBounds.width - sidebarWidth - translationPanel.width,
        height: windowBounds.height
      };

      return { success: true, windowBounds, sidebarWidth, translationPanel, viewBounds };
    } catch (error) {
      console.error('[IPC:View] Failed to get view bounds:', error);
      return { success: false, error: error.message };
    }
  });

  // Get saved active account ID
  ipcMain.handle('get-active-account-id', () => {
    try {
      const activeAccountId = viewManager.getSavedActiveAccountId();
      return { success: true, accountId: activeAccountId };
    } catch (error) {
      console.error('[IPC:View] Failed to get active account ID:', error);
      return { success: false, error: error.message };
    }
  });

  // Restore active account from saved state
  ipcMain.handle('restore-active-account', async () => {
    try {
      const savedAccountId = viewManager.getSavedActiveAccountId();
      
      if (!savedAccountId) {
        return { success: false, reason: 'no_saved_account' };
      }

      const account = await accountManager.getAccount(savedAccountId);
      if (!account) {
        return { success: false, reason: 'account_not_found', accountId: savedAccountId };
      }

      const result = await viewManager.switchView(savedAccountId, {
        createIfMissing: true,
        viewConfig: {
          url: 'https://web.whatsapp.com',
          translation: account.translation
        }
      });

      if (result.success) {
        await accountManager.updateAccount(savedAccountId, { lastActiveAt: new Date() });
        mainWindow.sendToRenderer('account:active-changed', { accountId: savedAccountId });
        return { success: true, accountId: savedAccountId };
      } else {
        return { success: false, reason: 'switch_failed', error: result.error, accountId: savedAccountId };
      }
    } catch (error) {
      console.error('[IPC:View] Failed to restore active account:', error);
      return { success: false, error: error.message };
    }
  });

  // Force logout an account
  ipcMain.handle('account:force-logout', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const result = await viewManager.forceLogout(accountId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to force logout');
      }

      mainWindow.sendToRenderer('account:logged-out', { accountId, forced: true });

      return { success: true, accountId };
    } catch (error) {
      console.error('[IPC:View] Failed to force logout:', error);
      return { success: false, error: error.message };
    }
  });

  // Handle session expiration
  ipcMain.handle('account:handle-session-expiration', async (event, accountId, options = {}) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const result = await viewManager.handleSessionExpiration(accountId, options);
      if (!result.success) {
        throw new Error(result.error || 'Failed to handle session expiration');
      }

      return { success: true, accountId };
    } catch (error) {
      console.error('[IPC:View] Failed to handle session expiration:', error);
      return { success: false, error: error.message };
    }
  });

  // Check session expiration
  ipcMain.handle('account:check-session-expiration', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const result = await viewManager.checkSessionExpiration(accountId);
      return result;
    } catch (error) {
      console.error('[IPC:View] Failed to check session expiration:', error);
      return { success: false, error: error.message };
    }
  });

  // Get session persistence status
  ipcMain.handle('account:session-persistence-status', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const result = await viewManager.getSessionPersistenceStatus(accountId);
      return result;
    } catch (error) {
      console.error('[IPC:View] Failed to get session persistence status:', error);
      return { success: false, error: error.message };
    }
  });

  // Restore login states for all accounts
  ipcMain.handle('account:restore-all-login-states', async () => {
    try {
      const result = await viewManager.restoreAllLoginStates();
      mainWindow.sendToRenderer('account:login-states-restored', result);
      return { success: true, ...result };
    } catch (error) {
      console.error('[IPC:View] Failed to restore all login states:', error);
      return { success: false, error: error.message };
    }
  });

  // Start session health monitoring
  ipcMain.handle('account:start-session-monitoring', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const monitor = viewManager.startSessionHealthMonitoring(accountId);
      if (!monitor) {
        throw new Error('Failed to start session health monitoring');
      }

      return { success: true, accountId, monitoring: true };
    } catch (error) {
      console.error('[IPC:View] Failed to start session monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  // Get connection status
  ipcMain.handle('account:connection-status', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const connectionStatus = viewManager.getConnectionStatus(accountId);
      const connectionError = viewManager.getConnectionError(accountId);
      const viewState = viewManager.getViewState(accountId);

      return {
        success: true,
        accountId,
        connectionStatus: connectionStatus || 'offline',
        error: connectionError,
        lastCheck: viewState ? viewState.lastConnectionCheck : null
      };
    } catch (error) {
      console.error('[IPC:View] Failed to get connection status:', error);
      return { success: false, error: error.message };
    }
  });

  // Check connection status (manual)
  ipcMain.handle('account:check-connection-status', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const result = await viewManager.checkConnectionStatus(accountId);
      return result;
    } catch (error) {
      console.error('[IPC:View] Failed to check connection status:', error);
      return { success: false, error: error.message };
    }
  });

  // Start connection monitoring
  ipcMain.handle('account:start-connection-monitoring', async (event, accountId, options = {}) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const monitor = viewManager.startConnectionMonitoring(accountId, options);
      if (!monitor) {
        throw new Error('Failed to start connection monitoring');
      }

      return { success: true, accountId, monitoring: true, interval: monitor.interval };
    } catch (error) {
      console.error('[IPC:View] Failed to start connection monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  // Stop connection monitoring
  ipcMain.handle('account:stop-connection-monitoring', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const success = viewManager.stopConnectionMonitoring(accountId);
      return { success, accountId };
    } catch (error) {
      console.error('[IPC:View] Failed to stop connection monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  // Start connection monitoring for all accounts
  ipcMain.handle('account:start-all-connection-monitoring', async (event, options = {}) => {
    try {
      const result = viewManager.startAllConnectionMonitoring(options);
      return { success: true, ...result };
    } catch (error) {
      console.error('[IPC:View] Failed to start all connection monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  // Stop connection monitoring for all accounts
  ipcMain.handle('account:stop-all-connection-monitoring', async () => {
    try {
      const result = viewManager.stopAllConnectionMonitoring();
      return { success: true, ...result };
    } catch (error) {
      console.error('[IPC:View] Failed to stop all connection monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  // Check login status (manual)
  ipcMain.handle('account:check-login-status', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const result = await viewManager.checkLoginStatus(accountId);
      return result;
    } catch (error) {
      console.error('[IPC:View] Failed to check login status:', error);
      return { success: false, error: error.message };
    }
  });

  // Start login status monitoring
  ipcMain.handle('account:start-login-status-monitoring', async (event, accountId, options = {}) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const account = await accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const monitor = viewManager.startLoginStatusMonitoring(accountId, options);
      if (!monitor) {
        throw new Error('Failed to start login status monitoring');
      }

      return { success: true, accountId, monitoring: true };
    } catch (error) {
      console.error('[IPC:View] Failed to start login status monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  // Stop login status monitoring
  ipcMain.handle('account:stop-login-status-monitoring', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const success = viewManager.stopLoginStatusMonitoring(accountId);
      return { success, accountId };
    } catch (error) {
      console.error('[IPC:View] Failed to stop login status monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  // Start login status monitoring for all accounts
  ipcMain.handle('account:start-all-login-status-monitoring', async (event, options = {}) => {
    try {
      const result = viewManager.startAllLoginStatusMonitoring(options);
      return { success: true, ...result };
    } catch (error) {
      console.error('[IPC:View] Failed to start all login status monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  // Stop login status monitoring for all accounts
  ipcMain.handle('account:stop-all-login-status-monitoring', async () => {
    try {
      const result = viewManager.stopAllLoginStatusMonitoring();
      return { success: true, ...result };
    } catch (error) {
      console.error('[IPC:View] Failed to stop all login status monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC:View] View handlers registered');
}

/**
 * Unregister view IPC handlers
 */
function unregister() {
  ipcMain.removeHandler('account:view-status');
  ipcMain.removeHandler('account:reload-view');
  ipcMain.removeHandler('account:recreate-view');
  ipcMain.removeHandler('account:login-status');
  ipcMain.removeHandler('account:load-url');
  ipcMain.removeHandler('get-view-bounds');
  ipcMain.removeHandler('get-active-account-id');
  ipcMain.removeHandler('restore-active-account');
  ipcMain.removeHandler('account:force-logout');
  ipcMain.removeHandler('account:handle-session-expiration');
  ipcMain.removeHandler('account:check-session-expiration');
  ipcMain.removeHandler('account:session-persistence-status');
  ipcMain.removeHandler('account:restore-all-login-states');
  ipcMain.removeHandler('account:start-session-monitoring');
  ipcMain.removeHandler('account:connection-status');
  ipcMain.removeHandler('account:check-connection-status');
  ipcMain.removeHandler('account:start-connection-monitoring');
  ipcMain.removeHandler('account:stop-connection-monitoring');
  ipcMain.removeHandler('account:start-all-connection-monitoring');
  ipcMain.removeHandler('account:stop-all-connection-monitoring');
  ipcMain.removeHandler('account:check-login-status');
  ipcMain.removeHandler('account:start-login-status-monitoring');
  ipcMain.removeHandler('account:stop-login-status-monitoring');
  ipcMain.removeHandler('account:start-all-login-status-monitoring');
  ipcMain.removeHandler('account:stop-all-login-status-monitoring');
  
  _accountManager = null;
  _viewManager = null;
  _mainWindow = null;
  
  console.log('[IPC:View] View handlers unregistered');
}

module.exports = {
  register,
  unregister
};
