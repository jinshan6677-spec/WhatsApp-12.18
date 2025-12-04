/**
 * WebGL Spoofing Script
 * WebGL伪装脚本
 * 
 * Implements spoofing for WebGL API methods to prevent fingerprinting.
 * Uses NoiseEngine to add deterministic noise to WebGL output.
 * 
 * Covered methods:
 * - WebGLRenderingContext.getParameter (VENDOR/RENDERER) (Req 6.1-6.4)
 * - WebGL2RenderingContext.getParameter (Req 6.5)
 * - getShaderPrecisionFormat (Req 6.6)
 * - getSupportedExtensions (Req 6.7)
 * - readPixels noise (Req 6.8)
 * 
 * @module infrastructure/fingerprint/injection-scripts/webgl
 * 
 * **Validates: Requirements 6.1-6.8**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');
const { PrototypeGuard } = require('./core/prototype-guard');
const NoiseEngine = require('../../../domain/fingerprint/NoiseEngine');

/**
 * WebGL parameter constants
 */
const WebGLConstants = {
  VENDOR: 0x1F00,
  RENDERER: 0x1F01,
  VERSION: 0x1F02,
  SHADING_LANGUAGE_VERSION: 0x8B8C,
  UNMASKED_VENDOR_WEBGL: 0x9245,
  UNMASKED_RENDERER_WEBGL: 0x9246
};

/**
 * Error class for WebGL spoofing operations
 */
class WebGLSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'WebGLSpoofError';
    this.code = code;
    this.details = details;
  }
}


/**
 * WebGLSpoof class
 * Provides methods to spoof WebGL API methods
 */
