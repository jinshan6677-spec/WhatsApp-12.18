/**
 * ViewLifecycle - 视图生命周期管理
 * 
 * 负责管理BrowserView的生命周期：创建、销毁、重载、显示、隐藏
 * 
 * @module presentation/windows/view-manager/ViewLifecycle
 */

/**
 * ViewLifecycle class
 */
class ViewLifecycle {
  /**
   * Create ViewLifecycle instance
   * @param {Object} options - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Function} [options.notifyRenderer] - Function to notify renderer
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.notifyRenderer = options.notifyRenderer || (() => {});
  }

  /**
   * Create logger function
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [ViewLifecycle] [${level.toUpperCase()}] ${message}`;
      
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
   * Set up event handlers for a BrowserView
   * @param {string} accountId - Account ID
   * @param {BrowserView} view - BrowserView instance
   * @param {Object} viewState - View state object
   * @param {Object} callbacks - Callback functions
   * @param {Function} callbacks.onLoginStatusDetect - Login status detection callback
   * @param {Function} callbacks.onConnectionStatusDetect - Connection status detection callback
   * @param {Function} callbacks.onProfileUpdate - Profile update callback
   */
  setupViewEventHandlers(accountId, view, viewState, callbacks = {}) {
    const { onLoginStatusDetect, onConnectionStatusDetect, onProfileUpdate } = callbacks;

    // Handle page load start
    view.webContents.on('did-start-loading', () => {
      viewState.status = 'loading';
      viewState.isLoaded = false;
      this.log('info', `View started loading for account ${accountId}`);
      
      // Notify renderer about loading state
      this.notifyRenderer('view-loading', { accountId, status: 'loading' });
    });

    // Handle page load completion
    view.webContents.on('did-finish-load', async () => {
      viewState.isLoaded = true;
      viewState.status = 'ready';
      this.log('info', `View loaded for account ${accountId}`);
      
      // Wait a bit for WhatsApp Web to render the UI
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Detect login status
      if (onLoginStatusDetect) {
        await onLoginStatusDetect(accountId, view);
      }
      
      // Detect connection status
      if (onConnectionStatusDetect) {
        await onConnectionStatusDetect(accountId, view);
      }
      
      // Notify renderer about ready state
      this.notifyRenderer('view-ready', { 
        accountId, 
        status: 'ready',
        loginStatus: viewState.loginStatus,
        connectionStatus: viewState.connectionStatus
      });
      
      // Set up periodic login status check
      this._setupPeriodicLoginCheck(accountId, view, viewState, onLoginStatusDetect);
    });

    // Handle load failures
    view.webContents.on('did-fail-load', async (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    this.log('error', `did-fail-load: account=${accountId}, code=${errorCode}, desc=${errorDescription}, url=${validatedURL}, mainFrame=${isMainFrame}`);
      
      await this._handleLoadFailure(accountId, view, viewState, errorCode, errorDescription, validatedURL);
    });

    

    // Handle navigation
    view.webContents.on('did-navigate', (_event, url) => {
      this.log('info', `View navigated for account ${accountId}: ${url}`);
      this.notifyRenderer('view-navigated', { accountId, url });
    });

    // Handle in-page navigation
    view.webContents.on('did-navigate-in-page', async (_event, url) => {
      this.log('debug', `View navigated in page for account ${accountId}: ${url}`);
      
      if (onLoginStatusDetect) {
        await onLoginStatusDetect(accountId, view);
      }
      
      if (onConnectionStatusDetect) {
        await onConnectionStatusDetect(accountId, view);
      }
    });

    // Handle console messages (for debugging)
    view.webContents.on('console-message', (_event, _level, message) => {
      if (process.env.NODE_ENV === 'development') {
        this.log('debug', `[Account ${accountId} Console] ${message}`);
      }
    });

    // Handle crashes
    view.webContents.on('render-process-gone', async (_event, details) => {
      await this._handleCrash(accountId, viewState, details);
    });

    // Handle unresponsive page
    view.webContents.on('unresponsive', () => {
      this.log('warn', `View became unresponsive for account ${accountId}`);
      this.notifyRenderer('view-unresponsive', { accountId });
    });

    // Handle page becoming responsive again
    view.webContents.on('responsive', () => {
      this.log('info', `View became responsive again for account ${accountId}`);
      this.notifyRenderer('view-responsive', { accountId });
    });
  }

