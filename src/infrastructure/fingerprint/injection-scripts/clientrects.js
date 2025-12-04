/**
 * ClientRects Spoofing Script
 * ClientRects伪装脚本
 * 
 * Implements spoofing for Element dimension measurement APIs to prevent fingerprinting.
 * Uses NoiseEngine to add deterministic noise to dimension values.
 * 
 * Covered methods:
 * - Element.getBoundingClientRect (Req 14.1)
 * - Element.getClientRects (Req 14.2)
 * 
 * Features:
 * - Deterministic noise based on seed (Req 14.3)
 * - Different noise per account (Req 14.4)
 * - Off mode returns original data (Req 14.5)
 * 
 * @module infrastructure/fingerprint/injection-scripts/clientrects
 * 
 * **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');
const NoiseEngine = require('../../../domain/fingerprint/NoiseEngine');

/**
 * Error class for ClientRects spoofing operations
 */
class ClientRectsSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ClientRectsSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * ClientRectsSpoof class
 * Provides methods to spoof Element dimension measurement APIs
 */
class ClientRectsSpoof {
  /**
   * Default ClientRects configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'noise',           // 'noise', 'off'
    noiseLevel: 'low',       // 'off', 'low', 'medium', 'high'
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
   * Cache for element noise values to ensure consistency
   * Uses WeakMap to avoid memory leaks
   * @private
   */
  static _elementNoiseCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  /**
   * Apply ClientRects spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='noise'] - Spoofing mode: 'noise' or 'off'
   * @param {string} [config.noiseLevel='low'] - Noise level: 'off', 'low', 'medium', 'high'
   * @param {number} [config.seed] - Noise seed for deterministic results
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = { ...ClientRectsSpoof._defaultConfig, ...config };
    
    // Validate mode
    if (!['noise', 'off'].includes(mergedConfig.mode)) {
      throw new ClientRectsSpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'noise' or 'off'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // Validate noise level
    if (!['off', 'low', 'medium', 'high'].includes(mergedConfig.noiseLevel)) {
      throw new ClientRectsSpoofError(
        `Invalid noiseLevel: ${mergedConfig.noiseLevel}. Must be 'off', 'low', 'medium', or 'high'`,
        'INVALID_NOISE_LEVEL',
        { noiseLevel: mergedConfig.noiseLevel }
      );
    }

    // If mode is 'noise', seed is required
    if (mergedConfig.mode === 'noise' && mergedConfig.seed === null) {
      // Generate a random seed if not provided
      mergedConfig.seed = NoiseEngine.generateSecureSeed();
    }

    // Store the applied configuration
    ClientRectsSpoof._appliedConfig = mergedConfig;

    // Clear the element noise cache
    ClientRectsSpoof._elementNoiseCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

    // Create NoiseEngine if in noise mode
    if (mergedConfig.mode === 'noise' && mergedConfig.noiseLevel !== 'off') {
      ClientRectsSpoof._noiseEngine = new NoiseEngine(mergedConfig.seed, {
        level: mergedConfig.noiseLevel,
        distribution: 'uniform'
      });
    } else {
      ClientRectsSpoof._noiseEngine = null;
    }

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // Spoof getBoundingClientRect (Req 14.1)
    try {
      ClientRectsSpoof._spoofGetBoundingClientRect();
      results.spoofed.push('getBoundingClientRect');
    } catch (e) {
      results.failed.push({ method: 'getBoundingClientRect', error: e.message });
      results.success = false;
    }

    // Spoof getClientRects (Req 14.2)
    try {
      ClientRectsSpoof._spoofGetClientRects();
      results.spoofed.push('getClientRects');
    } catch (e) {
      results.failed.push({ method: 'getClientRects', error: e.message });
      results.success = false;
    }

    return results;
  }

  /**
   * Get or create noise offsets for an element
   * Ensures the same element always gets the same noise (Req 14.3)
   * @private
   * @param {Element} element - The DOM element
   * @returns {Object} Noise offsets for x, y, width, height
   */
  static _getElementNoise(element) {
    if (!ClientRectsSpoof._noiseEngine) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    // Check cache first
    if (ClientRectsSpoof._elementNoiseCache && ClientRectsSpoof._elementNoiseCache.has(element)) {
      return ClientRectsSpoof._elementNoiseCache.get(element);
    }

    // Generate deterministic noise based on element characteristics
    // Use a hash of element properties to create consistent noise
    const elementHash = ClientRectsSpoof._hashElement(element);
    
    // Create a temporary NoiseEngine with element-specific seed
    const elementSeed = (ClientRectsSpoof._appliedConfig.seed + elementHash) >>> 0;
    const tempEngine = new NoiseEngine(elementSeed, {
      level: ClientRectsSpoof._appliedConfig.noiseLevel,
      distribution: 'uniform'
    });

    // Generate noise values for each dimension
    // ClientRects noise should be very small (sub-pixel)
    const noiseScale = ClientRectsSpoof._getNoiseScale();
    
    const noise = {
      x: tempEngine.getNoise(0) * noiseScale,
      y: tempEngine.getNoise(1) * noiseScale,
      width: tempEngine.getNoise(2) * noiseScale,
      height: tempEngine.getNoise(3) * noiseScale
    };

    // Cache the noise values
    if (ClientRectsSpoof._elementNoiseCache) {
      ClientRectsSpoof._elementNoiseCache.set(element, noise);
    }

    return noise;
  }

