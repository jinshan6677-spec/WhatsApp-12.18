/**
 * Google 翻译适配器
 * 使用免费的 Google Translate API
 */

const TranslationAdapter = require('./TranslationAdapter');
const https = require('https');
const querystring = require('querystring');

class GoogleTranslateAdapter extends TranslationAdapter {
  constructor(config = {}) {
    super({
      ...config,
      name: 'Google Translate',
      type: 'google'
    });
    
    this.baseUrl = 'translate.googleapis.com';
    this.maxRetries = 3;
  }

  /**
   * 翻译文本
   * @param {string} text - 待翻译文本
   * @param {string} sourceLang - 源语言
   * @param {string} targetLang - 目标语言
   * @param {Object} options - 翻译选项
   * @returns {Promise<Object>} 翻译结果
   */
  async translate(text, sourceLang, targetLang, options = {}) {
    try {
      // 验证文本长度
      this.validateTextLength(text, 5000);

      // 标准化语言代码
      const source = this.normalizeLanguageCode(sourceLang);
      const target = this.normalizeLanguageCode(targetLang);

      // 如果源语言和目标语言相同，直接返回
      if (source !== 'auto' && source === target) {
        return {
          translatedText: text,
          detectedLang: source,
          engineUsed: this.name
        };
      }

      // 调用 Google Translate API
      const result = await this.callGoogleTranslateAPI(text, source, target);

      return {
        translatedText: result.translatedText,
        detectedLang: result.detectedSourceLanguage || source,
        engineUsed: this.name
      };

    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 调用 Google Translate API
   * @param {string} text - 文本
   * @param {string} source - 源语言
   * @param {string} target - 目标语言
   * @returns {Promise<Object>} API 响应
   */
  async callGoogleTranslateAPI(text, source, target) {
    const params = {
      client: 'gtx',
      sl: source === 'auto' ? 'auto' : source,
      tl: target,
      dt: 't',
      q: text
    };

    const path = `/translate_a/single?${querystring.stringify(params)}`;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path: path,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
              return;
            }

            const parsed = JSON.parse(data);
            
            // Google Translate API 返回格式: [[["翻译文本","原文本",null,null,3]],null,"en"]
            let translatedText = '';
            if (parsed && parsed[0]) {
              for (const item of parsed[0]) {
                if (item[0]) {
                  translatedText += item[0];
                }
              }
            }

            // 解码 HTML 实体
            console.log('[GoogleTranslate] Raw API response:', translatedText);
            translatedText = this.decodeHTMLEntities(translatedText);
            console.log('[GoogleTranslate] After decode:', translatedText);

            const detectedSourceLanguage = parsed[2] || source;

            resolve({
              translatedText: translatedText || text,
              detectedSourceLanguage
            });

          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * 检测语言
   * @param {string} text - 待检测文本
   * @returns {Promise<string>} 语言代码
   */
  async detectLanguage(text) {
    try {
      const result = await this.callGoogleTranslateAPI(text, 'auto', 'en');
      return result.detectedSourceLanguage || 'auto';
    } catch (error) {
      console.warn('Language detection failed, using fallback:', error.message);
      return super.detectLanguage(text);
    }
  }

  /**
   * 解码 HTML 实体
   * @param {string} text - 包含 HTML 实体的文本
   * @returns {string} 解码后的文本
   */
  decodeHTMLEntities(text) {
    if (!text) return text;
    
    // 使用浏览器的 DOMParser 或 textarea 方法解码
    // 但在 Node.js 环境中，我们需要手动解码
    let decoded = text;
    
    // 多次解码以处理双重编码的情况（如 &amp;#x27; -> &#x27; -> '）
    let prevDecoded;
    let iterations = 0;
    const maxIterations = 3; // 防止无限循环
    
    do {
      prevDecoded = decoded;
      decoded = decoded
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&#47;/g, '/')
        .replace(/&apos;/g, "'");
      
      iterations++;
    } while (decoded !== prevDecoded && iterations < maxIterations);
    
    return decoded;
  }

  /**
   * 验证配置
   * @returns {boolean} 配置是否有效
   */
  validateConfig() {
    // Google 免费 API 不需要密钥
    return true;
  }
}

module.exports = GoogleTranslateAdapter;
