/**
 * 内容脚本优化器注入包装器
 * 先注入优化器，再注入主内容脚本
 */

// 注入 ContentScriptOptimizer
(function() {
  'use strict';
  
  // 内容脚本性能优化工具
  class ContentScriptOptimizer {
    constructor() {
      this.domOperations = [];
      this.rafScheduled = false;
      this.pendingTranslations = new Map();
      this.translationCache = new Map();
      this.cacheTimeout = 5000;
      this.debounceTimers = new Map();
      this.throttleTimers = new Map();
      this.stats = {
        domBatches: 0,
        domOperations: 0,
        translationRequests: 0,
        deduplicatedRequests: 0,
        cacheHits: 0
      };
    }

    scheduleDOMUpdate(operation) {
      this.domOperations.push(operation);
      this.stats.domOperations++;
      
      if (!this.rafScheduled) {
        this.rafScheduled = true;
        requestAnimationFrame(() => {
          this.flushDOMUpdates();
        });
      }
    }

    flushDOMUpdates() {
      const operations = this.domOperations.splice(0);
      this.rafScheduled = false;
      this.stats.domBatches++;
      
      operations.forEach(operation => {
        try {
          operation();
        } catch (error) {
          console.error('[ContentScriptOptimizer] DOM operation failed:', error);
        }
      });
    }

    async executeTranslation(key, translationFn) {
      this.stats.translationRequests++;
      
      const cached = this.translationCache.get(key);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        this.stats.cacheHits++;
        return cached.result;
      }
      
      if (this.pendingTranslations.has(key)) {
        this.stats.deduplicatedRequests++;
        return this.pendingTranslations.get(key);
      }
      
      const promise = translationFn()
        .then(result => {
          this.translationCache.set(key, {
            result,
            timestamp: Date.now()
          });
          this.cleanExpiredCache();
          return result;
        })
        .finally(() => {
          this.pendingTranslations.delete(key);
        });
      
      this.pendingTranslations.set(key, promise);
      return promise;
    }

    cleanExpiredCache() {
      const now = Date.now();
      for (const [key, value] of this.translationCache.entries()) {
        if (now - value.timestamp > this.cacheTimeout) {
          this.translationCache.delete(key);
        }
      }
    }

    debounce(key, func, wait) {
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key));
      }
      
      const timer = setTimeout(() => {
        this.debounceTimers.delete(key);
        func();
      }, wait);
      
      this.debounceTimers.set(key, timer);
    }

    throttle(key, func, limit) {
      if (this.throttleTimers.has(key)) {
        return;
      }
      
      func();
      
      const timer = setTimeout(() => {
        this.throttleTimers.delete(key);
      }, limit);
      
      this.throttleTimers.set(key, timer);
    }

    getStats() {
      return {
        ...this.stats,
        pendingTranslations: this.pendingTranslations.size,
        cachedTranslations: this.translationCache.size,
        pendingDOMOperations: this.domOperations.length,
        avgDOMBatchSize: this.stats.domBatches > 0
          ? (this.stats.domOperations / this.stats.domBatches).toFixed(2)
          : '0',
        deduplicationRate: this.stats.translationRequests > 0
          ? ((this.stats.deduplicatedRequests / this.stats.translationRequests) * 100).toFixed(2) + '%'
          : '0%',
        cacheHitRate: this.stats.translationRequests > 0
          ? ((this.stats.cacheHits / this.stats.translationRequests) * 100).toFixed(2) + '%'
          : '0%'
      };
    }

    cleanup() {
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      this.throttleTimers.forEach(timer => clearTimeout(timer));
      this.debounceTimers.clear();
      this.throttleTimers.clear();
      this.pendingTranslations.clear();
      this.translationCache.clear();
      this.domOperations = [];
      this.rafScheduled = false;
    }
  }

  // 创建全局优化器实例
  window.contentScriptOptimizer = new ContentScriptOptimizer();
  
  console.log('[Translation] ContentScriptOptimizer initialized');
  
  // 暴露性能统计 API
  window.getTranslationPerformanceStats = () => {
    return window.contentScriptOptimizer.getStats();
  };
})();
