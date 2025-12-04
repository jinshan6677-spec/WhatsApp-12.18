/**
 * AI 翻译适配器
 * 支持 OpenAI GPT-4, Google Gemini, DeepSeek 等兼容 OpenAI API 格式的服务
 */

const TranslationAdapter = require('./TranslationAdapter');
const https = require('https');
const { URL } = require('url');

class AITranslationAdapter extends TranslationAdapter {
  constructor(config = {}) {
    super(config);

    this.apiKey = config.apiKey || '';
    this.apiEndpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
    this.model = config.model || 'gpt-4';
    this.maxTokens = config.maxTokens || 2000;
    this.temperature = config.temperature || 0.3;
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
      // 验证配置
      if (!this.validateConfig()) {
        throw new Error('Invalid API configuration');
      }

      // 验证文本长度
      this.validateTextLength(text, 5000);

      // 标准化语言代码
      const source = this.normalizeLanguageCode(sourceLang);
      const target = this.normalizeLanguageCode(targetLang);

      // 构建提示词
      console.log('[AITranslation] 收到的 options:', JSON.stringify(options));
      const style = options.style || '通用';
      console.log(`[AITranslation] 最终使用风格: ${style}`);
      const prompt = this.buildPrompt(text, source, target, style);

      // 调试：显示提示词预览（仅在非通用风格时显示）
      if (style !== '通用') {
        console.log(`[AITranslation] 提示词预览: ${prompt.substring(0, 200)}...`);
      }

      // 调用 AI API
      const translatedText = await this.callAIAPI(prompt, style);

      return {
        translatedText: translatedText.trim(),
        detectedLang: source,
        engineUsed: this.name
      };

    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 构建翻译提示词
   * @param {string} text - 文本
   * @param {string} sourceLang - 源语言
   * @param {string} targetLang - 目标语言
   * @param {string} style - 翻译风格
   * @returns {string} 提示词
   */
  buildPrompt(text, sourceLang, targetLang, style) {
    const stylePrompts = {
      '通用': {
        instruction: '你是一个专业的翻译助手。请将以下文本翻译成{targetLang}，准确传达原意，保持自然流畅。',
        emphasis: ''
      },
      '正式': {
        instruction: '你是一个专业的商务翻译。请将以下文本翻译成{targetLang}。',
        emphasis: '【重要】必须使用正式、庄重的商务语气。使用敬语、完整句式，避免缩写和口语化表达。语气要专业、严谨、得体。'
      },
      '口语化': {
        instruction: '你是一个日常对话翻译助手。请将以下文本翻译成{targetLang}。',
        emphasis: '【重要】必须使用轻松、随意的日常口语。可以使用缩写、俚语、语气词，就像朋友之间聊天一样自然亲切。避免正式书面语。'
      },
      '亲切': {
        instruction: '你是一个温暖友好的翻译助手。请将以下文本翻译成{targetLang}。',
        emphasis: '【重要】必须使用亲切、温暖、关怀的语气。多用柔和的表达，让人感到被关心和重视。语气要友善、体贴。'
      },
      '幽默': {
        instruction: '你是一个风趣幽默的翻译助手。请将以下文本翻译成{targetLang}。',
        emphasis: '【重要】在准确传达原意的基础上，适当增加幽默感、俏皮话或有趣的表达方式。可以使用双关语、比喻等修辞手法增加趣味性。'
      },
      '礼貌': {
        instruction: '你是一个注重礼仪的翻译助手。请将以下文本翻译成{targetLang}。',
        emphasis: '【重要】必须使用礼貌、尊重、谦逊的语气。多用敬语、委婉表达，体现良好教养和对他人的尊重。'
      },
      '强硬': {
        instruction: '你是一个果断有力的翻译助手。请将以下文本翻译成{targetLang}。',
        emphasis: '【重要】必须使用坚定、有力、果断的语气。用词要直接、明确，展现权威性和决断力。避免模棱两可的表达。'
      },
      '简洁': {
        instruction: '你是一个简明扼要的翻译助手。请将以下文本翻译成{targetLang}。',
        emphasis: '【重要】必须使用最简洁明了的表达。去除所有冗余词汇，用最少的字传达完整意思。追求精炼、直接。'
      },
      '激励': {
        instruction: '你是一个充满正能量的翻译助手。请将以下文本翻译成{targetLang}。',
        emphasis: '【重要】必须使用积极、鼓舞人心、充满正能量的语气。多用激励性词汇，让人感到振奋和充满希望。'
      },
      '中立': {
        instruction: '你是一个客观中立的翻译助手。请将以下文本翻译成{targetLang}。',
        emphasis: '【重要】必须保持中立、客观、不带感情色彩。避免任何主观评价或情绪化表达，保持理性和公正。'
      },
      '专业': {
        instruction: '你是一个专业领域的翻译专家。请将以下文本翻译成{targetLang}。',
        emphasis: '【重要】必须使用专业、技术性、学术化的表达方式。使用行业术语、规范表述，体现专业水准。'
      }
    };

    const targetLangName = this.getLanguageName(targetLang);
    const styleConfig = stylePrompts[style] || stylePrompts['通用'];
    const styleInstruction = styleConfig.instruction.replace('{targetLang}', targetLangName);

    let prompt = styleInstruction;

    if (styleConfig.emphasis) {
      prompt += '\n\n' + styleConfig.emphasis;
    }

    prompt += `

原文：
${text}

翻译要求：
1. 只输出翻译结果，不要包含任何解释、说明或额外内容。
2. 严格遵守上述风格要求，风格特征必须明显体现。
3. 保持原文的完整意思。
4. 【关键】保留原文中的 Markdown 格式（如 **粗体**、*斜体*、\`代码\`、[链接](...) 等）不被破坏。
5. 【关键】保留原文中的 Emoji 表情符号和特殊符号。
6. 【关键】如果原文包含非源语言的内容（如代码片段、专有名词），请保留原样或按惯例翻译。
7. 【关键】如果原文是混合语言，请只翻译主要内容，保留专有名词或无法翻译的部分。`;

    return prompt;
  }

  /**
   * 获取语言名称
   * @param {string} langCode - 语言代码
   * @returns {string} 语言名称
   */
  getLanguageName(langCode) {
    const names = {
      'zh-CN': '中文简体',
      'zh-TW': '中文繁体',
      'en': '英语',
      'ja': '日语',
      'ko': '韩语',
      'es': '西班牙语',
      'fr': '法语',
      'de': '德语',
      'ru': '俄语',
      'ar': '阿拉伯语',
      'pt': '葡萄牙语',
      'it': '意大利语'
    };
    return names[langCode] || langCode;
  }

  /**
   * 调用 AI API
   * @param {string} prompt - 提示词
   * @param {string} style - 翻译风格（用于调整 temperature）
   * @returns {Promise<string>} 翻译结果
   */
  async callAIAPI(prompt, style = '通用') {
    const url = new URL(this.apiEndpoint);

    // 根据风格调整 temperature：需要创造性的风格使用更高的值
    const temperatureMap = {
      '通用': 0.5,
      '正式': 0.3,
      '口语化': 0.8,
      '亲切': 0.7,
      '幽默': 0.9,
      '礼貌': 0.4,
      '强硬': 0.6,
      '简洁': 0.3,
      '激励': 0.8,
      '中立': 0.3,
      '专业': 0.4
    };

    const temperature = temperatureMap[style] || 0.5;

    const requestBody = JSON.stringify({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Follow the style instructions precisely and only output the translation result without any explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: this.maxTokens,
      temperature: temperature
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(requestBody)
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

            if (parsed.error) {
              reject(new Error(`API Error: ${parsed.error.message}`));
              return;
            }

            let translatedText = parsed.choices?.[0]?.message?.content;

            if (!translatedText) {
              reject(new Error('No translation result in response'));
              return;
            }

            // 解码 HTML 实体
            translatedText = this.decodeHTMLEntities(translatedText);

            resolve(translatedText);

          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(requestBody);
      req.end();
    });
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
    if (!this.apiKey || this.apiKey.trim() === '') {
      console.error(`[${this.name}] API key is required`);
      return false;
    }

    if (!this.apiEndpoint || this.apiEndpoint.trim() === '') {
      console.error(`[${this.name}] API endpoint is required`);
      return false;
    }

    return true;
  }

  /**
   * 检查引擎是否可用
   * @returns {boolean} 是否可用
   */
  isAvailable() {
    return super.isAvailable() && this.validateConfig();
  }
}

module.exports = AITranslationAdapter;
