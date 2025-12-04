/**
 * Integration Test Suite for Single-Window Multi-Account Architecture
 * 
 * This comprehensive test suite validates the integration between:
 * - Account creation to view creation flow
 * - Account switching and state preservation
 * - Translation injection and configuration
 * - Session persistence and restoration
 * 
 * Requirements: All (comprehensive integration testing)
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Import components
const AccountConfigManager = require('../src/managers/AccountConfigManager');
const SessionManager = require('../src/managers/SessionManager');
const { ViewManager } = require('../src/presentation/windows/view-manager');
const TranslationIntegration = require('../src/managers/TranslationIntegration');
const MainWindow = require('../src/single-window/MainWindow');

// Test configuration
const TEST_DATA_DIR = path.join(app.getPath('userData'), 'integration-test');
const TEST_ACCOUNTS = [
  {
    name: 'Test Account 1',
    note: 'First test account',
    translation: {
      enabled: true,
      targetLanguage: 'zh-CN',
      engine: 'google',
      autoTranslate: false
    }
  },
  {
    name: 'Test Account 2',
    note: 'Second test account',
    translation: {
      enabled: true,
      targetLanguage: 'en',
      engine: 'google',
      autoTranslate: true
    }
  },
  {
    name: 'Test Account 3',
    note: 'Third test account',
    translation: {
      enabled: false
    }
  }
];

// Test state
let mainWindow = null;
let accountManager = null;
let sessionManager = null;
let viewManager = null;
let translationService = null;
let createdAccountIds = [];

/**
 * Setup test environment
 */
