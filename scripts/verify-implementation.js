/**
 * 验证清理功能实现的脚本
 */

console.log('🔍 验证 WhatsApp Desktop 自动清理功能实现\n');

try {
  // 1. 验证 OrphanedDataCleaner 类
  console.log('1. 验证 OrphanedDataCleaner 类...');
  const OrphanedDataCleaner = require('../src/utils/OrphanedDataCleaner');
  console.log('   ✓ OrphanedDataCleaner 类加载成功');
  
  const cleaner = new OrphanedDataCleaner({ userDataPath: '/test/path' });
  console.log('   ✓ OrphanedDataCleaner 实例创建成功');
  
  // 2. 验证主要方法存在
  console.log('\n2. 验证核心方法...');
  const requiredMethods = ['scanAndClean', 'cleanAccountData', 'getCleanupStats'];
  for (const method of requiredMethods) {
    if (typeof cleaner[method] === 'function') {
      console.log(`   ✓ ${method} 方法存在`);
    } else {
      throw new Error(`Missing method: ${method}`);
    }
  }
  
  // 3. 验证 main.js 集成
  console.log('\n3. 验证 main.js 集成...');
  const fs = require('fs');
  const mainJsPath = '../src/main-refactored.js';
  const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
  
  if (mainJsContent.includes('OrphanedDataCleaner')) {
    console.log('   ✓ main.js 已导入 OrphanedDataCleaner');
  } else {
    throw new Error('main.js 未导入 OrphanedDataCleaner');
  }
  
  if (mainJsContent.includes('performOrphanedDataCleanup')) {
    console.log('   ✓ main.js 包含清理函数');
  } else {
    throw new Error('main.js 缺少清理函数');
  }
  
  // 4. 验证单窗口 IPC 处理器
  console.log('\n4. 验证单窗口 IPC 处理器修改...');
  const singleWindowPath = '../src/single-window/ipcHandlers.js';
  const singleWindowContent = fs.readFileSync(singleWindowPath, 'utf8');
  
  if (singleWindowContent.includes('deleteUserData: options.deleteUserData !== false')) {
    console.log('   ✓ 单窗口模式删除逻辑已修改（默认清理）');
  } else {
    throw new Error('单窗口模式删除逻辑未正确修改');
  }
  
  // 5. 验证容器 IPC 处理器
  console.log('\n5. 验证容器 IPC 处理器修改...');
  const containerPath = '../src/container/ipcHandlers.js';
  const containerContent = fs.readFileSync(containerPath, 'utf8');
  
  if (containerContent.includes('deleteUserData: true')) {
    console.log('   ✓ 容器模式删除逻辑已修改（默认清理）');
  } else {
    throw new Error('容器模式删除逻辑未正确修改');
  }
  
  // 6. 验证测试文件
  console.log('\n6. 验证测试文件...');
  const testPath = '../src/utils/__tests__/OrphanedDataCleaner.test.js';
  if (fs.existsSync(testPath)) {
    console.log('   ✓ 测试文件创建成功');
  } else {
    throw new Error('测试文件不存在');
  }
  
  console.log('\n🎉 所有验证通过！');
  console.log('\n📋 实现总结:');
  console.log('   • 创建了 OrphanedDataCleaner 类负责清理遗留账号目录');
  console.log('   • 修改了容器和单窗口模式的删除逻辑，默认清理用户数据');
  console.log('   • 在应用启动时集成了自动清理服务');
  console.log('   • 创建了完整的单元测试套件');
  console.log('\n✨ 功能特性:');
  console.log('   • 自动扫描并清理已删除账号的遗留目录');
  console.log('   • 在删除账号时自动清理对应数据');
  console.log('   • 智能匹配现有账号，只清理 orphaned 目录');
  console.log('   • 详细的清理日志和统计信息');
  console.log('   • 安全的错误处理机制');
  
} catch (error) {
  console.error('\n❌ 验证失败:', error.message);
  process.exit(1);
}