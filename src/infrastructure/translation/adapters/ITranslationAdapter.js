/**
 * ITranslationAdapter - Translation Adapter Interface
 * 
 * Defines the standard interface that all translation engines must implement.
 * This interface enables adding new translation engines without modifying core code.
 * 
 * @module infrastructure/translation/adapters/ITranslationAdapter
 */

'use strict';

/**
 * @typedef {Object} TranslationResult
 * @property {string} translatedText - The translated text
 * @property {string} detectedLang - Detected source language code
 * @property {string} engineUsed - Name of the engine that performed the translation
 */

/**
 * @typedef {Object} TranslationOptions
 * @property {string} [style] - Translation style (e.g., 'formal', 'casual', 'professional')
 * @property {string} [accountId] - Account identifier for cache key generation
 * @property {boolean} [preserveFormatting] - Whether to preserve markdown/emoji formatting
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the configuration is valid
 * @property {Array<{field: string, reason: string}>} errors - Validation errors if any
 */

/**
 * @typedef {Object} AdapterConfig
 * @property {string} name - Adapter display name
 * @property {string} type - Adapter type identifier
 * @property {boolean} [enabled] - Whether the adapter is enabled
 * @property {string} [apiKey] - API key for authenticated services
 * @property {string} [endpoint] - API endpoint URL
 * @property {string} [model] - Model name for AI-based adapters
 */

/**
 * ITranslationAdapter Interface
 * 
 * Abstract base class defining the contract for translation adapters.
 * All translation engine implementations must extend this class.
 */
class ITranslationAdapter {
  /**
   * Creates a new translation adapter instance
   * @param {AdapterConfig} config - Adapter configuration
   */
  constructor(config = {}) {
    if (new.target === ITranslationAdapter) {
      throw new Error('ITranslationAdapter is an abstract class and cannot be instantiated directly');
    }
    
    this.config = config;
    this.name = config.name || 'unknown';
    this.type = config.type || 'unknown';
  }

  /**
   * Translates text from source language to target language
   * 
   * @abstract
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language code (or 'auto' for auto-detection)
   * @param {string} targetLang - Target language code
   * @param {TranslationOptions} [options={}] - Translation options
   * @returns {Promise<TranslationResult>} Translation result
   * @throws {Error} If translation fails
   */
  async translate(text, sourceLang, targetLang, options = {}) {
    throw new Error('Method not implemented: translate');
  }

  /**
   * Detects the language of the given text
   * 
   * @abstract
   * @param {string} text - Text to analyze
   * @returns {Promise<string>} Detected language code
   * @throws {Error} If detection fails
   */
  async detectLanguage(text) {
    throw new Error('Method not implemented: detectLanguage');
  }

  /**
   * Validates the adapter configuration
   * 
   * @abstract
   * @returns {ValidationResult} Validation result with any errors
   */
  validateConfig() {
    throw new Error('Method not implemented: validateConfig');
  }

  /**
   * Checks if the adapter is available and ready to use
   * 
   * @returns {boolean} True if the adapter is available
   */
  isAvailable() {
    return this.config.enabled !== false;
  }

  /**
   * Gets the adapter name
   * 
   * @returns {string} Adapter display name
   */
  getName() {
    return this.name;
  }

  /**
   * Gets the adapter type
   * 
   * @returns {string} Adapter type identifier
   */
  getType() {
    return this.type;
  }

  /**
   * Gets the adapter configuration
   * 
   * @returns {AdapterConfig} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Tests the adapter connection/availability
   * 
   * @returns {Promise<boolean>} True if connection test succeeds
   */
  async testConnection() {
    try {
      // Default implementation: try a simple translation
      await this.translate('test', 'en', 'en', {});
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets supported languages for this adapter
   * 
   * @returns {Promise<string[]>} Array of supported language codes
   */
  async getSupportedLanguages() {
    // Default: return common languages
    return [
      'en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'ar', 'pt', 'it'
    ];
  }

  /**
   * Normalizes a language code to standard format
   * 
   * @param {string} lang - Language code to normalize
   * @returns {string} Normalized language code
   */
  normalizeLanguageCode(lang) {
    if (!lang) return 'auto';
    
    const normalized = lang.toLowerCase().trim();
    
    // Common normalizations
    const mappings = {
      'chinese': 'zh-CN',
      'zh': 'zh-CN',
      'english': 'en',
      'japanese': 'ja',
      'korean': 'ko',
      'spanish': 'es',
      'french': 'fr',
      'german': 'de',
      'russian': 'ru',
      'arabic': 'ar',
      'portuguese': 'pt',
      'italian': 'it'
    };
    
    return mappings[normalized] || normalized;
  }

  /**
   * Validates text length against maximum allowed
   * 
   * @param {string} text - Text to validate
   * @param {number} [maxLength=5000] - Maximum allowed length
   * @throws {Error} If text exceeds maximum length
   */
  validateTextLength(text, maxLength = 5000) {
    if (text && text.length > maxLength) {
      throw new Error(`Text too long: ${text.length} characters (max: ${maxLength})`);
    }
  }

  /**
   * Handles and wraps translation errors
   * 
   * @param {Error} error - Original error
   * @returns {Error} Wrapped error with adapter context
   */
  handleError(error) {
    console.error(`[${this.name}] Translation error:`, error);
    const wrappedError = new Error(`[${this.name}] ${error.message}`);
    wrappedError.originalError = error;
    wrappedError.adapterName = this.name;
    wrappedError.adapterType = this.type;
    return wrappedError;
  }
}

/**
 * Translation Style Enum
 * Defines available translation styles for AI-based adapters
 */
const TranslationStyle = {
  General: 'general',
  Formal: 'formal',
  Casual: 'casual',
  Friendly: 'friendly',
  Humorous: 'humorous',
  Polite: 'polite',
  Firm: 'firm',
  Concise: 'concise',
  Motivational: 'motivational',
  Neutral: 'neutral',
  Professional: 'professional'
};

/**
 * Translation Engine Type Enum
 * Defines available translation engine types
 */
const TranslationEngineType = {
  Google: 'google',
  GPT4: 'gpt4',
  Gemini: 'gemini',
  DeepSeek: 'deepseek',
  Custom: 'custom'
};

module.exports = {
  ITranslationAdapter,
  TranslationStyle,
  TranslationEngineType
};
