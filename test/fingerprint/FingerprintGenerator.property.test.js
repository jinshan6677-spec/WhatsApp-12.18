'use strict';

/**
 * Property-based tests for FingerprintGenerator
 * 
 * Tests the following properties:
 * - Property 6: 生成指纹内部一致性 (Generated Fingerprint Internal Consistency)
 * - Property 7: 多次生成指纹唯一性 (Multiple Generation Uniqueness)
 * - Property 2: 新账号指纹唯一性 (New Account Fingerprint Uniqueness)
 * 
 * **Validates: Requirements 2.1, 20.2, 20.7, 29.1, 29.2**
 */

const fc = require('fast-check');
const FingerprintGenerator = require('../../src/application/services/fingerprint/FingerprintGenerator');
const FingerprintValidator = require('../../src/application/services/fingerprint/FingerprintValidator');
const FingerprintConfig = require('../../src/domain/fingerprint/FingerprintConfig');

// ==================== Arbitraries ====================

/**
 * OS type arbitrary
 */
const osTypeArbitrary = fc.constantFrom('windows', 'macos', 'linux');

/**
 * Browser type arbitrary for Windows
 */
const windowsBrowserArbitrary = fc.constantFrom('chrome', 'firefox', 'edge');

/**
 * Browser type arbitrary for macOS
 */
const macosBrowserArbitrary = fc.constantFrom('chrome', 'firefox', 'safari');

/**
 * Browser type arbitrary for Linux
 */
const linuxBrowserArbitrary = fc.constantFrom('chrome', 'firefox');

/**
 * OS and browser combination arbitrary (ensures valid combinations)
 */
const osAndBrowserArbitrary = fc.oneof(
  fc.record({ os: fc.constant('windows'), browser: windowsBrowserArbitrary }),
  fc.record({ os: fc.constant('macos'), browser: macosBrowserArbitrary }),
  fc.record({ os: fc.constant('linux'), browser: linuxBrowserArbitrary })
);

/**
 * Account ID arbitrary
 */
const accountIdArbitrary = fc.uuid();

/**
 * Seed arbitrary for deterministic generation
 */
const seedArbitrary = fc.integer({ min: 0, max: 0xFFFFFFFF });

// ==================== Property Tests ====================

