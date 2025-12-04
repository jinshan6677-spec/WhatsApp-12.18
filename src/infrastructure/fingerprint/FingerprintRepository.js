/**
 * Fingerprint Repository
 * 指纹仓库
 * 
 * Provides data access for FingerprintConfig entities using file-based storage.
 * Integrates with SeedManager for secure seed encryption.
 * 
 * @module infrastructure/fingerprint/FingerprintRepository
 * 
 * Requirements:
 * - 2.2: Persist fingerprint configuration to account data file
 * - 2.3: Load all saved account fingerprint configurations on app startup
 */

'use strict';

const fs = require('fs').promises;
const path = require('path');
const FingerprintConfig = require('../../domain/fingerprint/FingerprintConfig');
const { SeedManager, SeedError } = require('./SeedManager');

/**
 * Error class for fingerprint repository errors
 */
class FingerprintRepositoryError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'FingerprintRepositoryError';
    this.code = code;
    this.details = details;
  }

  static readFailed(filePath, originalError) {
    return new FingerprintRepositoryError(
      `Failed to read fingerprint data from ${filePath}`,
      'READ_FAILED',
      { filePath, originalError: originalError.message }
    );
  }

  static writeFailed(filePath, originalError) {
    return new FingerprintRepositoryError(
      `Failed to write fingerprint data to ${filePath}`,
      'WRITE_FAILED',
      { filePath, originalError: originalError.message }
    );
  }

  static notFound(id) {
    return new FingerprintRepositoryError(
      `Fingerprint configuration not found: ${id}`,
      'NOT_FOUND',
      { id }
    );
  }

  static validationFailed(errors) {
    return new FingerprintRepositoryError(
      'Fingerprint configuration validation failed',
      'VALIDATION_FAILED',
      { errors }
    );
  }
}

/**
 * Fingerprint Repository
 * Manages persistence of FingerprintConfig entities with secure seed encryption
 */
class FingerprintRepository {
  /**
   * Creates a FingerprintRepository instance
   * @param {Object} options - Repository options
   * @param {string} [options.storagePath] - Path to storage directory
   * @param {string} [options.fileName] - Name of the fingerprints file
   * @param {SeedManager} [options.seedManager] - SeedManager instance for seed encryption
   * @param {number} [options.cacheTTL] - Cache time-to-live in milliseconds
   */
  constructor(options = {}) {
    this.storagePath = options.storagePath || 'session-data';
    this.fileName = options.fileName || 'fingerprints.json';
    this.filePath = path.join(this.storagePath, this.fileName);
    this.seedManager = options.seedManager || new SeedManager();
    this._cache = null;
    this._cacheTime = null;
    this._cacheTTL = options.cacheTTL || 5000; // 5 seconds cache
  }

