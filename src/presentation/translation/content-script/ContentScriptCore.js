/**
 * ContentScriptCore - Core initialization and configuration management
 * Handles initialization, configuration loading, and lifecycle management
 */

class ContentScriptCore {
  constructor() {
    this.config = null;
    this.initialized = false;
    this.accountId = 'default';
    this._lastContactId = null;
    this._lastLogTime = {};
  }

  /**
   * Initialize the translation system
   */
  async init() {
    if (this.initialized) {
      console.log('[Translation] Already initialized');
      return;
    }

    try {
      // Wait for WhatsApp Web to load
      await this.waitForWhatsApp();
      console.log('[Translation] WhatsApp Web loaded');

      // Load configuration
      await this.loadConfig();
      console.log('[Translation] Config loaded:', this.config);

      this.initialized = true;
      console.log('[Translation] Core initialized successfully');

      // 导出全局方法，确保 IPC 处理器可以调用
      this.exportGlobalMethods();

    } catch (error) {
      console.error('[Translation] Initialization failed:', error);
    }
  }

  /**
   * Wait for WhatsApp Web to load
   */
  waitForWhatsApp() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // Check if chat container exists
        const chatContainer = document.querySelector('[data-testid="conversation-panel-messages"]') ||
          document.querySelector('#main') ||
          document.querySelector('[role="application"]');

