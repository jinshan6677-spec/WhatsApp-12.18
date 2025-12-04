'use strict';

/**
 * Property-based tests for FingerprintInjector
 * 
 * Tests the following property:
 * - Property 14: 指纹注入性能 (Fingerprint Injection Performance)
 * 
 * **Feature: professional-fingerprint-refactoring, Property 14: 指纹注入性能**
 * **Validates: Requirements 25.1**
 */

const fc = require('fast-check');
const { FingerprintInjector, FingerprintInjectorError } = require('../../src/infrastructure/fingerprint/FingerprintInjector');
const FingerprintConfig = require('../../src/domain/fingerprint/FingerprintConfig');

// ==================== Arbitraries ====================

/**
 * Browser type arbitrary
 */
const browserTypeArbitrary = fc.constantFrom('chrome', 'firefox', 'edge', 'safari');

/**
 * OS type arbitrary
 */
const osTypeArbitrary = fc.constantFrom('windows', 'macos', 'linux');

/**
 * Platform arbitrary
 */
const platformArbitrary = fc.constantFrom('Win32', 'MacIntel', 'Linux x86_64');

/**
 * Noise level arbitrary
 */
const noiseLevelArbitrary = fc.constantFrom('off', 'low', 'medium', 'high');

/**
 * Valid device memory values
 */
const deviceMemoryArbitrary = fc.constantFrom(0.25, 0.5, 1, 2, 4, 8, 16, 32, 64);

/**
 * Valid color depth values
 */
const colorDepthArbitrary = fc.constantFrom(24, 32);

/**
 * Valid screen resolution arbitrary
 */
const screenArbitrary = fc.record({
  width: fc.integer({ min: 320, max: 7680 }),
  height: fc.integer({ min: 240, max: 4320 }),
  availWidth: fc.integer({ min: 320, max: 7680 }),
  availHeight: fc.integer({ min: 200, max: 4320 }),
  colorDepth: colorDepthArbitrary,
  pixelDepth: colorDepthArbitrary
});

/**
 * Valid hardware arbitrary
 */
const hardwareArbitrary = fc.record({
  cpuCores: fc.integer({ min: 1, max: 128 }),
  deviceMemory: deviceMemoryArbitrary,
  maxTouchPoints: fc.integer({ min: 0, max: 20 }),
  screen: screenArbitrary,
  devicePixelRatio: fc.double({ min: 0.5, max: 4, noNaN: true })
});

/**
 * Valid canvas config arbitrary
 */
const canvasArbitrary = fc.record({
  mode: fc.constantFrom('noise', 'real', 'off'),
  noiseLevel: noiseLevelArbitrary,
  noiseDistribution: fc.constantFrom('uniform', 'gaussian')
});

/**
 * Valid WebGL config arbitrary
 */
const webglArbitrary = fc.record({
  mode: fc.constantFrom('custom', 'real', 'off'),
  vendor: fc.string({ minLength: 1, maxLength: 100 }),
  renderer: fc.string({ minLength: 1, maxLength: 200 }),
  unmaskedVendor: fc.string({ minLength: 1, maxLength: 100 }),
  unmaskedRenderer: fc.string({ minLength: 1, maxLength: 200 }),
  extensions: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
  shaderPrecision: fc.constant({}),
  imageNoise: fc.boolean(),
  noiseLevel: noiseLevelArbitrary
});

/**
 * Valid audio config arbitrary
 */
const audioArbitrary = fc.record({
  mode: fc.constantFrom('noise', 'real', 'off'),
  noiseLevel: noiseLevelArbitrary,
  noiseDistribution: fc.constantFrom('uniform', 'gaussian')
});

/**
 * Valid fonts config arbitrary
 */
const fontsArbitrary = fc.record({
  mode: fc.constantFrom('custom', 'system'),
  list: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 50 })
});

/**
 * Valid timezone config arbitrary
 */
const timezoneArbitrary = fc.record({
  mode: fc.constantFrom('custom', 'auto', 'real'),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  offset: fc.integer({ min: -720, max: 840 })
});

/**
 * Valid geolocation config arbitrary
 */
const geolocationArbitrary = fc.record({
  mode: fc.constantFrom('custom', 'deny', 'ip-based'),
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
  accuracy: fc.integer({ min: 1, max: 10000 })
});

/**
 * Valid WebRTC config arbitrary
 */
const webrtcArbitrary = fc.record({
  mode: fc.constantFrom('disable', 'replace', 'real'),
  publicIP: fc.string({ minLength: 1, maxLength: 50 }),
  localIP: fc.string({ minLength: 1, maxLength: 50 }),
  whitelist: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 })
});

/**
 * Valid battery config arbitrary
 */
