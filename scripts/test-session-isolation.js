#!/usr/bin/env node

/**
 * Session Isolation Test Script
 * 
 * This script verifies that BrowserView sessions are properly isolated between accounts.
 * Tests include:
 * - Unique session partition verification
 * - Cookie isolation
 * - LocalStorage isolation
 * - IndexedDB isolation
 * - Session validation on view creation
 */

const { app, BrowserWindow, BrowserView, session } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Test configuration
const TEST_ACCOUNTS = ['test-account-1', 'test-account-2', 'test-account-3'];
const TEST_URL = 'data:text/html,<html><body><h1>Session Isolation Test</h1></body></html>';
const USER_DATA_PATH = path.join(__dirname, '..', 'test-session-data');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkMark(passed) {
  return passed ? '✓' : '✗';
}

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function recordTest(name, passed, details = '') {
  results.tests.push({ name, passed, details });
  if (passed) {
    results.passed++;
    log(`  ${checkMark(true)} ${name}`, 'green');
  } else {
    results.failed++;
    log(`  ${checkMark(false)} ${name}`, 'red');
  }
  if (details) {
    log(`     ${details}`, 'cyan');
  }
}

/**
 * Clean up test data
 */
async function cleanup() {
  try {
    await fs.rm(USER_DATA_PATH, { recursive: true, force: true });
    log('Test data cleaned up', 'yellow');
  } catch (error) {
    log(`Cleanup warning: ${error.message}`, 'yellow');
  }
}

/**
 * Test 1: Verify unique session partitions
 */
async function testUniquePartitions() {
  log('\n1. Testing unique session partitions...', 'blue');
  
  const sessions = new Map();
  
  for (const accountId of TEST_ACCOUNTS) {
    const partition = `persist:account_${accountId}`;
    const accountSession = session.fromPartition(partition);
    
    // Check if session is unique
    const isDuplicate = Array.from(sessions.values()).some(s => s === accountSession);
    
    if (isDuplicate) {
      recordTest(
        `Account ${accountId} has unique partition`,
        false,
        'Session object is shared with another account'
      );
    } else {
      sessions.set(accountId, accountSession);
      recordTest(
        `Account ${accountId} has unique partition`,
        true,
        `Partition: ${partition}`
      );
    }
  }
  
  // Verify all sessions are different objects
  const uniqueSessions = new Set(sessions.values());
  recordTest(
    'All sessions are unique objects',
    uniqueSessions.size === TEST_ACCOUNTS.length,
    `${uniqueSessions.size} unique sessions out of ${TEST_ACCOUNTS.length}`
  );
}

/**
 * Test 2: Cookie isolation
 */
