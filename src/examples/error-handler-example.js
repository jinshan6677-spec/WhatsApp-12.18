/**
 * ErrorHandler 使用示例
 * 
 * 演示如何使用 ErrorHandler 处理实例错误和崩溃
 */

const { app } = require('electron');
const path = require('path');
const InstanceManager = require('../managers/InstanceManager');
const { UnifiedErrorHandler } = require('../shared/utils/ErrorHandler');
const AccountConfig = require('../models/AccountConfig');

/**
 * 示例：创建带有错误处理的实例管理器
 */
async function exampleWithErrorHandler() {
  console.log('=== ErrorHandler 使用示例 ===\n');
  
  // 1. 创建实例管理器
  const instanceManager = new InstanceManager({
    userDataPath: app.getPath('userData'),
    maxInstances: 30
  });
  
  // 2. 创建错误处理器
  const errorHandler = new UnifiedErrorHandler({
    instanceManager,
    maxCrashCount: 3,           // 最大崩溃次数
    crashResetTime: 300000,     // 5 分钟内的崩溃计数
    restartDelay: 5000,         // 重启延迟 5 秒
    logPath: path.join(app.getPath('userData'), 'logs', 'errors.log')
  });
  
  // 3. 将错误处理器关联到实例管理器
  instanceManager.errorHandler = errorHandler;
  
  console.log('✓ 错误处理器已创建并关联到实例管理器\n');
  
  // 4. 创建测试账号
  const testAccount = new AccountConfig({
    name: 'Test Account with Error Handling',
    translation: {
      enabled: false
    }
  });
  
  console.log(`创建测试账号: ${testAccount.name} (${testAccount.id})\n`);
  
  // 5. 创建实例
  console.log('创建实例...');
  const result = await instanceManager.createInstance(testAccount);
  
  if (result.success) {
    console.log(`✓ 实例创建成功: ${result.instanceId}\n`);
    
    // 6. 获取实例状态
    const status = instanceManager.getInstanceStatus(result.instanceId);
    console.log('实例状态:', {
      status: status.status,
      pid: status.pid,
      crashCount: status.crashCount,
      memoryUsage: `${status.memoryUsage} MB`,
      cpuUsage: `${status.cpuUsage}%`
    });
    console.log();
    
    // 7. 模拟崩溃场景（仅用于演示）
    console.log('=== 崩溃处理演示 ===\n');
    
    // 手动触发崩溃处理（实际场景中由 Electron 事件触发）
    console.log('模拟第 1 次崩溃...');
    await errorHandler.handleInstanceCrash(
      result.instanceId,
      new Error('Simulated crash'),
      false
    );
    
    // 获取崩溃统计
    let crashStats = errorHandler.getCrashStats(result.instanceId);
    console.log('崩溃统计:', crashStats);
    console.log();
    
    // 等待一段时间
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('模拟第 2 次崩溃...');
    await errorHandler.handleInstanceCrash(
      result.instanceId,
      new Error('Simulated crash'),
      false
    );
    
    crashStats = errorHandler.getCrashStats(result.instanceId);
    console.log('崩溃统计:', crashStats);
    console.log();
    
    // 8. 获取实例健康状态
    console.log('=== 健康检查 ===\n');
    const health = await instanceManager.getInstanceHealth(result.instanceId);
    console.log('实例健康状态:', {
      healthy: health.healthy,
      status: health.status?.status,
      issues: health.issues
    });
    console.log();
    
    // 9. 读取错误日志
    console.log('=== 错误日志 ===\n');
    const errorLogs = await errorHandler.readErrorLogs({
      instanceId: result.instanceId,
      limit: 10
    });
    
    console.log(`找到 ${errorLogs.length} 条错误日志:`);
    errorLogs.forEach((log, index) => {
      console.log(`${index + 1}. [${log.errorType}] ${log.message}`);
      console.log(`   时间: ${log.timestamp.toISOString()}`);
    });
    console.log();
    
    // 10. 获取所有实例的健康状态摘要
    console.log('=== 所有实例健康状态摘要 ===\n');
    const healthSummary = await instanceManager.getAllInstancesHealth();
    console.log('健康状态摘要:', healthSummary);
    console.log();
    
    // 11. 清理
    console.log('清理实例...');
    await instanceManager.destroyInstance(result.instanceId);
    console.log('✓ 实例已销毁\n');
    
  } else {
    console.error('✗ 实例创建失败:', result.error);
  }
  
  // 停止监控
  instanceManager.stopGlobalMonitoring();
  
  console.log('=== 示例完成 ===');
}

