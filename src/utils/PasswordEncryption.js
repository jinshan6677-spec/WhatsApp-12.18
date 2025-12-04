/**
 * PasswordEncryption - 密码加密工具
 */

const crypto = require('crypto');
const os = require('os');

class PasswordEncryption {
  /**
   * 获取或生成加密密钥
   * @private
   * @returns {Buffer} 32 字节的加密密钥
   */
  static _getEncryptionKey() {
    // 使用机器特定信息生成密钥
    // 注意：这是一个简单的实现，生产环境应该使用更安全的密钥管理方案
    const machineId = os.hostname() + os.platform() + os.arch();
    const hash = crypto.createHash('sha256');
    hash.update(machineId);
    hash.update('whatsapp-encryption-key-v1');
    return hash.digest();
  }

  /**
   * 加密密码
   * @param {string} password - 明文密码
   * @returns {string} 加密后的密码（格式: iv:encryptedData）
   */
  static encryptPassword(password) {
    if (!password || typeof password !== 'string') {
      return '';
    }

    try {
      const key = this._getEncryptionKey();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      let encrypted = cipher.update(password, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // 返回格式: iv:encryptedData
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Failed to encrypt password:', error);
      throw new Error('密码加密失败');
    }
  }

  /**
   * 解密密码
   * @param {string} encrypted - 加密的密码（格式: iv:encryptedData）
   * @returns {string} 明文密码
   */
  static decryptPassword(encrypted) {
    if (!encrypted || typeof encrypted !== 'string') {
      return '';
    }

    try {
      const parts = encrypted.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted password format');
      }

      const key = this._getEncryptionKey();
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt password:', error);
      // 如果解密失败，返回空字符串而不是抛出错误
      // 这样可以处理旧的未加密密码或损坏的数据
      return '';
    }
  }

  /**
   * 检查字符串是否已加密
   * @param {string} str - 要检查的字符串
   * @returns {boolean} 是否已加密
   */
  static isEncrypted(str) {
    if (!str || typeof str !== 'string') {
      return false;
    }

    // 检查格式是否为 iv:encryptedData
    const parts = str.split(':');
    if (parts.length !== 2) {
      return false;
    }

    // 检查 IV 是否为 32 个十六进制字符（16 字节）
    if (parts[0].length !== 32 || !/^[0-9a-f]+$/i.test(parts[0])) {
      return false;
    }

    // 检查加密数据是否为十六进制
    if (!/^[0-9a-f]+$/i.test(parts[1])) {
      return false;
    }

    return true;
  }

  /**
   * 安全地加密密码（如果尚未加密）
   * @param {string} password - 密码
   * @returns {string} 加密后的密码
   */
  static encryptIfNeeded(password) {
    if (!password) {
      return '';
    }

    // 如果已经加密，直接返回
    if (this.isEncrypted(password)) {
      return password;
    }

    // 否则进行加密
    return this.encryptPassword(password);
  }

  /**
   * 批量加密配置中的密码
   * @param {Object} config - 配置对象
   * @returns {Object} 加密后的配置对象
   */
  static encryptConfigPasswords(config) {
    if (!config) {
      return config;
    }

    const encrypted = { ...config };

  // 加密密码
    if (encrypted.password) {
      encrypted.password = this.encryptIfNeeded(encrypted.password);
    }

    return encrypted;
  }

  /**
   * 批量解密配置中的密码
   * @param {Object} config - 配置对象
   * @returns {Object} 解密后的配置对象
   */
  static decryptConfigPasswords(config) {
    if (!config) {
      return config;
    }

    const decrypted = { ...config };

  // 解密密码
    if (decrypted.password && this.isEncrypted(decrypted.password)) {
      decrypted.password = this.decryptPassword(decrypted.password);
    }

    return decrypted;
  }
}

module.exports = PasswordEncryption;
