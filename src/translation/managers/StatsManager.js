/**
 * 统计管理器
 * 记录和管理翻译统计数据
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class StatsManager {
  constructor() {
    try {
      this.statsFile = path.join(app.getPath('userData'), 'translation-stats.json');
    } catch (error) {
      console.warn('[StatsManager] Could not get userData path:', error.message);
      this.statsFile = null;
    }
    this.stats = this.loadStats();
  }

  /**
   * 加载统计数据
   * @returns {Object} 统计数据
   */
  loadStats() {
    if (!this.statsFile) {
      return this.getDefaultStats();
    }

    try {
      if (fs.existsSync(this.statsFile)) {
        const data = fs.readFileSync(this.statsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }

    return this.getDefaultStats();
  }

  /**
   * 获取默认统计数据
   * @returns {Object} 默认统计
   */
  getDefaultStats() {
    return {
      daily: {},
      engines: {},
      total: {
        requests: 0,
        success: 0,
        failure: 0,
        chars: 0
      }
    };
  }

  /**
   * 保存统计数据
   */
  saveStats() {
    if (!this.statsFile) return;

    try {
      fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
    } catch (error) {
      console.error('Failed to save stats:', error);
    }
  }

  /**
   * 记录翻译请求
   * @param {string} engineName - 引擎名称
   * @param {boolean} success - 是否成功
   * @param {number} charCount - 字符数
   * @param {number} responseTime - 响应时间（毫秒）
   */
  recordTranslation(engineName, success, charCount, responseTime) {
    const today = new Date().toISOString().split('T')[0];

    // 初始化今日统计
    if (!this.stats.daily[today]) {
      this.stats.daily[today] = {
        requests: 0,
        success: 0,
        failure: 0,
        chars: 0,
        avgResponseTime: 0,
        engines: {}
      };
    }

    // 初始化引擎统计
    if (!this.stats.engines[engineName]) {
      this.stats.engines[engineName] = {
        requests: 0,
        success: 0,
        failure: 0,
        chars: 0,
        avgResponseTime: 0
      };
    }

    if (!this.stats.daily[today].engines[engineName]) {
      this.stats.daily[today].engines[engineName] = {
        requests: 0,
        success: 0,
        failure: 0
      };
    }

    // 更新统计
    this.stats.total.requests++;
    this.stats.daily[today].requests++;
    this.stats.engines[engineName].requests++;
    this.stats.daily[today].engines[engineName].requests++;

    if (success) {
      this.stats.total.success++;
      this.stats.daily[today].success++;
      this.stats.engines[engineName].success++;
      this.stats.daily[today].engines[engineName].success++;
      
      this.stats.total.chars += charCount;
      this.stats.daily[today].chars += charCount;
      this.stats.engines[engineName].chars += charCount;

      // 更新平均响应时间
      const engineStats = this.stats.engines[engineName];
      engineStats.avgResponseTime = 
        (engineStats.avgResponseTime * (engineStats.success - 1) + responseTime) / engineStats.success;

      const dailyStats = this.stats.daily[today];
      dailyStats.avgResponseTime = 
        (dailyStats.avgResponseTime * (dailyStats.success - 1) + responseTime) / dailyStats.success;
    } else {
      this.stats.total.failure++;
      this.stats.daily[today].failure++;
      this.stats.engines[engineName].failure++;
      this.stats.daily[today].engines[engineName].failure++;
    }

    this.saveStats();
  }

  /**
   * 获取今日统计
   * @returns {Object} 今日统计
   */
  getTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    return this.stats.daily[today] || {
      requests: 0,
      success: 0,
      failure: 0,
      chars: 0,
      avgResponseTime: 0,
      engines: {}
    };
  }

  /**
   * 获取引擎统计
   * @param {string} engineName - 引擎名称
   * @returns {Object} 引擎统计
   */
  getEngineStats(engineName) {
    return this.stats.engines[engineName] || {
      requests: 0,
      success: 0,
      failure: 0,
      chars: 0,
      avgResponseTime: 0
    };
  }

  /**
   * 获取总统计
   * @returns {Object} 总统计
   */
  getTotalStats() {
    return this.stats.total;
  }

  /**
   * 获取日期范围统计
   * @param {string} startDate - 开始日期 (YYYY-MM-DD)
   * @param {string} endDate - 结束日期 (YYYY-MM-DD)
   * @returns {Object} 统计数据
   */
  getDateRangeStats(startDate, endDate) {
    const result = {
      requests: 0,
      success: 0,
      failure: 0,
      chars: 0,
      engines: {}
    };

    for (const [date, stats] of Object.entries(this.stats.daily)) {
      if (date >= startDate && date <= endDate) {
        result.requests += stats.requests;
        result.success += stats.success;
        result.failure += stats.failure;
        result.chars += stats.chars;

        for (const [engine, engineStats] of Object.entries(stats.engines)) {
          if (!result.engines[engine]) {
            result.engines[engine] = { requests: 0, success: 0, failure: 0 };
          }
          result.engines[engine].requests += engineStats.requests;
          result.engines[engine].success += engineStats.success;
          result.engines[engine].failure += engineStats.failure;
        }
      }
    }

    return result;
  }

  /**
   * 清理旧数据（保留最近 30 天）
   */
  cleanup() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    for (const date in this.stats.daily) {
      if (date < cutoffStr) {
        delete this.stats.daily[date];
      }
    }

    this.saveStats();
  }

  /**
   * 重置统计
   */
  reset() {
    this.stats = {
      daily: {},
      engines: {},
      total: {
        requests: 0,
        success: 0,
        failure: 0,
        chars: 0
      }
    };
    this.saveStats();
  }
}

module.exports = StatsManager;
