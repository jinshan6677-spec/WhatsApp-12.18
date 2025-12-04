/**
 * RecoveryManager - Handles recovery mechanisms for transient failures
 * 
 * Provides retry logic, session data recovery, account reset functionality,
 * and automatic reconnection for network issues.
 */

const { retryWithBackoff } = require('../shared/utils/ErrorHandler');
const { getErrorLogger, ErrorCategory } = require('./ErrorLogger');

/**
 * RecoveryManager class
 */
class RecoveryManager {
  /**
   * Create RecoveryManager instance
   * @param {Object} dependencies - Required dependencies
   * @param {SessionManager} dependencies.sessionManager - SessionManager instance
   * @param {ViewManager} dependencies.viewManager - ViewManager instance
   * @param {AccountConfigManager} dependencies.accountManager - AccountConfigManager instance
   * @param {Object} [options] - Configuration options
   */
  constructor(dependencies, options = {}) {
    if (!dependencies.sessionManager) {
      throw new Error('SessionManager is required');
    }
    if (!dependencies.viewManager) {
      throw new Error('ViewManager is required');
    }
    if (!dependencies.accountManager) {
      throw new Error('AccountConfigManager is required');
    }

    this.sessionManager = dependencies.sessionManager;
    this.viewManager = dependencies.viewManager;
    this.accountManager = dependencies.accountManager;
    
    this.options = {
      maxRetries: options.maxRetries || 3,
      initialRetryDelay: options.initialRetryDelay || 1000,
      maxRetryDelay: options.maxRetryDelay || 10000,
      reconnectInterval: options.reconnectInterval || 30000, // 30 seconds
      connectionCheckInterval: options.connectionCheckInterval || 60000, // 1 minute
      ...options
    };

    // Track reconnection attempts per account
    this.reconnectionAttempts = new Map();
    
    // Track active reconnection timers
    this.reconnectionTimers = new Map();
    
    // Track connection monitors
    this.connectionMonitors = new Map();

    // Initialize logger (handle test environment gracefully)
    try {
      this.logger = getErrorLogger();
    } catch (error) {
      // In test environment, use console logging
      this.logger = {
        info: (category, message, context) => console.log(`[INFO] ${message}`, context),
        warn: (category, message, context, error) => console.warn(`[WARN] ${message}`, context, error),
        error: (category, message, context, error) => console.error(`[ERROR] ${message}`, context, error)
      };
    }
    
    this.log = this._createLogger();
  }

  /**
   * Create logger function
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [RecoveryManager] [${level.toUpperCase()}] ${message}`;
      
      if (level === 'error') {
        console.error(logMessage, ...args);
      } else if (level === 'warn') {
        console.warn(logMessage, ...args);
      } else {
        console.log(logMessage, ...args);
      }
    };
  }

  /**
   * Retry an operation with exponential backoff
   * @param {Function} operation - Async operation to retry
   * @param {Object} [options] - Retry options
   * @param {number} [options.maxRetries] - Maximum retry attempts
   * @param {number} [options.initialDelay] - Initial delay in ms
   * @param {number} [options.maxDelay] - Maximum delay in ms
   * @param {Function} [options.shouldRetry] - Function to determine if should retry
   * @param {string} [options.operationName] - Name for logging
   * @returns {Promise<*>} Result of the operation
   */
  async retryOperation(operation, options = {}) {
    const {
      maxRetries = this.options.maxRetries,
      initialDelay = this.options.initialRetryDelay,
      maxDelay = this.options.maxRetryDelay,
      shouldRetry = this._defaultShouldRetry.bind(this),
      operationName = 'operation'
    } = options;

    this.log('info', `Starting retry operation: ${operationName}`);

    try {
      const result = await retryWithBackoff(operation, {
        maxRetries,
        initialDelay,
        maxDelay,
        shouldRetry
      });

      this.log('info', `Retry operation succeeded: ${operationName}`);
      return {
        success: true,
        result
      };
    } catch (error) {
      this.log('error', `Retry operation failed after ${maxRetries} attempts: ${operationName}`, error);
      
      await this.logger.error(
        ErrorCategory.RECOVERY,
        `Retry operation failed: ${operationName}`,
        {
          operationName,
          maxRetries,
          errorMessage: error.message
        },
        error
      );

      return {
        success: false,
        error: error.message,
        attempts: maxRetries + 1
      };
    }
  }

