'use strict';

const crypto = require('crypto');

/**
 * Translation Engine Enum
 * @readonly
 * @enum {string}
 */
const TranslationEngine = {
  Google: 'google',
  GPT4: 'gpt4',
  Gemini: 'gemini',
  DeepSeek: 'deepseek',
  Custom: 'custom'
};

/**
 * Translation Style Enum
 * @readonly
 * @enum {string}
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
 * Generate a UUID v4
 * @returns {string}
 */
function uuidv4() {
  return crypto.randomUUID();
}

/**
 * TranslationConfig Domain Entity
 * 
 * Represents translation configuration for an account.
 */
class TranslationConfig {
  /**
   * Creates a TranslationConfig instance
   * @param {Object} config - Translation configuration
   */
  constructor(config = {}) {
    this.id = config.id || uuidv4();
    this.enabled = config.enabled !== undefined ? config.enabled : false;
    this.engine = config.engine || TranslationEngine.Google;
    this.apiKey = config.apiKey || null;
    this.targetLanguage = config.targetLanguage || 'en';
    this.sourceLanguage = config.sourceLanguage || null;
    this.autoTranslate = config.autoTranslate !== undefined ? config.autoTranslate : false;
    this.translateInput = config.translateInput !== undefined ? config.translateInput : false;
    this.inputStyle = config.inputStyle || TranslationStyle.General;
    
    // Friend-specific settings stored as a Map-like object
    this.friendSettings = config.friendSettings || {};
    
    // Metadata
    this.createdAt = config.createdAt ? new Date(config.createdAt) : new Date();
    this.updatedAt = config.updatedAt ? new Date(config.updatedAt) : new Date();
  }

  // ==================== Domain Methods ====================

  /**
   * Gets the engine configuration object
   * @returns {Object}
   */
  getEngineConfig() {
    return {
      engine: this.engine,
      apiKey: this.apiKey,
      targetLanguage: this.targetLanguage,
      sourceLanguage: this.sourceLanguage
    };
  }

  /**
   * Gets friend-specific translation configuration
   * @param {string} friendId - Friend identifier
   * @returns {Object|null}
   */
  getFriendConfig(friendId) {
    return this.friendSettings[friendId] || null;
  }

  /**
   * Sets friend-specific translation configuration
   * @param {string} friendId - Friend identifier
   * @param {Object} config - Friend translation config
   */
  setFriendConfig(friendId, config) {
    this.friendSettings[friendId] = {
      enabled: config.enabled !== undefined ? config.enabled : true,
      targetLanguage: config.targetLanguage || this.targetLanguage,
      ...config
    };
    this.updatedAt = new Date();
  }

  /**
   * Removes friend-specific configuration
   * @param {string} friendId - Friend identifier
   */
  removeFriendConfig(friendId) {
    delete this.friendSettings[friendId];
    this.updatedAt = new Date();
  }

  /**
   * Enables translation
   */
  enable() {
    this.enabled = true;
    this.updatedAt = new Date();
  }

  /**
   * Disables translation
   */
  disable() {
    this.enabled = false;
    this.updatedAt = new Date();
  }

  /**
   * Checks if the engine requires an API key
   * @returns {boolean}
   */
  requiresApiKey() {
    return [TranslationEngine.GPT4, TranslationEngine.Gemini, TranslationEngine.DeepSeek, TranslationEngine.Custom].includes(this.engine);
  }

  /**
   * Updates the engine
   * @param {string} engine - New engine
   * @param {string} [apiKey] - API key for the engine
   */
  setEngine(engine, apiKey = null) {
    this.engine = engine;
    if (apiKey !== null) {
      this.apiKey = apiKey;
    }
    this.updatedAt = new Date();
  }

  // ==================== Validation ====================