  /**
   * Set up periodic login status check
   * @private
   */
  _setupPeriodicLoginCheck(accountId, view, viewState, onLoginStatusDetect) {
    if (!onLoginStatusDetect) return;

    let checkCount = 0;
    const maxChecks = 12; // Check for 1 minute (12 * 5 seconds)
    
    const periodicCheck = setInterval(async () => {
      checkCount++;
      if (checkCount >= maxChecks || !viewState || viewState.status === 'destroyed') {
        clearInterval(periodicCheck);
        return;
      }
      
      try {
        await onLoginStatusDetect(accountId, view);
      } catch (error) {
        this.log('debug', `Periodic login check failed for account ${accountId}:`, error);
        clearInterval(periodicCheck);
      }
    }, 5000);
    
    // Store interval ID for cleanup
    if (!viewState.intervals) {
      viewState.intervals = [];
    }
    viewState.intervals.push(periodicCheck);
  }

  /**
   * Handle load failure
   * @private
   */
  async _handleLoadFailure(accountId, view, viewState, errorCode, errorDescription, validatedURL) {
    // Ignore certain error codes that are not critical
    const ignoredErrors = [-3, -27]; // ERR_ABORTED, ERR_BLOCKED_BY_CLIENT
    
    if (ignoredErrors.includes(errorCode)) {
      this.log('debug', `Ignoring non-critical error for account ${accountId}: ${errorCode}`);
      return;
    }

    // Normalize error handling

    // Update view state
    viewState.status = 'error';
    viewState.connectionStatus = 'error';
    viewState.connectionError = {
      code: errorCode,
      description: errorDescription,
      url: validatedURL,
      timestamp: Date.now()
    };
    viewState.errorInfo = viewState.connectionError;
    
    this.log('error', `View load failed for account ${accountId}: ${errorDescription} (${errorCode}) at ${validatedURL}`);
    
    // Notify renderer about error
    this.notifyRenderer('view-error', { 
      accountId, 
      status: 'error',
      connectionStatus: 'error',
      error: {
        code: errorCode,
        message: errorDescription,
        url: validatedURL
      }
    });
    
    this.notifyRenderer('connection-status-changed', {
      accountId,
      connectionStatus: 'error',
      error: {
        code: errorCode,
        message: errorDescription
      }
    });
  }

  /**
   * Handle view crash
   * @private
   */
  async _handleCrash(accountId, viewState, details) {
    viewState.status = 'error';
    viewState.connectionStatus = 'error';
    viewState.connectionError = {
      reason: details.reason,
      exitCode: details.exitCode,
      timestamp: Date.now()
    };
    viewState.errorInfo = viewState.connectionError;
    
    this.log('error', `[崩溃] 账户 ${accountId} 渲染进程崩溃:`, details);
    
    // Normalize crash handling
    
    this.notifyRenderer('view-crashed', { 
      accountId, 
      status: 'error',
      connectionStatus: 'error',
      error: {
        reason: details.reason,
        exitCode: details.exitCode
      }
    });
    
    this.notifyRenderer('connection-status-changed', {
      accountId,
      connectionStatus: 'error',
      error: {
        reason: details.reason,
        exitCode: details.exitCode
      }
    });
  }

  /**
   * Destroy a view and clean up resources
   * @param {string} accountId - Account ID
   * @param {Object} viewState - View state object
   * @param {Electron.BrowserWindow} mainWindow - Main window
   * @returns {Promise<boolean>} Success status
   */
  async destroyView(accountId, viewState, mainWindow) {
    try {
      if (!viewState) {
        this.log('warn', `View for account ${accountId} does not exist`);
        return false;
      }

      this.log('info', `Destroying view for account ${accountId}`);

      // Clear any intervals
      if (viewState.intervals) {
        for (const intervalId of viewState.intervals) {
          clearInterval(intervalId);
        }
        viewState.intervals = [];
      }

      // Stop monitors
      if (viewState.connectionMonitor) {
        viewState.connectionMonitor.stop();
        viewState.connectionMonitor = null;
      }
      
      if (viewState.loginStatusMonitor) {
        viewState.loginStatusMonitor.stop();
        viewState.loginStatusMonitor = null;
      }

      // Remove from window if attached
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.removeBrowserView(viewState.view);
        } catch (removeError) {
          this.log('debug', `View may not be attached to window: ${removeError.message}`);
        }
      }