  /**
   * Get noise scale based on noise level
   * @private
   * @returns {number} Scale factor for noise
   */
  static _getNoiseScale() {
    const level = ClientRectsSpoof._appliedConfig?.noiseLevel || 'low';
    switch (level) {
      case 'off': return 0;
      case 'low': return 0.001;      // Sub-pixel noise
      case 'medium': return 0.005;   // Small but detectable
      case 'high': return 0.01;      // More noticeable
      default: return 0.001;
    }
  }

  /**
   * Create a simple hash from element properties
   * Used to generate consistent noise for the same element
   * @private
   * @param {Element} element - The DOM element
   * @returns {number} Hash value
   */
  static _hashElement(element) {
    let hash = 0;
    
    // Use tagName
    const tagName = element.tagName || '';
    for (let i = 0; i < tagName.length; i++) {
      hash = ((hash << 5) - hash) + tagName.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Use id if available
    const id = element.id || '';
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    
    // Use className if available
    const className = element.className || '';
    const classStr = typeof className === 'string' ? className : className.toString();
    for (let i = 0; i < classStr.length; i++) {
      hash = ((hash << 5) - hash) + classStr.charCodeAt(i);
      hash = hash & hash;
    }

    return Math.abs(hash);
  }

  /**
   * Apply noise to a DOMRect-like object
   * @private
   * @param {DOMRect} rect - The original DOMRect
   * @param {Object} noise - Noise offsets
   * @returns {Object} Modified rect values
   */
  static _applyNoiseToRect(rect, noise) {
    const x = rect.x + noise.x;
    const y = rect.y + noise.y;
    const width = rect.width + noise.width;
    const height = rect.height + noise.height;

    return {
      x,
      y,
      width,
      height,
      top: y,
      right: x + width,
      bottom: y + height,
      left: x
    };
  }

  /**
   * Create a DOMRect-like object with noise applied
   * @private
   * @param {DOMRect} originalRect - The original DOMRect
   * @param {Object} noise - Noise offsets
   * @returns {Object} A DOMRect-like object
   */
  static _createNoisyDOMRect(originalRect, noise) {
    const noisyValues = ClientRectsSpoof._applyNoiseToRect(originalRect, noise);
    
    // Create an object that mimics DOMRect
    const noisyRect = {
      x: noisyValues.x,
      y: noisyValues.y,
      width: noisyValues.width,
      height: noisyValues.height,
      top: noisyValues.top,
      right: noisyValues.right,
      bottom: noisyValues.bottom,
      left: noisyValues.left,
      toJSON: function() {
        return {
          x: this.x,
          y: this.y,
          width: this.width,
          height: this.height,
          top: this.top,
          right: this.right,
          bottom: this.bottom,
          left: this.left
        };
      }
    };

    // Make properties non-writable to match DOMRect behavior
    Object.keys(noisyRect).forEach(key => {
      if (key !== 'toJSON') {
        Object.defineProperty(noisyRect, key, {
          value: noisyRect[key],
          writable: false,
          enumerable: true,
          configurable: false
        });
      }
    });

    return noisyRect;
  }

  /**
   * Spoof Element.getBoundingClientRect
   * Requirement 14.1: Return dimensions with deterministic noise
   * @private
   */
  static _spoofGetBoundingClientRect() {
    // Check if Element exists (browser environment)
    if (typeof Element === 'undefined') {
      return;
    }

    const proto = Element.prototype;
    const originalGetBoundingClientRect = proto.getBoundingClientRect;

    // Store original method
    ClientRectsSpoof._originalMethods.getBoundingClientRect = originalGetBoundingClientRect;

    // Create wrapped function
    const wrappedGetBoundingClientRect = NativeWrapper.wrap(
      originalGetBoundingClientRect,
      function(original, args, thisArg) {
        const element = thisArg;
        const config = ClientRectsSpoof._appliedConfig;

        // Get original rect
        const originalRect = original.apply(element, args);

        // If mode is 'off' or no noise engine, return original result
        if (!config || config.mode === 'off' || !ClientRectsSpoof._noiseEngine) {
          return originalRect;
        }

        // Get noise for this element
        const noise = ClientRectsSpoof._getElementNoise(element);

        // Create and return noisy DOMRect
        return ClientRectsSpoof._createNoisyDOMRect(originalRect, noise);
      },
      { name: 'getBoundingClientRect', length: 0 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'getBoundingClientRect', wrappedGetBoundingClientRect);
  }

  /**
   * Spoof Element.getClientRects
   * Requirement 14.2: Return rectangle list with deterministic noise
   * @private
   */
  static _spoofGetClientRects() {
    // Check if Element exists (browser environment)
    if (typeof Element === 'undefined') {
      return;
    }

    const proto = Element.prototype;
    const originalGetClientRects = proto.getClientRects;

    // Store original method
    ClientRectsSpoof._originalMethods.getClientRects = originalGetClientRects;

    // Create wrapped function
    const wrappedGetClientRects = NativeWrapper.wrap(
      originalGetClientRects,
      function(original, args, thisArg) {
        const element = thisArg;
        const config = ClientRectsSpoof._appliedConfig;

        // Get original rects
        const originalRects = original.apply(element, args);

        // If mode is 'off' or no noise engine, return original result
        if (!config || config.mode === 'off' || !ClientRectsSpoof._noiseEngine) {
          return originalRects;
        }

        // Get base noise for this element
        const baseNoise = ClientRectsSpoof._getElementNoise(element);

        // Create noisy rects array
        const noisyRects = [];
        for (let i = 0; i < originalRects.length; i++) {
          // Add slight variation for each rect in the list
          const rectNoise = {
            x: baseNoise.x + (i * 0.0001),
            y: baseNoise.y + (i * 0.0001),
            width: baseNoise.width,
            height: baseNoise.height
          };
          noisyRects.push(ClientRectsSpoof._createNoisyDOMRect(originalRects[i], rectNoise));
        }

        // Create a DOMRectList-like object
        const noisyRectList = ClientRectsSpoof._createDOMRectList(noisyRects);

        return noisyRectList;
      },
      { name: 'getClientRects', length: 0 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'getClientRects', wrappedGetClientRects);
  }

  /**
   * Create a DOMRectList-like object
   * @private
   * @param {Array} rects - Array of DOMRect-like objects
   * @returns {Object} A DOMRectList-like object
   */
  static _createDOMRectList(rects) {
    const rectList = {
      length: rects.length,
      item: function(index) {
        return index >= 0 && index < rects.length ? rects[index] : null;
      }
    };

    // Add indexed access
    for (let i = 0; i < rects.length; i++) {
      rectList[i] = rects[i];
    }

    // Make it iterable
    rectList[Symbol.iterator] = function* () {
      for (let i = 0; i < rects.length; i++) {
        yield rects[i];
      }
    };

    return rectList;
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return ClientRectsSpoof._appliedConfig ? { ...ClientRectsSpoof._appliedConfig } : null;
  }

  /**
   * Get the NoiseEngine instance
   * @returns {NoiseEngine|null} The NoiseEngine instance or null
   */
  static getNoiseEngine() {
    return ClientRectsSpoof._noiseEngine;
  }

  /**
   * Restore original ClientRects methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    // Restore getBoundingClientRect
    if (ClientRectsSpoof._originalMethods.getBoundingClientRect && typeof Element !== 'undefined') {
      try {
        Element.prototype.getBoundingClientRect = ClientRectsSpoof._originalMethods.getBoundingClientRect;
        results.restored.push('getBoundingClientRect');
      } catch (e) {
        results.failed.push({ method: 'getBoundingClientRect', error: e.message });
      }
    }

    // Restore getClientRects
    if (ClientRectsSpoof._originalMethods.getClientRects && typeof Element !== 'undefined') {
      try {
        Element.prototype.getClientRects = ClientRectsSpoof._originalMethods.getClientRects;
        results.restored.push('getClientRects');
      } catch (e) {
        results.failed.push({ method: 'getClientRects', error: e.message });
      }
    }

    // Clear stored data
    ClientRectsSpoof._originalMethods = {};
    ClientRectsSpoof._appliedConfig = null;
    ClientRectsSpoof._noiseEngine = null;
    ClientRectsSpoof._elementNoiseCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

    return results;
  }

  /**
   * Generate injection script string for browser context
   * This creates a self-contained script that can be injected into a page
   * 
   * @param {Object} config - ClientRects configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...ClientRectsSpoof._defaultConfig, ...config };
    
    // If seed is not provided, generate one
    if (mergedConfig.seed === null) {
      mergedConfig.seed = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    }

    return `
(function() {
  'use strict';
  
  // ClientRects spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)},
    noiseLevel: ${JSON.stringify(mergedConfig.noiseLevel)},
    seed: ${mergedConfig.seed}
  };
  
  // Skip if mode is 'off'
  if (config.mode === 'off') {
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
      case 'low': return 0.001;
      case 'medium': return 0.005;
      case 'high': return 0.01;
      default: return 0.001;
    }
  }
  
  const noiseScale = getNoiseScale(config.noiseLevel);
  
  // Element noise cache
  const elementNoiseCache = new WeakMap();
  
  // Hash element for consistent noise
  function hashElement(element) {
    let hash = 0;
    const tagName = element.tagName || '';
    for (let i = 0; i < tagName.length; i++) {
      hash = ((hash << 5) - hash) + tagName.charCodeAt(i);
      hash = hash & hash;
    }
    const id = element.id || '';
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    const className = element.className || '';
    const classStr = typeof className === 'string' ? className : className.toString();
    for (let i = 0; i < classStr.length; i++) {
      hash = ((hash << 5) - hash) + classStr.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Get or create noise for element
  function getElementNoise(element) {
    if (noiseScale === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    if (elementNoiseCache.has(element)) {
      return elementNoiseCache.get(element);
    }
    
    const elementHash = hashElement(element);
    const elementSeed = (config.seed + elementHash) >>> 0;
    const rng = createSeededRNG(elementSeed);
    
    const noise = {
      x: (rng() * 2 - 1) * noiseScale,
      y: (rng() * 2 - 1) * noiseScale,
      width: (rng() * 2 - 1) * noiseScale,
      height: (rng() * 2 - 1) * noiseScale
    };
    
    elementNoiseCache.set(element, noise);
    return noise;
  }
  
  // Create noisy DOMRect
  function createNoisyDOMRect(rect, noise) {
    const x = rect.x + noise.x;
    const y = rect.y + noise.y;
    const width = rect.width + noise.width;
    const height = rect.height + noise.height;
    
    return {
      x: x,
      y: y,
      width: width,
      height: height,
      top: y,
      right: x + width,
      bottom: y + height,
      left: x,
      toJSON: function() {
        return {
          x: this.x, y: this.y, width: this.width, height: this.height,
          top: this.top, right: this.right, bottom: this.bottom, left: this.left
        };
      }
    };
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
  
  // Spoof getBoundingClientRect
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = createNativeFunction('getBoundingClientRect', 0, function() {
    const originalRect = originalGetBoundingClientRect.apply(this, arguments);
    const noise = getElementNoise(this);
    return createNoisyDOMRect(originalRect, noise);
  });
  
  // Spoof getClientRects
  const originalGetClientRects = Element.prototype.getClientRects;
  Element.prototype.getClientRects = createNativeFunction('getClientRects', 0, function() {
    const originalRects = originalGetClientRects.apply(this, arguments);
    const baseNoise = getElementNoise(this);
    
    const noisyRects = [];
    for (let i = 0; i < originalRects.length; i++) {
      const rectNoise = {
        x: baseNoise.x + (i * 0.0001),
        y: baseNoise.y + (i * 0.0001),
        width: baseNoise.width,
        height: baseNoise.height
      };
      noisyRects.push(createNoisyDOMRect(originalRects[i], rectNoise));
    }
    
    // Create DOMRectList-like object
    const rectList = {
      length: noisyRects.length,
      item: function(index) {
        return index >= 0 && index < noisyRects.length ? noisyRects[index] : null;
      }
    };
    
    for (let i = 0; i < noisyRects.length; i++) {
      rectList[i] = noisyRects[i];
    }
    
    rectList[Symbol.iterator] = function* () {
      for (let i = 0; i < noisyRects.length; i++) {
        yield noisyRects[i];
      }
    };
    
    return rectList;
  });
})();
`;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} ClientRects configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...ClientRectsSpoof._defaultConfig };
    }

    const clientRectsConfig = fingerprintConfig.clientRects || {};
    
    return {
      mode: clientRectsConfig.mode || ClientRectsSpoof._defaultConfig.mode,
      noiseLevel: clientRectsConfig.noiseLevel || ClientRectsSpoof._defaultConfig.noiseLevel,
      seed: fingerprintConfig.noiseSeed?.decrypted || clientRectsConfig.seed || null
    };
  }

  /**
   * Verify that ClientRects spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Object} Verification result
   */
  static verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = ClientRectsSpoof.getAppliedConfig();
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
  ClientRectsSpoof,
  ClientRectsSpoofError
};
