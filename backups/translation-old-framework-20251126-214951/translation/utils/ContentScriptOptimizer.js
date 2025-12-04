/**
 * 内容脚本性能优化工具
 * 用于优化 WhatsApp Web 页面中的 DOM 操作和翻译请求
 */

class ContentScriptOptimizer {
  constructor() {
    // DOM 操作队列
    this.domOperations = [];
    this.rafScheduled = false;
    
    // 翻译请求去重
    this.pendingTranslations = new Map();
    this.translationCache = new Map();
    this.cacheTimeout = 5000; // 5秒缓存
    
    // 防抖和节流定时器
    this.debounceTimers = new Map();
    this.throttleTimers = new Map();
    
    // 统计信息
    this.stats = {
      domBatches: 0,
      domOperations: 0,
      translationRequests: 0,
      deduplicatedRequests: 0,
      cacheHits: 0
    };
  }

  /**
   * 批量执行 DOM 操作
   * @param {Function} operation - DOM 操作函数
   */
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

  /**
   * 执行所有待处理的 DOM 操作
   */
  flushDOMUpdates() {
    const operations = this.domOperations.splice(0);
    this.rafScheduled = false;
    this.stats.domBatches++;
    
    // 批量执行
    const fragment = document.createDocumentFragment();
    let useFragment = false;
    
    operations.forEach(operation => {
      try {
        // 如果操作返回 DOM 元素，添加到 fragment
        const result = operation();
        if (result instanceof HTMLElement) {
          fragment.appendChild(result);
          useFragment = true;
        }
      } catch (error) {
        console.error('[ContentScriptOptimizer] DOM operation failed:', error);
      }
    });
    
    // 如果有元素需要添加，一次性添加
    if (useFragment && fragment.childNodes.length > 0) {
      // 这里需要调用者指定容器，暂时不实现
      // 实际使用时，操作函数应该自己处理 DOM 插入
    }
  }

  /**
   * 执行翻译请求（带去重）
   * @param {string} key - 请求唯一标识
   * @param {Function} translationFn - 翻译函数
   * @returns {Promise} 翻译结果
   */
  async executeTranslation(key, translationFn) {
    this.stats.translationRequests++;
    
    // 检查缓存
    const cached = this.translationCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.stats.cacheHits++;
      return cached.result;
    }
    
    // 检查是否有相同请求正在进行
    if (this.pendingTranslations.has(key)) {
      this.stats.deduplicatedRequests++;
      return this.pendingTranslations.get(key);
    }
    
    // 创建新请求
    const promise = translationFn()
      .then(result => {
        // 缓存结果
        this.translationCache.set(key, {
          result,
          timestamp: Date.now()
        });
        
        // 清理过期缓存
        this.cleanExpiredCache();
        
        return result;
      })
      .finally(() => {
        this.pendingTranslations.delete(key);
      });
    
    this.pendingTranslations.set(key, promise);
    return promise;
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.translationCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.translationCache.delete(key);
      }
    }
  }

  /**
   * 防抖函数
   * @param {string} key - 防抖标识
   * @param {Function} func - 要防抖的函数
   * @param {number} wait - 等待时间（毫秒）
   */
  debounce(key, func, wait) {
    // 清除之前的定时器
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }
    
    // 设置新的定时器
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      func();
    }, wait);
    
    this.debounceTimers.set(key, timer);
  }

  /**
   * 节流函数
   * @param {string} key - 节流标识
   * @param {Function} func - 要节流的函数
   * @param {number} limit - 时间限制（毫秒）
   */
  throttle(key, func, limit) {
    // 如果正在节流中，忽略
    if (this.throttleTimers.has(key)) {
      return;
    }
    
    // 执行函数
    func();
    
    // 设置节流标记
    const timer = setTimeout(() => {
      this.throttleTimers.delete(key);
    }, limit);
    
    this.throttleTimers.set(key, timer);
  }

  /**
   * 批量显示翻译结果
   * @param {Array} translations - 翻译结果数组 [{messageNode, result}, ...]
   */
  batchDisplayTranslations(translations) {
    this.scheduleDOMUpdate(() => {
      translations.forEach(({ messageNode, result }) => {
        this.displayTranslation(messageNode, result);
      });
    });
  }

  /**
   * 显示单个翻译结果（内部方法）
   * @param {HTMLElement} messageNode - 消息节点
   * @param {Object} result - 翻译结果
   */
  displayTranslation(messageNode, result) {
    // 检查是否已经有翻译结果
    const existing = messageNode.querySelector('.wa-translation-result');
    if (existing) {
      existing.remove();
    }

    // 创建翻译结果元素
    const translationDiv = document.createElement('div');
    translationDiv.className = 'wa-translation-result';
    
    const detectedLang = result.detectedLang || 'auto';
    const targetLang = result.targetLang || 'unknown';
    
    // 简化 HTML 结构
    translationDiv.innerHTML = `
      <div class="translation-header">
        🌐 ${this.escapeHtml(detectedLang)} → ${this.escapeHtml(targetLang)}${result.cached ? ' 📦' : ''}
      </div>
      <div class="translation-text">${this.escapeHtml(result.translatedText)}</div>
    `;

    // 找到消息内容容器
    const messageContent = messageNode.querySelector('.copyable-text') ||
                          messageNode.querySelector('[data-testid="msg-text"]') ||
                          messageNode;

    // 插入翻译结果
    if (messageContent.parentNode) {
      messageContent.parentNode.appendChild(translationDiv);
    } else {
      messageNode.appendChild(translationDiv);
    }
  }

  /**
   * 转义 HTML
   * @param {string} text - 文本
   * @returns {string} 转义后的文本
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 虚拟滚动优化（检测是否需要）
   * @param {HTMLElement} container - 滚动容器
   * @returns {boolean} 是否需要虚拟滚动
   */
  shouldUseVirtualScroll(container) {
    if (!container) return false;
    
    // 如果消息数量超过 100 条，建议使用虚拟滚动
    const messages = container.querySelectorAll('.message-in, .message-out');
    return messages.length > 100;
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
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

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      domBatches: 0,
      domOperations: 0,
      translationRequests: 0,
      deduplicatedRequests: 0,
      cacheHits: 0
    };
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 清除所有定时器
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

// 导出单例
if (typeof window !== 'undefined') {
  window.ContentScriptOptimizer = ContentScriptOptimizer;
}

// Node.js 环境导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentScriptOptimizer;
}
