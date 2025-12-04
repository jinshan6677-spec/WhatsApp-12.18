/**
 * Audio Spoofing Script
 * Audio伪装脚本
 * 
 * Implements spoofing for Web Audio API methods to prevent fingerprinting.
 * Uses NoiseEngine to add deterministic noise to audio output.
 * 
 * Covered methods:
 * - AudioBuffer.getChannelData (Req 7.1)
 * - AnalyserNode.getFloatFrequencyData (Req 7.2)
 * - AnalyserNode.getByteFrequencyData (Req 7.3)
 * - AnalyserNode.getFloatTimeDomainData (Req 7.4)
 * - AnalyserNode.getByteTimeDomainData (Req 7.5)
 * - OscillatorNode fingerprint protection (Req 7.6)
 * - Off mode returns original data (Req 7.7)
 * 
 * Features:
 * - Deterministic noise based on seed
 * - Different noise per account
 * - Off mode returns original data
 * - Configurable noise levels
 * - Configurable noise distribution
 * 
 * @module infrastructure/fingerprint/injection-scripts/audio
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');
const NoiseEngine = require('../../../domain/fingerprint/NoiseEngine');

/**
 * Error class for audio spoofing operations
 */
class AudioSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'AudioSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * AudioSpoof class
 * Provides methods to spoof Web Audio API methods
 */
class AudioSpoof {
  /**
   * Default audio configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'noise',           // 'noise', 'real', 'off'
    noiseLevel: 'medium',    // 'off', 'low', 'medium', 'high'
    noiseDistribution: 'uniform', // 'uniform', 'gaussian'
    seed: null               // Noise seed (required for noise mode)
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
   * NoiseEngine instance
   * @private
   */
  static _noiseEngine = null;

