/**
 * Timezone Spoofing Script
 * 时区伪装脚本
 * 
 * Implements spoofing for timezone-related APIs to prevent fingerprinting
 * and location tracking based on timezone information.
 * 
 * Covered APIs:
 * - Date.prototype.getTimezoneOffset (Req 11.1)
 * - Intl.DateTimeFormat (Req 11.2, 11.3)
 * - Intl.DateTimeFormat().resolvedOptions().timeZone (Req 11.3)
 * 
 * Modes:
 * - 'custom': Use configured timezone (Req 11.1, 11.2, 11.3)
 * - 'auto': Auto-detect based on proxy IP (Req 11.4)
 * - 'real': Return real system timezone (Req 11.5)
 * 
 * @module infrastructure/fingerprint/injection-scripts/timezone
 * 
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');

/**
 * Error class for timezone spoofing operations
 */
class TimezoneSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'TimezoneSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * TimezoneSpoof class
 * Provides methods to spoof timezone-related APIs
 */
class TimezoneSpoof {
  /**
   * Default timezone configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'custom',              // 'custom', 'auto', 'real'
    name: 'America/New_York',    // IANA timezone name
    offset: -300                 // Offset in minutes (negative = west of UTC)
  };

  /**
   * Store for original method references
   * @private
   */
  static _originalMethods = {};

  /**
   * Store for original constructors
   * @private
   */
  static _originalConstructors = {};

  /**
   * Store for applied configuration
   * @private
   */
  static _appliedConfig = null;

  /**
   * Common timezone data mapping timezone names to offsets
   * Note: This is simplified; real offsets vary with DST
   * @private
   */
  static _timezoneData = {
    'UTC': 0,
    'GMT': 0,
    'America/New_York': -300,      // EST: -5 hours
    'America/Chicago': -360,        // CST: -6 hours
    'America/Denver': -420,         // MST: -7 hours
    'America/Los_Angeles': -480,    // PST: -8 hours
    'America/Anchorage': -540,      // AKST: -9 hours
    'Pacific/Honolulu': -600,       // HST: -10 hours
    'America/Sao_Paulo': -180,      // BRT: -3 hours
    'Europe/London': 0,             // GMT: 0 hours
    'Europe/Paris': 60,             // CET: +1 hour
    'Europe/Berlin': 60,            // CET: +1 hour
    'Europe/Moscow': 180,           // MSK: +3 hours
    'Asia/Dubai': 240,              // GST: +4 hours
    'Asia/Kolkata': 330,            // IST: +5:30 hours
    'Asia/Bangkok': 420,            // ICT: +7 hours
    'Asia/Shanghai': 480,           // CST: +8 hours
    'Asia/Tokyo': 540,              // JST: +9 hours
    'Australia/Sydney': 600,        // AEST: +10 hours
    'Pacific/Auckland': 720         // NZST: +12 hours
  };

