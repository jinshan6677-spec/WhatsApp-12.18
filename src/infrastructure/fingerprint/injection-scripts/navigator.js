/**
 * Navigator Spoofing Script
 * Navigator伪装脚本
 * 
 * Implements spoofing for all Navigator properties to prevent fingerprinting.
 * Uses NativeWrapper to ensure all spoofed properties maintain native characteristics.
 * 
 * Covered properties:
 * - userAgent, appVersion, platform, vendor, product, productSub, appName, appCodeName (Req 3.1-3.8)
 * - hardwareConcurrency, deviceMemory (Req 4.1-4.2)
 * - language, languages (Req 10.1-10.2)
 * - webdriver (Req 28.2)
 * 
 * @module infrastructure/fingerprint/injection-scripts/navigator
 * 
 * **Validates: Requirements 3.1-3.8, 4.1-4.2, 10.1-10.2, 28.2**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');
const { PrototypeGuard } = require('./core/prototype-guard');

/**
 * Error class for navigator spoofing operations
 */
class NavigatorSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'NavigatorSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * NavigatorSpoof class
 * Provides methods to spoof Navigator properties
 */
class NavigatorSpoof {
  /**
   * Default navigator configuration
   * @private
   */
  static _defaultConfig = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    platform: 'Win32',
    vendor: 'Google Inc.',
    product: 'Gecko',
    productSub: '20030107',
    appName: 'Netscape',
    appCodeName: 'Mozilla',
    language: 'en-US',
    languages: ['en-US', 'en'],
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
    webdriver: false,
    doNotTrack: null,
    globalPrivacyControl: false
  };

  /**
   * Store for original navigator property descriptors
   * @private
   */
  static _originalDescriptors = {};

  /**
   * Store for applied configuration
   * @private
   */
  static _appliedConfig = null;

  /**
   * Apply navigator spoofing with the given configuration
   * 
   * @param {Object} navigatorObj - The navigator object to spoof (usually window.navigator)
   * @param {Object} config - Configuration object with navigator properties
   * @param {string} [config.userAgent] - User-Agent string (Req 3.1)
   * @param {string} [config.appVersion] - App version string (Req 3.2)
   * @param {string} [config.platform] - Platform string (Req 3.3)
   * @param {string} [config.vendor] - Vendor string (Req 3.4)
   * @param {string} [config.product] - Product string (Req 3.5)
   * @param {string} [config.productSub] - Product sub string (Req 3.6)
   * @param {string} [config.appName] - App name string (Req 3.7)
   * @param {string} [config.appCodeName] - App code name string (Req 3.8)
   * @param {number} [config.hardwareConcurrency] - CPU cores (Req 4.1)
   * @param {number} [config.deviceMemory] - Device memory in GB (Req 4.2)
   * @param {string} [config.language] - Primary language (Req 10.1)
   * @param {string[]} [config.languages] - Language list (Req 10.2)
   * @param {boolean} [config.webdriver] - Webdriver flag (Req 28.2)
   * @returns {Object} Result object with success status and details
   */
  static apply(navigatorObj, config = {}) {
    if (!navigatorObj || typeof navigatorObj !== 'object') {
      throw new NavigatorSpoofError(
        'navigatorObj must be an object',
        'INVALID_NAVIGATOR',
        { type: typeof navigatorObj }
      );
    }

    // Merge with defaults
    const mergedConfig = { ...NavigatorSpoof._defaultConfig, ...config };
    
    // Store the applied configuration
    NavigatorSpoof._appliedConfig = mergedConfig;

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // Get the Navigator prototype
    const navigatorProto = Object.getPrototypeOf(navigatorObj);

    // Spoof userAgent (Req 3.1)
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'userAgent', mergedConfig.userAgent);
      results.spoofed.push('userAgent');
    } catch (e) {
      results.failed.push({ property: 'userAgent', error: e.message });
      results.success = false;
    }

    // Spoof appVersion (Req 3.2)
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'appVersion', mergedConfig.appVersion);
      results.spoofed.push('appVersion');
    } catch (e) {
      results.failed.push({ property: 'appVersion', error: e.message });
      results.success = false;
    }

    // Spoof platform (Req 3.3)
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'platform', mergedConfig.platform);
      results.spoofed.push('platform');
    } catch (e) {
      results.failed.push({ property: 'platform', error: e.message });
      results.success = false;
    }

    // Spoof vendor (Req 3.4)
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'vendor', mergedConfig.vendor);
      results.spoofed.push('vendor');
    } catch (e) {
      results.failed.push({ property: 'vendor', error: e.message });
      results.success = false;
    }

    // Spoof product (Req 3.5)
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'product', mergedConfig.product);
      results.spoofed.push('product');
    } catch (e) {
      results.failed.push({ property: 'product', error: e.message });
      results.success = false;
    }

    // Spoof productSub (Req 3.6)
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'productSub', mergedConfig.productSub);
      results.spoofed.push('productSub');
    } catch (e) {
      results.failed.push({ property: 'productSub', error: e.message });
      results.success = false;
    }

    // Spoof appName (Req 3.7)
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'appName', mergedConfig.appName);
      results.spoofed.push('appName');
    } catch (e) {
      results.failed.push({ property: 'appName', error: e.message });
      results.success = false;
    }

    // Spoof appCodeName (Req 3.8)
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'appCodeName', mergedConfig.appCodeName);
      results.spoofed.push('appCodeName');
    } catch (e) {
      results.failed.push({ property: 'appCodeName', error: e.message });
      results.success = false;
    }

    // Spoof hardwareConcurrency (Req 4.1)
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'hardwareConcurrency', mergedConfig.hardwareConcurrency);
      results.spoofed.push('hardwareConcurrency');
    } catch (e) {
      results.failed.push({ property: 'hardwareConcurrency', error: e.message });
      results.success = false;
    }

    // Spoof deviceMemory (Req 4.2)
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'deviceMemory', mergedConfig.deviceMemory);
      results.spoofed.push('deviceMemory');
    } catch (e) {
      results.failed.push({ property: 'deviceMemory', error: e.message });
      results.success = false;
    }

    // Spoof maxTouchPoints
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'maxTouchPoints', mergedConfig.maxTouchPoints);
      results.spoofed.push('maxTouchPoints');
    } catch (e) {
      results.failed.push({ property: 'maxTouchPoints', error: e.message });
      results.success = false;
    }

    // Spoof language (Req 10.1)
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'language', mergedConfig.language);
      results.spoofed.push('language');
    } catch (e) {
      results.failed.push({ property: 'language', error: e.message });
      results.success = false;
    }

    // Spoof languages (Req 10.2)
    try {
      // languages returns a frozen array, so we need special handling
      NavigatorSpoof._spoofLanguages(navigatorProto, mergedConfig.languages);
      results.spoofed.push('languages');
    } catch (e) {
      results.failed.push({ property: 'languages', error: e.message });
      results.success = false;
    }

    // Hide webdriver (Req 28.2)
    try {
      NavigatorSpoof._spoofWebdriver(navigatorProto, mergedConfig.webdriver);
      results.spoofed.push('webdriver');
    } catch (e) {
      results.failed.push({ property: 'webdriver', error: e.message });
      results.success = false;
    }

    // Spoof doNotTrack
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'doNotTrack', mergedConfig.doNotTrack);
      results.spoofed.push('doNotTrack');
    } catch (e) {
      results.failed.push({ property: 'doNotTrack', error: e.message });
      results.success = false;
    }

    // Spoof globalPrivacyControl
    try {
      NavigatorSpoof._spoofProperty(navigatorProto, 'globalPrivacyControl', mergedConfig.globalPrivacyControl);
      results.spoofed.push('globalPrivacyControl');
    } catch (e) {
      results.failed.push({ property: 'globalPrivacyControl', error: e.message });
      results.success = false;
    }

    // Protect the prototype from detection
    PrototypeGuard.protectPrototype(navigatorProto, {
      protectedMethods: results.spoofed
    });

    return results;
  }

  /**
   * Spoof a single navigator property
   * @private
   */
  static _spoofProperty(proto, propertyName, value) {
    // Store original descriptor
    const originalDescriptor = Object.getOwnPropertyDescriptor(proto, propertyName);
    if (originalDescriptor) {
      NavigatorSpoof._originalDescriptors[propertyName] = originalDescriptor;
    }

    // Create a getter that returns the spoofed value
    const getter = function() {
      return value;
    };

    // Make the getter appear native
    Object.defineProperty(getter, 'name', {
      value: `get ${propertyName}`,
      writable: false,
      enumerable: false,
      configurable: true
    });

    // Create native-looking toString
    const nativeToString = `function get ${propertyName}() { [native code] }`;
    getter.toString = function() { return nativeToString; };

    // Define the property with the spoofed getter
    Object.defineProperty(proto, propertyName, {
      get: getter,
      set: undefined,
      enumerable: true,
      configurable: true
    });
  }

  /**
   * Spoof the languages property (returns frozen array)
   * @private
   */
  static _spoofLanguages(proto, languages) {
    // Store original descriptor
    const originalDescriptor = Object.getOwnPropertyDescriptor(proto, 'languages');
    if (originalDescriptor) {
      NavigatorSpoof._originalDescriptors['languages'] = originalDescriptor;
    }

    // Create a frozen array copy
    const frozenLanguages = Object.freeze([...languages]);

    // Create a getter that returns the frozen array
    const getter = function() {
      return frozenLanguages;
    };

    // Make the getter appear native
    Object.defineProperty(getter, 'name', {
      value: 'get languages',
      writable: false,
      enumerable: false,
      configurable: true
    });

    const nativeToString = 'function get languages() { [native code] }';
    getter.toString = function() { return nativeToString; };

    Object.defineProperty(proto, 'languages', {
      get: getter,
      set: undefined,
      enumerable: true,
      configurable: true
    });
  }

  /**
   * Spoof the webdriver property (Req 28.2)
   * This is critical for hiding automation detection
   * @private
   */
  static _spoofWebdriver(proto, value) {
    // Store original descriptor
    const originalDescriptor = Object.getOwnPropertyDescriptor(proto, 'webdriver');
    if (originalDescriptor) {
      NavigatorSpoof._originalDescriptors['webdriver'] = originalDescriptor;
    }

    // For webdriver, we want to return false or undefined to hide automation
    const spoofedValue = value === true ? true : (value === false ? false : undefined);

    // Create a getter
    const getter = function() {
      return spoofedValue;
    };

    // Make the getter appear native
    Object.defineProperty(getter, 'name', {
      value: 'get webdriver',
      writable: false,
      enumerable: false,
      configurable: true
    });

    const nativeToString = 'function get webdriver() { [native code] }';
    getter.toString = function() { return nativeToString; };

    Object.defineProperty(proto, 'webdriver', {
      get: getter,
      set: undefined,
      enumerable: true,
      configurable: true
    });
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return NavigatorSpoof._appliedConfig ? { ...NavigatorSpoof._appliedConfig } : null;
  }

  /**
   * Restore original navigator properties
   * @param {Object} navigatorObj - The navigator object to restore
   * @returns {Object} Result object with restored properties
   */
  static restore(navigatorObj) {
    if (!navigatorObj || typeof navigatorObj !== 'object') {
      throw new NavigatorSpoofError(
        'navigatorObj must be an object',
        'INVALID_NAVIGATOR',
        { type: typeof navigatorObj }
      );
    }

    const navigatorProto = Object.getPrototypeOf(navigatorObj);
    const results = {
      restored: [],
      failed: []
    };

    for (const [propertyName, descriptor] of Object.entries(NavigatorSpoof._originalDescriptors)) {
      try {
        Object.defineProperty(navigatorProto, propertyName, descriptor);
        results.restored.push(propertyName);
      } catch (e) {
        results.failed.push({ property: propertyName, error: e.message });
      }
    }

    // Clear stored descriptors and config
    NavigatorSpoof._originalDescriptors = {};
    NavigatorSpoof._appliedConfig = null;

    return results;
  }

  /**
   * Verify that navigator spoofing is correctly applied
   * @param {Object} navigatorObj - The navigator object to verify
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Object} Verification result
   */
  static verify(navigatorObj, expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    const propertiesToCheck = [
      'userAgent', 'appVersion', 'platform', 'vendor', 'product',
      'productSub', 'appName', 'appCodeName', 'hardwareConcurrency',
      'deviceMemory', 'language', 'webdriver'
    ];

    for (const prop of propertiesToCheck) {
      if (expectedConfig[prop] !== undefined) {
        const actual = navigatorObj[prop];
        const expected = expectedConfig[prop];
        const pass = actual === expected;

        result.checks[prop] = {
          expected,
          actual,
          pass
        };

        if (!pass) {
          result.valid = false;
        }
      }
    }

    // Special check for languages (array comparison)
    if (expectedConfig.languages) {
      const actualLanguages = navigatorObj.languages;
      const expectedLanguages = expectedConfig.languages;
      const languagesMatch = Array.isArray(actualLanguages) &&
        actualLanguages.length === expectedLanguages.length &&
        actualLanguages.every((lang, i) => lang === expectedLanguages[i]);

      result.checks.languages = {
        expected: expectedLanguages,
        actual: actualLanguages ? [...actualLanguages] : null,
        pass: languagesMatch
      };

      if (!languagesMatch) {
        result.valid = false;
      }
    }

    return result;
  }

  /**
   * Generate injection script string for browser context
   * This creates a self-contained script that can be injected into a page
   * 
   * @param {Object} config - Navigator configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...NavigatorSpoof._defaultConfig, ...config };
    
    // Escape strings for safe injection
    const escapeString = (str) => {
      if (str === null || str === undefined) return 'null';
      return JSON.stringify(str);
    };

    return `
(function() {
  'use strict';
  
  // Navigator spoofing configuration
  const config = {
    userAgent: ${escapeString(mergedConfig.userAgent)},
    appVersion: ${escapeString(mergedConfig.appVersion)},
    platform: ${escapeString(mergedConfig.platform)},
    vendor: ${escapeString(mergedConfig.vendor)},
    product: ${escapeString(mergedConfig.product)},
    productSub: ${escapeString(mergedConfig.productSub)},
    appName: ${escapeString(mergedConfig.appName)},
    appCodeName: ${escapeString(mergedConfig.appCodeName)},
    hardwareConcurrency: ${mergedConfig.hardwareConcurrency},
    deviceMemory: ${mergedConfig.deviceMemory},
    maxTouchPoints: ${mergedConfig.maxTouchPoints},
    language: ${escapeString(mergedConfig.language)},
    languages: ${JSON.stringify(mergedConfig.languages)},
    webdriver: ${mergedConfig.webdriver},
    doNotTrack: ${escapeString(mergedConfig.doNotTrack)},
    globalPrivacyControl: ${mergedConfig.globalPrivacyControl}
  };
  
  const navigatorProto = Object.getPrototypeOf(navigator);
  
  // Helper to create native-looking getter
  function createGetter(name, value) {
    const getter = function() { return value; };
    Object.defineProperty(getter, 'name', {
      value: 'get ' + name,
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeStr = 'function get ' + name + '() { [native code] }';
    getter.toString = function() { return nativeStr; };
    return getter;
  }
  
  // Spoof simple properties
  const simpleProps = [
    'userAgent', 'appVersion', 'platform', 'vendor', 'product',
    'productSub', 'appName', 'appCodeName', 'hardwareConcurrency',
    'deviceMemory', 'maxTouchPoints', 'language', 'doNotTrack',
    'globalPrivacyControl', 'webdriver'
  ];
  
  for (const prop of simpleProps) {
    if (config[prop] !== undefined) {
      try {
        Object.defineProperty(navigatorProto, prop, {
          get: createGetter(prop, config[prop]),
          set: undefined,
          enumerable: true,
          configurable: true
        });
      } catch (e) {
        // Property may not be configurable
      }
    }
  }
  
  // Spoof languages (frozen array)
  try {
    const frozenLanguages = Object.freeze([...config.languages]);
    Object.defineProperty(navigatorProto, 'languages', {
      get: createGetter('languages', frozenLanguages),
      set: undefined,
      enumerable: true,
      configurable: true
    });
  } catch (e) {
    // Property may not be configurable
  }
})();
`;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Navigator configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...NavigatorSpoof._defaultConfig };
    }

    return {
      userAgent: fingerprintConfig.userAgent || NavigatorSpoof._defaultConfig.userAgent,
      appVersion: fingerprintConfig.navigator?.appVersion || NavigatorSpoof._defaultConfig.appVersion,
      platform: fingerprintConfig.os?.platform || NavigatorSpoof._defaultConfig.platform,
      vendor: fingerprintConfig.navigator?.vendor || NavigatorSpoof._defaultConfig.vendor,
      product: fingerprintConfig.navigator?.product || NavigatorSpoof._defaultConfig.product,
      productSub: fingerprintConfig.navigator?.productSub || NavigatorSpoof._defaultConfig.productSub,
      appName: fingerprintConfig.navigator?.appName || NavigatorSpoof._defaultConfig.appName,
      appCodeName: fingerprintConfig.navigator?.appCodeName || NavigatorSpoof._defaultConfig.appCodeName,
      hardwareConcurrency: fingerprintConfig.hardware?.cpuCores || NavigatorSpoof._defaultConfig.hardwareConcurrency,
      deviceMemory: fingerprintConfig.hardware?.deviceMemory || NavigatorSpoof._defaultConfig.deviceMemory,
      maxTouchPoints: fingerprintConfig.hardware?.maxTouchPoints || NavigatorSpoof._defaultConfig.maxTouchPoints,
      language: fingerprintConfig.navigator?.language || fingerprintConfig.language?.primary || NavigatorSpoof._defaultConfig.language,
      languages: fingerprintConfig.navigator?.languages || fingerprintConfig.language?.list || NavigatorSpoof._defaultConfig.languages,
      webdriver: fingerprintConfig.navigator?.webdriver !== undefined ? fingerprintConfig.navigator.webdriver : NavigatorSpoof._defaultConfig.webdriver,
      doNotTrack: fingerprintConfig.navigator?.doNotTrack !== undefined ? fingerprintConfig.navigator.doNotTrack : fingerprintConfig.privacy?.doNotTrack,
      globalPrivacyControl: fingerprintConfig.navigator?.globalPrivacyControl !== undefined ? fingerprintConfig.navigator.globalPrivacyControl : fingerprintConfig.privacy?.globalPrivacyControl
    };
  }
}

module.exports = {
  NavigatorSpoof,
  NavigatorSpoofError
};
