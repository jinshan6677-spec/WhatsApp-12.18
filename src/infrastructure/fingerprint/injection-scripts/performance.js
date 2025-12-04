/**
 * Performance API Protection Script
 * 性能API保护脚本
 * 
 * Implements protection for Performance API to prevent fingerprinting.
 * Controls performance timing information and adds noise to high-precision timers.
 * 
 * Covered methods:
 * - performance.now (Req 37.1)
 * - performance.timing (Req 37.2)
 * - performance.memory (Req 37.3)
 * - Precision mode (Req 37.4)
 * 
 * Features:
 * - Noise mode adds micro noise to timestamps
 * - Precision mode reduces timestamp precision
 * - Custom memory configuration
 * - Native function characteristics preserved
 * 
 * @module infrastructure/fingerprint/injection-scripts/performance
 * 
 * **Validates: Requirements 37.1, 37.2, 37.3, 37.4**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');

/**
 * Error class for performance spoofing operations
 */
class PerformanceSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'PerformanceSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * PerformanceSpoof class
 * Provides methods to spoof Performance API
 */
class PerformanceSpoof {
  /**
   * Default performance configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'noise',            // 'noise', 'precision', 'real'
    precision: 100,           // Precision in microseconds (for precision mode)
    noiseSeed: 12345,         // Seed for deterministic noise
    noiseLevel: 'low',        // 'low', 'medium', 'high'
    memory: {
      jsHeapSizeLimit: 2172649472,
      totalJSHeapSize: 10000000,
      usedJSHeapSize: 8000000
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
   * Store for RNG state
   * @private
   */
  static _rngState = null;

