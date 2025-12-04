'use strict';

/**
 * PixelScan-style Detection Tests
 * 
 * Implements detection tests similar to pixelscan.net to verify
 * that the fingerprint spoofing system properly masks browser characteristics.
 * 
 * PixelScan focuses on:
 * - Browser/OS consistency detection
 * - WebGL renderer consistency
 * - Chrome object presence for Chrome browsers
 * - Automation tool detection
 * - Property descriptor analysis
 * 
 * @module test/fingerprint/detection-tests/pixelscan
 * 
 * **Validates: Requirements 52.2**
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
 * Creates a mock window object for testing
 */
function createMockWindow() {
  return {
    navigator: createMockNavigator(),
    chrome: undefined,
    devicePixelRatio: 1
  };
}


/**
 * Simulates pixelscan-style browser consistency detection
 * Checks for inconsistencies between browser type and features
 */
function pixelscanBrowserConsistency(window) {
  const results = {
    passed: true,
    checks: [],
    score: 100
  };
  
  const navigator = window.navigator;
  const ua = navigator.userAgent || '';
  
  // Check 1: Chrome browser should have window.chrome object
  const isChrome = ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('OPR');
  if (isChrome) {
    const chromeCheck = {
      name: 'Chrome object presence',
      expected: 'window.chrome exists for Chrome browser',
      actual: window.chrome !== undefined,
      pass: window.chrome !== undefined
    };
    results.checks.push(chromeCheck);
    if (!chromeCheck.pass) {
      results.passed = false;
      results.score -= 20;
    }
  }
  
  // Check 2: Vendor should match browser
  const vendorCheck = {
    name: 'Vendor consistency',
    pass: true
  };
  
  if (isChrome && navigator.vendor !== 'Google Inc.') {
    vendorCheck.pass = false;
    vendorCheck.reason = 'Chrome browser should have Google Inc. vendor';
  } else if (ua.includes('Firefox') && navigator.vendor !== '') {
    vendorCheck.pass = false;
    vendorCheck.reason = 'Firefox should have empty vendor';
  }
  
  results.checks.push(vendorCheck);
  if (!vendorCheck.pass) {
    results.passed = false;
    results.score -= 15;
  }
  
  // Check 3: Platform should be consistent with OS in UA
  const platformCheck = {
    name: 'Platform/UA consistency',
    pass: true
  };
  
  if (ua.includes('Windows NT') && !['Win32', 'Win64'].includes(navigator.platform)) {
    platformCheck.pass = false;
    platformCheck.reason = 'Windows UA requires Win32/Win64 platform';
  } else if (ua.includes('Mac OS X') && navigator.platform !== 'MacIntel') {
    platformCheck.pass = false;
    platformCheck.reason = 'macOS UA requires MacIntel platform';
  } else if (ua.includes('Linux') && !navigator.platform.includes('Linux')) {
    platformCheck.pass = false;
    platformCheck.reason = 'Linux UA requires Linux platform';
  }
  
  results.checks.push(platformCheck);
  if (!platformCheck.pass) {
    results.passed = false;
    results.score -= 25;
  }
  
  // Check 4: devicePixelRatio should be reasonable
  const dprCheck = {
    name: 'devicePixelRatio range',
    expected: '0.5-4',
    actual: window.devicePixelRatio,
    pass: window.devicePixelRatio >= 0.5 && window.devicePixelRatio <= 4
  };
  results.checks.push(dprCheck);
  if (!dprCheck.pass) {
    results.passed = false;
    results.score -= 10;
  }
  
  return results;
}

/**
 * Simulates pixelscan-style automation detection
 */
