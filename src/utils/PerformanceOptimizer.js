/**
 * PerformanceOptimizer - Utility for performance optimization
 * 
 * Provides utilities for:
 * - Debouncing high-frequency operations
 * - Throttling expensive operations
 * - Caching computed values
 * - Memory usage monitoring
 */

class PerformanceOptimizer {
  constructor() {
    this.caches = new Map();
    this.timers = new Map();
  }

  /**
   * Debounce a function - delays execution until after wait time has elapsed
   * since the last time it was invoked
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @param {string} [key] - Optional key for managing multiple debounced functions
   * @returns {Function} Debounced function
   */
  debounce(func, wait, key = 'default') {
    return (...args) => {
      const timerId = this.timers.get(key);
      if (timerId) {
        clearTimeout(timerId);
      }

      const newTimerId = setTimeout(() => {
        func.apply(this, args);
        this.timers.delete(key);
      }, wait);

      this.timers.set(key, newTimerId);
    };
  }

  /**
   * Throttle a function - ensures function is called at most once per wait period
   * @param {Function} func - Function to throttle
   * @param {number} wait - Wait time in milliseconds
   * @param {string} [key] - Optional key for managing multiple throttled functions
   * @returns {Function} Throttled function
   */
  throttle(func, wait, key = 'default') {
    let lastCall = 0;
    
    return (...args) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;

      if (timeSinceLastCall >= wait) {
        lastCall = now;
        func.apply(this, args);
      }
    };
  }

  /**
   * Create a cached version of a function
   * Results are cached based on stringified arguments
   * @param {Function} func - Function to cache
   * @param {Object} [options] - Cache options
   * @param {number} [options.maxAge] - Maximum age of cache entries in ms
   * @param {number} [options.maxSize] - Maximum number of cache entries
   * @param {string} [options.key] - Cache key
   * @returns {Function} Cached function
   */
  memoize(func, options = {}) {
    const cacheKey = options.key || func.name || 'default';
    const maxAge = options.maxAge || 60000; // 1 minute default
    const maxSize = options.maxSize || 100;

    if (!this.caches.has(cacheKey)) {
      this.caches.set(cacheKey, new Map());
    }

    const cache = this.caches.get(cacheKey);

    return (...args) => {
      const argKey = JSON.stringify(args);
      const cached = cache.get(argKey);

      // Check if cached value exists and is not expired
      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < maxAge) {
          return cached.value;
        } else {
          cache.delete(argKey);
        }
      }

      // Compute new value
      const value = func.apply(this, args);

      // Enforce cache size limit
      if (cache.size >= maxSize) {
        // Remove oldest entry
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      // Store in cache
      cache.set(argKey, {
        value,
        timestamp: Date.now()
      });

      return value;
    };
  }

  /**
   * Clear a specific cache or all caches
   * @param {string} [key] - Cache key to clear, or undefined to clear all
   */
  clearCache(key) {
    if (key) {
      this.caches.delete(key);
    } else {
      this.caches.clear();
    }
  }

  /**
   * Clear all timers
   */
  clearTimers() {
    for (const timerId of this.timers.values()) {
      clearTimeout(timerId);
    }
    this.timers.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const stats = {
      totalCaches: this.caches.size,
      caches: []
    };

    for (const [key, cache] of this.caches) {
      stats.caches.push({
        key,
        size: cache.size,
        entries: Array.from(cache.entries()).map(([argKey, entry]) => ({
          args: argKey,
          age: Date.now() - entry.timestamp
        }))
      });
    }

    return stats;
  }

  /**
   * Batch multiple DOM updates into a single operation
   * @param {Function} updateFunc - Function that performs DOM updates
   * @returns {Promise<void>}
   */
  async batchDOMUpdates(updateFunc) {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        updateFunc();
        resolve();
      });
    });
  }

  /**
   * Measure execution time of a function
   * @param {Function} func - Function to measure
   * @param {string} [label] - Label for the measurement
   * @returns {Promise<{result: any, duration: number}>}
   */
  async measurePerformance(func, label = 'operation') {
    const startTime = performance.now();
    
    try {
      const result = await func();
      const duration = performance.now() - startTime;
      
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
      
      return { result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`[Performance] ${label} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  /**
   * Create a lazy-loaded value that's computed only when first accessed
   * @param {Function} factory - Function that creates the value
   * @returns {Object} Object with get() method
   */
  lazy(factory) {
    let value;
    let computed = false;

    return {
      get: () => {
        if (!computed) {
          value = factory();
          computed = true;
        }
        return value;
      },
      reset: () => {
        computed = false;
        value = undefined;
      }
    };
  }

  /**
   * Monitor memory usage (Node.js only)
   * @returns {Object} Memory usage statistics
   */
  getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024), // MB
        rss: Math.round(usage.rss / 1024 / 1024) // MB
      };
    }
    return null;
  }

  /**
   * Create a rate limiter for operations
   * @param {number} maxOperations - Maximum operations per window
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Object} Rate limiter with check() method
   */
  createRateLimiter(maxOperations, windowMs) {
    const operations = [];

    return {
      check: () => {
        const now = Date.now();
        
        // Remove old operations outside the window
        while (operations.length > 0 && operations[0] < now - windowMs) {
          operations.shift();
        }

        // Check if we're at the limit
        if (operations.length >= maxOperations) {
          return false;
        }

        // Record this operation
        operations.push(now);
        return true;
      },
      reset: () => {
        operations.length = 0;
      }
    };
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    this.clearTimers();
    this.clearCache();
  }
}

// Export singleton instance
module.exports = new PerformanceOptimizer();
