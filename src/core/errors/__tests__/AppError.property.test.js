'use strict';

/**
 * Property-based tests for Error types
 * 
 * **Feature: architecture-refactoring, Property 19: Error Context Preservation**
 * **Validates: Requirements 6.2**
 */

const fc = require('fast-check');
const {
  AppError,
  ValidationError,
  NetworkError,
  StorageError,
  PluginError,
  IPCError,
  StateError,
  fromJSON
} = require('../index');

describe('Error Context Preservation (Property 19)', () => {
  // Arbitrary for generating error context objects
  const contextArbitrary = fc.record({
    component: fc.string({ minLength: 0, maxLength: 50 }),
    operation: fc.string({ minLength: 0, maxLength: 50 }),
    userId: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
    accountId: fc.option(fc.uuid()),
    additionalData: fc.option(fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.oneof(fc.string(), fc.integer(), fc.boolean())
    ))
  });

  // Arbitrary for generating original errors
  const originalErrorArbitrary = fc.record({
    message: fc.string({ minLength: 1, maxLength: 100 }),
    name: fc.constantFrom('Error', 'TypeError', 'RangeError', 'SyntaxError')
  }).map(({ message, name }) => {
    const err = new Error(message);
    err.name = name;
    return err;
  });

  // Arbitrary for error codes (uppercase letters and underscores)
  const errorCodeChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ_';
  const errorCodeArbitrary = fc.array(
    fc.integer({ min: 0, max: errorCodeChars.length - 1 }),
    { minLength: 3, maxLength: 20 }
  ).map(indices => indices.map(i => errorCodeChars[i]).join(''));

  // Arbitrary for error messages
  const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 });

  /**
   * **Feature: architecture-refactoring, Property 19: Error Context Preservation**
   * **Validates: Requirements 6.2**
   * 
   * For any error that occurs, wrapping it in an AppError should preserve
   * the original error message and stack trace while adding context information.
   */
  test('wrapping an error preserves original message and stack trace', () => {
    fc.assert(
      fc.property(
        originalErrorArbitrary,
        errorCodeArbitrary,
        contextArbitrary,
        (originalError, code, additionalContext) => {
          // Wrap the original error
          const wrappedError = AppError.wrap(originalError, code, additionalContext);
          
          // Original message should be preserved
          expect(wrappedError.message).toBe(originalError.message);
          
          // Original error should be accessible in context
          expect(wrappedError.context.originalError).toBe(originalError);
          
          // Original stack should be preserved
          expect(wrappedError.originalStack).toBe(originalError.stack);
          expect(wrappedError.originalMessage).toBe(originalError.message);
          
          // Additional context should be merged
          Object.keys(additionalContext).forEach(key => {
            if (additionalContext[key] !== undefined) {
              expect(wrappedError.context[key]).toEqual(additionalContext[key]);
            }
          });
          
          // Error code should be set
          expect(wrappedError.code).toBe(code);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: architecture-refactoring, Property 19: Error Context Preservation**
   * **Validates: Requirements 6.2**
   * 
   * For any AppError, context information should be preserved through
   * JSON serialization and deserialization.
   */
  test('context is preserved through JSON round-trip', () => {
    fc.assert(
      fc.property(
        errorMessageArbitrary,
        errorCodeArbitrary,
        contextArbitrary,
        fc.boolean(),
        (message, code, context, recoverable) => {
          // Create an AppError with context
          const originalError = new AppError(message, code, context, recoverable);
          
          // Serialize and deserialize
          const json = originalError.toJSON();
          const restoredError = AppError.fromJSON(json);
          
          // Context should be preserved
          expect(restoredError.context).toEqual(originalError.context);
          expect(restoredError.message).toBe(originalError.message);
          expect(restoredError.code).toBe(originalError.code);
          expect(restoredError.recoverable).toBe(originalError.recoverable);
          expect(restoredError.timestamp).toBe(originalError.timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: architecture-refactoring, Property 19: Error Context Preservation**
   * **Validates: Requirements 6.2**
   * 
   * For any error subclass, context should be preserved with type-specific fields.
   */
  test('subclass-specific context is preserved', () => {
    fc.assert(
      fc.property(
        errorMessageArbitrary,
        fc.record({
          fields: fc.array(fc.record({
            field: fc.string({ minLength: 1, maxLength: 30 }),
            reason: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))
          }), { minLength: 0, maxLength: 5 })
        }),
        (message, context) => {
          // Create a ValidationError with field-level context
          const validationError = new ValidationError(message, context);
          
          // Serialize and deserialize
          const json = validationError.toJSON();
          const restoredError = ValidationError.fromJSON(json);
          
          // Fields should be preserved
          expect(restoredError.fields).toEqual(validationError.fields);
          expect(restoredError.context.fields).toEqual(context.fields);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: architecture-refactoring, Property 19: Error Context Preservation**
   * **Validates: Requirements 6.2**
   * 
   * Wrapping an AppError should merge context rather than replace it.
   */
  test('wrapping AppError merges context', () => {
    fc.assert(
      fc.property(
        errorMessageArbitrary,
        errorCodeArbitrary,
        contextArbitrary,
        contextArbitrary,
        (message, code, originalContext, additionalContext) => {
          // Create an AppError with initial context
          const originalError = new AppError(message, code, originalContext);
          
          // Wrap it with additional context
          const wrappedError = AppError.wrap(originalError, 'NEW_CODE', additionalContext);
          
          // Should return the same error instance (not create a new one)
          expect(wrappedError).toBe(originalError);
          
          // Context should be merged (additional context takes precedence)
          Object.keys(additionalContext).forEach(key => {
            if (additionalContext[key] !== undefined) {
              expect(wrappedError.context[key]).toEqual(additionalContext[key]);
            }
          });
          
          // Original context keys not in additional should be preserved
          Object.keys(originalContext).forEach(key => {
            if (!(key in additionalContext) || additionalContext[key] === undefined) {
              expect(wrappedError.context[key]).toEqual(originalContext[key]);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: architecture-refactoring, Property 19: Error Context Preservation**
   * **Validates: Requirements 6.2**
   * 
   * All error types should preserve context through fromJSON deserialization.
   */
  test('all error types preserve context through fromJSON', () => {
    const errorTypes = [
      { Class: AppError, code: 'APP_ERROR' },
      { Class: ValidationError, code: 'VALIDATION_ERROR' },
      { Class: NetworkError, code: 'NETWORK_ERROR' },
      { Class: StorageError, code: 'STORAGE_ERROR' },
      { Class: PluginError, code: 'PLUGIN_ERROR' },
      { Class: IPCError, code: 'IPC_ERROR' },
      { Class: StateError, code: 'STATE_ERROR' }
    ];

    fc.assert(
      fc.property(
        errorMessageArbitrary,
        contextArbitrary,
        fc.integer({ min: 0, max: errorTypes.length - 1 }),
        (message, context, typeIndex) => {
          const { Class } = errorTypes[typeIndex];
          
          // Create error instance
          let error;
          if (Class === AppError) {
            error = new Class(message, 'TEST_CODE', context);
          } else {
            error = new Class(message, context);
          }
          
          // Serialize
          const json = error.toJSON();
          
          // Deserialize using the generic fromJSON
          const restoredError = fromJSON(json);
          
          // Context should be preserved
          expect(restoredError.context).toEqual(error.context);
          expect(restoredError.name).toBe(error.name);
          expect(restoredError.message).toBe(error.message);
        }
      ),
      { numRuns: 100 }
    );
  });
});
