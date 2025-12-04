/**
 * Test script for edge case validation (Task 29)
 * 
 * Tests validation and error handling for:
 * - Account configuration validation
 * - Duplicate account names
 * - Network failures and error handling
 * - Network failures
 * - BrowserView creation failures
 * - Account switching to non-existent accounts
 */

const {
  validateAccountConfig,
  validateTranslationConfig,
  checkDuplicateAccountName,
  validateAccountId,
  validateNetworkConnectivity,
  sanitizeAccountName,
  sanitizeAccountNote,
  validateViewCreationParams,
  validateAccountSwitch,
  handleNetworkFailure,
  handleViewCreationFailure,
  validateOperationSafety
} = require('../src/utils/ValidationHelper');

console.log('='.repeat(80));
console.log('Edge Case Validation Tests (Task 29)');
console.log('='.repeat(80));
console.log('');

// Test counters
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
    failedTests++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Test 1: Validate account configuration
console.log('\n1. Account Configuration Validation');
console.log('-'.repeat(80));

test('Valid account configuration should pass', () => {
  const config = {
    id: 'test-123',
    name: 'Test Account',
    note: 'Test note',
    order: 0,
    translation: { enabled: false },
    sessionDir: 'session-data/test',
    createdAt: new Date(),
    autoStart: false
  };
  const result = validateAccountConfig(config);
  assert(result.valid === true, 'Should be valid');
  assert(result.errors.length === 0, 'Should have no errors');
});

test('Missing account ID should fail', () => {
  const config = {
    name: 'Test Account'
  };
  const result = validateAccountConfig(config);
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.length > 0, 'Should have errors');
});

test('Empty account name should fail', () => {
  const config = {
    id: 'test-123',
    name: '   '
  };
  const result = validateAccountConfig(config);
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('name')), 'Should have name error');
});

test('Account name exceeding 100 characters should fail', () => {
  const config = {
    id: 'test-123',
    name: 'A'.repeat(101)
  };
  const result = validateAccountConfig(config);
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('100 characters')), 'Should have length error');
});

test('Invalid order (negative) should fail', () => {
  const config = {
    id: 'test-123',
    name: 'Test Account',
    order: -1
  };
  const result = validateAccountConfig(config);
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('order')), 'Should have order error');
});

  

// Test 3: Translation configuration validation
console.log('\n3. Translation Configuration Validation');
console.log('-'.repeat(80));

test('Valid translation configuration should pass', () => {
  const config = {
    enabled: true,
    targetLanguage: 'zh-CN',
    engine: 'google',
    autoTranslate: false
  };
  const result = validateTranslationConfig(config);
  assert(result.valid === true, 'Should be valid');
  assert(result.errors.length === 0, 'Should have no errors');
});

test('Invalid translation engine should fail', () => {
  const config = {
    enabled: true,
    targetLanguage: 'zh-CN',
    engine: 'invalid'
  };
  const result = validateTranslationConfig(config);
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('engine')), 'Should have engine error');
});

test('Invalid language code should fail', () => {
  const config = {
    enabled: true,
    targetLanguage: 'invalid-lang',
    engine: 'google'
  };
  const result = validateTranslationConfig(config);
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('targetLanguage')), 'Should have language error');
});

test('Disabled translation should skip validation', () => {
  const config = {
    enabled: false,
    targetLanguage: 'invalid',
    engine: 'invalid'
  };
  const result = validateTranslationConfig(config);
  assert(result.valid === true, 'Should be valid when disabled');
});

// Test 4: Duplicate account name detection
console.log('\n4. Duplicate Account Name Detection');
console.log('-'.repeat(80));

test('Duplicate account name should be detected', () => {
  const existingAccounts = [
    { id: 'acc-1', name: 'Account One' },
    { id: 'acc-2', name: 'Account Two' }
  ];
  const result = checkDuplicateAccountName('Account One', existingAccounts);
  assert(result.isDuplicate === true, 'Should detect duplicate');
  assert(result.conflictingAccount.id === 'acc-1', 'Should identify conflicting account');
});

test('Case-insensitive duplicate detection', () => {
  const existingAccounts = [
    { id: 'acc-1', name: 'Account One' }
  ];
  const result = checkDuplicateAccountName('account one', existingAccounts);
  assert(result.isDuplicate === true, 'Should detect case-insensitive duplicate');
});

test('Whitespace-normalized duplicate detection', () => {
  const existingAccounts = [
    { id: 'acc-1', name: 'Account One' }
  ];
  const result = checkDuplicateAccountName('  Account One  ', existingAccounts);
  assert(result.isDuplicate === true, 'Should detect duplicate with whitespace');
});

test('Exclude current account from duplicate check', () => {
  const existingAccounts = [
    { id: 'acc-1', name: 'Account One' },
    { id: 'acc-2', name: 'Account Two' }
  ];
  const result = checkDuplicateAccountName('Account One', existingAccounts, 'acc-1');
  assert(result.isDuplicate === false, 'Should exclude current account');
});

test('Unique account name should not be duplicate', () => {
  const existingAccounts = [
    { id: 'acc-1', name: 'Account One' }
  ];
  const result = checkDuplicateAccountName('Account Two', existingAccounts);
  assert(result.isDuplicate === false, 'Should not be duplicate');
});

// Test 5: Account ID validation
console.log('\n5. Account ID Validation');
console.log('-'.repeat(80));

test('Valid account ID should pass', () => {
  const result = validateAccountId('test-account-123');
  assert(result.valid === true, 'Should be valid');
});

test('Empty account ID should fail', () => {
  const result = validateAccountId('');
  assert(result.valid === false, 'Should be invalid');
  assert(result.error && (result.error.includes('empty') || result.error.includes('required')), 'Should have empty or required error');
});

