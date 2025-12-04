'use strict';

const crypto = require('crypto');
const FingerprintConfig = require('../../../domain/fingerprint/FingerprintConfig');
const FingerprintDatabase = require('../../../domain/fingerprint/FingerprintDatabase');
const NoiseEngine = require('../../../domain/fingerprint/NoiseEngine');
const FingerprintValidator = require('./FingerprintValidator');

/**
 * FingerprintGenerator - Professional Fingerprint Generation Service
 * 
 * Generates complete, realistic browser fingerprints with internal consistency.
 * Integrates with FingerprintDatabase for real browser data and NoiseEngine
 * for deterministic noise generation.
 * 
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7
 * 
 * Key Features:
 * - One-click complete fingerprint generation
 * - Internal consistency validation (OS, User-Agent, WebGL, fonts)
 * - Integration with real browser fingerprint database
 * - Unique noise seed generation for each fingerprint
 * - Multiple generation produces unique fingerprints
 */

/**
 * Browser type constants
 */
const BrowserType = FingerprintConfig.BrowserType;

/**
 * OS type constants
 */
const OSType = FingerprintConfig.OSType;

/**
 * FingerprintGenerator class for generating complete fingerprint configurations
 */
class FingerprintGenerator {
  /**
   * Creates a FingerprintGenerator instance
   * @param {Object} [options] - Generator options
   * @param {FingerprintDatabase} [options.database] - Fingerprint database instance
   * @param {FingerprintValidator} [options.validator] - Validator instance
   */
  constructor(options = {}) {
    this._database = options.database || new FingerprintDatabase();
    this._validator = options.validator || new FingerprintValidator();
    this._database.initialize();
  }


  /**
   * Generates a complete fingerprint configuration (one-click generation)
   * 
   * Requirement 20.1: When user clicks "one-click generate", system should
   * generate complete fingerprint configuration including all dimensions
   * 
   * @param {Object} [options] - Generation options
   * @param {string} [options.accountId] - Account ID to associate with fingerprint
   * @param {string} [options.os] - Target OS type (windows, macos, linux)
   * @param {string} [options.browser] - Target browser type (chrome, firefox, edge, safari)
   * @param {number} [options.seed] - Optional seed for deterministic generation
   * @returns {FingerprintConfig} Complete fingerprint configuration
   */
  generateFingerprint(options = {}) {
    const os = options.os || this._getRandomOS();
    const browser = options.browser || this._getValidBrowserForOS(os);
    
    // Get a template from the database
    const template = this._database.generateSyntheticFingerprint({
      os,
      browser,
      seed: options.seed
    });
    
    // Generate unique noise seed
    const noiseSeed = this._generateSecureSeed();
    
    // Build the complete fingerprint configuration
    const config = this._buildConfigFromTemplate(template, {
      accountId: options.accountId,
      os,
      browser,
      noiseSeed
    });
    
    // Ensure internal consistency
    this.ensureConsistency(config);
    
    return config;
  }

  /**
   * Generates a User-Agent string for the given OS and browser
   * 
   * Requirement 20.2: When generating fingerprint, system should ensure
   * all parameters are internally consistent
   * 
   * @param {Object} options - Generation options
   * @param {string} options.os - OS type
   * @param {string} options.browser - Browser type
   * @param {string} [options.browserVersion] - Specific browser version
   * @param {string} [options.osVersion] - Specific OS version
   * @returns {string} Generated User-Agent string
   */
  generateUserAgent(options) {
    const { os, browser, browserVersion, osVersion } = options;
    
    const version = browserVersion || this._getDefaultBrowserVersion(browser);
    const majorVersion = parseInt(version.split('.')[0], 10);
    
    switch (os) {
      case OSType.Windows:
        return this._generateWindowsUserAgent(browser, version, majorVersion, osVersion);
      case OSType.MacOS:
        return this._generateMacOSUserAgent(browser, version, majorVersion, osVersion);
      case OSType.Linux:
        return this._generateLinuxUserAgent(browser, version, majorVersion, osVersion);
      default:
        return this._generateWindowsUserAgent(browser, version, majorVersion, osVersion);
    }
  }

