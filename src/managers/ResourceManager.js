/**
 * ResourceManager - 资源管理器
 * 
 * 负责监控系统资源使用情况并提供资源限制功能
 */

const os = require('os');
const { app } = require('electron');

/**
 * @typedef {Object} SystemResources
 * @property {number} totalMemory - 总内存（MB）
 * @property {number} usedMemory - 已用内存（MB）
 * @property {number} freeMemory - 可用内存（MB）
 * @property {number} memoryUsagePercent - 内存使用率（%）
 * @property {number} cpuUsage - CPU 使用率（%）
 * @property {number} processCount - 进程数量
 */

/**
 * @typedef {Object} ResourceLimits
 * @property {number} maxInstances - 最大实例数
 * @property {number} maxMemoryUsagePercent - 最大内存使用率（%）
 * @property {number} maxCpuUsagePercent - 最大 CPU 使用率（%）
 * @property {number} warningMemoryUsagePercent - 内存使用率警告阈值（%）
 * @property {number} warningCpuUsagePercent - CPU 使用率警告阈值（%）
 */

/**
 * ResourceManager 类
 */
class ResourceManager {
  /**
   * 创建资源管理器
   * @param {Object} [options] - 配置选项
   * @param {ResourceLimits} [options.limits] - 资源限制
   * @param {Function} [options.onWarning] - 警告回调函数
   * @param {Function} [options.onLimit] - 达到限制回调函数
   */
  constructor(options = {}) {
    // 资源限制配置
    this.limits = {
      maxInstances: 30,
      maxMemoryUsagePercent: 90,
      maxCpuUsagePercent: 90,
      warningMemoryUsagePercent: 75,
      warningCpuUsagePercent: 75,
      ...(options.limits || {})
    };
    
    // 回调函数
    this.onWarning = options.onWarning || null;
    this.onLimit = options.onLimit || null;
    
    // 监控定时器
    this.monitoringInterval = null;
    
    // 资源历史记录（用于计算平均值）
    this.resourceHistory = [];
    this.maxHistoryLength = 60; // 保留最近 60 次记录
    
    // 警告状态
    this.warningState = {
      memory: false,
      cpu: false
    };
    
    // 日志函数
    this.log = this._createLogger();
  }

  /**
   * 创建日志记录器
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [ResourceManager] [${level.toUpperCase()}] ${message}`;
      
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
   * 获取当前系统资源使用情况
   * @returns {Promise<SystemResources>}
   */
  async getSystemResources() {
    try {
      // 获取内存信息
      const totalMemory = os.totalmem() / (1024 * 1024); // 转换为 MB
      const freeMemory = os.freemem() / (1024 * 1024);
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;
      
      // 获取 CPU 信息
      const cpuUsage = await this._getCpuUsage();
      
      // 获取进程数量
      const processMetrics = await app.getAppMetrics();
      const processCount = processMetrics.length;
      
      return {
        totalMemory: Math.round(totalMemory),
        usedMemory: Math.round(usedMemory),
        freeMemory: Math.round(freeMemory),
        memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
        cpuUsage: Math.round(cpuUsage * 100) / 100,
        processCount
      };
    } catch (error) {
      this.log('error', 'Failed to get system resources:', error);
      return {
        totalMemory: 0,
        usedMemory: 0,
        freeMemory: 0,
        memoryUsagePercent: 0,
        cpuUsage: 0,
        processCount: 0
      };
    }
  }

  /**
   * 获取 CPU 使用率
   * @private
   * @returns {Promise<number>}
   */
  async _getCpuUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        
        const elapsedTime = (endTime - startTime) * 1000; // 转换为微秒
        const totalUsage = endUsage.user + endUsage.system;
        const cpuPercent = (totalUsage / elapsedTime) * 100;
        
