/**
 * Seed Security Manager
 * 种子安全管理器
 * 
 * Securely generates, stores, and manages noise seeds for fingerprint spoofing.
 * Uses AES-256-GCM encryption to protect seeds and binds them to account IDs.
 * 
 * @module infrastructure/fingerprint/SeedManager
 * 
 * Requirements:
 * - 51.1: Generate secure seed using cryptographic random number generator
 * - 51.2: Encrypt seed storage and bind to account ID
 * - 51.3: Provide option to include/exclude seed when exporting fingerprint config
 * - 51.4: Support manual and automatic seed rotation
 * - 51.5: Support versioning and backward compatibility
 */

'use strict';

const crypto = require('crypto');

// Encryption constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const CURRENT_VERSION = 1;

/**
 * Error class for seed-related errors
 */
class SeedError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SeedError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Seed Security Manager
 * Manages secure generation, encryption, and rotation of noise seeds
 */
class SeedManager {
  /**
   * Create a new SeedManager instance
   * @param {Object} options - Configuration options
   * @param {Buffer|string} [options.encryptionKey] - 32-byte encryption key (will be derived if not provided)
   * @param {string} [options.salt] - Salt for key derivation
   */
  constructor(options = {}) {
    if (options.encryptionKey) {
      this.encryptionKey = this._normalizeKey(options.encryptionKey);
    } else {
      // Derive key from machine-specific data
      this.encryptionKey = this._deriveKey(options.salt || 'fingerprint-seed-salt-v1');
    }
  }

  /**
   * Normalize encryption key to Buffer
   * @param {Buffer|string} key - Encryption key
   * @returns {Buffer} Normalized key
   * @private
   */
  _normalizeKey(key) {
    if (Buffer.isBuffer(key)) {
      if (key.length !== KEY_LENGTH) {
        throw new SeedError(
          `Encryption key must be ${KEY_LENGTH} bytes`,
          'INVALID_KEY_LENGTH',
          { expected: KEY_LENGTH, actual: key.length }
        );
      }
      return key;
    }
    
    if (typeof key === 'string') {
      // If it's a hex string, convert it
      if (/^[0-9a-f]+$/i.test(key) && key.length === KEY_LENGTH * 2) {
        return Buffer.from(key, 'hex');
      }
      // Otherwise, derive a key from the string
      return this._deriveKey(key);
    }
    
    throw new SeedError('Invalid encryption key type', 'INVALID_KEY_TYPE');
  }

  /**
   * Derive encryption key from a seed string
   * @param {string} seed - Seed string for key derivation
   * @returns {Buffer} Derived key
   * @private
   */
  _deriveKey(seed) {
    try {
      // Try to use machine ID for additional entropy
      let machineId = '';
      try {
        const { machineIdSync } = require('node-machine-id');
        machineId = machineIdSync();
      } catch (e) {
        // Machine ID not available, use fallback
        machineId = 'fallback-machine-id';
      }
      
      const combinedSeed = `${seed}:${machineId}`;
      const salt = Buffer.from('fingerprint-seed-manager-v1', 'utf8');
      return crypto.pbkdf2Sync(combinedSeed, salt, 100000, KEY_LENGTH, 'sha256');
    } catch (error) {
      throw new SeedError(
        'Failed to derive encryption key',
        'KEY_DERIVATION_FAILED',
        { originalError: error.message }
      );
    }
  }

  /**
   * Generate a cryptographically secure seed
   * Uses crypto.randomBytes for secure random number generation
   * 
   * @returns {number} A secure 32-bit unsigned integer seed
   * 
   * Requirement: 51.1 - Generate secure seed using cryptographic random number generator
   */
  generateSecureSeed() {
    const buffer = crypto.randomBytes(4);
    // Convert to unsigned 32-bit integer
    return buffer.readUInt32BE(0);
  }

  /**
   * Encrypt a seed with account binding
   * 
   * @param {number} seed - The seed to encrypt
   * @param {string} accountId - The account ID to bind the seed to
   * @returns {Object} Encrypted seed data with iv, authTag, data, and metadata
   * 
   * Requirement: 51.2 - Encrypt seed storage and bind to account ID
   */
  encryptSeed(seed, accountId) {
    if (typeof seed !== 'number' || !Number.isInteger(seed)) {
      throw new SeedError('Seed must be an integer', 'INVALID_SEED_TYPE');
    }
    
    if (!accountId || typeof accountId !== 'string') {
      throw new SeedError('Account ID must be a non-empty string', 'INVALID_ACCOUNT_ID');
    }

    try {
      // Create payload with seed, account binding, and version
      const payload = JSON.stringify({
        seed,
        accountId,
        version: CURRENT_VERSION,
        createdAt: new Date().toISOString()
      });

      // Generate random IV
      const iv = crypto.randomBytes(IV_LENGTH);

      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);

      // Encrypt
      let encrypted = cipher.update(payload, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get auth tag
      const authTag = cipher.getAuthTag();

      return {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        data: encrypted,
        version: CURRENT_VERSION,
        accountId: this.hashAccountId(accountId) // Store hashed account ID for verification
      };
    } catch (error) {
      throw new SeedError(
        'Failed to encrypt seed',
        'ENCRYPTION_FAILED',
        { originalError: error.message }
      );
    }
  }

