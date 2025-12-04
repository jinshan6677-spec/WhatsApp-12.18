// 测试ViewManager加载
try {
  const { ViewManager } = require('../../src/presentation/windows/view-manager');
  console.log('✅ ViewManager loaded successfully');
  console.log('✅ ViewManager is a class:', typeof ViewManager === 'function');
} catch (error) {
  console.error('❌ ViewManager failed to load:', error.message);
  process.exit(1);
}

// 测试UI模块导出
try {
  const { ViewManager: UIManager } = require('../../src/ui/main-window');
  console.log('✅ UI ViewManager export loaded successfully');
  console.log('✅ UI ViewManager is same class:', UIManager === ViewManager);
} catch (error) {
  console.error('❌ UI ViewManager export failed:', error.message);
  process.exit(1);
}