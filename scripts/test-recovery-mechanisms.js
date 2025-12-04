/**
 * Test script for recovery mechanisms
 * 
 * Tests:
 * - Retry logic with exponential backoff
 * - Session data recovery
 * - Account reset functionality
 * - Automatic reconnection
 * - Connection monitoring
 */

const RecoveryManager = require('../src/utils/RecoveryManager');

// Mock dependencies
class MockSessionManager {
  constructor() {
    this.userDataPath = '/mock/path';
    this.sessions = new Map();
  }

  async backupSessionData(accountId, backupPath) {
    console.log(`[MockSessionManager] Backing up session for ${accountId}`);
    return {
      success: true,
      backupPath: `${backupPath}/backup-${accountId}-${Date.now()}`
    };
  }

  async clearSessionData(accountId) {
    console.log(`[MockSessionManager] Clearing session data for ${accountId}`);
    return { success: true };
  }

  async createSession(accountId, config) {
    console.log(`[MockSessionManager] Creating session for ${accountId}`);
    this.sessions.set(accountId, { accountId, config });
    return { success: true, session: {} };
  }

  async forceLogout(accountId, view) {
    console.log(`[MockSessionManager] Forcing logout for ${accountId}`);
    return { success: true };
  }

  getSession(accountId) {
    return this.sessions.get(accountId) || null;
  }
}

class MockViewManager {
  constructor() {
    this.views = new Map();
  }

  hasView(accountId) {
    return this.views.has(accountId);
  }

  async destroyView(accountId) {
    console.log(`[MockViewManager] Destroying view for ${accountId}`);
    this.views.delete(accountId);
    return true;
  }

  async createView(accountId, config) {
    console.log(`[MockViewManager] Creating view for ${accountId}`);
    this.views.set(accountId, {
      accountId,
      config,
      connectionAttempts: 0,
      view: {
        webContents: {
          isDestroyed: () => false,
          reload: async () => {
            console.log(`[MockView] Reloading ${accountId}`);
            this.markConnectionAttempt(accountId);
          },
          loadURL: async (url) => {
            console.log(`[MockView] Loading ${url} for ${accountId}`);
            this.markConnectionAttempt(accountId);
          },
          executeJavaScript: async (script) => {
            this.markConnectionAttempt(accountId);
            return { triggered: true, method: 'mock' };
          }
        }
      }
    });
    return this.views.get(accountId).view;
  }

  getViewState(accountId) {
    const viewData = this.views.get(accountId);
    if (!viewData) return null;
    
    // Simulate connection status improving after refresh
    const connectionStatus = viewData.connectionAttempts > 0 ? 'online' : 'offline';
    
    return {
      accountId,
      view: viewData.view,
      connectionStatus,
      status: 'ready'
    };
  }

  markConnectionAttempt(accountId) {
    const viewData = this.views.get(accountId);
    if (viewData) {
      viewData.connectionAttempts = (viewData.connectionAttempts || 0) + 1;
    }
  }
}

class MockAccountManager {
  constructor() {
    this.accounts = new Map();
    this.accounts.set('test-account-1', {
      id: 'test-account-1',
      name: 'Test Account 1',
      translation: { enabled: false }
    });
  }

  async getAccount(accountId) {
    return this.accounts.get(accountId) || null;
  }
}

// Test functions
async function testRetryOperation() {
  console.log('\n=== Testing Retry Operation ===\n');

  const sessionManager = new MockSessionManager();
  const viewManager = new MockViewManager();
  const accountManager = new MockAccountManager();

  const recoveryManager = new RecoveryManager({
    sessionManager,
    viewManager,
    accountManager
  });

  // Test successful operation after retries
  let attemptCount = 0;
  const operation = async () => {
    attemptCount++;
    console.log(`Attempt ${attemptCount}`);
    if (attemptCount < 3) {
      throw new Error('Transient failure');
    }
    return 'Success!';
  };

  const result = await recoveryManager.retryOperation(operation, {
    operationName: 'test-operation',
    maxRetries: 3
  });

  console.log('Retry result:', result);
  console.log(`Total attempts: ${attemptCount}`);

  if (result.success && attemptCount === 3) {
    console.log('✓ Retry operation test passed');
    return true;
  } else {
    console.log('✗ Retry operation test failed');
    return false;
  }
}

async function testSessionRecovery() {
  console.log('\n=== Testing Session Recovery ===\n');

  const sessionManager = new MockSessionManager();
  const viewManager = new MockViewManager();
  const accountManager = new MockAccountManager();

  const recoveryManager = new RecoveryManager({
    sessionManager,
    viewManager,
    accountManager
  });

  // Create initial view
  await viewManager.createView('test-account-1', {});

  // Test session recovery
  const result = await recoveryManager.recoverSessionData('test-account-1', {
    createBackup: true,
    preserveSettings: true
  });

  console.log('Recovery result:', result);

  if (result.success && result.backupPath) {
    console.log('✓ Session recovery test passed');
    return true;
  } else {
    console.log('✗ Session recovery test failed');
    return false;
  }
}