  /**
   * Default retry decision function
   * @private
   * @param {Error} error - Error that occurred
   * @param {number} attempt - Current attempt number
   * @returns {boolean} Whether to retry
   */
  _defaultShouldRetry(error, attempt) {
    // Don't retry on certain error types
    const nonRetryableErrors = [
      'EACCES',           // Permission denied
      'ENOTFOUND',        // DNS lookup failed
      'Invalid',          // Validation errors
      'Authentication'    // Auth errors
    ];

    const errorMessage = error.message || '';
    const shouldNotRetry = nonRetryableErrors.some(pattern => 
      errorMessage.includes(pattern)
    );

    if (shouldNotRetry) {
      this.log('info', `Not retrying due to non-retryable error: ${errorMessage}`);
      return false;
    }

    // Retry on network errors, timeouts, etc.
    return true;
  }

  /**
   * Recover corrupted session data for an account
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Recovery options
   * @param {boolean} [options.createBackup] - Create backup before recovery
   * @param {boolean} [options.preserveSettings] - Preserve account settings
   * @returns {Promise<Object>} Recovery result
   */
  async recoverSessionData(accountId, options = {}) {
    try {
      this.log('info', `Starting session data recovery for account ${accountId}`);

      const {
        createBackup = true,
        preserveSettings = true
      } = options;

      // Validate account exists
      const account = await this.accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Create backup if requested
      let backupPath = null;
      if (createBackup) {
        this.log('info', `Creating backup before recovery for account ${accountId}`);
        const backupResult = await this.sessionManager.backupSessionData(
          accountId,
          this.sessionManager.userDataPath
        );
        
        if (backupResult.success) {
          backupPath = backupResult.backupPath;
          this.log('info', `Backup created at: ${backupPath}`);
        } else {
          this.log('warn', `Failed to create backup: ${backupResult.error}`);
        }
      }

      // Clear corrupted session data
      this.log('info', `Clearing corrupted session data for account ${accountId}`);
      const clearResult = await this.sessionManager.clearSessionData(accountId);
      
      if (!clearResult.success) {
        throw new Error(`Failed to clear session data: ${clearResult.error}`);
      }

      // Destroy and recreate the view
      this.log('info', `Recreating view for account ${accountId}`);
      
      const viewExists = this.viewManager.hasView(accountId);
      if (viewExists) {
        await this.viewManager.destroyView(accountId);
      }

      // Recreate session with preserved settings
      const sessionConfig = preserveSettings ? {
        translation: account.translation
      } : {};

      const sessionResult = await this.sessionManager.createSession(accountId, sessionConfig);
      
      if (!sessionResult.success) {
        throw new Error(`Failed to recreate session: ${sessionResult.error}`);
      }

      // Recreate view
      const viewConfig = {
        translation: account.translation
      };

      await this.viewManager.createView(accountId, viewConfig);

      this.log('info', `Session data recovery completed for account ${accountId}`);

      await this.logger.info(
        ErrorCategory.RECOVERY,
        `Session data recovered for account ${accountId}`,
        {
          accountId,
          backupCreated: !!backupPath,
          backupPath,
          settingsPreserved: preserveSettings
        }
      );

      return {
        success: true,
        accountId,
        backupPath,
        message: 'Session data recovered successfully'
      };
    } catch (error) {
      this.log('error', `Failed to recover session data for account ${accountId}:`, error);
      
      await this.logger.error(
        ErrorCategory.RECOVERY,
        `Session data recovery failed for account ${accountId}`,
        {
          accountId,
          errorMessage: error.message
        },
        error
      );

      return {
        success: false,
        accountId,
        error: error.message
      };
    }
  }

