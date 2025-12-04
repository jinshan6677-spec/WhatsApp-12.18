'use strict';

/**
 * Property-based tests for IPCRouter
 * 
 * Tests the following properties:
 * - Property 29: IPC Payload Validation
 * - Property 30: IPC Timeout Handling
 * - Property 31: IPC Error Response
 * - Property 32: IPC Batch Processing
 * 
 * **Validates: Requirements 8.2, 8.3, 8.4, 8.5**
 */

const fc = require('fast-check');
const { IPCRouter } = require('../IPCRouter');
const { EventSchema } = require('../../../core/eventbus/EventSchema');

describe('IPCRouter Property Tests', () => {
  // Arbitraries for generating test data
  const channelNameArbitrary = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => s.trim().length > 0 && !s.includes('\n'));

  const requestIdArbitrary = fc.string({ minLength: 1, maxLength: 36 })
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

  const timeoutArbitrary = fc.integer({ min: 10, max: 5000 });


  /**
   * **Feature: architecture-refactoring, Property 29: IPC Payload Validation**
   * **Validates: Requirements 8.2**
   * 
   * For any IPC request with a defined schema, if the payload does not conform
   * to the schema, the request should be rejected with a validation error before
   * the handler is invoked.
   */
  describe('Property 29: IPC Payload Validation', () => {
    test('invalid payloads are rejected before handler invocation', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelNameArbitrary,
          requestIdArbitrary,
          fc.string({ minLength: 1, maxLength: 50 }), // Invalid payload (string instead of object)
          async (channel, requestId, invalidPayload) => {
            const router = new IPCRouter({ logger: () => {} });
            let handlerCalled = false;

            // Register handler with schema requiring object with id and name
            const schema = EventSchema.object({
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            }, ['id', 'name']);

            router.register(channel, async () => {
              handlerCalled = true;
              return { success: true };
            }, { schema });

            // Handle request with invalid payload
            const response = await router.handle(channel, {
              requestId,
              payload: invalidPayload
            });

            // Response should indicate failure
            expect(response.success).toBe(false);
            expect(response.requestId).toBe(requestId);
            expect(response.error).toBeDefined();
            expect(response.error.context.type).toBe('validation');

            // Handler should NOT have been called
            expect(handlerCalled).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('valid payloads pass validation and reach handler', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelNameArbitrary,
          requestIdArbitrary,
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            name: fc.string({ minLength: 1, maxLength: 50 })
          }),
          async (channel, requestId, validPayload) => {
            const router = new IPCRouter({ logger: () => {} });
            let receivedPayload = null;

            // Register handler with schema
            const schema = EventSchema.object({
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            }, ['id', 'name']);

            router.register(channel, async (req) => {
              receivedPayload = req.payload;
              return { processed: true };
            }, { schema });

            // Handle request with valid payload
            const response = await router.handle(channel, {
              requestId,
              payload: validPayload
            });

            // Response should indicate success
            expect(response.success).toBe(true);
            expect(response.requestId).toBe(requestId);
            expect(response.data).toEqual({ processed: true });

            // Handler should have received the payload
            expect(receivedPayload).toEqual(validPayload);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('channels without schema accept any payload', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelNameArbitrary,
          requestIdArbitrary,
          payloadArbitrary,
          async (channel, requestId, payload) => {
            const router = new IPCRouter({ logger: () => {} });
            let receivedPayload = null;

            // Register handler without schema
            router.register(channel, async (req) => {
              receivedPayload = req.payload;
              return payload;
            });

            // Handle request
            const response = await router.handle(channel, {
              requestId,
              payload
            });

            // Should succeed with any payload
            expect(response.success).toBe(true);
            expect(receivedPayload).toEqual(payload);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 30: IPC Timeout Handling**
   * **Validates: Requirements 8.3**
   * 
   * For any IPC request with a timeout, if the handler does not respond within
   * the timeout period, the request should fail with a timeout error.
   */
  describe('Property 30: IPC Timeout Handling', () => {
    test('requests that exceed timeout fail with timeout error', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelNameArbitrary,
          requestIdArbitrary,
          fc.integer({ min: 10, max: 50 }), // Short timeout (10-50ms)
          async (channel, requestId, timeout) => {
            const router = new IPCRouter({ logger: () => {} });

            // Register a slow handler that takes longer than timeout
            router.register(channel, async () => {
              await new Promise(resolve => setTimeout(resolve, timeout + 100));
              return { done: true };
            }, { defaultTimeout: timeout });

            // Handle request
            const response = await router.handle(channel, {
              requestId,
              payload: {}
            });

            // Should fail with timeout error
            expect(response.success).toBe(false);
            expect(response.requestId).toBe(requestId);
            expect(response.error).toBeDefined();
            expect(response.error.context.type).toBe('timeout');
            expect(response.error.context.timeout).toBe(timeout);
          }
        ),
        { numRuns: 20 } // Fewer runs due to timeouts
      );
    });

    test('requests that complete within timeout succeed', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelNameArbitrary,
          requestIdArbitrary,
          payloadArbitrary,
          async (channel, requestId, payload) => {
            const router = new IPCRouter({ logger: () => {} });

            // Register a fast handler
            router.register(channel, async (req) => {
              return { received: req.payload };
            }, { defaultTimeout: 5000 });

            // Handle request
            const response = await router.handle(channel, {
              requestId,
              payload
            });

            // Should succeed
            expect(response.success).toBe(true);
            expect(response.data).toEqual({ received: payload });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('request-level timeout overrides channel default', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelNameArbitrary,
          requestIdArbitrary,
          async (channel, requestId) => {
            const router = new IPCRouter({ logger: () => {} });

            // Register handler with long default timeout
            router.register(channel, async () => {
              await new Promise(resolve => setTimeout(resolve, 100));
              return { done: true };
            }, { defaultTimeout: 5000 });

            // Handle request with short timeout override
            const response = await router.handle(channel, {
              requestId,
              payload: {},
              timeout: 20 // Very short timeout
            });

            // Should fail with timeout
            expect(response.success).toBe(false);
            expect(response.error.context.type).toBe('timeout');
          }
        ),
        { numRuns: 20 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 31: IPC Error Response**
   * **Validates: Requirements 8.4**
   * 
   * For any IPC handler that throws an error, the response should contain a
   * structured error object with error code, message, and context.
   */
  describe('Property 31: IPC Error Response', () => {
    test('handler errors produce structured error responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelNameArbitrary,
          requestIdArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          async (channel, requestId, errorMessage) => {
            const router = new IPCRouter({ logger: () => {} });

            // Register handler that throws
            router.register(channel, async () => {
              throw new Error(errorMessage);
            });

            // Handle request
            const response = await router.handle(channel, {
              requestId,
              payload: {}
            });

            // Should fail with structured error
            expect(response.success).toBe(false);
            expect(response.requestId).toBe(requestId);
            expect(response.error).toBeDefined();
            expect(response.error.code).toBeDefined();
            expect(response.error.message).toBeDefined();
            expect(response.error.context).toBeDefined();
            expect(typeof response.error.recoverable).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('non-existent channels produce structured error responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelNameArbitrary,
          requestIdArbitrary,
          async (channel, requestId) => {
            const router = new IPCRouter({ logger: () => {} });

            // Don't register any handler

            // Handle request to non-existent channel
            const response = await router.handle(channel, {
              requestId,
              payload: {}
            });

            // Should fail with structured error
            expect(response.success).toBe(false);
            expect(response.requestId).toBe(requestId);
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('IPC_ERROR');
            // Error message should indicate the channel issue
            expect(response.error.message.length).toBeGreaterThan(0);
            expect(response.error.context).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error responses preserve request ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelNameArbitrary,
          requestIdArbitrary,
          async (channel, requestId) => {
            const router = new IPCRouter({ logger: () => {} });

            router.register(channel, async () => {
              throw new Error('Test error');
            });

            const response = await router.handle(channel, {
              requestId,
              payload: {}
            });

            // Request ID should be preserved in error response
            expect(response.requestId).toBe(requestId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 32: IPC Batch Processing**
   * **Validates: Requirements 8.5**
   * 
   * For any batch of IPC requests, all requests should be processed and responses
   * should be returned in the same order as the requests.
   */
  describe('Property 32: IPC Batch Processing', () => {
    test('batch responses maintain request order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              channel: channelNameArbitrary,
              requestId: requestIdArbitrary,
              payload: payloadArbitrary
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (requests) => {
            const router = new IPCRouter({ logger: () => {} });

            // Register handlers for all unique channels
            const uniqueChannels = [...new Set(requests.map(r => r.channel))];
            for (const channel of uniqueChannels) {
              router.register(channel, async (req) => {
                return { echo: req.payload, id: req.requestId };
              });
            }

            // Process batch
            const responses = await router.batch(requests);

            // Should have same number of responses as requests
            expect(responses.length).toBe(requests.length);

            // Responses should be in same order as requests
            for (let i = 0; i < requests.length; i++) {
              expect(responses[i].requestId).toBe(requests[i].requestId);
              if (responses[i].success) {
                expect(responses[i].data.id).toBe(requests[i].requestId);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('batch processes all requests even if some fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          fc.integer({ min: 0, max: 9 }),
          async (requestCount, failIndex) => {
            const actualFailIndex = failIndex % requestCount;
            const router = new IPCRouter({ logger: () => {} });

            // Register success handler
            router.register('success', async (req) => {
              return { ok: true };
            });

            // Register failing handler
            router.register('fail', async () => {
              throw new Error('Intentional failure');
            });

            // Create requests with one failing
            const requests = [];
            for (let i = 0; i < requestCount; i++) {
              requests.push({
                channel: i === actualFailIndex ? 'fail' : 'success',
                requestId: `req-${i}`,
                payload: { index: i }
              });
            }

            // Process batch
            const responses = await router.batch(requests);

            // All requests should have responses
            expect(responses.length).toBe(requestCount);

            // Check each response
            for (let i = 0; i < requestCount; i++) {
              expect(responses[i].requestId).toBe(`req-${i}`);
              if (i === actualFailIndex) {
                expect(responses[i].success).toBe(false);
              } else {
                expect(responses[i].success).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('batch handles requests with missing channels', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (requestCount) => {
            const router = new IPCRouter({ logger: () => {} });

            // Create requests with missing channel field
            const requests = [];
            for (let i = 0; i < requestCount; i++) {
              requests.push({
                // channel is missing
                requestId: `req-${i}`,
                payload: { index: i }
              });
            }

            // Process batch
            const responses = await router.batch(requests);

            // All requests should have error responses
            expect(responses.length).toBe(requestCount);
            for (const response of responses) {
              expect(response.success).toBe(false);
              expect(response.error.message).toContain('missing channel');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty batch returns empty array', async () => {
      const router = new IPCRouter({ logger: () => {} });
      const responses = await router.batch([]);
      expect(responses).toEqual([]);
    });
  });
});
