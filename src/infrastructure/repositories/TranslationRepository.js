/**
 * TranslationRepository - Translation Configuration Repository Implementation
 * 
 * Implements the ITranslationRepository interface by wrapping the existing
 * TranslationIntegration and translationService functionality.
 * Maintains backward compatibility while providing the new repository pattern.
 * 
 * @module infrastructure/repositories/TranslationRepository
 */

'use strict';

const ITranslationRepository = require('../../domain/repositories/ITranslationRepository');
const TranslationConfig = require('../../domain/entities/TranslationConfig');

/**
 * TranslationRepository
 * 
 * Repository implementation for translation configurations.
 * Wraps existing translation functionality without modifying it.
 */
class TranslationRepository extends ITranslationRepository {
  /**
   * Creates a new TranslationRepository instance
   * @param {Object} options - Repository options
   * @param {Object} [options.translationService] - Translation service instance
   * @param {Object} [options.translationIntegration] - Translation integration instance
   */
  constructor(options = {}) {
    super();
    
    this._translationService = options.translationService || null;
    this._translationIntegration = options.translationIntegration || null;
    
    // In-memory cache for configs (synced with underlying services)
    this._configCache = new Map();
  }

  /**
   * Sets the translation service instance
   * @param {Object} service - Translation service
   */
  setTranslationService(service) {
    this._translationService = service;
  }

  /**
   * Sets the translation integration instance
   * @param {Object} integration - Translation integration
   */
  setTranslationIntegration(integration) {
    this._translationIntegration = integration;
  }

  /**
   * Finds a translation configuration by ID (account ID)
   * @param {string} id - Account/config identifier
   * @returns {Promise<TranslationConfig|null>}
   */
  async findById(id) {
    try {
      // Try to get from translation service first
      if (this._translationService) {
        const config = this._translationService.getConfig(id);
        if (config) {
          return this._toEntity(id, config);
        }
      }
      
      // Try translation integration
      if (this._translationIntegration) {
        const config = this._translationIntegration.getTranslationConfig(id);
        if (config) {
          return this._toEntity(id, config);
        }
      }
      
      // Check cache
      if (this._configCache.has(id)) {
        return this._configCache.get(id);
      }
      
      return null;
    } catch (error) {
      console.error(`[TranslationRepository] Error finding config by ID ${id}:`, error);
      return null;
    }
  }

  /**
   * Finds all translation configurations
   * @returns {Promise<TranslationConfig[]>}
   */
  async findAll() {
    const configs = [];
    
    // Get from translation integration if available
    if (this._translationIntegration) {
      const allConfigs = this._translationIntegration.getAllTranslationConfigs();
      for (const [accountId, config] of allConfigs) {
        configs.push(this._toEntity(accountId, config));
      }
    }
    
    // Add any cached configs not already included
    for (const [id, config] of this._configCache) {
      if (!configs.find(c => c.id === id)) {
        configs.push(config);
      }
    }
    
    return configs;
  }

