'use strict';

/**
 * Property-based tests for WorkerInterceptor
 * 
 * Tests the following property:
 * - Property 16: Worker环境指纹一致性 (Worker Environment Fingerprint Consistency)
 * 
 * **Feature: professional-fingerprint-refactoring, Property 16: Worker环境指纹一致性**
 * **Validates: Requirements 30.5**
 */

const fc = require('fast-check');
const { WorkerInterceptor, WorkerInterceptorError } = require('../../src/infrastructure/fingerprint/injection-scripts/core/worker-interceptor');

// ==================== Arbitraries ====================

/**
 * Valid user agent arbitrary
 */
const userAgentArbitrary = fc.oneof(
  fc.constant('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
  fc.constant('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
  fc.constant('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
  fc.constant('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0')
);

/**
 * Valid platform arbitrary
 */
const platformArbitrary = fc.oneof(
  fc.constant('Win32'),
  fc.constant('MacIntel'),
  fc.constant('Linux x86_64')
);

/**
 * Valid language arbitrary
 */
const languageArbitrary = fc.oneof(
  fc.constant('en-US'),
  fc.constant('en-GB'),
  fc.constant('zh-CN'),
  fc.constant('ja-JP'),
  fc.constant('de-DE'),
  fc.constant('fr-FR')
);

/**
 * Valid languages array arbitrary
 */
const languagesArbitrary = fc.array(languageArbitrary, { minLength: 1, maxLength: 5 })
  .map(langs => [...new Set(langs)]); // Remove duplicates

/**
 * Valid CPU cores arbitrary (realistic values)
 */
const cpuCoresArbitrary = fc.integer({ min: 2, max: 32 });

/**
 * Valid device memory arbitrary (realistic values in GB)
 */
const deviceMemoryArbitrary = fc.oneof(
  fc.constant(0.25),
  fc.constant(0.5),
  fc.constant(1),
  fc.constant(2),
  fc.constant(4),
  fc.constant(8),
  fc.constant(16),
  fc.constant(32)
);

/**
 * Valid fingerprint configuration arbitrary
 */
const fingerprintConfigArbitrary = fc.record({
  userAgent: userAgentArbitrary,
  os: fc.record({
    type: fc.oneof(fc.constant('windows'), fc.constant('macos'), fc.constant('linux')),
    platform: platformArbitrary
  }),
  navigator: fc.record({
    language: languageArbitrary,
    languages: languagesArbitrary
  }),
  hardware: fc.record({
    cpuCores: cpuCoresArbitrary,
    deviceMemory: deviceMemoryArbitrary
  })
});

/**
 * Valid worker type arbitrary
 */
const workerTypeArbitrary = fc.oneof(
  fc.constant('worker'),
  fc.constant('sharedworker'),
  fc.constant('serviceworker')
);

/**
 * Valid script URL arbitrary
 */
const scriptURLArbitrary = fc.oneof(
  fc.constant('worker.js'),
  fc.constant('/scripts/worker.js'),
  fc.constant('./workers/my-worker.js'),
  fc.constant('https://example.com/worker.js')
);

// ==================== Mock Scope ====================

/**
 * Create a mock scope object that simulates browser globals
 */
function createMockScope() {
  // Mock Worker constructor
  const MockWorker = function(scriptURL, options) {
    this.scriptURL = scriptURL;
    this.options = options;
    this.onmessage = null;
    this.onerror = null;
  };
  MockWorker.prototype.postMessage = function() {};
  MockWorker.prototype.terminate = function() {};
  Object.defineProperty(MockWorker, 'name', { value: 'Worker' });
  Object.defineProperty(MockWorker, 'length', { value: 1 });

  // Mock SharedWorker constructor
  const MockSharedWorker = function(scriptURL, options) {
    this.scriptURL = scriptURL;
    this.options = options;
    this.port = { onmessage: null, postMessage: function() {} };
  };
  Object.defineProperty(MockSharedWorker, 'name', { value: 'SharedWorker' });
  Object.defineProperty(MockSharedWorker, 'length', { value: 1 });

  // Mock ServiceWorkerContainer
  const mockServiceWorker = {
    register: function(scriptURL, options) {
      return Promise.resolve({ scriptURL, options });
    }
  };
  Object.defineProperty(mockServiceWorker.register, 'name', { value: 'register' });
  Object.defineProperty(mockServiceWorker.register, 'length', { value: 1 });

  // Mock URL and Blob
  const mockURL = {
    createObjectURL: function(blob) {
      return 'blob:mock-' + Math.random().toString(36).substr(2, 9);
    },
    revokeObjectURL: function() {}
  };

  const MockBlob = function(parts, options) {
    this.parts = parts;
    this.type = options?.type || '';
    this.size = parts.reduce((acc, part) => acc + (part.length || 0), 0);
  };

  return {
    Worker: MockWorker,
    SharedWorker: MockSharedWorker,
    navigator: {
      serviceWorker: mockServiceWorker
    },
    location: {
      origin: 'https://example.com',
      href: 'https://example.com/page.html'
    },
    URL: mockURL,
    Blob: MockBlob
  };
}

// ==================== Property Tests ====================

describe('WorkerInterceptor Property Tests', () => {
  
  // Reset interceptor state before each test using the provided reset method
  beforeEach(() => {
    // Create a mock scope and reset using the static reset method
    const mockScope = createMockScope();
    WorkerInterceptor.reset(mockScope);
  });

  /**
   * **Feature: professional-fingerprint-refactoring, Property 16: Worker环境指纹一致性**
   * **Validates: Requirements 30.5**
   * 
   * For any fingerprint detection executed in a Worker, it should return
   * the same spoofed values as the main thread.
   */
  describe('Property 16: Worker Environment Fingerprint Consistency', () => {
    
    test('generated worker script contains correct fingerprint config', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          workerTypeArbitrary,
          scriptURLArbitrary,
          async (config, workerType, scriptURL) => {
            const mockScope = createMockScope();
            const interceptor = new WorkerInterceptor(config, { scope: mockScope });
            
            // Generate the injected worker script
            const injectedScript = interceptor.createInjectedWorkerScript(scriptURL, workerType);
            
            // Verify the script contains the fingerprint configuration (using '__fingerprintConfig__' variable)
            expect(injectedScript).toContain('__fingerprintConfig__');
            expect(injectedScript).toContain(JSON.stringify(config.userAgent));
            
            // Verify navigator spoofing is included
            expect(injectedScript).toContain('navigator');
            expect(injectedScript).toContain(config.navigator.language);
            
            // Verify hardware config is included
            expect(injectedScript).toContain(String(config.hardware.cpuCores));
            expect(injectedScript).toContain(String(config.hardware.deviceMemory));
          }
        ),
        { numRuns: 100 }
      );
    });

    test('generated worker script includes import statement', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          scriptURLArbitrary,
          async (config, scriptURL) => {
            const mockScope = createMockScope();
            const interceptor = new WorkerInterceptor(config, { scope: mockScope });
            
            // Generate the injected worker script
            const injectedScript = interceptor.createInjectedWorkerScript(scriptURL, 'worker');
            
            // Verify the script includes importScripts for the original script
            expect(injectedScript).toContain('importScripts');
            expect(injectedScript).toContain(scriptURL);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('generated worker script contains navigator spoofing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          workerTypeArbitrary,
          scriptURLArbitrary,
          async (config, workerType, scriptURL) => {
            const mockScope = createMockScope();
            const interceptor = new WorkerInterceptor(config, { scope: mockScope });
            
            // Generate the injected worker script
            const injectedScript = interceptor.createInjectedWorkerScript(scriptURL, workerType);
            
            // Verify navigator spoofing code is present
            expect(injectedScript).toContain('navigator');
            expect(injectedScript).toContain('Object.defineProperty');
            expect(injectedScript).toContain('userAgent');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('worker interception sets correct function name', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          async (config) => {
            // Reset state first
            const mockScope = createMockScope();
            WorkerInterceptor.reset(mockScope);
            
            const interceptor = new WorkerInterceptor(config, { scope: mockScope });
            
            // Initialize interception
            interceptor.initialize();
            
            // Verify Worker constructor has correct name
            expect(mockScope.Worker.name).toBe('Worker');
            
            // Verify SharedWorker constructor has correct name
            expect(mockScope.SharedWorker.name).toBe('SharedWorker');
          }
        ),
        { numRuns: 100 }
      );
    });


    test('standalone injection script contains all required spoofing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          async (config) => {
            // Generate standalone injection script
            const standaloneScript = WorkerInterceptor.createStandaloneInjectionScript(config);
            
            // Verify it contains fingerprint config (using '__fingerprintConfig__' variable)
            expect(standaloneScript).toContain('__fingerprintConfig__');
            
            // Verify navigator spoofing
            expect(standaloneScript).toContain('navigator');
            expect(standaloneScript).toContain('userAgent');
            expect(standaloneScript).toContain('language');
            expect(standaloneScript).toContain('hardwareConcurrency');
            expect(standaloneScript).toContain('deviceMemory');
            expect(standaloneScript).toContain('platform');
            
            // Verify config values are present
            expect(standaloneScript).toContain(JSON.stringify(config.userAgent));
            expect(standaloneScript).toContain(JSON.stringify(config.navigator.language));
          }
        ),
        { numRuns: 100 }
      );
    });

    test('config values in generated script match input config', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          async (config) => {
            const mockScope = createMockScope();
            const interceptor = new WorkerInterceptor(config, { scope: mockScope });
            
            // Generate the injected worker script
            const injectedScript = interceptor.createInjectedWorkerScript('test.js', 'worker');
            
            // Parse the config from the generated script (using '__fingerprintConfig__' variable)
            const configMatch = injectedScript.match(/const __fingerprintConfig__ = ({[\s\S]*?});/);
            expect(configMatch).not.toBeNull();
            
            if (configMatch) {
              const parsedConfig = JSON.parse(configMatch[1]);
              
              // Verify key values match
              expect(parsedConfig.userAgent).toBe(config.userAgent);
              expect(parsedConfig.navigator.language).toBe(config.navigator.language);
              expect(parsedConfig.hardware.cpuCores).toBe(config.hardware.cpuCores);
              expect(parsedConfig.hardware.deviceMemory).toBe(config.hardware.deviceMemory);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('interceptor stores and retrieves config correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          async (config) => {
            const mockScope = createMockScope();
            const interceptor = new WorkerInterceptor(config, { scope: mockScope });
            
            // Verify config is stored correctly
            const retrievedConfig = interceptor.getConfig();
            expect(retrievedConfig).toEqual(config);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('interceptor config update merges correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          fingerprintConfigArbitrary,
          async (config1, config2) => {
            const mockScope = createMockScope();
            const interceptor = new WorkerInterceptor(config1, { scope: mockScope });
            
            // Update with new config
            interceptor.updateConfig(config2);
            
            // Verify config was merged
            const retrievedConfig = interceptor.getConfig();
            expect(retrievedConfig.userAgent).toBe(config2.userAgent);
            expect(retrievedConfig.navigator).toEqual(config2.navigator);
            expect(retrievedConfig.hardware).toEqual(config2.hardware);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('verify method correctly identifies intercepted state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          async (config) => {
            // Reset state first
            const mockScope = createMockScope();
            WorkerInterceptor.reset(mockScope);
            
            const interceptor = new WorkerInterceptor(config, { scope: mockScope });
            
            // Before initialization
            const beforeVerify = WorkerInterceptor.verify(mockScope);
            expect(beforeVerify.checks.initialized).toBe(false);
            
            // Initialize
            interceptor.initialize();
            
            // After initialization
            const afterVerify = WorkerInterceptor.verify(mockScope);
            expect(afterVerify.checks.initialized).toBe(true);
            expect(afterVerify.checks.worker.intercepted).toBe(true);
            expect(afterVerify.checks.sharedWorker.intercepted).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('reset restores original constructors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          async (config) => {
            const mockScope = createMockScope();
            const originalWorker = mockScope.Worker;
            const originalSharedWorker = mockScope.SharedWorker;
            
            const interceptor = new WorkerInterceptor(config, { scope: mockScope });
            interceptor.initialize();
            
            // Verify interception is active
            expect(WorkerInterceptor.isInitialized()).toBe(true);
            
            // Reset
            WorkerInterceptor.reset(mockScope);
            
            // Verify reset
            expect(WorkerInterceptor.isInitialized()).toBe(false);
            expect(mockScope.Worker).toBe(originalWorker);
            expect(mockScope.SharedWorker).toBe(originalSharedWorker);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Error Handling', () => {
    test('constructor throws error for invalid config', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer(),
            fc.boolean()
          ),
          async (invalidConfig) => {
            expect(() => {
              new WorkerInterceptor(invalidConfig);
            }).toThrow(WorkerInterceptorError);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('setInjectionScript throws error for non-string', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.integer(),
            fc.boolean(),
            fc.array(fc.string())
          ),
          async (config, invalidScript) => {
            const mockScope = createMockScope();
            const interceptor = new WorkerInterceptor(config, { scope: mockScope });
            
            expect(() => {
              interceptor.setInjectionScript(invalidScript);
            }).toThrow(WorkerInterceptorError);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('updateConfig throws error for invalid config', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer()
          ),
          async (validConfig, invalidUpdate) => {
            const mockScope = createMockScope();
            const interceptor = new WorkerInterceptor(validConfig, { scope: mockScope });
            
            expect(() => {
              interceptor.updateConfig(invalidUpdate);
            }).toThrow(WorkerInterceptorError);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Custom Injection Script', () => {
    test('setInjectionScript accepts valid string', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0 && !s.includes('\n')),
          async (config, customScript) => {
            const mockScope = createMockScope();
            const interceptor = new WorkerInterceptor(config, { scope: mockScope });
            
            // Set custom injection script should not throw
            expect(() => interceptor.setInjectionScript(customScript)).not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Same-Origin Check', () => {
    test('_isSameOrigin returns false when no location origin', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          async (config) => {
            // Create scope without location
            const mockScope = createMockScope();
            delete mockScope.location;
            
            const interceptor = new WorkerInterceptor(config, { scope: mockScope });
            
            // Should return false when no origin
            const isSameOrigin = interceptor._isSameOrigin('https://example.com/worker.js');
            expect(isSameOrigin).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('_isSameOrigin handles invalid URLs gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fingerprintConfigArbitrary,
          async (config) => {
            const mockScope = createMockScope();
            const interceptor = new WorkerInterceptor(config, { scope: mockScope });
            
            // Invalid URL should return false without throwing
            const isSameOrigin = interceptor._isSameOrigin('not-a-valid-url:::');
            expect(isSameOrigin).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
