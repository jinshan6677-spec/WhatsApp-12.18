/**
 * 静默播放控制器
 * 控制语音消息的静默播放（用户听不到声音）
 * 用于触发音频下载而不打扰用户
 */

class SilentPlaybackController {
    constructor() {
        this.isPlaying = false;
        this.currentAudio = null;
        this.previousAudioState = null;
        if (!window.__AUDIO_STATE_MONITOR__) {
            window.__AUDIO_STATE_MONITOR__ = setInterval(() => {
                try {
                    const audios = document.querySelectorAll('audio');
                    audios.forEach(a => {
                        if (!window.__SILENT_PLAYBACK_MODE__ && (a.muted || a.volume === 0)) {
                            a.muted = false;
                            a.volume = 1;
                        }
                    });
                } catch (_) {}
            }, 5000);
        }
    }

    /**
     * 触发静默播放
     * @param {HTMLElement} messageElement - 语音消息元素
     * @returns {Promise<string>} 返回捕获到的 blob URL
     */
    async triggerSilentPlayback(messageElement) {
        if (this.isPlaying) {
            throw new Error('已有语音消息正在播放');
        }

        // 1. 检查是否已经有加载好的音频 (优化：如果已加载，直接使用)
        const existingAudio = this.findAudioElement(messageElement);
        if (existingAudio && existingAudio.src && existingAudio.src.startsWith('blob:')) {
            console.log('[SilentPlaybackController] 检测到已加载的音频，直接使用');
            return existingAudio.src;
        }

        try {
            this.isPlaying = true;
            // 设置全局静默标志，供 AudioInterceptor 使用
            window.__SILENT_PLAYBACK_MODE__ = true;

            this.captureCurrentForegroundAudio();
            this.applySilentClass(messageElement);
            this.enableGlobalSilentUI();

            // 查找播放按钮
            const playButton = this.findPlayButton(messageElement);
            if (!playButton) {
                throw new Error('未找到播放按钮');
            }

            // 查找音频元素
            const audioElement = this.findAudioElement(messageElement);

            // 如果找到音频元素，设置为静音并保存状态
            if (audioElement) {
                this.setupSilentAudio(audioElement);
            }

            // 关键：先开始监听 blob URL 事件，然后再点击播放按钮
            console.log('[SilentPlaybackController] 开始监听 blob URL 事件...');
            const blobUrlPromise = this.waitForBlobUrl();

            // 然后点击播放按钮，触发音频加载
            console.log('[SilentPlaybackController] 点击播放按钮');
            try {
                const audiosBefore = document.querySelectorAll('audio');
                audiosBefore.forEach(a => { a.muted = true; a.volume = 0; });
            } catch (_) {}
            playButton.click();

            // 等待 blob URL 被捕获
            const blobUrl = await blobUrlPromise;
            console.log('[SilentPlaybackController] ✓ 捕获到 blob URL:', blobUrl);

            // 立即停止播放并恢复状态，防止进度条继续移动
            this.stopPlayback();

            this.resetPlayerUI(messageElement);
            this.removeSilentClass(messageElement);
            this.disableGlobalSilentUI();

            return blobUrl;
        } finally {
            this.isPlaying = false;
            window.__SILENT_PLAYBACK_MODE__ = false;
            
            // 再次确保状态恢复（如果 try 块中发生错误）
            if (this.currentAudio) {
                this.restoreAudioState(this.currentAudio);
                this.currentAudio = null;
            }
            
            // 安全网：尝试恢复页面上所有音频元素的状态，防止有漏网之鱼
            this.recoverAllAudioElements();

            this.resumeForegroundAudio();
            this.removeSilentClass(messageElement);
            this.disableGlobalSilentUI();
        }
    }

    /**
     * 恢复音频状态
     * @param {HTMLAudioElement} audioElement 
     */
    restoreAudioState(audioElement) {
        try {
            // 如果保存了原始状态，则恢复原始状态
            if (audioElement._originalState) {
                audioElement.volume = audioElement._originalState.volume;
                audioElement.muted = audioElement._originalState.muted;
                delete audioElement._originalState;
            } else {
                // 默认恢复
                audioElement.volume = 1;
                audioElement.muted = false;
            }
            
            // 确保暂停
            audioElement.pause();
            audioElement.currentTime = 0;
            
            console.log('[SilentPlaybackController] 音频状态已恢复');
        } catch (e) {
            console.error('[SilentPlaybackController] 恢复音频状态失败:', e);
        }
    }