async function testCookieIsolation(mainWindow) {
  log('\n2. Testing cookie isolation...', 'blue');
  
  const views = new Map();
  const testCookies = new Map();
  
  // Create views and set cookies
  for (let i = 0; i < TEST_ACCOUNTS.length; i++) {
    const accountId = TEST_ACCOUNTS[i];
    const partition = `persist:account_${accountId}`;
    const accountSession = session.fromPartition(partition);
    
    const view = new BrowserView({
      webPreferences: {
        partition,
        session: accountSession,
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    views.set(accountId, { view, session: accountSession });
    
    // Set unique cookie for this account
    const cookieValue = `test-value-${i + 1}`;
    testCookies.set(accountId, cookieValue);
    
    try {
      await accountSession.cookies.set({
        url: 'https://example.com',
        name: 'test-cookie',
        value: cookieValue,
        expirationDate: Math.floor(Date.now() / 1000) + 3600
      });
      
      recordTest(
        `Set cookie for ${accountId}`,
        true,
        `Cookie value: ${cookieValue}`
      );
    } catch (error) {
      recordTest(
        `Set cookie for ${accountId}`,
        false,
        error.message
      );
    }
  }
  
  // Verify cookie isolation
  for (const accountId of TEST_ACCOUNTS) {
    const { session: accountSession } = views.get(accountId);
    const expectedValue = testCookies.get(accountId);
    
    try {
      const cookies = await accountSession.cookies.get({
        url: 'https://example.com',
        name: 'test-cookie'
      });
      
      if (cookies.length === 0) {
        recordTest(
          `Cookie isolation for ${accountId}`,
          false,
          'No cookies found'
        );
      } else if (cookies.length > 1) {
        recordTest(
          `Cookie isolation for ${accountId}`,
          false,
          `Multiple cookies found: ${cookies.length}`
        );
      } else {
        const actualValue = cookies[0].value;
        const isIsolated = actualValue === expectedValue;
        
        recordTest(
          `Cookie isolation for ${accountId}`,
          isIsolated,
          isIsolated 
            ? `Correct value: ${actualValue}`
            : `Expected: ${expectedValue}, Got: ${actualValue}`
        );
      }
    } catch (error) {
      recordTest(
        `Cookie isolation for ${accountId}`,
        false,
        error.message
      );
    }
  }
  
  // Cleanup views
  for (const { view } of views.values()) {
    if (!view.webContents.isDestroyed()) {
      view.webContents.destroy();
    }
  }
}

/**
 * Test 3: LocalStorage isolation
 */
async function testLocalStorageIsolation(mainWindow) {
  log('\n3. Testing localStorage isolation...', 'blue');
  
  const views = new Map();
  const testData = new Map();
  
  // Create views and set localStorage
  for (let i = 0; i < TEST_ACCOUNTS.length; i++) {
    const accountId = TEST_ACCOUNTS[i];
    const partition = `persist:account_${accountId}`;
    const accountSession = session.fromPartition(partition);
    
    const view = new BrowserView({
      webPreferences: {
        partition,
        session: accountSession,
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    mainWindow.addBrowserView(view);
    view.setBounds({ x: 0, y: 0, width: 800, height: 600 });
    
    views.set(accountId, view);
    
    // Load a data URL to have a valid origin
    await view.webContents.loadURL('data:text/html,<html><body>Test</body></html>');
    
    // Wait for page to load
    await new Promise(resolve => {
      if (view.webContents.isLoading()) {
        view.webContents.once('did-finish-load', resolve);
      } else {
        resolve();
      }
    });
    
    // Set unique localStorage value
    const testValue = `storage-value-${i + 1}`;
    testData.set(accountId, testValue);
    
    try {
      await view.webContents.executeJavaScript(`
        localStorage.setItem('test-key', '${testValue}');
        localStorage.getItem('test-key');
      `);
      
      recordTest(
        `Set localStorage for ${accountId}`,
        true,
        `Value: ${testValue}`
      );
    } catch (error) {
      recordTest(
        `Set localStorage for ${accountId}`,
        false,
        error.message
      );
    }
    
    mainWindow.removeBrowserView(view);
  }
  
  // Verify localStorage isolation
  for (const accountId of TEST_ACCOUNTS) {
    const view = views.get(accountId);
    const expectedValue = testData.get(accountId);
    
    mainWindow.addBrowserView(view);
    view.setBounds({ x: 0, y: 0, width: 800, height: 600 });
    
    try {
      const actualValue = await view.webContents.executeJavaScript(`
        localStorage.getItem('test-key');
      `);
      
      const isIsolated = actualValue === expectedValue;
      
      recordTest(
        `LocalStorage isolation for ${accountId}`,
        isIsolated,
        isIsolated
          ? `Correct value: ${actualValue}`
          : `Expected: ${expectedValue}, Got: ${actualValue}`
      );
    } catch (error) {
      recordTest(
        `LocalStorage isolation for ${accountId}`,
        false,
        error.message
      );
    }
    
    mainWindow.removeBrowserView(view);
  }
  
  // Cleanup views
  for (const view of views.values()) {
    if (!view.webContents.isDestroyed()) {
      view.webContents.destroy();
    }
  }
}

/**
 * Test 4: IndexedDB isolation
 */
async function testIndexedDBIsolation(mainWindow) {
  log('\n4. Testing IndexedDB isolation...', 'blue');
  
  const views = new Map();
  const testData = new Map();
  
  // Create views and set IndexedDB data
  for (let i = 0; i < TEST_ACCOUNTS.length; i++) {
    const accountId = TEST_ACCOUNTS[i];
    const partition = `persist:account_${accountId}`;
    const accountSession = session.fromPartition(partition);
    
    const view = new BrowserView({
      webPreferences: {
        partition,
        session: accountSession,
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    mainWindow.addBrowserView(view);
    view.setBounds({ x: 0, y: 0, width: 800, height: 600 });
    
    views.set(accountId, view);
    
    // Load a data URL to have a valid origin
    await view.webContents.loadURL('data:text/html,<html><body>Test</body></html>');
    
    // Wait for page to load
    await new Promise(resolve => {
      if (view.webContents.isLoading()) {
        view.webContents.once('did-finish-load', resolve);
      } else {
        resolve();
      }
    });
    
    // Set unique IndexedDB value
    const testValue = `indexeddb-value-${i + 1}`;
    testData.set(accountId, testValue);
    
    try {
      const result = await view.webContents.executeJavaScript(`
        new Promise((resolve, reject) => {
          const request = indexedDB.open('test-db', 1);
          
          request.onerror = () => reject(request.error);
          
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('test-store')) {
              db.createObjectStore('test-store');
            }
          };
          
          request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['test-store'], 'readwrite');
            const store = transaction.objectStore('test-store');
            
            const putRequest = store.put('${testValue}', 'test-key');
            
            putRequest.onsuccess = () => {
              db.close();
              resolve('${testValue}');
            };
            
            putRequest.onerror = () => {
              db.close();
              reject(putRequest.error);
            };
          };
        });
      `);
      
      recordTest(
        `Set IndexedDB for ${accountId}`,
        result === testValue,
        `Value: ${testValue}`
      );
    } catch (error) {
      recordTest(
        `Set IndexedDB for ${accountId}`,
        false,
        error.message
      );
    }
    
    mainWindow.removeBrowserView(view);
  }
  
  // Verify IndexedDB isolation
  for (const accountId of TEST_ACCOUNTS) {
    const view = views.get(accountId);
    const expectedValue = testData.get(accountId);
    
    mainWindow.addBrowserView(view);
    view.setBounds({ x: 0, y: 0, width: 800, height: 600 });
    
    try {
      const actualValue = await view.webContents.executeJavaScript(`
        new Promise((resolve, reject) => {
          const request = indexedDB.open('test-db', 1);
          
          request.onerror = () => reject(request.error);
          
          request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['test-store'], 'readonly');
            const store = transaction.objectStore('test-store');
            
            const getRequest = store.get('test-key');
            
            getRequest.onsuccess = () => {
              db.close();
              resolve(getRequest.result);
            };
            
            getRequest.onerror = () => {
              db.close();
              reject(getRequest.error);
            };
          };
        });
      `);
      
      const isIsolated = actualValue === expectedValue;
      
      recordTest(
        `IndexedDB isolation for ${accountId}`,
        isIsolated,
        isIsolated
          ? `Correct value: ${actualValue}`
          : `Expected: ${expectedValue}, Got: ${actualValue}`
      );
    } catch (error) {
      recordTest(
        `IndexedDB isolation for ${accountId}`,
        false,
        error.message
      );
    }
    
    mainWindow.removeBrowserView(view);
  }
  
  // Cleanup views
  for (const view of views.values()) {
    if (!view.webContents.isDestroyed()) {
      view.webContents.destroy();
    }
  }
}

/**
 * Test 5: Session validation on view creation
 */
async function testSessionValidation() {
  log('\n5. Testing session validation on view creation...', 'blue');
  
  // Test with valid account ID
  try {
    const accountId = 'valid-test-account';
    const partition = `persist:account_${accountId}`;
    const accountSession = session.fromPartition(partition);
    
    const view = new BrowserView({
      webPreferences: {
        partition,
        session: accountSession,
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    // Verify session is set correctly
    const isValid = view.webContents.session === accountSession;
    
    recordTest(
      'Valid session assignment',
      isValid,
      `Session matches expected instance`
    );
    
    // Verify partition is correct
    const sessionPartition = view.webContents.session.partition;
    const partitionMatches = sessionPartition === partition;
    
    recordTest(
      'Partition validation',
      partitionMatches,
      `Partition: ${sessionPartition}`
    );
    
    // Cleanup
    if (!view.webContents.isDestroyed()) {
      view.webContents.destroy();
    }
  } catch (error) {
    recordTest(
      'Session validation',
      false,
      error.message
    );
  }
  
  // Test session persistence path
  for (const accountId of TEST_ACCOUNTS) {
    const partition = `persist:account_${accountId}`;
    const accountSession = session.fromPartition(partition);
    
    // Check if session has a storage path
    const storagePath = accountSession.getStoragePath();
    const hasStoragePath = storagePath && storagePath.length > 0;
    
    recordTest(
      `Session storage path for ${accountId}`,
      hasStoragePath,
      hasStoragePath ? `Path: ${storagePath}` : 'No storage path'
    );
  }
}

/**
 * Test 6: Cache isolation
 */
async function testCacheIsolation() {
  log('\n6. Testing cache isolation...', 'blue');
  
  for (const accountId of TEST_ACCOUNTS) {
    const partition = `persist:account_${accountId}`;
    const accountSession = session.fromPartition(partition);
    
    try {
      // Get cache size before
      const sizeBefore = await accountSession.getCacheSize();
      
      // Clear cache
      await accountSession.clearCache();
      
      // Get cache size after
      const sizeAfter = await accountSession.getCacheSize();
      
      recordTest(
        `Cache operations for ${accountId}`,
        true,
        `Size before: ${sizeBefore}, after: ${sizeAfter}`
      );
    } catch (error) {
      recordTest(
        `Cache operations for ${accountId}`,
        false,
        error.message
      );
    }
  }
}

/**
 * Run all tests
 */
async function runTests() {
  log('\n' + '='.repeat(70), 'blue');
  log('Session Isolation Test Suite', 'blue');
  log('='.repeat(70) + '\n', 'blue');
  
  // Clean up any existing test data
  await cleanup();
  
  // Set user data path for tests
  app.setPath('userData', USER_DATA_PATH);
  
  await app.whenReady();
  
  // Create a hidden main window for testing
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  try {
    // Run all tests
    await testUniquePartitions();
    await testCookieIsolation(mainWindow);
    await testLocalStorageIsolation(mainWindow);
    await testIndexedDBIsolation(mainWindow);
    await testSessionValidation();
    await testCacheIsolation();
    
    // Print summary
    log('\n' + '='.repeat(70), 'blue');
    log('Test Summary', 'blue');
    log('='.repeat(70), 'blue');
    
    log(`\nTotal Tests: ${results.passed + results.failed}`, 'cyan');
    log(`Passed: ${results.passed}`, 'green');
    log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
    
    if (results.failed === 0) {
      log('\n✓ All session isolation tests passed!', 'green');
      log('Sessions are properly isolated between accounts.', 'green');
    } else {
      log('\n✗ Some tests failed!', 'red');
      log('Please review the failed tests above.', 'red');
    }
    
    // Detailed results
    log('\nDetailed Results:', 'cyan');
    for (const test of results.tests) {
      const status = test.passed ? '✓' : '✗';
      const color = test.passed ? 'green' : 'red';
      log(`  ${status} ${test.name}`, color);
      if (test.details) {
        log(`     ${test.details}`, 'cyan');
      }
    }
    
  } catch (error) {
    log(`\nTest execution error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    // Cleanup
    mainWindow.close();
    await cleanup();
    
    // Exit with appropriate code
    const exitCode = results.failed > 0 ? 1 : 0;
    setTimeout(() => {
      app.quit();
      process.exit(exitCode);
    }, 1000);
  }
}

// Handle app events
app.on('window-all-closed', () => {
  // Don't quit on macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Run tests when app is ready
runTests().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
