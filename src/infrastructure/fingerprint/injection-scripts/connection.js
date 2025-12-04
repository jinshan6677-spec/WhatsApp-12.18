/**
 * Connection API Protection Script
 * 网络连接API保护脚本
 * 
 * Implements protection for Network Information API to prevent fingerprinting.
 * Controls network connection information returned by navigator.connection.
 * 
 * Covered properties:
 * - navigator.connection (Req 35.1)
 * - connection.effectiveType (Req 35.2)
 * - connection.downlink (Req 35.3)
 * - connection.rtt (Req 35.4)
 * - Disable mode (Req 35.5)
 * 
 * Features:
 * - Custom network connection configuration
 * - Disable mode makes navigator.connection undefined
 * - Custom mode returns configured values
 * - Native function characteristics preserved
 * 
 * @module infrastructure/fingerprint/injection-scripts/connection
 * 
 * **Validates: Requirements 35.1, 35.2, 35.3, 35.4, 35.5**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');

/**
 * Error class for connection spoofing operations
 */
class ConnectionSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ConnectionSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * ConnectionSpoof class
 * Provides methods to spoof Network Information API
 */
class ConnectionSpoof {
  /**
   * Valid effective types
   * @private
   */
  static _validEffectiveTypes = ['slow-2g', '2g', '3g', '4g'];

  /**
   * Default connection configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'custom',           // 'custom', 'disable', 'real'
    effectiveType: '4g',      // 'slow-2g', '2g', '3g', '4g'
    downlink: 10,             // Mbps
    rtt: 50,                  // milliseconds
    saveData: false,          // Data saver mode
    type: 'wifi'              // 'bluetooth', 'cellular', 'ethernet', 'none', 'wifi', 'wimax', 'other', 'unknown'
  };

  /**
   * Store for original property descriptor
   * @private
   */
  static _originalDescriptor = null;

  /**
   * Store for applied configuration
   * @private
   */
  static _appliedConfig = null;

  /**
   * Store for fake connection object
   * @private
   */
  static _fakeConnection = null;

  /**
   * Apply connection spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='custom'] - Spoofing mode: 'custom', 'disable', or 'real'
   * @param {string} [config.effectiveType='4g'] - Effective connection type
   * @param {number} [config.downlink=10] - Downlink speed in Mbps
   * @param {number} [config.rtt=50] - Round-trip time in milliseconds
   * @param {boolean} [config.saveData=false] - Data saver mode
   * @param {string} [config.type='wifi'] - Connection type
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = { ...ConnectionSpoof._defaultConfig, ...config };
    
    // Validate mode
    if (!['custom', 'disable', 'real'].includes(mergedConfig.mode)) {
      throw new ConnectionSpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'custom', 'disable', or 'real'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // Validate effectiveType
    if (!ConnectionSpoof._validEffectiveTypes.includes(mergedConfig.effectiveType)) {
      throw new ConnectionSpoofError(
        `Invalid effectiveType: ${mergedConfig.effectiveType}. Must be one of: ${ConnectionSpoof._validEffectiveTypes.join(', ')}`,
        'INVALID_EFFECTIVE_TYPE',
        { effectiveType: mergedConfig.effectiveType }
      );
    }

    // Validate downlink
    if (typeof mergedConfig.downlink !== 'number' || mergedConfig.downlink < 0) {
      throw new ConnectionSpoofError(
        `Invalid downlink: ${mergedConfig.downlink}. Must be a non-negative number`,
        'INVALID_DOWNLINK',
        { downlink: mergedConfig.downlink }
      );
    }

    // Validate rtt
    if (typeof mergedConfig.rtt !== 'number' || mergedConfig.rtt < 0) {
      throw new ConnectionSpoofError(
        `Invalid rtt: ${mergedConfig.rtt}. Must be a non-negative number`,
        'INVALID_RTT',
        { rtt: mergedConfig.rtt }
      );
    }

    // Store the applied configuration
    ConnectionSpoof._appliedConfig = mergedConfig;

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // If mode is 'real', don't spoof anything
    if (mergedConfig.mode === 'real') {
      return results;
    }

    // Spoof navigator.connection (Req 35.1-35.5)
    try {
      ConnectionSpoof._spoofConnection();
      results.spoofed.push('navigator.connection');
    } catch (e) {
      results.failed.push({ property: 'navigator.connection', error: e.message });
      results.success = false;
    }

    return results;
  }

  /**
   * Create a fake NetworkInformation object
   * @private
   * @returns {Object} A fake NetworkInformation-like object
   */
  static _createFakeConnection() {
    const config = ConnectionSpoof._appliedConfig;
    
    // Event listeners storage
    const eventListeners = {
      change: []
    };

    let onchangeHandler = null;

    const fakeConnection = {
      // Properties (Req 35.2, 35.3, 35.4)
      get effectiveType() {
        return config.effectiveType;
      },
      get downlink() {
        return config.downlink;
      },
      get rtt() {
        return config.rtt;
      },
      get saveData() {
        return config.saveData;
      },
      get type() {
        return config.type;
      },
      // Deprecated but still used
      get downlinkMax() {
        return config.downlink * 1.5;
      },
      get onchange() {
        return onchangeHandler;
      },
      set onchange(handler) {
        onchangeHandler = handler;
      },
      addEventListener(type, listener, options) {
        if (type === 'change' && typeof listener === 'function') {
          eventListeners.change.push({ listener, options });
        }
      },
      removeEventListener(type, listener, options) {
        if (type === 'change') {
          const index = eventListeners.change.findIndex(
            item => item.listener === listener
          );
          if (index !== -1) {
            eventListeners.change.splice(index, 1);
          }
        }
      },
      dispatchEvent(event) {
        if (event.type === 'change') {
          if (typeof onchangeHandler === 'function') {
            try {
              onchangeHandler.call(fakeConnection, event);
            } catch (e) {
              // Ignore errors
            }
          }
          for (const { listener } of eventListeners.change) {
            try {
              listener.call(fakeConnection, event);
            } catch (e) {
              // Ignore errors
            }
          }
        }
        return true;
      }
    };

    // Make methods appear native
    const methods = ['addEventListener', 'removeEventListener', 'dispatchEvent'];
    methods.forEach(methodName => {
      const method = fakeConnection[methodName];
      Object.defineProperty(method, 'name', {
        value: methodName,
        writable: false,
        enumerable: false,
        configurable: true
      });
      const nativeStr = `function ${methodName}() { [native code] }`;
      method.toString = function() { return nativeStr; };
    });

    return fakeConnection;
  }

