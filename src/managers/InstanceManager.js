/**
 * InstanceManager - 实例管理器
 * 
 * 负责管理所有 WhatsApp 账号实例的生命周期
 * 包括创建、销毁、监控和重启实例
 */

const path = require('path');
const fs = require('fs').promises;

// Electron will be injected for testing, or required at runtime
let electron;
try {
  electron = require('electron');
} catch (e) {
  // Electron not available (e.g., in test environment without proper mock)
  electron = null;
}

/**
 * @typedef {Object} InstanceStatus
 * @property {string} instanceId - 实例 ID
 * @property {'stopped'|'starting'|'running'|'error'|'crashed'} status - 状态
 * @property {number} [pid] - 进程 ID
 * @property {number} memoryUsage - 内存使用（MB）
 * @property {number} cpuUsage - CPU 使用率（%）
 * @property {Date} [startTime] - 启动时间
 * @property {Date} lastHeartbeat - 最后心跳时间
 * @property {number} crashCount - 崩溃次数
 * @property {string} [error] - 错误信息
 * @property {boolean} isLoggedIn - 是否已登录
 * @property {number} unreadCount - 未读消息数
 */

/**
 * @typedef {Object} InstanceInfo
 * @property {string} instanceId - 实例 ID
 * @property {BrowserWindow} window - 浏览器窗口
 * @property {Object} config - 账号配置
 * @property {InstanceStatus} status - 实例状态
 */

/**
 * InstanceManager 类
 */
class InstanceManager {
  /**
   * 创建实例管理器
   * @param {Object} [options] - 配置选项
   * @param {string} [options.userDataPath] - 用户数据根目录
   * @param {number} [options.maxInstances] - 最大实例数
   * @param {Object} [options.translationIntegration] - 翻译集成实例
   * @param {Object} [options.errorHandler] - 错误处理器实例
   * @param {Object} [options.sessionManager] - 会话管理器实例
   * @param {Object} [options.notificationManager] - 通知管理器实例
   * @param {Object} [options.resourceManager] - 资源管理器实例
   * @param {Object} [options.electron] - Electron对象（用于测试注入）
   */
  constructor(options = {}) {
    // Electron对象（支持依赖注入用于测试）
    this.electron = options.electron || electron;
    
    // 实例存储 Map: instanceId -> InstanceInfo
    this.instances = new Map();
    
    // 实例状态 Map: instanceId -> InstanceStatus
    this.instanceStatuses = new Map();
    
    // 未读消息监控定时器 Map: instanceId -> Timeout
    this.unreadMonitoringIntervals = new Map();
    
    // 配置选项
    this.userDataPath = options.userDataPath || (this.electron && this.electron.app ? this.electron.app.getPath('userData') : '/tmp/whatsapp-data');
    this.maxInstances = options.maxInstances || 30;
    
    // 翻译集成
    this.translationIntegration = options.translationIntegration || null;
    
    // 错误处理器
    this.errorHandler = options.errorHandler || null;
    
    // 会话管理器
    this.sessionManager = options.sessionManager || null;
    
    // 通知管理器
    this.notificationManager = options.notificationManager || null;
    
    // 资源管理器
    this.resourceManager = options.resourceManager || null;
    
    // 监控定时器
    this.monitoringInterval = null;
    
    // 日志函数
    this.log = this._createLogger();
  }

  /**
   * 创建日志记录器
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [InstanceManager] [${level.toUpperCase()}] ${message}`;
      
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
   * 获取实例状态
   * @param {string} instanceId - 实例 ID
   * @returns {InstanceStatus|null}
   */
  getInstanceStatus(instanceId) {
    return this.instanceStatuses.get(instanceId) || null;
  }

  /**
   * 获取所有运行中的实例
   * @returns {InstanceInfo[]}
   */
  getRunningInstances() {
    const runningInstances = [];
    
    for (const [instanceId, instance] of this.instances.entries()) {
      const status = this.instanceStatuses.get(instanceId);
      if (status && status.status === 'running') {
        runningInstances.push(instance);
      }
    }
    
    return runningInstances;
  }

  /**
   * 获取所有实例
   * @returns {InstanceInfo[]}
   */
  getAllInstances() {
    return Array.from(this.instances.values());
  }

