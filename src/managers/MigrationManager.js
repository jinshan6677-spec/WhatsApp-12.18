/**
 * MigrationManager - 数据迁移管理器
 * 
 * 负责从单实例架构迁移到多实例架构
 * - 检测旧的 session-data 目录
 * - 迁移会话数据到新的 profiles 目录
 * - 创建默认账号配置
 * - 从现有配置文件加载翻译设置
 */

const path = require('path');
const fs = require('fs').promises;
const AccountConfig = require('../models/AccountConfig');

/**
 * MigrationManager 类
 */
class MigrationManager {
  /**
   * 创建迁移管理器实例
   * @param {Object} options - 配置选项
   * @param {string} options.userDataPath - 用户数据根目录路径
   * @param {Object} options.accountConfigManager - 账号配置管理器实例
   */
  constructor(options) {
    if (!options.userDataPath) {
      throw new Error('userDataPath is required');
    }
    if (!options.accountConfigManager) {
      throw new Error('accountConfigManager is required');
    }

    this.userDataPath = options.userDataPath;
    this.accountConfigManager = options.accountConfigManager;
    
    // 定义路径
    this.oldSessionPath = path.join(this.userDataPath, 'session-data');
    this.newProfilesPath = path.join(this.userDataPath, 'profiles');
    this.defaultProfilePath = path.join(this.newProfilesPath, 'default');
    this.translationConfigPath = path.join(this.userDataPath, 'enable-translation-config.json');
    
    // 迁移状态标记文件
    this.migrationMarkerPath = path.join(this.userDataPath, '.migration-completed');
  }

  /**
   * 检查是否需要迁移
   * @returns {Promise<boolean>}
   */
  async needsMigration() {
    try {
      // 如果已经完成迁移，返回 false
      const markerExists = await this._pathExists(this.migrationMarkerPath);
      if (markerExists) {
        console.log('[Migration] Migration already completed');
        return false;
      }

      // 检查是否存在旧的 session-data 目录
      const oldSessionExists = await this._pathExists(this.oldSessionPath);
      
      // 检查是否已经有 profiles 目录
      const profilesExists = await this._pathExists(this.newProfilesPath);
      
      // 如果旧目录存在且新目录不存在，需要迁移
      const needsMigration = oldSessionExists && !profilesExists;
      
      console.log('[Migration] Migration check:', {
        oldSessionExists,
        profilesExists,
        needsMigration
      });
      
      return needsMigration;
    } catch (error) {
      console.error('[Migration] Error checking migration status:', error);
      return false;
    }
  }

  /**
   * 执行迁移
   * @returns {Promise<{success: boolean, message: string, details?: Object}>}
   */
  async migrate() {
    console.log('[Migration] Starting migration process...');
    
    try {
      // 1. 检查是否需要迁移
      const needsMigration = await this.needsMigration();
      if (!needsMigration) {
        return {
          success: true,
          message: 'No migration needed'
        };
      }

      const migrationSteps = [];

      // 2. 创建 profiles 目录
      console.log('[Migration] Creating profiles directory...');
      await fs.mkdir(this.newProfilesPath, { recursive: true });
      migrationSteps.push('Created profiles directory');

      // 3. 迁移会话数据
      console.log('[Migration] Migrating session data...');
      const sessionMigrated = await this._migrateSessionData();
      if (sessionMigrated) {
        migrationSteps.push('Migrated session data to profiles/default');
      } else {
        migrationSteps.push('No session data to migrate');
      }

      // 4. 加载翻译配置
      console.log('[Migration] Loading translation configuration...');
      const translationConfig = await this._loadTranslationConfig();
      migrationSteps.push('Loaded translation configuration');

      // 5. 创建默认账号配置
      console.log('[Migration] Creating default account configuration...');
      const accountCreated = await this._createDefaultAccount(translationConfig);
      if (accountCreated) {
        migrationSteps.push('Created default account configuration');
      } else {
        migrationSteps.push('Default account already exists');
      }

      // 6. 标记迁移完成
      console.log('[Migration] Marking migration as completed...');
      await this._markMigrationCompleted();
      migrationSteps.push('Migration completed successfully');

      console.log('[Migration] Migration process completed successfully');
      
      return {
        success: true,
        message: 'Migration completed successfully',
        details: {
          steps: migrationSteps,
          oldSessionPath: this.oldSessionPath,
          newProfilePath: this.defaultProfilePath
        }
      };
    } catch (error) {
      console.error('[Migration] Migration failed:', error);
      return {
        success: false,
        message: `Migration failed: ${error.message}`,
        details: {
          error: error.stack
        }
      };
    }
  }

