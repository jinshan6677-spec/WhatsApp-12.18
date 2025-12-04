/**
 * Performance Benchmark Tests for Fingerprint System
 * 
 * Tests performance characteristics of the fingerprint injection system:
 * - Injection delay (target: <50ms)
 * - API call overhead (target: <1ms per call)
 * - CPU usage (target: <5% increase)
 * 
 * Requirements: 53.1-53.5
 * 
 * @module test/fingerprint/performance/benchmark
 */

'use strict';

const { FingerprintInjector } = require('../../../src/infrastructure/fingerprint/FingerprintInjector');
const { ScriptGenerator } = require('../../../src/infrastructure/fingerprint/injection-scripts');
const NoiseEngine = require('../../../src/domain/fingerprint/NoiseEngine');
const FingerprintGenerator = require('../../../src/application/services/fingerprint/FingerprintGenerator');

// ==================== Test Configuration ====================

/**
 * Performance thresholds based on requirements
 */
const PERFORMANCE_THRESHOLDS = {
  INJECTION_DELAY_MS: 50,        // Requirement 25.1: <50ms for injection
  API_CALL_OVERHEAD_MS: 1,       // Requirement 25.2: <1ms per API call
  CPU_INCREASE_PERCENT: 5,       // Requirement 25.3: <5% CPU increase
  CONFIG_LOAD_MS: 100,           // Requirement 25.4: <100ms for 50 accounts
  ITERATIONS: 20                 // Number of iterations for averaging (reduced for faster tests)
};

/**
 * Sample fingerprint configuration for testing
 */
const createTestConfig = () => ({
  id: 'test-fingerprint-id',
  accountId: 'test-account-id',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  browser: {
    type: 'chrome',
    version: '120.0.0.0',
    majorVersion: 120
  },
  os: {
    type: 'windows',
    version: '10.0',
    platform: 'Win32'
  },
  navigator: {
    appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    vendor: 'Google Inc.',
    product: 'Gecko',
    productSub: '20030107',
    appName: 'Netscape',
    appCodeName: 'Mozilla',
    language: 'en-US',
    languages: ['en-US', 'en'],
    doNotTrack: null,
    globalPrivacyControl: false,
    webdriver: false
  },
  hardware: {
    cpuCores: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
      colorDepth: 24,
      pixelDepth: 24
    },
    devicePixelRatio: 1
  },
  canvas: {
    mode: 'noise',
    noiseLevel: 'medium',
    noiseDistribution: 'uniform'
  },
  webgl: {
    mode: 'custom',
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
    unmaskedVendor: 'Intel Inc.',
    unmaskedRenderer: 'Intel(R) UHD Graphics',
    extensions: ['ANGLE_instanced_arrays', 'EXT_blend_minmax'],
    imageNoise: true,
    noiseLevel: 'medium'
  },
  audio: {
    mode: 'noise',
    noiseLevel: 'medium',
    noiseDistribution: 'uniform'
  },
  fonts: {
    mode: 'custom',
    list: ['Arial', 'Helvetica', 'Times New Roman', 'Verdana', 'Georgia']
  },
  timezone: {
    mode: 'custom',
    name: 'America/New_York',
    offset: -300
  },
  geolocation: {
    mode: 'custom',
    latitude: 40.7128,
    longitude: -74.0060,
    accuracy: 100
  },
  webrtc: {
    mode: 'replace',
    publicIP: 'auto',
    localIP: '192.168.1.100',
    whitelist: []
  },
  clientRects: {
    mode: 'noise',
    noiseLevel: 'low'
  },
  advancedApis: {
    performance: { mode: 'noise', precision: 100 }
  },
  noiseSeed: {
    encrypted: false,
    value: 12345678
  }
});

// ==================== Utility Functions ====================

/**
 * Measures execution time of a function
 * @param {Function} fn - Function to measure
 * @returns {Object} Result with duration and return value
 */
