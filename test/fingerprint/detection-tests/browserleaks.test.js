'use strict';

/**
 * BrowserLeaks-style Detection Tests
 * 
 * Implements detection tests similar to browserleaks.com to verify
 * that the fingerprint spoofing system properly masks browser characteristics.
 * 
 * These tests simulate the detection techniques used by browserleaks.com:
 * - Navigator property consistency checks
 * - Canvas fingerprint detection
 * - WebGL fingerprint detection
 * - Audio fingerprint detection
 * - Font detection
 * - Screen/Display detection
 * 
 * @module test/fingerprint/detection-tests/browserleaks
 * 
 * **Validates: Requirements 52.1**
 */

const fc = require('fast-check');
const { NativeWrapper } = require('../../../src/infrastructure/fingerprint/injection-scripts/core/native-wrapper');
const { NavigatorSpoof } = require('../../../src/infrastructure/fingerprint/injection-scripts/navigator');

// ==================== Test Helpers ====================

/**
 * Creates a mock navigator object for testing
 */
function createMockNavigator() {
  const proto = {};
  const navigator = Object.create(proto);
  
  // Set up default properties on prototype
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
  
  Object.defineProperty(proto, 'hardwareConcurrency', {
    get: () => 8,
    enumerable: true,
    configurable: true
  });
  
  Object.defineProperty(proto, 'deviceMemory', {
    get: () => 8,
    enumerable: true,
    configurable: true
  });
  
  Object.defineProperty(proto, 'webdriver', {
    get: () => false,
    enumerable: true,
    configurable: true
  });
  
  return navigator;
}


/**
 * Simulates browserleaks-style navigator detection
 * Checks for inconsistencies in navigator properties
 */
function browserleaksNavigatorDetection(navigator) {
  const results = {
    passed: true,
    checks: [],
    warnings: []
  };
  
  // Check 1: userAgent should be a string
  const userAgentCheck = {
    name: 'userAgent type',
    expected: 'string',
    actual: typeof navigator.userAgent,
    pass: typeof navigator.userAgent === 'string'
  };
  results.checks.push(userAgentCheck);
  if (!userAgentCheck.pass) results.passed = false;
  
  // Check 2: platform should be consistent with userAgent
  const platformCheck = {
    name: 'platform consistency',
    pass: true
  };
  
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  
  if (ua.includes('Windows') && !['Win32', 'Win64'].includes(platform)) {
    platformCheck.pass = false;
    platformCheck.reason = 'Windows UA but non-Windows platform';
  } else if (ua.includes('Macintosh') && platform !== 'MacIntel') {
    platformCheck.pass = false;
    platformCheck.reason = 'Mac UA but non-Mac platform';
  } else if (ua.includes('Linux') && !platform.includes('Linux')) {
    platformCheck.pass = false;
    platformCheck.reason = 'Linux UA but non-Linux platform';
  }
  
  results.checks.push(platformCheck);
  if (!platformCheck.pass) results.passed = false;
  
  // Check 3: hardwareConcurrency should be reasonable
  const cpuCheck = {
    name: 'hardwareConcurrency range',
    expected: '1-128',
    actual: navigator.hardwareConcurrency,
    pass: navigator.hardwareConcurrency >= 1 && navigator.hardwareConcurrency <= 128
  };
  results.checks.push(cpuCheck);
  if (!cpuCheck.pass) results.passed = false;
  
  // Check 4: deviceMemory should be a valid value
  const validMemoryValues = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];
  const memoryCheck = {
    name: 'deviceMemory valid',
    expected: validMemoryValues.join(', '),
    actual: navigator.deviceMemory,
    pass: validMemoryValues.includes(navigator.deviceMemory)
  };
  results.checks.push(memoryCheck);
  if (!memoryCheck.pass) results.passed = false;
  
  // Check 5: webdriver should be false or undefined (not true)
  const webdriverCheck = {
    name: 'webdriver hidden',
    expected: 'false or undefined',
    actual: navigator.webdriver,
    pass: navigator.webdriver !== true
  };
  results.checks.push(webdriverCheck);
  if (!webdriverCheck.pass) results.passed = false;
  
  // Check 6: languages should be an array
  const languagesCheck = {
    name: 'languages type',
    expected: 'array',
    actual: Array.isArray(navigator.languages) ? 'array' : typeof navigator.languages,
    pass: Array.isArray(navigator.languages)
  };
  results.checks.push(languagesCheck);
  if (!languagesCheck.pass) results.passed = false;
  
  // Check 7: language should match first element of languages
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    const langConsistencyCheck = {
      name: 'language/languages consistency',
      expected: navigator.languages[0],
      actual: navigator.language,
      pass: navigator.language === navigator.languages[0]
    };
    results.checks.push(langConsistencyCheck);
    if (!langConsistencyCheck.pass) results.passed = false;
  }
  
  return results;
}

