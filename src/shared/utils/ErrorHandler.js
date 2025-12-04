/**
 * 统一的错误处理器
 * 
 * 合并 utils/ErrorHandler.js 和 managers/ErrorHandler.js 的功能
 * 提供统一的错误处理接口
 */

const fs = require('fs').promises;
const path = require('path');
const { getErrorLogger, ErrorLevel, ErrorCategory } = require('../../utils/ErrorLogger');

/**
 * 错误处理器类型枚举
 */
const ErrorHandlerType = {
  WRAPPER: 'wrapper',    // 包装器类型（来自 utils/ErrorHandler.js）
  MANAGER: 'manager',    // 管理器类型（来自 managers/ErrorHandler.js）
  UNIFIED: 'unified'     // 统一类型
};

/**
 * 统一的错误处理器类
 */
class UnifiedErrorHandler {
  /**
   * 创建统一错误处理器
   * @param {Object} [options] - 配置选项
   * @param {string} [options.type] - 处理器类型
   * @param {Object} [options.instanceManager] - 实例管理器（管理器类型需要）
   * @param {number} [options.maxCrashCount] - 最大崩溃次数
   * @param {number} [options.crashResetTime] - 崩溃计数重置时间
   * @param {number} [options.restartDelay] - 重启延迟
   */
  constructor(options = {}) {
    const {
      type = ErrorHandlerType.UNIFIED,
      instanceManager = null,
      maxCrashCount = 3,
      crashResetTime = 5 * 60 * 1000, // 5分钟
      restartDelay = 5000 // 5秒
    } = options;

    this.type = type;
    this.instanceManager = instanceManager;
    this.maxCrashCount = maxCrashCount;
    this.crashResetTime = crashResetTime;
    this.restartDelay = restartDelay;
    
    // 崩溃计数记录
    this.crashRecords = new Map();
    
    // 错误日志记录
    this.errorLogs = [];
    
    // 获取错误日志器
    this.logger = getErrorLogger();
  }

  /**
   * 初始化错误处理器
   */
  initialize() {
    this.logger.info('UnifiedErrorHandler initialized', {
      type: this.type,
      maxCrashCount: this.maxCrashCount
    });
  }

  // ==================== 包装器功能（来自 utils/ErrorHandler.js） ====================

