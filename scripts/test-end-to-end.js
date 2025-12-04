/**
 * End-to-End Testing Script
 * Tests all major features of the single-window multi-account architecture
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
  accountCount: 12, // Test with 10+ accounts
  testTimeout: 60000,
  performanceThresholds: {
    viewSwitchMs: 100,
    memoryPerViewMB: 250,
    totalMemoryMB: 3000
  }
};

// Test results
const testResults = {
  passed: [],
  failed: [],
  warnings: [],
  performance: {}
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '✓',
    error: '✗',
    warn: '⚠',
    test: '→'
  }[type] || '•';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function recordResult(testName, passed, error = null) {
  if (passed) {
    testResults.passed.push(testName);
    log(`PASS: ${testName}`, 'info');
  } else {
    testResults.failed.push({ test: testName, error: error?.message || 'Unknown error' });
    log(`FAIL: ${testName} - ${error?.message || 'Unknown error'}`, 'error');
  }
}

function recordWarning(message) {
  testResults.warnings.push(message);
  log(`WARNING: ${message}`, 'warn');
}

// Test 1: Application Launch
async function testApplicationLaunch() {
  log('Testing application launch...', 'test');
  
  try {
    await app.whenReady();
    recordResult('Application Launch', true);
    return true;
  } catch (error) {
    recordResult('Application Launch', false, error);
    return false;
  }
}

// Test 2: Main Window Creation
async function testMainWindowCreation() {
  log('Testing main window creation...', 'test');
  
  try {
    const MainWindow = require('../src/single-window/MainWindow');
    const mainWindow = new MainWindow({
      width: 1400,
      height: 900
    });
    
    await mainWindow.initialize();
    
    const window = mainWindow.getWindow();
    if (!window) {
      throw new Error('Main window not created');
    }
    
    if (window.isDestroyed()) {
      throw new Error('Main window is destroyed');
    }
    
    const bounds = window.getBounds();
    if (bounds.width < 1000 || bounds.height < 600) {
      recordWarning('Window size below minimum threshold');
    }
    
    recordResult('Main Window Creation', true);
    return mainWindow;
  } catch (error) {
    recordResult('Main Window Creation', false, error);
    return null;
  }
}

// Test 3: Account Manager Operations
async function testAccountManager() {
  log('Testing account manager CRUD operations...', 'test');
  
  try {
    const AccountConfigManager = require('../src/managers/AccountConfigManager');
    const accountManager = new AccountConfigManager();
    
    // Test account creation
    const testAccount = {
      name: 'Test Account E2E',
      note: 'End-to-end test account',
      translation: {
        enabled: true,
        targetLanguage: 'zh-CN'
      }
    };
    
    const account = await accountManager.createAccount(testAccount);
    if (!account || !account.id) {
      throw new Error('Account creation failed');
    }
    
    // Test account retrieval
    const retrieved = accountManager.getAccount(account.id);
    if (!retrieved || retrieved.id !== account.id) {
      throw new Error('Account retrieval failed');
    }
    
    // Test account update
    await accountManager.updateAccount(account.id, { name: 'Updated Test Account' });
    const updated = accountManager.getAccount(account.id);
    if (updated.name !== 'Updated Test Account') {
      throw new Error('Account update failed');
    }
    
    // Test account deletion
    await accountManager.deleteAccount(account.id, { deleteSessionData: true });
    const deleted = accountManager.getAccount(account.id);
    if (deleted) {
      throw new Error('Account deletion failed');
    }
    
    recordResult('Account Manager CRUD', true);
    return accountManager;
  } catch (error) {
    recordResult('Account Manager CRUD', false, error);
    return null;
  }
}

// Test 4: Multiple Account Creation
async function testMultipleAccounts(accountManager) {
  log(`Testing creation of ${TEST_CONFIG.accountCount} accounts...`, 'test');
  
  try {
    const accounts = [];
    
    for (let i = 0; i < TEST_CONFIG.accountCount; i++) {
      const account = await accountManager.createAccount({
        name: `Test Account ${i + 1}`,
        note: `Performance test account ${i + 1}`,
        translation: {
          enabled: true,
          targetLanguage: 'zh-CN'
        }
      });
      
      accounts.push(account);
    }
    
    if (accounts.length !== TEST_CONFIG.accountCount) {
      throw new Error(`Expected ${TEST_CONFIG.accountCount} accounts, got ${accounts.length}`);
    }
    
    recordResult(`Multiple Account Creation (${TEST_CONFIG.accountCount})`, true);
    return accounts;
  } catch (error) {
    recordResult(`Multiple Account Creation (${TEST_CONFIG.accountCount})`, false, error);
    return [];
  }
}

// Test 5: Session Manager
async function testSessionManager(accounts) {
  log('Testing session manager...', 'test');
  
  try {
    const SessionManager = require('../src/managers/SessionManager');
    const sessionManager = new SessionManager();
    
    // Test session creation for first account
    if (accounts.length === 0) {
      throw new Error('No accounts available for testing');
    }
    
    const account = accounts[0];
    const session = sessionManager.createSession(account.id, account);
    
    if (!session) {
      throw new Error('Session creation failed');
    }
    
    // Verify session isolation
    const partition = session.partition;
    if (!partition || !partition.includes(account.id)) {
      throw new Error('Session partition not properly isolated');
    }
    
    recordResult('Session Manager', true);
    return sessionManager;
  } catch (error) {
    recordResult('Session Manager', false, error);
    return null;
  }
}

// Test 6: View Manager
async function testViewManager(mainWindow, sessionManager, accounts) {
  log('Testing view manager...', 'test');
  
  try {
    const { ViewManager } = require('../src/presentation/windows/view-manager');
    const viewManager = new ViewManager(mainWindow, sessionManager);
    
    if (accounts.length === 0) {
      throw new Error('No accounts available for testing');
    }
    
    // Test view creation
    const account = accounts[0];
    const view = await viewManager.createView(account.id, account);
    
    if (!view) {
      throw new Error('View creation failed');
    }
    
    // Test view showing
    await viewManager.showView(account.id);
    const activeView = viewManager.getActiveView();
    
    if (!activeView || activeView.accountId !== account.id) {
      throw new Error('View activation failed');
    }
    
    recordResult('View Manager', true);
    return viewManager;
  } catch (error) {
    recordResult('View Manager', false, error);
    return null;
  }
}

// Test 7: View Switching Performance
async function testViewSwitchingPerformance(viewManager, accounts) {
  log('Testing view switching performance...', 'test');
  
  try {
    if (accounts.length < 3) {
      recordWarning('Not enough accounts for view switching test');
      return;
    }
    
    const switchTimes = [];
    
    // Create views for first 3 accounts
    for (let i = 0; i < Math.min(3, accounts.length); i++) {
      await viewManager.createView(accounts[i].id, accounts[i]);
    }
    
    // Test switching between views
    for (let i = 0; i < Math.min(3, accounts.length); i++) {
      const startTime = Date.now();
      await viewManager.showView(accounts[i].id);
      const endTime = Date.now();
      
      const switchTime = endTime - startTime;
      switchTimes.push(switchTime);
      
      if (switchTime > TEST_CONFIG.performanceThresholds.viewSwitchMs) {
        recordWarning(`View switch took ${switchTime}ms (threshold: ${TEST_CONFIG.performanceThresholds.viewSwitchMs}ms)`);
      }
    }
    
    const avgSwitchTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;
    testResults.performance.avgViewSwitchMs = avgSwitchTime;
    
    log(`Average view switch time: ${avgSwitchTime.toFixed(2)}ms`);
    
    recordResult('View Switching Performance', avgSwitchTime <= TEST_CONFIG.performanceThresholds.viewSwitchMs);
  } catch (error) {
    recordResult('View Switching Performance', false, error);
  }
}

// Test 8: Memory Usage
async function testMemoryUsage(viewManager, accounts) {
  log('Testing memory usage...', 'test');
  
  try {
    const initialMemory = process.memoryUsage();
    
    // Create views for all accounts
    for (const account of accounts) {
      await viewManager.createView(account.id, account);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const finalMemory = process.memoryUsage();
    const memoryIncreaseMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
    const totalMemoryMB = finalMemory.heapUsed / 1024 / 1024;
    
    testResults.performance.memoryIncreaseMB = memoryIncreaseMB;
    testResults.performance.totalMemoryMB = totalMemoryMB;
    testResults.performance.memoryPerViewMB = memoryIncreaseMB / accounts.length;
    
    log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
    log(`Total memory: ${totalMemoryMB.toFixed(2)}MB`);
    log(`Memory per view: ${(memoryIncreaseMB / accounts.length).toFixed(2)}MB`);
    
    if (totalMemoryMB > TEST_CONFIG.performanceThresholds.totalMemoryMB) {
      recordWarning(`Total memory ${totalMemoryMB.toFixed(2)}MB exceeds threshold ${TEST_CONFIG.performanceThresholds.totalMemoryMB}MB`);
    }
    
    recordResult('Memory Usage', totalMemoryMB <= TEST_CONFIG.performanceThresholds.totalMemoryMB);
  } catch (error) {
    recordResult('Memory Usage', false, error);
  }
}


// Test 10: Translation Configuration
async function testTranslationConfiguration(accountManager) {
  log('Testing translation configuration...', 'test');
  
  try {
    const testAccount = await accountManager.createAccount({
      name: 'Translation Test Account',
      translation: {
        enabled: true,
        targetLanguage: 'zh-CN',
        engine: 'google',
        autoTranslate: false
      }
    });
    
    const account = accountManager.getAccount(testAccount.id);
    
    if (!account.translation || account.translation.targetLanguage !== 'zh-CN') {
      throw new Error('Translation configuration not saved correctly');
    }
    
    // Test update
    await accountManager.updateAccount(testAccount.id, {
      translation: {
        ...account.translation,
        targetLanguage: 'ja'
      }
    });
    
    const updated = accountManager.getAccount(testAccount.id);
    if (updated.translation.targetLanguage !== 'ja') {
      throw new Error('Translation configuration update failed');
    }
    
    // Clean up
    await accountManager.deleteAccount(testAccount.id, { deleteSessionData: true });
    
    recordResult('Translation Configuration', true);
  } catch (error) {
    recordResult('Translation Configuration', false, error);
  }
}

// Test 11: Error Handling
async function testErrorHandling(accountManager) {
  log('Testing error handling...', 'test');
  
  try {
    // Test invalid account creation
    try {
      await accountManager.createAccount({
        name: '', // Invalid: empty name
      });
      throw new Error('Should have thrown validation error');
    } catch (error) {
      if (!error.message.includes('name')) {
        throw new Error('Wrong error type for invalid account');
      }
    }
    
    // Test non-existent account retrieval
    const nonExistent = accountManager.getAccount('non-existent-id');
    if (nonExistent) {
      throw new Error('Should return null for non-existent account');
    }
    
    // Test duplicate account name
    const account1 = await accountManager.createAccount({ name: 'Duplicate Test' });
    try {
      await accountManager.createAccount({ name: 'Duplicate Test' });
      recordWarning('Duplicate account names allowed (may be intentional)');
    } catch (error) {
      // Expected behavior
    }
    
    await accountManager.deleteAccount(account1.id, { deleteSessionData: true });
    
    recordResult('Error Handling', true);
  } catch (error) {
    recordResult('Error Handling', false, error);
  }
}

// Test 12: State Persistence
async function testStatePersistence(accountManager) {
  log('Testing state persistence...', 'test');
  
  try {
    const testAccount = await accountManager.createAccount({
      name: 'Persistence Test',
      note: 'Testing state persistence'
    });
    
    // Simulate app restart by creating new manager instance
    const newManager = new AccountConfigManager();
    const retrieved = newManager.getAccount(testAccount.id);
    
    if (!retrieved || retrieved.name !== 'Persistence Test') {
      throw new Error('Account not persisted correctly');
    }
    
    // Clean up
    await newManager.deleteAccount(testAccount.id, { deleteSessionData: true });
    
    recordResult('State Persistence', true);
  } catch (error) {
    recordResult('State Persistence', false, error);
  }
}

// Test 13: Migration Detection
async function testMigrationDetection() {
  log('Testing migration detection...', 'test');
  
  try {
    const MigrationManager = require('../src/single-window/migration/MigrationManager');
    const migrationManager = new MigrationManager();
    
    // Check if migration detection works
    const needsMigration = migrationManager.needsMigration();
    
    log(`Migration needed: ${needsMigration}`);
    
    recordResult('Migration Detection', true);
  } catch (error) {
    recordResult('Migration Detection', false, error);
  }
}

// Generate test report
function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('END-TO-END TEST REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n✓ PASSED: ${testResults.passed.length}`);
  testResults.passed.forEach(test => {
    console.log(`  - ${test}`);
  });
  
  if (testResults.failed.length > 0) {
    console.log(`\n✗ FAILED: ${testResults.failed.length}`);
    testResults.failed.forEach(({ test, error }) => {
      console.log(`  - ${test}: ${error}`);
    });
  }
  
  if (testResults.warnings.length > 0) {
    console.log(`\n⚠ WARNINGS: ${testResults.warnings.length}`);
    testResults.warnings.forEach(warning => {
      console.log(`  - ${warning}`);
    });
  }
  
  if (Object.keys(testResults.performance).length > 0) {
    console.log('\n📊 PERFORMANCE METRICS:');
    Object.entries(testResults.performance).forEach(([key, value]) => {
      console.log(`  - ${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`);
    });
  }
  
  const totalTests = testResults.passed.length + testResults.failed.length;
  const passRate = (testResults.passed.length / totalTests * 100).toFixed(2);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TOTAL: ${totalTests} tests, ${passRate}% pass rate`);
  console.log('='.repeat(80) + '\n');
  
  return testResults.failed.length === 0;
}

// Main test execution
async function runTests() {
  log('Starting end-to-end tests...', 'test');
  
  try {
    // Test 1: Application Launch
    const launched = await testApplicationLaunch();
    if (!launched) {
      throw new Error('Application failed to launch');
    }
    
    // Test 2: Main Window
    const mainWindow = await testMainWindowCreation();
    if (!mainWindow) {
      throw new Error('Main window creation failed');
    }
    
    // Test 3: Account Manager
    const accountManager = await testAccountManager();
    if (!accountManager) {
      throw new Error('Account manager initialization failed');
    }
    
    // Test 4: Multiple Accounts
    const accounts = await testMultipleAccounts(accountManager);
    
    // Test 5: Session Manager
    const sessionManager = await testSessionManager(accounts);
    
    // Test 6: View Manager
    const viewManager = await testViewManager(mainWindow, sessionManager, accounts);
    
    // Test 7: View Switching Performance
    if (viewManager) {
      await testViewSwitchingPerformance(viewManager, accounts);
    }
    
    // Test 8: Memory Usage
    if (viewManager) {
      await testMemoryUsage(viewManager, accounts);
    }
    
    
    
    // Test 10: Translation Configuration
    await testTranslationConfiguration(accountManager);
    
    // Test 11: Error Handling
    await testErrorHandling(accountManager);
    
    // Test 12: State Persistence
    await testStatePersistence(accountManager);
    
    // Test 13: Migration Detection
    await testMigrationDetection();
    
    // Clean up test accounts
    log('Cleaning up test accounts...', 'test');
    for (const account of accounts) {
      try {
        await accountManager.deleteAccount(account.id, { deleteSessionData: true });
      } catch (error) {
        recordWarning(`Failed to clean up account ${account.id}: ${error.message}`);
      }
    }
    
    // Generate report
    const allPassed = generateReport();
    
    // Exit
    setTimeout(() => {
      app.quit();
      process.exit(allPassed ? 0 : 1);
    }, 1000);
    
  } catch (error) {
    log(`Fatal error during testing: ${error.message}`, 'error');
    console.error(error);
    
    setTimeout(() => {
      app.quit();
      process.exit(1);
    }, 1000);
  }
}

// Run tests when app is ready
app.whenReady().then(runTests);

// Handle errors
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`, 'error');
  console.error(error);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection: ${reason}`, 'error');
  console.error(reason);
});
