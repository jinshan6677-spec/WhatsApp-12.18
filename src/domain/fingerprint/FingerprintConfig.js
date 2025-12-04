'use strict';

const crypto = require('crypto');

/**
 * Browser Type Enum
 * @readonly
 * @enum {string}
 */
const BrowserType = {
  Chrome: 'chrome',
  Firefox: 'firefox',
  Edge: 'edge',
  Safari: 'safari'
};

/**
 * OS Type Enum
 * @readonly
 * @enum {string}
 */
const OSType = {
  Windows: 'windows',
  MacOS: 'macos',
  Linux: 'linux'
};

/**
 * Noise Level Enum
 * @readonly
 * @enum {string}
 */
const NoiseLevel = {
  Off: 'off',
  Low: 'low',
  Medium: 'medium',
  High: 'high'
};

/**
 * Noise Distribution Enum
 * @readonly
 * @enum {string}
 */
const NoiseDistribution = {
  Uniform: 'uniform',
  Gaussian: 'gaussian'
};

/**
 * Generate a UUID v4
 * @returns {string}
 */
function uuidv4() {
  return crypto.randomUUID();
}


/**
 * FingerprintConfig Domain Entity
 * 
 * Represents a complete browser fingerprint configuration for an account.
 * Contains all 54 requirements' configuration fields for professional-grade
 * fingerprint management.
 * 
 * Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7
 */
