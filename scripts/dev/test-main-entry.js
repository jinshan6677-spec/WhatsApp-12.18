// 测试主入口点加载
try {
  require('./src/main-refactored.js');
  console.log('✅ Main entry point loaded successfully');
} catch (error) {
  console.error('❌ Main entry point failed to load:', error.message);
  process.exit(1);
}