/**
 * Permissions API Protection Script
 * 权限API保护脚本
 * 
 * Implements protection for Permissions API to prevent fingerprinting.
 * Controls permission status returned by navigator.permissions.query().
 * 
 * Covered methods:
 * - navigator.permissions.query (Req 33.1)
 * - Notification permission status (Req 33.2)
 * - Geolocation permission status (Req 33.3)
 * - Camera/Microphone permission status (Req 33.4)
 * - Permission change events (Req 33.5)
 * 
 * Features:
 * - Custom permission status configuration
 * - Consistent status with other API modes
 * - Permission change event handling
 * - Native function characteristics preserved
 * 
 * @module infrastructure/fingerprint/injection-scripts/permissions
 * 
 * **Validates: Requirements 33.1, 33.2, 33.3, 33.4, 33.5**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');

/**
 * Error class for permissions spoofing operations
 */
class PermissionsSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'PermissionsSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * PermissionsSpoof class
 * Provides methods to spoof Permissions API
 */
class PermissionsSpoof {
  /**
   * Valid permission states
   * @private
   */
  static _validStates = ['granted', 'denied', 'prompt'];

  /**
   * Default permissions configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'custom',           // 'custom', 'real'
    permissions: {
      geolocation: 'prompt',
      notifications: 'denied',
      'push': 'denied',
      midi: 'prompt',
      camera: 'prompt',
      microphone: 'prompt',
      'background-fetch': 'prompt',
      'background-sync': 'prompt',
      'persistent-storage': 'prompt',
      'ambient-light-sensor': 'prompt',
      accelerometer: 'prompt',
      gyroscope: 'prompt',
      magnetometer: 'prompt',
      'clipboard-read': 'prompt',
      'clipboard-write': 'granted',
      'payment-handler': 'prompt',
      'idle-detection': 'prompt',
      'periodic-background-sync': 'prompt',
      'screen-wake-lock': 'prompt',
      'nfc': 'prompt',
      'display-capture': 'prompt'
    }
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
   * Store for permission status objects
   * @private
   */
  static _permissionStatuses = {};

  /**
   * Apply permissions spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='custom'] - Spoofing mode: 'custom' or 'real'
   * @param {Object} [config.permissions] - Permission status map
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = {
      ...PermissionsSpoof._defaultConfig,
      ...config,
      permissions: {
        ...PermissionsSpoof._defaultConfig.permissions,
        ...(config.permissions || {})
      }
    };
    
    // Validate mode
    if (!['custom', 'real'].includes(mergedConfig.mode)) {
      throw new PermissionsSpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'custom' or 'real'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // Validate permission states
    for (const [name, state] of Object.entries(mergedConfig.permissions)) {
      if (!PermissionsSpoof._validStates.includes(state)) {
        throw new PermissionsSpoofError(
          `Invalid permission state for ${name}: ${state}. Must be 'granted', 'denied', or 'prompt'`,
          'INVALID_STATE',
          { permission: name, state }
        );
      }
    }

    // Store the applied configuration
    PermissionsSpoof._appliedConfig = mergedConfig;

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // If mode is 'real', don't spoof anything
    if (mergedConfig.mode === 'real') {
      return results;
    }

    // Spoof navigator.permissions.query (Req 33.1)
    try {
      PermissionsSpoof._spoofPermissionsQuery();
      results.spoofed.push('permissions.query');
    } catch (e) {
      results.failed.push({ method: 'permissions.query', error: e.message });
      results.success = false;
    }

    return results;
  }

  /**
   * Create a fake PermissionStatus object
   * @private
   * @param {string} name - Permission name
   * @param {string} state - Permission state
   * @returns {Object} A fake PermissionStatus-like object
   */
  static _createFakePermissionStatus(name, state) {
    // Event listeners storage
    const eventListeners = {
      change: []
    };

    let currentState = state;
    let onchangeHandler = null;

    const permissionStatus = {
      get name() {
        return name;
      },
      get state() {
        return currentState;
      },
      // Deprecated but still used
      get status() {
        return currentState;
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
          // Call onchange handler
          if (typeof onchangeHandler === 'function') {
            try {
              onchangeHandler.call(permissionStatus, event);
            } catch (e) {
              // Ignore errors
            }
          }
          // Call registered listeners
          for (const { listener } of eventListeners.change) {
            try {
              listener.call(permissionStatus, event);
            } catch (e) {
              // Ignore errors
            }
          }
        }
        return true;
      },
      // Internal method to update state (Req 33.5)
      _updateState(newState) {
        if (currentState !== newState) {
          currentState = newState;
          const event = new Event('change');
          permissionStatus.dispatchEvent(event);
        }
      }
    };