class FingerprintConfig {
  /**
   * Creates a FingerprintConfig instance
   * @param {Object} config - Fingerprint configuration
   */
  constructor(config = {}) {
    // Metadata
    this.id = config.id || uuidv4();
    this.accountId = config.accountId || null;
    this.createdAt = config.createdAt ? new Date(config.createdAt) : new Date();
    this.updatedAt = config.updatedAt ? new Date(config.updatedAt) : new Date();
    this.version = config.version || '1.0.0';

    // Browser configuration (Req 3)
    this.browser = {
      type: config.browser?.type || BrowserType.Chrome,
      version: config.browser?.version || '120.0.0.0',
      majorVersion: config.browser?.majorVersion || 120
    };

    // OS configuration (Req 3)
    this.os = {
      type: config.os?.type || OSType.Windows,
      version: config.os?.version || '10.0',
      platform: config.os?.platform || 'Win32'
    };

    // User-Agent (Req 3)
    this.userAgent = config.userAgent || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // Navigator properties (Req 3, 4, 10, 19)
    this.navigator = {
      appVersion: config.navigator?.appVersion || '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      vendor: config.navigator?.vendor || 'Google Inc.',
      product: config.navigator?.product || 'Gecko',
      productSub: config.navigator?.productSub || '20030107',
      appName: config.navigator?.appName || 'Netscape',
      appCodeName: config.navigator?.appCodeName || 'Mozilla',
      language: config.navigator?.language || 'en-US',
      languages: config.navigator?.languages || ['en-US', 'en'],
      doNotTrack: config.navigator?.doNotTrack !== undefined ? config.navigator.doNotTrack : null,
      globalPrivacyControl: config.navigator?.globalPrivacyControl || false,
      webdriver: config.navigator?.webdriver !== undefined ? config.navigator.webdriver : false
    };

    // Hardware information (Req 4)
    this.hardware = {
      cpuCores: config.hardware?.cpuCores || 8,
      deviceMemory: config.hardware?.deviceMemory || 8,
      maxTouchPoints: config.hardware?.maxTouchPoints || 0,
      screen: {
        width: config.hardware?.screen?.width || 1920,
        height: config.hardware?.screen?.height || 1080,
        availWidth: config.hardware?.screen?.availWidth || 1920,
        availHeight: config.hardware?.screen?.availHeight || 1040,
        colorDepth: config.hardware?.screen?.colorDepth || 24,
        pixelDepth: config.hardware?.screen?.pixelDepth || 24
      },
      devicePixelRatio: config.hardware?.devicePixelRatio || 1
    };

    // Canvas configuration (Req 5)
    this.canvas = {
      mode: config.canvas?.mode || 'noise',
      noiseLevel: config.canvas?.noiseLevel || NoiseLevel.Medium,
      noiseDistribution: config.canvas?.noiseDistribution || NoiseDistribution.Uniform
    };

    // WebGL configuration (Req 6)
    this.webgl = {
      mode: config.webgl?.mode || 'custom',
      vendor: config.webgl?.vendor || 'Google Inc. (Intel)',
      renderer: config.webgl?.renderer || 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
      unmaskedVendor: config.webgl?.unmaskedVendor || 'Intel Inc.',
      unmaskedRenderer: config.webgl?.unmaskedRenderer || 'Intel(R) UHD Graphics',
      extensions: config.webgl?.extensions || ['ANGLE_instanced_arrays', 'EXT_blend_minmax'],
      shaderPrecision: config.webgl?.shaderPrecision || {},
      imageNoise: config.webgl?.imageNoise !== undefined ? config.webgl.imageNoise : true,
      noiseLevel: config.webgl?.noiseLevel || NoiseLevel.Medium
    };

    // Audio configuration (Req 7)
    this.audio = {
      mode: config.audio?.mode || 'noise',
      noiseLevel: config.audio?.noiseLevel || NoiseLevel.Medium,
      noiseDistribution: config.audio?.noiseDistribution || NoiseDistribution.Uniform
    };

    // Fonts configuration (Req 8)
    this.fonts = {
      mode: config.fonts?.mode || 'custom',
      list: config.fonts?.list || ['Arial', 'Helvetica', 'Times New Roman', 'Verdana', 'Georgia']
    };

    // Plugins configuration (Req 9)
    this.plugins = {
      mode: config.plugins?.mode || 'custom',
      list: config.plugins?.list || [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
      ]
    };

    // Language configuration (Req 10)
    this.language = {
      mode: config.language?.mode || 'custom',
      primary: config.language?.primary || 'en-US',
      list: config.language?.list || ['en-US', 'en']
    };

    // Timezone configuration (Req 11)
    this.timezone = {
      mode: config.timezone?.mode || 'custom',
      name: config.timezone?.name || 'America/New_York',
      offset: config.timezone?.offset !== undefined ? config.timezone.offset : -300
    };

    // Geolocation configuration (Req 12)
    this.geolocation = {
      mode: config.geolocation?.mode || 'custom',
      latitude: config.geolocation?.latitude || 40.7128,
      longitude: config.geolocation?.longitude || -74.0060,
      accuracy: config.geolocation?.accuracy || 100
    };

    // WebRTC configuration (Req 13)
    this.webrtc = {
      mode: config.webrtc?.mode || 'replace',
      publicIP: config.webrtc?.publicIP || 'auto',
      localIP: config.webrtc?.localIP || '192.168.1.100',
      whitelist: config.webrtc?.whitelist || [],
      // Hardened options
      dropNonRelay: config.webrtc?.dropNonRelay || false,
      forceRelay: config.webrtc?.forceRelay || false
    };

    // ClientRects configuration (Req 14)
    this.clientRects = {
      mode: config.clientRects?.mode || 'noise',
      noiseLevel: config.clientRects?.noiseLevel || NoiseLevel.Low
    };

    // Media devices configuration (Req 15)
    this.mediaDevices = {
      mode: config.mediaDevices?.mode || 'fake',
      devices: config.mediaDevices?.devices || [
        { kind: 'audioinput', deviceId: 'default', label: 'Default Audio Device' }
      ]
    };

    // Battery configuration (Req 16)
    this.battery = {
      mode: config.battery?.mode || 'privacy',
      charging: config.battery?.charging !== undefined ? config.battery.charging : true,
      level: config.battery?.level !== undefined ? config.battery.level : 1.0
    };

    // Sensors configuration (Req 17)
    this.sensors = {
      mode: config.sensors?.mode || 'disable'
    };

    // Speech configuration (Req 18)
    this.speech = {
      mode: config.speech?.mode || 'minimal',
      voices: config.speech?.voices || [{ name: 'Microsoft David Desktop', lang: 'en-US' }]
    };

    // Privacy settings (Req 19)
    this.privacy = {
      doNotTrack: config.privacy?.doNotTrack !== undefined ? config.privacy.doNotTrack : null,
      globalPrivacyControl: config.privacy?.globalPrivacyControl || false
    };

    // Advanced APIs configuration (Req 33-50)
    this.advancedApis = {
      permissions: { mode: config.advancedApis?.permissions?.mode || 'custom' },
      storage: { 
        mode: config.advancedApis?.storage?.mode || 'fake', 
        quota: config.advancedApis?.storage?.quota || 10737418240 
      },
      connection: { 
        mode: config.advancedApis?.connection?.mode || 'custom', 
        effectiveType: config.advancedApis?.connection?.effectiveType || '4g', 
        downlink: config.advancedApis?.connection?.downlink || 10, 
        rtt: config.advancedApis?.connection?.rtt || 50 
      },
      keyboard: { mode: config.advancedApis?.keyboard?.mode || 'standard' },
      performance: { 
        mode: config.advancedApis?.performance?.mode || 'noise', 
        precision: config.advancedApis?.performance?.precision || 100 
      },
      pdf: { enabled: config.advancedApis?.pdf?.enabled !== undefined ? config.advancedApis.pdf.enabled : true },
      bluetooth: { enabled: config.advancedApis?.bluetooth?.enabled || false },
      usb: { enabled: config.advancedApis?.usb?.enabled || false },
      gamepad: { mode: config.advancedApis?.gamepad?.mode || 'hide' },
      history: { 
        mode: config.advancedApis?.history?.mode || 'minimal', 
        length: config.advancedApis?.history?.length || 1 
      },
      clipboard: { mode: config.advancedApis?.clipboard?.mode || 'ask' },
      notification: { mode: config.advancedApis?.notification?.mode || 'deny' },
      serviceWorker: { enabled: config.advancedApis?.serviceWorker?.enabled !== undefined ? config.advancedApis.serviceWorker.enabled : true },
      webAssembly: { enabled: config.advancedApis?.webAssembly?.enabled !== undefined ? config.advancedApis.webAssembly.enabled : true },
      sharedArrayBuffer: { enabled: config.advancedApis?.sharedArrayBuffer?.enabled || false },
      credentials: { enabled: config.advancedApis?.credentials?.enabled || false },
      payment: { enabled: config.advancedApis?.payment?.enabled || false },
      presentation: { enabled: config.advancedApis?.presentation?.enabled || false }
    };

    // Noise seed (Req 51)
    this.noiseSeed = config.noiseSeed || {
      encrypted: false,
      value: config.noiseSeed?.value || Math.floor(Math.random() * 0xFFFFFFFF)
    };

    // Seed version for rotation (Req 51)
    this.seedVersion = config.seedVersion || 1;
    this.seedRotatedAt = config.seedRotatedAt ? new Date(config.seedRotatedAt) : null;
  }


