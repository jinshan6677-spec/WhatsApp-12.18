/**
 * Test script for MigrationManager
 * Tests migration detection and backup functionality
 */

const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');

// Mock app if not in Electron context
if (!app || !app.getPath) {
  global.app = {
    getPath: (name) => {
      if (name === 'userData') {
        return path.join(__dirname, '..', 'test-user-data');
      }
      return path.join(__dirname, '..');
    }
  };
  require('electron').app = global.app;
}

const MigrationManager = require('../src/single-window/migration/MigrationManager');

/**
 * Create a test old-format configuration
 */
async function createTestOldConfig(userDataPath) {
  const configPath = path.join(userDataPath, 'accounts.json');
  
  const oldConfig = {
    version: '1.0.0',
    accounts: {
      'acc-001': {
        id: 'acc-001',
        name: 'Test Account 1',
        note: 'Test note',
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
          engine: 'google'
        },
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      },
      'acc-002': {
        id: 'acc-002',
        name: 'Test Account 2',
        note: 'Another test',
        sessionDir: 'session-data/account-acc-002',
        window: {
          x: 200,
          y: 200,
          width: 1200,
          height: 800,
          minimized: false
        },
        
        translation: {
          enabled: false
        },
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      }
    }
  };
  
  await fs.mkdir(userDataPath, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(oldConfig, null, 2), 'utf-8');
  
  console.log(`✓ Created test old config at: ${configPath}`);
  return configPath;
}

/**
 * Create a test new-format configuration
 */
