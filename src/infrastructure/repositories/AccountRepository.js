'use strict';

const fs = require('fs').promises;
const path = require('path');
const IAccountRepository = require('../../domain/repositories/IAccountRepository');
const Account = require('../../domain/entities/Account');
const ValidationError = require('../../core/errors/ValidationError');
const StorageError = require('../../core/errors/StorageError');

/**
 * Account Repository Implementation
 * 
 * Provides data access for Account entities using file-based storage.
 * 
 * @extends IAccountRepository
 */
class AccountRepository extends IAccountRepository {
  /**
   * Creates an AccountRepository instance
   * @param {Object} options - Repository options
   * @param {string} [options.storagePath] - Path to storage directory
   * @param {string} [options.fileName] - Name of the accounts file
   */
  constructor(options = {}) {
    super();
    this.storagePath = options.storagePath || 'session-data';
    this.fileName = options.fileName || 'accounts.json';
    this.filePath = path.join(this.storagePath, this.fileName);
    this._cache = null;
    this._cacheTime = null;
    this._cacheTTL = options.cacheTTL || 5000; // 5 seconds cache
  }

  /**
   * Loads accounts from storage
   * @private
   * @returns {Promise<Map<string, Account>>}
   */
  async _load() {
    // Check cache
    if (this._cache && this._cacheTime && (Date.now() - this._cacheTime < this._cacheTTL)) {
      return this._cache;
    }

    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      const accounts = new Map();
      
      for (const item of (Array.isArray(parsed) ? parsed : [])) {
        const account = Account.fromJSON(item);
        accounts.set(account.id, account);
      }
      
      this._cache = accounts;
      this._cacheTime = Date.now();
      return accounts;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty map
        this._cache = new Map();
        this._cacheTime = Date.now();
        return this._cache;
      }
      throw StorageError.readFailed(this.filePath, error);
    }
  }

  /**
   * Saves accounts to storage
   * @private
   * @param {Map<string, Account>} accounts
   * @returns {Promise<void>}
   */
  async _save(accounts) {
    try {
      // Ensure directory exists
      await fs.mkdir(this.storagePath, { recursive: true });
      
      const data = Array.from(accounts.values()).map(a => a.toJSON());
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
      
      // Update cache
      this._cache = accounts;
      this._cacheTime = Date.now();
    } catch (error) {
      throw StorageError.writeFailed(this.filePath, error);
    }
  }

  /**
   * Invalidates the cache
   */
  invalidateCache() {
    this._cache = null;
    this._cacheTime = null;
  }

  // ==================== IRepository Methods ====================

  async findById(id) {
    const accounts = await this._load();
    const account = accounts.get(id);
    return account || null;
  }

  async findAll() {
    const accounts = await this._load();
    return Array.from(accounts.values());
  }

  async findBy(criteria) {
    const accounts = await this._load();
    return Array.from(accounts.values()).filter(account => {
      for (const [key, value] of Object.entries(criteria)) {
        if (account[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  async save(entity) {
    // Validate before saving
    const validation = entity.validate();
    if (!validation.valid) {
      throw new ValidationError('Account validation failed', {
        fields: validation.errors
      });
    }

    const accounts = await this._load();
    accounts.set(entity.id, entity);
    await this._save(accounts);
    return entity;
  }

  async update(id, data) {
    const accounts = await this._load();
    const existing = accounts.get(id);
    
    if (!existing) {
      throw new ValidationError(`Account not found: ${id}`, {
        fields: [{ field: 'id', reason: 'Account does not exist', value: id }]
      });
    }

    // Create updated account
    const updated = new Account({
      ...existing.toJSON(),
      ...data,
      id: existing.id // Ensure ID cannot be changed
    });

    // Validate updated account
    const validation = updated.validate();
    if (!validation.valid) {
      throw new ValidationError('Account validation failed', {
        fields: validation.errors
      });
    }

    accounts.set(id, updated);
    await this._save(accounts);
    return updated;
  }

  async delete(id) {
    const accounts = await this._load();
    const existed = accounts.has(id);
    
    if (existed) {
      accounts.delete(id);
      await this._save(accounts);
    }
    
    return existed;
  }

  async exists(id) {
    const accounts = await this._load();
    return accounts.has(id);
  }

  async count() {
    const accounts = await this._load();
    return accounts.size;
  }

  async deleteAll() {
    await this._save(new Map());
  }

  // ==================== IAccountRepository Methods ====================

  async findByName(name) {
    const accounts = await this._load();
    for (const account of accounts.values()) {
      if (account.name === name) {
        return account;
      }
    }
    return null;
  }

  async findActive() {
    const accounts = await this._load();
    return Array.from(accounts.values()).filter(
      account => account.status === Account.Status.Active
    );
  }

  async findAutoStart() {
    const accounts = await this._load();
    return Array.from(accounts.values()).filter(
      account => account.autoStart === true
    );
  }

  async updateLastActive(id) {
    const accounts = await this._load();
    const account = accounts.get(id);
    
    if (!account) {
      throw new ValidationError(`Account not found: ${id}`, {
        fields: [{ field: 'id', reason: 'Account does not exist', value: id }]
      });
    }

    account.updateLastActive();
    await this._save(accounts);
  }

  async findByStatus(status) {
    const accounts = await this._load();
    return Array.from(accounts.values()).filter(
      account => account.status === status
    );
  }

  async findAllOrdered() {
    const accounts = await this._load();
    return Array.from(accounts.values()).sort((a, b) => a.order - b.order);
  }

  async updateOrder(orderUpdates) {
    const accounts = await this._load();
    
    for (const { id, order } of orderUpdates) {
      const account = accounts.get(id);
      if (account) {
        account.order = order;
      }
    }
    
    await this._save(accounts);
  }
}

module.exports = AccountRepository;
