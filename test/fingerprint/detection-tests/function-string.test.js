'use strict';

/**
 * Function Stringification Detection Tests
 * 
 * Implements detection tests that use function toString() to detect
 * fingerprint spoofing. These tests verify that wrapped functions
 * maintain native function string characteristics.
 * 
 * Detection techniques tested:
 * - Function.prototype.toString behavior
 * - toString() returning [native code]
 * - Function name and length properties
 * - toSource() for Firefox compatibility
 * 
 * @module test/fingerprint/detection-tests/function-string
 * 
 * **Validates: Requirements 52.4**
 */

const { NativeWrapper } = require('../../../src/infrastructure/fingerprint/injection-scripts/core/native-wrapper');
const { NavigatorSpoof } = require('../../../src/infrastructure/fingerprint/injection-scripts/navigator');

// ==================== Test Helpers ====================

/**
 * Creates a mock navigator object for testing
 */
function createMockNavigator() {
  const proto = {};
  const navigator = Object.create(proto);
  
  Object.defineProperty(proto, 'userAgent', {
    get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    enumerable: true,
    configurable: true
  });
  
  Object.defineProperty(proto, 'platform', {
    get: () => 'Win32',
    enumerable: true,
    configurable: true
  });
  
  Object.defineProperty(proto, 'vendor', {
    get: () => 'Google Inc.',
    enumerable: true,
    configurable: true
  });
  
  Object.defineProperty(proto, 'language', {
    get: () => 'en-US',
    enumerable: true,
    configurable: true
  });
  
  Object.defineProperty(proto, 'languages', {
    get: () => Object.freeze(['en-US', 'en']),
    enumerable: true,
    configurable: true
  });
  
  return navigator;
}

/**
 * Creates a native function for testing
 */
function createNativeFunction(name, length = 0) {
  const params = Array.from({ length }, (_, i) => `arg${i}`).join(', ');
  const fn = new Function(`return function ${name}(${params}) { return arguments; }`)();
  return fn;
}


/**
 * Detects if a function appears to be native based on toString()
 */
function detectNativeFunction(fn, expectedName) {
  const results = {
    passed: true,
    checks: []
  };
  
  // Check 1: toString() should contain [native code]
  const toStringResult = fn.toString();
  const nativeCodeCheck = {
    name: 'toString contains [native code]',
    expected: true,
    actual: toStringResult.includes('[native code]'),
    pass: toStringResult.includes('[native code]')
  };
  results.checks.push(nativeCodeCheck);
  if (!nativeCodeCheck.pass) results.passed = false;
  
  // Check 2: toString() should match expected format
  const expectedFormat = `function ${expectedName}() { [native code] }`;
  const formatCheck = {
    name: 'toString format',
    expected: expectedFormat,
    actual: toStringResult,
    pass: toStringResult === expectedFormat
  };
  results.checks.push(formatCheck);
  if (!formatCheck.pass) results.passed = false;
  
  // Check 3: Function name should match
  const nameCheck = {
    name: 'function name',
    expected: expectedName,
    actual: fn.name,
    pass: fn.name === expectedName
  };
  results.checks.push(nameCheck);
  if (!nameCheck.pass) results.passed = false;
  
  return results;
}

/**
 * Detects if a getter function appears native
 */
function detectNativeGetter(descriptor, propertyName) {
  const results = {
    passed: true,
    checks: []
  };
  
  if (!descriptor || !descriptor.get) {
    results.passed = false;
    results.checks.push({
      name: 'getter exists',
      pass: false
    });
    return results;
  }
  
  const getter = descriptor.get;
  
  // Check 1: Getter toString should contain [native code]
  const toStringResult = getter.toString();
  const nativeCodeCheck = {
    name: 'getter toString contains [native code]',
    expected: true,
    actual: toStringResult.includes('[native code]'),
    pass: toStringResult.includes('[native code]')
  };
  results.checks.push(nativeCodeCheck);
  if (!nativeCodeCheck.pass) results.passed = false;
  
  // Check 2: Getter name should be "get propertyName"
  const expectedName = `get ${propertyName}`;
  const nameCheck = {
    name: 'getter name',
    expected: expectedName,
    actual: getter.name,
    pass: getter.name === expectedName
  };
  results.checks.push(nameCheck);
  if (!nameCheck.pass) results.passed = false;
  
  return results;
}

/**
 * Advanced detection using Function.prototype.toString.call
 * Note: This cannot be fully overridden without Proxy
 */
function detectUsingPrototypeToString(fn) {
  const results = {
    passed: true,
    checks: []
  };
  
  // Direct toString call
  const directResult = fn.toString();
  const directCheck = {
    name: 'direct toString',
    actual: directResult,
    pass: directResult.includes('[native code]')
  };
  results.checks.push(directCheck);
  if (!directCheck.pass) results.passed = false;
  
  return results;
}

/**
 * Detects function property tampering
 */
