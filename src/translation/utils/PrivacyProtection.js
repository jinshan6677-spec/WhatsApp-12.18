/**
 * 隐私保护工具
 * 提供数据隐私保护和日志清理功能
 */

const fs = require('fs');
const path = require('path');

class PrivacyProtection {
  constructor() {
    // 敏感信息模式
    this.sensitivePatterns = [
      // API 密钥
      { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: 'sk-***' },
      { pattern: /Bearer\s+[a-zA-Z0-9_-]{20,}/gi, replacement: 'Bearer ***' },
      
      // 邮箱地址
      { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '***@***.***' },
      
      // 电话号码
      { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '***-***-****' },
      { pattern: /\+\d{1,3}\s?\d{1,14}/g, replacement: '+***' },
      
      // IP 地址
      { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '*.*.*.*' },
      
      // URL 中的密钥参数
      { pattern: /([?&])(key|token|apikey|api_key|secret)=[^&\s]+/gi, replacement: '$1$2=***' },
      
      // 信用卡号（基本模式）
      { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '****-****-****-****' }
    ];
  }

  /**
   * 从文本中移除敏感信息
   * @param {string} text - 待处理的文本
   * @returns {string} 清理后的文本
   */
  removeSensitiveInfo(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let cleaned = text;

    // 应用所有敏感信息模式
    this.sensitivePatterns.forEach(({ pattern, replacement }) => {
      cleaned = cleaned.replace(pattern, replacement);
    });

    return cleaned;
  }

  /**
   * 清理日志文件中的敏感信息
   * @param {string} logFilePath - 日志文件路径
   * @returns {Promise<boolean>} 是否成功
   */
  async sanitizeLogFile(logFilePath) {
    try {
      if (!fs.existsSync(logFilePath)) {
        return false;
      }

      const content = fs.readFileSync(logFilePath, 'utf8');
      const sanitized = this.removeSensitiveInfo(content);
      
      fs.writeFileSync(logFilePath, sanitized, 'utf8');
      
      console.log(`[PrivacyProtection] Sanitized log file: ${logFilePath}`);
      return true;
    } catch (error) {
      console.error('[PrivacyProtection] Failed to sanitize log file:', error);
      return false;
    }
  }

  /**
   * 清理目录中的所有日志文件
   * @param {string} logDir - 日志目录路径
   * @returns {Promise<number>} 清理的文件数量
   */
  async sanitizeLogDirectory(logDir) {
    let count = 0;

    try {
      if (!fs.existsSync(logDir)) {
        return count;
      }

      const files = fs.readdirSync(logDir);

      for (const file of files) {
        if (file.endsWith('.log') || file.endsWith('.txt')) {
          const filePath = path.join(logDir, file);
          const success = await this.sanitizeLogFile(filePath);
          if (success) {
            count++;
          }
        }
      }

      console.log(`[PrivacyProtection] Sanitized ${count} log files in ${logDir}`);
    } catch (error) {
      console.error('[PrivacyProtection] Failed to sanitize log directory:', error);
    }

    return count;
  }

  /**
   * 删除旧的日志文件
   * @param {string} logDir - 日志目录路径
   * @param {number} maxAgeDays - 最大保留天数
   * @returns {Promise<number>} 删除的文件数量
   */
  async deleteOldLogs(logDir, maxAgeDays = 30) {
    let count = 0;

    try {
      if (!fs.existsSync(logDir)) {
        return count;
      }

      const files = fs.readdirSync(logDir);
      const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

      for (const file of files) {
        if (file.endsWith('.log') || file.endsWith('.txt')) {
          const filePath = path.join(logDir, file);
          const stats = fs.statSync(filePath);

          if (stats.mtimeMs < cutoffTime) {
            fs.unlinkSync(filePath);
            count++;
          }
        }
      }

      console.log(`[PrivacyProtection] Deleted ${count} old log files from ${logDir}`);
    } catch (error) {
      console.error('[PrivacyProtection] Failed to delete old logs:', error);
    }

    return count;
  }

  /**
   * 验证数据是否包含敏感信息
   * @param {string} text - 待验证的文本
   * @returns {Object} { hasSensitiveInfo: boolean, types: string[] }
   */
  detectSensitiveInfo(text) {
    if (!text || typeof text !== 'string') {
      return { hasSensitiveInfo: false, types: [] };
    }

    const detectedTypes = [];

    // API 密钥
    if (/sk-[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9_-]{20,}/i.test(text)) {
      detectedTypes.push('API Key');
    }

    // 邮箱
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
      detectedTypes.push('Email');
    }

    // 电话号码
    if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|\+\d{1,3}\s?\d{1,14}/.test(text)) {
      detectedTypes.push('Phone Number');
    }

    // IP 地址
    if (/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(text)) {
      detectedTypes.push('IP Address');
    }

    // 信用卡号
    if (/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/.test(text)) {
      detectedTypes.push('Credit Card');
    }

    return {
      hasSensitiveInfo: detectedTypes.length > 0,
      types: detectedTypes
    };
  }

  /**
   * 生成隐私合规报告
   * @param {Object} dataLocations - 数据存储位置
   * @returns {Object} 隐私报告
   */
  generatePrivacyReport(dataLocations) {
    const report = {
      timestamp: new Date().toISOString(),
      dataLocations: dataLocations || {},
      privacyCompliance: {
        localStorageOnly: true,
        encryptedStorage: true,
        noCloudSync: true,
        userControlled: true
      },
      recommendations: [
        'Regularly clear translation history to minimize data retention',
        'Review and remove unused API keys',
        'Enable automatic cache cleanup',
        'Periodically export and backup your configuration'
      ]
    };

    return report;
  }

  /**
   * 匿名化用户数据（用于错误报告）
   * @param {Object} data - 用户数据
   * @returns {Object} 匿名化后的数据
   */
  anonymizeUserData(data) {
    if (!data || typeof data !== 'object') {
      return {};
    }

    const anonymized = JSON.parse(JSON.stringify(data));

    // 递归处理对象
    const anonymizeObject = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          // 匿名化敏感字段
          if (['apiKey', 'api_key', 'token', 'secret', 'password'].includes(key.toLowerCase())) {
            obj[key] = '***';
          } else {
            // 移除其他敏感信息
            obj[key] = this.removeSensitiveInfo(obj[key]);
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          anonymizeObject(obj[key]);
        }
      }
    };

    anonymizeObject(anonymized);
    return anonymized;
  }

  /**
   * 创建安全的错误消息（用于日志）
   * @param {Error} error - 错误对象
   * @returns {string} 安全的错误消息
   */
  createSafeErrorMessage(error) {
    if (!error) {
      return 'Unknown error';
    }

    let message = error.message || 'Unknown error';
    
    // 移除敏感信息
    message = this.removeSensitiveInfo(message);
    
    // 移除文件路径中的用户名
    message = message.replace(/[C-Z]:\\Users\\[^\\]+/gi, 'C:\\Users\\***');
    message = message.replace(/\/home\/[^\/]+/gi, '/home/***');
    message = message.replace(/\/Users\/[^\/]+/gi, '/Users/***');

    return message;
  }
}

module.exports = PrivacyProtection;