  /**
   * Decrypt an encrypted seed
   * 
   * @param {Object} encryptedData - The encrypted seed data
   * @param {string} encryptedData.iv - Initialization vector (hex)
   * @param {string} encryptedData.authTag - Authentication tag (hex)
   * @param {string} encryptedData.data - Encrypted data (hex)
   * @param {string} [expectedAccountId] - Optional account ID to verify binding
   * @returns {Object} Decrypted seed data with seed, accountId, version, and createdAt
   * 
   * Requirement: 51.2 - Encrypt seed storage and bind to account ID
   */
  decryptSeed(encryptedData, expectedAccountId = null) {
    if (!encryptedData || typeof encryptedData !== 'object') {
      throw new SeedError('Invalid encrypted data format', 'INVALID_ENCRYPTED_DATA');
    }

    const { iv, authTag, data, accountId: storedAccountIdHash } = encryptedData;

    if (!iv || !authTag || !data) {
      throw new SeedError(
        'Missing required encrypted data fields',
        'MISSING_ENCRYPTED_FIELDS',
        { hasIv: !!iv, hasAuthTag: !!authTag, hasData: !!data }
      );
    }

    try {
      // Convert hex strings to buffers
      const ivBuffer = Buffer.from(iv, 'hex');
      const authTagBuffer = Buffer.from(authTag, 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, ivBuffer);
      decipher.setAuthTag(authTagBuffer);

      // Decrypt
      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Parse payload
      const payload = JSON.parse(decrypted);

      // Verify account binding if expected account ID is provided
      if (expectedAccountId) {
        const expectedHash = this.hashAccountId(expectedAccountId);
        if (storedAccountIdHash && storedAccountIdHash !== expectedHash) {
          throw new SeedError(
            'Account ID mismatch - seed is bound to a different account',
            'ACCOUNT_MISMATCH',
            { expected: expectedHash, actual: storedAccountIdHash }
          );
        }
        
        // Also verify the account ID in the payload
        if (payload.accountId !== expectedAccountId) {
          throw new SeedError(
            'Account ID mismatch in payload',
            'PAYLOAD_ACCOUNT_MISMATCH'
          );
        }
      }

      return payload;
    } catch (error) {
      if (error instanceof SeedError) {
        throw error;
      }
      throw new SeedError(
        'Failed to decrypt seed',
        'DECRYPTION_FAILED',
        { originalError: error.message }
      );
    }
  }

  /**
   * Rotate a seed - generate a new seed and record rotation history
   * 
   * @param {string} accountId - The account ID
   * @param {number} oldSeed - The old seed being rotated
   * @param {Object} [options] - Rotation options
   * @param {string} [options.reason] - Reason for rotation
   * @returns {Object} Rotation result with newSeed, rotatedAt, previousSeedHash, and version
   * 
   * Requirement: 51.4 - Support manual and automatic seed rotation
   */
  rotateSeed(accountId, oldSeed, options = {}) {
    if (!accountId || typeof accountId !== 'string') {
      throw new SeedError('Account ID must be a non-empty string', 'INVALID_ACCOUNT_ID');
    }

    if (typeof oldSeed !== 'number' || !Number.isInteger(oldSeed)) {
      throw new SeedError('Old seed must be an integer', 'INVALID_OLD_SEED');
    }

    const newSeed = this.generateSecureSeed();
    const rotatedAt = new Date().toISOString();

    return {
      newSeed,
      rotatedAt,
      previousSeedHash: this.hashSeed(oldSeed),
      accountId,
      version: CURRENT_VERSION,
      reason: options.reason || 'manual'
    };
  }

  /**
   * Hash a seed for logging/audit purposes (does not expose original value)
   * Uses SHA-256 for secure hashing
   * 
   * @param {number} seed - The seed to hash
   * @returns {string} Hex-encoded hash of the seed
   */
  hashSeed(seed) {
    if (typeof seed !== 'number') {
      throw new SeedError('Seed must be a number', 'INVALID_SEED_TYPE');
    }
    
    const hash = crypto.createHash('sha256');
    hash.update(seed.toString());
    return hash.digest('hex').substring(0, 16); // Return first 16 chars for brevity
  }

