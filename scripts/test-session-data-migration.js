/**
 * 测试会话数据迁移功能
 * 
 * 测试会话数据目录的验证、访问性检查和完整性验证
 */

const path = require('path');
const fs = require('fs').promises;
const MigrationManager = require('../src/single-window/migration/MigrationManager');

// 测试用的临时目录
const TEST_DATA_DIR = path.join(__dirname, '../temp/session-migration-test');
const TEST_CONFIG_FILE = 'accounts.json';
const TEST_SESSION_DIR = path.join(TEST_DATA_DIR, 'session-data');

/**
 * 创建测试用的会话数据目录
 */
async function createTestSessionData() {
  console.log('\n=== Creating Test Session Data ===\n');
  
  // 创建会话数据目录结构
  const accounts = [
    {
      id: 'acc-001',
      hasData: true,
      paths: ['IndexedDB', 'Local Storage', 'Cookies', 'Cache']
    },
    {
      id: 'acc-002',
      hasData: true,
      paths: ['IndexedDB', 'Cookies']
    },
    {
      id: 'acc-003',
      hasData: false, // 空目录（未登录）
      paths: []
    }
  ];
  
  for (const account of accounts) {
    const accountSessionDir = path.join(TEST_SESSION_DIR, `account-${account.id}`);
    await fs.mkdir(accountSessionDir, { recursive: true });
    
    if (account.hasData) {
      // 创建会话数据子目录
      for (const subPath of account.paths) {
        const fullPath = path.join(accountSessionDir, subPath);
        await fs.mkdir(fullPath, { recursive: true });
        
        // 创建一些测试文件
        const testFile = path.join(fullPath, 'test-data.txt');
        await fs.writeFile(testFile, `Test data for ${account.id}`, 'utf-8');
      }
      
      console.log(`✓ Created session data for ${account.id} with: ${account.paths.join(', ')}`);
    } else {
      console.log(`✓ Created empty session directory for ${account.id}`);
    }
  }
  
  console.log(`\n✓ Test session data created in: ${TEST_SESSION_DIR}`);
}

/**
 * 创建测试配置文件
 */
async function createTestConfig() {
  console.log('\n=== Creating Test Configuration ===\n');
  
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  
  const config = {
    version: '2.0.0',
    accounts: {
      'acc-001': {
        id: 'acc-001',
        name: 'Account with Full Data',
        note: 'Has complete session data',
        order: 0,
        sessionDir: 'session-data/account-acc-001',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastActiveAt: '2024-01-15T10:30:00.000Z',
        autoStart: true,
        
        translation: {
          enabled: false,
          targetLanguage: 'zh-CN',
          engine: 'google',
          apiKey: '',
          autoTranslate: false,
          translateInput: false,
          friendSettings: {}
        }
      },
      'acc-002': {
        id: 'acc-002',
        name: 'Account with Partial Data',
        note: 'Has some session data',
        order: 1,
        sessionDir: 'session-data/account-acc-002',
        createdAt: '2024-01-02T00:00:00.000Z',
        lastActiveAt: '2024-01-16T14:20:00.000Z',
        autoStart: false,
        
        translation: {
          enabled: false,
          targetLanguage: 'en',
          engine: 'google',
          apiKey: '',
          autoTranslate: false,
          translateInput: false,
          friendSettings: {}
        }
      },
      'acc-003': {
        id: 'acc-003',
        name: 'Account without Data',
        note: 'Empty session directory',
        order: 2,
        sessionDir: 'session-data/account-acc-003',
        createdAt: '2024-01-03T00:00:00.000Z',
        lastActiveAt: '2024-01-17T09:15:00.000Z',
        autoStart: false,
        
        translation: {
          enabled: false,
          targetLanguage: 'es',
          engine: 'google',
          apiKey: '',
          autoTranslate: false,
          translateInput: false,
          friendSettings: {}
        }
      },
      'acc-004': {
        id: 'acc-004',
        name: 'Account with Non-existent Session',
        note: 'Session directory does not exist',
        order: 3,
        sessionDir: 'session-data/account-acc-004',
        createdAt: '2024-01-04T00:00:00.000Z',
        lastActiveAt: '2024-01-18T11:00:00.000Z',
        autoStart: false,
        
        translation: {
          enabled: false,
          targetLanguage: 'fr',
          engine: 'google',
          apiKey: '',
          autoTranslate: false,
          translateInput: false,
          friendSettings: {}
        }
      }
    },
    migratedAt: new Date().toISOString(),
    migratedFrom: '1.0.0'
  };
  
  const configPath = path.join(TEST_DATA_DIR, TEST_CONFIG_FILE);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  
  console.log(`✓ Created test configuration: ${configPath}`);
  console.log(`✓ Configuration contains ${Object.keys(config.accounts).length} accounts`);
  
  return config;
}

