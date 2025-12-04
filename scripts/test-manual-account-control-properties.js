/**
 * Property-Based Tests for Manual Account Control
 * 
 * Feature: manual-account-control
 * Uses fast-check for property-based testing
 * 
 * This file contains property tests that validate the correctness properties
 * defined in the design document.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fc = require('fast-check');

// Import managers
const AccountConfigManager = require('../src/managers/AccountConfigManager');
const SessionManager = require('../src/managers/SessionManager');
const MainWindow = require('../src/single-window/MainWindow');
const { ViewManager } = require('../src/presentation/windows/view-manager');

let accountManager;
let sessionManager;
let mainWindow;
let viewManager;
let createdAccountIds = [];

// Test configuration
const TEST_CONFIG = {
  numRuns: 10,  // Number of iterations for each property test (reduced for faster testing)
  timeout: 60000, // Timeout for each test
  maxAccounts: 3  // Maximum accounts to create in tests (reduced for faster testing)
};

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Initialize test environment
 */
async function initializeTestEnvironment() {
  console.log('Initializing test environment...');
  
  accountManager = new AccountConfigManager({
    configName: 'accounts-test-properties',
    cwd: app.getPath('userData')
  });

  sessionManager = new SessionManager({
    userDataPath: app.getPath('userData')
  });

  mainWindow = new MainWindow({
    width: 1400,
    height: 900,
    title: 'Property Tests - Manual Account Control',
    show: false  // Don't show window during tests
  });

  mainWindow.initialize();

  viewManager = new ViewManager(mainWindow, sessionManager, {
    maxConcurrentViews: 10,
    lazyLoadViews: true
  });

  console.log('✓ Test environment initialized\n');
}

/**
 * Cleanup test environment
 */
async function cleanupTestEnvironment() {
  console.log('\nCleaning up test environment...');
  
  // Close all open accounts
  for (const accountId of createdAccountIds) {
    try {
      if (viewManager.isAccountRunning(accountId)) {
        await viewManager.closeAccount(accountId);
      }
    } catch (error) {
      console.error(`Failed to close account ${accountId}:`, error.message);
    }
  }

  // Delete all test accounts
  for (const accountId of createdAccountIds) {
    try {
      await accountManager.deleteAccount(accountId);
    } catch (error) {
      console.error(`Failed to delete account ${accountId}:`, error.message);
    }
  }

  createdAccountIds = [];
  console.log('✓ Test environment cleaned up');
}

/**
 * Create a test account
 */
async function createTestAccount(name) {
  // Generate unique name with timestamp and random suffix
  const uniqueName = name 
    ? `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    : `Test Account ${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
  const result = await accountManager.createAccount({
    name: uniqueName,
    note: 'Property test account',
    translation: { enabled: false },
    autoStart: false
  });

  if (!result.success) {
    throw new Error(`Failed to create account: ${result.errors.join(', ')}`);
  }

  createdAccountIds.push(result.account.id);
  return result.account;
}

// ============================================================================
// Fast-Check Arbitraries (Generators)
// ============================================================================

/**
 * Generate a random account configuration
 */
const accountConfigArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  autoStart: fc.boolean()
});

/**
 * Generate a list of account IDs
 */
const accountIdsArbitrary = (min = 1, max = TEST_CONFIG.maxAccounts) =>
  fc.array(fc.uuid(), { minLength: min, maxLength: max });

/**
 * Generate a sequence of account operations
 */
const accountOperationArbitrary = fc.oneof(
  fc.constant({ type: 'open' }),
  fc.constant({ type: 'close' })
);

const operationSequenceArbitrary = (accountIds) =>
  fc.array(
    fc.record({
      accountId: fc.constantFrom(...accountIds),
      operation: accountOperationArbitrary
    }),
    { minLength: 1, maxLength: 20 }
  );

// ============================================================================
// Property Tests
// ============================================================================

/**
 * Feature: manual-account-control, Property 1: 应用启动时不自动创建 WebView
 * Validates: Requirements 1.2, 1.3
 * 
 * For any configured accounts, when the application starts,
 * no BrowserView instances should exist in ViewManager.
 */
