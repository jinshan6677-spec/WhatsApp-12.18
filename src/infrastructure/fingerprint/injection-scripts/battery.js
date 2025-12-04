/**
 * Battery API Protection Script
 * 电池API保护脚本
 * 
 * Implements protection for Battery Status API to prevent fingerprinting.
 * Controls battery status information returned to websites.
 * 
 * Covered methods:
 * - navigator.getBattery (Req 16.1, 16.2, 16.3)
 * - BatteryManager events (Req 16.4)
 * 
 * Features:
 * - Three modes: 'privacy', 'disable', 'real'
 * - Privacy mode returns fixed battery status (charging, 100%)
 * - Disable mode returns rejected Promise
 * - Real mode returns actual battery status
 * - Event filtering based on mode
 * - Native function characteristics preserved
 * 
 * @module infrastructure/fingerprint/injection-scripts/battery
 * 
 * **Validates: Requirements 16.1, 16.2, 16.3, 16.4**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');

/**
 * Error class for battery spoofing operations
 */
class BatterySpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'BatterySpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * BatterySpoof class
 * Provides methods to spoof Battery Status API
 */
class BatterySpoof {
  /**
   * Default battery configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'privacy',        // 'privacy', 'disable', 'real'
    charging: true,         // Whether battery is charging (privacy mode)
    level: 1.0,             // Battery level 0.0-1.0 (privacy mode)
    chargingTime: 0,        // Seconds until fully charged (0 = fully charged)
    dischargingTime: Infinity // Seconds until empty (Infinity = not discharging)
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
   * Store for fake BatteryManager instance
   * @private
   */
  static _fakeBatteryManager = null;

  /**
   * Apply battery spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='privacy'] - Spoofing mode: 'privacy', 'disable', or 'real'
   * @param {boolean} [config.charging=true] - Whether battery is charging (privacy mode)
   * @param {number} [config.level=1.0] - Battery level 0.0-1.0 (privacy mode)
   * @param {number} [config.chargingTime=0] - Seconds until fully charged
   * @param {number} [config.dischargingTime=Infinity] - Seconds until empty
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = { ...BatterySpoof._defaultConfig, ...config };
    
    // Validate mode
    if (!['privacy', 'disable', 'real'].includes(mergedConfig.mode)) {
      throw new BatterySpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'privacy', 'disable', or 'real'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // Validate level
    if (typeof mergedConfig.level !== 'number' || mergedConfig.level < 0 || mergedConfig.level > 1) {
      throw new BatterySpoofError(
        `Invalid level: ${mergedConfig.level}. Must be a number between 0 and 1`,
        'INVALID_LEVEL',
        { level: mergedConfig.level }
      );
    }

    // Store the applied configuration
    BatterySpoof._appliedConfig = mergedConfig;

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // If mode is 'real', don't spoof anything
    if (mergedConfig.mode === 'real') {
      return results;
    }

    // Spoof navigator.getBattery (Req 16.1, 16.2, 16.3)
    try {
      BatterySpoof._spoofGetBattery();
      results.spoofed.push('getBattery');
    } catch (e) {
      results.failed.push({ method: 'getBattery', error: e.message });
      results.success = false;
    }

    return results;
  }

  /**
   * Create a fake BatteryManager object
   * Requirement 16.1: Privacy mode returns fixed battery status
   * @private
   * @returns {Object} A fake BatteryManager-like object
   */
  static _createFakeBatteryManager() {
    const config = BatterySpoof._appliedConfig;
    
    // Event listeners storage
    const eventListeners = {
      chargingchange: [],
      chargingtimechange: [],
      dischargingtimechange: [],
      levelchange: []
    };

    // Create the fake BatteryManager object
    const fakeBatteryManager = {
      // Properties (Req 16.1: fixed values for privacy mode)
      get charging() {
        return config.charging;
      },
      get level() {
        return config.level;
      },
      get chargingTime() {
        return config.chargingTime;
      },
      get dischargingTime() {
        return config.dischargingTime;
      },

      // Event handler properties
      onchargingchange: null,
      onchargingtimechange: null,
      ondischargingtimechange: null,
      onlevelchange: null,

      // EventTarget methods
      addEventListener(type, listener, options) {
        if (eventListeners[type]) {
          eventListeners[type].push({ listener, options });
        }
      },

      removeEventListener(type, listener, options) {
        if (eventListeners[type]) {
          const index = eventListeners[type].findIndex(
            item => item.listener === listener
          );
          if (index !== -1) {
            eventListeners[type].splice(index, 1);
          }
        }
      },

      dispatchEvent(event) {
        // In privacy mode, we don't dispatch real events (Req 16.4)
        // Events are filtered/blocked
        return true;
      }
    };

    // Make methods appear native
    const methods = ['addEventListener', 'removeEventListener', 'dispatchEvent'];
    methods.forEach(methodName => {
      const method = fakeBatteryManager[methodName];
      Object.defineProperty(method, 'name', {
        value: methodName,
        writable: false,
        enumerable: false,
        configurable: true
      });
      const nativeStr = `function ${methodName}() { [native code] }`;
      method.toString = function() { return nativeStr; };
    });

    return fakeBatteryManager;
  }


