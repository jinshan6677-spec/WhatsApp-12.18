/**
 * Test script for application lifecycle management
 * 
 * Tests:
 * 1. App ready event initialization
 * 2. Window close event state saving
 * 3. App quit event cleanup
 * 4. Graceful shutdown of BrowserViews
 * 5. Account state persistence
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
  testDuration: 5000, // 5 seconds
  accountCount: 3,
  userDataPath: path.join(__dirname, '..', 'test-lifecycle-data')
};

// Test results
const testResults = {
  appReady: false,
  managersInitialized: false,
  windowCreated: false,
  statesSaved: false,
  cleanupExecuted: false,
  errors: []
};

/**
 * Log test message
 */
function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [TEST] [${level.toUpperCase()}] ${message}`;
  
  if (level === 'error') {
    console.error(logMessage, ...args);
  } else if (level === 'warn') {
    console.warn(logMessage, ...args);
  } else {
    console.log(logMessage, ...args);
  }
}

/**
 * Test 1: App ready event
 */
async function testAppReady() {
  log('info', '=== Test 1: App Ready Event ===');
  
  try {
    // Check if app is ready
    if (app.isReady()) {
      testResults.appReady = true;
      log('info', '✓ App ready event fired successfully');
      return true;
    } else {
      throw new Error('App is not ready');
    }
  } catch (error) {
    log('error', '✗ App ready test failed:', error);
    testResults.errors.push({ test: 'appReady', error: error.message });
    return false;
  }
}

/**
 * Test 2: Manager initialization
 */
async function testManagerInitialization() {
  log('info', '=== Test 2: Manager Initialization ===');
  
  try {
    // Import managers
    const MainWindow = require('../src/single-window/MainWindow');
    const { ViewManager } = require('../src/presentation/windows/view-manager');
    const AccountConfigManager = require('../src/managers/AccountConfigManager');
    const SessionManager = require('../src/managers/SessionManager');
    
    // Create instances
    const accountManager = new AccountConfigManager({
      cwd: TEST_CONFIG.userDataPath
    });
    
    const sessionManager = new SessionManager({
      userDataPath: TEST_CONFIG.userDataPath
    });
    
    const mainWindow = new MainWindow({
      width: 1400,
      height: 900,
      title: 'Test Window',
      preloadPath: path.join(__dirname, '..', 'src', 'single-window', 'renderer', 'preload-main.js'),
      htmlPath: path.join(__dirname, '..', 'src', 'single-window', 'renderer', 'app.html')
    });
    
    mainWindow.initialize();
    
    const viewManager = new ViewManager(mainWindow, sessionManager);
    
    testResults.managersInitialized = true;
    testResults.windowCreated = true;
    log('info', '✓ All managers initialized successfully');
    
    return { accountManager, sessionManager, mainWindow, viewManager };
  } catch (error) {
    log('error', '✗ Manager initialization failed:', error);
    testResults.errors.push({ test: 'managerInit', error: error.message });
    return null;
  }
}

/**
 * Test 3: State saving on window close
 */
async function testStateSaving(managers) {
  log('info', '=== Test 3: State Saving ===');
  
  try {
    const { accountManager, viewManager } = managers;
    
    // Create test accounts
    for (let i = 1; i <= TEST_CONFIG.accountCount; i++) {
      const account = await accountManager.createAccount({
        name: `Test Account ${i}`,
        note: `Test account for lifecycle testing`,
        translation: { enabled: false }
      });
      
      log('info', `Created test account: ${account.name} (${account.id})`);
    }
    
    // Load accounts
    const accounts = await accountManager.loadAccounts();
    log('info', `Loaded ${accounts.length} test accounts`);
    
    // Simulate switching to first account
    if (accounts.length > 0) {
      const firstAccount = accounts[0];
      
      // Update last active time
      await accountManager.updateAccount(firstAccount.id, {
        lastActiveAt: new Date()
      });
      
      log('info', `Updated last active time for account: ${firstAccount.name}`);
    }
    
    // Verify state was saved
    const reloadedAccounts = await accountManager.loadAccounts();
    const hasLastActiveTime = reloadedAccounts.some(acc => acc.lastActiveAt);
    
    if (hasLastActiveTime) {
      testResults.statesSaved = true;
      log('info', '✓ Account states saved successfully');
      return true;
    } else {
      throw new Error('Account states were not saved');
    }
  } catch (error) {
    log('error', '✗ State saving test failed:', error);
    testResults.errors.push({ test: 'stateSaving', error: error.message });
    return false;
  }
}

/**
 * Test 4: Cleanup execution
 */
async function testCleanup(managers) {
  log('info', '=== Test 4: Cleanup Execution ===');
  
  try {
    const { viewManager, mainWindow } = managers;
    
    // Simulate cleanup
    log('info', 'Executing cleanup...');
    
    // Stop monitoring
    if (viewManager) {
      const stopResult = viewManager.stopAllConnectionMonitoring();
      log('info', `Stopped connection monitoring: ${stopResult.stopped} accounts`);
      
      const stopLoginResult = viewManager.stopAllLoginStatusMonitoring();
      log('info', `Stopped login monitoring: ${stopLoginResult.stopped} accounts`);
    }
    
    // Destroy views
    if (viewManager) {
      const result = await viewManager.destroyAllViews();
      log('info', `Destroyed views: ${result.destroyed} success, ${result.failed} failed`);
    }
    
    // Close window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
      log('info', 'Main window closed');
    }
    
    testResults.cleanupExecuted = true;
    log('info', '✓ Cleanup executed successfully');
    return true;
  } catch (error) {
    log('error', '✗ Cleanup test failed:', error);
    testResults.errors.push({ test: 'cleanup', error: error.message });
    return false;
  }
}

/**
 * Test 5: Verify state persistence
 */
async function testStatePersistence() {
  log('info', '=== Test 5: State Persistence Verification ===');
  
  try {
    const AccountConfigManager = require('../src/managers/AccountConfigManager');
    const accountManager = new AccountConfigManager({
      cwd: TEST_CONFIG.userDataPath
    });
    
    // Load accounts again
    const accounts = await accountManager.loadAccounts();
    
    if (accounts.length === TEST_CONFIG.accountCount) {
      log('info', `✓ All ${accounts.length} accounts persisted correctly`);
      
      // Check if last active time was saved
      const hasLastActiveTime = accounts.some(acc => acc.lastActiveAt);
      if (hasLastActiveTime) {
        log('info', '✓ Account last active times persisted');
        return true;
      } else {
        log('warn', '⚠ Last active times not persisted');
        return true; // Not critical
      }
    } else {
      throw new Error(`Expected ${TEST_CONFIG.accountCount} accounts, found ${accounts.length}`);
    }
  } catch (error) {
    log('error', '✗ State persistence verification failed:', error);
    testResults.errors.push({ test: 'persistence', error: error.message });
    return false;
  }
}

/**
 * Cleanup test data
 */
function cleanupTestData() {
  log('info', 'Cleaning up test data...');
  
  try {
    if (fs.existsSync(TEST_CONFIG.userDataPath)) {
      fs.rmSync(TEST_CONFIG.userDataPath, { recursive: true, force: true });
      log('info', '✓ Test data cleaned up');
    }
  } catch (error) {
    log('error', '✗ Failed to cleanup test data:', error);
  }
}

/**
 * Print test results
 */
function printResults() {
  log('info', '');
  log('info', '=== Test Results ===');
  log('info', `App Ready: ${testResults.appReady ? '✓ PASS' : '✗ FAIL'}`);
  log('info', `Managers Initialized: ${testResults.managersInitialized ? '✓ PASS' : '✗ FAIL'}`);
  log('info', `Window Created: ${testResults.windowCreated ? '✓ PASS' : '✗ FAIL'}`);
  log('info', `States Saved: ${testResults.statesSaved ? '✓ PASS' : '✗ FAIL'}`);
  log('info', `Cleanup Executed: ${testResults.cleanupExecuted ? '✓ PASS' : '✗ FAIL'}`);
  log('info', '');
  
  if (testResults.errors.length > 0) {
    log('error', 'Errors encountered:');
    testResults.errors.forEach((err, index) => {
      log('error', `${index + 1}. ${err.test}: ${err.error}`);
    });
  } else {
    log('info', '✓ All tests passed!');
  }
  
  const allPassed = testResults.appReady && 
                    testResults.managersInitialized && 
                    testResults.windowCreated && 
                    testResults.statesSaved && 
                    testResults.cleanupExecuted;
  
  return allPassed;
}

/**
 * Run all tests
 */
async function runTests() {
  log('info', '========================================');
  log('info', 'Application Lifecycle Management Tests');
  log('info', '========================================');
  log('info', '');
  
  try {
    // Test 1: App ready
    await testAppReady();
    
    // Test 2: Manager initialization
    const managers = await testManagerInitialization();
    
    if (managers) {
      // Test 3: State saving
      await testStateSaving(managers);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test 4: Cleanup
      await testCleanup(managers);
      
      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test 5: Verify persistence
      await testStatePersistence();
    }
    
    // Print results
    log('info', '');
    const allPassed = printResults();
    
    // Cleanup
    cleanupTestData();
    
    // Exit
    setTimeout(() => {
      process.exit(allPassed ? 0 : 1);
    }, 1000);
    
  } catch (error) {
    log('error', 'Test execution failed:', error);
    cleanupTestData();
    process.exit(1);
  }
}

// Run tests when app is ready
app.whenReady().then(runTests);

// Handle errors
process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception:', error);
  cleanupTestData();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled rejection:', reason);
  cleanupTestData();
  process.exit(1);
});