  /**
   * Apply timezone spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='custom'] - Spoofing mode: 'custom', 'auto', or 'real'
   * @param {string} [config.name='America/New_York'] - IANA timezone name (Req 11.3)
   * @param {number} [config.offset=-300] - Timezone offset in minutes (Req 11.1)
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = { ...TimezoneSpoof._defaultConfig, ...config };
    
    // Validate mode
    if (!['custom', 'auto', 'real'].includes(mergedConfig.mode)) {
      throw new TimezoneSpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'custom', 'auto', or 'real'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // Validate offset (must be a number between -720 and 840 minutes)
    if (typeof mergedConfig.offset !== 'number' || 
        mergedConfig.offset < -720 || 
        mergedConfig.offset > 840) {
      throw new TimezoneSpoofError(
        `Invalid offset: ${mergedConfig.offset}. Must be a number between -720 and 840`,
        'INVALID_OFFSET',
        { offset: mergedConfig.offset }
      );
    }

    // Validate timezone name
    if (typeof mergedConfig.name !== 'string' || mergedConfig.name.length === 0) {
      throw new TimezoneSpoofError(
        `Invalid timezone name: ${mergedConfig.name}. Must be a non-empty string`,
        'INVALID_TIMEZONE_NAME',
        { name: mergedConfig.name }
      );
    }

    // Store the applied configuration
    TimezoneSpoof._appliedConfig = mergedConfig;

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // If mode is 'real', don't apply any spoofing
    if (mergedConfig.mode === 'real') {
      results.spoofed.push('mode:real (no spoofing)');
      return results;
    }

    // Spoof Date.prototype.getTimezoneOffset (Req 11.1)
    try {
      TimezoneSpoof._spoofGetTimezoneOffset();
      results.spoofed.push('getTimezoneOffset');
    } catch (e) {
      results.failed.push({ method: 'getTimezoneOffset', error: e.message });
      results.success = false;
    }

    // Spoof Intl.DateTimeFormat (Req 11.2, 11.3)
    try {
      TimezoneSpoof._spoofIntlDateTimeFormat();
      results.spoofed.push('Intl.DateTimeFormat');
    } catch (e) {
      results.failed.push({ method: 'Intl.DateTimeFormat', error: e.message });
      results.success = false;
    }

    return results;
  }

  /**
   * Spoof Date.prototype.getTimezoneOffset
   * Requirement 11.1: Override to return configured offset
   * @private
   */
  static _spoofGetTimezoneOffset() {
    // Check if Date exists (should always exist)
    if (typeof Date === 'undefined') {
      return;
    }

    const proto = Date.prototype;
    const originalGetTimezoneOffset = proto.getTimezoneOffset;

    // Store original method
    TimezoneSpoof._originalMethods.getTimezoneOffset = originalGetTimezoneOffset;

    // Create wrapped function
    const wrappedGetTimezoneOffset = NativeWrapper.wrap(
      originalGetTimezoneOffset,
      function(original, args, thisArg) {
        const config = TimezoneSpoof._appliedConfig;

        // If mode is 'real' or no config, return original result
        if (!config || config.mode === 'real') {
          return original.apply(thisArg, args);
        }

        // Return configured offset (Req 11.1)
        // Note: getTimezoneOffset returns the difference in minutes between UTC and local time
        // A positive value means the local timezone is behind UTC (west)
        // Our config stores offset as negative for west, so we negate it
        return -config.offset;
      },
      { name: 'getTimezoneOffset', length: 0 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'getTimezoneOffset', wrappedGetTimezoneOffset);
  }

  /**
   * Spoof Intl.DateTimeFormat
   * Requirements 11.2, 11.3: Use configured timezone in DateTimeFormat
   * @private
   */
  static _spoofIntlDateTimeFormat() {
    // Check if Intl exists
    if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat === 'undefined') {
      return;
    }

    const OriginalDateTimeFormat = Intl.DateTimeFormat;

    // Store original constructor
    TimezoneSpoof._originalConstructors.DateTimeFormat = OriginalDateTimeFormat;

    // Create a new DateTimeFormat constructor that injects our timezone
    const SpoofedDateTimeFormat = function(locales, options) {
      const config = TimezoneSpoof._appliedConfig;

      // If mode is 'real' or no config, use original behavior
      if (!config || config.mode === 'real') {
        return new OriginalDateTimeFormat(locales, options);
      }

      // Merge options with our timezone (Req 11.2)
      const mergedOptions = { ...options };
      
      // Only set timezone if not explicitly provided by the caller
      if (!mergedOptions.timeZone) {
        mergedOptions.timeZone = config.name;
      }

      return new OriginalDateTimeFormat(locales, mergedOptions);
    };

    // Make the constructor appear native
    Object.defineProperty(SpoofedDateTimeFormat, 'name', {
      value: 'DateTimeFormat',
      writable: false,
      enumerable: false,
      configurable: true
    });

    Object.defineProperty(SpoofedDateTimeFormat, 'length', {
      value: 0,
      writable: false,
      enumerable: false,
      configurable: true
    });

    // Override toString to return native code
    const nativeToString = 'function DateTimeFormat() { [native code] }';
    SpoofedDateTimeFormat.toString = function() { return nativeToString; };

    // Copy static methods from original
    SpoofedDateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf;

    // Set prototype
    SpoofedDateTimeFormat.prototype = OriginalDateTimeFormat.prototype;

    // Replace Intl.DateTimeFormat
    Object.defineProperty(Intl, 'DateTimeFormat', {
      value: SpoofedDateTimeFormat,
      writable: true,
      enumerable: false,
      configurable: true
    });
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return TimezoneSpoof._appliedConfig ? { ...TimezoneSpoof._appliedConfig } : null;
  }

