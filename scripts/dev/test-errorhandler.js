// 测试ErrorHandler加载
try {
  const { getErrorHandler, UnifiedErrorHandler } = require('./src/shared/utils/ErrorHandler');
  console.log('✅ UnifiedErrorHandler loaded successfully');
  console.log('✅ getErrorHandler function available:', typeof getErrorHandler === 'function');
  console.log('✅ UnifiedErrorHandler class available:', typeof UnifiedErrorHandler === 'function');
  
  // 测试错误处理器实例化
  const errorHandler = getErrorHandler();
  console.log('✅ ErrorHandler instance created successfully');
} catch (error) {
  console.error('❌ ErrorHandler failed to load:', error.message);
  process.exit(1);
}