        if (chatContainer) {
          clearInterval(checkInterval);
          // Wait an extra second to ensure full load
          setTimeout(resolve, 1000);
        }
      }, 500);

      // Timeout protection
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Load configuration
   */
  async loadConfig() {
    try {
      if (window.translationAPI) {
        const response = await window.translationAPI.getConfig(this.accountId);
        
        // The IPC handler returns the config directly (not wrapped in { success, data })
        // because ipcMain.handle returns response.data
        if (response) {
          // Check if response is the config object itself or wrapped
          if (response.success !== undefined) {
            // Wrapped response: { success: true, data: config }
            this.config = response.data || response.config || this.getDefaultConfig();
          } else if (response.global || response.inputBox || response.advanced) {
            // Direct config object
            this.config = response;
          } else {
            console.warn('[Translation] Unexpected config format:', response);
            this.config = this.getDefaultConfig();
          }
        } else {
          console.error('[Translation] Empty config response');
          this.config = this.getDefaultConfig();
        }
      } else {
        console.warn('[Translation] translationAPI not available, using default config');
        this.config = this.getDefaultConfig();
      }
    } catch (error) {
      console.error('[Translation] Error loading config:', error);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      global: {
        autoTranslate: false,
        engine: 'google',
        sourceLang: 'auto',
        targetLang: 'zh-CN',
        groupTranslation: false
      },
      inputBox: {
        enabled: false,
        engine: 'google',
        style: '通用',
        targetLang: 'auto'
      },
      advanced: {
        friendIndependent: false,
        blockChinese: false,
        realtime: false,
        reverseTranslation: false,
        voiceTranslation: false,
        imageTranslation: false
      },
      friendConfigs: {}
    };
  }

  /**
   * 获取当前聊天的联系人 ID
   * 优化：添加日志节流，只在联系人变化时输出日志
   */
  getCurrentContactId() {
    try {
      // 方法1: 从 URL 获取联系人 ID
      const urlMatch = window.location.href.match(/\/chat\/([^/]+)/);
      if (urlMatch && urlMatch[1]) {
        const contactId = decodeURIComponent(urlMatch[1]);
        // 只在联系人变化时输出日志
        if (this._lastContactId !== contactId) {
          console.log('[Translation] Contact ID changed to:', contactId);
          this._lastContactId = contactId;
        }
        return contactId;
      }

      // 方法2: 从聊天标题获取
      const header = document.querySelector('#main header [data-testid="conversation-info-header"]') ||
        document.querySelector('#main header span[dir="auto"]') ||
        document.querySelector('header[data-testid="chatlist-header"] + div span[dir="auto"]');

      if (header) {
        const contactName = header.textContent.trim();
        if (contactName) {
          // 只在联系人变化时输出日志
          if (this._lastContactId !== contactName) {
            console.log('[Translation] Contact ID changed to:', contactName);
            this._lastContactId = contactName;
          }
          return contactName;
        }
      }

      // 只在第一次失败时输出警告
      if (this._lastContactId !== null) {
        console.warn('[Translation] Could not determine contact ID');
        this._lastContactId = null;
      }
      return null;
    } catch (error) {
      console.error('[Translation] Error getting contact ID:', error);
      return null;
    }
  }

  // 将方法暴露到全局，让旧版本的代码可以调用
  exportGlobalMethods() {
    if (typeof window !== 'undefined') {
      // 确保window.WhatsAppTranslation存在
      if (!window.WhatsAppTranslation) {
        window.WhatsAppTranslation = {};
      }
      // 暴露getCurrentContactId方法
      window.WhatsAppTranslation.getCurrentContactId = this.getCurrentContactId.bind(this);
    }
  }

  /**
   * Get contact configuration (prioritize independent config)
   */
  getContactConfig(contactId) {
    console.log('[Translation] getContactConfig called with contactId:', contactId);
    console.log('[Translation] friendIndependent enabled:', this.config.advanced.friendIndependent);
    console.log('[Translation] friendConfigs:', this.config.friendConfigs);

    // If friend independent config is not enabled, return global config
    if (!this.config.advanced.friendIndependent) {
      console.log('[Translation] Friend independent config is disabled, using global config');
      return this.config.global;
    }

    // Check if there's an independent config for this contact
    if (contactId && this.config.friendConfigs && this.config.friendConfigs[contactId]) {
      const friendConfig = this.config.friendConfigs[contactId];
      console.log('[Translation] Found friend config for', contactId, ':', friendConfig);

      if (friendConfig.enabled) {
        const mergedConfig = {
          ...this.config.global,
          targetLang: friendConfig.targetLang || this.config.global.targetLang,
          blockChinese: friendConfig.blockChinese !== undefined ? friendConfig.blockChinese : this.config.advanced.blockChinese
        };
        console.log('[Translation] ✓ Using friend-specific config:', mergedConfig);
        return mergedConfig;
      } else {
        console.log('[Translation] Friend config exists but is disabled');
      }
    } else {
      console.log('[Translation] No friend config found for:', contactId);
    }

    // Return global config
    console.log('[Translation] Using global config');
    return this.config.global;
  }

  /**
   * Check if it's a group chat
   */
  isGroupChat() {
    const header = document.querySelector('[data-testid="conversation-info-header"]');
    if (!header) return false;

    const groupIcon = header.querySelector('[data-icon="default-group"]') ||
      header.querySelector('[data-icon="group"]');

    return !!groupIcon;
  }

  /**
   * Check if text contains Chinese
   */
  containsChinese(text) {
    return /[\u4e00-\u9fa5]/.test(text);
  }

  /**
   * Check if text is primarily Chinese
   */
  isChinese(text) {
    // Check for Japanese kana
    const hasHiragana = /[\u3040-\u309f]/.test(text);
    const hasKatakana = /[\u30a0-\u30ff]/.test(text);

    if (hasHiragana || hasKatakana) {
      return false;
    }

    // Check for Korean
    const hasKorean = /[\uac00-\ud7af]/.test(text);
    if (hasKorean) {
      return false;
    }

    // Count Chinese characters
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
    const chineseCount = chineseChars ? chineseChars.length : 0;

    // If Chinese characters exceed 50%, consider it Chinese
    const totalChars = text.replace(/\s/g, '').length;
    const chineseRatio = totalChars > 0 ? chineseCount / totalChars : 0;

    return chineseRatio > 0.5;
  }

  /**
   * Calculate similarity between two texts (for reverse translation validation)
   */
  calculateSimilarity(text1, text2) {
    // Normalize text
    const normalize = (text) => {
      return text.toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fa5]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const s1 = normalize(text1);
    const s2 = normalize(text2);

    if (s1 === s2) return 1.0;

    // Calculate Levenshtein distance
    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
    if (len2 === 0) return 0.0;

    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);

    // Return similarity (0-1)
    return 1 - (distance / maxLen);
  }

  /**
   * Decode HTML entities in browser
   */
  decodeHTMLEntitiesInBrowser(text) {
    if (!text) return text;

    const textarea = document.createElement('textarea');
    let decoded = text;
    let prevDecoded;
    let iterations = 0;

    // Decode multiple times to handle double encoding
    do {
      prevDecoded = decoded;
      textarea.innerHTML = decoded;
      decoded = textarea.value;
      iterations++;
    } while (decoded !== prevDecoded && iterations < 3);

    return decoded;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.initialized = false;
    this._lastContactId = null;
    this._lastLogTime = {};
    console.log('[Translation] Core cleaned up');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentScriptCore;
}
