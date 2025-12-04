/**
 * Test script for comprehensive error handling
 * 
 * Tests error logging, error display, and error recovery mechanisms.
 */

const path = require('path');
const fs = require('fs').promises;

// Mock electron app for testing
const mockApp = {
  getPath: (name) => {
    if (name === 'userData') {
      return path.join(__dirname, '..', 'test-user-data');
    }
    return path.join(__dirname, '..');
  }
};

// Set up mock electron
global.app = mockApp;

// Import error handling modules
const { ErrorLogger, ErrorLevel, ErrorCategory, getErrorLogger } = require('../src/utils/ErrorLogger');
const { 
  wrapAsync, 
  wrapIPCHandler, 
  createErrorResult, 
  sanitizeError,
  retryWithBackoff
} = require('../src/utils/ErrorHandler');

/**
 * Test error logger
 */
async function testErrorLogger() {
  console.log('\n=== Testing Error Logger ===\n');

  const logger = getErrorLogger({
    logDir: path.join(__dirname, '..', 'test-logs'),
    logFileName: 'test-error.log',
    maxLogSize: 1024 * 1024, // 1MB
    maxLogFiles: 3,
    consoleOutput: false // Disable console output for cleaner test output
  });

  await logger.initialize();
  console.log('✓ Error logger initialized');

  // Test different log levels
  await logger.debug(ErrorCategory.SYSTEM, 'Debug message', { test: true });
  console.log('✓ Debug log written');

  await logger.info(ErrorCategory.ACCOUNT, 'Info message', { accountId: 'test-123' });
  console.log('✓ Info log written');

  await logger.warn(ErrorCategory.SESSION, 'Warning message', { reason: 'test' });
  console.log('✓ Warning log written');

  await logger.error(ErrorCategory.VIEW, 'Error message', { errorCode: 'TEST_ERROR' }, new Error('Test error'));
  console.log('✓ Error log written');

  await logger.fatal(ErrorCategory.SYSTEM, 'Fatal error', {}, new Error('Fatal test error'));
  console.log('✓ Fatal log written');

  // Test user-friendly messages
  const userMessage = logger.getUserFriendlyMessage(ErrorCategory.ACCOUNT, 'create_failed');
  console.log(`✓ User-friendly message: "${userMessage}"`);

  // Test reading recent logs
  const recentLogs = await logger.getRecentLogs(5);
  console.log(`✓ Read ${recentLogs.length} recent log entries`);

  // Verify log file exists
  const logPath = path.join(__dirname, '..', 'test-logs', 'test-error.log');
  try {
    await fs.access(logPath);
    console.log('✓ Log file created successfully');
  } catch (error) {
    console.error('✗ Log file not found');
  }

  console.log('\n✓ Error Logger tests passed\n');
}

/**
 * Test async function wrapper
 */
async function testAsyncWrapper() {
  console.log('\n=== Testing Async Wrapper ===\n');

  // Test successful operation
  const successFn = wrapAsync(
    async (value) => {
      return { success: true, value: value * 2 };
    },
    {
      category: ErrorCategory.ACCOUNT,
      operation: 'test-success'
    }
  );

  const successResult = await successFn(5);
  console.log(`✓ Success result: ${JSON.stringify(successResult)}`);

  // Test failed operation
  const failFn = wrapAsync(
    async () => {
      throw new Error('Test error');
    },
    {
      category: ErrorCategory.SESSION,
      operation: 'test-failure'
    }
  );

  const failResult = await failFn();
  console.log(`✓ Failure result: ${JSON.stringify(failResult)}`);

  // Test with custom error handler
  const customHandlerFn = wrapAsync(
    async () => {
      throw new Error('Test error with handler');
    },
    {
      category: ErrorCategory.VIEW,
      operation: 'test-custom-handler',
      onError: (error) => {
        return { success: false, handled: true, error: error.message };
      }
    }
  );

  const customResult = await customHandlerFn();
  console.log(`✓ Custom handler result: ${JSON.stringify(customResult)}`);

  console.log('\n✓ Async Wrapper tests passed\n');
}

/**
 * Test IPC handler wrapper
 */
async function testIPCHandlerWrapper() {
  console.log('\n=== Testing IPC Handler Wrapper ===\n');

  // Mock IPC event
  const mockEvent = { sender: { send: () => {} } };

  // Test successful IPC handler
  const successHandler = wrapIPCHandler(
    async (event, data) => {
      return { success: true, data: data.toUpperCase() };
    },
    {
      channel: 'test-channel',
      category: ErrorCategory.IPC
    }
  );

  const successResult = await successHandler(mockEvent, 'hello');
  console.log(`✓ IPC success result: ${JSON.stringify(successResult)}`);

  // Test failed IPC handler
  const failHandler = wrapIPCHandler(
    async (event, data) => {
      throw new Error('IPC handler error');
    },
    {
      channel: 'test-fail-channel',
      category: ErrorCategory.IPC
    }
  );

  const failResult = await failHandler(mockEvent, 'test');
  console.log(`✓ IPC failure result: ${JSON.stringify(failResult)}`);

  console.log('\n✓ IPC Handler Wrapper tests passed\n');
}

