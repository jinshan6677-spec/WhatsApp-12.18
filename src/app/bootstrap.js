/**
 * 应用启动引导器
 * 
 * 负责应用的整体初始化和依赖注入
 * 集成新架构组件：EventBus、ConfigProvider、StateManager、PluginManager、IPCRouter
 * 
 * @module app/bootstrap
 */

const { app } = require('electron');
const path = require('path');

// 导入统一导出模块
const { APP_INFO, EVENTS, ERROR_CODES } = require('./constants');

// 导入新架构核心组件
const { EventBus } = require('../core/eventbus/EventBus');
const { ConfigProvider, getGlobalConfigProvider } = require('../core/config/ConfigProvider');
const { StateManager, getGlobalStateManager } = require('../core/state/StateManager');
const { getGlobalContainer } = require('../core/container/DependencyContainer');
const { PluginManager } = require('../infrastructure/plugins/PluginManager');
const { PluginContext, createPluginContext } = require('../infrastructure/plugins/PluginContext');
const { IPCRouter } = require('../presentation/ipc/IPCRouter');
const { ErrorHandler, getGlobalErrorHandler } = require('../core/errors/ErrorHandler');

 

// 导入现有架构组件
const MainWindow = require('../single-window/MainWindow');
// 使用新的模块化ViewManager架构
const { ViewManager } = require('../presentation/windows/view-manager');
const NotificationManager = require('../managers/NotificationManager');
const TrayManager = require('../managers/TrayManager');

// 导入工具类
const { getErrorLogger, ErrorCategory } = require('../utils/ErrorLogger');
const OrphanedDataCleaner = require('../utils/OrphanedDataCleaner');

// 导入配置
const config = require('../config');

/**
 * 应用状态定义
 */
const AppState = {
  accounts: { items: {}, activeId: null, loading: false, error: null },
  ui: { sidebarWidth: 280, theme: 'system', language: 'zh-CN', notifications: [] },
  plugins: { loaded: [], active: [], errors: [] },
  config: { loaded: false, path: null }
};


/**
 * 应用实例类
 */
class AppBootstrap {
  constructor() {
    this.isInitialized = false;
    
    // 新架构核心组件
    this.eventBus = null;
    this.configProvider = null;
    this.stateManager = null;
    this.container = null;
    this.pluginManager = null;
    this.ipcRouter = null;
    this.errorHandler = null;
    
 
    
    // 现有组件
    this.managers = {};
    this.mainWindow = null;
    this.viewManager = null;
    this.errorLogger = null;
    this.config = config;
  }

