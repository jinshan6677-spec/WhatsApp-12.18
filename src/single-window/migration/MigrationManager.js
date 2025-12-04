/**
 * MigrationManager - 迁移管理器
 * 
 * 负责检测和迁移旧的多窗口架构配置到新的单窗口架构
 * 包括配置文件备份、数据迁移和验证
 */

const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

/**
 * @typedef {Object} MigrationResult
 * @property {boolean} needed - 是否需要迁移
 * @property {boolean} success - 迁移是否成功
 * @property {string} [backupPath] - 备份文件路径
 * @property {Object} [oldConfig] - 旧配置数据
 * @property {string[]} [errors] - 错误信息列表
 * @property {string[]} [warnings] - 警告信息列表
 */

/**
 * MigrationManager 类
 */
class MigrationManager {
  /**
   * 创建迁移管理器实例
   * @param {Object} [options] - 配置选项
   * @param {string} [options.userDataPath] - 用户数据目录路径
   * @param {string} [options.configFileName] - 配置文件名
   * @param {string} [options.backupDir] - 备份目录名
   */
  constructor(options = {}) {
    this.userDataPath = options.userDataPath || app.getPath('userData');
    this.configFileName = options.configFileName || 'accounts.json';
    this.backupDir = options.backupDir || 'migration-backups';
    
    // 配置文件路径
    this.oldConfigPath = path.join(this.userDataPath, this.configFileName);
    this.backupDirPath = path.join(this.userDataPath, this.backupDir);
    
    // 日志函数
    this.log = this._createLogger();
  }

  /**
   * 创建日志记录器
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [MigrationManager] [${level.toUpperCase()}] ${message}`;
      
      if (level === 'error') {
        console.error(logMessage, ...args);
      } else if (level === 'warn') {
        console.warn(logMessage, ...args);
      } else {
        console.log(logMessage, ...args);
      }
    };
  }

  /**
   * 检测是否需要迁移
   * 检查是否存在旧的多窗口配置文件
   * @returns {Promise<{needed: boolean, configPath?: string, reason?: string}>}
   */
  async detectMigrationNeeded() {
    this.log('info', 'Detecting if migration is needed');
    
    try {
      // 检查旧配置文件是否存在
      const configExists = await this._fileExists(this.oldConfigPath);
      
      if (!configExists) {
        this.log('info', 'No old configuration file found, migration not needed');
        return {
          needed: false,
          reason: 'No old configuration file found'
        };
      }
      
      // 读取配置文件检查格式
      const configData = await this._readConfigFile(this.oldConfigPath);
      
      if (!configData) {
        this.log('warn', 'Configuration file exists but could not be read');
        return {
          needed: false,
          reason: 'Configuration file could not be read'
        };
      }
      
      // 检查是否是旧格式（包含 window 配置）
      const isOldFormat = this._isOldConfigFormat(configData);
      
      if (isOldFormat) {
        this.log('info', 'Old multi-window configuration detected, migration needed');
        return {
          needed: true,
          configPath: this.oldConfigPath,
          reason: 'Old multi-window configuration format detected'
        };
      } else {
        this.log('info', 'Configuration file is already in new format, migration not needed');
        return {
          needed: false,
          reason: 'Configuration is already in new format'
        };
      }
      
    } catch (error) {
      this.log('error', 'Error detecting migration need:', error);
      return {
        needed: false,
        reason: `Error during detection: ${error.message}`
      };
    }
  }