  /**
   * 迁移会话数据
   * @private
   * @returns {Promise<boolean>} 是否成功迁移
   */
  async _migrateSessionData() {
    try {
      // 检查旧会话目录是否存在
      const oldSessionExists = await this._pathExists(this.oldSessionPath);
      if (!oldSessionExists) {
        console.log('[Migration] No old session data found');
        return false;
      }

      // 检查旧会话目录中是否有 session 子目录
      const oldSessionDir = path.join(this.oldSessionPath, 'session');
      const sessionDirExists = await this._pathExists(oldSessionDir);
      
      if (!sessionDirExists) {
        console.log('[Migration] No session subdirectory found in old session data');
        return false;
      }

      // 创建默认 profile 目录
      await fs.mkdir(this.defaultProfilePath, { recursive: true });

      // 复制会话数据（使用复制而不是移动，以保留原始数据作为备份）
      console.log(`[Migration] Copying session data from ${oldSessionDir} to ${this.defaultProfilePath}`);
      await this._copyDirectory(oldSessionDir, this.defaultProfilePath);

      console.log('[Migration] Session data migrated successfully');
      return true;
    } catch (error) {
      console.error('[Migration] Error migrating session data:', error);
      throw new Error(`Failed to migrate session data: ${error.message}`);
    }
  }

  /**
   * 加载翻译配置
   * @private
   * @returns {Promise<Object>} 翻译配置对象
   */
  async _loadTranslationConfig() {
    try {
      // 检查翻译配置文件是否存在
      const configExists = await this._pathExists(this.translationConfigPath);
      if (!configExists) {
        console.log('[Migration] No translation configuration file found, using defaults');
        return this._getDefaultTranslationConfig();
      }

      // 读取配置文件
      const configContent = await fs.readFile(this.translationConfigPath, 'utf8');
      const config = JSON.parse(configContent);

      // 提取默认账号的配置
      const defaultAccountConfig = config.accounts?.default;
      if (!defaultAccountConfig) {
        console.log('[Migration] No default account in translation config, using defaults');
        return this._getDefaultTranslationConfig();
      }

      // 转换为新的配置格式
      const translationConfig = {
        enabled: defaultAccountConfig.global?.autoTranslate || false,
        targetLanguage: defaultAccountConfig.global?.targetLang || 'zh-CN',
        engine: defaultAccountConfig.global?.engine || 'google',
        apiKey: '',
        autoTranslate: defaultAccountConfig.global?.autoTranslate || false,
        translateInput: defaultAccountConfig.inputBox?.enabled || false,
        friendSettings: defaultAccountConfig.friendConfigs || {}
      };

      // 如果配置中有引擎的 API 密钥，提取它
      if (config.engines && config.engines[translationConfig.engine]) {
        const engineConfig = config.engines[translationConfig.engine];
        if (engineConfig.apiKey) {
          translationConfig.apiKey = engineConfig.apiKey;
        }
      }

      console.log('[Migration] Translation configuration loaded:', {
        enabled: translationConfig.enabled,
        engine: translationConfig.engine,
        targetLanguage: translationConfig.targetLanguage
      });

      return translationConfig;
    } catch (error) {
      console.error('[Migration] Error loading translation config:', error);
      console.log('[Migration] Using default translation configuration');
      return this._getDefaultTranslationConfig();
    }
  }

