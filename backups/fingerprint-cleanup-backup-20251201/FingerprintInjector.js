/**
 * Fingerprint Injector
 * 
 * Generates and injects JavaScript code to override browser fingerprints.
 * Modifies navigator properties, WebGL, Canvas, Audio, and other APIs.
 * 
 * @module environment/FingerprintInjector
 */

'use strict';

const FingerprintGenerator = require('./FingerprintGenerator');

/**
 * Fingerprint Injector
 */
class FingerprintInjector {
  /**
   * Get injection script for fingerprint configuration
   * @param {Object} fingerprintConfig - Fingerprint configuration
   * @returns {string} JavaScript code to inject
   */
  static getInjectionScript(fingerprintConfig) {
    if (!fingerprintConfig) {
      return '';
    }

    const scripts = [];

    // User Agent override
    if (fingerprintConfig.userAgent) {
      scripts.push(this._getUserAgentScript(fingerprintConfig.userAgent));
    }

    // WebGL override
    if (fingerprintConfig.webgl && fingerprintConfig.webgl.mode === 'custom') {
      scripts.push(this._getWebGLScript(fingerprintConfig.webgl));
    }

    // WebRTC override
    if (fingerprintConfig.webrtc) {
      scripts.push(this._getWebRTCScript(fingerprintConfig.webrtc));
    }

    // Canvas override
    if (fingerprintConfig.canvas === 'random') {
      scripts.push(this._getCanvasScript());
    }

    // Audio override
    if (fingerprintConfig.audio === 'random') {
      scripts.push(this._getAudioScript());
    }

    // ClientRects override
    if (fingerprintConfig.clientRects === 'random') {
      scripts.push(this._getClientRectsScript());
    }

    // Timezone override
    if (fingerprintConfig.timezone && fingerprintConfig.timezone.mode === 'custom') {
      scripts.push(this._getTimezoneScript(fingerprintConfig.timezone.value));
    }

    // Geolocation override
    if (fingerprintConfig.geolocation) {
      scripts.push(this._getGeolocationScript(fingerprintConfig.geolocation));
    }

    // Language override
    if (fingerprintConfig.language && fingerprintConfig.language.mode === 'custom') {
      scripts.push(this._getLanguageScript(fingerprintConfig.language.value));
    }

    // Resolution override
    if (fingerprintConfig.resolution && fingerprintConfig.resolution.mode === 'custom') {
      scripts.push(this._getResolutionScript(fingerprintConfig.resolution));
    }

    // Device info override
    if (fingerprintConfig.deviceInfo) {
      scripts.push(this._getDeviceInfoScript(fingerprintConfig.deviceInfo));
    }

    // Hardware override
    if (fingerprintConfig.hardware) {
      scripts.push(this._getHardwareScript(fingerprintConfig.hardware));
    }

    // Combine all scripts
    const combinedScript = `
(function() {
  'use strict';
  
  try {
    ${scripts.join('\n\n')}
    
    console.log('[Fingerprint] Fingerprint injection completed');
  } catch (error) {
    console.error('[Fingerprint] Injection error:', error);
  }
})();
`;

    return combinedScript;
  }

  /**
   * Get User-Agent override script
   * @param {string} userAgent - User-Agent string
   * @returns {string} Script
   * @private
   */
  static _getUserAgentScript(userAgent) {
    let platform = 'Win32';
    if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS X')) {
      platform = 'MacIntel';
    } else if (userAgent.includes('Linux')) {
      platform = 'Linux x86_64';
    } else if (userAgent.includes('Android')) {
      platform = 'Linux armv8l';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      platform = 'iPhone';
    }

