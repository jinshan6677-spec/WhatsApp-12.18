/**
 * Test script for memory management features
 * Tests view pooling, memory monitoring, and automatic cleanup
 */

const path = require('path');

// Mock Electron modules
function createMockSession(accountId) {
  return {
    partition: `persist:account_${accountId}`,
    getStoragePath: () => `/test/path/${accountId}`,
    clearCache: async () => {},
    clearStorageData: async () => {},
    cookies: {
      set: async () => {},
      get: async () => []
    },
    webRequest: {
      onBeforeSendHeaders: () => {}
    }
  };
}

function createMockBrowserView(accountId) {
  const session = createMockSession(accountId);
  
  return {
    webContents: {
      isDestroyed: () => false,
      destroy: () => {},
      loadURL: async () => {},
      executeJavaScript: async (script) => {
        // Simulate memory info
        if (script.includes('performance.memory')) {
          return {
            usedJSHeapSize: Math.floor(Math.random() * 400) + 100, // 100-500 MB
            totalJSHeapSize: 512,
            jsHeapSizeLimit: 2048
          };
        }
        return null;
      },
      getOSProcessId: () => Math.floor(Math.random() * 10000),
      setUserAgent: () => {},
      on: () => {},
      session: session
    },
    setBounds: () => {}
  };
}

const mockElectron = {
  BrowserView: class {
    constructor(options) {
      // Extract accountId from partition
      const partition = options?.webPreferences?.partition || 'persist:account_test';
      const accountId = partition.replace('persist:account_', '');
      return createMockBrowserView(accountId);
    }
  }
};

// Mock modules
require.cache[require.resolve('electron')] = {
  exports: mockElectron
};

// Load modules
const { ViewManager } = require('../src/presentation/windows/view-manager');

// Mock MainWindow
class MockMainWindow {
  constructor() {
    this.window = {
      isDestroyed: () => false,
      getContentBounds: () => ({ x: 0, y: 0, width: 1400, height: 900 }),
      addBrowserView: () => {},
      removeBrowserView: () => {},
      setTopBrowserView: () => {},
      webContents: {
        send: () => {}
      }
    };
    this.stateStore = new Map();
  }

  getWindow() {
    return this.window;
  }

  getSidebarWidth() {
    return 280;
  }

  getStateStore() {
    return this.stateStore;
  }
}

// Mock SessionManager
class MockSessionManager {
  constructor() {
    this.sessions = new Map();
  }

  getInstanceSession(accountId) {
    if (!this.sessions.has(accountId)) {
      this.sessions.set(accountId, createMockSession(accountId));
    }
    return this.sessions.get(accountId);
  }

  async restoreLoginState() {
    return { success: true, isLoggedIn: false };
  }

  async checkSessionExpiration() {
    return { expired: false, needsReauth: false };
  }

  monitorSessionHealth() {
    return { stop: () => {} };
  }

  async getSessionPersistenceStatus() {
    return { hasData: true, dataSize: 1024 };
  }
}

