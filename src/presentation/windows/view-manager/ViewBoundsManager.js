/**
 * ViewBoundsManager - 视图边界计算和布局管理
 * 
 * 负责计算和管理BrowserView的边界，处理窗口大小变化
 * 
 * @module presentation/windows/view-manager/ViewBoundsManager
 */

/**
 * ViewBoundsManager class
 */
class ViewBoundsManager {
  /**
   * Create ViewBoundsManager instance
   * @param {MainWindow} mainWindow - MainWindow instance
   * @param {Object} [options] - Configuration options
   * @param {number} [options.defaultSidebarWidth] - Default sidebar width in pixels
   * @param {Function} [options.logger] - Logger function
   */
  constructor(mainWindow, options = {}) {
    if (!mainWindow) {
      throw new Error('MainWindow instance is required');
    }

    this.mainWindow = mainWindow;
    this.options = {
      defaultSidebarWidth: options.defaultSidebarWidth || 280,
      ...options
    };

    // Performance optimization: Bounds cache
    this.boundsCache = {
      lastSidebarWidth: null,
      lastTranslationPanelWidth: null,
      lastWindowBounds: null,
      cachedBounds: null,
      cacheTimestamp: null
    };

    this.log = options.logger || this._createLogger();
  }

  /**
   * Create logger function
   * @private
   * @returns {Function}
   */
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
   * Calculate view bounds based on sidebar width and window size
   * @param {number} [sidebarWidth] - Sidebar width in pixels
   * @param {boolean} [forceRecalculate=false] - Force recalculation ignoring cache
   * @returns {Object} Bounds object {x, y, width, height}
   */
  calculateViewBounds(sidebarWidth, forceRecalculate = false) {
    try {
      const window = this.mainWindow.getWindow();
      if (!window || window.isDestroyed()) {
        this.log('warn', 'Main window is not available for bounds calculation');
        return { x: 0, y: 0, width: 0, height: 0 };
      }

      const windowBounds = window.getContentBounds();
      const sidebar = sidebarWidth || this.mainWindow.getSidebarWidth() || this.options.defaultSidebarWidth;
      
      // Get translation panel width if available
      let translationPanelWidth = 0;
      if (typeof this.mainWindow.getTranslationPanelWidth === 'function') {
        translationPanelWidth = this.mainWindow.getTranslationPanelWidth() || 0;
      }

      // Check if we can use cached bounds
      if (!forceRecalculate && this._isCacheValid(sidebar, translationPanelWidth, windowBounds)) {
        this.log('debug', 'Using cached bounds');
        return { ...this.boundsCache.cachedBounds };
      }

      // Calculate new bounds
      const bounds = {
        x: sidebar,
        y: 0,
        width: Math.max(0, windowBounds.width - sidebar - translationPanelWidth),
        height: windowBounds.height
      };

      // Update cache
      this._updateCache(sidebar, translationPanelWidth, windowBounds, bounds);

      this.log('debug', `Calculated bounds: ${JSON.stringify(bounds)}`);

      return bounds;
    } catch (error) {
      this.log('error', 'Failed to calculate view bounds:', error);
      return { x: 0, y: 0, width: 0, height: 0 };
    }
  }

  /**
   * Check if cache is valid
   * @private
   */
  _isCacheValid(sidebarWidth, translationPanelWidth, windowBounds) {
    if (!this.boundsCache.cachedBounds) {
      return false;
    }

    const cacheAge = Date.now() - (this.boundsCache.cacheTimestamp || 0);
    
    return (
      this.boundsCache.lastSidebarWidth === sidebarWidth &&
      this.boundsCache.lastTranslationPanelWidth === translationPanelWidth &&
      this.boundsCache.lastWindowBounds &&
      this.boundsCache.lastWindowBounds.width === windowBounds.width &&
      this.boundsCache.lastWindowBounds.height === windowBounds.height &&
      cacheAge < 200 // Cache valid for 200ms for better real-time experience
    );
  }

  /**
   * Update bounds cache
   * @private
   */
  _updateCache(sidebarWidth, translationPanelWidth, windowBounds, bounds) {
    this.boundsCache = {
      lastSidebarWidth: sidebarWidth,
      lastTranslationPanelWidth: translationPanelWidth,
      lastWindowBounds: { ...windowBounds },
      cachedBounds: { ...bounds },
      cacheTimestamp: Date.now()
    };
  }

  /**
   * Invalidate bounds cache
   * Call this when you know bounds need to be recalculated
   */
  invalidateCache() {
    this.log('debug', 'Invalidating bounds cache');
    this.boundsCache = {
      lastSidebarWidth: null,
      lastTranslationPanelWidth: null,
      lastWindowBounds: null,
      cachedBounds: null,
      cacheTimestamp: null
    };
  }

  /**
   * Update bounds for all views
   * @param {Map} views - Map of accountId to viewState
   * @param {number} [sidebarWidth] - Sidebar width in pixels
   */
  updateAllViewBounds(views, sidebarWidth) {
    try {
      const bounds = this.calculateViewBounds(sidebarWidth, true);

      for (const [accountId, viewState] of views) {
        viewState.bounds = bounds;
        
        // Update all views, not just visible ones
        if (viewState.view && !viewState.view.webContents.isDestroyed()) {
          viewState.view.setBounds(bounds);
        }
      }

      this.log('info', `Updated bounds for ${views.size} views: ${JSON.stringify(bounds)}`);
    } catch (error) {
      this.log('error', 'Failed to update view bounds:', error);
    }
  }

  /**
   * Get current bounds cache info
   * @returns {Object} Cache info
   */
  getCacheInfo() {
    return {
      isValid: !!this.boundsCache.cachedBounds,
      age: this.boundsCache.cacheTimestamp 
        ? Date.now() - this.boundsCache.cacheTimestamp 
        : null,
      lastSidebarWidth: this.boundsCache.lastSidebarWidth,
      lastTranslationPanelWidth: this.boundsCache.lastTranslationPanelWidth,
      cachedBounds: this.boundsCache.cachedBounds ? { ...this.boundsCache.cachedBounds } : null
    };
  }
}

module.exports = ViewBoundsManager;
