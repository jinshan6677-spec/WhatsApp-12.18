'use strict';

/**
 * Property-based tests for Test Infrastructure
 * 
 * Tests the following properties:
 * - Property 38: Test Environment Isolation
 * - Property 39: Test Failure Context
 * 
 * **Validates: Requirements 10.2, 10.4**
 */

const fc = require('fast-check');
const { StorageMock, FileSystemMock, JsonStoreMock } = require('../mocks/StorageMock');
const { ElectronMock, BrowserWindowMock } = require('../mocks/ElectronMock');
const { NetworkMock, MockResponse } = require('../mocks/NetworkMock');
const { 
  createTestContext, 
  deepClone, 
  deepEqual, 
  formatFailureContext 
} = require('../helpers');

describe('Test Infrastructure Property Tests', () => {
  // Reserved JavaScript property names that should not be used as keys
  const reservedKeys = new Set([
    'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
    'propertyIsEnumerable', 'toLocaleString', 'constructor',
    '__proto__', '__defineGetter__', '__defineSetter__',
    '__lookupGetter__', '__lookupSetter__'
  ]);

  // Arbitraries for generating test data
  const keyArbitrary = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => s.trim().length > 0 && !s.includes('.') && !reservedKeys.has(s));
  
  const valueArbitrary = fc.oneof(
    fc.string({ maxLength: 100 }),
    fc.integer(),
    fc.boolean(),
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 0, maxLength: 50 }),
      value: fc.integer()
    }),
    fc.array(fc.integer(), { minLength: 0, maxLength: 10 })
  );

  const stateChangeArbitrary = fc.record({
    key: keyArbitrary,
    value: valueArbitrary
  });

  /**
   * **Feature: architecture-refactoring, Property 38: Test Environment Isolation**
   * **Validates: Requirements 10.2**
   * 
   * For any test, state changes made during the test should not affect other tests
   * running in the same test suite.
   */
  describe('Property 38: Test Environment Isolation', () => {
    describe('StorageMock Isolation', () => {
      test('state changes in one StorageMock instance do not affect new instances', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(stateChangeArbitrary, { minLength: 1, maxLength: 20 }),
            async (stateChanges) => {
              // Create first storage instance and make changes
              const storage1 = new StorageMock();
              
              // Track unique keys (Map overwrites duplicate keys)
              const uniqueKeys = new Set();
              for (const { key, value } of stateChanges) {
                await storage1.write(key, value);
                uniqueKeys.add(key);
              }
              
              // Verify changes were made (size equals unique keys, not total changes)
              expect(storage1.size).toBe(uniqueKeys.size);
              
              // Create a new storage instance (simulating a new test)
              const storage2 = new StorageMock();
              
              // New instance should be empty (isolated)
              expect(storage2.size).toBe(0);
              
              // Verify none of the keys from storage1 exist in storage2
              for (const { key } of stateChanges) {
                const exists = await storage2.exists(key);
                expect(exists).toBe(false);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      test('reset() clears all state for test isolation', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(stateChangeArbitrary, { minLength: 1, maxLength: 20 }),
            async (stateChanges) => {
              const storage = new StorageMock();
              
              // Make changes
              for (const { key, value } of stateChanges) {
                await storage.write(key, value);
              }
              
              // Configure failure modes
              storage.setReadDelay(100);
              storage.setWriteDelay(100);
              storage.setReadFailure(true);
              storage.setWriteFailure(true);
              
              // Reset
              storage.reset();
              
              // All state should be cleared
              expect(storage.size).toBe(0);
              expect(storage.getReadCount()).toBe(0);
              expect(storage.getWriteCount()).toBe(0);
              
              // Failure modes should be reset
              await expect(storage.read('test')).resolves.toBeUndefined();
              await expect(storage.write('test', 'value')).resolves.toBeUndefined();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('ElectronMock Isolation', () => {
      test('BrowserWindow instances are isolated between resets', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 10 }),
            fc.record({
              width: fc.integer({ min: 400, max: 2000 }),
              height: fc.integer({ min: 300, max: 1500 })
            }),
            async (windowCount, windowOptions) => {
              // Create windows
              const windows = [];
              for (let i = 0; i < windowCount; i++) {
                windows.push(new BrowserWindowMock(windowOptions));
              }
              
              // Verify windows were created
              expect(BrowserWindowMock.getAllWindows().length).toBe(windowCount);
              
              // Reset all windows (simulating test cleanup)
              BrowserWindowMock._resetAll();
              
              // All windows should be cleared
              expect(BrowserWindowMock.getAllWindows().length).toBe(0);
              expect(BrowserWindowMock.getFocusedWindow()).toBeNull();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('ElectronMock reset() clears all state', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 30 }),
            fc.string({ minLength: 1, maxLength: 100 }),
            async (channel, message) => {
              const electron = new ElectronMock();
              
              // Set up various state
              electron.ipcMain.handle(channel, () => message);
              electron.ipcMain.on(channel, () => {});
              new BrowserWindowMock({ width: 800, height: 600 });
              
              // Verify state was set
              expect(BrowserWindowMock.getAllWindows().length).toBe(1);
              
              // Reset
              electron.reset();
              
              // All state should be cleared
              expect(BrowserWindowMock.getAllWindows().length).toBe(0);
              
              // IPC handlers should be cleared
              await expect(
                electron.ipcMain._invoke(channel, {})
              ).rejects.toThrow(`No handler registered for channel: ${channel}`);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('NetworkMock Isolation', () => {
      test('network handlers are isolated between instances', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.webUrl(),
            fc.record({
              status: fc.integer({ min: 200, max: 599 }),
              body: fc.string({ maxLength: 100 })
            }),
            async (url, response) => {
              // Create first network mock and set up handler
              const network1 = new NetworkMock();
              network1.on(url, new MockResponse(response.body, { status: response.status }));
              
              // Verify handler works
              const result1 = await network1.fetch(url);
              expect(result1.status).toBe(response.status);
              
              // Create new network mock (simulating new test)
              const network2 = new NetworkMock();
              
              // New instance should not have the handler
              await expect(network2.fetch(url)).rejects.toThrow();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('reset() clears all network state', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.webUrl(),
            fc.string({ maxLength: 100 }),
            async (url, body) => {
              const network = new NetworkMock();
              
              // Set up state
              network.on(url, body);
              network.setLatency(100);
              network.setFailure(true);
              await network.fetch(url).catch(() => {}); // This will fail but log request
              
              // Verify state was set
              expect(network.getRequestLog().length).toBe(1);
              
              // Reset
              network.reset();
              
              // All state should be cleared
              expect(network.getRequestLog().length).toBe(0);
              
              // Handlers should be cleared
              await expect(network.fetch(url)).rejects.toThrow();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('TestContext Isolation', () => {
      test('createTestContext returns isolated instances', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(stateChangeArbitrary, { minLength: 1, maxLength: 10 }),
            fc.array(fc.record({
              type: fc.string({ minLength: 1, maxLength: 20 }),
              data: valueArbitrary
            }), { minLength: 1, maxLength: 10 }),
            async (stateChanges, events) => {
              // Create first context and populate it
              const context1 = createTestContext();
              
              // Track unique keys (setState overwrites duplicate keys)
              const uniqueKeys = new Set();
              for (const { key, value } of stateChanges) {
                context1.setState(key, value);
                uniqueKeys.add(key);
              }
              
              for (const event of events) {
                context1.recordEvent(event);
              }
              
              // Verify state was set (count unique keys, not total changes)
              expect(Object.keys(context1.state).length).toBe(uniqueKeys.size);
              expect(context1.events.length).toBe(events.length);
              
              // Create second context (simulating new test)
              const context2 = createTestContext();
              
              // Second context should be empty (isolated)
              expect(Object.keys(context2.state).length).toBe(0);
              expect(context2.events.length).toBe(0);
              
              // Verify no state leakage
              for (const { key } of stateChanges) {
                expect(context2.getState(key)).toBeUndefined();
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      test('reset() clears test context state', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(stateChangeArbitrary, { minLength: 1, maxLength: 10 }),
            async (stateChanges) => {
              const context = createTestContext();
              
              // Populate context
              for (const { key, value } of stateChanges) {
                context.setState(key, value);
              }
              context.recordEvent({ type: 'test' });
              context.recordError(new Error('test error'));
              
              // Verify state was set
              expect(Object.keys(context.state).length).toBeGreaterThan(0);
              expect(context.events.length).toBeGreaterThan(0);
              expect(context.errors.length).toBeGreaterThan(0);
              
              // Reset
              context.reset();
              
              // All state should be cleared
              expect(Object.keys(context.state).length).toBe(0);
              expect(context.events.length).toBe(0);
              expect(context.errors.length).toBe(0);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('FileSystemMock Isolation', () => {
      test('file system state is isolated between instances', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 50 }).map(s => `/test/${s.replace(/[/\\]/g, '_')}.txt`),
            fc.string({ maxLength: 200 }),
            async (filePath, content) => {
              // Create first file system and add file
              const fs1 = new FileSystemMock();
              fs1.setFile(filePath, content);
              
              // Verify file exists
              expect(await fs1.exists(filePath)).toBe(true);
              
              // Create new file system (simulating new test)
              const fs2 = new FileSystemMock();
              
              // New instance should not have the file
              expect(await fs2.exists(filePath)).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('JsonStoreMock Isolation', () => {
      test('JSON store state is isolated between instances', async () => {
        await fc.assert(
          fc.asyncProperty(
            keyArbitrary,
            valueArbitrary,
            async (key, value) => {
              // Create first store and set value
              const store1 = new JsonStoreMock();
              store1.set(key, value);
              
              // Verify value was set
              expect(store1.has(key)).toBe(true);
              
              // Create new store (simulating new test)
              const store2 = new JsonStoreMock();
              
              // New instance should not have the value
              expect(store2.has(key)).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  /**
   * **Feature: architecture-refactoring, Property 39: Test Failure Context**
   * **Validates: Requirements 10.4**
   * 
   * For any failing test, the failure report should include the input data that
   * caused the failure and a comparison of expected vs actual results.
   */
  describe('Property 39: Test Failure Context', () => {
    describe('formatFailureContext provides complete information', () => {
      test('failure context includes input, expected, and actual values', async () => {
        await fc.assert(
          fc.asyncProperty(
            valueArbitrary,
            valueArbitrary,
            valueArbitrary,
            async (input, expected, actual) => {
              const context = {
                input,
                expected,
                actual
              };
              
              const formatted = formatFailureContext(context);
              
              // Formatted output should contain all required sections
              expect(formatted).toContain('TEST FAILURE CONTEXT');
              expect(formatted).toContain('Input Data:');
              expect(formatted).toContain('Expected:');
              expect(formatted).toContain('Actual:');
              
              // Should contain the actual data (serialized)
              expect(formatted).toContain(JSON.stringify(input, null, 2));
              expect(formatted).toContain(JSON.stringify(expected, null, 2));
              expect(formatted).toContain(JSON.stringify(actual, null, 2));
            }
          ),
          { numRuns: 100 }
        );
      });

      test('failure context includes error information when present', async () => {
        await fc.assert(
          fc.asyncProperty(
            valueArbitrary,
            fc.string({ minLength: 1, maxLength: 100 }),
            async (input, errorMessage) => {
              const error = new Error(errorMessage);
              const context = {
                input,
                expected: 'success',
                actual: 'failure',
                error
              };
              
              const formatted = formatFailureContext(context);
              
              // Should contain error information
              expect(formatted).toContain('Error:');
              expect(formatted).toContain(errorMessage);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('deepEqual provides accurate comparison', () => {
      test('deepEqual correctly identifies equal objects', async () => {
        await fc.assert(
          fc.asyncProperty(
            valueArbitrary,
            async (value) => {
              // Clone the value
              const cloned = deepClone(value);
              
              // deepEqual should return true for equal values
              expect(deepEqual(value, cloned)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('deepEqual correctly identifies different objects', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              value: fc.integer()
            }),
            fc.string({ minLength: 1, maxLength: 50 }),
            async (obj, differentName) => {
              // Create a modified copy
              const modified = { ...obj, name: differentName + '_modified' };
              
              // deepEqual should return false for different values
              if (obj.name !== modified.name) {
                expect(deepEqual(obj, modified)).toBe(false);
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('deepClone creates independent copies', () => {
      test('deepClone creates a copy that can be modified independently', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              nested: fc.record({
                value: fc.integer(),
                items: fc.array(fc.integer(), { maxLength: 5 })
              })
            }),
            async (original) => {
              // Clone the object
              const cloned = deepClone(original);
              
              // Modify the clone
              cloned.name = 'modified';
              if (cloned.nested) {
                cloned.nested.value = -999;
              }
              
              // Original should be unchanged
              expect(original.name).not.toBe('modified');
              if (original.nested) {
                expect(original.nested.value).not.toBe(-999);
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Custom matchers provide detailed failure information', () => {
      test('toHaveErrorCode matcher provides clear failure messages', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 1, maxLength: 20 }),
            async (actualCode, expectedCode) => {
              const error = { code: actualCode };
              
              // Test the matcher behavior
              const result = expect.extend({
                toHaveErrorCode(received, expected) {
                  const pass = received && received.code === expected;
                  return {
                    pass,
                    message: () =>
                      pass
                        ? `expected error not to have code ${expected}`
                        : `expected error to have code ${expected}, but got ${received?.code}`
                  };
                }
              });
              
              // The matcher should correctly identify matching/non-matching codes
              if (actualCode === expectedCode) {
                expect(error).toHaveErrorCode(expectedCode);
              } else {
                expect(error).not.toHaveErrorCode(expectedCode);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      test('toHaveValidationErrorsFor matcher identifies missing fields', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
            fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 }),
            async (presentFields, missingFields) => {
              // Create validation result with some fields
              const validationResult = {
                errors: presentFields.map(field => ({ field, message: 'error' }))
              };
              
              // Matcher should correctly identify present fields
              const presentFieldsSet = new Set(presentFields);
              const actualMissingFields = missingFields.filter(f => !presentFieldsSet.has(f));
              
              if (actualMissingFields.length === 0 && missingFields.length > 0) {
                // All requested fields are present
                expect(validationResult).toHaveValidationErrorsFor(missingFields);
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Test context records errors with full information', () => {
      test('recordError captures error details for failure context', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 100 }),
            async (errorMessage) => {
              const context = createTestContext();
              const error = new Error(errorMessage);
              
              // Record the error
              context.recordError(error);
              
              // Error should be recorded with timestamp
              expect(context.errors.length).toBe(1);
              expect(context.errors[0].error).toBe(error);
              expect(context.errors[0].error.message).toBe(errorMessage);
              expect(typeof context.errors[0].timestamp).toBe('number');
            }
          ),
          { numRuns: 100 }
        );
      });

      test('multiple errors are recorded in order', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
            async (errorMessages) => {
              const context = createTestContext();
              
              // Record multiple errors
              for (const message of errorMessages) {
                context.recordError(new Error(message));
              }
              
              // All errors should be recorded in order
              expect(context.errors.length).toBe(errorMessages.length);
              
              for (let i = 0; i < errorMessages.length; i++) {
                expect(context.errors[i].error.message).toBe(errorMessages[i]);
              }
              
              // Timestamps should be non-decreasing
              for (let i = 1; i < context.errors.length; i++) {
                expect(context.errors[i].timestamp).toBeGreaterThanOrEqual(
                  context.errors[i - 1].timestamp
                );
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
