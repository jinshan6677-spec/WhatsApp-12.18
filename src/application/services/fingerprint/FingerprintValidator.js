'use strict';

/**
 * FingerprintValidator - Fingerprint Configuration Consistency Validator
 * 
 * Validates fingerprint configurations for internal consistency, ensuring
 * that all components (User-Agent, platform, WebGL, fonts, etc.) are
 * compatible with each other and represent a realistic browser profile.
 * 
 * Requirements: 29.1, 29.2, 29.3, 29.4, 29.5
 * 
 * Key Validations:
 * - User-Agent and platform string consistency
 * - WebGL renderer and OS compatibility
 * - Screen resolution and device type reasonability
 * - Font list and OS matching
 */

const FingerprintConfig = require('../../../domain/fingerprint/FingerprintConfig');

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the configuration is valid
 * @property {Array<ValidationError>} errors - List of validation errors
 * @property {Array<ValidationWarning>} warnings - List of validation warnings (non-blocking)
 */

/**
 * Validation error structure
 * @typedef {Object} ValidationError
 * @property {string} field - The field that failed validation
 * @property {string} reason - Human-readable error description
 * @property {*} value - The invalid value
 * @property {string} [suggestion] - Optional fix suggestion
 */

/**
 * Validation warning structure
 * @typedef {Object} ValidationWarning
 * @property {string} field - The field with a warning
 * @property {string} reason - Human-readable warning description
 * @property {*} value - The value that triggered the warning
 * @property {string} [suggestion] - Optional improvement suggestion
 */

// ==================== Constants ====================

/**
 * Common Windows fonts
 */
const WINDOWS_FONTS = [
  'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas',
  'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Segoe UI', 'Tahoma',
  'Times New Roman', 'Trebuchet MS', 'Verdana', 'Microsoft Sans Serif',
  'Palatino Linotype', 'Lucida Sans Unicode', 'Franklin Gothic Medium'
];

/**
 * Common macOS fonts
 */
const MACOS_FONTS = [
  'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
  'Helvetica', 'Helvetica Neue', 'Impact', 'Lucida Grande', 'Monaco',
  'Palatino', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
  'SF Pro Display', 'SF Pro Text', 'Menlo', 'Avenir', 'Futura'
];

/**
 * Common Linux fonts
 */
const LINUX_FONTS = [
  'Arial', 'Bitstream Vera Sans', 'Courier New', 'DejaVu Sans',
  'DejaVu Sans Mono', 'DejaVu Serif', 'Droid Sans', 'FreeMono',
  'FreeSans', 'FreeSerif', 'Georgia', 'Liberation Mono', 'Liberation Sans',
  'Liberation Serif', 'Noto Sans', 'Times New Roman', 'Ubuntu', 'Verdana'
];

/**
 * Windows-compatible WebGL vendors
 */
const WINDOWS_WEBGL_VENDORS = [
  'Google Inc.', 'Google Inc. (Intel)', 'Google Inc. (NVIDIA)', 'Google Inc. (AMD)',
  'Intel Inc.', 'NVIDIA Corporation', 'ATI Technologies Inc.', 'AMD'
];

/**
 * macOS-compatible WebGL vendors
 */
const MACOS_WEBGL_VENDORS = [
  'Google Inc.', 'Google Inc. (Apple)', 'Google Inc. (Intel)', 'Google Inc. (AMD)',
  'Apple Inc.', 'Intel Inc.', 'AMD'
];

/**
 * Linux-compatible WebGL vendors
 */
const LINUX_WEBGL_VENDORS = [
  'Google Inc.', 'Google Inc. (Intel)', 'Google Inc. (NVIDIA)', 'Google Inc. (AMD)',
  'Intel', 'NVIDIA Corporation', 'AMD', 'Mesa', 'X.Org'
];

/**
 * Common screen resolutions by device type
 */
