/**
 * ViewMemoryManager - 视图内存管理
 * 
 * 负责监控和管理BrowserView的内存使用，包括内存限制、自动清理等
 * 
 * @module presentation/windows/view-manager/ViewMemoryManager
 */

/**
 * ViewMemoryManager class
 */
class ViewMemoryManager {
  /**
   * Create ViewMemoryManager instance
   * @param {Object} [options] - Configuration options
   * @param {number} [options.memoryWarningThreshold] - Warning threshold in MB
   * @param {number} [options.maxMemoryPerView] - Maximum memory per view in MB
   * @param {boolean} [options.autoMemoryCleanup] - Enable automatic cleanup
   * @param {number} [options.memoryCheckInterval] - Memory check interval in ms
   * @param {Function} [options.logger] - Logger function
   * @param {Function} [options.notifyRenderer] - Function to notify renderer
   */
  constructor(options = {}) {
    this.options = {
      memoryWarningThreshold: options.memoryWarningThreshold || 300, // MB
      maxMemoryPerView: options.maxMemoryPerView || 500, // MB
      autoMemoryCleanup: options.autoMemoryCleanup !== false, // Default: true
      memoryCheckInterval: options.memoryCheckInterval || 60000, // 1 minute
      ...options
    };

    // Memory limits
    this.memoryLimits = {
      warningThreshold: this.options.memoryWarningThreshold,
      maxMemory: this.options.maxMemoryPerView,
      autoCleanupEnabled: this.options.autoMemoryCleanup
    };

    // Memory usage cache
    this.memoryUsageCache = new Map();

    // Memory monitor interval
    this.memoryMonitorInterval = null;

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
   * Start monitoring memory usage
   * @param {Map} views - Map of accountId to viewState
   * @param {Function} reloadViewCallback - Callback to reload a view
   */
  startMemoryMonitoring(views, reloadViewCallback) {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }

    this.log('info', `Starting memory monitoring (interval: ${this.options.memoryCheckInterval}ms)`);

    this.memoryMonitorInterval = setInterval(async () => {
      try {
        await this._checkMemoryUsage(views, reloadViewCallback);
      } catch (error) {
        this.log('error', 'Memory monitoring error:', error);
      }
    }, this.options.memoryCheckInterval);
  }

