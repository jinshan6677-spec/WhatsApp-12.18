/**
 * Fingerprint System Integration Examples
 * 指纹系统集成示例
 * 
 * This file provides comprehensive examples demonstrating how to integrate
 * and use the professional fingerprint system in your application.
 * 
 * @module examples/fingerprint-integration-example
 * 
 * Requirements: 31.3 - Provide runnable code examples for common use cases
 * 
 * Table of Contents:
 * 1. Basic Fingerprint Generation
 * 2. Fingerprint Configuration Management
 * 3. Template Management
 * 4. Fingerprint Validation
 * 5. Fingerprint Injection
 * 6. Seed Management
 * 7. Testing and Verification
 * 8. Complete Integration Example
 * 9. Noise Engine
 * 10. IPC Integration
 * 11. ViewFactory Integration
 * 12. Error Handling
 * 13. Database Usage
 */

'use strict';

// ==================== Imports ====================

// Domain layer
const {
  FingerprintConfig,
  FingerprintTemplate,
  NoiseEngine,
  FingerprintDatabase,
  BrowserType,
  OSType,
  NoiseLevel,
  NoiseDistribution
} = require('../domain/fingerprint');

// Application services
const {
  FingerprintService,
  FingerprintGenerator,
  FingerprintValidator,
  TemplateManager,
  FingerprintTestRunner
} = require('../application/services/fingerprint');

// Infrastructure
const {
  FingerprintInjector,
  FingerprintRepository,
  SeedManager
} = require('../infrastructure/fingerprint');

// ==================== Example 1: Basic Fingerprint Generation ====================

/**
 * Example 1: Generate a complete fingerprint configuration
 * 
 * This example shows how to generate a new fingerprint with one click,
 * which creates a complete, internally consistent configuration.
 */
async function example1_BasicGeneration() {
  console.log('\n=== Example 1: Basic Fingerprint Generation ===\n');
  
  // Create a fingerprint generator
  const generator = new FingerprintGenerator();
  
  // Generate a complete fingerprint for a new account
  const fingerprint = generator.generateFingerprint({
    accountId: 'account-001',
    os: OSType.Windows,
    browser: BrowserType.Chrome
  });
  
  console.log('Generated fingerprint:');
  console.log(`  ID: ${fingerprint.id}`);
  console.log(`  Account: ${fingerprint.accountId}`);
  console.log(`  Browser: ${fingerprint.browser.type} ${fingerprint.browser.version}`);
  console.log(`  OS: ${fingerprint.os.type} (${fingerprint.os.platform})`);
  console.log(`  User-Agent: ${fingerprint.userAgent.substring(0, 60)}...`);
  console.log(`  Screen: ${fingerprint.hardware.screen.width}x${fingerprint.hardware.screen.height}`);
  console.log(`  CPU Cores: ${fingerprint.hardware.cpuCores}`);
  console.log(`  Device Memory: ${fingerprint.hardware.deviceMemory}GB`);
  
  // Generate for different OS/browser combinations
  const macFingerprint = generator.generateFingerprint({
    accountId: 'account-002',
    os: OSType.MacOS,
    browser: BrowserType.Safari
  });
  
  console.log('\nGenerated macOS Safari fingerprint:');
  console.log(`  Platform: ${macFingerprint.os.platform}`);
  console.log(`  WebGL Vendor: ${macFingerprint.webgl.vendor}`);
  
  return fingerprint;
}

// ==================== Example 2: Configuration Management ====================

/**
 * Example 2: Manage fingerprint configurations
 * 
 * This example shows how to create, update, validate, and serialize
 * fingerprint configurations.
 */