const COMMON_RESOLUTIONS = {
  desktop: [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1680, height: 1050 },
    { width: 3840, height: 2160 },
    { width: 2880, height: 1800 },
    { width: 2560, height: 1600 }
  ],
  laptop: [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 2560, height: 1600 },
    { width: 2880, height: 1800 }
  ]
};


// ==================== FingerprintValidator Class ====================

/**
 * FingerprintValidator class for validating fingerprint configuration consistency
 */
class FingerprintValidator {
  /**
   * Creates a FingerprintValidator instance
   * @param {Object} [options] - Validator options
   * @param {boolean} [options.strict=false] - Enable strict validation mode
   */
  constructor(options = {}) {
    this.strict = options.strict || false;
  }

  /**
   * Validates a fingerprint configuration for internal consistency
   * 
   * @param {FingerprintConfig|Object} config - The fingerprint configuration to validate
   * @returns {ValidationResult} Validation result with errors and warnings
   */
  validate(config) {
    const errors = [];
    const warnings = [];

    // Ensure we have a FingerprintConfig instance
    const fpConfig = config instanceof FingerprintConfig 
      ? config 
      : new FingerprintConfig(config);

    // First, run basic field validation from FingerprintConfig
    const basicValidation = fpConfig.validate();
    if (!basicValidation.valid) {
      errors.push(...basicValidation.errors);
    }

    // Run consistency validations
    const uaPlatformResult = this.validateUserAgentPlatform(fpConfig);
    errors.push(...uaPlatformResult.errors);
    warnings.push(...uaPlatformResult.warnings);

    const webglOSResult = this.validateWebGLOS(fpConfig);
    errors.push(...webglOSResult.errors);
    warnings.push(...webglOSResult.warnings);

    const fontsOSResult = this.validateFontsOS(fpConfig);
    errors.push(...fontsOSResult.errors);
    warnings.push(...fontsOSResult.warnings);

    const resolutionResult = this.validateResolution(fpConfig);
    errors.push(...resolutionResult.errors);
    warnings.push(...resolutionResult.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates User-Agent and platform string consistency
   * 
   * Requirement 29.1: When saving fingerprint configuration, the system should
   * validate User-Agent and platform string consistency
   * 
   * @param {FingerprintConfig} config - The fingerprint configuration
   * @returns {{errors: Array<ValidationError>, warnings: Array<ValidationWarning>}}
   */
  validateUserAgentPlatform(config) {
    const errors = [];
    const warnings = [];
    const userAgent = config.userAgent || '';
    const platform = config.os?.platform || '';
    const osType = config.os?.type || '';

    // Check User-Agent contains OS indicators
    const uaLower = userAgent.toLowerCase();
    const hasWindows = uaLower.includes('windows');
    const hasMac = uaLower.includes('macintosh') || uaLower.includes('mac os');
    const hasLinux = uaLower.includes('linux') && !uaLower.includes('android');

    // Validate platform matches User-Agent
    if (hasWindows) {
      if (platform !== 'Win32') {
        errors.push({
          field: 'os.platform',
          reason: 'User-Agent indicates Windows but platform is not "Win32"',
          value: platform,
          suggestion: 'Set platform to "Win32" for Windows User-Agent'
        });
      }
      if (osType !== 'windows') {
        errors.push({
          field: 'os.type',
          reason: 'User-Agent indicates Windows but os.type is not "windows"',
          value: osType,
          suggestion: 'Set os.type to "windows" for Windows User-Agent'
        });
      }
    } else if (hasMac) {
      if (platform !== 'MacIntel') {
        errors.push({
          field: 'os.platform',
          reason: 'User-Agent indicates macOS but platform is not "MacIntel"',
          value: platform,
          suggestion: 'Set platform to "MacIntel" for macOS User-Agent'
        });
      }
      if (osType !== 'macos') {
        errors.push({
          field: 'os.type',
          reason: 'User-Agent indicates macOS but os.type is not "macos"',
          value: osType,
          suggestion: 'Set os.type to "macos" for macOS User-Agent'
        });
      }
    } else if (hasLinux) {
      const validLinuxPlatforms = ['Linux x86_64', 'Linux armv7l', 'Linux aarch64'];
      if (!validLinuxPlatforms.includes(platform)) {
        errors.push({
          field: 'os.platform',
          reason: 'User-Agent indicates Linux but platform is not a valid Linux platform',
          value: platform,
          suggestion: 'Set platform to "Linux x86_64" for Linux User-Agent'
        });
      }
      if (osType !== 'linux') {
        errors.push({
          field: 'os.type',
          reason: 'User-Agent indicates Linux but os.type is not "linux"',
          value: osType,
          suggestion: 'Set os.type to "linux" for Linux User-Agent'
        });
      }
    }

    // Check browser type consistency
    const browserType = config.browser?.type || '';
    const hasChrome = uaLower.includes('chrome') && !uaLower.includes('edg');
    const hasFirefox = uaLower.includes('firefox');
    const hasEdge = uaLower.includes('edg/') || uaLower.includes('edge/');
    const hasSafari = uaLower.includes('safari') && !uaLower.includes('chrome');

    if (hasChrome && browserType !== 'chrome') {
      warnings.push({
        field: 'browser.type',
        reason: 'User-Agent indicates Chrome but browser.type does not match',
        value: browserType,
        suggestion: 'Set browser.type to "chrome"'
      });
    } else if (hasFirefox && browserType !== 'firefox') {
      warnings.push({
        field: 'browser.type',
        reason: 'User-Agent indicates Firefox but browser.type does not match',
        value: browserType,
        suggestion: 'Set browser.type to "firefox"'
      });
    } else if (hasEdge && browserType !== 'edge') {
      warnings.push({
        field: 'browser.type',
        reason: 'User-Agent indicates Edge but browser.type does not match',
        value: browserType,
        suggestion: 'Set browser.type to "edge"'
      });
    } else if (hasSafari && browserType !== 'safari') {
      warnings.push({
        field: 'browser.type',
        reason: 'User-Agent indicates Safari but browser.type does not match',
        value: browserType,
        suggestion: 'Set browser.type to "safari"'
      });
    }

    // Safari should only be on macOS
    if (browserType === 'safari' && osType !== 'macos') {
      errors.push({
        field: 'browser.type',
        reason: 'Safari browser is only available on macOS',
        value: browserType,
        suggestion: 'Change browser type or set os.type to "macos"'
      });
    }

    return { errors, warnings };
  }

  /**
   * Validates WebGL renderer and OS compatibility
   * 
   * Requirement 29.2: When saving fingerprint configuration, the system should
   * validate WebGL renderer and OS compatibility
   * 
   * @param {FingerprintConfig} config - The fingerprint configuration
   * @returns {{errors: Array<ValidationError>, warnings: Array<ValidationWarning>}}
   */
  validateWebGLOS(config) {
    const errors = [];
    const warnings = [];
    const osType = config.os?.type || '';
    const webglMode = config.webgl?.mode || 'custom';

    // Skip validation if WebGL is disabled or using real values
    if (webglMode === 'off' || webglMode === 'real') {
      return { errors, warnings };
    }

    const vendor = config.webgl?.vendor || '';
    const renderer = config.webgl?.renderer || '';
    const unmaskedVendor = config.webgl?.unmaskedVendor || '';
    const unmaskedRenderer = config.webgl?.unmaskedRenderer || '';

    // Get valid vendors for the OS
    let validVendors;
    switch (osType) {
      case 'windows':
        validVendors = WINDOWS_WEBGL_VENDORS;
        break;
      case 'macos':
        validVendors = MACOS_WEBGL_VENDORS;
        break;
      case 'linux':
        validVendors = LINUX_WEBGL_VENDORS;
        break;
      default:
        validVendors = [...WINDOWS_WEBGL_VENDORS, ...MACOS_WEBGL_VENDORS, ...LINUX_WEBGL_VENDORS];
    }

    // Check vendor compatibility
    const vendorLower = vendor.toLowerCase();
    const isValidVendor = validVendors.some(v => vendorLower.includes(v.toLowerCase()));
    
    if (!isValidVendor && vendor) {
      warnings.push({
        field: 'webgl.vendor',
        reason: `WebGL vendor "${vendor}" may not be compatible with ${osType}`,
        value: vendor,
        suggestion: `Consider using a vendor compatible with ${osType}`
      });
    }

    // Check for Apple GPU on non-macOS
    const rendererLower = renderer.toLowerCase();
    const unmaskedRendererLower = unmaskedRenderer.toLowerCase();
    
    if (osType !== 'macos') {
      if (rendererLower.includes('apple m') || unmaskedRendererLower.includes('apple m')) {
        errors.push({
          field: 'webgl.renderer',
          reason: 'Apple Silicon GPU (M1/M2/M3) is only available on macOS',
          value: renderer || unmaskedRenderer,
          suggestion: 'Use a GPU renderer compatible with the configured OS'
        });
      }
    }

    // Check for Direct3D on non-Windows
    if (osType !== 'windows') {
      if (rendererLower.includes('direct3d') || rendererLower.includes('d3d11')) {
        errors.push({
          field: 'webgl.renderer',
          reason: 'Direct3D renderer is only available on Windows',
          value: renderer,
          suggestion: 'Use OpenGL or Metal renderer for non-Windows OS'
        });
      }
    }

    // Check for Mesa on Windows
    if (osType === 'windows') {
      if (rendererLower.includes('mesa') || unmaskedRendererLower.includes('mesa')) {
        warnings.push({
          field: 'webgl.renderer',
          reason: 'Mesa renderer is typically found on Linux, not Windows',
          value: renderer || unmaskedRenderer,
          suggestion: 'Consider using ANGLE or native Windows renderer'
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validates font list and OS matching
   * 
   * Requirement 29.4: When saving fingerprint configuration, the system should
   * validate font list and OS matching
   * 
   * @param {FingerprintConfig} config - The fingerprint configuration
   * @returns {{errors: Array<ValidationError>, warnings: Array<ValidationWarning>}}
   */
  validateFontsOS(config) {
    const errors = [];
    const warnings = [];
    const osType = config.os?.type || '';
    const fontsMode = config.fonts?.mode || 'custom';
    const fontList = config.fonts?.list || [];

    // Skip validation if using system fonts
    if (fontsMode === 'system') {
      return { errors, warnings };
    }

    // Get expected fonts for the OS
    let expectedFonts;
    let osSpecificFonts;
    switch (osType) {
      case 'windows':
        expectedFonts = WINDOWS_FONTS;
        osSpecificFonts = ['Segoe UI', 'Calibri', 'Consolas'];
        break;
      case 'macos':
        expectedFonts = MACOS_FONTS;
        osSpecificFonts = ['Helvetica Neue', 'SF Pro Display', 'Lucida Grande', 'Monaco'];
        break;
      case 'linux':
        expectedFonts = LINUX_FONTS;
        osSpecificFonts = ['DejaVu Sans', 'Liberation Sans', 'Ubuntu', 'Noto Sans'];
        break;
      default:
        return { errors, warnings };
    }

    // Check if font list contains at least some OS-appropriate fonts
    const hasOSFonts = fontList.some(font => expectedFonts.includes(font));
    
    if (!hasOSFonts && fontList.length > 0) {
      warnings.push({
        field: 'fonts.list',
        reason: `Font list does not contain any fonts typical for ${osType}`,
        value: fontList,
        suggestion: `Consider adding fonts like: ${osSpecificFonts.join(', ')}`
      });
    }

    // Check for OS-specific fonts that shouldn't appear on other OSes
    if (osType !== 'windows') {
      const windowsOnlyFonts = ['Segoe UI', 'Calibri', 'Consolas'];
      const hasWindowsFonts = fontList.some(font => windowsOnlyFonts.includes(font));
      if (hasWindowsFonts) {
        warnings.push({
          field: 'fonts.list',
          reason: 'Font list contains Windows-specific fonts on non-Windows OS',
          value: fontList.filter(f => windowsOnlyFonts.includes(f)),
          suggestion: 'Remove Windows-specific fonts for better consistency'
        });
      }
    }

    if (osType !== 'macos') {
      const macOnlyFonts = ['SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Lucida Grande'];
      const hasMacFonts = fontList.some(font => macOnlyFonts.includes(font));
      if (hasMacFonts) {
        warnings.push({
          field: 'fonts.list',
          reason: 'Font list contains macOS-specific fonts on non-macOS',
          value: fontList.filter(f => macOnlyFonts.includes(f)),
          suggestion: 'Remove macOS-specific fonts for better consistency'
        });
      }
    }

    if (osType !== 'linux') {
      const linuxOnlyFonts = ['DejaVu Sans', 'Liberation Sans', 'Ubuntu', 'Noto Sans'];
      const hasLinuxFonts = fontList.some(font => linuxOnlyFonts.includes(font));
      if (hasLinuxFonts && this.strict) {
        warnings.push({
          field: 'fonts.list',
          reason: 'Font list contains Linux-specific fonts on non-Linux OS',
          value: fontList.filter(f => linuxOnlyFonts.includes(f)),
          suggestion: 'Remove Linux-specific fonts for better consistency'
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validates screen resolution and device type reasonability
   * 
   * Requirement 29.3: When saving fingerprint configuration, the system should
   * validate screen resolution and device type reasonability
   * 
   * @param {FingerprintConfig} config - The fingerprint configuration
   * @returns {{errors: Array<ValidationError>, warnings: Array<ValidationWarning>}}
   */
  validateResolution(config) {
    const errors = [];
    const warnings = [];
    const screen = config.hardware?.screen || {};
    const width = screen.width || 0;
    const height = screen.height || 0;
    const availWidth = screen.availWidth || 0;
    const availHeight = screen.availHeight || 0;
    const devicePixelRatio = config.hardware?.devicePixelRatio || 1;
    const osType = config.os?.type || '';

    // Check if resolution is a common one
    const allResolutions = [...COMMON_RESOLUTIONS.desktop, ...COMMON_RESOLUTIONS.laptop];
    const isCommonResolution = allResolutions.some(
      r => r.width === width && r.height === height
    );

    if (!isCommonResolution && this.strict) {
      warnings.push({
        field: 'hardware.screen',
        reason: `Screen resolution ${width}x${height} is not a common resolution`,
        value: { width, height },
        suggestion: 'Consider using a common resolution like 1920x1080 or 1366x768'
      });
    }

    // Check aspect ratio is reasonable (between 4:3 and 21:9)
    const aspectRatio = width / height;
    if (aspectRatio < 1.2 || aspectRatio > 2.5) {
      warnings.push({
        field: 'hardware.screen',
        reason: `Screen aspect ratio ${aspectRatio.toFixed(2)} is unusual`,
        value: { width, height, aspectRatio },
        suggestion: 'Most screens have aspect ratios between 4:3 (1.33) and 21:9 (2.33)'
      });
    }

    // Check availWidth/availHeight are less than or equal to width/height
    if (availWidth > width) {
      errors.push({
        field: 'hardware.screen.availWidth',
        reason: 'Available width cannot be greater than screen width',
        value: { availWidth, width },
        suggestion: 'Set availWidth to be less than or equal to width'
      });
    }

    if (availHeight > height) {
      errors.push({
        field: 'hardware.screen.availHeight',
        reason: 'Available height cannot be greater than screen height',
        value: { availHeight, height },
        suggestion: 'Set availHeight to be less than or equal to height'
      });
    }

    // Check device pixel ratio is appropriate for OS
    if (osType === 'macos' && devicePixelRatio < 2) {
      warnings.push({
        field: 'hardware.devicePixelRatio',
        reason: 'Most modern Macs have Retina displays with devicePixelRatio of 2',
        value: devicePixelRatio,
        suggestion: 'Consider setting devicePixelRatio to 2 for macOS'
      });
    }

    // Check for very high resolutions with low pixel ratio
    if (width >= 3840 && devicePixelRatio < 1.5) {
      warnings.push({
        field: 'hardware.devicePixelRatio',
        reason: '4K+ resolution typically has higher devicePixelRatio',
        value: { width, devicePixelRatio },
        suggestion: 'Consider increasing devicePixelRatio for high-resolution displays'
      });
    }

    return { errors, warnings };
  }

  /**
   * Validates and returns suggestions for fixing inconsistencies
   * 
   * @param {FingerprintConfig|Object} config - The fingerprint configuration
   * @returns {{valid: boolean, errors: Array, warnings: Array, suggestions: Object}}
   */
  validateWithSuggestions(config) {
    const result = this.validate(config);
    
    // Build suggestions object from errors and warnings
    const suggestions = {};
    
    for (const error of result.errors) {
      if (error.suggestion) {
        suggestions[error.field] = error.suggestion;
      }
    }
    
    for (const warning of result.warnings) {
      if (warning.suggestion && !suggestions[warning.field]) {
        suggestions[warning.field] = warning.suggestion;
      }
    }

    return {
      ...result,
      suggestions
    };
  }

  /**
   * Checks if a configuration is consistent (no errors, warnings allowed)
   * 
   * @param {FingerprintConfig|Object} config - The fingerprint configuration
   * @returns {boolean} True if configuration has no errors
   */
  isConsistent(config) {
    const result = this.validate(config);
    return result.valid;
  }

  /**
   * Gets the expected platform for a given OS type
   * 
   * @param {string} osType - The OS type (windows, macos, linux)
   * @returns {string} The expected platform string
   */
  static getExpectedPlatform(osType) {
    switch (osType) {
      case 'windows':
        return 'Win32';
      case 'macos':
        return 'MacIntel';
      case 'linux':
        return 'Linux x86_64';
      default:
        return 'Win32';
    }
  }

  /**
   * Gets the expected fonts for a given OS type
   * 
   * @param {string} osType - The OS type (windows, macos, linux)
   * @returns {Array<string>} Array of expected fonts
   */
  static getExpectedFonts(osType) {
    switch (osType) {
      case 'windows':
        return [...WINDOWS_FONTS];
      case 'macos':
        return [...MACOS_FONTS];
      case 'linux':
        return [...LINUX_FONTS];
      default:
        return [...WINDOWS_FONTS];
    }
  }

  /**
   * Gets valid WebGL vendors for a given OS type
   * 
   * @param {string} osType - The OS type (windows, macos, linux)
   * @returns {Array<string>} Array of valid WebGL vendors
   */
  static getValidWebGLVendors(osType) {
    switch (osType) {
      case 'windows':
        return [...WINDOWS_WEBGL_VENDORS];
      case 'macos':
        return [...MACOS_WEBGL_VENDORS];
      case 'linux':
        return [...LINUX_WEBGL_VENDORS];
      default:
        return [...WINDOWS_WEBGL_VENDORS];
    }
  }
}

// Export constants for external use
FingerprintValidator.WINDOWS_FONTS = WINDOWS_FONTS;
FingerprintValidator.MACOS_FONTS = MACOS_FONTS;
FingerprintValidator.LINUX_FONTS = LINUX_FONTS;
FingerprintValidator.WINDOWS_WEBGL_VENDORS = WINDOWS_WEBGL_VENDORS;
FingerprintValidator.MACOS_WEBGL_VENDORS = MACOS_WEBGL_VENDORS;
FingerprintValidator.LINUX_WEBGL_VENDORS = LINUX_WEBGL_VENDORS;
FingerprintValidator.COMMON_RESOLUTIONS = COMMON_RESOLUTIONS;

module.exports = FingerprintValidator;
