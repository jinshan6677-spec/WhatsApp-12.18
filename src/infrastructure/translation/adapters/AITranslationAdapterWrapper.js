/**
 * AITranslationAdapterWrapper - Wrapper for existing AI Translation adapter
 * 
 * Wraps the existing AITranslationAdapter to conform to the new ITranslationAdapter interface.
 * Supports GPT-4, Gemini, DeepSeek and other OpenAI-compatible APIs.
 * Does not modify existing translation logic, only provides interface compliance.
 * 
 * @module infrastructure/translation/adapters/AITranslationAdapterWrapper
 */

'use strict';

const { ITranslationAdapter } = require('./ITranslationAdapter');
const AITranslationAdapter = require('../../../translation/adapters/AITranslationAdapter');

/**
 * AITranslationAdapterWrapper
 * 
 * Wraps the existing AITranslationAdapter implementation.
 */
class AITranslationAdapterWrapper extends ITranslationAdapter {
  /**
   * Creates a new AITranslationAdapterWrapper instance
   * @param {Object} config - Adapter configuration
   * @param {string} config.name - Adapter display name
   * @param {string} config.type - Adapter type (gpt4, gemini, deepseek)
   * @param {string} config.apiKey - API key
   * @param {string} [config.endpoint] - API endpoint URL
   * @param {string} [config.model] - Model name
   */
  constructor(config = {}) {
    super({
      ...config,
      name: config.name || 'AI Translation',
      type: config.type || 'ai'
    });
    
    // Create the underlying adapter
    this._adapter = new AITranslationAdapter(config);
  }

  /**
   * Translates text using AI translation
   * 
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language code
   * @param {string} targetLang - Target language code
   * @param {Object} [options={}] - Translation options including style
   * @returns {Promise<Object>} Translation result
   */
  async translate(text, sourceLang, targetLang, options = {}) {
    try {
      return await this._adapter.translate(text, sourceLang, targetLang, options);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Detects the language of the given text
   * 
   * @param {string} text - Text to analyze
   * @returns {Promise<string>} Detected language code
   */
  async detectLanguage(text) {
    try {
      return await this._adapter.detectLanguage(text);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Validates the adapter configuration
   * 
   * @returns {{valid: boolean, errors: Array}} Validation result
   */
  validateConfig() {
    const errors = [];
    
    if (!this._adapter.apiKey || this._adapter.apiKey.trim() === '') {
      errors.push({ field: 'apiKey', reason: 'API key is required' });
    }
    
    if (!this._adapter.apiEndpoint || this._adapter.apiEndpoint.trim() === '') {
      errors.push({ field: 'endpoint', reason: 'API endpoint is required' });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Checks if the adapter is available
   * 
   * @returns {boolean} True if available
   */
  isAvailable() {
    return this._adapter.isAvailable();
  }

  /**
   * Gets the underlying adapter instance
   * 
   * @returns {AITranslationAdapter} The wrapped adapter
   */
  getUnderlyingAdapter() {
    return this._adapter;
  }
}

module.exports = AITranslationAdapterWrapper;
