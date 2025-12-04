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

      const style = options.style || '通用';
      const prompt = this.buildPrompt(text, source, target, style);

      const translatedText = await this.callAIAPI(prompt, style, options.agent);

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
        instruction: '你是一位专业的翻译专家。请将以下文本翻译成{targetLang}，准确传达原意，保持自然流畅。',
        emphasis: ''
      },
      '正式': {
        instruction: '你是一位资深的商务翻译专家。请将以下文本翻译成{targetLang}。',
        emphasis: '风格要求：使用正式、庄重的商务语气。采用敬语和完整句式，避免缩写、口语化表达和随意用词。保持专业、严谨、得体的语言风格，体现商务场合的正式性和权威性。'
      },
      '口语化': {
        instruction: '你是一位擅长日常对话的翻译专家。请将以下文本翻译成{targetLang}。',
        emphasis: '风格要求：使用轻松、随意的日常口语风格。可以使用缩写、常见俚语、语气词，就像朋友之间聊天一样自然亲切。避免过于正式的书面语，让表达更接地气、更生活化。'
      },
      '亲切': {
        instruction: '你是一位温暖友好的翻译专家。请将以下文本翻译成{targetLang}。',
        emphasis: '风格要求：使用亲切、温暖、关怀的语气。采用柔和、体贴的表达方式，让人感到被关心和重视。选择温和的词汇，传递友善、善意和人文关怀。'
      },
      '幽默': {
        instruction: '你是一位风趣幽默的翻译专家。请将以下文本翻译成{targetLang}。',
        emphasis: '风格要求：使用轻松、风趣、俏皮的表达方式。在忠实原文意思的前提下，选择更生动、更有趣的词汇和表达。如果原文有双关语、俏皮话或幽默元素，要巧妙地在译文中体现出来。注意：不要添加原文没有的笑话或幽默内容，只是让表达方式更轻松活泼。'
      },
      '礼貌': {
        instruction: '你是一位注重礼仪的翻译专家。请将以下文本翻译成{targetLang}。',
        emphasis: '风格要求：使用礼貌、尊重、谦逊的语气。多用敬语、委婉表达和礼貌用语，避免直白或生硬的表述。体现良好教养和对他人的充分尊重，让译文更得体、更有礼节。'
      },
      '强硬': {
        instruction: '你是一位翻译专家。请将以下文本翻译成{targetLang}。',
        emphasis: '风格要求：使用坚定、有力、果断的语气。用词直接、明确、不留余地，展现权威性和决断力。避免模棱两可、犹豫不决的表达，让译文更有力量感和说服力。'
      },
      '简洁': {
        instruction: '你是一位翻译专家。请将以下文本翻译成{targetLang}。',
        emphasis: '风格要求：使用最简洁明了的表达。去除一切冗余词汇和修饰语，用最少的字传达完整准确的意思。追求精炼、直接、高效的表达方式，让每个字都有价值。'
      },
      '激励': {
        instruction: '你是一位充满正能量的翻译专家。请将以下文本翻译成{targetLang}。',
        emphasis: '风格要求：使用积极、鼓舞人心、充满活力的表达方式。选择更有力量感和正面情绪的词汇，传递希望、信心和动力。在忠实原意的基础上，让译文更能激发读者的积极情绪和行动力。'
      },
      '中立': {
        instruction: '你是一位客观中立的翻译专家。请将以下文本翻译成{targetLang}。',
        emphasis: '风格要求：保持中立、客观、不带任何感情色彩。避免任何主观评价、情绪化表达或倾向性用词。使用理性、公正、平衡的语言风格，确保译文的客观性和中立性。'
      },
      '专业': {
        instruction: '你是一位专业领域的资深翻译专家。请将以下文本翻译成{targetLang}。',
        emphasis: '风格要求：使用专业、技术性、学术化的表达方式。优先使用行业术语、专业词汇和规范表述，避免口语化和通俗化表达。体现专业水准和学术严谨性。'
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
1. 【核心】忠实传达原文的完整意思、语气和情感色彩
2. 【风格】在忠实原文的基础上，充分体现上述风格特征
3. 【输出】只输出翻译结果，不要包含任何解释、注释或额外内容
4. 【格式】完整保留原文中的 Markdown 格式（**粗体**、*斜体*、\`代码\`、[链接]、列表等）
5. 【Emoji】如果原文有 Emoji 表情符号，必须保留；如果原文没有，绝不添加
6. 【纯净】不要添加原文中没有的任何符号、表情、标点或装饰性内容
7. 【特殊内容】保留代码片段、专有名词、品牌名称、人名、地名等特殊内容
8. 【混合语言】对于混合语言文本，只翻译需要翻译的部分，保持其他部分不变`;

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
  async callAIAPI(prompt, style = '通用', agent) {
    const url = new URL(this.apiEndpoint);

    // 根据风格调整 temperature：需要创造性的风格使用更高的值
    const temperatureMap = {
      '通用': 0.5,
      '正式': 0.2,   // 降低以提高稳定性和准确性
      '口语化': 0.8,
      '亲切': 0.7,
      '幽默': 0.9,
      '礼貌': 0.3,   // 降低以确保礼貌表达更稳定
      '强硬': 0.6,
      '简洁': 0.2,   // 降低以确保更精准简洁
      '激励': 0.8,
      '中立': 0.2,   // 降低以确保更客观中立
      '专业': 0.3    // 降低以提高专业术语准确性
    };

    const temperature = temperatureMap[style] || 0.5;

    const requestBody = JSON.stringify({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: '你是一位专业的翻译专家。请严格遵循风格指示，只输出翻译结果，不要包含任何解释、说明或额外内容。'
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
        },
        agent: agent || new https.Agent({ keepAlive: true })
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