function pixelscanAutomationDetection(window) {
  const results = {
    passed: true,
    checks: [],
    automationDetected: false
  };
  
  const navigator = window.navigator;
  
  // Check 1: webdriver property
  const webdriverCheck = {
    name: 'webdriver property',
    expected: 'false or undefined',
    actual: navigator.webdriver,
    pass: navigator.webdriver !== true
  };
  results.checks.push(webdriverCheck);
  if (!webdriverCheck.pass) {
    results.passed = false;
    results.automationDetected = true;
  }
  
  // Check 2: Check for automation-related properties
  const automationProps = [
    '__webdriver_script_fn',
    '__driver_evaluate',
    '__webdriver_evaluate',
    '__selenium_evaluate',
    '__fxdriver_evaluate',
    '__driver_unwrapped',
    '__webdriver_unwrapped',
    '__selenium_unwrapped',
    '__fxdriver_unwrapped',
    '_Selenium_IDE_Recorder',
    '_selenium',
    'calledSelenium',
    '$cdc_asdjflasutopfhvcZLmcfl_',
    '$chrome_asyncScriptInfo'
  ];
  
  for (const prop of automationProps) {
    if (window[prop] !== undefined || navigator[prop] !== undefined) {
      results.checks.push({
        name: `Automation property: ${prop}`,
        expected: 'undefined',
        actual: 'defined',
        pass: false
      });
      results.passed = false;
      results.automationDetected = true;
    }
  }
  
  // Check 3: document.documentElement attributes (if available)
  if (window.document && window.document.documentElement) {
    const docElement = window.document.documentElement;
    const seleniumAttrs = ['webdriver', 'selenium', 'driver'];
    
    for (const attr of seleniumAttrs) {
      if (docElement.getAttribute(attr)) {
        results.checks.push({
          name: `Document attribute: ${attr}`,
          expected: 'null',
          actual: docElement.getAttribute(attr),
          pass: false
        });
        results.passed = false;
        results.automationDetected = true;
      }
    }
  }
  
  return results;
}

/**
 * Simulates pixelscan-style property descriptor analysis
 * Note: After PrototypeGuard protection, properties may have enumerable: false
 * which is actually more native-like for protected properties
 */
function pixelscanDescriptorAnalysis(navigator) {
  const results = {
    passed: true,
    checks: []
  };
  
  const proto = Object.getPrototypeOf(navigator);
  const propertiesToCheck = ['userAgent', 'platform', 'vendor', 'language', 'webdriver'];
  
  for (const prop of propertiesToCheck) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
    
    if (descriptor) {
      // Check that getter exists and is a function
      const hasGetter = typeof descriptor.get === 'function';
      const getterCheck = {
        name: `${prop} has getter`,
        expected: true,
        actual: hasGetter,
        pass: hasGetter
      };
      results.checks.push(getterCheck);
      if (!getterCheck.pass) results.passed = false;
      
      // Check that property is configurable
      const configurableCheck = {
        name: `${prop} is configurable`,
        expected: true,
        actual: descriptor.configurable,
        pass: descriptor.configurable === true
      };
      results.checks.push(configurableCheck);
      if (!configurableCheck.pass) results.passed = false;
      
      // Note: enumerable can be true or false depending on protection level
      // Both are valid - native navigator properties are enumerable,
      // but protected properties may be non-enumerable for stealth
    }
  }
  
  return results;
}

// ==================== Test Suites ====================

