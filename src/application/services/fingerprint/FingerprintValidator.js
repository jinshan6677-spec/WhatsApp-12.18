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
const { validateUserAgentPlatform, getExpectedPlatform } = require('./validator/uaPlatform');
const { validateWebGLOS, getValidWebGLVendors } = require('./validator/webgl');
const { validateFontsOS, getExpectedFonts } = require('./validator/fonts');
const { validateResolution } = require('./validator/screen');
const constants = require('./validator/constants');

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
    const uaPlatformResult = validateUserAgentPlatform(fpConfig);
    errors.push(...uaPlatformResult.errors);
    warnings.push(...uaPlatformResult.warnings);

    const webglOSResult = validateWebGLOS(fpConfig);
    errors.push(...webglOSResult.errors);
    warnings.push(...webglOSResult.warnings);

    const fontsOSResult = validateFontsOS(fpConfig, this.strict);
    errors.push(...fontsOSResult.errors);
    warnings.push(...fontsOSResult.warnings);

    const resolutionResult = validateResolution(fpConfig, this.strict);
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
  validateUserAgentPlatform(config) { return validateUserAgentPlatform(config); }

  /**
   * Validates WebGL renderer and OS compatibility
   * 
   * Requirement 29.2: When saving fingerprint configuration, the system should
   * validate WebGL renderer and OS compatibility
   * 
   * @param {FingerprintConfig} config - The fingerprint configuration
   * @returns {{errors: Array<ValidationError>, warnings: Array<ValidationWarning>}}
   */
  validateWebGLOS(config) { return validateWebGLOS(config); }

  /**
   * Validates font list and OS matching
   * 
   * Requirement 29.4: When saving fingerprint configuration, the system should
   * validate font list and OS matching
   * 
   * @param {FingerprintConfig} config - The fingerprint configuration
   * @returns {{errors: Array<ValidationError>, warnings: Array<ValidationWarning>}}
   */
  validateFontsOS(config) { return validateFontsOS(config, this.strict); }

  /**
   * Validates screen resolution and device type reasonability
   * 
   * Requirement 29.3: When saving fingerprint configuration, the system should
   * validate screen resolution and device type reasonability
   * 
   * @param {FingerprintConfig} config - The fingerprint configuration
   * @returns {{errors: Array<ValidationError>, warnings: Array<ValidationWarning>}}
   */
  validateResolution(config) { return validateResolution(config, this.strict); }

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
  static getExpectedPlatform(osType) { return getExpectedPlatform(osType); }

  /**
   * Gets the expected fonts for a given OS type
   * 
   * @param {string} osType - The OS type (windows, macos, linux)
   * @returns {Array<string>} Array of expected fonts
   */
  static getExpectedFonts(osType) { return getExpectedFonts(osType); }

  /**
   * Gets valid WebGL vendors for a given OS type
   * 
   * @param {string} osType - The OS type (windows, macos, linux)
   * @returns {Array<string>} Array of valid WebGL vendors
   */
  static getValidWebGLVendors(osType) { return getValidWebGLVendors(osType); }
}

// Export constants for external use
FingerprintValidator.WINDOWS_FONTS = constants.WINDOWS_FONTS;
FingerprintValidator.MACOS_FONTS = constants.MACOS_FONTS;
FingerprintValidator.LINUX_FONTS = constants.LINUX_FONTS;
FingerprintValidator.WINDOWS_WEBGL_VENDORS = constants.WINDOWS_WEBGL_VENDORS;
FingerprintValidator.MACOS_WEBGL_VENDORS = constants.MACOS_WEBGL_VENDORS;
FingerprintValidator.LINUX_WEBGL_VENDORS = constants.LINUX_WEBGL_VENDORS;
FingerprintValidator.COMMON_RESOLUTIONS = constants.COMMON_RESOLUTIONS;

module.exports = FingerprintValidator;