  /**
   * Reset an account (clear all data and restart)
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Reset options
   * @param {boolean} [options.createBackup] - Create backup before reset
   * @param {boolean} [options.preserveSettings] - Preserve account settings
   * @param {boolean} [options.reloadView] - Reload view after reset
   * @returns {Promise<Object>} Reset result
   */
  async resetAccount(accountId, options = {}) {
    try {
      this.log('info', `Starting account reset for ${accountId}`);

      const {
        createBackup = true,
        preserveSettings = true,
        reloadView = true
      } = options;

      // Validate account exists
      const account = await this.accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Create backup if requested
      let backupPath = null;
      if (createBackup) {
        this.log('info', `Creating backup before reset for account ${accountId}`);
        const backupResult = await this.sessionManager.backupSessionData(
          accountId,
          this.sessionManager.userDataPath
        );
        
        if (backupResult.success) {
          backupPath = backupResult.backupPath;
          this.log('info', `Backup created at: ${backupPath}`);
        } else {
          this.log('warn', `Failed to create backup: ${backupResult.error}`);
        }
      }

      // Get view before destroying
      const viewState = this.viewManager.getViewState(accountId);
      const view = viewState ? viewState.view : null;

      // Force logout (clears all session data)
      this.log('info', `Forcing logout for account ${accountId}`);
      const logoutResult = await this.sessionManager.forceLogout(accountId, view);
      
      if (!logoutResult.success) {
        throw new Error(`Failed to force logout: ${logoutResult.error}`);
      }

      // Reload view if requested and view exists
      if (reloadView && view && !view.webContents.isDestroyed()) {
        this.log('info', `Reloading view for account ${accountId}`);
        try {
          await view.webContents.loadURL('https://web.whatsapp.com');
        } catch (loadError) {
          this.log('warn', `Failed to reload view: ${loadError.message}`);
        }
      }

      this.log('info', `Account reset completed for ${accountId}`);

      await this.logger.info(
        ErrorCategory.RECOVERY,
        `Account reset completed for ${accountId}`,
        {
          accountId,
          backupCreated: !!backupPath,
          backupPath,
          settingsPreserved: preserveSettings,
          viewReloaded: reloadView
        }
      );

      return {
        success: true,
        accountId,
        backupPath,
        message: 'Account reset successfully'
      };
    } catch (error) {
      this.log('error', `Failed to reset account ${accountId}:`, error);
      
      await this.logger.error(
        ErrorCategory.RECOVERY,
        `Account reset failed for ${accountId}`,
        {
          accountId,
          errorMessage: error.message
        },
        error
      );

      return {
        success: false,
        accountId,
        error: error.message
      };
    }
  }

  /**
   * Attempt to reconnect an account
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Reconnection options
   * @returns {Promise<Object>} Reconnection result
   */
  async reconnectAccount(accountId, options = {}) {
    try {
      this.log('info', `Attempting to reconnect account ${accountId}`);

      // Get view state
      const viewState = this.viewManager.getViewState(accountId);
      if (!viewState) {
        throw new Error(`View for account ${accountId} not found`);
      }

      const view = viewState.view;
      if (!view || view.webContents.isDestroyed()) {
        throw new Error(`View for account ${accountId} is destroyed`);
      }

      // Check current connection status
      const currentStatus = viewState.connectionStatus;
      this.log('info', `Current connection status for ${accountId}: ${currentStatus}`);

      // Attempt reconnection based on status
      let reconnectionResult;

      if (currentStatus === 'error' || viewState.status === 'error') {
        // Reload the page for error states
        this.log('info', `Reloading page for account ${accountId} due to error state`);
        reconnectionResult = await this._reloadView(accountId, view);
      } else if (currentStatus === 'offline') {
        // Try to refresh connection for offline state
        this.log('info', `Refreshing connection for account ${accountId}`);
        reconnectionResult = await this._refreshConnection(accountId, view);
      } else {
        // Already online
        this.log('info', `Account ${accountId} is already online`);
        return {
          success: true,
          accountId,
          status: 'already_online',
          connectionStatus: currentStatus
        };
      }

      if (reconnectionResult.success) {
        // Reset reconnection attempts counter
        this.reconnectionAttempts.delete(accountId);
        
        this.log('info', `Reconnection successful for account ${accountId}`);
        
        return {
          success: true,
          accountId,
          status: 'reconnected',
          connectionStatus: reconnectionResult.connectionStatus
        };
      } else {
        throw new Error(reconnectionResult.error || 'Reconnection failed');
      }
    } catch (error) {
      this.log('error', `Failed to reconnect account ${accountId}:`, error);
      
      // Track reconnection attempts
      const attempts = (this.reconnectionAttempts.get(accountId) || 0) + 1;
      this.reconnectionAttempts.set(accountId, attempts);

      await this.logger.warn(
        ErrorCategory.RECOVERY,
        `Reconnection failed for account ${accountId}`,
        {
          accountId,
          attempts,
          errorMessage: error.message
        },
        error
      );

      return {
        success: false,
        accountId,
        error: error.message,
        attempts
      };
    }
  }

  /**
   * Reload a view
   * @private
   * @param {string} accountId - Account ID
   * @param {BrowserView} view - BrowserView instance
   * @returns {Promise<Object>} Reload result
   */
  async _reloadView(accountId, view) {
    try {
      await view.webContents.reload();
      
      // Wait for page to load
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Reload timeout'));
        }, 30000); // 30 second timeout