function detectFunctionPropertyTampering(fn, expectedName, expectedLength) {
  const results = {
    passed: true,
    checks: []
  };
  
  // Check name property descriptor
  const nameDescriptor = Object.getOwnPropertyDescriptor(fn, 'name');
  if (nameDescriptor) {
    const nameDescCheck = {
      name: 'name descriptor',
      expected: { writable: false, enumerable: false, configurable: true },
      actual: {
        writable: nameDescriptor.writable,
        enumerable: nameDescriptor.enumerable,
        configurable: nameDescriptor.configurable
      },
      pass: nameDescriptor.writable === false &&
            nameDescriptor.enumerable === false &&
            nameDescriptor.configurable === true
    };
    results.checks.push(nameDescCheck);
    if (!nameDescCheck.pass) results.passed = false;
  }
  
  // Check length property descriptor
  const lengthDescriptor = Object.getOwnPropertyDescriptor(fn, 'length');
  if (lengthDescriptor) {
    const lengthDescCheck = {
      name: 'length descriptor',
      expected: { writable: false, enumerable: false, configurable: true },
      actual: {
        writable: lengthDescriptor.writable,
        enumerable: lengthDescriptor.enumerable,
        configurable: lengthDescriptor.configurable
      },
      pass: lengthDescriptor.writable === false &&
            lengthDescriptor.enumerable === false &&
            lengthDescriptor.configurable === true
    };
    results.checks.push(lengthDescCheck);
    if (!lengthDescCheck.pass) results.passed = false;
  }
  
  // Check name value
  const nameValueCheck = {
    name: 'name value',
    expected: expectedName,
    actual: fn.name,
    pass: fn.name === expectedName
  };
  results.checks.push(nameValueCheck);
  if (!nameValueCheck.pass) results.passed = false;
  
  // Check length value
  const lengthValueCheck = {
    name: 'length value',
    expected: expectedLength,
    actual: fn.length,
    pass: fn.length === expectedLength
  };
  results.checks.push(lengthValueCheck);
  if (!lengthValueCheck.pass) results.passed = false;
  
  return results;
}

// ==================== Test Suites ====================

