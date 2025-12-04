/**
 * 测试配置迁移功能
 * 
 * 测试从旧的多窗口配置格式迁移到新的单窗口配置格式
 */

const path = require('path');
const fs = require('fs').promises;
const MigrationManager = require('../src/single-window/migration/MigrationManager');

// 测试用的临时目录
const TEST_DATA_DIR = path.join(__dirname, '../temp/migration-test');
const TEST_CONFIG_FILE = 'accounts.json';

/**
 * 创建测试用的旧配置文件
 */
async function createOldConfigFile() {
  console.log('\n=== Creating Old Configuration File ===\n');
  
  // 确保测试目录存在
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  
  // 创建旧格式的配置（包含 window 配置）
  const oldConfig = {
    version: '1.0.0',
    accounts: {
      'acc-001': {
        id: 'acc-001',
        name: 'Personal WhatsApp',
        note: 'My personal account',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastActiveAt: '2024-01-15T10:30:00.000Z',
        autoStart: true,
        sessionDir: 'session-data/account-acc-001',
        window: {
          x: 100,
          y: 100,
          width: 1200,
          height: 800,
          minimized: false
        },
        
        translation: {
          enabled: true,
          targetLanguage: 'zh-CN',
          engine: 'google',
          apiKey: '',
          autoTranslate: false,
          translateInput: true,
          friendSettings: {
            'friend1': {
              enabled: true,
              targetLanguage: 'en'
            }
          }
        },
        notifications: {
          enabled: true,
          sound: true,
          badge: true
        }
      },
      'acc-002': {
        id: 'acc-002',
        name: 'Business WhatsApp',
        note: 'Work account',
        createdAt: '2024-01-02T00:00:00.000Z',
        lastActiveAt: '2024-01-16T14:20:00.000Z',
        autoStart: false,
        sessionDir: 'session-data/account-acc-002',
        window: {
          x: 1320,
          y: 100,
          width: 1200,
          height: 800,
          minimized: false
        },
        
        translation: {
          enabled: false,
          targetLanguage: 'en',
          engine: 'gpt4',
          apiKey: 'sk-test-key',
          autoTranslate: false,
          translateInput: false,
          friendSettings: {}
        }
      },
      'acc-003': {
        id: 'acc-003',
        name: 'Customer Support',
        note: '',
        createdAt: '2024-01-03T00:00:00.000Z',
        lastActiveAt: '2024-01-17T09:15:00.000Z',
        autoStart: true,
        sessionDir: 'session-data/account-acc-003',
        window: {
          x: 100,
          y: 920,
          width: 1200,
          height: 800,
          minimized: false
        },
        
        translation: {
          enabled: true,
          targetLanguage: 'es',
          engine: 'deepseek',
          apiKey: 'ds-test-key',
          autoTranslate: true,
          translateInput: true,
          friendSettings: {}
        }
      }
    }
  };
  
  const configPath = path.join(TEST_DATA_DIR, TEST_CONFIG_FILE);
  await fs.writeFile(configPath, JSON.stringify(oldConfig, null, 2), 'utf-8');
  
  console.log(`✓ Created old configuration file: ${configPath}`);
  console.log(`✓ Configuration contains ${Object.keys(oldConfig.accounts).length} accounts`);
  
  return configPath;
}

/**
 * 测试迁移检测
 */
async function testMigrationDetection(manager) {
  console.log('\n=== Testing Migration Detection ===\n');
  
  const detection = await manager.detectMigrationNeeded();
  
  console.log('Detection Result:');
  console.log(`  Needed: ${detection.needed}`);
  console.log(`  Reason: ${detection.reason}`);
  
  if (detection.configPath) {
    console.log(`  Config Path: ${detection.configPath}`);
  }
  
  if (!detection.needed) {
    console.log('\n✗ Migration detection failed - should detect old format');
    return false;
  }
  
  console.log('\n✓ Migration detection successful');
  return true;
}