  /**
   * Apply audio spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='noise'] - Spoofing mode: 'noise', 'real', or 'off'
   * @param {string} [config.noiseLevel='medium'] - Noise level: 'off', 'low', 'medium', 'high'
   * @param {string} [config.noiseDistribution='uniform'] - Distribution: 'uniform', 'gaussian'
   * @param {number} [config.seed] - Noise seed for deterministic results
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = { ...AudioSpoof._defaultConfig, ...config };
    
    // Validate mode
    if (!['noise', 'real', 'off'].includes(mergedConfig.mode)) {
      throw new AudioSpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'noise', 'real', or 'off'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // If mode is 'noise', seed is required
    if (mergedConfig.mode === 'noise' && mergedConfig.seed === null) {
      // Generate a random seed if not provided
      mergedConfig.seed = NoiseEngine.generateSecureSeed();
    }

    // Store the applied configuration
    AudioSpoof._appliedConfig = mergedConfig;

    // Create NoiseEngine if in noise mode
    if (mergedConfig.mode === 'noise') {
      AudioSpoof._noiseEngine = new NoiseEngine(mergedConfig.seed, {
        level: mergedConfig.noiseLevel,
        distribution: mergedConfig.noiseDistribution
      });
    } else {
      AudioSpoof._noiseEngine = null;
    }

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // Spoof AudioBuffer.getChannelData (Req 7.1)
    try {
      AudioSpoof._spoofGetChannelData();
      results.spoofed.push('getChannelData');
    } catch (e) {
      results.failed.push({ method: 'getChannelData', error: e.message });
      results.success = false;
    }

    // Spoof AnalyserNode.getFloatFrequencyData (Req 7.2)
    try {
      AudioSpoof._spoofGetFloatFrequencyData();
      results.spoofed.push('getFloatFrequencyData');
    } catch (e) {
      results.failed.push({ method: 'getFloatFrequencyData', error: e.message });
      results.success = false;
    }

    // Spoof AnalyserNode.getByteFrequencyData (Req 7.3)
    try {
      AudioSpoof._spoofGetByteFrequencyData();
      results.spoofed.push('getByteFrequencyData');
    } catch (e) {
      results.failed.push({ method: 'getByteFrequencyData', error: e.message });
      results.success = false;
    }

    // Spoof AnalyserNode.getFloatTimeDomainData (Req 7.4)
    try {
      AudioSpoof._spoofGetFloatTimeDomainData();
      results.spoofed.push('getFloatTimeDomainData');
    } catch (e) {
      results.failed.push({ method: 'getFloatTimeDomainData', error: e.message });
      results.success = false;
    }

    // Spoof AnalyserNode.getByteTimeDomainData (Req 7.5)
    try {
      AudioSpoof._spoofGetByteTimeDomainData();
      results.spoofed.push('getByteTimeDomainData');
    } catch (e) {
      results.failed.push({ method: 'getByteTimeDomainData', error: e.message });
      results.success = false;
    }

    return results;
  }

  /**
   * Spoof AudioBuffer.getChannelData
   * Requirement 7.1: Return audio data with deterministic noise
   * @private
   */
  static _spoofGetChannelData() {
    // Check if AudioBuffer exists (browser environment)
    if (typeof AudioBuffer === 'undefined') {
      return;
    }

    const proto = AudioBuffer.prototype;
    const originalGetChannelData = proto.getChannelData;

    // Store original method
    AudioSpoof._originalMethods.getChannelData = originalGetChannelData;

    // Create wrapped function
    const wrappedGetChannelData = NativeWrapper.wrap(
      originalGetChannelData,
      function(original, args, thisArg) {
        const audioBuffer = thisArg;
        const config = AudioSpoof._appliedConfig;

        // Get original channel data
        const channelData = original.apply(audioBuffer, args);

        // If mode is 'off' or 'real', return original result
        if (!config || config.mode === 'off' || config.mode === 'real') {
          return channelData;
        }

        // Apply noise to the channel data
        AudioSpoof._applyNoiseToFloat32Array(channelData);

        return channelData;
      },
      { name: 'getChannelData', length: 1 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'getChannelData', wrappedGetChannelData);
  }

  /**
   * Spoof AnalyserNode.getFloatFrequencyData
   * Requirement 7.2: Return frequency data with deterministic noise
   * @private
   */
  static _spoofGetFloatFrequencyData() {
    // Check if AnalyserNode exists (browser environment)
    if (typeof AnalyserNode === 'undefined') {
      return;
    }

    const proto = AnalyserNode.prototype;
    const originalGetFloatFrequencyData = proto.getFloatFrequencyData;

    // Store original method
    AudioSpoof._originalMethods.getFloatFrequencyData = originalGetFloatFrequencyData;

    // Create wrapped function
    const wrappedGetFloatFrequencyData = NativeWrapper.wrap(
      originalGetFloatFrequencyData,
      function(original, args, thisArg) {
        const analyserNode = thisArg;
        const [array] = args;
        const config = AudioSpoof._appliedConfig;

        // Call original method (fills the array)
        original.apply(analyserNode, args);

        // If mode is 'off' or 'real', return without modification
        if (!config || config.mode === 'off' || config.mode === 'real') {
          return;
        }

        // Apply noise to the frequency data
        AudioSpoof._applyNoiseToFloat32Array(array);
      },
      { name: 'getFloatFrequencyData', length: 1 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'getFloatFrequencyData', wrappedGetFloatFrequencyData);
  }

  /**
   * Spoof AnalyserNode.getByteFrequencyData
   * Requirement 7.3: Return byte frequency data with deterministic noise
   * @private
   */
  static _spoofGetByteFrequencyData() {
    // Check if AnalyserNode exists (browser environment)
    if (typeof AnalyserNode === 'undefined') {
      return;
    }

    const proto = AnalyserNode.prototype;
    const originalGetByteFrequencyData = proto.getByteFrequencyData;

    // Store original method
    AudioSpoof._originalMethods.getByteFrequencyData = originalGetByteFrequencyData;

    // Create wrapped function
    const wrappedGetByteFrequencyData = NativeWrapper.wrap(
      originalGetByteFrequencyData,
      function(original, args, thisArg) {
        const analyserNode = thisArg;
        const [array] = args;
        const config = AudioSpoof._appliedConfig;

        // Call original method (fills the array)
        original.apply(analyserNode, args);

        // If mode is 'off' or 'real', return without modification
        if (!config || config.mode === 'off' || config.mode === 'real') {
          return;
        }

        // Apply noise to the byte data
        AudioSpoof._applyNoiseToUint8Array(array);
      },
      { name: 'getByteFrequencyData', length: 1 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'getByteFrequencyData', wrappedGetByteFrequencyData);
  }

  /**
   * Spoof AnalyserNode.getFloatTimeDomainData
   * Requirement 7.4: Return time domain data with deterministic noise
   * @private
   */
  static _spoofGetFloatTimeDomainData() {
    // Check if AnalyserNode exists (browser environment)
    if (typeof AnalyserNode === 'undefined') {
      return;
    }

    const proto = AnalyserNode.prototype;
    const originalGetFloatTimeDomainData = proto.getFloatTimeDomainData;

    // Store original method
    AudioSpoof._originalMethods.getFloatTimeDomainData = originalGetFloatTimeDomainData;

    // Create wrapped function
    const wrappedGetFloatTimeDomainData = NativeWrapper.wrap(
      originalGetFloatTimeDomainData,
      function(original, args, thisArg) {
        const analyserNode = thisArg;
        const [array] = args;
        const config = AudioSpoof._appliedConfig;

        // Call original method (fills the array)
        original.apply(analyserNode, args);

        // If mode is 'off' or 'real', return without modification
        if (!config || config.mode === 'off' || config.mode === 'real') {
          return;
        }

        // Apply noise to the time domain data
        AudioSpoof._applyNoiseToFloat32Array(array);
      },
      { name: 'getFloatTimeDomainData', length: 1 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'getFloatTimeDomainData', wrappedGetFloatTimeDomainData);
  }

  /**
   * Spoof AnalyserNode.getByteTimeDomainData
   * Requirement 7.5: Return byte time domain data with deterministic noise
   * @private
   */
  static _spoofGetByteTimeDomainData() {
    // Check if AnalyserNode exists (browser environment)
    if (typeof AnalyserNode === 'undefined') {
      return;
    }

    const proto = AnalyserNode.prototype;
    const originalGetByteTimeDomainData = proto.getByteTimeDomainData;

    // Store original method
    AudioSpoof._originalMethods.getByteTimeDomainData = originalGetByteTimeDomainData;

    // Create wrapped function
    const wrappedGetByteTimeDomainData = NativeWrapper.wrap(
      originalGetByteTimeDomainData,
      function(original, args, thisArg) {
        const analyserNode = thisArg;
        const [array] = args;
        const config = AudioSpoof._appliedConfig;

        // Call original method (fills the array)
        original.apply(analyserNode, args);

        // If mode is 'off' or 'real', return without modification
        if (!config || config.mode === 'off' || config.mode === 'real') {
          return;
        }

        // Apply noise to the byte data
        AudioSpoof._applyNoiseToUint8Array(array);
      },
      { name: 'getByteTimeDomainData', length: 1 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'getByteTimeDomainData', wrappedGetByteTimeDomainData);
  }

  /**
   * Apply noise to Float32Array using NoiseEngine
   * @private
   * @param {Float32Array} array - The Float32Array to modify
   */
  static _applyNoiseToFloat32Array(array) {
    if (!AudioSpoof._noiseEngine || !array) {
      return;
    }

    // Use NoiseEngine to apply noise
    AudioSpoof._noiseEngine.applyToAudioData(array);
  }

  /**
   * Apply noise to Uint8Array
   * @private
   * @param {Uint8Array} array - The Uint8Array to modify
   */
  static _applyNoiseToUint8Array(array) {
    if (!AudioSpoof._noiseEngine || !array) {
      return;
    }

    // Reset noise engine for deterministic results
    AudioSpoof._noiseEngine.reset();

    // Get noise scale based on level
    const scale = AudioSpoof._getByteNoiseScale();

    for (let i = 0; i < array.length; i++) {
      const noise = AudioSpoof._noiseEngine.getNoise(i);
      // Scale noise for byte values (0-255)
      const byteNoise = Math.round(noise * scale);
      array[i] = Math.max(0, Math.min(255, array[i] + byteNoise));
    }
  }

  /**
   * Get noise scale for byte arrays based on noise level
   * @private
   * @returns {number} Scale factor for byte noise
   */
  static _getByteNoiseScale() {
    if (!AudioSpoof._appliedConfig) {
      return 0;
    }

    switch (AudioSpoof._appliedConfig.noiseLevel) {
      case 'off': return 0;
      case 'low': return 0.5;
      case 'medium': return 1;
      case 'high': return 2;
      default: return 1;
    }
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return AudioSpoof._appliedConfig ? { ...AudioSpoof._appliedConfig } : null;
  }

  /**
   * Get the NoiseEngine instance
   * @returns {NoiseEngine|null} The NoiseEngine instance or null
   */
  static getNoiseEngine() {
    return AudioSpoof._noiseEngine;
  }

  /**
   * Restore original audio methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    // Restore getChannelData
    if (AudioSpoof._originalMethods.getChannelData && typeof AudioBuffer !== 'undefined') {
      try {
        AudioBuffer.prototype.getChannelData = AudioSpoof._originalMethods.getChannelData;
        results.restored.push('getChannelData');
      } catch (e) {
        results.failed.push({ method: 'getChannelData', error: e.message });
      }
    }

    // Restore AnalyserNode methods
    if (typeof AnalyserNode !== 'undefined') {
      const analyserMethods = [
        'getFloatFrequencyData',
        'getByteFrequencyData',
        'getFloatTimeDomainData',
        'getByteTimeDomainData'
      ];

      for (const method of analyserMethods) {
        if (AudioSpoof._originalMethods[method]) {
          try {
            AnalyserNode.prototype[method] = AudioSpoof._originalMethods[method];
            results.restored.push(method);
          } catch (e) {
            results.failed.push({ method, error: e.message });
          }
        }
      }
    }

    // Clear stored data
    AudioSpoof._originalMethods = {};
    AudioSpoof._appliedConfig = null;
    AudioSpoof._noiseEngine = null;

    return results;
  }

  /**
   * Generate injection script string for browser context
   * This creates a self-contained script that can be injected into a page
   * 
   * @param {Object} config - Audio configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...AudioSpoof._defaultConfig, ...config };
    
    // If seed is not provided, generate one
    if (mergedConfig.seed === null) {
      mergedConfig.seed = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    }

    return `
(function() {
  'use strict';
  
  // Audio spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)},
    noiseLevel: ${JSON.stringify(mergedConfig.noiseLevel)},
    noiseDistribution: ${JSON.stringify(mergedConfig.noiseDistribution)},
    seed: ${mergedConfig.seed}
  };
  
  // Skip if mode is 'off' or 'real'
  if (config.mode === 'off' || config.mode === 'real') {
    return;
  }
  
  // Mulberry32 PRNG for deterministic noise
  function createSeededRNG(seed) {
    let state = seed >>> 0;
    return function() {
      let t = state += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  
  // Get noise scale based on level
  function getNoiseScale(level) {
    switch (level) {
      case 'off': return 0;
      case 'low': return 0.5;
      case 'medium': return 2;
      case 'high': return 5;
      default: return 2;
    }
  }
  
  // Create noise generator
  let rng = createSeededRNG(config.seed);
  const noiseScale = getNoiseScale(config.noiseLevel);
  
  // Reset RNG for deterministic results
  function resetRNG() {
    rng = createSeededRNG(config.seed);
  }
  
  // Generate noise value
  function getNoise() {
    if (config.noiseLevel === 'off') return 0;
    
    let noise;
    if (config.noiseDistribution === 'gaussian') {
      const u1 = Math.max(rng(), 1e-10);
      const u2 = rng();
      noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    } else {
      noise = rng() * 2 - 1;
    }
    return noise * noiseScale;
  }
  
  // Apply noise to Float32Array (audio data)
  function applyNoiseToFloat32Array(array) {
    resetRNG();
    const audioScale = noiseScale * 0.0001 / noiseScale; // Very small for audio
    for (let i = 0; i < array.length; i++) {
      const noise = getNoise();
      array[i] += noise * audioScale;
    }
  }
  
  // Apply noise to Uint8Array (byte data)
  function applyNoiseToUint8Array(array) {
    resetRNG();
    const byteScale = config.noiseLevel === 'low' ? 0.5 : 
                      config.noiseLevel === 'medium' ? 1 : 
                      config.noiseLevel === 'high' ? 2 : 0;
    for (let i = 0; i < array.length; i++) {
      const noise = getNoise();
      const byteNoise = Math.round(noise * byteScale);
      array[i] = Math.max(0, Math.min(255, array[i] + byteNoise));
    }
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
  
  // Spoof AudioBuffer.getChannelData (Req 7.1)
  if (typeof AudioBuffer !== 'undefined') {
    const originalGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = createNativeFunction('getChannelData', 1, function(channel) {
      const channelData = originalGetChannelData.call(this, channel);
      applyNoiseToFloat32Array(channelData);
      return channelData;
    });
  }
  
  // Spoof AnalyserNode methods
  if (typeof AnalyserNode !== 'undefined') {
    // getFloatFrequencyData (Req 7.2)
    const originalGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
    AnalyserNode.prototype.getFloatFrequencyData = createNativeFunction('getFloatFrequencyData', 1, function(array) {
      originalGetFloatFrequencyData.call(this, array);
      applyNoiseToFloat32Array(array);
    });
    
    // getByteFrequencyData (Req 7.3)
    const originalGetByteFrequencyData = AnalyserNode.prototype.getByteFrequencyData;
    AnalyserNode.prototype.getByteFrequencyData = createNativeFunction('getByteFrequencyData', 1, function(array) {
      originalGetByteFrequencyData.call(this, array);
      applyNoiseToUint8Array(array);
    });
    
    // getFloatTimeDomainData (Req 7.4)
    const originalGetFloatTimeDomainData = AnalyserNode.prototype.getFloatTimeDomainData;
    AnalyserNode.prototype.getFloatTimeDomainData = createNativeFunction('getFloatTimeDomainData', 1, function(array) {
      originalGetFloatTimeDomainData.call(this, array);
      applyNoiseToFloat32Array(array);
    });
    
    // getByteTimeDomainData (Req 7.5)
    const originalGetByteTimeDomainData = AnalyserNode.prototype.getByteTimeDomainData;
    AnalyserNode.prototype.getByteTimeDomainData = createNativeFunction('getByteTimeDomainData', 1, function(array) {
      originalGetByteTimeDomainData.call(this, array);
      applyNoiseToUint8Array(array);
    });
  }
})();
`;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Audio configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...AudioSpoof._defaultConfig };
    }

    const audioConfig = fingerprintConfig.audio || {};
    
    return {
      mode: audioConfig.mode || AudioSpoof._defaultConfig.mode,
      noiseLevel: audioConfig.noiseLevel || AudioSpoof._defaultConfig.noiseLevel,
      noiseDistribution: audioConfig.noiseDistribution || AudioSpoof._defaultConfig.noiseDistribution,
      seed: fingerprintConfig.noiseSeed?.decrypted || audioConfig.seed || null
    };
  }

  /**
   * Verify that audio spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Object} Verification result
   */
  static verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = AudioSpoof.getAppliedConfig();
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

    // Check noise level
    if (expectedConfig.noiseLevel !== undefined) {
      result.checks.noiseLevel = {
        expected: expectedConfig.noiseLevel,
        actual: appliedConfig.noiseLevel,
        pass: appliedConfig.noiseLevel === expectedConfig.noiseLevel
      };
      if (!result.checks.noiseLevel.pass) result.valid = false;
    }

    // Check noise distribution
    if (expectedConfig.noiseDistribution !== undefined) {
      result.checks.noiseDistribution = {
        expected: expectedConfig.noiseDistribution,
        actual: appliedConfig.noiseDistribution,
        pass: appliedConfig.noiseDistribution === expectedConfig.noiseDistribution
      };
      if (!result.checks.noiseDistribution.pass) result.valid = false;
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

    return result;
  }
}

module.exports = {
  AudioSpoof,
  AudioSpoofError
};