  /**
   * Generates WebGL configuration for the given OS
   * 
   * Requirement 20.3: When generating fingerprint, system should select
   * parameters from real browser fingerprint database
   * 
   * @param {Object} options - Generation options
   * @param {string} options.os - OS type
   * @param {string} [options.browser] - Browser type
   * @returns {Object} WebGL configuration
   */
  generateWebGL(options) {
    const { os, browser } = options;
    
    // Get templates for the OS to extract WebGL configs
    const templates = browser 
      ? this._database.getByOSAndBrowser(os, browser)
      : this._getTemplatesForOS(os);
    
    if (templates.length === 0) {
      return this._getDefaultWebGL(os);
    }
    
    // Select a random WebGL config from templates
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    return {
      mode: 'custom',
      vendor: template.webgl.vendor,
      renderer: template.webgl.renderer,
      unmaskedVendor: template.webgl.unmaskedVendor,
      unmaskedRenderer: template.webgl.unmaskedRenderer,
      extensions: this._getWebGLExtensions(os, browser),
      shaderPrecision: this._getShaderPrecision(),
      imageNoise: true,
      noiseLevel: 'medium'
    };
  }

  /**
   * Generates font list for the given OS
   * 
   * Requirement 20.5: When generating fingerprint, system should automatically
   * match appropriate font list based on selected OS
   * 
   * @param {Object} options - Generation options
   * @param {string} options.os - OS type
   * @returns {Object} Fonts configuration
   */
  generateFonts(options) {
    const { os } = options;
    const fonts = FingerprintValidator.getExpectedFonts(os);
    
    // Randomly select a subset of fonts (more realistic)
    const minFonts = Math.min(10, fonts.length);
    const maxFonts = Math.min(20, fonts.length);
    const numFonts = minFonts + Math.floor(Math.random() * (maxFonts - minFonts + 1));
    
    // Shuffle and select
    const shuffled = [...fonts].sort(() => Math.random() - 0.5);
    const selectedFonts = shuffled.slice(0, numFonts);
    
    // Always include common fonts
    const commonFonts = ['Arial', 'Times New Roman', 'Verdana', 'Georgia', 'Courier New'];
    for (const font of commonFonts) {
      if (!selectedFonts.includes(font) && fonts.includes(font)) {
        selectedFonts.push(font);
      }
    }
    
    return {
      mode: 'custom',
      list: selectedFonts
    };
  }


  /**
   * Ensures internal consistency of a fingerprint configuration
   * 
   * Requirement 20.2: When generating fingerprint, system should ensure
   * all parameters are internally consistent (OS matches User-Agent, GPU compatible with browser)
   * 
   * @param {FingerprintConfig} config - Configuration to validate and fix
   * @returns {FingerprintConfig} The same config with consistency fixes applied
   */
  ensureConsistency(config) {
    // Ensure platform matches OS type
    const expectedPlatform = FingerprintValidator.getExpectedPlatform(config.os.type);
    if (config.os.platform !== expectedPlatform) {
      config.os.platform = expectedPlatform;
    }
    
    // Ensure User-Agent matches OS and browser
    const uaLower = config.userAgent.toLowerCase();
    const osType = config.os.type;
    
    // Check if User-Agent needs regeneration
    let needsNewUA = false;
    if (osType === OSType.Windows && !uaLower.includes('windows')) {
      needsNewUA = true;
    } else if (osType === OSType.MacOS && !uaLower.includes('macintosh') && !uaLower.includes('mac os')) {
      needsNewUA = true;
    } else if (osType === OSType.Linux && !uaLower.includes('linux')) {
      needsNewUA = true;
    }
    
    if (needsNewUA) {
      config.userAgent = this.generateUserAgent({
        os: osType,
        browser: config.browser.type,
        browserVersion: config.browser.version,
        osVersion: config.os.version
      });
    }
    
    // Ensure navigator properties match
    this._ensureNavigatorConsistency(config);
    
    // Ensure WebGL is compatible with OS
    this._ensureWebGLConsistency(config);
    
    // Ensure fonts match OS
    this._ensureFontsConsistency(config);
    
    // Ensure screen dimensions are valid
    this._ensureScreenConsistency(config);
    
    // Update timestamp
    config.updatedAt = new Date();
    
    return config;
  }