    /**
     * 安全恢复所有音频元素的状态
     * 用于防止某些异常情况下音频被永久静音
     */
    recoverAllAudioElements() {
        try {
            const audios = document.querySelectorAll('audio');
            audios.forEach(audio => {
                // 仅恢复由本控制器修改过的音频元素，避免误触发全局取消静音
                if (!window.__SILENT_PLAYBACK_MODE__ && audio._originalState) {
                    try {
                        audio.volume = audio._originalState.volume;
                        audio.muted = audio._originalState.muted;
                        delete audio._originalState;
                    } catch (_) {}
                }
            });
        } catch (e) {
            console.error('[SilentPlaybackController] 全局音频恢复失败:', e);
        }
    }

    /**
     * 查找播放按钮
     * @param {HTMLElement} messageElement - 语音消息元素
     * @returns {HTMLElement|null}
     */
    findPlayButton(messageElement) {
        // WhatsApp 的播放按钮可能有不同的选择器
        const selectors = [
            '[data-testid="play-button"]',
            '[data-icon="audio-play"]',
            'button[aria-label*="播放"]',
            'button[aria-label*="Play"]',
            '.audio-play-button'
        ];

        for (const selector of selectors) {
            const button = messageElement.querySelector(selector);
            if (button) {
                return button;
            }
        }

        // 尝试查找包含播放图标的按钮
        const buttons = messageElement.querySelectorAll('button');
        for (const button of buttons) {
            const svg = button.querySelector('svg');
            if (svg && (svg.innerHTML.includes('play') || svg.innerHTML.includes('M'))) {
                return button;
            }
        }

        return null;
    }

    /**
     * 查找音频元素
     * @param {HTMLElement} messageElement - 语音消息元素
     * @returns {HTMLAudioElement|null}
     */
    findAudioElement(messageElement) {
        return messageElement.querySelector('audio') || document.querySelector('audio');
    }