  /**
   * 获取实例数量
   * @returns {number}
   */
  getInstanceCount() {
    return this.instances.size;
  }

  /**
   * 获取运行中的实例数量
   * @returns {number}
   */
  getRunningInstanceCount() {
    return this.getRunningInstances().length;
  }

  /**
   * 检查实例是否存在
   * @param {string} instanceId - 实例 ID
   * @returns {boolean}
   */
  instanceExists(instanceId) {
    return this.instances.has(instanceId);
  }

  /**
   * 初始化实例状态
   * @private
   * @param {string} instanceId - 实例 ID
   * @returns {InstanceStatus}
   */
  _initializeStatus(instanceId) {
    const status = {
      instanceId,
      status: 'stopped',
      pid: null,
      memoryUsage: 0,
      cpuUsage: 0,
      startTime: null,
      lastHeartbeat: new Date(),
      crashCount: 0,
      error: null,
      isLoggedIn: false,
      unreadCount: 0
    };
    
    this.instanceStatuses.set(instanceId, status);
    return status;
  }

  /**
   * 更新实例状态
   * @private
   * @param {string} instanceId - 实例 ID
   * @param {Partial<InstanceStatus>} updates - 状态更新
   */
  _updateStatus(instanceId, updates) {
    const status = this.instanceStatuses.get(instanceId);
    if (status) {
      Object.assign(status, updates);
      status.lastHeartbeat = new Date();
    }
  }