  /**
   * Stop monitoring memory usage
   */
  stopMemoryMonitoring() {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
      this.log('info', 'Memory monitoring stopped');
    }
  }

  /**
   * Check memory usage for all views and take action if needed
   * @private
   * @param {Map} views - Map of accountId to viewState
   * @param {Function} reloadViewCallback - Callback to reload a view
   * @returns {Promise<Object>} Check results
   */
  async _checkMemoryUsage(views, reloadViewCallback) {
    const results = {
      checked: 0,
      warnings: [],
      actionsTaken: []
    };

    for (const [accountId, viewState] of views) {
      try {
        // Skip destroyed views
        if (!viewState.view || viewState.view.webContents.isDestroyed()) {
          continue;
        }

        results.checked++;

        const memoryInfo = await this.getViewMemoryUsage(accountId, viewState);
        
        if (!memoryInfo) {
          continue;
        }

        const usage = memoryInfo.usedJSHeapSize;

        // Check if memory usage exceeds warning threshold
        if (usage >= this.memoryLimits.warningThreshold) {
          this.log('warn', `View ${accountId} memory usage high: ${usage}MB (threshold: ${this.memoryLimits.warningThreshold}MB)`);
          
          results.warnings.push({
            accountId,
            usage,
            threshold: this.memoryLimits.warningThreshold
          });

          // Notify renderer about high memory usage
          this.notifyRenderer('memory-warning', {
            accountId,
            usage,
            threshold: this.memoryLimits.warningThreshold,
            timestamp: Date.now()
          });
        }

        // Check if memory usage exceeds maximum limit
        if (usage >= this.memoryLimits.maxMemory) {
          this.log('error', `View ${accountId} memory usage critical: ${usage}MB (max: ${this.memoryLimits.maxMemory}MB)`);
          
          results.actionsTaken.push({
            accountId,
            action: 'reload',
            usage,
            maxMemory: this.memoryLimits.maxMemory
          });

          // Take action: reload the view to free memory
          if (this.memoryLimits.autoCleanupEnabled && reloadViewCallback) {
            this.log('info', `Auto-reloading view ${accountId} due to high memory usage`);
            
            // Notify renderer before reload
            this.notifyRenderer('memory-critical', {
              accountId,
              usage,
              maxMemory: this.memoryLimits.maxMemory,
              action: 'reloading',
              timestamp: Date.now()
            });

            // Reload the view
            await reloadViewCallback(accountId, true); // Ignore cache
          }
        }
      } catch (error) {
        this.log('error', `Failed to check memory for ${accountId}:`, error);
      }
    }

    if (results.warnings.length > 0 || results.actionsTaken.length > 0) {
      this.log('info', `Memory check complete: ${results.warnings.length} warnings, ${results.actionsTaken.length} actions taken`);
    }

    return results;
  }

  /**
   * Get memory usage for a specific view
   * @param {string} accountId - Account ID
   * @param {Object} viewState - View state object
   * @returns {Promise<Object|null>} Memory usage info or null
   */
  async getViewMemoryUsage(accountId, viewState) {
    try {
      if (!viewState || !viewState.view || viewState.view.webContents.isDestroyed()) {
        return null;
      }

      const memoryInfo = await viewState.view.webContents.executeJavaScript(`
        (function() {
          if (performance && performance.memory) {
            return {
              usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
              totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
              jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) // MB
            };
          }
          return null;
        })();
      `);

      if (memoryInfo) {
        // Cache the result
        this.memoryUsageCache.set(accountId, {
          usage: memoryInfo.usedJSHeapSize,
          timestamp: Date.now()
        });

        return {
          accountId,
          ...memoryInfo,
          timestamp: Date.now()
        };
      }

      return null;
    } catch (error) {
      this.log('error', `Failed to get memory usage for ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Get memory usage statistics for all views
   * @param {Map} views - Map of accountId to viewState
   * @param {string} activeAccountId - Currently active account ID
   * @returns {Promise<Object>} Memory usage statistics
   */
  async getMemoryUsage(views, activeAccountId) {
    const stats = {
      totalViews: views.size,
      activeView: activeAccountId,
      viewDetails: [],
      totalMemory: 0,
      timestamp: Date.now()
    };

    for (const [accountId, viewState] of views) {
      try {
        if (viewState.view && !viewState.view.webContents.isDestroyed()) {
          const processId = viewState.view.webContents.getOSProcessId();
          const memoryInfo = await this.getViewMemoryUsage(accountId, viewState);

          const viewInfo = {
            accountId,
            isVisible: viewState.isVisible,
            isActive: accountId === activeAccountId,
            status: viewState.status,
            processId,
            memory: memoryInfo
          };

          if (memoryInfo && memoryInfo.usedJSHeapSize) {
            stats.totalMemory += memoryInfo.usedJSHeapSize;
          }

          stats.viewDetails.push(viewInfo);
        }
      } catch (error) {
        this.log('error', `Failed to get memory info for ${accountId}:`, error);
      }
    }

    return stats;
  }

  /**
   * Get memory statistics summary
   * @param {Map} views - Map of accountId to viewState
   * @returns {Promise<Object>} Memory statistics summary
   */
  async getMemoryStats(views) {
    const memoryUsage = await this.getMemoryUsage(views, null);
    
    return {
      totalViews: memoryUsage.totalViews,
      totalMemoryMB: memoryUsage.totalMemory,
      averageMemoryMB: memoryUsage.totalViews > 0 
        ? Math.round(memoryUsage.totalMemory / memoryUsage.totalViews) 
        : 0,
      limits: this.memoryLimits,
      highMemoryViews: memoryUsage.viewDetails
        .filter(v => v.memory && v.memory.usedJSHeapSize >= this.memoryLimits.warningThreshold)
        .map(v => ({
          accountId: v.accountId,
          memoryMB: v.memory.usedJSHeapSize,
          isActive: v.isActive
        })),
      timestamp: memoryUsage.timestamp
    };
  }

  /**
   * Set memory limits
   * @param {Object} limits - Memory limits
   */
  setMemoryLimits(limits) {
    if (limits.warningThreshold !== undefined) {
      this.memoryLimits.warningThreshold = limits.warningThreshold;
    }
    if (limits.maxMemory !== undefined) {
      this.memoryLimits.maxMemory = limits.maxMemory;
    }
    if (limits.autoCleanupEnabled !== undefined) {
      this.memoryLimits.autoCleanupEnabled = limits.autoCleanupEnabled;
    }

    this.log('info', 'Memory limits updated:', this.memoryLimits);
  }

  /**
   * Get current memory limits
   * @returns {Object} Memory limits
   */
  getMemoryLimits() {
    return { ...this.memoryLimits };
  }

  /**
   * Force garbage collection for a view (if available)
   * @param {string} accountId - Account ID
   * @param {Object} viewState - View state object
   * @returns {Promise<boolean>} Success status
   */
  async forceGarbageCollection(accountId, viewState) {
    try {
      if (!viewState || !viewState.view || viewState.view.webContents.isDestroyed()) {
        return false;
      }

      this.log('info', `Forcing garbage collection for view ${accountId}`);

      await viewState.view.webContents.executeJavaScript(`
        (function() {
          if (window.gc) {
            window.gc();
            return true;
          }
          return false;
        })();
      `);

      return true;
    } catch (error) {
      this.log('error', `Failed to force garbage collection for ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Clear cache for a view
   * @param {string} accountId - Account ID
   * @param {Object} viewState - View state object
   * @returns {Promise<boolean>} Success status
   */
  async clearViewCache(accountId, viewState) {
    try {
      if (!viewState || !viewState.view || viewState.view.webContents.isDestroyed()) {
        return false;
      }

      this.log('info', `Clearing cache for view ${accountId}`);

      const session = viewState.session;
      
      // Clear cache
      await session.clearCache();
      
      // Clear storage data (but keep cookies for login state)
      await session.clearStorageData({
        storages: ['appcache', 'serviceworkers', 'cachestorage', 'websql', 'indexdb']
      });

      this.log('info', `Cache cleared for view ${accountId}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to clear cache for ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopMemoryMonitoring();
    this.memoryUsageCache.clear();
    this.log('info', 'ViewMemoryManager cleaned up');
  }
}

module.exports = ViewMemoryManager;
