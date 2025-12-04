/**
 * Hugging Face STT (Speech-to-Text)
 * 使用 Hugging Face 免费推理 API 进行语音识别
 */

class HuggingFaceSTT {
    constructor(config = {}) {
        this.apiKey = config.apiKey || '';
        this.model = config.model || 'openai/whisper-large-v3';
        this.apiUrl = `https://api-inference.huggingface.co/models/${this.model}`;
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000;
    }

    /**
     * 从 Blob 转录音频
     * @param {Blob} audioBlob - 音频 Blob
     * @param {Object} options - 转录选项
     * @returns {Promise<string>} 转录文本
     */
    async transcribeFromBlob(audioBlob, options = {}) {
        if (!this.apiKey) {
            throw new Error('未配置 Hugging Face API Key');
        }

        console.log('[HuggingFaceSTT] 开始转录音频');
        console.log('[HuggingFaceSTT] 音频大小:', audioBlob.size, 'bytes');
        console.log('[HuggingFaceSTT] 音频类型:', audioBlob.type);

        try {
            // 如果是 MP4，可能需要转换为 WAV
            // Hugging Face Whisper 支持多种格式，先尝试直接发送
            const text = await this.callAPI(audioBlob);

            console.log('[HuggingFaceSTT] ✓ 转录成功:', text);
            return text;
        } catch (error) {
            console.error('[HuggingFaceSTT] 转录失败:', error);
            throw new Error(`语音识别失败: ${error.message}`);
        }
    }

    /**
     * 调用 Hugging Face API（通过主进程 IPC 绕过 CORS）
     * @param {Blob} audioBlob - 音频数据
     * @param {number} retryCount - 重试次数
     * @returns {Promise<string>} 转录文本
     */
    async callAPI(audioBlob, retryCount = 0) {
        try {
            console.log(`[HuggingFaceSTT] 调用 API (尝试 ${retryCount + 1}/${this.maxRetries + 1})`);

            // 检查 sttAPI 是否可用
            if (!window.sttAPI || !window.sttAPI.callHuggingFace) {
                throw new Error('STT API 不可用，请检查 preload 配置');
            }

            // 使用 IPC 调用主进程
            const result = await window.sttAPI.callHuggingFace(
                audioBlob,
                this.apiKey,
                this.model
            );

            if (!result.success) {
                // 如果是可重试的错误（如模型加载中）
                if (result.retryable && retryCount < this.maxRetries) {
                    console.log('[HuggingFaceSTT] 模型正在加载，等待重试...');
                    await this.sleep(this.retryDelay * (retryCount + 1));
                    return this.callAPI(audioBlob, retryCount + 1);
                }

                throw new Error(result.error);
            }

            console.log('[HuggingFaceSTT] API 响应:', result.text);

            if (result.text) {
                return result.text.trim();
            } else {
                throw new Error('API 返回格式不正确');
            }
        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.log(`[HuggingFaceSTT] 重试 ${retryCount + 1}/${this.maxRetries}`);
                await this.sleep(this.retryDelay);
                return this.callAPI(audioBlob, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * 检查是否支持（总是返回 true，因为只需要网络连接）
     * @returns {boolean}
     */
    isSupported() {
        return true; // Hugging Face API 只需要网络连接
    }

    /**
     * 检查 API 状态
     * @returns {Promise<boolean>} API 是否可用
     */
    async checkStatus() {
        if (!this.apiKey) {
            return false;
        }

        try {
            const response = await fetch(this.apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            return response.ok || response.status === 503; // 503 表示模型正在加载
        } catch (error) {
            console.error('[HuggingFaceSTT] 状态检查失败:', error);
            return false;
        }
    }

    /**
     * 更新配置
     * @param {Object} config - 新配置
     */
    updateConfig(config) {
        if (config.apiKey !== undefined) {
            this.apiKey = config.apiKey;
        }
        if (config.model !== undefined) {
            this.model = config.model;
            this.apiUrl = `https://api-inference.huggingface.co/models/${this.model}`;
        }
        console.log('[HuggingFaceSTT] 配置已更新');
    }

    /**
     * 延迟函数
     * @param {number} ms - 毫秒数
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 清理资源
     */
    cleanup() {
        console.log('[HuggingFaceSTT] 清理资源');
        // 目前没有需要清理的资源
    }
}

// Export for browser environment
if (typeof window !== 'undefined') {
    window.HuggingFaceSTT = HuggingFaceSTT;
}
