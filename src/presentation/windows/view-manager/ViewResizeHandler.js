/**
 * ViewResizeHandler - 窗口大小调整处理
 * 
 * 负责处理窗口大小变化事件，使用防抖机制优化性能
 * 
 * @module presentation/windows/view-manager/ViewResizeHandler
 */

/**
 * ViewResizeHandler class
 */
class ViewResizeHandler {
  /**
   * Create ViewResizeHandler instance
   * @param {ViewBoundsManager} boundsManager - ViewBoundsManager instance
   * @param {Object} [options] - Configuration options
   * @param {number} [options.debounceDelay] - Debounce delay in milliseconds
   * @param {Function} [options.logger] - Logger function
   */
  constructor(boundsManager, options = {}) {
    if (!boundsManager) {
      throw new Error('ViewBoundsManager instance is required');
    }

    this.boundsManager = boundsManager;
    this.options = {
      debounceDelay: options.debounceDelay || 16, // ~60fps for better real-time experience
      immediateResizeThreshold: options.immediateResizeThreshold || 50, // Skip debouncing for small changes
      ...options
    };

    // Debounce timer for resize operations
    this.resizeDebounceTimer = null;

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
      const logMessage = `[${timestamp}] [ViewResizeHandler] [${level.toUpperCase()}] ${message}`;
      
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
   * Resize all views with optimized debouncing
   * @param {Map} views - Map of accountId to viewState
   * @param {number} sidebarWidth - New sidebar width in pixels
   * @param {Object} [options] - Resize options
   * @param {boolean} [options.immediate] - Skip debouncing and resize immediately
   * @param {number} [options.lastWidth] - Previous width for delta calculation
   */
  resizeViews(views, sidebarWidth, options = {}) {
    // Clear existing debounce timer
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }

    // Calculate width change delta
    const widthDelta = options.lastWidth ? Math.abs(sidebarWidth - options.lastWidth) : 0;
    
    // If immediate resize requested or small change, perform it now
    if (options.immediate || widthDelta <= this.options.immediateResizeThreshold) {
      this._performResize(views, sidebarWidth);
      return;
    }

    // Otherwise, debounce the resize operation with reduced delay
    this.resizeDebounceTimer = setTimeout(() => {
      this._performResize(views, sidebarWidth);
      this.resizeDebounceTimer = null;
    }, this.options.debounceDelay);
  }

  /**
   * Perform the actual resize operation
   * @private
   * @param {Map} views - Map of accountId to viewState
   * @param {number} sidebarWidth - New sidebar width in pixels
   */
  _performResize(views, sidebarWidth) {
    try {
      this.log('info', `Resizing views for sidebar width: ${sidebarWidth}`);
      this.boundsManager.updateAllViewBounds(views, sidebarWidth);
    } catch (error) {
      this.log('error', 'Failed to resize views:', error);
    }
  }

  /**
   * Handle window resize event
   * @param {Map} views - Map of accountId to viewState
   * @param {MainWindow} mainWindow - MainWindow instance
   * @param {Object} [options] - Resize options
   */
  handleWindowResize(views, mainWindow, options = {}) {
    try {
      const window = mainWindow.getWindow();
      if (!window || window.isDestroyed()) {
        return;
      }

      // Get current sidebar width
      const sidebarWidth = mainWindow.getSidebarWidth();

      // Resize all views with the current sidebar width
      this.resizeViews(views, sidebarWidth, options);

      this.log('debug', 'Window resize handled');
    } catch (error) {
      this.log('error', 'Failed to handle window resize:', error);
    }
  }

  /**
   * Handle sidebar resize event
   * @param {Map} views - Map of accountId to viewState
   * @param {number} newSidebarWidth - New sidebar width
   * @param {Object} [options] - Resize options
   */
  handleSidebarResize(views, newSidebarWidth, options = {}) {
    try {
      this.log('info', `Sidebar resized to: ${newSidebarWidth}`);
      
      // Invalidate bounds cache since sidebar width changed
      this.boundsManager.invalidateCache();
      
      // Resize all views
      this.resizeViews(views, newSidebarWidth, options);
    } catch (error) {
      this.log('error', 'Failed to handle sidebar resize:', error);
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }
    this.log('info', 'ViewResizeHandler cleaned up');
  }
}

module.exports = ViewResizeHandler;
