/**
 * 配置管理器
 * 使用 electron-store 管理翻译配置
 */

const Store = require('electron-store');
const SecureStorage = require('../utils/SecureStorage');

class ConfigManager {
  constructor() {
    this.store = new Store({
      name: 'translation-config',
      defaults: {
        accounts: {},
        engines: {
          google: {
            type: 'google',
            enabled: true
          }
        }
      }
    });
    
    // 初始化安全存储
    this.secureStorage = new SecureStorage();
  }

  /**
   * 获取账号配置
   * @param {string} accountId - 账号ID
   * @returns {Object} 配置对象
   */
  getConfig(accountId) {
    const accountConfig = this.store.get(`accounts.${accountId}`);
    
    if (!accountConfig) {
      // 返回默认配置
      return this.getDefaultConfig();
    }
    
    return accountConfig;
  }

  /**
   * 保存账号配置
   * @param {string} accountId - 账号ID
   * @param {Object} config - 配置对象
   */
  saveConfig(accountId, config) {
    this.store.set(`accounts.${accountId}`, config);
  }

  /**
   * 获取默认配置
   * @returns {Object} 默认配置
   */
  getDefaultConfig() {
    return {
      global: {
        autoTranslate: false,
        engine: 'google', // 聊天窗口翻译引擎（接收消息）
        sourceLang: 'auto',
        targetLang: 'zh-CN',
        groupTranslation: false
      },
      inputBox: {
        enabled: false,
        engine: 'google', // 输入框翻译引擎（发送消息）
        style: '通用', // 翻译风格（仅用于输入框翻译）
        targetLang: 'auto'
      },
      advanced: {
        friendIndependent: false,
        blockChinese: false,
        realtime: false,
        reverseTranslation: false,
        voiceTranslation: false,
        imageTranslation: false
      },
      friendConfigs: {}
    };
  }

  /**
   * 获取引擎配置
   * @param {string} engineName - 引擎名称
   * @returns {Object|null} 引擎配置
   */
  getEngineConfig(engineName) {
    const config = this.store.get(`engines.${engineName}`) || null;
    
    if (config && config.apiKey) {
      // 解密 API 密钥
      config.apiKey = this.secureStorage.decryptApiKey(config.apiKey);
    }
    
    return config;
  }

  /**
   * 保存引擎配置
   * @param {string} engineName - 引擎名称
   * @param {Object} config - 引擎配置
   */
  saveEngineConfig(engineName, config) {
    // 加密 API 密钥后再保存
    const configToSave = { ...config };
    
    if (configToSave.apiKey) {
      configToSave.apiKey = this.secureStorage.encryptApiKey(configToSave.apiKey);
    }
    
    this.store.set(`engines.${engineName}`, configToSave);
  }

  /**
   * 获取单个引擎配置
   * @param {string} engineName - 引擎名称
   * @returns {Object} 引擎配置
   */
  getEngineConfig(engineName) {
    const config = this.store.get(`engines.${engineName}`) || {};
    
    // 解密 API 密钥
    if (config.apiKey) {
      config.apiKey = this.secureStorage.decryptApiKey(config.apiKey);
    }
    
    return config;
  }

  /**
   * 获取所有引擎配置
   * @returns {Object} 所有引擎配置
   */
  getAllEngineConfigs() {
    const engines = this.store.get('engines') || {};
    
    // 解密所有引擎的 API 密钥
    Object.keys(engines).forEach(engineName => {
      if (engines[engineName].apiKey) {
        engines[engineName].apiKey = this.secureStorage.decryptApiKey(engines[engineName].apiKey);
      }
    });
    
    return engines;
  }

  /**
   * 获取所有引擎配置（掩码 API 密钥，用于显示）
   * @returns {Object} 掩码后的引擎配置
   */
  getAllEngineConfigsMasked() {
    const engines = this.store.get('engines') || {};
    
    // 掩码所有引擎的 API 密钥
    Object.keys(engines).forEach(engineName => {
      if (engines[engineName].apiKey) {
        const decryptedKey = this.secureStorage.decryptApiKey(engines[engineName].apiKey);
        engines[engineName].apiKey = this.secureStorage.maskApiKey(decryptedKey);
      }
    });
    
    return engines;
  }

  /**
   * 获取好友独立配置
   * @param {string} accountId - 账号ID
   * @param {string} contactId - 联系人ID
   * @returns {Object|null} 好友配置
   */
  getFriendConfig(accountId, contactId) {
    return this.store.get(`accounts.${accountId}.friendConfigs.${contactId}`) || null;
  }

  /**
   * 保存好友独立配置
   * @param {string} accountId - 账号ID
   * @param {string} contactId - 联系人ID
   * @param {Object} config - 好友配置
   */
  saveFriendConfig(accountId, contactId, config) {
    this.store.set(`accounts.${accountId}.friendConfigs.${contactId}`, config);
  }

  /**
   * 删除好友独立配置
   * @param {string} accountId - 账号ID
   * @param {string} contactId - 联系人ID
   */
  deleteFriendConfig(accountId, contactId) {
    this.store.delete(`accounts.${accountId}.friendConfigs.${contactId}`);
  }

  /**
   * 清除所有配置
   */
  clearAll() {
    this.store.clear();
  }

  /**
   * 清除用户数据（隐私保护）
   * 删除所有账号配置，但保留引擎配置
   */
  clearUserData() {
    console.log('[ConfigManager] Clearing user data for privacy...');
    
    // 删除所有账号配置
    this.store.delete('accounts');
    
    console.log('[ConfigManager] User data cleared successfully');
  }

  /**
   * 清除所有敏感数据（隐私保护）
   * 删除所有配置包括 API 密钥
   */
  clearAllSensitiveData() {
    console.log('[ConfigManager] Clearing all sensitive data...');
    
    this.store.clear();
    
    console.log('[ConfigManager] All sensitive data cleared successfully');
  }

  /**
   * 导出配置（掩码敏感信息）
   * @returns {Object} 掩码后的配置
   */
  exportConfigSafe() {
    const config = { ...this.store.store };
    
    // 掩码所有 API 密钥
    if (config.engines) {
      Object.keys(config.engines).forEach(engineName => {
        if (config.engines[engineName].apiKey) {
          const decryptedKey = this.secureStorage.decryptApiKey(config.engines[engineName].apiKey);
          config.engines[engineName].apiKey = this.secureStorage.maskApiKey(decryptedKey);
        }
      });
    }
    
    return config;
  }

  /**
   * 导出配置
   * @returns {Object} 所有配置
   */
  exportConfig() {
    return this.store.store;
  }

  /**
   * 导入配置
   * @param {Object} config - 配置对象
   */
  importConfig(config) {
    this.store.store = config;
  }

  /**
   * 获取隐私数据摘要
   * @returns {Object} 隐私数据统计
   */
  getPrivacyDataSummary() {
    const accounts = this.store.get('accounts') || {};
    const engines = this.store.get('engines') || {};
    
    const accountCount = Object.keys(accounts).length;
    let friendConfigCount = 0;
    
    Object.values(accounts).forEach(account => {
      if (account.friendConfigs) {
        friendConfigCount += Object.keys(account.friendConfigs).length;
      }
    });
    
    const engineCount = Object.keys(engines).length;
    const enginesWithKeys = Object.values(engines).filter(e => e.apiKey).length;
    
    return {
      accountCount,
      friendConfigCount,
      engineCount,
      enginesWithKeys,
      storageLocation: this.store.path
    };
  }
}

module.exports = ConfigManager;