  /**
   * Create a seeded random number generator
   * @private
   * @param {number} seed - The seed value
   * @returns {Function} A seeded RNG function
   */
  static _createSeededRNG(seed) {
    let state = seed;
    return function() {
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), state | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Get noise scale based on level
   * @private
   * @param {string} level - Noise level
   * @returns {number} Noise scale in milliseconds
   */
  static _getNoiseScale(level) {
    switch (level) {
      case 'low': return 0.01;      // 10 microseconds
      case 'medium': return 0.1;    // 100 microseconds
      case 'high': return 1;        // 1 millisecond
      default: return 0.01;
    }
  }

  /**
   * Apply noise to a timestamp
   * @private
   * @param {number} timestamp - Original timestamp
   * @returns {number} Noised timestamp
   */
  static _applyNoise(timestamp) {
    if (!PerformanceSpoof._rngState) return timestamp;
    const scale = PerformanceSpoof._getNoiseScale(PerformanceSpoof._appliedConfig.noiseLevel);
    const noise = (PerformanceSpoof._rngState() * 2 - 1) * scale;
    return timestamp + noise;
  }

  /**
   * Reduce precision of a timestamp
   * @private
   * @param {number} timestamp - Original timestamp
   * @param {number} precision - Precision in microseconds
   * @returns {number} Reduced precision timestamp
   */
  static _reducePrecision(timestamp, precision) {
    const precisionMs = precision / 1000;
    return Math.floor(timestamp / precisionMs) * precisionMs;
  }

  /**
   * Apply performance spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='noise'] - Spoofing mode: 'noise', 'precision', or 'real'
   * @param {number} [config.precision=100] - Precision in microseconds
   * @param {number} [config.noiseSeed] - Seed for deterministic noise
   * @param {string} [config.noiseLevel='low'] - Noise level
   * @param {Object} [config.memory] - Memory configuration
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = {
      ...PerformanceSpoof._defaultConfig,
      ...config,
      memory: {
        ...PerformanceSpoof._defaultConfig.memory,
        ...(config.memory || {})
      }
    };
    
    // Validate mode
    if (!['noise', 'precision', 'real'].includes(mergedConfig.mode)) {
      throw new PerformanceSpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'noise', 'precision', or 'real'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // Validate precision
    if (typeof mergedConfig.precision !== 'number' || mergedConfig.precision <= 0) {
      throw new PerformanceSpoofError(
        `Invalid precision: ${mergedConfig.precision}. Must be a positive number`,
        'INVALID_PRECISION',
        { precision: mergedConfig.precision }
      );
    }

    // Validate noise level
    if (!['low', 'medium', 'high'].includes(mergedConfig.noiseLevel)) {
      throw new PerformanceSpoofError(
        `Invalid noiseLevel: ${mergedConfig.noiseLevel}. Must be 'low', 'medium', or 'high'`,
        'INVALID_NOISE_LEVEL',
        { noiseLevel: mergedConfig.noiseLevel }
      );
    }

    // Store the applied configuration
    PerformanceSpoof._appliedConfig = mergedConfig;

    // Initialize RNG for noise mode
    if (mergedConfig.mode === 'noise') {
      PerformanceSpoof._rngState = PerformanceSpoof._createSeededRNG(mergedConfig.noiseSeed);
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

    // Spoof performance.now (Req 37.1, 37.4)
    try {
      PerformanceSpoof._spoofPerformanceNow();
      results.spoofed.push('performance.now');
    } catch (e) {
      results.failed.push({ method: 'performance.now', error: e.message });
      results.success = false;
    }

    // Spoof performance.timing (Req 37.2)
    try {
      PerformanceSpoof._spoofPerformanceTiming();
      results.spoofed.push('performance.timing');
    } catch (e) {
      results.failed.push({ property: 'performance.timing', error: e.message });
      // Not critical
    }

    // Spoof performance.memory (Req 37.3)
    try {
      PerformanceSpoof._spoofPerformanceMemory();
      results.spoofed.push('performance.memory');
    } catch (e) {
      results.failed.push({ property: 'performance.memory', error: e.message });
      // Not critical
    }

    return results;
  }

  /**
   * Spoof performance.now
   * Requirement 37.1: Add micro noise to timestamps
   * Requirement 37.4: Reduce precision to prevent timing attacks
   * @private
   */
  static _spoofPerformanceNow() {
    // Check if performance exists (browser environment)
    if (typeof performance === 'undefined') {
      return;
    }

    const originalNow = performance.now;

    // Store original method
    if (originalNow) {
      PerformanceSpoof._originalMethods.now = originalNow;
    }

    const config = PerformanceSpoof._appliedConfig;

    // Create wrapped function
    const wrappedNow = NativeWrapper.wrap(
      originalNow || function() { return Date.now(); },
      function(original, args, thisArg) {
        let timestamp = original.call(thisArg);

        if (config.mode === 'noise') {
          // Add noise (Req 37.1)
          timestamp = PerformanceSpoof._applyNoise(timestamp);
        } else if (config.mode === 'precision') {
          // Reduce precision (Req 37.4)
          timestamp = PerformanceSpoof._reducePrecision(timestamp, config.precision);
        }

        return timestamp;
      },
      { name: 'now', length: 0 }
    );

    // Replace the method on performance
    try {
      Object.defineProperty(performance, 'now', {
        value: wrappedNow,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      // If defineProperty fails, try direct assignment
      performance.now = wrappedNow;
    }
  }

  /**
   * Spoof performance.timing
   * Requirement 37.2: Add noise to timing data
   * @private
   */
  static _spoofPerformanceTiming() {
    // Check if performance.timing exists (browser environment)
    if (typeof performance === 'undefined' || !performance.timing) {
      return;
    }

    const originalTiming = performance.timing;
    const config = PerformanceSpoof._appliedConfig;

    // Store original
    PerformanceSpoof._originalMethods.timing = originalTiming;

    // Create a proxy for timing object
    const timingProxy = new Proxy(originalTiming, {
      get(target, prop) {
        const value = target[prop];
        
        // Only modify numeric timing values
        if (typeof value === 'number' && value > 0) {
          if (config.mode === 'noise') {
            return PerformanceSpoof._applyNoise(value);
          } else if (config.mode === 'precision') {
            return PerformanceSpoof._reducePrecision(value, config.precision);
          }
        }
        
        return value;
      }
    });

    // Replace performance.timing
    try {
      Object.defineProperty(performance, 'timing', {
        get: function() {
          return timingProxy;
        },
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      // If defineProperty fails, that's okay
    }
  }

  /**
   * Spoof performance.memory
   * Requirement 37.3: Return configured memory information
   * @private
   */
  static _spoofPerformanceMemory() {
    // Check if performance exists (browser environment)
    if (typeof performance === 'undefined') {
      return;
    }

    const config = PerformanceSpoof._appliedConfig;

    // Store original descriptor
    const originalDescriptor = Object.getOwnPropertyDescriptor(performance, 'memory');
    if (originalDescriptor) {
      PerformanceSpoof._originalMethods.memoryDescriptor = originalDescriptor;
    }

    // Create fake memory object
    const fakeMemory = {
      get jsHeapSizeLimit() {
        return config.memory.jsHeapSizeLimit;
      },
      get totalJSHeapSize() {
        return config.memory.totalJSHeapSize;
      },
      get usedJSHeapSize() {
        return config.memory.usedJSHeapSize;
      }
    };

    // Replace performance.memory
    try {
      Object.defineProperty(performance, 'memory', {
        get: function() {
          return fakeMemory;
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
    return PerformanceSpoof._appliedConfig ? {
      ...PerformanceSpoof._appliedConfig,
      memory: { ...PerformanceSpoof._appliedConfig.memory }
    } : null;
  }

  /**
   * Restore original performance methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    if (typeof performance === 'undefined') {
      return results;
    }

    // Restore now
    if (PerformanceSpoof._originalMethods.now) {
      try {
        performance.now = PerformanceSpoof._originalMethods.now;
        results.restored.push('now');
      } catch (e) {
        results.failed.push({ method: 'now', error: e.message });
      }
    }

    // Restore timing
    if (PerformanceSpoof._originalMethods.timing) {
      try {
        Object.defineProperty(performance, 'timing', {
          get: function() {
            return PerformanceSpoof._originalMethods.timing;
          },
          enumerable: true,
          configurable: true
        });
        results.restored.push('timing');
      } catch (e) {
        results.failed.push({ property: 'timing', error: e.message });
      }
    }

    // Restore memory
    if (PerformanceSpoof._originalMethods.memoryDescriptor) {
      try {
        Object.defineProperty(performance, 'memory', PerformanceSpoof._originalMethods.memoryDescriptor);
        results.restored.push('memory');
      } catch (e) {
        results.failed.push({ property: 'memory', error: e.message });
      }
    }

    // Clear stored data
    PerformanceSpoof._originalMethods = {};
    PerformanceSpoof._appliedConfig = null;
    PerformanceSpoof._rngState = null;

    return results;
  }

  /**
   * Generate injection script string for browser context
   * @param {Object} config - Performance configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = {
      ...PerformanceSpoof._defaultConfig,
      ...config,
      memory: {
        ...PerformanceSpoof._defaultConfig.memory,
        ...(config.memory || {})
      }
    };

    return `
(function() {
  'use strict';
  
  // Performance spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)},
    precision: ${mergedConfig.precision},
    noiseSeed: ${mergedConfig.noiseSeed},
    noiseLevel: ${JSON.stringify(mergedConfig.noiseLevel)},
    memory: ${JSON.stringify(mergedConfig.memory)}
  };
  
  // Skip if mode is 'real'
  if (config.mode === 'real') {
    return;
  }
  
  // Check if performance exists
  if (typeof performance === 'undefined') {
    return;
  }
  
  // Seeded RNG for deterministic noise
  let rngState = config.noiseSeed;
  function seededRandom() {
    rngState = (rngState + 0x6D2B79F5) | 0;
    let t = Math.imul(rngState ^ (rngState >>> 15), rngState | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  
  // Get noise scale
  function getNoiseScale(level) {
    switch (level) {
      case 'low': return 0.01;
      case 'medium': return 0.1;
      case 'high': return 1;
      default: return 0.01;
    }
  }
  
  // Apply noise to timestamp (Req 37.1)
  function applyNoise(timestamp) {
    const scale = getNoiseScale(config.noiseLevel);
    const noise = (seededRandom() * 2 - 1) * scale;
    return timestamp + noise;
  }
  
  // Reduce precision (Req 37.4)
  function reducePrecision(timestamp, precision) {
    const precisionMs = precision / 1000;
    return Math.floor(timestamp / precisionMs) * precisionMs;
  }
  
  // Store original performance.now
  const originalNow = performance.now;
  
  // Create spoofed performance.now
  function spoofedNow() {
    let timestamp = originalNow.call(performance);
    
    if (config.mode === 'noise') {
      timestamp = applyNoise(timestamp);
    } else if (config.mode === 'precision') {
      timestamp = reducePrecision(timestamp, config.precision);
    }
    
    return timestamp;
  }
  
  // Make the function appear native
  Object.defineProperty(spoofedNow, 'name', {
    value: 'now',
    writable: false,
    enumerable: false,
    configurable: true
  });
  Object.defineProperty(spoofedNow, 'length', {
    value: 0,
    writable: false,
    enumerable: false,
    configurable: true
  });
  const nativeNowStr = 'function now() { [native code] }';
  spoofedNow.toString = function() { return nativeNowStr; };
  
  // Replace performance.now
  try {
    Object.defineProperty(performance, 'now', {
      value: spoofedNow,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } catch (e) {
    performance.now = spoofedNow;
  }
  
  // Spoof performance.timing (Req 37.2)
  if (performance.timing) {
    const originalTiming = performance.timing;
    
    const timingProxy = new Proxy(originalTiming, {
      get: function(target, prop) {
        const value = target[prop];
        
        if (typeof value === 'number' && value > 0) {
          if (config.mode === 'noise') {
            return applyNoise(value);
          } else if (config.mode === 'precision') {
            return reducePrecision(value, config.precision);
          }
        }
        
        return value;
      }
    });
    
    try {
      Object.defineProperty(performance, 'timing', {
        get: function() {
          return timingProxy;
        },
        enumerable: true,
        configurable: true
      });
    } catch (e) {}
  }
  
  // Spoof performance.memory (Req 37.3)
  const fakeMemory = {
    get jsHeapSizeLimit() { return config.memory.jsHeapSizeLimit; },
    get totalJSHeapSize() { return config.memory.totalJSHeapSize; },
    get usedJSHeapSize() { return config.memory.usedJSHeapSize; }
  };
  
  try {
    Object.defineProperty(performance, 'memory', {
      get: function() {
        return fakeMemory;
      },
      enumerable: true,
      configurable: true
    });
  } catch (e) {}
})();
`;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Performance configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...PerformanceSpoof._defaultConfig };
    }

    const advancedApis = fingerprintConfig.advancedApis || {};
    const performanceConfig = advancedApis.performance || {};
    
    return {
      mode: performanceConfig.mode || PerformanceSpoof._defaultConfig.mode,
      precision: performanceConfig.precision !== undefined 
        ? performanceConfig.precision 
        : PerformanceSpoof._defaultConfig.precision,
      noiseSeed: fingerprintConfig.noiseSeed?.value || PerformanceSpoof._defaultConfig.noiseSeed,
      noiseLevel: performanceConfig.noiseLevel || PerformanceSpoof._defaultConfig.noiseLevel,
      memory: performanceConfig.memory 
        ? { ...PerformanceSpoof._defaultConfig.memory, ...performanceConfig.memory }
        : PerformanceSpoof._defaultConfig.memory
    };
  }

  /**
   * Verify that performance spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Object} Verification result
   */
  static verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = PerformanceSpoof.getAppliedConfig();
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

    // If in browser environment, verify actual behavior
    if (typeof performance !== 'undefined') {
      // Check that performance.now returns a number
      const now = performance.now();
      result.checks.nowReturnsNumber = {
        expected: 'number',
        actual: typeof now,
        pass: typeof now === 'number'
      };
      if (!result.checks.nowReturnsNumber.pass) result.valid = false;

      // Check memory if configured (Req 37.3)
      if (performance.memory && appliedConfig.mode !== 'real') {
        result.checks.memoryJsHeapSizeLimit = {
          expected: appliedConfig.memory.jsHeapSizeLimit,
          actual: performance.memory.jsHeapSizeLimit,
          pass: performance.memory.jsHeapSizeLimit === appliedConfig.memory.jsHeapSizeLimit
        };
        if (!result.checks.memoryJsHeapSizeLimit.pass) result.valid = false;
      }
    }

    return result;
  }
}

module.exports = {
  PerformanceSpoof,
  PerformanceSpoofError
};