  /**
   * Spoof navigator.connection
   * Requirement 35.1: Return configured connection info
   * Requirement 35.5: Disable mode makes navigator.connection undefined
   * @private
   */
  static _spoofConnection() {
    // Check if navigator exists (browser environment)
    if (typeof navigator === 'undefined') {
      return;
    }

    const config = ConnectionSpoof._appliedConfig;

    // Store original descriptor
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'connection') ||
                               Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'connection');
    
    if (originalDescriptor) {
      ConnectionSpoof._originalDescriptor = originalDescriptor;
    }

    // If mode is 'disable', make connection undefined (Req 35.5)
    if (config.mode === 'disable') {
      try {
        Object.defineProperty(navigator, 'connection', {
          get: function() {
            return undefined;
          },
          enumerable: true,
          configurable: true
        });
      } catch (e) {
        // If defineProperty fails, try delete
        try {
          delete navigator.connection;
        } catch (e2) {
          // Ignore
        }
      }
      return;
    }

    // Create fake connection object
    ConnectionSpoof._fakeConnection = ConnectionSpoof._createFakeConnection();

    // Replace navigator.connection
    try {
      Object.defineProperty(navigator, 'connection', {
        get: function() {
          return ConnectionSpoof._fakeConnection;
        },
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      // If defineProperty fails, that's okay
    }
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return ConnectionSpoof._appliedConfig ? { ...ConnectionSpoof._appliedConfig } : null;
  }

  /**
   * Restore original connection property
   * @returns {Object} Result object with restored properties
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    // Restore connection
    if (ConnectionSpoof._originalDescriptor && typeof navigator !== 'undefined') {
      try {
        Object.defineProperty(navigator, 'connection', ConnectionSpoof._originalDescriptor);
        results.restored.push('connection');
      } catch (e) {
        results.failed.push({ property: 'connection', error: e.message });
      }
    }

    // Clear stored data
    ConnectionSpoof._originalDescriptor = null;
    ConnectionSpoof._appliedConfig = null;
    ConnectionSpoof._fakeConnection = null;

    return results;
  }

  /**
   * Generate injection script string for browser context
   * @param {Object} config - Connection configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...ConnectionSpoof._defaultConfig, ...config };

    return `
(function() {
  'use strict';
  
  // Connection spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)},
    effectiveType: ${JSON.stringify(mergedConfig.effectiveType)},
    downlink: ${mergedConfig.downlink},
    rtt: ${mergedConfig.rtt},
    saveData: ${mergedConfig.saveData},
    type: ${JSON.stringify(mergedConfig.type)}
  };
  
  // Skip if mode is 'real'
  if (config.mode === 'real') {
    return;
  }
  
  // Check if navigator exists
  if (typeof navigator === 'undefined') {
    return;
  }
  
  // If mode is 'disable', make connection undefined (Req 35.5)
  if (config.mode === 'disable') {
    try {
      Object.defineProperty(navigator, 'connection', {
        get: function() {
          return undefined;
        },
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      try {
        delete navigator.connection;
      } catch (e2) {}
    }
    return;
  }
  
  // Create fake connection object (Req 35.1-35.4)
  const eventListeners = { change: [] };
  let onchangeHandler = null;
  
  const fakeConnection = {
    get effectiveType() { return config.effectiveType; },
    get downlink() { return config.downlink; },
    get rtt() { return config.rtt; },
    get saveData() { return config.saveData; },
    get type() { return config.type; },
    get downlinkMax() { return config.downlink * 1.5; },
    get onchange() { return onchangeHandler; },
    set onchange(handler) { onchangeHandler = handler; },
    addEventListener: function(type, listener, options) {
      if (type === 'change' && typeof listener === 'function') {
        eventListeners.change.push({ listener: listener, options: options });
      }
    },
    removeEventListener: function(type, listener, options) {
      if (type === 'change') {
        const index = eventListeners.change.findIndex(function(item) {
          return item.listener === listener;
        });
        if (index !== -1) {
          eventListeners.change.splice(index, 1);
        }
      }
    },
    dispatchEvent: function(event) {
      if (event.type === 'change') {
        if (typeof onchangeHandler === 'function') {
          try { onchangeHandler.call(fakeConnection, event); } catch (e) {}
        }
        eventListeners.change.forEach(function(item) {
          try { item.listener.call(fakeConnection, event); } catch (e) {}
        });
      }
      return true;
    }
  };
  
  // Make methods appear native
  ['addEventListener', 'removeEventListener', 'dispatchEvent'].forEach(function(methodName) {
    const method = fakeConnection[methodName];
    Object.defineProperty(method, 'name', {
      value: methodName,
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeStr = 'function ' + methodName + '() { [native code] }';
    method.toString = function() { return nativeStr; };
  });
  
  // Replace navigator.connection
  try {
    Object.defineProperty(navigator, 'connection', {
      get: function() {
        return fakeConnection;
      },
      enumerable: true,
      configurable: true
    });
  } catch (e) {
    // If defineProperty fails, that's okay
  }
})();
`;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Connection configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...ConnectionSpoof._defaultConfig };
    }

    const advancedApis = fingerprintConfig.advancedApis || {};
    const connectionConfig = advancedApis.connection || {};
    
    return {
      mode: connectionConfig.mode || ConnectionSpoof._defaultConfig.mode,
      effectiveType: connectionConfig.effectiveType || ConnectionSpoof._defaultConfig.effectiveType,
      downlink: connectionConfig.downlink !== undefined ? connectionConfig.downlink : ConnectionSpoof._defaultConfig.downlink,
      rtt: connectionConfig.rtt !== undefined ? connectionConfig.rtt : ConnectionSpoof._defaultConfig.rtt,
      saveData: connectionConfig.saveData !== undefined ? connectionConfig.saveData : ConnectionSpoof._defaultConfig.saveData,
      type: connectionConfig.type || ConnectionSpoof._defaultConfig.type
    };
  }

  /**
   * Verify that connection spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Object} Verification result
   */
  static verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = ConnectionSpoof.getAppliedConfig();
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

    // If in browser environment, verify actual connection behavior
    if (typeof navigator !== 'undefined') {
      if (appliedConfig.mode === 'disable') {
        // Should be undefined (Req 35.5)
        result.checks.disableMode = {
          expected: undefined,
          actual: navigator.connection,
          pass: navigator.connection === undefined
        };
        if (!result.checks.disableMode.pass) result.valid = false;
      } else if (appliedConfig.mode === 'custom' && navigator.connection) {
        // Check effectiveType (Req 35.2)
        result.checks.effectiveType = {
          expected: appliedConfig.effectiveType,
          actual: navigator.connection.effectiveType,
          pass: navigator.connection.effectiveType === appliedConfig.effectiveType
        };
        if (!result.checks.effectiveType.pass) result.valid = false;

        // Check downlink (Req 35.3)
        result.checks.downlink = {
          expected: appliedConfig.downlink,
          actual: navigator.connection.downlink,
          pass: navigator.connection.downlink === appliedConfig.downlink
        };
        if (!result.checks.downlink.pass) result.valid = false;

        // Check rtt (Req 35.4)
        result.checks.rtt = {
          expected: appliedConfig.rtt,
          actual: navigator.connection.rtt,
          pass: navigator.connection.rtt === appliedConfig.rtt
        };
        if (!result.checks.rtt.pass) result.valid = false;
      }
    }

    return result;
  }
}

module.exports = {
  ConnectionSpoof,
  ConnectionSpoofError
};