        const onLoad = () => {
          clearTimeout(timeout);
          view.webContents.removeListener('did-finish-load', onLoad);
          view.webContents.removeListener('did-fail-load', onFail);
          resolve();
        };

        const onFail = (_event, errorCode, errorDescription) => {
          clearTimeout(timeout);
          view.webContents.removeListener('did-finish-load', onLoad);
          view.webContents.removeListener('did-fail-load', onFail);
          reject(new Error(`Load failed: ${errorDescription} (${errorCode})`));
        };

        view.webContents.once('did-finish-load', onLoad);
        view.webContents.once('did-fail-load', onFail);
      });

      // Check connection status after reload
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for page to stabilize
      
      const viewState = this.viewManager.getViewState(accountId);
      const connectionStatus = viewState ? viewState.connectionStatus : 'unknown';

      return {
        success: true,
        connectionStatus
      };
    } catch (error) {
      this.log('error', `Failed to reload view for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Refresh connection without full reload
   * @private
   * @param {string} accountId - Account ID
   * @param {BrowserView} view - BrowserView instance
   * @returns {Promise<Object>} Refresh result
   */
  async _refreshConnection(accountId, view) {
    try {
      // Execute script to trigger reconnection in WhatsApp Web
      await view.webContents.executeJavaScript(`
        (function() {
          // Try to trigger reconnection by simulating user activity
          window.dispatchEvent(new Event('online'));
          
          // Try to click reconnect button if present
          const reconnectButton = document.querySelector('[data-testid="alert-phone-connection"] button') ||
                                  document.querySelector('button[aria-label*="Retry"]') ||
                                  document.querySelector('button[aria-label*="Reconnect"]');
          
          if (reconnectButton) {
            reconnectButton.click();
            return { triggered: true, method: 'button_click' };
          }
          
          return { triggered: true, method: 'online_event' };
        })();
      `);

      // Wait for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

      const viewState = this.viewManager.getViewState(accountId);
      const connectionStatus = viewState ? viewState.connectionStatus : 'unknown';

      return {
        success: connectionStatus === 'online',
        connectionStatus
      };
    } catch (error) {
      this.log('error', `Failed to refresh connection for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start automatic reconnection for an account
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Reconnection options
   * @param {number} [options.interval] - Reconnection interval in ms
   * @param {number} [options.maxAttempts] - Maximum reconnection attempts (0 = unlimited)
   * @returns {Object} Control object with stop() method
   */
  startAutoReconnect(accountId, options = {}) {
    const {
      interval = this.options.reconnectInterval,
      maxAttempts = 0
    } = options;

    // Stop existing auto-reconnect if any
    this.stopAutoReconnect(accountId);

    this.log('info', `Starting auto-reconnect for account ${accountId} (interval: ${interval}ms)`);

    let attempts = 0;
    let isActive = true;

    const attemptReconnect = async () => {
      if (!isActive) return;

      attempts++;
      
      // Check if max attempts reached
      if (maxAttempts > 0 && attempts > maxAttempts) {
        this.log('warn', `Max reconnection attempts (${maxAttempts}) reached for account ${accountId}`);
        this.stopAutoReconnect(accountId);
        return;
      }

      this.log('info', `Auto-reconnect attempt ${attempts} for account ${accountId}`);

      const result = await this.reconnectAccount(accountId);

      if (result.success) {
        this.log('info', `Auto-reconnect successful for account ${accountId}`);
        this.stopAutoReconnect(accountId);
      } else if (isActive) {
        // Schedule next attempt
        const timer = setTimeout(attemptReconnect, interval);
        this.reconnectionTimers.set(accountId, timer);
      }
    };

    // Start first attempt
    const initialTimer = setTimeout(attemptReconnect, interval);
    this.reconnectionTimers.set(accountId, initialTimer);

    // Return control object
    return {
      stop: () => {
        isActive = false;
        this.stopAutoReconnect(accountId);
      },
      getAttempts: () => attempts
    };
  }

  /**
   * Stop automatic reconnection for an account
   * @param {string} accountId - Account ID
   */
  stopAutoReconnect(accountId) {
    const timer = this.reconnectionTimers.get(accountId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectionTimers.delete(accountId);
      this.log('info', `Stopped auto-reconnect for account ${accountId}`);
    }
  }

  /**
   * Start connection monitoring for an account
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Monitoring options
   * @param {number} [options.interval] - Check interval in ms
   * @param {Function} [options.onStatusChange] - Callback for status changes
   * @param {boolean} [options.autoReconnect] - Automatically reconnect on failure
   * @returns {Object} Monitor control object
   */
  startConnectionMonitor(accountId, options = {}) {
    const {
      interval = this.options.connectionCheckInterval,
      onStatusChange = null,
      autoReconnect = true
    } = options;

    // Stop existing monitor if any
    this.stopConnectionMonitor(accountId);

    this.log('info', `Starting connection monitor for account ${accountId} (interval: ${interval}ms)`);

    let isActive = true;
    let lastStatus = null;

    const checkConnection = async () => {
      if (!isActive) return;

      try {
        const viewState = this.viewManager.getViewState(accountId);
        if (!viewState) {
          this.log('warn', `View not found for account ${accountId}, stopping monitor`);
          this.stopConnectionMonitor(accountId);
          return;
        }

        const currentStatus = viewState.connectionStatus;

        // Check if status changed
        if (currentStatus !== lastStatus) {
          this.log('info', `Connection status changed for ${accountId}: ${lastStatus} -> ${currentStatus}`);
          lastStatus = currentStatus;

          // Call status change callback
          if (onStatusChange && typeof onStatusChange === 'function') {
            try {
              onStatusChange({
                accountId,
                status: currentStatus,
                previousStatus: lastStatus,
                timestamp: Date.now()
              });
            } catch (callbackError) {
              this.log('error', `Status change callback error for ${accountId}:`, callbackError);
            }
          }

          // Auto-reconnect if enabled and status is error or offline
          if (autoReconnect && (currentStatus === 'error' || currentStatus === 'offline')) {
            this.log('info', `Auto-reconnect triggered for ${accountId} due to ${currentStatus} status`);
            this.startAutoReconnect(accountId);
          }
        }
      } catch (error) {
        this.log('error', `Connection check failed for ${accountId}:`, error);
      }

      // Schedule next check
      if (isActive) {
        const timer = setTimeout(checkConnection, interval);
        this.connectionMonitors.set(accountId, timer);
      }
    };

    // Start first check
    const initialTimer = setTimeout(checkConnection, interval);
    this.connectionMonitors.set(accountId, initialTimer);

    // Return control object
    return {
      stop: () => {
        isActive = false;
        this.stopConnectionMonitor(accountId);
      }
    };
  }

  /**
   * Stop connection monitoring for an account
   * @param {string} accountId - Account ID
   */
  stopConnectionMonitor(accountId) {
    const timer = this.connectionMonitors.get(accountId);
    if (timer) {
      clearTimeout(timer);
      this.connectionMonitors.delete(accountId);
      this.log('info', `Stopped connection monitor for account ${accountId}`);
    }
  }

  /**
   * Stop all monitors and timers for an account
   * @param {string} accountId - Account ID
   */
  stopAllMonitors(accountId) {
    this.stopAutoReconnect(accountId);
    this.stopConnectionMonitor(accountId);
    this.reconnectionAttempts.delete(accountId);
  }

  /**
   * Cleanup all monitors and timers
   */
  cleanup() {
    this.log('info', 'Cleaning up all recovery monitors');

    // Stop all reconnection timers
    for (const accountId of this.reconnectionTimers.keys()) {
      this.stopAutoReconnect(accountId);
    }

    // Stop all connection monitors
    for (const accountId of this.connectionMonitors.keys()) {
      this.stopConnectionMonitor(accountId);
    }

    // Clear all tracking maps
    this.reconnectionAttempts.clear();
    this.reconnectionTimers.clear();
    this.connectionMonitors.clear();

    this.log('info', 'Recovery manager cleanup completed');
  }

  /**
   * Get recovery status for an account
   * @param {string} accountId - Account ID
   * @returns {Object} Recovery status
   */
  getRecoveryStatus(accountId) {
    return {
      reconnectionAttempts: this.reconnectionAttempts.get(accountId) || 0,
      hasAutoReconnect: this.reconnectionTimers.has(accountId),
      hasConnectionMonitor: this.connectionMonitors.has(accountId)
    };
  }

  /**
   * Get recovery status for all accounts
   * @returns {Map<string, Object>} Map of accountId to recovery status
   */
  getAllRecoveryStatus() {
    const status = new Map();
    
    // Get all unique account IDs from all tracking maps
    const accountIds = new Set([
      ...this.reconnectionAttempts.keys(),
      ...this.reconnectionTimers.keys(),
      ...this.connectionMonitors.keys()
    ]);

    for (const accountId of accountIds) {
      status.set(accountId, this.getRecoveryStatus(accountId));
    }

    return status;
  }
}

module.exports = RecoveryManager;
