/**
 * Media Devices Protection Script
 * 媒体设备保护脚本
 * 
 * Implements protection for MediaDevices API to prevent fingerprinting.
 * Controls device enumeration and generates deterministic fake device IDs.
 * 
 * Covered methods:
 * - navigator.mediaDevices.enumerateDevices (Req 15.1)
 * - Hide mode returns empty device list (Req 15.2)
 * - Fake mode returns fake device IDs and labels (Req 15.3)
 * - Deterministic device ID generation (Req 15.4)
 * - Generic device labels (Req 15.5)
 * 
 * Features:
 * - Three modes: 'hide', 'fake', 'real'
 * - Deterministic device ID generation based on seed
 * - Configurable device list
 * - Generic device labels for privacy
 * - Native function characteristics preserved
 * 
 * @module infrastructure/fingerprint/injection-scripts/media-devices
 * 
 * **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');

/**
 * Error class for media devices spoofing operations
 */
class MediaDevicesSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'MediaDevicesSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * MediaDevicesSpoof class
 * Provides methods to spoof MediaDevices API
 */
class MediaDevicesSpoof {
  /**
   * Default media devices configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'fake',           // 'hide', 'fake', 'real'
    seed: null,             // Seed for deterministic device ID generation
    devices: [
      { kind: 'audioinput', label: 'Default Audio Device' },
      { kind: 'audiooutput', label: 'Default Audio Output' },
      { kind: 'videoinput', label: 'Default Camera' }
    ]
  };

  /**
   * Generic device labels by kind
   * @private
   */
  static _genericLabels = {
    audioinput: [
      'Default Audio Device',
      'Microphone',
      'Internal Microphone',
      'Built-in Microphone'
    ],
    audiooutput: [
      'Default Audio Output',
      'Speakers',
      'Internal Speakers',
      'Built-in Speakers'
    ],
    videoinput: [
      'Default Camera',
      'Webcam',
      'Integrated Camera',
      'Built-in Camera'
    ]
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
   * Seeded random number generator state
   * @private
   */
  static _rngState = null;

  /**
   * Apply media devices spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='fake'] - Spoofing mode: 'hide', 'fake', or 'real'
   * @param {number} [config.seed] - Seed for deterministic device ID generation
   * @param {Array} [config.devices] - Custom device list for fake mode
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = { ...MediaDevicesSpoof._defaultConfig, ...config };
    
    // Validate mode
    if (!['hide', 'fake', 'real'].includes(mergedConfig.mode)) {
      throw new MediaDevicesSpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'hide', 'fake', or 'real'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // If mode is 'fake' and seed is not provided, generate one
    if (mergedConfig.mode === 'fake' && mergedConfig.seed === null) {
      mergedConfig.seed = MediaDevicesSpoof._generateSecureSeed();
    }

    // Store the applied configuration
    MediaDevicesSpoof._appliedConfig = mergedConfig;

    // Initialize RNG state if in fake mode
    if (mergedConfig.mode === 'fake') {
      MediaDevicesSpoof._rngState = mergedConfig.seed >>> 0;
    }

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // If mode is 'real', don't spoof anything
    if (mergedConfig.mode === 'real') {
      return results;
    }

    // Spoof navigator.mediaDevices.enumerateDevices (Req 15.1)
    try {
      MediaDevicesSpoof._spoofEnumerateDevices();
      results.spoofed.push('enumerateDevices');
    } catch (e) {
      results.failed.push({ method: 'enumerateDevices', error: e.message });
      results.success = false;
    }

    return results;
  }

  /**
   * Generate a secure random seed
   * @private
   * @returns {number} A random 32-bit unsigned integer
   */
  static _generateSecureSeed() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return array[0];
    }
    // Fallback for non-browser environments
    return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
  }

  /**
   * Mulberry32 PRNG - deterministic random number generator
   * @private
   * @returns {number} A random number between 0 and 1
   */
  static _seededRandom() {
    let t = MediaDevicesSpoof._rngState += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  /**
   * Reset RNG to initial state for deterministic results
   * @private
   */
  static _resetRNG() {
    if (MediaDevicesSpoof._appliedConfig) {
      MediaDevicesSpoof._rngState = MediaDevicesSpoof._appliedConfig.seed >>> 0;
    }
  }

  /**
   * Generate a deterministic device ID based on seed and index
   * Requirement 15.4: Deterministic device ID generation
   * @private
   * @param {number} index - Device index
   * @param {string} kind - Device kind
   * @returns {string} A deterministic device ID
   */
  static _generateDeviceId(index, kind) {
    // Reset RNG for deterministic results
    MediaDevicesSpoof._resetRNG();
    
    // Advance RNG based on index to get unique IDs
    for (let i = 0; i <= index; i++) {
      MediaDevicesSpoof._seededRandom();
    }
    
    // Generate a UUID-like device ID
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const part = Math.floor(MediaDevicesSpoof._seededRandom() * 0xFFFFFFFF)
        .toString(16)
        .padStart(8, '0');
      parts.push(part);
    }
    
    // Format as device ID (similar to real device IDs)
    return parts.join('');
  }

  /**
   * Generate a deterministic group ID based on seed and kind
   * @private
   * @param {string} kind - Device kind
   * @returns {string} A deterministic group ID
   */
  static _generateGroupId(kind) {
    // Reset RNG
    MediaDevicesSpoof._resetRNG();
    
    // Use kind to offset the RNG
    const kindOffset = kind === 'audioinput' ? 100 : 
                       kind === 'audiooutput' ? 200 : 300;
    
    for (let i = 0; i < kindOffset; i++) {
      MediaDevicesSpoof._seededRandom();
    }
    
    // Generate group ID
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const part = Math.floor(MediaDevicesSpoof._seededRandom() * 0xFFFFFFFF)
        .toString(16)
        .padStart(8, '0');
      parts.push(part);
    }
    
    return parts.join('');
  }

  /**
   * Get a generic label for a device kind
   * Requirement 15.5: Generic device labels
   * @private
   * @param {string} kind - Device kind
   * @param {number} index - Device index within kind
   * @returns {string} A generic device label
   */
  static _getGenericLabel(kind, index) {
    const labels = MediaDevicesSpoof._genericLabels[kind] || ['Unknown Device'];
    return labels[index % labels.length];
  }

  /**
   * Create a fake MediaDeviceInfo object
   * @private
   * @param {Object} deviceConfig - Device configuration
   * @param {number} index - Device index
   * @returns {Object} A fake MediaDeviceInfo-like object
   */
  static _createFakeDevice(deviceConfig, index) {
    const kind = deviceConfig.kind || 'audioinput';
    const label = deviceConfig.label || MediaDevicesSpoof._getGenericLabel(kind, index);
    const deviceId = deviceConfig.deviceId || MediaDevicesSpoof._generateDeviceId(index, kind);
    const groupId = deviceConfig.groupId || MediaDevicesSpoof._generateGroupId(kind);

    // Create an object that mimics MediaDeviceInfo
    const device = {
      deviceId,
      kind,
      label,
      groupId,
      toJSON() {
        return {
          deviceId: this.deviceId,
          kind: this.kind,
          label: this.label,
          groupId: this.groupId
        };
      }
    };

    // Make toJSON appear native
    Object.defineProperty(device.toJSON, 'name', {
      value: 'toJSON',
      writable: false,
      enumerable: false,
      configurable: true
    });

    const nativeToString = 'function toJSON() { [native code] }';
    device.toJSON.toString = function() { return nativeToString; };

    return device;
  }

  /**
   * Spoof navigator.mediaDevices.enumerateDevices
   * Requirement 15.1: Return configured device list
   * Requirement 15.2: Hide mode returns empty list
   * Requirement 15.3: Fake mode returns fake device IDs and labels
   * @private
   */
  static _spoofEnumerateDevices() {
    // Check if mediaDevices exists (browser environment)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return;
    }

    const mediaDevices = navigator.mediaDevices;
    const originalEnumerateDevices = mediaDevices.enumerateDevices;

    // Store original method
    MediaDevicesSpoof._originalMethods.enumerateDevices = originalEnumerateDevices;

    // Create wrapped function
    const wrappedEnumerateDevices = NativeWrapper.wrap(
      originalEnumerateDevices,
      function(original, args, thisArg) {
        const config = MediaDevicesSpoof._appliedConfig;

        // If mode is 'real', return original result
        if (!config || config.mode === 'real') {
          return original.apply(thisArg, args);
        }

        // If mode is 'hide', return empty array (Req 15.2)
        if (config.mode === 'hide') {
          return Promise.resolve([]);
        }

        // Mode is 'fake' - return fake devices (Req 15.3)
        const fakeDevices = config.devices.map((deviceConfig, index) => 
          MediaDevicesSpoof._createFakeDevice(deviceConfig, index)
        );

        return Promise.resolve(fakeDevices);
      },
      { name: 'enumerateDevices', length: 0 }
    );

    // Replace the method on mediaDevices
    try {
      Object.defineProperty(mediaDevices, 'enumerateDevices', {
        value: wrappedEnumerateDevices,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      // If defineProperty fails, try direct assignment
      mediaDevices.enumerateDevices = wrappedEnumerateDevices;
    }
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return MediaDevicesSpoof._appliedConfig ? { ...MediaDevicesSpoof._appliedConfig } : null;
  }

  /**
   * Restore original media devices methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    // Restore enumerateDevices
    if (MediaDevicesSpoof._originalMethods.enumerateDevices && 
        typeof navigator !== 'undefined' && navigator.mediaDevices) {
      try {
        navigator.mediaDevices.enumerateDevices = MediaDevicesSpoof._originalMethods.enumerateDevices;
        results.restored.push('enumerateDevices');
      } catch (e) {
        results.failed.push({ method: 'enumerateDevices', error: e.message });
      }
    }

    // Clear stored data
    MediaDevicesSpoof._originalMethods = {};
    MediaDevicesSpoof._appliedConfig = null;
    MediaDevicesSpoof._rngState = null;

    return results;
  }

  /**
   * Generate injection script string for browser context
   * This creates a self-contained script that can be injected into a page
   * 
   * @param {Object} config - Media devices configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...MediaDevicesSpoof._defaultConfig, ...config };
    
    // If seed is not provided, generate one
    if (mergedConfig.seed === null) {
      mergedConfig.seed = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    }

    return `
(function() {
  'use strict';
  
  // Media devices spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)},
    seed: ${mergedConfig.seed},
    devices: ${JSON.stringify(mergedConfig.devices)}
  };
  
  // Skip if mode is 'real'
  if (config.mode === 'real') {
    return;
  }
  
  // Check if mediaDevices exists
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return;
  }
  
  // Mulberry32 PRNG for deterministic device IDs
  let rngState = config.seed >>> 0;
  
  function seededRandom() {
    let t = rngState += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  
  function resetRNG() {
    rngState = config.seed >>> 0;
  }
  
  // Generate deterministic device ID (Req 15.4)
  function generateDeviceId(index, kind) {
    resetRNG();
    for (let i = 0; i <= index; i++) {
      seededRandom();
    }
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const part = Math.floor(seededRandom() * 0xFFFFFFFF)
        .toString(16)
        .padStart(8, '0');
      parts.push(part);
    }
    return parts.join('');
  }
  
  // Generate deterministic group ID
  function generateGroupId(kind) {
    resetRNG();
    const kindOffset = kind === 'audioinput' ? 100 : 
                       kind === 'audiooutput' ? 200 : 300;
    for (let i = 0; i < kindOffset; i++) {
      seededRandom();
    }
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const part = Math.floor(seededRandom() * 0xFFFFFFFF)
        .toString(16)
        .padStart(8, '0');
      parts.push(part);
    }
    return parts.join('');
  }
  
  // Generic device labels (Req 15.5)
  const genericLabels = {
    audioinput: ['Default Audio Device', 'Microphone', 'Internal Microphone', 'Built-in Microphone'],
    audiooutput: ['Default Audio Output', 'Speakers', 'Internal Speakers', 'Built-in Speakers'],
    videoinput: ['Default Camera', 'Webcam', 'Integrated Camera', 'Built-in Camera']
  };
  
  function getGenericLabel(kind, index) {
    const labels = genericLabels[kind] || ['Unknown Device'];
    return labels[index % labels.length];
  }
  
  // Create fake MediaDeviceInfo object (Req 15.3)
  function createFakeDevice(deviceConfig, index) {
    const kind = deviceConfig.kind || 'audioinput';
    const label = deviceConfig.label || getGenericLabel(kind, index);
    const deviceId = deviceConfig.deviceId || generateDeviceId(index, kind);
    const groupId = deviceConfig.groupId || generateGroupId(kind);
    
    const device = {
      deviceId: deviceId,
      kind: kind,
      label: label,
      groupId: groupId,
      toJSON: function() {
        return {
          deviceId: this.deviceId,
          kind: this.kind,
          label: this.label,
          groupId: this.groupId
        };
      }
    };
    
    // Make toJSON appear native
    Object.defineProperty(device.toJSON, 'name', {
      value: 'toJSON',
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeStr = 'function toJSON() { [native code] }';
    device.toJSON.toString = function() { return nativeStr; };
    
    return device;
  }
  
  // Store original method
  const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
  
  // Create spoofed enumerateDevices (Req 15.1)
  function spoofedEnumerateDevices() {
    // If mode is 'hide', return empty array (Req 15.2)
    if (config.mode === 'hide') {
      return Promise.resolve([]);
    }
    
    // Mode is 'fake' - return fake devices
    const fakeDevices = config.devices.map(function(deviceConfig, index) {
      return createFakeDevice(deviceConfig, index);
    });
    
    return Promise.resolve(fakeDevices);
  }
  
  // Make the function appear native
  Object.defineProperty(spoofedEnumerateDevices, 'name', {
    value: 'enumerateDevices',
    writable: false,
    enumerable: false,
    configurable: true
  });
  Object.defineProperty(spoofedEnumerateDevices, 'length', {
    value: 0,
    writable: false,
    enumerable: false,
    configurable: true
  });
  const nativeEnumerateStr = 'function enumerateDevices() { [native code] }';
  spoofedEnumerateDevices.toString = function() { return nativeEnumerateStr; };
  
  // Replace the method
  try {
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
      value: spoofedEnumerateDevices,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } catch (e) {
    navigator.mediaDevices.enumerateDevices = spoofedEnumerateDevices;
  }
})();
`;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Media devices configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...MediaDevicesSpoof._defaultConfig };
    }

    const mediaDevicesConfig = fingerprintConfig.mediaDevices || {};
    
    return {
      mode: mediaDevicesConfig.mode || MediaDevicesSpoof._defaultConfig.mode,
      seed: fingerprintConfig.noiseSeed?.decrypted || mediaDevicesConfig.seed || null,
      devices: mediaDevicesConfig.devices || MediaDevicesSpoof._defaultConfig.devices
    };
  }

  /**
   * Verify that media devices spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Promise<Object>} Verification result
   */
  static async verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = MediaDevicesSpoof.getAppliedConfig();
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

    // Check seed
    if (expectedConfig.seed !== undefined) {
      result.checks.seed = {
        expected: expectedConfig.seed,
        actual: appliedConfig.seed,
        pass: appliedConfig.seed === expectedConfig.seed
      };
      if (!result.checks.seed.pass) result.valid = false;
    }

    // If in browser environment, verify actual enumeration
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        if (appliedConfig.mode === 'hide') {
          result.checks.hideMode = {
            expected: 0,
            actual: devices.length,
            pass: devices.length === 0
          };
          if (!result.checks.hideMode.pass) result.valid = false;
        } else if (appliedConfig.mode === 'fake') {
          result.checks.fakeMode = {
            expected: appliedConfig.devices.length,
            actual: devices.length,
            pass: devices.length === appliedConfig.devices.length
          };
          if (!result.checks.fakeMode.pass) result.valid = false;
          
          // Verify device IDs are deterministic
          if (devices.length > 0) {
            const firstDeviceId = devices[0].deviceId;
            const expectedDeviceId = MediaDevicesSpoof._generateDeviceId(0, devices[0].kind);
            result.checks.deterministicId = {
              expected: expectedDeviceId,
              actual: firstDeviceId,
              pass: firstDeviceId === expectedDeviceId
            };
            if (!result.checks.deterministicId.pass) result.valid = false;
          }
        }
      } catch (e) {
        result.checks.enumeration = {
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
  MediaDevicesSpoof,
  MediaDevicesSpoofError
};
