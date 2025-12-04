/**
 * 共享工具类统一导出
 * 
 * 提供所有共享工具类的统一导入接口
 * 避免使用复杂的相对路径引用
 */

// 引入工具类
const { UnifiedErrorHandler, getErrorHandler, createErrorHandler } = require('./ErrorHandler');
const ErrorLogger = require('../../utils/ErrorLogger');
const OrphanedDataCleaner = require('../../utils/OrphanedDataCleaner');
const PasswordEncryption = require('../../utils/PasswordEncryption');
const PerformanceOptimizer = require('../../utils/PerformanceOptimizer');
const RecoveryManager = require('../../utils/RecoveryManager');
const ValidationHelper = require('../../utils/ValidationHelper');

// 导出统一接口
module.exports = {
  // 错误处理工具
  ErrorHandler: UnifiedErrorHandler,
  UnifiedErrorHandler,
  ErrorLogger,
  RecoveryManager,
  
  // 数据处理工具
  OrphanedDataCleaner,
  PasswordEncryption,
  
  // 性能优化工具
  PerformanceOptimizer,
  
  // 验证工具
  ValidationHelper,
  
  // 便捷方法
  getErrorLogger: () => ErrorLogger.getErrorLogger(),
  getErrorHandler,
  createErrorHandler,
  createOrphanedDataCleaner: () => new OrphanedDataCleaner(),
  createRecoveryManager: () => new RecoveryManager(),
  
  // 常量
  ErrorLevel: ErrorLogger.ErrorLevel,
  ErrorCategory: ErrorLogger.ErrorCategory
};