/**
 * 测试配置备份
 */
async function testConfigBackup(manager) {
  console.log('\n=== Testing Configuration Backup ===\n');
  
  const backupResult = await manager.createBackup();
  
  console.log('Backup Result:');
  console.log(`  Success: ${backupResult.success}`);
  
  if (backupResult.success) {
    console.log(`  Backup Path: ${backupResult.backupPath}`);
    
    // 验证备份文件存在
    try {
      await fs.access(backupResult.backupPath);
      console.log('\n✓ Backup file created successfully');
      return true;
    } catch (error) {
      console.log('\n✗ Backup file not found');
      return false;
    }
  } else {
    console.log(`  Error: ${backupResult.error}`);
    console.log('\n✗ Backup creation failed');
    return false;
  }
}

/**
 * 测试配置迁移
 */
async function testConfigMigration(manager) {
  console.log('\n=== Testing Configuration Migration ===\n');
  
  // 读取旧配置
  const configResult = await manager.readOldConfig();
  
  if (!configResult.success) {
    console.log(`✗ Failed to read old config: ${configResult.error}`);
    return false;
  }
  
  console.log(`✓ Read old configuration with ${Object.keys(configResult.data.accounts).length} accounts`);
  
  // 执行迁移
  const migrationResult = await manager.migrateConfiguration(configResult.data);
  
  console.log('\nMigration Result:');
  console.log(`  Success: ${migrationResult.success}`);
  
  if (migrationResult.errors && migrationResult.errors.length > 0) {
    console.log(`  Errors: ${migrationResult.errors.length}`);
    migrationResult.errors.forEach(err => console.log(`    - ${err}`));
  }
  
  if (migrationResult.warnings && migrationResult.warnings.length > 0) {
    console.log(`  Warnings: ${migrationResult.warnings.length}`);
    migrationResult.warnings.forEach(warn => console.log(`    - ${warn}`));
  }
  
  if (!migrationResult.success) {
    console.log('\n✗ Configuration migration failed');
    return false;
  }
  
  const migratedConfig = migrationResult.migratedConfig;
  
  console.log('\nMigrated Configuration:');
  console.log(`  Version: ${migratedConfig.version}`);
  console.log(`  Migrated From: ${migratedConfig.migratedFrom}`);
  console.log(`  Accounts: ${Object.keys(migratedConfig.accounts).length}`);
  
  // 验证迁移后的配置
  console.log('\nValidating Migrated Accounts:');
  
  for (const [accountId, account] of Object.entries(migratedConfig.accounts)) {
    console.log(`\n  Account: ${accountId}`);
    console.log(`    Name: ${account.name}`);
    console.log(`    Order: ${account.order}`);
    console.log(`    Session Dir: ${account.sessionDir}`);
    console.log(`    Has Window Config: ${account.window !== undefined ? 'YES (ERROR!)' : 'NO (CORRECT)'}`);
    
    // 验证必需字段
    if (!account.id || !account.name || account.order === undefined || !account.sessionDir) {
      console.log(`    ✗ Missing required fields`);
      return false;
    }
    
    
    
    // 验证翻译配置保留
    if (account.translation) {
      console.log(`    Translation Enabled: ${account.translation.enabled}`);
      if (account.translation.enabled) {
        console.log(`    Translation: ${account.translation.engine} -> ${account.translation.targetLanguage}`);
      }
    }
    
    console.log(`    ✓ Account migrated correctly`);
  }
  
  // 验证 order 字段的顺序
  const orders = Object.values(migratedConfig.accounts).map(acc => acc.order).sort((a, b) => a - b);
  const expectedOrders = Array.from({ length: orders.length }, (_, i) => i);
  
  if (JSON.stringify(orders) === JSON.stringify(expectedOrders)) {
    console.log('\n✓ Order fields are sequential and correct');
  } else {
    console.log('\n✗ Order fields are not sequential');
    return false;
  }
  
  console.log('\n✓ Configuration migration successful');
  return true;
}

