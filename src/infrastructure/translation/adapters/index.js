/**
 * Translation Adapters Index
 * 
 * Exports all translation adapter interfaces and wrapper implementations.
 * 
 * @module infrastructure/translation/adapters
 */

'use strict';

const { ITranslationAdapter, TranslationStyle, TranslationEngineType } = require('./ITranslationAdapter');
const GoogleTranslateAdapterWrapper = require('./GoogleTranslateAdapterWrapper');
const AITranslationAdapterWrapper = require('./AITranslationAdapterWrapper');
const CustomAPIAdapterWrapper = require('./CustomAPIAdapterWrapper');

/**
 * Creates an adapter wrapper based on engine type
 * 
 * @param {string} engineType - Engine type (google, gpt4, gemini, deepseek, custom)
 * @param {Object} config - Adapter configuration
 * @returns {ITranslationAdapter} Adapter instance
 */
function createAdapter(engineType, config = {}) {
  switch (engineType) {
    case 'google':
      return new GoogleTranslateAdapterWrapper(config);
    
    case 'gpt4':
      return new AITranslationAdapterWrapper({
        ...config,
        name: 'GPT-4',
        type: 'gpt4',
        endpoint: config.endpoint || 'https://api.openai.com/v1/chat/completions',
        model: config.model || 'gpt-4'
      });
    
    case 'gemini':
      return new AITranslationAdapterWrapper({
        ...config,
        name: 'Gemini',
        type: 'gemini',
        endpoint: config.endpoint || 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
        model: config.model || 'gemini-pro'
      });
    
    case 'deepseek':
      return new AITranslationAdapterWrapper({
        ...config,
        name: 'DeepSeek',
        type: 'deepseek',
        endpoint: config.endpoint || 'https://api.deepseek.com/v1/chat/completions',
        model: config.model || 'deepseek-chat'
      });
    
    case 'custom':
      return new CustomAPIAdapterWrapper(config);
    
    default:
      throw new Error(`Unknown engine type: ${engineType}`);
  }
}

module.exports = {
  // Interface
  ITranslationAdapter,
  
  // Enums
  TranslationStyle,
  TranslationEngineType,
  
  // Wrapper implementations
  GoogleTranslateAdapterWrapper,
  AITranslationAdapterWrapper,
  CustomAPIAdapterWrapper,
  
  // Factory function
  createAdapter
};
