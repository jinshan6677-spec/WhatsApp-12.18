/**
 * AccountConfigManager - 账号配置管理器
 * 
 * 负责账号配置的加载、保存、删除和验证
 * 使用 electron-store 进行持久化存储
 */

const Store = require('electron-store');
const AccountConfig = require('../models/AccountConfig');
const path = require('path');
const fs = require('fs').promises;
const { 
  validateAccountConfig, 
  checkDuplicateAccountName,
  sanitizeAccountName,
  sanitizeAccountNote
} = require('../utils/ValidationHelper');

/**
 * AccountConfigManager 类
 */
class AccountConfigManager {
  /**
   * 创建配置管理器实例
   * @param {Object} [options] - 配置选项
   * @param {string} [options.configName] - 配置文件名
   * @param {string} [options.cwd] - 配置文件目录
   */
  constructor(options = {}) {
    // 初始化 electron-store
    this.store = new Store({
      name: options.configName || 'accounts',
      cwd: options.cwd,
      defaults: {
        accounts: {},
        version: '1.0.0'
      },
      schema: {
        accounts: {
          type: 'object'
        },
        version: {
          type: 'string'
        }
      }
    });

    // 内存缓存
    this.accountsCache = new Map();
    
    // 加载所有账号到缓存
    this._loadAccountsToCache();
  }

  /**
   * 从存储加载所有账号到内存缓存
   * @private
   */
  _loadAccountsToCache() {
    const accountsData = this.store.get('accounts', {});
    this.accountsCache.clear();
    
    let maxOrder = -1;
    
    for (const [id, data] of Object.entries(accountsData)) {
      try {
        // 向后兼容：如果旧配置没有 order 字段，自动分配
        if (data.order === undefined) {
          data.order = maxOrder + 1;
          maxOrder++;
        } else {
          maxOrder = Math.max(maxOrder, data.order);
        }
        
        // 向后兼容：如果旧配置没有 sessionDir，使用默认路径
        if (!data.sessionDir) {
          data.sessionDir = `session-data/account-${id}`;
        }
        
        const account = AccountConfig.fromJSON(data);
        this.accountsCache.set(id, account);
      } catch (error) {
        console.error(`Failed to load account ${id}:`, error);
      }
    }
    
    // 如果进行了向后兼容转换，保存更新后的配置
    if (maxOrder >= 0) {
      this._saveCacheToStore();
    }
  }

  /**
   * 保存缓存到存储
   * @private
   */
  _saveCacheToStore() {
    const accountsData = {};
    for (const [id, account] of this.accountsCache.entries()) {
      accountsData[id] = account.toJSON();
    }
    this.store.set('accounts', accountsData);
  }

  /**
   * 加载所有账号配置
   * @param {Object} [options] - 加载选项
   * @param {boolean} [options.sorted] - 是否按 order 字段排序
   * @returns {Promise<AccountConfig[]>}
   */
  async loadAccounts(options = {}) {
    const accounts = Array.from(this.accountsCache.values());
    
    if (options.sorted) {
      return accounts.sort((a, b) => a.order - b.order);
    }
    
    return accounts;
  }

  /**
   * 获取单个账号配置
   * @param {string} accountId - 账号 ID
   * @returns {Promise<AccountConfig|null>}
   */
  async getAccount(accountId) {
    return this.accountsCache.get(accountId) || null;
  }

  /**
   * 保存账号配置
   * @param {AccountConfig} accountConfig - 账号配置
   * @returns {Promise<{success: boolean, errors?: string[]}>}
   */
  async saveAccount(accountConfig) {
    // 验证配置
    const validation = accountConfig.validate();
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    try {
      // 更新缓存
      this.accountsCache.set(accountConfig.id, accountConfig);
      
      // 持久化到存储
      this._saveCacheToStore();
      
      return { success: true };
    } catch (error) {
      console.error('Failed to save account:', error);
      return {
        success: false,
        errors: [`Failed to save account: ${error.message}`]
      };
    }
  }

