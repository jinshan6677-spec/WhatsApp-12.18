/**
 * 语音消息翻译助手
 * 为 WhatsApp 语音消息添加翻译按钮和处理翻译逻辑
 */

class VoiceMessageTranslator {
  constructor(core, ui) {
    this.core = core;
    this.ui = ui;
    this.voiceTranslator = null;
    this.processedMessages = new Set();
    this.voiceButtonCheckInterval = null;
    this._scrollListener = null;
    this._scrollAttached = false;
    this._scrollDebounceTimer = null;
  }

    /**
     * 初始化语音翻译模块
     */
  async initVoiceTranslator() {
    if (this.voiceTranslator) {
      return this.voiceTranslator;
    }

        try {
            // 在浏览器环境中，需要确保 VoiceTranslationModule 已加载
            // 这里使用全局变量方式（需要在 preload 或其他地方注入）
            if (typeof VoiceTranslationModule === 'undefined') {
                console.warn('[VoiceMessageTranslator] VoiceTranslationModule not loaded');
                return null;
            }

            this.voiceTranslator = new VoiceTranslationModule({
                translationAPI: window.translationAPI,
                config: {
                    sourceLang: this.core.config.global.sourceLang,
                    targetLang: this.core.config.global.targetLang,
                    engine: this.core.config.global.engine,
                    // STT 配置 - 使用 Groq API
                    sttProvider: 'huggingface', // 保持名称以兼容现有代码
                    huggingfaceApiKey: 'YOUR_API_KEY_HERE', // 请替换为实际的API密钥
                    huggingfaceModel: 'whisper-large-v3'
                }
            });

            this.voiceTranslator.initialize();
            console.log('[VoiceMessageTranslator] Voice translator initialized');
            return this.voiceTranslator;
        } catch (error) {
            console.error('[VoiceMessageTranslator] Failed to initialize voice translator:', error);
            return null;
    }
  }

  updateConfig(newConfig = {}) {
    const cfg = {
      sourceLang: this.core && this.core.config && this.core.config.global ? this.core.config.global.sourceLang : newConfig.sourceLang,
      targetLang: this.core && this.core.config && this.core.config.global ? this.core.config.global.targetLang : newConfig.targetLang,
      engine: this.core && this.core.config && this.core.config.global ? this.core.config.global.engine : newConfig.engine
    };
    if (this.voiceTranslator && typeof this.voiceTranslator.updateConfig === 'function') {
      this.voiceTranslator.updateConfig(cfg);
    }
  }

    /**
     * 为语音消息添加翻译按钮
     */
    /**
     * 为语音消息添加翻译按钮
     */
    addTranslateButtons() {
        const selectors = this.ui.getVoiceAnchorSelectors();
        const elements = [];
        selectors.forEach(sel => elements.push(...document.querySelectorAll(sel)));

        const seen = new Set();
        let foundCount = 0;

        elements.forEach(el => {
            const bubble = this.ui.findBubbleContainer(el);
            if (!bubble) return;
            const msgId = this.getMessageId(bubble);
            if (seen.has(msgId)) return;
            seen.add(msgId);

            const hasButton = !!bubble.querySelector('.wa-voice-translate-block');
            const hasResult = !!bubble.querySelector('.wa-voice-result-container');
            if (this.processedMessages.has(msgId) && (hasButton || hasResult)) {
                return;
            }
            if (hasButton || hasResult) {
                this.processedMessages.add(msgId);
                return;
            }

            const translateBtn = this.ui.createVoiceTranslateButton(bubble);
            translateBtn.onclick = async () => {
                await this.handleTranslateClick(bubble, translateBtn);
            };
            if (translateBtn.parentElement !== bubble) {
                bubble.appendChild(translateBtn);
            }
            this.processedMessages.add(msgId);
            foundCount++;
        });

        if (foundCount > 0) {
            console.log(`[VoiceMessageTranslator] Added buttons to ${foundCount} messages`);
        }
    }

    /**
     * 处理翻译按钮点击
     */
    async handleTranslateClick(messageElement, button) {
        let playerContainer = null;
        try {
            const { bubble, anchor } = this.ui.resolveBubbleAndAnchor(messageElement, null);
            if (!bubble) {
                throw new Error('未找到语音消息元素');
            }

            playerContainer = anchor || null;

            this.ui.showVoiceTranslationLoading(bubble, playerContainer);

            const translator = await this.initVoiceTranslator();
            if (!translator) {
                throw new Error('语音翻译模块未加载，请检查配置');
            }

            const elementToTranslate = bubble;

            const result = await translator.translateVoiceMessage(elementToTranslate, {
                sourceLang: this.core.config.global.sourceLang,
                targetLang: this.core.config.global.targetLang,
                engine: this.core.config.global.engine
            });

            this.ui.displayVoiceTranslation(
                bubble,
                result,
                playerContainer,
                () => this.handleTranslateClick(bubble, button)
            );

        } catch (error) {
            console.error('[VoiceMessageTranslator] Translation failed:', error);
            this.ui.displayVoiceTranslationError(
                messageElement,
                error.message,
                playerContainer,
                () => this.handleTranslateClick(messageElement, button)
            );
        }
    }

