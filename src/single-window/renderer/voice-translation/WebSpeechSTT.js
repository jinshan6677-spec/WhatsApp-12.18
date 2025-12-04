/**
 * Web Speech API 语音识别
 * 使用浏览器原生的 SpeechRecognition API 进行语音转文字
 */

class WebSpeechSTT {
    constructor(options = {}) {
        this.defaultLanguage = options.defaultLanguage || 'auto';
        this.continuous = options.continuous || false;
        this.interimResults = options.interimResults || false;
        this.maxAlternatives = options.maxAlternatives || 1;

        // 检查浏览器支持
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!this.SpeechRecognition) {
            console.warn('[WebSpeechSTT] 浏览器不支持 Web Speech API');
        }
    }

    /**
     * 检查是否支持 Web Speech API
     * @returns {boolean}
     */
    isSupported() {
        return !!this.SpeechRecognition;
    }

    /**
     * 从音频 Blob 转录文字
     * 注意：Web Speech API 不直接支持 Blob 输入，需要播放音频
     * @param {Blob} audioBlob - 音频 Blob
     * @param {string} language - 语言代码（如 'en-US', 'zh-CN'）
     * @returns {Promise<string>} 转录的文本
     */
    async transcribeFromBlob(audioBlob, language = null) {
        if (!this.isSupported()) {
            throw new Error('浏览器不支持 Web Speech API');
        }

        try {
            // 创建音频元素
            const audio = new Audio();
            const objectUrl = URL.createObjectURL(audioBlob);
            audio.src = objectUrl;

            // 静音播放
            audio.volume = 0;
            audio.muted = true;

            // 创建识别器
            const recognition = new this.SpeechRecognition();
            this.setupRecognition(recognition, language);

            // 开始识别
            const transcription = await this.performRecognition(recognition, audio);

            // 清理
            URL.revokeObjectURL(objectUrl);

            return transcription;
        } catch (error) {
            console.error('[WebSpeechSTT] 转录失败:', error);
            throw new Error(`语音识别失败: ${error.message}`);
        }
    }

    /**
     * 从麦克风实时转录（用于未来扩展）
     * @param {string} language - 语言代码
     * @returns {Promise<string>}
     */
    async transcribeFromMicrophone(language = null) {
        if (!this.isSupported()) {
            throw new Error('浏览器不支持 Web Speech API');
        }

        const recognition = new this.SpeechRecognition();
        this.setupRecognition(recognition, language);

        return new Promise((resolve, reject) => {
            let finalTranscript = '';

            recognition.onresult = (event) => {
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    }
                }
            };

            recognition.onend = () => {
                resolve(finalTranscript);
            };

            recognition.onerror = (event) => {
                reject(new Error(`识别错误: ${event.error}`));
            };

            recognition.start();
        });
    }

    /**
     * 设置识别器配置
     * @param {SpeechRecognition} recognition - 识别器实例
     * @param {string} language - 语言代码
     */
    setupRecognition(recognition, language) {
        // 设置语言
        if (language && language !== 'auto') {
            recognition.lang = this.normalizeLanguageCode(language);
        } else {
            // 自动检测，使用常见语言
            recognition.lang = 'en-US';
        }

        recognition.continuous = this.continuous;
        recognition.interimResults = this.interimResults;
        recognition.maxAlternatives = this.maxAlternatives;

        console.log('[WebSpeechSTT] 识别器配置:', {
            lang: recognition.lang,
            continuous: recognition.continuous,
            interimResults: recognition.interimResults
        });
    }

    /**
     * 执行识别
     * @param {SpeechRecognition} recognition - 识别器实例
     * @param {HTMLAudioElement} audio - 音频元素
     * @returns {Promise<string>}
     */
    performRecognition(recognition, audio) {
        return new Promise((resolve, reject) => {
            let finalTranscript = '';
            let recognitionStarted = false;

            recognition.onresult = (event) => {
                console.log('[WebSpeechSTT] 识别结果:', event.results);

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    const confidence = event.results[i][0].confidence;

                    console.log('[WebSpeechSTT] 转录片段:', {
                        transcript,
                        confidence,
                        isFinal: event.results[i].isFinal
                    });

                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    }
                }
            };

            recognition.onend = () => {
                console.log('[WebSpeechSTT] 识别结束，最终文本:', finalTranscript.trim());
                resolve(finalTranscript.trim());
            };

            recognition.onerror = (event) => {
                console.error('[WebSpeechSTT] 识别错误:', event.error);
                reject(new Error(`识别错误: ${event.error}`));
            };

            recognition.onstart = () => {
                console.log('[WebSpeechSTT] 识别已启动');
                recognitionStarted = true;
            };

            // 播放音频并开始识别
            audio.play().then(() => {
                recognition.start();
            }).catch((error) => {
                reject(new Error(`播放音频失败: ${error.message}`));
            });

            // 音频播放结束时停止识别
            audio.onended = () => {
                console.log('[WebSpeechSTT] 音频播放结束');
                if (recognitionStarted) {
                    setTimeout(() => {
                        recognition.stop();
                    }, 500); // 给识别器一点时间处理最后的音频
                }
            };
        });
    }

    /**
     * 规范化语言代码
     * 将翻译系统的语言代码转换为 Web Speech API 支持的格式
     * @param {string} langCode - 语言代码
     * @returns {string}
     */
    normalizeLanguageCode(langCode) {
        const languageMap = {
            'zh-CN': 'zh-CN',
            'zh-TW': 'zh-TW',
            'en': 'en-US',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'vi': 'vi-VN',
            'th': 'th-TH',
            'id': 'id-ID',
            'ms': 'ms-MY',
            'tl': 'fil-PH',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'it': 'it-IT',
            'pt': 'pt-PT',
            'ru': 'ru-RU',
            'ar': 'ar-SA',
            'hi': 'hi-IN',
            'tr': 'tr-TR'
        };

        return languageMap[langCode] || langCode;
    }

    /**
     * 获取支持的语言列表（理论上的，实际支持取决于浏览器）
     * @returns {Array<string>}
     */
    getSupportedLanguages() {
        return [
            'zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR',
            'vi-VN', 'th-TH', 'id-ID', 'ms-MY', 'fil-PH',
            'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-PT',
            'ru-RU', 'ar-SA', 'hi-IN', 'tr-TR'
        ];
    }
}

// Export for browser environment
if (typeof window !== 'undefined') {
    window.WebSpeechSTT = WebSpeechSTT;
}
