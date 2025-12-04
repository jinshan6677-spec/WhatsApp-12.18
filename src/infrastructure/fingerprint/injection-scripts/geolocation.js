/**
 * Geolocation Spoofing Script
 * 地理位置伪装脚本
 * 
 * Implements spoofing for Geolocation API to prevent location tracking
 * and provide custom location data.
 * 
 * Covered APIs:
 * - navigator.geolocation.getCurrentPosition (Req 12.4)
 * - navigator.geolocation.watchPosition (Req 12.5)
 * - navigator.geolocation.clearWatch
 * 
 * Modes:
 * - 'custom': Return configured coordinates (Req 12.1)
 * - 'deny': Reject all geolocation requests (Req 12.2)
 * - 'ip-based': Infer location from proxy IP (Req 12.3)
 * - 'real': Return real system location
 * 
 * @module infrastructure/fingerprint/injection-scripts/geolocation
 * 
 * **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');

/**
 * Error class for geolocation spoofing operations
 */
class GeolocationSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'GeolocationSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * GeolocationSpoof class
 * Provides methods to spoof Geolocation API
 */
class GeolocationSpoof {
  /**
   * Default geolocation configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'custom',              // 'custom', 'deny', 'ip-based', 'real'
    latitude: 40.7128,           // Default: New York City
    longitude: -74.0060,
    accuracy: 100,               // Accuracy in meters
    altitude: null,              // Altitude in meters (optional)
    altitudeAccuracy: null,      // Altitude accuracy in meters (optional)
    heading: null,               // Heading in degrees (optional)
    speed: null                  // Speed in m/s (optional)
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
   * Store for active watch IDs and their callbacks
   * @private
   */
  static _watchCallbacks = new Map();

  /**
   * Counter for generating watch IDs
   * @private
   */
  static _watchIdCounter = 1;

  /**
   * Interval IDs for watch position updates
   * @private
   */
  static _watchIntervals = new Map();

