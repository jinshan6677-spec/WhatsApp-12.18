'use strict';

/**
 * Property-based tests for ErrorHandler
 * 
 * Tests for:
 * - Property 20: Error Recovery Execution
 * - Property 21: Error Logging Completeness
 * - Property 22: Error Message Localization
 * 
 * **Validates: Requirements 6.3, 6.5, 6.6**
 */

const fc = require('fast-check');
const { 
  ErrorHandler, 
  createErrorHandler,
  resetGlobalErrorHandler 
} = require('../ErrorHandler');
const AppError = require('../AppError');

describe('ErrorHandler Property Tests', () => {
  // Arbitrary for generating error codes
  const errorCodeChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ_';
  const errorCodeArbitrary = fc.array(
    fc.integer({ min: 0, max: errorCodeChars.length - 1 }),
    { minLength: 3, maxLength: 20 }
  ).map(indices => indices.map(i => errorCodeChars[i]).join(''));

  // Arbitrary for error messages
  const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 });

  // Arbitrary for error context
  const contextArbitrary = fc.record({
    component: fc.string({ minLength: 0, maxLength: 50 }),
    operation: fc.string({ minLength: 0, maxLength: 50 }),
    userId: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
    accountId: fc.option(fc.uuid())
  });

  // Arbitrary for recovery results
  const recoveryResultArbitrary = fc.record({
    success: fc.boolean(),
    message: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
    data: fc.option(fc.anything())
  });

  // Arbitrary for locale codes
  const localeArbitrary = fc.constantFrom('en', 'zh', 'es', 'fr', 'de', 'ja');

  // Arbitrary for locale messages
  const localeMessagesArbitrary = fc.dictionary(
    errorCodeArbitrary,
    fc.string({ minLength: 1, maxLength: 200 })
  );

  beforeEach(() => {
    resetGlobalErrorHandler();
  });

  /**
   * **Feature: architecture-refactoring, Property 20: Error Recovery Execution**
   * **Validates: Requirements 6.3**
   * 
   * For any recoverable error with a registered recovery strategy,
   * the recovery strategy should be executed and its result should
   * indicate success or failure.
   */
  describe('Property 20: Error Recovery Execution', () => {
    test('recovery strategy is executed for recoverable errors with registered strategy', async () => {
      await fc.assert(
        fc.asyncProperty(
          errorMessageArbitrary,
          errorCodeArbitrary,
          contextArbitrary,
          recoveryResultArbitrary,
          async (message, code, context, expectedResult) => {
            const handler = createErrorHandler({ logger: () => {} });
            
            // Track if strategy was called
            let strategyCalled = false;
            let receivedError = null;
            let receivedContext = null;
            
            // Register recovery strategy
            handler.registerRecoveryStrategy(code, async (error, ctx) => {
              strategyCalled = true;
              receivedError = error;
              receivedContext = ctx;
              return expectedResult;
            });
            
            // Create a recoverable error
            const error = new AppError(message, code, context, true);
            
            // Attempt recovery
            const result = await handler.recover(error, context);
            
            // Strategy should have been called
            expect(strategyCalled).toBe(true);
            expect(receivedError).toBe(error);
            
            // Result should match what strategy returned
            expect(result.success).toBe(expectedResult.success);
            if (expectedResult.message) {
              expect(result.message).toBe(expectedResult.message);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('recovery fails gracefully for non-recoverable errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          errorMessageArbitrary,
          errorCodeArbitrary,
          contextArbitrary,
          async (message, code, context) => {
            const handler = createErrorHandler({ logger: () => {} });
            
            // Register a strategy (should not be called)
            let strategyCalled = false;
            handler.registerRecoveryStrategy(code, async () => {
              strategyCalled = true;
              return { success: true };
            });
            
            // Create a non-recoverable error
            const error = new AppError(message, code, context, false);
            
            // Attempt recovery
            const result = await handler.recover(error, context);
            
            // Strategy should NOT have been called
            expect(strategyCalled).toBe(false);
            expect(result.success).toBe(false);
            expect(result.message).toContain('not marked as recoverable');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('recovery fails gracefully when no strategy is registered', async () => {
      await fc.assert(
        fc.asyncProperty(
          errorMessageArbitrary,
          errorCodeArbitrary,
          contextArbitrary,
          async (message, code, context) => {
            const handler = createErrorHandler({ logger: () => {} });
            
            // Create a recoverable error but don't register a strategy
            const error = new AppError(message, code, context, true);
            
            // Attempt recovery
            const result = await handler.recover(error, context);
            
            // Should fail with appropriate message
            expect(result.success).toBe(false);
            expect(result.message).toContain('No recovery strategy registered');
            expect(result.message).toContain(code);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('recovery handles strategy exceptions gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          errorMessageArbitrary,
          errorCodeArbitrary,
          errorMessageArbitrary,
          async (message, code, strategyErrorMessage) => {
            const handler = createErrorHandler({ logger: () => {} });
            
            // Register a strategy that throws
            handler.registerRecoveryStrategy(code, async () => {
              throw new Error(strategyErrorMessage);
            });
            
            // Create a recoverable error
            const error = new AppError(message, code, {}, true);
            
            // Attempt recovery
            const result = await handler.recover(error, {});
            
            // Should fail gracefully
            expect(result.success).toBe(false);
            expect(result.message).toContain('Recovery failed');
            expect(result.message).toContain(strategyErrorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: architecture-refactoring, Property 21: Error Logging Completeness**
   * **Validates: Requirements 6.5**
   * 
   * For any error handled by the error handler, a log entry should be created
   * containing the error type, message, stack trace, and context metadata.
   */
  describe('Property 21: Error Logging Completeness', () => {
    test('handled errors create complete log entries in history', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          errorCodeArbitrary,
          contextArbitrary,
          fc.boolean(),
          (message, code, context, recoverable) => {
            const handler = createErrorHandler({ logger: () => {} });
            
            // Create and handle an error
            const error = new AppError(message, code, context, recoverable);
            const record = handler.handle(error, context);
            
            // Verify record contains all required fields
            expect(record.timestamp).toBeDefined();
            expect(typeof record.timestamp).toBe('string');
            
            expect(record.level).toBeDefined();
            expect(['error', 'warn', 'info']).toContain(record.level);
            
            expect(record.errorType).toBe('AppError');
            expect(record.errorCode).toBe(code);
            expect(record.message).toBe(message);
            
            expect(record.stack).toBeDefined();
            expect(typeof record.stack).toBe('string');
            
            expect(record.context).toBeDefined();
            expect(typeof record.context).toBe('object');
            
            expect(record.recoverable).toBe(recoverable);
            expect(typeof record.recovered).toBe('boolean');
            
            // Verify record is in history
            const history = handler.getErrorHistory();
            expect(history.length).toBeGreaterThan(0);
            expect(history[history.length - 1]).toEqual(record);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('log entries contain merged context from error and handle call', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          errorCodeArbitrary,
          contextArbitrary,
          contextArbitrary,
          (message, code, errorContext, handleContext) => {
            const handler = createErrorHandler({ logger: () => {} });
            
            // Create error with initial context
            const error = new AppError(message, code, errorContext, false);
            
            // Handle with additional context
            const record = handler.handle(error, handleContext);
            
            // Context should contain fields from both
            Object.keys(handleContext).forEach(key => {
              if (handleContext[key] !== undefined) {
                expect(record.context[key]).toEqual(handleContext[key]);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('wrapped non-AppError errors create complete log entries', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          contextArbitrary,
          (message, context) => {
            const handler = createErrorHandler({ logger: () => {} });
            
            // Create a regular Error
            const error = new Error(message);
            
            // Handle it
            const record = handler.handle(error, context);
            
            // Should still have all required fields
            expect(record.timestamp).toBeDefined();
            expect(record.errorType).toBe('AppError'); // Wrapped as AppError
            expect(record.errorCode).toBe('WRAPPED_ERROR');
            expect(record.message).toBe(message);
            expect(record.stack).toBeDefined();
            expect(record.context).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error history respects maxHistory limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1, max: 50 }),
          (maxHistory, errorCount) => {
            const handler = createErrorHandler({ 
              logger: () => {},
              maxHistory 
            });
            
            // Handle multiple errors
            for (let i = 0; i < errorCount; i++) {
              handler.handle(new Error(`Error ${i}`), {});
            }
            
            // History should not exceed maxHistory
            const history = handler.getErrorHistory();
            expect(history.length).toBeLessThanOrEqual(maxHistory);
            
            // If we added more than max, should have exactly max
            if (errorCount > maxHistory) {
              expect(history.length).toBe(maxHistory);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: architecture-refactoring, Property 22: Error Message Localization**
   * **Validates: Requirements 6.6**
   * 
   * For any error and supported locale, the user-facing message should be
   * in the correct language and should not expose technical details.
   */
  describe('Property 22: Error Message Localization', () => {
    test('localized messages are returned for supported locales', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          fc.constantFrom('VALIDATION_ERROR', 'NETWORK_ERROR', 'STORAGE_ERROR', 
                          'PLUGIN_ERROR', 'IPC_ERROR', 'STATE_ERROR', 'UNKNOWN_ERROR'),
          fc.constantFrom('en', 'zh'),
          (message, code, locale) => {
            const handler = createErrorHandler({ logger: () => {} });
            
            // Create an error
            const error = new AppError(message, code, {}, false);
            
            // Get localized message
            const localizedMessage = handler.getLocalizedMessage(error, locale);
            
            // Should return a non-empty string
            expect(typeof localizedMessage).toBe('string');
            expect(localizedMessage.length).toBeGreaterThan(0);
            
            // Should NOT contain the technical error message
            // (unless it happens to be a substring of the localized message)
            // The localized message should be user-friendly
            expect(localizedMessage).not.toBe(message);
            
            // Should NOT contain stack trace indicators
            expect(localizedMessage).not.toContain('at ');
            expect(localizedMessage).not.toContain('.js:');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('registered locale messages are used correctly', () => {
      fc.assert(
        fc.property(
          localeArbitrary.filter(l => !['en', 'zh'].includes(l)),
          localeMessagesArbitrary,
          errorCodeArbitrary,
          errorMessageArbitrary,
          (locale, messages, code, technicalMessage) => {
            const handler = createErrorHandler({ logger: () => {} });
            
            // Register custom locale with the error code
            const customMessage = `Custom message for ${code}`;
            handler.registerLocale(locale, { [code]: customMessage });
            
            // Create an error with that code
            const error = new AppError(technicalMessage, code, {}, false);
            
            // Get localized message
            const localizedMessage = handler.getLocalizedMessage(error, locale);
            
            // Should return the custom message
            expect(localizedMessage).toBe(customMessage);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('fallback to default locale when locale not found', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          fc.constantFrom('VALIDATION_ERROR', 'NETWORK_ERROR', 'STORAGE_ERROR'),
          (message, code) => {
            const handler = createErrorHandler({ 
              logger: () => {},
              defaultLocale: 'en'
            });
            
            // Create an error
            const error = new AppError(message, code, {}, false);
            
            // Get localized message for unsupported locale
            const localizedMessage = handler.getLocalizedMessage(error, 'unsupported_locale');
            
            // Should fall back to English
            const englishMessage = handler.getLocalizedMessage(error, 'en');
            expect(localizedMessage).toBe(englishMessage);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('fallback to UNKNOWN_ERROR when error code not in locale', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          errorCodeArbitrary.filter(code => 
            !['VALIDATION_ERROR', 'NETWORK_ERROR', 'STORAGE_ERROR', 
              'PLUGIN_ERROR', 'IPC_ERROR', 'STATE_ERROR', 'UNKNOWN_ERROR',
              'TIMEOUT_ERROR', 'PERMISSION_ERROR', 'NOT_FOUND_ERROR',
              'CONFLICT_ERROR', 'WRAPPED_ERROR', 'CORRUPTION_ERROR',
              'INITIALIZATION_ERROR', 'CONFIGURATION_ERROR'].includes(code)
          ),
          (message, unknownCode) => {
            const handler = createErrorHandler({ logger: () => {} });
            
            // Create an error with unknown code
            const error = new AppError(message, unknownCode, {}, false);
            
            // Get localized message
            const localizedMessage = handler.getLocalizedMessage(error, 'en');
            
            // Should return UNKNOWN_ERROR message
            const unknownErrorMessage = handler.getLocalizedMessage(
              new AppError('test', 'UNKNOWN_ERROR', {}, false), 
              'en'
            );
            expect(localizedMessage).toBe(unknownErrorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Chinese locale returns Chinese messages', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          fc.constantFrom('VALIDATION_ERROR', 'NETWORK_ERROR', 'STORAGE_ERROR'),
          (message, code) => {
            const handler = createErrorHandler({ logger: () => {} });
            
            // Create an error
            const error = new AppError(message, code, {}, false);
            
            // Get Chinese message
            const zhMessage = handler.getLocalizedMessage(error, 'zh');
            
            // Get English message
            const enMessage = handler.getLocalizedMessage(error, 'en');
            
            // Messages should be different (Chinese vs English)
            expect(zhMessage).not.toBe(enMessage);
            
            // Chinese message should contain Chinese characters
            const hasChineseChars = /[\u4e00-\u9fff]/.test(zhMessage);
            expect(hasChineseChars).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