  /**
   * 包装异步函数
   * @param {Function} fn - 要包装的异步函数
   * @param {Object} options - 配置选项
   * @param {string} options.category - 错误类别
   * @param {string} options.operation - 操作名称
   * @param {Function} [options.onError] - 自定义错误处理器
   * @param {boolean} [options.rethrow=false] - 是否重新抛出错误
   * @returns {Function} 包装后的函数
   */
  wrapAsync(fn, options) {
    const { category, operation, onError, rethrow = false } = options;

    return async function(...args) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        // 记录错误
        await this.logger.error(
          category,
          `${operation} failed`,
          {
            operation,
            args: args.length > 0 ? args[0] : undefined,
            errorMessage: error.message
          },
          error
        );

        // 调用自定义错误处理器
        if (onError && typeof onError === 'function') {
          try {
            return await onError(error, ...args);
          } catch (handlerError) {
            await this.logger.error(
              category,
              `Error handler for ${operation} failed`,
              { errorMessage: handlerError.message },
              handlerError
            );
          }
        }

        // 如果需要重新抛出错误
        if (rethrow) {
          throw error;
        }
      }
    };
  }

  /**
   * 包装Promise
   * @param {Promise} promise - 要包装的Promise
   * @param {Object} options - 配置选项
   * @param {string} options.category - 错误类别
   * @param {string} options.operation - 操作名称
   * @param {Function} [options.onError] - 自定义错误处理器
   * @param {boolean} [options.rethrow=false] - 是否重新抛出错误
   * @returns {Promise} 包装后的Promise
   */
  wrapPromise(promise, options) {
    const { category, operation, onError, rethrow = false } = options;

    return promise.catch(async (error) => {
      // 记录错误
      await this.logger.error(
        category,
        `${operation} failed`,
        {
          operation,
          errorMessage: error.message
        },
        error
      );

      // 调用自定义错误处理器
      if (onError && typeof onError === 'function') {
        try {
          return await onError(error);
        } catch (handlerError) {
          await this.logger.error(
            category,
            `Error handler for ${operation} failed`,
            { errorMessage: handlerError.message },
            handlerError
          );
        }
      }

      // 如果需要重新抛出错误
      if (rethrow) {
        throw error;
      }
    });
  }

  /**
   * 包装IPC处理器
   * @param {Function} handler - IPC处理器函数
   * @param {Object} options - 配置选项
   * @param {string} options.channel - IPC通道名称
   * @param {string} options.category - 错误类别
   * @returns {Function} 包装后的处理器
   */
  wrapIPCHandler(handler, options) {
    const { channel, category } = options;

    return async (event, ...args) => {
      try {
        return await handler.call(this, event, ...args);
      } catch (error) {
        // 记录错误
        await this.logger.error(
          category,
          `IPC handler '${channel}' failed`,
          {
            channel,
            args: args.length > 0 ? args[0] : undefined,
            errorMessage: error.message
          },
          error
        );

        // 返回错误响应
        return {
          success: false,
          error: error.message
        };
      }
    };
  }

  // ==================== 管理器功能（来自 managers/ErrorHandler.js） ====================

  /**
   * 处理实例错误
   * @param {string} instanceId - 实例ID
   * @param {Error} error - 错误对象
   * @param {Object} [details] - 错误详情
   * @returns {Promise<boolean>} 是否应该重启实例
   */
  async handleInstanceError(instanceId, error, details = {}) {
    const timestamp = new Date();
    
    // 记录错误日志
    const errorLog = {
      timestamp,
      instanceId,
      errorType: error.constructor.name,
      message: error.message,
      details,
      stack: error.stack
    };
    
    this.errorLogs.push(errorLog);
    
    // 记录到日志系统
    await this.logger.error(
      ErrorCategory.INSTANCE,
      `Instance ${instanceId} error`,
      { instanceId, errorType: errorLog.errorType, message: errorLog.message },
      error
    );
    
    // 更新崩溃计数
    const shouldRestart = await this.updateCrashCount(instanceId, timestamp);
    
    // 如果超过最大崩溃次数，不重启
    if (!shouldRestart) {
      await this.logger.warn(
        ErrorCategory.INSTANCE,
        `Instance ${instanceId} exceeded max crash count`,
        { instanceId, maxCrashCount: this.maxCrashCount }
      );
    }
    
    return shouldRestart;
  }

  

  /**
   * 处理翻译错误
   * @param {string} engine - 翻译引擎
   * @param {Error} error - 错误对象
   * @param {Object} [details] - 错误详情
   * @returns {Promise<void>}
   */
  async handleTranslationError(engine, error, details = {}) {
    const timestamp = new Date();
    
    // 记录错误
    await this.logger.error(
      ErrorCategory.TRANSLATION,
      `Translation engine ${engine} error`,
      { engine, errorMessage: error.message, ...details },
      error
    );
  }

  /**
   * 更新崩溃计数
   * @param {string} instanceId - 实例ID
   * @param {Date} timestamp - 时间戳
   * @returns {Promise<boolean>} 是否应该重启
   */
  async updateCrashCount(instanceId, timestamp) {
    const record = this.crashRecords.get(instanceId) || {
      count: 0,
      lastCrash: null,
      startTime: timestamp
    };
    
    // 重置计数（如果距离第一次崩溃时间超过重置时间）
    if (record.startTime && (timestamp - record.startTime) > this.crashResetTime) {
      record.count = 0;
      record.startTime = timestamp;
    }
    
    // 增加崩溃计数
    record.count += 1;
    record.lastCrash = timestamp;
    
    this.crashRecords.set(instanceId, record);
    
    // 检查是否超过最大崩溃次数
    const shouldRestart = record.count <= this.maxCrashCount;
    
    if (!shouldRestart) {
      // 达到最大崩溃次数，标记为永久失败
      record.permanentFailure = true;
      this.crashRecords.set(instanceId, record);
    }
    
    return shouldRestart;
  }

  /**
   * 获取崩溃记录
   * @param {string} instanceId - 实例ID
   * @returns {Object} 崩溃记录
   */
  getCrashRecord(instanceId) {
    return this.crashRecords.get(instanceId);
  }

  /**
   * 重置崩溃计数
   * @param {string} instanceId - 实例ID
   */
  resetCrashCount(instanceId) {
    this.crashRecords.delete(instanceId);
  }

  /**
   * 获取错误统计
   * @returns {Object} 错误统计信息
   */
  getErrorStatistics() {
    const now = new Date();
    const last24Hours = this.errorLogs.filter(log => 
      (now - log.timestamp) < 24 * 60 * 60 * 1000
    );
    
    return {
      totalErrors: this.errorLogs.length,
      errorsLast24Hours: last24Hours.length,
      recentErrors: last24Hours.slice(-10),
      activeCrashRecords: Array.from(this.crashRecords.entries()).map(([id, record]) => ({
        instanceId: id,
        ...record
      }))
    };
  }

  /**
   * 清理旧的错误日志
   * @param {number} [daysToKeep=7] - 保留天数
   */
  async cleanupOldLogs(daysToKeep = 7) {
    const cutoffTime = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const originalLength = this.errorLogs.length;
    this.errorLogs = this.errorLogs.filter(log => log.timestamp > cutoffTime);
    
    const removedCount = originalLength - this.errorLogs.length;
    
    if (removedCount > 0) {
      await this.logger.info(
        ErrorCategory.SYSTEM,
        `Cleaned up ${removedCount} old error logs`,
        { removedCount, cutoffTime }
      );
    }
  }

  /**
 * 销毁错误处理器
 */
  async destroy() {
    // 清理崩溃记录
    this.crashRecords.clear();
    
    // 清理错误日志
    this.errorLogs = [];
    
    await this.logger.info('UnifiedErrorHandler destroyed');
  }

  /**
   * 设置全局错误处理器
   * @returns {Function} 清理函数
   */
  setupGlobalErrorHandlers() {
    // 处理未捕获的异常
    const uncaughtExceptionHandler = async (error) => {
      await this.handleInstanceError('main-process', error, {
        source: 'uncaughtException',
        fatal: true
      });
      
      // 给日志系统时间写入
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 退出进程
      process.exit(1);
    };

    // 处理未处理的Promise拒绝
    const unhandledRejectionHandler = async (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      
      await this.handleInstanceError('main-process', error, {
        source: 'unhandledRejection',
        reason: String(reason)
      });
      
      // 给日志系统时间写入
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 退出进程
      process.exit(1);
    };

    // 处理警告
    const warningHandler = async (warning) => {
      await this.logger.warn(
        ErrorCategory.SYSTEM,
        'Process warning',
        {
          name: warning.name,
          message: warning.message,
          stack: warning.stack
        }
      );
    };

    // 绑定事件监听器
    process.on('uncaughtException', uncaughtExceptionHandler);
    process.on('unhandledRejection', unhandledRejectionHandler);
    process.on('warning', warningHandler);

    this.logger.info('Global error handlers initialized');

    // 返回清理函数
    return () => {
      process.removeListener('uncaughtException', uncaughtExceptionHandler);
      process.removeListener('unhandledRejection', unhandledRejectionHandler);
      process.removeListener('warning', warningHandler);
      
      this.logger.info('Global error handlers removed');
    };
  }
}

// 便捷创建函数
function createErrorHandler(options = {}) {
  return new UnifiedErrorHandler(options);
}

// 单例实例
let singletonInstance = null;

function getErrorHandler(options = {}) {
  if (!singletonInstance) {
    singletonInstance = createErrorHandler(options);
  }
  return singletonInstance;
}

// 装饰器函数（兼容原有 utils/ErrorHandler.js 的使用方式）
function wrapAsync(fn, options) {
  const handler = getErrorHandler();
  return handler.wrapAsync(fn, options);
}

// 导出统一接口
module.exports = {
  UnifiedErrorHandler,
  ErrorHandlerType,
  createErrorHandler,
  getErrorHandler,
  wrapAsync,
  
  // 向后兼容
  wrapper: {
    wrapAsync
  }
};