  /**
   * Apply geolocation spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='custom'] - Spoofing mode: 'custom', 'deny', 'ip-based', or 'real'
   * @param {number} [config.latitude=40.7128] - Latitude coordinate (Req 12.1)
   * @param {number} [config.longitude=-74.0060] - Longitude coordinate (Req 12.1)
   * @param {number} [config.accuracy=100] - Accuracy in meters
   * @param {number|null} [config.altitude=null] - Altitude in meters
   * @param {number|null} [config.altitudeAccuracy=null] - Altitude accuracy in meters
   * @param {number|null} [config.heading=null] - Heading in degrees (0-360)
   * @param {number|null} [config.speed=null] - Speed in m/s
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = { ...GeolocationSpoof._defaultConfig, ...config };
    
    // Validate mode
    if (!['custom', 'deny', 'ip-based', 'real'].includes(mergedConfig.mode)) {
      throw new GeolocationSpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'custom', 'deny', 'ip-based', or 'real'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // Validate latitude (-90 to 90)
    if (typeof mergedConfig.latitude !== 'number' || 
        mergedConfig.latitude < -90 || 
        mergedConfig.latitude > 90) {
      throw new GeolocationSpoofError(
        `Invalid latitude: ${mergedConfig.latitude}. Must be a number between -90 and 90`,
        'INVALID_LATITUDE',
        { latitude: mergedConfig.latitude }
      );
    }

    // Validate longitude (-180 to 180)
    if (typeof mergedConfig.longitude !== 'number' || 
        mergedConfig.longitude < -180 || 
        mergedConfig.longitude > 180) {
      throw new GeolocationSpoofError(
        `Invalid longitude: ${mergedConfig.longitude}. Must be a number between -180 and 180`,
        'INVALID_LONGITUDE',
        { longitude: mergedConfig.longitude }
      );
    }

    // Validate accuracy (must be positive)
    if (typeof mergedConfig.accuracy !== 'number' || mergedConfig.accuracy <= 0) {
      throw new GeolocationSpoofError(
        `Invalid accuracy: ${mergedConfig.accuracy}. Must be a positive number`,
        'INVALID_ACCURACY',
        { accuracy: mergedConfig.accuracy }
      );
    }

    // Validate heading if provided (0-360)
    if (mergedConfig.heading !== null && 
        (typeof mergedConfig.heading !== 'number' || 
         mergedConfig.heading < 0 || 
         mergedConfig.heading > 360)) {
      throw new GeolocationSpoofError(
        `Invalid heading: ${mergedConfig.heading}. Must be a number between 0 and 360`,
        'INVALID_HEADING',
        { heading: mergedConfig.heading }
      );
    }

    // Validate speed if provided (must be non-negative)
    if (mergedConfig.speed !== null && 
        (typeof mergedConfig.speed !== 'number' || mergedConfig.speed < 0)) {
      throw new GeolocationSpoofError(
        `Invalid speed: ${mergedConfig.speed}. Must be a non-negative number`,
        'INVALID_SPEED',
        { speed: mergedConfig.speed }
      );
    }

    // Store the applied configuration
    GeolocationSpoof._appliedConfig = mergedConfig;

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

    // Check if geolocation API exists
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      results.failed.push({ method: 'geolocation', error: 'Geolocation API not available' });
      results.success = false;
      return results;
    }

    // Spoof getCurrentPosition (Req 12.4)
    try {
      GeolocationSpoof._spoofGetCurrentPosition();
      results.spoofed.push('getCurrentPosition');
    } catch (e) {
      results.failed.push({ method: 'getCurrentPosition', error: e.message });
      results.success = false;
    }

    // Spoof watchPosition (Req 12.5)
    try {
      GeolocationSpoof._spoofWatchPosition();
      results.spoofed.push('watchPosition');
    } catch (e) {
      results.failed.push({ method: 'watchPosition', error: e.message });
      results.success = false;
    }

    // Spoof clearWatch
    try {
      GeolocationSpoof._spoofClearWatch();
      results.spoofed.push('clearWatch');
    } catch (e) {
      results.failed.push({ method: 'clearWatch', error: e.message });
      results.success = false;
    }

    return results;
  }


  /**
   * Create a GeolocationPosition-like object
   * @private
   * @returns {Object} Position object matching GeolocationPosition interface
   */
  static _createPosition() {
    const config = GeolocationSpoof._appliedConfig;
    const timestamp = Date.now();

    // Create coords object matching GeolocationCoordinates interface
    const coords = {
      latitude: config.latitude,
      longitude: config.longitude,
      accuracy: config.accuracy,
      altitude: config.altitude,
      altitudeAccuracy: config.altitudeAccuracy,
      heading: config.heading,
      speed: config.speed
    };

    // Make coords properties read-only
    Object.freeze(coords);

    // Create position object matching GeolocationPosition interface
    const position = {
      coords: coords,
      timestamp: timestamp
    };

    // Make position properties read-only
    Object.freeze(position);

    return position;
  }

  /**
   * Create a GeolocationPositionError-like object
   * @private
   * @param {number} code - Error code (1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT)
   * @param {string} message - Error message
   * @returns {Object} Error object matching GeolocationPositionError interface
   */
  static _createPositionError(code, message) {
    const error = {
      code: code,
      message: message,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    };

    Object.freeze(error);
    return error;
  }

