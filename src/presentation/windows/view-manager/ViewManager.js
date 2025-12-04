/**
 * ViewManager - BrowserView Lifecycle Manager
 * 
 * 重构后的ViewManager，使用模块化设计协调各个子模块：
 * - ViewFactory: 视图创建
 * - ViewLifecycle: 生命周期管理
 * - ViewBoundsManager: 边界计算
 * - ViewResizeHandler: 窗口大小调整
 * - ViewMemoryManager: 内存管理
 * - ViewPerformanceOptimizer: 性能优化
 * - ViewTranslationIntegration: 翻译集成
 * 
 * @module presentation/windows/view-manager/ViewManager
 */

const ViewFactory = require('./ViewFactory');
const ViewLifecycle = require('./ViewLifecycle');
const ViewBoundsManager = require('./ViewBoundsManager');
const ViewResizeHandler = require('./ViewResizeHandler');
const ViewMemoryManager = require('./ViewMemoryManager');
const ViewPerformanceOptimizer = require('./ViewPerformanceOptimizer');
const ViewTranslationIntegration = require('./ViewTranslationIntegration');
const { validateViewCreationParams, validateAccountSwitch, handleViewCreationFailure } = require('../../../utils/ValidationHelper');

/**
 * ViewManager class - Main coordinator
 */
class ViewManager {
  constructor(mainWindow, sessionManager, options = {}) {
    if (!mainWindow) throw new Error('MainWindow instance is required');
    if (!sessionManager) throw new Error('SessionManager instance is required');

    this.mainWindow = mainWindow;
    this.sessionManager = sessionManager;
    this.accountManager = options.accountManager || null;
    this.options = {
      defaultSidebarWidth: options.defaultSidebarWidth || 280,
      debounceDelay: options.debounceDelay || 100,
      lazyLoadViews: options.lazyLoadViews !== false,
      maxConcurrentViews: options.maxConcurrentViews || 10,
      viewPoolSize: options.viewPoolSize || 2,
      memoryWarningThreshold: options.memoryWarningThreshold || 300,
      maxMemoryPerView: options.maxMemoryPerView || 500,
      autoMemoryCleanup: options.autoMemoryCleanup !== false,
      ...options
    };

    // Map: accountId -> ViewState
    this.views = new Map();
    this.activeAccountId = null;
    this.log = this._createLogger();
    this.stateStore = this.mainWindow.getStateStore();

    // Backward compatibility: expose resizeDebounceTimer
    this.resizeDebounceTimer = null;

    // Initialize sub-modules
    this._initializeModules(options);
  }