    /**
     * 获取消息 ID（用于去重）
     */
    getMessageId(element) {
        // 尝试多种方式获取唯一标识
        const dataId = element.getAttribute('data-id');
        if (dataId) return dataId;

        const msgContainer = element.closest('[data-id]');
        if (msgContainer) return msgContainer.getAttribute('data-id');

        // 使用元素的位置作为备用标识
        return element.getBoundingClientRect().top + '_' + element.getBoundingClientRect().left;
    }

    /**
     * 开始观察语音消息
     */
  startObserving() {
    // 初始添加按钮
    this.addTranslateButtons();

        // 使用 MutationObserver 监听新的语音消息
        const observer = new MutationObserver((mutations) => {
            // 检查是否有新的语音消息或DOM变化
            const hasChanges = mutations.some(mutation => {
                // 检查新增节点
                if (mutation.addedNodes.length > 0) {
                    return Array.from(mutation.addedNodes).some(node => {
                        if (node.nodeType === 1) {
                            // 检查是否包含语音消息元素
                            return node.querySelector('[data-icon="audio-play"]') ||
                                node.querySelector('[data-icon="audio-pause"]') ||
                                node.querySelector('[data-icon="ptt-in-blue"]') ||
                                node.querySelector('span[data-icon="ptt-in-blue"]');
                        }
                        return false;
                    });
                }
                return false;
            });

            if (hasChanges) {
                // 延迟执行以确保DOM完全渲染
                setTimeout(() => this.addTranslateButtons(), 100);
            }
        });

        // 观察聊天容器
        const chatContainer = document.querySelector('[data-testid="conversation-panel-messages"]') ||
            document.querySelector('#main');

    if (chatContainer) {
      observer.observe(chatContainer, {
        childList: true,
        subtree: true
      });
      console.log('[VoiceMessageTranslator] Started observing voice messages');

      if (!this._scrollAttached) {
        this._scrollListener = () => {
          if (this._scrollDebounceTimer) {
            clearTimeout(this._scrollDebounceTimer);
          }
          this._scrollDebounceTimer = setTimeout(() => this.addTranslateButtons(), 150);
        };
        chatContainer.addEventListener('scroll', this._scrollListener, true);
        this._scrollAttached = true;
        console.log('[VoiceMessageTranslator] Scroll listener attached');
      }
    }

        // 添加窗口焦点事件监听，修复切换窗口后按钮消失问题
        window.addEventListener('focus', () => {
            this.processedMessages.clear();
            console.log('[VoiceMessageTranslator] Window focused, re-scanning messages');
            setTimeout(() => this.addTranslateButtons(), 200);
        });

        // 添加可见性变化监听
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.processedMessages.clear();
        console.log('[VoiceMessageTranslator] Page visible, re-scanning messages');
        setTimeout(() => this.addTranslateButtons(), 200);
      }
    });

    this.observer = observer;

    if (this.voiceButtonCheckInterval) {
      clearInterval(this.voiceButtonCheckInterval);
    }
    this.voiceButtonCheckInterval = setInterval(() => {
      this.addTranslateButtons();
    }, 1500);
    console.log('[VoiceMessageTranslator] Periodic button check started');
  }

    /**
     * 清理资源
     */
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.processedMessages.clear();
    if (this.voiceTranslator) {
      this.voiceTranslator.cleanup();
    }
    if (this.voiceButtonCheckInterval) {
      clearInterval(this.voiceButtonCheckInterval);
      this.voiceButtonCheckInterval = null;
    }
    if (this._scrollAttached && this._scrollListener) {
      const chatContainer = document.querySelector('[data-testid="conversation-panel-messages"]') ||
        document.querySelector('#main');
      if (chatContainer) {
        chatContainer.removeEventListener('scroll', this._scrollListener, true);
      }
      this._scrollAttached = false;
      this._scrollListener = null;
    }
    const leftovers = document.querySelectorAll('.wa-voice-translate-block, .wa-voice-result-container');
    leftovers.forEach(el => el.remove());
    console.log('[VoiceMessageTranslator] Cleaned up');
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceMessageTranslator;
}
