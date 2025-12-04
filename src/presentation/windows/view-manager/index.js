/**
 * View Manager Module - 视图管理模块
 * 
 * 将原 ViewManager.js (4096行) 拆分为多个专注的模块：
 * - ViewFactory: 视图创建
 * - ViewLifecycle: 生命周期管理（创建、销毁、重载）
 * - ViewBoundsManager: 边界计算和布局管理
 * - ViewResizeHandler: 窗口大小调整处理
 * - ViewMemoryManager: 内存管理
 * - ViewPerformanceOptimizer: 性能优化
 * - ViewTranslationIntegration: 翻译集成
 * - ViewManager: 主协调器（500行以下）
 * 
 * @module presentation/windows/view-manager
 */

// Lazy load modules to avoid circular dependencies
let _ViewFactory, _ViewLifecycle, _ViewBoundsManager, _ViewResizeHandler;
let _ViewMemoryManager, _ViewPerformanceOptimizer, _ViewTranslationIntegration;
let _ViewManager;

function getViewFactory() {
  if (!_ViewFactory) _ViewFactory = require('./ViewFactory');
  return _ViewFactory;
}

function getViewLifecycle() {
  if (!_ViewLifecycle) _ViewLifecycle = require('./ViewLifecycle');
  return _ViewLifecycle;
}

function getViewBoundsManager() {
  if (!_ViewBoundsManager) _ViewBoundsManager = require('./ViewBoundsManager');
  return _ViewBoundsManager;
}

function getViewResizeHandler() {
  if (!_ViewResizeHandler) _ViewResizeHandler = require('./ViewResizeHandler');
  return _ViewResizeHandler;
}

function getViewMemoryManager() {
  if (!_ViewMemoryManager) _ViewMemoryManager = require('./ViewMemoryManager');
  return _ViewMemoryManager;
}

function getViewPerformanceOptimizer() {
  if (!_ViewPerformanceOptimizer) _ViewPerformanceOptimizer = require('./ViewPerformanceOptimizer');
  return _ViewPerformanceOptimizer;
}


function getViewTranslationIntegration() {
  if (!_ViewTranslationIntegration) _ViewTranslationIntegration = require('./ViewTranslationIntegration');
  return _ViewTranslationIntegration;
}

 

function getViewManager() {
  if (!_ViewManager) _ViewManager = require('./ViewManager');
  return _ViewManager;
}

// Export using getters for lazy loading
module.exports = {
  // 主类 (getter for lazy loading)
  get ViewManager() { return getViewManager(); },
  
  // 子模块 (getters for lazy loading)
  get ViewFactory() { return getViewFactory(); },
  get ViewLifecycle() { return getViewLifecycle(); },
  get ViewBoundsManager() { return getViewBoundsManager(); },
  get ViewResizeHandler() { return getViewResizeHandler(); },
  get ViewMemoryManager() { return getViewMemoryManager(); },
  get ViewPerformanceOptimizer() { return getViewPerformanceOptimizer(); },
  get ViewTranslationIntegration() { return getViewTranslationIntegration(); },
  
  
  // 工厂方法
  createViewManager: (mainWindow, sessionManager, options = {}) => {
    const ViewManager = getViewManager();
    return new ViewManager(mainWindow, sessionManager, options);
  }
};
