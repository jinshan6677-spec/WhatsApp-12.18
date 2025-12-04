/**
 * 应用常量统一导出
 * 
 * 提供所有应用常量的统一导入接口
 */

// 引入所有常量
const APP_CONSTANTS = require('./app');

module.exports = {
  ...APP_CONSTANTS,
  
  // 便捷方法
  getAppInfo: () => APP_CONSTANTS.APP_INFO,
  getPaths: () => APP_CONSTANTS.PATHS,
  getWindowConfig: () => APP_CONSTANTS.WINDOW_CONFIG,
  getAccountConfig: () => APP_CONSTANTS.ACCOUNT_CONFIG,
  getTranslationConfig: () => APP_CONSTANTS.TRANSLATION_CONFIG,
  getErrorCodes: () => APP_CONSTANTS.ERROR_CODES,
  getEvents: () => APP_CONSTANTS.EVENTS,
  getPerformanceConfig: () => APP_CONSTANTS.PERFORMANCE_CONFIG
};