  // ==================== Validation ====================

  /**
   * Validates the fingerprint configuration
   * @returns {{valid: boolean, errors: Array<{field: string, reason: string, value: any}>}}
   */
  validate() {
    const errors = [];

    // Validate ID
    if (!this.id || typeof this.id !== 'string' || this.id.trim().length === 0) {
      errors.push({ field: 'id', reason: 'Fingerprint ID is required and must be a non-empty string', value: this.id });
    }

    // Validate version
    if (!this.version || typeof this.version !== 'string') {
      errors.push({ field: 'version', reason: 'Version is required and must be a string', value: this.version });
    }

    // Validate browser type
    if (!Object.values(BrowserType).includes(this.browser.type)) {
      errors.push({ 
        field: 'browser.type', 
        reason: `Browser type must be one of: ${Object.values(BrowserType).join(', ')}`, 
        value: this.browser.type 
      });
    }

    // Validate browser version
    if (!this.browser.version || typeof this.browser.version !== 'string') {
      errors.push({ field: 'browser.version', reason: 'Browser version is required', value: this.browser.version });
    }

    // Validate browser majorVersion
    if (typeof this.browser.majorVersion !== 'number' || this.browser.majorVersion < 1 || this.browser.majorVersion > 999) {
      errors.push({ 
        field: 'browser.majorVersion', 
        reason: 'Browser major version must be a number between 1 and 999', 
        value: this.browser.majorVersion 
      });
    }

    // Validate OS type
    if (!Object.values(OSType).includes(this.os.type)) {
      errors.push({ 
        field: 'os.type', 
        reason: `OS type must be one of: ${Object.values(OSType).join(', ')}`, 
        value: this.os.type 
      });
    }

    // Validate OS platform
    const validPlatforms = ['Win32', 'MacIntel', 'Linux x86_64', 'Linux armv7l', 'Linux aarch64'];
    if (!this.os.platform || typeof this.os.platform !== 'string') {
      errors.push({ field: 'os.platform', reason: 'OS platform is required', value: this.os.platform });
    }

    // Validate User-Agent
    if (!this.userAgent || typeof this.userAgent !== 'string' || this.userAgent.length < 10) {
      errors.push({ field: 'userAgent', reason: 'User-Agent is required and must be at least 10 characters', value: this.userAgent });
    }

    // Validate hardware - CPU cores (Req 4.1)
    if (typeof this.hardware.cpuCores !== 'number' || this.hardware.cpuCores < 1 || this.hardware.cpuCores > 128) {
      errors.push({ 
        field: 'hardware.cpuCores', 
        reason: 'CPU cores must be a number between 1 and 128', 
        value: this.hardware.cpuCores 
      });
    }

    // Validate hardware - device memory (Req 4.2)
    const validMemoryValues = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];
    if (!validMemoryValues.includes(this.hardware.deviceMemory)) {
      errors.push({ 
        field: 'hardware.deviceMemory', 
        reason: `Device memory must be one of: ${validMemoryValues.join(', ')} GB`, 
        value: this.hardware.deviceMemory 
      });
    }

