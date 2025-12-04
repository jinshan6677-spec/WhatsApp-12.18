// 测试bootstrap加载
try {
  const { initializeApp } = require('./src/app/bootstrap');
  console.log('✅ Bootstrap module loaded successfully');
  console.log('✅ initializeApp function is available:', typeof initializeApp === 'function');
} catch (error) {
  console.error('❌ Bootstrap failed to load:', error.message);
  process.exit(1);
}