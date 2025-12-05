'use strict';

const FingerprintConfig = require('../../../domain/fingerprint/FingerprintConfig');
const FingerprintGenerator = require('./FingerprintGenerator');
const FingerprintValidator = require('./FingerprintValidator');
const TemplateManager = require('./TemplateManager');
const FingerprintTestRunner = require('./FingerprintTestRunner');

/**
 * FingerprintService - Unified Fingerprint Management Facade
 * 
 * Provides a unified interface for all fingerprint operations by integrating:
 * - FingerprintGenerator: Generate complete fingerprint configurations
 * - FingerprintValidator: Validate fingerprint consistency
 * - TemplateManager: Manage fingerprint templates
 * - FingerprintTestRunner: Test fingerprint configurations
 * 
 * Requirements: 24.1, 24.2, 24.3, 24.4, 24.5
 * 
 * Key Features:
 * - Inject fingerprint configuration when creating account BrowserView (24.1)
 * - Apply changes to active BrowserView when updating fingerprint (24.2)
 * - Load fingerprint configuration before creating BrowserView on startup (24.3)
 * - Generate and assign default fingerprint for new accounts (24.4)
 * - Log errors and continue with default behavior on injection failure (24.5)
 */
class FingerprintService {
  /**
   * Creates a FingerprintService instance
   * @param {Object} [options] - Service options
   * @param {FingerprintGenerator} [options.generator] - Generator instance
   * @param {FingerprintValidator} [options.validator] - Validator instance
   * @param {TemplateManager} [options.templateManager] - Template manager instance
   * @param {FingerprintTestRunner} [options.testRunner] - Test runner instance
   * @param {string} [options.templateStoragePath] - Path for template storage
   * @param {Function} [options.logger] - Logger function for errors
   */
  constructor(options = {}) {
    this._validator = options.validator || new FingerprintValidator();
    this._generator = options.generator || new FingerprintGenerator({ validator: this._validator });
    this._templateManager = options.templateManager || new TemplateManager({
      storagePath: options.templateStoragePath
    });
    this._testRunner = options.testRunner || new FingerprintTestRunner();
    this._logger = options.logger || console.error.bind(console);

    // Cache for loaded fingerprint configurations
    this._configCache = new Map();

    // Initialization state
    this._initialized = false;
  }

  /**
   * Initializes the fingerprint service
   * Loads templates and prepares the service for use
   * 
   * Requirement 24.3: When application starts, system loads fingerprint
   * configuration before creating BrowserView
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) {
      return;
    }

    try {
      await this._templateManager.initialize();
      this._initialized = true;
    } catch (error) {
      this._logError('Failed to initialize FingerprintService', error);
      // Continue without templates - service is still usable
      this._initialized = true;
    }
  }

  // ==================== Generation Methods ====================

  /**
   * Generates a new fingerprint configuration for an account
   * 
   * Requirement 24.4: When adding new account, system generates and
   * assigns default fingerprint configuration
   * 
   * @param {Object} [options] - Generation options
   * @param {string} [options.accountId] - Account ID to associate
   * @param {string} [options.os] - Target OS (windows, macos, linux)
   * @param {string} [options.browser] - Target browser (chrome, firefox, edge, safari)
   * @returns {FingerprintConfig} Generated fingerprint configuration
   */
  generateFingerprint(options = {}) {
    try {
      const config = this._generator.generateFingerprint(options);

      // Cache the configuration if accountId is provided
      if (options.accountId) {
        this._configCache.set(options.accountId, config);
      }

      return config;
    } catch (error) {
      this._logError('Failed to generate fingerprint', error);
      // Return a default configuration on failure
      return new FingerprintConfig({ accountId: options.accountId });
    }
  }

  /**
   * Generates a fingerprint for a new account with default settings
   * 
   * Requirement 24.4: When adding new account, system generates and
   * assigns default fingerprint configuration
   * 
   * @param {string} accountId - Account ID
   * @returns {FingerprintConfig} Generated fingerprint configuration
   */
  generateDefaultFingerprint(accountId) {
    return this.generateFingerprint({ accountId });
  }

