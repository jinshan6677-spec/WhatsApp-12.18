'use strict';

/**
 * Property-based tests for NativeWrapper
 * 
 * Tests the following property:
 * - Property 10: 被覆盖API原生函数特征 (Wrapped API Native Function Characteristics)
 * 
 * **Feature: professional-fingerprint-refactoring, Property 10: 被覆盖API原生函数特征**
 * **Validates: Requirements 28.4, 28.5**
 */

const fc = require('fast-check');
const { NativeWrapper, NativeWrapperError } = require('../../src/infrastructure/fingerprint/injection-scripts/core/native-wrapper');

// ==================== Arbitraries ====================

/**
 * JavaScript reserved keywords that cannot be used as function names
 */
const RESERVED_KEYWORDS = new Set([
  'break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete',
  'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof',
  'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var',
  'void', 'while', 'with', 'class', 'const', 'enum', 'export', 'extends',
  'import', 'super', 'implements', 'interface', 'let', 'package', 'private',
  'protected', 'public', 'static', 'yield', 'await', 'null', 'true', 'false'
]);

/**
 * Valid function name arbitrary
 * Function names must be valid JavaScript identifiers and not reserved keywords
 */
const validFunctionNameArbitrary = fc.string({ minLength: 1, maxLength: 30 })
  .map(s => s.replace(/[^a-zA-Z0-9_$]/g, ''))
  .filter(s => s.length > 0 && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s) && !RESERVED_KEYWORDS.has(s));

/**
 * Function length arbitrary (number of parameters)
 */
const functionLengthArbitrary = fc.integer({ min: 0, max: 10 });

/**
 * Return value arbitrary for wrapped functions
 */
const returnValueArbitrary = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.double({ noNaN: true }),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.array(fc.integer(), { maxLength: 5 }),
  fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.integer(), { maxKeys: 5 })
);

/**
 * Create a native function with specified name and length
 */
function createNativeFunction(name, length) {
  // Create a function with the specified number of parameters
  const params = Array.from({ length }, (_, i) => `arg${i}`).join(', ');
  const fn = new Function(`return function ${name}(${params}) { return arguments; }`)();
  return fn;
}

// ==================== Property Tests ====================