describe('FingerprintGenerator Property Tests', () => {
  let generator;
  let validator;

  beforeAll(() => {
    generator = new FingerprintGenerator();
    validator = new FingerprintValidator();
  });

  /**
   * **Feature: professional-fingerprint-refactoring, Property 6: 生成指纹内部一致性**
   * **Validates: Requirements 20.2, 29.1, 29.2**
   * 
   * For any generated fingerprint configuration, the User-Agent OS information
   * should match the platform property, and the WebGL renderer should be
   * compatible with the operating system.
   */
  describe('Property 6: Generated Fingerprint Internal Consistency', () => {
    
    test('User-Agent matches platform for all OS types', async () => {
      await fc.assert(
        fc.asyncProperty(
          osAndBrowserArbitrary,
          async ({ os, browser }) => {
            const config = generator.generateFingerprint({ os, browser });
            
            const userAgent = config.userAgent.toLowerCase();
            const platform = config.os.platform;
            const osType = config.os.type;
            
            // Verify OS type matches what was requested
            expect(osType).toBe(os);
            
            // Verify User-Agent contains OS indicators
            if (os === 'windows') {
              expect(userAgent).toContain('windows');
              expect(platform).toBe('Win32');
            } else if (os === 'macos') {
              expect(userAgent.includes('macintosh') || userAgent.includes('mac os')).toBe(true);
              expect(platform).toBe('MacIntel');
            } else if (os === 'linux') {
              expect(userAgent).toContain('linux');
              expect(platform.startsWith('Linux')).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('WebGL renderer is compatible with OS', async () => {
      await fc.assert(
        fc.asyncProperty(
          osAndBrowserArbitrary,
          async ({ os, browser }) => {
            const config = generator.generateFingerprint({ os, browser });
            
            const renderer = config.webgl.renderer.toLowerCase();
            const unmaskedRenderer = config.webgl.unmaskedRenderer.toLowerCase();
            const osType = config.os.type;
            
            // Apple Silicon GPUs should only appear on macOS
            if (osType !== 'macos') {
              expect(renderer.includes('apple m')).toBe(false);
              expect(unmaskedRenderer.includes('apple m')).toBe(false);
            }
            
            // Direct3D should only appear on Windows
            if (osType !== 'windows') {
              expect(renderer.includes('direct3d')).toBe(false);
              expect(renderer.includes('d3d11')).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Browser type matches User-Agent', async () => {
      await fc.assert(
        fc.asyncProperty(
          osAndBrowserArbitrary,
          async ({ os, browser }) => {
            const config = generator.generateFingerprint({ os, browser });
            
            const userAgent = config.userAgent.toLowerCase();
            const browserType = config.browser.type;
            
            // Verify browser type matches what was requested
            expect(browserType).toBe(browser);
            
            // Verify User-Agent contains browser indicators
            if (browser === 'chrome') {
              expect(userAgent).toContain('chrome');
              // Chrome UA should not contain 'edg/' (Edge indicator)
              if (!userAgent.includes('edg/')) {
                expect(config.navigator.vendor).toBe('Google Inc.');
              }
            } else if (browser === 'firefox') {
              expect(userAgent).toContain('firefox');
              expect(config.navigator.vendor).toBe('');
            } else if (browser === 'edge') {
              expect(userAgent.includes('edg/') || userAgent.includes('edge/')).toBe(true);
            } else if (browser === 'safari') {
              expect(userAgent).toContain('safari');
              expect(config.navigator.vendor).toBe('Apple Computer, Inc.');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Generated config passes validator consistency checks', async () => {
      await fc.assert(
        fc.asyncProperty(
          osAndBrowserArbitrary,
          async ({ os, browser }) => {
            const config = generator.generateFingerprint({ os, browser });
            
            // Run the validator
            const result = validator.validate(config);
            
            // Generated configs should pass validation
            expect(result.valid).toBe(true);
            
            // Should have no errors (warnings are acceptable)
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Screen dimensions are valid', async () => {
      await fc.assert(
        fc.asyncProperty(
          osAndBrowserArbitrary,
          async ({ os, browser }) => {
            const config = generator.generateFingerprint({ os, browser });
            
            const screen = config.hardware.screen;
            
            // availWidth should be <= width
            expect(screen.availWidth).toBeLessThanOrEqual(screen.width);
            
            // availHeight should be <= height
            expect(screen.availHeight).toBeLessThanOrEqual(screen.height);
            
            // pixelDepth should match colorDepth
            expect(screen.pixelDepth).toBe(screen.colorDepth);
            
            // Dimensions should be in valid ranges
            expect(screen.width).toBeGreaterThanOrEqual(320);
            expect(screen.width).toBeLessThanOrEqual(7680);
            expect(screen.height).toBeGreaterThanOrEqual(240);
            expect(screen.height).toBeLessThanOrEqual(4320);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Fonts are appropriate for OS', async () => {
      await fc.assert(
        fc.asyncProperty(
          osAndBrowserArbitrary,
          async ({ os, browser }) => {
            const config = generator.generateFingerprint({ os, browser });
            
            const fonts = config.fonts.list;
            const expectedFonts = FingerprintValidator.getExpectedFonts(os);
            
            // At least some fonts should be from the expected OS font list
            const hasOSFonts = fonts.some(font => expectedFonts.includes(font));
            expect(hasOSFonts).toBe(true);
            
            // Should have a reasonable number of fonts
            expect(fonts.length).toBeGreaterThanOrEqual(5);
            expect(fonts.length).toBeLessThanOrEqual(50);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Navigator webdriver is always false', async () => {
      await fc.assert(
        fc.asyncProperty(
          osAndBrowserArbitrary,
          async ({ os, browser }) => {
            const config = generator.generateFingerprint({ os, browser });
            
            // webdriver should always be false for anti-detection
            expect(config.navigator.webdriver).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });



  /**
   * **Feature: professional-fingerprint-refactoring, Property 7: 多次生成指纹唯一性**
   * **Validates: Requirements 20.7**
   * 
   * For any consecutive multiple calls to the fingerprint generator, each
   * generated fingerprint configuration should have a different noise seed
   * and unique identifier.
   */
  describe('Property 7: Multiple Generation Uniqueness', () => {
    
    test('Multiple generations produce different noise seeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          osAndBrowserArbitrary,
          fc.integer({ min: 2, max: 10 }),
          async ({ os, browser }, count) => {
            const configs = [];
            
            // Generate multiple fingerprints
            for (let i = 0; i < count; i++) {
              configs.push(generator.generateFingerprint({ os, browser }));
            }
            
            // Extract noise seeds
            const seeds = configs.map(c => c.noiseSeed.value);
            
            // All seeds should be unique
            const uniqueSeeds = new Set(seeds);
            expect(uniqueSeeds.size).toBe(count);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Multiple generations produce different IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          osAndBrowserArbitrary,
          fc.integer({ min: 2, max: 10 }),
          async ({ os, browser }, count) => {
            const configs = [];
            
            // Generate multiple fingerprints
            for (let i = 0; i < count; i++) {
              configs.push(generator.generateFingerprint({ os, browser }));
            }
            
            // Extract IDs
            const ids = configs.map(c => c.id);
            
            // All IDs should be unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(count);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Multiple generations with same seed produce same config', async () => {
      await fc.assert(
        fc.asyncProperty(
          osAndBrowserArbitrary,
          seedArbitrary,
          async ({ os, browser }, seed) => {
            // Generate two fingerprints with the same seed
            const config1 = generator.generateFingerprint({ os, browser, seed });
            const config2 = generator.generateFingerprint({ os, browser, seed });
            
            // Core properties should be the same (from database template)
            expect(config1.userAgent).toBe(config2.userAgent);
            expect(config1.os.platform).toBe(config2.os.platform);
            expect(config1.webgl.renderer).toBe(config2.webgl.renderer);
            
            // Note: IDs and noise seeds will still be different as they're
            // generated independently of the template seed
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Different OS/browser combinations produce different fingerprints', async () => {
      await fc.assert(
        fc.asyncProperty(
          osAndBrowserArbitrary,
          osAndBrowserArbitrary,
          async (combo1, combo2) => {
            // Skip if same combination
            if (combo1.os === combo2.os && combo1.browser === combo2.browser) {
              return;
            }
            
            const config1 = generator.generateFingerprint(combo1);
            const config2 = generator.generateFingerprint(combo2);
            
            // Different OS should produce different User-Agents
            if (combo1.os !== combo2.os) {
              expect(config1.userAgent).not.toBe(config2.userAgent);
              expect(config1.os.platform).not.toBe(config2.os.platform);
            }
            
            // Different browsers should produce different User-Agents
            if (combo1.browser !== combo2.browser) {
              expect(config1.userAgent).not.toBe(config2.userAgent);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });


  /**
   * **Feature: professional-fingerprint-refactoring, Property 2: 新账号指纹唯一性**
   * **Validates: Requirements 2.1**
   * 
   * For any newly created account, the system-generated fingerprint configuration
   * should have a unique ID and noise seed.
   */
  describe('Property 2: New Account Fingerprint Uniqueness', () => {
    
    test('Each account gets unique fingerprint ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(accountIdArbitrary, { minLength: 2, maxLength: 10 }),
          async (accountIds) => {
            const configs = accountIds.map(accountId => 
              generator.generateFingerprint({ accountId })
            );
            
            // Extract fingerprint IDs
            const fpIds = configs.map(c => c.id);
            
            // All fingerprint IDs should be unique
            const uniqueFpIds = new Set(fpIds);
            expect(uniqueFpIds.size).toBe(accountIds.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Each account gets unique noise seed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(accountIdArbitrary, { minLength: 2, maxLength: 10 }),
          async (accountIds) => {
            const configs = accountIds.map(accountId => 
              generator.generateFingerprint({ accountId })
            );
            
            // Extract noise seeds
            const seeds = configs.map(c => c.noiseSeed.value);
            
            // All noise seeds should be unique
            const uniqueSeeds = new Set(seeds);
            expect(uniqueSeeds.size).toBe(accountIds.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Account ID is correctly associated with fingerprint', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          async (accountId) => {
            const config = generator.generateFingerprint({ accountId });
            
            // Account ID should be set on the config
            expect(config.accountId).toBe(accountId);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Fingerprint without account ID has null accountId', async () => {
      await fc.assert(
        fc.asyncProperty(
          osAndBrowserArbitrary,
          async ({ os, browser }) => {
            const config = generator.generateFingerprint({ os, browser });
            
            // Account ID should be null when not provided
            expect(config.accountId).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Generated fingerprint is a valid FingerprintConfig instance', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          osAndBrowserArbitrary,
          async (accountId, { os, browser }) => {
            const config = generator.generateFingerprint({ accountId, os, browser });
            
            // Should be a FingerprintConfig instance
            expect(config).toBeInstanceOf(FingerprintConfig);
            
            // Should pass basic validation
            const validation = config.validate();
            expect(validation.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Seed version starts at 1 for new fingerprints', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          async (accountId) => {
            const config = generator.generateFingerprint({ accountId });
            
            // Seed version should be 1 for new fingerprints
            expect(config.seedVersion).toBe(1);
            
            // Seed should not have been rotated yet
            expect(config.seedRotatedAt).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
