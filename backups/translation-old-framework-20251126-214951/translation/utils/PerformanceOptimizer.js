/**
 * 性能优化工具
 * 实现请求队列、请求合并、DOM 优化等功能
 */

class PerformanceOptimizer {
  constructor(options = {}) {
    // 请求队列配置
    this.maxConcurrent = options.maxConcurrent || 5;
    this.activeRequests = 0;
    this.requestQueue = [];
    
    // 请求去重配置
    this.pendingRequests = new Map(); // key -> Promise
    this.requestCache = new Map(); // key -> { result, timestamp }
    this.cacheTimeout = options.cacheTimeout || 5000; // 5秒内的重复请求直接返回缓存
    
    // DOM 操作队列
    this.domOperations = [];
    this.rafScheduled = false;
    
    // 统计信息
    this.stats = {
      totalRequests: 0,
      queuedRequests: 0,
      deduplicatedRequests: 0,
      cacheHits: 0,
      domBatchCount: 0,
      domOperationCount: 0
    };
  }

  /**
   * 执行翻译请求（带队列和去重）
   * @param {string} key - 请求唯一标识
   * @param {Function} requestFn - 实际的请求函数
   * @returns {Promise} 请求结果
   */
  async executeRequest(key, requestFn) {
    this.stats.totalRequests++;
    
    // 1. 检查短期缓存（避免重复请求）
    const cached = this.requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.stats.cacheHits++;
      return cached.result;
    }
    
    // 2. 检查是否有相同的请求正在进行
    if (this.pendingRequests.has(key)) {
      this.stats.deduplicatedRequests++;
      return this.pendingRequests.get(key);
    }
    
    // 3. 创建新的请求 Promise
    const requestPromise = new Promise((resolve, reject) => {
      const task = async () => {
        try {
          this.activeRequests++;
          const result = await requestFn();
          
          // 缓存结果
          this.requestCache.set(key, {
            result,
            timestamp: Date.now()
          });
          
          // 清理过期缓存
          this.cleanExpiredCache();
          
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          this.pendingRequests.delete(key);
          this.processQueue();
        }
      };
      
      // 如果当前并发数未达到上限，立即执行
      if (this.activeRequests < this.maxConcurrent) {
        task();
      } else {
        // 否则加入队列
        this.stats.queuedRequests++;
        this.requestQueue.push(task);
      }
    });
    
    // 记录正在进行的请求
    this.pendingRequests.set(key, requestPromise);
    
    return requestPromise;
  }

  /**
   * 处理队列中的请求
   */
  processQueue() {
    while (this.activeRequests < this.maxConcurrent && this.requestQueue.length > 0) {
      const task = this.requestQueue.shift();
      task();
    }
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.requestCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.requestCache.delete(key);
      }
    }
  }

  /**
   * 批量执行 DOM 操作（使用 requestAnimationFrame）
   * @param {Function} operation - DOM 操作函数
   */
  scheduleDOMOperation(operation) {
    this.domOperations.push(operation);
    this.stats.domOperationCount++;
    
    if (!this.rafScheduled) {
      this.rafScheduled = true;
      
      // 检查是否在浏览器环境
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          this.executeDOMOperations();
        });
      } else {
        // Node.js 环境，使用 setImmediate 或 setTimeout
        const scheduleFunc = typeof setImmediate !== 'undefined' ? setImmediate : setTimeout;
        scheduleFunc(() => {
          this.executeDOMOperations();
        }, 0);
      }
    }
  }

  /**
   * 执行所有待处理的 DOM 操作
   */
  executeDOMOperations() {
    const operations = this.domOperations.splice(0);
    this.rafScheduled = false;
    this.stats.domBatchCount++;
    
    // 批量执行所有 DOM 操作
    operations.forEach(operation => {
      try {
        operation();
      } catch (error) {
        console.error('[PerformanceOptimizer] DOM operation failed:', error);
      }
    });
  }

  /**
   * 防抖函数
   * @param {Function} func - 要防抖的函数
   * @param {number} wait - 等待时间（毫秒）
   * @returns {Function} 防抖后的函数
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * 节流函数
   * @param {Function} func - 要节流的函数
   * @param {number} limit - 时间限制（毫秒）
   * @returns {Function} 节流后的函数
   */
  throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    return {
      ...this.stats,
      activeRequests: this.activeRequests,
      queueLength: this.requestQueue.length,
      pendingRequests: this.pendingRequests.size,
      cacheSize: this.requestCache.size,
      deduplicationRate: this.stats.totalRequests > 0 
        ? (this.stats.deduplicatedRequests / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      cacheHitRate: this.stats.totalRequests > 0
        ? (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      avgDOMBatchSize: this.stats.domBatchCount > 0
        ? (this.stats.domOperationCount / this.stats.domBatchCount).toFixed(2)
        : '0'
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      queuedRequests: 0,
      deduplicatedRequests: 0,
      cacheHits: 0,
      domBatchCount: 0,
      domOperationCount: 0
    };
  }

  /**
   * 清理所有缓存和队列
   */
  cleanup() {
    this.requestQueue = [];
    this.pendingRequests.clear();
    this.requestCache.clear();
    this.domOperations = [];
    this.rafScheduled = false;
    this.activeRequests = 0;
  }
}