    // Validate hardware - max touch points
    if (typeof this.hardware.maxTouchPoints !== 'number' || this.hardware.maxTouchPoints < 0 || this.hardware.maxTouchPoints > 20) {
      errors.push({ 
        field: 'hardware.maxTouchPoints', 
        reason: 'Max touch points must be a number between 0 and 20', 
        value: this.hardware.maxTouchPoints 
      });
    }

    // Validate screen dimensions
    if (typeof this.hardware.screen.width !== 'number' || this.hardware.screen.width < 320 || this.hardware.screen.width > 7680) {
      errors.push({ 
        field: 'hardware.screen.width', 
        reason: 'Screen width must be between 320 and 7680', 
        value: this.hardware.screen.width 
      });
    }

    if (typeof this.hardware.screen.height !== 'number' || this.hardware.screen.height < 240 || this.hardware.screen.height > 4320) {
      errors.push({ 
        field: 'hardware.screen.height', 
        reason: 'Screen height must be between 240 and 4320', 
        value: this.hardware.screen.height 
      });
    }

    // Validate color depth
    const validColorDepths = [24, 32];
    if (!validColorDepths.includes(this.hardware.screen.colorDepth)) {
      errors.push({ 
        field: 'hardware.screen.colorDepth', 
        reason: 'Color depth must be 24 or 32', 
        value: this.hardware.screen.colorDepth 
      });
    }

    // Validate device pixel ratio
    if (typeof this.hardware.devicePixelRatio !== 'number' || this.hardware.devicePixelRatio < 0.5 || this.hardware.devicePixelRatio > 4) {
      errors.push({ 
        field: 'hardware.devicePixelRatio', 
        reason: 'Device pixel ratio must be between 0.5 and 4', 
        value: this.hardware.devicePixelRatio 
      });
    }

    // Validate canvas mode
    const validCanvasModes = ['noise', 'real', 'off'];
    if (!validCanvasModes.includes(this.canvas.mode)) {
      errors.push({ 
        field: 'canvas.mode', 
        reason: `Canvas mode must be one of: ${validCanvasModes.join(', ')}`, 
        value: this.canvas.mode 
      });
    }

    // Validate noise level
    if (!Object.values(NoiseLevel).includes(this.canvas.noiseLevel)) {
      errors.push({ 
        field: 'canvas.noiseLevel', 
        reason: `Noise level must be one of: ${Object.values(NoiseLevel).join(', ')}`, 
        value: this.canvas.noiseLevel 
      });
    }

    // Validate noise distribution
    if (!Object.values(NoiseDistribution).includes(this.canvas.noiseDistribution)) {
      errors.push({ 
        field: 'canvas.noiseDistribution', 
        reason: `Noise distribution must be one of: ${Object.values(NoiseDistribution).join(', ')}`, 
        value: this.canvas.noiseDistribution 
      });
    }

    // Validate WebGL mode
    const validWebGLModes = ['custom', 'real', 'off'];
    if (!validWebGLModes.includes(this.webgl.mode)) {
      errors.push({ 
        field: 'webgl.mode', 
        reason: `WebGL mode must be one of: ${validWebGLModes.join(', ')}`, 
        value: this.webgl.mode 
      });
    }