  // ==================== Validation Methods ====================

  /**
   * Validates a fingerprint configuration
   * 
   * @param {FingerprintConfig|Object} config - Configuration to validate
   * @returns {{valid: boolean, errors: Array, warnings: Array}} Validation result
   */
  validateFingerprint(config) {
    try {
      return this._validator.validate(config);
    } catch (error) {
      this._logError('Failed to validate fingerprint', error);
      return {
        valid: false,
        errors: [{ field: 'unknown', reason: error.message, value: null }],
        warnings: []
      };
    }
  }

  /**
   * Validates a fingerprint and returns suggestions for fixing issues
   * 
   * @param {FingerprintConfig|Object} config - Configuration to validate
   * @returns {{valid: boolean, errors: Array, warnings: Array, suggestions: Object}}
   */
  validateWithSuggestions(config) {
    try {
      return this._validator.validateWithSuggestions(config);
    } catch (error) {
      this._logError('Failed to validate fingerprint with suggestions', error);
      return {
        valid: false,
        errors: [{ field: 'unknown', reason: error.message, value: null }],
        warnings: [],
        suggestions: {}
      };
    }
  }

  /**
   * Checks if a fingerprint configuration is consistent
   * 
   * @param {FingerprintConfig|Object} config - Configuration to check
   * @returns {boolean} True if configuration is consistent
   */
  isConsistent(config) {
    return this._validator.isConsistent(config);
  }

  // ==================== Configuration Management ====================

  /**
   * Gets a fingerprint configuration for an account from cache
   * 
   * Requirement 24.1: When creating account's BrowserView, system injects
   * account's fingerprint configuration
   * 
   * @param {string} accountId - Account ID
   * @returns {FingerprintConfig|null} Cached configuration or null
   */
  getFingerprint(accountId) {
    return this._configCache.get(accountId) || null;
  }

  /**
   * Sets/caches a fingerprint configuration for an account
   * 
   * @param {string} accountId - Account ID
   * @param {FingerprintConfig|Object} config - Configuration to cache
   * @returns {FingerprintConfig} The cached configuration
   */
  setFingerprint(accountId, config) {
    const fpConfig = config instanceof FingerprintConfig
      ? config
      : new FingerprintConfig({ ...config, accountId });

    this._configCache.set(accountId, fpConfig);
    return fpConfig;
  }

  /**
   * Updates a fingerprint configuration for an account
   * 
   * Requirement 24.2: When updating account's fingerprint configuration,
   * system applies changes to active BrowserView
   * 
   * @param {string} accountId - Account ID
   * @param {Object} updates - Configuration updates
   * @returns {FingerprintConfig|null} Updated configuration or null if not found
   */
  updateFingerprint(accountId, updates) {
    const config = this._configCache.get(accountId);
    if (!config) {
      return null;
    }

    try {
      config.update(updates);

      // Ensure consistency after update
      this._generator.ensureConsistency(config);

      return config;
    } catch (error) {
      this._logError(`Failed to update fingerprint for account ${accountId}`, error);
      return config;
    }
  }

  /**
   * Removes a fingerprint configuration from cache
   * 
   * @param {string} accountId - Account ID
   * @returns {boolean} True if configuration was removed
   */
  removeFingerprint(accountId) {
    return this._configCache.delete(accountId);
  }

  /**
   * Loads fingerprint configurations for multiple accounts
   * 
   * Requirement 24.3: When application starts, system loads fingerprint
   * configuration before creating BrowserView
   * 
   * @param {Array<{accountId: string, config: Object}>} accounts - Account configurations
   * @returns {Map<string, FingerprintConfig>} Map of account IDs to configurations
   */
  loadFingerprints(accounts) {
    const loaded = new Map();

    for (const { accountId, config } of accounts) {
      try {
        const fpConfig = config instanceof FingerprintConfig
          ? config
          : new FingerprintConfig({ ...config, accountId });

        this._configCache.set(accountId, fpConfig);
        loaded.set(accountId, fpConfig);
      } catch (error) {
        this._logError(`Failed to load fingerprint for account ${accountId}`, error);
        // Generate a default fingerprint on failure
        const defaultConfig = this.generateDefaultFingerprint(accountId);
        loaded.set(accountId, defaultConfig);
      }
    }

    return loaded;
  }