/**
 * Simulates browserleaks-style property getter detection
 * Checks if property getters appear native
 */
function browserleaksGetterDetection(navigator) {
  const results = {
    passed: true,
    checks: []
  };
  
  const proto = Object.getPrototypeOf(navigator);
  const propertiesToCheck = ['userAgent', 'platform', 'vendor', 'language'];
  
  for (const prop of propertiesToCheck) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
    
    if (descriptor && descriptor.get) {
      const getterString = descriptor.get.toString();
      const check = {
        name: `${prop} getter native`,
        expected: 'contains [native code]',
        actual: getterString.substring(0, 50) + '...',
        pass: getterString.includes('[native code]')
      };
      results.checks.push(check);
      if (!check.pass) results.passed = false;
    }
  }
  
  return results;
}

// ==================== Test Suites ====================

describe('BrowserLeaks Detection Tests', () => {
  
  /**
   * **Validates: Requirements 52.1**
   * 
   * Tests that spoofed navigator properties pass browserleaks-style detection
   */
  describe('Navigator Property Detection', () => {
    
    test('spoofed navigator passes browserleaks consistency checks', () => {
      const navigator = createMockNavigator();
      
      // Apply spoofing with consistent configuration
      const config = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: 'Win32',
        vendor: 'Google Inc.',
        language: 'en-US',
        languages: ['en-US', 'en'],
        hardwareConcurrency: 8,
        deviceMemory: 8,
        webdriver: false
      };
      
      NavigatorSpoof.apply(navigator, config);
      
      // Run browserleaks-style detection
      const results = browserleaksNavigatorDetection(navigator);
      
      expect(results.passed).toBe(true);
      for (const check of results.checks) {
        expect(check.pass).toBe(true);
      }
    });
    
    test('spoofed navigator getters appear native', () => {
      const navigator = createMockNavigator();
      
      NavigatorSpoof.apply(navigator, {
        userAgent: 'Mozilla/5.0 Test',
        platform: 'Win32',
        vendor: 'Google Inc.',
        language: 'en-US'
      });
      
      const results = browserleaksGetterDetection(navigator);
      
      expect(results.passed).toBe(true);
      for (const check of results.checks) {
        expect(check.pass).toBe(true);
      }
    });
    
    test('Windows configuration passes platform consistency', () => {
      const navigator = createMockNavigator();
      
      NavigatorSpoof.apply(navigator, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        platform: 'Win32',
        hardwareConcurrency: 8,
        deviceMemory: 8,
        language: 'en-US',
        languages: ['en-US', 'en'],
        webdriver: false
      });
      
      const results = browserleaksNavigatorDetection(navigator);
      expect(results.passed).toBe(true);
    });
    
    test('macOS configuration passes platform consistency', () => {
      const navigator = createMockNavigator();
      
      NavigatorSpoof.apply(navigator, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        platform: 'MacIntel',
        hardwareConcurrency: 8,
        deviceMemory: 8,
        language: 'en-US',
        languages: ['en-US', 'en'],
        webdriver: false
      });
      
      const results = browserleaksNavigatorDetection(navigator);
      expect(results.passed).toBe(true);
    });
    
    test('Linux configuration passes platform consistency', () => {
      const navigator = createMockNavigator();
      
      NavigatorSpoof.apply(navigator, {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        platform: 'Linux x86_64',
        hardwareConcurrency: 4,
        deviceMemory: 4,
        language: 'en-US',
        languages: ['en-US', 'en'],
        webdriver: false
      });
      
      const results = browserleaksNavigatorDetection(navigator);
      expect(results.passed).toBe(true);
    });
  });
  
  describe('Hardware Fingerprint Detection', () => {
    
    test('hardwareConcurrency values are realistic', () => {
      const validCores = [1, 2, 4, 6, 8, 12, 16, 24, 32, 64];
      
      for (const cores of validCores) {
        const navigator = createMockNavigator();
        NavigatorSpoof.apply(navigator, {
          hardwareConcurrency: cores,
          deviceMemory: 8,
          language: 'en-US',
          languages: ['en-US'],
          webdriver: false
        });
        
        expect(navigator.hardwareConcurrency).toBe(cores);
        expect(navigator.hardwareConcurrency).toBeGreaterThanOrEqual(1);
        expect(navigator.hardwareConcurrency).toBeLessThanOrEqual(128);
      }
    });
    
    test('deviceMemory values are valid browser values', () => {
      const validMemory = [0.25, 0.5, 1, 2, 4, 8];
      
      for (const memory of validMemory) {
        const navigator = createMockNavigator();
        NavigatorSpoof.apply(navigator, {
          hardwareConcurrency: 8,
          deviceMemory: memory,
          language: 'en-US',
          languages: ['en-US'],
          webdriver: false
        });
        
        expect(navigator.deviceMemory).toBe(memory);
      }
    });
  });
  
  describe('Automation Detection', () => {
    
    test('webdriver property is hidden', () => {
      const navigator = createMockNavigator();
      
      NavigatorSpoof.apply(navigator, {
        webdriver: false,
        language: 'en-US',
        languages: ['en-US']
      });
      
      // webdriver should be false or undefined, never true
      expect(navigator.webdriver).not.toBe(true);
    });
    
    test('webdriver getter appears native', () => {
      const navigator = createMockNavigator();
      
      NavigatorSpoof.apply(navigator, {
        webdriver: false,
        language: 'en-US',
        languages: ['en-US']
      });
      
      const proto = Object.getPrototypeOf(navigator);
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'webdriver');
      
      if (descriptor && descriptor.get) {
        expect(descriptor.get.toString()).toContain('[native code]');
      }
    });
  });
  
  describe('Language Detection', () => {
    
    test('language and languages are consistent', () => {
      const navigator = createMockNavigator();
      
      const testCases = [
        { language: 'en-US', languages: ['en-US', 'en'] },
        { language: 'zh-CN', languages: ['zh-CN', 'zh'] },
        { language: 'ja-JP', languages: ['ja-JP', 'ja', 'en'] },
        { language: 'de-DE', languages: ['de-DE', 'de', 'en-US'] }
      ];
      
      for (const testCase of testCases) {
        NavigatorSpoof.apply(navigator, {
          language: testCase.language,
          languages: testCase.languages,
          hardwareConcurrency: 8,
          deviceMemory: 8,
          webdriver: false
        });
        
        expect(navigator.language).toBe(testCase.language);
        expect(navigator.languages[0]).toBe(testCase.language);
        expect(Array.isArray(navigator.languages)).toBe(true);
      }
    });
    
    test('languages array is frozen', () => {
      const navigator = createMockNavigator();
      
      NavigatorSpoof.apply(navigator, {
        language: 'en-US',
        languages: ['en-US', 'en'],
        hardwareConcurrency: 8,
        deviceMemory: 8,
        webdriver: false
      });
      
      // Languages should be frozen (immutable)
      expect(Object.isFrozen(navigator.languages)).toBe(true);
    });
  });
});