async function example2_ConfigurationManagement() {
  console.log('\n=== Example 2: Configuration Management ===\n');
  
  // Create a fingerprint configuration manually
  const config = new FingerprintConfig({
    accountId: 'account-003',
    browser: {
      type: BrowserType.Chrome,
      version: '120.0.0.0',
      majorVersion: 120
    },
    os: {
      type: OSType.Windows,
      version: '10.0',
      platform: 'Win32'
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
    hardware: {
      cpuCores: 8,
      deviceMemory: 16,
      screen: {
        width: 1920,
        height: 1080,
        colorDepth: 24
      }
    },
    canvas: {
      mode: 'noise',
      noiseLevel: NoiseLevel.Medium
    },
    webrtc: {
      mode: 'replace',
      publicIP: 'auto'
    }
  });
  
  // Validate the configuration
  const validation = config.validate();
  console.log(`Configuration valid: ${validation.valid}`);
  if (!validation.valid) {
    console.log('Validation errors:', validation.errors);
  }
  
  // Update the configuration
  config.update({
    hardware: {
      cpuCores: 12,
      deviceMemory: 32
    },
    timezone: {
      mode: 'custom',
      name: 'Europe/London',
      offset: 0
    }
  });
  
  console.log(`Updated CPU cores: ${config.hardware.cpuCores}`);
  console.log(`Updated timezone: ${config.timezone.name}`);
  
  // Serialize to JSON
  const json = config.toJSON();
  console.log('\nSerialized config (partial):');
  console.log(JSON.stringify({
    id: json.id,
    browser: json.browser,
    os: json.os
  }, null, 2));
  
  // Deserialize from JSON
  const restored = FingerprintConfig.fromJSON(json);
  console.log(`\nRestored config ID: ${restored.id}`);
  console.log(`Configs equal: ${config.equals(restored)}`);
  
  return config;
}

// ==================== Example 3: Template Management ====================

/**
 * Example 3: Create and use fingerprint templates
 * 
 * This example shows how to create reusable templates that can be
 * applied to multiple accounts.
 */
async function example3_TemplateManagement() {
  console.log('\n=== Example 3: Template Management ===\n');
  
  // Create a template manager
  const templateManager = new TemplateManager();
  
  // Create a base configuration
  const generator = new FingerprintGenerator();
  const baseConfig = generator.generateFingerprint({
    os: OSType.Windows,
    browser: BrowserType.Chrome
  });
  
  // Create a template from the configuration
  const template = templateManager.createTemplate({
    name: 'Windows Chrome Standard',
    description: 'Standard Windows Chrome profile for general use',
    config: baseConfig,
    tags: ['windows', 'chrome', 'standard']
  });
  
  console.log('Created template:');
  console.log(`  ID: ${template.id}`);
  console.log(`  Name: ${template.name}`);
  console.log(`  Description: ${template.description}`);
  
  // Apply template to multiple accounts
  const account1Config = templateManager.applyTemplate(template.id, 'account-101');
  const account2Config = templateManager.applyTemplate(template.id, 'account-102');
  
  console.log('\nApplied template to accounts:');
  console.log(`  Account 101 config ID: ${account1Config.id}`);
  console.log(`  Account 102 config ID: ${account2Config.id}`);
  console.log(`  Same browser: ${account1Config.browser.type === account2Config.browser.type}`);
  console.log(`  Different IDs: ${account1Config.id !== account2Config.id}`);
  
  // Export template to JSON
  const exportedTemplate = templateManager.exportTemplate(template.id, {
    includeNoiseSeed: false // Don't include seed for security
  });
  
  console.log('\nExported template (without seed):');
  console.log(`  Has seed: ${!!exportedTemplate.config.noiseSeed?.value}`);
  
  // List all templates
  const templates = templateManager.listTemplates();
  console.log(`\nTotal templates: ${templates.length}`);
  
  return template;
}

// ==================== Example 4: Fingerprint Validation ====================

/**
 * Example 4: Validate fingerprint consistency
 * 
 * This example shows how to validate that a fingerprint configuration
 * is internally consistent and realistic.
 */
async function example4_Validation() {
  console.log('\n=== Example 4: Fingerprint Validation ===\n');
  
  const validator = new FingerprintValidator();
  
  // Create a valid configuration
  const validConfig = new FingerprintConfig({
    os: { type: OSType.Windows, platform: 'Win32' },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    browser: { type: BrowserType.Chrome },
    webgl: {
      mode: 'custom',
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) UHD Graphics)'
    },
    fonts: {
      mode: 'custom',
      list: ['Arial', 'Calibri', 'Segoe UI', 'Times New Roman']
    }
  });
  
  const validResult = validator.validate(validConfig);
  console.log('Valid configuration:');
  console.log(`  Valid: ${validResult.valid}`);
  console.log(`  Errors: ${validResult.errors.length}`);
  console.log(`  Warnings: ${validResult.warnings.length}`);
  
  // Create an inconsistent configuration
  const inconsistentConfig = new FingerprintConfig({
    os: { type: OSType.Windows, platform: 'MacIntel' }, // Wrong platform!
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0', // Wrong UA!
    browser: { type: BrowserType.Chrome },
    webgl: {
      mode: 'custom',
      vendor: 'Apple Inc.',
      renderer: 'Apple M1' // Apple GPU on Windows!
    }
  });
  
  const inconsistentResult = validator.validate(inconsistentConfig);
  console.log('\nInconsistent configuration:');
  console.log(`  Valid: ${inconsistentResult.valid}`);
  console.log(`  Errors: ${inconsistentResult.errors.length}`);
  
  if (inconsistentResult.errors.length > 0) {
    console.log('  Error details:');
    inconsistentResult.errors.forEach(err => {
      console.log(`    - ${err.field}: ${err.reason}`);
    });
  }
  
  // Get validation with suggestions
  const withSuggestions = validator.validateWithSuggestions(inconsistentConfig);
  console.log('\nSuggestions for fixing:');
  Object.entries(withSuggestions.suggestions).forEach(([field, suggestion]) => {
    console.log(`  ${field}: ${suggestion}`);
  });
  
  return validResult;
}