/**
 * 测试完整迁移流程
 */
async function testFullMigration(manager) {
  console.log('\n=== Testing Full Migration Process ===\n');
  
  const result = await manager.performFullMigration();
  
  console.log('Full Migration Result:');
  console.log(`  Success: ${result.success}`);
  
  if (result.backupPath) {
    console.log(`  Backup Path: ${result.backupPath}`);
  }
  
  if (result.errors && result.errors.length > 0) {
    console.log(`  Errors: ${result.errors.length}`);
    result.errors.forEach(err => console.log(`    - ${err}`));
  }
  
  if (result.warnings && result.warnings.length > 0) {
    console.log(`  Warnings: ${result.warnings.length}`);
    result.warnings.forEach(warn => console.log(`    - ${warn}`));
  }
  
  if (!result.success) {
    console.log('\n✗ Full migration process failed');
    return false;
  }
  
  // 验证迁移后的配置文件
  const configPath = path.join(TEST_DATA_DIR, TEST_CONFIG_FILE);
  
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    
    console.log('\nVerifying Saved Configuration:');
    console.log(`  Version: ${config.version}`);
    console.log(`  Accounts: ${Object.keys(config.accounts).length}`);
    
    // 验证没有 window 配置
    let hasWindowConfig = false;
    for (const account of Object.values(config.accounts)) {
      if (account.window) {
        hasWindowConfig = true;
        break;
      }
    }
    
    if (hasWindowConfig) {
      console.log('  ✗ Configuration still contains window config');
      return false;
    }
    
    console.log('  ✓ Configuration is in new format (no window config)');
    
  } catch (error) {
    console.log(`\n✗ Failed to read saved configuration: ${error.message}`);
    return false;
  }
  
  console.log('\n✓ Full migration process successful');
  return true;
}

/**
 * 清理测试数据
 */
async function cleanup() {
  console.log('\n=== Cleaning Up Test Data ===\n');
  
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    console.log('✓ Test data cleaned up');
  } catch (error) {
    console.log(`✗ Failed to clean up: ${error.message}`);
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Configuration Migration Test Suite                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  let allTestsPassed = true;
  
  try {
    // 创建测试配置文件
    await createOldConfigFile();
    
    // 创建迁移管理器实例
    const manager = new MigrationManager({
      userDataPath: TEST_DATA_DIR,
      configFileName: TEST_CONFIG_FILE,
      backupDir: 'migration-backups'
    });
    
    // 运行测试
    const tests = [
      { name: 'Migration Detection', fn: () => testMigrationDetection(manager) },
      { name: 'Configuration Backup', fn: () => testConfigBackup(manager) },
      { name: 'Configuration Migration', fn: () => testConfigMigration(manager) }
    ];
    
    for (const test of tests) {
      const passed = await test.fn();
      if (!passed) {
        allTestsPassed = false;
        console.log(`\n❌ Test Failed: ${test.name}`);
      }
    }
    
    // 清理并重新创建配置文件用于完整迁移测试
    await cleanup();
    await createOldConfigFile();
    
    const manager2 = new MigrationManager({
      userDataPath: TEST_DATA_DIR,
      configFileName: TEST_CONFIG_FILE,
      backupDir: 'migration-backups'
    });
    
    const fullMigrationPassed = await testFullMigration(manager2);
    if (!fullMigrationPassed) {
      allTestsPassed = false;
      console.log('\n❌ Test Failed: Full Migration Process');
    }
    
    // 最终清理
    await cleanup();
    
    // 输出测试结果
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    if (allTestsPassed) {
      console.log('║                  ✓ ALL TESTS PASSED                           ║');
    } else {
      console.log('║                  ✗ SOME TESTS FAILED                          ║');
    }
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    process.exit(allTestsPassed ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
    await cleanup();
    process.exit(1);
  }
}

// 运行测试
runTests();
