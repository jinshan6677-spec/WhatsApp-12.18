/**
 * ViewBoundsManager - 边界计算和管理
 * 
 * 负责计算和管理BrowserView的边界，处理窗口大小变化
 */

class ViewBoundsManager {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.options = {
      debounceDelay: options.debounceDelay || 100,
      ...options
    };

    // 边界缓存
    this.boundsCache = {
      lastSidebarWidth: null,
      lastTranslationPanelWidth: null,
      lastWindowBounds: null,
      cachedBounds: null,
      cacheTimestamp: null
    };

    // 防抖定时器
    this.resizeDebounceTimer = null;

    // 日志函数
    this.log = this._createLogger();
  }

  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [ViewBoundsManager] [${level.toUpperCase()}] ${message}`;
      
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
   * 计算视图边界
   * @param {number} sidebarWidth - 侧边栏宽度
   * @param {boolean} forceRecalculate - 强制重新计算
   * @returns {Object} 边界对象 {x, y, width, height}
   */
  calculateBounds(sidebarWidth, forceRecalculate = false) {
    const window = this.mainWindow.getWindow();
    if (!window || window.isDestroyed()) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const windowBounds = window.getContentBounds();
    const sidebar = sidebarWidth || this.mainWindow.getSidebarWidth();
    const translationWidth = this.mainWindow.getTranslationPanelWidth();

    // 检查是否可以使用缓存
    if (!forceRecalculate && this.boundsCache.cachedBounds) {
      const cacheAge = Date.now() - (this.boundsCache.cacheTimestamp || 0);
      const isCacheValid = 
        this.boundsCache.lastSidebarWidth === sidebar &&
        this.boundsCache.lastTranslationPanelWidth === translationWidth &&
        this.boundsCache.lastWindowBounds &&
        this.boundsCache.lastWindowBounds.width === windowBounds.width &&
        this.boundsCache.lastWindowBounds.height === windowBounds.height &&
        cacheAge < 1000;

      if (isCacheValid) {
        this.log('debug', 'Using cached bounds');
        return { ...this.boundsCache.cachedBounds };
      }
    }

    // 计算新边界
    const bounds = {
      x: sidebar,
      y: 0,
      width: Math.max(0, windowBounds.width - sidebar - translationWidth),
      height: windowBounds.height
    };

    // 更新缓存
    this.boundsCache = {
      lastSidebarWidth: sidebar,
      lastTranslationPanelWidth: translationWidth,
      lastWindowBounds: { ...windowBounds },
      cachedBounds: { ...bounds },
      cacheTimestamp: Date.now()
    };

    this.log('debug', 'Calculated and cached new bounds');
    return bounds;
  }

  /**
   * 调整所有视图的大小
   * @param {Map} views - 视图映射
   * @param {number} sidebarWidth - 侧边栏宽度
   * @param {Object} options - 选项
   */
  resizeViews(views, sidebarWidth, options = {}) {
    // 清除现有的防抖定时器
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }

    // 如果请求立即调整大小，立即执行
    if (options.immediate) {
      this.performResize(views, sidebarWidth);
      return;
    }

    // 否则，防抖调整大小操作
    this.resizeDebounceTimer = setTimeout(() => {
      this.performResize(views, sidebarWidth);
      this.resizeDebounceTimer = null;
    }, this.options.debounceDelay);
  }

  /**
   * 执行实际的调整大小操作
   * @param {Map} views - 视图映射
   * @param {number} sidebarWidth - 侧边栏宽度
   */
  performResize(views, sidebarWidth) {
    try {
      this.log('info', `Resizing views for sidebar width: ${sidebarWidth}`);

      const bounds = this.calculateBounds(sidebarWidth);

      // 更新所有视图的边界
      for (const [, viewState] of views) {
        viewState.bounds = bounds;
        
        // 更新所有视图，不只是可见的
        if (viewState.view && !viewState.view.webContents.isDestroyed()) {
          viewState.view.setBounds(bounds);
        }
      }

      this.log('info', `Views resized to bounds: ${JSON.stringify(bounds)}`);
    } catch (error) {
      this.log('error', 'Failed to resize views:', error);
    }
  }

  /**
   * 处理窗口大小变化
   * @param {Map} views - 视图映射
   * @param {Object} options - 选项
   */
  handleWindowResize(views, options = {}) {
    try {
      const window = this.mainWindow.getWindow();
      if (!window || window.isDestroyed()) {
        return;
      }

      // 获取当前侧边栏宽度
      const sidebarWidth = this.mainWindow.getSidebarWidth();

      // 调整所有视图的大小
      this.resizeViews(views, sidebarWidth, options);

      this.log('debug', 'Window resize handled');
    } catch (error) {
      this.log('error', 'Failed to handle window resize:', error);
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }
    this.log('info', 'ViewBoundsManager cleaned up');
  }
}

module.exports = ViewBoundsManager;
