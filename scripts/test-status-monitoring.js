/**
 * Test script for account status monitoring
 * 
 * This script tests the connection status monitoring functionality
 * for the single-window architecture.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Import required managers
const AccountConfigManager = require('../src/managers/AccountConfigManager');
const SessionManager = require('../src/managers/SessionManager');
const MainWindow = require('../src/single-window/MainWindow');
const { ViewManager } = require('../src/presentation/windows/view-manager');

let mainWindow;
let accountManager;
let sessionManager;
let viewManager;

/**
 * Initialize the test environment
 */
async function initialize() {
  console.log('=== Initializing Status Monitoring Test ===\n');

  // Create managers
  accountManager = new AccountConfigManager({
    configName: 'accounts-test',
    cwd: path.join(app.getPath('userData'), 'test')
  });

  sessionManager = new SessionManager({
    userDataPath: app.getPath('userData')
  });

  mainWindow = new MainWindow({
    show: false // Don't show window during test
  });

  viewManager = new ViewManager(mainWindow, sessionManager);

  console.log('✓ Managers initialized\n');
}

/**
 * Test 1: Create test account and view
 */
async function testCreateAccountAndView() {
  console.log('=== Test 1: Create Account and View ===');

  try {
    // Create test account
    const accountConfig = {
      name: 'Status Test Account',
      note: 'Testing connection status monitoring',
      translation: {
        enabled: false
      }
    };

    const result = await accountManager.createAccount(accountConfig);
    
    if (!result.success) {
      throw new Error(`Failed to create account: ${result.errors.join(', ')}`);
    }

    const account = result.account;
    console.log(`✓ Created test account: ${account.id}`);

    // Create view for the account
    const view = await viewManager.createView(account.id, {
      url: 'https://web.whatsapp.com',
      translation: account.translation
    });

    console.log(`✓ Created view for account: ${account.id}`);

    // Get initial view state
    const viewState = viewManager.getViewState(account.id);
    console.log(`  - Status: ${viewState.status}`);
    console.log(`  - Connection Status: ${viewState.connectionStatus}`);
    console.log(`  - Login Status: ${viewState.loginStatus}`);

    return account.id;
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    throw error;
  }
}

/**
 * Test 2: Check connection status
 */
async function testCheckConnectionStatus(accountId) {
  console.log('\n=== Test 2: Check Connection Status ===');

  try {
    // Wait for view to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check connection status
    const result = await viewManager.checkConnectionStatus(accountId);

    if (!result.success) {
      throw new Error(`Failed to check connection status: ${result.error}`);
    }

    console.log(`✓ Connection status checked for account: ${accountId}`);
    console.log(`  - Connection Status: ${result.connectionStatus}`);
    console.log(`  - Timestamp: ${new Date(result.timestamp).toISOString()}`);
    
    if (result.error) {
      console.log(`  - Error: ${result.error.message}`);
    }

    return result;
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    throw error;
  }
}

/**
 * Test 3: Start connection monitoring
 */
async function testStartConnectionMonitoring(accountId) {
  console.log('\n=== Test 3: Start Connection Monitoring ===');

  try {
    // Start monitoring with 10 second interval
    const monitor = viewManager.startConnectionMonitoring(accountId, {
      interval: 10000
    });

    if (!monitor) {
      throw new Error('Failed to start connection monitoring');
    }

    console.log(`✓ Connection monitoring started for account: ${accountId}`);
    console.log(`  - Interval: ${monitor.interval}ms`);
    console.log(`  - Started at: ${new Date(monitor.startedAt).toISOString()}`);

    // Wait for a few monitoring cycles
    console.log('  - Waiting for monitoring cycles...');
    await new Promise(resolve => setTimeout(resolve, 25000));

    // Get current status
    const connectionStatus = viewManager.getConnectionStatus(accountId);
    const connectionError = viewManager.getConnectionError(accountId);
    const viewState = viewManager.getViewState(accountId);

    console.log(`✓ Monitoring results after 25 seconds:`);
    console.log(`  - Connection Status: ${connectionStatus}`);
    console.log(`  - Last Check: ${viewState.lastConnectionCheck ? new Date(viewState.lastConnectionCheck).toISOString() : 'Never'}`);
    
    if (connectionError) {
      console.log(`  - Error: ${connectionError.message}`);
    }

    return monitor;
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    throw error;
  }
}

/**
 * Test 4: Stop connection monitoring
 */
async function testStopConnectionMonitoring(accountId, monitor) {
  console.log('\n=== Test 4: Stop Connection Monitoring ===');

  try {
    // Stop monitoring
    const success = viewManager.stopConnectionMonitoring(accountId);

    if (!success) {
      throw new Error('Failed to stop connection monitoring');
    }

    console.log(`✓ Connection monitoring stopped for account: ${accountId}`);

    // Verify monitoring stopped
    const viewState = viewManager.getViewState(accountId);
    if (viewState.connectionMonitor) {
      throw new Error('Connection monitor still active');
    }

    console.log('✓ Verified monitoring stopped');

    return true;
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    throw error;
  }
}

/**
 * Test 5: Get connection status via getter
 */
async function testGetConnectionStatus(accountId) {
  console.log('\n=== Test 5: Get Connection Status ===');

  try {
    const connectionStatus = viewManager.getConnectionStatus(accountId);
    const connectionError = viewManager.getConnectionError(accountId);

    console.log(`✓ Retrieved connection status for account: ${accountId}`);
    console.log(`  - Status: ${connectionStatus}`);
    
    if (connectionError) {
      console.log(`  - Error: ${connectionError.message}`);
      console.log(`  - Error Timestamp: ${new Date(connectionError.timestamp).toISOString()}`);
    }

    return { connectionStatus, connectionError };
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    throw error;
  }
}

/**
 * Cleanup test resources
 */
async function cleanup(accountId) {
  console.log('\n=== Cleanup ===');

  try {
    // Destroy view
    if (accountId && viewManager.hasView(accountId)) {
      await viewManager.destroyView(accountId);
      console.log(`✓ Destroyed view for account: ${accountId}`);
    }

    // Delete test account
    if (accountId && accountManager.accountExists(accountId)) {
      await accountManager.deleteAccount(accountId);
      console.log(`✓ Deleted test account: ${accountId}`);
    }

    // Close main window
    if (mainWindow) {
      mainWindow.close();
      console.log('✓ Closed main window');
    }

    console.log('\n✓ Cleanup complete');
  } catch (error) {
    console.error('✗ Cleanup failed:', error.message);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  let accountId;

  try {
    await initialize();

    // Run tests
    accountId = await testCreateAccountAndView();
    await testCheckConnectionStatus(accountId);
    const monitor = await testStartConnectionMonitoring(accountId);
    await testStopConnectionMonitoring(accountId, monitor);
    await testGetConnectionStatus(accountId);

    console.log('\n=== All Tests Passed ===\n');
  } catch (error) {
    console.error('\n=== Tests Failed ===');
    console.error(error);
  } finally {
    await cleanup(accountId);
    
    // Exit after a short delay
    setTimeout(() => {
      app.quit();
    }, 1000);
  }
}

// Run tests when app is ready
app.whenReady().then(() => {
  runTests();
});

// Handle app quit
app.on('window-all-closed', () => {
  // Don't quit on macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
