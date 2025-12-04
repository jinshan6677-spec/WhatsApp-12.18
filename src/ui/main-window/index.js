/**
 * UI主窗口模块统一导出
 * 
 * 重构说明：ViewManager已重构为模块化设计
 * 新的模块化实现位于 src/presentation/windows/view-manager/
 * 此模块提供向后兼容的导出接口
 */

// 导入新的模块化ViewManager实现
const viewManagerModule = require('../../presentation/windows/view-manager');

// 保留旧的独立模块（向后兼容）
const LegacyViewBoundsManager = require('./ViewBoundsManager');
const LegacyViewMemoryManager = require('./ViewMemoryManager');

module.exports = {
  // 新的模块化ViewManager
  ViewManager: viewManagerModule.ViewManager,
  
  // 新的子模块
  ViewFactory: viewManagerModule.ViewFactory,
  ViewLifecycle: viewManagerModule.ViewLifecycle,
  ViewBoundsManager: viewManagerModule.ViewBoundsManager,
  ViewResizeHandler: viewManagerModule.ViewResizeHandler,
  ViewMemoryManager: viewManagerModule.ViewMemoryManager,
  ViewPerformanceOptimizer: viewManagerModule.ViewPerformanceOptimizer,
  ViewTranslationIntegration: viewManagerModule.ViewTranslationIntegration,
  
  // 旧的独立模块（向后兼容）
  LegacyViewBoundsManager,
  LegacyViewMemoryManager,
  
  // 工厂方法
  createViewManager: (mainWindow, sessionManager, options) => 
    viewManagerModule.createViewManager(mainWindow, sessionManager, options),
  createViewBoundsManager: (mainWindow, options) => 
    new LegacyViewBoundsManager(mainWindow, options),
  createViewMemoryManager: (options) => 
    new LegacyViewMemoryManager(options)
};