/**
 * 测试会话数据可访问性验证
 */
async function testSessionAccessibility(manager) {
  console.log('\n=== Testing Session Data Accessibility ===\n');
  
  const testCases = [
    {
      name: 'Existing session with data',
      sessionDir: 'session-data/account-acc-001',
      expectedAccessible: true,
      expectedExists: true
    },
    {
      name: 'Existing session with partial data',
      sessionDir: 'session-data/account-acc-002',
      expectedAccessible: true,
      expectedExists: true
    },
    {
      name: 'Empty session directory',
      sessionDir: 'session-data/account-acc-003',
      expectedAccessible: true,
      expectedExists: true
    },
    {
      name: 'Non-existent session',
      sessionDir: 'session-data/account-acc-004',
      expectedAccessible: false,
      expectedExists: false
    }
  ];
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log(`  Session Dir: ${testCase.sessionDir}`);
    
    const result = await manager.verifySessionDataAccessible(testCase.sessionDir);
    
    console.log(`  Accessible: ${result.accessible}`);
    console.log(`  Exists: ${result.exists}`);
    console.log(`  Path: ${result.path}`);
    
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    
    const passed = 
      result.accessible === testCase.expectedAccessible &&
      result.exists === testCase.expectedExists;
    
    if (passed) {
      console.log(`  ✓ Test passed`);
    } else {
      console.log(`  ✗ Test failed`);
      console.log(`    Expected accessible: ${testCase.expectedAccessible}, got: ${result.accessible}`);
      console.log(`    Expected exists: ${testCase.expectedExists}, got: ${result.exists}`);
      allPassed = false;
    }
  }
  
  if (allPassed) {
    console.log('\n✓ All accessibility tests passed');
  } else {
    console.log('\n✗ Some accessibility tests failed');
  }
  
  return allPassed;
}

/**
 * 测试会话数据完整性验证
 */
async function testSessionIntegrity(manager) {
  console.log('\n=== Testing Session Data Integrity ===\n');
  
  const testCases = [
    {
      name: 'Full session data',
      sessionDir: 'session-data/account-acc-001',
      expectedValid: true,
      expectedHasData: true,
      expectedPaths: ['IndexedDB', 'Local Storage', 'Cookies', 'Cache']
    },
    {
      name: 'Partial session data',
      sessionDir: 'session-data/account-acc-002',
      expectedValid: true,
      expectedHasData: true,
      expectedPaths: ['IndexedDB', 'Cookies']
    },
    {
      name: 'Empty session directory',
      sessionDir: 'session-data/account-acc-003',
      expectedValid: false,
      expectedHasData: false,
      expectedPaths: []
    },
    {
      name: 'Non-existent session',
      sessionDir: 'session-data/account-acc-004',
      expectedValid: false,
      expectedHasData: false,
      expectedPaths: []
    }
  ];
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log(`  Session Dir: ${testCase.sessionDir}`);
    
    const result = await manager.validateSessionDataIntegrity(testCase.sessionDir);
    
    console.log(`  Valid: ${result.valid}`);
    console.log(`  Has Data: ${result.hasData}`);
    
    if (result.details && result.details.foundPaths) {
      console.log(`  Found Paths: ${result.details.foundPaths.join(', ') || 'none'}`);
    }
    
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    
    const passed = 
      result.valid === testCase.expectedValid &&
      result.hasData === testCase.expectedHasData;
    
    if (passed && result.details && result.details.foundPaths) {
      // 验证找到的路径
      const foundPathsMatch = testCase.expectedPaths.every(p => 
        result.details.foundPaths.includes(p)
      );
      
      if (!foundPathsMatch) {
        console.log(`  ✗ Found paths don't match expected`);
        console.log(`    Expected: ${testCase.expectedPaths.join(', ')}`);
        console.log(`    Found: ${result.details.foundPaths.join(', ')}`);
        allPassed = false;
        continue;
      }
    }
    
    if (passed) {
      console.log(`  ✓ Test passed`);
    } else {
      console.log(`  ✗ Test failed`);
      console.log(`    Expected valid: ${testCase.expectedValid}, got: ${result.valid}`);
      console.log(`    Expected hasData: ${testCase.expectedHasData}, got: ${result.hasData}`);
      allPassed = false;
    }
  }
  
  if (allPassed) {
    console.log('\n✓ All integrity tests passed');
  } else {
    console.log('\n✗ Some integrity tests failed');
  }
  
  return allPassed;
}