// Test utilities
function log(message, ...args) {
  console.log(`[TEST] ${message}`, ...args);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test functions
async function testViewPooling() {
  log('Testing view pooling...');

  const mainWindow = new MockMainWindow();
  const sessionManager = new MockSessionManager();
  const viewManager = new ViewManager(mainWindow, sessionManager, {
    viewPoolSize: 2,
    maxConcurrentViews: 5
  });

  // Create multiple views
  await viewManager.createView('account1', {});
  await viewManager.createView('account2', {});
  await viewManager.createView('account3', {});

  assert(viewManager.getViewCount() === 3, 'Should have 3 views');

  // Pool a view
  await viewManager._poolView('account1');

  assert(viewManager.getViewCount() === 2, 'Should have 2 active views after pooling');
  
  const poolStats = viewManager.getPoolStats();
  assert(poolStats.size === 1, 'Pool should have 1 view');
  assert(poolStats.maxSize === 2, 'Pool max size should be 2');

  log('✓ View pooling works correctly');

  // Test pool overflow
  await viewManager._poolView('account2');
  await viewManager._poolView('account3');

  const poolStats2 = viewManager.getPoolStats();
  assert(poolStats2.size === 2, 'Pool should be at max size (2)');

  log('✓ Pool size limit enforced correctly');

  // Cleanup
  await viewManager.destroyAllViews();
}

async function testMemoryMonitoring() {
  log('Testing memory monitoring...');

  const mainWindow = new MockMainWindow();
  const sessionManager = new MockSessionManager();
  const viewManager = new ViewManager(mainWindow, sessionManager, {
    memoryWarningThreshold: 200,
    maxMemoryPerView: 400,
    autoMemoryCleanup: false // Disable auto cleanup for testing
  });

  // Create views
  await viewManager.createView('account1', {});
  await viewManager.createView('account2', {});

  // Get memory usage
  const memoryUsage = await viewManager.getMemoryUsage();
  
  assert(memoryUsage.totalViews === 2, 'Should track 2 views');
  assert(memoryUsage.viewDetails.length === 2, 'Should have details for 2 views');
  assert(typeof memoryUsage.totalMemory === 'number', 'Should calculate total memory');

  log('✓ Memory usage tracking works');

  // Get memory stats
  const memoryStats = await viewManager.getMemoryStats();
  
  assert(memoryStats.totalViews === 2, 'Stats should show 2 views');
  assert(typeof memoryStats.averageMemoryMB === 'number', 'Should calculate average');
  assert(Array.isArray(memoryStats.highMemoryViews), 'Should track high memory views');

  log('✓ Memory statistics calculation works');

  // Test memory limits
  const limits = viewManager.getMemoryLimits();
  assert(limits.warningThreshold === 200, 'Warning threshold should be 200MB');
  assert(limits.maxMemory === 400, 'Max memory should be 400MB');

  // Update limits
  viewManager.setMemoryLimits({
    warningThreshold: 250,
    maxMemory: 500
  });

  const newLimits = viewManager.getMemoryLimits();
  assert(newLimits.warningThreshold === 250, 'Warning threshold should be updated');
  assert(newLimits.maxMemory === 500, 'Max memory should be updated');

  log('✓ Memory limits configuration works');

  // Cleanup
  await viewManager.destroyAllViews();
}

async function testMemoryOptimization() {
  log('Testing memory optimization...');

  const mainWindow = new MockMainWindow();
  const sessionManager = new MockSessionManager();
  const viewManager = new ViewManager(mainWindow, sessionManager, {
    maxConcurrentViews: 3,
    viewPoolSize: 2
  });

  // Create views and simulate access times
  await viewManager.createView('account1', {});
  await sleep(10);
  await viewManager.createView('account2', {});
  await sleep(10);
  await viewManager.createView('account3', {});

  // Simulate old access times
  viewManager.viewAccessTimes.set('account1', Date.now() - 10 * 60 * 1000); // 10 minutes ago
  viewManager.viewAccessTimes.set('account2', Date.now() - 2 * 60 * 1000);  // 2 minutes ago
  viewManager.viewAccessTimes.set('account3', Date.now());                   // Just now

  // Set account3 as active
  await viewManager.showView('account3');

  // Run memory optimization
  const results = await viewManager.optimizeMemory({
    inactiveThreshold: 5 * 60 * 1000 // 5 minutes
  });

  assert(results.checked >= 3, 'Should check all views');
  assert(results.destroyed + results.pooled >= 1, 'Should optimize at least 1 view');
  assert(results.kept >= 1, 'Should keep active view');

  log('✓ Memory optimization works correctly');

  // Cleanup
  await viewManager.destroyAllViews();
}

async function testViewLimitEnforcement() {
  log('Testing view limit enforcement...');

  const mainWindow = new MockMainWindow();
  const sessionManager = new MockSessionManager();
  const viewManager = new ViewManager(mainWindow, sessionManager, {
    maxConcurrentViews: 3,
    viewPoolSize: 2
  });

  // Create views up to limit
  await viewManager.createView('account1', {});
  await viewManager.createView('account2', {});
  await viewManager.createView('account3', {});

  assert(viewManager.getViewCount() === 3, 'Should have 3 views at limit');

  // Try to create one more - should trigger enforcement
  await viewManager.createView('account4', {});

  // After enforcement, should still be within limits
  assert(viewManager.getViewCount() <= 3, 'Should enforce view limit');

  log('✓ View limit enforcement works');

  // Cleanup
  await viewManager.destroyAllViews();
}

async function testPerformanceStats() {
  log('Testing performance statistics...');

  const mainWindow = new MockMainWindow();
  const sessionManager = new MockSessionManager();
  const viewManager = new ViewManager(mainWindow, sessionManager, {
    maxConcurrentViews: 5,
    viewPoolSize: 2,
    lazyLoadViews: true
  });

  // Create some views
  await viewManager.createView('account1', {});
  await viewManager.createView('account2', {});

  // Pool one view
  await viewManager._poolView('account1');

  // Get performance stats
  const stats = viewManager.getPerformanceStats();

  assert(stats.totalViews === 1, 'Should show 1 active view');
  assert(stats.pooledViews === 1, 'Should show 1 pooled view');
  assert(stats.maxConcurrentViews === 5, 'Should show max concurrent views');
  assert(stats.lazyLoadEnabled === true, 'Should show lazy load enabled');
  assert(stats.memoryMonitoring, 'Should have memory monitoring info');
  assert(Array.isArray(stats.viewAccessTimes), 'Should have access times');
  assert(Array.isArray(stats.poolDetails), 'Should have pool details');

  log('✓ Performance statistics work correctly');

  // Cleanup
  await viewManager.destroyAllViews();
}

async function testStalePoolCleanup() {
  log('Testing stale pool cleanup...');

  const mainWindow = new MockMainWindow();
  const sessionManager = new MockSessionManager();
  const viewManager = new ViewManager(mainWindow, sessionManager, {
    viewPoolSize: 3
  });

  // Create and pool views
  await viewManager.createView('account1', {});
  await viewManager.createView('account2', {});
  await viewManager.createView('account3', {});

  await viewManager._poolView('account1');
  await viewManager._poolView('account2');
  await viewManager._poolView('account3');

  assert(viewManager.getPoolStats().size === 3, 'Pool should have 3 views');

  // Simulate old pooled views
  viewManager.viewPool[0].pooledAt = Date.now() - 10 * 60 * 1000; // 10 minutes ago
  viewManager.viewPool[1].pooledAt = Date.now() - 2 * 60 * 1000;  // 2 minutes ago

  // Clean up stale views (older than 5 minutes)
  const cleaned = viewManager.cleanupStalePooledViews(5 * 60 * 1000);

  assert(cleaned === 1, 'Should clean up 1 stale view');
  assert(viewManager.getPoolStats().size === 2, 'Pool should have 2 views after cleanup');

  log('✓ Stale pool cleanup works correctly');

  // Cleanup
  await viewManager.destroyAllViews();
}

async function testCacheClearing() {
  log('Testing cache clearing...');

  const mainWindow = new MockMainWindow();
  const sessionManager = new MockSessionManager();
  const viewManager = new ViewManager(mainWindow, sessionManager);

  // Create view
  await viewManager.createView('account1', {});

  // Clear cache
  const result = await viewManager.clearViewCache('account1');

  assert(result === true, 'Cache clearing should succeed');

  log('✓ Cache clearing works');

  // Cleanup
  await viewManager.destroyAllViews();
}

// Run all tests
async function runTests() {
  console.log('='.repeat(60));
  console.log('Memory Management Tests');
  console.log('='.repeat(60));

  const tests = [
    { name: 'View Pooling', fn: testViewPooling },
    { name: 'Memory Monitoring', fn: testMemoryMonitoring },
    { name: 'Memory Optimization', fn: testMemoryOptimization },
    { name: 'View Limit Enforcement', fn: testViewLimitEnforcement },
    { name: 'Performance Statistics', fn: testPerformanceStats },
    { name: 'Stale Pool Cleanup', fn: testStalePoolCleanup },
    { name: 'Cache Clearing', fn: testCacheClearing }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log('');
      await test.fn();
      passed++;
    } catch (error) {
      console.error(`✗ ${test.name} failed:`, error.message);
      console.error(error.stack);
      failed++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`Tests completed: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