  /**
   * Spoof navigator.geolocation.getCurrentPosition
   * Requirement 12.4: Return configured location data
   * @private
   */
  static _spoofGetCurrentPosition() {
    const geolocation = navigator.geolocation;
    const originalGetCurrentPosition = geolocation.getCurrentPosition;

    // Store original method
    GeolocationSpoof._originalMethods.getCurrentPosition = originalGetCurrentPosition;

    // Create wrapped function
    const wrappedGetCurrentPosition = NativeWrapper.wrap(
      originalGetCurrentPosition,
      function(original, args, thisArg) {
        const [successCallback, errorCallback, options] = args;
        const config = GeolocationSpoof._appliedConfig;

        // If mode is 'real', use original method
        if (!config || config.mode === 'real') {
          return original.apply(thisArg, args);
        }

        // If mode is 'deny', call error callback with PERMISSION_DENIED (Req 12.2)
        if (config.mode === 'deny') {
          if (typeof errorCallback === 'function') {
            // Use setTimeout to simulate async behavior
            setTimeout(() => {
              const error = GeolocationSpoof._createPositionError(
                1, // PERMISSION_DENIED
                'User denied Geolocation'
              );
              errorCallback(error);
            }, 0);
          }
          return;
        }

        // For 'custom' and 'ip-based' modes, return configured position (Req 12.1, 12.3)
        if (typeof successCallback === 'function') {
          // Use setTimeout to simulate async behavior
          setTimeout(() => {
            const position = GeolocationSpoof._createPosition();
            successCallback(position);
          }, 0);
        }
      },
      { name: 'getCurrentPosition', length: 1 }
    );

    // Replace the method on the geolocation object
    NativeWrapper.protectPrototype(geolocation, 'getCurrentPosition', wrappedGetCurrentPosition);
  }

  /**
   * Spoof navigator.geolocation.watchPosition
   * Requirement 12.5: Continuously return configured location data
   * @private
   */
  static _spoofWatchPosition() {
    const geolocation = navigator.geolocation;
    const originalWatchPosition = geolocation.watchPosition;

    // Store original method
    GeolocationSpoof._originalMethods.watchPosition = originalWatchPosition;

    // Create wrapped function
    const wrappedWatchPosition = NativeWrapper.wrap(
      originalWatchPosition,
      function(original, args, thisArg) {
        const [successCallback, errorCallback, options] = args;
        const config = GeolocationSpoof._appliedConfig;

        // If mode is 'real', use original method
        if (!config || config.mode === 'real') {
          return original.apply(thisArg, args);
        }

        // Generate a unique watch ID
        const watchId = GeolocationSpoof._watchIdCounter++;

        // If mode is 'deny', call error callback with PERMISSION_DENIED (Req 12.2)
        if (config.mode === 'deny') {
          if (typeof errorCallback === 'function') {
            setTimeout(() => {
              const error = GeolocationSpoof._createPositionError(
                1, // PERMISSION_DENIED
                'User denied Geolocation'
              );
              errorCallback(error);
            }, 0);
          }
          return watchId;
        }

        // Store the callback for this watch ID
        GeolocationSpoof._watchCallbacks.set(watchId, {
          success: successCallback,
          error: errorCallback,
          options: options
        });

        // For 'custom' and 'ip-based' modes, periodically call success callback (Req 12.5)
        if (typeof successCallback === 'function') {
          // Call immediately first
          setTimeout(() => {
            const position = GeolocationSpoof._createPosition();
            successCallback(position);
          }, 0);

          // Then set up periodic updates (every 5 seconds by default)
          const updateInterval = options?.maximumAge || 5000;
          const intervalId = setInterval(() => {
            // Check if watch is still active
            if (!GeolocationSpoof._watchCallbacks.has(watchId)) {
              clearInterval(intervalId);
              return;
            }
            const position = GeolocationSpoof._createPosition();
            successCallback(position);
          }, updateInterval);

          // Store interval ID for cleanup
          GeolocationSpoof._watchIntervals.set(watchId, intervalId);
        }

        return watchId;
      },
      { name: 'watchPosition', length: 1 }
    );

    // Replace the method on the geolocation object
    NativeWrapper.protectPrototype(geolocation, 'watchPosition', wrappedWatchPosition);
  }


