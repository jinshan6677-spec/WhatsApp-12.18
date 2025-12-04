/**
 * 内容安全工具
 * 提供 XSS 过滤、HTML 转义和内容验证功能
 */

class ContentSecurity {
  constructor() {
    // 最大文本长度限制
    this.MAX_TEXT_LENGTH = 10000;
    
    // 危险的 HTML 标签
    this.DANGEROUS_TAGS = [
      'script', 'iframe', 'object', 'embed', 'link', 'style',
      'meta', 'base', 'form', 'input', 'button', 'textarea'
    ];
    
    // 危险的属性
    this.DANGEROUS_ATTRS = [
      'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout',
      'onfocus', 'onblur', 'onchange', 'onsubmit', 'href', 'src'
    ];
  }

  /**
   * HTML 转义
   * @param {string} text - 待转义的文本
   * @returns {string} 转义后的文本
   */
  escapeHtml(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const htmlEscapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };

    return text.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char]);
  }

  /**
   * HTML 反转义
   * @param {string} text - 待反转义的文本
   * @returns {string} 反转义后的文本
   */
  unescapeHtml(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const htmlUnescapeMap = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x2F;': '/'
    };

    return text.replace(/&(?:amp|lt|gt|quot|#x27|#x2F);/g, (entity) => htmlUnescapeMap[entity]);
  }

  /**
   * XSS 过滤 - 移除危险的 HTML 标签和属性
   * @param {string} text - 待过滤的文本
   * @returns {string} 过滤后的文本
   */
  sanitizeInput(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let sanitized = text;

    // 移除危险的 HTML 标签
    this.DANGEROUS_TAGS.forEach(tag => {
      const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gi');
      sanitized = sanitized.replace(regex, '');
      
      // 移除自闭合标签
      const selfClosingRegex = new RegExp(`<${tag}[^>]*/>`, 'gi');
      sanitized = sanitized.replace(selfClosingRegex, '');
    });

    // 移除危险的属性
    this.DANGEROUS_ATTRS.forEach(attr => {
      const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });

    // 移除 javascript: 协议
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    // 移除 data: 协议（可能包含恶意代码）
    sanitized = sanitized.replace(/data:text\/html/gi, '');

    return sanitized;
  }

  /**
   * 验证文本长度
   * @param {string} text - 待验证的文本
   * @param {number} maxLength - 最大长度（可选）
   * @returns {Object} { valid: boolean, error: string }
   */
  validateTextLength(text, maxLength = null) {
    if (!text) {
      return { valid: false, error: 'Text is empty' };
    }

    if (typeof text !== 'string') {
      return { valid: false, error: 'Text must be a string' };
    }

    const limit = maxLength || this.MAX_TEXT_LENGTH;

    if (text.length > limit) {
      return { 
        valid: false, 
        error: `Text exceeds maximum length of ${limit} characters (current: ${text.length})` 
      };
    }

    return { valid: true, error: null };
  }

  /**
   * 清理翻译输入（组合多个安全检查）
   * @param {string} text - 待清理的文本
   * @returns {Object} { text: string, valid: boolean, error: string }
   */
  cleanTranslationInput(text) {
    // 验证长度
    const lengthCheck = this.validateTextLength(text);
    if (!lengthCheck.valid) {
      return { text: '', valid: false, error: lengthCheck.error };
    }

    // XSS 过滤
    const sanitized = this.sanitizeInput(text);

    // 移除多余的空白字符
    const cleaned = sanitized.trim().replace(/\s+/g, ' ');

    return { text: cleaned, valid: true, error: null };
  }

  /**
   * 清理翻译输出（用于显示）
   * @param {string} text - 翻译结果
   * @returns {string} 安全的翻译结果
   */
  cleanTranslationOutput(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // HTML 转义以防止 XSS
    return this.escapeHtml(text);
  }

  /**
   * 检测潜在的恶意内容
   * @param {string} text - 待检测的文本
   * @returns {Object} { isSafe: boolean, threats: string[] }
   */
  detectThreats(text) {
    if (!text || typeof text !== 'string') {
      return { isSafe: true, threats: [] };
    }

    const threats = [];

    // 检测 script 标签
    if (/<script/i.test(text)) {
      threats.push('Contains script tag');
    }

    // 检测 javascript: 协议
    if (/javascript:/i.test(text)) {
      threats.push('Contains javascript: protocol');
    }

    // 检测事件处理器
    if (/on\w+\s*=/i.test(text)) {
      threats.push('Contains event handlers');
    }

    // 检测 iframe
    if (/<iframe/i.test(text)) {
      threats.push('Contains iframe tag');
    }

    // 检测 data: URL
    if (/data:text\/html/i.test(text)) {
      threats.push('Contains data URL');
    }

    // 检测 SQL 注入模式（虽然不太可能，但以防万一）
    if (/(\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b).*(\bFROM\b|\bWHERE\b)/i.test(text)) {
      threats.push('Contains SQL-like patterns');
    }

    return {
      isSafe: threats.length === 0,
      threats
    };
  }

  /**
   * 限制文本长度并添加省略号
   * @param {string} text - 文本
   * @param {number} maxLength - 最大长度
   * @returns {string} 截断后的文本
   */
  truncateText(text, maxLength) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    if (text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * 验证语言代码格式
   * @param {string} langCode - 语言代码
   * @returns {boolean} 是否有效
   */
  validateLanguageCode(langCode) {
    if (!langCode || typeof langCode !== 'string') {
      return false;
    }

    // 支持的格式: en, zh-CN, zh-TW, auto
    const validPattern = /^(auto|[a-z]{2}(-[A-Z]{2})?)$/;
    return validPattern.test(langCode);
  }

  /**
   * 清理日志消息（移除敏感信息）
   * @param {string} message - 日志消息
   * @returns {string} 清理后的消息
   */
  sanitizeLogMessage(message) {
    if (!message || typeof message !== 'string') {
      return '';
    }

    let sanitized = message;

    // 移除可能的 API 密钥模式
    sanitized = sanitized.replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***');
    sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_-]{20,}/gi, 'Bearer ***');
    
    // 移除可能的邮箱地址
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***');
    
    // 移除可能的电话号码
    sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '***-***-****');
    
    // 移除可能的 IP 地址
    sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '*.*.*.*');

    return sanitized;
  }
}

module.exports = ContentSecurity;