  /**
   * Spoof navigator.getBattery
   * Requirement 16.1: Privacy mode returns fixed battery status (charging, 100%)
   * Requirement 16.2: Disable mode returns rejected Promise
   * Requirement 16.3: Real mode returns actual battery status
   * @private
   */
  static _spoofGetBattery() {
    // Check if navigator exists (browser environment)
    if (typeof navigator === 'undefined') {
      return;
    }

    // Check if getBattery exists
    const originalGetBattery = navigator.getBattery;
    
    // Store original method if it exists
    if (originalGetBattery) {
      BatterySpoof._originalMethods.getBattery = originalGetBattery;
    }

    // Create wrapped function
    const wrappedGetBattery = NativeWrapper.wrap(
      originalGetBattery || function() { return Promise.reject(new Error('Battery API not supported')); },
      function(original, args, thisArg) {
        const config = BatterySpoof._appliedConfig;

        // If mode is 'real', return original result (Req 16.3)
        if (!config || config.mode === 'real') {
          if (original && typeof original === 'function') {
            return original.apply(thisArg, args);
          }
          return Promise.reject(new Error('Battery API not supported'));
        }

        // If mode is 'disable', return rejected Promise (Req 16.2)
        if (config.mode === 'disable') {
          return Promise.reject(new DOMException(
            'Battery Status API is disabled',
            'NotAllowedError'
          ));
        }

        // Mode is 'privacy' - return fake BatteryManager (Req 16.1)
        if (!BatterySpoof._fakeBatteryManager) {
          BatterySpoof._fakeBatteryManager = BatterySpoof._createFakeBatteryManager();
        }

        return Promise.resolve(BatterySpoof._fakeBatteryManager);
      },
      { name: 'getBattery', length: 0 }
    );

    // Replace the method on navigator
    try {
      Object.defineProperty(navigator, 'getBattery', {
        value: wrappedGetBattery,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      // If defineProperty fails, try direct assignment
      navigator.getBattery = wrappedGetBattery;
    }
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return BatterySpoof._appliedConfig ? { ...BatterySpoof._appliedConfig } : null;
  }

  /**
   * Restore original battery methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    // Restore getBattery
    if (BatterySpoof._originalMethods.getBattery && typeof navigator !== 'undefined') {
      try {
        navigator.getBattery = BatterySpoof._originalMethods.getBattery;
        results.restored.push('getBattery');
      } catch (e) {
        results.failed.push({ method: 'getBattery', error: e.message });
      }
    }

    // Clear stored data
    BatterySpoof._originalMethods = {};
    BatterySpoof._appliedConfig = null;
    BatterySpoof._fakeBatteryManager = null;

    return results;
  }


  /**
   * Generate injection script string for browser context
   * This creates a self-contained script that can be injected into a page
   * 
   * @param {Object} config - Battery configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...BatterySpoof._defaultConfig, ...config };

    return `
(function() {
  'use strict';
  
  // Battery spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)},
    charging: ${mergedConfig.charging},
    level: ${mergedConfig.level},
    chargingTime: ${mergedConfig.chargingTime},
    dischargingTime: ${mergedConfig.dischargingTime === Infinity ? 'Infinity' : mergedConfig.dischargingTime}
  };
  
  // Skip if mode is 'real' (Req 16.3)
  if (config.mode === 'real') {
    return;
  }
  
  // Check if navigator exists
  if (typeof navigator === 'undefined') {
    return;
  }
  
  // Store original getBattery if it exists
  const originalGetBattery = navigator.getBattery;
  
  // Event listeners storage for fake BatteryManager
  const eventListeners = {
    chargingchange: [],
    chargingtimechange: [],
    dischargingtimechange: [],
    levelchange: []
  };
  
  // Create fake BatteryManager object (Req 16.1)
  const fakeBatteryManager = {
    get charging() {
      return config.charging;
    },
    get level() {
      return config.level;
    },
    get chargingTime() {
      return config.chargingTime;
    },
    get dischargingTime() {
      return config.dischargingTime;
    },
    
    // Event handler properties
    onchargingchange: null,
    onchargingtimechange: null,
    ondischargingtimechange: null,
    onlevelchange: null,
    
    // EventTarget methods
    addEventListener: function(type, listener, options) {
      if (eventListeners[type]) {
        eventListeners[type].push({ listener: listener, options: options });
      }
    },
    
    removeEventListener: function(type, listener, options) {
      if (eventListeners[type]) {
        const index = eventListeners[type].findIndex(
          function(item) { return item.listener === listener; }
        );
        if (index !== -1) {
          eventListeners[type].splice(index, 1);
        }
      }
    },
    
    // In privacy mode, events are filtered (Req 16.4)
    dispatchEvent: function(event) {
      return true;
    }
  };
  
  // Make methods appear native
  ['addEventListener', 'removeEventListener', 'dispatchEvent'].forEach(function(methodName) {
    const method = fakeBatteryManager[methodName];
    Object.defineProperty(method, 'name', {
      value: methodName,
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeStr = 'function ' + methodName + '() { [native code] }';
    method.toString = function() { return nativeStr; };
  });
  
  // Create spoofed getBattery function
  function spoofedGetBattery() {
    // If mode is 'disable', return rejected Promise (Req 16.2)
    if (config.mode === 'disable') {
      return Promise.reject(new DOMException(
        'Battery Status API is disabled',
        'NotAllowedError'
      ));
    }
    
    // Mode is 'privacy' - return fake BatteryManager (Req 16.1)
    return Promise.resolve(fakeBatteryManager);
  }
  
  // Make the function appear native
  Object.defineProperty(spoofedGetBattery, 'name', {
    value: 'getBattery',
    writable: false,
    enumerable: false,
    configurable: true
  });
  Object.defineProperty(spoofedGetBattery, 'length', {
    value: 0,
    writable: false,
    enumerable: false,
    configurable: true
  });
  const nativeGetBatteryStr = 'function getBattery() { [native code] }';
  spoofedGetBattery.toString = function() { return nativeGetBatteryStr; };
  
  // Replace the method on navigator
  try {
    Object.defineProperty(navigator, 'getBattery', {
      value: spoofedGetBattery,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } catch (e) {
    navigator.getBattery = spoofedGetBattery;
  }
})();
`;
  }


  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Battery configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...BatterySpoof._defaultConfig };
    }

    const batteryConfig = fingerprintConfig.battery || {};
    
    return {
      mode: batteryConfig.mode || BatterySpoof._defaultConfig.mode,
      charging: batteryConfig.charging !== undefined ? batteryConfig.charging : BatterySpoof._defaultConfig.charging,
      level: batteryConfig.level !== undefined ? batteryConfig.level : BatterySpoof._defaultConfig.level,
      chargingTime: batteryConfig.chargingTime !== undefined ? batteryConfig.chargingTime : BatterySpoof._defaultConfig.chargingTime,
      dischargingTime: batteryConfig.dischargingTime !== undefined ? batteryConfig.dischargingTime : BatterySpoof._defaultConfig.dischargingTime
    };
  }

  /**
   * Verify that battery spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Promise<Object>} Verification result
   */
  static async verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = BatterySpoof.getAppliedConfig();
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

    // If in browser environment, verify actual getBattery behavior
    if (typeof navigator !== 'undefined' && navigator.getBattery) {
      try {
        if (appliedConfig.mode === 'disable') {
          // Should reject
          try {
            await navigator.getBattery();
            result.checks.disableMode = {
              expected: 'rejected',
              actual: 'resolved',
              pass: false
            };
            result.valid = false;
          } catch (e) {
            result.checks.disableMode = {
              expected: 'rejected',
              actual: 'rejected',
              pass: true
            };
          }
        } else if (appliedConfig.mode === 'privacy') {
          const battery = await navigator.getBattery();
          
          // Check charging status
          result.checks.charging = {
            expected: appliedConfig.charging,
            actual: battery.charging,
            pass: battery.charging === appliedConfig.charging
          };
          if (!result.checks.charging.pass) result.valid = false;
          
          // Check level
          result.checks.level = {
            expected: appliedConfig.level,
            actual: battery.level,
            pass: battery.level === appliedConfig.level
          };
          if (!result.checks.level.pass) result.valid = false;
          
          // Check chargingTime
          result.checks.chargingTime = {
            expected: appliedConfig.chargingTime,
            actual: battery.chargingTime,
            pass: battery.chargingTime === appliedConfig.chargingTime
          };
          if (!result.checks.chargingTime.pass) result.valid = false;
          
          // Check dischargingTime
          result.checks.dischargingTime = {
            expected: appliedConfig.dischargingTime,
            actual: battery.dischargingTime,
            pass: battery.dischargingTime === appliedConfig.dischargingTime
          };
          if (!result.checks.dischargingTime.pass) result.valid = false;
        }
      } catch (e) {
        // If getBattery throws in non-disable mode, that's an error
        if (appliedConfig.mode !== 'disable') {
          result.checks.getBattery = {
            expected: 'success',
            actual: e.message,
            pass: false
          };
          result.valid = false;
        }
      }
    }

    return result;
  }
}

module.exports = {
  BatterySpoof,
  BatterySpoofError
};
