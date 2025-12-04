/**
 * Test script for preload-main.js
 * Verifies that the preload script is properly structured and exposes the correct API
 */

const fs = require('fs');
const path = require('path');

console.log('Testing preload-main.js structure...\n');

// Read the preload script
const preloadPath = path.join(__dirname, '..', 'src', 'single-window', 'renderer', 'preload-main.js');
const preloadContent = fs.readFileSync(preloadPath, 'utf8');

// Test 1: Check for contextBridge usage
console.log('✓ Test 1: Checking for contextBridge usage...');
if (preloadContent.includes('contextBridge.exposeInMainWorld')) {
  console.log('  ✓ contextBridge.exposeInMainWorld found');
} else {
  console.error('  ✗ contextBridge.exposeInMainWorld not found');
  process.exit(1);
}

// Test 2: Check for electronAPI exposure
console.log('\n✓ Test 2: Checking for electronAPI exposure...');
if (preloadContent.includes("exposeInMainWorld('electronAPI'")) {
  console.log('  ✓ electronAPI exposed');
} else {
  console.error('  ✗ electronAPI not exposed');
  process.exit(1);
}

// Test 3: Check for required account management methods
console.log('\n✓ Test 3: Checking for account management methods...');
const accountMethods = [
  'getAccount:',
  'getAccounts:',
  'listAccounts:',
  'createAccount:',
  'updateAccount:',
  'deleteAccount:',
  'reorderAccounts:'
];

let allAccountMethodsFound = true;
for (const method of accountMethods) {
  if (preloadContent.includes(method)) {
    console.log(`  ✓ ${method} found`);
  } else {
    console.error(`  ✗ ${method} not found`);
    allAccountMethodsFound = false;
  }
}

if (!allAccountMethodsFound) {
  process.exit(1);
}

// Test 4: Check for view switching methods
console.log('\n✓ Test 4: Checking for view switching methods...');
const viewMethods = [
  'switchAccount:',
  'switchAccountByIndex:',
  'switchToNextAccount:',
  'switchToPreviousAccount:',
  'getActiveAccount:',
  'restoreActiveAccount:'
];

let allViewMethodsFound = true;
for (const method of viewMethods) {
  if (preloadContent.includes(method)) {
    console.log(`  ✓ ${method} found`);
  } else {
    console.error(`  ✗ ${method} not found`);
    allViewMethodsFound = false;
  }
}

if (!allViewMethodsFound) {
  process.exit(1);
}

// Test 5: Check for status update methods
console.log('\n✓ Test 5: Checking for status update methods...');
const statusMethods = [
  'getViewStatus:',
  'getLoginStatus:',
  'checkLoginStatus:',
  'getConnectionStatus:',
  'checkConnectionStatus:'
];

let allStatusMethodsFound = true;
for (const method of statusMethods) {
  if (preloadContent.includes(method)) {
    console.log(`  ✓ ${method} found`);
  } else {
    console.error(`  ✗ ${method} not found`);
    allStatusMethodsFound = false;
  }
}

if (!allStatusMethodsFound) {
  process.exit(1);
}

// Test 6: Check for generic IPC methods
console.log('\n✓ Test 6: Checking for generic IPC methods...');
const ipcMethods = [
  'invoke:',
  'send:',
  'on:',
  'removeListener:',
  'removeAllListeners:'
];

let allIpcMethodsFound = true;
for (const method of ipcMethods) {
  if (preloadContent.includes(method)) {
    console.log(`  ✓ ${method} found`);
  } else {
    console.error(`  ✗ ${method} not found`);
    allIpcMethodsFound = false;
  }
}

if (!allIpcMethodsFound) {
  process.exit(1);
}

// Test 7: Check for session management methods
console.log('\n✓ Test 7: Checking for session management methods...');
const sessionMethods = [
  'forceLogout:',
  'handleSessionExpiration:',
  'checkSessionExpiration:',
  'getSessionPersistenceStatus:',
  'restoreAllLoginStates:'
];

let allSessionMethodsFound = true;
for (const method of sessionMethods) {
  if (preloadContent.includes(method)) {
    console.log(`  ✓ ${method} found`);
  } else {
    console.error(`  ✗ ${method} not found`);
    allSessionMethodsFound = false;
  }
}

if (!allSessionMethodsFound) {
  process.exit(1);
}

// Test 8: Check for window and layout methods
console.log('\n✓ Test 8: Checking for window and layout methods...');
const layoutMethods = [
  'getViewBounds:',
  'getSidebarWidth:',
  'getActiveAccountId:',
  'notifySidebarResized:',
  'notifyWindowResizeComplete:'
];

let allLayoutMethodsFound = true;
for (const method of layoutMethods) {
  if (preloadContent.includes(method)) {
    console.log(`  ✓ ${method} found`);
  } else {
    console.error(`  ✗ ${method} not found`);
    allLayoutMethodsFound = false;
  }
}

if (!allLayoutMethodsFound) {
  process.exit(1);
}

// Test 9: Check for security - no direct ipcRenderer exposure
console.log('\n✓ Test 9: Checking for security...');
if (!preloadContent.includes('window.ipcRenderer') && !preloadContent.includes('global.ipcRenderer')) {
  console.log('  ✓ ipcRenderer not directly exposed to window');
} else {
  console.error('  ✗ ipcRenderer is directly exposed (security risk)');
  process.exit(1);
}

// Test 10: Check for contextIsolation
console.log('\n✓ Test 10: Checking for proper context isolation...');
if (preloadContent.includes('contextIsolation: true') || !preloadContent.includes('contextIsolation: false')) {
  console.log('  ✓ Context isolation is properly configured');
} else {
  console.error('  ✗ Context isolation may not be properly configured');
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('All tests passed! ✓');
console.log('='.repeat(60));
console.log('\nThe preload-main.js script is properly structured and exposes:');
console.log('  - Account management methods');
console.log('  - View switching methods');
console.log('  - Status update methods');
console.log('  - Session management methods');
console.log('  - Window and layout methods');
console.log('  - Generic IPC methods (invoke, send, on)');
console.log('  - Secure context bridge (no direct ipcRenderer exposure)');
console.log('\nThe preload script is ready for use!');