/**
 * 示例：处理不同类型的错误
 */
async function exampleErrorTypes() {
  console.log('\n=== 不同错误类型处理示例 ===\n');
  
  const instanceManager = new InstanceManager();
  const errorHandler = new UnifiedErrorHandler({
    instanceManager,
    logPath: path.join(app.getPath('userData'), 'logs', 'errors.log')
  });
  
  const testInstanceId = 'test-instance-123';
  
  
  
  // 2. 翻译错误
  console.log('2. 处理翻译错误...');
  await errorHandler.handleTranslationError(
    testInstanceId,
    new Error('Translation API key invalid')
  );
  console.log('✓ 翻译错误已记录\n');
  
  // 3. 页面加载错误
  console.log('3. 处理页面加载错误...');
  await errorHandler.handlePageLoadError(
    testInstanceId,
    -106,
    'ERR_INTERNET_DISCONNECTED'
  );
  console.log('✓ 页面加载错误已记录\n');
  
  // 4. 实例无响应
  console.log('4. 处理实例无响应...');
  await errorHandler.handleInstanceUnresponsive(testInstanceId);
  console.log('✓ 无响应错误已记录\n');
  
  // 读取所有错误日志
  const allLogs = await errorHandler.readErrorLogs({ limit: 20 });
  console.log(`总共记录了 ${allLogs.length} 条错误日志\n`);
  
  // 按错误类型分组
  const logsByType = {};
  allLogs.forEach(log => {
    if (!logsByType[log.errorType]) {
      logsByType[log.errorType] = 0;
    }
    logsByType[log.errorType]++;
  });
  
  console.log('错误类型统计:');
  Object.entries(logsByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  console.log();
}

/**
 * 示例：崩溃计数和自动重启
 */
async function exampleCrashCountAndRestart() {
  console.log('\n=== 崩溃计数和自动重启示例 ===\n');
  
  const instanceManager = new InstanceManager();
  const errorHandler = new UnifiedErrorHandler({
    instanceManager,
    maxCrashCount: 3,
    crashResetTime: 60000, // 1 分钟
    restartDelay: 2000     // 2 秒
  });
  
  instanceManager.errorHandler = errorHandler;
  
  const testInstanceId = 'crash-test-instance';
  
  // 初始化一个测试状态
  instanceManager._initializeStatus(testInstanceId);
  
  console.log('模拟连续崩溃场景...\n');
  
  // 模拟 4 次崩溃
  for (let i = 1; i <= 4; i++) {
    console.log(`崩溃 #${i}...`);
    await errorHandler.handleInstanceCrash(
      testInstanceId,
      new Error(`Crash #${i}`),
      false
    );
    
    const stats = errorHandler.getCrashStats(testInstanceId);
    console.log(`  总崩溃次数: ${stats.totalCrashes}`);
    console.log(`  最近崩溃次数: ${stats.recentCrashes}`);
    
    const status = instanceManager.getInstanceStatus(testInstanceId);
    if (status) {
      console.log(`  实例状态: ${status.status}`);
      if (status.error) {
        console.log(`  错误信息: ${status.error}`);
      }
    }
    console.log();
    
    // 等待一段时间
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('注意: 第 4 次崩溃后，实例被标记为 "error"，不再自动重启\n');
  
  // 清除崩溃历史
  console.log('清除崩溃历史...');
  errorHandler.clearCrashHistory(testInstanceId);
  
  const statsAfterClear = errorHandler.getCrashStats(testInstanceId);
  console.log('清除后的统计:', statsAfterClear);
  console.log();
}

// 主函数
async function main() {
  try {
    // 等待 Electron 准备就绪
    await app.whenReady();
    
    // 运行示例
    await exampleWithErrorHandler();
    await exampleErrorTypes();
    await exampleCrashCountAndRestart();
    
    console.log('\n所有示例运行完成！');
    
    // 退出应用
    setTimeout(() => {
      app.quit();
    }, 1000);
    
  } catch (error) {
    console.error('示例运行出错:', error);
    app.quit();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = {
  exampleWithErrorHandler,
  exampleErrorTypes,
  exampleCrashCountAndRestart
};
