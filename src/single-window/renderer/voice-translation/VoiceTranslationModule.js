/**
 * 语音翻译模块
 * 主协调器，整合所有组件完成语音翻译流程
 */

class VoiceTranslationModule {
    constructor(options = {}) {
        this.translationAPI = options.translationAPI || window.translationAPI;
        this.config = options.config || {};

        // 初始化各个组件（使用全局变量）
        this.audioInterceptor = new window.AudioInterceptor();
        this.playbackController = new window.SilentPlaybackController();
        this.audioDownloader = new window.AudioDownloader();

        this.stt = new window.GroqSTT({
            apiKey: this.config.groqApiKey || '',
            model: this.config.groqModel || 'whisper-large-v3'
        });

        this.isInitialized = false;
        this.isTranslating = false;
        this.maxQueueSize = options.maxQueueSize || this.config.maxQueueSize || 8;
        this.queue = [];
    }

    /**
     * 初始化模块
     */
    initialize() {
        if (this.isInitialized) {
            console.log('[VoiceTranslationModule] 已经初始化');
            return;
        }

        try {
            // 设置音频拦截器
            this.audioInterceptor.setup();

            if (!this.stt.isSupported()) {
                console.warn('[VoiceTranslationModule] STT 不可用');
            }

            this.isInitialized = true;
            console.log('[VoiceTranslationModule] 初始化成功');
        } catch (error) {
            console.error('[VoiceTranslationModule] 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 检查是否可用
     * @returns {boolean}
     */
    isAvailable() {
        return this.isInitialized && this.stt.isSupported();
    }

    /**
     * 翻译语音消息
     * @param {HTMLElement} messageElement - 语音消息元素
     * @param {Object} options - 翻译选项
     * @returns {Promise<Object>} 翻译结果 {original, translated, sourceLang, targetLang}
     */
    async translateVoiceMessage(messageElement, options = {}) {
        if (!this.isAvailable()) {
            throw new Error('语音翻译功能不可用');
        }
        if (this.queue.length >= this.maxQueueSize) {
            throw new Error('翻译队列已满，请稍后再试');
        }
        return new Promise((resolve, reject) => {
            this.queue.push({ messageElement, options, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isTranslating) return;
        const task = this.queue.shift();
        if (!task) return;
        const { messageElement, options, resolve, reject } = task;
        this.isTranslating = true;
        try {
            const result = await this.doTranslateVoiceMessage(messageElement, options);
            resolve(result);
        } catch (err) {
            reject(err);
        } finally {
            this.isTranslating = false;
            this.playbackController.stopPlayback();
            // 继续处理下一个
            this.processQueue();
        }
    }

    async doTranslateVoiceMessage(messageElement, options = {}) {
        console.log('[VoiceTranslationModule] 开始翻译语音消息');

        // 步骤 1: 触发静默播放并捕获 blob URL
        console.log('[VoiceTranslationModule] 步骤 1: 触发静默播放');
        const blobUrl = await this.playbackController.triggerSilentPlayback(messageElement);

        // 步骤 2: 下载音频
        console.log('[VoiceTranslationModule] 步骤 2: 下载音频');
        const audioBlob = await this.audioDownloader.download(blobUrl);

        // 步骤 3: 语音识别
        console.log('[VoiceTranslationModule] 步骤 3: 语音识别');
        const sourceLang = options.sourceLang || this.config.sourceLang || 'auto';
        window.__SILENT_PLAYBACK_MODE__ = true;
        this.playbackController.enableGlobalSilentUI();
        let originalText;
        try {
            originalText = await this.stt.transcribeFromBlob(audioBlob, sourceLang);
        } finally {
            window.__SILENT_PLAYBACK_MODE__ = false;
            this.playbackController.disableGlobalSilentUI();
        }

        if (!originalText || originalText.trim().length === 0) {
            throw new Error('未能识别语音内容，请确保语音清晰');
        }

        console.log('[VoiceTranslationModule] 识别结果:', originalText);

        // 步骤 4: 翻译文本
        console.log('[VoiceTranslationModule] 步骤 4: 翻译文本');
        const targetLang = options.targetLang || this.config.targetLang || 'zh-CN';
        const engine = options.engine || this.config.engine || 'google';

        const translationResult = await this.translateText(
            originalText,
            sourceLang,
            targetLang,
            engine
        );

        const result = {
            original: originalText,
            translated: translationResult.translatedText || translationResult,
            sourceLang: translationResult.detectedLanguage || sourceLang,
            targetLang: targetLang,
            engine: engine
        };
        console.log('[VoiceTranslationModule] 翻译完成:', result);
        return result;
    }

    /**
     * 翻译文本（调用现有翻译服务）
     * @param {string} text - 待翻译文本
     * @param {string} sourceLang - 源语言
     * @param {string} targetLang - 目标语言
     * @param {string} engine - 翻译引擎
     * @returns {Promise<Object>}
     */
    async translateText(text, sourceLang, targetLang, engine) {
        try {
            const apiKey = this.config.groqApiKey || '';
            const model = this.config.groqTextModel || 'llama-3.1-70b-versatile';

            if (!apiKey) {
                throw new Error('未配置 Groq API Key');
            }

            const prompt = `请将以下文本从${sourceLang}翻译成${targetLang}，只输出译文：\n\n${text}`;
            const res = await window.llmAPI.translateWithGroq(apiKey, model, prompt);
            if (!res.success) {
                return await this.fallbackTranslate(text, sourceLang, targetLang);
            }
            return {
                translatedText: res.text,
                detectedLanguage: sourceLang
            };
        } catch (error) {
            return await this.fallbackTranslate(text, sourceLang, targetLang);
        }
    }

    /**
     * 降级翻译方案（使用 Google 翻译 API）
     * @param {string} text - 待翻译文本
     * @param {string} sourceLang - 源语言
     * @param {string} targetLang - 目标语言
     * @returns {Promise<Object>}
     */
    async fallbackTranslate(text, sourceLang, targetLang) {
        const apiKey = this.config.groqApiKey || '';
        const model = this.config.groqTextModelFallback || 'llama-3.1-8b-instant';
        if (apiKey) {
            const prompt = `请将以下文本从${sourceLang}翻译成${targetLang}，只输出译文：\n\n${text}`;
            const res = await window.llmAPI.translateWithGroq(apiKey, model, prompt);
            if (res && res.success) {
                return {
                    translatedText: res.text,
                    detectedLanguage: sourceLang
                };
            }
        }
        return await this.fallbackGoogleTranslate(text, sourceLang, targetLang);
    }

    async fallbackGoogleTranslate(text, sourceLang, targetLang) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await (typeof window !== 'undefined' && window.fetch ? window.fetch(url) : Promise.reject(new Error('网络不可用')));
        if (!response || !response.ok) {
            const status = response && response.status ? response.status : 0;
            throw new Error(`Google 翻译 API 错误: ${status}`);
        }
        const data = await response.json();
        if (data && data[0] && Array.isArray(data[0])) {
            const translatedText = data[0].map(item => item[0]).join('');
            if (translatedText) {
                return {
                    translatedText,
                    detectedLanguage: sourceLang
                };
            }
        }
        throw new Error('Google 翻译返回格式不正确');
    }

    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (this.stt && typeof this.stt.updateConfig === 'function') {
            this.stt.updateConfig({
                apiKey: this.config.groqApiKey,
                model: this.config.groqModel
            });
        }
        console.log('[VoiceTranslationModule] 配置已更新:', this.config);
    }

    cancelPending() {
        try {
            const pending = this.queue.splice(0, this.queue.length);
            pending.forEach(task => {
                try { task.reject(new Error('语音翻译任务已取消')); } catch (_) {}
            });
        } catch (_) {}
    }

    /**
     * 清理资源
     */
    cleanup() {
        try {
            this.cancelPending();
            this.audioInterceptor.cleanup();
            this.audioDownloader.clearCache();
            this.playbackController.stopPlayback();
            this.queue = [];
            this.isTranslating = false;
            this.isInitialized = false;
            console.log('[VoiceTranslationModule] 清理完成');
        } catch (error) {
            console.error('[VoiceTranslationModule] 清理失败:', error);
        }
    }

    /**
     * 获取模块状态
     * @returns {Object}
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            available: this.isAvailable(),
            translating: this.isTranslating,
            sttSupported: this.stt.isSupported(),
            cacheSize: this.audioDownloader.getCacheSize(),
            queueSize: this.queue.length
        };
    }
}

// Export for browser environment
if (typeof window !== 'undefined') {
    window.VoiceTranslationModule = VoiceTranslationModule;
}