async function testProperty1_NoAutoCreateWebView() {
  console.log('\n--- Property 1: 应用启动时不自动创建 WebView ---');
  
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: TEST_CONFIG.maxAccounts }),
      async (numAccounts) => {
        // Create accounts but don't open them
        const accounts = [];
        for (let i = 0; i < numAccounts; i++) {
          const account = await createTestAccount(`Property1-Account-${i}`);
          accounts.push(account);
        }

        // Verify no views are created
        for (const account of accounts) {
          const isRunning = viewManager.isAccountRunning(account.id);
          const status = viewManager.getAccountRunningStatus(account.id);
          
          if (isRunning || status !== 'not_started') {
            return false;
          }
        }

        return true;
      }
    ),
    { numRuns: TEST_CONFIG.numRuns }
  );

  console.log('✓ Property 1 passed');
}

/**
 * Feature: manual-account-control, Property 2: 初始账号状态为未启动
 * Validates: Requirements 1.4
 * 
 * For any configured accounts, when the account list is displayed,
 * all accounts should have status "not_started".
 */
async function testProperty2_InitialStatusNotStarted() {
  console.log('\n--- Property 2: 初始账号状态为未启动 ---');
  
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: TEST_CONFIG.maxAccounts }),
      async (numAccounts) => {
        // Create accounts
        const accounts = [];
        for (let i = 0; i < numAccounts; i++) {
          const account = await createTestAccount(`Property2-Account-${i}`);
          accounts.push(account);
        }

        // Verify all accounts have not_started status
        for (const account of accounts) {
          const status = viewManager.getAccountRunningStatus(account.id);
          if (status !== 'not_started') {
            console.log(`Account ${account.id} has status ${status}, expected not_started`);
            return false;
          }
        }

        return true;
      }
    ),
    { numRuns: TEST_CONFIG.numRuns }
  );

  console.log('✓ Property 2 passed');
}

/**
 * Feature: manual-account-control, Property 4: 打开账号创建 WebView
 * Validates: Requirements 3.1, 3.2
 * 
 * For any account, when the open operation is called,
 * ViewManager should create a BrowserView instance and load WhatsApp Web URL.
 */
async function testProperty4_OpenAccountCreatesWebView() {
  console.log('\n--- Property 4: 打开账号创建 WebView ---');
  
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 3 }),
      async (numAccounts) => {
        // Create accounts
        const accounts = [];
        for (let i = 0; i < numAccounts; i++) {
          const account = await createTestAccount(`Property4-Account-${i}`);
          accounts.push(account);
        }

        // Open each account and verify WebView is created
        for (const account of accounts) {
          const result = await viewManager.openAccount(account.id, {
            url: 'https://web.whatsapp.com',
            translation: { enabled: false }
          });

          if (!result.success) {
            console.log(`Failed to open account ${account.id}: ${result.error}`);
            return false;
          }

          // Wait a bit for view creation
          await new Promise(resolve => setTimeout(resolve, 500));

          // Verify view exists
          const isRunning = viewManager.isAccountRunning(account.id);
          const viewState = viewManager.getViewState(account.id);

          if (!isRunning || !viewState) {
            console.log(`Account ${account.id} not running or view not created`);
            return false;
          }
        }

        return true;
      }
    ),
    { numRuns: 20 }  // Fewer runs due to time cost
  );

  console.log('✓ Property 4 passed');
}

/**
 * Feature: manual-account-control, Property 7: 关闭账号销毁 WebView
 * Validates: Requirements 5.1, 5.2, 5.4
 * 
 * For any open account, when the close operation is called,
 * ViewManager should destroy the BrowserView instance.
 */
