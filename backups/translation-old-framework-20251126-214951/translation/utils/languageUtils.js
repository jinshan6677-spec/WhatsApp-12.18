/**
 * 语言工具函数
 */

/**
 * 语言代码映射表
 */
const LANGUAGE_MAP = {
  // 中文
  'zh': 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN',
  'zh-tw': 'zh-TW',
  'zh-hant': 'zh-TW',
  'chinese': 'zh-CN',
  
  // 英语
  'en': 'en',
  'en-us': 'en',
  'en-gb': 'en',
  'english': 'en',
  
  // 日语
  'ja': 'ja',
  'jp': 'ja',
  'japanese': 'ja',
  
  // 韩语
  'ko': 'ko',
  'kr': 'ko',
  'korean': 'ko',
  
  // 东南亚语言
  'vi': 'vi',
  'vietnamese': 'vi',
  'th': 'th',
  'thai': 'th',
  'id': 'id',
  'indonesian': 'id',
  'ms': 'ms',
  'malay': 'ms',
  'tl': 'tl',
  'fil': 'tl',
  'tagalog': 'tl',
  'filipino': 'tl',
  'my': 'my',
  'burmese': 'my',
  'km': 'km',
  'khmer': 'km',
  'cambodian': 'km',
  'lo': 'lo',
  'lao': 'lo',
  
  // 欧洲语言
  'es': 'es',
  'spanish': 'es',
  'fr': 'fr',
  'french': 'fr',
  'de': 'de',
  'german': 'de',
  'it': 'it',
  'italian': 'it',
  'pt': 'pt',
  'pt-br': 'pt',
  'portuguese': 'pt',
  'ru': 'ru',
  'russian': 'ru',
  'nl': 'nl',
  'dutch': 'nl',
  'pl': 'pl',
  'polish': 'pl',
  'uk': 'uk',
  'ukrainian': 'uk',
  'cs': 'cs',
  'czech': 'cs',
  'ro': 'ro',
  'romanian': 'ro',
  'sv': 'sv',
  'swedish': 'sv',
  'da': 'da',
  'danish': 'da',
  'no': 'no',
  'norwegian': 'no',
  'fi': 'fi',
  'finnish': 'fi',
  'el': 'el',
  'greek': 'el',
  'hu': 'hu',
  'hungarian': 'hu',
  'bg': 'bg',
  'bulgarian': 'bg',
  'sr': 'sr',
  'serbian': 'sr',
  'hr': 'hr',
  'croatian': 'hr',
  'sk': 'sk',
  'slovak': 'sk',
  'sl': 'sl',
  'slovenian': 'sl',
  'lt': 'lt',
  'lithuanian': 'lt',
  'lv': 'lv',
  'latvian': 'lv',
  'et': 'et',
  'estonian': 'et',
  
  // 中东和南亚语言
  'ar': 'ar',
  'arabic': 'ar',
  'hi': 'hi',
  'hindi': 'hi',
  'bn': 'bn',
  'bengali': 'bn',
  'ur': 'ur',
  'urdu': 'ur',
  'tr': 'tr',
  'turkish': 'tr',
  'fa': 'fa',
  'persian': 'fa',
  'he': 'he',
  'hebrew': 'he',
  
  // 非洲语言
  'sw': 'sw',
  'swahili': 'sw',
  'af': 'af',
  'afrikaans': 'af',
  'am': 'am',
  'amharic': 'am',
  
  // 自动检测
  'auto': 'auto',
  'detect': 'auto'
};

/**
 * 语言名称映射
 */
const LANGUAGE_NAMES = {
  'zh-CN': '中文简体',
  'zh-TW': '中文繁体',
  'en': '英语',
  'vi': '越南语',
  'ja': '日语',
  'ko': '韩语',
  'th': '泰语',
  'id': '印尼语',
  'ms': '马来语',
  'tl': '菲律宾语',
  'my': '缅甸语',
  'km': '高棉语',
  'lo': '老挝语',
  'es': '西班牙语',
  'fr': '法语',
  'de': '德语',
  'it': '意大利语',
  'pt': '葡萄牙语',
  'ru': '俄语',
  'ar': '阿拉伯语',
  'hi': '印地语',
  'bn': '孟加拉语',
  'ur': '乌尔都语',
  'tr': '土耳其语',
  'fa': '波斯语',
  'he': '希伯来语',
  'nl': '荷兰语',
  'pl': '波兰语',
  'uk': '乌克兰语',
  'cs': '捷克语',
  'ro': '罗马尼亚语',
  'sv': '瑞典语',
  'da': '丹麦语',
  'no': '挪威语',
  'fi': '芬兰语',
  'el': '希腊语',
  'hu': '匈牙利语',
  'bg': '保加利亚语',
  'sr': '塞尔维亚语',
  'hr': '克罗地亚语',
  'sk': '斯洛伐克语',
  'sl': '斯洛文尼亚语',
  'lt': '立陶宛语',
  'lv': '拉脱维亚语',
  'et': '爱沙尼亚语',
  'sw': '斯瓦希里语',
  'af': '南非荷兰语',
  'am': '阿姆哈拉语',
  'auto': '自动检测'
};

/**
 * 标准化语言代码
 * @param {string} lang - 语言代码
 * @returns {string} 标准化后的语言代码
 */
function normalizeLanguageCode(lang) {
  if (!lang) return 'auto';
  
  const normalized = lang.toLowerCase().trim();
  return LANGUAGE_MAP[normalized] || lang;
}

/**
 * 获取语言名称
 * @param {string} langCode - 语言代码
 * @returns {string} 语言名称
 */
function getLanguageName(langCode) {
  return LANGUAGE_NAMES[langCode] || langCode;
}

/**
 * 检测文本是否包含中文
 * @param {string} text - 文本
 * @returns {boolean} 是否包含中文
 */
function containsChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text);
}

/**
 * 简单的语言检测（基于字符集）
 * @param {string} text - 文本
 * @returns {string} 检测到的语言代码
 */
function detectLanguageSimple(text) {
  if (!text || text.trim().length === 0) {
    return 'auto';
  }

  // 中文
  if (/[\u4e00-\u9fa5]/.test(text)) {
    // 检测繁体字
    const traditionalChars = /[繁體爲與臺灣]/;
    return traditionalChars.test(text) ? 'zh-TW' : 'zh-CN';
  }

  // 日文
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
    return 'ja';
  }

  // 韩文
  if (/[\uac00-\ud7af]/.test(text)) {
    return 'ko';
  }

  // 阿拉伯文
  if (/[\u0600-\u06ff]/.test(text)) {
    return 'ar';
  }

  // 泰文
  if (/[\u0e00-\u0e7f]/.test(text)) {
    return 'th';
  }

  // 西里尔字母（俄语等）
  if (/[\u0400-\u04ff]/.test(text)) {
    return 'ru';
  }

  // 默认英语
  return 'en';
}

/**
 * 获取所有支持的语言列表
 * @returns {Array} 语言列表
 */
function getSupportedLanguages() {
  return Object.keys(LANGUAGE_NAMES).map(code => ({
    code,
    name: LANGUAGE_NAMES[code]
  }));
}

module.exports = {
  normalizeLanguageCode,
  getLanguageName,
  containsChinese,
  detectLanguageSimple,
  getSupportedLanguages,
  LANGUAGE_MAP,
  LANGUAGE_NAMES
};
