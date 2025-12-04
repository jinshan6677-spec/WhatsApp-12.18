/**
 * Test script for manual account control functionality
 * 
 * This script tests the new openAccount, closeAccount, and status query methods
 * added to ViewManager and IPC handlers.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Import managers
const AccountConfigManager = require('../src/managers/AccountConfigManager');
const SessionManager = require('../src/managers/SessionManager');
const MainWindow = require('../src/single-window/MainWindow');
const { ViewManager } = require('../src/presentation/windows/view-manager');

let accountManager;
let sessionManager;
let mainWindow;
let viewManager;
let testAccountId;

async function runTests() {
  console.log('\n=== Testing Manual Account Control ===\n');

  try {
    // Initialize managers
    console.log('1. Initializing managers...');
    accountManager = new AccountConfigManager({
      configName: 'accounts-test',
      cwd: app.getPath('userData')
    });

    sessionManager = new SessionManager({
      userDataPath: app.getPath('userData')
    });

    mainWindow = new MainWindow({
      width: 1400,
      height: 900,
      title: 'Test - Manual Account Control'
    });

    mainWindow.initialize();

    viewManager = new ViewManager(mainWindow, sessionManager, {
      maxConcurrentViews: 10,
      lazyLoadViews: true
    });

    console.log('✓ Managers initialized\n');

    // Create a test account
    console.log('2. Creating test account...');
    const createResult = await accountManager.createAccount({
      name: 'Test Account - Manual Control',
      note: 'Test account for manual control feature',
      translation: {
        enabled: false
      },
      autoStart: false
    });

    if (!createResult.success) {
      throw new Error(`Failed to create account: ${createResult.errors.join(', ')}`);
    }

    testAccountId = createResult.account.id;
    console.log(`✓ Test account created: ${testAccountId}\n`);

    // Test 1: Check initial status (should be not_started)
    console.log('3. Testing initial status...');
    const initialStatus = viewManager.getAccountRunningStatus(testAccountId);
    const initialRunning = viewManager.isAccountRunning(testAccountId);
    
    console.log(`   Status: ${initialStatus}`);
    console.log(`   Is Running: ${initialRunning}`);
    
    if (initialStatus !== 'not_started') {
      throw new Error(`Expected status 'not_started', got '${initialStatus}'`);
    }
    if (initialRunning !== false) {
      throw new Error(`Expected isRunning to be false, got ${initialRunning}`);
    }
    console.log('✓ Initial status correct\n');

    // Test 2: Open account
    console.log('4. Testing openAccount...');
    const openResult = await viewManager.openAccount(testAccountId, {
      url: 'https://web.whatsapp.com',
      translation: { enabled: false }
    });

    console.log(`   Open result: ${JSON.stringify(openResult, null, 2)}`);
    
    if (!openResult.success) {
      throw new Error(`Failed to open account: ${openResult.error}`);
    }
    console.log('✓ Account opened successfully\n');

    // Test 3: Check status after opening (should be loading or connected)
    console.log('5. Testing status after opening...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for loading
    
    const openedStatus = viewManager.getAccountRunningStatus(testAccountId);
    const openedRunning = viewManager.isAccountRunning(testAccountId);
    const viewState = viewManager.getViewState(testAccountId);
    
    console.log(`   Status: ${openedStatus}`);
    console.log(`   Is Running: ${openedRunning}`);
    console.log(`   View exists: ${viewState !== null}`);
    console.log(`   View status: ${viewState ? viewState.status : 'N/A'}`);
    
    if (!openedRunning) {
      throw new Error('Expected isRunning to be true after opening');
    }
    if (!viewState) {
      throw new Error('Expected view to exist after opening');
    }
    console.log('✓ Status after opening correct\n');

    // Test 4: Try to open again (should return alreadyOpen)
    console.log('6. Testing opening already open account...');
    const reopenResult = await viewManager.openAccount(testAccountId, {});
    
    console.log(`   Reopen result: ${JSON.stringify(reopenResult, null, 2)}`);
    
    if (!reopenResult.success || !reopenResult.alreadyOpen) {
      throw new Error('Expected alreadyOpen to be true');
    }
    console.log('✓ Already open detection works\n');

    // Test 5: Close account
    console.log('7. Testing closeAccount...');
    const closeResult = await viewManager.closeAccount(testAccountId);
    
    console.log(`   Close result: ${JSON.stringify(closeResult, null, 2)}`);
    
    if (!closeResult.success) {
      throw new Error(`Failed to close account: ${closeResult.error}`);
    }
    console.log('✓ Account closed successfully\n');

    // Test 6: Check status after closing (should be not_started)
    console.log('8. Testing status after closing...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup
    
    const closedStatus = viewManager.getAccountRunningStatus(testAccountId);
    const closedRunning = viewManager.isAccountRunning(testAccountId);
    const closedViewState = viewManager.getViewState(testAccountId);
    
    console.log(`   Status: ${closedStatus}`);
    console.log(`   Is Running: ${closedRunning}`);
    console.log(`   View exists: ${closedViewState !== null}`);
    
    if (closedStatus !== 'not_started') {
      throw new Error(`Expected status 'not_started' after closing, got '${closedStatus}'`);
    }
    if (closedRunning !== false) {
      throw new Error('Expected isRunning to be false after closing');
    }
    if (closedViewState !== null) {
      throw new Error('Expected view to be destroyed after closing');
    }
    console.log('✓ Status after closing correct\n');

    // Test 7: Try to close already closed account
    console.log('9. Testing closing already closed account...');
    const recloseResult = await viewManager.closeAccount(testAccountId);
    
    console.log(`   Reclose result: ${JSON.stringify(recloseResult, null, 2)}`);
    
    if (!recloseResult.success || !recloseResult.alreadyClosed) {
      throw new Error('Expected alreadyClosed to be true');
    }
    console.log('✓ Already closed detection works\n');

    // Test 8: Test account limit
    console.log('10. Testing account limit...');
    const maxViews = viewManager.options.maxConcurrentViews;
    console.log(`   Max concurrent views: ${maxViews}`);
    
    // Create and open multiple accounts
    const testAccounts = [];
    for (let i = 0; i < maxViews; i++) {
      const result = await accountManager.createAccount({
        name: `Test Account ${i + 1}`,
        autoStart: false
      });
      if (result.success) {
        testAccounts.push(result.account.id);
        await viewManager.openAccount(result.account.id, {});
      }
    }
    
    console.log(`   Opened ${testAccounts.length} accounts`);
    
    // Try to open one more (should fail)
    const extraResult = await accountManager.createAccount({
      name: 'Extra Account',
      autoStart: false
    });
    
    if (extraResult.success) {
      const limitResult = await viewManager.openAccount(extraResult.account.id, {});
      console.log(`   Limit test result: ${JSON.stringify(limitResult, null, 2)}`);
      
      if (limitResult.success) {
        throw new Error('Expected to fail when exceeding limit');
      }
      console.log('✓ Account limit enforced\n');
      
      // Clean up extra account
      await accountManager.deleteAccount(extraResult.account.id);
    }
    
    // Clean up test accounts
    for (const id of testAccounts) {
      await viewManager.closeAccount(id);
      await accountManager.deleteAccount(id);
    }

    console.log('\n=== All Tests Passed! ===\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    if (testAccountId && accountManager) {
      try {
        await accountManager.deleteAccount(testAccountId);
        console.log('✓ Test account cleaned up');
      } catch (error) {
        console.error('Failed to cleanup test account:', error);
      }
    }

    // Close app
    setTimeout(() => {
      app.quit();
    }, 1000);
  }
}

// App lifecycle
app.whenReady().then(() => {
  runTests();
});

app.on('window-all-closed', () => {
  // Keep app running for tests
});

app.on('activate', () => {
  // Do nothing
});