  /**
   * 获取默认翻译配置
   * @private
   * @returns {Object}
   */
  _getDefaultTranslationConfig() {
    return {
      enabled: false,
      targetLanguage: 'zh-CN',
      engine: 'google',
      apiKey: '',
      autoTranslate: false,
      translateInput: false,
      friendSettings: {}
    };
  }

  /**
   * 创建默认账号配置
   * @private
   * @param {Object} translationConfig - 翻译配置
   * @returns {Promise<boolean>} 是否成功创建
   */
  async _createDefaultAccount(translationConfig) {
    try {
      // 检查是否已经存在默认账号
      const existingAccount = await this.accountConfigManager.getAccount('default');
      if (existingAccount) {
        console.log('[Migration] Default account already exists');
        return false;
      }

      // 创建默认账号配置
      const defaultAccount = new AccountConfig({
        id: 'default',
        name: 'Default Account',
        createdAt: new Date(),
        lastActiveAt: new Date(),
        translation: translationConfig,
        window: {
          width: 1200,
          height: 800,
          minimized: false
        },
        notifications: {
          enabled: true,
          sound: true,
          badge: true
        }
      });

      // 保存账号配置
      const result = await this.accountConfigManager.saveAccount(defaultAccount);
      
      if (result.success) {
        console.log('[Migration] Default account created successfully');
        return true;
      } else {
        throw new Error(`Failed to save default account: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('[Migration] Error creating default account:', error);
      throw new Error(`Failed to create default account: ${error.message}`);
    }
  }

  /**
   * 标记迁移完成
   * @private
   */
  async _markMigrationCompleted() {
    try {
      const markerData = {
        migrationDate: new Date().toISOString(),
        version: '1.0.0',
        migratedFrom: 'single-instance',
        migratedTo: 'multi-instance'
      };
      
      await fs.writeFile(
        this.migrationMarkerPath,
        JSON.stringify(markerData, null, 2),
        'utf8'
      );
      
      console.log('[Migration] Migration marker created');
    } catch (error) {
      console.error('[Migration] Error creating migration marker:', error);
      throw new Error(`Failed to mark migration as completed: ${error.message}`);
    }
  }

  /**
   * 检查路径是否存在
   * @private
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>}
   */
  async _pathExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 递归复制目录
   * @private
   * @param {string} src - 源目录
   * @param {string} dest - 目标目录
   */
  async _copyDirectory(src, dest) {
    try {
      // 创建目标目录
      await fs.mkdir(dest, { recursive: true });

      // 读取源目录内容
      const entries = await fs.readdir(src, { withFileTypes: true });

      // 复制每个条目
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          // 递归复制子目录
          await this._copyDirectory(srcPath, destPath);
        } else {
          // 复制文件
          await fs.copyFile(srcPath, destPath);
        }
      }
    } catch (error) {
      console.error(`[Migration] Error copying directory from ${src} to ${dest}:`, error);
      throw error;
    }
  }

  /**
   * 获取迁移状态
   * @returns {Promise<Object>}
   */
  async getMigrationStatus() {
    try {
      const markerExists = await this._pathExists(this.migrationMarkerPath);
      
      if (!markerExists) {
        return {
          completed: false,
          needsMigration: await this.needsMigration()
        };
      }

      // 读取迁移标记文件
      const markerContent = await fs.readFile(this.migrationMarkerPath, 'utf8');
      const markerData = JSON.parse(markerContent);

      return {
        completed: true,
        needsMigration: false,
        migrationDate: markerData.migrationDate,
        version: markerData.version
      };
    } catch (error) {
      console.error('[Migration] Error getting migration status:', error);
      return {
        completed: false,
        needsMigration: false,
        error: error.message
      };
    }
  }

  /**
   * 重置迁移状态（用于测试或重新迁移）
   * @returns {Promise<void>}
   */
  async resetMigration() {
    try {
      const markerExists = await this._pathExists(this.migrationMarkerPath);
      if (markerExists) {
        await fs.unlink(this.migrationMarkerPath);
        console.log('[Migration] Migration marker removed');
      }
    } catch (error) {
      console.error('[Migration] Error resetting migration:', error);
      throw error;
    }
  }
}

module.exports = MigrationManager;
