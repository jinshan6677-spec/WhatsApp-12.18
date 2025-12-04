class GroqSTT {
    constructor(config = {}) {
        this.apiKey = config.apiKey || '';
        this.model = config.model || 'whisper-large-v3';
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000;
    }

    async transcribeFromBlob(audioBlob) {
        if (!this.apiKey) {
            throw new Error('未配置 Groq API Key');
        }

        try {
            return await this.callAPI(audioBlob);
        } catch (error) {
            throw new Error(`语音识别失败: ${error.message}`);
        }
    }

    async callAPI(audioBlob, retryCount = 0) {
        try {
            if (!window.sttAPI || !window.sttAPI.callGroq) {
                throw new Error('STT API 不可用，请检查 preload 配置');
            }

            const result = await window.sttAPI.callGroq(
                audioBlob,
                this.apiKey,
                this.model
            );

            if (!result.success) {
                if (result.retryable && retryCount < this.maxRetries) {
                    await this.sleep(this.retryDelay * (retryCount + 1));
                    return this.callAPI(audioBlob, retryCount + 1);
                }
                throw new Error(result.error);
            }

            if (result.text) {
                return result.text.trim();
            }
            throw new Error('API 返回格式不正确');
        } catch (error) {
            if (retryCount < this.maxRetries) {
                await this.sleep(this.retryDelay);
                return this.callAPI(audioBlob, retryCount + 1);
            }
            throw error;
        }
    }

    isSupported() {
        return !!(this.apiKey && String(this.apiKey).trim().length > 0);
    }

    async checkStatus() {
        return !!this.apiKey;
    }

    updateConfig(config) {
        if (config.apiKey !== undefined) {
            this.apiKey = config.apiKey;
        }
        if (config.model !== undefined) {
            this.model = config.model;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    cleanup() {}
}

if (typeof window !== 'undefined') {
    window.GroqSTT = GroqSTT;
}