  /**
   * Gets all cached fingerprint configurations
   * 
   * @returns {Map<string, FingerprintConfig>} Map of all cached configurations
   */
  getAllFingerprints() {
    return new Map(this._configCache);
  }

  /**
   * Clears all cached fingerprint configurations
   */
  clearCache() {
    this._configCache.clear();
  }

  /**
   * Disables fingerprint protection for an account and clears all related data
   * 
   * This method:
   * - Clears cached fingerprint configuration
   * - Records the disable operation in logs
   * 
   * @param {string} accountId - Account ID
   * @returns {{success: boolean, cleared: boolean, message: string}} Result
   */
  disableFingerprint(accountId) {
    try {
      if (!accountId) {
        return {
          success: false,
          cleared: false,
          message: 'Account ID is required'
        };
      }

      // Remove from cache
      const wasInCache = this._configCache.delete(accountId);

      console.log(`[FingerprintService] Fingerprint disabled for account ${accountId}. Cache cleared: ${wasInCache}`);

      return {
        success: true,
        cleared: wasInCache,
        message: `Fingerprint authentication disabled for account ${accountId}`
      };
    } catch (error) {
      this._logError(`Failed to disable fingerprint for account ${accountId}`, error);
      return {
        success: false,
        cleared: false,
        message: error.message
      };
    }
  }

  // ==================== Template Methods ====================

  /**
   * Creates a new fingerprint template
   * 
   * @param {Object} options - Template options
   * @param {string} options.name - Template name
   * @param {string} [options.description] - Template description
   * @param {FingerprintConfig|Object} options.config - Source configuration
   * @param {string[]} [options.tags] - Template tags
   * @returns {Object} Created template
   */
  createTemplate(options) {
    return this._templateManager.createTemplate(options);
  }

  /**
   * Applies a template to an account
   * 
   * @param {string} templateId - Template ID
   * @param {string} accountId - Account ID
   * @returns {FingerprintConfig} New configuration for the account
   */
  applyTemplate(templateId, accountId) {
    const config = this._templateManager.applyTemplate(templateId, accountId);
    this._configCache.set(accountId, config);
    return config;
  }

  /**
   * Exports a template to JSON
   * 
   * @param {string} templateId - Template ID
   * @param {Object} [options] - Export options
   * @returns {Object} Exported template JSON
   */
  exportTemplate(templateId, options = {}) {
    return this._templateManager.exportTemplate(templateId, options);
  }

  /**
   * Imports a template from JSON
   * 
   * @param {Object} json - Template JSON
   * @param {Object} [options] - Import options
   * @returns {Object} Imported template
   */
  importTemplate(json, options = {}) {
    return this._templateManager.importTemplate(json, options);
  }

  /**
   * Deletes a template
   * 
   * @param {string} templateId - Template ID
   * @returns {boolean} True if template was deleted
   */
  deleteTemplate(templateId) {
    return this._templateManager.deleteTemplate(templateId);
  }

  /**
   * Lists all templates
   * 
   * @param {Object} [options] - List options
   * @returns {Array<Object>} Template summaries
   */
  listTemplates(options = {}) {
    return this._templateManager.listTemplates(options);
  }

  /**
   * Gets a template by ID
   * 
   * @param {string} templateId - Template ID
   * @returns {Object|null} Template or null
   */
  getTemplate(templateId) {
    return this._templateManager.getTemplate(templateId);
  }

  // ==================== Testing Methods ====================

