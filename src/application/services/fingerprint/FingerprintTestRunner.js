'use strict';

/**
 * FingerprintTestRunner - Fingerprint Testing and Validation Service
 * 
 * Runs anti-detection tests and generates reports to verify fingerprint
 * configuration effectiveness. Provides built-in tests for common detection
 * methods and supports custom test registration.
 * 
 * Requirements: 23.1, 23.2, 23.3, 23.4, 52.1-52.7
 * 
 * Key Features:
 * - Register custom tests
 * - Run all tests against a fingerprint configuration
 * - Generate detailed test reports
 * - Built-in tests for prototype chain and function stringification detection
 * - Compare configured values vs detected values
 */

const FingerprintConfig = require('../../../domain/fingerprint/FingerprintConfig');
const TestCategory = require('./test-runner/TestCategory');
const navigatorTests = require('./test-runner/builtins/navigatorTests');
const screenTests = require('./test-runner/builtins/screenTests');
const prototypeTests = require('./test-runner/builtins/prototypeTests');
const functionTests = require('./test-runner/builtins/functionTests');
const webglTests = require('./test-runner/builtins/webglTests');
const timezoneTests = require('./test-runner/builtins/timezoneTests');
const generalTests = require('./test-runner/builtins/generalTests');
const browserleaks = require('./test-runner/suites/browserleaks');
const pixelscan = require('./test-runner/suites/pixelscan');

/**
 * Test result structure
 * @typedef {Object} TestResult
 * @property {string} name - Test name
 * @property {boolean} passed - Whether the test passed
 * @property {*} expected - Expected value
 * @property {*} actual - Actual detected value
 * @property {string} [details] - Additional details
 * @property {string} [error] - Error message if test threw
 * @property {string} category - Test category (navigator, canvas, webgl, etc.)
 */

/**
 * Test report structure
 * @typedef {Object} TestReport
 * @property {Object} summary - Summary statistics
 * @property {number} summary.total - Total number of tests
 * @property {number} summary.passed - Number of passed tests
 * @property {number} summary.failed - Number of failed tests
 * @property {string} summary.passRate - Pass rate as percentage string
 * @property {Array<TestResult>} results - Individual test results
 * @property {string} timestamp - ISO timestamp of report generation
 */

/**
 * Test definition structure
 * @typedef {Object} TestDefinition
 * @property {string} name - Test name
 * @property {Function} testFn - Test function that returns TestResult
 * @property {string} category - Test category
 * @property {string} [description] - Test description
 */


// ==================== Test Categories ====================

/**
 * Test categories for organizing tests
 */
 

// ==================== FingerprintTestRunner Class ====================

/**
 * FingerprintTestRunner class for running fingerprint detection tests
 */
class FingerprintTestRunner {
  /**
   * Creates a FingerprintTestRunner instance
   * @param {Object} [options] - Runner options
   * @param {boolean} [options.includeBuiltInTests=true] - Whether to include built-in tests
   */
  constructor(options = {}) {
    this._tests = [];
    this._results = [];
    this._includeBuiltInTests = options.includeBuiltInTests !== false;
    
    // Register built-in tests if enabled
    if (this._includeBuiltInTests) {
      this._registerBuiltInTests();
    }
  }

  /**
   * Registers a test
   * 
   * @param {string} name - Test name
   * @param {Function} testFn - Test function that takes config and returns TestResult
   * @param {Object} [options] - Test options
   * @param {string} [options.category='general'] - Test category
   * @param {string} [options.description] - Test description
   * @returns {FingerprintTestRunner} This instance for chaining
   */
  registerTest(name, testFn, options = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Test name is required and must be a string');
    }
    
    if (typeof testFn !== 'function') {
      throw new Error('Test function is required and must be a function');
    }
    
    this._tests.push({
      name,
      testFn,
      category: options.category || TestCategory.GENERAL,
      description: options.description || ''
    });
    
