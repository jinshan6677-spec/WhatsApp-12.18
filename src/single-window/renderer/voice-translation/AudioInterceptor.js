/**
 * 音频拦截器
 * 基于验证的 intercept-audio.js 实现
 * 拦截 WhatsApp 语音消息的音频 blob URL
 */

class AudioInterceptor {
    constructor() {
        this.isSetup = false;
        this.originalSrcSetter = null;
        this.capturedBlobUrls = [];
        this.originalSetAttribute = null;
        this.originalAudioPlay = null;
        this.mutationObserver = null;
        this.originalAudioCtxResume = null;
        this.originalCreateMediaElementSource = null;
        this.originalBufferStart = null;
        this.originalMediaElementConnect = null;
        this.originalVolumeSetter = null;
        this.originalVolumeGetter = null;
        this.originalMutedSetter = null;
        this.originalMutedGetter = null;
        this.originalAutoplaySetter = null;
        this.originalAutoplayGetter = null;
    }

    /**
     * 设置音频拦截
     * 拦截 HTMLMediaElement.prototype.src 的 setter 和 play 方法
     */
    setup() {
        if (this.isSetup) {
            console.log('[AudioInterceptor] 已经设置过拦截器');
            return;
        }

        try {
            const mediaProto = HTMLMediaElement.prototype;
            
            // 1. 拦截 src setter
            this.originalSrcSetter = Object.getOwnPropertyDescriptor(mediaProto, 'src').set;
            const originalSrcSetter = this.originalSrcSetter;

            Object.defineProperty(mediaProto, 'src', {
                set: function (value) {
                    // 检测是否是 blob URL（WhatsApp 语音消息使用 blob URL）
                    if (value && value.includes('blob:')) {
                        console.log('[AudioInterceptor] 捕获到音频 blob URL:', value);

                        // 如果处于全局静默模式，立即静音
                        if (window.__SILENT_PLAYBACK_MODE__) {
                            // 保存原始状态（如果还没有保存过）
                            if (!this._originalState) {
                                this._originalState = {
                                    volume: this.volume,
                                    muted: this.muted
                                };
                            }
                            this.volume = 0;
                            this.muted = true;
                            console.log('[AudioInterceptor] 强制静音 (Silent Mode)');
                        }

                        // 触发自定义事件，传递 blob URL 和音频元素
                        window.dispatchEvent(new CustomEvent('audio-blob-captured', {
                            detail: {
                                blobUrl: value,
                                element: this,
                                timestamp: new Date().toISOString()
                            }
                        }));
                    }

                    // 调用原始 setter，this 指向当前的 audio 元素
                    return originalSrcSetter.call(this, value);
                },
                get: function () {
                    return Object.getOwnPropertyDescriptor(mediaProto, 'src').get.call(this);
                },
                configurable: true
            });

            // 2. 拦截 play 方法
            this.originalPlay = mediaProto.play;
            const originalPlay = this.originalPlay;
            
            mediaProto.play = function() {
                if (window.__SILENT_PLAYBACK_MODE__) {
                    console.log('[AudioInterceptor] 拦截并阻止 play() 调用 (Silent Mode)');
                    return Promise.resolve();
                }
                try {
                    if (this && this.tagName && this.tagName.toUpperCase() === 'AUDIO') {
                        if (this.defaultMuted) this.defaultMuted = false;
                        if (this.muted) this.muted = false;
                        if (this.volume === 0) this.volume = 1;
                    }
                } catch (_) {}
                return originalPlay.apply(this, arguments);
            };

            // 3. 拦截 HTMLAudioElement.play 以确保覆盖所有情况
            const audioProto = HTMLAudioElement.prototype;
            this.originalAudioPlay = audioProto.play;
            const originalAudioPlay = this.originalAudioPlay;
            audioProto.play = function() {
                if (window.__SILENT_PLAYBACK_MODE__) {
                    console.log('[AudioInterceptor] 拦截并阻止 HTMLAudioElement.play (Silent Mode)');
                    return Promise.resolve();
                }
                try {
                    if (this.defaultMuted) this.defaultMuted = false;
                    if (this.muted) this.muted = false;
                    if (this.volume === 0) this.volume = 1;
                } catch (_) {}
                return originalAudioPlay.apply(this, arguments);
            };

            // 4. 拦截 setAttribute 设置 src
            this.originalSetAttribute = Element.prototype.setAttribute;
            const originalSetAttribute = this.originalSetAttribute;
            Element.prototype.setAttribute = function(name, value) {
                if (name === 'src' && this.tagName && this.tagName.toUpperCase() === 'AUDIO') {
                    if (value && String(value).includes('blob:')) {
                        if (window.__SILENT_PLAYBACK_MODE__) {
                            if (!this._originalState) {
                                this._originalState = { volume: this.volume, muted: this.muted };
                            }
                            this.volume = 0;
                            this.muted = true;
                        }
                        try {
                            window.dispatchEvent(new CustomEvent('audio-blob-captured', {
                                detail: { blobUrl: value, element: this, timestamp: new Date().toISOString() }
                            }));
                        } catch (_) {}
                    }
                }
                return originalSetAttribute.call(this, name, value);
            };

            // 5. MutationObserver：静默模式下发现新 audio 立即静音
            try {
                this.mutationObserver = new MutationObserver((mutations) => {
                    if (!window.__SILENT_PLAYBACK_MODE__) return;
                    try {
                        mutations.forEach(m => {
                            Array.from(m.addedNodes || []).forEach(node => {
                                if (!node) return;
                                if (node.tagName && node.tagName.toUpperCase() === 'AUDIO') {
                                    node.volume = 0;
                                    node.muted = true;
                                }
                                if (node.querySelectorAll) {
                                    const audios = node.querySelectorAll('audio');
                                    audios.forEach(a => { a.volume = 0; a.muted = true; });
                                }
                            });
                        });
                    } catch (_) {}
                });
                this.mutationObserver.observe(document.documentElement || document, { childList: true, subtree: true });
            } catch (_) {}

            // 6. 属性级拦截：volume/muted/autoplay 在静默模式下强制为静音
            try {
                const volDesc = Object.getOwnPropertyDescriptor(mediaProto, 'volume');
                const mutedDesc = Object.getOwnPropertyDescriptor(mediaProto, 'muted');
                const autoplayDesc = Object.getOwnPropertyDescriptor(mediaProto, 'autoplay');

                if (volDesc && volDesc.set && volDesc.get) {
                    this.originalVolumeSetter = volDesc.set;
                    this.originalVolumeGetter = volDesc.get;
                    Object.defineProperty(mediaProto, 'volume', {
                        configurable: true,
                        enumerable: volDesc.enumerable,
                        get: function() { return volDesc.get.call(this); },
                        set: function(v) {
                            const value = window.__SILENT_PLAYBACK_MODE__ ? 0 : v;
                            return volDesc.set.call(this, value);
                        }
                    });
                }

                if (mutedDesc && mutedDesc.set && mutedDesc.get) {
                    this.originalMutedSetter = mutedDesc.set;
                    this.originalMutedGetter = mutedDesc.get;
                    Object.defineProperty(mediaProto, 'muted', {
                        configurable: true,
                        enumerable: mutedDesc.enumerable,
                        get: function() { return mutedDesc.get.call(this); },
                        set: function(v) {
                            const value = window.__SILENT_PLAYBACK_MODE__ ? true : v;
                            return mutedDesc.set.call(this, value);
                        }
                    });
                }

                if (autoplayDesc && autoplayDesc.set && autoplayDesc.get) {
                    this.originalAutoplaySetter = autoplayDesc.set;
                    this.originalAutoplayGetter = autoplayDesc.get;
                    Object.defineProperty(mediaProto, 'autoplay', {
                        configurable: true,
                        enumerable: autoplayDesc.enumerable,
                        get: function() { return autoplayDesc.get.call(this); },
                        set: function(v) {
                            const value = window.__SILENT_PLAYBACK_MODE__ ? false : v;
                            return autoplayDesc.set.call(this, value);
                        }
                    });
                }
            } catch (e) {
                console.warn('[AudioInterceptor] 属性级拦截失败:', e.message);
            }

            this.isSetup = true;
            console.log('[AudioInterceptor] 音频拦截器设置成功');
        } catch (error) {
            console.error('[AudioInterceptor] 设置拦截器失败:', error);
            throw error;
        }

        // WebAudio API 拦截
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx && AudioCtx.prototype) {
                // 拦截 resume，静默模式下不恢复
                this.originalAudioCtxResume = AudioCtx.prototype.resume;
                const originalAudioCtxResume = this.originalAudioCtxResume;
                AudioCtx.prototype.resume = function() {
                    if (window.__SILENT_PLAYBACK_MODE__) {
                        console.log('[AudioInterceptor] 拦截 AudioContext.resume (Silent Mode)');
                        return Promise.resolve();
                    }
                    return originalAudioCtxResume.apply(this, arguments);
                };

                // 拦截 createMediaElementSource，静默模式下阻断连接
                this.originalCreateMediaElementSource = AudioCtx.prototype.createMediaElementSource;
                const originalCreateMediaElementSource = this.originalCreateMediaElementSource;
                AudioCtx.prototype.createMediaElementSource = function(mediaElement) {
                    const node = originalCreateMediaElementSource.call(this, mediaElement);
                    try {
                        const proto = Object.getPrototypeOf(node);
                        if (proto && !proto.__connect_patched__) {
                            const origConnect = node.connect;
                            this.originalMediaElementConnect = origConnect;
                            proto.__connect_patched__ = true;
                            proto.connect = function() {
                                if (window.__SILENT_PLAYBACK_MODE__) {
                                    console.log('[AudioInterceptor] 拦截 MediaElementAudioSourceNode.connect (Silent Mode)');
                                    return this; // no-op
                                }
                                return origConnect.apply(this, arguments);
                            };
                        }
                    } catch (_) {}
                    return node;
                };

                // 拦截 AudioBufferSourceNode.start
                const BufferProto = window.AudioBufferSourceNode && window.AudioBufferSourceNode.prototype;
                if (BufferProto && BufferProto.start) {
                    this.originalBufferStart = BufferProto.start;
                    const originalBufferStart = this.originalBufferStart;
                    BufferProto.start = function() {
                        if (window.__SILENT_PLAYBACK_MODE__) {
                            console.log('[AudioInterceptor] 拦截 AudioBufferSourceNode.start (Silent Mode)');
                            return; // no-op
                        }
                        return originalBufferStart.apply(this, arguments);
                    };
                }
            }
        } catch (e) {
            console.warn('[AudioInterceptor] WebAudio 拦截失败:', e.message);
        }
    }

    /**
     * 监听音频捕获事件
     * @param {Function} callback - 回调函数，接收 {blobUrl, element, timestamp}
     * @returns {Function} 移除监听器的函数
     */
    onAudioCaptured(callback) {
        const handler = (event) => {
            callback(event.detail);
        };

        window.addEventListener('audio-blob-captured', handler);

        // 返回移除监听器的函数
        return () => {
            window.removeEventListener('audio-blob-captured', handler);
        };
    }

    /**
     * 清理拦截器（恢复原始行为）
     */
    cleanup() {
        if (!this.isSetup) {
            return;
        }

        try {
            const mediaProto = HTMLMediaElement.prototype;
            
            // 恢复 src setter
            if (this.originalSrcSetter) {
                Object.defineProperty(mediaProto, 'src', {
                    set: this.originalSrcSetter,
                    get: Object.getOwnPropertyDescriptor(mediaProto, 'src').get,
                    configurable: true
                });
            }

            // 恢复 play 方法
            if (this.originalPlay) {
                mediaProto.play = this.originalPlay;
            }

            // 恢复 HTMLAudioElement.play
            if (this.originalAudioPlay) {
                HTMLAudioElement.prototype.play = this.originalAudioPlay;
            }

            // 恢复 setAttribute
            if (this.originalSetAttribute) {
                Element.prototype.setAttribute = this.originalSetAttribute;
            }

            if (this.mutationObserver) {
                try { this.mutationObserver.disconnect(); } catch (_) {}
                this.mutationObserver = null;
            }

            // 恢复 WebAudio API
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx && AudioCtx.prototype) {
                    if (this.originalAudioCtxResume) {
                        AudioCtx.prototype.resume = this.originalAudioCtxResume;
                    }
                    if (this.originalCreateMediaElementSource) {
                        AudioCtx.prototype.createMediaElementSource = this.originalCreateMediaElementSource;
                    }
                }
                const BufferProto = window.AudioBufferSourceNode && window.AudioBufferSourceNode.prototype;
                if (BufferProto && this.originalBufferStart) {
                    BufferProto.start = this.originalBufferStart;
                }
            } catch (e) {
                console.warn('[AudioInterceptor] WebAudio 恢复失败:', e.message);
            }

            // 恢复属性级拦截
            try {
                const mediaProto = HTMLMediaElement.prototype;
                if (this.originalVolumeSetter || this.originalVolumeGetter) {
                    Object.defineProperty(mediaProto, 'volume', {
                        configurable: true,
                        get: this.originalVolumeGetter,
                        set: this.originalVolumeSetter
                    });
                }
                if (this.originalMutedSetter || this.originalMutedGetter) {
                    Object.defineProperty(mediaProto, 'muted', {
                        configurable: true,
                        get: this.originalMutedGetter,
                        set: this.originalMutedSetter
                    });
                }
                if (this.originalAutoplaySetter || this.originalAutoplayGetter) {
                    Object.defineProperty(mediaProto, 'autoplay', {
                        configurable: true,
                        get: this.originalAutoplayGetter,
                        set: this.originalAutoplaySetter
                    });
                }
            } catch (e) {
                console.warn('[AudioInterceptor] 属性级拦截恢复失败:', e.message);
            }

            this.isSetup = false;
            console.log('[AudioInterceptor] 音频拦截器已清理');
        } catch (error) {
            console.error('[AudioInterceptor] 清理拦截器失败:', error);
        }
    }
}

// Export for browser environment
if (typeof window !== 'undefined') {
    window.AudioInterceptor = AudioInterceptor;
}