/**
 * 测试会话数据迁移
 */
async function testSessionDataMigration(manager, config) {
  console.log('\n=== Testing Session Data Migration ===\n');
  
  const result = await manager.migrateSessionData(config);
  
  console.log('Migration Result:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Updated: ${result.updated}`);
  
  if (result.errors && result.errors.length > 0) {
    console.log(`  Errors: ${result.errors.length}`);
    result.errors.forEach(err => console.log(`    - ${err}`));
  }
  
  if (result.warnings && result.warnings.length > 0) {
    console.log(`  Warnings: ${result.warnings.length}`);
    result.warnings.forEach(warn => console.log(`    - ${warn}`));
  }
  
  // 验证结果
  console.log('\nValidation:');
  
  // 应该处理了 4 个账号
  if (result.updated !== 4) {
    console.log(`  ✗ Expected 4 accounts to be processed, got ${result.updated}`);
    return false;
  }
  
  console.log(`  ✓ Processed ${result.updated} accounts`);
  
  // 应该有警告（对于空目录和不存在的目录）
  if (result.warnings.length < 2) {
    console.log(`  ✗ Expected at least 2 warnings, got ${result.warnings.length}`);
    return false;
  }
  
  console.log(`  ✓ Generated ${result.warnings.length} warnings as expected`);
  
  // 不应该有错误（所有情况都应该被优雅处理）
  if (result.errors.length > 0) {
    console.log(`  ✗ Unexpected errors occurred`);
    return false;
  }
  
  console.log(`  ✓ No errors occurred`);
  
  // 验证配置中的 sessionDir 路径保持不变
  console.log('\nVerifying Session Paths:');
  
  for (const [accountId, account] of Object.entries(config.accounts)) {
    if (!account.sessionDir) {
      console.log(`  ✗ Account ${accountId} missing sessionDir`);
      return false;
    }
    
    console.log(`  ✓ Account ${accountId}: ${account.sessionDir}`);
  }
  
  console.log('\n✓ Session data migration test passed');
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
  console.log('║        Session Data Migration Test Suite                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  let allTestsPassed = true;
  
  try {
    // 创建测试数据
    await createTestSessionData();
    const config = await createTestConfig();
    
    // 创建迁移管理器实例
    const manager = new MigrationManager({
      userDataPath: TEST_DATA_DIR,
      configFileName: TEST_CONFIG_FILE,
      backupDir: 'migration-backups'
    });
    
    // 运行测试
    const tests = [
      { name: 'Session Accessibility', fn: () => testSessionAccessibility(manager) },
      { name: 'Session Integrity', fn: () => testSessionIntegrity(manager) },
      { name: 'Session Data Migration', fn: () => testSessionDataMigration(manager, config) }
    ];
    
    for (const test of tests) {
      const passed = await test.fn();
      if (!passed) {
        allTestsPassed = false;
        console.log(`\n❌ Test Failed: ${test.name}`);
      }
    }
    
    // 清理
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
