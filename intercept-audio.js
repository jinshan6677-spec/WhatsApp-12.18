// Web Audio API 拦截器 - 捕获音频数据
// Web Audio API Interceptor - Capture audio data

(function () {
    console.log('=== Web Audio API 拦截器已启动 ===');
    console.log('正在监听音频播放...\n');

    const capturedData = {
        audioContexts: [],
        audioBuffers: [],
        mediaElements: [],
        fetchCalls: [],
        blobUrls: []
    };

    // 1. 拦截 AudioContext 创建
    const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
    if (OriginalAudioContext) {
        window.AudioContext = function (...args) {
            console.log('✓ AudioContext 被创建');
            const ctx = new OriginalAudioContext(...args);
            capturedData.audioContexts.push({
                sampleRate: ctx.sampleRate,
                state: ctx.state,
                timestamp: new Date().toISOString()
            });

            // 拦截 decodeAudioData
            const originalDecode = ctx.decodeAudioData.bind(ctx);
            ctx.decodeAudioData = function (audioData, ...args) {
                console.log('✓ decodeAudioData 被调用');
                console.log('  数据大小:', audioData.byteLength, 'bytes');
                capturedData.audioBuffers.push({
                    size: audioData.byteLength,
                    timestamp: new Date().toISOString()
                });
                return originalDecode(audioData, ...args);
            };

            return ctx;
        };
    }

    // 2. 拦截 fetch 调用（捕获音频文件请求）
    const originalFetch = window.fetch;
    window.fetch = function (url, ...args) {
        const urlStr = url.toString();

        // 检查是否是音频相关的请求
        if (urlStr.includes('blob:') ||
            urlStr.includes('.ogg') ||
            urlStr.includes('.opus') ||
            urlStr.includes('.mp3') ||
            urlStr.includes('.m4a') ||
            urlStr.includes('ptt') ||  // Push-to-talk
            urlStr.includes('audio')) {

            console.log('✓ 捕获到音频相关的 fetch 请求:');
            console.log('  URL:', urlStr);

            capturedData.fetchCalls.push({
                url: urlStr,
                timestamp: new Date().toISOString()
            });
        }

        return originalFetch(url, ...args);
    };

    // 3. 拦截 URL.createObjectURL（捕获 blob URL 创建）
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
        const url = originalCreateObjectURL(blob);

        console.log('✓ Blob URL 被创建:');
        console.log('  URL:', url);
        console.log('  类型:', blob.type);
        console.log('  大小:', blob.size, 'bytes');

        capturedData.blobUrls.push({
            url: url,
            type: blob.type,
            size: blob.size,
            timestamp: new Date().toISOString()
        });

        return url;
    };

    // 4. 拦截 HTMLMediaElement 的 src 设置
    const mediaProto = HTMLMediaElement.prototype;
    const originalSrcSetter = Object.getOwnPropertyDescriptor(mediaProto, 'src').set;
    Object.defineProperty(mediaProto, 'src', {
        set: function (value) {
            if (value && (value.includes('blob:') || value.includes('audio'))) {
                console.log('✓ Media Element src 被设置:');
                console.log('  URL:', value);

                capturedData.mediaElements.push({
                    src: value,
                    tagName: this.tagName,
                    timestamp: new Date().toISOString()
                });
            }
            return originalSrcSetter.call(this, value);
        },
        get: function () {
            return Object.getOwnPropertyDescriptor(mediaProto, 'src').get.call(this);
        }
    });

    // 提供查看结果的函数
    window.getAudioData = function () {
        console.log('\n=== 捕获的音频数据 ===');
        console.log('AudioContext 数量:', capturedData.audioContexts.length);
        console.log('AudioBuffer 数量:', capturedData.audioBuffers.length);
        console.log('Fetch 请求数量:', capturedData.fetchCalls.length);
        console.log('Blob URL 数量:', capturedData.blobUrls.length);
        console.log('Media Element 数量:', capturedData.mediaElements.length);

        console.log('\n详细数据:');
        console.log(JSON.stringify(capturedData, null, 2));

        return capturedData;
    };

    console.log('\n拦截器已就绪！');
    console.log('现在请播放语音消息...');
    console.log('播放后输入 window.getAudioData() 查看结果\n');

    // 60秒后自动输出
    setTimeout(() => {
        console.log('\n=== 60秒监听结束 ===');
        window.getAudioData();
    }, 60000);

    return '拦截器运行中...';
})();