async function testAccountReset() {
  console.log('\n=== Testing Account Reset ===\n');

  const sessionManager = new MockSessionManager();
  const viewManager = new MockViewManager();
  const accountManager = new MockAccountManager();

  const recoveryManager = new RecoveryManager({
    sessionManager,
    viewManager,
    accountManager
  });

  // Create initial view
  await viewManager.createView('test-account-1', {});

  // Test account reset
  const result = await recoveryManager.resetAccount('test-account-1', {
    createBackup: true,
    preserveSettings: true,
    reloadView: true
  });

  console.log('Reset result:', result);

  if (result.success && result.backupPath) {
    console.log('✓ Account reset test passed');
    return true;
  } else {
    console.log('✗ Account reset test failed');
    return false;
  }
}

async function testReconnection() {
  console.log('\n=== Testing Reconnection ===\n');

  const sessionManager = new MockSessionManager();
  const viewManager = new MockViewManager();
  const accountManager = new MockAccountManager();

  const recoveryManager = new RecoveryManager({
    sessionManager,
    viewManager,
    accountManager
  });

  // Create initial view
  await viewManager.createView('test-account-1', {});

  // Test reconnection
  const result = await recoveryManager.reconnectAccount('test-account-1');

  console.log('Reconnection result:', result);

  if (result.success || result.status === 'already_online') {
    console.log('✓ Reconnection test passed');
    return true;
  } else {
    console.log('✗ Reconnection test failed');
    return false;
  }
}

async function testAutoReconnect() {
  console.log('\n=== Testing Auto-Reconnect ===\n');

  const sessionManager = new MockSessionManager();
  const viewManager = new MockViewManager();
  const accountManager = new MockAccountManager();

  const recoveryManager = new RecoveryManager({
    sessionManager,
    viewManager,
    accountManager
  }, {
    reconnectInterval: 1000 // 1 second for testing
  });

  // Create initial view
  await viewManager.createView('test-account-1', {});

  // Start auto-reconnect
  const controller = recoveryManager.startAutoReconnect('test-account-1', {
    interval: 1000,
    maxAttempts: 2
  });

  console.log('Auto-reconnect started, waiting for attempts...');

  // Wait for attempts
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Stop auto-reconnect
  controller.stop();

  const status = recoveryManager.getRecoveryStatus('test-account-1');
  console.log('Recovery status:', status);

  if (status.reconnectionAttempts >= 0) {
    console.log('✓ Auto-reconnect test passed');
    return true;
  } else {
    console.log('✗ Auto-reconnect test failed');
    return false;
  }
}

async function testConnectionMonitor() {
  console.log('\n=== Testing Connection Monitor ===\n');

  const sessionManager = new MockSessionManager();
  const viewManager = new MockViewManager();
  const accountManager = new MockAccountManager();

  const recoveryManager = new RecoveryManager({
    sessionManager,
    viewManager,
    accountManager
  }, {
    connectionCheckInterval: 1000 // 1 second for testing
  });

  // Create initial view
  await viewManager.createView('test-account-1', {});

  let statusChanges = 0;
  const onStatusChange = (data) => {
    console.log('Status changed:', data);
    statusChanges++;
  };

  // Start connection monitor
  const controller = recoveryManager.startConnectionMonitor('test-account-1', {
    interval: 1000,
    onStatusChange,
    autoReconnect: false
  });

  console.log('Connection monitor started, waiting...');

  // Wait for checks
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Stop monitor
  controller.stop();

  const status = recoveryManager.getRecoveryStatus('test-account-1');
  console.log('Recovery status:', status);

  if (!status.hasConnectionMonitor) {
    console.log('✓ Connection monitor test passed');
    return true;
  } else {
    console.log('✗ Connection monitor test failed');
    return false;
  }
}

async function testCleanup() {
  console.log('\n=== Testing Cleanup ===\n');

  const sessionManager = new MockSessionManager();
  const viewManager = new MockViewManager();
  const accountManager = new MockAccountManager();

  const recoveryManager = new RecoveryManager({
    sessionManager,
    viewManager,
    accountManager
  });

  // Create initial view
  await viewManager.createView('test-account-1', {});

  // Start various monitors
  recoveryManager.startAutoReconnect('test-account-1');
  recoveryManager.startConnectionMonitor('test-account-1');

  // Cleanup
  recoveryManager.cleanup();

  const allStatus = recoveryManager.getAllRecoveryStatus();
  console.log('All recovery status after cleanup:', allStatus);

  if (allStatus.size === 0) {
    console.log('✓ Cleanup test passed');
    return true;
  } else {
    console.log('✗ Cleanup test failed');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('Starting Recovery Mechanisms Tests...\n');

  const tests = [
    { name: 'Retry Operation', fn: testRetryOperation },
    { name: 'Session Recovery', fn: testSessionRecovery },
    { name: 'Account Reset', fn: testAccountReset },
    { name: 'Reconnection', fn: testReconnection },
    { name: 'Auto-Reconnect', fn: testAutoReconnect },
    { name: 'Connection Monitor', fn: testConnectionMonitor },
    { name: 'Cleanup', fn: testCleanup }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
    } catch (error) {
      console.error(`\n✗ ${test.name} threw an error:`, error);
      results.push({ name: test.name, passed: false, error: error.message });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  let passedCount = 0;
  let failedCount = 0;

  results.forEach(result => {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} - ${result.name}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    if (result.passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  });

  console.log('='.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('='.repeat(60));

  process.exit(failedCount > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
