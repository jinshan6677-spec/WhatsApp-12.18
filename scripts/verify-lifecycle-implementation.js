/**
 * Verification script for lifecycle management implementation
 * 
 * This script verifies that all required lifecycle management functions
 * and handlers are properly implemented in main.js
 */

const fs = require('fs');
const path = require('path');

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: []
};

/**
 * Log test result
 */
function log(type, message) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [VERIFY]`;
  
  if (type === 'pass') {
    console.log(`${prefix} ✓ ${message}`);
    results.passed.push(message);
  } else if (type === 'fail') {
    console.error(`${prefix} ✗ ${message}`);
    results.failed.push(message);
  } else if (type === 'warn') {
    console.warn(`${prefix} ⚠ ${message}`);
    results.warnings.push(message);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

/**
 * Read main.js file
 */
function readMainFile() {
  const mainPath = path.join(__dirname, '..', 'src', 'main-refactored.js');
  
  if (!fs.existsSync(mainPath)) {
    log('fail', 'main.js file not found');
    return null;
  }
  
  return fs.readFileSync(mainPath, 'utf8');
}

/**
 * Check if function exists in code
 */
function checkFunction(code, functionName, description) {
  const patterns = [
    new RegExp(`function\\s+${functionName}\\s*\\(`),
    new RegExp(`const\\s+${functionName}\\s*=\\s*async\\s+function`),
    new RegExp(`async\\s+function\\s+${functionName}\\s*\\(`)
  ];
  
  const exists = patterns.some(pattern => pattern.test(code));
  
  if (exists) {
    log('pass', `${description}: ${functionName}() exists`);
    return true;
  } else {
    log('fail', `${description}: ${functionName}() not found`);
    return false;
  }
}

/**
 * Check if event handler exists
 */
function checkEventHandler(code, eventName, description) {
  const pattern = new RegExp(`app\\.on\\s*\\(\\s*['"\`]${eventName}['"\`]`);
  
  if (pattern.test(code)) {
    log('pass', `${description}: app.on('${eventName}') exists`);
    return true;
  } else {
    log('fail', `${description}: app.on('${eventName}') not found`);
    return false;
  }
}

/**
 * Check if code contains specific pattern
 */
function checkPattern(code, pattern, description) {
  if (pattern.test(code)) {
    log('pass', description);
    return true;
  } else {
    log('fail', description);
    return false;
  }
}

/**
 * Run all verification checks
 */
function runVerification() {
  log('info', '========================================');
  log('info', 'Lifecycle Management Implementation Verification');
  log('info', '========================================');
  log('info', '');
  
  const code = readMainFile();
  
  if (!code) {
    log('fail', 'Cannot read main.js file');
    return false;
  }
  
  log('info', 'Checking lifecycle management implementation...');
  log('info', '');
  
  // Check 1: saveApplicationState function
  log('info', '1. Checking saveApplicationState function...');
  checkFunction(code, 'saveApplicationState', 'State saving function');
  checkPattern(
    code,
    /viewManager\.getActiveAccountId\(\)/,
    'Saves active account ID'
  );
  checkPattern(
    code,
    /accountConfigManager\.updateAccount.*lastActiveAt/s,
    'Updates account last active times'
  );
  log('info', '');
  
  // Check 2: cleanup function
  log('info', '2. Checking cleanup function...');
  checkFunction(code, 'cleanup', 'Cleanup function');
  checkPattern(
    code,
    /await\s+saveApplicationState\(\)/,
    'Calls saveApplicationState in cleanup'
  );
  checkPattern(
    code,
    /stopAllConnectionMonitoring/,
    'Stops connection monitoring'
  );
  checkPattern(
    code,
    /stopAllLoginStatusMonitoring/,
    'Stops login status monitoring'
  );
  checkPattern(
    code,
    /destroyAllViews/,
    'Destroys all BrowserViews'
  );
  checkPattern(
    code,
    /unregisterSingleWindowIPCHandlers/,
    'Unregisters IPC handlers'
  );
  log('info', '');
  
  // Check 3: setupMainWindowCloseHandler function
  log('info', '3. Checking setupMainWindowCloseHandler function...');
  checkFunction(code, 'setupMainWindowCloseHandler', 'Window close handler setup');
  checkPattern(
    code,
    /window\.on\s*\(\s*['"`]close['"`]/,
    'Listens to window close event'
  );
  checkPattern(
    code,
    /setupMainWindowCloseHandler\(\)/,
    'Calls setupMainWindowCloseHandler after window init'
  );
  log('info', '');
  
  // Check 4: app.whenReady handler
  log('info', '4. Checking app.whenReady handler...');
  checkPattern(
    code,
    /app\.whenReady\(\)\.then/,
    'app.whenReady handler exists'
  );
  checkPattern(
    code,
    /initializeManagers/,
    'Initializes managers'
  );
  checkPattern(
    code,
    /registerAllIPCHandlers/,
    'Registers IPC handlers'
  );
  checkPattern(
    code,
    /loadAccounts/,
    'Loads accounts'
  );
  checkPattern(
    code,
    /restoreActiveAccount/,
    'Restores active account'
  );
  log('info', '');
  
  // Check 5: window-all-closed handler
  log('info', '5. Checking window-all-closed handler...');
  checkEventHandler(code, 'window-all-closed', 'Window all closed handler');
  checkPattern(
    code,
    /await\s+cleanup\(\)/,
    'Calls cleanup on window-all-closed'
  );
  log('info', '');
  
  // Check 6: before-quit handler
  log('info', '6. Checking before-quit handler...');
  checkEventHandler(code, 'before-quit', 'Before quit handler');
  checkPattern(
    code,
    /app\.isQuitting/,
    'Uses isQuitting flag to prevent duplicate cleanup'
  );
  log('info', '');
  
  // Check 7: will-quit handler
  log('info', '7. Checking will-quit handler...');
  checkEventHandler(code, 'will-quit', 'Will quit handler');
  log('info', '');
  
  // Check 8: Error handlers
  log('info', '8. Checking error handlers...');
  checkPattern(
    code,
    /process\.on\s*\(\s*['"`]uncaughtException['"`]/,
    'Uncaught exception handler exists'
  );
  checkPattern(
    code,
    /process\.on\s*\(\s*['"`]unhandledRejection['"`]/,
    'Unhandled rejection handler exists'
  );
  checkPattern(
    code,
    /saveApplicationState.*uncaughtException/s,
    'Emergency save on uncaught exception'
  );
  log('info', '');
  
  // Print summary
  log('info', '========================================');
  log('info', 'Verification Summary');
  log('info', '========================================');
  log('info', `Passed: ${results.passed.length}`);
  log('info', `Failed: ${results.failed.length}`);
  log('info', `Warnings: ${results.warnings.length}`);
  log('info', '');
  
  if (results.failed.length === 0) {
    log('pass', 'All verification checks passed!');
    log('info', '');
    log('info', 'Lifecycle management implementation is complete.');
    return true;
  } else {
    log('fail', `${results.failed.length} verification check(s) failed`);
    log('info', '');
    log('info', 'Failed checks:');
    results.failed.forEach((msg, index) => {
      log('info', `  ${index + 1}. ${msg}`);
    });
    return false;
  }
}

// Run verification
const success = runVerification();
process.exit(success ? 0 : 1);