    // Validate WebGL vendor and renderer
    if (this.webgl.mode === 'custom') {
      if (!this.webgl.vendor || typeof this.webgl.vendor !== 'string') {
        errors.push({ field: 'webgl.vendor', reason: 'WebGL vendor is required in custom mode', value: this.webgl.vendor });
      }
      if (!this.webgl.renderer || typeof this.webgl.renderer !== 'string') {
        errors.push({ field: 'webgl.renderer', reason: 'WebGL renderer is required in custom mode', value: this.webgl.renderer });
      }
    }

    // Validate audio mode
    const validAudioModes = ['noise', 'real', 'off'];
    if (!validAudioModes.includes(this.audio.mode)) {
      errors.push({ 
        field: 'audio.mode', 
        reason: `Audio mode must be one of: ${validAudioModes.join(', ')}`, 
        value: this.audio.mode 
      });
    }

    // Validate fonts mode
    const validFontsModes = ['custom', 'system'];
    if (!validFontsModes.includes(this.fonts.mode)) {
      errors.push({ 
        field: 'fonts.mode', 
        reason: `Fonts mode must be one of: ${validFontsModes.join(', ')}`, 
        value: this.fonts.mode 
      });
    }

    // Validate fonts list
    if (this.fonts.mode === 'custom' && (!Array.isArray(this.fonts.list) || this.fonts.list.length === 0)) {
      errors.push({ field: 'fonts.list', reason: 'Fonts list is required in custom mode', value: this.fonts.list });
    }

    // Validate timezone offset
    if (typeof this.timezone.offset !== 'number' || this.timezone.offset < -720 || this.timezone.offset > 840) {
      errors.push({ 
        field: 'timezone.offset', 
        reason: 'Timezone offset must be between -720 and 840 minutes', 
        value: this.timezone.offset 
      });
    }

    // Validate geolocation coordinates
    if (typeof this.geolocation.latitude !== 'number' || this.geolocation.latitude < -90 || this.geolocation.latitude > 90) {
      errors.push({ 
        field: 'geolocation.latitude', 
        reason: 'Latitude must be between -90 and 90', 
        value: this.geolocation.latitude 
      });
    }

    if (typeof this.geolocation.longitude !== 'number' || this.geolocation.longitude < -180 || this.geolocation.longitude > 180) {
      errors.push({ 
        field: 'geolocation.longitude', 
        reason: 'Longitude must be between -180 and 180', 
        value: this.geolocation.longitude 
      });
    }

    // Validate WebRTC mode
    const validWebRTCModes = ['disable', 'replace', 'real'];
    if (!validWebRTCModes.includes(this.webrtc.mode)) {
      errors.push({ 
        field: 'webrtc.mode', 
        reason: `WebRTC mode must be one of: ${validWebRTCModes.join(', ')}`, 
        value: this.webrtc.mode 
      });
    }

    // Validate battery level
    if (typeof this.battery.level !== 'number' || this.battery.level < 0 || this.battery.level > 1) {
      errors.push({ 
        field: 'battery.level', 
        reason: 'Battery level must be between 0 and 1', 
        value: this.battery.level 
      });
    }

    // Validate createdAt
    if (!(this.createdAt instanceof Date) || isNaN(this.createdAt.getTime())) {
      errors.push({ field: 'createdAt', reason: 'createdAt must be a valid Date', value: this.createdAt });
    }

    // Validate updatedAt
    if (!(this.updatedAt instanceof Date) || isNaN(this.updatedAt.getTime())) {
      errors.push({ field: 'updatedAt', reason: 'updatedAt must be a valid Date', value: this.updatedAt });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }


  // ==================== Serialization ====================