  /**
   * 创建新账号配置
   * @param {Partial<AccountConfig>} config - 账号配置选项
   * @returns {Promise<{success: boolean, account?: AccountConfig, errors?: string[]}>}
   */
  async createAccount(config = {}) {
    try {
      // Sanitize input
      if (config.name) {
        config.name = sanitizeAccountName(config.name);
      }
      if (config.note) {
        config.note = sanitizeAccountNote(config.note);
      }

      // Check for duplicate account names
      const existingAccounts = await this.loadAccounts();
      const duplicateCheck = checkDuplicateAccountName(config.name, existingAccounts);
      if (duplicateCheck.isDuplicate) {
        return {
          success: false,
          errors: [`An account with the name "${config.name}" already exists`]
        };
      }

      // 如果没有指定 order，自动分配为最大值 + 1
      if (config.order === undefined) {
        const maxOrder = this._getMaxOrder();
        config.order = maxOrder + 1;
      }
      
      const account = new AccountConfig(config);

      // Additional validation using ValidationHelper
      const validation = validateAccountConfig(account.toJSON());
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      const result = await this.saveAccount(account);
      
      if (result.success) {
        return {
          success: true,
          account
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('Failed to create account:', error);
      return {
        success: false,
        errors: [`Failed to create account: ${error.message}`]
      };
    }
  }

  /**
   * 更新账号配置
   * @param {string} accountId - 账号 ID
   * @param {Partial<AccountConfig>} updates - 更新的配置项
   * @returns {Promise<{success: boolean, account?: AccountConfig, errors?: string[]}>}
   */
  async updateAccount(accountId, updates) {
    const account = this.accountsCache.get(accountId);
    
    if (!account) {
      return {
        success: false,
        errors: [`Account ${accountId} not found`]
      };
    }

    try {
      // Sanitize input
      if (updates.name) {
        updates.name = sanitizeAccountName(updates.name);
        
        // Check for duplicate account names (excluding current account)
        const existingAccounts = await this.loadAccounts();
        const duplicateCheck = checkDuplicateAccountName(updates.name, existingAccounts, accountId);
        if (duplicateCheck.isDuplicate) {
          return {
            success: false,
            errors: [`An account with the name "${updates.name}" already exists`]
          };
        }
      }
      if (updates.note !== undefined) {
        updates.note = sanitizeAccountNote(updates.note);
      }

      // 应用更新，确保日期字段被正确转换
      const processedUpdates = { ...updates };
      if (processedUpdates.createdAt && !(processedUpdates.createdAt instanceof Date)) {
        processedUpdates.createdAt = new Date(processedUpdates.createdAt);
      }
      if (processedUpdates.lastActiveAt && !(processedUpdates.lastActiveAt instanceof Date)) {
        processedUpdates.lastActiveAt = new Date(processedUpdates.lastActiveAt);
      }
      
      Object.assign(account, processedUpdates);

      // Additional validation using ValidationHelper
      const validation = validateAccountConfig(account.toJSON());
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }
      
      // 保存更新后的配置
      const result = await this.saveAccount(account);
      
      if (result.success) {
        return {
          success: true,
          account
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('Failed to update account:', error);
      return {
        success: false,
        errors: [`Failed to update account: ${error.message}`]
      };
    }
  }

  /**
   * 删除账号配置
   * @param {string} accountId - 账号 ID
   * @param {Object} [options] - 删除选项
   * @param {boolean} [options.deleteUserData] - 是否删除用户数据目录
   * @param {string} [options.userDataPath] - 用户数据根目录路径
   * @returns {Promise<{success: boolean, errors?: string[]}>}
   */
  async deleteAccount(accountId, options = {}) {
    const account = this.accountsCache.get(accountId);
    
    if (!account) {
      return {
        success: false,
        errors: [`Account ${accountId} not found`]
      };
    }

    try {
      // 从缓存中删除
      this.accountsCache.delete(accountId);
      
      // 持久化到存储
      this._saveCacheToStore();
      
      // 如果需要，删除用户数据目录
      if (options.deleteUserData && options.userDataPath) {
        const userDataDir = path.join(options.userDataPath, 'profiles', accountId);
        try {
          await fs.rm(userDataDir, { recursive: true, force: true });
          console.log(`Deleted user data directory: ${userDataDir}`);
        } catch (error) {
          console.warn(`Failed to delete user data directory: ${error.message}`);
          // 不将此作为致命错误，因为配置已经删除
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to delete account:', error);
      return {
        success: false,
        errors: [`Failed to delete account: ${error.message}`]
      };
    }
  }

  /**
   * 检查账号是否存在
   * @param {string} accountId - 账号 ID
   * @returns {boolean}
   */
  accountExists(accountId) {
    return this.accountsCache.has(accountId);
  }

  /**
   * 获取所有账号 ID
   * @returns {string[]}
   */
  getAllAccountIds() {
    return Array.from(this.accountsCache.keys());
  }

  /**
   * 获取账号数量
   * @returns {number}
   */
  getAccountCount() {
    return this.accountsCache.size;
  }

  /**
   * 验证账号配置
   * @param {AccountConfig} accountConfig - 账号配置
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateConfig(accountConfig) {
    return accountConfig.validate();
  }

  /**
   * 导出所有账号配置
   * @returns {Promise<Object>}
   */
  async exportAccounts() {
    const accounts = await this.loadAccounts();
    return {
      version: this.store.get('version'),
      exportDate: new Date().toISOString(),
      accounts: accounts.map(account => account.toJSON())
    };
  }

  /**
   * 导入账号配置
   * @param {Object} data - 导入的数据
   * @param {Object} [options] - 导入选项
   * @param {boolean} [options.overwrite] - 是否覆盖现有账号
   * @returns {Promise<{success: boolean, imported: number, skipped: number, errors: string[]}>}
   */
  async importAccounts(data, options = {}) {
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
        const account = AccountConfig.fromJSON(accountData);
        
        // 检查账号是否已存在
        if (this.accountExists(account.id) && !options.overwrite) {
          skipped++;
          continue;
        }

        // 保存账号
        const result = await this.saveAccount(account);
        if (result.success) {
          imported++;
        } else {
          errors.push(`Failed to import account ${account.id}: ${result.errors.join(', ')}`);
          skipped++;
        }
      } catch (error) {
        errors.push(`Failed to parse account data: ${error.message}`);
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

  /**
   * 清除所有账号配置（危险操作）
   * @returns {Promise<{success: boolean}>}
   */
  async clearAllAccounts() {
    try {
      this.accountsCache.clear();
      this.store.set('accounts', {});
      return { success: true };
    } catch (error) {
      console.error('Failed to clear accounts:', error);
      return { success: false };
    }
  }

  /**
   * 获取配置文件路径
   * @returns {string}
   */
  getConfigPath() {
    return this.store.path;
  }

  /**
   * 获取当前最大的 order 值
   * @private
   * @returns {number}
   */
  _getMaxOrder() {
    let maxOrder = -1;
    for (const account of this.accountsCache.values()) {
      if (account.order > maxOrder) {
        maxOrder = account.order;
      }
    }
    return maxOrder;
  }

  /**
   * 重新排序账号
   * @param {string[]} accountIds - 按新顺序排列的账号 ID 数组
   * @returns {Promise<{success: boolean, errors?: string[]}>}
   */
  async reorderAccounts(accountIds) {
    try {
      const errors = [];
      
      // 验证所有账号 ID 是否存在
      for (const id of accountIds) {
        if (!this.accountExists(id)) {
          errors.push(`Account ${id} not found`);
        }
      }
      
      if (errors.length > 0) {
        return { success: false, errors };
      }
      
      // 更新每个账号的 order 字段
      accountIds.forEach((id, index) => {
        const account = this.accountsCache.get(id);
        if (account) {
          account.order = index;
        }
      });
      
      // 保存更新
      this._saveCacheToStore();
      
      return { success: true };
    } catch (error) {
      console.error('Failed to reorder accounts:', error);
      return {
        success: false,
        errors: [`Failed to reorder accounts: ${error.message}`]
      };
    }
  }

  /**
   * 获取按顺序排列的账号列表
   * @returns {Promise<AccountConfig[]>}
   */
  async getAccountsSorted() {
    return this.loadAccounts({ sorted: true });
  }
}

module.exports = AccountConfigManager;