// ==================== Example 5: Fingerprint Injection ====================

/**
 * Example 5: Generate injection scripts
 * 
 * This example shows how to generate JavaScript injection scripts
 * that can be used to spoof browser fingerprints.
 */
async function example5_Injection() {
  console.log('\n=== Example 5: Fingerprint Injection ===\n');
  
  // Create a fingerprint configuration
  const generator = new FingerprintGenerator();
  const config = generator.generateFingerprint({
    os: OSType.Windows,
    browser: BrowserType.Chrome
  });
  
  // Create an injector
  const injector = new FingerprintInjector(config.toJSON(), {
    minify: false,
    includeWorkerInterceptor: true,
    includeIframeProtection: true
  });
  
  // Validate the injector configuration
  const validation = injector.validate();
  console.log('Injector validation:');
  console.log(`  Valid: ${validation.valid}`);
  console.log(`  Warnings: ${validation.warnings.length}`);
  
  // Generate main injection script
  const mainScript = injector.getInjectionScript();
  console.log(`\nMain injection script length: ${mainScript.length} characters`);
  console.log(`Generation time: ${injector.getGenerationTime()}ms`);
  
  // Generate preload script for Electron
  const preloadScript = injector.getPreloadScript();
  console.log(`Preload script length: ${preloadScript.length} characters`);
  
  // Generate iframe script
  const iframeScript = injector.getIframeScript({ sameOriginOnly: true });
  console.log(`Iframe script length: ${iframeScript.length} characters`);
  
  // Generate worker script
  const workerScript = injector.getWorkerScript({ workerType: 'worker' });
  console.log(`Worker script length: ${workerScript.length} characters`);
  
  // Show cache statistics
  const cacheStats = injector.getCacheStats();
  console.log(`\nCached scripts: ${cacheStats.cachedScripts}`);
  
  // Show available modules
  const modules = FingerprintInjector.getAvailableModules();
  console.log(`\nAvailable spoof modules: ${modules.length}`);
  console.log(`  Modules: ${modules.slice(0, 5).join(', ')}...`);
  
  return injector;
}

// ==================== Example 6: Seed Management ====================

/**
 * Example 6: Secure seed management
 * 
 * This example shows how to securely generate, encrypt, and manage
 * noise seeds for fingerprint spoofing.
 */
async function example6_SeedManagement() {
  console.log('\n=== Example 6: Seed Management ===\n');
  
  // Create a seed manager
  const seedManager = new SeedManager();
  
  // Generate a secure seed
  const seed = seedManager.generateSecureSeed();
  console.log(`Generated secure seed: ${seed}`);
  console.log(`Seed hash (for logging): ${seedManager.hashSeed(seed)}`);
  
  // Encrypt the seed with account binding
  const accountId = 'account-seed-001';
  const encrypted = seedManager.encryptSeed(seed, accountId);
  
  console.log('\nEncrypted seed data:');
  console.log(`  IV length: ${encrypted.iv.length} hex chars`);
  console.log(`  Auth tag length: ${encrypted.authTag.length} hex chars`);
  console.log(`  Data length: ${encrypted.data.length} hex chars`);
  console.log(`  Version: ${encrypted.version}`);
  
  // Decrypt the seed
  const decrypted = seedManager.decryptSeed(encrypted, accountId);
  console.log(`\nDecrypted seed: ${decrypted.seed}`);
  console.log(`Seeds match: ${seed === decrypted.seed}`);
  
  // Rotate the seed
  const rotationResult = seedManager.rotateSeed(accountId, seed, {
    reason: 'scheduled rotation'
  });
  
  console.log('\nSeed rotation:');
  console.log(`  New seed: ${rotationResult.newSeed}`);
  console.log(`  Previous seed hash: ${rotationResult.previousSeedHash}`);
  console.log(`  Rotated at: ${rotationResult.rotatedAt}`);
  console.log(`  Reason: ${rotationResult.reason}`);
  
  // Prepare for export (without seed)
  const exportData = seedManager.prepareForExport(encrypted, {
    includeSeed: false
  });
  
  console.log('\nExport data (without seed):');
  console.log(`  Included seed: ${exportData.includedSeed}`);
  
  return seedManager;
}

