/**
 * 迁移脚本 - 从单实例架构迁移到多实例架构
 * 
 * 使用方法：
 *   node scripts/migrate-to-multi-instance.js
 * 
 * 或者在应用启动时自动运行
 */

const path = require('path');
const { app } = require('electron');

// 如果不在 Electron 环境中运行，使用模拟的 app 对象
const getApp = () => {
  if (app) {
    return app;
  }
  
  // 模拟 app 对象用于独立脚本运行
  return {
    getPath: (name) => {
      if (name === 'userData') {
        return path.join(process.cwd(), 'session-data');
      }
      return process.cwd();
    }
  };
};

/**
 * 执行迁移
 */
async function runMigration() {
  console.log('========================================');
  console.log('WhatsApp Desktop - Migration Tool');
  console.log('From: Single Instance Architecture');
  console.log('To: Multi-Instance Architecture');
  console.log('========================================\n');

  try {
    // 动态导入管理器
    const MigrationManager = require('../src/managers/MigrationManager');
    const AccountConfigManager = require('../src/managers/AccountConfigManager');

    const currentApp = getApp();
    const userDataPath = currentApp.getPath('userData');

    console.log(`User Data Path: ${userDataPath}\n`);

    // 初始化账号配置管理器
    console.log('[1/4] Initializing Account Configuration Manager...');
    const accountConfigManager = new AccountConfigManager({
      cwd: userDataPath
    });
    console.log('✓ Account Configuration Manager initialized\n');

    // 初始化迁移管理器
    console.log('[2/4] Initializing Migration Manager...');
    const migrationManager = new MigrationManager({
      userDataPath,
      accountConfigManager
    });
    console.log('✓ Migration Manager initialized\n');

    // 检查迁移状态
    console.log('[3/4] Checking migration status...');
    const status = await migrationManager.getMigrationStatus();
    
    if (status.completed) {
      console.log('✓ Migration already completed');
      console.log(`  Migration Date: ${status.migrationDate}`);
      console.log(`  Version: ${status.version}\n`);
      console.log('No action needed. Exiting...');
      return;
    }

    const needsMigration = await migrationManager.needsMigration();
    
    if (!needsMigration) {
      console.log('✓ No migration needed');
      console.log('  Either no old session data exists or profiles already set up\n');
      console.log('Exiting...');
      return;
    }

    console.log('✓ Migration needed\n');

    // 执行迁移
    console.log('[4/4] Executing migration...');
    console.log('This may take a few moments...\n');
    
    const result = await migrationManager.migrate();

    if (result.success) {
      console.log('\n========================================');
      console.log('✓ MIGRATION COMPLETED SUCCESSFULLY');
      console.log('========================================\n');
      
      if (result.details) {
        console.log('Migration Steps:');
        result.details.steps.forEach((step, index) => {
          console.log(`  ${index + 1}. ${step}`);
        });
        
        console.log('\nPaths:');
        console.log(`  Old Session: ${result.details.oldSessionPath}`);
        console.log(`  New Profile: ${result.details.newProfilePath}`);
      }
      
      console.log('\nYou can now start the application with multi-instance support.');
      console.log('Your old session data has been preserved as a backup.\n');
    } else {
      console.error('\n========================================');
      console.error('✗ MIGRATION FAILED');
      console.error('========================================\n');
      console.error(`Error: ${result.message}\n`);
      
      if (result.details && result.details.error) {
        console.error('Details:');
        console.error(result.details.error);
      }
      
      console.error('\nPlease check the error message above and try again.');
      console.error('If the problem persists, please report it as an issue.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n========================================');
    console.error('✗ MIGRATION ERROR');
    console.error('========================================\n');
    console.error('An unexpected error occurred during migration:\n');
    console.error(error.stack);
    console.error('\nPlease report this error as an issue.\n');
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
