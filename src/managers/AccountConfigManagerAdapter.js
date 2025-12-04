/**
 * AccountConfigManagerAdapter - Adapter for AccountConfigManager to Repository pattern
 * 
 * Provides backward compatibility while integrating with the new Repository pattern.
 * Wraps the existing AccountConfigManager and delegates to AccountRepository when available.
 * 
 * @module managers/AccountConfigManagerAdapter
 */

'use strict';

const AccountConfigManager = require('./AccountConfigManager');
const AccountRepository = require('../infrastructure/repositories/AccountRepository');
const Account = require('../domain/entities/Account');

/**
 * AccountConfigManagerAdapter class
 * 
 * Provides a unified interface that works with both the legacy AccountConfigManager
 * and the new AccountRepository pattern.
 */
class AccountConfigManagerAdapter {
  /**
   * Creates an AccountConfigManagerAdapter instance
   * @param {Object} options - Configuration options
   * @param {string} [options.cwd] - Configuration file directory
   * @param {string} [options.storagePath] - Storage path for repository
   * @param {boolean} [options.useRepository=false] - Whether to use the new Repository pattern
   */
  constructor(options = {}) {
    this._options = options;
    this._useRepository = options.useRepository || false;
    
    // Initialize the appropriate backend
    if (this._useRepository) {
      this._repository = new AccountRepository({
        storagePath: options.storagePath || options.cwd || 'session-data'
      });
      this._legacyManager = null;
    } else {
      this._legacyManager = new AccountConfigManager(options);
      this._repository = null;
    }
  }


  /**
   * Load all accounts
   * @param {Object} [options] - Load options
   * @param {boolean} [options.sorted] - Whether to sort by order
   * @returns {Promise<Array>}
   */
  async loadAccounts(options = {}) {
    if (this._useRepository) {
      const accounts = options.sorted 
        ? await this._repository.findAllOrdered()
        : await this._repository.findAll();
      return accounts;
    }
    return this._legacyManager.loadAccounts(options);
  }

  /**
   * Get a single account by ID
   * @param {string} accountId - Account ID
   * @returns {Promise<Object|null>}
   */
  async getAccount(accountId) {
    if (this._useRepository) {
      return this._repository.findById(accountId);
    }
    return this._legacyManager.getAccount(accountId);
  }

