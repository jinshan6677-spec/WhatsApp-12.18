/**
 * Recovery IPC Handlers
 * 
 * Handles IPC communication for recovery operations including:
 * - Session data recovery
 * - Account reset
 * - Manual reconnection
 * - Auto-reconnection control
 */

const { ipcMain } = require('electron');
const errorHandler = getErrorHandler();

// 使用errorHandler的wrapIPCHandler方法
const wrapIPCHandler = (handler, options) => {
  return errorHandler.wrapIPCHandler(handler, options);
};
const { ErrorCategory } = require('../utils/ErrorLogger');

/**
 * Setup recovery IPC handlers
 * @param {RecoveryManager} recoveryManager - RecoveryManager instance
 * @param {MainWindow} mainWindow - MainWindow instance
 */
function setupRecoveryHandlers(recoveryManager, mainWindow) {
  if (!recoveryManager) {
    throw new Error('RecoveryManager is required');
  }
  if (!mainWindow) {
    throw new Error('MainWindow is required');
  }

  /**
   * Recover session data for an account
   */
  ipcMain.handle('recovery:recover-session', wrapIPCHandler(
    async (_event, { accountId, options = {} }) => {
      if (!accountId) {
        return {
          success: false,
          error: 'Account ID is required'
        };
      }

      const result = await recoveryManager.recoverSessionData(accountId, options);
      
      // Notify renderer about recovery result
      if (result.success) {
        mainWindow.sendToRenderer('recovery:session-recovered', {
          accountId,
          backupPath: result.backupPath
        });
      }

      return result;
    },
    {
      channel: 'recovery:recover-session',
      category: ErrorCategory.RECOVERY
    }
  ));

  /**
   * Reset an account
   */
  ipcMain.handle('recovery:reset-account', wrapIPCHandler(
    async (_event, { accountId, options = {} }) => {
      if (!accountId) {
        return {
          success: false,
          error: 'Account ID is required'
        };
      }

      const result = await recoveryManager.resetAccount(accountId, options);
      
      // Notify renderer about reset result
      if (result.success) {
        mainWindow.sendToRenderer('recovery:account-reset', {
          accountId,
          backupPath: result.backupPath
        });
      }

      return result;
    },
    {
      channel: 'recovery:reset-account',
      category: ErrorCategory.RECOVERY
    }
  ));

  /**
   * Manually reconnect an account
   */
  ipcMain.handle('recovery:reconnect', wrapIPCHandler(
    async (_event, { accountId, options = {} }) => {
      if (!accountId) {
        return {
          success: false,
          error: 'Account ID is required'
        };
      }

      const result = await recoveryManager.reconnectAccount(accountId, options);
      
      // Notify renderer about reconnection result
      if (result.success) {
        mainWindow.sendToRenderer('recovery:reconnected', {
          accountId,
          status: result.status,
          connectionStatus: result.connectionStatus
        });
      }

      return result;
    },
    {
      channel: 'recovery:reconnect',
      category: ErrorCategory.RECOVERY
    }
  ));

  /**
   * Start auto-reconnect for an account
   */
  ipcMain.handle('recovery:start-auto-reconnect', wrapIPCHandler(
    async (_event, { accountId, options = {} }) => {
      if (!accountId) {
        return {
          success: false,
          error: 'Account ID is required'
        };
      }

      recoveryManager.startAutoReconnect(accountId, options);

      return {
        success: true,
        accountId,
        message: 'Auto-reconnect started'
      };
    },
    {
      channel: 'recovery:start-auto-reconnect',
      category: ErrorCategory.RECOVERY
    }
  ));

  /**
   * Stop auto-reconnect for an account
   */
  ipcMain.handle('recovery:stop-auto-reconnect', wrapIPCHandler(
    async (_event, { accountId }) => {
      if (!accountId) {
        return {
          success: false,
          error: 'Account ID is required'
        };
      }

      recoveryManager.stopAutoReconnect(accountId);

      return {
        success: true,
        accountId,
        message: 'Auto-reconnect stopped'
      };
    },
    {
      channel: 'recovery:stop-auto-reconnect',
      category: ErrorCategory.RECOVERY
    }
  ));

  /**
   * Start connection monitor for an account
   */
  ipcMain.handle('recovery:start-monitor', wrapIPCHandler(
    async (_event, { accountId, options = {} }) => {
      if (!accountId) {
        return {
          success: false,
          error: 'Account ID is required'
        };
      }

      // Setup status change callback to notify renderer
      const monitorOptions = {
        ...options,
        onStatusChange: (statusInfo) => {
          mainWindow.sendToRenderer('recovery:status-changed', statusInfo);
        }
      };

      recoveryManager.startConnectionMonitor(accountId, monitorOptions);

      return {
        success: true,
        accountId,
        message: 'Connection monitor started'
      };
    },
    {
      channel: 'recovery:start-monitor',
      category: ErrorCategory.RECOVERY
    }
  ));

  /**
   * Stop connection monitor for an account
   */
  ipcMain.handle('recovery:stop-monitor', wrapIPCHandler(
    async (_event, { accountId }) => {
      if (!accountId) {
        return {
          success: false,
          error: 'Account ID is required'
        };
      }

      recoveryManager.stopConnectionMonitor(accountId);

      return {
        success: true,
        accountId,
        message: 'Connection monitor stopped'
      };
    },
    {
      channel: 'recovery:stop-monitor',
      category: ErrorCategory.RECOVERY
    }
  ));

  /**
   * Get recovery status for an account
   */
  ipcMain.handle('recovery:get-status', wrapIPCHandler(
    async (_event, { accountId }) => {
      if (!accountId) {
        return {
          success: false,
          error: 'Account ID is required'
        };
      }

      const status = recoveryManager.getRecoveryStatus(accountId);

      return {
        success: true,
        accountId,
        status
      };
    },
    {
      channel: 'recovery:get-status',
      category: ErrorCategory.RECOVERY
    }
  ));

  /**
   * Get recovery status for all accounts
   */
  ipcMain.handle('recovery:get-all-status', wrapIPCHandler(
    async (_event) => {
      const statusMap = recoveryManager.getAllRecoveryStatus();
      
      // Convert Map to object for IPC transfer
      const statusObject = {};
      for (const [accountId, status] of statusMap) {
        statusObject[accountId] = status;
      }

      return {
        success: true,
        status: statusObject
      };
    },
    {
      channel: 'recovery:get-all-status',
      category: ErrorCategory.RECOVERY
    }
  ));

  /**
   * Retry an operation with exponential backoff
   */
  ipcMain.handle('recovery:retry-operation', wrapIPCHandler(
    async (_event, { operationName, operationData, options = {} }) => {
      if (!operationName) {
        return {
          success: false,
          error: 'Operation name is required'
        };
      }

      // This is a generic retry handler that can be used for various operations
      // The actual operation logic should be implemented based on operationName
      
      return {
        success: false,
        error: 'Operation not implemented',
        operationName
      };
    },
    {
      channel: 'recovery:retry-operation',
      category: ErrorCategory.RECOVERY
    }
  ));

  console.log('[RecoveryHandlers] Recovery IPC handlers registered');
}

/**
 * Cleanup recovery IPC handlers
 */
function cleanupRecoveryHandlers() {
  const channels = [
    'recovery:recover-session',
    'recovery:reset-account',
    'recovery:reconnect',
    'recovery:start-auto-reconnect',
    'recovery:stop-auto-reconnect',
    'recovery:start-monitor',
    'recovery:stop-monitor',
    'recovery:get-status',
    'recovery:get-all-status',
    'recovery:retry-operation'
  ];

  channels.forEach(channel => {
    ipcMain.removeHandler(channel);
  });

  console.log('[RecoveryHandlers] Recovery IPC handlers cleaned up');
}

module.exports = {
  setupRecoveryHandlers,
  cleanupRecoveryHandlers
};
