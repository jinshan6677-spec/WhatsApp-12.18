/**
 * 安全存储工具
 * 使用 Electron safeStorage 加密存储敏感信息（如 API 密钥）
 */

const { safeStorage } = require('electron');

class SecureStorage {
  constructor() {
    this.isEncryptionAvailable = safeStorage.isEncryptionAvailable();
    
    if (!this.isEncryptionAvailable) {
      console.warn('[SecureStorage] Encryption is not available on this platform. API keys will be stored in plain text.');
    }
  }

  /**
   * 加密 API 密钥
   * @param {string} apiKey - 原始 API 密钥
   * @returns {string} 加密后的密钥（Base64 编码）
   */
  encryptApiKey(apiKey) {
    if (!apiKey) {
      return '';
    }

    if (this.isEncryptionAvailable) {
      try {
        const buffer = safeStorage.encryptString(apiKey);
        return buffer.toString('base64');
      } catch (error) {
        console.error('[SecureStorage] Encryption failed:', error);
        // 降级：返回原始密钥
        return apiKey;
      }
    }
    
    // 降级：如果加密不可用，返回原始密钥
    return apiKey;
  }

  /**
   * 解密 API 密钥
   * @param {string} encryptedKey - 加密的密钥（Base64 编码）
   * @returns {string} 解密后的原始密钥
   */
  decryptApiKey(encryptedKey) {
    if (!encryptedKey) {
      return '';
    }

    if (this.isEncryptionAvailable) {
      try {
        const buffer = Buffer.from(encryptedKey, 'base64');
        return safeStorage.decryptString(buffer);
      } catch (error) {
        console.error('[SecureStorage] Decryption failed:', error);
        // 降级：假设是未加密的密钥
        return encryptedKey;
      }
    }
    
    // 降级：如果加密不可用，假设是未加密的密钥
    return encryptedKey;
  }

  /**
   * 检查字符串是否已加密
   * @param {string} value - 待检查的字符串
   * @returns {boolean} 是否已加密
   */
  isEncrypted(value) {
    if (!value) {
      return false;
    }

    // 简单检查：加密后的字符串应该是 Base64 格式且长度较长
    // 这不是完美的检测，但对于大多数情况足够了
    try {
      const buffer = Buffer.from(value, 'base64');
      return buffer.toString('base64') === value && value.length > 20;
    } catch {
      return false;
    }
  }

  /**
   * 掩码显示 API 密钥（用于日志）
   * @param {string} apiKey - API 密钥
   * @returns {string} 掩码后的密钥
   */
  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) {
      return '***';
    }

    const visibleChars = 4;
    const start = apiKey.substring(0, visibleChars);
    const end = apiKey.substring(apiKey.length - visibleChars);
    return `${start}...${end}`;
  }

  /**
   * 验证 API 密钥格式
   * @param {string} apiKey - API 密钥
   * @param {string} type - 密钥类型 (openai, google, gemini, etc.)
   * @returns {boolean} 是否有效
   */
  validateApiKeyFormat(apiKey, type) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // 基本长度检查
    if (apiKey.length < 10) {
      return false;
    }

    // 根据不同类型进行格式验证
    switch (type) {
      case 'openai':
        return apiKey.startsWith('sk-') && apiKey.length > 20;
      case 'google':
        return apiKey.length >= 20;
      case 'gemini':
        return apiKey.length >= 20;
      case 'deepseek':
        return apiKey.startsWith('sk-') && apiKey.length > 20;
      default:
        return apiKey.length >= 10;
    }
  }
}

module.exports = SecureStorage;