// ==================== Example 7: Testing and Verification ====================

/**
 * Example 7: Test fingerprint configurations
 * 
 * This example shows how to run tests to verify that a fingerprint
 * configuration is properly set up and will pass detection tests.
 */
async function example7_Testing() {
  console.log('\n=== Example 7: Testing and Verification ===\n');
  
  // Create a test runner
  const testRunner = new FingerprintTestRunner();
  
  // Generate a fingerprint to test
  const generator = new FingerprintGenerator();
  const config = generator.generateFingerprint({
    os: OSType.Windows,
    browser: BrowserType.Chrome
  });
  
  // Get a preview of the fingerprint
  const preview = testRunner.getPreview(config);
  console.log('Fingerprint preview:');
  console.log(`  Browser: ${preview.browser.type} ${preview.browser.version}`);
  console.log(`  OS: ${preview.os.type} (${preview.os.platform})`);
  console.log(`  Screen: ${preview.hardware.screen}`);
  console.log(`  Canvas mode: ${preview.canvas.mode}`);
  console.log(`  WebGL vendor: ${preview.webgl.vendor}`);
  
  // Run all tests
  const report = await testRunner.runAll(config);
  
  console.log('\nTest report:');
  console.log(`  Total tests: ${report.summary.total}`);
  console.log(`  Passed: ${report.summary.passed}`);
  console.log(`  Failed: ${report.summary.failed}`);
  console.log(`  Pass rate: ${report.summary.passRate}`);
  
  // Show results by category
  console.log('\nResults by category:');
  Object.entries(report.byCategory).forEach(([category, data]) => {
    console.log(`  ${category}: ${data.passed}/${data.total} passed`);
  });
  
  // Show any failed tests
  const failedTests = report.results.filter(r => !r.passed);
  if (failedTests.length > 0) {
    console.log('\nFailed tests:');
    failedTests.forEach(test => {
      console.log(`  - ${test.name}: ${test.details || test.error}`);
    });
  }
  
  // Register a custom test
  testRunner.registerTest(
    'Custom WebRTC Check',
    (cfg) => ({
      passed: cfg.webrtc?.mode !== 'real',
      expected: 'WebRTC mode should not be "real"',
      actual: cfg.webrtc?.mode,
      details: 'WebRTC in real mode may expose IP address'
    }),
    { category: 'webrtc', description: 'Checks WebRTC is protected' }
  );
  
  console.log('\nRegistered custom test');
  console.log(`Total tests now: ${testRunner.getTests().length}`);
  
  return report;
}

// ==================== Example 8: Complete Integration ====================

/**
 * Example 8: Complete integration with FingerprintService
 * 
 * This example shows how to use the FingerprintService facade
 * for a complete fingerprint management workflow.
 */
async function example8_CompleteIntegration() {
  console.log('\n=== Example 8: Complete Integration ===\n');
  
  // Create the fingerprint service (main facade)
  const fingerprintService = new FingerprintService();
  
  // Initialize the service
  await fingerprintService.initialize();
  console.log('Fingerprint service initialized');
  
  // Generate a fingerprint for a new account
  const accountId = 'account-integration-001';
  const fingerprint = fingerprintService.generateFingerprint({
    accountId,
    os: OSType.Windows,
    browser: BrowserType.Chrome
  });
  
  console.log(`\nGenerated fingerprint for account: ${accountId}`);
  console.log(`  Config ID: ${fingerprint.id}`);
  
  // Validate the fingerprint
  const validation = fingerprintService.validateFingerprint(fingerprint);
  console.log(`  Valid: ${validation.valid}`);
  
  // Cache the fingerprint
  fingerprintService.setFingerprint(accountId, fingerprint);
  
  // Retrieve the cached fingerprint
  const cached = fingerprintService.getFingerprint(accountId);
  console.log(`  Cached: ${cached !== null}`);
  
  // Update the fingerprint
  const updated = fingerprintService.updateFingerprint(accountId, {
    timezone: {
      mode: 'custom',
      name: 'Asia/Tokyo',
      offset: -540
    }
  });
  
  console.log(`  Updated timezone: ${updated.timezone.name}`);
  
  // Create a template from the fingerprint
  const template = fingerprintService.createTemplate({
    name: 'Integration Test Template',
    description: 'Template created during integration example',
    config: fingerprint,
    tags: ['test', 'integration']
  });
  
  console.log(`\nCreated template: ${template.name}`);
  
  // Apply template to another account
  const account2Id = 'account-integration-002';
  const account2Config = fingerprintService.applyTemplate(template.id, account2Id);
  console.log(`Applied template to account: ${account2Id}`);
  
  // Run tests on the fingerprint
  const testReport = await fingerprintService.runTests(fingerprint);
  console.log(`\nTest results: ${testReport.summary.passRate} pass rate`);
  
  // Get a preview
  const preview = fingerprintService.getPreview(fingerprint);
  console.log(`\nFingerprint preview:`);
  console.log(`  Browser: ${preview.browser.type}`);
  console.log(`  OS: ${preview.os.type}`);
  console.log(`  Canvas: ${preview.canvas.mode}`);
  
  // List all templates
  const templates = fingerprintService.listTemplates();
  console.log(`\nTotal templates: ${templates.length}`);
  
  // Get all cached fingerprints
  const allFingerprints = fingerprintService.getAllFingerprints();
  console.log(`Cached fingerprints: ${allFingerprints.size}`);
  
  // Clean up
  fingerprintService.removeFingerprint(accountId);
  fingerprintService.removeFingerprint(account2Id);
  fingerprintService.deleteTemplate(template.id);
  
  console.log('\nCleanup complete');
  
  return fingerprintService;
}