describe('PixelScan Detection Tests', () => {
  
  /**
   * **Validates: Requirements 52.2**
   * 
   * Tests that spoofed properties pass pixelscan-style detection
   */
  describe('Browser Consistency Detection', () => {
    
    test('Chrome configuration passes consistency checks', () => {
      const window = createMockWindow();
      
      // Set up Chrome-like environment
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {}
      };
      
      NavigatorSpoof.apply(window.navigator, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: 'Win32',
        vendor: 'Google Inc.',
        language: 'en-US',
        languages: ['en-US', 'en'],
        hardwareConcurrency: 8,
        deviceMemory: 8,
        webdriver: false
      });
      
      const results = pixelscanBrowserConsistency(window);
      
      expect(results.passed).toBe(true);
      expect(results.score).toBeGreaterThanOrEqual(80);
    });
    
    test('Firefox configuration passes consistency checks', () => {
      const window = createMockWindow();
      window.chrome = undefined; // Firefox doesn't have chrome object
      
      NavigatorSpoof.apply(window.navigator, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        platform: 'Win32',
        vendor: '', // Firefox has empty vendor
        language: 'en-US',
        languages: ['en-US', 'en'],
        hardwareConcurrency: 8,
        deviceMemory: 8,
        webdriver: false
      });
      
      const results = pixelscanBrowserConsistency(window);
      
      expect(results.passed).toBe(true);
    });
    
    test('macOS Chrome configuration passes consistency checks', () => {
      const window = createMockWindow();
      window.chrome = { runtime: {} };
      
      NavigatorSpoof.apply(window.navigator, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: 'MacIntel',
        vendor: 'Google Inc.',
        language: 'en-US',
        languages: ['en-US', 'en'],
        hardwareConcurrency: 8,
        deviceMemory: 8,
        webdriver: false
      });
      
      const results = pixelscanBrowserConsistency(window);
      
      expect(results.passed).toBe(true);
    });
  });
  
  describe('Automation Detection', () => {
    
    test('clean window passes automation detection', () => {
      const window = createMockWindow();
      
      NavigatorSpoof.apply(window.navigator, {
        webdriver: false,
        language: 'en-US',
        languages: ['en-US']
      });
      
      const results = pixelscanAutomationDetection(window);
      
      expect(results.passed).toBe(true);
      expect(results.automationDetected).toBe(false);
    });
    
    test('webdriver=true fails automation detection', () => {
      const window = createMockWindow();
      
      NavigatorSpoof.apply(window.navigator, {
        webdriver: true, // This should fail
        language: 'en-US',
        languages: ['en-US']
      });
      
      const results = pixelscanAutomationDetection(window);
      
      expect(results.automationDetected).toBe(true);
    });
    
    test('selenium properties are not present', () => {
      const window = createMockWindow();
      
      // Ensure no selenium properties exist
      expect(window.__selenium_evaluate).toBeUndefined();
      expect(window._selenium).toBeUndefined();
      expect(window.calledSelenium).toBeUndefined();
      
      const results = pixelscanAutomationDetection(window);
      expect(results.passed).toBe(true);
    });
  });
  
  describe('Property Descriptor Analysis', () => {
    
    test('spoofed properties have correct descriptors', () => {
      const navigator = createMockNavigator();
      
      NavigatorSpoof.apply(navigator, {
        userAgent: 'Mozilla/5.0 Test',
        platform: 'Win32',
        vendor: 'Google Inc.',
        language: 'en-US',
        languages: ['en-US'],
        webdriver: false
      });
      
      const results = pixelscanDescriptorAnalysis(navigator);
      
      expect(results.passed).toBe(true);
      for (const check of results.checks) {
        expect(check.pass).toBe(true);
      }
    });
    
    test('property getters are functions', () => {
      const navigator = createMockNavigator();
      
      NavigatorSpoof.apply(navigator, {
        userAgent: 'Test UA',
        platform: 'Win32',
        language: 'en-US',
        languages: ['en-US'],
        webdriver: false
      });
      
      const proto = Object.getPrototypeOf(navigator);
      const properties = ['userAgent', 'platform', 'language'];
      
      for (const prop of properties) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
        expect(descriptor).toBeDefined();
        expect(typeof descriptor.get).toBe('function');
      }
    });
  });
  
  describe('Score-based Detection', () => {
    
    test('fully consistent configuration scores 100', () => {
      const window = createMockWindow();
      window.chrome = { runtime: {} };
      window.devicePixelRatio = 1;
      
      NavigatorSpoof.apply(window.navigator, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: 'Win32',
        vendor: 'Google Inc.',
        language: 'en-US',
        languages: ['en-US', 'en'],
        hardwareConcurrency: 8,
        deviceMemory: 8,
        webdriver: false
      });
      
      const results = pixelscanBrowserConsistency(window);
      
      expect(results.score).toBe(100);
    });
    
    test('devicePixelRatio in valid range', () => {
      const validDPRs = [1, 1.25, 1.5, 2, 2.5, 3];
      
      for (const dpr of validDPRs) {
        const window = createMockWindow();
        window.devicePixelRatio = dpr;
        window.chrome = { runtime: {} };
        
        NavigatorSpoof.apply(window.navigator, {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          platform: 'Win32',
          vendor: 'Google Inc.',
          language: 'en-US',
          languages: ['en-US'],
          webdriver: false
        });
        
        const results = pixelscanBrowserConsistency(window);
        
        const dprCheck = results.checks.find(c => c.name === 'devicePixelRatio range');
        expect(dprCheck.pass).toBe(true);
      }
    });
  });
});