  // ==================== Private Helper Methods ====================

  /**
   * Builds a FingerprintConfig from a database template
   * @private
   */
  _buildConfigFromTemplate(template, options) {
    const { accountId, os, browser, noiseSeed } = options;
    
    const config = new FingerprintConfig({
      accountId,
      browser: {
        type: browser,
        version: template.browserVersion,
        majorVersion: template.majorVersion
      },
      os: {
        type: os,
        version: template.osVersion,
        platform: template.platform
      },
      userAgent: template.userAgent,
      navigator: {
        appVersion: this._extractAppVersion(template.userAgent),
        vendor: template.vendor,
        product: 'Gecko',
        productSub: '20030107',
        appName: 'Netscape',
        appCodeName: 'Mozilla',
        language: 'en-US',
        languages: ['en-US', 'en'],
        doNotTrack: null,
        globalPrivacyControl: false,
        webdriver: false
      },
      hardware: {
        cpuCores: template.hardware.cpuCores,
        deviceMemory: template.hardware.deviceMemory,
        maxTouchPoints: template.hardware.maxTouchPoints,
        screen: {
          width: template.screen.width,
          height: template.screen.height,
          availWidth: template.screen.width,
          availHeight: template.screen.height - 40, // Account for taskbar
          colorDepth: template.screen.colorDepth,
          pixelDepth: template.screen.colorDepth
        },
        devicePixelRatio: template.screen.pixelRatio || 1
      },
      canvas: {
        mode: 'noise',
        noiseLevel: 'medium',
        noiseDistribution: 'uniform'
      },
      webgl: {
        mode: 'custom',
        vendor: template.webgl.vendor,
        renderer: template.webgl.renderer,
        unmaskedVendor: template.webgl.unmaskedVendor,
        unmaskedRenderer: template.webgl.unmaskedRenderer,
        extensions: this._getWebGLExtensions(os, browser),
        shaderPrecision: this._getShaderPrecision(),
        imageNoise: true,
        noiseLevel: 'medium'
      },
      audio: {
        mode: 'noise',
        noiseLevel: 'medium',
        noiseDistribution: 'uniform'
      },
      fonts: {
        mode: 'custom',
        list: template.fonts
      },
      plugins: {
        mode: 'custom',
        list: this._getPlugins(browser)
      },
      language: {
        mode: 'custom',
        primary: 'en-US',
        list: ['en-US', 'en']
      },
      timezone: {
        mode: 'custom',
        name: 'America/New_York',
        offset: -300
      },
      geolocation: {
        mode: 'custom',
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 100
      },
      webrtc: {
        mode: 'replace',
        publicIP: 'auto',
        localIP: '192.168.1.100',
        whitelist: []
      },
      clientRects: {
        mode: 'noise',
        noiseLevel: 'low'
      },
      mediaDevices: {
        mode: 'fake',
        devices: [
          { kind: 'audioinput', deviceId: this._generateDeviceId(), label: 'Default Audio Device' },
          { kind: 'videoinput', deviceId: this._generateDeviceId(), label: 'Integrated Webcam' }
        ]
      },
      battery: {
        mode: 'privacy',
        charging: true,
        level: 1.0
      },
      sensors: {
        mode: 'disable'
      },
      speech: {
        mode: 'minimal',
        voices: this._getSpeechVoices(os)
      },
      privacy: {
        doNotTrack: null,
        globalPrivacyControl: false
      },
      noiseSeed: {
        encrypted: false,
        value: noiseSeed
      },
      seedVersion: 1,
      seedRotatedAt: null
    });
    
    return config;
  }


