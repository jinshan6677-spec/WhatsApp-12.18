'use strict';

/**
 * NoiseEngine - Deterministic Noise Generator for Fingerprint Spoofing
 * 
 * Provides deterministic noise generation for Canvas, Audio, and other
 * fingerprint-related data. Uses the Mulberry32 algorithm for seeded
 * random number generation to ensure consistent results across sessions.
 * 
 * Requirements: 5.4, 5.5, 5.7, 5.8, 7.1-7.7
 * 
 * Key Features:
 * - Deterministic noise generation based on seed
 * - Multiple noise intensity levels (off/low/medium/high)
 * - Multiple noise distribution types (uniform/gaussian)
 * - Canvas pixel data noise application
 * - Audio channel data noise application
 */

/**
 * Noise Level Enum
 * @readonly
 * @enum {string}
 */
const NoiseLevel = {
  Off: 'off',
  Low: 'low',
  Medium: 'medium',
  High: 'high'
};

/**
 * Noise Distribution Enum
 * @readonly
 * @enum {string}
 */
const NoiseDistribution = {
  Uniform: 'uniform',
  Gaussian: 'gaussian'
};

/**
 * NoiseEngine class for deterministic noise generation
 */
class NoiseEngine {
  /**
   * Creates a NoiseEngine instance
   * @param {number} seed - The seed value for deterministic random generation
   * @param {Object} options - Configuration options
   * @param {string} [options.level='medium'] - Noise intensity level
   * @param {string} [options.distribution='uniform'] - Noise distribution type
   */
  constructor(seed, options = {}) {
    if (typeof seed !== 'number' || !Number.isFinite(seed)) {
      throw new Error('Seed must be a finite number');
    }
    
    this.seed = seed >>> 0; // Ensure unsigned 32-bit integer
    this.level = options.level || NoiseLevel.Medium;
    this.distribution = options.distribution || NoiseDistribution.Uniform;
    
    // Validate level
    if (!Object.values(NoiseLevel).includes(this.level)) {
      throw new Error(`Invalid noise level: ${this.level}. Must be one of: ${Object.values(NoiseLevel).join(', ')}`);
    }
    
    // Validate distribution
    if (!Object.values(NoiseDistribution).includes(this.distribution)) {
      throw new Error(`Invalid noise distribution: ${this.distribution}. Must be one of: ${Object.values(NoiseDistribution).join(', ')}`);
    }
    
    // Initialize the RNG state
    this._state = this.seed;
  }

  /**
   * Mulberry32 PRNG algorithm
   * A fast, high-quality 32-bit PRNG with good statistical properties
   * @private
   * @returns {number} A random number between 0 and 1
   */
  _mulberry32() {
    let t = this._state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  /**
   * Resets the RNG state to the original seed
   * Useful for ensuring deterministic results when processing the same data
   */
  reset() {
    this._state = this.seed;
  }

  /**
   * Gets the scale factor for the current noise level
   * @private
   * @returns {number} Scale factor for noise amplitude
   */
  _getScaleForLevel() {
    switch (this.level) {
      case NoiseLevel.Off:
        return 0;
      case NoiseLevel.Low:
        return 0.5;
      case NoiseLevel.Medium:
        return 2;
      case NoiseLevel.High:
        return 5;
      default:
        return 2;
    }
  }

  /**
   * Generates a noise value based on the current distribution
   * @param {number} [index=0] - Optional index for additional determinism
   * @returns {number} A noise value scaled by the current level
   */
  getNoise(index = 0) {
    if (this.level === NoiseLevel.Off) {
      return 0;
    }

    let noise;
    
    if (this.distribution === NoiseDistribution.Gaussian) {
      // Box-Muller transform for Gaussian distribution
      const u1 = this._mulberry32();
      const u2 = this._mulberry32();
      // Avoid log(0) by ensuring u1 > 0
      const safeU1 = Math.max(u1, 1e-10);
      noise = Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2);
    } else {
      // Uniform distribution in range [-1, 1]
      noise = this._mulberry32() * 2 - 1;
    }

    const scale = this._getScaleForLevel();
    return noise * scale;
  }

