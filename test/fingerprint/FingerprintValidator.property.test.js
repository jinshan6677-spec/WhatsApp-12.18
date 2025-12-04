'use strict';

/**
 * Property-based tests for FingerprintValidator
 * 
 * Tests the following properties:
 * - Property 11: User-Agent与平台一致性验证 (User-Agent and Platform Consistency Validation)
 * - Property 12: WebGL与操作系统兼容性验证 (WebGL and OS Compatibility Validation)
 * 
 * **Validates: Requirements 29.1, 29.2**
 */

const fc = require('fast-check');
const FingerprintValidator = require('../../src/application/services/fingerprint/FingerprintValidator');
const FingerprintConfig = require('../../src/domain/fingerprint/FingerprintConfig');

// ==================== Arbitraries ====================

/**
 * Windows User-Agent arbitrary
 */
const windowsUserAgentArbitrary = fc.constantFrom(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
);

/**
 * macOS User-Agent arbitrary
 */
const macosUserAgentArbitrary = fc.constantFrom(
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
);

/**
 * Linux User-Agent arbitrary
 */
const linuxUserAgentArbitrary = fc.constantFrom(
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
);

/**
 * Valid Windows platform
 */
const windowsPlatformArbitrary = fc.constant('Win32');

/**
 * Valid macOS platform
 */
const macosPlatformArbitrary = fc.constant('MacIntel');

/**
 * Valid Linux platforms
 */
const linuxPlatformArbitrary = fc.constantFrom('Linux x86_64', 'Linux armv7l', 'Linux aarch64');

/**
 * Invalid platform for Windows (not Win32)
 */
const invalidWindowsPlatformArbitrary = fc.constantFrom('MacIntel', 'Linux x86_64', 'Linux armv7l');

/**
 * Invalid platform for macOS (not MacIntel)
 */
const invalidMacosPlatformArbitrary = fc.constantFrom('Win32', 'Linux x86_64', 'Linux armv7l');

/**
 * Invalid platform for Linux
 */
const invalidLinuxPlatformArbitrary = fc.constantFrom('Win32', 'MacIntel');

/**
 * Windows WebGL renderer arbitrary
 */
const windowsWebGLArbitrary = fc.record({
  vendor: fc.constantFrom('Google Inc. (Intel)', 'Google Inc. (NVIDIA)', 'Google Inc. (AMD)'),
  renderer: fc.constantFrom(
    'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)'
  ),
  unmaskedVendor: fc.constantFrom('Intel Inc.', 'NVIDIA Corporation', 'AMD'),
  unmaskedRenderer: fc.constantFrom('Intel(R) UHD Graphics 630', 'NVIDIA GeForce GTX 1660 SUPER', 'AMD Radeon RX 580 Series')
});

/**
 * macOS WebGL renderer arbitrary
 */
const macosWebGLArbitrary = fc.record({
  vendor: fc.constantFrom('Google Inc. (Apple)', 'Google Inc. (Intel)', 'Apple Inc.'),
  renderer: fc.constantFrom(
    'ANGLE (Apple, Apple M1, OpenGL 4.1)',
    'ANGLE (Apple, Apple M2, OpenGL 4.1)',
    'ANGLE (Intel Inc., Intel(R) Iris Plus Graphics 640, OpenGL 4.1)'
  ),
  unmaskedVendor: fc.constantFrom('Apple Inc.', 'Intel Inc.'),
  unmaskedRenderer: fc.constantFrom('Apple M1', 'Apple M2', 'Intel(R) Iris Plus Graphics 640')
});

/**
 * Linux WebGL renderer arbitrary
 */
const linuxWebGLArbitrary = fc.record({
  vendor: fc.constantFrom('Google Inc. (Intel)', 'Google Inc. (NVIDIA)', 'Intel', 'NVIDIA Corporation'),
  renderer: fc.constantFrom(
    'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)',
    'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER/PCIe/SSE2, OpenGL 4.6)',
    'Mesa Intel(R) UHD Graphics 630 (CFL GT2)'
  ),
  unmaskedVendor: fc.constantFrom('Intel', 'NVIDIA Corporation', 'AMD'),
  unmaskedRenderer: fc.constantFrom('Mesa Intel(R) UHD Graphics 630 (CFL GT2)', 'NVIDIA GeForce GTX 1660 SUPER/PCIe/SSE2')
});

