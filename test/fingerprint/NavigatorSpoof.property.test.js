'use strict';

/**
 * Property-based tests for NavigatorSpoof
 * 
 * Tests the following property:
 * - Property 9: Navigator属性注入正确性 (Navigator Property Injection Correctness)
 * 
 * **Feature: professional-fingerprint-refactoring, Property 9: Navigator属性注入正确性**
 * **Validates: Requirements 3.1**
 */

const fc = require('fast-check');
const { NavigatorSpoof } = require('../../src/infrastructure/fingerprint/injection-scripts/navigator');

// ==================== Arbitraries ====================

const userAgentArbitrary = fc.oneof(
  fc.constant('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
  fc.constant('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
  fc.constant('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
  fc.constant('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0')
);

const platformArbitrary = fc.oneof(
  fc.constant('Win32'),
  fc.constant('MacIntel'),
  fc.constant('Linux x86_64')
);

const vendorArbitrary = fc.oneof(
  fc.constant('Google Inc.'),
  fc.constant('Apple Computer, Inc.'),
  fc.constant('')
);

const languageArbitrary = fc.oneof(
  fc.constant('en-US'),
  fc.constant('en-GB'),
  fc.constant('zh-CN'),
  fc.constant('ja-JP')
);

const languagesArbitrary = fc.array(languageArbitrary, { minLength: 1, maxLength: 3 })
  .map(langs => [...new Set(langs)]);

const hardwareConcurrencyArbitrary = fc.integer({ min: 2, max: 32 });


const deviceMemoryArbitrary = fc.oneof(
  fc.constant(0.25),
  fc.constant(0.5),
  fc.constant(1),
  fc.constant(2),
  fc.constant(4),
  fc.constant(8)
);

const maxTouchPointsArbitrary = fc.integer({ min: 0, max: 10 });

const navigatorConfigArbitrary = fc.record({
  userAgent: userAgentArbitrary,
  platform: platformArbitrary,
  vendor: vendorArbitrary,
  language: languageArbitrary,
  languages: languagesArbitrary,
  hardwareConcurrency: hardwareConcurrencyArbitrary,
  deviceMemory: deviceMemoryArbitrary,
  maxTouchPoints: maxTouchPointsArbitrary,
  webdriver: fc.boolean(),
  product: fc.constant('Gecko'),
  productSub: fc.constant('20030107'),
  appName: fc.constant('Netscape'),
  appCodeName: fc.constant('Mozilla')
});

// ==================== Mock Navigator ====================

function createMockNavigator() {
  const navigatorProto = {};
  const defaultProps = {
    userAgent: 'Mozilla/5.0 (Original)',
    appVersion: '5.0 (Original)',
    platform: 'Original',
    vendor: 'Original Vendor',
    product: 'Gecko',
    productSub: '20030107',
    appName: 'Netscape',
    appCodeName: 'Mozilla',
    language: 'en',
    languages: Object.freeze(['en']),
    hardwareConcurrency: 4,
    deviceMemory: 4,
    maxTouchPoints: 0,
    webdriver: true,
    doNotTrack: null,
    globalPrivacyControl: false
  };

  for (const [key, value] of Object.entries(defaultProps)) {
    Object.defineProperty(navigatorProto, key, {
      get: function() { return value; },
      enumerable: true,
      configurable: true
    });
  }

  return Object.create(navigatorProto);
}


// ==================== Property Tests ====================

describe('NavigatorSpoof Property Tests', () => {
  /**
   * **Feature: professional-fingerprint-refactoring, Property 9: Navigator属性注入正确性**
   * **Validates: Requirements 3.1**
   */
  describe('Property 9: Navigator Property Injection Correctness', () => {
    
    test('should return configured userAgent after injection for any valid config', async () => {
      await fc.assert(
        fc.asyncProperty(
          navigatorConfigArbitrary,
          async (config) => {
            const mockNavigator = createMockNavigator();
            const result = NavigatorSpoof.apply(mockNavigator, config);
            
            expect(result.success).toBe(true);
            expect(result.spoofed).toContain('userAgent');
            expect(mockNavigator.userAgent).toBe(config.userAgent);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return configured platform after injection for any valid config', async () => {
      await fc.assert(
        fc.asyncProperty(
          navigatorConfigArbitrary,
          async (config) => {
            const mockNavigator = createMockNavigator();
            NavigatorSpoof.apply(mockNavigator, config);
            expect(mockNavigator.platform).toBe(config.platform);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return configured vendor after injection for any valid config', async () => {
      await fc.assert(
        fc.asyncProperty(
          navigatorConfigArbitrary,
          async (config) => {
            const mockNavigator = createMockNavigator();
            NavigatorSpoof.apply(mockNavigator, config);
            expect(mockNavigator.vendor).toBe(config.vendor);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return configured language after injection for any valid config', async () => {
      await fc.assert(
        fc.asyncProperty(
          navigatorConfigArbitrary,
          async (config) => {
            const mockNavigator = createMockNavigator();
            NavigatorSpoof.apply(mockNavigator, config);
            expect(mockNavigator.language).toBe(config.language);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return configured languages array after injection for any valid config', async () => {
      await fc.assert(
        fc.asyncProperty(
          navigatorConfigArbitrary,
          async (config) => {
            const mockNavigator = createMockNavigator();
            NavigatorSpoof.apply(mockNavigator, config);
            
            expect(Array.isArray(mockNavigator.languages)).toBe(true);
            expect([...mockNavigator.languages]).toEqual(config.languages);
            expect(Object.isFrozen(mockNavigator.languages)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return configured hardwareConcurrency after injection', async () => {
      await fc.assert(
        fc.asyncProperty(
          navigatorConfigArbitrary,
          async (config) => {
            const mockNavigator = createMockNavigator();
            NavigatorSpoof.apply(mockNavigator, config);
            expect(mockNavigator.hardwareConcurrency).toBe(config.hardwareConcurrency);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return configured deviceMemory after injection', async () => {
      await fc.assert(
        fc.asyncProperty(
          navigatorConfigArbitrary,
          async (config) => {
            const mockNavigator = createMockNavigator();
            NavigatorSpoof.apply(mockNavigator, config);
            expect(mockNavigator.deviceMemory).toBe(config.deviceMemory);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return configured webdriver value after injection', async () => {
      await fc.assert(
        fc.asyncProperty(
          navigatorConfigArbitrary,
          async (config) => {
            const mockNavigator = createMockNavigator();
            NavigatorSpoof.apply(mockNavigator, config);
            
            const expectedWebdriver = config.webdriver === true ? true : (config.webdriver === false ? false : undefined);
            expect(mockNavigator.webdriver).toBe(expectedWebdriver);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should verify all properties match configuration after injection', async () => {
      await fc.assert(
        fc.asyncProperty(
          navigatorConfigArbitrary,
          async (config) => {
            const mockNavigator = createMockNavigator();
            NavigatorSpoof.apply(mockNavigator, config);
            
            const verification = NavigatorSpoof.verify(mockNavigator, config);
            expect(verification.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Additional Navigator Spoofing Properties', () => {
    test('should maintain spoofed values across multiple accesses', async () => {
      await fc.assert(
        fc.asyncProperty(
          navigatorConfigArbitrary,
          fc.integer({ min: 2, max: 10 }),
          async (config, accessCount) => {
            const mockNavigator = createMockNavigator();
            NavigatorSpoof.apply(mockNavigator, config);
            
            for (let i = 0; i < accessCount; i++) {
              expect(mockNavigator.userAgent).toBe(config.userAgent);
              expect(mockNavigator.platform).toBe(config.platform);
              expect(mockNavigator.language).toBe(config.language);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should store applied configuration correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          navigatorConfigArbitrary,
          async (config) => {
            const mockNavigator = createMockNavigator();
            NavigatorSpoof.apply(mockNavigator, config);
            
            const appliedConfig = NavigatorSpoof.getAppliedConfig();
            expect(appliedConfig).not.toBeNull();
            expect(appliedConfig.userAgent).toBe(config.userAgent);
            expect(appliedConfig.platform).toBe(config.platform);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should generate valid injection script for any config', async () => {
      await fc.assert(
        fc.asyncProperty(
          navigatorConfigArbitrary,
          async (config) => {
            const script = NavigatorSpoof.generateInjectionScript(config);
            
            expect(typeof script).toBe('string');
            expect(script.length).toBeGreaterThan(0);
            expect(script).toContain(config.userAgent);
            expect(script).toContain(config.platform);
            expect(() => new Function(script)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Handling Properties', () => {
    test('should throw error for invalid navigator object', () => {
      const invalidInputs = [null, undefined, 'string', 123, true];
      
      for (const input of invalidInputs) {
        expect(() => NavigatorSpoof.apply(input, {})).toThrow();
      }
    });

    test('should handle missing config properties gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Use partial config without undefined values - just omit properties
          fc.record({
            language: languageArbitrary,
            hardwareConcurrency: hardwareConcurrencyArbitrary
          }),
          async (partialConfig) => {
            const mockNavigator = createMockNavigator();
            const result = NavigatorSpoof.apply(mockNavigator, partialConfig);
            
            // The apply method should always succeed
            expect(result.success).toBe(true);
            
            // The spoofed array should contain all properties (including those using defaults)
            expect(result.spoofed).toContain('userAgent');
            expect(result.spoofed).toContain('platform');
            expect(result.spoofed).toContain('language');
            expect(result.spoofed).toContain('hardwareConcurrency');
            
            // The applied config should have values for all properties
            const appliedConfig = NavigatorSpoof.getAppliedConfig();
            expect(appliedConfig.userAgent).toBeDefined();
            expect(appliedConfig.platform).toBeDefined();
            // Explicitly passed values should be used
            expect(appliedConfig.language).toBe(partialConfig.language);
            expect(appliedConfig.hardwareConcurrency).toBe(partialConfig.hardwareConcurrency);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