test('Account ID with invalid characters should fail', () => {
  const result = validateAccountId('test<>account');
  assert(result.valid === false, 'Should be invalid');
  assert(result.error.includes('invalid characters'), 'Should have invalid characters error');
});

// Test 6: Sanitization
console.log('\n6. Input Sanitization');
console.log('-'.repeat(80));

test('Sanitize account name removes control characters', () => {
  const result = sanitizeAccountName('Test\x00Account\x1F');
  assert(!result.includes('\x00'), 'Should remove null character');
  assert(!result.includes('\x1F'), 'Should remove control character');
});

test('Sanitize account name trims whitespace', () => {
  const result = sanitizeAccountName('  Test Account  ');
  assert(result === 'Test Account', 'Should trim whitespace');
});

test('Sanitize account name limits length', () => {
  const longName = 'A'.repeat(150);
  const result = sanitizeAccountName(longName);
  assert(result.length === 100, 'Should limit to 100 characters');
});

test('Sanitize account note preserves newlines', () => {
  const result = sanitizeAccountNote('Line 1\nLine 2');
  assert(result.includes('\n'), 'Should preserve newlines');
});

// Test 7: View creation validation
console.log('\n7. View Creation Validation');
console.log('-'.repeat(80));

test('Valid view creation params should pass', () => {
  const result = validateViewCreationParams('test-account', {
    url: 'https://web.whatsapp.com'
  });
  assert(result.valid === true, 'Should be valid');
});

test('Invalid URL should fail', () => {
  const result = validateViewCreationParams('test-account', {
    url: 'not-a-url'
  });
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('URL')), 'Should have URL error');
});

// Test 8: Account switch validation
console.log('\n8. Account Switch Validation');
console.log('-'.repeat(80));

test('Switch to existing account should pass', () => {
  const availableAccounts = ['acc-1', 'acc-2', 'acc-3'];
  const result = validateAccountSwitch('acc-2', availableAccounts);
  assert(result.valid === true, 'Should be valid');
});

test('Switch to non-existent account should fail', () => {
  const availableAccounts = ['acc-1', 'acc-2'];
  const result = validateAccountSwitch('acc-999', availableAccounts);
  assert(result.valid === false, 'Should be invalid');
  assert(result.error.includes('does not exist'), 'Should have existence error');
});

// Test 9: Network failure handling
console.log('\n9. Network Failure Handling');
console.log('-'.repeat(80));

test('Handle timeout error', () => {
  const error = new Error('Connection timeout');
  error.code = 'ETIMEDOUT';
  const result = handleNetworkFailure(error);
  assert(result.handled === true, 'Should be handled');
  assert(result.retryable === true, 'Should be retryable');
  assert(result.userMessage.includes('timed out'), 'Should have timeout message');
});

test('Handle connection refused error', () => {
  const error = new Error('Connection refused');
  error.code = 'ECONNREFUSED';
  const result = handleNetworkFailure(error);
  assert(result.handled === true, 'Should be handled');
  assert(result.retryable === true, 'Should be retryable');
  assert(result.userMessage.includes('refused'), 'Should have refused message');
});

test('Handle DNS error', () => {
  const error = new Error('Not found');
  error.code = 'ENOTFOUND';
  const result = handleNetworkFailure(error);
  assert(result.handled === true, 'Should be handled');
  assert(result.retryable === true, 'Should be retryable');
  assert(result.userMessage.includes('hostname'), 'Should have DNS message');
});

// Test 10: View creation failure handling
console.log('\n10. View Creation Failure Handling');
console.log('-'.repeat(80));

test('Handle session error', () => {
  const error = new Error('Session creation failed');
  const result = handleViewCreationFailure(error, 'test-account');
  assert(result.handled === true, 'Should be handled');
  assert(result.userMessage.includes('session'), 'Should mention session');
  assert(result.suggestedAction.length > 0, 'Should have suggested action');
});

test('Handle connection error', () => {
  const error = new Error('Network connection failed');
  const result = handleViewCreationFailure(error, 'test-account');
  assert(result.handled === true, 'Should be handled');
});

// Test 11: Operation safety validation
console.log('\n11. Operation Safety Validation');
console.log('-'.repeat(80));

test('Delete active account should warn', () => {
  const result = validateOperationSafety('delete-account', {
    isActive: true
  });
  assert(result.safe === true, 'Should be safe');
  assert(result.warnings.length > 0, 'Should have warnings');
  assert(result.warnings.some(w => w.includes('active')), 'Should warn about active account');
});

test('Switch with many accounts should warn', () => {
  const result = validateOperationSafety('switch-account', {
    viewCount: 15
  });
  assert(result.safe === true, 'Should be safe');
  assert(result.warnings.length > 0, 'Should have warnings');
});

test('Switch to non-existent account should block', () => {
  const result = validateOperationSafety('switch-account', {
    accountExists: false
  });
  assert(result.safe === false, 'Should not be safe');
  assert(result.blockers.length > 0, 'Should have blockers');
});

// Print summary
console.log('\n' + '='.repeat(80));
console.log('Test Summary');
console.log('='.repeat(80));
console.log(`Total tests: ${totalTests}`);
console.log(`Passed: ${passedTests} (${Math.round(passedTests / totalTests * 100)}%)`);
console.log(`Failed: ${failedTests} (${Math.round(failedTests / totalTests * 100)}%)`);
console.log('');

if (failedTests === 0) {
  console.log('✓ All tests passed!');
  process.exit(0);
} else {
  console.error(`✗ ${failedTests} test(s) failed`);
  process.exit(1);
}