    // Make methods appear native
    const methods = ['addEventListener', 'removeEventListener', 'dispatchEvent'];
    methods.forEach(methodName => {
      const method = permissionStatus[methodName];
      Object.defineProperty(method, 'name', {
        value: methodName,
        writable: false,
        enumerable: false,
        configurable: true
      });
      const nativeStr = `function ${methodName}() { [native code] }`;
      method.toString = function() { return nativeStr; };
    });

    return permissionStatus;
  }

  /**
   * Spoof navigator.permissions.query
   * Requirement 33.1: Return configured permission status
   * @private
   */
  static _spoofPermissionsQuery() {
    // Check if navigator.permissions exists (browser environment)
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      return;
    }

    const permissions = navigator.permissions;
    const originalQuery = permissions.query;

    // Store original method
    if (originalQuery) {
      PermissionsSpoof._originalMethods.query = originalQuery;
    }

    // Create wrapped function
    const wrappedQuery = NativeWrapper.wrap(
      originalQuery || function() { return Promise.reject(new Error('Permissions API not supported')); },
      function(original, args, thisArg) {
        const config = PermissionsSpoof._appliedConfig;

        // If mode is 'real', return original result
        if (!config || config.mode === 'real') {
          if (original && typeof original === 'function') {
            return original.apply(thisArg, args);
          }
          return Promise.reject(new Error('Permissions API not supported'));
        }

        const [descriptor] = args;
        if (!descriptor || typeof descriptor !== 'object') {
          return Promise.reject(new TypeError('Invalid permission descriptor'));
        }

        const permissionName = descriptor.name;
        if (!permissionName) {
          return Promise.reject(new TypeError('Permission name is required'));
        }

        // Get configured state or default to 'prompt'
        const state = config.permissions[permissionName] || 'prompt';

        // Create or retrieve cached permission status
        const cacheKey = permissionName;
        if (!PermissionsSpoof._permissionStatuses[cacheKey]) {
          PermissionsSpoof._permissionStatuses[cacheKey] = 
            PermissionsSpoof._createFakePermissionStatus(permissionName, state);
        }

        return Promise.resolve(PermissionsSpoof._permissionStatuses[cacheKey]);
      },
      { name: 'query', length: 1 }
    );

    // Replace the method on permissions
    try {
      Object.defineProperty(permissions, 'query', {
        value: wrappedQuery,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      // If defineProperty fails, try direct assignment
      permissions.query = wrappedQuery;
    }
  }

  /**
   * Update a permission state and trigger change event (Req 33.5)
   * @param {string} name - Permission name
   * @param {string} newState - New permission state
   */
  static updatePermissionState(name, newState) {
    if (!PermissionsSpoof._validStates.includes(newState)) {
      throw new PermissionsSpoofError(
        `Invalid permission state: ${newState}`,
        'INVALID_STATE',
        { state: newState }
      );
    }

    // Update config
    if (PermissionsSpoof._appliedConfig) {
      PermissionsSpoof._appliedConfig.permissions[name] = newState;
    }

    // Update cached status and trigger event
    if (PermissionsSpoof._permissionStatuses[name]) {
      PermissionsSpoof._permissionStatuses[name]._updateState(newState);
    }
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return PermissionsSpoof._appliedConfig ? { 
      ...PermissionsSpoof._appliedConfig,
      permissions: { ...PermissionsSpoof._appliedConfig.permissions }
    } : null;
  }

  /**
   * Restore original permissions methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    // Restore query
    if (PermissionsSpoof._originalMethods.query && 
        typeof navigator !== 'undefined' && navigator.permissions) {
      try {
        navigator.permissions.query = PermissionsSpoof._originalMethods.query;
        results.restored.push('query');
      } catch (e) {
        results.failed.push({ method: 'query', error: e.message });
      }
    }

    // Clear stored data
    PermissionsSpoof._originalMethods = {};
    PermissionsSpoof._appliedConfig = null;
    PermissionsSpoof._permissionStatuses = {};

    return results;
  }

  /**
   * Generate injection script string for browser context
   * @param {Object} config - Permissions configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = {
      ...PermissionsSpoof._defaultConfig,
      ...config,
      permissions: {
        ...PermissionsSpoof._defaultConfig.permissions,
        ...(config.permissions || {})
      }
    };

    return `
(function() {
  'use strict';
  
  // Permissions spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)},
    permissions: ${JSON.stringify(mergedConfig.permissions)}
  };
  
  // Skip if mode is 'real'
  if (config.mode === 'real') {
    return;
  }
  
  // Check if navigator.permissions exists
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return;
  }
  
  const permissions = navigator.permissions;
  const permissionStatuses = {};
  
  // Create fake PermissionStatus object
  function createFakePermissionStatus(name, state) {
    const eventListeners = { change: [] };
    let currentState = state;
    let onchangeHandler = null;
    
    const permissionStatus = {
      get name() { return name; },
      get state() { return currentState; },
      get status() { return currentState; },
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
            try { onchangeHandler.call(permissionStatus, event); } catch (e) {}
          }
          eventListeners.change.forEach(function(item) {
            try { item.listener.call(permissionStatus, event); } catch (e) {}
          });
        }
        return true;
      }
    };
    
    // Make methods appear native
    ['addEventListener', 'removeEventListener', 'dispatchEvent'].forEach(function(methodName) {
      const method = permissionStatus[methodName];
      Object.defineProperty(method, 'name', {
        value: methodName,
        writable: false,
        enumerable: false,
        configurable: true
      });
      const nativeStr = 'function ' + methodName + '() { [native code] }';
      method.toString = function() { return nativeStr; };
    });
    
    return permissionStatus;
  }
  
  // Store original query
  const originalQuery = permissions.query;
  
  // Create spoofed query function (Req 33.1)
  function spoofedQuery(descriptor) {
    if (!descriptor || typeof descriptor !== 'object') {
      return Promise.reject(new TypeError('Invalid permission descriptor'));
    }
    
    const permissionName = descriptor.name;
    if (!permissionName) {
      return Promise.reject(new TypeError('Permission name is required'));
    }
    
    // Get configured state or default to 'prompt'
    const state = config.permissions[permissionName] || 'prompt';
    
    // Create or retrieve cached permission status
    if (!permissionStatuses[permissionName]) {
      permissionStatuses[permissionName] = createFakePermissionStatus(permissionName, state);
    }
    
    return Promise.resolve(permissionStatuses[permissionName]);
  }
  
  // Make the function appear native
  Object.defineProperty(spoofedQuery, 'name', {
    value: 'query',
    writable: false,
    enumerable: false,
    configurable: true
  });
  Object.defineProperty(spoofedQuery, 'length', {
    value: 1,
    writable: false,
    enumerable: false,
    configurable: true
  });
  const nativeQueryStr = 'function query() { [native code] }';
  spoofedQuery.toString = function() { return nativeQueryStr; };
  
  // Replace the method on permissions
  try {
    Object.defineProperty(permissions, 'query', {
      value: spoofedQuery,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } catch (e) {
    permissions.query = spoofedQuery;
  }
})();
`;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Permissions configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...PermissionsSpoof._defaultConfig };
    }

    const advancedApis = fingerprintConfig.advancedApis || {};
    const permissionsConfig = advancedApis.permissions || {};
    const geolocationConfig = fingerprintConfig.geolocation || {};
    const mediaDevicesConfig = fingerprintConfig.mediaDevices || {};
    
    // Build permissions based on other API modes
    const permissions = { ...PermissionsSpoof._defaultConfig.permissions };
    
    // Geolocation permission based on geolocation mode (Req 33.3)
    if (geolocationConfig.mode === 'deny') {
      permissions.geolocation = 'denied';
    } else if (geolocationConfig.mode === 'custom' || geolocationConfig.mode === 'ip-based') {
      permissions.geolocation = 'granted';
    }
    
    // Camera/Microphone based on media devices mode (Req 33.4)
    if (mediaDevicesConfig.mode === 'hide') {
      permissions.camera = 'denied';
      permissions.microphone = 'denied';
    } else if (mediaDevicesConfig.mode === 'fake') {
      permissions.camera = 'granted';
      permissions.microphone = 'granted';
    }
    
    // Override with explicit permissions config
    if (permissionsConfig.permissions) {
      Object.assign(permissions, permissionsConfig.permissions);
    }
    
    return {
      mode: permissionsConfig.mode || PermissionsSpoof._defaultConfig.mode,
      permissions
    };
  }

  /**
   * Verify that permissions spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Promise<Object>} Verification result
   */
  static async verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = PermissionsSpoof.getAppliedConfig();
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

    // If in browser environment, verify actual query behavior
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      try {
        // Test geolocation permission (Req 33.3)
        const geoStatus = await navigator.permissions.query({ name: 'geolocation' });
        const expectedGeoState = appliedConfig.permissions.geolocation || 'prompt';
        result.checks.geolocation = {
          expected: expectedGeoState,
          actual: geoStatus.state,
          pass: geoStatus.state === expectedGeoState
        };
        if (!result.checks.geolocation.pass) result.valid = false;

        // Test notifications permission (Req 33.2)
        const notifStatus = await navigator.permissions.query({ name: 'notifications' });
        const expectedNotifState = appliedConfig.permissions.notifications || 'prompt';
        result.checks.notifications = {
          expected: expectedNotifState,
          actual: notifStatus.state,
          pass: notifStatus.state === expectedNotifState
        };
        if (!result.checks.notifications.pass) result.valid = false;
      } catch (e) {
        result.checks.query = {
          expected: 'success',
          actual: e.message,
          pass: false
        };
        result.valid = false;
      }
    }

    return result;
  }
}

module.exports = {
  PermissionsSpoof,
  PermissionsSpoofError
};
