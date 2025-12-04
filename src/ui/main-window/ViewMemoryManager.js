/**
 * ViewMemoryManager - 内存管理器
 * 
 * 负责监控和管理BrowserView的内存使用
 */

class ViewMemoryManager {
  constructor(options = {}) {
    this.options = {
      memoryWarningThreshold: options.memoryWarningThreshold || 300,
      maxMemoryPerView: options.maxMemoryPerView || 500,
      autoMemoryCleanup: options.autoMemoryCleanup !== false,
      memoryCheckInterval: options.memoryCheckInterval || 30000,
      ...options
    };

    // 视图访问时间跟踪
    this.viewAccessTimes = new Map();
    
    // 内存使用缓存
    this.memoryUsageCache = new Map();
    
    // 视图池
    this.viewPool = [];
    
    // 内存监控定时器
    this.memoryMonitorInterval = null;

    // 日志函数
    this.log = this._createLogger();
  }

  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [ViewMemoryManager] [${level.toUpperCase()}] ${message}`;
      
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
   * 记录视图访问
   * @param {string} accountId - 账号ID
   */
  recordViewAccess(accountId) {
    this.viewAccessTimes.set(accountId, Date.now());
  }

  /**
   * 获取视图访问时间
   * @param {string} accountId - 账号ID
   * @returns {number|null}
   */
  getLastAccessTime(accountId) {
    return this.viewAccessTimes.get(accountId) || null;
  }

  /**
   * 检查视图是否过期
   * @param {string} accountId - 账号ID
   * @param {number} maxInactiveTime - 最大不活跃时间（毫秒）
   * @returns {boolean}
   */
  isViewExpired(accountId, maxInactiveTime) {
    const lastAccess = this.getLastAccessTime(accountId);
    if (!lastAccess) return true;
    
    return (Date.now() - lastAccess) > maxInactiveTime;
  }

  /**
   * 更新内存使用缓存
   * @param {string} accountId - 账号ID
   * @param {number} memoryUsage - 内存使用（MB）
   */
  updateMemoryUsage(accountId, memoryUsage) {
    this.memoryUsageCache.set(accountId, {
      memoryUsage,
      timestamp: Date.now()
    });
  }

  /**
   * 获取内存使用
   * @param {string} accountId - 账号ID
   * @returns {Object|null}
   */
  getMemoryUsage(accountId) {
    return this.memoryUsageCache.get(accountId) || null;
  }

  /**
   * 检查内存是否超过警告阈值
   * @param {string} accountId - 账号ID
   * @returns {boolean}
   */
  isMemoryWarning(accountId) {
    const usage = this.getMemoryUsage(accountId);
    if (!usage) return false;
    
    return usage.memoryUsage > this.options.memoryWarningThreshold;
  }

  /**
   * 检查内存是否超过最大限制
   * @param {string} accountId - 账号ID
   * @returns {boolean}
   */
  isMemoryExceeded(accountId) {
    const usage = this.getMemoryUsage(accountId);
    if (!usage) return false;
    
    return usage.memoryUsage > this.options.maxMemoryPerView;
  }

  /**
   * 添加视图到池
   * @param {BrowserView} view - 视图
   * @param {Object} session - 会话
   */
  addToViewPool(view, session) {
    this.viewPool.push({ view, session, addedAt: Date.now() });
    this.log('debug', `View added to pool. Pool size: ${this.viewPool.length}`);
  }

  /**
   * 从池中获取视图
   * @returns {Object|null}
   */
  getFromViewPool() {
    if (this.viewPool.length === 0) return null;
    
    const item = this.viewPool.shift();
    this.log('debug', `View retrieved from pool. Remaining: ${this.viewPool.length}`);
    return item;
  }

  /**
   * 清空视图池
   */
  clearViewPool() {
    for (const item of this.viewPool) {
      if (item.view && !item.view.webContents.isDestroyed()) {
        item.view.webContents.destroy();
      }
    }
    this.viewPool = [];
    this.log('info', 'View pool cleared');
  }

  /**
   * 开始内存监控
   * @param {Map} views - 视图映射
   */
  startMemoryMonitoring(views) {
    if (!this.options.autoMemoryCleanup) {
      this.log('info', 'Memory monitoring disabled');
      return;
    }

    if (this.memoryMonitorInterval) {
      this.log('warn', 'Memory monitoring already started');
      return;
    }

    this.memoryMonitorInterval = setInterval(() => {
      this.checkMemoryUsage(views);
    }, this.options.memoryCheckInterval);

    this.log('info', `Memory monitoring started (interval: ${this.options.memoryCheckInterval}ms)`);
  }

  /**
   * 停止内存监控
   */
  stopMemoryMonitoring() {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
      this.log('info', 'Memory monitoring stopped');
    }
  }

  /**
   * 检查内存使用
   * @param {Map} views - 视图映射
   */
  checkMemoryUsage(views) {
    try {
      for (const [accountId, viewState] of views) {
        if (!viewState.view || viewState.view.webContents.isDestroyed()) {
          continue;
        }

        const process = viewState.view.webContents.getOSProcessId();
        if (!process) continue;

        // 模拟内存检查（实际实现需要平台特定的代码）
        const memoryUsage = this._estimateMemoryUsage(viewState);
        
        this.updateMemoryUsage(accountId, memoryUsage);

        if (this.isMemoryWarning(accountId)) {
          this.log('warn', `Memory warning for ${accountId}: ${memoryUsage}MB`);
        }

        if (this.isMemoryExceeded(accountId)) {
          this.log('error', `Memory exceeded for ${accountId}: ${memoryUsage}MB`);
          // 触发垃圾回收或清理
          this._triggerCleanup(viewState);
        }
      }
    } catch (error) {
      this.log('error', 'Failed to check memory usage:', error);
    }
  }

  /**
   * 估算内存使用
   * @private
   */
  _estimateMemoryUsage(viewState) {
    // 简化的内存估算
    const baseMemory = 100;
    const pageComplexity = viewState.loadCount || 1;
    return baseMemory + (pageComplexity * 50);
  }

  /**
   * 触发清理
   * @private
   */
  _triggerCleanup(viewState) {
    try {
      if (viewState.view && !viewState.view.webContents.isDestroyed()) {
        viewState.view.webContents.executeJavaScript('if (window.gc) window.gc(); true;').catch(() => {});
      }
    } catch (error) {
      this.log('error', 'Failed to trigger cleanup:', error);
    }
  }

  /**
   * 获取内存统计
   */
  getMemoryStats() {
    const stats = {
      totalViews: this.viewAccessTimes.size,
      memoryUsage: [],
      viewPoolSize: this.viewPool.length
    };

    for (const [accountId, data] of this.memoryUsageCache) {
      stats.memoryUsage.push({
        accountId,
        ...data
      });
    }

    return stats;
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stopMemoryMonitoring();
    this.clearViewPool();
    this.memoryUsageCache.clear();
    this.viewAccessTimes.clear();
    this.log('info', 'ViewMemoryManager cleaned up');
  }
}

module.exports = ViewMemoryManager;