  /**
   * 创建独立的浏览器实例
   * @param {Object} accountConfig - 账号配置
   * @returns {Promise<{success: boolean, instanceId?: string, window?: BrowserWindow, error?: string}>}
   */
  async createInstance(accountConfig) {
    const { id, name, translation, window: windowConfig } = accountConfig;
    
    this.log('info', `Creating instance for account: ${name} (${id})`);
    
    try {
      // 检查实例是否已存在
      if (this.instanceExists(id)) {
        const existingStatus = this.getInstanceStatus(id);
        if (existingStatus && existingStatus.status === 'running') {
          this.log('warn', `Instance ${id} is already running`);
          return {
            success: false,
            error: 'Instance is already running'
          };
        }
      }
      
      // 检查资源可用性（如果资源管理器已配置）
      if (this.resourceManager) {
        const resourceCheck = await this.resourceManager.canCreateInstance(
          this.getRunningInstanceCount()
        );
        
        if (!resourceCheck.allowed) {
          this.log('error', `Cannot create instance: ${resourceCheck.reason}`);
          return {
            success: false,
            error: resourceCheck.reason
          };
        }
        
        // 记录资源状态
        if (resourceCheck.resources) {
          this.log('info', `System resources: Memory ${resourceCheck.resources.memoryUsagePercent.toFixed(1)}%, CPU ${resourceCheck.resources.cpuUsage.toFixed(1)}%`);
        }
      } else {
        // 如果没有资源管理器，使用简单的实例数检查
        if (this.getRunningInstanceCount() >= this.maxInstances) {
          this.log('error', `Maximum instance limit reached: ${this.maxInstances}`);
          return {
            success: false,
            error: `Maximum instance limit reached: ${this.maxInstances}`
          };
        }
      }
      
      // 初始化状态
      const status = this._initializeStatus(id);
      this._updateStatus(id, { status: 'starting' });
      
      // 1. 创建独立的 userDataDir
      const userDataDir = path.join(this.userDataPath, 'profiles', id);
      await fs.mkdir(userDataDir, { recursive: true });
      this.log('info', `Created user data directory: ${userDataDir}`);
      
      // 1.5. 检查是否存在已保存的会话数据
      let hasExistingSession = false;
      if (this.sessionManager) {
        hasExistingSession = await this.sessionManager.hasSessionData(id);
        if (hasExistingSession) {
          this.log('info', `Found existing session data for instance ${id}, will attempt to restore`);
        } else {
          this.log('info', `No existing session data for instance ${id}, will require login`);
        }
      }
      
      // 2. 创建独立的 session partition
      const partition = `persist:account_${id}`;
      const instanceSession = this.electron.session.fromPartition(partition, { cache: true });
      
      // 2.3. 配置 session 持久化选项
      if (this.sessionManager) {
        const persistResult = await this.sessionManager.configureSessionPersistence(id);
        if (!persistResult.success) {
          this.log('warn', `Failed to configure session persistence for instance ${id}: ${persistResult.error}`);
        }
      }
      
      
      
      // 3. 创建 BrowserWindow
      // 验证窗口位置是否在可见屏幕范围内
      const windowBounds = this._validateWindowBounds({
        x: windowConfig?.x,
        y: windowConfig?.y,
        width: windowConfig?.width || 1200,
        height: windowConfig?.height || 800
      });
      
      const window = new this.electron.BrowserWindow({
        width: windowBounds.width,
        height: windowBounds.height,
        x: windowBounds.x,
        y: windowBounds.y,
        title: `WhatsApp - ${name}`,
        show: !windowConfig?.minimized,
        webPreferences: {
          partition: partition,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          preload: path.join(__dirname, '../preload.js')
        }
      });
      
      // 4. 设置 User-Agent 以支持 WhatsApp Web
      const chromeVersion = process.versions.chrome;
      const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
      window.webContents.setUserAgent(userAgent);
      this.log('info', `Set User-Agent for instance ${id}: ${userAgent}`);
      
      // 5. 存储实例信息
      const instanceInfo = {
        instanceId: id,
        window: window,
        config: accountConfig,
        status: status
      };
      this.instances.set(id, instanceInfo);
      
      // 6. 设置实例监控
      this.setupInstanceMonitoring(id, window);
      
      // 7. 加载 WhatsApp Web
      this.log('info', `Loading WhatsApp Web for instance ${id}`);
      await window.loadURL('https://web.whatsapp.com');
      
      // 7.5. 注入翻译脚本（如果翻译集成已配置）
      if (this.translationIntegration && translation) {
        this.log('info', `Injecting translation scripts for instance ${id}`);
        const injectionResult = await this.translationIntegration.injectScripts(id, window, translation);
        if (!injectionResult.success) {
          this.log('warn', `Failed to inject translation scripts for instance ${id}: ${injectionResult.error}`);
        }
      }
      
      // 7.7. 设置登录状态检测和会话恢复监控
      if (this.sessionManager) {
        // 监听页面加载完成事件，检测登录状态
        window.webContents.on('did-finish-load', async () => {
          // 延迟检测，等待 DOM 完全渲染
          setTimeout(async () => {
            const isLoggedIn = await this.sessionManager.detectLoginStatus(id, window);
            this._updateStatus(id, { isLoggedIn });
            
            // 如果有会话数据但未登录，说明会话可能已过期
            if (hasExistingSession && !isLoggedIn) {
              this.log('warn', `Session expired for instance ${id}, QR code will be displayed`);
              this._updateStatus(id, {
                error: 'Session expired, please scan QR code to login'
              });
            } else if (hasExistingSession && isLoggedIn) {
              this.log('info', `Session restored successfully for instance ${id}`);
              this._updateStatus(id, {
                error: null
              });
            }
          }, 3000);
        });
        
        // 定期检测登录状态
        const loginCheckInterval = setInterval(async () => {
          if (!this.instances.has(id)) {
            clearInterval(loginCheckInterval);
            return;
          }
          
          const isLoggedIn = await this.sessionManager.detectLoginStatus(id, window);
          const currentStatus = this.getInstanceStatus(id);
          
          // 检测登录状态变化
          if (currentStatus && currentStatus.isLoggedIn !== isLoggedIn) {
            if (!isLoggedIn) {
              this.log('warn', `Instance ${id} logged out or session expired`);
              this._updateStatus(id, {
                isLoggedIn: false,
                error: 'Session expired, please scan QR code to login'
              });
            } else {
              this.log('info', `Instance ${id} logged in successfully`);
              this._updateStatus(id, {
                isLoggedIn: true,
                error: null
              });
            }
          } else {
            this._updateStatus(id, { isLoggedIn });
          }
        }, 30000); // 每 30 秒检测一次
      }
      
      // 7.8. 启动未读消息监控（如果通知管理器已配置）
      if (this.notificationManager && accountConfig.notifications?.enabled) {
        this.log('info', `Starting unread message monitoring for instance ${id}`);
        const unreadInterval = this.notificationManager.startUnreadMonitoring(
          id,
          window,
          accountConfig,
          5000 // 每 5 秒检查一次
        );
        this.unreadMonitoringIntervals.set(id, unreadInterval);
      }
      
      // 8. 更新状态
      this._updateStatus(id, {
        status: 'running',
        pid: window.webContents.getOSProcessId(),
        startTime: new Date()
      });
      
      this.log('info', `Instance ${id} created successfully`);
      
      return {
        success: true,
        instanceId: id,
        window: window
      };
      
    } catch (error) {
      this.log('error', `Failed to create instance ${id}:`, error);
      
      // 更新状态为错误
      this._updateStatus(id, {
        status: 'error',
        error: error.message
      });
      
      // 清理
      if (this.instances.has(id)) {
        const instance = this.instances.get(id);
        if (instance.window && !instance.window.isDestroyed()) {
          instance.window.destroy();
        }
        this.instances.delete(id);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 验证窗口边界是否在可见屏幕范围内
   * @private
   * @param {Object} bounds - 窗口边界
   * @param {number} [bounds.x] - X 坐标
   * @param {number} [bounds.y] - Y 坐标
   * @param {number} bounds.width - 宽度
   * @param {number} bounds.height - 高度
   * @returns {Object} 验证后的窗口边界
   */
  _validateWindowBounds(bounds) {
    const { screen } = require('electron');
    
    // 如果没有指定位置，返回默认值（让系统自动定位）
    if (bounds.x === undefined || bounds.y === undefined) {
      return {
        width: bounds.width,
        height: bounds.height,
        x: undefined,
        y: undefined
      };
    }
    
    // 获取所有显示器
    const displays = this.electron.screen.getAllDisplays();
    
    // 检查窗口是否在任何显示器的可见区域内
    let isVisible = false;
    for (const display of displays) {
      const { x, y, width, height } = display.workArea;
      
      // 检查窗口中心点是否在显示器范围内
      const windowCenterX = bounds.x + bounds.width / 2;
      const windowCenterY = bounds.y + bounds.height / 2;
      
      if (
        windowCenterX >= x &&
        windowCenterX < x + width &&
        windowCenterY >= y &&
        windowCenterY < y + height
      ) {
        isVisible = true;
        break;
      }
    }
    
    // 如果窗口不在可见范围内，使用主显示器的中心位置
    if (!isVisible) {
      const primaryDisplay = this.electron.screen.getPrimaryDisplay();
      const { x, y, width, height } = primaryDisplay.workArea;
      
      this.log('warn', 'Window position is outside visible area, centering on primary display');
      
      return {
        width: bounds.width,
        height: bounds.height,
        x: x + Math.floor((width - bounds.width) / 2),
        y: y + Math.floor((height - bounds.height) / 2)
      };
    }
    
    // 窗口在可见范围内，返回原始边界
    return bounds;
  }

  

  /**
   * 销毁实例
   * @param {string} instanceId - 实例 ID
   * @param {Object} [options] - 销毁选项
   * @param {boolean} [options.saveState] - 是否保存状态
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async destroyInstance(instanceId, options = {}) {
    this.log('info', `Destroying instance ${instanceId}`);
    
    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        this.log('warn', `Instance ${instanceId} not found`);
        return {
          success: false,
          error: 'Instance not found'
        };
      }
      
      const { window, config } = instance;
      
      // 保存窗口状态（如果需要）
      if (options.saveState && window && !window.isDestroyed()) {
        try {
          const bounds = window.getBounds();
          config.window = {
            ...config.window,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            minimized: window.isMinimized()
          };
          this.log('info', `Saved window state for instance ${instanceId}`);
        } catch (error) {
          this.log('warn', `Failed to save window state for instance ${instanceId}:`, error);
        }
      }
      
      // 移除事件监听器（通过销毁窗口自动完成）
      
      // 优雅关闭窗口
      if (window && !window.isDestroyed()) {
        // 尝试优雅关闭
        window.close();
        
        // 如果窗口在 5 秒内没有关闭，强制销毁
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            if (!window.isDestroyed()) {
              this.log('warn', `Force destroying window for instance ${instanceId}`);
              window.destroy();
            }
            resolve();
          }, 5000);
          
          window.once('closed', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      
      // 更新状态
      this._updateStatus(instanceId, {
        status: 'stopped',
        pid: null,
        startTime: null
      });
      
      // 从实例列表中移除
      this.instances.delete(instanceId);
      
      // 清理翻译集成数据
      if (this.translationIntegration) {
        this.translationIntegration.removeInstance(instanceId);
      }
      
      // 停止未读消息监控
      if (this.notificationManager) {
        const unreadInterval = this.unreadMonitoringIntervals.get(instanceId);
        if (unreadInterval) {
          this.notificationManager.stopUnreadMonitoring(unreadInterval);
          this.unreadMonitoringIntervals.delete(instanceId);
        }
        this.notificationManager.clearUnreadCount(instanceId);
      }
      
      this.log('info', `Instance ${instanceId} destroyed successfully`);
      
      return { success: true };
      
    } catch (error) {
      this.log('error', `Failed to destroy instance ${instanceId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 重启实例
   * @param {string} instanceId - 实例 ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async restartInstance(instanceId) {
    this.log('info', `Restarting instance ${instanceId}`);
    
    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        return {
          success: false,
          error: 'Instance not found'
        };
      }
      
      // 保存配置
      const config = instance.config;
      
      // 销毁现有实例（保存状态）
      const destroyResult = await this.destroyInstance(instanceId, { saveState: true });
      if (!destroyResult.success) {
        return destroyResult;
      }
      
      // 等待一小段时间确保资源释放
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 创建新实例
      const createResult = await this.createInstance(config);
      if (!createResult.success) {
        return {
          success: false,
          error: `Failed to restart instance: ${createResult.error}`
        };
      }
      
      this.log('info', `Instance ${instanceId} restarted successfully`);
      
      return { success: true };
      
    } catch (error) {
      this.log('error', `Failed to restart instance ${instanceId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 销毁所有实例
   * @returns {Promise<{success: boolean, destroyed: number, failed: number}>}
   */
  async destroyAllInstances() {
    this.log('info', 'Destroying all instances');
    
    const instanceIds = Array.from(this.instances.keys());
    let destroyed = 0;
    let failed = 0;
    
    for (const instanceId of instanceIds) {
      const result = await this.destroyInstance(instanceId, { saveState: true });
      if (result.success) {
        destroyed++;
      } else {
        failed++;
      }
    }
    
    this.log('info', `Destroyed ${destroyed} instances, ${failed} failed`);
    
    return {
      success: failed === 0,
      destroyed,
      failed
    };
  }

  /**
   * 设置窗口事件监听器
   * @private
   * @param {string} instanceId - 实例 ID
   * @param {BrowserWindow} window - 浏览器窗口
   */
  _setupWindowEventListeners(instanceId, window) {
    // 窗口关闭事件
    window.on('closed', () => {
      this.log('info', `Window closed for instance ${instanceId}`);
      this._updateStatus(instanceId, { status: 'stopped' });
      this.instances.delete(instanceId);
      
      // 清除崩溃历史
      if (this.errorHandler) {
        this.errorHandler.clearCrashHistory(instanceId);
      }
    });
    
    // 窗口移动事件 - 保存位置
    let moveTimeout;
    window.on('move', () => {
      // 使用防抖，避免频繁保存
      clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        this.saveWindowState(instanceId);
      }, 500);
    });
    
    // 窗口调整大小事件 - 保存大小
    let resizeTimeout;
    window.on('resize', () => {
      // 使用防抖，避免频繁保存
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.saveWindowState(instanceId);
      }, 500);
    });
    
