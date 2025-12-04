/**
 * Test Helpers
 * 
 * Utility functions for testing.
 * 
 * @module test/helpers
 * Requirements: 10.4, 10.6
 */

'use strict';

/**
 * Create a test context with isolated state
 * @returns {Object} Test context
 */
function createTestContext() {
  return {
    state: {},
    events: [],
    errors: [],
    
    setState(key, value) {
      this.state[key] = value;
    },
    
    getState(key) {
      return this.state[key];
    },
    
    recordEvent(event) {
      this.events.push({
        ...event,
        timestamp: Date.now()
      });
    },
    
    recordError(error) {
      this.errors.push({
        error,
        timestamp: Date.now()
      });
    },
    
    reset() {
      this.state = {};
      this.events = [];
      this.errors = [];
    }
  };
}

/**
 * Wait for a condition to be true
 * @param {Function} condition - Condition function
 * @param {number} timeout - Timeout in ms
 * @param {number} interval - Check interval in ms
 * @returns {Promise<void>}
 */
async function waitFor(condition, timeout = 5000, interval = 50) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Wait for a specific number of milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a deferred promise for testing async operations
 * @returns {{promise: Promise, resolve: Function, reject: Function}}
 */
function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Capture console output during a function execution
 * @param {Function} fn - Function to execute
 * @returns {Promise<{result: any, logs: string[], warnings: string[], errors: string[]}>}
 */
async function captureConsole(fn) {
  const logs = [];
  const warnings = [];
  const errors = [];
  
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.log = (...args) => logs.push(args.join(' '));
  console.warn = (...args) => warnings.push(args.join(' '));
  console.error = (...args) => errors.push(args.join(' '));
  
  try {
    const result = await fn();
    return { result, logs, warnings, errors };
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
}

/**
 * Create a spy function that records calls
 * @param {Function} [implementation] - Optional implementation
 * @returns {Function & {calls: Array, reset: Function}}
 */
function createSpy(implementation = () => {}) {
  const calls = [];
  
  const spy = function(...args) {
    const call = {
      args,
      timestamp: Date.now(),
      result: undefined,
      error: undefined
    };
    
    try {
      call.result = implementation.apply(this, args);
      calls.push(call);
      return call.result;
    } catch (error) {
      call.error = error;
      calls.push(call);
      throw error;
    }
  };
  
  spy.calls = calls;
  spy.reset = () => { calls.length = 0; };
  spy.getCall = (index) => calls[index];
  spy.getLastCall = () => calls[calls.length - 1];
  spy.wasCalled = () => calls.length > 0;
  spy.wasCalledWith = (...args) => 
    calls.some(call => 
      JSON.stringify(call.args) === JSON.stringify(args)
    );
  
  return spy;
}

/**
 * Deep clone an object (for creating test fixtures)
 * @param {any} obj - Object to clone
 * @returns {any}
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }
  
  if (obj instanceof Map) {
    return new Map(Array.from(obj.entries()).map(([k, v]) => [k, deepClone(v)]));
  }
  
  if (obj instanceof Set) {
    return new Set(Array.from(obj).map(v => deepClone(v)));
  }
  
  const cloned = {};
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone(obj[key]);
  }
  return cloned;
}

/**
 * Deep equality check
 * @param {any} a - First value
 * @param {any} b - Second value
 * @returns {boolean}
 */
function deepEqual(a, b) {
  if (a === b) return true;
  
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  if (typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  
  if (a === null || b === null) {
    return a === b;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) {
    return false;
  }
  
  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Generate a random string
 * @param {number} length - String length
 * @returns {string}
 */
function randomString(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a random integer
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
function randomInt(min = 0, max = 100) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Create a test fixture factory
 * @param {Object} defaults - Default values
 * @returns {Function}
 */
function createFixtureFactory(defaults) {
  return (overrides = {}) => ({
    ...deepClone(defaults),
    ...overrides
  });
}

/**
 * Assert that a function throws an error with specific properties
 * @param {Function} fn - Function to test
 * @param {Object} expected - Expected error properties
 */
async function assertThrows(fn, expected = {}) {
  let error;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  
  if (!error) {
    throw new Error('Expected function to throw an error');
  }
  
  if (expected.message && !error.message.includes(expected.message)) {
    throw new Error(`Expected error message to include "${expected.message}", got "${error.message}"`);
  }
  
  if (expected.code && error.code !== expected.code) {
    throw new Error(`Expected error code "${expected.code}", got "${error.code}"`);
  }
  
  if (expected.type && !(error instanceof expected.type)) {
    throw new Error(`Expected error to be instance of ${expected.type.name}`);
  }
  
  return error;
}

/**
 * Format test failure context for property-based tests
 * @param {Object} context - Failure context
 * @returns {string}
 */
function formatFailureContext(context) {
  const lines = [
    '═══════════════════════════════════════════════════════════════',
    '                    TEST FAILURE CONTEXT                        ',
    '═══════════════════════════════════════════════════════════════',
    '',
    'Input Data:',
    JSON.stringify(context.input, null, 2),
    '',
    'Expected:',
    JSON.stringify(context.expected, null, 2),
    '',
    'Actual:',
    JSON.stringify(context.actual, null, 2),
    ''
  ];
  
  if (context.error) {
    lines.push('Error:', context.error.message, context.error.stack || '');
  }
  
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

module.exports = {
  createTestContext,
  waitFor,
  delay,
  createDeferred,
  captureConsole,
  createSpy,
  deepClone,
  deepEqual,
  randomString,
  randomInt,
  createFixtureFactory,
  assertThrows,
  formatFailureContext
};
