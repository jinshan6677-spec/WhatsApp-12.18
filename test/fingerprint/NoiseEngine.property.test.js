'use strict';

/**
 * Property-based tests for NoiseEngine
 * 
 * Tests the following properties:
 * - Property 4: Canvas噪声确定性 (Canvas Noise Determinism)
 * - Property 5: 不同账号Canvas噪声唯一性 (Different Account Canvas Noise Uniqueness)
 * 
 * **Validates: Requirements 5.4, 5.5**
 */

const fc = require('fast-check');
const NoiseEngine = require('../../src/domain/fingerprint/NoiseEngine');

// ==================== Arbitraries ====================

/**
 * Valid seed arbitrary (32-bit unsigned integer)
 */
const seedArbitrary = fc.integer({ min: 0, max: 0xFFFFFFFF });

/**
 * Noise level arbitrary
 */
const noiseLevelArbitrary = fc.constantFrom('off', 'low', 'medium', 'high');

/**
 * Active noise level arbitrary (excludes 'off' for tests that need actual noise)
 */
const activeNoiseLevelArbitrary = fc.constantFrom('low', 'medium', 'high');

/**
 * Noise distribution arbitrary
 */
const noiseDistributionArbitrary = fc.constantFrom('uniform', 'gaussian');

/**
 * Valid NoiseEngine options arbitrary
 */
const noiseOptionsArbitrary = fc.record({
  level: noiseLevelArbitrary,
  distribution: noiseDistributionArbitrary
});

/**
 * Active NoiseEngine options arbitrary (with noise enabled)
 */
const activeNoiseOptionsArbitrary = fc.record({
  level: activeNoiseLevelArbitrary,
  distribution: noiseDistributionArbitrary
});

/**
 * Canvas dimensions arbitrary (reasonable sizes for testing)
 */
const canvasDimensionsArbitrary = fc.record({
  width: fc.integer({ min: 1, max: 100 }),
  height: fc.integer({ min: 1, max: 100 })
});

/**
 * Creates a mock ImageData object for testing
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} [fillValue=128] - Value to fill pixels with
 * @returns {Object} Mock ImageData object
 */
function createMockImageData(width, height, fillValue = 128) {
  const length = width * height * 4;
  const data = new Uint8ClampedArray(length);
  for (let i = 0; i < length; i++) {
    data[i] = fillValue;
  }
  return { data, width, height };
}

/**
 * Creates a mock audio channel data array
 * @param {number} length - Number of samples
 * @param {number} [fillValue=0.5] - Value to fill samples with
 * @returns {Float32Array} Mock audio channel data
 */
function createMockAudioData(length, fillValue = 0.5) {
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = fillValue;
  }
  return data;
}

/**
 * Compares two arrays for equality
 * @param {Array|TypedArray} a - First array
 * @param {Array|TypedArray} b - Second array
 * @returns {boolean} True if arrays are equal
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Checks if two arrays are different
 * @param {Array|TypedArray} a - First array
 * @param {Array|TypedArray} b - Second array
 * @returns {boolean} True if arrays differ in at least one element
 */
function arraysDiffer(a, b) {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true;
  }
  return false;
}


// ==================== Property Tests ====================