async function createTestNewConfig(userDataPath) {
  const configPath = path.join(userDataPath, 'accounts.json');
  
  const newConfig = {
    version: '2.0.0',
    accounts: {
      'acc-001': {
        id: 'acc-001',
        name: 'Test Account 1',
        note: 'Test note',
        order: 0,
        sessionDir: 'session-data/account-acc-001',
        
        translation: {
          enabled: true,
          targetLanguage: 'zh-CN',
          engine: 'google'
        },
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      }
    }
  };
  
  await fs.mkdir(userDataPath, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
  
  console.log(`✓ Created test new config at: ${configPath}`);
  return configPath;
}

/**
 * Clean up test files
 */
async function cleanup(userDataPath) {
  try {
    await fs.rm(userDataPath, { recursive: true, force: true });
    console.log(`✓ Cleaned up test directory: ${userDataPath}`);
  } catch (error) {
    console.warn(`Warning: Failed to clean up: ${error.message}`);
  }
}

/**
 * Test migration detection with old config
 */
async function testDetectionWithOldConfig() {
  console.log('\n=== Test 1: Detection with Old Config ===');
  
  const testUserDataPath = path.join(__dirname, '..', 'test-user-data-old');
  
  try {
    // Create test old config
    await createTestOldConfig(testUserDataPath);
    
    // Create migration manager
    const migrationManager = new MigrationManager({
      userDataPath: testUserDataPath
    });
    
    // Test detection
    const detection = await migrationManager.detectMigrationNeeded();
    
    console.log('Detection result:', detection);
    
    if (detection.needed) {
      console.log('✓ Old config correctly detected as needing migration');
    } else {
      console.error('✗ Old config should need migration but was not detected');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('✗ Test failed:', error);
    return false;
  } finally {
    await cleanup(testUserDataPath);
  }
}

/**
 * Test migration detection with new config
 */
async function testDetectionWithNewConfig() {
  console.log('\n=== Test 2: Detection with New Config ===');
  
  const testUserDataPath = path.join(__dirname, '..', 'test-user-data-new');
  
  try {
    // Create test new config
    await createTestNewConfig(testUserDataPath);
    
    // Create migration manager
    const migrationManager = new MigrationManager({
      userDataPath: testUserDataPath
    });
    
    // Test detection
    const detection = await migrationManager.detectMigrationNeeded();
    
    console.log('Detection result:', detection);
    
    if (!detection.needed) {
      console.log('✓ New config correctly detected as not needing migration');
    } else {
      console.error('✗ New config should not need migration but was detected as needing it');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('✗ Test failed:', error);
    return false;
  } finally {
    await cleanup(testUserDataPath);
  }
}

/**
 * Test backup creation
 */
async function testBackupCreation() {
  console.log('\n=== Test 3: Backup Creation ===');
  
  const testUserDataPath = path.join(__dirname, '..', 'test-user-data-backup');
  
  try {
    // Create test old config
    await createTestOldConfig(testUserDataPath);
    
    // Create migration manager
    const migrationManager = new MigrationManager({
      userDataPath: testUserDataPath
    });
    
    // Test backup creation
    const backupResult = await migrationManager.createBackup();
    
    console.log('Backup result:', backupResult);
    
    if (backupResult.success && backupResult.backupPath) {
      console.log('✓ Backup created successfully');
      
      // Verify backup file exists
      const backupExists = await fs.access(backupResult.backupPath)
        .then(() => true)
        .catch(() => false);
      
      if (backupExists) {
        console.log('✓ Backup file exists at:', backupResult.backupPath);
      } else {
        console.error('✗ Backup file does not exist');
        return false;
      }
    } else {
      console.error('✗ Backup creation failed:', backupResult.error);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('✗ Test failed:', error);
    return false;
  } finally {
    await cleanup(testUserDataPath);
  }
}

/**
 * Test window state backup
 */
async function testWindowStateBackup() {
  console.log('\n=== Test 4: Window State Backup ===');
  
  const testUserDataPath = path.join(__dirname, '..', 'test-user-data-window');
  
  try {
    // Create test old config
    await createTestOldConfig(testUserDataPath);
    
    // Create migration manager
    const migrationManager = new MigrationManager({
      userDataPath: testUserDataPath
    });
    
    // Read config
    const configResult = await migrationManager.readOldConfig();
    
    if (!configResult.success) {
      console.error('✗ Failed to read config:', configResult.error);
      return false;
    }
    
    // Test window state backup
    const windowBackupResult = await migrationManager.createWindowStateBackup(configResult.data);
    
    console.log('Window state backup result:', windowBackupResult);
    
    if (windowBackupResult.success && windowBackupResult.backupPath) {
      console.log('✓ Window state backup created successfully');
      
      // Verify backup file exists and contains data
      const backupContent = await fs.readFile(windowBackupResult.backupPath, 'utf-8');
      const backupData = JSON.parse(backupContent);
      
      console.log('Backed up window states:', Object.keys(backupData));
      
      if (Object.keys(backupData).length > 0) {
        console.log('✓ Window state backup contains data');
      } else {
        console.error('✗ Window state backup is empty');
        return false;
      }
    } else {
      console.error('✗ Window state backup creation failed:', windowBackupResult.error);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('✗ Test failed:', error);
    return false;
  } finally {
    await cleanup(testUserDataPath);
  }
}

/**
 * Test migration log creation
 */
async function testMigrationLog() {
  console.log('\n=== Test 5: Migration Log Creation ===');
  
  const testUserDataPath = path.join(__dirname, '..', 'test-user-data-log');
  
  try {
    // Create test old config
    await createTestOldConfig(testUserDataPath);
    
    // Create migration manager
    const migrationManager = new MigrationManager({
      userDataPath: testUserDataPath
    });
    
    // Read config
    const configResult = await migrationManager.readOldConfig();
    
    if (!configResult.success) {
      console.error('✗ Failed to read config:', configResult.error);
      return false;
    }
    
    // Test log creation
    const logResult = await migrationManager.logMigrationStart(configResult.data);
    
    console.log('Migration log result:', logResult);
    
    if (logResult.success && logResult.logPath) {
      console.log('✓ Migration log created successfully');
      
      // Verify log file exists and contains data
      const logContent = await fs.readFile(logResult.logPath, 'utf-8');
      
      if (logContent.includes('Migration Start Time') && logContent.includes('Account IDs')) {
        console.log('✓ Migration log contains expected content');
      } else {
        console.error('✗ Migration log missing expected content');
        return false;
      }
    } else {
      console.error('✗ Migration log creation failed:', logResult.error);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('✗ Test failed:', error);
    return false;
  } finally {
    await cleanup(testUserDataPath);
  }
}

/**
 * Test complete detection and backup flow
 */
async function testCompleteFlow() {
  console.log('\n=== Test 6: Complete Detection and Backup Flow ===');
  
  const testUserDataPath = path.join(__dirname, '..', 'test-user-data-complete');
  
  try {
    // Create test old config
    await createTestOldConfig(testUserDataPath);
    
    // Create migration manager
    const migrationManager = new MigrationManager({
      userDataPath: testUserDataPath
    });
    
    // Test complete flow
    const result = await migrationManager.detectAndBackup();
    
    console.log('Complete flow result:', {
      needed: result.needed,
      success: result.success,
      backupPath: result.backupPath,
      errors: result.errors,
      warnings: result.warnings
    });
    
    if (result.needed && result.success) {
      console.log('✓ Complete flow executed successfully');
      
      // Verify backup was created
      if (result.backupPath) {
        const backupExists = await fs.access(result.backupPath)
          .then(() => true)
          .catch(() => false);
        
        if (backupExists) {
          console.log('✓ Backup file created');
        } else {
          console.error('✗ Backup file not found');
          return false;
        }
      }
      
      // Check for errors
      if (result.errors.length > 0) {
        console.error('✗ Flow completed with errors:', result.errors);
        return false;
      }
      
      // Warnings are acceptable
      if (result.warnings.length > 0) {
        console.log('⚠ Flow completed with warnings:', result.warnings);
      }
      
    } else if (!result.needed) {
      console.error('✗ Migration should be needed but was not detected');
      return false;
    } else {
      console.error('✗ Complete flow failed');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('✗ Test failed:', error);
    return false;
  } finally {
    await cleanup(testUserDataPath);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('Starting MigrationManager tests...\n');
  
  const tests = [
    { name: 'Detection with Old Config', fn: testDetectionWithOldConfig },
    { name: 'Detection with New Config', fn: testDetectionWithNewConfig },
    { name: 'Backup Creation', fn: testBackupCreation },
    { name: 'Window State Backup', fn: testWindowStateBackup },
    { name: 'Migration Log Creation', fn: testMigrationLog },
    { name: 'Complete Flow', fn: testCompleteFlow }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`✗ Test "${test.name}" threw an error:`, error);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Test Results:');
  console.log(`  Passed: ${passed}/${tests.length}`);
  console.log(`  Failed: ${failed}/${tests.length}`);
  console.log('='.repeat(60));
  
  if (failed === 0) {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n✗ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