  /**
   * Loads fingerprint configurations from storage
   * @private
   * @returns {Promise<Map<string, Object>>} Map of fingerprint ID to stored data
   */
  async _load() {
    // Check cache
    if (this._cache && this._cacheTime && (Date.now() - this._cacheTime < this._cacheTTL)) {
      return this._cache;
    }

    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      const fingerprints = new Map();
      
      // Handle both array and object formats
      const items = parsed.fingerprints || parsed;
      const itemsArray = Array.isArray(items) ? items : Object.values(items);
      
      for (const item of itemsArray) {
        if (item && item.id) {
          fingerprints.set(item.id, item);
        }
      }
      
      this._cache = fingerprints;
      this._cacheTime = Date.now();
      return fingerprints;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty map
        this._cache = new Map();
        this._cacheTime = Date.now();
        return this._cache;
      }
      throw FingerprintRepositoryError.readFailed(this.filePath, error);
    }
  }

  /**
   * Saves fingerprint configurations to storage
   * @private
   * @param {Map<string, Object>} fingerprints - Map of fingerprint data
   * @returns {Promise<void>}
   */
  async _save(fingerprints) {
    try {
      // Ensure directory exists
      await fs.mkdir(this.storagePath, { recursive: true });
      
      const data = {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        fingerprints: Array.from(fingerprints.values())
      };
      
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
      
      // Update cache
      this._cache = fingerprints;
      this._cacheTime = Date.now();
    } catch (error) {
      throw FingerprintRepositoryError.writeFailed(this.filePath, error);
    }
  }

  /**
   * Invalidates the cache
   */
  invalidateCache() {
    this._cache = null;
    this._cacheTime = null;
  }

  /**
   * Encrypts the noise seed in a fingerprint config
   * @private
   * @param {FingerprintConfig} config - Fingerprint configuration
   * @returns {Object} Config data with encrypted seed
   */
  _encryptSeed(config) {
    const configData = config.toJSON();
    
    // If seed is not already encrypted, encrypt it
    if (configData.noiseSeed && !configData.noiseSeed.encrypted) {
      const seedValue = configData.noiseSeed.value;
      const accountId = configData.accountId || configData.id;
      
      if (typeof seedValue === 'number') {
        const encryptedSeed = this.seedManager.encryptSeed(seedValue, accountId);
        configData.noiseSeed = {
          encrypted: true,
          ...encryptedSeed
        };
      }
    }
    
    return configData;
  }

  /**
   * Decrypts the noise seed in stored fingerprint data
   * @private
   * @param {Object} storedData - Stored fingerprint data
   * @returns {Object} Config data with decrypted seed
   */
  _decryptSeed(storedData) {
    const configData = { ...storedData };
    
    // If seed is encrypted, decrypt it
    if (configData.noiseSeed && configData.noiseSeed.encrypted) {
      try {
        const accountId = configData.accountId || configData.id;
        const decrypted = this.seedManager.decryptSeed(configData.noiseSeed, accountId);
        configData.noiseSeed = {
          encrypted: false,
          value: decrypted.seed
        };
      } catch (error) {
        // If decryption fails, generate a new seed
        console.warn(`Failed to decrypt seed for fingerprint ${configData.id}, generating new seed:`, error.message);
        configData.noiseSeed = {
          encrypted: false,
          value: this.seedManager.generateSecureSeed()
        };
      }
    }
    
    return configData;
  }

  // ==================== Public Methods ====================

  /**
   * Saves a fingerprint configuration
   * @param {FingerprintConfig} config - Fingerprint configuration to save
   * @returns {Promise<FingerprintConfig>} Saved configuration
   * 
   * Requirement: 2.2 - Persist fingerprint configuration to account data file
   */
  async save(config) {
    if (!(config instanceof FingerprintConfig)) {
      throw new FingerprintRepositoryError(
        'Invalid config: expected FingerprintConfig instance',
        'INVALID_CONFIG'
      );
    }

    // Validate before saving
    const validation = config.validate();
    if (!validation.valid) {
      throw FingerprintRepositoryError.validationFailed(validation.errors);
    }

    const fingerprints = await this._load();

    for (const [id, storedData] of fingerprints.entries()) {
      if (storedData.accountId === config.accountId) {
        fingerprints.delete(id);
      }
    }
    
    // Encrypt seed before storing
    const configData = this._encryptSeed(config);
    
    fingerprints.set(config.id, configData);
    await this._save(fingerprints);
    
    return config;
  }

  /**
   * Loads a fingerprint configuration by ID
   * @param {string} id - Fingerprint configuration ID
   * @returns {Promise<FingerprintConfig|null>} Loaded configuration or null if not found
   * 
   * Requirement: 2.3 - Load all saved account fingerprint configurations on app startup
   */
  async load(id) {
    if (!id || typeof id !== 'string') {
      throw new FingerprintRepositoryError(
        'Invalid ID: expected non-empty string',
        'INVALID_ID'
      );
    }

    const fingerprints = await this._load();
    const storedData = fingerprints.get(id);
    
    if (!storedData) {
      return null;
    }
    
    // Decrypt seed before returning
    const configData = this._decryptSeed(storedData);
    
    return FingerprintConfig.fromJSON(configData);
  }

  /**
   * Loads a fingerprint configuration by account ID
   * @param {string} accountId - Account ID
   * @returns {Promise<FingerprintConfig|null>} Loaded configuration or null if not found
   */
  async loadByAccountId(accountId) {
    if (!accountId || typeof accountId !== 'string') {
      throw new FingerprintRepositoryError(
        'Invalid account ID: expected non-empty string',
        'INVALID_ACCOUNT_ID'
      );
    }

    const fingerprints = await this._load();
    let match = null;
    for (const storedData of fingerprints.values()) {
      if (storedData.accountId === accountId) {
        match = storedData;
      }
    }
    if (!match) return null;
    const configData = this._decryptSeed(match);
    return FingerprintConfig.fromJSON(configData);
  }

  /**
   * Loads all fingerprint configurations
   * @returns {Promise<FingerprintConfig[]>} Array of all configurations
   * 
   * Requirement: 2.3 - Load all saved account fingerprint configurations on app startup
   */
  async loadAll() {
    const fingerprints = await this._load();
    const configs = [];
    
    for (const storedData of fingerprints.values()) {
      const configData = this._decryptSeed(storedData);
      configs.push(FingerprintConfig.fromJSON(configData));
    }
    
    return configs;
  }

  /**
   * Deletes a fingerprint configuration by ID
   * @param {string} id - Fingerprint configuration ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(id) {
    if (!id || typeof id !== 'string') {
      throw new FingerprintRepositoryError(
        'Invalid ID: expected non-empty string',
        'INVALID_ID'
      );
    }

    const fingerprints = await this._load();
    const existed = fingerprints.has(id);
    
    if (existed) {
      fingerprints.delete(id);
      await this._save(fingerprints);
    }
    
    return existed;
  }

  /**
   * Deletes a fingerprint configuration by account ID
   * @param {string} accountId - Account ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteByAccountId(accountId) {
    if (!accountId || typeof accountId !== 'string') {
      throw new FingerprintRepositoryError(
        'Invalid account ID: expected non-empty string',
        'INVALID_ACCOUNT_ID'
      );
    }

    const fingerprints = await this._load();
    let deleted = false;
    
    for (const [id, storedData] of fingerprints.entries()) {
      if (storedData.accountId === accountId) {
        fingerprints.delete(id);
        deleted = true;
        break;
      }
    }
    
    if (deleted) {
      await this._save(fingerprints);
    }
    
    return deleted;
  }

  /**
   * Checks if a fingerprint configuration exists
   * @param {string} id - Fingerprint configuration ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(id) {
    const fingerprints = await this._load();
    return fingerprints.has(id);
  }

  /**
   * Checks if a fingerprint configuration exists for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<boolean>} True if exists
   */
  async existsByAccountId(accountId) {
    const fingerprints = await this._load();
    
    for (const storedData of fingerprints.values()) {
      if (storedData.accountId === accountId) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Returns the count of stored fingerprint configurations
   * @returns {Promise<number>} Count of configurations
   */
  async count() {
    const fingerprints = await this._load();
    return fingerprints.size;
  }

  /**
   * Deletes all fingerprint configurations
   * @returns {Promise<void>}
   */
  async deleteAll() {
    await this._save(new Map());
  }

  /**
   * Updates a fingerprint configuration
   * @param {string} id - Fingerprint configuration ID
   * @param {Object} updates - Partial configuration updates
   * @returns {Promise<FingerprintConfig>} Updated configuration
   */
  async update(id, updates) {
    const existing = await this.load(id);
    
    if (!existing) {
      throw FingerprintRepositoryError.notFound(id);
    }

    // Apply updates
    existing.update(updates);

    // Validate updated config
    const validation = existing.validate();
    if (!validation.valid) {
      throw FingerprintRepositoryError.validationFailed(validation.errors);
    }

    // Save updated config
    return this.save(existing);
  }

  /**
   * Rotates the noise seed for a fingerprint configuration
   * @param {string} id - Fingerprint configuration ID
   * @param {Object} [options] - Rotation options
   * @param {string} [options.reason] - Reason for rotation
   * @returns {Promise<FingerprintConfig>} Updated configuration with new seed
   */
  async rotateSeed(id, options = {}) {
    const config = await this.load(id);
    
    if (!config) {
      throw FingerprintRepositoryError.notFound(id);
    }

    const accountId = config.accountId || config.id;
    const oldSeed = config.noiseSeed.value;
    
    // Rotate seed using SeedManager
    const rotationResult = this.seedManager.rotateSeed(accountId, oldSeed, options);
    
    // Update config with new seed
    config.update({
      noiseSeed: {
        encrypted: false,
        value: rotationResult.newSeed
      },
      seedVersion: (config.seedVersion || 1) + 1,
      seedRotatedAt: rotationResult.rotatedAt
    });

    // Save updated config
    return this.save(config);
  }

  /**
   * Exports a fingerprint configuration for sharing
   * @param {string} id - Fingerprint configuration ID
   * @param {Object} [options] - Export options
   * @param {boolean} [options.includeSeed=false] - Whether to include the seed
   * @returns {Promise<Object>} Exported configuration data
   */
  async export(id, options = {}) {
    const config = await this.load(id);
    
    if (!config) {
      throw FingerprintRepositoryError.notFound(id);
    }

    const configData = config.toJSON();
    
    if (!options.includeSeed) {
      // Remove seed data for export
      configData.noiseSeed = {
        exported: true,
        includedSeed: false
      };
    }
    
    return {
      ...configData,
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0.0'
    };
  }

  /**
   * Imports a fingerprint configuration
   * @param {Object} exportedData - Exported configuration data
   * @param {string} [accountId] - Account ID to bind the imported config to
   * @returns {Promise<FingerprintConfig>} Imported configuration
   */
  async import(exportedData, accountId = null) {
    if (!exportedData || typeof exportedData !== 'object') {
      throw new FingerprintRepositoryError(
        'Invalid export data: expected object',
        'INVALID_EXPORT_DATA'
      );
    }

    // Create new config from exported data
    const configData = { ...exportedData };
    
    // Generate new ID for imported config
    configData.id = require('crypto').randomUUID();
    
    // Set account ID if provided
    if (accountId) {
      configData.accountId = accountId;
    }
    
    // Handle seed
    if (!configData.noiseSeed || !configData.noiseSeed.value) {
      // Generate new seed if not included
      configData.noiseSeed = {
        encrypted: false,
        value: this.seedManager.generateSecureSeed()
      };
    }
    
    // Reset timestamps
    configData.createdAt = new Date().toISOString();
    configData.updatedAt = new Date().toISOString();
    
    // Remove export metadata
    delete configData.exportedAt;
    delete configData.exportVersion;
    
    const config = FingerprintConfig.fromJSON(configData);
    
    return this.save(config);
  }
}

module.exports = {
  FingerprintRepository,
  FingerprintRepositoryError
};
