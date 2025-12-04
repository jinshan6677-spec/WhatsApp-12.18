/**
 * InstanceManager 使用示例
 * 
 * 演示如何使用 InstanceManager 创建、管理和销毁 WhatsApp 账号实例
 */

const { app } = require('electron');
const InstanceManager = require('../managers/InstanceManager');
const AccountConfigManager = require('../managers/AccountConfigManager');

/**
 * 示例：创建和管理多个账号实例
 */
async function exampleMultiInstanceManagement() {
  console.log('=== InstanceManager 使用示例 ===\n');
  
  // 1. 初始化管理器
  const configManager = new AccountConfigManager();
  const instanceManager = new InstanceManager({
    userDataPath: app.getPath('userData'),
    maxInstances: 30
  });
  
  console.log('✓ 管理器初始化完成\n');
  
  // 2. 创建账号配置
  const account1Result = await configManager.createAccount({
    name: 'Work Account',
    translation: {
      enabled: true,
      targetLanguage: 'zh-CN',
      engine: 'google'
    }
  });
  
  if (!account1Result.success) {
    console.error('创建账号失败:', account1Result.errors);
    return;
  }
  
  const account1 = account1Result.account;
  console.log(`✓ 创建账号: ${account1.name} (${account1.id})\n`);
  
  // 3. 创建实例
  console.log('正在创建实例...');
  const createResult = await instanceManager.createInstance(account1);
  
  if (createResult.success) {
    console.log(`✓ 实例创建成功: ${createResult.instanceId}\n`);
  } else {
    console.error('实例创建失败:', createResult.error);
    return;
  }
  
  // 4. 获取实例状态
  const status = instanceManager.getInstanceStatus(account1.id);
  console.log('实例状态:', {
    status: status.status,
    pid: status.pid,
    memoryUsage: status.memoryUsage,
    startTime: status.startTime
  });
  console.log();
  
  // 5. 获取运行中的实例
  const runningInstances = instanceManager.getRunningInstances();
  console.log(`运行中的实例数量: ${runningInstances.length}\n`);
  
  // 6. 等待一段时间（模拟使用）
  console.log('等待 5 秒...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 7. 重启实例
  console.log('正在重启实例...');
  const restartResult = await instanceManager.restartInstance(account1.id);
  
  if (restartResult.success) {
    console.log('✓ 实例重启成功\n');
  } else {
    console.error('实例重启失败:', restartResult.error);
  }
  
  // 8. 等待一段时间
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 9. 销毁实例
  console.log('正在销毁实例...');
  const destroyResult = await instanceManager.destroyInstance(account1.id, {
    saveState: true
  });
  
  if (destroyResult.success) {
    console.log('✓ 实例销毁成功\n');
  } else {
    console.error('实例销毁失败:', destroyResult.error);
  }
  
  console.log('=== 示例完成 ===');
}


/**
 * 示例：批量管理实例
 */
async function exampleBatchManagement() {
  console.log('=== 批量管理示例 ===\n');
  
  const configManager = new AccountConfigManager();
  const instanceManager = new InstanceManager();
  
  // 创建多个账号
  const accounts = [];
  for (let i = 1; i <= 3; i++) {
    const result = await configManager.createAccount({
      name: `Account ${i}`
    });
    if (result.success) {
      accounts.push(result.account);
    }
  }
  
  console.log(`✓ 创建了 ${accounts.length} 个账号\n`);
  
  // 批量创建实例
  console.log('正在批量创建实例...');
  for (const account of accounts) {
    const result = await instanceManager.createInstance(account);
    if (result.success) {
      console.log(`  ✓ ${account.name} 实例创建成功`);
    }
  }
  console.log();
  
  // 显示统计信息
  console.log('实例统计:');
  console.log(`  总实例数: ${instanceManager.getInstanceCount()}`);
  console.log(`  运行中: ${instanceManager.getRunningInstanceCount()}`);
  console.log();
  
  // 批量销毁
  console.log('正在批量销毁实例...');
  const destroyResult = await instanceManager.destroyAllInstances();
  console.log(`✓ 销毁了 ${destroyResult.destroyed} 个实例`);
  if (destroyResult.failed > 0) {
    console.log(`  失败: ${destroyResult.failed} 个`);
  }
  
  console.log('\n=== 示例完成 ===');
}

// 导出示例函数
module.exports = {
  exampleMultiInstanceManagement,
  exampleBatchManagement
};

// 如果直接运行此文件
if (require.main === module) {
  app.whenReady().then(async () => {
    try {
      // 运行示例
      await exampleMultiInstanceManagement();
      
      // 退出应用
      setTimeout(() => {
        app.quit();
      }, 1000);
    } catch (error) {
      console.error('示例运行失败:', error);
      app.quit();
    }
  });
}
