// 测试DependencyContainer加载
try {
  const { getGlobalContainer, DependencyContainer } = require('./src/app/DependencyContainer');
  console.log('✅ DependencyContainer loaded successfully');
  console.log('✅ getGlobalContainer function available:', typeof getGlobalContainer === 'function');
  console.log('✅ DependencyContainer class available:', typeof DependencyContainer === 'function');
  
  // 测试容器实例化
  const container = getGlobalContainer();
  console.log('✅ Global container instance created successfully');
  console.log('✅ Container has registerSingleton method:', typeof container.registerSingleton === 'function');
  console.log('✅ Container has registerFactory method:', typeof container.registerFactory === 'function');
  console.log('✅ Container has resolve method:', typeof container.resolve === 'function');
} catch (error) {
  console.error('❌ DependencyContainer failed to load:', error.message);
  process.exit(1);
}