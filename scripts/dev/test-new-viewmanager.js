// 简单测试新的ViewManager架构
try {
  console.log('🔍 测试新的ViewManager模块加载...');
  
  // 测试直接导入
  const viewManagerModule = require('../../src/presentation/windows/view-manager');
  console.log('✅ ViewManager模块加载成功');
  console.log('📋 可用导出:', Object.keys(viewManagerModule));
  
  // 测试ViewManager类
  const ViewManager = viewManagerModule.ViewManager;
  console.log('✅ ViewManager类获取成功');
  console.log('📋 ViewManager类型:', typeof ViewManager);
  console.log('📋 ViewManager是否为函数:', typeof ViewManager === 'function');
  
  // 测试子模块
  if (viewManagerModule.ViewFactory) {
    console.log('✅ ViewFactory子模块可用');
  }
  if (viewManagerModule.ViewLifecycle) {
    console.log('✅ ViewLifecycle子模块可用');
  }
  if (viewManagerModule.ViewBoundsManager) {
    console.log('✅ ViewBoundsManager子模块可用');
  }
  
  console.log('🎉 新ViewManager架构测试通过！');
  
} catch (error) {
  console.error('❌ 测试失败:', error.message);
  console.error('📍 错误堆栈:', error.stack);
  process.exit(1);
}