    /**
     * 等待音频元素出现
     * @param {HTMLElement} messageElement - 语音消息元素
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<HTMLAudioElement>}
     */
    waitForAudioElement(messageElement, timeout = 3000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkInterval = setInterval(() => {
                const audioElement = this.findAudioElement(messageElement);

                if (audioElement) {
                    clearInterval(checkInterval);
                    this.setupSilentAudio(audioElement);
                    resolve(audioElement);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error('等待音频元素超时'));
                }
            }, 100);
        });
    }

    /**
     * 设置音频为静音
     * @param {HTMLAudioElement} audioElement - 音频元素
     */
    setupSilentAudio(audioElement) {
        this.currentAudio = audioElement;
        // 保存原始状态
        if (!audioElement._originalState) {
            audioElement._originalState = {
                volume: audioElement.volume,
                muted: audioElement.muted
            };
        }
        audioElement.volume = 0;
        audioElement.muted = true;
        console.log('[SilentPlaybackController] 音频已设置为静音');
    }

    /**
     * 等待 blob URL 被捕获
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<string>}
     */
    waitForBlobUrl(timeout = 5000) {
        return new Promise((resolve, reject) => {
            let resolved = false;
            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    window.removeEventListener('audio-blob-captured', handler);
                    clearInterval(pollId);
                    reject(new Error('等待音频 blob URL 超时'));
                }
            }, timeout);

            const handler = (event) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeoutId);
                clearInterval(pollId);
                window.removeEventListener('audio-blob-captured', handler);
                this.currentAudio = event.detail && event.detail.element ? event.detail.element : this.currentAudio;
                console.log('[SilentPlaybackController] 捕获到 blob URL:', event.detail.blobUrl);
                resolve(event.detail.blobUrl);
            };

            window.addEventListener('audio-blob-captured', handler, { once: true });

            const pollId = setInterval(() => {
                if (resolved) return;
                try {
                    const audio = Array.from(document.querySelectorAll('audio')).find(a => a.src && a.src.startsWith('blob:'));
                    if (audio) {
                        resolved = true;
                        clearTimeout(timeoutId);
                        clearInterval(pollId);
                        this.currentAudio = audio;
                        console.log('[SilentPlaybackController] 轮询捕获到 blob URL:', audio.src);
                        resolve(audio.src);
                    }
                } catch (_) {}
            }, 100);
        });
    }

    enableGlobalSilentUI() {
        try {
            document.documentElement.classList.add('wa-silent-mode');
        } catch (_) {}
    }

    disableGlobalSilentUI() {
        try {
            document.documentElement.classList.remove('wa-silent-mode');
        } catch (_) {}
    }

    /**
     * 停止播放
     */
    stopPlayback() {
        if (this.currentAudio) {
            this.restoreAudioState(this.currentAudio);
            this.currentAudio = null;
        }
        this.isPlaying = false;
    }

    captureCurrentForegroundAudio() {
        try {
            const audios = Array.from(document.querySelectorAll('audio'));
            const playing = audios.find(a => !a.paused && !a.ended);
            if (playing) {
                this.previousAudioState = {
                    element: playing,
                    time: playing.currentTime,
                    volume: playing.volume,
                    muted: playing.muted
                };
                try { playing.pause(); } catch (_) {}
            } else {
                this.previousAudioState = null;
            }
        } catch (_) {
            this.previousAudioState = null;
        }
    }

    resumeForegroundAudio() {
        const state = this.previousAudioState;
        this.previousAudioState = null;
        if (!state || !state.element) return;
        try {
            const el = state.element;
            el.muted = state.muted;
            el.volume = state.volume;
            if (!isNaN(state.time)) {
                try { el.currentTime = state.time; } catch (_) {}
            }
            Promise.resolve(el.play()).catch(() => {});
        } catch (_) {}
    }

    applySilentClass(messageElement) {
        try {
            if (!messageElement) return;

            const bubble = messageElement.closest('.message-in, .message-out') ||
                            messageElement.closest('[data-testid="audio-player"], [data-testid="ptt-player"]') ||
                            messageElement.parentElement;

            if (bubble && bubble.classList) {
                bubble.classList.add('wa-silent-translation');
                const player = bubble.querySelector('[data-testid="audio-player"], [data-testid="ptt-player"]');
                if (player) {
                    player.style.opacity = '0.01';
                    player.style.pointerEvents = 'none';
                }
            } else if (messageElement.classList) {
                messageElement.classList.add('wa-silent-translation');
                if (messageElement.getAttribute('data-testid') === 'audio-player' || messageElement.getAttribute('data-testid') === 'ptt-player') {
                    messageElement.style.opacity = '0.01';
                    messageElement.style.pointerEvents = 'none';
                }
            }
        } catch (_) {}
    }

    removeSilentClass(messageElement) {
        try {
            if (!messageElement) return;

            const bubble = messageElement.closest('.message-in, .message-out') ||
                            messageElement.closest('[data-testid="audio-player"], [data-testid="ptt-player"]') ||
                            messageElement.parentElement;

            const target = bubble || messageElement;
            if (target && target.classList) {
                target.classList.remove('wa-silent-translation');
            }

            const player = (bubble || messageElement).querySelector ? (bubble || messageElement).querySelector('[data-testid="audio-player"], [data-testid="ptt-player"]') : null;
            if (player) {
                player.style.opacity = '';
                player.style.pointerEvents = '';
            } else if (messageElement.getAttribute && (messageElement.getAttribute('data-testid') === 'audio-player' || messageElement.getAttribute('data-testid') === 'ptt-player')) {
                messageElement.style.opacity = '';
                messageElement.style.pointerEvents = '';
            }
        } catch (_) {}
    }

    resetPlayerUI(messageElement) {
        try {
            const pauseIcon = messageElement.querySelector('[data-icon="audio-pause"], svg[data-icon="audio-pause"]');
            const pauseBtn = pauseIcon ? pauseIcon.closest('button') || pauseIcon.closest('[role="button"]') : null;
            if (pauseBtn) { pauseBtn.click(); }
        } catch (_) {}
    }
}

// Export for browser environment
if (typeof window !== 'undefined') {
    window.SilentPlaybackController = SilentPlaybackController;
}