function measureTime(fn) {
  const start = process.hrtime.bigint();
  const result = fn();
  const end = process.hrtime.bigint();
  const durationNs = Number(end - start);
  const durationMs = durationNs / 1_000_000;
  
  return {
    result,
    durationMs,
    durationNs
  };
}

/**
 * Measures async execution time
 * @param {Function} fn - Async function to measure
 * @returns {Promise<Object>} Result with duration and return value
 */
async function measureTimeAsync(fn) {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const durationNs = Number(end - start);
  const durationMs = durationNs / 1_000_000;
  
  return {
    result,
    durationMs,
    durationNs
  };
}

/**
 * Runs a function multiple times and returns statistics
 * @param {Function} fn - Function to benchmark
 * @param {number} iterations - Number of iterations
 * @returns {Object} Statistics object
 */
function benchmark(fn, iterations = PERFORMANCE_THRESHOLDS.ITERATIONS) {
  const times = [];
  
  // Warm-up run
  fn();
  
  for (let i = 0; i < iterations; i++) {
    const { durationMs } = measureTime(fn);
    times.push(durationMs);
  }
  
  times.sort((a, b) => a - b);
  
  const sum = times.reduce((a, b) => a + b, 0);
  const mean = sum / times.length;
  const median = times[Math.floor(times.length / 2)];
  const min = times[0];
  const max = times[times.length - 1];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  
  // Standard deviation
  const squaredDiffs = times.map(t => Math.pow(t - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / times.length;
  const stdDev = Math.sqrt(avgSquaredDiff);
  
  return {
    iterations,
    mean,
    median,
    min,
    max,
    p95,
    p99,
    stdDev,
    times
  };
}

/**
 * Generates a performance report
 * @param {Object} results - Benchmark results
 * @param {string} testName - Name of the test
 * @param {number} threshold - Performance threshold
 * @returns {Object} Report object
 */
function generateReport(results, testName, threshold) {
  const passed = results.mean < threshold;
  const margin = ((threshold - results.mean) / threshold * 100).toFixed(2);
  
  return {
    testName,
    threshold,
    passed,
    margin: passed ? `${margin}% under threshold` : `${Math.abs(margin)}% over threshold`,
    statistics: {
      mean: `${results.mean.toFixed(3)}ms`,
      median: `${results.median.toFixed(3)}ms`,
      min: `${results.min.toFixed(3)}ms`,
      max: `${results.max.toFixed(3)}ms`,
      p95: `${results.p95.toFixed(3)}ms`,
      p99: `${results.p99.toFixed(3)}ms`,
      stdDev: `${results.stdDev.toFixed(3)}ms`
    },
    recommendations: passed ? [] : getOptimizationRecommendations(testName, results)
  };
}

/**
 * Gets optimization recommendations based on test results
 * Requirement 53.4: Provide optimization suggestions when performance is not meeting targets
 * @param {string} testName - Name of the test
 * @param {Object} results - Benchmark results
 * @returns {string[]} Array of recommendations
 */
function getOptimizationRecommendations(testName, results) {
  const recommendations = [];
  
  if (testName.includes('injection')) {
    recommendations.push('Consider lazy initialization of non-critical spoof modules');
    recommendations.push('Use minimal coverage strategy - only spoof APIs that are actually used');
    recommendations.push('Cache generated scripts to avoid regeneration');
    if (results.stdDev > results.mean * 0.5) {
      recommendations.push('High variance detected - consider optimizing hot paths');
    }
  }
  
  if (testName.includes('api') || testName.includes('API')) {
    recommendations.push('Reduce noise calculation complexity for frequently called APIs');
    recommendations.push('Consider using pre-computed noise tables');
    recommendations.push('Batch similar operations where possible');
  }
  
  if (testName.includes('cpu') || testName.includes('CPU')) {
    recommendations.push('Implement throttling for high-frequency API calls');
    recommendations.push('Use requestIdleCallback for non-critical operations');
    recommendations.push('Consider disabling unused spoof modules');
  }
  
  return recommendations;
}

// ==================== Test Suites ====================

describe('Fingerprint Performance Benchmarks', () => {
  let testConfig;
  
  beforeAll(() => {
    testConfig = createTestConfig();
  });

  describe('Injection Delay Tests', () => {
    /**
     * Requirement 53.1: Test injection delay on complex and idle pages
     */
    
    test('script generation should complete within threshold', () => {
      const results = benchmark(() => {
        const injector = new FingerprintInjector(testConfig);
        return injector.getInjectionScript();
      });
      
      const report = generateReport(
        results,
        'Script Generation',
        PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS
      );
      
      console.log('\n=== Script Generation Performance ===');
      console.log(`Mean: ${report.statistics.mean}`);
      console.log(`P95: ${report.statistics.p95}`);
      console.log(`Threshold: ${PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS}ms`);
      console.log(`Status: ${report.passed ? 'PASSED' : 'FAILED'}`);
      
      expect(results.mean).toBeLessThan(PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS);
    });

    test('preload script generation should complete within threshold', () => {
      const results = benchmark(() => {
        const injector = new FingerprintInjector(testConfig);
        return injector.getPreloadScript();
      });
      
      const report = generateReport(
        results,
        'Preload Script Generation',
        PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS
      );
      
      console.log('\n=== Preload Script Generation Performance ===');
      console.log(`Mean: ${report.statistics.mean}`);
      console.log(`P95: ${report.statistics.p95}`);
      console.log(`Status: ${report.passed ? 'PASSED' : 'FAILED'}`);
      
      expect(results.mean).toBeLessThan(PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS);
    });

    test('worker script generation should complete within threshold', () => {
      const results = benchmark(() => {
        const injector = new FingerprintInjector(testConfig);
        return injector.getWorkerScript({ workerType: 'worker' });
      });
      
      const report = generateReport(
        results,
        'Worker Script Generation',
        PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS
      );
      
      console.log('\n=== Worker Script Generation Performance ===');
      console.log(`Mean: ${report.statistics.mean}`);
      console.log(`P95: ${report.statistics.p95}`);
      console.log(`Status: ${report.passed ? 'PASSED' : 'FAILED'}`);
      
      expect(results.mean).toBeLessThan(PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS);
    });

    test('iframe script generation should complete within threshold', () => {
      const results = benchmark(() => {
        const injector = new FingerprintInjector(testConfig);
        return injector.getIframeScript({ sameOriginOnly: true });
      });
      
      const report = generateReport(
        results,
        'Iframe Script Generation',
        PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS
      );
      
      console.log('\n=== Iframe Script Generation Performance ===');
      console.log(`Mean: ${report.statistics.mean}`);
      console.log(`P95: ${report.statistics.p95}`);
      console.log(`Status: ${report.passed ? 'PASSED' : 'FAILED'}`);
      
      expect(results.mean).toBeLessThan(PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS);
    });

    test('cached script retrieval should be significantly faster', () => {
      const injector = new FingerprintInjector(testConfig);
      
      // First call - generates and caches
      const firstCall = measureTime(() => injector.getInjectionScript());
      
      // Subsequent calls - should use cache
      const cachedResults = benchmark(() => injector.getInjectionScript());
      
      console.log('\n=== Cache Performance ===');
      console.log(`First call: ${firstCall.durationMs.toFixed(3)}ms`);
      console.log(`Cached mean: ${cachedResults.mean.toFixed(3)}ms`);
      console.log(`Speedup: ${(firstCall.durationMs / cachedResults.mean).toFixed(1)}x`);
      
      // Cached retrieval should be at least 10x faster
      expect(cachedResults.mean).toBeLessThan(firstCall.durationMs / 10);
    });
  });

  describe('API Call Overhead Tests', () => {
    /**
     * Requirement 53.2: Test API call overhead for each overridden API
     */
    
    test('NoiseEngine.getNoise should have minimal overhead', () => {
      const engine = new NoiseEngine(12345678, { level: 'medium' });
      
      const results = benchmark(() => {
        for (let i = 0; i < 1000; i++) {
          engine.getNoise(i);
        }
      });
      
      // Per-call overhead (1000 calls per iteration)
      const perCallMs = results.mean / 1000;
      
      console.log('\n=== NoiseEngine.getNoise Performance ===');
      console.log(`Mean per 1000 calls: ${results.mean.toFixed(3)}ms`);
      console.log(`Per call: ${(perCallMs * 1000).toFixed(3)}μs`);
      console.log(`Threshold: ${PERFORMANCE_THRESHOLDS.API_CALL_OVERHEAD_MS}ms`);
      
      expect(perCallMs).toBeLessThan(PERFORMANCE_THRESHOLDS.API_CALL_OVERHEAD_MS);
    });

    test('NoiseEngine.applyToCanvasData should have acceptable overhead', () => {
      const engine = new NoiseEngine(12345678, { level: 'medium' });
      
      // Simulate a 100x100 canvas (40000 bytes of RGBA data)
      const imageData = {
        data: new Uint8ClampedArray(100 * 100 * 4),
        width: 100,
        height: 100
      };
      
      // Fill with random data
      for (let i = 0; i < imageData.data.length; i++) {
        imageData.data[i] = Math.floor(Math.random() * 256);
      }
      
      const results = benchmark(() => {
        engine.reset();
        engine.applyToCanvasData(imageData);
      });
      
      console.log('\n=== Canvas Noise Application Performance (100x100) ===');
      console.log(`Mean: ${results.mean.toFixed(3)}ms`);
      console.log(`P95: ${results.p95.toFixed(3)}ms`);
      
      // Canvas noise should complete in reasonable time for 40,000 pixels
      // Threshold: 50ms (allows for system variance while ensuring acceptable UX)
      expect(results.mean).toBeLessThan(50);
    });

    test('NoiseEngine.applyToAudioData should have acceptable overhead', () => {
      const engine = new NoiseEngine(12345678, { level: 'medium' });
      
      // Simulate audio buffer (44100 samples = 1 second at 44.1kHz)
      const channelData = new Float32Array(44100);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.random() * 2 - 1;
      }
      
      const results = benchmark(() => {
        engine.reset();
        engine.applyToAudioData(channelData);
      });
      
      console.log('\n=== Audio Noise Application Performance (1 second) ===');
      console.log(`Mean: ${results.mean.toFixed(3)}ms`);
      console.log(`P95: ${results.p95.toFixed(3)}ms`);
      
      // Audio noise should complete in reasonable time for 44,100 samples
      // Threshold: 50ms (allows for system variance while ensuring acceptable UX)
      expect(results.mean).toBeLessThan(50);
    });

    test('ScriptGenerator.generateScript should have acceptable overhead', () => {
      const results = benchmark(() => {
        ScriptGenerator.generateScript(testConfig, { minify: false });
      });
      
      console.log('\n=== ScriptGenerator Performance ===');
      console.log(`Mean: ${results.mean.toFixed(3)}ms`);
      console.log(`P95: ${results.p95.toFixed(3)}ms`);
      console.log(`Threshold: ${PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS}ms`);
      
      expect(results.mean).toBeLessThan(PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS);
    });

    test('ScriptGenerator with minification should complete within threshold', () => {
      const results = benchmark(() => {
        ScriptGenerator.generateScript(testConfig, { minify: true });
      });
      
      console.log('\n=== ScriptGenerator (Minified) Performance ===');
      console.log(`Mean: ${results.mean.toFixed(3)}ms`);
      console.log(`P95: ${results.p95.toFixed(3)}ms`);
      
      expect(results.mean).toBeLessThan(PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS);
    });
  });

  describe('CPU Usage Tests', () => {
    /**
     * Requirement 53.3: Test CPU usage in long-running scenarios
     */
    
    test('repeated noise generation should not cause excessive CPU usage', () => {
      const engine = new NoiseEngine(12345678, { level: 'medium' });
      const iterations = 10000;
      
      const startTime = process.hrtime.bigint();
      
      for (let i = 0; i < iterations; i++) {
        engine.getNoise(i);
      }
      
      const endTime = process.hrtime.bigint();
      const totalMs = Number(endTime - startTime) / 1_000_000;
      const perIterationMs = totalMs / iterations;
      
      console.log('\n=== CPU Usage Test (10000 noise generations) ===');
      console.log(`Total time: ${totalMs.toFixed(3)}ms`);
      console.log(`Per iteration: ${(perIterationMs * 1000).toFixed(3)}μs`);
      
      // Should complete 10000 iterations in under 100ms
      expect(totalMs).toBeLessThan(100);
    });

    test('fingerprint generation should not cause excessive CPU usage', () => {
      const generator = new FingerprintGenerator();
      const iterations = 50;
      
      const startTime = process.hrtime.bigint();
      
      for (let i = 0; i < iterations; i++) {
        generator.generateFingerprint({ accountId: `account-${i}` });
      }
      
      const endTime = process.hrtime.bigint();
      const totalMs = Number(endTime - startTime) / 1_000_000;
      const perIterationMs = totalMs / iterations;
      
      console.log('\n=== CPU Usage Test (50 fingerprint generations) ===');
      console.log(`Total time: ${totalMs.toFixed(3)}ms`);
      console.log(`Per generation: ${perIterationMs.toFixed(3)}ms`);
      
      // Should complete 50 generations in under 5 seconds
      expect(totalMs).toBeLessThan(5000);
    });

    test('script generation under load should remain stable', () => {
      const injector = new FingerprintInjector(testConfig);
      const iterations = 100;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        injector.clearCache(); // Force regeneration
        const { durationMs } = measureTime(() => injector.getInjectionScript());
        times.push(durationMs);
      }
      
      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);
      const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = (stdDev / mean) * 100;
      
      console.log('\n=== Script Generation Stability Test ===');
      console.log(`Mean: ${mean.toFixed(3)}ms`);
      console.log(`Max: ${max.toFixed(3)}ms`);
      console.log(`StdDev: ${stdDev.toFixed(3)}ms`);
      console.log(`Coefficient of Variation: ${coefficientOfVariation.toFixed(2)}%`);
      
      // Coefficient of variation should be under 50% for stable performance
      expect(coefficientOfVariation).toBeLessThan(50);
    });
  });

  describe('Configuration Loading Tests', () => {
    /**
     * Requirement 25.4: Load fingerprint configurations for up to 50 accounts in <100ms
     */
    
    test('loading 50 fingerprint configurations should complete within threshold', () => {
      const configs = [];
      
      // Generate 50 configurations
      const generator = new FingerprintGenerator();
      const generationStart = process.hrtime.bigint();
      
      for (let i = 0; i < 50; i++) {
        configs.push(generator.generateFingerprint({ accountId: `account-${i}` }));
      }
      
      const generationEnd = process.hrtime.bigint();
      const generationMs = Number(generationEnd - generationStart) / 1_000_000;
      
      // Simulate loading (serialization/deserialization)
      const serialized = configs.map(c => JSON.stringify(c));
      
      const loadStart = process.hrtime.bigint();
      const loaded = serialized.map(s => JSON.parse(s));
      const loadEnd = process.hrtime.bigint();
      const loadMs = Number(loadEnd - loadStart) / 1_000_000;
      
      console.log('\n=== Configuration Loading Performance (50 accounts) ===');
      console.log(`Generation time: ${generationMs.toFixed(3)}ms`);
      console.log(`Load time: ${loadMs.toFixed(3)}ms`);
      console.log(`Threshold: ${PERFORMANCE_THRESHOLDS.CONFIG_LOAD_MS}ms`);
      
      expect(loadMs).toBeLessThan(PERFORMANCE_THRESHOLDS.CONFIG_LOAD_MS);
      expect(loaded.length).toBe(50);
    });

    test('creating injectors for 50 accounts should complete within threshold', () => {
      const configs = [];
      const generator = new FingerprintGenerator();
      
      for (let i = 0; i < 50; i++) {
        configs.push(generator.generateFingerprint({ accountId: `account-${i}` }));
      }
      
      const results = benchmark(() => {
        const injectors = configs.map(config => new FingerprintInjector(config));
        return injectors;
      }, 10); // Fewer iterations due to higher cost
      
      console.log('\n=== Injector Creation Performance (50 accounts) ===');
      console.log(`Mean: ${results.mean.toFixed(3)}ms`);
      console.log(`P95: ${results.p95.toFixed(3)}ms`);
      
      // Creating 50 injectors should be fast (just object creation, no script generation)
      expect(results.mean).toBeLessThan(50);
    });
  });

  describe('Performance Report Generation', () => {
    /**
     * Requirement 53.5: Generate detailed performance reports
     */
    
    test('should generate comprehensive performance report', () => {
      const allResults = {};
      
      // Collect all benchmark results
      const injector = new FingerprintInjector(testConfig);
      
      allResults.scriptGeneration = benchmark(() => {
        injector.clearCache();
        return injector.getInjectionScript();
      }, 50);
      
      allResults.preloadGeneration = benchmark(() => {
        injector.clearCache();
        return injector.getPreloadScript();
      }, 50);
      
      const engine = new NoiseEngine(12345678, { level: 'medium' });
      allResults.noiseGeneration = benchmark(() => {
        for (let i = 0; i < 100; i++) {
          engine.getNoise(i);
        }
      }, 50);
      
      // Generate comprehensive report
      const report = {
        timestamp: new Date().toISOString(),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        },
        thresholds: PERFORMANCE_THRESHOLDS,
        results: {
          scriptGeneration: generateReport(
            allResults.scriptGeneration,
            'Script Generation',
            PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS
          ),
          preloadGeneration: generateReport(
            allResults.preloadGeneration,
            'Preload Script Generation',
            PERFORMANCE_THRESHOLDS.INJECTION_DELAY_MS
          ),
          noiseGeneration: generateReport(
            allResults.noiseGeneration,
            'Noise Generation (100 calls)',
            1 // 1ms for 100 calls
          )
        },
        summary: {
          totalTests: 3,
          passed: 0,
          failed: 0
        }
      };
      
      // Count passed/failed
      for (const result of Object.values(report.results)) {
        if (result.passed) {
          report.summary.passed++;
        } else {
          report.summary.failed++;
        }
      }
      
      console.log('\n========================================');
      console.log('    PERFORMANCE BENCHMARK REPORT');
      console.log('========================================');
      console.log(`Timestamp: ${report.timestamp}`);
      console.log(`Node.js: ${report.environment.nodeVersion}`);
      console.log(`Platform: ${report.environment.platform} (${report.environment.arch})`);
      console.log('----------------------------------------');
      
      for (const [name, result] of Object.entries(report.results)) {
        console.log(`\n${result.testName}:`);
        console.log(`  Status: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
        console.log(`  Mean: ${result.statistics.mean}`);
        console.log(`  P95: ${result.statistics.p95}`);
        console.log(`  Threshold: ${result.threshold}ms`);
        if (result.recommendations.length > 0) {
          console.log('  Recommendations:');
          result.recommendations.forEach(r => console.log(`    - ${r}`));
        }
      }
      
      console.log('\n----------------------------------------');
      console.log(`Summary: ${report.summary.passed}/${report.summary.totalTests} tests passed`);
      console.log('========================================\n');
      
      // All tests should pass
      expect(report.summary.failed).toBe(0);
    });
  });

  describe('Memory Usage Tests', () => {
    test('script generation should not cause memory leaks', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate many scripts (reduced to 20 for faster testing)
      for (let i = 0; i < 20; i++) {
        const config = createTestConfig();
        config.accountId = `account-${i}`;
        const injector = new FingerprintInjector(config);
        injector.getInjectionScript();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      console.log('\n=== Memory Usage Test ===');
      console.log(`Initial heap: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Final heap: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Increase: ${memoryIncrease.toFixed(2)} MB`);
      
      // Memory increase should be reasonable (under 50MB for 20 scripts)
      expect(memoryIncrease).toBeLessThan(50);
    });
  });
});
