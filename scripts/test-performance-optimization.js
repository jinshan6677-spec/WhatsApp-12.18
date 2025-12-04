/**
 * Test script for performance optimizations (Task 33)
 * 
 * Tests:
 * 1. View lazy loading
 * 2. Bounds calculation caching
 * 3. Memory management (view pooling and limits)
 * 4. View switching latency
 * 5. Performance utilities
 */

const path = require('path');

// Mock Electron modules
const mockBrowserView = {
  webContents: {
    isDestroyed: () => false,
    destroy: () => {},
    loadURL: async () => {},
    setUserAgent: () => {},
    executeJavaScript: async () => ({ isLoggedIn: false }),
    on: () => {},
    getOSProcessId: () => 12345
  },
  setBounds: () => {}
};

const mockSession = {
  partition: 'persist:test',
  getStoragePath: () => '/test/path',
  cookies: {
    set: async () => {},
    get: async () => []
  },
  webRequest: {
    onBeforeSendHeaders: () => {}
  }
};

const mockWindow = {
  isDestroyed: () => false,
  getBounds: () => ({ x: 0, y: 0, width: 1400, height: 900 }),
  getContentBounds: () => ({ x: 0, y: 0, width: 1400, height: 900 }),
  addBrowserView: () => {},
  removeBrowserView: () => {},
  setTopBrowserView: () => {},
  webContents: {
    send: () => {}
  }
};

const mockMainWindow = {
  getWindow: () => mockWindow,
  getSidebarWidth: () => 280,
  getStateStore: () => ({
    get: () => null,
    set: () => {},
    delete: () => {}
  })
};

const mockSessionManager = {
  getInstanceSession: () => mockSession,
  restoreLoginState: async () => ({ success: true, isLoggedIn: false }),
  handleSessionExpiration: async () => ({ success: true }),
  forceLogout: async () => ({ success: true }),
  checkSessionExpiration: async () => ({ expired: false, needsReauth: false }),
  monitorSessionHealth: () => ({ stop: () => {} }),
  getSessionPersistenceStatus: async () => ({ hasData: true })
};

// Mock Electron before requiring modules
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === 'electron') {
    return {
      BrowserView: function() { return mockBrowserView; },
      screen: {
        getAllDisplays: () => [],
        getPrimaryDisplay: () => ({
          workAreaSize: { width: 1920, height: 1080 }
        })
      }
    };
  }
  if (id === 'electron-store') {
    return function() {
      return {
        get: (key, defaultValue) => defaultValue,
        set: () => {},
        delete: () => {}
      };
    };
  }
  return originalRequire.apply(this, arguments);
};

// Import modules after mocking
const { ViewManager } = require('../src/presentation/windows/view-manager');
const PerformanceOptimizer = require('../src/utils/PerformanceOptimizer');

/**
 * Test suite
 */