  /**
   * 检查文件是否存在
   * @private
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>}
   */
  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 读取配置文件
   * @private
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object|null>}
   */
  async _readConfigFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.log('error', `Failed to read config file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 检查配置是否是旧格式
   * @private
   * @param {Object} configData - 配置数据
   * @returns {boolean}
   */
  _isOldConfigFormat(configData) {
    // 检查是否有 accounts 对象
    if (!configData.accounts || typeof configData.accounts !== 'object') {
      return false;
    }
    
    // 检查任何账号是否包含 window 配置
    const accounts = Object.values(configData.accounts);
    
    for (const account of accounts) {
      if (account.window && typeof account.window === 'object') {
        // 找到包含 window 配置的账号，说明是旧格式
        return true;
      }
    }
    
    return false;
  }

  /**
   * 创建配置文件备份
   * @returns {Promise<{success: boolean, backupPath?: string, error?: string}>}
   */
  async createBackup() {
    this.log('info', 'Creating backup of old configuration');
    
    try {
      // 确保备份目录存在
      await fs.mkdir(this.backupDirPath, { recursive: true });
      
      // 生成备份文件名（包含时间戳）
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${this.configFileName}.backup-${timestamp}`;
      const backupPath = path.join(this.backupDirPath, backupFileName);
      
      // 检查源文件是否存在
      const sourceExists = await this._fileExists(this.oldConfigPath);
      if (!sourceExists) {
        this.log('warn', 'Source configuration file does not exist, nothing to backup');
        return {
          success: false,
          error: 'Source configuration file does not exist'
        };
      }
      
      // 复制配置文件到备份位置
      await fs.copyFile(this.oldConfigPath, backupPath);
      
      this.log('info', `Backup created successfully: ${backupPath}`);
      
      return {
        success: true,
        backupPath
      };
      
    } catch (error) {
      this.log('error', 'Failed to create backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 创建窗口状态数据备份
   * 备份所有账号的窗口位置和大小信息
   * @param {Object} configData - 配置数据
   * @returns {Promise<{success: boolean, backupPath?: string, error?: string}>}
   */
  async createWindowStateBackup(configData) {
    this.log('info', 'Creating backup of window state data');
    
    try {
      // 确保备份目录存在
      await fs.mkdir(this.backupDirPath, { recursive: true });
      
      // 提取所有窗口状态
      const windowStates = {};
      
      if (configData.accounts) {
        for (const [accountId, account] of Object.entries(configData.accounts)) {
          if (account.window) {
            windowStates[accountId] = {
              name: account.name,
              window: account.window
            };
          }
        }
      }
      
      // 生成备份文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `window-states.backup-${timestamp}.json`;
      const backupPath = path.join(this.backupDirPath, backupFileName);
      
      // 保存窗口状态数据
      await fs.writeFile(
        backupPath,
        JSON.stringify(windowStates, null, 2),
        'utf-8'
      );
      
      this.log('info', `Window state backup created: ${backupPath}`);
      this.log('info', `Backed up window states for ${Object.keys(windowStates).length} accounts`);
      
      return {
        success: true,
        backupPath
      };
      
    } catch (error) {
      this.log('error', 'Failed to create window state backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 读取旧配置文件
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async readOldConfig() {
    this.log('info', 'Reading old configuration file');
    
    try {
      const configData = await this._readConfigFile(this.oldConfigPath);
      
      if (!configData) {
        return {
          success: false,
          error: 'Failed to read configuration file'
        };
      }
      
      this.log('info', 'Old configuration file read successfully');
      
      // 统计账号数量
      const accountCount = configData.accounts ? Object.keys(configData.accounts).length : 0;
      this.log('info', `Found ${accountCount} accounts in old configuration`);
      
      return {
        success: true,
        data: configData
      };
      
    } catch (error) {
      this.log('error', 'Failed to read old configuration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 记录迁移开始
   * 创建迁移日志文件
   * @param {Object} configData - 配置数据
   * @returns {Promise<{success: boolean, logPath?: string, error?: string}>}
   */
  async logMigrationStart(configData) {
    this.log('info', 'Logging migration start');
    
    try {
      // 确保备份目录存在
      await fs.mkdir(this.backupDirPath, { recursive: true });
      
      // 生成日志文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFileName = `migration-log-${timestamp}.txt`;
      const logPath = path.join(this.backupDirPath, logFileName);
      
      // 收集配置信息
      const accountCount = configData.accounts ? Object.keys(configData.accounts).length : 0;
      const accountIds = configData.accounts ? Object.keys(configData.accounts) : [];
      
      // 构建日志内容
      const logContent = [
        '='.repeat(80),
        'WhatsApp Desktop - Configuration Migration Log',
        '='.repeat(80),
        '',
        `Migration Start Time: ${new Date().toISOString()}`,
        `User Data Path: ${this.userDataPath}`,
        `Old Config Path: ${this.oldConfigPath}`,
        '',
        'Configuration Summary:',
        `- Total Accounts: ${accountCount}`,
        `- Config Version: ${configData.version || 'unknown'}`,
        '',
        'Account IDs:',
        ...accountIds.map(id => `  - ${id}`),
        '',
        'Account Details:',
        ''
      ];
      
      // 添加每个账号的详细信息
      if (configData.accounts) {
        for (const [accountId, account] of Object.entries(configData.accounts)) {
          logContent.push(`Account: ${accountId}`);
          logContent.push(`  Name: ${account.name || 'N/A'}`);
          logContent.push(`  Note: ${account.note || 'N/A'}`);
          logContent.push(`  Session Dir: ${account.sessionDir || 'N/A'}`);
          
          if (account.window) {
            logContent.push(`  Window: ${account.window.width}x${account.window.height} at (${account.window.x}, ${account.window.y})`);
          }
          
          if (account.translation && account.translation.enabled) {
            logContent.push(`  Translation: ${account.translation.engine} -> ${account.translation.targetLanguage}`);
          }
          
          logContent.push('');
        }
      }
      
      logContent.push('='.repeat(80));
      logContent.push('Migration process started');
      logContent.push('='.repeat(80));
      
      // 写入日志文件
      await fs.writeFile(logPath, logContent.join('\n'), 'utf-8');
      
      this.log('info', `Migration log created: ${logPath}`);
      
      return {
        success: true,
        logPath
      };
      
    } catch (error) {
      this.log('error', 'Failed to create migration log:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 执行完整的迁移检测和备份流程
   * @returns {Promise<MigrationResult>}
   */
  async detectAndBackup() {
    this.log('info', 'Starting migration detection and backup process');
    
    const result = {
      needed: false,
      success: false,
      errors: [],
      warnings: []
    };
    
    try {
      // 1. 检测是否需要迁移
      const detection = await this.detectMigrationNeeded();
      result.needed = detection.needed;
      
      if (!detection.needed) {
        this.log('info', `Migration not needed: ${detection.reason}`);
        result.success = true;
        return result;
      }
      
      // 2. 读取旧配置
      const configResult = await this.readOldConfig();
      if (!configResult.success) {
        result.errors.push(`Failed to read old configuration: ${configResult.error}`);
        return result;
      }
      
      result.oldConfig = configResult.data;
      
      // 3. 创建配置文件备份
      const backupResult = await this.createBackup();
      if (!backupResult.success) {
        result.errors.push(`Failed to create backup: ${backupResult.error}`);
        return result;
      }
      
      result.backupPath = backupResult.backupPath;
      
      // 4. 创建窗口状态备份
      const windowBackupResult = await this.createWindowStateBackup(configResult.data);
      if (!windowBackupResult.success) {
        result.warnings.push(`Failed to create window state backup: ${windowBackupResult.error}`);
      }
      
      // 5. 记录迁移开始
      const logResult = await this.logMigrationStart(configResult.data);
      if (!logResult.success) {
        result.warnings.push(`Failed to create migration log: ${logResult.error}`);
      }
      
      // 迁移检测和备份成功
      result.success = true;
      this.log('info', 'Migration detection and backup completed successfully');
      
      return result;
      
    } catch (error) {
      this.log('error', 'Migration detection and backup failed:', error);
      result.errors.push(`Unexpected error: ${error.message}`);
      return result;
    }
  }

  /**
   * 迁移账号配置
   * 将旧的多窗口配置格式转换为新的单窗口配置格式
   * @param {Object} oldConfig - 旧配置数据
   * @returns {Promise<{success: boolean, migratedConfig?: Object, errors?: string[], warnings?: string[]}>}
   */
  async migrateConfiguration(oldConfig) {
    this.log('info', 'Starting configuration migration');
    
    const errors = [];
    const warnings = [];
    const migratedAccounts = {};
    
    try {
      // 验证旧配置格式
      if (!oldConfig || !oldConfig.accounts || typeof oldConfig.accounts !== 'object') {
        errors.push('Invalid old configuration format: missing accounts object');
        return { success: false, errors, warnings };
      }
      
      const accountEntries = Object.entries(oldConfig.accounts);
      this.log('info', `Migrating ${accountEntries.length} accounts`);
      
      // 按窗口位置排序账号（用于确定 order 字段）
      // 优先按 Y 坐标排序，然后按 X 坐标排序
      const sortedAccounts = accountEntries.sort((a, b) => {
        const [, accountA] = a;
        const [, accountB] = b;
        
        const yA = accountA.window?.y || 0;
        const yB = accountB.window?.y || 0;
        
        if (yA !== yB) {
          return yA - yB;
        }
        
        const xA = accountA.window?.x || 0;
        const xB = accountB.window?.x || 0;
        
        return xA - xB;
      });
      
      // 迁移每个账号
      let order = 0;
      for (const [accountId, oldAccount] of sortedAccounts) {
        try {
          this.log('info', `Migrating account: ${accountId} (${oldAccount.name || 'Unnamed'})`);
          
          const migratedAccount = this._migrateAccountConfig(oldAccount, order);
          
          // 验证迁移后的配置
          const validation = this._validateMigratedAccount(migratedAccount);
          if (!validation.valid) {
            errors.push(`Account ${accountId} validation failed: ${validation.errors.join(', ')}`);
            warnings.push(`Skipping account ${accountId} due to validation errors`);
            continue;
          }
          
          // 添加到迁移后的配置
          migratedAccounts[accountId] = migratedAccount;
          order++;
          
          this.log('info', `Successfully migrated account ${accountId} with order ${migratedAccount.order}`);
          
        } catch (error) {
          this.log('error', `Failed to migrate account ${accountId}:`, error);
          errors.push(`Failed to migrate account ${accountId}: ${error.message}`);
          warnings.push(`Skipping account ${accountId}`);
        }
      }
      
      // 构建新配置对象
      const migratedConfig = {
        version: '2.0.0', // 新版本号
        accounts: migratedAccounts,
        migratedAt: new Date().toISOString(),
        migratedFrom: oldConfig.version || '1.0.0'
      };
      
      this.log('info', `Configuration migration completed: ${Object.keys(migratedAccounts).length} accounts migrated`);
      
      if (errors.length > 0) {
        this.log('warn', `Migration completed with ${errors.length} errors`);
      }
      
      return {
        success: errors.length === 0,
        migratedConfig,
        errors,
        warnings
      };
      
    } catch (error) {
      this.log('error', 'Configuration migration failed:', error);
      errors.push(`Migration failed: ${error.message}`);
      return {
        success: false,
        errors,
        warnings
      };
    }
  }

  /**
   * 迁移单个账号配置
   * @private
   * @param {Object} oldAccount - 旧账号配置
   * @param {number} order - 侧边栏显示顺序
   * @returns {Object} 迁移后的账号配置
   */
  _migrateAccountConfig(oldAccount, order) {
    // 基础字段映射
    const migratedAccount = {
      id: oldAccount.id,
      name: oldAccount.name || `Account ${oldAccount.id?.substring(0, 8) || 'Unknown'}`,
      note: oldAccount.note || '',
      order: order,
      createdAt: oldAccount.createdAt || new Date().toISOString(),
      lastActiveAt: oldAccount.lastActiveAt || new Date().toISOString(),
      autoStart: oldAccount.autoStart !== undefined ? oldAccount.autoStart : false
    };
    
    // 会话目录路径保留
    // 优先使用 sessionDir，如果不存在则使用旧的路径格式
    if (oldAccount.sessionDir) {
      migratedAccount.sessionDir = oldAccount.sessionDir;
    } else {
      // 向后兼容：构建默认会话目录路径
      migratedAccount.sessionDir = `session-data/account-${oldAccount.id}`;
    }
    
    
    
    // 翻译配置保留
    if (oldAccount.translation) {
      migratedAccount.translation = {
        enabled: oldAccount.translation.enabled !== undefined ? oldAccount.translation.enabled : false,
        targetLanguage: oldAccount.translation.targetLanguage || 'zh-CN',
        engine: oldAccount.translation.engine || 'google',
        apiKey: oldAccount.translation.apiKey || '',
        autoTranslate: oldAccount.translation.autoTranslate !== undefined ? oldAccount.translation.autoTranslate : false,
        translateInput: oldAccount.translation.translateInput !== undefined ? oldAccount.translation.translateInput : false,
        friendSettings: oldAccount.translation.friendSettings || {}
      };
    } else {
      // 默认翻译配置
      migratedAccount.translation = {
        enabled: false,
        targetLanguage: 'zh-CN',
        engine: 'google',
        apiKey: '',
        autoTranslate: false,
        translateInput: false,
        friendSettings: {}
      };
    }
    
    // 通知配置保留（如果存在）
    if (oldAccount.notifications) {
      migratedAccount.notifications = {
        enabled: oldAccount.notifications.enabled !== undefined ? oldAccount.notifications.enabled : true,
        sound: oldAccount.notifications.sound !== undefined ? oldAccount.notifications.sound : true,
        badge: oldAccount.notifications.badge !== undefined ? oldAccount.notifications.badge : true
      };
    } else {
      // 默认通知配置
      migratedAccount.notifications = {
        enabled: true,
        sound: true,
        badge: true
      };
    }
    
    // 窗口配置被移除，不再迁移
    // 记录窗口信息用于日志（但不包含在迁移后的配置中）
    if (oldAccount.window) {
      this.log('info', `Account ${oldAccount.id} had window config: ${oldAccount.window.width}x${oldAccount.window.height} at (${oldAccount.window.x}, ${oldAccount.window.y})`);
    }
    
    return migratedAccount;
  }

  /**
   * 验证迁移后的账号配置
   * @private
   * @param {Object} account - 迁移后的账号配置
   * @returns {{valid: boolean, errors: string[]}}
   */
  _validateMigratedAccount(account) {
    const errors = [];
    
    // 验证必需字段
    if (!account.id || typeof account.id !== 'string') {
      errors.push('Invalid or missing account ID');
    }
    
    if (!account.name || typeof account.name !== 'string' || account.name.trim().length === 0) {
      errors.push('Invalid or missing account name');
    }
    
    if (typeof account.order !== 'number' || account.order < 0) {
      errors.push('Invalid order field');
    }
    
    if (!account.sessionDir || typeof account.sessionDir !== 'string' || account.sessionDir.trim().length === 0) {
      errors.push('Invalid or missing session directory path');
    }
    
    
    
    // 验证翻译配置
    if (account.translation) {
      if (account.translation.enabled) {
        if (!['google', 'gpt4', 'gemini', 'deepseek'].includes(account.translation.engine)) {
          errors.push('Invalid translation engine');
        }
        
        if (!account.translation.targetLanguage || typeof account.translation.targetLanguage !== 'string') {
          errors.push('Invalid target language');
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 保存迁移后的配置
   * @param {Object} migratedConfig - 迁移后的配置
   * @param {string} [targetPath] - 目标配置文件路径（可选，默认覆盖原文件）
   * @returns {Promise<{success: boolean, configPath?: string, error?: string}>}
   */
  async saveMigratedConfig(migratedConfig, targetPath) {
    const configPath = targetPath || this.oldConfigPath;
    
    this.log('info', `Saving migrated configuration to: ${configPath}`);
    
    try {
      // 确保目录存在
      const configDir = path.dirname(configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      // 写入配置文件
      await fs.writeFile(
        configPath,
        JSON.stringify(migratedConfig, null, 2),
        'utf-8'
      );
      
      this.log('info', 'Migrated configuration saved successfully');
      
      return {
        success: true,
        configPath
      };
      
    } catch (error) {
      this.log('error', 'Failed to save migrated configuration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 验证会话数据目录是否可访问
   * @param {string} sessionDir - 会话数据目录路径（相对或绝对）
   * @returns {Promise<{accessible: boolean, exists: boolean, path: string, error?: string}>}
   */
  async verifySessionDataAccessible(sessionDir) {
    try {
      // 如果是相对路径，转换为绝对路径
      let absolutePath = sessionDir;
      if (!path.isAbsolute(sessionDir)) {
        absolutePath = path.join(this.userDataPath, sessionDir);
      }
      
      this.log('info', `Verifying session data accessibility: ${absolutePath}`);
      
      // 检查目录是否存在
      const exists = await this._fileExists(absolutePath);
      
      if (!exists) {
        this.log('warn', `Session data directory does not exist: ${absolutePath}`);
        return {
          accessible: false,
          exists: false,
          path: absolutePath
        };
      }
      
      // 检查是否可读
      try {
        await fs.access(absolutePath, fs.constants.R_OK);
      } catch (error) {
        this.log('error', `Session data directory is not readable: ${absolutePath}`);
        return {
          accessible: false,
          exists: true,
          path: absolutePath,
          error: 'Directory is not readable'
        };
      }
      
      this.log('info', `Session data directory is accessible: ${absolutePath}`);
      
      return {
        accessible: true,
        exists: true,
        path: absolutePath
      };
      
    } catch (error) {
      this.log('error', `Error verifying session data accessibility:`, error);
      return {
        accessible: false,
        exists: false,
        path: sessionDir,
        error: error.message
      };
    }
  }

  /**
   * 验证会话数据完整性
   * 检查会话数据目录中是否包含关键文件
   * @param {string} sessionDir - 会话数据目录路径
   * @returns {Promise<{valid: boolean, hasData: boolean, details: Object, error?: string}>}
   */
  async validateSessionDataIntegrity(sessionDir) {
    try {
      // 验证目录可访问性
      const accessCheck = await this.verifySessionDataAccessible(sessionDir);
      
      if (!accessCheck.accessible) {
        return {
          valid: false,
          hasData: false,
          details: {
            accessible: false,
            exists: accessCheck.exists
          },
          error: accessCheck.error || 'Session directory not accessible'
        };
      }
      
      const absolutePath = accessCheck.path;
      
      this.log('info', `Validating session data integrity: ${absolutePath}`);
      
      // 检查关键的会话文件/目录
      const keyPaths = [
        'IndexedDB',
        'Local Storage',
        'Cookies',
        'Session Storage',
        'Cache'
      ];
      
      const details = {
        accessible: true,
        exists: true,
        path: absolutePath,
        foundPaths: []
      };
      
      let hasAnyData = false;
      
      for (const keyPath of keyPaths) {
        const fullPath = path.join(absolutePath, keyPath);
        const exists = await this._fileExists(fullPath);
        
        if (exists) {
          details.foundPaths.push(keyPath);
          hasAnyData = true;
        }
      }
      
      // 如果找到任何关键路径，认为会话数据有效
      const valid = hasAnyData;
      
      if (valid) {
        this.log('info', `Session data is valid, found: ${details.foundPaths.join(', ')}`);
      } else {
        this.log('warn', `Session data directory exists but contains no data: ${absolutePath}`);
      }
      
      return {
        valid,
        hasData: hasAnyData,
        details
      };
      
    } catch (error) {
      this.log('error', `Error validating session data integrity:`, error);
      return {
        valid: false,
        hasData: false,
        details: {},
        error: error.message
      };
    }
  }

  /**
   * 迁移会话数据路径
   * 更新配置中的会话路径，但不移动实际文件
   * @param {Object} migratedConfig - 迁移后的配置
   * @returns {Promise<{success: boolean, updated: number, errors?: string[], warnings?: string[]}>}
   */
  async migrateSessionData(migratedConfig) {
    this.log('info', 'Starting session data migration');
    
    const errors = [];
    const warnings = [];
    let updated = 0;
    
    try {
      if (!migratedConfig || !migratedConfig.accounts) {
        errors.push('Invalid migrated configuration: missing accounts');
        return { success: false, updated: 0, errors, warnings };
      }
      
      const accountEntries = Object.entries(migratedConfig.accounts);
      this.log('info', `Migrating session data for ${accountEntries.length} accounts`);
      
      for (const [accountId, account] of accountEntries) {
        try {
          this.log('info', `Processing session data for account: ${accountId}`);
          
          // 验证会话目录路径存在
          if (!account.sessionDir) {
            warnings.push(`Account ${accountId} has no sessionDir, using default`);
            account.sessionDir = `session-data/account-${accountId}`;
            updated++;
            continue;
          }
          
          // 验证会话数据可访问性
          const accessCheck = await this.verifySessionDataAccessible(account.sessionDir);
          
          if (!accessCheck.accessible) {
            if (accessCheck.exists) {
              errors.push(`Session data for account ${accountId} exists but is not accessible: ${accessCheck.error || 'unknown error'}`);
            } else {
              warnings.push(`Session data for account ${accountId} does not exist yet (new account or not logged in)`);
            }
            // 仍然计数为已处理
            updated++;
            continue;
          }
          
          // 验证会话数据完整性
          const integrityCheck = await this.validateSessionDataIntegrity(account.sessionDir);
          
          if (!integrityCheck.valid) {
            if (integrityCheck.hasData === false && integrityCheck.details.exists) {
              warnings.push(`Session directory for account ${accountId} exists but contains no data (not logged in yet)`);
            } else {
              warnings.push(`Session data integrity check failed for account ${accountId}: ${integrityCheck.error || 'unknown error'}`);
            }
            // 仍然计数为已处理
            updated++;
            continue;
          }
          
          // 会话数据有效，路径保持不变（不需要移动文件）
          this.log('info', `Session data for account ${accountId} is valid and accessible`);
          this.log('info', `  Path: ${accessCheck.path}`);
          this.log('info', `  Found data: ${integrityCheck.details.foundPaths.join(', ')}`);
          
          updated++;
          
        } catch (error) {
          this.log('error', `Error processing session data for account ${accountId}:`, error);
          errors.push(`Failed to process session data for account ${accountId}: ${error.message}`);
        }
      }
      
      this.log('info', `Session data migration completed: ${updated} accounts processed`);
      
      if (errors.length > 0) {
        this.log('warn', `Session data migration completed with ${errors.length} errors`);
      }
      
      return {
        success: errors.length === 0,
        updated,
        errors,
        warnings
      };
      
    } catch (error) {
      this.log('error', 'Session data migration failed:', error);
      errors.push(`Session data migration failed: ${error.message}`);
      return {
        success: false,
        updated: 0,
        errors,
        warnings
      };
    }
  }

  /**
   * 执行完整的配置迁移流程
   * 包括检测、备份、迁移和保存
   * @returns {Promise<{success: boolean, migratedConfig?: Object, backupPath?: string, errors?: string[], warnings?: string[]}>}
   */
  async performFullMigration() {
    this.log('info', 'Starting full migration process');
    
    const result = {
      success: false,
      errors: [],
      warnings: []
    };
    
    try {
      // 1. 检测和备份
      const backupResult = await this.detectAndBackup();
      
      if (!backupResult.needed) {
        this.log('info', 'Migration not needed');
        result.success = true;
        result.warnings.push('Migration not needed - no old configuration found or already migrated');
        return result;
      }
      
      if (!backupResult.success) {
        result.errors.push(...(backupResult.errors || []));
        result.warnings.push(...(backupResult.warnings || []));
        return result;
      }
      
      result.backupPath = backupResult.backupPath;
      
      // 2. 迁移配置
      const migrationResult = await this.migrateConfiguration(backupResult.oldConfig);
      
      if (!migrationResult.success) {
        result.errors.push(...(migrationResult.errors || []));
        result.warnings.push(...(migrationResult.warnings || []));
        return result;
      }
      
      result.migratedConfig = migrationResult.migratedConfig;
      result.warnings.push(...(migrationResult.warnings || []));
      
      // 3. 迁移会话数据（验证和更新路径）
      const sessionMigrationResult = await this.migrateSessionData(migrationResult.migratedConfig);
      
      if (!sessionMigrationResult.success) {
        result.errors.push(...(sessionMigrationResult.errors || []));
      }
      result.warnings.push(...(sessionMigrationResult.warnings || []));
      
      this.log('info', `Session data migration: ${sessionMigrationResult.updated} accounts processed`);
      
      // 4. 保存迁移后的配置
      const saveResult = await this.saveMigratedConfig(migrationResult.migratedConfig);
      
      if (!saveResult.success) {
        result.errors.push(`Failed to save migrated configuration: ${saveResult.error}`);
        return result;
      }
      
      // 5. 记录迁移完成
      await this._logMigrationComplete(migrationResult.migratedConfig);
      
      this.log('info', 'Full migration process completed successfully');
      result.success = true;
      
      return result;
      
    } catch (error) {
      this.log('error', 'Full migration process failed:', error);
      result.errors.push(`Migration failed: ${error.message}`);
      return result;
    }
  }

  /**
   * 记录迁移完成
   * @private
   * @param {Object} migratedConfig - 迁移后的配置
   * @returns {Promise<void>}
   */
  async _logMigrationComplete(migratedConfig) {
    try {
      // 确保备份目录存在
      await fs.mkdir(this.backupDirPath, { recursive: true });
      
      // 生成日志文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFileName = `migration-complete-${timestamp}.txt`;
      const logPath = path.join(this.backupDirPath, logFileName);
      
      // 统计信息
      const accountCount = migratedConfig.accounts ? Object.keys(migratedConfig.accounts).length : 0;
      
      // 构建日志内容
      const logContent = [
        '='.repeat(80),
        'WhatsApp Desktop - Configuration Migration Complete',
        '='.repeat(80),
        '',
        `Migration Complete Time: ${new Date().toISOString()}`,
        `New Config Version: ${migratedConfig.version}`,
        `Migrated From Version: ${migratedConfig.migratedFrom}`,
        `Total Accounts Migrated: ${accountCount}`,
        '',
        'Migrated Accounts:',
        ''
      ];
      
      // 添加每个账号的信息
      if (migratedConfig.accounts) {
        for (const [accountId, account] of Object.entries(migratedConfig.accounts)) {
          logContent.push(`Account: ${accountId}`);
          logContent.push(`  Name: ${account.name}`);
          logContent.push(`  Order: ${account.order}`);
          logContent.push(`  Session Dir: ${account.sessionDir}`);
          
          if (account.translation && account.translation.enabled) {
            logContent.push(`  Translation: ${account.translation.engine} -> ${account.translation.targetLanguage}`);
          }
          
          logContent.push('');
        }
      }
      
      logContent.push('='.repeat(80));
      logContent.push('Migration completed successfully');
      logContent.push('Old configuration has been backed up');
      logContent.push('Application will now use the new single-window architecture');
      logContent.push('='.repeat(80));
      
      // 写入日志文件
      await fs.writeFile(logPath, logContent.join('\n'), 'utf-8');
      
      this.log('info', `Migration completion log created: ${logPath}`);
      
    } catch (error) {
      this.log('error', 'Failed to create migration completion log:', error);
      // 不抛出错误，因为这只是日志记录
    }
  }

  /**
   * 获取所有备份文件列表
   * @returns {Promise<{success: boolean, backups?: Array, error?: string}>}
   */
  async listBackups() {
    try {
      const backupDirExists = await this._fileExists(this.backupDirPath);
      
      if (!backupDirExists) {
        return {
          success: true,
          backups: []
        };
      }
      
      const files = await fs.readdir(this.backupDirPath);
      
      const backups = [];
      for (const file of files) {
        const filePath = path.join(this.backupDirPath, file);
        const stats = await fs.stat(filePath);
        
        backups.push({
          name: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
      }
      
      // 按创建时间降序排序
      backups.sort((a, b) => b.created - a.created);
      
      return {
        success: true,
        backups
      };
      
    } catch (error) {
      this.log('error', 'Failed to list backups:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 恢复备份文件
   * @param {string} backupPath - 备份文件路径
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async restoreBackup(backupPath) {
    this.log('info', `Restoring backup from: ${backupPath}`);
    
    try {
      // 检查备份文件是否存在
      const backupExists = await this._fileExists(backupPath);
      if (!backupExists) {
        return {
          success: false,
          error: 'Backup file does not exist'
        };
      }
      
      // 如果当前配置文件存在，先备份它
      const currentExists = await this._fileExists(this.oldConfigPath);
      if (currentExists) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const tempBackupPath = path.join(
          this.backupDirPath,
          `${this.configFileName}.pre-restore-${timestamp}`
        );
        await fs.copyFile(this.oldConfigPath, tempBackupPath);
        this.log('info', `Current config backed up to: ${tempBackupPath}`);
      }
      
      // 恢复备份
      await fs.copyFile(backupPath, this.oldConfigPath);
      
      this.log('info', 'Backup restored successfully');
      
      return {
        success: true
      };
      
    } catch (error) {
      this.log('error', 'Failed to restore backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = MigrationManager;