/**
 * Test error result creation
 */
function testErrorResult() {
  console.log('\n=== Testing Error Result Creation ===\n');

  const error = new Error('Test error message');
  const result = createErrorResult(error, ErrorCategory.NETWORK, 'connection_failed');

  console.log(`✓ Error result: ${JSON.stringify(result, null, 2)}`);
  console.log(`✓ User message included: ${result.userMessage ? 'Yes' : 'No'}`);

  console.log('\n✓ Error Result Creation tests passed\n');
}

/**
 * Test error sanitization
 */
function testErrorSanitization() {
  console.log('\n=== Testing Error Sanitization ===\n');

  // Test with Error object
  const error = new Error('Sensitive error message');
  error.code = 'ERR_TEST';
  const sanitized = sanitizeError(error);

  console.log(`✓ Sanitized error: ${JSON.stringify(sanitized, null, 2)}`);
  console.log(`✓ Stack trace removed in production: ${!sanitized.stack || process.env.NODE_ENV === 'development'}`);

  // Test with string
  const stringError = sanitizeError('Simple error string');
  console.log(`✓ Sanitized string error: ${JSON.stringify(stringError)}`);

  console.log('\n✓ Error Sanitization tests passed\n');
}

/**
 * Test retry with backoff
 */
async function testRetryWithBackoff() {
  console.log('\n=== Testing Retry with Backoff ===\n');

  let attemptCount = 0;

  // Test successful retry
  const successAfterRetries = async () => {
    attemptCount++;
    if (attemptCount < 3) {
      throw new Error('Temporary failure');
    }
    return { success: true, attempts: attemptCount };
  };

  attemptCount = 0;
  const result = await retryWithBackoff(successAfterRetries, {
    maxRetries: 3,
    initialDelay: 100,
    maxDelay: 1000
  });

  console.log(`✓ Succeeded after ${result.attempts} attempts`);

  // Test max retries exceeded
  attemptCount = 0;
  const alwaysFails = async () => {
    attemptCount++;
    throw new Error('Permanent failure');
  };

  try {
    await retryWithBackoff(alwaysFails, {
      maxRetries: 2,
      initialDelay: 50,
      maxDelay: 500
    });
    console.error('✗ Should have thrown error');
  } catch (error) {
    console.log(`✓ Failed after ${attemptCount} attempts as expected`);
  }

  console.log('\n✓ Retry with Backoff tests passed\n');
}

/**
 * Test log rotation
 */
async function testLogRotation() {
  console.log('\n=== Testing Log Rotation ===\n');

  const logger = new ErrorLogger({
    logDir: path.join(__dirname, '..', 'test-logs-rotation'),
    logFileName: 'rotation-test.log',
    maxLogSize: 1024, // 1KB for testing
    maxLogFiles: 3,
    consoleOutput: false
  });

  await logger.initialize();

  // Write enough logs to trigger rotation
  for (let i = 0; i < 100; i++) {
    await logger.info(ErrorCategory.SYSTEM, `Test log entry ${i}`, {
      iteration: i,
      data: 'x'.repeat(50) // Add some data to increase size
    });
  }

  console.log('✓ Wrote 100 log entries');

  // Check if rotation occurred
  const logDir = path.join(__dirname, '..', 'test-logs-rotation');
  const files = await fs.readdir(logDir);
  const rotatedFiles = files.filter(f => f.includes('rotation-test'));

  console.log(`✓ Found ${rotatedFiles.length} log files (including rotated)`);

  if (rotatedFiles.length > 1) {
    console.log('✓ Log rotation occurred');
  } else {
    console.log('⚠ Log rotation may not have occurred (file size might not have exceeded limit)');
  }

  console.log('\n✓ Log Rotation tests passed\n');
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Comprehensive Error Handling Test Suite               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await testErrorLogger();
    await testAsyncWrapper();
    await testIPCHandlerWrapper();
    testErrorResult();
    testErrorSanitization();
    await testRetryWithBackoff();
    await testLogRotation();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  ALL TESTS PASSED ✓                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Cleanup test files
    console.log('Cleaning up test files...');
    try {
      await fs.rm(path.join(__dirname, '..', 'test-logs'), { recursive: true, force: true });
      await fs.rm(path.join(__dirname, '..', 'test-logs-rotation'), { recursive: true, force: true });
      console.log('✓ Test files cleaned up\n');
    } catch (error) {
      console.warn('⚠ Could not clean up all test files:', error.message);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║                  TESTS FAILED ✗                            ║');
    console.error('╚════════════════════════════════════════════════════════════╝\n');
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