    return `
    // Override User-Agent
    Object.defineProperty(navigator, 'userAgent', {
      get: function() { return '${userAgent}'; },
      configurable: true
    });
    
    Object.defineProperty(navigator, 'appVersion', {
      get: function() { return '${userAgent.replace('Mozilla/', '')}'; },
      configurable: true
    });

    Object.defineProperty(navigator, 'platform', {
      get: function() { return '${platform}'; },
      configurable: true
    });
    `;
  }

  /**
   * Get WebGL override script
   * @param {Object} webglConfig - WebGL configuration
   * @returns {string} Script
   * @private
   */
  static _getWebGLScript(webglConfig) {
    const { vendor, renderer } = webglConfig;

    return `
    // Override WebGL
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) {
        return '${vendor}';
      }
      if (parameter === 37446) {
        return '${renderer}';
      }
      return getParameter.call(this, parameter);
    };
    
    const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) {
        return '${vendor}';
      }
      if (parameter === 37446) {
        return '${renderer}';
      }
      return getParameter2.call(this, parameter);
    };
    `;
  }

  /**
   * Get WebRTC override script
   * @param {Object} webrtcConfig - WebRTC configuration
   * @returns {string} Script
   * @private
   */
  static _getWebRTCScript(webrtcConfig) {
    if (webrtcConfig.mode === 'disable') {
      return `
      // Disable WebRTC
      if (typeof RTCPeerConnection !== 'undefined') {
        RTCPeerConnection = undefined;
      }
      if (typeof webkitRTCPeerConnection !== 'undefined') {
        webkitRTCPeerConnection = undefined;
      }
      if (typeof mozRTCPeerConnection !== 'undefined') {
        mozRTCPeerConnection = undefined;
      }
      `;
    } else if (webrtcConfig.mode === 'replace') {
      return `
      // Replace WebRTC IPs
      const originalRTCPeerConnection = RTCPeerConnection || webkitRTCPeerConnection || mozRTCPeerConnection;
      if (originalRTCPeerConnection) {
        const newRTCPeerConnection = function(...args) {
          const pc = new originalRTCPeerConnection(...args);
          const originalCreateOffer = pc.createOffer;
          pc.createOffer = function(...args) {
            return originalCreateOffer.apply(this, args).then(offer => {
              offer.sdp = offer.sdp.replace(/([0-9]{1,3}(\\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/g, '0.0.0.0');
              return offer;
            });
          };
          return pc;
        };
        RTCPeerConnection = newRTCPeerConnection;
        if (typeof webkitRTCPeerConnection !== 'undefined') {
          webkitRTCPeerConnection = newRTCPeerConnection;
        }
      }
      `;
    }

    return '';
  }

  /**
   * Get Canvas override script
   * @returns {string} Script
   * @private
   */
  static _getCanvasScript() {
    const noiseSeed = FingerprintGenerator.generateNoiseSeed();

    return `
    // Override Canvas
    const noiseSeed = ${noiseSeed};
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    
    function addCanvasNoise(canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.sin(noiseSeed + i) * 127 + 128) % 2;
        data[i] = data[i] + noise;
        data[i + 1] = data[i + 1] + noise;
        data[i + 2] = data[i + 2] + noise;
      }
      
      ctx.putImageData(imageData, 0, 0);
    }
    
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      addCanvasNoise(this);
      return originalToDataURL.apply(this, args);
    };
    
    HTMLCanvasElement.prototype.toBlob = function(...args) {
      addCanvasNoise(this);
      return originalToBlob.apply(this, args);
    };
    
    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
      const imageData = originalGetImageData.apply(this, args);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.sin(noiseSeed + i) * 127 + 128) % 2;
        data[i] = data[i] + noise;
        data[i + 1] = data[i + 1] + noise;
        data[i + 2] = data[i + 2] + noise;
      }
      
      return imageData;
    };
    `;
  }

  /**
   * Get Audio override script
   * @returns {string} Script
   * @private
   */
  static _getAudioScript() {
    const noiseSeed = FingerprintGenerator.generateNoiseSeed();

    return `
    // Override Audio
    const audioNoiseSeed = ${noiseSeed};
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    
    if (AudioContext) {
      const originalGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function(channel) {
        const data = originalGetChannelData.call(this, channel);
        for (let i = 0; i < data.length; i++) {
          data[i] = data[i] + (Math.sin(audioNoiseSeed + i) * 0.0001);
        }
        return data;
      };
    }
    `;
  }

  /**
   * Get ClientRects override script
   * @returns {string} Script
   * @private
   */
  static _getClientRectsScript() {
    return `
    // Override ClientRects
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
      const rect = originalGetBoundingClientRect.call(this);
      const noise = Math.random() * 0.0001;
      return {
        x: rect.x + noise,
        y: rect.y + noise,
        width: rect.width + noise,
        height: rect.height + noise,
        top: rect.top + noise,
        right: rect.right + noise,
        bottom: rect.bottom + noise,
        left: rect.left + noise
      };
    };
    `;
  }

  /**
   * Get Timezone override script
   * @param {string} timezone - Timezone string
   * @returns {string} Script
   * @private
   */
  static _getTimezoneScript(timezone) {
    return `
    // Override Timezone
    const originalDateTimeFormat = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function(...args) {
      if (args.length === 0 || !args[1] || !args[1].timeZone) {
        args[1] = args[1] || {};
        args[1].timeZone = '${timezone}';
      }
      return new originalDateTimeFormat(...args);
    };
    
    Date.prototype.getTimezoneOffset = function() {
      return 0; // Adjust based on timezone
    };
    `;
  }

  /**
   * Get Geolocation override script
   * @param {Object} geoConfig - Geolocation configuration
   * @returns {string} Script
   * @private
   */
  static _getGeolocationScript(geoConfig) {
    if (geoConfig.mode === 'deny') {
      return `
      // Deny Geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition = function(success, error) {
          if (error) {
            error({ code: 1, message: 'User denied geolocation' });
          }
        };
      }
      `;
    } else if (geoConfig.mode === 'ip-based' && geoConfig.latitude && geoConfig.longitude) {
      return `
      // Override Geolocation
      if (navigator.geolocation) {
        const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
        navigator.geolocation.getCurrentPosition = function(success, error, options) {
          if (success) {
            success({
              coords: {
                latitude: ${geoConfig.latitude},
                longitude: ${geoConfig.longitude},
                accuracy: 100,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
              },
              timestamp: Date.now()
            });
          }
        };
      }
      `;
    }

    return '';
  }

  /**
   * Get Language override script
   * @param {string} language - Language string
   * @returns {string} Script
   * @private
   */
  static _getLanguageScript(language) {
    return `
    // Override Language
    Object.defineProperty(navigator, 'language', {
      get: function() { return '${language.split(',')[0]}'; }
    });
    
    Object.defineProperty(navigator, 'languages', {
      get: function() { return '${language}'.split(',').map(l => l.trim()); }
    });
    `;
  }

  /**
   * Get Resolution override script
   * @param {Object} resolution - Resolution configuration
   * @returns {string} Script
   * @private
   */
  static _getResolutionScript(resolution) {
    return `
    // Override Screen Resolution
    Object.defineProperty(screen, 'width', {
      get: function() { return ${resolution.width}; }
    });
    
    Object.defineProperty(screen, 'height', {
      get: function() { return ${resolution.height}; }
    });
    
    Object.defineProperty(screen, 'availWidth', {
      get: function() { return ${resolution.width}; }
    });
    
    Object.defineProperty(screen, 'availHeight', {
      get: function() { return ${resolution.height - 40}; }
    });
    `;
  }

  /**
   * Get Device Info override script
   * @param {Object} deviceInfo - Device information
   * @returns {string} Script
   * @private
   */
  static _getDeviceInfoScript(deviceInfo) {
    const scripts = [];

    // CPU cores
    if (deviceInfo.cpu && deviceInfo.cpu.mode === 'custom') {
      scripts.push(`
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: function() { return ${deviceInfo.cpu.cores}; }
      });
      `);
    }

    // Memory
    if (deviceInfo.memory && deviceInfo.memory.mode === 'custom') {
      scripts.push(`
      Object.defineProperty(navigator, 'deviceMemory', {
        get: function() { return ${deviceInfo.memory.size}; }
      });
      `);
    }

    return scripts.join('\n');
  }

  /**
   * Get Hardware override script
   * @param {Object} hardware - Hardware configuration
   * @returns {string} Script
   * @private
   */
  static _getHardwareScript(hardware) {
    const scripts = [];

    // Bluetooth
    if (!hardware.bluetooth) {
      scripts.push(`
      if (navigator.bluetooth) {
        navigator.bluetooth = undefined;
      }
      `);
    }

    // Battery
    if (hardware.battery === 'privacy') {
      scripts.push(`
      if (navigator.getBattery) {
        navigator.getBattery = function() {
          return Promise.resolve({
            charging: true,
            chargingTime: 0,
            dischargingTime: Infinity,
            level: 1.0
          });
        };
      }
      `);
    }

    // Port scan protection
    if (hardware.portScanProtection) {
      scripts.push(`
      // Block port scanning
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        const url = args[0];
        if (typeof url === 'string' && url.match(/localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0/)) {
          return Promise.reject(new Error('Blocked'));
        }
        return originalFetch.apply(this, args);
      };
      `);
    }

    return scripts.join('\n');
  }
}

module.exports = FingerprintInjector;