// ==================== Noise Engine Example ====================

/**
 * Example 9: Using the Noise Engine
 * 
 * This example shows how to use the NoiseEngine for deterministic
 * noise generation in Canvas and Audio fingerprinting.
 */
async function example9_NoiseEngine() {
  console.log('\n=== Example 9: Noise Engine ===\n');
  
  // Create a noise engine with a specific seed
  const seed = 12345;
  const noiseEngine = new NoiseEngine(seed, {
    level: NoiseLevel.Medium,
    distribution: NoiseDistribution.Uniform
  });
  
  console.log('Noise engine configuration:');
  console.log(`  Seed: ${noiseEngine.seed}`);
  console.log(`  Level: ${noiseEngine.level}`);
  console.log(`  Distribution: ${noiseEngine.distribution}`);
  
  // Generate some noise values
  console.log('\nNoise values (deterministic):');
  for (let i = 0; i < 5; i++) {
    const noise = noiseEngine.getNoise(i);
    console.log(`  Index ${i}: ${noise.toFixed(4)}`);
  }
  
  // Reset and regenerate - should be the same
  noiseEngine.reset();
  console.log('\nAfter reset (same values):');
  for (let i = 0; i < 5; i++) {
    const noise = noiseEngine.getNoise(i);
    console.log(`  Index ${i}: ${noise.toFixed(4)}`);
  }
  
  // Create a mock canvas image data
  const mockImageData = {
    data: new Uint8ClampedArray([
      255, 0, 0, 255,   // Red pixel
      0, 255, 0, 255,   // Green pixel
      0, 0, 255, 255,   // Blue pixel
      255, 255, 255, 255 // White pixel
    ]),
    width: 2,
    height: 2
  };
  
  console.log('\nOriginal pixel data:');
  console.log(`  Pixel 0 (R): ${mockImageData.data[0]}`);
  console.log(`  Pixel 1 (G): ${mockImageData.data[5]}`);
  
  // Apply noise to canvas data
  noiseEngine.reset();
  noiseEngine.applyToCanvasData(mockImageData);
  
  console.log('\nAfter noise application:');
  console.log(`  Pixel 0 (R): ${mockImageData.data[0]}`);
  console.log(`  Pixel 1 (G): ${mockImageData.data[5]}`);
  
  // Create engine with different settings
  const gaussianEngine = noiseEngine.withOptions({
    distribution: NoiseDistribution.Gaussian
  });
  
  console.log(`\nGaussian engine distribution: ${gaussianEngine.distribution}`);
  
  // Serialize and restore
  const json = noiseEngine.toJSON();
  const restored = NoiseEngine.fromJSON(json);
  console.log(`\nRestored engine seed: ${restored.seed}`);
  console.log(`Engines equal: ${noiseEngine.equals(restored)}`);
  
  return noiseEngine;
}

// ==================== Run All Examples ====================

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Fingerprint System Integration Examples                ║');
  console.log('║     指纹系统集成示例                                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    await example1_BasicGeneration();
    await example2_ConfigurationManagement();
    await example3_TemplateManagement();
    await example4_Validation();
    await example5_Injection();
    await example6_SeedManagement();
    await example7_Testing();
    await example8_CompleteIntegration();
    await example9_NoiseEngine();
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     All examples completed successfully!                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('\nExample failed with error:', error.message);
    console.error(error.stack);
  }
}

