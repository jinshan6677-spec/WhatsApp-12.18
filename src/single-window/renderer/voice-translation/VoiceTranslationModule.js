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

        // 根据配置选择 STT 提供商
        const sttProvider = this.config.sttProvider || 'webspeech';
        console.log('[VoiceTranslationModule] 使用 STT 提供商:', sttProvider);

        if (sttProvider === 'huggingface' && window.HuggingFaceSTT) {
            this.stt = new window.HuggingFaceSTT({
                apiKey: this.config.huggingfaceApiKey || '',
                model: this.config.huggingfaceModel || 'openai/whisper-large-v3'
            });
            console.log('[VoiceTranslationModule] 使用 Hugging Face STT');
        } else {
            this.stt = new window.WebSpeechSTT({
                defaultLanguage: this.config.sourceLang || 'auto'
            });
            console.log('[VoiceTranslationModule] 使用 Web Speech STT');
        }

        this.isInitialized = false;
        this.isTranslating = false;
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

            // 检查 Web Speech API 支持
            if (!this.stt.isSupported()) {
                console.warn('[VoiceTranslationModule] 浏览器不支持 Web Speech API，语音翻译功能将不可用');
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

        if (this.isTranslating) {
            throw new Error('正在翻译其他语音消息，请稍候');
        }

        try {
            this.isTranslating = true;
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
            // 在识别期间启用静默模式，防止任何潜在的播放
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

            // 返回完整结果
            const result = {
                original: originalText,
                translated: translationResult.translatedText || translationResult,
                sourceLang: translationResult.detectedLanguage || sourceLang,
                targetLang: targetLang,
                engine: engine
            };

            console.log('[VoiceTranslationModule] 翻译完成:', result);
            return result;

        } catch (error) {
            console.error('[VoiceTranslationModule] 翻译失败:', error);
            throw error;
        } finally {
            this.isTranslating = false;
            // 停止播放
            this.playbackController.stopPlayback();
        }
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
            console.log('[VoiceTranslationModule] 翻译文本:', text);

            // 由于 IPC 验证问题，直接使用降级方案（Google 翻译）
            console.log('[VoiceTranslationModule] 使用 Google 翻译降级方案');
            return await this.fallbackTranslate(text, sourceLang, targetLang);
        } catch (error) {
            console.error('[VoiceTranslationModule] 文本翻译失败:', error);
            throw new Error(`翻译失败: ${error.message}`);
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
        try {
            console.log('[VoiceTranslationModule] 调用 Google 翻译 API');

            // 使用 Google 翻译免费 API
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Google 翻译 API 错误: ${response.status}`);
            }

            const data = await response.json();

            // Google 翻译 API 返回格式: [[[翻译文本, 原文本, null, null, 10]], null, "源语言"]
            if (data && data[0] && data[0][0] && data[0][0][0]) {
                const translatedText = data[0].map(item => item[0]).join('');
                console.log('[VoiceTranslationModule] ✓ Google 翻译成功:', translatedText);
                return translatedText;
            } else {
                throw new Error('Google 翻译返回格式不正确');
            }
        } catch (error) {
            console.error('[VoiceTranslationModule] Google 翻译失败:', error);
            throw new Error(`翻译服务不可用: ${error.message}`);
        }
    }

    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[VoiceTranslationModule] 配置已更新:', this.config);
    }

    /**
     * 清理资源
     */
    cleanup() {
        try {
            this.audioInterceptor.cleanup();
            this.audioDownloader.clearCache();
            this.playbackController.stopPlayback();
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
            cacheSize: this.audioDownloader.getCacheSize()
        };
    }
}

// Export for browser environment
if (typeof window !== 'undefined') {
    window.VoiceTranslationModule = VoiceTranslationModule;
}
