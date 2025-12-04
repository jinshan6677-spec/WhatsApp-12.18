/**
 * 翻译引擎适配器基类
 * 所有翻译引擎都需要继承此类
 */

const { normalizeLanguageCode, detectLanguageSimple } = require('../utils/languageUtils');

class TranslationAdapter {
  constructor(config = {}) {
    this.config = config;
    this.name = config.name || 'unknown';
    this.type = config.type || 'unknown';
  }

  /**
   * 翻译文本
   * @param {string} text - 待翻译文本
   * @param {string} sourceLang - 源语言
   * @param {string} targetLang - 目标语言
   * @param {Object} options - 翻译选项
   * @returns {Promise<Object>} 翻译结果 { translatedText, detectedLang, engineUsed }
   */
  async translate(text, sourceLang, targetLang, options = {}) {
    throw new Error('translate() must be implemented by subclass');
  }

  /**
   * 检测语言
   * @param {string} text - 待检测文本
   * @returns {Promise<string>} 语言代码
   */
  async detectLanguage(text) {
    // 默认使用简单的语言检测
    return detectLanguageSimple(text);
  }

  /**
   * 检查引擎是否可用
   * @returns {boolean} 是否可用
   */
  isAvailable() {
    return this.config.enabled !== false;
  }

  /**
   * 验证配置
   * @returns {boolean} 配置是否有效
   */
  validateConfig() {
    return true;
  }

  /**
   * 标准化语言代码
   * @param {string} lang - 语言代码
   * @returns {string} 标准化后的语言代码
   */
  normalizeLanguageCode(lang) {
    return normalizeLanguageCode(lang);
  }

  /**
   * 验证文本长度
   * @param {string} text - 文本
   * @param {number} maxLength - 最大长度
   * @throws {Error} 文本过长时抛出错误
   */
  validateTextLength(text, maxLength = 5000) {
    if (text.length > maxLength) {
      throw new Error(`Text too long: ${text.length} characters (max: ${maxLength})`);
    }
  }

  /**
   * 处理翻译错误
   * @param {Error} error - 错误对象
   * @returns {Error} 处理后的错误
   */
  handleError(error) {
    console.error(`[${this.name}] Translation error:`, error);
    return error;
  }
}

module.exports = TranslationAdapter;
