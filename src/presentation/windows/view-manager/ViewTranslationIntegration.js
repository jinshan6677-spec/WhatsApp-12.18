/**
 * ViewTranslationIntegration - 视图翻译集成
 * 
 * 负责管理BrowserView的翻译功能集成
 * 
 * @module presentation/windows/view-manager/ViewTranslationIntegration
 */

/**
 * ViewTranslationIntegration class
 */
class ViewTranslationIntegration {
  /**
   * Create ViewTranslationIntegration instance
   * @param {TranslationIntegration} translationIntegration - TranslationIntegration instance
   * @param {Object} [options] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Function} [options.notifyRenderer] - Function to notify renderer
   */
  constructor(translationIntegration, options = {}) {
    this.translationIntegration = translationIntegration;
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.notifyRenderer = options.notifyRenderer || (() => {});
  }

  /**
   * Create logger function
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [ViewTranslationIntegration] [${level.toUpperCase()}] ${message}`;
      
      if (level === 'error') {
        console.error(logMessage, ...args);
      } else if (level === 'warn') {
        console.warn(logMessage, ...args);
      } else {
        console.log(logMessage, ...args);
      }
    };
  }

  /**
   * Check if translation integration is available
   * @returns {boolean}
   */
  isAvailable() {
    return !!this.translationIntegration;
  }

  /**
   * Inject translation scripts into a view
   * @param {string} accountId - Account ID
   * @param {BrowserView} view - BrowserView instance
   * @param {Object} [translationConfig] - Translation configuration
   * @returns {Promise<Object>} Injection result
   */
  async injectScripts(accountId, view, translationConfig = null) {
    if (!this.translationIntegration) {
      this.log('warn', 'TranslationIntegration not available');
      return {
        success: false,
        error: 'Translation integration not available'
      };
    }

    try {
      this.log('info', `Injecting translation scripts for account ${accountId}`);
      
      // Use provided translation config or default
      const config = translationConfig || {
        enabled: true,
        targetLanguage: 'zh-CN',
        engine: 'google',
        apiKey: '',
        autoTranslate: false,
        translateInput: false,
        friendSettings: {}
      };
      
      const injectionResult = await this.translationIntegration.injectScripts(
        accountId,
        view,
        config
      );
      
      if (injectionResult.success) {
        this.log('info', `Translation scripts injected for account ${accountId}`);
      } else {
        this.log('warn', `Failed to inject translation scripts for account ${accountId}: ${injectionResult.error}`);
      }

      return injectionResult;
    } catch (error) {
      this.log('error', `Error injecting translation scripts for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update translation configuration for an account
   * @param {string} accountId - Account ID
   * @param {Object} translationConfig - Translation configuration
   * @param {BrowserView} view - BrowserView instance
   * @returns {Promise<Object>} Result object
   */
  async updateTranslationConfig(accountId, translationConfig, view) {
    if (!this.translationIntegration) {
      this.log('warn', 'TranslationIntegration not available');
      return {
        success: false,
        error: 'Translation integration not available',
        accountId
      };
    }

    try {
      if (!translationConfig) {
        throw new Error('Translation configuration is required');
      }

      this.log('info', `Updating translation config for account ${accountId}`);

      // Update translation configuration
      const result = await this.translationIntegration.configureTranslation(
        accountId,
        translationConfig,
        view
      );

      if (result.success) {
        this.log('info', `Translation config updated for account ${accountId}`);
        
        // Notify renderer about config update
        this.notifyRenderer('translation-config-updated', {
          accountId,
          config: translationConfig,
          timestamp: Date.now()
        });

        return {
          success: true,
          accountId
        };
      } else {
        throw new Error(result.error || 'Failed to update translation config');
      }
    } catch (error) {
      this.log('error', `Failed to update translation config for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message,
        accountId
      };
    }
  }

  /**
   * Get translation configuration for an account
   * @param {string} accountId - Account ID
   * @returns {Object|null} Translation configuration
   */
  getTranslationConfig(accountId) {
    if (!this.translationIntegration) {
      return null;
    }

    return this.translationIntegration.getTranslationConfig(accountId);
  }

  /**
   * Check if translation is enabled for an account
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  isTranslationEnabled(accountId) {
    const config = this.getTranslationConfig(accountId);
    return config ? config.enabled : false;
  }

  /**
   * Get default translation configuration
   * @returns {Object} Default translation configuration
   */
  getDefaultConfig() {
    return {
      enabled: true,
      targetLanguage: 'zh-CN',
      engine: 'google',
      apiKey: '',
      autoTranslate: false,
      translateInput: false,
      friendSettings: {}
    };
  }

  /**
   * Validate translation configuration
   * @param {Object} config - Translation configuration
   * @returns {Object} Validation result {valid: boolean, errors: string[]}
   */
  validateConfig(config) {
    const errors = [];

    if (!config) {
      return { valid: false, errors: ['翻译配置不能为空'] };
    }

    // Validate engine
    const validEngines = ['google', 'gpt4', 'gemini', 'deepseek', 'custom'];
    if (config.engine && !validEngines.includes(config.engine)) {
      errors.push(`不支持的翻译引擎: ${config.engine}。支持的引擎: ${validEngines.join(', ')}`);
    }

    // Validate target language
    if (config.enabled && !config.targetLanguage) {
      errors.push('启用翻译时必须指定目标语言');
    }

    // Validate API key for engines that require it
    const enginesRequiringApiKey = ['gpt4', 'gemini', 'deepseek', 'custom'];
    if (config.enabled && enginesRequiringApiKey.includes(config.engine) && !config.apiKey) {
      errors.push(`${config.engine} 引擎需要 API Key`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get translation statistics for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object|null>} Translation statistics
   */
  async getTranslationStats(accountId) {
    if (!this.translationIntegration) {
      return null;
    }

    try {
      if (typeof this.translationIntegration.getStats === 'function') {
        return await this.translationIntegration.getStats(accountId);
      }
      return null;
    } catch (error) {
      this.log('error', `Failed to get translation stats for ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Clear translation cache for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<boolean>} Success status
   */
  async clearTranslationCache(accountId) {
    if (!this.translationIntegration) {
      return false;
    }

    try {
      if (typeof this.translationIntegration.clearCache === 'function') {
        await this.translationIntegration.clearCache(accountId);
        this.log('info', `Translation cache cleared for account ${accountId}`);
        return true;
      }
      return false;
    } catch (error) {
      this.log('error', `Failed to clear translation cache for ${accountId}:`, error);
      return false;
    }
  }
}

module.exports = ViewTranslationIntegration;