      // Destroy the view
      if (viewState.view && !viewState.view.webContents.isDestroyed()) {
        viewState.view.webContents.destroy();
      }

      viewState.status = 'destroyed';

      this.log('info', `View destroyed for account ${accountId}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to destroy view for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Reload a view
   * @param {string} accountId - Account ID
   * @param {Object} viewState - View state object
   * @param {boolean} [ignoreCache=false] - Whether to ignore cache
   * @returns {Promise<boolean>} Success status
   */
  async reloadView(accountId, viewState, ignoreCache = false) {
    try {
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      this.log('info', `Reloading view for account ${accountId} (ignoreCache: ${ignoreCache})`);

      // Reset error state
      viewState.status = 'loading';
      viewState.errorInfo = null;
      viewState.isLoaded = false;

      // Reload the view
      if (ignoreCache) {
        await viewState.view.webContents.reloadIgnoringCache();
      } else {
        await viewState.view.webContents.reload();
      }

      this.log('info', `View reloaded for account ${accountId}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to reload view for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Load a specific URL in a view
   * @param {string} accountId - Account ID
   * @param {Object} viewState - View state object
   * @param {string} url - URL to load
   * @returns {Promise<boolean>} Success status
   */
  async loadURL(accountId, viewState, url) {
    try {
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      if (!url) {
        throw new Error('URL is required');
      }

      this.log('info', `Loading URL for account ${accountId}: ${url}`);

      // Reset state
      viewState.status = 'loading';
      viewState.errorInfo = null;
      viewState.isLoaded = false;

      // Load URL
      await viewState.view.webContents.loadURL(url);

      this.log('info', `URL loaded for account ${accountId}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to load URL for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Show a view (attach and display)
   * @param {string} accountId - Account ID
   * @param {Object} viewState - View state object
   * @param {Electron.BrowserWindow} mainWindow - Main window
   * @param {Object} bounds - View bounds
   * @param {Object} [options] - Show options
   * @returns {Promise<boolean>} Success status
   */
  async showView(accountId, viewState, mainWindow, bounds, options = {}) {
    try {
      if (!viewState) {
        throw new Error(`View for account ${accountId} does not exist`);
      }

      if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error('Main window is not available');
      }

      this.log('info', `Showing view for account ${accountId}`);

      // Set view bounds before attaching
      viewState.bounds = bounds;
      viewState.view.setBounds(bounds);

      // Attach view to window
      mainWindow.addBrowserView(viewState.view);

      // Set as top view (makes it visible)
      mainWindow.setTopBrowserView(viewState.view);

      // Update state
      viewState.isVisible = true;

      this.log('info', `View shown for account ${accountId}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to show view for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Hide a view (detach from window)
   * @param {string} accountId - Account ID
   * @param {Object} viewState - View state object
   * @param {Electron.BrowserWindow} mainWindow - Main window
   * @returns {Promise<boolean>} Success status
   */
  async hideView(accountId, viewState, mainWindow) {
    try {
      if (!viewState) {
        this.log('warn', `View for account ${accountId} does not exist`);
        return false;
      }

      if (!viewState.isVisible) {
        this.log('debug', `View for account ${accountId} is already hidden`);
        return true;
      }

      this.log('info', `Hiding view for account ${accountId}`);

      // Remove from window
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.removeBrowserView(viewState.view);
        } catch (removeError) {
          this.log('debug', `View may not be attached to window: ${removeError.message}`);
        }
      }

      // Update state
      viewState.isVisible = false;

      this.log('info', `View hidden for account ${accountId}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to hide view for account ${accountId}:`, error);
      return false;
    }
  }
}

module.exports = ViewLifecycle;