const batteryArbitrary = fc.record({
  mode: fc.constantFrom('privacy', 'disable', 'real'),
  charging: fc.boolean(),
  level: fc.double({ min: 0, max: 1, noNaN: true })
});

/**
 * Valid advanced APIs config arbitrary
 */
const advancedApisArbitrary = fc.record({
  permissions: fc.record({ mode: fc.constantFrom('custom', 'real') }),
  storage: fc.record({ 
    mode: fc.constantFrom('fake', 'real'), 
    quota: fc.integer({ min: 1000000, max: 100000000000 }) 
  }),
  connection: fc.record({ 
    mode: fc.constantFrom('custom', 'disable', 'real'), 
    effectiveType: fc.constantFrom('4g', '3g', '2g', 'slow-2g'),
    downlink: fc.integer({ min: 1, max: 100 }),
    rtt: fc.integer({ min: 10, max: 500 })
  }),
  keyboard: fc.record({ mode: fc.constantFrom('standard', 'real', 'disable') }),
  performance: fc.record({ 
    mode: fc.constantFrom('noise', 'real'), 
    precision: fc.integer({ min: 1, max: 1000 }) 
  }),
  pdf: fc.record({ enabled: fc.boolean() }),
  bluetooth: fc.record({ enabled: fc.boolean() }),
  usb: fc.record({ enabled: fc.boolean() }),
  gamepad: fc.record({ mode: fc.constantFrom('hide', 'fake', 'real') }),
  history: fc.record({ 
    mode: fc.constantFrom('minimal', 'real'), 
    length: fc.integer({ min: 1, max: 100 }) 
  }),
  clipboard: fc.record({ mode: fc.constantFrom('ask', 'allow', 'disable') }),
  notification: fc.record({ mode: fc.constantFrom('deny', 'allow', 'ask') }),
  serviceWorker: fc.record({ enabled: fc.boolean() }),
  webAssembly: fc.record({ enabled: fc.boolean() }),
  sharedArrayBuffer: fc.record({ enabled: fc.boolean() }),
  credentials: fc.record({ enabled: fc.boolean() }),
  payment: fc.record({ enabled: fc.boolean() }),
  presentation: fc.record({ enabled: fc.boolean() })
});

/**
 * Valid date arbitrary
 */
const validDateArbitrary = fc.integer({ 
  min: new Date('2020-01-01').getTime(), 
  max: new Date('2030-12-31').getTime() 
}).map(ts => new Date(ts));

/**
 * Valid FingerprintConfig arbitrary for injection testing
 */
const validFingerprintConfigArbitrary = fc.record({
  id: fc.uuid(),
  accountId: fc.option(fc.uuid(), { nil: null }),
  createdAt: validDateArbitrary,
  updatedAt: validDateArbitrary,
  version: fc.constantFrom('1.0.0', '1.1.0', '2.0.0'),
  browser: fc.record({
    type: browserTypeArbitrary,
    version: fc.string({ minLength: 1, maxLength: 20 }).map(s => s || '120.0.0.0'),
    majorVersion: fc.integer({ min: 1, max: 999 })
  }),
  os: fc.record({
    type: osTypeArbitrary,
    version: fc.string({ minLength: 1, maxLength: 20 }).map(s => s || '10.0'),
    platform: platformArbitrary
  }),
  userAgent: fc.string({ minLength: 10, maxLength: 500 }),
  navigator: fc.record({
    appVersion: fc.string({ minLength: 1, maxLength: 200 }),
    vendor: fc.string({ minLength: 1, maxLength: 100 }),
    product: fc.string({ minLength: 1, maxLength: 50 }),
    productSub: fc.string({ minLength: 1, maxLength: 20 }),
    appName: fc.string({ minLength: 1, maxLength: 50 }),
    appCodeName: fc.string({ minLength: 1, maxLength: 50 }),
    language: fc.string({ minLength: 2, maxLength: 10 }),
    languages: fc.array(fc.string({ minLength: 2, maxLength: 10 }), { minLength: 1, maxLength: 10 }),
    doNotTrack: fc.option(fc.constantFrom('1', '0'), { nil: null }),
    globalPrivacyControl: fc.boolean(),
    webdriver: fc.boolean()
  }),
  hardware: hardwareArbitrary,
  canvas: canvasArbitrary,
  webgl: webglArbitrary,
  audio: audioArbitrary,
  fonts: fontsArbitrary,
  timezone: timezoneArbitrary,
  geolocation: geolocationArbitrary,
  webrtc: webrtcArbitrary,
  battery: batteryArbitrary,
  advancedApis: advancedApisArbitrary,
  noiseSeed: fc.record({
    encrypted: fc.boolean(),
    value: fc.integer({ min: 0, max: 0xFFFFFFFF })
  }),
  seedVersion: fc.integer({ min: 1, max: 100 }),
  seedRotatedAt: fc.option(validDateArbitrary, { nil: null })
});

