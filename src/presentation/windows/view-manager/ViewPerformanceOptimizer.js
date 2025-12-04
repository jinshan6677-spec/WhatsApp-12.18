/**
 * ViewPerformanceOptimizer - 视图性能优化
 * 
 * 负责视图池管理、懒加载、访问时间跟踪等性能优化功能
 * 
 * @module presentation/windows/view-manager/ViewPerformanceOptimizer
 */

/**
 * ViewPerformanceOptimizer class
 */
class ViewPerformanceOptimizer {
  /**
   * Create ViewPerformanceOptimizer instance
   * @param {Object} [options] - Configuration options
   * @param {number} [options.maxConcurrentViews] - Maximum concurrent views
   * @param {number} [options.viewPoolSize] - View pool size
   * @param {boolean} [options.lazyLoadViews] - Enable lazy loading
   * @param {Function} [options.logger] - Logger function
   */
  constructor(options = {}) {
    this.options = {
      maxConcurrentViews: options.maxConcurrentViews || 10,
      viewPoolSize: options.viewPoolSize || 2,
      lazyLoadViews: options.lazyLoadViews !== false, // Default: true
      ...options
    };

    // View pool for reuse
    this.viewPool = [];

    // Track view access times for memory management
    this.viewAccessTimes = new Map();

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
      const logMessage = `[${timestamp}] [ViewPerformanceOptimizer] [${level.toUpperCase()}] ${message}`;
      
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
   * Record view access time
   * @param {string} accountId - Account ID
   */
  recordViewAccess(accountId) {
    this.viewAccessTimes.set(accountId, Date.now());
  }

  /**
   * Get last access time for a view
   * @param {string} accountId - Account ID
   * @returns {number|null} Last access timestamp or null
   */
  getLastAccessTime(accountId) {
    return this.viewAccessTimes.get(accountId) || null;
  }

  /**
   * Check if view limit is exceeded
   * @param {number} currentViewCount - Current number of views
   * @returns {boolean} True if limit exceeded
   */
  isViewLimitExceeded(currentViewCount) {
    return currentViewCount >= this.options.maxConcurrentViews;
  }

  /**
   * Get views sorted by last access time (oldest first)
   * @param {Map} views - Map of accountId to viewState
   * @param {string} activeAccountId - Currently active account ID
   * @returns {Array} Sorted array of {accountId, accessTime, isActive}
   */
  getViewsByAccessTime(views, activeAccountId) {
    return Array.from(views.keys())
      .map(accountId => ({
        accountId,
        accessTime: this.viewAccessTimes.get(accountId) || 0,
        isActive: accountId === activeAccountId
      }))
      .filter(v => !v.isActive) // Never include active view
      .sort((a, b) => a.accessTime - b.accessTime);
  }

  /**
   * Get number of views to destroy to make room
   * @param {number} currentViewCount - Current number of views
   * @returns {number} Number of views to destroy
   */
  getViewsToDestroyCount(currentViewCount) {
    if (currentViewCount < this.options.maxConcurrentViews) {
      return 0;
    }
    return currentViewCount - this.options.maxConcurrentViews + 1;
  }

  /**
   * Pool a view for potential reuse
   * @param {Object} viewState - View state object
   * @param {string} accountId - Account ID
   * @returns {boolean} Success status
   */
  poolView(viewState, accountId) {
    try {
      // Check if pool is full
      if (this.viewPool.length >= this.options.viewPoolSize) {
        // Pool is full, remove oldest pooled view and destroy it
        const oldestPooled = this.viewPool.shift();
        if (oldestPooled && oldestPooled.view && !oldestPooled.view.webContents.isDestroyed()) {
          try {
            oldestPooled.view.webContents.destroy();
            this.log('info', 'Destroyed oldest pooled view to make room');
          } catch (error) {
            this.log('error', 'Failed to destroy oldest pooled view:', error);
          }
        }
      }

      this.log('info', `Pooling view for potential reuse: ${accountId}`);

      // Add to pool
      this.viewPool.push({
        view: viewState.view,
        session: viewState.session,
        pooledAt: Date.now(),
        originalAccountId: accountId
      });

      // Remove from access times
      this.viewAccessTimes.delete(accountId);

      this.log('info', `View pooled: ${accountId} (pool size: ${this.viewPool.length})`);

      return true;
    } catch (error) {
      this.log('error', `Failed to pool view ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Get a view from the pool
   * @returns {Object|null} Pooled view object or null
   */
  getPooledView() {
    if (this.viewPool.length === 0) {
      return null;
    }

    // Get the most recently pooled view
    const pooledView = this.viewPool.pop();
    
    // Check if view is still valid
    if (pooledView.view && !pooledView.view.webContents.isDestroyed()) {
      this.log('info', `Reusing pooled view (pool size: ${this.viewPool.length})`);
      return pooledView;
    }

    // View is destroyed, try next one
    return this.getPooledView();
  }

  /**
   * Clear the view pool and destroy all pooled views
   * @returns {number} Number of views destroyed
   */
  clearViewPool() {
    this.log('info', `Clearing view pool (${this.viewPool.length} views)`);

    let destroyed = 0;

    while (this.viewPool.length > 0) {
      const pooledView = this.viewPool.pop();
      
      if (pooledView.view && !pooledView.view.webContents.isDestroyed()) {
        try {
          pooledView.view.webContents.destroy();
          destroyed++;
        } catch (error) {
          this.log('error', 'Failed to destroy pooled view:', error);
        }
      }
    }

    this.log('info', `View pool cleared: ${destroyed} views destroyed`);

    return destroyed;
  }

  /**
   * Clean up stale pooled views
   * @param {number} [maxAge=300000] - Maximum age in milliseconds (default: 5 minutes)
   * @returns {number} Number of views cleaned up
   */
  cleanupStalePooledViews(maxAge = 300000) {
    const now = Date.now();
    let cleaned = 0;

    this.viewPool = this.viewPool.filter(pooled => {
      const age = now - pooled.pooledAt;
      
      // Remove if too old or destroyed
      if (age > maxAge || pooled.view.webContents.isDestroyed()) {
        if (!pooled.view.webContents.isDestroyed()) {
          try {
            pooled.view.webContents.destroy();
          } catch (error) {
            this.log('error', 'Failed to destroy stale pooled view:', error);
          }
        }
        cleaned++;
        return false;
      }
      
      return true;
    });

    if (cleaned > 0) {
      this.log('info', `Cleaned up ${cleaned} stale pooled views`);
    }

    return cleaned;
  }

  /**
   * Optimize memory by identifying inactive views
   * @param {Map} views - Map of accountId to viewState
   * @param {string} activeAccountId - Currently active account ID
   * @param {number} [inactiveThreshold=300000] - Time in ms after which a view is considered inactive
   * @returns {Array} Array of accountIds that should be optimized
   */
  getInactiveViews(views, activeAccountId, inactiveThreshold = 300000) {
    const now = Date.now();
    const inactiveViews = [];

    for (const accountId of views.keys()) {
      // Never optimize active view
      if (accountId === activeAccountId) {
        continue;
      }

      const lastAccess = this.viewAccessTimes.get(accountId) || 0;
      const inactiveTime = now - lastAccess;

      if (inactiveTime > inactiveThreshold) {
        inactiveViews.push({
          accountId,
          inactiveTime,
          lastAccess
        });
      }
    }

    return inactiveViews;
  }

  /**
   * Get view pool statistics
   * @returns {Object} Pool statistics
   */
  getPoolStats() {
    return {
      size: this.viewPool.length,
      maxSize: this.options.viewPoolSize,
      views: this.viewPool.map(pooled => ({
        pooledAt: pooled.pooledAt,
        age: Date.now() - pooled.pooledAt,
        originalAccountId: pooled.originalAccountId,
        isDestroyed: pooled.view.webContents.isDestroyed()
      }))
    };
  }

  /**
   * Get performance statistics
   * @param {Map} views - Map of accountId to viewState
   * @param {string} activeAccountId - Currently active account ID
   * @returns {Object} Performance statistics
   */
  getPerformanceStats(views, activeAccountId) {
    return {
      totalViews: views.size,
      activeView: activeAccountId,
      pooledViews: this.viewPool.length,
      maxConcurrentViews: this.options.maxConcurrentViews,
      lazyLoadEnabled: this.options.lazyLoadViews,
      viewAccessTimes: Array.from(this.viewAccessTimes.entries()).map(([accountId, time]) => ({
        accountId,
        lastAccess: time,
        timeSinceAccess: Date.now() - time
      })),
      poolDetails: this.viewPool.map(pooled => ({
        pooledAt: pooled.pooledAt,
        age: Date.now() - pooled.pooledAt,
        originalAccountId: pooled.originalAccountId
      }))
    };
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.clearViewPool();
    this.viewAccessTimes.clear();
    this.log('info', 'ViewPerformanceOptimizer cleaned up');
  }
}

module.exports = ViewPerformanceOptimizer;
