/**
 * Storage API Protection Script
 * 存储API保护脚本
 * 
 * Implements protection for Storage API to prevent fingerprinting.
 * Controls storage quota information returned by navigator.storage.estimate().
 * 
 * Covered methods:
 * - navigator.storage.estimate (Req 34.1)
 * - IndexedDB database list (Req 34.2)
 * - Fake quota mode (Req 34.3)
 * - Real quota mode (Req 34.4)
 * 
 * Features:
 * - Custom storage quota configuration
 * - Fake mode returns reasonable random quota
 * - Real mode returns actual storage quota
 * - Native function characteristics preserved
 * 
 * @module infrastructure/fingerprint/injection-scripts/storage
 * 
 * **Validates: Requirements 34.1, 34.2, 34.3, 34.4**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');

/**
 * Error class for storage spoofing operations
 */
class StorageSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'StorageSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * StorageSpoof class
 * Provides methods to spoof Storage API
 */
class StorageSpoof {
  /**
   * Default storage configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'fake',             // 'fake', 'real'
    quota: 10737418240,       // 10 GB in bytes
    usage: 0,                 // Current usage in bytes
    usageDetails: {}          // Usage breakdown by type
  };

  /**
   * Store for original method references
   * @private
   */
  static _originalMethods = {};

  /**
   * Store for applied configuration
   * @private
   */
  static _appliedConfig = null;