  /**
   * Spoof navigator.geolocation.clearWatch
   * @private
   */
  static _spoofClearWatch() {
    const geolocation = navigator.geolocation;
    const originalClearWatch = geolocation.clearWatch;

    // Store original method
    GeolocationSpoof._originalMethods.clearWatch = originalClearWatch;

    // Create wrapped function
    const wrappedClearWatch = NativeWrapper.wrap(
      originalClearWatch,
      function(original, args, thisArg) {
        const [watchId] = args;
        const config = GeolocationSpoof._appliedConfig;

        // If mode is 'real', use original method
        if (!config || config.mode === 'real') {
          return original.apply(thisArg, args);
        }

        // Clear the watch callback
        GeolocationSpoof._watchCallbacks.delete(watchId);

        // Clear the interval if exists
        const intervalId = GeolocationSpoof._watchIntervals.get(watchId);
        if (intervalId) {
          clearInterval(intervalId);
          GeolocationSpoof._watchIntervals.delete(watchId);
        }
      },
      { name: 'clearWatch', length: 1 }
    );

    // Replace the method on the geolocation object
    NativeWrapper.protectPrototype(geolocation, 'clearWatch', wrappedClearWatch);
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return GeolocationSpoof._appliedConfig ? { ...GeolocationSpoof._appliedConfig } : null;
  }