  /**
   * Converts the fingerprint config to a JSON-serializable object
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      accountId: this.accountId,
      createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : this.createdAt,
      updatedAt: this.updatedAt instanceof Date ? this.updatedAt.toISOString() : this.updatedAt,
      version: this.version,
      browser: { ...this.browser },
      os: { ...this.os },
      userAgent: this.userAgent,
      navigator: { ...this.navigator },
      hardware: {
        ...this.hardware,
        screen: { ...this.hardware.screen }
      },
      canvas: { ...this.canvas },
      webgl: { 
        ...this.webgl,
        extensions: [...this.webgl.extensions],
        shaderPrecision: { ...this.webgl.shaderPrecision }
      },
      audio: { ...this.audio },
      fonts: { 
        ...this.fonts,
        list: [...this.fonts.list]
      },
      plugins: {
        ...this.plugins,
        list: this.plugins.list.map(p => ({ ...p }))
      },
      language: {
        ...this.language,
        list: [...this.language.list]
      },
      timezone: { ...this.timezone },
      geolocation: { ...this.geolocation },
      webrtc: {
        ...this.webrtc,
        whitelist: [...this.webrtc.whitelist]
      },
      clientRects: { ...this.clientRects },
      mediaDevices: {
        ...this.mediaDevices,
        devices: this.mediaDevices.devices.map(d => ({ ...d }))
      },
      battery: { ...this.battery },
      sensors: { ...this.sensors },
      speech: {
        ...this.speech,
        voices: this.speech.voices.map(v => ({ ...v }))
      },
      privacy: { ...this.privacy },
      advancedApis: {
        permissions: { ...this.advancedApis.permissions },
        storage: { ...this.advancedApis.storage },
        connection: { ...this.advancedApis.connection },
        keyboard: { ...this.advancedApis.keyboard },
        performance: { ...this.advancedApis.performance },
        pdf: { ...this.advancedApis.pdf },
        bluetooth: { ...this.advancedApis.bluetooth },
        usb: { ...this.advancedApis.usb },
        gamepad: { ...this.advancedApis.gamepad },
        history: { ...this.advancedApis.history },
        clipboard: { ...this.advancedApis.clipboard },
        notification: { ...this.advancedApis.notification },
        serviceWorker: { ...this.advancedApis.serviceWorker },
        webAssembly: { ...this.advancedApis.webAssembly },
        sharedArrayBuffer: { ...this.advancedApis.sharedArrayBuffer },
        credentials: { ...this.advancedApis.credentials },
        payment: { ...this.advancedApis.payment },
        presentation: { ...this.advancedApis.presentation }
      },
      noiseSeed: { ...this.noiseSeed },
      seedVersion: this.seedVersion,
      seedRotatedAt: this.seedRotatedAt instanceof Date ? this.seedRotatedAt.toISOString() : this.seedRotatedAt
    };
  }

  /**
   * Creates a FingerprintConfig instance from a JSON object
   * @param {Object} json - JSON representation
   * @returns {FingerprintConfig}
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON: expected an object');
    }
    return new FingerprintConfig(json);
  }

  /**
   * Creates a deep clone of this configuration
   * @returns {FingerprintConfig}
   */
  clone() {
    return FingerprintConfig.fromJSON(this.toJSON());
  }

  /**
   * Updates the configuration with new values
   * @param {Object} updates - Partial configuration updates
   */
  update(updates) {
    if (updates.browser) {
      this.browser = { ...this.browser, ...updates.browser };
    }
    if (updates.os) {
      this.os = { ...this.os, ...updates.os };
    }
    if (updates.userAgent !== undefined) {
      this.userAgent = updates.userAgent;
    }
    if (updates.navigator) {
      this.navigator = { ...this.navigator, ...updates.navigator };
    }
    if (updates.hardware) {
      this.hardware = {
        ...this.hardware,
        ...updates.hardware,
        screen: updates.hardware.screen 
          ? { ...this.hardware.screen, ...updates.hardware.screen }
          : this.hardware.screen
      };
    }
    if (updates.canvas) {
      this.canvas = { ...this.canvas, ...updates.canvas };
    }
    if (updates.webgl) {
      this.webgl = { ...this.webgl, ...updates.webgl };
    }
    if (updates.audio) {
      this.audio = { ...this.audio, ...updates.audio };
    }
    if (updates.fonts) {
      this.fonts = { ...this.fonts, ...updates.fonts };
    }
    if (updates.plugins) {
      this.plugins = { ...this.plugins, ...updates.plugins };
    }
    if (updates.language) {
      this.language = { ...this.language, ...updates.language };
    }
    if (updates.timezone) {
      this.timezone = { ...this.timezone, ...updates.timezone };
    }
    if (updates.geolocation) {
      this.geolocation = { ...this.geolocation, ...updates.geolocation };
    }
    if (updates.webrtc) {
      this.webrtc = { ...this.webrtc, ...updates.webrtc };
    }
    if (updates.clientRects) {
      this.clientRects = { ...this.clientRects, ...updates.clientRects };
    }
    if (updates.mediaDevices) {
      this.mediaDevices = { ...this.mediaDevices, ...updates.mediaDevices };
    }
    if (updates.battery) {
      this.battery = { ...this.battery, ...updates.battery };
    }
    if (updates.sensors) {
      this.sensors = { ...this.sensors, ...updates.sensors };
    }
    if (updates.speech) {
      this.speech = { ...this.speech, ...updates.speech };
    }
    if (updates.privacy) {
      this.privacy = { ...this.privacy, ...updates.privacy };
    }
    if (updates.advancedApis) {
      this.advancedApis = this._mergeAdvancedApis(updates.advancedApis);
    }
    if (updates.noiseSeed) {
      this.noiseSeed = { ...this.noiseSeed, ...updates.noiseSeed };
    }
    if (updates.seedVersion !== undefined) {
      this.seedVersion = updates.seedVersion;
    }
    if (updates.seedRotatedAt !== undefined) {
      this.seedRotatedAt = updates.seedRotatedAt ? new Date(updates.seedRotatedAt) : null;
    }

    this.updatedAt = new Date();
  }

