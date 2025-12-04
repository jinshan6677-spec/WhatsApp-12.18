'use strict';

/**
 * Property-based tests for TemplateManager
 * 
 * Tests the following properties:
 * - Property 8: 模板导出导入往返一致性 (Template Export/Import Round-Trip Consistency)
 * 
 * **Validates: Requirements 21.3, 21.4**
 */

const fc = require('fast-check');
const TemplateManager = require('../../src/application/services/fingerprint/TemplateManager');
const FingerprintTemplate = require('../../src/domain/fingerprint/FingerprintTemplate');
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

/**
 * Valid template name arbitrary (non-empty, max 100 chars)
 */
const validTemplateNameArbitrary = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * Valid template description arbitrary (max 500 chars)
 */
const validTemplateDescriptionArbitrary = fc.string({ minLength: 0, maxLength: 500 });

/**
 * Valid tags arbitrary
 */
const validTagsArbitrary = fc.array(
  fc.string({ minLength: 1, maxLength: 50 }),
  { minLength: 0, maxLength: 10 }
);

/**
 * Valid template creation options arbitrary
 */
const validTemplateOptionsArbitrary = fc.record({
  name: validTemplateNameArbitrary,
  description: validTemplateDescriptionArbitrary,
  tags: validTagsArbitrary,
  config: validFingerprintConfigArbitrary
});


// ==================== Property Tests ====================

