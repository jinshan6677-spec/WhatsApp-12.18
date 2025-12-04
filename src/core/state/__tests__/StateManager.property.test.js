'use strict';

/**
 * Property-based tests for StateManager
 * 
 * Tests the following properties:
 * - Property 33: State Change Notification
 * - Property 34: State Persistence Round-Trip
 * - Property 35: State Corruption Handling
 * - Property 36: State Snapshot Accuracy
 * - Property 37: State Serialization Round-Trip
 * 
 * **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6**
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { StateManager } = require('../StateManager');

describe('StateManager Property Tests', () => {
  // Arbitraries for generating test data
  const stateKeyArbitrary = fc.string({ minLength: 1, maxLength: 30 })
    .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s));

  const primitiveValueArbitrary = fc.oneof(
    fc.string({ minLength: 0, maxLength: 100 }),
    fc.integer({ min: -1000000, max: 1000000 }),
    fc.boolean(),
    fc.constant(null)
  );

  const simpleObjectArbitrary = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 0, maxLength: 50 }),
    value: fc.integer({ min: -1000, max: 1000 }),
    active: fc.boolean()
  });

  const stateArbitrary = fc.dictionary(
    stateKeyArbitrary,
    fc.oneof(
      primitiveValueArbitrary,
      simpleObjectArbitrary,
      fc.array(fc.integer(), { minLength: 0, maxLength: 10 })
    ),
    { minKeys: 0, maxKeys: 10 }
  );

  // Helper to create temp file path
  const createTempPath = () => {
    return path.join(os.tmpdir(), `state-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  };

  // Cleanup helper
  const cleanupFile = (filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  };


  /**
   * **Feature: architecture-refactoring, Property 33: State Change Notification**
   * **Validates: Requirements 9.2**
   * 
   * For any state change and set of observers, all observers should be notified
   * with the new state value.
   */
  describe('Property 33: State Change Notification', () => {
    test('all global subscribers receive state changes', () => {
      fc.assert(
        fc.property(
          stateArbitrary,
          stateArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (initialState, newState, subscriberCount) => {
            const stateManager = new StateManager({ initialState });
            const receivedStates = [];

            // Subscribe multiple observers
            for (let i = 0; i < subscriberCount; i++) {
              stateManager.subscribe((state) => {
                receivedStates.push(state);
              });
            }

            // Change state
            stateManager.setState(() => newState);

            // All subscribers should have been notified
            expect(receivedStates.length).toBe(subscriberCount);

            // All should have received the new state
            receivedStates.forEach(received => {
              expect(received).toEqual(newState);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('slice subscribers receive changes to their specific slice', () => {
      fc.assert(
        fc.property(
          stateKeyArbitrary,
          primitiveValueArbitrary,
          primitiveValueArbitrary,
          fc.integer({ min: 1, max: 5 }),
          (sliceKey, initialValue, newValue, subscriberCount) => {
            const initialState = { [sliceKey]: initialValue };
            const stateManager = new StateManager({ initialState });
            const receivedValues = [];
            const receivedOldValues = [];

            // Subscribe to slice
            for (let i = 0; i < subscriberCount; i++) {
              stateManager.subscribeToSlice(sliceKey, (value, oldValue) => {
                receivedValues.push(value);
                receivedOldValues.push(oldValue);
              });
            }

            // Change slice
            stateManager.setSlice(sliceKey, newValue);

            // All subscribers should have been notified
            expect(receivedValues.length).toBe(subscriberCount);

            // All should have received correct values
            receivedValues.forEach(received => {
              expect(received).toEqual(newValue);
            });
            receivedOldValues.forEach(received => {
              expect(received).toEqual(initialValue);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('slice subscribers are not notified for unchanged slices', () => {
      fc.assert(
        fc.property(
          stateKeyArbitrary,
          stateKeyArbitrary,
          primitiveValueArbitrary,
          primitiveValueArbitrary,
          (slice1, slice2Raw, value1, value2) => {
            // Ensure different slice keys
            const slice2 = slice1 === slice2Raw ? slice2Raw + '_other' : slice2Raw;
            
            const initialState = { [slice1]: value1, [slice2]: value2 };
            const stateManager = new StateManager({ initialState });
            let slice1NotificationCount = 0;

            // Subscribe to slice1
            stateManager.subscribeToSlice(slice1, () => {
              slice1NotificationCount++;
            });

            // Change slice2 only
            stateManager.setSlice(slice2, 'changed');

            // slice1 subscriber should NOT have been notified
            expect(slice1NotificationCount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 34: State Persistence Round-Trip**
   * **Validates: Requirements 9.3**
   * 
   * For any application state, persisting and then restoring should produce
   * equivalent state.
   */
  describe('Property 34: State Persistence Round-Trip', () => {
    test('persist then restore produces equivalent state', async () => {
      await fc.assert(
        fc.asyncProperty(
          stateArbitrary,
          async (state) => {
            const persistPath = createTempPath();
            
            try {
              // Create manager with state and persist
              const manager1 = new StateManager({
                initialState: state,
                persistPath
              });
              await manager1.persist();

              // Create new manager and restore
              const manager2 = new StateManager({ persistPath });
              await manager2.restore();

              // States should be equivalent
              expect(manager2.getState()).toEqual(state);
            } finally {
              cleanupFile(persistPath);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('persisted state includes version information', async () => {
      await fc.assert(
        fc.asyncProperty(
          stateArbitrary,
          fc.integer({ min: 1, max: 10 }),
          async (initialState, changeCount) => {
            const persistPath = createTempPath();
            
            try {
              const manager = new StateManager({
                initialState,
                persistPath
              });

              // Make some state changes to increment version
              for (let i = 0; i < changeCount; i++) {
                manager.setState(s => ({ ...s, counter: i }));
              }

              await manager.persist();

              // Read persisted file directly
              const content = fs.readFileSync(persistPath, 'utf8');
              const data = JSON.parse(content);

              // Should have version and checksum
              expect(data.version).toBe(changeCount);
              expect(data.checksum).toBeDefined();
              expect(typeof data.checksum).toBe('string');
            } finally {
              cleanupFile(persistPath);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 35: State Corruption Handling**
   * **Validates: Requirements 9.4**
   * 
   * For any corrupted state data, restoration should fail gracefully with an error
   * and should not crash the application or leave the state in an inconsistent state.
   */
  describe('Property 35: State Corruption Handling', () => {
    test('corrupted JSON is handled gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          stateArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => {
            // Generate strings that are not valid JSON
            try {
              JSON.parse(s);
              return false;
            } catch {
              return true;
            }
          }),
          async (initialState, corruptedData) => {
            const persistPath = createTempPath();
            
            try {
              // Write corrupted data to file
              fs.writeFileSync(persistPath, corruptedData, 'utf8');

              const manager = new StateManager({
                initialState,
                persistPath
              });

              // Restore should throw with CORRUPTION_ERROR
              let errorThrown = false;
              let errorCode = null;
              
              try {
                await manager.restore();
              } catch (error) {
                errorThrown = true;
                errorCode = error.code;
              }

              expect(errorThrown).toBe(true);
              expect(errorCode).toBe('CORRUPTION_ERROR');

              // Original state should be preserved
              expect(manager.getState()).toEqual(initialState);
            } finally {
              cleanupFile(persistPath);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('checksum mismatch is detected as corruption', async () => {
      await fc.assert(
        fc.asyncProperty(
          stateArbitrary,
          async (state) => {
            const persistPath = createTempPath();
            
            try {
              // Create valid persisted state with wrong checksum
              const data = {
                state,
                version: 1,
                timestamp: Date.now(),
                checksum: 'invalid_checksum_12345'
              };
              fs.writeFileSync(persistPath, JSON.stringify(data), 'utf8');

              const manager = new StateManager({ persistPath });

              // Restore should throw with CORRUPTION_ERROR
              let errorThrown = false;
              let errorCode = null;
              
              try {
                await manager.restore();
              } catch (error) {
                errorThrown = true;
                errorCode = error.code;
              }

              expect(errorThrown).toBe(true);
              expect(errorCode).toBe('CORRUPTION_ERROR');
            } finally {
              cleanupFile(persistPath);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('deserialize handles invalid data gracefully', () => {
      fc.assert(
        fc.property(
          stateArbitrary,
          fc.oneof(
            fc.constant(''),
            fc.constant('not json'),
            fc.constant('{invalid}'),
            fc.constant('null'),
            fc.constant('123')
          ),
          (initialState, invalidData) => {
            const manager = new StateManager({ initialState });

            let errorThrown = false;
            let errorCode = null;

            try {
              manager.deserialize(invalidData);
            } catch (error) {
              errorThrown = true;
              errorCode = error.code;
            }

            // Should throw CORRUPTION_ERROR for invalid data
            // Note: 'null' and '123' are valid JSON but not valid state objects
            if (invalidData === '' || invalidData === 'not json' || invalidData === '{invalid}') {
              expect(errorThrown).toBe(true);
              expect(errorCode).toBe('CORRUPTION_ERROR');
            }

            // Original state should be preserved on error
            if (errorThrown) {
              expect(manager.getState()).toEqual(initialState);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 36: State Snapshot Accuracy**
   * **Validates: Requirements 9.5**
   * 
   * For any sequence of state changes, each snapshot should accurately capture
   * the state at that point in time.
   */
  describe('Property 36: State Snapshot Accuracy', () => {
    test('snapshots capture state at the moment they are taken', () => {
      fc.assert(
        fc.property(
          fc.array(stateArbitrary, { minLength: 1, maxLength: 10 }),
          (stateSequence) => {
            const manager = new StateManager();
            const snapshots = [];

            // Apply each state and take a snapshot
            for (const state of stateSequence) {
              manager.setState(() => state);
              snapshots.push(manager.snapshot());
            }

            // Each snapshot should match the state at that point
            for (let i = 0; i < stateSequence.length; i++) {
              expect(snapshots[i].state).toEqual(stateSequence[i]);
            }

            // Versions should be sequential
            for (let i = 0; i < snapshots.length; i++) {
              expect(snapshots[i].version).toBe(i + 1);
            }

            // Timestamps should be non-decreasing
            for (let i = 1; i < snapshots.length; i++) {
              expect(snapshots[i].timestamp).toBeGreaterThanOrEqual(snapshots[i - 1].timestamp);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('snapshots are independent of subsequent state changes', () => {
      fc.assert(
        fc.property(
          stateArbitrary,
          stateArbitrary,
          (state1, state2) => {
            const manager = new StateManager({ initialState: state1 });
            
            // Take snapshot of initial state
            const snapshot = manager.snapshot();

            // Change state
            manager.setState(() => state2);

            // Snapshot should still have original state
            expect(snapshot.state).toEqual(state1);

            // Current state should be new state
            expect(manager.getState()).toEqual(state2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('restoreFromSnapshot accurately restores state', () => {
      fc.assert(
        fc.property(
          stateArbitrary,
          stateArbitrary,
          stateArbitrary,
          (state1, state2, state3) => {
            const manager = new StateManager({ initialState: state1 });
            
            // Take snapshot
            const snapshot1 = manager.snapshot();

            // Make changes
            manager.setState(() => state2);
            manager.setState(() => state3);

            // Restore from snapshot
            manager.restoreFromSnapshot(snapshot1);

            // State should be back to snapshot state
            expect(manager.getState()).toEqual(state1);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('getSnapshots returns all snapshots in order', () => {
      fc.assert(
        fc.property(
          fc.array(stateArbitrary, { minLength: 1, maxLength: 10 }),
          (stateSequence) => {
            const manager = new StateManager();

            // Apply states and take snapshots
            for (const state of stateSequence) {
              manager.setState(() => state);
              manager.snapshot();
            }

            // Get all snapshots
            const allSnapshots = manager.getSnapshots();

            // Should have correct count
            expect(allSnapshots.length).toBe(stateSequence.length);

            // Each should match corresponding state
            for (let i = 0; i < stateSequence.length; i++) {
              expect(allSnapshots[i].state).toEqual(stateSequence[i]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 37: State Serialization Round-Trip**
   * **Validates: Requirements 9.6**
   * 
   * For any application state, serializing and deserializing should produce
   * equivalent state.
   */
  describe('Property 37: State Serialization Round-Trip', () => {
    test('serialize then deserialize produces equivalent state', () => {
      fc.assert(
        fc.property(
          stateArbitrary,
          (state) => {
            const manager1 = new StateManager({ initialState: state });
            
            // Serialize
            const serialized = manager1.serialize();

            // Deserialize into new manager
            const manager2 = new StateManager();
            manager2.deserialize(serialized);

            // States should be equivalent
            expect(manager2.getState()).toEqual(state);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('serialization preserves nested structures', () => {
      fc.assert(
        fc.property(
          fc.record({
            users: fc.array(
              fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 50 }),
                settings: fc.record({
                  theme: fc.constantFrom('light', 'dark'),
                  notifications: fc.boolean()
                })
              }),
              { minLength: 0, maxLength: 5 }
            ),
            config: fc.record({
              version: fc.integer({ min: 1, max: 100 }),
              features: fc.array(fc.string(), { minLength: 0, maxLength: 5 })
            })
          }),
          (complexState) => {
            const manager1 = new StateManager({ initialState: complexState });
            
            // Serialize and deserialize
            const serialized = manager1.serialize();
            const manager2 = new StateManager();
            manager2.deserialize(serialized);

            // Deep equality check
            expect(manager2.getState()).toEqual(complexState);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('serialization includes version information', () => {
      fc.assert(
        fc.property(
          stateArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (initialState, changeCount) => {
            const manager = new StateManager({ initialState });

            // Make changes to increment version
            for (let i = 0; i < changeCount; i++) {
              manager.setState(s => ({ ...s, counter: i }));
            }

            // Serialize
            const serialized = manager.serialize();
            const parsed = JSON.parse(serialized);

            // Should include version
            expect(parsed.version).toBe(changeCount);
            expect(parsed.timestamp).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple round-trips preserve state', () => {
      fc.assert(
        fc.property(
          stateArbitrary,
          fc.integer({ min: 1, max: 5 }),
          (state, roundTrips) => {
            let currentState = state;

            for (let i = 0; i < roundTrips; i++) {
              const manager = new StateManager({ initialState: currentState });
              const serialized = manager.serialize();
              
              const newManager = new StateManager();
              newManager.deserialize(serialized);
              currentState = newManager.getState();
            }

            // After multiple round-trips, state should still be equivalent
            expect(currentState).toEqual(state);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
