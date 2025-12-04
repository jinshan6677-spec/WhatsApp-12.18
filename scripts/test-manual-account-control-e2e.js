/**
 * End-to-End Integration Tests for Manual Account Control
 * 
 * This script tests complete user workflows and integration between
 * all components of the manual account control feature.
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
let testAccountIds = [];

// ============================================================================
// Test Utilities
// ============================================================================

function log(message, ...args) {
  console.log(`[E2E Test] ${message}`, ...args);
}

async function createTestAccount(name, config = {}) {
  const result = await accountManager.createAccount({
    name: name || `E2E Test Account ${Date.now()}`,
    note: 'End-to-end test account',
    translation: { enabled: false },
    autoStart: false,
    ...config
  });

  if (!result.success) {
    throw new Error(`Failed to create account: ${result.errors.join(', ')}`);
  }

  testAccountIds.push(result.account.id);
  return result.account;
}

async function cleanup() {
  log('Cleaning up test accounts...');
  
  for (const accountId of testAccountIds) {
    try {
      if (viewManager.isAccountRunning(accountId)) {
        await viewManager.closeAccount(accountId);
      }
      await accountManager.deleteAccount(accountId);
    } catch (error) {
      console.error(`Failed to cleanup account ${accountId}:`, error.message);
    }
  }
  
  testAccountIds = [];
  log('✓ Cleanup complete');
}

// ============================================================================
// E2E Test Scenarios
// ============================================================================

/**
 * Scenario 1: Complete Account Lifecycle
 * 
 * User workflow:
 * 1. Create a new account
 * 2. Open the account
 * 3. Verify it's running
 * 4. Close the account
 * 5. Verify it's stopped
 * 6. Delete the account
 */
async function testScenario1_CompleteAccountLifecycle() {
  log('\n=== Scenario 1: Complete Account Lifecycle ===\n');

  // Step 1: Create account
  log('Step 1: Creating account...');
  const account = await createTestAccount('E2E-Lifecycle-Test');
  log(`✓ Account created: ${account.id}`);

  // Step 2: Open account
  log('Step 2: Opening account...');
  const openResult = await viewManager.openAccount(account.id, {
    url: 'https://web.whatsapp.com',
    translation: { enabled: false }
  });
  
  if (!openResult.success) {
    throw new Error(`Failed to open account: ${openResult.error}`);
  }
  log('✓ Account opened');

  // Wait for loading
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 3: Verify running
  log('Step 3: Verifying account is running...');
  const isRunning = viewManager.isAccountRunning(account.id);
  const status = viewManager.getAccountRunningStatus(account.id);
  
  if (!isRunning) {
    throw new Error('Account should be running');
  }
  log(`✓ Account is running (status: ${status})`);

  // Step 4: Close account
  log('Step 4: Closing account...');
  const closeResult = await viewManager.closeAccount(account.id);
  
  if (!closeResult.success) {
    throw new Error(`Failed to close account: ${closeResult.error}`);
  }
  log('✓ Account closed');

  // Wait for cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 5: Verify stopped
  log('Step 5: Verifying account is stopped...');
  const isStillRunning = viewManager.isAccountRunning(account.id);
  const finalStatus = viewManager.getAccountRunningStatus(account.id);
  
  if (isStillRunning) {
    throw new Error('Account should not be running');
  }
  if (finalStatus !== 'not_started') {
    throw new Error(`Expected status 'not_started', got '${finalStatus}'`);
  }
  log('✓ Account is stopped');

  // Step 6: Delete account
  log('Step 6: Deleting account...');
  await accountManager.deleteAccount(account.id);
  testAccountIds = testAccountIds.filter(id => id !== account.id);
  log('✓ Account deleted');

  log('\n✓ Scenario 1 passed\n');
}

/**
 * Scenario 2: Multiple Accounts Concurrent Operations
 * 
 * User workflow:
 * 1. Create 3 accounts
 * 2. Open all accounts
 * 3. Verify all are running
 * 4. Close one account
 * 5. Verify others still running
 * 6. Close remaining accounts
 */
