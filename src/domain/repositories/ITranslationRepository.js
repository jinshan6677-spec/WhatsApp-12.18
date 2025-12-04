'use strict';

const IRepository = require('./IRepository');

/**
 * Translation Repository Interface
 * 
 * Extends the base repository with translation-specific operations.
 * 
 * @extends IRepository<TranslationConfig, string>
 */
class ITranslationRepository extends IRepository {
  /**
   * Finds translation configurations by engine
   * @param {string} engine - Translation engine (google, gpt4, gemini, deepseek, custom)
   * @returns {Promise<TranslationConfig[]>} Array of matching translation configs
   */
  async findByEngine(engine) {
    throw new Error('Method not implemented: findByEngine');
  }

  /**
   * Finds all enabled translation configurations
   * @returns {Promise<TranslationConfig[]>} Array of enabled translation configs
   */
  async findEnabled() {
    throw new Error('Method not implemented: findEnabled');
  }

  /**
   * Finds translation configurations by target language
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<TranslationConfig[]>} Array of matching translation configs
   */
  async findByTargetLanguage(targetLanguage) {
    throw new Error('Method not implemented: findByTargetLanguage');
  }

  /**
   * Gets friend-specific settings for a translation config
   * @param {string} id - Translation config identifier
   * @param {string} friendId - Friend identifier
   * @returns {Promise<Object|null>} Friend settings or null if not found
   */
  async getFriendSettings(id, friendId) {
    throw new Error('Method not implemented: getFriendSettings');
  }

  /**
   * Updates friend-specific settings for a translation config
   * @param {string} id - Translation config identifier
   * @param {string} friendId - Friend identifier
   * @param {Object} settings - Friend settings to update
   * @returns {Promise<void>}
   */
  async updateFriendSettings(id, friendId, settings) {
    throw new Error('Method not implemented: updateFriendSettings');
  }

  /**
   * Removes friend-specific settings
   * @param {string} id - Translation config identifier
   * @param {string} friendId - Friend identifier
   * @returns {Promise<void>}
   */
  async removeFriendSettings(id, friendId) {
    throw new Error('Method not implemented: removeFriendSettings');
  }

  /**
   * Validates a translation configuration
   * @param {TranslationConfig} config - Translation configuration to validate
   * @returns {Promise<{valid: boolean, errors: Array<{field: string, reason: string}>}>}
   */
  async validate(config) {
    throw new Error('Method not implemented: validate');
  }
}

module.exports = ITranslationRepository;