// ==================== Example 10: IPC Integration ====================

/**
 * Example 10: IPC Integration for Renderer Process
 * 
 * This example shows how to use the fingerprint system via IPC
 * from the renderer process.
 */
async function example10_IPCIntegration() {
  console.log('\n=== Example 10: IPC Integration ===\n');
  
  // Note: This example shows the IPC channel names and expected payloads
  // In actual use, these would be called via ipcRenderer.invoke()
  
  console.log('Available IPC channels for fingerprint operations:');
  
  // Generate fingerprint
  console.log('\n1. Generate fingerprint:');
  console.log('   Channel: fingerprint:generate');
  console.log('   Payload: { accountId: "account-001", os: "windows", browser: "chrome" }');
  console.log('   Returns: FingerprintConfig object');
  
  // Save fingerprint
  console.log('\n2. Save fingerprint:');
  console.log('   Channel: fingerprint:save');
  console.log('   Payload: { accountId: "account-001", config: {...} }');
  console.log('   Returns: { success: true }');
  
  // Get fingerprint
  console.log('\n3. Get fingerprint:');
  console.log('   Channel: fingerprint:get');
  console.log('   Payload: { accountId: "account-001" }');
  console.log('   Returns: FingerprintConfig object or null');
  
  // Validate fingerprint
  console.log('\n4. Validate fingerprint:');
  console.log('   Channel: fingerprint:validate');
  console.log('   Payload: { config: {...} }');
  console.log('   Returns: { valid: true, errors: [], warnings: [] }');
  
  // Apply fingerprint
  console.log('\n5. Apply fingerprint:');
  console.log('   Channel: fingerprint:apply');
  console.log('   Payload: { accountId: "account-001" }');
  console.log('   Returns: { success: true }');
  
  // Template operations
  console.log('\n6. Template operations:');
  console.log('   Channel: fingerprint:template:create');
  console.log('   Channel: fingerprint:template:apply');
  console.log('   Channel: fingerprint:template:export');
  console.log('   Channel: fingerprint:template:import');
  console.log('   Channel: fingerprint:template:delete');
  console.log('   Channel: fingerprint:template:list');
  
  // Test operations
  console.log('\n7. Test operations:');
  console.log('   Channel: fingerprint:test:run');
  console.log('   Channel: fingerprint:test:preview');
  
  // Example renderer code (pseudo-code)
  console.log('\n--- Example Renderer Code ---');
  console.log(`
// In renderer process (preload exposes these via contextBridge)
const { fingerprint } = window.electronAPI;

// Generate a new fingerprint
const config = await fingerprint.generate({
  accountId: 'account-001',
  os: 'windows',
  browser: 'chrome'
});

// Save the fingerprint
await fingerprint.save('account-001', config);

// Validate before applying
const validation = await fingerprint.validate(config);
if (validation.valid) {
  await fingerprint.apply('account-001');
}

// Create a template
const template = await fingerprint.createTemplate({
  name: 'My Template',
  config: config
});

// Run tests
const report = await fingerprint.runTests(config);
console.log('Pass rate:', report.summary.passRate);
`);
  
  return true;
}

// ==================== Example 11: ViewFactory Integration ====================

/**
 * Example 11: ViewFactory Integration
 * 
 * This example shows how fingerprints are applied to BrowserViews
 * through the ViewFactory.
 */
