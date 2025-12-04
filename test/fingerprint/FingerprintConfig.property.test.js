'use strict';

/**
 * Property-based tests for FingerprintConfig
 * 
 * Tests the following properties:
 * - Property 1: 指纹配置序列化往返一致性 (Serialization Round-Trip Consistency)
 * - Property 3: 无效配置拒绝 (Invalid Configuration Rejection)
 * 
 * **Validates: Requirements 2.5, 2.7**
 */

const fc = require('fast-check');
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
 * Platform arbitrary based on OS
 */
const platformArbitrary = fc.constantFrom('Win32', 'MacIntel', 'Linux x86_64', 'Linux armv7l', 'Linux aarch64');

/**
 * Noise level arbitrary
 */
const noiseLevelArbitrary = fc.constantFrom('off', 'low', 'medium', 'high');

/**
 * Noise distribution arbitrary
 */
const noiseDistributionArbitrary = fc.constantFrom('uniform', 'gaussian');

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
  noiseDistribution: noiseDistributionArbitrary
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
  noiseDistribution: noiseDistributionArbitrary
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
 * Valid date arbitrary that ensures valid Date objects
 */
const validDateArbitrary = fc.integer({ 
  min: new Date('2020-01-01').getTime(), 
  max: new Date('2030-12-31').getTime() 
}).map(ts => new Date(ts));

