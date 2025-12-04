/**
 * 音频下载器
 * 从 blob URL 下载音频数据并转换为所需格式
 */

class AudioDownloader {
    constructor() {
        this.downloadCache = new Map();
    }

    /**
     * 从 blob URL 下载音频
     * @param {string} blobUrl - blob URL
     * @returns {Promise<Blob>} 音频 Blob 对象
     */
    async download(blobUrl) {
        // 检查缓存
        if (this.downloadCache.has(blobUrl)) {
            console.log('[AudioDownloader] 使用缓存的音频数据');
            return this.downloadCache.get(blobUrl);
        }

        try {
            console.log('[AudioDownloader] 开始下载音频:', blobUrl);

            const response = await fetch(blobUrl);
            if (!response.ok) {
                throw new Error(`下载失败: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            console.log('[AudioDownloader] 音频下载成功:', {
                size: blob.size,
                type: blob.type
            });

            // 缓存下载的数据
            this.downloadCache.set(blobUrl, blob);

            return blob;
        } catch (error) {
            console.error('[AudioDownloader] 下载音频失败:', error);
            throw new Error(`下载音频失败: ${error.message}`);
        }
    }

    /**
     * 将 Blob 转换为 ArrayBuffer
     * @param {Blob} blob - Blob 对象
     * @returns {Promise<ArrayBuffer>}
     */
    async blobToArrayBuffer(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('读取 Blob 失败'));
            reader.readAsArrayBuffer(blob);
        });
    }

    /**
     * 将 Blob 转换为 Base64
     * @param {Blob} blob - Blob 对象
     * @returns {Promise<string>} Base64 字符串（不包含 data URL 前缀）
     */
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = () => reject(new Error('读取 Blob 失败'));
            reader.readAsDataURL(blob);
        });
    }

    /**
     * 将 Blob 转换为 File 对象
     * @param {Blob} blob - Blob 对象
     * @param {string} filename - 文件名
     * @returns {File}
     */
    blobToFile(blob, filename = 'audio.ogg') {
        return new File([blob], filename, { type: blob.type });
    }

    /**
     * 将 Blob 转换为 Data URL
     * @param {Blob} blob - Blob 对象
     * @returns {Promise<string>} Data URL
     */
    async blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('读取 Blob 失败'));
            reader.readAsDataURL(blob);
        });
    }

    /**
     * 创建音频对象 URL（用于播放）
     * @param {Blob} blob - Blob 对象
     * @returns {string} Object URL
     */
    createObjectURL(blob) {
        return URL.createObjectURL(blob);
    }

    /**
     * 释放音频对象 URL
     * @param {string} objectUrl - Object URL
     */
    revokeObjectURL(objectUrl) {
        URL.revokeObjectURL(objectUrl);
    }

    /**
     * 清除下载缓存
     */
    clearCache() {
        this.downloadCache.clear();
        console.log('[AudioDownloader] 缓存已清除');
    }

    /**
     * 获取缓存大小
     * @returns {number}
     */
    getCacheSize() {
        return this.downloadCache.size;
    }
}

// Export for browser environment
if (typeof window !== 'undefined') {
    window.AudioDownloader = AudioDownloader;
}