  /**
   * Finds translation configurations by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<TranslationConfig[]>}
   */
  async findBy(criteria) {
    const allConfigs = await this.findAll();
    
    return allConfigs.filter(config => {
      for (const [key, value] of Object.entries(criteria)) {
        if (config[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Saves a translation configuration
   * @param {TranslationConfig} entity - Translation config to save
   * @returns {Promise<TranslationConfig>}
   */
  async save(entity) {
    const validation = entity.validate();
    if (!validation.valid) {
      const error = new Error('Validation failed');
      error.validationErrors = validation.errors;
      throw error;
    }
    
    const configData = entity.toJSON();
    
    // Save to translation service
    if (this._translationService) {
      this._translationService.saveConfig(entity.id, configData);
    }
    
    // Update cache
    this._configCache.set(entity.id, entity);
    
    return entity;
  }

  /**
   * Updates a translation configuration
   * @param {string} id - Config identifier
   * @param {Object} data - Data to update
   * @returns {Promise<TranslationConfig>}
   */
  async update(id, data) {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Translation config not found: ${id}`);
    }
    
    // Merge data
    const updatedData = {
      ...existing.toJSON(),
      ...data,
      id, // Ensure ID is preserved
      updatedAt: new Date().toISOString()
    };
    
    const updated = TranslationConfig.fromJSON(updatedData);
    return this.save(updated);
  }

  /**
   * Deletes a translation configuration
   * @param {string} id - Config identifier
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    try {
      // Remove from translation integration
      if (this._translationIntegration) {
        this._translationIntegration.removeAccount(id);
      }
      
      // Remove from cache
      this._configCache.delete(id);
      
      return true;
    } catch (error) {
      console.error(`[TranslationRepository] Error deleting config ${id}:`, error);
      return false;
    }
  }

  /**
   * Checks if a translation configuration exists
   * @param {string} id - Config identifier
   * @returns {Promise<boolean>}
   */
  async exists(id) {
    const config = await this.findById(id);
    return config !== null;
  }

  // ==================== ITranslationRepository Methods ====================

  /**
   * Finds translation configurations by engine
   * @param {string} engine - Translation engine
   * @returns {Promise<TranslationConfig[]>}
   */
  async findByEngine(engine) {
    return this.findBy({ engine });
  }

  /**
   * Finds all enabled translation configurations
   * @returns {Promise<TranslationConfig[]>}
   */
  async findEnabled() {
    return this.findBy({ enabled: true });
  }

  /**
   * Finds translation configurations by target language
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<TranslationConfig[]>}
   */
  async findByTargetLanguage(targetLanguage) {
    return this.findBy({ targetLanguage });
  }

  /**
   * Gets friend-specific settings for a translation config
   * @param {string} id - Translation config identifier
   * @param {string} friendId - Friend identifier
   * @returns {Promise<Object|null>}
   */
  async getFriendSettings(id, friendId) {
    const config = await this.findById(id);
    if (!config) {
      return null;
    }
    return config.getFriendConfig(friendId);
  }

  /**
   * Updates friend-specific settings for a translation config
   * @param {string} id - Translation config identifier
   * @param {string} friendId - Friend identifier
   * @param {Object} settings - Friend settings to update
   * @returns {Promise<void>}
   */
  async updateFriendSettings(id, friendId, settings) {
    const config = await this.findById(id);
    if (!config) {
      throw new Error(`Translation config not found: ${id}`);
    }
    
    config.setFriendConfig(friendId, settings);
    await this.save(config);
  }

  /**
   * Removes friend-specific settings
   * @param {string} id - Translation config identifier
   * @param {string} friendId - Friend identifier
   * @returns {Promise<void>}
   */
  async removeFriendSettings(id, friendId) {
    const config = await this.findById(id);
    if (!config) {
      throw new Error(`Translation config not found: ${id}`);
    }
    
    config.removeFriendConfig(friendId);
    await this.save(config);
  }

  /**
   * Validates a translation configuration
   * @param {TranslationConfig} config - Translation configuration to validate
   * @returns {Promise<{valid: boolean, errors: Array}>}
   */
  async validate(config) {
    if (config instanceof TranslationConfig) {
      return config.validate();
    }
    
    // If raw object, convert to entity first
    try {
      const entity = TranslationConfig.fromJSON(config);
      return entity.validate();
    } catch (error) {
      return {
        valid: false,
        errors: [{ field: 'config', reason: error.message }]
      };
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Converts raw config data to TranslationConfig entity
   * @private
   * @param {string} id - Config identifier
   * @param {Object} config - Raw config data
   * @returns {TranslationConfig}
   */
  _toEntity(id, config) {
    return new TranslationConfig({
      id,
      enabled: config.enabled,
      engine: config.engine,
      apiKey: config.apiKey,
      targetLanguage: config.targetLanguage,
      sourceLanguage: config.sourceLanguage,
      autoTranslate: config.autoTranslate,
      translateInput: config.translateInput,
      inputStyle: config.inputStyle,
      friendSettings: config.friendSettings,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    });
  }

  /**
   * Clears the internal cache
   */
  clearCache() {
    this._configCache.clear();
  }
}

module.exports = TranslationRepository;