/**
 * Valid FingerprintConfig arbitrary - generates configs that pass validation
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
  noiseSeed: fc.record({
    encrypted: fc.boolean(),
    value: fc.integer({ min: 0, max: 0xFFFFFFFF })
  }),
  seedVersion: fc.integer({ min: 1, max: 100 }),
  seedRotatedAt: fc.option(validDateArbitrary, { nil: null })
});


// ==================== Property Tests ====================

describe('FingerprintConfig Property Tests', () => {
  
  /**
   * **Feature: professional-fingerprint-refactoring, Property 1: 指纹配置序列化往返一致性**
   * **Validates: Requirements 2.5**
   * 
   * For any valid FingerprintConfig object, serializing to JSON and then
   * deserializing should produce an equivalent configuration.
   */
  describe('Property 1: Serialization Round-Trip Consistency', () => {
    test('toJSON followed by fromJSON produces equivalent config', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            // Create original config
            const original = new FingerprintConfig(configData);
            
            // Serialize to JSON
            const json = original.toJSON();
            
            // Deserialize back to config
            const restored = FingerprintConfig.fromJSON(json);
            
            // The restored config should be equivalent to the original
            expect(restored.id).toBe(original.id);
            expect(restored.accountId).toBe(original.accountId);
            expect(restored.version).toBe(original.version);
            
            // Browser config
            expect(restored.browser.type).toBe(original.browser.type);
            expect(restored.browser.version).toBe(original.browser.version);
            expect(restored.browser.majorVersion).toBe(original.browser.majorVersion);
            
            // OS config
            expect(restored.os.type).toBe(original.os.type);
            expect(restored.os.version).toBe(original.os.version);
            expect(restored.os.platform).toBe(original.os.platform);
            
            // User-Agent
            expect(restored.userAgent).toBe(original.userAgent);
            
            // Hardware config
            expect(restored.hardware.cpuCores).toBe(original.hardware.cpuCores);
            expect(restored.hardware.deviceMemory).toBe(original.hardware.deviceMemory);
            expect(restored.hardware.maxTouchPoints).toBe(original.hardware.maxTouchPoints);
            expect(restored.hardware.screen.width).toBe(original.hardware.screen.width);
            expect(restored.hardware.screen.height).toBe(original.hardware.screen.height);
            expect(restored.hardware.screen.colorDepth).toBe(original.hardware.screen.colorDepth);
            expect(restored.hardware.devicePixelRatio).toBe(original.hardware.devicePixelRatio);
            
            // Canvas config
            expect(restored.canvas.mode).toBe(original.canvas.mode);
            expect(restored.canvas.noiseLevel).toBe(original.canvas.noiseLevel);
            expect(restored.canvas.noiseDistribution).toBe(original.canvas.noiseDistribution);
            
            // WebGL config
            expect(restored.webgl.mode).toBe(original.webgl.mode);
            expect(restored.webgl.vendor).toBe(original.webgl.vendor);
            expect(restored.webgl.renderer).toBe(original.webgl.renderer);
            
            // Audio config
            expect(restored.audio.mode).toBe(original.audio.mode);
            expect(restored.audio.noiseLevel).toBe(original.audio.noiseLevel);
            
            // Fonts config
            expect(restored.fonts.mode).toBe(original.fonts.mode);
            expect(restored.fonts.list).toEqual(original.fonts.list);
            
            // Timezone config
            expect(restored.timezone.mode).toBe(original.timezone.mode);
            expect(restored.timezone.name).toBe(original.timezone.name);
            expect(restored.timezone.offset).toBe(original.timezone.offset);
            
            // Geolocation config
            expect(restored.geolocation.mode).toBe(original.geolocation.mode);
            expect(restored.geolocation.latitude).toBe(original.geolocation.latitude);
            expect(restored.geolocation.longitude).toBe(original.geolocation.longitude);
            
            // WebRTC config
            expect(restored.webrtc.mode).toBe(original.webrtc.mode);
            expect(restored.webrtc.whitelist).toEqual(original.webrtc.whitelist);
            
            // Battery config
            expect(restored.battery.mode).toBe(original.battery.mode);
            expect(restored.battery.charging).toBe(original.battery.charging);
            expect(restored.battery.level).toBe(original.battery.level);
            
            // Noise seed
            expect(restored.noiseSeed.encrypted).toBe(original.noiseSeed.encrypted);
            expect(restored.noiseSeed.value).toBe(original.noiseSeed.value);
            expect(restored.seedVersion).toBe(original.seedVersion);
            
            // Dates should be equivalent (comparing ISO strings)
            expect(restored.createdAt.toISOString()).toBe(original.createdAt.toISOString());
            expect(restored.updatedAt.toISOString()).toBe(original.updatedAt.toISOString());
            
            // The equals method should return true
            expect(original.equals(restored)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('double serialization produces identical JSON', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const config = new FingerprintConfig(configData);
            
            // First serialization
            const json1 = config.toJSON();
            
            // Restore and serialize again
            const restored = FingerprintConfig.fromJSON(json1);
            const json2 = restored.toJSON();
            
            // Both JSON outputs should be identical
            expect(JSON.stringify(json1)).toBe(JSON.stringify(json2));
          }
        ),
        { numRuns: 100 }
      );
    });

    test('clone produces independent but equivalent copy', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const original = new FingerprintConfig(configData);
            const cloned = original.clone();
            
            // Should be equivalent
            expect(original.equals(cloned)).toBe(true);
            
            // But should be independent (modifying clone doesn't affect original)
            cloned.userAgent = 'Modified User Agent String Here';
            expect(original.userAgent).not.toBe('Modified User Agent String Here');
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: professional-fingerprint-refactoring, Property 3: 无效配置拒绝**
   * **Validates: Requirements 2.7**
   * 
   * For any fingerprint configuration containing invalid data (such as invalid
   * CPU core count, non-existent browser type, etc.), the validator should
   * reject the configuration and return specific error information.
   */
  describe('Property 3: Invalid Configuration Rejection', () => {
    
    // Invalid browser type arbitrary
    const invalidBrowserTypeArbitrary = fc.string({ minLength: 1, maxLength: 20 })
      .filter(s => !['chrome', 'firefox', 'edge', 'safari'].includes(s));
    
    // Invalid OS type arbitrary
    const invalidOSTypeArbitrary = fc.string({ minLength: 1, maxLength: 20 })
      .filter(s => !['windows', 'macos', 'linux'].includes(s));
    
    // Invalid CPU cores arbitrary (outside 1-128 range)
    // Note: 0, undefined, null are replaced by defaults in constructor (due to || operator), 
    // so we only test actual invalid values that will be set
    const invalidCpuCoresArbitrary = fc.oneof(
      fc.integer({ min: -100, max: -1 }),
      fc.integer({ min: 129, max: 1000 })
    );
    
    // Invalid device memory arbitrary
    // Note: undefined/null are replaced by defaults in constructor, so we only test actual invalid values
    const invalidDeviceMemoryArbitrary = fc.oneof(
      fc.double({ min: 0.1, max: 0.24, noNaN: true }),
      fc.double({ min: 65, max: 100, noNaN: true }),
      fc.constant(3),
      fc.constant(5),
      fc.constant(7)
    );
    
    // Invalid screen dimensions arbitrary
    // Note: 0 is replaced by default in constructor (due to || operator)
    const invalidScreenWidthArbitrary = fc.oneof(
      fc.integer({ min: -1000, max: -1 }),
      fc.integer({ min: 1, max: 319 }),
      fc.integer({ min: 7681, max: 10000 })
    );
    
    // Note: 0 is replaced by default in constructor (due to || operator)
    const invalidScreenHeightArbitrary = fc.oneof(
      fc.integer({ min: -1000, max: -1 }),
      fc.integer({ min: 1, max: 239 }),
      fc.integer({ min: 4321, max: 10000 })
    );
    
    // Invalid color depth arbitrary
    const invalidColorDepthArbitrary = fc.integer({ min: 1, max: 23 });
    
    // Invalid timezone offset arbitrary
    const invalidTimezoneOffsetArbitrary = fc.oneof(
      fc.integer({ min: -1000, max: -721 }),
      fc.integer({ min: 841, max: 2000 })
    );
    
    // Invalid latitude arbitrary
    const invalidLatitudeArbitrary = fc.oneof(
      fc.double({ min: -180, max: -90.01, noNaN: true }),
      fc.double({ min: 90.01, max: 180, noNaN: true })
    );
    
    // Invalid longitude arbitrary
    const invalidLongitudeArbitrary = fc.oneof(
      fc.double({ min: -360, max: -180.01, noNaN: true }),
      fc.double({ min: 180.01, max: 360, noNaN: true })
    );
    
    // Invalid battery level arbitrary
    const invalidBatteryLevelArbitrary = fc.oneof(
      fc.double({ min: -1, max: -0.01, noNaN: true }),
      fc.double({ min: 1.01, max: 2, noNaN: true })
    );

    test('invalid browser type is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidBrowserTypeArbitrary,
          async (invalidBrowserType) => {
            const config = new FingerprintConfig({
              browser: { type: invalidBrowserType, version: '120.0.0.0', majorVersion: 120 }
            });
            
            const result = config.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'browser.type')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('invalid OS type is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidOSTypeArbitrary,
          async (invalidOSType) => {
            const config = new FingerprintConfig({
              os: { type: invalidOSType, version: '10.0', platform: 'Win32' }
            });
            
            const result = config.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'os.type')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('invalid CPU cores is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidCpuCoresArbitrary,
          async (invalidCpuCores) => {
            const config = new FingerprintConfig({
              hardware: { cpuCores: invalidCpuCores }
            });
            
            const result = config.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'hardware.cpuCores')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('invalid device memory is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidDeviceMemoryArbitrary,
          async (invalidDeviceMemory) => {
            const config = new FingerprintConfig({
              hardware: { deviceMemory: invalidDeviceMemory }
            });
            
            const result = config.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'hardware.deviceMemory')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('invalid screen width is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidScreenWidthArbitrary,
          async (invalidWidth) => {
            const config = new FingerprintConfig({
              hardware: { screen: { width: invalidWidth } }
            });
            
            const result = config.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'hardware.screen.width')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('invalid screen height is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidScreenHeightArbitrary,
          async (invalidHeight) => {
            const config = new FingerprintConfig({
              hardware: { screen: { height: invalidHeight } }
            });
            
            const result = config.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'hardware.screen.height')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('invalid color depth is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidColorDepthArbitrary,
          async (invalidColorDepth) => {
            const config = new FingerprintConfig({
              hardware: { screen: { colorDepth: invalidColorDepth } }
            });
            
            const result = config.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'hardware.screen.colorDepth')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('invalid timezone offset is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidTimezoneOffsetArbitrary,
          async (invalidOffset) => {
            const config = new FingerprintConfig({
              timezone: { offset: invalidOffset }
            });
            
            const result = config.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'timezone.offset')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('invalid latitude is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidLatitudeArbitrary,
          async (invalidLatitude) => {
            const config = new FingerprintConfig({
              geolocation: { latitude: invalidLatitude }
            });
            
            const result = config.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'geolocation.latitude')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('invalid longitude is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidLongitudeArbitrary,
          async (invalidLongitude) => {
            const config = new FingerprintConfig({
              geolocation: { longitude: invalidLongitude }
            });
            
            const result = config.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'geolocation.longitude')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('invalid battery level is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidBatteryLevelArbitrary,
          async (invalidLevel) => {
            const config = new FingerprintConfig({
              battery: { level: invalidLevel }
            });
            
            const result = config.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'battery.level')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('valid configuration passes validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          validFingerprintConfigArbitrary,
          async (configData) => {
            const config = new FingerprintConfig(configData);
            const result = config.validate();
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple invalid fields produce multiple errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidBrowserTypeArbitrary,
          invalidCpuCoresArbitrary,
          invalidBatteryLevelArbitrary,
          async (invalidBrowser, invalidCpu, invalidBattery) => {
            const config = new FingerprintConfig({
              browser: { type: invalidBrowser, version: '120.0.0.0', majorVersion: 120 },
              hardware: { cpuCores: invalidCpu },
              battery: { level: invalidBattery }
            });
            
            const result = config.validate();
            
            expect(result.valid).toBe(false);
            // Should have errors for each invalid field
            expect(result.errors.some(e => e.field === 'browser.type')).toBe(true);
            expect(result.errors.some(e => e.field === 'hardware.cpuCores')).toBe(true);
            expect(result.errors.some(e => e.field === 'battery.level')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('error messages include field name and invalid value', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidBrowserTypeArbitrary,
          async (invalidBrowserType) => {
            const config = new FingerprintConfig({
              browser: { type: invalidBrowserType, version: '120.0.0.0', majorVersion: 120 }
            });
            
            const result = config.validate();
            const browserError = result.errors.find(e => e.field === 'browser.type');
            
            expect(browserError).toBeDefined();
            expect(browserError.field).toBe('browser.type');
            expect(browserError.reason).toBeTruthy();
            expect(browserError.value).toBe(invalidBrowserType);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
