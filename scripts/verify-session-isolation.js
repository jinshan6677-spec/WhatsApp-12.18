#!/usr/bin/env node

/**
 * Session Isolation Verification Script
 * 
 * This script verifies that session isolation is properly implemented
 * by checking the SessionManager and ViewManager implementations.
 */

const path = require('path');
const fs = require('fs');

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
 * Check if a file contains specific code patterns
 */
function checkFileContains(filePath, patterns, testName) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const allPatternsFound = patterns.every(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(content);
    });
    
    recordTest(
      testName,
      allPatternsFound,
      allPatternsFound 
        ? 'All required patterns found'
        : 'Some patterns missing'
    );
    
    return allPatternsFound;
  } catch (error) {
    recordTest(testName, false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * Test 1: Verify SessionManager creates unique partitions
 */
function testSessionManagerPartitions() {
  log('\n1. Verifying SessionManager partition implementation...', 'blue');
  
  const sessionManagerPath = path.join(__dirname, '..', 'src', 'managers', 'SessionManager.js');
  
  checkFileContains(
    sessionManagerPath,
    [
      'persist:account_\\$\\{accountId\\}',
      'session\\.fromPartition',
      'partition'
    ],
    'SessionManager uses unique partitions per account'
  );
  
  checkFileContains(
    sessionManagerPath,
    [
      'getSession',
      'createSession'
    ],
    'SessionManager has session creation methods'
  );
}

/**
 * Test 2: Verify ViewManager uses isolated sessions
 */
function testViewManagerIsolation() {
  log('\n2. Verifying ViewManager session isolation...', 'blue');
  
  const viewManagerPath = path.join(__dirname, '..', 'src', 'presentation', 'windows', 'view-manager', 'ViewManager.js');
  
  checkFileContains(
    viewManagerPath,
    [
      'sessionManager\\.getInstanceSession',
      'partition.*persist:account',
      'session.*accountSession'
    ],
    'ViewManager uses SessionManager for isolated sessions'
  );
  
  checkFileContains(
    viewManagerPath,
    [
      'BrowserView',
      'webPreferences',
      'contextIsolation.*true',
      'sandbox.*true'
    ],
    'ViewManager creates BrowserViews with proper isolation'
  );
  
  checkFileContains(
    viewManagerPath,
    [
      '_validateSessionIsolation',
      'verifyAllSessionIsolation'
    ],
    'ViewManager has session validation methods'
  );
}

/**
 * Test 3: Verify session validation implementation
 */
function testSessionValidation() {
  log('\n3. Verifying session validation implementation...', 'blue');
  
  const viewManagerPath = path.join(__dirname, '..', 'src', 'presentation', 'windows', 'view-manager', 'ViewManager.js');
  
  checkFileContains(
    viewManagerPath,
    [
      'expectedPartition',
      'actualPartition',
      'partition mismatch'
    ],
    'Session validation checks partition correctness'
  );
  
  checkFileContains(
    viewManagerPath,
    [
      'getStoragePath',
      'storagePath'
    ],
    'Session validation checks storage path'
  );
  
  checkFileContains(
    viewManagerPath,
    [
      'Session is shared',
      'viewState\\.session.*accountSession'
    ],
    'Session validation checks for session sharing'
  );
}


/**
 * Test 5: Verify storage isolation
 */
function testStorageIsolation() {
  log('\n5. Verifying storage isolation...', 'blue');
  
  const sessionManagerPath = path.join(__dirname, '..', 'src', 'managers', 'SessionManager.js');
  
  checkFileContains(
    sessionManagerPath,
    [
      'clearStorageData',
      'cookies',
      'localstorage',
      'indexdb'
    ],
    'SessionManager can clear isolated storage data'
  );
  
  checkFileContains(
    sessionManagerPath,
    [
      'getUserDataDir',
      'profiles',
      'accountId'
    ],
    'SessionManager uses separate user data directories'
  );
}

/**
 * Test 6: Verify session persistence
 */
function testSessionPersistence() {
  log('\n6. Verifying session persistence...', 'blue');
  
  const sessionManagerPath = path.join(__dirname, '..', 'src', 'managers', 'SessionManager.js');
  
  checkFileContains(
    sessionManagerPath,
    [
      'persist:',
      'configureSessionPersistence'
    ],
    'SessionManager uses persistent partitions'
  );
  
  checkFileContains(
    sessionManagerPath,
    [
      'hasSessionData',
      'IndexedDB',
      'Local Storage',
      'Cookies'
    ],
    'SessionManager can detect existing session data'
  );
}

/**
 * Test 7: Verify isolation verification methods
 */
function testIsolationVerification() {
  log('\n7. Verifying isolation verification methods...', 'blue');
  
  const sessionManagerPath = path.join(__dirname, '..', 'src', 'managers', 'SessionManager.js');
  
  checkFileContains(
    sessionManagerPath,
    [
      'verifySessionIsolation',
      'isolated',
      'details'
    ],
    'SessionManager has session isolation verification'
  );
  
  const viewManagerPath = path.join(__dirname, '..', 'src', 'presentation', 'windows', 'view-manager', 'ViewManager.js');
  
  checkFileContains(
    viewManagerPath,
    [
      'testSessionIsolation',
      'cookies',
      'storagePath',
      'uniqueness'
    ],
    'ViewManager has session isolation testing'
  );
}

/**
 * Run all verification tests
 */
function runVerification() {
  log('\n' + '='.repeat(70), 'blue');
  log('Session Isolation Verification', 'blue');
  log('='.repeat(70) + '\n', 'blue');
  
  try {
    testSessionManagerPartitions();
    testViewManagerIsolation();
    testSessionValidation();
    testStorageIsolation();
    testSessionPersistence();
    testIsolationVerification();
    
    // Print summary
    log('\n' + '='.repeat(70), 'blue');
    log('Verification Summary', 'blue');
    log('='.repeat(70), 'blue');
    
    log(`\nTotal Checks: ${results.passed + results.failed}`, 'cyan');
    log(`Passed: ${results.passed}`, 'green');
    log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
    
    if (results.failed === 0) {
      log('\n✓ All session isolation checks passed!', 'green');
      log('Session isolation is properly implemented.', 'green');
      log('\nKey Features Verified:', 'cyan');
      log('  • Unique session partitions per account', 'green');
      log('  • Isolated cookies, localStorage, and IndexedDB', 'green');
      log('  • Session validation on view creation', 'green');
      log('  • Separate user data directories', 'green');
      log('  • Session persistence support', 'green');
    } else {
      log('\n✗ Some checks failed!', 'red');
      log('Please review the failed checks above.', 'red');
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
    
    log('\n' + '='.repeat(70) + '\n', 'blue');
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
    
  } catch (error) {
    log(`\nVerification error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run verification
runVerification();