  /**
   * Get timezone offset from timezone name
   * @param {string} timezoneName - IANA timezone name
   * @returns {number|null} Offset in minutes or null if unknown
   */
  static getOffsetFromName(timezoneName) {
    return TimezoneSpoof._timezoneData[timezoneName] ?? null;
  }

  /**
   * Get all known timezone names
   * @returns {string[]} Array of timezone names
   */
  static getKnownTimezones() {
    return Object.keys(TimezoneSpoof._timezoneData);
  }

  /**
   * Restore original timezone methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    // Restore getTimezoneOffset
    if (TimezoneSpoof._originalMethods.getTimezoneOffset && typeof Date !== 'undefined') {
      try {
        Date.prototype.getTimezoneOffset = TimezoneSpoof._originalMethods.getTimezoneOffset;
        results.restored.push('getTimezoneOffset');
      } catch (e) {
        results.failed.push({ method: 'getTimezoneOffset', error: e.message });
      }
    }

    // Restore Intl.DateTimeFormat
    if (TimezoneSpoof._originalConstructors.DateTimeFormat && typeof Intl !== 'undefined') {
      try {
        Intl.DateTimeFormat = TimezoneSpoof._originalConstructors.DateTimeFormat;
        results.restored.push('Intl.DateTimeFormat');
      } catch (e) {
        results.failed.push({ method: 'Intl.DateTimeFormat', error: e.message });
      }
    }

    // Clear stored data
    TimezoneSpoof._originalMethods = {};
    TimezoneSpoof._originalConstructors = {};
    TimezoneSpoof._appliedConfig = null;

    return results;
  }

  /**
   * Generate injection script string for browser context
   * This creates a self-contained script that can be injected into a page
   * 
   * @param {Object} config - Timezone configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...TimezoneSpoof._defaultConfig, ...config };

    return `
(function() {
  'use strict';
  
  // Timezone spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)},
    name: ${JSON.stringify(mergedConfig.name)},
    offset: ${mergedConfig.offset}
  };
  
  // Skip if mode is 'real'
  if (config.mode === 'real') {
    return;
  }
  
  // Helper to create native-looking function
  function createNativeFunction(name, length, fn) {
    Object.defineProperty(fn, 'name', {
      value: name,
      writable: false,
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(fn, 'length', {
      value: length,
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeStr = 'function ' + name + '() { [native code] }';
    fn.toString = function() { return nativeStr; };
    return fn;
  }
  
  // Spoof Date.prototype.getTimezoneOffset (Req 11.1)
  const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
  Date.prototype.getTimezoneOffset = createNativeFunction('getTimezoneOffset', 0, function() {
    // Return negated offset (getTimezoneOffset returns positive for west of UTC)
    return -config.offset;
  });
  
  // Spoof Intl.DateTimeFormat (Req 11.2, 11.3)
  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat !== 'undefined') {
    const OriginalDateTimeFormat = Intl.DateTimeFormat;
    
    const SpoofedDateTimeFormat = function(locales, options) {
      const mergedOptions = Object.assign({}, options);
      
      // Only set timezone if not explicitly provided
      if (!mergedOptions.timeZone) {
        mergedOptions.timeZone = config.name;
      }
      
      return new OriginalDateTimeFormat(locales, mergedOptions);
    };
    
    // Make constructor appear native
    Object.defineProperty(SpoofedDateTimeFormat, 'name', {
      value: 'DateTimeFormat',
      writable: false,
      enumerable: false,
      configurable: true
    });
    
    Object.defineProperty(SpoofedDateTimeFormat, 'length', {
      value: 0,
      writable: false,
      enumerable: false,
      configurable: true
    });
    
    SpoofedDateTimeFormat.toString = function() {
      return 'function DateTimeFormat() { [native code] }';
    };
    
    // Copy static methods
    SpoofedDateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf;
    
    // Set prototype
    SpoofedDateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
    
    // Replace Intl.DateTimeFormat
    Object.defineProperty(Intl, 'DateTimeFormat', {
      value: SpoofedDateTimeFormat,
      writable: true,
      enumerable: false,
      configurable: true
    });
  }
})();
`;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Timezone configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...TimezoneSpoof._defaultConfig };
    }

    const timezoneConfig = fingerprintConfig.timezone || {};
    
    return {
      mode: timezoneConfig.mode || TimezoneSpoof._defaultConfig.mode,
      name: timezoneConfig.name || TimezoneSpoof._defaultConfig.name,
      offset: timezoneConfig.offset !== undefined ? timezoneConfig.offset : TimezoneSpoof._defaultConfig.offset
    };
  }

  /**
   * Verify that timezone spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Object} Verification result
   */
  static verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = TimezoneSpoof.getAppliedConfig();
    result.checks.configApplied = {
      expected: true,
      actual: appliedConfig !== null,
      pass: appliedConfig !== null
    };