async function testProperty7_CloseAccountDestroysWebView() {
  console.log('\n--- Property 7: 关闭账号销毁 WebView ---');
  
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 3 }),
      async (numAccounts) => {
        // Create and open accounts
        const accounts = [];
        for (let i = 0; i < numAccounts; i++) {
          const account = await createTestAccount(`Property7-Account-${i}`);
          accounts.push(account);
          
          await viewManager.openAccount(account.id, {
            url: 'https://web.whatsapp.com',
            translation: { enabled: false }
          });
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Close each account and verify WebView is destroyed
        for (const account of accounts) {
          const result = await viewManager.closeAccount(account.id);

          if (!result.success) {
            console.log(`Failed to close account ${account.id}: ${result.error}`);
            return false;
          }

          // Wait a bit for cleanup
          await new Promise(resolve => setTimeout(resolve, 500));

          // Verify view is destroyed
          const isRunning = viewManager.isAccountRunning(account.id);
          const viewState = viewManager.getViewState(account.id);

          if (isRunning || viewState !== null) {
            console.log(`Account ${account.id} still running or view not destroyed`);
            return false;
          }
        }

        return true;
      }
    ),
    { numRuns: 20 }  // Fewer runs due to time cost
  );

  console.log('✓ Property 7 passed');
}

/**
 * Feature: manual-account-control, Property 8: 关闭账号的状态转换
 * Validates: Requirements 5.3
 * 
 * For any open account, after the close operation completes,
 * the account status should be updated to "not_started".
 */
async function testProperty8_CloseAccountStatusTransition() {
  console.log('\n--- Property 8: 关闭账号的状态转换 ---');
  
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 3 }),
      async (numAccounts) => {
        // Create and open accounts
        const accounts = [];
        for (let i = 0; i < numAccounts; i++) {
          const account = await createTestAccount(`Property8-Account-${i}`);
          accounts.push(account);
          
          await viewManager.openAccount(account.id, {});
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Close each account and verify status
        for (const account of accounts) {
          await viewManager.closeAccount(account.id);
          await new Promise(resolve => setTimeout(resolve, 500));

          const status = viewManager.getAccountRunningStatus(account.id);
          if (status !== 'not_started') {
            console.log(`Account ${account.id} has status ${status}, expected not_started`);
            return false;
          }
        }

        return true;
      }
    ),
    { numRuns: 20 }
  );

  console.log('✓ Property 8 passed');
}

/**
 * Feature: manual-account-control, Property 12: 多账号并发打开
 * Validates: Requirements 8.1
 * 
 * For any set of accounts, the system should allow opening multiple accounts
 * simultaneously, and all accounts should be in running state.
 */
async function testProperty12_MultipleAccountsConcurrent() {
  console.log('\n--- Property 12: 多账号并发打开 ---');
  
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 2, max: 5 }),
      async (numAccounts) => {
        // Create accounts
        const accounts = [];
        for (let i = 0; i < numAccounts; i++) {
          const account = await createTestAccount(`Property12-Account-${i}`);
          accounts.push(account);
        }

        // Open all accounts concurrently
        const openPromises = accounts.map(account =>
          viewManager.openAccount(account.id, {})
        );

        const results = await Promise.all(openPromises);

        // Verify all opened successfully
        for (let i = 0; i < results.length; i++) {
          if (!results[i].success && !results[i].alreadyOpen) {
            console.log(`Failed to open account ${accounts[i].id}`);
            return false;
          }
        }

        // Wait for all to load
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify all are running
        for (const account of accounts) {
          const isRunning = viewManager.isAccountRunning(account.id);
          if (!isRunning) {
            console.log(`Account ${account.id} is not running`);
            return false;
          }
        }

        return true;
      }
    ),
    { numRuns: 10 }  // Fewer runs due to time cost
  );

  console.log('✓ Property 12 passed');
}

/**
 * Feature: manual-account-control, Property 13: 账号操作独立性
 * Validates: Requirements 8.2, 8.3, 8.4
 * 
 * For any open accounts, when one account is opened or closed,
 * other accounts' status and connections should remain unchanged.
 */