  /**
   * Restore original geolocation methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    // Clear all watch intervals
    for (const [watchId, intervalId] of GeolocationSpoof._watchIntervals) {
      clearInterval(intervalId);
    }
    GeolocationSpoof._watchIntervals.clear();
    GeolocationSpoof._watchCallbacks.clear();

    // Check if geolocation exists
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return results;
    }

    const geolocation = navigator.geolocation;

    // Restore getCurrentPosition
    if (GeolocationSpoof._originalMethods.getCurrentPosition) {
      try {
        geolocation.getCurrentPosition = GeolocationSpoof._originalMethods.getCurrentPosition;
        results.restored.push('getCurrentPosition');
      } catch (e) {
        results.failed.push({ method: 'getCurrentPosition', error: e.message });
      }
    }

    // Restore watchPosition
    if (GeolocationSpoof._originalMethods.watchPosition) {
      try {
        geolocation.watchPosition = GeolocationSpoof._originalMethods.watchPosition;
        results.restored.push('watchPosition');
      } catch (e) {
        results.failed.push({ method: 'watchPosition', error: e.message });
      }
    }

    // Restore clearWatch
    if (GeolocationSpoof._originalMethods.clearWatch) {
      try {
        geolocation.clearWatch = GeolocationSpoof._originalMethods.clearWatch;
        results.restored.push('clearWatch');
      } catch (e) {
        results.failed.push({ method: 'clearWatch', error: e.message });
      }
    }

    // Clear stored data
    GeolocationSpoof._originalMethods = {};
    GeolocationSpoof._appliedConfig = null;
    GeolocationSpoof._watchIdCounter = 1;

    return results;
  }

  /**
   * Generate injection script string for browser context
   * This creates a self-contained script that can be injected into a page
   * 
   * @param {Object} config - Geolocation configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...GeolocationSpoof._defaultConfig, ...config };

    return `
(function() {
  'use strict';
  
  // Geolocation spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)},
    latitude: ${mergedConfig.latitude},
    longitude: ${mergedConfig.longitude},
    accuracy: ${mergedConfig.accuracy},
    altitude: ${mergedConfig.altitude === null ? 'null' : mergedConfig.altitude},
    altitudeAccuracy: ${mergedConfig.altitudeAccuracy === null ? 'null' : mergedConfig.altitudeAccuracy},
    heading: ${mergedConfig.heading === null ? 'null' : mergedConfig.heading},
    speed: ${mergedConfig.speed === null ? 'null' : mergedConfig.speed}
  };
  
  // Skip if mode is 'real' or geolocation not available
  if (config.mode === 'real' || typeof navigator === 'undefined' || !navigator.geolocation) {
    return;
  }
  
  // Watch tracking
  let watchIdCounter = 1;
  const watchCallbacks = new Map();
  const watchIntervals = new Map();
  
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
  
  // Create position object
  function createPosition() {
    const coords = Object.freeze({
      latitude: config.latitude,
      longitude: config.longitude,
      accuracy: config.accuracy,
      altitude: config.altitude,
      altitudeAccuracy: config.altitudeAccuracy,
      heading: config.heading,
      speed: config.speed
    });
    
    return Object.freeze({
      coords: coords,
      timestamp: Date.now()
    });
  }
  
  // Create error object
  function createError(code, message) {
    return Object.freeze({
      code: code,
      message: message,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    });
  }
  
  const geolocation = navigator.geolocation;
  const originalGetCurrentPosition = geolocation.getCurrentPosition;
  const originalWatchPosition = geolocation.watchPosition;
  const originalClearWatch = geolocation.clearWatch;
  
  // Spoof getCurrentPosition (Req 12.4)
  geolocation.getCurrentPosition = createNativeFunction('getCurrentPosition', 1, 
    function(successCallback, errorCallback, options) {
      if (config.mode === 'deny') {
        if (typeof errorCallback === 'function') {
          setTimeout(function() {
            errorCallback(createError(1, 'User denied Geolocation'));
          }, 0);
        }
        return;
      }
      
      if (typeof successCallback === 'function') {
        setTimeout(function() {
          successCallback(createPosition());
        }, 0);
      }
    }
  );
  
  // Spoof watchPosition (Req 12.5)
  geolocation.watchPosition = createNativeFunction('watchPosition', 1,
    function(successCallback, errorCallback, options) {
      const watchId = watchIdCounter++;
      
      if (config.mode === 'deny') {
        if (typeof errorCallback === 'function') {
          setTimeout(function() {
            errorCallback(createError(1, 'User denied Geolocation'));
          }, 0);
        }
        return watchId;
      }
      
      watchCallbacks.set(watchId, { success: successCallback, error: errorCallback });
      
      if (typeof successCallback === 'function') {
        setTimeout(function() {
          successCallback(createPosition());
        }, 0);
        
        const updateInterval = (options && options.maximumAge) || 5000;
        const intervalId = setInterval(function() {
          if (!watchCallbacks.has(watchId)) {
            clearInterval(intervalId);
            return;
          }
          successCallback(createPosition());
        }, updateInterval);
        
        watchIntervals.set(watchId, intervalId);
      }
      
      return watchId;
    }
  );
  
  // Spoof clearWatch
  geolocation.clearWatch = createNativeFunction('clearWatch', 1,
    function(watchId) {
      watchCallbacks.delete(watchId);
      const intervalId = watchIntervals.get(watchId);
      if (intervalId) {
        clearInterval(intervalId);
        watchIntervals.delete(watchId);
      }
    }
  );
})();
`;
  }


  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Geolocation configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...GeolocationSpoof._defaultConfig };
    }

    const geoConfig = fingerprintConfig.geolocation || {};
    
    return {
      mode: geoConfig.mode || GeolocationSpoof._defaultConfig.mode,
      latitude: geoConfig.latitude !== undefined ? geoConfig.latitude : GeolocationSpoof._defaultConfig.latitude,
      longitude: geoConfig.longitude !== undefined ? geoConfig.longitude : GeolocationSpoof._defaultConfig.longitude,
      accuracy: geoConfig.accuracy !== undefined ? geoConfig.accuracy : GeolocationSpoof._defaultConfig.accuracy,
      altitude: geoConfig.altitude !== undefined ? geoConfig.altitude : GeolocationSpoof._defaultConfig.altitude,
      altitudeAccuracy: geoConfig.altitudeAccuracy !== undefined ? geoConfig.altitudeAccuracy : GeolocationSpoof._defaultConfig.altitudeAccuracy,
      heading: geoConfig.heading !== undefined ? geoConfig.heading : GeolocationSpoof._defaultConfig.heading,
      speed: geoConfig.speed !== undefined ? geoConfig.speed : GeolocationSpoof._defaultConfig.speed
    };
  }

  /**
   * Verify that geolocation spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Promise<Object>} Verification result
   */
  static async verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = GeolocationSpoof.getAppliedConfig();
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

    // Check latitude
    if (expectedConfig.latitude !== undefined) {
      result.checks.latitude = {
        expected: expectedConfig.latitude,
        actual: appliedConfig.latitude,
        pass: appliedConfig.latitude === expectedConfig.latitude
      };
      if (!result.checks.latitude.pass) result.valid = false;
    }