  /**
   * Runs all fingerprint tests against a configuration
   * 
   * @param {FingerprintConfig|Object} config - Configuration to test
   * @param {Object} [options] - Test options
   * @returns {Promise<Object>} Test report
   */
  async runTests(config, options = {}) {
    try {
      return await this._testRunner.runAll(config, options);
    } catch (error) {
      this._logError('Failed to run fingerprint tests', error);
      return {
        summary: { total: 0, passed: 0, failed: 0, passRate: '0.00%' },
        results: [],
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Gets a preview of how a fingerprint will appear to websites
   * 
   * @param {FingerprintConfig|Object} config - Configuration to preview
   * @returns {Object} Preview summary
   */
  getPreview(config) {
    return this._testRunner.getPreview(config);
  }

  /**
   * Registers a custom test
   * 
   * @param {string} name - Test name
   * @param {Function} testFn - Test function
   * @param {Object} [options] - Test options
   * @returns {FingerprintService} This instance for chaining
   */
  registerTest(name, testFn, options = {}) {
    this._testRunner.registerTest(name, testFn, options);
    return this;
  }

  /**
   * Registers browserleaks-style tests
   * 
   * @returns {FingerprintService} This instance for chaining
   */
  registerBrowserleaksTests() {
    this._testRunner.registerBrowserleaksTests();
    return this;
  }

  /**
   * Registers pixelscan-style tests
   * 
   * @returns {FingerprintService} This instance for chaining
   */
  registerPixelscanTests() {
    this._testRunner.registerPixelscanTests();
    return this;
  }

  // ==================== Utility Methods ====================

  /**
   * Ensures a fingerprint configuration is internally consistent
   * 
   * @param {FingerprintConfig} config - Configuration to fix
   * @returns {FingerprintConfig} The same config with consistency fixes applied
   */
  ensureConsistency(config) {
    return this._generator.ensureConsistency(config);
  }

  /**
   * Gets the expected platform for an OS type
   * 
   * @param {string} osType - OS type
   * @returns {string} Expected platform string
   */
  getExpectedPlatform(osType) {
    return FingerprintValidator.getExpectedPlatform(osType);
  }

  /**
   * Gets expected fonts for an OS type
   * 
   * @param {string} osType - OS type
   * @returns {Array<string>} Expected fonts
   */
  getExpectedFonts(osType) {
    return FingerprintValidator.getExpectedFonts(osType);
  }

  /**
   * Gets valid WebGL vendors for an OS type
   * 
   * @param {string} osType - OS type
   * @returns {Array<string>} Valid WebGL vendors
   */
  getValidWebGLVendors(osType) {
    return FingerprintValidator.getValidWebGLVendors(osType);
  }

  // ==================== Accessor Methods ====================

  /**
   * Gets the generator instance
   * @returns {FingerprintGenerator}
   */
  get generator() {
    return this._generator;
  }

  /**
   * Gets the validator instance
   * @returns {FingerprintValidator}
   */
  get validator() {
    return this._validator;
  }

  /**
   * Gets the template manager instance
   * @returns {TemplateManager}
   */
  get templateManager() {
    return this._templateManager;
  }

  /**
   * Gets the test runner instance
   * @returns {FingerprintTestRunner}
   */
  get testRunner() {
    return this._testRunner;
  }

  /**
   * Checks if the service is initialized
   * @returns {boolean}
   */
  get isInitialized() {
    return this._initialized;
  }

  // ==================== Private Methods ====================

  /**
   * Logs an error
   * @private
   * @param {string} message - Error message
   * @param {Error} error - Error object
   */
  _logError(message, error) {
    if (this._logger) {
      this._logger(`[FingerprintService] ${message}:`, error.message || error);
    }
  }
}

// Export constants from sub-modules for convenience
FingerprintService.BrowserType = FingerprintConfig.BrowserType;
FingerprintService.OSType = FingerprintConfig.OSType;
FingerprintService.NoiseLevel = FingerprintConfig.NoiseLevel;
FingerprintService.NoiseDistribution = FingerprintConfig.NoiseDistribution;
FingerprintService.TestCategory = FingerprintTestRunner.TestCategory;

module.exports = FingerprintService;