describe('NoiseEngine Property Tests', () => {
  
  /**
   * **Feature: professional-fingerprint-refactoring, Property 4: Canvas噪声确定性**
   * **Validates: Requirements 5.4**
   * 
   * For any given noise seed and Canvas operation, executing multiple times
   * should produce exactly the same output result.
   */
  describe('Property 4: Canvas Noise Determinism', () => {
    
    test('same seed produces identical canvas noise on multiple executions', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          noiseOptionsArbitrary,
          canvasDimensionsArbitrary,
          async (seed, options, dimensions) => {
            // Create two NoiseEngines with the same seed and options
            const engine1 = new NoiseEngine(seed, options);
            const engine2 = new NoiseEngine(seed, options);
            
            // Create identical ImageData objects
            const imageData1 = createMockImageData(dimensions.width, dimensions.height);
            const imageData2 = createMockImageData(dimensions.width, dimensions.height);
            
            // Apply noise to both
            engine1.applyToCanvasData(imageData1);
            engine2.applyToCanvasData(imageData2);
            
            // Results should be identical
            expect(arraysEqual(imageData1.data, imageData2.data)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('reset() allows reproducing the same noise sequence', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          noiseOptionsArbitrary,
          canvasDimensionsArbitrary,
          async (seed, options, dimensions) => {
            const engine = new NoiseEngine(seed, options);
            
            // Create two identical ImageData objects
            const imageData1 = createMockImageData(dimensions.width, dimensions.height);
            const imageData2 = createMockImageData(dimensions.width, dimensions.height);
            
            // Apply noise, reset, and apply again
            engine.applyToCanvasData(imageData1);
            engine.reset();
            engine.applyToCanvasData(imageData2);
            
            // Results should be identical after reset
            expect(arraysEqual(imageData1.data, imageData2.data)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('getNoise returns same value for same index after reset', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          activeNoiseOptionsArbitrary,
          fc.integer({ min: 0, max: 1000 }),
          async (seed, options, index) => {
            const engine = new NoiseEngine(seed, options);
            
            // Get noise values
            const values1 = [];
            for (let i = 0; i <= index; i++) {
              values1.push(engine.getNoise(i));
            }
            
            // Reset and get again
            engine.reset();
            const values2 = [];
            for (let i = 0; i <= index; i++) {
              values2.push(engine.getNoise(i));
            }
            
            // Values should be identical
            expect(arraysEqual(values1, values2)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('serialization and deserialization preserves determinism', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          noiseOptionsArbitrary,
          canvasDimensionsArbitrary,
          async (seed, options, dimensions) => {
            // Create original engine
            const original = new NoiseEngine(seed, options);
            
            // Serialize and deserialize
            const json = original.toJSON();
            const restored = NoiseEngine.fromJSON(json);
            
            // Create identical ImageData objects
            const imageData1 = createMockImageData(dimensions.width, dimensions.height);
            const imageData2 = createMockImageData(dimensions.width, dimensions.height);
            
            // Apply noise with both engines
            original.applyToCanvasData(imageData1);
            restored.applyToCanvasData(imageData2);
            
            // Results should be identical
            expect(arraysEqual(imageData1.data, imageData2.data)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('audio noise is also deterministic', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          noiseOptionsArbitrary,
          fc.integer({ min: 1, max: 1000 }),
          async (seed, options, length) => {
            // Create two NoiseEngines with the same seed
            const engine1 = new NoiseEngine(seed, options);
            const engine2 = new NoiseEngine(seed, options);
            
            // Create identical audio data
            const audioData1 = createMockAudioData(length);
            const audioData2 = createMockAudioData(length);
            
            // Apply noise to both
            engine1.applyToAudioData(audioData1);
            engine2.applyToAudioData(audioData2);
            
            // Results should be identical
            expect(arraysEqual(audioData1, audioData2)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: professional-fingerprint-refactoring, Property 5: 不同账号Canvas噪声唯一性**
   * **Validates: Requirements 5.5**
   * 
   * For any two accounts with different noise seeds, executing the same
   * Canvas operation should produce different output results.
   */
  describe('Property 5: Different Account Canvas Noise Uniqueness', () => {
    
    test('different seeds produce different canvas noise', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          seedArbitrary.filter(s => s !== 0), // Ensure we can get a different seed
          // Use medium/high noise levels to ensure visible differences in pixel values
          fc.record({
            level: fc.constantFrom('medium', 'high'),
            distribution: noiseDistributionArbitrary
          }),
          // Use larger canvas to ensure enough pixels for statistical difference
          fc.record({
            width: fc.integer({ min: 10, max: 100 }),
            height: fc.integer({ min: 10, max: 100 })
          }),
          async (seed1, seedOffset, options, dimensions) => {
            // Ensure seeds are different
            const seed2 = (seed1 + seedOffset) >>> 0;
            if (seed1 === seed2) return; // Skip if seeds happen to be equal
            
            // Create two NoiseEngines with different seeds
            const engine1 = new NoiseEngine(seed1, options);
            const engine2 = new NoiseEngine(seed2, options);
            
            // Create identical ImageData objects
            const imageData1 = createMockImageData(dimensions.width, dimensions.height);
            const imageData2 = createMockImageData(dimensions.width, dimensions.height);
            
            // Apply noise to both
            engine1.applyToCanvasData(imageData1);
            engine2.applyToCanvasData(imageData2);
            
            // Results should be different
            expect(arraysDiffer(imageData1.data, imageData2.data)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('different seeds produce different audio noise', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          seedArbitrary.filter(s => s !== 0),
          activeNoiseOptionsArbitrary,
          fc.integer({ min: 10, max: 1000 }), // Need enough samples to see difference
          async (seed1, seedOffset, options, length) => {
            // Ensure seeds are different
            const seed2 = (seed1 + seedOffset) >>> 0;
            if (seed1 === seed2) return;
            
            // Create two NoiseEngines with different seeds
            const engine1 = new NoiseEngine(seed1, options);
            const engine2 = new NoiseEngine(seed2, options);
            
            // Create identical audio data
            const audioData1 = createMockAudioData(length);
            const audioData2 = createMockAudioData(length);
            
            // Apply noise to both
            engine1.applyToAudioData(audioData1);
            engine2.applyToAudioData(audioData2);
            
            // Results should be different
            expect(arraysDiffer(audioData1, audioData2)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('different seeds produce different getNoise sequences', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          seedArbitrary.filter(s => s !== 0),
          activeNoiseOptionsArbitrary,
          async (seed1, seedOffset, options) => {
            // Ensure seeds are different
            const seed2 = (seed1 + seedOffset) >>> 0;
            if (seed1 === seed2) return;
            
            const engine1 = new NoiseEngine(seed1, options);
            const engine2 = new NoiseEngine(seed2, options);
            
            // Generate sequences of noise values
            const sequence1 = [];
            const sequence2 = [];
            for (let i = 0; i < 10; i++) {
              sequence1.push(engine1.getNoise(i));
              sequence2.push(engine2.getNoise(i));
            }
            
            // Sequences should be different
            expect(arraysDiffer(sequence1, sequence2)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('equals() correctly identifies different engines', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          seedArbitrary.filter(s => s !== 0),
          noiseOptionsArbitrary,
          async (seed1, seedOffset, options) => {
            const seed2 = (seed1 + seedOffset) >>> 0;
            if (seed1 === seed2) return;
            
            const engine1 = new NoiseEngine(seed1, options);
            const engine2 = new NoiseEngine(seed2, options);
            
            // Engines with different seeds should not be equal
            expect(engine1.equals(engine2)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('equals() correctly identifies identical engines', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          noiseOptionsArbitrary,
          async (seed, options) => {
            const engine1 = new NoiseEngine(seed, options);
            const engine2 = new NoiseEngine(seed, options);
            
            // Engines with same seed and options should be equal
            expect(engine1.equals(engine2)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  // ==================== Additional Unit Tests ====================
  
  describe('NoiseEngine Basic Functionality', () => {
    
    test('constructor validates seed', () => {
      expect(() => new NoiseEngine('invalid')).toThrow('Seed must be a finite number');
      expect(() => new NoiseEngine(NaN)).toThrow('Seed must be a finite number');
      expect(() => new NoiseEngine(Infinity)).toThrow('Seed must be a finite number');
    });

    test('constructor validates noise level', () => {
      expect(() => new NoiseEngine(12345, { level: 'invalid' })).toThrow('Invalid noise level');
    });

    test('constructor validates noise distribution', () => {
      expect(() => new NoiseEngine(12345, { distribution: 'invalid' })).toThrow('Invalid noise distribution');
    });

    test('off level produces no noise', () => {
      const engine = new NoiseEngine(12345, { level: 'off' });
      const imageData = createMockImageData(10, 10, 128);
      const originalData = new Uint8ClampedArray(imageData.data);
      
      engine.applyToCanvasData(imageData);
      
      expect(arraysEqual(imageData.data, originalData)).toBe(true);
    });

    test('applyToCanvasData validates input', () => {
      const engine = new NoiseEngine(12345);
      expect(() => engine.applyToCanvasData(null)).toThrow('Invalid imageData');
      expect(() => engine.applyToCanvasData({})).toThrow('Invalid imageData');
    });

    test('applyToAudioData validates input', () => {
      const engine = new NoiseEngine(12345);
      expect(() => engine.applyToAudioData(null)).toThrow('Invalid channelData');
      expect(() => engine.applyToAudioData({})).toThrow('Invalid channelData');
    });

    test('generateSecureSeed returns valid seed', () => {
      const seed = NoiseEngine.generateSecureSeed();
      expect(typeof seed).toBe('number');
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xFFFFFFFF);
    });

    test('withOptions creates new engine with modified options', () => {
      const original = new NoiseEngine(12345, { level: 'low', distribution: 'uniform' });
      const modified = original.withOptions({ level: 'high' });
      
      expect(modified.seed).toBe(original.seed);
      expect(modified.level).toBe('high');
      expect(modified.distribution).toBe('uniform');
    });

    test('noise values are within expected ranges', () => {
      const engine = new NoiseEngine(12345, { level: 'medium', distribution: 'uniform' });
      
      for (let i = 0; i < 100; i++) {
        const noise = engine.getNoise(i);
        // Medium level has scale of 2, uniform distribution is [-1, 1] * scale
        expect(noise).toBeGreaterThanOrEqual(-2);
        expect(noise).toBeLessThanOrEqual(2);
      }
    });

    test('canvas data stays within valid range [0, 255]', () => {
      const engine = new NoiseEngine(12345, { level: 'high' });
      const imageData = createMockImageData(10, 10, 128);
      
      engine.applyToCanvasData(imageData);
      
      for (let i = 0; i < imageData.data.length; i++) {
        expect(imageData.data[i]).toBeGreaterThanOrEqual(0);
        expect(imageData.data[i]).toBeLessThanOrEqual(255);
      }
    });
  });
});