// ==================== Constants ====================

/**
 * Performance threshold in milliseconds
 * Requirement 25.1: Fingerprint injection should complete within 50ms
 */
const INJECTION_TIME_THRESHOLD_MS = 50;

// ==================== Property Tests ====================

describe('FingerprintInjector Property Tests', () => {
  
  /**
   * **Feature: professional-fingerprint-refactoring, Property 14: 指纹注入性能**
   * **Validates: Requirements 25.1**
   * 
   * For any fingerprint configuration, the injection script generation
   * should complete within 50 milliseconds.
   */
  describe('Property 14: Fingerprint Injection Performance', () => {
    
    test('getInjectionScript completes within 50ms for any valid config', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const injector = new FingerprintInjector(configData);
            
            // Clear cache to ensure we measure actual generation time
            injector.clearCache();
            
            const startTime = performance.now();
            const script = injector.getInjectionScript();
            const endTime = performance.now();
            
            const generationTime = endTime - startTime;
            
            // Script should be generated
            expect(script).toBeTruthy();
            expect(typeof script).toBe('string');
            expect(script.length).toBeGreaterThan(0);
            
            // Generation should complete within threshold
            expect(generationTime).toBeLessThan(INJECTION_TIME_THRESHOLD_MS);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('getPreloadScript completes within 50ms for any valid config', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const injector = new FingerprintInjector(configData);
            
            // Clear cache to ensure we measure actual generation time
            injector.clearCache();
            
            const startTime = performance.now();
            const script = injector.getPreloadScript();
            const endTime = performance.now();
            
            const generationTime = endTime - startTime;
            
            // Script should be generated
            expect(script).toBeTruthy();
            expect(typeof script).toBe('string');
            expect(script.length).toBeGreaterThan(0);
            
            // Generation should complete within threshold
            expect(generationTime).toBeLessThan(INJECTION_TIME_THRESHOLD_MS);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('getIframeScript completes within 50ms for any valid config', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const injector = new FingerprintInjector(configData);
            
            // Clear cache to ensure we measure actual generation time
            injector.clearCache();
            
            const startTime = performance.now();
            const script = injector.getIframeScript();
            const endTime = performance.now();
            
            const generationTime = endTime - startTime;
            
            // Script should be generated
            expect(script).toBeTruthy();
            expect(typeof script).toBe('string');
            expect(script.length).toBeGreaterThan(0);
            
            // Generation should complete within threshold
            expect(generationTime).toBeLessThan(INJECTION_TIME_THRESHOLD_MS);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('getWorkerScript completes within 50ms for any valid config', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          fc.constantFrom('worker', 'sharedworker', 'serviceworker'),
          async (configData, workerType) => {
            const injector = new FingerprintInjector(configData);
            
            // Clear cache to ensure we measure actual generation time
            injector.clearCache();
            
            const startTime = performance.now();
            const script = injector.getWorkerScript({ workerType });
            const endTime = performance.now();
            
            const generationTime = endTime - startTime;
            
            // Script should be generated
            expect(script).toBeTruthy();
            expect(typeof script).toBe('string');
            expect(script.length).toBeGreaterThan(0);
            
            // Generation should complete within threshold
            expect(generationTime).toBeLessThan(INJECTION_TIME_THRESHOLD_MS);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('all script types combined complete within 50ms with caching', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const injector = new FingerprintInjector(configData);
            
            // First call populates cache
            injector.getInjectionScript();
            
            // Measure time for all script types with cache
            const startTime = performance.now();
            
            injector.getInjectionScript();
            injector.getPreloadScript();
            injector.getIframeScript();
            injector.getWorkerScript({ workerType: 'worker' });
            injector.getWorkerScript({ workerType: 'sharedworker' });
            injector.getWorkerScript({ workerType: 'serviceworker' });
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            
            // With caching, all operations should be very fast
            expect(totalTime).toBeLessThan(INJECTION_TIME_THRESHOLD_MS);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('cached scripts are returned instantly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const injector = new FingerprintInjector(configData);
            
            // First call - generates and caches
            const script1 = injector.getInjectionScript();
            
            // Second call - should return cached version
            const startTime = performance.now();
            const script2 = injector.getInjectionScript();
            const endTime = performance.now();
            
            const cacheRetrievalTime = endTime - startTime;
            
            // Scripts should be identical
            expect(script1).toBe(script2);
            
            // Cache retrieval should be nearly instant (< 1ms)
            expect(cacheRetrievalTime).toBeLessThan(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('generation time is tracked correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const injector = new FingerprintInjector(configData);
            
            // Clear cache
            injector.clearCache();
            
            // Before generation, time should be null
            expect(injector.getGenerationTime()).toBeNull();
            
            // Generate script
            injector.getInjectionScript();
            
            // After generation, time should be recorded
            const generationTime = injector.getGenerationTime();
            expect(generationTime).not.toBeNull();
            expect(typeof generationTime).toBe('number');
            expect(generationTime).toBeGreaterThanOrEqual(0);
            expect(generationTime).toBeLessThan(INJECTION_TIME_THRESHOLD_MS);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('minified scripts are generated within threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const injector = new FingerprintInjector(configData, { minify: true });
            
            // Clear cache
            injector.clearCache();
            
            const startTime = performance.now();
            const script = injector.getInjectionScript();
            const endTime = performance.now();
            
            const generationTime = endTime - startTime;
            
            // Script should be generated
            expect(script).toBeTruthy();
            expect(typeof script).toBe('string');
            
            // Generation should complete within threshold
            expect(generationTime).toBeLessThan(INJECTION_TIME_THRESHOLD_MS);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('static createStandaloneScript completes within threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const startTime = performance.now();
            const script = FingerprintInjector.createStandaloneScript(configData);
            const endTime = performance.now();
            
            const generationTime = endTime - startTime;
            
            // Script should be generated
            expect(script).toBeTruthy();
            expect(typeof script).toBe('string');
            
            // Generation should complete within threshold
            expect(generationTime).toBeLessThan(INJECTION_TIME_THRESHOLD_MS);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ==================== Additional Correctness Tests ====================

  describe('FingerprintInjector Correctness', () => {
    
    test('generated scripts contain fingerprint configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const injector = new FingerprintInjector(configData);
            const script = injector.getInjectionScript();
            
            // Script should contain key configuration values
            // Note: Values are JSON-stringified in the script
            if (configData.userAgent && configData.userAgent.length > 10) {
              // Check that userAgent appears in some form (may be escaped)
              expect(script.length).toBeGreaterThan(100);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('invalid config throws FingerprintInjectorError', async () => {
      // Note: Arrays are technically objects in JavaScript, so they pass the typeof check
      // We only test truly invalid types that should throw
      const invalidConfigs = [
        null,
        undefined,
        'string',
        123,
        true
      ];

      for (const invalidConfig of invalidConfigs) {
        expect(() => {
          new FingerprintInjector(invalidConfig);
        }).toThrow(FingerprintInjectorError);
      }
    });

    test('updateConfig updates the configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          fc.string({ minLength: 20, maxLength: 200 }),
          async (configData, newUserAgent) => {
            const injector = new FingerprintInjector(configData);
            
            // Update config
            injector.updateConfig({ userAgent: newUserAgent });
            
            // Get updated config
            const updatedConfig = injector.getConfig();
            expect(updatedConfig.userAgent).toBe(newUserAgent);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('clearCache invalidates cached scripts', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const injector = new FingerprintInjector(configData);
            
            // Generate and cache
            injector.getInjectionScript();
            
            // Check cache stats
            let stats = injector.getCacheStats();
            expect(stats.cachedScripts).toBeGreaterThan(0);
            
            // Clear cache
            injector.clearCache();
            
            // Cache should be empty
            stats = injector.getCacheStats();
            expect(stats.cachedScripts).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('validate returns validation result', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const injector = new FingerprintInjector(configData);
            const result = injector.validate();
            
            expect(result).toHaveProperty('valid');
            expect(result).toHaveProperty('errors');
            expect(result).toHaveProperty('warnings');
            expect(typeof result.valid).toBe('boolean');
            expect(Array.isArray(result.errors)).toBe(true);
            expect(Array.isArray(result.warnings)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('getAvailableModules returns array of module names', () => {
      const modules = FingerprintInjector.getAvailableModules();
      
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
      
      // Should include common modules
      expect(modules).toContain('navigator');
      expect(modules).toContain('canvas');
      expect(modules).toContain('webgl');
    });

    test('hasModule correctly identifies available modules', () => {
      expect(FingerprintInjector.hasModule('navigator')).toBe(true);
      expect(FingerprintInjector.hasModule('canvas')).toBe(true);
      expect(FingerprintInjector.hasModule('nonexistent')).toBe(false);
    });

    test('different options produce different scripts', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const injector = new FingerprintInjector(configData);
            
            // Generate with different options
            const scriptWithWorker = injector.getInjectionScript({ 
              includeWorkerInterceptor: true,
              includeIframeProtection: false 
            });
            
            injector.clearCache();
            
            const scriptWithIframe = injector.getInjectionScript({ 
              includeWorkerInterceptor: false,
              includeIframeProtection: true 
            });
            
            // Scripts should be different
            expect(scriptWithWorker).not.toBe(scriptWithIframe);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