  /**
   * Applies noise to Canvas ImageData
   * Modifies RGB channels while preserving alpha
   * 
   * @param {Object} imageData - ImageData-like object with data property
   * @param {Uint8ClampedArray|Array} imageData.data - Pixel data array (RGBA format)
   * @param {number} imageData.width - Image width
   * @param {number} imageData.height - Image height
   * @returns {Object} The modified imageData object
   */
  applyToCanvasData(imageData) {
    if (!imageData || !imageData.data) {
      throw new Error('Invalid imageData: must have a data property');
    }

    if (this.level === NoiseLevel.Off) {
      return imageData;
    }

    // Reset state for deterministic results
    this.reset();

    const data = imageData.data;
    const length = data.length;

    // Process RGBA pixels (4 bytes per pixel)
    for (let i = 0; i < length; i += 4) {
      const noise = this.getNoise(i);
      
      // Apply noise to RGB channels, clamp to valid range [0, 255]
      data[i] = Math.max(0, Math.min(255, Math.round(data[i] + noise)));     // R
      data[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1] + noise))); // G
      data[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2] + noise))); // B
      // Alpha channel (data[i + 3]) is not modified
    }

    return imageData;
  }

  /**
   * Applies noise to Audio channel data
   * Audio data is typically in the range [-1, 1]
   * 
   * @param {Float32Array|Array} channelData - Audio channel data
   * @returns {Float32Array|Array} The modified channel data
   */
  applyToAudioData(channelData) {
    if (!channelData || typeof channelData.length !== 'number') {
      throw new Error('Invalid channelData: must be an array-like object');
    }

    if (this.level === NoiseLevel.Off) {
      return channelData;
    }

    // Reset state for deterministic results
    this.reset();

    // Audio noise needs to be much smaller than canvas noise
    // to avoid audible artifacts
    const audioScale = this._getScaleForLevel() * 0.0001;

    for (let i = 0; i < channelData.length; i++) {
      const baseNoise = this.getNoise(i);
      channelData[i] += baseNoise * audioScale / this._getScaleForLevel();
    }

    return channelData;
  }

  /**
   * Applies noise to ClientRects dimensions
   * Returns a small offset to add to dimension values
   * 
   * @param {number} index - Index for deterministic noise
   * @returns {number} A small noise value suitable for dimensions
   */
  getClientRectsNoise(index = 0) {
    if (this.level === NoiseLevel.Off) {
      return 0;
    }

    // Reset and advance to the index position for determinism
    this.reset();
    for (let i = 0; i < index; i++) {
      this._mulberry32();
    }

    // ClientRects noise should be very small (sub-pixel)
    const scale = this._getScaleForLevel() * 0.001;
    const noise = this._mulberry32() * 2 - 1;
    return noise * scale;
  }

  /**
   * Creates a new NoiseEngine with the same seed but different options
   * @param {Object} options - New options to apply
   * @returns {NoiseEngine} A new NoiseEngine instance
   */
  withOptions(options) {
    return new NoiseEngine(this.seed, {
      level: options.level || this.level,
      distribution: options.distribution || this.distribution
    });
  }

  /**
   * Serializes the NoiseEngine configuration to JSON
   * @returns {Object} JSON-serializable configuration
   */
  toJSON() {
    return {
      seed: this.seed,
      level: this.level,
      distribution: this.distribution
    };
  }

  /**
   * Creates a NoiseEngine from a JSON configuration
   * @param {Object} json - JSON configuration
   * @returns {NoiseEngine} A new NoiseEngine instance
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON: expected an object');
    }
    return new NoiseEngine(json.seed, {
      level: json.level,
      distribution: json.distribution
    });
  }

  /**
   * Generates a cryptographically secure random seed
   * @returns {number} A random 32-bit unsigned integer
   */
  static generateSecureSeed() {
    // Use crypto module in Node.js environment
    if (typeof require !== 'undefined') {
      try {
        const crypto = require('crypto');
        const buffer = crypto.randomBytes(4);
        return buffer.readUInt32BE(0);
      } catch (e) {
        // Fallback to Math.random if crypto is not available
      }
    }
    
    // Fallback for browser or when crypto is not available
    return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
  }

  /**
   * Checks if two NoiseEngines will produce the same output
   * @param {NoiseEngine} other - Another NoiseEngine to compare
   * @returns {boolean} True if they will produce identical output
   */
  equals(other) {
    if (!(other instanceof NoiseEngine)) {
      return false;
    }
    return this.seed === other.seed &&
           this.level === other.level &&
           this.distribution === other.distribution;
  }
}

// Attach enums to the class for easy access
NoiseEngine.NoiseLevel = NoiseLevel;
NoiseEngine.NoiseDistribution = NoiseDistribution;

module.exports = NoiseEngine;
