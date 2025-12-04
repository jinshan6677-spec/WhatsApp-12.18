/**
 * GoogleTranslateAdapterWrapper - Wrapper for existing Google Translate adapter
 * 
 * Wraps the existing GoogleTranslateAdapter to conform to the new ITranslationAdapter interface.
 * Does not modify existing translation logic, only provides interface compliance.
 * 
 * @module infrastructure/translation/adapters/GoogleTranslateAdapterWrapper
 */

'use strict';

const { ITranslationAdapter } = require('./ITranslationAdapter');
const GoogleTranslateAdapter = require('../../../translation/adapters/GoogleTranslateAdapter');

/**
 * GoogleTranslateAdapterWrapper
 * 
 * Wraps the existing GoogleTranslateAdapter implementation.
 */
class GoogleTranslateAdapterWrapper extends ITranslationAdapter {
  /**
   * Creates a new GoogleTranslateAdapterWrapper instance
   * @param {Object} config - Adapter configuration
   */
  constructor(config = {}) {
    super({
      ...config,
      name: 'Google Translate',
      type: 'google'
    });
    
    // Create the underlying adapter
    this._adapter = new GoogleTranslateAdapter(config);
  }

  /**
   * Translates text using Google Translate
   * 
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language code
   * @param {string} targetLang - Target language code
   * @param {Object} [options={}] - Translation options
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
    const isValid = this._adapter.validateConfig();
    return {
      valid: isValid,
      errors: isValid ? [] : [{ field: 'config', reason: 'Invalid configuration' }]
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
   * @returns {GoogleTranslateAdapter} The wrapped adapter
   */
  getUnderlyingAdapter() {
    return this._adapter;
  }
}

module.exports = GoogleTranslateAdapterWrapper;
