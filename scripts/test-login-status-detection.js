/**
 * Test script for login status detection
 * 
 * This script tests the login status detection functionality:
 * - QR code detection (not logged in)
 * - Chat list detection (logged in)
 * - Status updates in sidebar
 * - Login prompt display
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Import managers
const AccountConfigManager = require('../src/managers/AccountConfigManager');
const SessionManager = require('../src/managers/SessionManager');
const MainWindow = require('../src/single-window/MainWindow');
const { ViewManager } = require('../src/presentation/windows/view-manager');

let mainWindow;
let viewManager;
let accountManager;
let sessionManager;

/**
 * Initialize the application
 */
async function initialize() {
  console.log('\n=== Login Status Detection Test ===\n');

  try {
    // Initialize managers
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'accounts.json');

    accountManager = new AccountConfigManager(configPath);
    await accountManager.loadAccounts();

    sessionManager = new SessionManager({ userDataPath });

    // Create main window
    mainWindow = new MainWindow({
      width: 1400,
      height: 900
    });

    await mainWindow.initialize();

    // Create view manager
    viewManager = new ViewManager(mainWindow, sessionManager);

    console.log('✓ Managers initialized\n');

    // Run tests
    await runTests();

  } catch (error) {
    console.error('✗ Initialization failed:', error);
    app.quit();
  }
}

/**
 * Run login status detection tests
 */
async function runTests() {
  console.log('Running login status detection tests...\n');

  try {
    // Test 1: Get accounts
    console.log('Test 1: Loading accounts...');
    const accounts = await accountManager.getAccountsSorted();
    
    if (accounts.length === 0) {
      console.log('✗ No accounts found. Please create at least one account first.');
      app.quit();
      return;
    }

    console.log(`✓ Found ${accounts.length} account(s)\n`);

    // Test 2: Create views and detect login status
    console.log('Test 2: Creating views and detecting login status...');
    
    for (const account of accounts.slice(0, 3)) { // Test first 3 accounts
      console.log(`\n  Account: ${account.name} (${account.id})`);
      
      try {
        // Create view
        const view = await viewManager.createView(account.id, {
          url: 'https://web.whatsapp.com',
          translation: account.translation
        });

        console.log('  ✓ View created');

        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check login status
        const loginResult = await viewManager.checkLoginStatus(account.id);
        
        if (loginResult.success) {
          console.log(`  ✓ Login status detected: ${loginResult.isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}`);
          
          if (loginResult.loginInfo) {
            console.log('  Login info:');
            console.log(`    - Has QR code: ${loginResult.loginInfo.qrCodeVisible ? 'YES' : 'NO'}`);
            console.log(`    - Has chat pane: ${loginResult.loginInfo.chatPaneVisible ? 'YES' : 'NO'}`);
            console.log(`    - Has login prompt: ${loginResult.loginInfo.hasLoginPrompt ? 'YES' : 'NO'}`);
          }
        } else {
          console.log(`  ✗ Failed to detect login status: ${loginResult.error}`);
        }

        // Check connection status
        const connectionResult = await viewManager.checkConnectionStatus(account.id);
        
        if (connectionResult.success) {
          console.log(`  ✓ Connection status: ${connectionResult.connectionStatus.toUpperCase()}`);
        } else {
          console.log(`  ✗ Failed to check connection status: ${connectionResult.error}`);
        }

      } catch (error) {
        console.log(`  ✗ Error testing account: ${error.message}`);
      }
    }

    console.log('\n\nTest 3: Starting login status monitoring...');
    
    // Test 3: Start monitoring for all accounts
    const monitorResult = viewManager.startAllLoginStatusMonitoring({
      interval: 10000 // Check every 10 seconds
    });

    console.log(`✓ Started monitoring for ${monitorResult.started} account(s)`);
    if (monitorResult.failed > 0) {
      console.log(`✗ Failed to start monitoring for ${monitorResult.failed} account(s)`);
    }

    // Wait for a few monitoring cycles
    console.log('\nMonitoring login status for 30 seconds...');
    console.log('(Watch the console for status changes)\n');

    await new Promise(resolve => setTimeout(resolve, 30000));

    // Stop monitoring
    console.log('\nStopping login status monitoring...');
    const stopResult = viewManager.stopAllLoginStatusMonitoring();
    console.log(`✓ Stopped monitoring for ${stopResult.stopped} account(s)\n`);

    // Test 4: Test SessionManager login detection
    console.log('Test 4: Testing SessionManager login detection...');
    
    for (const account of accounts.slice(0, 2)) {
      console.log(`\n  Account: ${account.name} (${account.id})`);
      
      const viewState = viewManager.getViewState(account.id);
      if (viewState && viewState.view) {
        try {
          const isLoggedIn = await sessionManager.detectLoginStatus(
            account.id,
            viewState.view
          );
          
          console.log(`  ✓ SessionManager detected: ${isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}`);
          
          // Get cached status
          const cachedStatus = sessionManager.getCachedLoginStatus(account.id);
          console.log(`  ✓ Cached status: ${cachedStatus !== null ? (cachedStatus ? 'LOGGED IN' : 'NOT LOGGED IN') : 'UNKNOWN'}`);
          
        } catch (error) {
          console.log(`  ✗ Error: ${error.message}`);
        }
      } else {
        console.log('  ✗ View not available');
      }
    }

    console.log('\n\n=== All Tests Complete ===\n');
    console.log('The main window will remain open for manual inspection.');
    console.log('Check the sidebar to see login status indicators.');
    console.log('Press Ctrl+C to exit.\n');

  } catch (error) {
    console.error('✗ Test failed:', error);
    app.quit();
  }
}

/**
 * Application ready handler
 */
app.whenReady().then(initialize);

/**
 * Handle window close
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Handle activation (macOS)
 */
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    initialize();
  }
});

/**
 * Handle errors
 */
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