async function example11_ViewFactoryIntegration() {
  console.log('\n=== Example 11: ViewFactory Integration ===\n');
  
  console.log('ViewFactory fingerprint injection flow:');
  console.log('');
  console.log('1. ViewFactory.createView(accountId) is called');
  console.log('2. ViewFactory loads fingerprint config for the account');
  console.log('3. FingerprintInjector generates injection script');
  console.log('4. Script is injected via webContents.executeJavaScript()');
  console.log('5. All subsequent page loads use the spoofed fingerprint');
  console.log('');
  
  // Show the integration code pattern
  console.log('--- Integration Code Pattern ---');
  console.log(`
// In ViewFactory.js
const { FingerprintInjector } = require('../infrastructure/fingerprint');
const { FingerprintService } = require('../application/services/fingerprint');

class ViewFactory {
  constructor() {
    this.fingerprintService = new FingerprintService();
  }
  
  async createView(accountId, options = {}) {
    // Create BrowserView
    const view = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    
    // Get fingerprint config for account
    const fingerprintConfig = this.fingerprintService.getFingerprint(accountId);
    
    if (fingerprintConfig) {
      // Create injector
      const injector = new FingerprintInjector(fingerprintConfig.toJSON(), {
        includeWorkerInterceptor: true,
        includeIframeProtection: true
      });
      
      // Get injection script
      const script = injector.getInjectionScript();
      
      // Inject on page load
      view.webContents.on('dom-ready', () => {
        view.webContents.executeJavaScript(script);
      });
      
      // Also inject via preload for earliest execution
      const preloadScript = injector.getPreloadScript();
      // preloadScript is used in preload.js
    }
    
    return view;
  }
}
`);
  
  console.log('\n--- Preload Script Integration ---');
  console.log(`
// In preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Get fingerprint injection script from main process
const injectionScript = await ipcRenderer.invoke('fingerprint:get-injection-script');

// Execute before page scripts
if (injectionScript) {
  const script = document.createElement('script');
  script.textContent = injectionScript;
  document.documentElement.prepend(script);
}

// Expose fingerprint API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  fingerprint: {
    generate: (options) => ipcRenderer.invoke('fingerprint:generate', options),
    save: (accountId, config) => ipcRenderer.invoke('fingerprint:save', { accountId, config }),
    get: (accountId) => ipcRenderer.invoke('fingerprint:get', { accountId }),
    validate: (config) => ipcRenderer.invoke('fingerprint:validate', { config }),
    apply: (accountId) => ipcRenderer.invoke('fingerprint:apply', { accountId })
  }
});
`);
  
  return true;
}

// ==================== Example 12: Error Handling ====================

/**
 * Example 12: Error Handling
 * 
 * This example shows how to handle errors in the fingerprint system.
 */
async function example12_ErrorHandling() {
  console.log('\n=== Example 12: Error Handling ===\n');
  
  const generator = new FingerprintGenerator();
  const validator = new FingerprintValidator();
  
  // Example 1: Handle validation errors
  console.log('1. Handling validation errors:');
  try {
    const invalidConfig = new FingerprintConfig({
      os: { type: 'invalid_os', platform: 'Unknown' },
      browser: { type: 'invalid_browser' },
      hardware: { cpuCores: -1, deviceMemory: 0 }
    });
    
    const validation = validator.validate(invalidConfig);
    if (!validation.valid) {
      console.log('   Validation failed with errors:');
      validation.errors.forEach(err => {
        console.log(`   - ${err.field}: ${err.reason}`);
      });
    }
  } catch (error) {
    console.log(`   Caught error: ${error.message}`);
  }
  
  // Example 2: Handle generation errors
  console.log('\n2. Handling generation errors:');
  try {
    // This should work, but we show the error handling pattern
    const config = generator.generateFingerprint({
      accountId: 'test-account',
      os: OSType.Windows,
      browser: BrowserType.Chrome
    });
    console.log('   Generation successful');
  } catch (error) {
    console.log(`   Generation failed: ${error.message}`);
    // Fallback to default config
    console.log('   Using default configuration as fallback');
  }
  
  // Example 3: Handle injection errors
  console.log('\n3. Handling injection errors:');
  try {
    const config = generator.generateFingerprint({
      accountId: 'test-account'
    });
    
    const injector = new FingerprintInjector(config.toJSON());
    const validation = injector.validate();
    
    if (!validation.valid) {
      console.log('   Injector validation failed:');
      validation.errors.forEach(err => {
        console.log(`   - ${err}`);
      });
    } else {
      console.log('   Injector validation passed');
    }
  } catch (error) {
    console.log(`   Injection setup failed: ${error.message}`);
  }
  
  // Example 4: Handle seed errors
  console.log('\n4. Handling seed errors:');
  const seedManager = new SeedManager();
  try {
    // Try to decrypt with wrong account ID
    const seed = seedManager.generateSecureSeed();
    const encrypted = seedManager.encryptSeed(seed, 'account-001');
    
    try {
      // This should fail - wrong account ID
      seedManager.decryptSeed(encrypted, 'wrong-account');
      console.log('   Decryption succeeded (unexpected)');
    } catch (decryptError) {
      console.log(`   Decryption failed as expected: ${decryptError.message}`);
    }
  } catch (error) {
    console.log(`   Seed operation failed: ${error.message}`);
  }
  
  // Example 5: Graceful degradation pattern
  console.log('\n5. Graceful degradation pattern:');
  console.log(`
async function applyFingerprintSafely(accountId, view) {
  try {
    const config = fingerprintService.getFingerprint(accountId);
    if (!config) {
      console.warn('No fingerprint config found, using defaults');
      return;
    }
    
    const validation = fingerprintService.validateFingerprint(config);
    if (!validation.valid) {
      console.warn('Fingerprint config invalid:', validation.errors);
      // Try to auto-fix
      const fixed = fingerprintService.autoFix(config);
      if (fixed) {
        config = fixed;
      } else {
        console.warn('Could not auto-fix, using defaults');
        return;
      }
    }
    
    const injector = new FingerprintInjector(config.toJSON());
    const script = injector.getInjectionScript();
    
    await view.webContents.executeJavaScript(script);
    console.log('Fingerprint applied successfully');
    
  } catch (error) {
    console.error('Failed to apply fingerprint:', error);
    // Continue without fingerprint spoofing
    // The browser will use real fingerprint
  }
}
`);
  
  return true;
}