async function setupTestEnvironment() {
  console.log('\n=== Setting up test environment ===\n');
  
  try {
    // Clean up any existing test data
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
      console.log('✓ Cleaned up existing test data');
    } catch (error) {
      // Ignore if directory doesn't exist
    }
    
    // Create test data directory
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
    console.log('✓ Test data directory created');
    
    // Initialize managers
    accountManager = new AccountConfigManager({
      configName: 'accounts',
      cwd: TEST_DATA_DIR
    });
    console.log('✓ AccountConfigManager initialized');
    
    sessionManager = new SessionManager({
      userDataPath: TEST_DATA_DIR
    });
    console.log('✓ SessionManager initialized');
    
    translationService = new TranslationIntegration();
    await translationService.initialize();
    console.log('✓ TranslationIntegration initialized');
    
    // Create main window
    mainWindow = new MainWindow({
      width: 1400,
      height: 900,
      show: false
    });
    mainWindow.initialize();
    console.log('✓ MainWindow created');
    
    // Wait for window to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Initialize ViewManager
    viewManager = new ViewManager(mainWindow, sessionManager);
    console.log('✓ ViewManager initialized');
    
    return true;
  } catch (error) {
    console.error('✗ Setup failed:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

/**
 * Test 1: Account creation to view creation flow
 */
async function test1_AccountCreationToViewFlow() {
  console.log('\n=== Test 1: Account Creation to View Creation Flow ===\n');
  
  const results = { passed: 0, failed: 0 };
  
  for (let i = 0; i < TEST_ACCOUNTS.length; i++) {
    const accountConfig = TEST_ACCOUNTS[i];
    
    try {
      console.log(`\nCreating account: ${accountConfig.name}`);
      
      // Step 1: Create account
      const createResult = await accountManager.createAccount(accountConfig);
      if (!createResult.success || !createResult.account) {
        throw new Error(`Failed to create account: ${createResult.errors ? createResult.errors.join(', ') : 'Unknown error'}`);
      }
      const account = createResult.account;
      createdAccountIds.push(account.id);
      console.log(`  ✓ Account created with ID: ${account.id}`);
      
      // Step 2: Create session
      const sessionResult = await sessionManager.createSession(account.id);
      if (!sessionResult.success) {
        throw new Error(`Session creation failed: ${sessionResult.error}`);
      }
      console.log(`  ✓ Session created for account ${account.id}`);
      
      // Step 3: Verify session isolation
      const sessionObj = sessionManager.getSession(account.id);
      if (!sessionObj) {
        throw new Error('Session not found');
      }
      console.log(`  ✓ Session retrieved: ${sessionObj.partition}`);
      
      // Step 4: Create view
      try {
        await viewManager.createView(account.id, {
          translation: accountConfig.translation
        });
        console.log(`  ✓ View created for account ${account.id}`);
      } catch (viewError) {
        throw new Error(`View creation failed: ${viewError.message}`);
      }
      
      // Step 5: Verify view exists
      const view = viewManager.getView(account.id);
      if (!view) {
        throw new Error('View not found after creation');
      }
      console.log(`  ✓ View verified in ViewManager`);
      
      // Step 6: Configure translation if enabled
      if (accountConfig.translation.enabled) {
        const translationResult = await translationService.configureTranslation(
          account.id,
          accountConfig.translation,
          view
        );
        if (!translationResult.success) {
          throw new Error(`Translation config failed: ${translationResult.error}`);
        }
        console.log(`  ✓ Translation configured for account ${account.id}`);
      }
      
      console.log(`✓ Complete flow successful for ${accountConfig.name}`);
      results.passed++;
      
    } catch (error) {
      console.error(`✗ Flow failed for ${accountConfig.name}:`, error.message);
      console.error('  Full error:', error);
      results.failed++;
    }
  }
  
  console.log(`\nTest 1 Results: ${results.passed} passed, ${results.failed} failed`);
  return results;
}

/**
 * Test 2: Account switching and state preservation
 */
async function test2_AccountSwitchingAndState() {
  console.log('\n=== Test 2: Account Switching and State Preservation ===\n');
  
  const results = { passed: 0, failed: 0 };
  
  if (createdAccountIds.length < 2) {
    console.log('⚠ Skipping test: Need at least 2 accounts');
    return results;
  }
  
  try {
    // Test switching between accounts
    for (let i = 0; i < createdAccountIds.length; i++) {
      const accountId = createdAccountIds[i];
      
      console.log(`\nSwitching to account: ${accountId}`);
      
      // Switch to account
      try {
        await viewManager.showView(accountId);
        console.log(`  ✓ Switched to account ${accountId}`);
      } catch (switchError) {
        throw new Error(`Failed to switch to account: ${switchError.message}`);
      }
      
      // Verify active view
      const activeView = viewManager.getActiveView();
      const activeAccountId = viewManager.getActiveAccountId();
      if (!activeView || activeAccountId !== accountId) {
        throw new Error(`Active view mismatch: expected ${accountId}, got ${activeAccountId}`);
      }
      console.log(`  ✓ Active view verified: ${activeAccountId}`);
      
      // Verify view state
      const viewState = viewManager.getViewState(accountId);
      if (!viewState || !viewState.isVisible) {
        throw new Error('View state incorrect');
      }
      console.log(`  ✓ View state correct: visible=${viewState.isVisible}`);
      
      // Wait a bit to simulate user interaction
      await new Promise(resolve => setTimeout(resolve, 500));
      
      results.passed++;
    }
    
    // Test rapid switching
    console.log('\nTesting rapid switching...');
    for (let i = 0; i < 3; i++) {
      const accountId = createdAccountIds[i % createdAccountIds.length];
      await viewManager.showView(accountId);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('  ✓ Rapid switching successful');
    results.passed++;
    
    // Verify all views still exist
    console.log('\nVerifying all views still exist...');
    for (const accountId of createdAccountIds) {
      const view = viewManager.getView(accountId);
      if (!view) {
        throw new Error(`View lost for account ${accountId}`);
      }
    }
    console.log('  ✓ All views preserved');
    results.passed++;
    
  } catch (error) {
    console.error('✗ Account switching test failed:', error.message);
    results.failed++;
  }
  
  console.log(`\nTest 2 Results: ${results.passed} passed, ${results.failed} failed`);
  return results;
}

/**
 * Test 3: Translation injection and configuration
 */
async function test3_TranslationInjectionAndConfig() {
  console.log('\n=== Test 3: Translation Injection and Configuration ===\n');
  
  const results = { passed: 0, failed: 0 };
  
  for (const accountId of createdAccountIds) {
    try {
      const account = await accountManager.getAccount(accountId);
      if (!account.translation || !account.translation.enabled) {
        console.log(`  ⚠ Skipping ${accountId}: translation not enabled`);
        continue;
      }
      
      console.log(`\nTesting translation for account: ${accountId}`);
      
      // Get view
      const view = viewManager.getView(accountId);
      if (!view) {
        throw new Error('View not found');
      }
      
      // Note: Skip actual WhatsApp Web loading in integration tests
      // as it requires network and may timeout
      console.log('  ⚠ Skipping WhatsApp Web load (network dependent)');
      
      // Test translation configuration without loading page
      const newConfig = {
        ...account.translation,
        targetLanguage: 'es',
        autoTranslate: !account.translation.autoTranslate
      };
      
      const configResult = await translationService.configureTranslation(
        accountId,
        newConfig,
        view
      );
      if (!configResult.success) {
        throw new Error(`Config update failed: ${configResult.error}`);
      }
      console.log('  ✓ Translation configuration updated');
      
      // Verify config stored
      const storedConfig = translationService.getTranslationConfig(accountId);
      if (!storedConfig || storedConfig.targetLanguage !== 'es') {
        throw new Error('Configuration not stored correctly');
      }
      console.log('  ✓ Configuration verified');
      
      // Verify translation status tracking
      const status = translationService.getTranslationStatus(accountId);
      if (status) {
        console.log('  ✓ Translation status tracked');
      }
      
      results.passed++;
      
    } catch (error) {
      console.error(`✗ Translation test failed for ${accountId}:`, error.message);
      console.error('  Stack:', error.stack);
      results.failed++;
    }
  }
  
  console.log(`\nTest 3 Results: ${results.passed} passed, ${results.failed} failed`);
  return results;
}


/**
 * Test 5: Session persistence and restoration
 */
async function test5_SessionPersistenceAndRestoration() {
  console.log('\n=== Test 5: Session Persistence and Restoration ===\n');
  
  const results = { passed: 0, failed: 0 };
  
  try {
    // Test session data persistence
    console.log('\nTesting session data persistence...');
    
    for (const accountId of createdAccountIds) {
      // Check if session data exists
      const hasSession = await sessionManager.hasSessionData(accountId);
      console.log(`  Account ${accountId}: has session data = ${hasSession}`);
      
      // Get persistence status
      const persistenceStatus = await sessionManager.getSessionPersistenceStatus(accountId);
      if (persistenceStatus.persisted !== undefined) {
        console.log(`    ✓ Persistence status: ${persistenceStatus.persisted}`);
        console.log(`    - Data size: ${persistenceStatus.dataSize} bytes`);
        console.log(`    - File count: ${persistenceStatus.fileCount || 0}`);
      }
      
      // Get session stats
      const stats = await sessionManager.getSessionDataStats(accountId);
      if (!stats.error) {
        console.log(`    ✓ Session stats: ${stats.size} bytes, ${stats.files} files`);
      }
    }
    results.passed++;
    
    // Test session restoration simulation
    console.log('\nSimulating session restoration...');
    
    // Save current state
    const accountStates = [];
    for (const accountId of createdAccountIds) {
      const account = await accountManager.getAccount(accountId);
      const viewState = viewManager.getViewState(accountId);
      accountStates.push({
        accountId,
        account,
        viewState
      });
    }
    console.log(`  ✓ Saved state for ${accountStates.length} accounts`);
    
    // Simulate app restart by hiding all views
    console.log('\nSimulating app restart (hiding views)...');
    for (const accountId of createdAccountIds) {
      await viewManager.hideView(accountId);
    }
    console.log('  ✓ All views hidden');
    
    // Restore views
    console.log('\nRestoring views...');
    for (const state of accountStates) {
      try {
        await viewManager.showView(state.accountId);
        console.log(`  ✓ View restored for ${state.accountId}`);
      } catch (restoreError) {
        throw new Error(`Failed to restore view for ${state.accountId}: ${restoreError.message}`);
      }
    }
    results.passed++;
    
    // Test session expiration handling
    console.log('\nTesting session expiration handling...');
    const testAccountId = createdAccountIds[0];
    const expirationResult = await sessionManager.handleSessionExpiration(testAccountId, {
      clearCache: true
    });
    if (expirationResult.success) {
      console.log(`  ✓ Session expiration handled for ${testAccountId}`);
      results.passed++;
    } else {
      throw new Error(`Expiration handling failed: ${expirationResult.error}`);
    }
    
  } catch (error) {
    console.error('✗ Session persistence test failed:', error.message);
    results.failed++;
  }
  
  console.log(`\nTest 5 Results: ${results.passed} passed, ${results.failed} failed`);
  return results;
}

/**
 * Cleanup test environment
 */
async function cleanupTestEnvironment() {
  console.log('\n=== Cleaning up test environment ===\n');
  
  try {
    // Destroy all views
    for (const accountId of createdAccountIds) {
      await viewManager.destroyView(accountId);
      console.log(`✓ View destroyed for ${accountId}`);
    }
    
    // Clear all sessions
    for (const accountId of createdAccountIds) {
      await sessionManager.clearSessionData(accountId);
      console.log(`✓ Session cleared for ${accountId}`);
    }
    
    // Delete all accounts
    for (const accountId of createdAccountIds) {
      await accountManager.deleteAccount(accountId);
      console.log(`✓ Account deleted: ${accountId}`);
    }
    
    // Close main window
    if (mainWindow && mainWindow.getWindow() && !mainWindow.getWindow().isDestroyed()) {
      mainWindow.close();
      console.log('✓ Main window closed');
    }
    
    // Clean up test data directory
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
      console.log('✓ Test data directory removed');
    } catch (error) {
      console.log('⚠ Could not remove test data directory:', error.message);
    }
    
    console.log('\n✓ Cleanup complete');
    return true;
    
  } catch (error) {
    console.error('✗ Cleanup failed:', error);
    return false;
  }
}

/**
 * Run all integration tests
 */
async function runIntegrationTests() {
  console.log('\n' + '='.repeat(70));
  console.log('INTEGRATION TEST SUITE - Single-Window Multi-Account Architecture');
  console.log('='.repeat(70));
  
  const overallResults = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  try {
    // Setup
    const setupSuccess = await setupTestEnvironment();
    if (!setupSuccess) {
      throw new Error('Test environment setup failed');
    }
    
    // Run tests
    const test1Results = await test1_AccountCreationToViewFlow();
    overallResults.total += test1Results.passed + test1Results.failed;
    overallResults.passed += test1Results.passed;
    overallResults.failed += test1Results.failed;
    
    const test2Results = await test2_AccountSwitchingAndState();
    overallResults.total += test2Results.passed + test2Results.failed;
    overallResults.passed += test2Results.passed;
    overallResults.failed += test2Results.failed;
    
    const test3Results = await test3_TranslationInjectionAndConfig();
    overallResults.total += test3Results.passed + test3Results.failed;
    overallResults.passed += test3Results.passed;
    overallResults.failed += test3Results.failed;
    
    
    
    const test5Results = await test5_SessionPersistenceAndRestoration();
    overallResults.total += test5Results.passed + test5Results.failed;
    overallResults.passed += test5Results.passed;
    overallResults.failed += test5Results.failed;
    
  } catch (error) {
    console.error('\n✗ Test suite failed:', error);
    overallResults.failed++;
  } finally {
    // Cleanup
    await cleanupTestEnvironment();
  }
  
  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('INTEGRATION TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total tests: ${overallResults.total}`);
  console.log(`Passed: ${overallResults.passed} ✓`);
  console.log(`Failed: ${overallResults.failed} ✗`);
  console.log(`Success rate: ${overallResults.total > 0 ? ((overallResults.passed / overallResults.total) * 100).toFixed(1) : 0}%`);
  console.log('='.repeat(70) + '\n');
  
  // Exit
  setTimeout(() => {
    app.quit();
    process.exit(overallResults.failed === 0 ? 0 : 1);
  }, 1000);
}

// App lifecycle
app.whenReady().then(() => {
  runIntegrationTests().catch(error => {
    console.error('Fatal error:', error);
    app.quit();
    process.exit(1);
  });
});

app.on('window-all-closed', () => {
  // Don't quit on macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  app.quit();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  app.quit();
  process.exit(1);
});

module.exports = {
  runIntegrationTests
};