/**
 * 虚拟滚动管理器
 * 用于优化大量消息的渲染性能
 */
class VirtualScrollManager {
  constructor(options = {}) {
    this.container = null;
    this.items = [];
    this.visibleRange = { start: 0, end: 0 };
    this.itemHeight = options.itemHeight || 100; // 预估的项目高度
    this.bufferSize = options.bufferSize || 5; // 缓冲区大小
    this.renderCallback = options.renderCallback || (() => {});
    
    this.scrollHandler = null;
    this.resizeObserver = null;
  }

  /**
   * 初始化虚拟滚动
   * @param {HTMLElement} container - 滚动容器
   * @param {Array} items - 数据项数组
   */
  init(container, items) {
    this.container = container;
    this.items = items;
    
    // 设置容器样式
    if (!container.style.position || container.style.position === 'static') {
      container.style.position = 'relative';
    }
    container.style.overflow = 'auto';
    
    // 创建滚动处理器（节流）
    this.scrollHandler = this.throttle(() => {
      this.updateVisibleRange();
    }, 100);
    
    // 监听滚动事件
    container.addEventListener('scroll', this.scrollHandler);
    
    // 监听容器大小变化
    this.resizeObserver = new ResizeObserver(() => {
      this.updateVisibleRange();
    });
    this.resizeObserver.observe(container);
    
    // 初始渲染
    this.updateVisibleRange();
  }

  /**
   * 更新可见范围
   */
  updateVisibleRange() {
    if (!this.container) return;
    
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    
    // 计算可见范围
    const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
    const end = Math.min(
      this.items.length,
      Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.bufferSize
    );
    
    // 如果范围没有变化，不需要重新渲染
    if (start === this.visibleRange.start && end === this.visibleRange.end) {
      return;
    }
    
    this.visibleRange = { start, end };
    this.render();
  }

  /**
   * 渲染可见项
   */
  render() {
    const visibleItems = this.items.slice(this.visibleRange.start, this.visibleRange.end);
    
    // 调用渲染回调
    this.renderCallback({
      items: visibleItems,
      startIndex: this.visibleRange.start,
      endIndex: this.visibleRange.end,
      totalHeight: this.items.length * this.itemHeight,
      offsetTop: this.visibleRange.start * this.itemHeight
    });
  }

  /**
   * 更新数据项
   * @param {Array} items - 新的数据项数组
   */
  updateItems(items) {
    this.items = items;
    this.updateVisibleRange();
  }

  /**
   * 节流函数
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * 销毁虚拟滚动
   */
  destroy() {
    if (this.container && this.scrollHandler) {
      this.container.removeEventListener('scroll', this.scrollHandler);
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    this.container = null;
    this.items = [];
    this.scrollHandler = null;
    this.resizeObserver = null;
  }
}

module.exports = {
  PerformanceOptimizer,
  VirtualScrollManager
};