  _initializeModules(options) {
    const loggerOption = { logger: this.log };
    const notifyOption = { notifyRenderer: this._notifyRenderer.bind(this) };

    this.viewFactory = new ViewFactory(loggerOption);
    this.boundsManager = new ViewBoundsManager(this.mainWindow, { ...loggerOption, defaultSidebarWidth: this.options.defaultSidebarWidth });
    this.resizeHandler = new ViewResizeHandler(this.boundsManager, { ...loggerOption, debounceDelay: this.options.debounceDelay });
    this.memoryManager = new ViewMemoryManager({ ...loggerOption, ...notifyOption, ...this.options });
    this.performanceOptimizer = new ViewPerformanceOptimizer({ ...loggerOption, ...this.options });
    this.translationIntegration = new ViewTranslationIntegration(options.translationIntegration, { ...loggerOption, ...notifyOption });

    // Initialize ViewLifecycle
    this.viewLifecycle = new ViewLifecycle({
      ...loggerOption,
      ...notifyOption
    });

    if (this.options.autoMemoryCleanup) {
      this.memoryManager.startMemoryMonitoring(this.views, this.reloadView.bind(this));
    }
  }

  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [ViewManager] [${level.toUpperCase()}] ${message}`;
      if (level === 'error') console.error(logMessage, ...args);
      else if (level === 'warn') console.warn(logMessage, ...args);
      else console.log(logMessage, ...args);
    };
  }

  _notifyRenderer(channel, data) {
    try {
      const window = this.mainWindow.getWindow();
      if (window && !window.isDestroyed() && window.webContents) {
        window.webContents.send(`view-manager:${channel}`, data);
      }
    } catch (error) {
      this.log('error', `Failed to notify renderer on channel ${channel}:`, error);
    }
  }

  _saveActiveAccountId() {
    try {
      if (this.activeAccountId) this.stateStore.set('activeAccountId', this.activeAccountId);
      else this.stateStore.delete('activeAccountId');
    } catch (error) {
      this.log('error', 'Failed to save active account ID:', error);
    }
  }

  getSavedActiveAccountId() {
    try { return this.stateStore.get('activeAccountId', null); }
    catch (error) { this.log('error', 'Failed to get saved active account ID:', error); return null; }
  }

  async restoreActiveAccount(accountIds = []) {
    try {
      const savedId = this.getSavedActiveAccountId();
      if (!savedId) return { success: false, reason: 'no_saved_account' };
      if (!Array.isArray(accountIds) || accountIds.length === 0 || !accountIds.includes(savedId)) {
        try { this.stateStore.delete('activeAccountId'); } catch (_) { }
        return { success: false, reason: 'account_not_found', accountId: savedId };
      }
      await this.createView(savedId);
      const shown = await this.showView(savedId);
      if (shown) return { success: true, accountId: savedId };
      return { success: false, reason: 'show_failed', accountId: savedId };
    } catch (error) {
      this.log('error', 'Failed to restore active account:', error);
      return { success: false, reason: 'error', error: error.message };
    }
  }

  async createView(accountId, config = {}) {
    try {
      if (!accountId) throw new Error('Account ID is required');
      const validation = validateViewCreationParams(accountId, config);
      if (!validation.valid) throw new Error(`Invalid view creation parameters: ${validation.errors.join(', ')}`);
      if (this.views.has(accountId)) return this.views.get(accountId).view;

      this.log('info', `Creating view for account ${accountId}`);
      const accountSession = this.sessionManager.getInstanceSession(accountId);
      const isolationValidation = await this.viewFactory.validateSessionIsolation(accountId, accountSession, this.views);
      if (!isolationValidation.valid) this.log('warn', `Session isolation warning for ${accountId}: ${isolationValidation.message}`);

      // Load environment configuration for this account
      let environmentConfig = null;
      try {
        const EnvironmentConfigManager = require('../../../environment/EnvironmentConfigManager');
        const envManager = new EnvironmentConfigManager();
        environmentConfig = envManager.getConfig(accountId);

        if (environmentConfig) {
          this.log('info', `[ENV_DEBUG] Loaded config for ${accountId}`, {
            proxy: environmentConfig.proxy ? {
              enabled: environmentConfig.proxy.enabled,
              host: environmentConfig.proxy.host,
              port: environmentConfig.proxy.port
            } : 'none'
            // Note: fingerprint日志已移除，作为专业指纹系统重构的一部分
          });
        } else {
          this.log('warn', `[ENV_DEBUG] No config found for ${accountId}`);
        }
      } catch (envError) {
        this.log('error', `[ENV_DEBUG] Failed to load environment config for ${accountId}:`, envError);
      }

      // Merge environment config with provided config
      const viewConfig = {
        ...config,
        userAgent: config.userAgent,
        proxy: environmentConfig?.proxy
      };

      // Load fingerprint configuration for this account
      try {
        const { FingerprintRepository } = require('../../../infrastructure/fingerprint/FingerprintRepository');
        const repo = new FingerprintRepository();
        const fpConfig = await repo.loadByAccountId(accountId);
        if (fpConfig) {
          viewConfig.fingerprint = fpConfig.toJSON();
          if (!viewConfig.userAgent && fpConfig.userAgent) {
            viewConfig.userAgent = fpConfig.userAgent;
          }
          this.log('info', `[ENV_DEBUG] Fingerprint loaded for ${accountId}`);
        } else {
          this.log('warn', `[ENV_DEBUG] No fingerprint found for ${accountId}`);
        }
      } catch (fpError) {
        this.log('error', `[ENV_DEBUG] Failed to load fingerprint for ${accountId}:`, fpError);
      }

      this.log('info', `[ENV_DEBUG] Final view config for ${accountId}:`, {
        userAgent: viewConfig.userAgent,
        proxyEnabled: viewConfig.proxy?.enabled
      });

      const view = await this.viewFactory.createView(accountId, accountSession, viewConfig);


      const viewState = this.viewFactory.createViewState(accountId, view, accountSession, viewConfig);
      this.views.set(accountId, viewState);

      this.viewLifecycle.setupViewEventHandlers(accountId, view, viewState, {
        onLoginStatusDetect: this._detectLoginStatus.bind(this),
        onConnectionStatusDetect: this._detectConnectionStatus.bind(this),
        onProfileUpdate: this._updateAccountProfileFromWeb.bind(this)
      });

      // Inject translation scripts
      if (this.translationIntegration.isAvailable()) {
        await this.translationIntegration.injectScripts(accountId, view, config.translation);
      }

      // Load URL
      const url = config.url || 'https://web.whatsapp.com';
      try {
        viewState.status = 'loading';
        this._notifyRenderer('view-created', { accountId, url });
        await view.webContents.loadURL(url);
      } catch (loadError) {
        this.log('error', `Failed to load URL for account ${accountId}:`, loadError);

        // Enhance error message for proxy failures
        let userMessage = loadError.message;
        if (loadError.code === 'ERR_PROXY_CONNECTION_FAILED' ||
          loadError.code === 'ERR_SOCKS_CONNECTION_FAILED' ||
          loadError.code === 'ERR_TUNNEL_CONNECTION_FAILED' ||
          loadError.code === 'ERR_TIMED_OUT') {
          userMessage = `Unable to connect via proxy (${loadError.code}). Please check your proxy settings and network connection.`;
        }

        viewState.status = 'error';
        viewState.errorInfo = {
          message: userMessage,
          code: loadError.code,
          timestamp: Date.now()
        };
        this._notifyRenderer('view-error', { accountId, status: 'error', error: viewState.errorInfo });
      }

      return view;
    } catch (error) {
      this.log('error', `Failed to create view for account ${accountId}:`, error);
      const failureInfo = handleViewCreationFailure(error, accountId);
      if (this.views.has(accountId)) {
        const viewState = this.views.get(accountId);
        if (viewState?.view && !viewState.view.webContents.isDestroyed()) viewState.view.webContents.destroy();
        this.views.delete(accountId);
      }
      this._notifyRenderer('view-creation-failed', { accountId, userMessage: failureInfo.userMessage, suggestedAction: failureInfo.suggestedAction, timestamp: Date.now() });
      throw error;
    }
  }

  async showView(accountId, options = {}) {
    try {
      if (!accountId) throw new Error('Account ID is required');
      const viewState = this.views.get(accountId);
      if (!viewState) throw new Error(`View for account ${accountId} does not exist`);
      const window = this.mainWindow.getWindow();
      if (!window || window.isDestroyed()) throw new Error('Main window is not available');
      if (this.activeAccountId === accountId && viewState.isVisible) return true;

      this._notifyRenderer('view-switching', { fromAccountId: this.activeAccountId, toAccountId: accountId, timestamp: Date.now() });
      const previousAccountId = this.activeAccountId;
      const bounds = this.boundsManager.calculateViewBounds();

      await this.viewLifecycle.showView(accountId, viewState, window, bounds, options);
      const oldActiveAccountId = this.activeAccountId;
      this.activeAccountId = accountId;
      this._saveActiveAccountId();

      if (previousAccountId && previousAccountId !== accountId) await this.hideView(previousAccountId);
      this._notifyRenderer('view-switched', { fromAccountId: oldActiveAccountId, toAccountId: accountId, timestamp: Date.now() });
      return true;
    } catch (error) {
      this.log('error', `Failed to show view for account ${accountId}:`, error);
      this._notifyRenderer('view-switch-failed', { accountId, error: error.message, timestamp: Date.now() });
      return false;
    }
  }

  async hideView(accountId) {
    const viewState = this.views.get(accountId);
    const window = this.mainWindow.getWindow();
    const result = await this.viewLifecycle.hideView(accountId, viewState, window);
    if (result && this.activeAccountId === accountId) {
      this.activeAccountId = null;
      this._saveActiveAccountId();
    }
    return result;
  }

  async destroyView(accountId) {
    const viewState = this.views.get(accountId);
    const window = this.mainWindow.getWindow();
    const result = await this.viewLifecycle.destroyView(accountId, viewState, window);
    if (result) {
      this.views.delete(accountId);
      this.performanceOptimizer.viewAccessTimes.delete(accountId);
      if (this.activeAccountId === accountId) this.activeAccountId = null;
    }
    return result;
  }

  async switchView(accountId, options = {}) {
    try {
      if (!accountId) throw new Error('Account ID is required');
      this.performanceOptimizer.recordViewAccess(accountId);

      if (this.activeAccountId === accountId) return { success: true, accountId, alreadyActive: true };

      if (!this.hasView(accountId)) {
        if (options.createIfMissing || this.options.lazyLoadViews) {
          await this._enforceViewLimit();
          await this.createView(accountId, options.viewConfig || {});
        } else throw new Error(`View for account ${accountId} does not exist`);
      }

      const success = await this.showView(accountId);
      if (!success) throw new Error('Failed to show view');
      return { success: true, accountId, previousAccountId: this.activeAccountId !== accountId ? this.activeAccountId : null };
    } catch (error) {
      this.log('error', `Failed to switch to account ${accountId}:`, error);
      return { success: false, error: error.message, accountId };
    }
  }

  async _enforceViewLimit() {
    if (this.views.size < this.options.maxConcurrentViews) return;
    const viewsByAccessTime = this.performanceOptimizer.getViewsByAccessTime(this.views, this.activeAccountId);
    const viewsToDestroy = this.performanceOptimizer.getViewsToDestroyCount(this.views.size);
    for (let i = 0; i < Math.min(viewsToDestroy, viewsByAccessTime.length); i++) {
      await this.destroyView(viewsByAccessTime[i].accountId);
    }
  }

  async reloadView(accountId, ignoreCache = false) {
    const viewState = this.views.get(accountId);
    return this.viewLifecycle.reloadView(accountId, viewState, ignoreCache);
  }

  resizeViews(sidebarWidth, options = {}) {
    const currentSidebarWidth = this.mainWindow.getSidebarWidth();
    const resizeOptions = {
      ...options,
      lastWidth: currentSidebarWidth
    };

    this.resizeDebounceTimer = this.resizeHandler.resizeDebounceTimer;
    this.resizeHandler.resizeViews(this.views, sidebarWidth, resizeOptions);
    this.resizeDebounceTimer = this.resizeHandler.resizeDebounceTimer;
  }

  handleWindowResize(options = {}) {
    this.resizeHandler.handleWindowResize(this.views, this.mainWindow, options);
  }

  async destroyAllViews() {
    this.memoryManager.stopMemoryMonitoring();
    this.resizeHandler.cleanup();
    this.resizeDebounceTimer = null;
    this.stopAllConnectionMonitoring();
    this.stopAllLoginStatusMonitoring();
    for (const accountId of Array.from(this.views.keys())) await this.destroyView(accountId);
    this.performanceOptimizer.clearViewPool();
    this.activeAccountId = null;
  }

  // Getters
  getView(accountId) { return this.views.get(accountId)?.view || null; }
  getViewState(accountId) { return this.views.get(accountId) || null; }
  getAllViews() { return new Map(this.views); }
  getActiveView() { return this.activeAccountId ? this.getView(this.activeAccountId) : null; }
  getActiveAccountId() { return this.activeAccountId; }
  hasView(accountId) { return this.views.has(accountId); }
  getViewCount() { return this.views.size; }
  getLoginStatus(accountId) { return this.views.get(accountId)?.loginStatus ?? null; }
  getLoginInfo(accountId) { return this.views.get(accountId)?.loginInfo || null; }
  getConnectionStatus(accountId) { return this.views.get(accountId)?.connectionStatus || null; }
  getConnectionError(accountId) { return this.views.get(accountId)?.connectionError || null; }
  isViewLoading(accountId) { return this.views.get(accountId)?.status === 'loading'; }
  hasViewError(accountId) { return this.views.get(accountId)?.status === 'error'; }
  getErrorInfo(accountId) { return this.views.get(accountId)?.errorInfo || null; }

  // Monitoring methods
  startConnectionMonitoring(accountId, options = {}) {
    const viewState = this.views.get(accountId);
    if (!viewState) return null;
    const interval = options.interval || 30000;
    if (viewState.connectionMonitor) clearInterval(viewState.connectionMonitor.intervalId);
    this._detectConnectionStatus(accountId, viewState.view);
    const intervalId = setInterval(async () => {
      if (viewState.isLoaded && !viewState.view.webContents.isDestroyed()) {
        await this._detectConnectionStatus(accountId, viewState.view);
      }
    }, interval);
    const monitor = { accountId, intervalId, interval, startedAt: Date.now(), stop: () => { clearInterval(intervalId); viewState.connectionMonitor = null; } };
    viewState.connectionMonitor = monitor;
    return monitor;
  }

  stopConnectionMonitoring(accountId) {
    const viewState = this.views.get(accountId);
    if (viewState?.connectionMonitor) { viewState.connectionMonitor.stop(); return true; }
    return false;
  }

  startAllConnectionMonitoring(options = {}) {
    let started = 0;
    for (const accountId of this.views.keys()) if (this.startConnectionMonitoring(accountId, options)) started++;
    return { started, total: this.views.size };
  }

  stopAllConnectionMonitoring() {
    let stopped = 0;
    for (const accountId of this.views.keys()) if (this.stopConnectionMonitoring(accountId)) stopped++;
    return { stopped, total: this.views.size };
  }

  startLoginStatusMonitoring(accountId, options = {}) {
    const viewState = this.views.get(accountId);
    if (!viewState) return null;
    if (viewState.loginStatusMonitor) viewState.loginStatusMonitor.stop();
    const interval = options.interval || 30000;
    let isMonitoring = true, timeoutId = null;
    const checkStatus = async () => {
      if (!isMonitoring) return;
      try { await this._detectLoginStatus(accountId, viewState.view); } catch (e) { }
      if (isMonitoring) timeoutId = setTimeout(checkStatus, interval);
    };
    checkStatus();
    const monitor = { stop: () => { isMonitoring = false; if (timeoutId) clearTimeout(timeoutId); } };
    viewState.loginStatusMonitor = monitor;
    return monitor;
  }

  stopLoginStatusMonitoring(accountId) {
    const viewState = this.views.get(accountId);
    if (viewState?.loginStatusMonitor) { viewState.loginStatusMonitor.stop(); viewState.loginStatusMonitor = null; return true; }
    return false;
  }

  startAllLoginStatusMonitoring(options = {}) {
    let started = 0;
    for (const accountId of this.views.keys()) if (this.startLoginStatusMonitoring(accountId, options)) started++;
    return { started, total: this.views.size };
  }

  stopAllLoginStatusMonitoring() {
    let stopped = 0;
    for (const accountId of this.views.keys()) if (this.stopLoginStatusMonitoring(accountId)) stopped++;
    return { stopped, total: this.views.size };
  }

  // Translation methods
  async updateTranslationConfig(accountId, config) {
    const viewState = this.views.get(accountId);
    if (!viewState) return { success: false, error: 'View does not exist', accountId };
    return this.translationIntegration.updateTranslationConfig(accountId, config, viewState.view);
  }

  getTranslationConfig(accountId) { return this.translationIntegration.getTranslationConfig(accountId); }
  isTranslationEnabled(accountId) { return this.translationIntegration.isTranslationEnabled(accountId); }

  // Memory and performance methods
  async getMemoryUsage() { return this.memoryManager.getMemoryUsage(this.views, this.activeAccountId); }
  async getMemoryStats() { return this.memoryManager.getMemoryStats(this.views); }
  setMemoryLimits(limits) { this.memoryManager.setMemoryLimits(limits); }
  getMemoryLimits() { return this.memoryManager.getMemoryLimits(); }
  async forceGarbageCollection(accountId) { return this.memoryManager.forceGarbageCollection(accountId, this.views.get(accountId)); }
  async clearViewCache(accountId) { return this.memoryManager.clearViewCache(accountId, this.views.get(accountId)); }
  stopMemoryMonitoring() { this.memoryManager.stopMemoryMonitoring(); }
  getPerformanceStats() { return this.performanceOptimizer.getPerformanceStats(this.views, this.activeAccountId); }
  getPoolStats() { return this.performanceOptimizer.getPoolStats(); }
  invalidateBoundsCache() { this.boundsManager.invalidateCache(); }

  // Account open/close methods
  async openAccount(accountId, config = {}) {
    try {
      if (!accountId) throw new Error('Account ID is required');
      if (this.hasView(accountId)) return { success: true, alreadyOpen: true };
      if (this.views.size >= this.options.maxConcurrentViews) throw new Error(`Maximum concurrent accounts limit (${this.options.maxConcurrentViews}) reached`);
      this._notifyRenderer('account-opening', { accountId, timestamp: Date.now() });
      await this.createView(accountId, config);
      await this.showView(accountId);
      this._notifyRenderer('account-opened', { accountId, timestamp: Date.now() });
      return { success: true };
    } catch (error) {
      this._notifyRenderer('account-open-failed', { accountId, error: error.message, timestamp: Date.now() });
      return { success: false, error: error.message };
    }
  }

  async closeAccount(accountId) {
    try {
      if (!accountId) throw new Error('Account ID is required');
      if (!this.hasView(accountId)) return { success: true, alreadyClosed: true };
      this._notifyRenderer('account-closing', { accountId, timestamp: Date.now() });
      if (this.activeAccountId === accountId) {
        const otherIds = Array.from(this.views.keys()).filter(id => id !== accountId);
        if (otherIds.length > 0) await this.switchView(otherIds[0]);
        else await this.hideView(accountId);
      }
      await this.destroyView(accountId);
      this._notifyRenderer('account-closed', { accountId, timestamp: Date.now() });
      return { success: true };
    } catch (error) {
      this._notifyRenderer('account-close-failed', { accountId, error: error.message, timestamp: Date.now() });
      return { success: false, error: error.message };
    }
  }

  getAccountRunningStatus(accountId) {
    const viewState = this.views.get(accountId);
    if (!viewState) return 'not_started';
    switch (viewState.status) {
      case 'created': case 'loading': return 'loading';
      case 'ready': return 'connected';
      case 'error': return 'error';
      default: return 'not_started';
    }
  }

  isAccountRunning(accountId) { return this.hasView(accountId); }

  // Private detection methods
  async _detectLoginStatus(accountId, view) {
    const viewState = this.views.get(accountId);
    if (!viewState) return false;
    try {
      const loginStatus = await view.webContents.executeJavaScript(`
        (function() {
          const qrCode = document.querySelector('canvas[aria-label*="QR"]') || document.querySelector('canvas[aria-label*="Code"]');
          const chatPane = document.querySelector('[data-testid="chat-list"]') || document.querySelector('#pane-side');
          const qrCodeVisible = qrCode && qrCode.offsetParent !== null;
          const chatPaneVisible = chatPane && chatPane.offsetParent !== null;
          return { isLoggedIn: chatPaneVisible && !qrCodeVisible, qrCodeVisible };
        })();
      `);
      viewState.loginStatus = loginStatus.isLoggedIn;
      viewState.connectionStatus = loginStatus.isLoggedIn ? 'online' : 'offline';
      this._notifyRenderer('login-status-changed', { accountId, isLoggedIn: loginStatus.isLoggedIn, hasQRCode: loginStatus.qrCodeVisible });
      return loginStatus.isLoggedIn;
    } catch (error) { return false; }
  }

  async _detectConnectionStatus(accountId, view) {
    const viewState = this.views.get(accountId);
    if (!viewState) return 'offline';
    try {
      const connectionInfo = await view.webContents.executeJavaScript(`
        (function() {
          const chatPane = document.querySelector('[data-testid="chat-list"]') || document.querySelector('#pane-side');
          const errorMessage = document.querySelector('[data-testid="alert-error"]');
          if (errorMessage) return { status: 'error' };
          if (chatPane) return { status: 'online' };
          return { status: 'offline' };
        })();
      `);
      const previousStatus = viewState.connectionStatus;
      viewState.connectionStatus = connectionInfo.status;
      if (previousStatus !== connectionInfo.status) {
        this._notifyRenderer('connection-status-changed', { accountId, connectionStatus: connectionInfo.status });
      }
      return connectionInfo.status;
    } catch (error) { return 'error'; }
  }

  async _updateAccountProfileFromWeb(accountId, view) {
    // Simplified - full implementation in original file
  }

  // Backward compatibility methods
  _calculateViewBounds(sidebarWidth) {
    return this.boundsManager.calculateViewBounds(sidebarWidth);
  }

  _performResize(sidebarWidth) {
    this.boundsManager.updateAllViewBounds(this.views, sidebarWidth);
  }

  _getDefaultUserAgent() {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  async switchViewByIndex(index) {
    try {
      if (typeof index !== 'number' || index < 0) {
        throw new Error('Invalid index');
      }
      const accountIds = Array.from(this.views.keys());
      if (index >= accountIds.length) {
        return { success: false, error: 'Account index out of range' };
      }
      return await this.switchView(accountIds[index]);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async switchToNextView() {
    try {
      const accountIds = Array.from(this.views.keys());
      if (accountIds.length === 0) return { success: false, error: 'No accounts available' };
      if (accountIds.length === 1) return { success: true, accountId: accountIds[0], alreadyActive: true };
      const currentIndex = this.activeAccountId ? accountIds.indexOf(this.activeAccountId) : -1;
      const nextIndex = (currentIndex + 1) % accountIds.length;
      return await this.switchView(accountIds[nextIndex]);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async switchToPreviousView() {
    try {
      const accountIds = Array.from(this.views.keys());
      if (accountIds.length === 0) return { success: false, error: 'No accounts available' };
      if (accountIds.length === 1) return { success: true, accountId: accountIds[0], alreadyActive: true };
      const currentIndex = this.activeAccountId ? accountIds.indexOf(this.activeAccountId) : -1;
      const previousIndex = currentIndex <= 0 ? accountIds.length - 1 : currentIndex - 1;
      return await this.switchView(accountIds[previousIndex]);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ViewManager;