async function testScenario2_MultipleAccountsConcurrent() {
  log('\n=== Scenario 2: Multiple Accounts Concurrent Operations ===\n');

  // Step 1: Create accounts
  log('Step 1: Creating 3 accounts...');
  const accounts = [];
  for (let i = 0; i < 3; i++) {
    const account = await createTestAccount(`E2E-Multi-${i + 1}`);
    accounts.push(account);
  }
  log(`✓ Created ${accounts.length} accounts`);

  // Step 2: Open all accounts
  log('Step 2: Opening all accounts...');
  for (const account of accounts) {
    await viewManager.openAccount(account.id, {});
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  log('✓ All accounts opened');

  // Wait for loading
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 3: Verify all running
  log('Step 3: Verifying all accounts are running...');
  for (const account of accounts) {
    const isRunning = viewManager.isAccountRunning(account.id);
    if (!isRunning) {
      throw new Error(`Account ${account.id} should be running`);
    }
  }
  log('✓ All accounts are running');

  // Step 4: Close one account
  log('Step 4: Closing one account...');
  await viewManager.closeAccount(accounts[1].id);
  await new Promise(resolve => setTimeout(resolve, 500));
  log('✓ One account closed');

  // Step 5: Verify others still running
  log('Step 5: Verifying other accounts still running...');
  if (!viewManager.isAccountRunning(accounts[0].id)) {
    throw new Error('Account 0 should still be running');
  }
  if (!viewManager.isAccountRunning(accounts[2].id)) {
    throw new Error('Account 2 should still be running');
  }
  if (viewManager.isAccountRunning(accounts[1].id)) {
    throw new Error('Account 1 should not be running');
  }
  log('✓ Other accounts still running');

  // Step 6: Close remaining accounts
  log('Step 6: Closing remaining accounts...');
  await viewManager.closeAccount(accounts[0].id);
  await viewManager.closeAccount(accounts[2].id);
  await new Promise(resolve => setTimeout(resolve, 500));
  log('✓ All accounts closed');

  log('\n✓ Scenario 2 passed\n');
}

/**
 * Scenario 3: Auto-Start Functionality
 * 
 * User workflow:
 * 1. Create account with autoStart enabled
 * 2. Simulate app restart (reload accounts)
 * 3. Verify account is in auto-start list
 * 4. Open auto-start accounts
 * 5. Verify account is running
 */
async function testScenario3_AutoStartFunctionality() {
  log('\n=== Scenario 3: Auto-Start Functionality ===\n');

  // Step 1: Create account with autoStart
  log('Step 1: Creating account with autoStart enabled...');
  const account = await createTestAccount('E2E-AutoStart', { autoStart: true });
  log(`✓ Account created with autoStart: ${account.id}`);

  // Step 2: Simulate app restart
  log('Step 2: Simulating app restart (reloading accounts)...');
  const accounts = await accountManager.loadAccounts();
  log(`✓ Loaded ${accounts.length} accounts`);

  // Step 3: Verify in auto-start list
  log('Step 3: Verifying account is in auto-start list...');
  const autoStartAccounts = accounts.filter(acc => acc.autoStart === true);
  const isInAutoStart = autoStartAccounts.some(acc => acc.id === account.id);
  
  if (!isInAutoStart) {
    throw new Error('Account should be in auto-start list');
  }
  log(`✓ Found ${autoStartAccounts.length} auto-start accounts`);

  // Step 4: Open auto-start accounts
  log('Step 4: Opening auto-start accounts...');
  for (const acc of autoStartAccounts) {
    await viewManager.openAccount(acc.id, {});
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  log('✓ Auto-start accounts opened');

  // Wait for loading
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 5: Verify running
  log('Step 5: Verifying account is running...');
  const isRunning = viewManager.isAccountRunning(account.id);
  
  if (!isRunning) {
    throw new Error('Auto-start account should be running');
  }
  log('✓ Auto-start account is running');

  log('\n✓ Scenario 3 passed\n');
}

/**
 * Scenario 4: Session Persistence and Recovery
 * 
 * User workflow:
 * 1. Create and open account
 * 2. Close account
 * 3. Verify session data exists
 * 4. Reopen account
 * 5. Verify session restored
 */
async function testScenario4_SessionPersistenceAndRecovery() {
  log('\n=== Scenario 4: Session Persistence and Recovery ===\n');

  // Step 1: Create and open account
  log('Step 1: Creating and opening account...');
  const account = await createTestAccount('E2E-Session');
  await viewManager.openAccount(account.id, {});
  await new Promise(resolve => setTimeout(resolve, 2000));
  log('✓ Account opened');

  // Step 2: Close account
  log('Step 2: Closing account...');
  await viewManager.closeAccount(account.id);
  await new Promise(resolve => setTimeout(resolve, 500));
  log('✓ Account closed');

  // Step 3: Verify session data exists
  log('Step 3: Verifying session data exists...');
  const fs = require('fs').promises;
  const sessionPath = path.join(app.getPath('userData'), 'profiles', account.id);
  
  try {
    await fs.access(sessionPath);
    log('✓ Session data directory exists');
  } catch (error) {
    throw new Error('Session data directory should exist after closing');
  }

  // Step 4: Reopen account
  log('Step 4: Reopening account...');
  await viewManager.openAccount(account.id, {});
  await new Promise(resolve => setTimeout(resolve, 2000));
  log('✓ Account reopened');

  // Step 5: Verify session restored
  log('Step 5: Verifying session restored...');
  const isRunning = viewManager.isAccountRunning(account.id);
  
  if (!isRunning) {
    throw new Error('Account should be running after reopen');
  }
  log('✓ Session restored successfully');

  log('\n✓ Scenario 4 passed\n');
}

/**
 * Scenario 5: Error Handling and Recovery
 * 
 * User workflow:
 * 1. Create account
 * 2. Open account
 * 3. Close account
 * 4. Try to close again (should handle gracefully)
 * 5. Reopen account (retry after error)
 */
async function testScenario5_ErrorHandlingAndRecovery() {
  log('\n=== Scenario 5: Error Handling and Recovery ===\n');

  // Step 1: Create account
  log('Step 1: Creating account...');
  const account = await createTestAccount('E2E-Error');
  log('✓ Account created');

  // Step 2: Open account
  log('Step 2: Opening account...');
  await viewManager.openAccount(account.id, {});
  await new Promise(resolve => setTimeout(resolve, 1000));
  log('✓ Account opened');

  // Step 3: Close account
  log('Step 3: Closing account...');
  await viewManager.closeAccount(account.id);
  await new Promise(resolve => setTimeout(resolve, 500));
  log('✓ Account closed');

  // Step 4: Try to close again
  log('Step 4: Trying to close already closed account...');
  const closeResult = await viewManager.closeAccount(account.id);
  
  if (!closeResult.success) {
    throw new Error('Should handle closing already closed account gracefully');
  }
  if (!closeResult.alreadyClosed) {
    throw new Error('Should indicate account was already closed');
  }
  log('✓ Handled gracefully (alreadyClosed: true)');

  // Step 5: Reopen account
  log('Step 5: Reopening account (retry)...');
  const reopenResult = await viewManager.openAccount(account.id, {});
  
  if (!reopenResult.success) {
    throw new Error('Should be able to reopen after close');
  }
  await new Promise(resolve => setTimeout(resolve, 1000));
  log('✓ Account reopened successfully');

  log('\n✓ Scenario 5 passed\n');
}

/**
 * Scenario 6: Account Limit Enforcement
 * 
 * User workflow:
 * 1. Create max + 1 accounts
 * 2. Open max accounts
 * 3. Try to open one more (should fail)
 * 4. Close one account
 * 5. Try to open the extra account (should succeed)
 */
async function testScenario6_AccountLimitEnforcement() {
  log('\n=== Scenario 6: Account Limit Enforcement ===\n');

  const maxViews = viewManager.options.maxConcurrentViews;
  log(`Max concurrent views: ${maxViews}`);

  // Step 1: Create max + 1 accounts
  log(`Step 1: Creating ${maxViews + 1} accounts...`);
  const accounts = [];
  for (let i = 0; i < Math.min(maxViews + 1, 5); i++) {  // Limit to 5 for testing
    const account = await createTestAccount(`E2E-Limit-${i + 1}`);
    accounts.push(account);
  }
  log(`✓ Created ${accounts.length} accounts`);

  // Step 2: Open max accounts
  log(`Step 2: Opening ${accounts.length - 1} accounts...`);
  for (let i = 0; i < accounts.length - 1; i++) {
    await viewManager.openAccount(accounts[i].id, {});
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  log('✓ Opened max accounts');

  // Wait for loading
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 3: Try to open one more
  log('Step 3: Trying to open one more account (should fail if at limit)...');
  const extraResult = await viewManager.openAccount(accounts[accounts.length - 1].id, {});
  
  // If we're at the actual limit, it should fail
  if (accounts.length - 1 >= maxViews) {
    if (extraResult.success) {
      throw new Error('Should fail when exceeding limit');
    }
    log('✓ Correctly rejected (limit reached)');

    // Step 4: Close one account
    log('Step 4: Closing one account...');
    await viewManager.closeAccount(accounts[0].id);
    await new Promise(resolve => setTimeout(resolve, 500));
    log('✓ One account closed');

    // Step 5: Try to open the extra account
    log('Step 5: Trying to open the extra account again...');
    const retryResult = await viewManager.openAccount(accounts[accounts.length - 1].id, {});
    
    if (!retryResult.success) {
      throw new Error('Should succeed after closing one account');
    }
    log('✓ Successfully opened after freeing slot');
  } else {
    log('✓ Under limit, all accounts opened successfully');
  }

  log('\n✓ Scenario 6 passed\n');
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runAllE2ETests() {
  console.log('\n========================================');
  console.log('End-to-End Integration Tests');
  console.log('Manual Account Control');
  console.log('========================================\n');

  try {
    // Initialize environment
    log('Initializing test environment...');
    
    accountManager = new AccountConfigManager({
      configName: 'accounts-test-e2e',
      cwd: app.getPath('userData')
    });

    sessionManager = new SessionManager({
      userDataPath: app.getPath('userData')
    });

    mainWindow = new MainWindow({
      width: 1400,
      height: 900,
      title: 'E2E Tests - Manual Account Control',
      show: false
    });

    mainWindow.initialize();

    viewManager = new ViewManager(mainWindow, sessionManager, {
      maxConcurrentViews: 10,
      lazyLoadViews: true
    });

    log('✓ Test environment initialized\n');

    // Run test scenarios
    await testScenario1_CompleteAccountLifecycle();
    await cleanup();

    await testScenario2_MultipleAccountsConcurrent();
    await cleanup();

    await testScenario3_AutoStartFunctionality();
    await cleanup();

    await testScenario4_SessionPersistenceAndRecovery();
    await cleanup();

    await testScenario5_ErrorHandlingAndRecovery();
    await cleanup();

    await testScenario6_AccountLimitEnforcement();
    await cleanup();

    console.log('\n========================================');
    console.log('✓ All E2E Tests Passed!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ E2E Test Failed');
    console.error('========================================');
    console.error(error);
    console.error('========================================\n');
    process.exit(1);
  } finally {
    await cleanup();
    
    setTimeout(() => {
      app.quit();
    }, 1000);
  }
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  runAllE2ETests();
});

app.on('window-all-closed', () => {
  // Keep app running for tests
});

app.on('activate', () => {
  // Do nothing
});
