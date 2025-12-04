'use strict';

const IRepository = require('./IRepository');

/**
 * Account Repository Interface
 * 
 * Extends the base repository with account-specific operations.
 * 
 * @extends IRepository<Account, string>
 */
class IAccountRepository extends IRepository {
  /**
   * Finds an account by its name
   * @param {string} name - Account name
   * @returns {Promise<Account|null>} The account or null if not found
   */
  async findByName(name) {
    throw new Error('Method not implemented: findByName');
  }

  /**
   * Finds all active accounts (status === 'active')
   * @returns {Promise<Account[]>} Array of active accounts
   */
  async findActive() {
    throw new Error('Method not implemented: findActive');
  }

  /**
   * Finds all accounts with autoStart enabled
   * @returns {Promise<Account[]>} Array of auto-start accounts
   */
  async findAutoStart() {
    throw new Error('Method not implemented: findAutoStart');
  }

  /**
   * Updates the last active timestamp for an account
   * @param {string} id - Account identifier
   * @returns {Promise<void>}
   */
  async updateLastActive(id) {
    throw new Error('Method not implemented: updateLastActive');
  }

  /**
   * Finds accounts by status
   * @param {string} status - Account status
   * @returns {Promise<Account[]>} Array of accounts with the given status
   */
  async findByStatus(status) {
    throw new Error('Method not implemented: findByStatus');
  }

  /**
   * Gets accounts ordered by their order field
   * @returns {Promise<Account[]>} Ordered array of accounts
   */
  async findAllOrdered() {
    throw new Error('Method not implemented: findAllOrdered');
  }

  /**
   * Updates the order of multiple accounts
   * @param {Array<{id: string, order: number}>} orderUpdates - Array of id/order pairs
   * @returns {Promise<void>}
   */
  async updateOrder(orderUpdates) {
    throw new Error('Method not implemented: updateOrder');
  }
}

module.exports = IAccountRepository;