    if (!appliedConfig) {
      result.valid = false;
      return result;
    }

    // Check mode
    if (expectedConfig.mode !== undefined) {
      result.checks.mode = {
        expected: expectedConfig.mode,
        actual: appliedConfig.mode,
        pass: appliedConfig.mode === expectedConfig.mode
      };
      if (!result.checks.mode.pass) result.valid = false;
    }

    // Check timezone name
    if (expectedConfig.name !== undefined) {
      result.checks.name = {
        expected: expectedConfig.name,
        actual: appliedConfig.name,
        pass: appliedConfig.name === expectedConfig.name
      };
      if (!result.checks.name.pass) result.valid = false;
    }

    // Check offset
    if (expectedConfig.offset !== undefined) {
      result.checks.offset = {
        expected: expectedConfig.offset,
        actual: appliedConfig.offset,
        pass: appliedConfig.offset === expectedConfig.offset
      };
      if (!result.checks.offset.pass) result.valid = false;
    }

    // Verify getTimezoneOffset returns expected value (if not in 'real' mode)
    if (appliedConfig.mode !== 'real' && typeof Date !== 'undefined') {
      const testDate = new Date();
      const actualOffset = testDate.getTimezoneOffset();
      const expectedOffset = -appliedConfig.offset;
      
      result.checks.getTimezoneOffset = {
        expected: expectedOffset,
        actual: actualOffset,
        pass: actualOffset === expectedOffset
      };
      if (!result.checks.getTimezoneOffset.pass) result.valid = false;
    }

    // Verify Intl.DateTimeFormat uses configured timezone (if not in 'real' mode)
    if (appliedConfig.mode !== 'real' && typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat !== 'undefined') {
      try {
        const formatter = new Intl.DateTimeFormat();
        const resolvedTimezone = formatter.resolvedOptions().timeZone;
        
        result.checks.intlTimezone = {
          expected: appliedConfig.name,
          actual: resolvedTimezone,
          pass: resolvedTimezone === appliedConfig.name
        };
        if (!result.checks.intlTimezone.pass) result.valid = false;
      } catch (e) {
        result.checks.intlTimezone = {
          expected: appliedConfig.name,
          actual: null,
          pass: false,
          error: e.message
        };
        result.valid = false;
      }
    }

    return result;
  }
}

module.exports = {
  TimezoneSpoof,
  TimezoneSpoofError
};