  /**
   * Generates a cryptographically secure seed
   * @private
   * @returns {number} Secure random seed
   */
  _generateSecureSeed() {
    return NoiseEngine.generateSecureSeed();
  }

  /**
   * Gets a random OS type
   * @private
   * @returns {string} Random OS type
   */
  _getRandomOS() {
    const osTypes = [OSType.Windows, OSType.MacOS, OSType.Linux];
    // Weight towards Windows as it's most common
    const weights = [0.7, 0.2, 0.1];
    const random = Math.random();
    let cumulative = 0;
    for (let i = 0; i < osTypes.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        return osTypes[i];
      }
    }
    return OSType.Windows;
  }

  /**
   * Gets a valid browser for the given OS
   * @private
   * @param {string} os - OS type
   * @returns {string} Valid browser type
   */
  _getValidBrowserForOS(os) {
    const availableBrowsers = this._database.getAvailableBrowsersForOS(os);
    if (availableBrowsers.length === 0) {
      return BrowserType.Chrome;
    }
    return availableBrowsers[Math.floor(Math.random() * availableBrowsers.length)];
  }

  /**
   * Gets templates for a given OS
   * @private
   */
  _getTemplatesForOS(os) {
    const osBrowsers = this._database.getByOS(os);
    const templates = [];
    for (const browser of Object.keys(osBrowsers)) {
      templates.push(...osBrowsers[browser]);
    }
    return templates;
  }

  /**
   * Gets default browser version
   * @private
   */
  _getDefaultBrowserVersion(browser) {
    switch (browser) {
      case BrowserType.Chrome:
        return '120.0.0.0';
      case BrowserType.Firefox:
        return '121.0';
      case BrowserType.Edge:
        return '120.0.0.0';
      case BrowserType.Safari:
        return '17.2';
      default:
        return '120.0.0.0';
    }
  }

  /**
   * Generates Windows User-Agent
   * @private
   */
  _generateWindowsUserAgent(browser, version, majorVersion, osVersion = '10.0') {
    switch (browser) {
      case BrowserType.Chrome:
        return `Mozilla/5.0 (Windows NT ${osVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
      case BrowserType.Firefox:
        return `Mozilla/5.0 (Windows NT ${osVersion}; Win64; x64; rv:${majorVersion}.0) Gecko/20100101 Firefox/${version}`;
      case BrowserType.Edge:
        return `Mozilla/5.0 (Windows NT ${osVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36 Edg/${version}`;
      default:
        return `Mozilla/5.0 (Windows NT ${osVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
    }
  }

  /**
   * Generates macOS User-Agent
   * @private
   */
  _generateMacOSUserAgent(browser, version, majorVersion, osVersion = '10_15_7') {
    const formattedOSVersion = osVersion.replace(/\./g, '_');
    switch (browser) {
      case BrowserType.Chrome:
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${formattedOSVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
      case BrowserType.Firefox:
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${formattedOSVersion}; rv:${majorVersion}.0) Gecko/20100101 Firefox/${version}`;
      case BrowserType.Safari:
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${formattedOSVersion}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Safari/605.1.15`;
      default:
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${formattedOSVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
    }
  }

  /**
   * Generates Linux User-Agent
   * @private
   */
  _generateLinuxUserAgent(browser, version, majorVersion) {
    switch (browser) {
      case BrowserType.Chrome:
        return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
      case BrowserType.Firefox:
        return `Mozilla/5.0 (X11; Linux x86_64; rv:${majorVersion}.0) Gecko/20100101 Firefox/${version}`;
      default:
        return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
    }
  }

  /**
   * Gets default WebGL configuration for OS
   * @private
   */
  _getDefaultWebGL(os) {
    switch (os) {
      case OSType.Windows:
        return {
          mode: 'custom',
          vendor: 'Google Inc. (Intel)',
          renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
          unmaskedVendor: 'Intel Inc.',
          unmaskedRenderer: 'Intel(R) UHD Graphics 630',
          extensions: this._getWebGLExtensions(os, BrowserType.Chrome),
          shaderPrecision: this._getShaderPrecision(),
          imageNoise: true,
          noiseLevel: 'medium'
        };
      case OSType.MacOS:
        return {
          mode: 'custom',
          vendor: 'Google Inc. (Apple)',
          renderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)',
          unmaskedVendor: 'Apple Inc.',
          unmaskedRenderer: 'Apple M1',
          extensions: this._getWebGLExtensions(os, BrowserType.Chrome),
          shaderPrecision: this._getShaderPrecision(),
          imageNoise: true,
          noiseLevel: 'medium'
        };
      case OSType.Linux:
        return {
          mode: 'custom',
          vendor: 'Google Inc. (Intel)',
          renderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)',
          unmaskedVendor: 'Intel',
          unmaskedRenderer: 'Mesa Intel(R) UHD Graphics 630 (CFL GT2)',
          extensions: this._getWebGLExtensions(os, BrowserType.Chrome),
          shaderPrecision: this._getShaderPrecision(),
          imageNoise: true,
          noiseLevel: 'medium'
        };
      default:
        return this._getDefaultWebGL(OSType.Windows);
    }
  }


  /**
   * Gets WebGL extensions for browser
   * @private
   */
  _getWebGLExtensions(os, browser) {
    const commonExtensions = [
      'ANGLE_instanced_arrays',
      'EXT_blend_minmax',
      'EXT_color_buffer_half_float',
      'EXT_disjoint_timer_query',
      'EXT_float_blend',
      'EXT_frag_depth',
      'EXT_shader_texture_lod',
      'EXT_texture_compression_bptc',
      'EXT_texture_compression_rgtc',
      'EXT_texture_filter_anisotropic',
      'EXT_sRGB',
      'OES_element_index_uint',
      'OES_fbo_render_mipmap',
      'OES_standard_derivatives',
      'OES_texture_float',
      'OES_texture_float_linear',
      'OES_texture_half_float',
      'OES_texture_half_float_linear',
      'OES_vertex_array_object',
      'WEBGL_color_buffer_float',
      'WEBGL_compressed_texture_s3tc',
      'WEBGL_compressed_texture_s3tc_srgb',
      'WEBGL_debug_renderer_info',
      'WEBGL_debug_shaders',
      'WEBGL_depth_texture',
      'WEBGL_draw_buffers',
      'WEBGL_lose_context',
      'WEBGL_multi_draw'
    ];
    
    return commonExtensions;
  }

  /**
   * Gets shader precision format
   * @private
   */
  _getShaderPrecision() {
    return {
      vertexShaderHighFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
      vertexShaderMediumFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
      vertexShaderLowFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
      fragmentShaderHighFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
      fragmentShaderMediumFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
      fragmentShaderLowFloat: { rangeMin: 127, rangeMax: 127, precision: 23 }
    };
  }

  /**
   * Gets plugins for browser
   * @private
   */
  _getPlugins(browser) {
    if (browser === BrowserType.Firefox) {
      return [];
    }
    
    return [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
    ];
  }

  /**
   * Gets speech voices for OS
   * @private
   */
  _getSpeechVoices(os) {
    switch (os) {
      case OSType.Windows:
        return [
          { name: 'Microsoft David Desktop', lang: 'en-US' },
          { name: 'Microsoft Zira Desktop', lang: 'en-US' }
        ];
      case OSType.MacOS:
        return [
          { name: 'Alex', lang: 'en-US' },
          { name: 'Samantha', lang: 'en-US' }
        ];
      case OSType.Linux:
        return [
          { name: 'English (America)', lang: 'en-US' }
        ];
      default:
        return [{ name: 'Microsoft David Desktop', lang: 'en-US' }];
    }
  }

  /**
   * Generates a device ID
   * @private
   */
  _generateDeviceId() {
    return crypto.randomUUID();
  }

  /**
   * Extracts appVersion from User-Agent
   * @private
   */
  _extractAppVersion(userAgent) {
    // Extract the part after "Mozilla/"
    const match = userAgent.match(/^Mozilla\/(\d+\.\d+)\s+(.+)$/);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
    return userAgent.replace('Mozilla/', '');
  }

  /**
   * Ensures navigator properties are consistent
   * @private
   */
  _ensureNavigatorConsistency(config) {
    // Update appVersion to match User-Agent
    config.navigator.appVersion = this._extractAppVersion(config.userAgent);
    
    // Set vendor based on browser
    switch (config.browser.type) {
      case BrowserType.Chrome:
      case BrowserType.Edge:
        config.navigator.vendor = 'Google Inc.';
        break;
      case BrowserType.Firefox:
        config.navigator.vendor = '';
        break;
      case BrowserType.Safari:
        config.navigator.vendor = 'Apple Computer, Inc.';
        break;
    }
    
    // Ensure webdriver is false
    config.navigator.webdriver = false;
  }

  /**
   * Ensures WebGL configuration is consistent with OS
   * @private
   */
  _ensureWebGLConsistency(config) {
    if (config.webgl.mode !== 'custom') {
      return;
    }
    
    const os = config.os.type;
    const renderer = config.webgl.renderer.toLowerCase();
    const unmaskedRenderer = config.webgl.unmaskedRenderer.toLowerCase();
    
    // Check for Apple GPU on non-macOS
    if (os !== OSType.MacOS) {
      if (renderer.includes('apple m') || unmaskedRenderer.includes('apple m')) {
        // Replace with appropriate GPU for the OS
        const newWebGL = this._getDefaultWebGL(os);
        config.webgl.vendor = newWebGL.vendor;
        config.webgl.renderer = newWebGL.renderer;
        config.webgl.unmaskedVendor = newWebGL.unmaskedVendor;
        config.webgl.unmaskedRenderer = newWebGL.unmaskedRenderer;
      }
    }
    
    // Check for Direct3D on non-Windows
    if (os !== OSType.Windows) {
      if (renderer.includes('direct3d') || renderer.includes('d3d11')) {
        const newWebGL = this._getDefaultWebGL(os);
        config.webgl.vendor = newWebGL.vendor;
        config.webgl.renderer = newWebGL.renderer;
        config.webgl.unmaskedVendor = newWebGL.unmaskedVendor;
        config.webgl.unmaskedRenderer = newWebGL.unmaskedRenderer;
      }
    }
  }

  /**
   * Ensures fonts are consistent with OS
   * @private
   */
  _ensureFontsConsistency(config) {
    if (config.fonts.mode !== 'custom') {
      return;
    }
    
    const os = config.os.type;
    const expectedFonts = FingerprintValidator.getExpectedFonts(os);
    
    // Check if current fonts have at least some OS-appropriate fonts
    const hasOSFonts = config.fonts.list.some(font => expectedFonts.includes(font));
    
    if (!hasOSFonts) {
      // Replace with OS-appropriate fonts
      config.fonts.list = this.generateFonts({ os }).list;
    }
  }

  /**
   * Ensures screen dimensions are valid
   * @private
   */
  _ensureScreenConsistency(config) {
    const screen = config.hardware.screen;
    
    // Ensure availWidth <= width
    if (screen.availWidth > screen.width) {
      screen.availWidth = screen.width;
    }
    
    // Ensure availHeight <= height
    if (screen.availHeight > screen.height) {
      screen.availHeight = screen.height - 40; // Account for taskbar
    }
    
    // Ensure pixelDepth matches colorDepth
    screen.pixelDepth = screen.colorDepth;
  }
}

// Export enums for convenience
FingerprintGenerator.BrowserType = BrowserType;
FingerprintGenerator.OSType = OSType;

module.exports = FingerprintGenerator;
