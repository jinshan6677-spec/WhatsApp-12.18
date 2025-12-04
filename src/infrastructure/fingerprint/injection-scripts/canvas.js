/**
 * Canvas Spoofing Script
 * Canvas伪装脚本
 * 
 * Implements spoofing for Canvas 2D API methods to prevent fingerprinting.
 * Uses NoiseEngine to add deterministic noise to canvas output.
 * 
 * Covered methods:
 * - HTMLCanvasElement.toDataURL (Req 5.1)
 * - HTMLCanvasElement.toBlob (Req 5.2)
 * - CanvasRenderingContext2D.getImageData (Req 5.3)
 * 
 * Features:
 * - Deterministic noise based on seed (Req 5.4)
 * - Different noise per account (Req 5.5)
 * - Off mode returns original data (Req 5.6)
 * - Configurable noise levels (Req 5.7)
 * - Configurable noise distribution (Req 5.8)
 * 
 * @module infrastructure/fingerprint/injection-scripts/canvas
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.6**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');
const NoiseEngine = require('../../../domain/fingerprint/NoiseEngine');

/**
 * Error class for canvas spoofing operations
 */
class CanvasSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'CanvasSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * CanvasSpoof class
 * Provides methods to spoof Canvas 2D API methods
 */
class CanvasSpoof {
  /**
   * Default canvas configuration
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
   * Apply canvas spoofing with the given configuration
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
    const mergedConfig = { ...CanvasSpoof._defaultConfig, ...config };
    
    // Validate mode
    if (!['noise', 'real', 'off'].includes(mergedConfig.mode)) {
      throw new CanvasSpoofError(
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
    CanvasSpoof._appliedConfig = mergedConfig;

    // Create NoiseEngine if in noise mode
    if (mergedConfig.mode === 'noise') {
      CanvasSpoof._noiseEngine = new NoiseEngine(mergedConfig.seed, {
        level: mergedConfig.noiseLevel,
        distribution: mergedConfig.noiseDistribution
      });
    } else {
      CanvasSpoof._noiseEngine = null;
    }

    try {
      if (typeof HTMLCanvasElement !== 'undefined') {
        const proto = HTMLCanvasElement.prototype;
        const originalGetContext = proto.getContext;
        const wrappedGetContext = NativeWrapper.wrap(
          originalGetContext,
          function(original, args, thisArg) {
            try {
              const type = args[0];
              let options = args[1];
              if (type === '2d') {
                let opts = options && typeof options === 'object' ? options : {};
                if (opts.willReadFrequently !== true) {
                  opts = { ...opts, willReadFrequently: true };
                }
                return original.call(thisArg, type, opts);
              }
            } catch (_) {}
            return original.apply(thisArg, args);
          },
          { name: 'getContext', length: 1 }
        );
        NativeWrapper.protectPrototype(proto, 'getContext', wrappedGetContext);
      }
      if (typeof OffscreenCanvas !== 'undefined') {
        const ocProto = OffscreenCanvas.prototype;
        const ocOriginalGetContext = ocProto.getContext;
        const ocWrappedGetContext = NativeWrapper.wrap(
          ocOriginalGetContext,
          function(original, args, thisArg) {
            try {
              const type = args[0];
              let options = args[1];
              if (type === '2d') {
                let opts = options && typeof options === 'object' ? options : {};
                if (opts.willReadFrequently !== true) {
                  opts = { ...opts, willReadFrequently: true };
                }
                return original.call(thisArg, type, opts);
              }
            } catch (_) {}
            return original.apply(thisArg, args);
          },
          { name: 'getContext', length: 1 }
        );
        NativeWrapper.protectPrototype(ocProto, 'getContext', ocWrappedGetContext);
      }
    } catch (_) {}

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // Spoof toDataURL (Req 5.1)
    try {
      CanvasSpoof._spoofToDataURL();
      results.spoofed.push('toDataURL');
    } catch (e) {
      results.failed.push({ method: 'toDataURL', error: e.message });
      results.success = false;
    }

    // Spoof toBlob (Req 5.2)
    try {
      CanvasSpoof._spoofToBlob();
      results.spoofed.push('toBlob');
    } catch (e) {
      results.failed.push({ method: 'toBlob', error: e.message });
      results.success = false;
    }

    // Spoof getImageData (Req 5.3)
    try {
      CanvasSpoof._spoofGetImageData();
      results.spoofed.push('getImageData');
    } catch (e) {
      results.failed.push({ method: 'getImageData', error: e.message });
      results.success = false;
    }

    return results;
  }

  /**
   * Spoof HTMLCanvasElement.toDataURL
   * Requirement 5.1: Return pixel data with deterministic noise
   * @private
   */
  static _spoofToDataURL() {
    // Check if HTMLCanvasElement exists (browser environment)
    if (typeof HTMLCanvasElement === 'undefined') {
      return;
    }

    const proto = HTMLCanvasElement.prototype;
    const originalToDataURL = proto.toDataURL;

    // Store original method
    CanvasSpoof._originalMethods.toDataURL = originalToDataURL;

    // Create wrapped function
    const wrappedToDataURL = NativeWrapper.wrap(
      originalToDataURL,
      function(original, args, thisArg) {
        const canvas = thisArg;
        const config = CanvasSpoof._appliedConfig;

        // If mode is 'off' or 'real', return original result
        if (!config || config.mode === 'off' || config.mode === 'real') {
          return original.apply(canvas, args);
        }

        // Apply noise to canvas data
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // If no 2D context, return original
          return original.apply(canvas, args);
        }

        // Get image data, apply noise, put it back
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          CanvasSpoof._applyNoiseToImageData(imageData);
          ctx.putImageData(imageData, 0, 0);
        } catch (e) {
          // If we can't modify (e.g., tainted canvas), return original
          return original.apply(canvas, args);
        }

        // Return the modified data URL
        return original.apply(canvas, args);
      },
      { name: 'toDataURL', length: 0 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'toDataURL', wrappedToDataURL);
  }

  /**
   * Spoof HTMLCanvasElement.toBlob
   * Requirement 5.2: Return Blob data with deterministic noise
   * @private
   */
  static _spoofToBlob() {
    // Check if HTMLCanvasElement exists (browser environment)
    if (typeof HTMLCanvasElement === 'undefined') {
      return;
    }

    const proto = HTMLCanvasElement.prototype;
    const originalToBlob = proto.toBlob;

    // Store original method
    CanvasSpoof._originalMethods.toBlob = originalToBlob;

    // Create wrapped function
    const wrappedToBlob = NativeWrapper.wrap(
      originalToBlob,
      function(original, args, thisArg) {
        const canvas = thisArg;
        const [callback, ...restArgs] = args;
        const config = CanvasSpoof._appliedConfig;

        // If mode is 'off' or 'real', call original
        if (!config || config.mode === 'off' || config.mode === 'real') {
          return original.apply(canvas, args);
        }

        // Apply noise to canvas data
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // If no 2D context, call original
          return original.apply(canvas, args);
        }

        // Get image data, apply noise, put it back
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          CanvasSpoof._applyNoiseToImageData(imageData);
          ctx.putImageData(imageData, 0, 0);
        } catch (e) {
          // If we can't modify (e.g., tainted canvas), call original
          return original.apply(canvas, args);
        }

        // Call original with the modified canvas
        return original.apply(canvas, [callback, ...restArgs]);
      },
      { name: 'toBlob', length: 1 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'toBlob', wrappedToBlob);
  }

  /**
   * Spoof CanvasRenderingContext2D.getImageData
   * Requirement 5.3: Return image data with deterministic noise
   * @private
   */
  static _spoofGetImageData() {
    // Check if CanvasRenderingContext2D exists (browser environment)
    if (typeof CanvasRenderingContext2D === 'undefined') {
      return;
    }

    const proto = CanvasRenderingContext2D.prototype;
    const originalGetImageData = proto.getImageData;

    // Store original method
    CanvasSpoof._originalMethods.getImageData = originalGetImageData;

    // Create wrapped function
    const wrappedGetImageData = NativeWrapper.wrap(
      originalGetImageData,
      function(original, args, thisArg) {
        const ctx = thisArg;
        const config = CanvasSpoof._appliedConfig;

        // Get original image data
        const imageData = original.apply(ctx, args);

        // If mode is 'off' or 'real', return original result
        if (!config || config.mode === 'off' || config.mode === 'real') {
          return imageData;
        }

        // Apply noise to the image data
        CanvasSpoof._applyNoiseToImageData(imageData);

        return imageData;
      },
      { name: 'getImageData', length: 4 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'getImageData', wrappedGetImageData);
  }

  /**
   * Apply noise to ImageData using NoiseEngine
   * @private
   * @param {ImageData} imageData - The ImageData object to modify
   */
  static _applyNoiseToImageData(imageData) {
    if (!CanvasSpoof._noiseEngine) {
      return;
    }

    // Use NoiseEngine to apply noise
    CanvasSpoof._noiseEngine.applyToCanvasData(imageData);
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return CanvasSpoof._appliedConfig ? { ...CanvasSpoof._appliedConfig } : null;
  }

  /**
   * Get the NoiseEngine instance
   * @returns {NoiseEngine|null} The NoiseEngine instance or null
   */
  static getNoiseEngine() {
    return CanvasSpoof._noiseEngine;
  }

  /**
   * Restore original canvas methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    // Restore toDataURL
    if (CanvasSpoof._originalMethods.toDataURL && typeof HTMLCanvasElement !== 'undefined') {
      try {
        HTMLCanvasElement.prototype.toDataURL = CanvasSpoof._originalMethods.toDataURL;
        results.restored.push('toDataURL');
      } catch (e) {
        results.failed.push({ method: 'toDataURL', error: e.message });
      }
    }

    // Restore toBlob
    if (CanvasSpoof._originalMethods.toBlob && typeof HTMLCanvasElement !== 'undefined') {
      try {
        HTMLCanvasElement.prototype.toBlob = CanvasSpoof._originalMethods.toBlob;
        results.restored.push('toBlob');
      } catch (e) {
        results.failed.push({ method: 'toBlob', error: e.message });
      }
    }

    // Restore getImageData
    if (CanvasSpoof._originalMethods.getImageData && typeof CanvasRenderingContext2D !== 'undefined') {
      try {
        CanvasRenderingContext2D.prototype.getImageData = CanvasSpoof._originalMethods.getImageData;
        results.restored.push('getImageData');
      } catch (e) {
        results.failed.push({ method: 'getImageData', error: e.message });
      }
    }

    // Clear stored data
    CanvasSpoof._originalMethods = {};
    CanvasSpoof._appliedConfig = null;
    CanvasSpoof._noiseEngine = null;

    return results;
  }

  /**
   * Generate injection script string for browser context
   * This creates a self-contained script that can be injected into a page
   * 
   * @param {Object} config - Canvas configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...CanvasSpoof._defaultConfig, ...config };
    
    // If seed is not provided, generate one
    if (mergedConfig.seed === null) {
      mergedConfig.seed = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    }

    return `
(function() {
  'use strict';
  
  // Canvas spoofing configuration
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
  const rng = createSeededRNG(config.seed);
  const noiseScale = getNoiseScale(config.noiseLevel);
  
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
  
  // Apply noise to ImageData
  function applyNoiseToImageData(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = getNoise();
      data[i] = Math.max(0, Math.min(255, Math.round(data[i] + noise)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1] + noise)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2] + noise)));
    }
    return imageData;
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
  
  // Spoof toDataURL
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = createNativeFunction('toDataURL', 0, function() {
    const canvas = this;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyNoiseToImageData(imageData);
        ctx.putImageData(imageData, 0, 0);
      } catch (e) {
        // Tainted canvas, return original
      }
    }
    return originalToDataURL.apply(canvas, arguments);
  });
  
  // Spoof toBlob
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = createNativeFunction('toBlob', 1, function(callback) {
    const canvas = this;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyNoiseToImageData(imageData);
        ctx.putImageData(imageData, 0, 0);
      } catch (e) {
        // Tainted canvas, call original
      }
    }
    return originalToBlob.apply(canvas, arguments);
  });
  
  // Spoof getImageData
  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = createNativeFunction('getImageData', 4, function(sx, sy, sw, sh) {
    const imageData = originalGetImageData.apply(this, arguments);
    applyNoiseToImageData(imageData);
    return imageData;
  });
})();
`;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Canvas configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...CanvasSpoof._defaultConfig };
    }

    const canvasConfig = fingerprintConfig.canvas || {};
    
    return {
      mode: canvasConfig.mode || CanvasSpoof._defaultConfig.mode,
      noiseLevel: canvasConfig.noiseLevel || CanvasSpoof._defaultConfig.noiseLevel,
      noiseDistribution: canvasConfig.noiseDistribution || CanvasSpoof._defaultConfig.noiseDistribution,
      seed: fingerprintConfig.noiseSeed?.decrypted || canvasConfig.seed || null
    };
  }

  /**
   * Verify that canvas spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Object} Verification result
   */
  static verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = CanvasSpoof.getAppliedConfig();
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
  CanvasSpoof,
  CanvasSpoofError
};
