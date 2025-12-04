/**
 * Fingerprint Generator
 * 
 * Generates realistic browser fingerprints for anti-detection.
 * Creates User-Agent strings, WebGL fingerprints, device information, etc.
 * 
 * @module environment/FingerprintGenerator
 */

'use strict';

const os = require('os');
const crypto = require('crypto');

/**
 * Browser versions database
 */
const BROWSER_VERSIONS = {
    'chrome-108': {
        name: 'Chrome',
        version: '108.0.0.0',
        webkitVersion: '537.36',
        engines: ['Blink', 'V8']
    },
    'chrome-110': {
        name: 'Chrome',
        version: '110.0.0.0',
        webkitVersion: '537.36',
        engines: ['Blink', 'V8']
    },
    'chrome-115': {
        name: 'Chrome',
        version: '115.0.0.0',
        webkitVersion: '537.36',
        engines: ['Blink', 'V8']
    },
    'edge-110': {
        name: 'Edge',
        version: '110.0.1587.50',
        webkitVersion: '537.36',
        engines: ['Blink', 'V8']
    },
    'firefox-115': {
        name: 'Firefox',
        version: '115.0',
        geckoVersion: '20100101',
        engines: ['Gecko']
    }
};

/**
 * WebGL vendors and renderers
 */
const WEBGL_CONFIGS = [
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc.', renderer: 'ANGLE (Intel Iris Xe Graphics Direct3D11 vs_5_0 ps_5_0)' },
    { vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL Engine' },
    { vendor: 'NVIDIA Corporation', renderer: 'GeForce GTX 1660/PCIe/SSE2' },
    { vendor: 'ATI Technologies Inc.', renderer: 'AMD Radeon RX 6700 XT' }
];

/**
 * Device names
 */
const DEVICE_NAMES = [
    'DESKTOP-{RANDOM}',
    'LAPTOP-{RANDOM}',
    'PC-{RANDOM}',
    'WORKSTATION-{RANDOM}'
];

/**
 * Fingerprint Generator
 */
class FingerprintGenerator {
    /**
     * Generate complete fingerprint configuration
     * @param {Object} [options] - Generation options
     * @param {string} [options.browser] - Browser type
     * @param {string} [options.os] - Operating system
     * @returns {Object} Complete fingerprint configuration
     */
    static generateFingerprint(options = {}) {
        const browser = options.browser || this._randomChoice(['chrome-108', 'chrome-110', 'chrome-115']);
        const osType = options.os || this._randomChoice(['windows', 'macos']);

        const userAgent = this.generateUserAgent(browser, osType);
        const webgl = this.generateWebGLFingerprint();
        const deviceInfo = this.generateDeviceInfo();

        return {
            browser: browser,
            os: osType,
            userAgent: userAgent,
            webgl: {
                mode: 'custom',
                vendor: webgl.vendor,
                renderer: webgl.renderer,
                image: 'random'
            },
            webrtc: {
                mode: this._randomChoice(['replace', 'real', 'disable'])
            },
            canvas: 'random',
            audio: 'random',
            clientRects: 'random',
            timezone: {
                mode: 'auto',
                value: ''
            },
            geolocation: {
                mode: 'ip-based',
                latitude: null,
                longitude: null
            },
            language: {
                mode: 'auto',
                value: ''
            },
            resolution: {
                mode: 'custom',
                width: this._randomChoice([1920, 1680, 1440, 2560]),
                height: this._randomChoice([1080, 1050, 900, 1440])
            },
            fonts: {
                mode: 'system'
            },
            deviceInfo: deviceInfo,
            hardware: {
                bluetooth: this._randomBoolean(),
                battery: this._randomChoice(['real', 'privacy']),
                portScanProtection: true
            },
            cookies: []
        };
    }

    /**
     * Generate User-Agent string
     * @param {string} browser - Browser type
     * @param {string} osType - Operating system type
     * @returns {string} User-Agent string
     */
    static generateUserAgent(browser, osType) {
        const browserConfig = BROWSER_VERSIONS[browser] || BROWSER_VERSIONS['chrome-108'];

        if (osType === 'windows') {
            return this._generateWindowsUA(browserConfig);
        } else if (osType === 'macos') {
            return this._generateMacOSUA(browserConfig);
        }

        return this._generateWindowsUA(browserConfig);
    }

    /**
     * Generate WebGL fingerprint
     * @returns {Object} WebGL configuration {vendor, renderer}
     */
    static generateWebGLFingerprint() {
        return this._randomChoice(WEBGL_CONFIGS);
    }

    /**
     * Generate device information
     * @returns {Object} Device information
     */
    static generateDeviceInfo() {
        return {
            name: {
                mode: 'custom',
                value: this._generateDeviceName()
            },
            mac: {
                mode: 'custom',
                value: this._generateMacAddress()
            },
            cpu: {
                mode: 'custom',
                cores: this._randomChoice([4, 8, 16])
            },
            memory: {
                mode: 'custom',
                size: this._randomChoice([8, 16, 32])
            }
        };
    }

    /**
     * Generate Windows User-Agent
     * @param {Object} browserConfig - Browser configuration
     * @returns {string} User-Agent string
     * @private
     */
    static _generateWindowsUA(browserConfig) {
        const windowsVersion = this._randomChoice(['10.0', '11.0']);
        const wow64 = this._randomBoolean() ? '; WOW64' : '';

        if (browserConfig.name === 'Firefox') {
            return `Mozilla/5.0 (Windows NT ${windowsVersion}${wow64}; rv:${browserConfig.version}) Gecko/${browserConfig.geckoVersion} Firefox/${browserConfig.version}`;
        } else if (browserConfig.name === 'Edge') {
            return `Mozilla/5.0 (Windows NT ${windowsVersion}; Win64; x64) AppleWebKit/${browserConfig.webkitVersion} (KHTML, like Gecko) Chrome/${browserConfig.version.split('.')[0]}.0.0.0 Safari/${browserConfig.webkitVersion} Edg/${browserConfig.version}`;
        } else {
            // Chrome
            return `Mozilla/5.0 (Windows NT ${windowsVersion}; Win64; x64) AppleWebKit/${browserConfig.webkitVersion} (KHTML, like Gecko) Chrome/${browserConfig.version} Safari/${browserConfig.webkitVersion}`;
        }
    }

    /**
     * Generate macOS User-Agent
     * @param {Object} browserConfig - Browser configuration
     * @returns {string} User-Agent string
     * @private
     */
    static _generateMacOSUA(browserConfig) {
        const macVersion = this._randomChoice(['10_15_7', '11_6_0', '12_5_0', '13_0_0']);

        if (browserConfig.name === 'Firefox') {
            return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVersion}; rv:${browserConfig.version}) Gecko/${browserConfig.geckoVersion} Firefox/${browserConfig.version}`;
        } else if (browserConfig.name === 'Edge') {
            return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVersion}) AppleWebKit/${browserConfig.webkitVersion} (KHTML, like Gecko) Chrome/${browserConfig.version.split('.')[0]}.0.0.0 Safari/${browserConfig.webkitVersion} Edg/${browserConfig.version}`;
        } else {
            // Chrome
            return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVersion}) AppleWebKit/${browserConfig.webkitVersion} (KHTML, like Gecko) Chrome/${browserConfig.version} Safari/${browserConfig.webkitVersion}`;
        }
    }

    /**
     * Generate device name
     * @returns {string} Device name
     * @private
     */
    static _generateDeviceName() {
        const template = this._randomChoice(DEVICE_NAMES);
        const random = this._generateRandomString(7, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
        return template.replace('{RANDOM}', random);
    }

    /**
     * Generate MAC address
     * @returns {string} MAC address
     * @private
     */
    static _generateMacAddress() {
        const octets = [];
        for (let i = 0; i < 6; i++) {
            const octet = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
            octets.push(octet);
        }
        return octets.join(':').toUpperCase();
    }

    /**
     * Generate random string
     * @param {number} length - String length
     * @param {string} chars - Character set
     * @returns {string} Random string
     * @private
     */
    static _generateRandomString(length, chars) {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Random choice from array
     * @param {Array} array - Array to choose from
     * @returns {*} Random element
     * @private
     */
    static _randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Random boolean
     * @returns {boolean} Random boolean
     * @private
     */
    static _randomBoolean() {
        return Math.random() < 0.5;
    }

    /**
     * Generate random noise seed for Canvas/Audio
     * @returns {number} Noise seed
     */
    static generateNoiseSeed() {
        return Math.floor(Math.random() * 1000000);
    }

    /**
     * Get real system information
     * @returns {Object} System information
     */
    static getRealSystemInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)), // GB
            hostname: os.hostname()
        };
    }
}

module.exports = FingerprintGenerator;