    return this;
  }

  /**
   * Unregisters a test by name
   * 
   * @param {string} name - Test name to remove
   * @returns {boolean} True if test was removed
   */
  unregisterTest(name) {
    const index = this._tests.findIndex(t => t.name === name);
    if (index !== -1) {
      this._tests.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Gets all registered tests
   * 
   * @returns {Array<TestDefinition>} Array of test definitions
   */
  getTests() {
    return [...this._tests];
  }

  /**
   * Gets tests by category
   * 
   * @param {string} category - Category to filter by
   * @returns {Array<TestDefinition>} Array of test definitions in the category
   */
  getTestsByCategory(category) {
    return this._tests.filter(t => t.category === category);
  }

  /**
   * Runs all registered tests against a fingerprint configuration
   * 
   * Requirement 23.2: When user clicks "test fingerprint", system opens
   * test page showing detected fingerprint values
   * 
   * Requirement 23.3: When showing fingerprint values, system displays
   * both configured and detected values for comparison
   * 
   * @param {FingerprintConfig|Object} config - Fingerprint configuration to test
   * @param {Object} [options] - Run options
   * @param {Array<string>} [options.categories] - Only run tests in these categories
   * @param {Array<string>} [options.testNames] - Only run tests with these names
   * @returns {Promise<TestReport>} Test report
   */
  async runAll(config, options = {}) {
    this._results = [];
    
    // Ensure we have a FingerprintConfig instance
    const fpConfig = config instanceof FingerprintConfig 
      ? config 
      : new FingerprintConfig(config);
    
    // Filter tests if options provided
    let testsToRun = [...this._tests];
    
    if (options.categories && Array.isArray(options.categories)) {
      testsToRun = testsToRun.filter(t => options.categories.includes(t.category));
    }
    
    if (options.testNames && Array.isArray(options.testNames)) {
      testsToRun = testsToRun.filter(t => options.testNames.includes(t.name));
    }
    
    // Run each test
    for (const test of testsToRun) {
      try {
        const result = await test.testFn(fpConfig);
        this._results.push({
          name: test.name,
          category: test.category,
          passed: result.passed,
          expected: result.expected,
          actual: result.actual,
          details: result.details || ''
        });
      } catch (error) {
        this._results.push({
          name: test.name,
          category: test.category,
          passed: false,
          expected: 'Test should complete without error',
          actual: null,
          error: error.message
        });
      }
    }
    
    return this.generateReport();
  }


  /**
   * Generates a test report from the results
   * 
   * Requirement 23.4: When fingerprint test completes, system indicates
   * pass/fail status for each dimension
   * 
   * Requirement 52.7: When fingerprint leak is detected, system generates
   * detailed failure report
   * 
   * @returns {TestReport} Test report
   */
  generateReport() {
    const passed = this._results.filter(r => r.passed).length;
    const failed = this._results.filter(r => !r.passed).length;
    const total = this._results.length;
    
    // Calculate pass rate, handle division by zero
    const passRate = total > 0 
      ? (passed / total * 100).toFixed(2) + '%'
      : '0.00%';
    
    // Group results by category
    const byCategory = {};
    for (const result of this._results) {
      const category = result.category || TestCategory.GENERAL;
      if (!byCategory[category]) {
        byCategory[category] = {
          total: 0,
          passed: 0,
          failed: 0,
          results: []
        };
      }
      byCategory[category].total++;
      if (result.passed) {
        byCategory[category].passed++;
      } else {
        byCategory[category].failed++;
      }
      byCategory[category].results.push(result);
    }
    
    return {
      summary: {
        total,
        passed,
        failed,
        passRate
      },
      byCategory,
      results: [...this._results],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Gets the last test results
   * 
   * @returns {Array<TestResult>} Last test results
   */
  getResults() {
    return [...this._results];
  }

  /**
   * Clears all test results
   */
  clearResults() {
    this._results = [];
  }

  /**
   * Gets a preview summary of the fingerprint configuration
   * 
   * Requirement 23.1: When user clicks "preview", system displays
   * summary of how fingerprint will appear to websites
   * 
   * @param {FingerprintConfig|Object} config - Fingerprint configuration
   * @returns {Object} Preview summary
   */
  getPreview(config) {
    const fpConfig = config instanceof FingerprintConfig 
      ? config 
      : new FingerprintConfig(config);
    
    return {
      browser: {
        type: fpConfig.browser?.type || 'unknown',
        version: fpConfig.browser?.version || 'unknown',
        userAgent: fpConfig.userAgent || 'unknown'
      },
      os: {
        type: fpConfig.os?.type || 'unknown',
        platform: fpConfig.os?.platform || 'unknown'
      },
      hardware: {
        cpuCores: fpConfig.hardware?.cpuCores || 'unknown',
        deviceMemory: fpConfig.hardware?.deviceMemory || 'unknown',
        screen: fpConfig.hardware?.screen ? 
          `${fpConfig.hardware.screen.width}x${fpConfig.hardware.screen.height}` : 'unknown'
      },
      canvas: {
        mode: fpConfig.canvas?.mode || 'unknown',
        noiseLevel: fpConfig.canvas?.noiseLevel || 'unknown'
      },
      webgl: {
        vendor: fpConfig.webgl?.vendor || 'unknown',
        renderer: fpConfig.webgl?.renderer || 'unknown'
      },
      audio: {
        mode: fpConfig.audio?.mode || 'unknown'
      },
      fonts: {
        count: fpConfig.fonts?.list?.length || 0
      },
      timezone: {
        name: fpConfig.timezone?.name || 'unknown',
        offset: fpConfig.timezone?.offset || 'unknown'
      },
      webrtc: {
        mode: fpConfig.webrtc?.mode || 'unknown'
      }
    };
  }

  // ==================== Built-in Tests ====================

  /**
   * Registers all built-in tests
   * @private
   */
  _registerBuiltInTests() {
    // Navigator tests
    this.registerTest(
      'Navigator User-Agent',
      FingerprintTestRunner.navigatorUserAgentTest,
      { category: TestCategory.NAVIGATOR, description: 'Verifies User-Agent matches configuration' }
    );
    
    this.registerTest(
      'Navigator Platform',
      FingerprintTestRunner.navigatorPlatformTest,
      { category: TestCategory.NAVIGATOR, description: 'Verifies platform matches configuration' }
    );
    
    this.registerTest(
      'Navigator Hardware Concurrency',
      FingerprintTestRunner.navigatorHardwareConcurrencyTest,
      { category: TestCategory.NAVIGATOR, description: 'Verifies CPU cores matches configuration' }
    );
    
    this.registerTest(
      'Navigator Device Memory',
      FingerprintTestRunner.navigatorDeviceMemoryTest,
      { category: TestCategory.NAVIGATOR, description: 'Verifies device memory matches configuration' }
    );
    
    this.registerTest(
      'Navigator Language',
      FingerprintTestRunner.navigatorLanguageTest,
      { category: TestCategory.NAVIGATOR, description: 'Verifies language matches configuration' }
    );
    
    this.registerTest(
      'Navigator Webdriver',
      FingerprintTestRunner.navigatorWebdriverTest,
      { category: TestCategory.NAVIGATOR, description: 'Verifies webdriver is hidden' }
    );
    
    // Screen tests
    this.registerTest(
      'Screen Resolution',
      FingerprintTestRunner.screenResolutionTest,
      { category: TestCategory.SCREEN, description: 'Verifies screen resolution matches configuration' }
    );
    
    // Prototype chain tests (Requirement 52.3)
    this.registerTest(
      'Prototype Chain - No Original Reference',
      FingerprintTestRunner.prototypeChainNoOriginalTest,
      { category: TestCategory.PROTOTYPE, description: 'Verifies no __original__ property exposed' }
    );
    
    this.registerTest(
      'Prototype Chain - Property Descriptors',
      FingerprintTestRunner.prototypeChainDescriptorsTest,
      { category: TestCategory.PROTOTYPE, description: 'Verifies property descriptors are consistent' }
    );
    
    // Function stringification tests (Requirement 52.4)
    this.registerTest(
      'Function toString - Native Code',
      FingerprintTestRunner.functionToStringNativeTest,
      { category: TestCategory.FUNCTION, description: 'Verifies toString returns [native code]' }
    );
    
    // WebGL tests
    this.registerTest(
      'WebGL Vendor',
      FingerprintTestRunner.webglVendorTest,
      { category: TestCategory.WEBGL, description: 'Verifies WebGL vendor matches configuration' }
    );
    
    this.registerTest(
      'WebGL Renderer',
      FingerprintTestRunner.webglRendererTest,
      { category: TestCategory.WEBGL, description: 'Verifies WebGL renderer matches configuration' }
    );
    
    // Timezone tests
    this.registerTest(
      'Timezone Offset',
      FingerprintTestRunner.timezoneOffsetTest,
      { category: TestCategory.TIMEZONE, description: 'Verifies timezone offset matches configuration' }
    );
    
    // General consistency tests
    this.registerTest(
      'User-Agent OS Consistency',
      FingerprintTestRunner.userAgentOSConsistencyTest,
      { category: TestCategory.GENERAL, description: 'Verifies User-Agent matches OS type' }
    );
    
    this.registerTest(
      'Configuration Validity',
      FingerprintTestRunner.configurationValidityTest,
      { category: TestCategory.GENERAL, description: 'Verifies configuration passes validation' }
    );
  }


  // ==================== Static Test Methods ====================

  /**
   * Test: Navigator User-Agent
   * Verifies the User-Agent string matches the configuration
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
  */
  static navigatorUserAgentTest(config) {
    return navigatorTests.navigatorUserAgentTest(config);
  }

  /**
   * Test: Navigator Platform
   * Verifies the platform string matches the configuration
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static navigatorPlatformTest(config) {
    return navigatorTests.navigatorPlatformTest(config);
  }

  /**
   * Test: Navigator Hardware Concurrency
   * Verifies CPU cores matches the configuration
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static navigatorHardwareConcurrencyTest(config) {
    return navigatorTests.navigatorHardwareConcurrencyTest(config);
  }

  /**
   * Test: Navigator Device Memory
   * Verifies device memory matches the configuration
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static navigatorDeviceMemoryTest(config) {
    return navigatorTests.navigatorDeviceMemoryTest(config);
  }

  /**
   * Test: Navigator Language
   * Verifies language matches the configuration
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static navigatorLanguageTest(config) {
    return navigatorTests.navigatorLanguageTest(config);
  }

  /**
   * Test: Navigator Webdriver
   * Verifies webdriver property is hidden (false or undefined)
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static navigatorWebdriverTest(config) {
    return navigatorTests.navigatorWebdriverTest(config);
  }

  /**
   * Test: Screen Resolution
   * Verifies screen resolution matches the configuration
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static screenResolutionTest(config) {
    return screenTests.screenResolutionTest(config);
  }

  /**
   * Test: Prototype Chain - No Original Reference
   * Verifies that wrapped functions don't expose __original__ property
   * 
   * Requirement 52.3: System should include prototype chain traversal detection
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static prototypeChainNoOriginalTest(config) {
    return prototypeTests.prototypeChainNoOriginalTest(config);
  }

  /**
   * Test: Prototype Chain - Property Descriptors
   * Verifies property descriptors are consistent with native behavior
   * 
   * Requirement 52.3: System should include prototype chain traversal detection
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static prototypeChainDescriptorsTest(config) {
    return prototypeTests.prototypeChainDescriptorsTest(config);
  }

  /**
   * Test: Function toString - Native Code
   * Verifies that function toString returns [native code]
   * 
   * Requirement 52.4: System should include function stringification detection
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static functionToStringNativeTest(config) {
    return functionTests.functionToStringNativeTest(config);
  }


  /**
   * Test: WebGL Vendor
   * Verifies WebGL vendor matches the configuration
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static webglVendorTest(config) {
    return webglTests.webglVendorTest(config);
  }

  /**
   * Test: WebGL Renderer
   * Verifies WebGL renderer matches the configuration
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static webglRendererTest(config) {
    return webglTests.webglRendererTest(config);
  }

  /**
   * Test: Timezone Offset
   * Verifies timezone offset matches the configuration
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static timezoneOffsetTest(config) {
    return timezoneTests.timezoneOffsetTest(config);
  }

  /**
   * Test: User-Agent OS Consistency
   * Verifies User-Agent string is consistent with OS type
   * 
   * Requirement 52.5: System should automatically compare "configured vs detected" values
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static userAgentOSConsistencyTest(config) {
    return generalTests.userAgentOSConsistencyTest(config);
  }

  /**
   * Test: Configuration Validity
   * Verifies the configuration passes validation
   * 
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {TestResult} Test result
   */
  static configurationValidityTest(config) {
    return generalTests.configurationValidityTest(config);
  }

  // ==================== Browserleaks-style Tests (Requirement 52.1) ====================

  /**
   * Creates a browserleaks-style test suite
   * Tests similar to what browserleaks.com checks
   * 
   * Requirement 52.1: System should include browserleaks-style detection scripts
   * 
   * @returns {Array<TestDefinition>} Array of test definitions
   */
  static createBrowserleaksTests() {
    return browserleaks.createBrowserleaksTests();
  }

  // ==================== Pixelscan-style Tests (Requirement 52.2) ====================

  /**
   * Creates a pixelscan-style test suite
   * Tests similar to what pixelscan.net checks
   * 
   * Requirement 52.2: System should include pixelscan-style detection scripts
   * 
   * @returns {Array<TestDefinition>} Array of test definitions
   */
  static createPixelscanTests() {
    return pixelscan.createPixelscanTests();
  }

  /**
   * Registers browserleaks-style tests
   * 
   * @returns {FingerprintTestRunner} This instance for chaining
   */
  registerBrowserleaksTests() {
    const tests = FingerprintTestRunner.createBrowserleaksTests();
    for (const test of tests) {
      this.registerTest(test.name, test.testFn, { category: test.category });
    }
    return this;
  }

  /**
   * Registers pixelscan-style tests
   * 
   * @returns {FingerprintTestRunner} This instance for chaining
   */
  registerPixelscanTests() {
    const tests = FingerprintTestRunner.createPixelscanTests();
    for (const test of tests) {
      this.registerTest(test.name, test.testFn, { category: test.category });
    }
    return this;
  }
}

// Export constants
FingerprintTestRunner.TestCategory = TestCategory;

module.exports = FingerprintTestRunner;