        resolve(cpuPercent);
      }, 100);
    });
  }

  /**
   * 检查是否可以创建新实例
   * @param {number} currentInstanceCount - 当前实例数量
   * @returns {Promise<{allowed: boolean, reason?: string, resources?: SystemResources}>}
   */
  async canCreateInstance(currentInstanceCount) {
    // 检查实例数量限制
    if (currentInstanceCount >= this.limits.maxInstances) {
      return {
        allowed: false,
        reason: `Maximum instance limit reached: ${this.limits.maxInstances}`
      };
    }
    
    // 获取系统资源
    const resources = await this.getSystemResources();
    
    // 检查内存使用率
    if (resources.memoryUsagePercent >= this.limits.maxMemoryUsagePercent) {
      return {
        allowed: false,
        reason: `Memory usage too high: ${resources.memoryUsagePercent.toFixed(1)}% (limit: ${this.limits.maxMemoryUsagePercent}%)`,
        resources
      };
    }
    
    // 检查 CPU 使用率
    if (resources.cpuUsage >= this.limits.maxCpuUsagePercent) {
      return {
        allowed: false,
        reason: `CPU usage too high: ${resources.cpuUsage.toFixed(1)}% (limit: ${this.limits.maxCpuUsagePercent}%)`,
        resources
      };
    }
    
    // 检查是否接近警告阈值
    if (resources.memoryUsagePercent >= this.limits.warningMemoryUsagePercent) {
      this.log('warn', `Memory usage approaching limit: ${resources.memoryUsagePercent.toFixed(1)}%`);
      this._triggerWarning('memory', resources);
    }
    
    if (resources.cpuUsage >= this.limits.warningCpuUsagePercent) {
      this.log('warn', `CPU usage approaching limit: ${resources.cpuUsage.toFixed(1)}%`);
      this._triggerWarning('cpu', resources);
    }
    
    return {
      allowed: true,
      resources
    };
  }

  /**
   * 触发警告
   * @private
   * @param {string} type - 警告类型（'memory' 或 'cpu'）
   * @param {SystemResources} resources - 系统资源
   */
  _triggerWarning(type, resources) {
    // 避免重复警告
    if (this.warningState[type]) {
      return;
    }
    
    this.warningState[type] = true;
    
    if (this.onWarning) {
      this.onWarning(type, resources);
    }
  }

  /**
   * 触发限制达到事件
   * @private
   * @param {string} type - 限制类型
   * @param {SystemResources} resources - 系统资源
   */
  _triggerLimit(type, resources) {
    if (this.onLimit) {
      this.onLimit(type, resources);
    }
  }

  /**
   * 重置警告状态
   * @param {string} [type] - 警告类型，不指定则重置所有
   */
  resetWarningState(type) {
    if (type) {
      this.warningState[type] = false;
    } else {
      this.warningState = {
        memory: false,
        cpu: false
      };
    }
  }

  /**
   * 启动资源监控
   * @param {number} [interval] - 监控间隔（毫秒）
   */
  startMonitoring(interval = 10000) {
    if (this.monitoringInterval) {
      this.log('warn', 'Resource monitoring is already running');
      return;
    }
    
    this.log('info', `Starting resource monitoring (interval: ${interval}ms)`);
    
    this.monitoringInterval = setInterval(async () => {
      try {
        const resources = await this.getSystemResources();
        
        // 添加到历史记录
        this.resourceHistory.push({
          timestamp: new Date(),
          ...resources
        });
        
        // 限制历史记录长度
        if (this.resourceHistory.length > this.maxHistoryLength) {
          this.resourceHistory.shift();
        }
        
        // 检查是否超过警告阈值
        if (resources.memoryUsagePercent >= this.limits.warningMemoryUsagePercent) {
          this._triggerWarning('memory', resources);
        } else {
          this.resetWarningState('memory');
        }
        
        if (resources.cpuUsage >= this.limits.warningCpuUsagePercent) {
          this._triggerWarning('cpu', resources);
        } else {
          this.resetWarningState('cpu');
        }
        
        // 检查是否超过限制
        if (resources.memoryUsagePercent >= this.limits.maxMemoryUsagePercent) {
          this.log('error', `Memory usage exceeded limit: ${resources.memoryUsagePercent.toFixed(1)}%`);
          this._triggerLimit('memory', resources);
        }
        
        if (resources.cpuUsage >= this.limits.maxCpuUsagePercent) {
          this.log('error', `CPU usage exceeded limit: ${resources.cpuUsage.toFixed(1)}%`);
          this._triggerLimit('cpu', resources);
        }
      } catch (error) {
        this.log('error', 'Resource monitoring error:', error);
      }
    }, interval);
  }

  /**
   * 停止资源监控
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      this.log('info', 'Stopping resource monitoring');
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * 获取资源历史记录
   * @param {number} [limit] - 限制数量
   * @returns {Array}
   */
  getResourceHistory(limit) {
    if (limit) {
      return this.resourceHistory.slice(-limit);
    }
    return [...this.resourceHistory];
  }

  /**
   * 获取平均资源使用情况
   * @param {number} [minutes] - 时间范围（分钟）
   * @returns {Object}
   */
  getAverageResources(minutes = 5) {
    if (this.resourceHistory.length === 0) {
      return null;
    }
    
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - minutes * 60 * 1000);
    
    const recentHistory = this.resourceHistory.filter(
      record => record.timestamp >= cutoffTime
    );
    
    if (recentHistory.length === 0) {
      return null;
    }
    
    const sum = recentHistory.reduce((acc, record) => ({
      memoryUsagePercent: acc.memoryUsagePercent + record.memoryUsagePercent,
      cpuUsage: acc.cpuUsage + record.cpuUsage,
      processCount: acc.processCount + record.processCount
    }), { memoryUsagePercent: 0, cpuUsage: 0, processCount: 0 });
    
    const count = recentHistory.length;
    
    return {
      memoryUsagePercent: Math.round((sum.memoryUsagePercent / count) * 100) / 100,
      cpuUsage: Math.round((sum.cpuUsage / count) * 100) / 100,
      processCount: Math.round(sum.processCount / count),
      sampleCount: count,
      timeRange: minutes
    };
  }

  /**
   * 获取资源使用趋势
   * @returns {Object}
   */
  getResourceTrend() {
    if (this.resourceHistory.length < 2) {
      return {
        memory: 'stable',
        cpu: 'stable'
      };
    }
    
    const recent = this.resourceHistory.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];
    
    const memoryDiff = last.memoryUsagePercent - first.memoryUsagePercent;
    const cpuDiff = last.cpuUsage - first.cpuUsage;
    
    return {
      memory: memoryDiff > 5 ? 'increasing' : memoryDiff < -5 ? 'decreasing' : 'stable',
      cpu: cpuDiff > 5 ? 'increasing' : cpuDiff < -5 ? 'decreasing' : 'stable',
      memoryChange: Math.round(memoryDiff * 100) / 100,
      cpuChange: Math.round(cpuDiff * 100) / 100
    };
  }

  /**
   * 清除资源历史记录
   */
  clearHistory() {
    this.resourceHistory = [];
    this.log('info', 'Resource history cleared');
  }

  /**
   * 更新资源限制
   * @param {Partial<ResourceLimits>} newLimits - 新的限制配置
   */
  updateLimits(newLimits) {
    this.limits = {
      ...this.limits,
      ...newLimits
    };
    this.log('info', 'Resource limits updated:', this.limits);
  }

  /**
   * 获取当前资源限制
   * @returns {ResourceLimits}
   */
  getLimits() {
    return { ...this.limits };
  }

  /**
   * 获取推荐的最大实例数
   * @returns {Promise<number>}
   */
  async getRecommendedMaxInstances() {
    const resources = await this.getSystemResources();
    
    // 假设每个实例平均使用 200MB 内存
    const avgMemoryPerInstance = 200;
    
    // 计算基于可用内存的最大实例数
    const maxByMemory = Math.floor(
      (resources.freeMemory * 0.8) / avgMemoryPerInstance
    );
    
    // 考虑 CPU 核心数
    const cpuCores = os.cpus().length;
    const maxByCpu = cpuCores * 4; // 每个核心最多 4 个实例
    
    // 取较小值
    const recommended = Math.min(maxByMemory, maxByCpu, this.limits.maxInstances);
    
    this.log('info', `Recommended max instances: ${recommended} (memory: ${maxByMemory}, cpu: ${maxByCpu})`);
    
    return Math.max(1, recommended);
  }
}

module.exports = ResourceManager;