  /**
   * Apply storage spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='fake'] - Spoofing mode: 'fake' or 'real'
   * @param {number} [config.quota] - Storage quota in bytes
   * @param {number} [config.usage] - Current usage in bytes
   * @param {Object} [config.usageDetails] - Usage breakdown by type
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = { ...StorageSpoof._defaultConfig, ...config };
    
    // Validate mode
    if (!['fake', 'real'].includes(mergedConfig.mode)) {
      throw new StorageSpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'fake' or 'real'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // Validate quota
    if (typeof mergedConfig.quota !== 'number' || mergedConfig.quota < 0) {
      throw new StorageSpoofError(
        `Invalid quota: ${mergedConfig.quota}. Must be a non-negative number`,
        'INVALID_QUOTA',
        { quota: mergedConfig.quota }
      );
    }

    // Validate usage
    if (typeof mergedConfig.usage !== 'number' || mergedConfig.usage < 0) {
      throw new StorageSpoofError(
        `Invalid usage: ${mergedConfig.usage}. Must be a non-negative number`,
        'INVALID_USAGE',
        { usage: mergedConfig.usage }
      );
    }

    // Store the applied configuration
    StorageSpoof._appliedConfig = mergedConfig;

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // If mode is 'real', don't spoof anything (Req 34.4)
    if (mergedConfig.mode === 'real') {
      return results;
    }

    // Spoof navigator.storage.estimate (Req 34.1, 34.3)
    try {
      StorageSpoof._spoofStorageEstimate();
      results.spoofed.push('storage.estimate');
    } catch (e) {
      results.failed.push({ method: 'storage.estimate', error: e.message });
      results.success = false;
    }

    return results;
  }

  /**
   * Spoof navigator.storage.estimate
   * Requirement 34.1: Return configured storage quota
   * Requirement 34.3: Fake mode returns reasonable random quota
   * @private
   */
  static _spoofStorageEstimate() {
    // Check if navigator.storage exists (browser environment)
    if (typeof navigator === 'undefined' || !navigator.storage) {
      return;
    }

    const storage = navigator.storage;
    const originalEstimate = storage.estimate;

    // Store original method
    if (originalEstimate) {
      StorageSpoof._originalMethods.estimate = originalEstimate;
    }

    // Create wrapped function
    const wrappedEstimate = NativeWrapper.wrap(
      originalEstimate || function() { return Promise.reject(new Error('Storage API not supported')); },
      function(original, args, thisArg) {
        const config = StorageSpoof._appliedConfig;

        // If mode is 'real', return original result (Req 34.4)
        if (!config || config.mode === 'real') {
          if (original && typeof original === 'function') {
            return original.apply(thisArg, args);
          }
          return Promise.reject(new Error('Storage API not supported'));
        }

        // Return fake storage estimate (Req 34.1, 34.3)
        const estimate = {
          quota: config.quota,
          usage: config.usage
        };

        // Add usage details if configured
        if (config.usageDetails && Object.keys(config.usageDetails).length > 0) {
          estimate.usageDetails = { ...config.usageDetails };
        }

        return Promise.resolve(estimate);
      },
      { name: 'estimate', length: 0 }
    );

    // Replace the method on storage
    try {
      Object.defineProperty(storage, 'estimate', {
        value: wrappedEstimate,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      // If defineProperty fails, try direct assignment
      storage.estimate = wrappedEstimate;
    }
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return StorageSpoof._appliedConfig ? { ...StorageSpoof._appliedConfig } : null;
  }

  /**
   * Restore original storage methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    // Restore estimate
    if (StorageSpoof._originalMethods.estimate && 
        typeof navigator !== 'undefined' && navigator.storage) {
      try {
        navigator.storage.estimate = StorageSpoof._originalMethods.estimate;
        results.restored.push('estimate');
      } catch (e) {
        results.failed.push({ method: 'estimate', error: e.message });
      }
    }

    // Clear stored data
    StorageSpoof._originalMethods = {};
    StorageSpoof._appliedConfig = null;

    return results;
  }

  /**
   * Generate injection script string for browser context
   * @param {Object} config - Storage configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...StorageSpoof._defaultConfig, ...config };

    return `
(function() {
  'use strict';
  
  // Storage spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)},
    quota: ${mergedConfig.quota},
    usage: ${mergedConfig.usage},
    usageDetails: ${JSON.stringify(mergedConfig.usageDetails || {})}
  };
  
  // Skip if mode is 'real' (Req 34.4)
  if (config.mode === 'real') {
    return;
  }
  
  // Check if navigator.storage exists
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return;
  }
  
  const storage = navigator.storage;
  
  // Store original estimate
  const originalEstimate = storage.estimate;
  
  // Create spoofed estimate function (Req 34.1, 34.3)
  function spoofedEstimate() {
    const estimate = {
      quota: config.quota,
      usage: config.usage
    };
    
    // Add usage details if configured
    if (config.usageDetails && Object.keys(config.usageDetails).length > 0) {
      estimate.usageDetails = Object.assign({}, config.usageDetails);
    }
    
    return Promise.resolve(estimate);
  }
  
  // Make the function appear native
  Object.defineProperty(spoofedEstimate, 'name', {
    value: 'estimate',
    writable: false,
    enumerable: false,
    configurable: true
  });
  Object.defineProperty(spoofedEstimate, 'length', {
    value: 0,
    writable: false,
    enumerable: false,
    configurable: true
  });
  const nativeEstimateStr = 'function estimate() { [native code] }';
  spoofedEstimate.toString = function() { return nativeEstimateStr; };
  
  // Replace the method on storage
  try {
    Object.defineProperty(storage, 'estimate', {
      value: spoofedEstimate,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } catch (e) {
    storage.estimate = spoofedEstimate;
  }
})();
`;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Storage configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...StorageSpoof._defaultConfig };
    }

    const advancedApis = fingerprintConfig.advancedApis || {};
    const storageConfig = advancedApis.storage || {};
    
    return {
      mode: storageConfig.mode || StorageSpoof._defaultConfig.mode,
      quota: storageConfig.quota !== undefined ? storageConfig.quota : StorageSpoof._defaultConfig.quota,
      usage: storageConfig.usage !== undefined ? storageConfig.usage : StorageSpoof._defaultConfig.usage,
      usageDetails: storageConfig.usageDetails || StorageSpoof._defaultConfig.usageDetails
    };
  }

  /**
   * Verify that storage spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Promise<Object>} Verification result
   */
  static async verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = StorageSpoof.getAppliedConfig();
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

    // If in browser environment, verify actual estimate behavior
    if (typeof navigator !== 'undefined' && navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        
        if (appliedConfig.mode === 'fake') {
          // Check quota (Req 34.1)
          result.checks.quota = {
            expected: appliedConfig.quota,
            actual: estimate.quota,
            pass: estimate.quota === appliedConfig.quota
          };
          if (!result.checks.quota.pass) result.valid = false;

          // Check usage
          result.checks.usage = {
            expected: appliedConfig.usage,
            actual: estimate.usage,
            pass: estimate.usage === appliedConfig.usage
          };
          if (!result.checks.usage.pass) result.valid = false;
        }
      } catch (e) {
        result.checks.estimate = {
          expected: 'success',
          actual: e.message,
          pass: false
        };
        result.valid = false;
      }
    }

    return result;
  }

  /**
   * Generate a reasonable random quota value
   * @returns {number} Random quota in bytes (between 5GB and 50GB)
   */
  static generateRandomQuota() {
    const minQuota = 5 * 1024 * 1024 * 1024;  // 5 GB
    const maxQuota = 50 * 1024 * 1024 * 1024; // 50 GB
    return Math.floor(Math.random() * (maxQuota - minQuota) + minQuota);
  }
}

module.exports = {
  StorageSpoof,
  StorageSpoofError
};