async function testProperty13_AccountOperationIndependence() {
  console.log('\n--- Property 13: 账号操作独立性 ---');
  
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 3, max: 5 }),
      async (numAccounts) => {
        // Create and open all accounts
        const accounts = [];
        for (let i = 0; i < numAccounts; i++) {
          const account = await createTestAccount(`Property13-Account-${i}`);
          accounts.push(account);
          await viewManager.openAccount(account.id, {});
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Record initial states
        const initialStates = accounts.map(account => ({
          id: account.id,
          isRunning: viewManager.isAccountRunning(account.id),
          status: viewManager.getAccountRunningStatus(account.id)
        }));

        // Close one account (the middle one)
        const targetIndex = Math.floor(numAccounts / 2);
        await viewManager.closeAccount(accounts[targetIndex].id);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify other accounts unchanged
        for (let i = 0; i < accounts.length; i++) {
          if (i === targetIndex) continue;  // Skip the closed account

          const currentRunning = viewManager.isAccountRunning(accounts[i].id);
          const currentStatus = viewManager.getAccountRunningStatus(accounts[i].id);

          if (currentRunning !== initialStates[i].isRunning) {
            console.log(`Account ${accounts[i].id} running state changed`);
            return false;
          }

          // Status might change from loading to connected, but shouldn't go to not_started
          if (currentStatus === 'not_started' && initialStates[i].status !== 'not_started') {
            console.log(`Account ${accounts[i].id} status changed to not_started`);
            return false;
          }
        }

        return true;
      }
    ),
    { numRuns: 10 }
  );

  console.log('✓ Property 13 passed');
}

/**
 * Feature: manual-account-control, Property 17: 账号数量限制
 * Validates: Requirements 10.5
 * 
 * For any number of accounts exceeding the system limit,
 * when trying to open more than the limit, the system should reject the operation.
 */
async function testProperty17_AccountLimit() {
  console.log('\n--- Property 17: 账号数量限制 ---');
  
  const maxViews = viewManager.options.maxConcurrentViews;
  console.log(`Max concurrent views: ${maxViews}`);

  // Create max + 1 accounts
  const accounts = [];
  for (let i = 0; i < maxViews + 1; i++) {
    const account = await createTestAccount(`Property17-Account-${i}`);
    accounts.push(account);
  }

  // Open max accounts
  for (let i = 0; i < maxViews; i++) {
    const result = await viewManager.openAccount(accounts[i].id, {});
    if (!result.success && !result.alreadyOpen) {
      console.log(`Failed to open account ${i}: ${result.error}`);
      throw new Error('Should be able to open up to max accounts');
    }
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Try to open one more (should fail)
  const extraResult = await viewManager.openAccount(accounts[maxViews].id, {});
  if (extraResult.success) {
    console.log('Should have failed when exceeding limit');
    throw new Error('Account limit not enforced');
  }

  console.log('✓ Property 17 passed');
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runAllPropertyTests() {
  console.log('\n========================================');
  console.log('Property-Based Tests for Manual Account Control');
  console.log('========================================');
  console.log(`Test Configuration:`);
  console.log(`  - Runs per property: ${TEST_CONFIG.numRuns}`);
  console.log(`  - Timeout: ${TEST_CONFIG.timeout}ms`);
  console.log(`  - Max accounts: ${TEST_CONFIG.maxAccounts}`);
  console.log('========================================\n');

  try {
    await initializeTestEnvironment();

    // Run property tests
    await testProperty1_NoAutoCreateWebView();
    await cleanupTestEnvironment();

    await testProperty2_InitialStatusNotStarted();
    await cleanupTestEnvironment();

    await testProperty4_OpenAccountCreatesWebView();
    await cleanupTestEnvironment();

    await testProperty7_CloseAccountDestroysWebView();
    await cleanupTestEnvironment();

    await testProperty8_CloseAccountStatusTransition();
    await cleanupTestEnvironment();

    await testProperty12_MultipleAccountsConcurrent();
    await cleanupTestEnvironment();

    await testProperty13_AccountOperationIndependence();
    await cleanupTestEnvironment();

    await testProperty17_AccountLimit();
    await cleanupTestEnvironment();

    console.log('\n========================================');
    console.log('✓ All Property Tests Passed!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ Property Test Failed');
    console.error('========================================');
    console.error(error);
    console.error('========================================\n');
    process.exit(1);
  } finally {
    await cleanupTestEnvironment();
    
    // Close app
    setTimeout(() => {
      app.quit();
    }, 1000);
  }
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  runAllPropertyTests();
});

app.on('window-all-closed', () => {
  // Keep app running for tests
});

app.on('activate', () => {
  // Do nothing
});
