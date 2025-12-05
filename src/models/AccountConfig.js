/**
 * AccountConfig 数据模型
 *
 * 定义单个 WhatsApp 账号的完整配置信息：
 * - 应用侧的账号名称 / 备注 / 排序
 * - 从 WhatsApp Web 解析到的真实头像、昵称、号码
 * - 翻译、通知等运行配置
 */

const crypto = require('crypto');

/**
 * Generate a UUID v4
 * @returns {string}
 */
function uuidv4() {
  return crypto.randomUUID();
}


/**
 * @typedef {Object} FriendTranslationConfig
 * @property {boolean} enabled - 是否启用翻译
 * @property {string} targetLanguage - 目标语言
 */

/**
 * @typedef {Object} TranslationConfig
 * @property {boolean} enabled - 是否启用翻译
 * @property {string} targetLanguage - 目标语言
 * @property {'google'|'gpt4'|'gemini'|'deepseek'} engine - 翻译引擎
 * @property {string} [apiKey] - API 密钥（可选）
 * @property {boolean} autoTranslate - 是否自动翻译
 * @property {boolean} translateInput - 是否翻译输入框
 * @property {Object.<string, FriendTranslationConfig>} friendSettings - 好友特定设置
 */

/**
 * @typedef {Object} NotificationConfig
 * @property {boolean} enabled - 是否启用通知
 * @property {boolean} sound - 是否启用声音
 * @property {boolean} badge - 是否显示徽章
 */

/**
 * @typedef {Object} AccountConfig
 * @property {string} id - 唯一标识符（UUID）
 * @property {string} name - 应用内账号名称（用户自定义标签）
 * @property {string} [phoneNumber] - WhatsApp 号码（从 Web 解析或手工填写，可选）
 * @property {string} [profileName] - WhatsApp 真实昵称（从 Web 解析，可选）
 * @property {string} [avatarUrl] - WhatsApp 真实头像 URL（从 Web 解析，可选）
 * @property {string} [note] - 账号备注（可选）
 * @property {number} order - 侧边栏显示顺序
 * @property {Date} createdAt - 创建时间
 * @property {Date} lastActiveAt - 最后活跃时间
 * @property {boolean} autoStart - 是否自动启动
 * @property {boolean} keepAlive - 是否保持运行（应用关闭时记住状态）
 * @property {boolean} fingerprintEnabled - 是否启用指纹保护（默认禁用）
 * @property {string|null} lastRunningStatus - 最后运行状态（'not-started'|'loading'|'connected'|'error'|null）
 * @property {TranslationConfig} translation - 翻译配置
 * @property {NotificationConfig} notifications - 通知配置
 * @property {string} sessionDir - 会话数据目录路径
 */

/**
 * AccountConfig 实体
 */
class AccountConfig {
  /**
   * 创建新的账号配置
   * @param {Partial<AccountConfig>} [config] - 配置选项
   */
  constructor(config = {}) {
    this.id = config.id || uuidv4();
    this.name = (config.name !== undefined && config.name !== null) ? config.name : `Account ${this.id.substring(0, 8)}`;

    // 从 WhatsApp Web 提取的真实信息（可选）
    this.phoneNumber = config.phoneNumber || '';
    this.profileName = config.profileName || '';
    this.avatarUrl = config.avatarUrl || '';

    this.note = config.note || '';
    this.order = config.order !== undefined ? config.order : 0;
    this.createdAt = config.createdAt ? new Date(config.createdAt) : new Date();
    this.lastActiveAt = config.lastActiveAt ? new Date(config.lastActiveAt) : new Date();
    this.autoStart = config.autoStart !== undefined ? config.autoStart : false;
    this.keepAlive = config.keepAlive !== undefined ? config.keepAlive : true;
    // 指纹保护默认禁用
    this.fingerprintEnabled = config.fingerprintEnabled !== undefined ? config.fingerprintEnabled : false;
    this.lastRunningStatus = config.lastRunningStatus || null;

    // 会话数据目录路径 - 确保使用正确的账号ID和实际存储路径
    if (config.sessionDir !== undefined && config.sessionDir !== null) {
      this.sessionDir = config.sessionDir;
    } else {
      this.sessionDir = `Partitions/account_${this.id}`;
    }

    // 翻译配置
    this.translation = {
      enabled: true,
      targetLanguage: 'zh-CN',
      engine: 'google',
      apiKey: '',
      autoTranslate: false,
      translateInput: false,
      friendSettings: {},
      ...(config.translation || {})
    };

    // 通知配置
    this.notifications = {
      enabled: true,
      sound: true,
      badge: true,
      ...(config.notifications || {})
    };

    // 向后兼容：如果存在旧的 window 配置，忽略它但不报错
    if (config.window) {
      // 旧配置文件中可能带有窗口信息，这里仅记录一次警告
      console.warn(`Account ${this.id}: window configuration is deprecated and will be ignored`);
    }
  }