    // Check longitude
    if (expectedConfig.longitude !== undefined) {
      result.checks.longitude = {
        expected: expectedConfig.longitude,
        actual: appliedConfig.longitude,
        pass: appliedConfig.longitude === expectedConfig.longitude
      };
      if (!result.checks.longitude.pass) result.valid = false;
    }

    // Check accuracy
    if (expectedConfig.accuracy !== undefined) {
      result.checks.accuracy = {
        expected: expectedConfig.accuracy,
        actual: appliedConfig.accuracy,
        pass: appliedConfig.accuracy === expectedConfig.accuracy
      };
      if (!result.checks.accuracy.pass) result.valid = false;
    }

    // Verify getCurrentPosition returns expected values (if not in 'real' or 'deny' mode)
    if (appliedConfig.mode === 'custom' || appliedConfig.mode === 'ip-based') {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });

          result.checks.getCurrentPosition = {
            expected: {
              latitude: appliedConfig.latitude,
              longitude: appliedConfig.longitude
            },
            actual: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            },
            pass: position.coords.latitude === appliedConfig.latitude &&
                  position.coords.longitude === appliedConfig.longitude
          };
          if (!result.checks.getCurrentPosition.pass) result.valid = false;
        } catch (e) {
          result.checks.getCurrentPosition = {
            expected: 'Position data',
            actual: null,
            pass: false,
            error: e.message
          };
          result.valid = false;
        }
      }
    }

    // Verify deny mode returns error
    if (appliedConfig.mode === 'deny') {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          // If we get here, it didn't deny
          result.checks.denyMode = {
            expected: 'PERMISSION_DENIED error',
            actual: 'Position returned',
            pass: false
          };
          result.valid = false;
        } catch (e) {
          result.checks.denyMode = {
            expected: 'PERMISSION_DENIED error',
            actual: e.code === 1 ? 'PERMISSION_DENIED error' : `Error code ${e.code}`,
            pass: e.code === 1
          };
          if (!result.checks.denyMode.pass) result.valid = false;
        }
      }
    }

    return result;
  }

  /**
   * Get common location presets
   * @returns {Object} Object with location presets
   */
  static getLocationPresets() {
    return {
      'new-york': {
        name: 'New York, USA',
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 100
      },
      'london': {
        name: 'London, UK',
        latitude: 51.5074,
        longitude: -0.1278,
        accuracy: 100
      },
      'tokyo': {
        name: 'Tokyo, Japan',
        latitude: 35.6762,
        longitude: 139.6503,
        accuracy: 100
      },
      'paris': {
        name: 'Paris, France',
        latitude: 48.8566,
        longitude: 2.3522,
        accuracy: 100
      },
      'sydney': {
        name: 'Sydney, Australia',
        latitude: -33.8688,
        longitude: 151.2093,
        accuracy: 100
      },
      'berlin': {
        name: 'Berlin, Germany',
        latitude: 52.5200,
        longitude: 13.4050,
        accuracy: 100
      },
      'moscow': {
        name: 'Moscow, Russia',
        latitude: 55.7558,
        longitude: 37.6173,
        accuracy: 100
      },
      'beijing': {
        name: 'Beijing, China',
        latitude: 39.9042,
        longitude: 116.4074,
        accuracy: 100
      },
      'dubai': {
        name: 'Dubai, UAE',
        latitude: 25.2048,
        longitude: 55.2708,
        accuracy: 100
      },
      'singapore': {
        name: 'Singapore',
        latitude: 1.3521,
        longitude: 103.8198,
        accuracy: 100
      },
      'sao-paulo': {
        name: 'São Paulo, Brazil',
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 100
      },
      'mumbai': {
        name: 'Mumbai, India',
        latitude: 19.0760,
        longitude: 72.8777,
        accuracy: 100
      }
    };
  }

  /**
   * Get a location preset by name
   * @param {string} presetName - Name of the preset
   * @returns {Object|null} Location preset or null if not found
   */
  static getPreset(presetName) {
    const presets = GeolocationSpoof.getLocationPresets();
    return presets[presetName] || null;
  }
}

module.exports = {
  GeolocationSpoof,
  GeolocationSpoofError
};