  /**
   * Hash an account ID for storage (privacy protection)
   * 
   * @param {string} accountId - The account ID to hash
   * @returns {string} Hex-encoded hash of the account ID
   */
  hashAccountId(accountId) {
    if (!accountId || typeof accountId !== 'string') {
      throw new SeedError('Account ID must be a non-empty string', 'INVALID_ACCOUNT_ID');
    }
    
    const hash = crypto.createHash('sha256');
    hash.update(accountId);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Prepare seed data for export (with option to include/exclude seed)
   * 
   * @param {Object} encryptedSeedData - The encrypted seed data
   * @param {Object} options - Export options
   * @param {boolean} [options.includeSeed=false] - Whether to include the actual seed
   * @param {string} [options.accountId] - Account ID for decryption if includeSeed is true
   * @returns {Object} Export-ready seed data
   * 
   * Requirement: 51.3 - Provide option to include/exclude seed when exporting
   */
  prepareForExport(encryptedSeedData, options = {}) {
    const { includeSeed = false, accountId } = options;

    if (includeSeed) {
      if (!accountId) {
        throw new SeedError(
          'Account ID required to export seed',
          'ACCOUNT_ID_REQUIRED_FOR_EXPORT'
        );
      }
      
      // Decrypt and include the seed
      const decrypted = this.decryptSeed(encryptedSeedData, accountId);
      return {
        seed: decrypted.seed,
        version: decrypted.version,
        exportedAt: new Date().toISOString(),
        includedSeed: true
      };
    }

    // Export without seed - only metadata
    return {
      seedHash: encryptedSeedData.accountId, // This is the hashed account ID
      version: encryptedSeedData.version,
      exportedAt: new Date().toISOString(),
      includedSeed: false
    };
  }

  /**
   * Import seed data from export
   * 
   * @param {Object} exportData - The exported seed data
   * @param {string} accountId - The account ID to bind the imported seed to
   * @returns {Object} Encrypted seed data ready for storage
   * 
   * Requirement: 51.3 - Provide option to include/exclude seed when exporting
   */
  importSeed(exportData, accountId) {
    if (!exportData || typeof exportData !== 'object') {
      throw new SeedError('Invalid export data', 'INVALID_EXPORT_DATA');
    }

    if (!accountId || typeof accountId !== 'string') {
      throw new SeedError('Account ID must be a non-empty string', 'INVALID_ACCOUNT_ID');
    }

    let seed;
    
    if (exportData.includedSeed && typeof exportData.seed === 'number') {
      // Use the exported seed
      seed = exportData.seed;
    } else {
      // Generate a new seed since the export didn't include one
      seed = this.generateSecureSeed();
    }

    // Encrypt and bind to the new account
    return this.encryptSeed(seed, accountId);
  }

  /**
   * Validate encrypted seed data structure
   * 
   * @param {Object} encryptedData - The encrypted seed data to validate
   * @returns {Object} Validation result with isValid and errors
   */
  validateEncryptedData(encryptedData) {
    const errors = [];

    if (!encryptedData || typeof encryptedData !== 'object') {
      return { isValid: false, errors: ['Encrypted data must be an object'] };
    }

    if (!encryptedData.iv || typeof encryptedData.iv !== 'string') {
      errors.push('Missing or invalid IV');
    } else if (!/^[0-9a-f]+$/i.test(encryptedData.iv)) {
      errors.push('IV must be a hex string');
    } else if (encryptedData.iv.length !== IV_LENGTH * 2) {
      errors.push(`IV must be ${IV_LENGTH * 2} hex characters`);
    }

    if (!encryptedData.authTag || typeof encryptedData.authTag !== 'string') {
      errors.push('Missing or invalid auth tag');
    } else if (!/^[0-9a-f]+$/i.test(encryptedData.authTag)) {
      errors.push('Auth tag must be a hex string');
    } else if (encryptedData.authTag.length !== AUTH_TAG_LENGTH * 2) {
      errors.push(`Auth tag must be ${AUTH_TAG_LENGTH * 2} hex characters`);
    }

    if (!encryptedData.data || typeof encryptedData.data !== 'string') {
      errors.push('Missing or invalid encrypted data');
    } else if (!/^[0-9a-f]+$/i.test(encryptedData.data)) {
      errors.push('Encrypted data must be a hex string');
    }

    if (encryptedData.version !== undefined && typeof encryptedData.version !== 'number') {
      errors.push('Version must be a number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if seed data needs migration to a newer version
   * 
   * @param {Object} encryptedData - The encrypted seed data
   * @returns {boolean} True if migration is needed
   * 
   * Requirement: 51.5 - Support versioning and backward compatibility
   */
  needsMigration(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'object') {
      return false;
    }
    
    const version = encryptedData.version || 0;
    return version < CURRENT_VERSION;
  }

  /**
   * Migrate seed data to the current version
   * 
   * @param {Object} encryptedData - The encrypted seed data to migrate
   * @param {string} accountId - The account ID
   * @returns {Object} Migrated encrypted seed data
   * 
   * Requirement: 51.5 - Support versioning and backward compatibility
   */
  migrateSeedData(encryptedData, accountId) {
    if (!this.needsMigration(encryptedData)) {
      return encryptedData;
    }

    // Decrypt with old format
    const decrypted = this.decryptSeed(encryptedData, accountId);
    
    // Re-encrypt with current version
    return this.encryptSeed(decrypted.seed, accountId);
  }

  /**
   * Get the current version number
   * @returns {number} Current version
   */
  static get VERSION() {
    return CURRENT_VERSION;
  }
}

module.exports = {
  SeedManager,
  SeedError,
  CURRENT_VERSION
};