    // 窗口最小化/最大化事件
    window.on('minimize', () => {
      this.log('info', `Window minimized for instance ${instanceId}`);
      this.saveWindowState(instanceId);
    });
    
    window.on('maximize', () => {
      this.log('info', `Window maximized for instance ${instanceId}`);
      this.saveWindowState(instanceId);
    });
    
    window.on('unmaximize', () => {
      this.log('info', `Window unmaximized for instance ${instanceId}`);
      this.saveWindowState(instanceId);
    });
    
    // 窗口崩溃事件
    window.webContents.on('crashed', (_event, killed) => {
      this.log('error', `Instance ${instanceId} crashed (killed: ${killed})`);
      const status = this.getInstanceStatus(instanceId);
      if (status) {
        this._updateStatus(instanceId, {
          status: 'crashed',
          crashCount: status.crashCount + 1,
          error: 'Renderer process crashed'
        });
      }
      
      // 使用错误处理器处理崩溃
      if (this.errorHandler) {
        this.errorHandler.handleInstanceCrash(instanceId, new Error('Renderer process crashed'), killed);
      }
    });
    
    // 窗口无响应事件
    window.on('unresponsive', () => {
      this.log('warn', `Instance ${instanceId} became unresponsive`);
      this._updateStatus(instanceId, {
        error: 'Window is unresponsive'
      });
      
      // 使用错误处理器处理无响应
      if (this.errorHandler) {
        this.errorHandler.handleInstanceUnresponsive(instanceId);
      }
    });
    