  /**
   * Save an account
   * @param {Object} accountConfig - Account configuration
   * @returns {Promise<{success: boolean, errors?: string[]}>}
   */
  async saveAccount(accountConfig) {
    if (this._useRepository) {
      try {
        const account = accountConfig instanceof Account 
          ? accountConfig 
          : Account.fromJSON(accountConfig.toJSON ? accountConfig.toJSON() : accountConfig);
        await this._repository.save(account);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          errors: [error.message]
        };
      }
    }
    return this._legacyManager.saveAccount(accountConfig);
  }

  /**
   * Create a new account
   * @param {Object} config - Account configuration options
   * @returns {Promise<{success: boolean, account?: Object, errors?: string[]}>}
   */
  async createAccount(config = {}) {
    if (this._useRepository) {
      try {
        const account = new Account(config);
        const saved = await this._repository.save(account);
        return { success: true, account: saved };
      } catch (error) {
        return {
          success: false,
          errors: [error.message]
        };
      }
    }
    return this._legacyManager.createAccount(config);
  }

  /**
   * Update an account
   * @param {string} accountId - Account ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<{success: boolean, account?: Object, errors?: string[]}>}
   */
  async updateAccount(accountId, updates) {
    if (this._useRepository) {
      try {
        const updated = await this._repository.update(accountId, updates);
        return { success: true, account: updated };
      } catch (error) {
        return {
          success: false,
          errors: [error.message]
        };
      }
    }
    return this._legacyManager.updateAccount(accountId, updates);
  }

  /**
   * Delete an account
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Delete options
   * @returns {Promise<{success: boolean, errors?: string[]}>}
   */
  async deleteAccount(accountId, options = {}) {
    if (this._useRepository) {
      try {
        await this._repository.delete(accountId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          errors: [error.message]
        };
      }
    }
    return this._legacyManager.deleteAccount(accountId, options);
  }

  /**
   * Check if an account exists
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  accountExists(accountId) {
    if (this._useRepository) {
      // Note: This is synchronous for backward compatibility
      // In repository mode, we check the cache
      return this._repository._cache ? this._repository._cache.has(accountId) : false;
    }
    return this._legacyManager.accountExists(accountId);
  }

  /**
   * Get all account IDs
   * @returns {string[]}
   */
  getAllAccountIds() {
    if (this._useRepository) {
      return this._repository._cache ? Array.from(this._repository._cache.keys()) : [];
    }
    return this._legacyManager.getAllAccountIds();
  }

  /**
   * Get account count
   * @returns {number}
   */
  getAccountCount() {
    if (this._useRepository) {
      return this._repository._cache ? this._repository._cache.size : 0;
    }
    return this._legacyManager.getAccountCount();
  }


  /**
   * Reorder accounts
   * @param {string[]} accountIds - Account IDs in new order
   * @returns {Promise<{success: boolean, errors?: string[]}>}
   */
  async reorderAccounts(accountIds) {
    if (this._useRepository) {
      try {
        const orderUpdates = accountIds.map((id, index) => ({ id, order: index }));
        await this._repository.updateOrder(orderUpdates);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          errors: [error.message]
        };
      }
    }
    return this._legacyManager.reorderAccounts(accountIds);
  }

  /**
   * Get accounts sorted by order
   * @returns {Promise<Array>}
   */
  async getAccountsSorted() {
    if (this._useRepository) {
      return this._repository.findAllOrdered();
    }
    return this._legacyManager.getAccountsSorted();
  }

  /**
   * Export all accounts
   * @returns {Promise<Object>}
   */
  async exportAccounts() {
    if (this._useRepository) {
      const accounts = await this._repository.findAll();
      return {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        accounts: accounts.map(a => a.toJSON())
      };
    }
    return this._legacyManager.exportAccounts();
  }

  /**
   * Import accounts
   * @param {Object} data - Import data
   * @param {Object} [options] - Import options
   * @returns {Promise<{success: boolean, imported: number, skipped: number, errors: string[]}>}
   */
  async importAccounts(data, options = {}) {
    if (this._useRepository) {
      const errors = [];
      let imported = 0;
      let skipped = 0;

      if (!data.accounts || !Array.isArray(data.accounts)) {
        return {
          success: false,
          imported: 0,
          skipped: 0,
          errors: ['Invalid import data format']
        };
      }

      for (const accountData of data.accounts) {
        try {
          const account = Account.fromJSON(accountData);
          const exists = await this._repository.exists(account.id);
          
          if (exists && !options.overwrite) {
            skipped++;
            continue;
          }

          await this._repository.save(account);
          imported++;
        } catch (error) {
          errors.push(`Failed to import account: ${error.message}`);
          skipped++;
        }
      }

      return {
        success: errors.length === 0,
        imported,
        skipped,
        errors
      };
    }
    return this._legacyManager.importAccounts(data, options);
  }

  /**
   * Clear all accounts
   * @returns {Promise<{success: boolean}>}
   */
  async clearAllAccounts() {
    if (this._useRepository) {
      try {
        await this._repository.deleteAll();
        return { success: true };
      } catch (error) {
        return { success: false };
      }
    }
    return this._legacyManager.clearAllAccounts();
  }

  /**
   * Get the underlying repository (for advanced use)
   * @returns {AccountRepository|null}
   */
  getRepository() {
    return this._repository;
  }

  /**
   * Get the underlying legacy manager (for backward compatibility)
   * @returns {AccountConfigManager|null}
   */
  getLegacyManager() {
    return this._legacyManager;
  }

  /**
   * Check if using repository mode
   * @returns {boolean}
   */
  isUsingRepository() {
    return this._useRepository;
  }
}

module.exports = AccountConfigManagerAdapter;
