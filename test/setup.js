/**
 * Jest Test Setup
 * 
 * Configures the test environment with proper isolation and cleanup hooks.
 * This file runs before each test file.
 * 
 * Requirements: 10.2
 */

'use strict';

const { ElectronMock } = require('./mocks/ElectronMock');
const { StorageMock } = require('./mocks/StorageMock');
const { NetworkMock } = require('./mocks/NetworkMock');

// ==================== Global Test State ====================

/**
 * Global test context that provides isolated instances for each test
 */
global.testContext = {
  electron: null,
  storage: null,
  network: null,
  cleanupCallbacks: []
};

/**
 * Register a cleanup callback to be called after the test
 * @param {Function} callback - Cleanup function
 */
global.registerCleanup = (callback) => {
  global.testContext.cleanupCallbacks.push(callback);
};

/**
 * Get or create an isolated Electron mock for the current test
 * @returns {ElectronMock}
 */
global.getElectronMock = () => {
  if (!global.testContext.electron) {
    global.testContext.electron = new ElectronMock();
  }
  return global.testContext.electron;
};

/**
 * Get or create an isolated Storage mock for the current test
 * @returns {StorageMock}
 */
global.getStorageMock = () => {
  if (!global.testContext.storage) {
    global.testContext.storage = new StorageMock();
  }
  return global.testContext.storage;
};

/**
 * Get or create an isolated Network mock for the current test
 * @returns {NetworkMock}
 */
global.getNetworkMock = () => {
  if (!global.testContext.network) {
    global.testContext.network = new NetworkMock();
  }
  return global.testContext.network;
};

// ==================== Test Lifecycle Hooks ====================

/**
 * Before each test - create fresh isolated context
 */
beforeEach(() => {
  // Reset test context
  global.testContext = {
    electron: null,
    storage: null,
    network: null,
    cleanupCallbacks: []
  };
  
  // Clear any module cache that might leak state
  // Note: Jest's resetModules handles most of this
});

/**
 * After each test - cleanup and verify isolation
 */
afterEach(async () => {
  // Run registered cleanup callbacks
  for (const callback of global.testContext.cleanupCallbacks) {
    try {
      await callback();
    } catch (error) {
      console.warn('Cleanup callback failed:', error.message);
    }
  }
  
  // Reset mocks if they were created
  if (global.testContext.electron) {
    global.testContext.electron.reset();
  }
  if (global.testContext.storage) {
    global.testContext.storage.reset();
  }
  if (global.testContext.network) {
    global.testContext.network.reset();
  }
  
  // Clear timers
  jest.clearAllTimers();
  
  // Clear all mocks
  jest.clearAllMocks();
});

// ==================== Custom Matchers ====================

expect.extend({
  /**
   * Check if an error has a specific code
   */
  toHaveErrorCode(received, expectedCode) {
    const pass = received && received.code === expectedCode;
    return {
      pass,
      message: () =>
        pass
          ? `expected error not to have code ${expectedCode}`
          : `expected error to have code ${expectedCode}, but got ${received?.code}`
    };
  },
  
  /**
   * Check if a validation result has errors for specific fields
   */
  toHaveValidationErrorsFor(received, fields) {
    const errorFields = (received?.errors || []).map(e => e.field);
    const missingFields = fields.filter(f => !errorFields.includes(f));
    const pass = missingFields.length === 0;
    
    return {
      pass,
      message: () =>
        pass
          ? `expected validation result not to have errors for fields: ${fields.join(', ')}`
          : `expected validation errors for fields: ${fields.join(', ')}, but missing: ${missingFields.join(', ')}`
    };
  },
  
  /**
   * Check if two objects are deeply equal (for property testing)
   */
  toBeDeepEqual(received, expected) {
    const pass = JSON.stringify(received) === JSON.stringify(expected);
    return {
      pass,
      message: () =>
        pass
          ? `expected objects not to be deeply equal`
          : `expected objects to be deeply equal\nReceived: ${JSON.stringify(received, null, 2)}\nExpected: ${JSON.stringify(expected, null, 2)}`
    };
  }
});

// ==================== Console Suppression ====================

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
};

/**
 * Suppress console output during tests (optional)
 * Set TEST_VERBOSE=true to enable console output
 */
if (process.env.TEST_VERBOSE !== 'true') {
  // Suppress console.log in tests
  console.log = jest.fn();
  
  // Keep warnings and errors but track them
  console.warn = jest.fn((...args) => {
    // Store for potential assertion
    if (!global.testContext.warnings) {
      global.testContext.warnings = [];
    }
    global.testContext.warnings.push(args);
  });
  
  console.error = jest.fn((...args) => {
    // Store for potential assertion
    if (!global.testContext.errors) {
      global.testContext.errors = [];
    }
    global.testContext.errors.push(args);
  });
}

/**
 * Restore console for debugging
 */
global.restoreConsole = () => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
};

// ==================== Timeout Configuration ====================

// Increase timeout for property-based tests
jest.setTimeout(30000);

// ==================== Error Handling ====================

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in test:', reason);
});

// ==================== Exports for Test Files ====================

module.exports = {
  getElectronMock: global.getElectronMock,
  getStorageMock: global.getStorageMock,
  getNetworkMock: global.getNetworkMock,
  registerCleanup: global.registerCleanup,
  restoreConsole: global.restoreConsole
};