class WebGLSpoof {
  /**
   * Default WebGL configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'custom',           // 'custom', 'real', 'off'
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
    unmaskedVendor: 'Intel Inc.',
    unmaskedRenderer: 'Intel(R) UHD Graphics',
    extensions: null,         // null means use real extensions
    shaderPrecision: null,    // null means use real precision
    imageNoise: true,         // Apply noise to readPixels
    noiseLevel: 'medium',     // 'off', 'low', 'medium', 'high'
    noiseDistribution: 'uniform', // 'uniform', 'gaussian'
    seed: null                // Noise seed (required for noise mode)
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
   * Apply WebGL spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='custom'] - Spoofing mode: 'custom', 'real', or 'off'
   * @param {string} [config.vendor] - WebGL vendor string (Req 6.1)
   * @param {string} [config.renderer] - WebGL renderer string (Req 6.2)
   * @param {string} [config.unmaskedVendor] - Unmasked vendor string (Req 6.3)
   * @param {string} [config.unmaskedRenderer] - Unmasked renderer string (Req 6.4)
   * @param {string[]} [config.extensions] - Supported extensions list (Req 6.7)
   * @param {Object} [config.shaderPrecision] - Shader precision format (Req 6.6)
   * @param {boolean} [config.imageNoise] - Apply noise to readPixels (Req 6.8)
   * @param {string} [config.noiseLevel] - Noise level for readPixels
   * @param {number} [config.seed] - Noise seed for deterministic results
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = { ...WebGLSpoof._defaultConfig, ...config };
    
    // Validate mode
    if (!['custom', 'real', 'off'].includes(mergedConfig.mode)) {
      throw new WebGLSpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'custom', 'real', or 'off'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // If imageNoise is enabled, seed is required
    if (mergedConfig.imageNoise && mergedConfig.seed === null) {
      // Generate a random seed if not provided
      mergedConfig.seed = NoiseEngine.generateSecureSeed();
    }

    // Store the applied configuration
    WebGLSpoof._appliedConfig = mergedConfig;

    // Create NoiseEngine if image noise is enabled
    if (mergedConfig.imageNoise && mergedConfig.noiseLevel !== 'off') {
      WebGLSpoof._noiseEngine = new NoiseEngine(mergedConfig.seed, {
        level: mergedConfig.noiseLevel,
        distribution: mergedConfig.noiseDistribution
      });
    } else {
      WebGLSpoof._noiseEngine = null;
    }

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // Spoof WebGLRenderingContext.getParameter (Req 6.1-6.4)
    try {
      WebGLSpoof._spoofGetParameter('WebGLRenderingContext');
      results.spoofed.push('WebGLRenderingContext.getParameter');
    } catch (e) {
      results.failed.push({ method: 'WebGLRenderingContext.getParameter', error: e.message });
      results.success = false;
    }

    // Spoof WebGL2RenderingContext.getParameter (Req 6.5)
    try {
      WebGLSpoof._spoofGetParameter('WebGL2RenderingContext');
      results.spoofed.push('WebGL2RenderingContext.getParameter');
    } catch (e) {
      results.failed.push({ method: 'WebGL2RenderingContext.getParameter', error: e.message });
      // WebGL2 may not be available, don't mark as failure
    }

    // Spoof getShaderPrecisionFormat (Req 6.6)
    try {
      WebGLSpoof._spoofGetShaderPrecisionFormat('WebGLRenderingContext');
      results.spoofed.push('WebGLRenderingContext.getShaderPrecisionFormat');
    } catch (e) {
      results.failed.push({ method: 'WebGLRenderingContext.getShaderPrecisionFormat', error: e.message });
      results.success = false;
    }

    try {
      WebGLSpoof._spoofGetShaderPrecisionFormat('WebGL2RenderingContext');
      results.spoofed.push('WebGL2RenderingContext.getShaderPrecisionFormat');
    } catch (e) {
      // WebGL2 may not be available
    }

    // Spoof getSupportedExtensions (Req 6.7)
    try {
      WebGLSpoof._spoofGetSupportedExtensions('WebGLRenderingContext');
      results.spoofed.push('WebGLRenderingContext.getSupportedExtensions');
    } catch (e) {
      results.failed.push({ method: 'WebGLRenderingContext.getSupportedExtensions', error: e.message });
      results.success = false;
    }

    try {
      WebGLSpoof._spoofGetSupportedExtensions('WebGL2RenderingContext');
      results.spoofed.push('WebGL2RenderingContext.getSupportedExtensions');
    } catch (e) {
      // WebGL2 may not be available
    }

    // Spoof readPixels with noise (Req 6.8)
    try {
      WebGLSpoof._spoofReadPixels('WebGLRenderingContext');
      results.spoofed.push('WebGLRenderingContext.readPixels');
    } catch (e) {
      results.failed.push({ method: 'WebGLRenderingContext.readPixels', error: e.message });
      results.success = false;
    }

    try {
      WebGLSpoof._spoofReadPixels('WebGL2RenderingContext');
      results.spoofed.push('WebGL2RenderingContext.readPixels');
    } catch (e) {
      // WebGL2 may not be available
    }

    return results;
  }


  /**
   * Spoof getParameter method
   * Requirements 6.1-6.5: Return configured vendor/renderer strings
   * @private
   * @param {string} contextName - 'WebGLRenderingContext' or 'WebGL2RenderingContext'
   */
  static _spoofGetParameter(contextName) {
    // Check if context exists (browser environment)
    if (typeof globalThis[contextName] === 'undefined') {
      return;
    }

    const proto = globalThis[contextName].prototype;
    const originalGetParameter = proto.getParameter;

    // Store original method
    const key = `${contextName}.getParameter`;
    WebGLSpoof._originalMethods[key] = originalGetParameter;

    // Create wrapped function
    const wrappedGetParameter = NativeWrapper.wrap(
      originalGetParameter,
      function(original, args, thisArg) {
        const gl = thisArg;
        const pname = args[0];
        const config = WebGLSpoof._appliedConfig;

        // If mode is 'off' or 'real', return original result
        if (!config || config.mode === 'off' || config.mode === 'real') {
          return original.apply(gl, args);
        }

        // Handle VENDOR (Req 6.1)
        if (pname === WebGLConstants.VENDOR && config.vendor) {
          return config.vendor;
        }

        // Handle RENDERER (Req 6.2)
        if (pname === WebGLConstants.RENDERER && config.renderer) {
          return config.renderer;
        }

        // Handle UNMASKED_VENDOR_WEBGL (Req 6.3)
        if (pname === WebGLConstants.UNMASKED_VENDOR_WEBGL && config.unmaskedVendor) {
          return config.unmaskedVendor;
        }

        // Handle UNMASKED_RENDERER_WEBGL (Req 6.4)
        if (pname === WebGLConstants.UNMASKED_RENDERER_WEBGL && config.unmaskedRenderer) {
          return config.unmaskedRenderer;
        }

        // Return original for other parameters
        return original.apply(gl, args);
      },
      { name: 'getParameter', length: 1 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'getParameter', wrappedGetParameter);
  }

  /**
   * Spoof getShaderPrecisionFormat method
   * Requirement 6.6: Return configured shader precision format
   * @private
   * @param {string} contextName - 'WebGLRenderingContext' or 'WebGL2RenderingContext'
   */
  static _spoofGetShaderPrecisionFormat(contextName) {
    // Check if context exists (browser environment)
    if (typeof globalThis[contextName] === 'undefined') {
      return;
    }

    const proto = globalThis[contextName].prototype;
    const originalGetShaderPrecisionFormat = proto.getShaderPrecisionFormat;

    // Store original method
    const key = `${contextName}.getShaderPrecisionFormat`;
    WebGLSpoof._originalMethods[key] = originalGetShaderPrecisionFormat;

    // Create wrapped function
    const wrappedGetShaderPrecisionFormat = NativeWrapper.wrap(
      originalGetShaderPrecisionFormat,
      function(original, args, thisArg) {
        const gl = thisArg;
        const config = WebGLSpoof._appliedConfig;

        // If mode is 'off' or 'real', or no custom precision, return original
        if (!config || config.mode === 'off' || config.mode === 'real' || !config.shaderPrecision) {
          return original.apply(gl, args);
        }

        const [shaderType, precisionType] = args;
        
        // Check if we have custom precision for this combination
        const shaderKey = shaderType === 0x8B31 ? 'vertex' : 'fragment'; // VERTEX_SHADER or FRAGMENT_SHADER
        const precisionKey = WebGLSpoof._getPrecisionKey(precisionType);
        
        if (config.shaderPrecision[shaderKey] && config.shaderPrecision[shaderKey][precisionKey]) {
          const customPrecision = config.shaderPrecision[shaderKey][precisionKey];
          // Return a WebGLShaderPrecisionFormat-like object
          return {
            rangeMin: customPrecision.rangeMin,
            rangeMax: customPrecision.rangeMax,
            precision: customPrecision.precision
          };
        }

        return original.apply(gl, args);
      },
      { name: 'getShaderPrecisionFormat', length: 2 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'getShaderPrecisionFormat', wrappedGetShaderPrecisionFormat);
  }

  /**
   * Get precision key from precision type constant
   * @private
   */
  static _getPrecisionKey(precisionType) {
    switch (precisionType) {
      case 0x8DF0: return 'lowFloat';    // LOW_FLOAT
      case 0x8DF1: return 'mediumFloat'; // MEDIUM_FLOAT
      case 0x8DF2: return 'highFloat';   // HIGH_FLOAT
      case 0x8DF3: return 'lowInt';      // LOW_INT
      case 0x8DF4: return 'mediumInt';   // MEDIUM_INT
      case 0x8DF5: return 'highInt';     // HIGH_INT
      default: return 'unknown';
    }
  }


  /**
   * Spoof getSupportedExtensions method
   * Requirement 6.7: Return configured extensions list
   * @private
   * @param {string} contextName - 'WebGLRenderingContext' or 'WebGL2RenderingContext'
   */
  static _spoofGetSupportedExtensions(contextName) {
    // Check if context exists (browser environment)
    if (typeof globalThis[contextName] === 'undefined') {
      return;
    }

    const proto = globalThis[contextName].prototype;
    const originalGetSupportedExtensions = proto.getSupportedExtensions;

    // Store original method
    const key = `${contextName}.getSupportedExtensions`;
    WebGLSpoof._originalMethods[key] = originalGetSupportedExtensions;

    // Create wrapped function
    const wrappedGetSupportedExtensions = NativeWrapper.wrap(
      originalGetSupportedExtensions,
      function(original, args, thisArg) {
        const gl = thisArg;
        const config = WebGLSpoof._appliedConfig;

        // If mode is 'off' or 'real', or no custom extensions, return original
        if (!config || config.mode === 'off' || config.mode === 'real' || !config.extensions) {
          return original.apply(gl, args);
        }

        // Return configured extensions list
        return [...config.extensions];
      },
      { name: 'getSupportedExtensions', length: 0 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'getSupportedExtensions', wrappedGetSupportedExtensions);
  }

  /**
   * Spoof readPixels method with noise
   * Requirement 6.8: Add deterministic noise to readPixels result
   * @private
   * @param {string} contextName - 'WebGLRenderingContext' or 'WebGL2RenderingContext'
   */
  static _spoofReadPixels(contextName) {
    // Check if context exists (browser environment)
    if (typeof globalThis[contextName] === 'undefined') {
      return;
    }

    const proto = globalThis[contextName].prototype;
    const originalReadPixels = proto.readPixels;

    // Store original method
    const key = `${contextName}.readPixels`;
    WebGLSpoof._originalMethods[key] = originalReadPixels;

    // Create wrapped function
    const wrappedReadPixels = NativeWrapper.wrap(
      originalReadPixels,
      function(original, args, thisArg) {
        const gl = thisArg;
        const config = WebGLSpoof._appliedConfig;

        // Call original first
        const result = original.apply(gl, args);

        // If mode is 'off' or 'real', or noise is disabled, return original result
        if (!config || config.mode === 'off' || config.mode === 'real' || 
            !config.imageNoise || !WebGLSpoof._noiseEngine) {
          return result;
        }

        // Get the pixels array from args (it's passed by reference)
        // readPixels signature: readPixels(x, y, width, height, format, type, pixels)
        const pixels = args[6];
        
        if (pixels && (pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray)) {
          // Apply noise to pixel data
          WebGLSpoof._applyNoiseToPixels(pixels);
        }

        return result;
      },
      { name: 'readPixels', length: 7 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'readPixels', wrappedReadPixels);
  }

  /**
   * Apply noise to pixel data using NoiseEngine
   * @private
   * @param {Uint8Array|Uint8ClampedArray} pixels - The pixel data to modify
   */
  static _applyNoiseToPixels(pixels) {
    if (!WebGLSpoof._noiseEngine) {
      return;
    }

    // Reset noise engine for deterministic results
    WebGLSpoof._noiseEngine.reset();

    // Apply noise to RGBA pixels (4 bytes per pixel)
    for (let i = 0; i < pixels.length; i += 4) {
      const noise = WebGLSpoof._noiseEngine.getNoise(i);
      
      // Apply noise to RGB channels, clamp to valid range [0, 255]
      pixels[i] = Math.max(0, Math.min(255, Math.round(pixels[i] + noise)));     // R
      pixels[i + 1] = Math.max(0, Math.min(255, Math.round(pixels[i + 1] + noise))); // G
      pixels[i + 2] = Math.max(0, Math.min(255, Math.round(pixels[i + 2] + noise))); // B
      // Alpha channel (pixels[i + 3]) is not modified
    }
  }


  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return WebGLSpoof._appliedConfig ? { ...WebGLSpoof._appliedConfig } : null;
  }

  /**
   * Get the NoiseEngine instance
   * @returns {NoiseEngine|null} The NoiseEngine instance or null
   */
  static getNoiseEngine() {
    return WebGLSpoof._noiseEngine;
  }

  /**
   * Restore original WebGL methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    for (const [key, originalMethod] of Object.entries(WebGLSpoof._originalMethods)) {
      try {
        const [contextName, methodName] = key.split('.');
        if (typeof globalThis[contextName] !== 'undefined') {
          globalThis[contextName].prototype[methodName] = originalMethod;
          results.restored.push(key);
        }
      } catch (e) {
        results.failed.push({ method: key, error: e.message });
      }
    }

    // Clear stored data
    WebGLSpoof._originalMethods = {};
    WebGLSpoof._appliedConfig = null;
    WebGLSpoof._noiseEngine = null;

    return results;
  }

  /**
   * Verify that WebGL spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Object} Verification result
   */
  static verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = WebGLSpoof.getAppliedConfig();
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

    // Check vendor
    if (expectedConfig.vendor !== undefined) {
      result.checks.vendor = {
        expected: expectedConfig.vendor,
        actual: appliedConfig.vendor,
        pass: appliedConfig.vendor === expectedConfig.vendor
      };
      if (!result.checks.vendor.pass) result.valid = false;
    }

    // Check renderer
    if (expectedConfig.renderer !== undefined) {
      result.checks.renderer = {
        expected: expectedConfig.renderer,
        actual: appliedConfig.renderer,
        pass: appliedConfig.renderer === expectedConfig.renderer
      };
      if (!result.checks.renderer.pass) result.valid = false;
    }

    // Check unmaskedVendor
    if (expectedConfig.unmaskedVendor !== undefined) {
      result.checks.unmaskedVendor = {
        expected: expectedConfig.unmaskedVendor,
        actual: appliedConfig.unmaskedVendor,
        pass: appliedConfig.unmaskedVendor === expectedConfig.unmaskedVendor
      };
      if (!result.checks.unmaskedVendor.pass) result.valid = false;
    }

    // Check unmaskedRenderer
    if (expectedConfig.unmaskedRenderer !== undefined) {
      result.checks.unmaskedRenderer = {
        expected: expectedConfig.unmaskedRenderer,
        actual: appliedConfig.unmaskedRenderer,
        pass: appliedConfig.unmaskedRenderer === expectedConfig.unmaskedRenderer
      };
      if (!result.checks.unmaskedRenderer.pass) result.valid = false;
    }

    return result;
  }


  /**
   * Generate injection script string for browser context
   * This creates a self-contained script that can be injected into a page
   * 
   * @param {Object} config - WebGL configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...WebGLSpoof._defaultConfig, ...config };
    
    // If seed is not provided, generate one
    if (mergedConfig.seed === null) {
      mergedConfig.seed = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    }

    return `
(function() {
  'use strict';
  
  // WebGL spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)},
    vendor: ${JSON.stringify(mergedConfig.vendor)},
    renderer: ${JSON.stringify(mergedConfig.renderer)},
    unmaskedVendor: ${JSON.stringify(mergedConfig.unmaskedVendor)},
    unmaskedRenderer: ${JSON.stringify(mergedConfig.unmaskedRenderer)},
    extensions: ${JSON.stringify(mergedConfig.extensions)},
    shaderPrecision: ${JSON.stringify(mergedConfig.shaderPrecision)},
    imageNoise: ${mergedConfig.imageNoise},
    noiseLevel: ${JSON.stringify(mergedConfig.noiseLevel)},
    noiseDistribution: ${JSON.stringify(mergedConfig.noiseDistribution)},
    seed: ${mergedConfig.seed}
  };
  
  // Skip if mode is 'off' or 'real'
  if (config.mode === 'off' || config.mode === 'real') {
    return;
  }
  
  // WebGL constants
  const VENDOR = 0x1F00;
  const RENDERER = 0x1F01;
  const UNMASKED_VENDOR_WEBGL = 0x9245;
  const UNMASKED_RENDERER_WEBGL = 0x9246;
  
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
  
  // Reset RNG for deterministic results
  function resetRNG() {
    rng = createSeededRNG(config.seed);
  }
  
  // Apply noise to pixel data
  function applyNoiseToPixels(pixels) {
    if (!config.imageNoise || config.noiseLevel === 'off') return;
    
    resetRNG();
    for (let i = 0; i < pixels.length; i += 4) {
      const noise = getNoise();
      pixels[i] = Math.max(0, Math.min(255, Math.round(pixels[i] + noise)));
      pixels[i + 1] = Math.max(0, Math.min(255, Math.round(pixels[i + 1] + noise)));
      pixels[i + 2] = Math.max(0, Math.min(255, Math.round(pixels[i + 2] + noise)));
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
  
  // Spoof getParameter for both WebGL contexts
  function spoofGetParameter(contextName) {
    if (typeof window[contextName] === 'undefined') return;
    
    const proto = window[contextName].prototype;
    const originalGetParameter = proto.getParameter;
    
    proto.getParameter = createNativeFunction('getParameter', 1, function(pname) {
      if (pname === VENDOR && config.vendor) return config.vendor;
      if (pname === RENDERER && config.renderer) return config.renderer;
      if (pname === UNMASKED_VENDOR_WEBGL && config.unmaskedVendor) return config.unmaskedVendor;
      if (pname === UNMASKED_RENDERER_WEBGL && config.unmaskedRenderer) return config.unmaskedRenderer;
      return originalGetParameter.apply(this, arguments);
    });
  }
  
  // Spoof getSupportedExtensions
  function spoofGetSupportedExtensions(contextName) {
    if (typeof window[contextName] === 'undefined' || !config.extensions) return;
    
    const proto = window[contextName].prototype;
    const originalGetSupportedExtensions = proto.getSupportedExtensions;
    
    proto.getSupportedExtensions = createNativeFunction('getSupportedExtensions', 0, function() {
      return [...config.extensions];
    });
  }
  
  // Spoof readPixels with noise
  function spoofReadPixels(contextName) {
    if (typeof window[contextName] === 'undefined') return;
    
    const proto = window[contextName].prototype;
    const originalReadPixels = proto.readPixels;
    
    proto.readPixels = createNativeFunction('readPixels', 7, function(x, y, width, height, format, type, pixels) {
      const result = originalReadPixels.apply(this, arguments);
      if (pixels && (pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray)) {
        applyNoiseToPixels(pixels);
      }
      return result;
    });
  }
  
  // Apply spoofing to both WebGL contexts
  spoofGetParameter('WebGLRenderingContext');
  spoofGetParameter('WebGL2RenderingContext');
  spoofGetSupportedExtensions('WebGLRenderingContext');
  spoofGetSupportedExtensions('WebGL2RenderingContext');
  spoofReadPixels('WebGLRenderingContext');
  spoofReadPixels('WebGL2RenderingContext');
})();
`;
  }


  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} WebGL configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...WebGLSpoof._defaultConfig };
    }

    const webglConfig = fingerprintConfig.webgl || {};
    
    return {
      mode: webglConfig.mode || WebGLSpoof._defaultConfig.mode,
      vendor: webglConfig.vendor || WebGLSpoof._defaultConfig.vendor,
      renderer: webglConfig.renderer || WebGLSpoof._defaultConfig.renderer,
      unmaskedVendor: webglConfig.unmaskedVendor || WebGLSpoof._defaultConfig.unmaskedVendor,
      unmaskedRenderer: webglConfig.unmaskedRenderer || WebGLSpoof._defaultConfig.unmaskedRenderer,
      extensions: webglConfig.extensions || WebGLSpoof._defaultConfig.extensions,
      shaderPrecision: webglConfig.shaderPrecision || WebGLSpoof._defaultConfig.shaderPrecision,
      imageNoise: webglConfig.imageNoise !== undefined ? webglConfig.imageNoise : WebGLSpoof._defaultConfig.imageNoise,
      noiseLevel: webglConfig.noiseLevel || WebGLSpoof._defaultConfig.noiseLevel,
      noiseDistribution: webglConfig.noiseDistribution || WebGLSpoof._defaultConfig.noiseDistribution,
      seed: fingerprintConfig.noiseSeed?.decrypted || webglConfig.seed || null
    };
  }
}

// Export WebGL constants for external use
WebGLSpoof.Constants = WebGLConstants;

module.exports = {
  WebGLSpoof,
  WebGLSpoofError,
  WebGLConstants
};