// ==================== Example 13: Database Usage ====================

/**
 * Example 13: Using the Fingerprint Database
 * 
 * This example shows how to use the fingerprint database
 * to get realistic browser configurations.
 */
async function example13_DatabaseUsage() {
  console.log('\n=== Example 13: Fingerprint Database Usage ===\n');
  
  // Create database instance
  const database = new FingerprintDatabase();
  
  // Get database statistics
  const stats = database.getStats();
  console.log('Database statistics:');
  console.log(`  Total profiles: ${stats.totalProfiles}`);
  console.log(`  By OS: Windows=${stats.byOS.windows}, macOS=${stats.byOS.macos}, Linux=${stats.byOS.linux}`);
  console.log(`  By Browser: Chrome=${stats.byBrowser.chrome}, Firefox=${stats.byBrowser.firefox}`);
  
  // Get a random profile
  console.log('\nRandom profile:');
  const randomProfile = database.getRandomProfile();
  console.log(`  Browser: ${randomProfile.browser.type} ${randomProfile.browser.version}`);
  console.log(`  OS: ${randomProfile.os.type}`);
  console.log(`  User-Agent: ${randomProfile.userAgent.substring(0, 50)}...`);
  
  // Get profile by criteria
  console.log('\nProfile by criteria (Windows + Chrome):');
  const windowsChrome = database.getProfileByCriteria({
    os: OSType.Windows,
    browser: BrowserType.Chrome
  });
  console.log(`  Platform: ${windowsChrome.os.platform}`);
  console.log(`  WebGL Vendor: ${windowsChrome.webgl.vendor}`);
  
  // Get synthesized profile (unique combination)
  console.log('\nSynthesized profile (unique combination):');
  const synthesized = database.getSynthesizedProfile({
    os: OSType.Windows,
    browser: BrowserType.Chrome
  });
  console.log(`  This profile is a unique combination of real data`);
  console.log(`  Screen: ${synthesized.hardware.screen.width}x${synthesized.hardware.screen.height}`);
  console.log(`  CPU Cores: ${synthesized.hardware.cpuCores}`);
  
  // Get fonts for OS
  console.log('\nFonts for Windows:');
  const windowsFonts = database.getFontsForOS(OSType.Windows);
  console.log(`  ${windowsFonts.slice(0, 5).join(', ')}...`);
  
  // Get WebGL configs for OS
  console.log('\nWebGL configs for Windows:');
  const webglConfigs = database.getWebGLConfigsForOS(OSType.Windows);
  console.log(`  Available configs: ${webglConfigs.length}`);
  if (webglConfigs.length > 0) {
    console.log(`  First config vendor: ${webglConfigs[0].vendor}`);
  }
  
  return database;
}

// ==================== Run All Examples ====================

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Fingerprint System Integration Examples                ║');
  console.log('║     指纹系统集成示例                                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    await example1_BasicGeneration();
    await example2_ConfigurationManagement();
    await example3_TemplateManagement();
    await example4_Validation();
    await example5_Injection();
    await example6_SeedManagement();
    await example7_Testing();
    await example8_CompleteIntegration();
    await example9_NoiseEngine();
    await example10_IPCIntegration();
    await example11_ViewFactoryIntegration();
    await example12_ErrorHandling();
    await example13_DatabaseUsage();
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     All examples completed successfully!                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('\nExample failed with error:', error.message);
    console.error(error.stack);
  }
}

// Export examples for individual use
module.exports = {
  example1_BasicGeneration,
  example2_ConfigurationManagement,
  example3_TemplateManagement,
  example4_Validation,
  example5_Injection,
  example6_SeedManagement,
  example7_Testing,
  example8_CompleteIntegration,
  example9_NoiseEngine,
  example10_IPCIntegration,
  example11_ViewFactoryIntegration,
  example12_ErrorHandling,
  example13_DatabaseUsage,
  runAllExamples
};

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