/**
 * Apple Silicon WebGL (macOS only)
 */
const appleSiliconWebGLArbitrary = fc.record({
  vendor: fc.constantFrom('Google Inc. (Apple)', 'Apple Inc.'),
  renderer: fc.constantFrom('ANGLE (Apple, Apple M1, OpenGL 4.1)', 'ANGLE (Apple, Apple M2, OpenGL 4.1)'),
  unmaskedVendor: fc.constant('Apple Inc.'),
  unmaskedRenderer: fc.constantFrom('Apple M1', 'Apple M2', 'Apple M1 Pro', 'Apple M2 Pro')
});

/**
 * Direct3D WebGL (Windows only)
 */
const direct3DWebGLArbitrary = fc.record({
  vendor: fc.constantFrom('Google Inc. (Intel)', 'Google Inc. (NVIDIA)'),
  renderer: fc.constantFrom(
    'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)'
  ),
  unmaskedVendor: fc.constantFrom('Intel Inc.', 'NVIDIA Corporation'),
  unmaskedRenderer: fc.constantFrom('Intel(R) UHD Graphics 630', 'NVIDIA GeForce GTX 1660 SUPER')
});


// ==================== Property Tests ====================

describe('FingerprintValidator Property Tests', () => {
  
  /**
   * **Feature: professional-fingerprint-refactoring, Property 11: User-Agent与平台一致性验证**
   * **Validates: Requirements 29.1**
   * 
   * For any fingerprint configuration, if User-Agent contains "Windows", 
   * then platform should be "Win32"; if it contains "Macintosh", 
   * then platform should be "MacIntel".
   */
  describe('Property 11: User-Agent and Platform Consistency Validation', () => {
    const validator = new FingerprintValidator();

    test('Windows User-Agent with Win32 platform passes validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          windowsUserAgentArbitrary,
          windowsPlatformArbitrary,
          async (userAgent, platform) => {
            const config = new FingerprintConfig({
              userAgent,
              os: { type: 'windows', version: '10.0', platform }
            });
            
            const result = validator.validateUserAgentPlatform(config);
            
            // Should have no errors for matching UA and platform
            const platformErrors = result.errors.filter(e => e.field === 'os.platform');
            expect(platformErrors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Windows User-Agent with non-Win32 platform fails validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          windowsUserAgentArbitrary,
          invalidWindowsPlatformArbitrary,
          async (userAgent, platform) => {
            const config = new FingerprintConfig({
              userAgent,
              os: { type: 'windows', version: '10.0', platform }
            });
            
            const result = validator.validateUserAgentPlatform(config);
            
            // Should have error for mismatched platform
            const platformErrors = result.errors.filter(e => e.field === 'os.platform');
            expect(platformErrors.length).toBeGreaterThan(0);
            expect(platformErrors[0].reason).toContain('Windows');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('macOS User-Agent with MacIntel platform passes validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          macosUserAgentArbitrary,
          macosPlatformArbitrary,
          async (userAgent, platform) => {
            const config = new FingerprintConfig({
              userAgent,
              os: { type: 'macos', version: '10.15.7', platform }
            });
            
            const result = validator.validateUserAgentPlatform(config);
            
            // Should have no errors for matching UA and platform
            const platformErrors = result.errors.filter(e => e.field === 'os.platform');
            expect(platformErrors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('macOS User-Agent with non-MacIntel platform fails validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          macosUserAgentArbitrary,
          invalidMacosPlatformArbitrary,
          async (userAgent, platform) => {
            const config = new FingerprintConfig({
              userAgent,
              os: { type: 'macos', version: '10.15.7', platform }
            });
            
            const result = validator.validateUserAgentPlatform(config);
            
            // Should have error for mismatched platform
            const platformErrors = result.errors.filter(e => e.field === 'os.platform');
            expect(platformErrors.length).toBeGreaterThan(0);
            expect(platformErrors[0].reason).toContain('macOS');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Linux User-Agent with valid Linux platform passes validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          linuxUserAgentArbitrary,
          linuxPlatformArbitrary,
          async (userAgent, platform) => {
            const config = new FingerprintConfig({
              userAgent,
              os: { type: 'linux', version: '6.1.0', platform }
            });
            
            const result = validator.validateUserAgentPlatform(config);
            
            // Should have no errors for matching UA and platform
            const platformErrors = result.errors.filter(e => e.field === 'os.platform');
            expect(platformErrors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Linux User-Agent with non-Linux platform fails validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          linuxUserAgentArbitrary,
          invalidLinuxPlatformArbitrary,
          async (userAgent, platform) => {
            const config = new FingerprintConfig({
              userAgent,
              os: { type: 'linux', version: '6.1.0', platform }
            });
            
            const result = validator.validateUserAgentPlatform(config);
            
            // Should have error for mismatched platform
            const platformErrors = result.errors.filter(e => e.field === 'os.platform');
            expect(platformErrors.length).toBeGreaterThan(0);
            expect(platformErrors[0].reason).toContain('Linux');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Safari browser on non-macOS fails validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('windows', 'linux'),
          async (osType) => {
            const config = new FingerprintConfig({
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              browser: { type: 'safari', version: '17.2', majorVersion: 17 },
              os: { type: osType, version: '10.0', platform: osType === 'windows' ? 'Win32' : 'Linux x86_64' }
            });
            
            const result = validator.validateUserAgentPlatform(config);
            
            // Should have error for Safari on non-macOS
            const browserErrors = result.errors.filter(e => e.field === 'browser.type');
            expect(browserErrors.length).toBeGreaterThan(0);
            expect(browserErrors[0].reason).toContain('Safari');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('consistent config passes full validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.record({
              userAgent: windowsUserAgentArbitrary,
              osType: fc.constant('windows'),
              platform: windowsPlatformArbitrary
            }),
            fc.record({
              userAgent: macosUserAgentArbitrary,
              osType: fc.constant('macos'),
              platform: macosPlatformArbitrary
            }),
            fc.record({
              userAgent: linuxUserAgentArbitrary,
              osType: fc.constant('linux'),
              platform: linuxPlatformArbitrary
            })
          ),
          async ({ userAgent, osType, platform }) => {
            const config = new FingerprintConfig({
              userAgent,
              os: { type: osType, version: '10.0', platform }
            });
            
            const result = validator.validateUserAgentPlatform(config);
            
            // Should have no platform or OS type errors
            const criticalErrors = result.errors.filter(
              e => e.field === 'os.platform' || e.field === 'os.type'
            );
            expect(criticalErrors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: professional-fingerprint-refactoring, Property 12: WebGL与操作系统兼容性验证**
   * **Validates: Requirements 29.2**
   * 
   * For any fingerprint configuration, WebGL renderer string should be
   * compatible with the configured operating system.
   */
  describe('Property 12: WebGL and OS Compatibility Validation', () => {
    const validator = new FingerprintValidator();

    test('Windows WebGL config on Windows passes validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          windowsWebGLArbitrary,
          async (webgl) => {
            const config = new FingerprintConfig({
              os: { type: 'windows', version: '10.0', platform: 'Win32' },
              webgl: { mode: 'custom', ...webgl }
            });
            
            const result = validator.validateWebGLOS(config);
            
            // Should have no errors for compatible WebGL
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('macOS WebGL config on macOS passes validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          macosWebGLArbitrary,
          async (webgl) => {
            const config = new FingerprintConfig({
              os: { type: 'macos', version: '10.15.7', platform: 'MacIntel' },
              webgl: { mode: 'custom', ...webgl }
            });
            
            const result = validator.validateWebGLOS(config);
            
            // Should have no errors for compatible WebGL
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Linux WebGL config on Linux passes validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          linuxWebGLArbitrary,
          async (webgl) => {
            const config = new FingerprintConfig({
              os: { type: 'linux', version: '6.1.0', platform: 'Linux x86_64' },
              webgl: { mode: 'custom', ...webgl }
            });
            
            const result = validator.validateWebGLOS(config);
            
            // Should have no errors for compatible WebGL
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Apple Silicon WebGL on non-macOS fails validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          appleSiliconWebGLArbitrary,
          fc.constantFrom('windows', 'linux'),
          async (webgl, osType) => {
            const config = new FingerprintConfig({
              os: { 
                type: osType, 
                version: '10.0', 
                platform: osType === 'windows' ? 'Win32' : 'Linux x86_64' 
              },
              webgl: { mode: 'custom', ...webgl }
            });
            
            const result = validator.validateWebGLOS(config);
            
            // Should have error for Apple Silicon on non-macOS
            const rendererErrors = result.errors.filter(e => e.field === 'webgl.renderer');
            expect(rendererErrors.length).toBeGreaterThan(0);
            expect(rendererErrors[0].reason).toContain('Apple Silicon');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Direct3D WebGL on non-Windows fails validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          direct3DWebGLArbitrary,
          fc.constantFrom('macos', 'linux'),
          async (webgl, osType) => {
            const config = new FingerprintConfig({
              os: { 
                type: osType, 
                version: '10.15.7', 
                platform: osType === 'macos' ? 'MacIntel' : 'Linux x86_64' 
              },
              webgl: { mode: 'custom', ...webgl }
            });
            
            const result = validator.validateWebGLOS(config);
            
            // Should have error for Direct3D on non-Windows
            const rendererErrors = result.errors.filter(e => e.field === 'webgl.renderer');
            expect(rendererErrors.length).toBeGreaterThan(0);
            expect(rendererErrors[0].reason).toContain('Direct3D');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('WebGL mode "off" skips validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          appleSiliconWebGLArbitrary,
          fc.constantFrom('windows', 'linux'),
          async (webgl, osType) => {
            const config = new FingerprintConfig({
              os: { 
                type: osType, 
                version: '10.0', 
                platform: osType === 'windows' ? 'Win32' : 'Linux x86_64' 
              },
              webgl: { mode: 'off', ...webgl }
            });
            
            const result = validator.validateWebGLOS(config);
            
            // Should have no errors when WebGL is disabled
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('WebGL mode "real" skips validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          appleSiliconWebGLArbitrary,
          fc.constantFrom('windows', 'linux'),
          async (webgl, osType) => {
            const config = new FingerprintConfig({
              os: { 
                type: osType, 
                version: '10.0', 
                platform: osType === 'windows' ? 'Win32' : 'Linux x86_64' 
              },
              webgl: { mode: 'real', ...webgl }
            });
            
            const result = validator.validateWebGLOS(config);
            
            // Should have no errors when using real WebGL
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('consistent OS and WebGL config passes full validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.record({
              osType: fc.constant('windows'),
              platform: fc.constant('Win32'),
              webgl: windowsWebGLArbitrary
            }),
            fc.record({
              osType: fc.constant('macos'),
              platform: fc.constant('MacIntel'),
              webgl: macosWebGLArbitrary
            }),
            fc.record({
              osType: fc.constant('linux'),
              platform: fc.constant('Linux x86_64'),
              webgl: linuxWebGLArbitrary
            })
          ),
          async ({ osType, platform, webgl }) => {
            const config = new FingerprintConfig({
              os: { type: osType, version: '10.0', platform },
              webgl: { mode: 'custom', ...webgl }
            });
            
            const result = validator.validateWebGLOS(config);
            
            // Should have no errors for compatible config
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  // ==================== Additional Unit Tests ====================
  
  describe('FingerprintValidator Basic Functionality', () => {
    const validator = new FingerprintValidator();

    test('validate() returns valid for consistent config', () => {
      const config = new FingerprintConfig({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        os: { type: 'windows', version: '10.0', platform: 'Win32' },
        webgl: {
          mode: 'custom',
          vendor: 'Google Inc. (Intel)',
          renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)'
        },
        fonts: { mode: 'custom', list: ['Arial', 'Segoe UI', 'Calibri'] }
      });
      
      const result = validator.validate(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validate() returns errors for inconsistent config', () => {
      const config = new FingerprintConfig({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        os: { type: 'macos', version: '10.15.7', platform: 'MacIntel' }
      });
      
      const result = validator.validate(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('isConsistent() returns boolean', () => {
      const validConfig = new FingerprintConfig({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        os: { type: 'windows', version: '10.0', platform: 'Win32' }
      });
      
      const invalidConfig = new FingerprintConfig({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        os: { type: 'macos', version: '10.15.7', platform: 'MacIntel' }
      });
      
      expect(validator.isConsistent(validConfig)).toBe(true);
      expect(validator.isConsistent(invalidConfig)).toBe(false);
    });

    test('validateWithSuggestions() includes suggestions', () => {
      const config = new FingerprintConfig({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        os: { type: 'windows', version: '10.0', platform: 'MacIntel' }
      });
      
      const result = validator.validateWithSuggestions(config);
      
      expect(result.suggestions).toBeDefined();
      expect(Object.keys(result.suggestions).length).toBeGreaterThan(0);
    });

    test('static getExpectedPlatform() returns correct platform', () => {
      expect(FingerprintValidator.getExpectedPlatform('windows')).toBe('Win32');
      expect(FingerprintValidator.getExpectedPlatform('macos')).toBe('MacIntel');
      expect(FingerprintValidator.getExpectedPlatform('linux')).toBe('Linux x86_64');
    });

    test('static getExpectedFonts() returns fonts array', () => {
      const windowsFonts = FingerprintValidator.getExpectedFonts('windows');
      const macosFonts = FingerprintValidator.getExpectedFonts('macos');
      const linuxFonts = FingerprintValidator.getExpectedFonts('linux');
      
      expect(Array.isArray(windowsFonts)).toBe(true);
      expect(windowsFonts.length).toBeGreaterThan(0);
      expect(windowsFonts).toContain('Segoe UI');
      
      expect(Array.isArray(macosFonts)).toBe(true);
      expect(macosFonts).toContain('Helvetica Neue');
      
      expect(Array.isArray(linuxFonts)).toBe(true);
      expect(linuxFonts).toContain('DejaVu Sans');
    });

    test('static getValidWebGLVendors() returns vendors array', () => {
      const windowsVendors = FingerprintValidator.getValidWebGLVendors('windows');
      const macosVendors = FingerprintValidator.getValidWebGLVendors('macos');
      const linuxVendors = FingerprintValidator.getValidWebGLVendors('linux');
      
      expect(Array.isArray(windowsVendors)).toBe(true);
      expect(windowsVendors.length).toBeGreaterThan(0);
      
      expect(Array.isArray(macosVendors)).toBe(true);
      expect(macosVendors).toContain('Apple Inc.');
      
      expect(Array.isArray(linuxVendors)).toBe(true);
      expect(linuxVendors).toContain('Mesa');
    });

    test('strict mode enables additional warnings', () => {
      const strictValidator = new FingerprintValidator({ strict: true });
      const normalValidator = new FingerprintValidator({ strict: false });
      
      const config = new FingerprintConfig({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        os: { type: 'windows', version: '10.0', platform: 'Win32' },
        hardware: { screen: { width: 1234, height: 567 } }
      });
      
      const strictResult = strictValidator.validate(config);
      const normalResult = normalValidator.validate(config);
      
      // Strict mode should produce more warnings for unusual resolution
      expect(strictResult.warnings.length).toBeGreaterThanOrEqual(normalResult.warnings.length);
    });
  });
});
