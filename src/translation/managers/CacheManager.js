/**
 * 缓存管理器
 * 使用 LRU 缓存和文件系统持久化存储
 */

const { LRUCache } = require('lru-cache');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class CacheManager {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 7 * 24 * 60 * 60 * 1000; // 7 days

    // LRU 内存缓存
    this.cache = new LRUCache({
      max: this.maxSize,
      ttl: this.ttl,
      updateAgeOnGet: true
    });

    // 文件系统持久化缓存
    try {
      this.cacheDir = path.join(app.getPath('userData'), 'translation-cache');
      this.initCacheDir();
    } catch (error) {
      console.warn('[CacheManager] Could not initialize cache directory:', error.message);
      this.cacheDir = null;
    }

    // 统计信息
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };
  }

  /**
   * 初始化缓存目录
   */
  initCacheDir() {
    if (!this.cacheDir) return;

    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (error) {
      console.error('[CacheManager] Failed to create cache directory:', error);
    }
  }

  /**
   * 生成缓存键
   * @param {string} text - 文本
   * @param {string} sourceLang - 源语言
   * @param {string} targetLang - 目标语言
   * @param {string} engine - 引擎名称
   * @param {string} accountId - 账号ID (可选，用于账号隔离)
   * @returns {string} 缓存键
   */
  generateKey(text, sourceLang, targetLang, engine, accountId = null) {
    // Include accountId in cache key for per-account isolation
    const content = accountId
      ? `${accountId}:${text}:${sourceLang}:${targetLang}:${engine}`
      : `${text}:${sourceLang}:${targetLang}:${engine}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {Promise<Object|null>} 缓存结果
   */
  async get(key) {
    // 先查内存缓存
    const memCached = this.cache.get(key);
    if (memCached) {
      this.stats.hits++;
      return memCached;
    }

    // 查询文件缓存
    if (!this.cacheDir) {
      this.stats.misses++;
      return null;
    }

    try {
      const cacheFile = path.join(this.cacheDir, `${key}.json`);

      if (fs.existsSync(cacheFile)) {
        const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        const cutoffTime = Date.now() - this.ttl;

        if (data.created_at > cutoffTime) {
          // 更新访问时间
          data.accessed_at = Date.now();
          data.access_count = (data.access_count || 0) + 1;
          fs.writeFileSync(cacheFile, JSON.stringify(data));

          const result = {
            translatedText: data.translated_text,
            detectedLang: data.source_lang,
            engineUsed: data.engine
          };

          // 放入内存缓存
          this.cache.set(key, result);
          this.stats.hits++;

          return result;
        } else {
          // 过期，删除文件
          fs.unlinkSync(cacheFile);
        }
      }
    } catch (error) {
      console.error('Cache get error:', error);
    }

    this.stats.misses++;
    return null;
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {Object} value - 缓存值
   * @param {string} accountId - 账号ID (可选，用于账号隔离)
   */
  async set(key, value, accountId = null) {
    // 设置内存缓存
    this.cache.set(key, value);
    this.stats.sets++;

    // 持久化到文件
    if (!this.cacheDir) return;

    try {
      const cacheFile = path.join(this.cacheDir, `${key}.json`);
      const now = Date.now();

      const data = {
        cache_key: key,
        account_id: accountId, // Store accountId for per-account cache management
        translated_text: value.translatedText,
        source_lang: value.detectedLang || 'auto',
        target_lang: value.targetLang || 'unknown',
        engine: value.engineUsed || 'unknown',
        created_at: now,
        accessed_at: now,
        access_count: 1
      };

      fs.writeFileSync(cacheFile, JSON.stringify(data));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanup() {
    if (!this.cacheDir) return;

    try {
      const cutoffTime = Date.now() - this.ttl;
      const files = fs.readdirSync(this.cacheDir);
      let cleanedCount = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          try {
            // 优化：只读取文件元数据，不读取文件内容
            const stats = fs.statSync(filePath);
            // 使用修改时间作为最后访问时间的近似值
            // 注意：这假设文件被访问时会更新 mtime (在 get 方法中确实有写回操作)
            if (stats.mtimeMs < cutoffTime) {
              fs.unlinkSync(filePath);
              cleanedCount++;
            }
          } catch (error) {
            // 如果获取状态失败或删除失败，尝试直接删除（可能是损坏的文件）
            try {
              fs.unlinkSync(filePath);
              cleanedCount++;
            } catch (e) {
              // 忽略无法删除的文件
            }
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`[CacheManager] Cleaned up ${cleanedCount} expired cache entries`);
      }
    } catch (error) {
      console.error('[CacheManager] Cache cleanup error:', error);
    }
  }

  /**
   * 清空所有缓存
   */
  async clear() {
    this.cache.clear();

    if (!this.cacheDir) return;

    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }
      console.log('All cache cleared');
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * 清除特定账号的缓存
   * @param {string} accountId - 账号ID
   */
  async clearByAccount(accountId) {
    if (!accountId) {
      throw new Error('Account ID is required to clear account cache');
    }

    console.log(`[CacheManager] Clearing cache for account ${accountId}`);

    // Clear from memory cache - need to iterate and remove matching keys
    const keysToDelete = [];
    for (const [key, value] of this.cache.entries()) {
      // Check if this cache entry belongs to the account
      // We need to check the file to get the accountId
      if (this.cacheDir) {
        try {
          const cacheFile = path.join(this.cacheDir, `${key}.json`);
          if (fs.existsSync(cacheFile)) {
            const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            if (data.account_id === accountId) {
              keysToDelete.push(key);
            }
          }
        } catch (error) {
          // Ignore errors for individual files
        }
      }
    }

    // Delete from memory cache
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    // Clear from file cache
    if (!this.cacheDir) {
      console.log(`[CacheManager] Cleared ${keysToDelete.length} memory cache entries for account ${accountId}`);
      return;
    }

    try {
      const files = fs.readdirSync(this.cacheDir);
      let deletedCount = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data.account_id === accountId) {
              fs.unlinkSync(filePath);
              deletedCount++;
            }
          } catch (error) {
            // Ignore errors for individual files
          }
        }
      }

      console.log(`[CacheManager] Cleared ${deletedCount} file cache entries for account ${accountId}`);
    } catch (error) {
      console.error(`[CacheManager] Error clearing cache for account ${accountId}:`, error);
    }
  }

  /**
   * 清除翻译历史（隐私保护）
   * 删除所有缓存数据和统计信息
   */
  async clearTranslationHistory() {
    console.log('[CacheManager] Clearing translation history for privacy...');

    // 清空内存缓存
    this.cache.clear();

    // 清空文件缓存
    if (this.cacheDir) {
      try {
        const files = fs.readdirSync(this.cacheDir);
        let deletedCount = 0;

        for (const file of files) {
          const filePath = path.join(this.cacheDir, file);
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
          } catch (error) {
            console.error(`Failed to delete ${file}:`, error.message);
          }
        }

        console.log(`[CacheManager] Deleted ${deletedCount} cache files`);
      } catch (error) {
        console.error('[CacheManager] Failed to clear translation history:', error);
      }
    }

    // 重置统计信息
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };

    console.log('[CacheManager] Translation history cleared successfully');
  }

  /**
   * 获取缓存数据大小（用于隐私报告）
   * @returns {Object} 缓存大小信息
   */
  getCacheSize() {
    let totalSize = 0;
    let fileCount = 0;

    if (this.cacheDir) {
      try {
        const files = fs.readdirSync(this.cacheDir);

        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(this.cacheDir, file);
            const stats = fs.statSync(filePath);
            totalSize += stats.size;
            fileCount++;
          }
        }
      } catch (error) {
        console.error('[CacheManager] Failed to get cache size:', error);
      }
    }

    return {
      totalBytes: totalSize,
      totalMB: (totalSize / (1024 * 1024)).toFixed(2),
      fileCount,
      memoryEntries: this.cache.size
    };
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    let fileCount = 0;
    if (this.cacheDir) {
      try {
        const files = fs.readdirSync(this.cacheDir);
        fileCount = files.filter(f => f.endsWith('.json')).length;
      } catch (error) {
        console.error('Get stats error:', error);
      }
    }

    return {
      memorySize: this.cache.size,
      fileCount,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * 关闭（清理资源）
   */
  close() {
    // 文件系统不需要关闭连接
    this.cache.clear();
  }
}

module.exports = CacheManager;