  /**
   * Validates the translation configuration
   * @returns {{valid: boolean, errors: Array<{field: string, reason: string, value: any}>}}
   */
  validate() {
    const errors = [];

    // Validate ID
    if (!this.id || typeof this.id !== 'string' || this.id.trim().length === 0) {
      errors.push({ field: 'id', reason: 'Translation config ID is required and must be a non-empty string', value: this.id });
    }

    // Validate enabled
    if (typeof this.enabled !== 'boolean') {
      errors.push({ field: 'enabled', reason: 'enabled must be a boolean', value: this.enabled });
    }

    // Validate engine
    if (!Object.values(TranslationEngine).includes(this.engine)) {
      errors.push({ field: 'engine', reason: `Engine must be one of: ${Object.values(TranslationEngine).join(', ')}`, value: this.engine });
    }

    // Validate targetLanguage
    if (!this.targetLanguage || typeof this.targetLanguage !== 'string' || this.targetLanguage.trim().length === 0) {
      errors.push({ field: 'targetLanguage', reason: 'Target language is required', value: this.targetLanguage });
    } else if (this.targetLanguage.length > 10) {
      errors.push({ field: 'targetLanguage', reason: 'Target language code must not exceed 10 characters', value: this.targetLanguage });
    }

    // Validate sourceLanguage (optional)
    if (this.sourceLanguage !== null && this.sourceLanguage !== undefined) {
      if (typeof this.sourceLanguage !== 'string') {
        errors.push({ field: 'sourceLanguage', reason: 'Source language must be a string', value: this.sourceLanguage });
      } else if (this.sourceLanguage.length > 10) {
        errors.push({ field: 'sourceLanguage', reason: 'Source language code must not exceed 10 characters', value: this.sourceLanguage });
      }
    }

    // Validate API key requirement
    if (this.enabled && this.requiresApiKey()) {
      if (!this.apiKey || typeof this.apiKey !== 'string' || this.apiKey.trim().length === 0) {
        errors.push({ field: 'apiKey', reason: `API key is required for ${this.engine} engine`, value: this.apiKey });
      }
    }

    // Validate autoTranslate
    if (typeof this.autoTranslate !== 'boolean') {
      errors.push({ field: 'autoTranslate', reason: 'autoTranslate must be a boolean', value: this.autoTranslate });
    }

    // Validate translateInput
    if (typeof this.translateInput !== 'boolean') {
      errors.push({ field: 'translateInput', reason: 'translateInput must be a boolean', value: this.translateInput });
    }

    // Validate inputStyle
    if (!Object.values(TranslationStyle).includes(this.inputStyle)) {
      errors.push({ field: 'inputStyle', reason: `Input style must be one of: ${Object.values(TranslationStyle).join(', ')}`, value: this.inputStyle });
    }

    // Validate friendSettings
    if (this.friendSettings !== null && typeof this.friendSettings !== 'object') {
      errors.push({ field: 'friendSettings', reason: 'friendSettings must be an object', value: this.friendSettings });
    }

    // Validate createdAt
    if (!(this.createdAt instanceof Date) || isNaN(this.createdAt.getTime())) {
      errors.push({ field: 'createdAt', reason: 'createdAt must be a valid Date', value: this.createdAt });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ==================== Serialization ====================

  /**
   * Converts the translation config to a JSON-serializable object
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      enabled: this.enabled,
      engine: this.engine,
      apiKey: this.apiKey,
      targetLanguage: this.targetLanguage,
      sourceLanguage: this.sourceLanguage,
      autoTranslate: this.autoTranslate,
      translateInput: this.translateInput,
      inputStyle: this.inputStyle,
      friendSettings: { ...this.friendSettings },
      createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : this.createdAt,
      updatedAt: this.updatedAt instanceof Date ? this.updatedAt.toISOString() : this.updatedAt
    };
  }

  /**
   * Creates a TranslationConfig instance from a JSON object
   * @param {Object} json - JSON representation
   * @returns {TranslationConfig}
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON: expected an object');
    }
    return new TranslationConfig({
      id: json.id,
      enabled: json.enabled,
      engine: json.engine,
      apiKey: json.apiKey,
      targetLanguage: json.targetLanguage,
      sourceLanguage: json.sourceLanguage,
      autoTranslate: json.autoTranslate,
      translateInput: json.translateInput,
      inputStyle: json.inputStyle,
      friendSettings: json.friendSettings,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt
    });
  }

  /**
   * Returns a human-readable string representation for debugging
   * @param {TranslationConfig} config - TranslationConfig instance
   * @returns {string}
   */
  static prettyPrint(config) {
    const maskedApiKey = config.apiKey ? '********' : 'None';
    const friendCount = Object.keys(config.friendSettings || {}).length;
    const lines = [
      '┌─────────────────────────────────────────────────────────────┐',
      '│                   TRANSLATION CONFIG                       │',
      '├─────────────────────────────────────────────────────────────┤',
      `│ ID:              ${(config.id || 'N/A').padEnd(41)} │`,
      `│ Enabled:         ${String(config.enabled).padEnd(41)} │`,
      `│ Engine:          ${(config.engine || 'N/A').padEnd(41)} │`,
      `│ API Key:         ${maskedApiKey.padEnd(41)} │`,
      `│ Target Lang:     ${(config.targetLanguage || 'N/A').padEnd(41)} │`,
      `│ Source Lang:     ${(config.sourceLanguage || 'Auto').padEnd(41)} │`,
      `│ Auto Translate:  ${String(config.autoTranslate).padEnd(41)} │`,
      `│ Translate Input: ${String(config.translateInput).padEnd(41)} │`,
      `│ Input Style:     ${(config.inputStyle || 'N/A').padEnd(41)} │`,
      `│ Friend Settings: ${String(friendCount + ' configured').padEnd(41)} │`,
      `│ Created:         ${(config.createdAt instanceof Date ? config.createdAt.toISOString() : String(config.createdAt)).substring(0, 41).padEnd(41)} │`,
      `│ Updated:         ${(config.updatedAt instanceof Date ? config.updatedAt.toISOString() : String(config.updatedAt)).substring(0, 41).padEnd(41)} │`,
      '└─────────────────────────────────────────────────────────────┘'
    ];
    return lines.join('\n');
  }
}

// Export the class and enums
TranslationConfig.Engine = TranslationEngine;
TranslationConfig.Style = TranslationStyle;
module.exports = TranslationConfig;
