/**
 * SessionManager 使用示例
 * 
 * 演示如何使用 SessionManager 管理 WhatsApp 账号的会话持久化
 */

const { app } = require('electron');
const path = require('path');
const SessionManager = require('../managers/SessionManager');
const InstanceManager = require('../managers/InstanceManager');
const AccountConfigManager = require('../managers/AccountConfigManager');

async function sessionManagerExample() {
  console.log('=== SessionManager Example ===\n');

  // 1. 创建 SessionManager 实例
  const sessionManager = new SessionManager({
    userDataPath: app.getPath('userData')
  });
  console.log('✓ SessionManager created\n');

  // 2. 创建 AccountConfigManager 和 InstanceManager
  const configManager = new AccountConfigManager();
  const instanceManager = new InstanceManager({
    userDataPath: app.getPath('userData'),
    sessionManager: sessionManager
  });
  console.log('✓ Managers initialized\n');

  // 3. 创建测试账号
  const testAccountId = 'test-account-001';
  const accountConfig = {
    id: testAccountId,
    name: 'Test Account',
    translation: { enabled: false },
    window: { width: 1200, height: 800 }
  };

  // 4. 检查会话数据是否存在
  console.log('--- Checking Session Data ---');
  const hasSessionData = await sessionManager.hasSessionData(testAccountId);
  console.log(`Has session data: ${hasSessionData}`);
  
  if (hasSessionData) {
    // 获取会话数据统计
    const stats = await sessionManager.getSessionDataStats(testAccountId);
    console.log(`Session data size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Session data files: ${stats.files}`);
  }
  console.log();

  // 5. 创建实例（会自动检测和恢复会话）
  console.log('--- Creating Instance ---');
  const createResult = await instanceManager.createInstance(accountConfig);
  
  if (createResult.success) {
    console.log('✓ Instance created successfully');
    console.log(`Instance ID: ${createResult.instanceId}`);
    
    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 6. 检测登录状态
    console.log('\n--- Detecting Login Status ---');
    const isLoggedIn = await sessionManager.detectLoginStatus(
      testAccountId,
      createResult.window
    );
    console.log(`Login status: ${isLoggedIn ? 'Logged in' : 'Not logged in'}`);
    
    if (!isLoggedIn) {
      console.log('Please scan the QR code to login...');
      console.log('Session will be automatically saved after login');
    } else {
      console.log('✓ Session restored successfully');
    }
    
    // 7. 演示会话管理操作
    console.log('\n--- Session Management Operations ---');
    
    // 获取会话数据统计
    const sessionStats = await sessionManager.getSessionDataStats(testAccountId);
    console.log(`Current session size: ${(sessionStats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // 演示清除会话数据（注释掉以避免实际清除）
    /*
    console.log('\nClearing session data...');
    const clearResult = await sessionManager.clearSessionData(testAccountId);
    if (clearResult.success) {
      console.log('✓ Session data cleared');
      console.log('User will need to login again');
    }
    */
    
    // 8. 演示会话备份和恢复
    console.log('\n--- Session Backup & Restore ---');
    
    const backupPath = path.join(app.getPath('userData'), 'backups');
    
    // 备份会话数据
    const backupResult = await sessionManager.backupSessionData(
      testAccountId,
      backupPath
    );
    
    if (backupResult.success) {
      console.log('✓ Session data backed up');
      console.log(`Backup location: ${backupResult.backupPath}`);
      
      // 恢复会话数据（注释掉以避免实际恢复）
      /*
      console.log('\nRestoring session data...');
      const restoreResult = await sessionManager.restoreSessionData(
        testAccountId,
        backupResult.backupPath
      );
      
      if (restoreResult.success) {
        console.log('✓ Session data restored');
      }
      */
    }
    
    // 9. 监控登录状态变化
    console.log('\n--- Monitoring Login Status ---');
    console.log('Monitoring login status for 60 seconds...');
    
    let checkCount = 0;
    const monitorInterval = setInterval(async () => {
      checkCount++;
      
      if (checkCount > 6) {
        clearInterval(monitorInterval);
        console.log('Monitoring stopped');
        
        // 清理：销毁实例
        await instanceManager.destroyInstance(testAccountId);
        console.log('\n✓ Instance destroyed');
        console.log('\n=== Example Complete ===');
        return;
      }
      
      const currentStatus = await sessionManager.detectLoginStatus(
        testAccountId,
        createResult.window
      );
      
      console.log(`[${checkCount}] Login status: ${currentStatus ? 'Logged in' : 'Not logged in'}`);
    }, 10000);
    
  } else {
    console.error('✗ Failed to create instance:', createResult.error);
  }
}

// 使用示例函数
async function demonstrateSessionPersistence() {
  console.log('\n=== Session Persistence Demonstration ===\n');
  
  const sessionManager = new SessionManager({
    userDataPath: app.getPath('userData')
  });
  
  const testAccountId = 'demo-account';
  
  // 场景 1: 首次启动（无会话数据）
  console.log('Scenario 1: First Launch (No Session Data)');
  console.log('-------------------------------------------');
  const hasData1 = await sessionManager.hasSessionData(testAccountId);
  console.log(`Has session data: ${hasData1}`);
  console.log('Expected: User will see QR code and need to login');
  console.log();
  
  // 场景 2: 第二次启动（有会话数据）
  console.log('Scenario 2: Second Launch (With Session Data)');
  console.log('----------------------------------------------');
  console.log('After user logs in, session data is automatically saved');
  console.log('On next launch, session will be restored automatically');
  console.log('Expected: User is automatically logged in');
  console.log();
  
  // 场景 3: 会话过期
  console.log('Scenario 3: Session Expired');
  console.log('----------------------------');
  console.log('If WhatsApp session expires (e.g., after 14 days of inactivity)');
  console.log('Expected: QR code will be displayed for re-authentication');
  console.log();
  
  // 场景 4: 清除会话
  console.log('Scenario 4: Clear Session (Force Re-login)');
  console.log('-------------------------------------------');
  console.log('User can manually clear session data to force re-login');
  console.log('This is useful for troubleshooting or switching accounts');
  console.log();
  
  console.log('=== Demonstration Complete ===\n');
}

// 导出示例函数
module.exports = {
  sessionManagerExample,
  demonstrateSessionPersistence
};

// 如果直接运行此文件
if (require.main === module) {
  app.whenReady().then(async () => {
    try {
      await demonstrateSessionPersistence();
      // await sessionManagerExample(); // 取消注释以运行完整示例
    } catch (error) {
      console.error('Example failed:', error);
    }
  });
}
