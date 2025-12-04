/**
 * CustomAPIAdapterWrapper - Wrapper for existing Custom API adapter
 * 
 * Wraps the existing CustomAPIAdapter to conform to the new ITranslationAdapter interface.
 * Supports user-configured custom translation APIs (OpenAI-compatible format).
 * Does not modify existing translation logic, only provides interface compliance.
 * 
 * @module infrastructure/translation/adapters/CustomAPIAdapterWrapper
 */

'use strict';

const { ITranslationAdapter } = require('./ITranslationAdapter');
const CustomAPIAdapter = require('../../../translation/adapters/CustomAPIAdapter');

/**
 * CustomAPIAdapterWrapper
 * 
 * Wraps the existing CustomAPIAdapter implementation.
 */
class CustomAPIAdapterWrapper extends ITranslationAdapter {
  /**
   * Creates a new CustomAPIAdapterWrapper instance
   * @param {Object} config - Adapter configuration
   * @param {string} [config.name] - Adapter display name
   * @param {string} config.apiKey - API key
   * @param {string} config.endpoint - API endpoint URL
   * @param {string} config.model - Model name
   */
  constructor(config = {}) {
    super({
      ...config,
      name: config.name || 'Custom API',
      type: 'custom'
    });
    
    // Create the underlying adapter
    this._adapter = new CustomAPIAdapter(config);
  }

  /**
   * Translates text using custom API
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
    
    if (!this._adapter.model || this._adapter.model.trim() === '') {
      errors.push({ field: 'model', reason: 'Model name is required' });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Tests the API connection
   * 
   * @returns {Promise<boolean>} True if connection test succeeds
   */
  async testConnection() {
    try {
      return await this._adapter.testConnection();
    } catch (error) {
      return false;
    }
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
   * @returns {CustomAPIAdapter} The wrapped adapter
   */
  getUnderlyingAdapter() {
    return this._adapter;
  }
}

module.exports = CustomAPIAdapterWrapper;
