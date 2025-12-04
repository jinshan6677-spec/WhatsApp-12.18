/**
 * 自定义 API 适配器
 * 支持用户配置自定义翻译 API（兼容 OpenAI 格式）
 */

const AITranslationAdapter = require('./AITranslationAdapter');

class CustomAPIAdapter extends AITranslationAdapter {
  constructor(config = {}) {
    super({
      ...config,
      name: config.name || 'Custom API',
      type: 'custom'
    });
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

    if (!this.model || this.model.trim() === '') {
      console.error(`[${this.name}] Model name is required`);
      return false;
    }

    return true;
  }

  /**
   * 测试 API 连接
   * @returns {Promise<boolean>} 连接是否成功
   */
  async testConnection() {
    try {
      const testPrompt = 'Translate "Hello" to Chinese.';
      await this.callAIAPI(testPrompt);
      return true;
    } catch (error) {
      console.error(`[${this.name}] Connection test failed:`, error.message);
      return false;
    }
  }
}

module.exports = CustomAPIAdapter;