describe('Function Stringification Detection Tests', () => {
  
  /**
   * **Validates: Requirements 52.4**
   * 
   * Tests that wrapped functions pass toString() detection
   */
  describe('NativeWrapper toString Detection', () => {
    
    test('wrapped function toString returns [native code]', () => {
      const originalFn = createNativeFunction('testFunction', 2);
      
      const wrapped = NativeWrapper.wrap(
        originalFn,
        (original, args) => 'wrapped result',
        { name: 'testFunction', length: 2 }
      );
      
      const results = detectNativeFunction(wrapped, 'testFunction');
      
      expect(results.passed).toBe(true);
      for (const check of results.checks) {
        expect(check.pass).toBe(true);
      }
    });
    
    test('wrapped function name matches original', () => {
      const testNames = ['getUserAgent', 'getPlatform', 'getLanguage', 'customMethod'];
      
      for (const name of testNames) {
        const originalFn = createNativeFunction(name, 0);
        
        const wrapped = NativeWrapper.wrap(
          originalFn,
          (original, args) => 'result',
          { name }
        );
        
        expect(wrapped.name).toBe(name);
        expect(wrapped.toString()).toBe(`function ${name}() { [native code] }`);
      }
    });
    
    test('wrapped function length matches original', () => {
      const testLengths = [0, 1, 2, 3, 5];
      
      for (const length of testLengths) {
        const originalFn = createNativeFunction('testFn', length);
        
        const wrapped = NativeWrapper.wrap(
          originalFn,
          (original, args) => 'result',
          { name: 'testFn', length }
        );
        
        expect(wrapped.length).toBe(length);
      }
    });
    
    test('wrapped function property descriptors match native', () => {
      const originalFn = createNativeFunction('nativeTest', 1);
      
      const wrapped = NativeWrapper.wrap(
        originalFn,
        (original, args) => 'result',
        { name: 'nativeTest', length: 1 }
      );
      
      const results = detectFunctionPropertyTampering(wrapped, 'nativeTest', 1);
      
      expect(results.passed).toBe(true);
    });
  });
  
  describe('Navigator Getter toString Detection', () => {
    
    test('spoofed navigator getters appear native', () => {
      const navigator = createMockNavigator();
      
      NavigatorSpoof.apply(navigator, {
        userAgent: 'Test UA',
        platform: 'Win32',
        vendor: 'Google Inc.',
        language: 'en-US',
        languages: ['en-US']
      });
      
      const proto = Object.getPrototypeOf(navigator);
      const propertiesToCheck = ['userAgent', 'platform', 'vendor', 'language'];
      
      for (const prop of propertiesToCheck) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
        const results = detectNativeGetter(descriptor, prop);
        
        expect(results.passed).toBe(true);
      }
    });
    
    test('getter toString contains [native code]', () => {
      const navigator = createMockNavigator();
      
      NavigatorSpoof.apply(navigator, {
        userAgent: 'Test',
        platform: 'Win32',
        language: 'en-US',
        languages: ['en-US']
      });
      
      const proto = Object.getPrototypeOf(navigator);
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'userAgent');
      
      expect(descriptor.get.toString()).toContain('[native code]');
    });
    
    test('getter name follows "get propertyName" format', () => {
      const navigator = createMockNavigator();
      
      NavigatorSpoof.apply(navigator, {
        userAgent: 'Test',
        platform: 'Win32',
        language: 'en-US',
        languages: ['en-US']
      });
      
      const proto = Object.getPrototypeOf(navigator);
      const properties = ['userAgent', 'platform', 'language'];
      
      for (const prop of properties) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
        expect(descriptor.get.name).toBe(`get ${prop}`);
      }
    });
  });
  
  describe('toSource Detection (Firefox)', () => {
    
    test('wrapped function toSource returns native code', () => {
      const originalFn = createNativeFunction('testFn', 0);
      
      const wrapped = NativeWrapper.wrap(
        originalFn,
        (original, args) => 'result',
        { name: 'testFn' }
      );
      
      // toSource should also return native code format
      if (typeof wrapped.toSource === 'function') {
        expect(wrapped.toSource()).toContain('[native code]');
      }
    });
  });
  
  describe('createConstantFunction Detection', () => {
    
    test('constant function appears native', () => {
      const fn = NativeWrapper.createConstantFunction('getValue', 42, 0);
      
      expect(fn()).toBe(42);
      expect(fn.name).toBe('getValue');
      expect(fn.length).toBe(0);
      expect(fn.toString()).toContain('[native code]');
    });
    
    test('constant function with different return types', () => {
      const testCases = [
        { name: 'getString', value: 'test string', length: 0 },
        { name: 'getNumber', value: 123, length: 0 },
        { name: 'getBoolean', value: true, length: 0 },
        { name: 'getNull', value: null, length: 0 },
        { name: 'getArray', value: [1, 2, 3], length: 0 },
        { name: 'getObject', value: { key: 'value' }, length: 0 }
      ];
      
      for (const testCase of testCases) {
        const fn = NativeWrapper.createConstantFunction(
          testCase.name,
          testCase.value,
          testCase.length
        );
        
        expect(fn()).toEqual(testCase.value);
        expect(fn.name).toBe(testCase.name);
        expect(fn.toString()).toContain('[native code]');
      }
    });
  });
  
  describe('verifyNativeCharacteristics', () => {
    
    test('verification passes for properly wrapped functions', () => {
      const originalFn = createNativeFunction('verifyTest', 2);
      
      const wrapped = NativeWrapper.wrap(
        originalFn,
        (original, args) => 'result',
        { name: 'verifyTest', length: 2 }
      );
      
      const verification = NativeWrapper.verifyNativeCharacteristics(wrapped, 'verifyTest');
      
      expect(verification.valid).toBe(true);
      expect(verification.checks.name.pass).toBe(true);
      expect(verification.checks.toString.pass).toBe(true);
      expect(verification.checks.nameDescriptor.pass).toBe(true);
      expect(verification.checks.lengthDescriptor.pass).toBe(true);
    });
    
    test('verification fails for non-native functions', () => {
      const regularFn = function testFn() { return 'not native'; };
      
      const verification = NativeWrapper.verifyNativeCharacteristics(regularFn, 'testFn');
      
      // Regular functions don't have [native code] in toString
      expect(verification.checks.toString.pass).toBe(false);
    });
  });
  
  describe('Edge Cases', () => {
    
    test('empty function name handling', () => {
      const originalFn = function() { return 'anonymous'; };
      
      const wrapped = NativeWrapper.wrap(
        originalFn,
        (original, args) => 'result',
        { name: '', length: 0 }
      );
      
      expect(wrapped.name).toBe('');
      expect(wrapped.toString()).toBe('function () { [native code] }');
    });
    
    test('special characters in function name', () => {
      // Note: Only valid JavaScript identifier names should be used
      const validNames = ['$test', '_private', 'camelCase', 'PascalCase'];
      
      for (const name of validNames) {
        const originalFn = createNativeFunction(name, 0);
        
        const wrapped = NativeWrapper.wrap(
          originalFn,
          (original, args) => 'result',
          { name }
        );
        
        expect(wrapped.name).toBe(name);
        expect(wrapped.toString()).toBe(`function ${name}() { [native code] }`);
      }
    });
    
    test('multiple wrapping maintains native appearance', () => {
      const originalFn = createNativeFunction('multiWrap', 0);
      
      // First wrap
      const wrapped1 = NativeWrapper.wrap(
        originalFn,
        (original, args) => 'first',
        { name: 'multiWrap' }
      );
      
      // Second wrap (wrapping the wrapped function)
      const wrapped2 = NativeWrapper.wrap(
        wrapped1,
        (original, args) => 'second',
        { name: 'multiWrap' }
      );
      
      // Both should appear native
      expect(wrapped1.toString()).toContain('[native code]');
      expect(wrapped2.toString()).toContain('[native code]');
    });
  });
});

