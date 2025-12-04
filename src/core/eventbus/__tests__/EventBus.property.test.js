'use strict';

/**
 * Property-based tests for EventBus
 * 
 * Tests the following properties:
 * - Property 6: Event Delivery Completeness
 * - Property 7: Event Payload Validation
 * - Property 8: Subscriber Error Isolation
 * - Property 9: Event History Retention
 * - Property 10: Subscription Cleanup
 * 
 * **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6**
 */

const fc = require('fast-check');
const { EventBus } = require('../EventBus');
const { EventSchema } = require('../EventSchema');

describe('EventBus Property Tests', () => {
  // Arbitraries for generating test data
  const eventNameArbitrary = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => s.trim().length > 0);
  
  const payloadArbitrary = fc.oneof(
    fc.string(),
    fc.integer(),
    fc.boolean(),
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 0, maxLength: 50 }),
      value: fc.integer()
    }),
    fc.array(fc.integer(), { minLength: 0, maxLength: 10 })
  );

  const subscriberCountArbitrary = fc.integer({ min: 1, max: 20 });

  /**
   * **Feature: architecture-refactoring, Property 6: Event Delivery Completeness**
   * **Validates: Requirements 3.2**
   * 
   * For any event and set of N subscribers, publishing the event should result
   * in exactly N subscriber callbacks being invoked with the correct payload.
   */
  describe('Property 6: Event Delivery Completeness', () => {
    test('all subscribers receive the event with correct payload', async () => {
      await fc.assert(
        fc.asyncProperty(
          eventNameArbitrary,
          payloadArbitrary,
          subscriberCountArbitrary,
          async (eventName, payload, subscriberCount) => {
            const eventBus = new EventBus();
            const receivedPayloads = [];
            const callCounts = new Array(subscriberCount).fill(0);

            // Subscribe N handlers
            for (let i = 0; i < subscriberCount; i++) {
              const index = i;
              eventBus.subscribe(eventName, (p) => {
                receivedPayloads.push(p);
                callCounts[index]++;
              });
            }

            // Publish the event
            await eventBus.publish(eventName, payload);

            // Verify all subscribers were called exactly once
            expect(receivedPayloads.length).toBe(subscriberCount);
            callCounts.forEach(count => expect(count).toBe(1));

            // Verify all received the correct payload
            receivedPayloads.forEach(received => {
              expect(received).toEqual(payload);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: architecture-refactoring, Property 7: Event Payload Validation**
   * **Validates: Requirements 3.3**
   * 
   * For any typed event with a defined schema, publishing a payload that does not
   * conform to the schema should result in a validation error before any subscribers
   * are notified.
   */
  describe('Property 7: Event Payload Validation', () => {
    test('invalid payloads are rejected before subscriber notification', async () => {
      await fc.assert(
        fc.asyncProperty(
          eventNameArbitrary,
          fc.string({ minLength: 1, maxLength: 50 }), // Invalid payload (string instead of object)
          async (eventName, invalidPayload) => {
            const eventBus = new EventBus();
            let subscriberCalled = false;

            // Register a schema that requires an object with specific properties
            const schema = EventSchema.object({
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            }, ['id', 'name']);

            eventBus.registerSchema(eventName, schema);

            // Subscribe a handler
            eventBus.subscribe(eventName, () => {
              subscriberCalled = true;
            });

            // Attempt to publish invalid payload
            let errorThrown = false;
            try {
              await eventBus.publish(eventName, invalidPayload);
            } catch (error) {
              errorThrown = true;
              expect(error.code).toBe('VALIDATION_ERROR');
            }

            // Validation error should be thrown
            expect(errorThrown).toBe(true);
            // Subscriber should NOT have been called
            expect(subscriberCalled).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('valid payloads pass validation and reach subscribers', async () => {
      await fc.assert(
        fc.asyncProperty(
          eventNameArbitrary,
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            name: fc.string({ minLength: 1, maxLength: 50 })
          }),
          async (eventName, validPayload) => {
            const eventBus = new EventBus();
            let receivedPayload = null;

            // Register a schema
            const schema = EventSchema.object({
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            }, ['id', 'name']);

            eventBus.registerSchema(eventName, schema);

            // Subscribe a handler
            eventBus.subscribe(eventName, (p) => {
              receivedPayload = p;
            });

            // Publish valid payload
            await eventBus.publish(eventName, validPayload);

            // Subscriber should have received the payload
            expect(receivedPayload).toEqual(validPayload);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 8: Subscriber Error Isolation**
   * **Validates: Requirements 3.4**
   * 
   * For any set of subscribers where one throws an error, all other subscribers
   * should still receive the event and the error should be logged.
   */
  describe('Property 8: Subscriber Error Isolation', () => {
    test('errors in one subscriber do not prevent others from receiving events', async () => {
      await fc.assert(
        fc.asyncProperty(
          eventNameArbitrary,
          payloadArbitrary,
          fc.integer({ min: 2, max: 10 }), // At least 2 subscribers
          fc.integer({ min: 0, max: 9 }), // Index of failing subscriber
          async (eventName, payload, subscriberCount, failingIndex) => {
            const actualFailingIndex = failingIndex % subscriberCount;
            const eventBus = new EventBus({ logger: () => {} }); // Suppress error logging
            const receivedPayloads = [];
            const callOrder = [];

            // Subscribe handlers, one of which will throw
            for (let i = 0; i < subscriberCount; i++) {
              const index = i;
              eventBus.subscribe(eventName, (p) => {
                callOrder.push(index);
                if (index === actualFailingIndex) {
                  throw new Error(`Subscriber ${index} failed`);
                }
                receivedPayloads.push({ index, payload: p });
              });
            }

            // Publish should not throw despite subscriber error
            await eventBus.publish(eventName, payload);

            // All subscribers should have been called
            expect(callOrder.length).toBe(subscriberCount);

            // All non-failing subscribers should have received the payload
            expect(receivedPayloads.length).toBe(subscriberCount - 1);
            receivedPayloads.forEach(({ payload: received }) => {
              expect(received).toEqual(payload);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('errors are logged when subscribers fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          eventNameArbitrary,
          payloadArbitrary,
          fc.string({ minLength: 1, maxLength: 50 }),
          async (eventName, payload, errorMessage) => {
            const loggedErrors = [];
            const eventBus = new EventBus({
              logger: (...args) => loggedErrors.push(args)
            });

            // Subscribe a failing handler
            eventBus.subscribe(eventName, () => {
              throw new Error(errorMessage);
            });

            // Publish
            await eventBus.publish(eventName, payload);

            // Error should have been logged
            expect(loggedErrors.length).toBe(1);
            expect(loggedErrors[0][0]).toContain('Subscriber error');
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 9: Event History Retention**
   * **Validates: Requirements 3.5**
   * 
   * For any published event within the retention period, it should be retrievable
   * from the event history with correct payload and timestamp.
   */
  describe('Property 9: Event History Retention', () => {
    test('published events are recorded in history with correct data', async () => {
      await fc.assert(
        fc.asyncProperty(
          eventNameArbitrary,
          payloadArbitrary,
          async (eventName, payload) => {
            const eventBus = new EventBus({ historyRetentionMs: 60000 }); // 1 minute retention
            const beforePublish = Date.now();

            // Publish the event
            await eventBus.publish(eventName, payload);

            const afterPublish = Date.now();

            // Get history
            const history = eventBus.getHistory(eventName);

            // Event should be in history
            expect(history.length).toBe(1);
            expect(history[0].event).toBe(eventName);
            expect(history[0].payload).toEqual(payload);
            expect(history[0].timestamp).toBeGreaterThanOrEqual(beforePublish);
            expect(history[0].timestamp).toBeLessThanOrEqual(afterPublish);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple events are retained in order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              event: eventNameArbitrary,
              payload: payloadArbitrary
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (events) => {
            const eventBus = new EventBus({ historyRetentionMs: 60000 });

            // Publish all events
            for (const { event, payload } of events) {
              await eventBus.publish(event, payload);
            }

            // Get full history
            const history = eventBus.getHistory();

            // All events should be in history
            expect(history.length).toBe(events.length);

            // Events should be in order
            for (let i = 0; i < events.length; i++) {
              expect(history[i].event).toBe(events[i].event);
              expect(history[i].payload).toEqual(events[i].payload);
            }

            // Timestamps should be non-decreasing
            for (let i = 1; i < history.length; i++) {
              expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i - 1].timestamp);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('history can be filtered by event name', async () => {
      await fc.assert(
        fc.asyncProperty(
          eventNameArbitrary,
          eventNameArbitrary,
          payloadArbitrary,
          payloadArbitrary,
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          async (event1, event2, payload1, payload2, count1, count2) => {
            // Ensure different event names
            const actualEvent2 = event1 === event2 ? event2 + '_different' : event2;
            const eventBus = new EventBus({ historyRetentionMs: 60000 });

            // Publish events of both types
            for (let i = 0; i < count1; i++) {
              await eventBus.publish(event1, payload1);
            }
            for (let i = 0; i < count2; i++) {
              await eventBus.publish(actualEvent2, payload2);
            }

            // Filter by event1
            const history1 = eventBus.getHistory(event1);
            expect(history1.length).toBe(count1);
            history1.forEach(record => {
              expect(record.event).toBe(event1);
            });

            // Filter by event2
            const history2 = eventBus.getHistory(actualEvent2);
            expect(history2.length).toBe(count2);
            history2.forEach(record => {
              expect(record.event).toBe(actualEvent2);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 10: Subscription Cleanup**
   * **Validates: Requirements 3.6**
   * 
   * For any subscription, calling the returned unsubscribe function should remove
   * the subscriber such that subsequent events are not delivered to it.
   */
  describe('Property 10: Subscription Cleanup', () => {
    test('unsubscribe prevents future event delivery', async () => {
      await fc.assert(
        fc.asyncProperty(
          eventNameArbitrary,
          payloadArbitrary,
          payloadArbitrary,
          async (eventName, payload1, payload2) => {
            const eventBus = new EventBus();
            const receivedPayloads = [];

            // Subscribe and get unsubscribe function
            const unsubscribe = eventBus.subscribe(eventName, (p) => {
              receivedPayloads.push(p);
            });

            // First publish should be received
            await eventBus.publish(eventName, payload1);
            expect(receivedPayloads.length).toBe(1);
            expect(receivedPayloads[0]).toEqual(payload1);

            // Unsubscribe
            unsubscribe();

            // Second publish should NOT be received
            await eventBus.publish(eventName, payload2);
            expect(receivedPayloads.length).toBe(1); // Still 1, not 2
          }
        ),
        { numRuns: 100 }
      );
    });

    test('unsubscribe only affects the specific subscription', async () => {
      await fc.assert(
        fc.asyncProperty(
          eventNameArbitrary,
          payloadArbitrary,
          fc.integer({ min: 2, max: 10 }),
          fc.integer({ min: 0, max: 9 }),
          async (eventName, payload, subscriberCount, unsubscribeIndex) => {
            const actualUnsubscribeIndex = unsubscribeIndex % subscriberCount;
            const eventBus = new EventBus();
            const receivedCounts = new Array(subscriberCount).fill(0);
            const unsubscribes = [];

            // Subscribe multiple handlers
            for (let i = 0; i < subscriberCount; i++) {
              const index = i;
              const unsub = eventBus.subscribe(eventName, () => {
                receivedCounts[index]++;
              });
              unsubscribes.push(unsub);
            }

            // Unsubscribe one
            unsubscribes[actualUnsubscribeIndex]();

            // Publish
            await eventBus.publish(eventName, payload);

            // All except unsubscribed should have received
            for (let i = 0; i < subscriberCount; i++) {
              if (i === actualUnsubscribeIndex) {
                expect(receivedCounts[i]).toBe(0);
              } else {
                expect(receivedCounts[i]).toBe(1);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('subscribeOnce automatically unsubscribes after first event', async () => {
      await fc.assert(
        fc.asyncProperty(
          eventNameArbitrary,
          payloadArbitrary,
          payloadArbitrary,
          async (eventName, payload1, payload2) => {
            const eventBus = new EventBus();
            const receivedPayloads = [];

            // Subscribe once
            eventBus.subscribeOnce(eventName, (p) => {
              receivedPayloads.push(p);
            });

            // First publish should be received
            await eventBus.publish(eventName, payload1);
            expect(receivedPayloads.length).toBe(1);

            // Second publish should NOT be received (auto-unsubscribed)
            await eventBus.publish(eventName, payload2);
            expect(receivedPayloads.length).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('calling unsubscribe multiple times is safe', async () => {
      await fc.assert(
        fc.asyncProperty(
          eventNameArbitrary,
          payloadArbitrary,
          fc.integer({ min: 1, max: 10 }),
          async (eventName, payload, callCount) => {
            const eventBus = new EventBus();
            let receivedCount = 0;

            const unsubscribe = eventBus.subscribe(eventName, () => {
              receivedCount++;
            });

            // Call unsubscribe multiple times
            for (let i = 0; i < callCount; i++) {
              unsubscribe(); // Should not throw
            }

            // Publish should not reach the unsubscribed handler
            await eventBus.publish(eventName, payload);
            expect(receivedCount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