describe('NativeWrapper Property Tests', () => {
  
  /**
   * **Feature: professional-fingerprint-refactoring, Property 10: 被覆盖API原生函数特征**
   * **Validates: Requirements 28.4, 28.5**
   * 
   * For any API function wrapped by the fingerprint system, calling its toString()
   * method should return a string containing "[native code]".
   */
  describe('Property 10: Wrapped API Native Function Characteristics', () => {
    
    test('wrapped function toString returns [native code]', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          functionLengthArbitrary,
          returnValueArbitrary,
          async (funcName, funcLength, returnValue) => {
            // Create an original function
            const originalFn = createNativeFunction(funcName, funcLength);
            
            // Wrap it with NativeWrapper
            const wrapped = NativeWrapper.wrap(
              originalFn,
              (original, args) => returnValue,
              { name: funcName, length: funcLength }
            );
            
            // Requirement 28.5: toString should return "[native code]"
            const toStringResult = wrapped.toString();
            expect(toStringResult).toContain('[native code]');
            expect(toStringResult).toBe(`function ${funcName}() { [native code] }`);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('wrapped function name property matches original', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          functionLengthArbitrary,
          async (funcName, funcLength) => {
            const originalFn = createNativeFunction(funcName, funcLength);
            
            const wrapped = NativeWrapper.wrap(
              originalFn,
              (original, args) => original.apply(this, args),
              { name: funcName, length: funcLength }
            );
            
            // Requirement 28.8: name property should match
            expect(wrapped.name).toBe(funcName);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('wrapped function length property matches original', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          functionLengthArbitrary,
          async (funcName, funcLength) => {
            const originalFn = createNativeFunction(funcName, funcLength);
            
            const wrapped = NativeWrapper.wrap(
              originalFn,
              (original, args) => original.apply(this, args),
              { name: funcName, length: funcLength }
            );
            
            // Requirement 28.8: length property should match
            expect(wrapped.length).toBe(funcLength);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('wrapped function name descriptor matches native function characteristics', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          async (funcName) => {
            const originalFn = createNativeFunction(funcName, 0);
            
            const wrapped = NativeWrapper.wrap(
              originalFn,
              (original, args) => original.apply(this, args),
              { name: funcName }
            );
            
            // Requirement 28.7: Property descriptors should match native
            const nameDescriptor = Object.getOwnPropertyDescriptor(wrapped, 'name');
            
            expect(nameDescriptor).toBeDefined();
            expect(nameDescriptor.writable).toBe(false);
            expect(nameDescriptor.enumerable).toBe(false);
            expect(nameDescriptor.configurable).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('wrapped function length descriptor matches native function characteristics', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          functionLengthArbitrary,
          async (funcName, funcLength) => {
            const originalFn = createNativeFunction(funcName, funcLength);
            
            const wrapped = NativeWrapper.wrap(
              originalFn,
              (original, args) => original.apply(this, args),
              { name: funcName, length: funcLength }
            );
            
            // Requirement 28.7: Property descriptors should match native
            const lengthDescriptor = Object.getOwnPropertyDescriptor(wrapped, 'length');
            
            expect(lengthDescriptor).toBeDefined();
            expect(lengthDescriptor.writable).toBe(false);
            expect(lengthDescriptor.enumerable).toBe(false);
            expect(lengthDescriptor.configurable).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('wrapped function executes wrapper logic correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          returnValueArbitrary,
          async (funcName, expectedReturn) => {
            const originalFn = createNativeFunction(funcName, 0);
            
            const wrapped = NativeWrapper.wrap(
              originalFn,
              (original, args) => expectedReturn,
              { name: funcName }
            );
            
            // The wrapped function should return the value from wrapper
            const result = wrapped();
            expect(result).toEqual(expectedReturn);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('wrapped function preserves this context', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          fc.string(),
          async (funcName, contextValue) => {
            const originalFn = createNativeFunction(funcName, 0);
            
            const wrapped = NativeWrapper.wrap(
              originalFn,
              function(original, args, thisArg) {
                return thisArg?.testValue;
              },
              { name: funcName, preserveThis: true }
            );
            
            const context = { testValue: contextValue };
            const result = wrapped.call(context);
            
            expect(result).toBe(contextValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('wrapped function can access original function', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          fc.array(fc.integer(), { minLength: 0, maxLength: 5 }),
          async (funcName, args) => {
            // Create a function that sums its arguments
            const originalFn = function(...nums) {
              return nums.reduce((a, b) => a + b, 0);
            };
            Object.defineProperty(originalFn, 'name', { value: funcName });
            
            const wrapped = NativeWrapper.wrap(
              originalFn,
              (original, passedArgs) => {
                // Call original and add 1 to result
                return original(...passedArgs) + 1;
              },
              { name: funcName }
            );
            
            const expectedSum = args.reduce((a, b) => a + b, 0) + 1;
            const result = wrapped(...args);
            
            expect(result).toBe(expectedSum);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('getOriginal returns the original function', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          async (funcName) => {
            const originalFn = createNativeFunction(funcName, 0);
            
            const wrapped = NativeWrapper.wrap(
              originalFn,
              (original, args) => original.apply(this, args),
              { name: funcName }
            );
            
            // Requirement 28.6: Preserve original function reference
            const retrieved = NativeWrapper.getOriginal(wrapped);
            expect(retrieved).toBe(originalFn);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('isWrapped correctly identifies wrapped functions', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          async (funcName) => {
            const originalFn = createNativeFunction(funcName, 0);
            
            const wrapped = NativeWrapper.wrap(
              originalFn,
              (original, args) => original.apply(this, args),
              { name: funcName }
            );
            
            expect(NativeWrapper.isWrapped(wrapped)).toBe(true);
            expect(NativeWrapper.isWrapped(originalFn)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('verifyNativeCharacteristics passes for properly wrapped functions', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          async (funcName) => {
            const originalFn = createNativeFunction(funcName, 0);
            
            const wrapped = NativeWrapper.wrap(
              originalFn,
              (original, args) => original.apply(this, args),
              { name: funcName }
            );
            
            const verification = NativeWrapper.verifyNativeCharacteristics(wrapped, funcName);
            
            // All achievable checks should pass
            // Note: Function.prototype.toString.call() cannot be fully overridden
            // without using a Proxy, so we focus on the achievable characteristics
            expect(verification.valid).toBe(true);
            expect(verification.checks.name.pass).toBe(true);
            expect(verification.checks.toString.pass).toBe(true);
            expect(verification.checks.nameDescriptor.pass).toBe(true);
            expect(verification.checks.lengthDescriptor.pass).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('protectPrototype correctly replaces method on prototype', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          returnValueArbitrary,
          async (methodName, returnValue) => {
            // Create a test prototype
            const TestClass = function() {};
            TestClass.prototype[methodName] = function() { return 'original'; };
            
            // Create wrapped function
            const wrapped = NativeWrapper.wrap(
              TestClass.prototype[methodName],
              () => returnValue,
              { name: methodName }
            );
            
            // Protect the prototype
            NativeWrapper.protectPrototype(TestClass.prototype, methodName, wrapped);
            
            // Verify the method was replaced
            const instance = new TestClass();
            expect(instance[methodName]()).toEqual(returnValue);
            
            // Verify toString still returns native code
            expect(TestClass.prototype[methodName].toString()).toContain('[native code]');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('protectPrototype preserves descriptor attributes', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          async (methodName) => {
            // Create a test prototype with specific descriptor
            const TestClass = function() {};
            Object.defineProperty(TestClass.prototype, methodName, {
              value: function() { return 'original'; },
              writable: false,
              enumerable: true,
              configurable: true
            });
            
            const originalDescriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, methodName);
            
            // Create wrapped function
            const wrapped = NativeWrapper.wrap(
              TestClass.prototype[methodName],
              () => 'wrapped',
              { name: methodName }
            );
            
            // Protect the prototype with preserveDescriptor: true
            NativeWrapper.protectPrototype(TestClass.prototype, methodName, wrapped, { preserveDescriptor: true });
            
            // Requirement 28.7: Descriptor should be preserved
            const newDescriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, methodName);
            expect(newDescriptor.writable).toBe(originalDescriptor.writable);
            expect(newDescriptor.enumerable).toBe(originalDescriptor.enumerable);
            expect(newDescriptor.configurable).toBe(originalDescriptor.configurable);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('createConstantFunction creates native-looking function', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          returnValueArbitrary,
          functionLengthArbitrary,
          async (funcName, returnValue, funcLength) => {
            const fn = NativeWrapper.createConstantFunction(funcName, returnValue, funcLength);
            
            // Should return the constant value
            expect(fn()).toEqual(returnValue);
            
            // Should have native characteristics
            expect(fn.name).toBe(funcName);
            expect(fn.length).toBe(funcLength);
            expect(fn.toString()).toContain('[native code]');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Handling', () => {
    test('wrap throws error for non-function originalFn', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.array(fc.integer()),
            fc.dictionary(fc.string(), fc.integer())
          ),
          async (invalidOriginal) => {
            expect(() => {
              NativeWrapper.wrap(invalidOriginal, () => {});
            }).toThrow(NativeWrapperError);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('wrap throws error for non-function wrapperFn', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFunctionNameArbitrary,
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined)
          ),
          async (funcName, invalidWrapper) => {
            const originalFn = createNativeFunction(funcName, 0);
            
            expect(() => {
              NativeWrapper.wrap(originalFn, invalidWrapper);
            }).toThrow(NativeWrapperError);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('protectPrototype throws error for non-object proto', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined)
          ),
          validFunctionNameArbitrary,
          async (invalidProto, methodName) => {
            const wrapped = NativeWrapper.wrap(
              function() {},
              () => {},
              { name: methodName }
            );
            
            expect(() => {
              NativeWrapper.protectPrototype(invalidProto, methodName, wrapped);
            }).toThrow(NativeWrapperError);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('protectPrototype throws error for invalid methodName', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(''),
            fc.constant(null),
            fc.constant(undefined),
            fc.integer()
          ),
          async (invalidMethodName) => {
            const TestClass = function() {};
            const wrapped = NativeWrapper.wrap(
              function() {},
              () => {},
              { name: 'test' }
            );
            
            expect(() => {
              NativeWrapper.protectPrototype(TestClass.prototype, invalidMethodName, wrapped);
            }).toThrow(NativeWrapperError);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