describe('TemplateManager Property Tests', () => {
  
  /**
   * **Feature: professional-fingerprint-refactoring, Property 8: 模板导出导入往返一致性**
   * **Validates: Requirements 21.3, 21.4**
   * 
   * For any valid fingerprint template, exporting to JSON and then importing
   * should produce an equivalent template configuration.
   */
  describe('Property 8: Template Export/Import Round-Trip Consistency', () => {
    
    test('exportTemplate followed by importTemplate produces equivalent template config', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTemplateOptionsArbitrary,
          async (templateOptions) => {
            // Create a fresh TemplateManager for each test
            const manager = new TemplateManager();
            
            // Create the original template
            const original = manager.createTemplate(templateOptions);
            
            // Export the template
            const exported = manager.exportTemplate(original.id);
            
            // Import the template (with generateNewId=false to preserve ID for comparison)
            const imported = manager.importTemplate(exported, { generateNewId: false });
            
            // The imported template should have equivalent configuration
            expect(imported.name).toBe(original.name);
            expect(imported.description).toBe(original.description);
            expect(imported.version).toBe(original.version);
            expect(imported.tags).toEqual(original.tags);
            
            // Config should be equivalent
            expect(imported.config.browser.type).toBe(original.config.browser.type);
            expect(imported.config.browser.version).toBe(original.config.browser.version);
            expect(imported.config.browser.majorVersion).toBe(original.config.browser.majorVersion);
            
            expect(imported.config.os.type).toBe(original.config.os.type);
            expect(imported.config.os.version).toBe(original.config.os.version);
            expect(imported.config.os.platform).toBe(original.config.os.platform);
            
            expect(imported.config.userAgent).toBe(original.config.userAgent);
            
            expect(imported.config.hardware.cpuCores).toBe(original.config.hardware.cpuCores);
            expect(imported.config.hardware.deviceMemory).toBe(original.config.hardware.deviceMemory);
            expect(imported.config.hardware.screen.width).toBe(original.config.hardware.screen.width);
            expect(imported.config.hardware.screen.height).toBe(original.config.hardware.screen.height);
            
            expect(imported.config.canvas.mode).toBe(original.config.canvas.mode);
            expect(imported.config.canvas.noiseLevel).toBe(original.config.canvas.noiseLevel);
            
            expect(imported.config.webgl.mode).toBe(original.config.webgl.mode);
            expect(imported.config.webgl.vendor).toBe(original.config.webgl.vendor);
            expect(imported.config.webgl.renderer).toBe(original.config.webgl.renderer);
            
            expect(imported.config.audio.mode).toBe(original.config.audio.mode);
            expect(imported.config.fonts.list).toEqual(original.config.fonts.list);
            
            expect(imported.config.timezone.name).toBe(original.config.timezone.name);
            expect(imported.config.timezone.offset).toBe(original.config.timezone.offset);
            
            expect(imported.config.geolocation.latitude).toBe(original.config.geolocation.latitude);
            expect(imported.config.geolocation.longitude).toBe(original.config.geolocation.longitude);
            
            expect(imported.config.webrtc.mode).toBe(original.config.webrtc.mode);
            expect(imported.config.battery.level).toBe(original.config.battery.level);
            
            // Noise seed should be preserved
            expect(imported.config.noiseSeed.value).toBe(original.config.noiseSeed.value);
            expect(imported.config.seedVersion).toBe(original.config.seedVersion);
            
            // Dates should be equivalent
            expect(imported.createdAt.toISOString()).toBe(original.createdAt.toISOString());
          }
        ),
        { numRuns: 100 }
      );
    });

    test('double export/import produces equivalent JSON (excluding timestamps)', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTemplateOptionsArbitrary,
          async (templateOptions) => {
            const manager = new TemplateManager();
            
            // Create template
            const template = manager.createTemplate(templateOptions);
            
            // First export
            const exported1 = manager.exportTemplate(template.id);
            
            // Import and export again
            const imported = manager.importTemplate(exported1, { generateNewId: false });
            const exported2 = manager.exportTemplate(imported.id);
            
            // Remove export metadata and updatedAt for comparison 
            // (updatedAt changes on import which is expected behavior)
            delete exported1._exportMetadata;
            delete exported2._exportMetadata;
            delete exported1.updatedAt;
            delete exported2.updatedAt;
            
            // Both exports should be identical (excluding updatedAt)
            expect(JSON.stringify(exported1)).toBe(JSON.stringify(exported2));
          }
        ),
        { numRuns: 100 }
      );
    });

    test('export without noise seed excludes seed data', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTemplateOptionsArbitrary,
          async (templateOptions) => {
            const manager = new TemplateManager();
            
            // Create template
            const template = manager.createTemplate(templateOptions);
            
            // Export without noise seed
            const exported = manager.exportTemplate(template.id, { includeNoiseSeed: false });
            
            // Noise seed should not be present in exported config
            expect(exported.config.noiseSeed).toBeUndefined();
            expect(exported.config.seedVersion).toBeUndefined();
            expect(exported.config.seedRotatedAt).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('import with generateNewId creates new unique ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTemplateOptionsArbitrary,
          async (templateOptions) => {
            const manager = new TemplateManager();
            
            // Create template
            const original = manager.createTemplate(templateOptions);
            
            // Export
            const exported = manager.exportTemplate(original.id);
            
            // Import with new ID (default behavior)
            const imported = manager.importTemplate(exported, { generateNewId: true });
            
            // IDs should be different
            expect(imported.id).not.toBe(original.id);
            
            // But config should still be equivalent
            expect(imported.name).toBe(original.name);
            expect(imported.config.browser.type).toBe(original.config.browser.type);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('import with newName overrides template name', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTemplateOptionsArbitrary,
          validTemplateNameArbitrary,
          async (templateOptions, newName) => {
            const manager = new TemplateManager();
            
            // Create template
            const original = manager.createTemplate(templateOptions);
            
            // Export
            const exported = manager.exportTemplate(original.id);
            
            // Import with new name
            const imported = manager.importTemplate(exported, { newName });
            
            // Name should be the new name
            expect(imported.name).toBe(newName.trim());
            
            // But config should still be equivalent
            expect(imported.config.browser.type).toBe(original.config.browser.type);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('imported template passes validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTemplateOptionsArbitrary,
          async (templateOptions) => {
            const manager = new TemplateManager();
            
            // Create template
            const original = manager.createTemplate(templateOptions);
            
            // Export and import
            const exported = manager.exportTemplate(original.id);
            const imported = manager.importTemplate(exported);
            
            // Imported template should pass validation
            const validation = imported.validate();
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('applyTemplate creates independent config for account', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTemplateOptionsArbitrary,
          fc.uuid(),
          async (templateOptions, accountId) => {
            const manager = new TemplateManager();
            
            // Create template
            const template = manager.createTemplate(templateOptions);
            
            // Apply to account
            const accountConfig = manager.applyTemplate(template.id, accountId);
            
            // Account config should have the account ID
            expect(accountConfig.accountId).toBe(accountId);
            
            // Account config should have a new unique ID
            expect(accountConfig.id).not.toBe(template.config.id);
            
            // But settings should match template
            expect(accountConfig.browser.type).toBe(template.config.browser.type);
            expect(accountConfig.os.type).toBe(template.config.os.type);
            expect(accountConfig.userAgent).toBe(template.config.userAgent);
            
            // Modifying account config should not affect template
            accountConfig.userAgent = 'Modified User Agent';
            expect(template.config.userAgent).not.toBe('Modified User Agent');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('deleteTemplate does not affect previously applied configs', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTemplateOptionsArbitrary,
          fc.uuid(),
          async (templateOptions, accountId) => {
            const manager = new TemplateManager();
            
            // Create template
            const template = manager.createTemplate(templateOptions);
            const templateId = template.id;
            
            // Apply to account
            const accountConfig = manager.applyTemplate(templateId, accountId);
            const originalUserAgent = accountConfig.userAgent;
            
            // Delete template
            const deleted = manager.deleteTemplate(templateId);
            expect(deleted).toBe(true);
            
            // Template should no longer exist
            expect(manager.hasTemplate(templateId)).toBe(false);
            
            // But account config should still be valid and unchanged
            expect(accountConfig.userAgent).toBe(originalUserAgent);
            expect(accountConfig.accountId).toBe(accountId);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