  /**
   * 初始化应用
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn('App is already initialized');
      return;
    }

    try {
      console.log(`Starting ${APP_INFO.NAME} v${APP_INFO.VERSION}...`);
      
      // 1. 初始化核心架构组件
      await this.initializeCoreComponents();
      
      // 2. 注册服务到依赖容器
      await this.registerServices();
      
      // 3. 初始化错误处理和日志记录
      await this.initializeErrorHandling();
      
      // 4. 初始化核心管理器
      await this.initializeManagers();
      
      // 5. 初始化插件系统
      await this.initializePlugins();
      
      // 6. 初始化UI组件
      await this.initializeUIComponents();
      
      // 7. 初始化ViewManager
      await this.initializeViewManager();
      
      // 8. 注册全局事件处理器
      this.registerGlobalEventHandlers();
      
      // 9. 发布应用初始化完成事件
      await this.eventBus.publish('app:initialized', {
        version: APP_INFO.VERSION,
        timestamp: Date.now()
      });
      
      this.isInitialized = true;
      console.log('Application initialized successfully with new architecture');
      
    } catch (error) {
      console.error('Failed to initialize application:', error);
      throw error;
    }
  }


  /**
   * 初始化核心架构组件
   * @returns {Promise<void>}
   */
  async initializeCoreComponents() {
    console.log('Initializing core architecture components...');
    
    // 1. 初始化 EventBus
    this.eventBus = new EventBus({
      historyRetentionMs: 300000, // 5 minutes
      maxHistorySize: 1000
    });
    console.log('✓ EventBus initialized');
    
    // 2. 初始化 ConfigProvider
    this.configProvider = getGlobalConfigProvider();
    this.configProvider.setSchema({
      properties: {
        app: {
          type: 'object',
          properties: {
            name: { type: 'string', default: APP_INFO.NAME },
            version: { type: 'string', default: APP_INFO.VERSION },
            theme: { type: 'string', enum: ['light', 'dark', 'system'], default: 'system' },
            language: { type: 'string', default: 'zh-CN' }
          }
        },
        tray: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: true }
          }
        },
        plugins: {
          type: 'object',
          default: {}
        }
      }
    });
    
    // 尝试加载配置文件
    const configPath = path.join(app.getPath('userData'), 'config.json');
    try {
      await this.configProvider.load(configPath);
    } catch (error) {
      console.warn('Config file not found, using defaults:', error.message);
    }
    console.log('✓ ConfigProvider initialized');
    
    // 3. 初始化 StateManager
    this.stateManager = getGlobalStateManager({
      initialState: AppState,
      persistPath: path.join(app.getPath('userData'), 'app-state.json')
    });
    console.log('✓ StateManager initialized');
    
    // 4. 获取增强的依赖容器
    this.container = getGlobalContainer();
    console.log('✓ DependencyContainer initialized');
    
    // 5. 初始化 IPCRouter
    this.ipcRouter = new IPCRouter({
      defaultTimeout: 30000
    });
    console.log('✓ IPCRouter initialized');
    
    // 6. 初始化 PluginManager
    this.pluginManager = new PluginManager();
    console.log('✓ PluginManager initialized');
    
    // 7. 初始化 ErrorHandler
    this.errorHandler = getGlobalErrorHandler();
    console.log('✓ ErrorHandler initialized');
    
 
    
    console.log('Core architecture components initialized successfully');
  }

  

  /**
   * 初始化错误处理
   * @returns {Promise<void>}
   */
  async initializeErrorHandling() {
    // 注册错误恢复策略
    if (this.errorHandler) {
      try {
        // 注册网络错误恢复策略
        this.errorHandler.registerRecoveryStrategy('NETWORK_ERROR', async (error) => {
          console.log('Attempting network error recovery...');
          return { recovered: false, message: 'Network recovery not implemented' };
        });
        
        // 注册存储错误恢复策略
        this.errorHandler.registerRecoveryStrategy('STORAGE_ERROR', async (error) => {
          console.log('Attempting storage error recovery...');
          return { recovered: false, message: 'Storage recovery not implemented' };
        });
        
        console.log('✓ Error recovery strategies registered');
      } catch (error) {
        console.warn('Error handler initialization failed:', error.message);
      }
    }
    
    // 捕获未处理的异常
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error.message);
      if (this.errorHandler) {
        this.errorHandler.handle(error, { source: 'uncaughtException' });
      }
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Promise rejection:', reason);
      if (this.errorHandler) {
        this.errorHandler.handle(reason, { source: 'unhandledRejection' });
      }
    });
  }

  /**
   * 注册服务到依赖容器
   * @returns {Promise<void>}
   */
  async registerServices() {
    try {
      // 注册核心架构组件
      this.container.registerSingleton('eventBus', this.eventBus, { isInstance: true });
      this.container.registerSingleton('configProvider', this.configProvider, { isInstance: true });
      this.container.registerSingleton('stateManager', this.stateManager, { isInstance: true });
      this.container.registerSingleton('pluginManager', this.pluginManager, { isInstance: true });
      this.container.registerSingleton('ipcRouter', this.ipcRouter, { isInstance: true });
      this.container.registerSingleton('errorHandler', this.errorHandler, { isInstance: true });
      
 
      
      // 注册配置
      this.container.registerSingleton('config', config, { isInstance: true });
      
      // 注册错误日志记录器
      this.container.registerSingleton('errorLogger', getErrorLogger(), { isInstance: true });
      
      // 注册账号配置管理器
      this.container.registerFactory('accountConfigManager', () => {
        const { AccountConfigManager } = require('../core/managers');
        return new AccountConfigManager({
          cwd: app.getPath('userData')
        });
      });
      
      
      
      // 注册会话管理器
      this.container.registerFactory('sessionManager', () => {
        const { SessionManager } = require('../core/managers');
        return new SessionManager({
          userDataPath: app.getPath('userData')
        });
      });
      
      console.log('✓ Services registered to dependency container');
    } catch (error) {
      console.warn('Service registration failed:', error.message);
    }
  }


  /**
   * 初始化核心管理器
   * @returns {Promise<void>}
   */
  async initializeManagers() {
    try {
      // 从容器获取管理器实例
      this.managers.accountConfigManager = this.container.resolve('accountConfigManager');
      this.managers.sessionManager = this.container.resolve('sessionManager');
      
      console.log('✓ Core managers initialized from container');
    } catch (error) {
      console.warn('Manager initialization from container failed, falling back:', error.message);
      await this._initializeManagersFallback();
    }
  }

  /**
   * 管理器初始化回退方法
   * @private
   */
  async _initializeManagersFallback() {
    try {
      const { AccountConfigManager } = require('../core/managers');
      this.managers.accountConfigManager = new AccountConfigManager({
        cwd: app.getPath('userData')
      });
      console.log('✓ AccountConfigManager initialized (fallback)');
    } catch (error) {
      console.warn('AccountConfigManager initialization failed:', error.message);
    }
    
    
    
    try {
      const { SessionManager } = require('../core/managers');
      this.managers.sessionManager = new SessionManager({
        userDataPath: app.getPath('userData')
      });
      console.log('✓ SessionManager initialized (fallback)');
    } catch (error) {
      console.warn('SessionManager initialization failed:', error.message);
    }
    
    try {
      const { NotificationManager } = require('../core/managers');
      this.managers.notificationManager = new NotificationManager();
      console.log('✓ NotificationManager initialized (fallback)');
    } catch (error) {
      console.warn('NotificationManager initialization failed:', error.message);
    }
    
    try {
      const { TranslationIntegration } = require('../core/managers');
      this.managers.translationIntegration = new TranslationIntegration(null);
      if (typeof this.managers.translationIntegration.initialize === 'function') {
        await this.managers.translationIntegration.initialize();
      }
      console.log('✓ TranslationIntegration initialized (fallback)');
    } catch (error) {
      console.warn('TranslationIntegration initialization failed:', error.message);
    }
    
    try {
      const { MigrationManager } = require('../core/managers');
      this.managers.migrationManager = new MigrationManager({
        userDataPath: app.getPath('userData')
      });
      console.log('✓ MigrationManager initialized (fallback)');
    } catch (error) {
      console.warn('MigrationManager initialization failed:', error.message);
    }
  }


  /**
   * 初始化插件系统
   * @returns {Promise<void>}
   */
  async initializePlugins() {
    try {
      // 创建插件上下文
      const pluginContext = createPluginContext({
        eventBus: this.eventBus,
        container: this.container,
        config: this.configProvider
      });
      
      // 设置插件管理器上下文
      this.pluginManager.setContext(pluginContext);
      
      // 初始化所有已注册的插件
      const result = await this.pluginManager.initializeAll();
      
      // 更新状态
      this.stateManager.setSlice('plugins', {
        loaded: result.successful,
        active: result.successful,
        errors: result.failed.map(f => ({ name: f.name, error: f.error.message }))
      });
      
      if (result.successful.length > 0) {
        console.log(`✓ Plugins initialized: ${result.successful.join(', ')}`);
      }
      if (result.failed.length > 0) {
        console.warn(`Plugin initialization failures: ${result.failed.map(f => f.name).join(', ')}`);
      }
      
      // 发布插件初始化完成事件
      await this.eventBus.publish('plugins:initialized', {
        successful: result.successful,
        failed: result.failed.map(f => f.name)
      });
      
    } catch (error) {
      console.warn('Plugin system initialization failed:', error.message);
    }
  }

  /**
   * 初始化UI组件
   * @returns {Promise<void>}
   */
  async initializeUIComponents() {
    try {
      // 1. 初始化主窗口
      this.mainWindow = new MainWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        title: 'WhatsApp Desktop'
      });
      this.mainWindow.initialize();
      console.log('✓ MainWindow initialized');

      // 2. 初始化通知管理器
      if (!this.managers.notificationManager) {
        this.managers.notificationManager = new NotificationManager();
      }
      this.managers.notificationManager.setMainWindow(this.mainWindow);

      // 3. 初始化系统托盘
      if (this.config.trayConfig && this.config.trayConfig.enabled) {
        try {
          this.managers.trayManager = new TrayManager();
          this.managers.trayManager.initialize(this.mainWindow.getWindow(), this.config.trayConfig);
          this.managers.notificationManager.setTrayManager(this.managers.trayManager);
          console.log('✓ TrayManager initialized');
        } catch (error) {
          console.warn('TrayManager initialization failed:', error.message);
        }
      }

      // 4. 设置窗口关闭事件处理器
      this.setupMainWindowCloseHandler();
      console.log('✓ Window close handler configured');

      // 发布UI初始化完成事件
      await this.eventBus.publish('ui:initialized', {
        hasMainWindow: true,
        hasTray: !!this.managers.trayManager
      });

    } catch (error) {
      throw new Error(`Failed to initialize UI components: ${error.message}`);
    }
  }


  /**
   * 初始化ViewManager (新模块化架构)
   * @returns {Promise<void>}
   */
  async initializeViewManager() {
    try {
      // 使用新的模块化ViewManager架构
      this.viewManager = new ViewManager(this.mainWindow, this.managers.sessionManager, {
        defaultSidebarWidth: 280,
        translationIntegration: this.managers.translationIntegration,
        accountManager: this.managers.accountConfigManager,
        // 新架构支持的额外配置
        debounceDelay: 100,
        lazyLoadViews: true,
        maxConcurrentViews: 10,
        viewPoolSize: 2,
        memoryWarningThreshold: 300,
        maxMemoryPerView: 500,
        autoMemoryCleanup: true
      });
      console.log('✓ ViewManager initialized (new modular architecture)');
    } catch (error) {
      throw new Error(`Failed to initialize ViewManager: ${error.message}`);
    }
  }

  /**
   * 设置主窗口关闭处理器
   */
  setupMainWindowCloseHandler() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    const window = this.mainWindow.getWindow();
    if (!window) {
      return;
    }

    window.on('close', async () => {
      console.log('Main window closing');
      try {
        await this.saveApplicationState();
        console.log('Application state saved before window close');
      } catch (error) {
        console.error('Error saving state on window close:', error);
      }
    });
  }

  /**
   * 注册全局事件处理器
   */
  registerGlobalEventHandlers() {
    // 应用准备就绪
    app.whenReady().then(() => {
      this.onAppReady();
    });
    
    // 所有窗口关闭
    app.on('window-all-closed', () => {
      this.onAllWindowsClosed();
    });
    
    // 应用激活
    app.on('activate', () => {
      this.onAppActivated();
    });
    
    // 应用退出前
    app.on('before-quit', () => {
      this.onBeforeQuit();
    });
  }

  /**
   * 应用准备就绪事件处理
   */
  async onAppReady() {
    console.log(`${APP_INFO.NAME} is ready`);
    
    // 显示主窗口
    if (this.mainWindow) {
      this.mainWindow.show();
    }
    
    // 发布应用就绪事件
    await this.eventBus.publish('app:ready', {
      timestamp: Date.now()
    });
  }

  /**
   * 所有窗口关闭事件处理
   */
  onAllWindowsClosed() {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }

  /**
   * 应用激活事件处理
   */
  onAppActivated() {
    if (this.mainWindow && this.mainWindow.isDestroyed()) {
      this.mainWindow.rebuild();
    }
  }

  /**
   * 应用退出前事件处理
   */
  async onBeforeQuit() {
    console.log('Application shutting down...');
    
    try {
      // 发布应用关闭事件
      await this.eventBus.publish('app:shutdown', {
        timestamp: Date.now()
      });
      
      // 清理资源
      await this.cleanup();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }


  /**
   * 保存应用状态
   * @returns {Promise<void>}
   */
  async saveApplicationState() {
    try {
      // 1. 保存活跃账号ID
      if (this.viewManager) {
        const activeAccountId = this.viewManager.getActiveAccountId();
        if (activeAccountId) {
          this.stateManager.setSlice('accounts', {
            ...this.stateManager.getSlice('accounts'),
            activeId: activeAccountId
          });
          console.log(`Active account: ${activeAccountId}`);
        }
      }

      // 2. 保存所有账号的最后活跃时间
      if (this.managers.accountConfigManager && this.viewManager) {
        const accounts = await this.managers.accountConfigManager.loadAccounts();
        let updatedCount = 0;

        for (const account of accounts) {
          if (this.viewManager.hasView(account.id)) {
            await this.managers.accountConfigManager.updateAccount(account.id, {
              lastActiveAt: new Date()
            });
            updatedCount++;
          }
        }

        console.log(`Updated ${updatedCount} account(s) last active time`);
      }

      // 3. 保存窗口状态
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const bounds = this.mainWindow.getBounds();
        if (bounds) {
          this.stateManager.setSlice('ui', {
            ...this.stateManager.getSlice('ui'),
            windowBounds: bounds
          });
          console.log(`Window state saved: ${bounds.width}x${bounds.height}`);
        }
      }

      // 4. 持久化状态
      await this.stateManager.persist();
      
      // 5. 保存配置
      await this.configProvider.save();

      console.log('Application state saved successfully');
    } catch (error) {
      console.error('Error saving application state:', error);
      throw error;
    }
  }

  /**
   * 清理资源
   * @returns {Promise<void>}
   */
  async cleanup() {
    console.log('Starting resource cleanup...');

    try {
      // 1. 保存应用状态
      await this.saveApplicationState();

      // 2. 停止所有监控
      if (this.viewManager) {
        try {
          const stopResult = this.viewManager.stopAllConnectionMonitoring();
          console.log(`Connection monitoring stopped: ${stopResult.stopped} accounts`);

          const stopLoginResult = this.viewManager.stopAllLoginStatusMonitoring();
          console.log(`Login status monitoring stopped: ${stopLoginResult.stopped} accounts`);
        } catch (error) {
          console.error('Error stopping monitoring:', error);
        }
      }

      // 3. 销毁所有插件
      if (this.pluginManager) {
        const destroyResult = await this.pluginManager.destroyAll();
        console.log(`Plugins destroyed: ${destroyResult.successful.length} successful, ${destroyResult.failed.length} failed`);
      }

      // 4. 关闭所有BrowserView
      if (this.viewManager) {
        console.log('Destroying all BrowserViews...');
        const allViews = this.viewManager.getAllViews();
        console.log(`Preparing to close ${allViews.length} BrowserView(s)`);

        const result = await this.viewManager.destroyAllViews();
        console.log(`BrowserViews closed: ${result.destroyed} successful, ${result.failed} failed`);
      }

      // 5. 销毁系统托盘
      if (this.managers.trayManager) {
        this.managers.trayManager.destroy();
        this.managers.trayManager = null;
        console.log('TrayManager destroyed');
      }

      // 6. 清理翻译集成
      if (this.managers.translationIntegration) {
        this.managers.translationIntegration.cleanup();
        console.log('TranslationIntegration cleaned up');
      }

      // 7. 清理通知管理器
      if (this.managers.notificationManager) {
        this.managers.notificationManager.clearAll();
        console.log('NotificationManager cleaned up');
      }

      

      // 9. 清理EventBus
      if (this.eventBus) {
        this.eventBus.clear();
        console.log('EventBus cleared');
      }

      console.log('Resource cleanup completed');
    } catch (error) {
      console.error('Error during resource cleanup:', error);
    }
  }


  // ==================== Accessor Methods ====================

  /**
   * 获取管理器实例
   * @param {string} name - 管理器名称
   * @returns {Object} 管理器实例
   */
  getManager(name) {
    return this.managers[name];
  }

  /**
   * 获取ViewManager实例
   * @returns {Object} ViewManager实例
   */
  getViewManager() {
    return this.viewManager;
  }

  /**
   * 获取主窗口实例
   * @returns {Object} 主窗口实例
   */
  getMainWindow() {
    return this.mainWindow;
  }

  /**
   * 获取所有管理器
   * @returns {Object} 所有管理器实例
   */
  getAllManagers() {
    return { ...this.managers };
  }

  /**
   * 获取EventBus实例
   * @returns {EventBus}
   */
  getEventBus() {
    return this.eventBus;
  }

  /**
   * 获取ConfigProvider实例
   * @returns {ConfigProvider}
   */
  getConfigProvider() {
    return this.configProvider;
  }

  /**
   * 获取StateManager实例
   * @returns {StateManager}
   */
  getStateManager() {
    return this.stateManager;
  }

  /**
   * 获取DependencyContainer实例
   * @returns {DependencyContainer}
   */
  getContainer() {
    return this.container;
  }

  /**
   * 获取PluginManager实例
   * @returns {PluginManager}
   */
  getPluginManager() {
    return this.pluginManager;
  }

  /**
   * 获取IPCRouter实例
   * @returns {IPCRouter}
   */
  getIPCRouter() {
    return this.ipcRouter;
  }

  /**
   * 获取ErrorHandler实例
   * @returns {ErrorHandler}
   */
  getErrorHandler() {
    return this.errorHandler;
  }

  

  /**
   * 获取应用状态
   * @returns {Object} 应用状态
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasMainWindow: !!this.mainWindow,
      hasViewManager: !!this.viewManager,
      managers: Object.keys(this.managers),
      version: APP_INFO.VERSION,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      platform: process.platform,
      // 新架构组件状态
      architecture: {
        eventBus: !!this.eventBus,
        configProvider: !!this.configProvider,
        stateManager: !!this.stateManager,
        pluginManager: !!this.pluginManager,
        ipcRouter: !!this.ipcRouter,
        errorHandler: !!this.errorHandler,
        pluginCount: this.pluginManager ? this.pluginManager.getAllPlugins().length : 0,
        ipcChannelCount: this.ipcRouter ? this.ipcRouter.getChannelCount() : 0
      },
      
    };
  }
}

// ==================== Module Exports ====================

// 单例实例
let appInstance = null;

/**
 * 获取应用实例（单例模式）
 * @returns {AppBootstrap} 应用实例
 */
function getAppInstance() {
  if (!appInstance) {
    appInstance = new AppBootstrap();
  }
  return appInstance;
}

/**
 * 初始化应用
 * @returns {Promise<AppBootstrap>} 应用实例
 */
async function initializeApp() {
  const bootstrap = getAppInstance();
  await bootstrap.initialize();
  return bootstrap;
}

module.exports = {
  AppBootstrap,
  getAppInstance,
  initializeApp
};