  /**
   * Merges advanced APIs configuration
   * @private
   */
  _mergeAdvancedApis(updates) {
    const result = { ...this.advancedApis };
    for (const key of Object.keys(updates)) {
      if (result[key] && typeof updates[key] === 'object') {
        result[key] = { ...result[key], ...updates[key] };
      } else {
        result[key] = updates[key];
      }
    }
    return result;
  }

  /**
   * Checks if two configurations are equal
   * @param {FingerprintConfig} other - Other configuration to compare
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof FingerprintConfig)) {
      return false;
    }
    return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON());
  }

  /**
   * Returns a human-readable string representation for debugging
   * @param {FingerprintConfig} config - FingerprintConfig instance
   * @returns {string}
   */
  static prettyPrint(config) {
    const lines = [
      '┌─────────────────────────────────────────────────────────────┐',
      '│                   FINGERPRINT CONFIG                       │',
      '├─────────────────────────────────────────────────────────────┤',
      `│ ID:           ${(config.id || 'N/A').substring(0, 44).padEnd(44)} │`,
      `│ Account ID:   ${(config.accountId || 'N/A').substring(0, 44).padEnd(44)} │`,
      `│ Version:      ${(config.version || 'N/A').padEnd(44)} │`,
      `│ Browser:      ${(config.browser.type + ' ' + config.browser.version).substring(0, 44).padEnd(44)} │`,
      `│ OS:           ${(config.os.type + ' ' + config.os.version).substring(0, 44).padEnd(44)} │`,
      `│ Platform:     ${(config.os.platform || 'N/A').padEnd(44)} │`,
      `│ CPU Cores:    ${String(config.hardware.cpuCores).padEnd(44)} │`,
      `│ Memory:       ${(config.hardware.deviceMemory + ' GB').padEnd(44)} │`,
      `│ Screen:       ${(config.hardware.screen.width + 'x' + config.hardware.screen.height).padEnd(44)} │`,
      `│ Canvas Mode:  ${(config.canvas.mode).padEnd(44)} │`,
      `│ WebGL Mode:   ${(config.webgl.mode).padEnd(44)} │`,
      `│ Audio Mode:   ${(config.audio.mode).padEnd(44)} │`,
      `│ WebRTC Mode:  ${(config.webrtc.mode).padEnd(44)} │`,
      `│ Timezone:     ${(config.timezone.name || 'N/A').substring(0, 44).padEnd(44)} │`,
      `│ Created:      ${(config.createdAt instanceof Date ? config.createdAt.toISOString() : String(config.createdAt)).substring(0, 44).padEnd(44)} │`,
      '└─────────────────────────────────────────────────────────────┘'
    ];
    return lines.join('\n');
  }
}

// Export enums and class
FingerprintConfig.BrowserType = BrowserType;
FingerprintConfig.OSType = OSType;
FingerprintConfig.NoiseLevel = NoiseLevel;
FingerprintConfig.NoiseDistribution = NoiseDistribution;

module.exports = FingerprintConfig;