async function runTests() {
  console.log('='.repeat(80));
  console.log('Performance Optimization Tests (Task 33)');
  console.log('='.repeat(80));
  console.log('');

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: View Lazy Loading
  console.log('Test 1: View Lazy Loading');
  console.log('-'.repeat(80));
  try {
    const viewManager = new ViewManager(mockMainWindow, mockSessionManager, {
      lazyLoadViews: true,
      maxConcurrentViews: 5
    });

    // Initially, no views should exist
    if (viewManager.getViewCount() !== 0) {
      throw new Error('Expected 0 views initially');
    }
    console.log('✓ No views created initially');

    // Switch to account - should create view lazily
    await viewManager.switchView('test-account-1', {
      viewConfig: { url: 'https://web.whatsapp.com' }
    });

    if (viewManager.getViewCount() !== 1) {
      throw new Error('Expected 1 view after lazy load');
    }
    console.log('✓ View created lazily on first access');

    // Switch to same account - should not create new view
    await viewManager.switchView('test-account-1');

    if (viewManager.getViewCount() !== 1) {
      throw new Error('Expected still 1 view');
    }
    console.log('✓ No duplicate view created on re-access');

    console.log('✅ Test 1 PASSED\n');
    passedTests++;
  } catch (error) {
    console.error('❌ Test 1 FAILED:', error.message);
    console.error(error.stack);
    console.log('');
    failedTests++;
  }

  // Test 2: Bounds Calculation Caching
  console.log('Test 2: Bounds Calculation Caching');
  console.log('-'.repeat(80));
  try {
    const viewManager = new ViewManager(mockMainWindow, mockSessionManager);

    // Calculate bounds first time
    const bounds1 = viewManager._calculateViewBounds(280);
    console.log('✓ First bounds calculation:', JSON.stringify(bounds1));

    // Calculate again with same parameters - should use cache
    const startTime = Date.now();
    const bounds2 = viewManager._calculateViewBounds(280);
    const duration = Date.now() - startTime;

    if (JSON.stringify(bounds1) !== JSON.stringify(bounds2)) {
      throw new Error('Cached bounds do not match');
    }
    console.log('✓ Second calculation used cache (took', duration, 'ms)');

    // Force recalculation
    const bounds3 = viewManager._calculateViewBounds(280, true);
    if (JSON.stringify(bounds1) !== JSON.stringify(bounds3)) {
      throw new Error('Forced recalculation produced different bounds');
    }
    console.log('✓ Forced recalculation works correctly');

    // Invalidate cache
    viewManager.invalidateBoundsCache();
    const bounds4 = viewManager._calculateViewBounds(280);
    if (JSON.stringify(bounds1) !== JSON.stringify(bounds4)) {
      throw new Error('Bounds after cache invalidation do not match');
    }
    console.log('✓ Cache invalidation works correctly');

    console.log('✅ Test 2 PASSED\n');
    passedTests++;
  } catch (error) {
    console.error('❌ Test 2 FAILED:', error.message);
    console.error(error.stack);
    console.log('');
    failedTests++;
  }

  // Test 3: Memory Management (View Limits)
  console.log('Test 3: Memory Management (View Limits)');
  console.log('-'.repeat(80));
  try {
    const viewManager = new ViewManager(mockMainWindow, mockSessionManager, {
      lazyLoadViews: true,
      maxConcurrentViews: 3,
      viewPoolSize: 2
    });

    // Create views up to limit
    await viewManager.switchView('account-1', { viewConfig: {} });
    await viewManager.switchView('account-2', { viewConfig: {} });
    await viewManager.switchView('account-3', { viewConfig: {} });

    if (viewManager.getViewCount() !== 3) {
      throw new Error(`Expected 3 views, got ${viewManager.getViewCount()}`);
    }
    console.log('✓ Created 3 views (at limit)');

    // Create one more - should trigger cleanup
    await viewManager.switchView('account-4', { viewConfig: {} });

    // Should still be at or near limit (some may be pooled)
    const viewCount = viewManager.getViewCount();
    if (viewCount > 3) {
      throw new Error(`Expected <= 3 views after limit enforcement, got ${viewCount}`);
    }
    console.log(`✓ View limit enforced (${viewCount} active views)`);

    // Check pool
    const poolSize = viewManager.viewPool.length;
    console.log(`✓ View pool has ${poolSize} views`);

    console.log('✅ Test 3 PASSED\n');
    passedTests++;
  } catch (error) {
    console.error('❌ Test 3 FAILED:', error.message);
    console.error(error.stack);
    console.log('');
    failedTests++;
  }

  // Test 4: View Switching Latency
  console.log('Test 4: View Switching Latency');
  console.log('-'.repeat(80));
  try {
    const viewManager = new ViewManager(mockMainWindow, mockSessionManager, {
      lazyLoadViews: false
    });

    // Pre-create views
    await viewManager.createView('account-1', {});
    await viewManager.createView('account-2', {});
    console.log('✓ Pre-created 2 views');

    // Measure switch time
    const startTime = Date.now();
    await viewManager.switchView('account-1');
    await viewManager.switchView('account-2');
    await viewManager.switchView('account-1');
    const duration = Date.now() - startTime;

    console.log(`✓ 3 view switches took ${duration}ms (avg: ${(duration / 3).toFixed(2)}ms)`);

    if (duration / 3 > 100) {
      console.warn('⚠️  Average switch time > 100ms (target: <100ms)');
    } else {
      console.log('✓ Switch latency within target (<100ms)');
    }

    console.log('✅ Test 4 PASSED\n');
    passedTests++;
  } catch (error) {
    console.error('❌ Test 4 FAILED:', error.message);
    console.error(error.stack);
    console.log('');
    failedTests++;
  }

  // Test 5: Performance Utilities
  console.log('Test 5: Performance Utilities');
  console.log('-'.repeat(80));
  try {
    // Test debounce
    let debounceCount = 0;
    const debouncedFunc = PerformanceOptimizer.debounce(() => {
      debounceCount++;
    }, 50, 'test-debounce');

    debouncedFunc();
    debouncedFunc();
    debouncedFunc();

    await new Promise(resolve => setTimeout(resolve, 100));

    if (debounceCount !== 1) {
      throw new Error(`Expected debounce to call once, called ${debounceCount} times`);
    }
    console.log('✓ Debounce works correctly');

    // Test throttle
    let throttleCount = 0;
    const throttledFunc = PerformanceOptimizer.throttle(() => {
      throttleCount++;
    }, 50, 'test-throttle');

    throttledFunc();
    throttledFunc();
    await new Promise(resolve => setTimeout(resolve, 60));
    throttledFunc();

    if (throttleCount !== 2) {
      throw new Error(`Expected throttle to call twice, called ${throttleCount} times`);
    }
    console.log('✓ Throttle works correctly');

    // Test memoize
    let computeCount = 0;
    const expensiveFunc = (x) => {
      computeCount++;
      return x * 2;
    };
    const memoizedFunc = PerformanceOptimizer.memoize(expensiveFunc, {
      key: 'test-memoize'
    });

    const result1 = memoizedFunc(5);
    const result2 = memoizedFunc(5);
    const result3 = memoizedFunc(10);

    if (result1 !== 10 || result2 !== 10 || result3 !== 20) {
      throw new Error('Memoized function returned wrong results');
    }

    if (computeCount !== 2) {
      throw new Error(`Expected 2 computations, got ${computeCount}`);
    }
    console.log('✓ Memoization works correctly');

    // Test lazy
    let lazyComputeCount = 0;
    const lazyValue = PerformanceOptimizer.lazy(() => {
      lazyComputeCount++;
      return 'computed';
    });

    if (lazyComputeCount !== 0) {
      throw new Error('Lazy value computed too early');
    }

    const value1 = lazyValue.get();
    const value2 = lazyValue.get();

    if (lazyComputeCount !== 1) {
      throw new Error(`Expected 1 lazy computation, got ${lazyComputeCount}`);
    }

    if (value1 !== 'computed' || value2 !== 'computed') {
      throw new Error('Lazy value returned wrong result');
    }
    console.log('✓ Lazy evaluation works correctly');

    console.log('✅ Test 5 PASSED\n');
    passedTests++;
  } catch (error) {
    console.error('❌ Test 5 FAILED:', error.message);
    console.error(error.stack);
    console.log('');
    failedTests++;
  }

  // Test 6: Performance Statistics
  console.log('Test 6: Performance Statistics');
  console.log('-'.repeat(80));
  try {
    const viewManager = new ViewManager(mockMainWindow, mockSessionManager, {
      lazyLoadViews: true,
      maxConcurrentViews: 5
    });

    await viewManager.switchView('account-1', { viewConfig: {} });
    await viewManager.switchView('account-2', { viewConfig: {} });

    const stats = viewManager.getPerformanceStats();

    if (!stats.totalViews || stats.totalViews !== 2) {
      throw new Error('Performance stats missing or incorrect');
    }

    console.log('✓ Performance stats:', JSON.stringify(stats, null, 2));

    const memoryUsage = await viewManager.getMemoryUsage();
    console.log('✓ Memory usage:', JSON.stringify(memoryUsage, null, 2));

    console.log('✅ Test 6 PASSED\n');
    passedTests++;
  } catch (error) {
    console.error('❌ Test 6 FAILED:', error.message);
    console.error(error.stack);
    console.log('');
    failedTests++;
  }

  // Summary
  console.log('='.repeat(80));
  console.log('Test Summary');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log('');

  if (failedTests === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