    // 窗口恢复响应事件
    window.on('responsive', () => {
      this.log('info', `Instance ${instanceId} became responsive again`);
      this._updateStatus(instanceId, {
        error: null
      });
    });
    
    // 页面加载完成事件
    window.webContents.on('did-finish-load', () => {
      this.log('info', `Page loaded for instance ${instanceId}`);
    });
    
    // 页面加载失败事件
    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      this.log('error', `Page load failed for instance ${instanceId}: ${errorDescription} (${errorCode})`);
      this._updateStatus(instanceId, {
        error: `Page load failed: ${errorDescription}`
      });
      
      // 使用错误处理器处理页面加载错误
      if (this.errorHandler) {
        this.errorHandler.handlePageLoadError(instanceId, errorCode, errorDescription);
      }
    });
  }

  /**
   * 设置实例监控
   * @private
   * @param {string} instanceId - 实例 ID
   * @param {BrowserWindow} window - 浏览器窗口
   */
  setupInstanceMonitoring(instanceId, window) {
    this.log('info', `Setting up monitoring for instance ${instanceId}`);
    
    // 监听所有窗口事件
    this._setupWindowEventListeners(instanceId, window);
    
    // 如果全局监控未启动，启动它
    if (!this.monitoringInterval) {
      this.startGlobalMonitoring();
    }
  }

  /**
   * 启动全局监控
   * 定期检查所有实例的健康状态
   */
  startGlobalMonitoring() {
    if (this.monitoringInterval) {
      this.log('warn', 'Global monitoring is already running');
      return;
    }
    
    this.log('info', 'Starting global instance monitoring');
    
    // 每 10 秒检查一次所有实例
    this.monitoringInterval = setInterval(() => {
      this._performHealthCheck();
    }, 10000);
  }

  /**
   * 停止全局监控
   */
  stopGlobalMonitoring() {
    if (this.monitoringInterval) {
      this.log('info', 'Stopping global instance monitoring');
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * 执行健康检查
   * @private
   */
  async _performHealthCheck() {
    const now = new Date();
    
    for (const [instanceId, instance] of this.instances.entries()) {
      try {
        const status = this.instanceStatuses.get(instanceId);
        if (!status) continue;
        
        const { window } = instance;
        
        // 检查窗口是否仍然存在
        if (!window || window.isDestroyed()) {
          this.log('warn', `Instance ${instanceId} window is destroyed`);
          this._updateStatus(instanceId, {
            status: 'stopped',
            error: 'Window destroyed'
          });
          this.instances.delete(instanceId);
          continue;
        }
        
        // 检查心跳超时（60 秒无更新）
        const timeSinceLastHeartbeat = now - status.lastHeartbeat;
        if (timeSinceLastHeartbeat > 60000) {
          this.log('warn', `Instance ${instanceId} heartbeat timeout: ${timeSinceLastHeartbeat}ms`);
          this._updateStatus(instanceId, {
            error: 'Heartbeat timeout'
          });
        }
        
        // 更新资源使用情况
        await this._updateResourceUsage(instanceId, window);
        
        // 检查实例是否响应
        const isResponsive = await this._checkInstanceResponsiveness(instanceId, window);
        if (!isResponsive) {
          this.log('warn', `Instance ${instanceId} is not responsive`);
          this._updateStatus(instanceId, {
            error: 'Instance not responsive'
          });
        }
        
      } catch (error) {
        this.log('error', `Health check failed for instance ${instanceId}:`, error);
      }
    }
  }

  /**
   * 更新实例的资源使用情况
   * @private
   * @param {string} instanceId - 实例 ID
   * @param {BrowserWindow} window - 浏览器窗口
   */
  async _updateResourceUsage(instanceId, window) {
    try {
      // 获取进程信息
      const processMetrics = await app.getAppMetrics();
      const pid = window.webContents.getOSProcessId();
      
      // 查找对应的进程
      const processInfo = processMetrics.find(p => p.pid === pid);
      
      if (processInfo) {
        // 计算内存使用（转换为 MB）
        const memoryUsageMB = processInfo.memory.workingSetSize / 1024;
        
        // CPU 使用率（百分比）
        const cpuUsage = processInfo.cpu.percentCPUUsage;
        
        this._updateStatus(instanceId, {
          memoryUsage: Math.round(memoryUsageMB * 100) / 100,
          cpuUsage: Math.round(cpuUsage * 100) / 100
        });
        
        // 记录高资源使用
        if (memoryUsageMB > 1000) {
          this.log('warn', `Instance ${instanceId} high memory usage: ${memoryUsageMB.toFixed(2)} MB`);
        }
        
        if (cpuUsage > 50) {
          this.log('warn', `Instance ${instanceId} high CPU usage: ${cpuUsage.toFixed(2)}%`);
        }
      }
    } catch (error) {
      this.log('error', `Failed to update resource usage for instance ${instanceId}:`, error);
    }
  }

  /**
   * 检查实例是否响应
   * @private
   * @param {string} instanceId - 实例 ID
   * @param {BrowserWindow} window - 浏览器窗口
   * @returns {Promise<boolean>}
   */
  async _checkInstanceResponsiveness(instanceId, window) {
    try {
      // 使用 executeJavaScript 检查实例是否响应
      // 设置 5 秒超时
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve(false), 5000);
      });
      
      const checkPromise = window.webContents.executeJavaScript('true')
        .then(() => true)
        .catch(() => false);
      
      const isResponsive = await Promise.race([checkPromise, timeoutPromise]);
      
      return isResponsive;
    } catch (error) {
      this.log('error', `Responsiveness check failed for instance ${instanceId}:`, error);
      return false;
    }
  }

  /**
   * 获取实例的详细健康状态
   * @param {string} instanceId - 实例 ID
   * @returns {Promise<{healthy: boolean, status: InstanceStatus, issues: string[]}>}
   */
  async getInstanceHealth(instanceId) {
    const status = this.getInstanceStatus(instanceId);
    const issues = [];
    
    if (!status) {
      return {
        healthy: false,
        status: null,
        issues: ['Instance not found']
      };
    }
    
    // 检查状态
    if (status.status === 'crashed' || status.status === 'error') {
      issues.push(`Instance is in ${status.status} state`);
    }
    
    // 检查错误信息
    if (status.error) {
      issues.push(status.error);
    }
    
    // 检查崩溃次数
    if (status.crashCount > 0) {
      issues.push(`Instance has crashed ${status.crashCount} time(s)`);
    }
    
    // 检查心跳
    const timeSinceLastHeartbeat = Date.now() - status.lastHeartbeat.getTime();
    if (timeSinceLastHeartbeat > 60000) {
      issues.push(`No heartbeat for ${Math.round(timeSinceLastHeartbeat / 1000)} seconds`);
    }
    
    // 检查资源使用
    if (status.memoryUsage > 1000) {
      issues.push(`High memory usage: ${status.memoryUsage.toFixed(2)} MB`);
    }
    
    if (status.cpuUsage > 50) {
      issues.push(`High CPU usage: ${status.cpuUsage.toFixed(2)}%`);
    }
    
    const healthy = issues.length === 0 && status.status === 'running';
    
    return {
      healthy,
      status,
      issues
    };
  }

  /**
   * 获取所有实例的健康状态摘要
   * @returns {Promise<{total: number, healthy: number, unhealthy: number, stopped: number}>}
   */
  async getAllInstancesHealth() {
    let total = 0;
    let healthy = 0;
    let unhealthy = 0;
    let stopped = 0;
    
    for (const instanceId of this.instances.keys()) {
      total++;
      const health = await this.getInstanceHealth(instanceId);
      
      if (health.status && health.status.status === 'stopped') {
        stopped++;
      } else if (health.healthy) {
        healthy++;
      } else {
        unhealthy++;
      }
    }
    
    return {
      total,
      healthy,
      unhealthy,
      stopped
    };
  }

  /**
   * 检查实例是否有保存的会话数据
   * @param {string} instanceId - 实例 ID
   * @returns {Promise<boolean>}
   */
  async hasSessionData(instanceId) {
    if (!this.sessionManager) {
      this.log('warn', 'SessionManager not configured');
      return false;
    }
    
    return await this.sessionManager.hasSessionData(instanceId);
  }

  /**
   * 清除实例的会话数据（强制重新登录）
   * @param {string} instanceId - 实例 ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async clearSessionData(instanceId) {
    if (!this.sessionManager) {
      return {
        success: false,
        error: 'SessionManager not configured'
      };
    }
    
    this.log('info', `Clearing session data for instance ${instanceId}`);
    
    const result = await this.sessionManager.clearSessionData(instanceId);
    
    if (result.success) {
      // 更新登录状态
      this._updateStatus(instanceId, { isLoggedIn: false });
    }
    
    return result;
  }

  /**
   * 获取实例的会话数据统计
   * @param {string} instanceId - 实例 ID
   * @returns {Promise<{size: number, files: number, error?: string}>}
   */
  async getSessionDataStats(instanceId) {
    if (!this.sessionManager) {
      return {
        size: 0,
        files: 0,
        error: 'SessionManager not configured'
      };
    }
    
    return await this.sessionManager.getSessionDataStats(instanceId);
  }

  /**
   * 保存实例的窗口状态
   * @param {string} instanceId - 实例 ID
   * @returns {{success: boolean, bounds?: Object, error?: string}}
   */
  saveWindowState(instanceId) {
    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        return {
          success: false,
          error: 'Instance not found'
        };
      }

      const { window, config } = instance;

      if (!window || window.isDestroyed()) {
        return {
          success: false,
          error: 'Window is destroyed'
        };
      }

      // 获取窗口边界
      const bounds = window.getBounds();
      const isMinimized = window.isMinimized();
      const isMaximized = window.isMaximized();

      // 更新配置
      config.window = {
        ...config.window,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        minimized: isMinimized,
        maximized: isMaximized
      };

      this.log('info', `Saved window state for instance ${instanceId}:`, bounds);

      return {
        success: true,
        bounds: config.window
      };
    } catch (error) {
      this.log('error', `Failed to save window state for instance ${instanceId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取实例的窗口状态
   * @param {string} instanceId - 实例 ID
   * @returns {{success: boolean, bounds?: Object, error?: string}}
   */
  getWindowState(instanceId) {
    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        return {
          success: false,
          error: 'Instance not found'
        };
      }

      const { window } = instance;

      if (!window || window.isDestroyed()) {
        return {
          success: false,
          error: 'Window is destroyed'
        };
      }

      const bounds = window.getBounds();
      const isMinimized = window.isMinimized();
      const isMaximized = window.isMaximized();
      const isVisible = window.isVisible();

      return {
        success: true,
        bounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          minimized: isMinimized,
          maximized: isMaximized,
          visible: isVisible
        }
      };
    } catch (error) {
      this.log('error', `Failed to get window state for instance ${instanceId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 设置实例的窗口状态
   * @param {string} instanceId - 实例 ID
   * @param {Object} bounds - 窗口边界
   * @param {number} [bounds.x] - X 坐标
   * @param {number} [bounds.y] - Y 坐标
   * @param {number} [bounds.width] - 宽度
   * @param {number} [bounds.height] - 高度
   * @returns {{success: boolean, error?: string}}
   */
  setWindowState(instanceId, bounds) {
    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        return {
          success: false,
          error: 'Instance not found'
        };
      }

      const { window } = instance;

      if (!window || window.isDestroyed()) {
        return {
          success: false,
          error: 'Window is destroyed'
        };
      }

      // 验证边界
      const validatedBounds = this._validateWindowBounds(bounds);

      // 设置窗口边界
      window.setBounds(validatedBounds);

      this.log('info', `Set window state for instance ${instanceId}:`, validatedBounds);

      return { success: true };
    } catch (error) {
      this.log('error', `Failed to set window state for instance ${instanceId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = InstanceManager;