  /**
   * 转换为普通对象，方便持久化 / 通过 IPC 传输
   * @returns {Object}
   */
  toJSON() {
    const createdAt =
      this.createdAt instanceof Date
        ? this.createdAt
        : new Date(this.createdAt || Date.now());
    const lastActiveAt =
      this.lastActiveAt instanceof Date
        ? this.lastActiveAt
        : new Date(this.lastActiveAt || Date.now());

    return {
      id: this.id,
      name: this.name,
      phoneNumber: this.phoneNumber,
      profileName: this.profileName,
      avatarUrl: this.avatarUrl,
      note: this.note,
      order: this.order,
      createdAt: createdAt.toISOString(),
      lastActiveAt: lastActiveAt.toISOString(),
      autoStart: this.autoStart,
      keepAlive: this.keepAlive,
      fingerprintEnabled: this.fingerprintEnabled,
      lastRunningStatus: this.lastRunningStatus,
      sessionDir: this.sessionDir,
      translation: this.translation,
      notifications: this.notifications
    };
  }

  /**
   * 从普通对象创建 AccountConfig 实例
   * @param {Object} data - 数据对象
   * @returns {AccountConfig}
   */
  static fromJSON(data) {
    return new AccountConfig(data);
  }

  /**
   * 验证配置是否有效
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];

    // 验证 ID
    if (!this.id || typeof this.id !== 'string') {
      errors.push('Invalid account ID');
    }

    // 验证名称（应用内标签，必填）
    if (!this.name || typeof this.name !== 'string' || this.name.trim().length === 0) {
      errors.push('Account name is required');
    }

    // 验证 profileName（可选）
    if (this.profileName !== undefined && this.profileName !== null && this.profileName !== '') {
      if (typeof this.profileName !== 'string') {
        errors.push('profileName must be a string');
      } else if (this.profileName.trim().length > 100) {
        errors.push('profileName must not exceed 100 characters');
      }
    }

    // 验证 WhatsApp 号码（可选）
    if (this.phoneNumber !== undefined && this.phoneNumber !== null && this.phoneNumber !== '') {
      if (typeof this.phoneNumber !== 'string') {
        errors.push('phoneNumber must be a string');
      } else {
        const trimmed = this.phoneNumber.trim();
        if (trimmed.length > 32) {
          errors.push('phoneNumber must not exceed 32 characters');
        }
        const phonePattern = /^[0-9+\s-]+$/;
        if (!phonePattern.test(trimmed)) {
          errors.push('phoneNumber must contain only digits, spaces, plus sign or dashes');
        }
      }
    }

    // 验证 avatarUrl（可选）
    if (this.avatarUrl !== undefined && this.avatarUrl !== null && this.avatarUrl !== '') {
      if (typeof this.avatarUrl !== 'string') {
        errors.push('avatarUrl must be a string');
      } else if (this.avatarUrl.length > 512) {
        errors.push('avatarUrl must not exceed 512 characters');
      }
    }

    // 验证 order 字段
    if (typeof this.order !== 'number' || this.order < 0) {
      errors.push('Order must be a non-negative number');
    }

    // 验证 sessionDir
    if (!this.sessionDir || typeof this.sessionDir !== 'string' || this.sessionDir.trim().length === 0) {
      errors.push('Session directory path is required');
    }

    // 验证 autoStart
    if (typeof this.autoStart !== 'boolean') {
      errors.push('autoStart must be a boolean');
    }

    // 验证 keepAlive
    if (typeof this.keepAlive !== 'boolean') {
      errors.push('keepAlive must be a boolean');
    }

    // 验证 lastRunningStatus
    if (
      this.lastRunningStatus !== null &&
      !['not-started', 'loading', 'connected', 'error'].includes(this.lastRunningStatus)
    ) {
      errors.push(
        'lastRunningStatus must be null or one of: not-started, loading, connected, error'
      );
    }


    // 验证翻译配置
    if (this.translation && this.translation.enabled) {
      const engine = this.translation.engine;

      if (!['google', 'gpt4', 'gemini', 'deepseek'].includes(engine)) {
        errors.push('Invalid translation engine. Must be google, gpt4, gemini, or deepseek');
      }

      if (!this.translation.targetLanguage || typeof this.translation.targetLanguage !== 'string') {
        errors.push('Target language is required when translation is enabled');
      }

      // 非 Google 引擎需要 API 密钥（包括自定义/未知引擎）
      if (engine && engine !== 'google') {
        if (
          !this.translation.apiKey ||
          typeof this.translation.apiKey !== 'string' ||
          this.translation.apiKey.trim().length === 0
        ) {
          errors.push(`API key is required for ${engine} translation engine`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 更新最后活跃时间
   */
  updateLastActive() {
    this.lastActiveAt = new Date();
  }
}

module.exports = AccountConfig;
