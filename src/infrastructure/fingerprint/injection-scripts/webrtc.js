/**
 * WebRTC Protection Script
 * WebRTC保护脚本
 * 
 * Implements WebRTC IP leak protection with multiple modes:
 * - disable: Completely disable RTCPeerConnection (Req 13.1)
 * - replace: Modify SDP to replace local IPs (Req 13.2)
 * - real: Allow normal WebRTC operation (Req 13.3)
 * 
 * Additional features:
 * - ICE candidate filtering (Req 13.4)
 * - Per-origin whitelist support (Req 13.6)
 * - Delayed enable and fallback mechanism (Req 13.8)
 * 
 * @module infrastructure/fingerprint/injection-scripts/webrtc
 * 
 * **Validates: Requirements 13.1-13.8**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');
const { PrototypeGuard } = require('./core/prototype-guard');

/**
 * Error class for WebRTC protection operations
 */
class WebRTCProtectionError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'WebRTCProtectionError';
    this.code = code;
    this.details = details;
  }
}

/**
 * WebRTC Protection modes
 */
const WebRTCMode = {
  DISABLE: 'disable',   // Completely disable WebRTC (Req 13.1)
  REPLACE: 'replace',   // Replace IPs in SDP (Req 13.2)
  REAL: 'real'          // Allow normal operation (Req 13.3)
};


/**
 * WebRTCProtection class
 * Provides methods to protect WebRTC from IP leaks
 */
class WebRTCProtection {
  /**
   * Default WebRTC configuration
   * @private
   */
  static _defaultConfig = {
    mode: WebRTCMode.REPLACE,
    publicIP: 'auto',           // 'auto' means use proxy IP or configured value
    localIP: '192.168.1.100',   // Replacement local IP
    whitelist: [],              // Per-origin whitelist (Req 13.6)
    enableFallback: true,       // Enable fallback mechanism (Req 13.8)
    fallbackTimeout: 5000,      // Timeout before fallback in ms
    // Hardened options
    dropNonRelay: false,        // When true, drop ICE candidates that are not relay
    forceRelay: false           // When true, enforce relay-only transport policy
  };

  /**
   * Store for original RTCPeerConnection
   * @private
   */
  static _originalRTCPeerConnection = null;

  /**
   * Store for original RTCSessionDescription
   * @private
   */
  static _originalRTCSessionDescription = null;

  /**
   * Store for applied configuration
   * @private
   */
  static _appliedConfig = null;

  /**
   * Store for delayed enable state per origin
   * @private
   */
  static _delayedEnableState = new Map();

  /**
   * Regular expressions for IP detection
   * @private
   */
  static _ipPatterns = {
    // IPv4 pattern
    ipv4: /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g,
    // IPv4 in SDP candidate line
    sdpCandidate: /candidate:(\S+) (\d+) (udp|tcp) (\d+) (\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}) (\d+)/gi,
    // IPv6 pattern (simplified)
    ipv6: /([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}/g,
    // Private IP ranges
    privateIPv4: /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/
  };


  /**
   * Apply WebRTC protection with the given configuration
   * 
   * @param {Object} windowObj - The window object to apply protection to
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='replace'] - Protection mode: 'disable', 'replace', or 'real'
   * @param {string} [config.publicIP='auto'] - Public IP to use in SDP
   * @param {string} [config.localIP='192.168.1.100'] - Local IP replacement
   * @param {string[]} [config.whitelist=[]] - Origins allowed to use real WebRTC
   * @param {boolean} [config.enableFallback=true] - Enable fallback mechanism
   * @returns {Object} Result object with success status and details
   */
  static apply(windowObj, config = {}) {
    if (!windowObj || typeof windowObj !== 'object') {
      throw new WebRTCProtectionError(
        'windowObj must be an object',
        'INVALID_WINDOW',
        { type: typeof windowObj }
      );
    }

    // Merge with defaults
    const mergedConfig = { ...WebRTCProtection._defaultConfig, ...config };
    WebRTCProtection._appliedConfig = mergedConfig;

    const results = {
      success: true,
      mode: mergedConfig.mode,
      protected: [],
      failed: []
    };

    // Store original constructors
    if (windowObj.RTCPeerConnection) {
      WebRTCProtection._originalRTCPeerConnection = windowObj.RTCPeerConnection;
    }
    if (windowObj.RTCSessionDescription) {
      WebRTCProtection._originalRTCSessionDescription = windowObj.RTCSessionDescription;
    }

    // Apply protection based on mode
    switch (mergedConfig.mode) {
      case WebRTCMode.DISABLE:
        results.protected = WebRTCProtection._applyDisableMode(windowObj);
        break;
      case WebRTCMode.REPLACE:
        results.protected = WebRTCProtection._applyReplaceMode(windowObj, mergedConfig);
        break;
      case WebRTCMode.REAL:
        // No protection needed, but still track
        results.protected.push('real_mode_active');
        break;
      default:
        results.failed.push({ error: `Unknown mode: ${mergedConfig.mode}` });
        results.success = false;
    }

    return results;
  }


  /**
   * Apply disable mode - completely disable RTCPeerConnection (Req 13.1)
   * @private
   */
  static _applyDisableMode(windowObj) {
    const protectedItems = [];

    // Create a disabled RTCPeerConnection that throws errors
    const DisabledRTCPeerConnection = function() {
      throw new DOMException(
        'RTCPeerConnection is disabled',
        'NotSupportedError'
      );
    };

    // Make it look native
    Object.defineProperty(DisabledRTCPeerConnection, 'name', {
      value: 'RTCPeerConnection',
      writable: false,
      enumerable: false,
      configurable: true
    });

    const nativeToString = 'function RTCPeerConnection() { [native code] }';
    DisabledRTCPeerConnection.toString = function() { return nativeToString; };

    // Replace RTCPeerConnection
    if (windowObj.RTCPeerConnection) {
      windowObj.RTCPeerConnection = DisabledRTCPeerConnection;
      protectedItems.push('RTCPeerConnection');
    }

    // Also disable webkitRTCPeerConnection for older browsers
    if (windowObj.webkitRTCPeerConnection) {
      windowObj.webkitRTCPeerConnection = DisabledRTCPeerConnection;
      protectedItems.push('webkitRTCPeerConnection');
    }

    // Disable mozRTCPeerConnection for Firefox
    if (windowObj.mozRTCPeerConnection) {
      windowObj.mozRTCPeerConnection = DisabledRTCPeerConnection;
      protectedItems.push('mozRTCPeerConnection');
    }

    return protectedItems;
  }


  /**
   * Apply replace mode - modify SDP to replace IPs (Req 13.2)
   * @private
   */
  static _applyReplaceMode(windowObj, config) {
    const protectedItems = [];
    const OriginalRTCPeerConnection = WebRTCProtection._originalRTCPeerConnection;

    if (!OriginalRTCPeerConnection) {
      return protectedItems;
    }

    // Create wrapped RTCPeerConnection
    const WrappedRTCPeerConnection = function(configuration, constraints) {
      // Check whitelist (Req 13.6)
      const currentOrigin = windowObj.location?.origin || '';
      if (WebRTCProtection._isWhitelisted(currentOrigin, config.whitelist)) {
        return new OriginalRTCPeerConnection(configuration, constraints);
      }

      // Enforce relay-only transport if configured
      if (config.forceRelay) {
        try {
          const conf = configuration || {};
          // Preserve provided configuration while enforcing policy
          conf.iceTransportPolicy = 'relay';
          configuration = conf;
        } catch (e) {
          // Ignore configuration enforcement errors
        }
      }

      // Create the original peer connection
      const pc = new OriginalRTCPeerConnection(configuration, constraints);

      // Wrap setLocalDescription to filter SDP
      const originalSetLocalDescription = pc.setLocalDescription.bind(pc);
      pc.setLocalDescription = function(description) {
        if (description && description.sdp) {
          description = new RTCSessionDescription({
            type: description.type,
            sdp: WebRTCProtection._filterSDP(description.sdp, config)
          });
        }
        return originalSetLocalDescription(description);
      };

      // Wrap setRemoteDescription
      const originalSetRemoteDescription = pc.setRemoteDescription.bind(pc);
      pc.setRemoteDescription = function(description) {
        // Don't filter remote SDP, just pass through
        return originalSetRemoteDescription(description);
      };

      // Wrap createOffer to filter SDP in result
      const originalCreateOffer = pc.createOffer.bind(pc);
      pc.createOffer = function(options) {
        return originalCreateOffer(options).then(offer => {
          return new RTCSessionDescription({
            type: offer.type,
            sdp: WebRTCProtection._filterSDP(offer.sdp, config)
          });
        });
      };

      // Wrap createAnswer to filter SDP in result
      const originalCreateAnswer = pc.createAnswer.bind(pc);
      pc.createAnswer = function(options) {
        return originalCreateAnswer(options).then(answer => {
          return new RTCSessionDescription({
            type: answer.type,
            sdp: WebRTCProtection._filterSDP(answer.sdp, config)
          });
        });
      };


      // Intercept ICE candidates (Req 13.4)
      const originalAddEventListener = pc.addEventListener.bind(pc);
      pc.addEventListener = function(type, listener, options) {
        if (type === 'icecandidate') {
          const wrappedListener = function(event) {
            if (event.candidate) {
              const filteredCandidate = WebRTCProtection._filterICECandidate(
                event.candidate,
                config
              );
              if (filteredCandidate === null) {
                // Skip this candidate entirely
                return;
              }
              // Create a new event with filtered candidate
              const newEvent = {
                ...event,
                candidate: filteredCandidate
              };
              listener.call(this, newEvent);
            } else {
              listener.call(this, event);
            }
          };
          return originalAddEventListener(type, wrappedListener, options);
        }
        return originalAddEventListener(type, listener, options);
      };

      // Also handle onicecandidate property
      let _onicecandidateHandler = null;
      Object.defineProperty(pc, 'onicecandidate', {
        get: function() {
          return _onicecandidateHandler;
        },
        set: function(handler) {
          if (typeof handler === 'function') {
            _onicecandidateHandler = function(event) {
              if (event.candidate) {
                const filteredCandidate = WebRTCProtection._filterICECandidate(
                  event.candidate,
                  config
                );
                if (filteredCandidate === null) {
                  return;
                }
                const newEvent = { ...event, candidate: filteredCandidate };
                handler.call(this, newEvent);
              } else {
                handler.call(this, event);
              }
            };
          } else {
            _onicecandidateHandler = handler;
          }
        },
        enumerable: true,
        configurable: true
      });

      return pc;
    };


    // Copy static properties and prototype
    WrappedRTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
    
    // Copy static methods
    for (const key of Object.getOwnPropertyNames(OriginalRTCPeerConnection)) {
      if (key !== 'prototype' && key !== 'length' && key !== 'name') {
        try {
          WrappedRTCPeerConnection[key] = OriginalRTCPeerConnection[key];
        } catch (e) {
          // Some properties may not be writable
        }
      }
    }

    // Make it look native
    Object.defineProperty(WrappedRTCPeerConnection, 'name', {
      value: 'RTCPeerConnection',
      writable: false,
      enumerable: false,
      configurable: true
    });

    const nativeToString = 'function RTCPeerConnection() { [native code] }';
    WrappedRTCPeerConnection.toString = function() { return nativeToString; };

    // Replace RTCPeerConnection
    windowObj.RTCPeerConnection = WrappedRTCPeerConnection;
    protectedItems.push('RTCPeerConnection');

    // Also wrap webkit/moz variants if they exist
    if (windowObj.webkitRTCPeerConnection) {
      windowObj.webkitRTCPeerConnection = WrappedRTCPeerConnection;
      protectedItems.push('webkitRTCPeerConnection');
    }

    return protectedItems;
  }


  /**
   * Filter SDP to replace IP addresses (Req 13.2)
   * @private
   */
  static _filterSDP(sdp, config) {
    if (!sdp || typeof sdp !== 'string') {
      return sdp;
    }

    let filteredSDP = sdp;

    // Replace private IPv4 addresses with configured local IP
    filteredSDP = filteredSDP.replace(
      WebRTCProtection._ipPatterns.sdpCandidate,
      (match, foundation, componentId, protocol, priority, ip, port) => {
        // Check if this is a private IP
        if (WebRTCProtection._ipPatterns.privateIPv4.test(ip)) {
          return `candidate:${foundation} ${componentId} ${protocol} ${priority} ${config.localIP} ${port}`;
        }
        // For public IPs, optionally replace with configured public IP
        if (config.publicIP && config.publicIP !== 'auto') {
          return `candidate:${foundation} ${componentId} ${protocol} ${priority} ${config.publicIP} ${port}`;
        }
        return match;
      }
    );

    // Also filter c= lines (connection info)
    filteredSDP = filteredSDP.replace(
      /c=IN IP4 (\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g,
      (match, ip) => {
        if (WebRTCProtection._ipPatterns.privateIPv4.test(ip)) {
          return `c=IN IP4 ${config.localIP}`;
        }
        if (config.publicIP && config.publicIP !== 'auto') {
          return `c=IN IP4 ${config.publicIP}`;
        }
        return match;
      }
    );

    // Filter a=candidate lines
    filteredSDP = filteredSDP.replace(
      /a=candidate:(\S+) (\d+) (\S+) (\d+) (\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}) (\d+)/g,
      (match, foundation, componentId, protocol, priority, ip, port) => {
        if (WebRTCProtection._ipPatterns.privateIPv4.test(ip)) {
          return `a=candidate:${foundation} ${componentId} ${protocol} ${priority} ${config.localIP} ${port}`;
        }
        if (config.publicIP && config.publicIP !== 'auto') {
          return `a=candidate:${foundation} ${componentId} ${protocol} ${priority} ${config.publicIP} ${port}`;
        }
        return match;
      }
    );

    return filteredSDP;
  }


  /**
   * Filter ICE candidate to remove/replace IP addresses (Req 13.4)
   * @private
   */
  static _filterICECandidate(candidate, config) {
    if (!candidate || !candidate.candidate) {
      return candidate;
    }

    const candidateStr = candidate.candidate;
    
    // Determine candidate type (host, srflx, relay)
    const typeMatch = candidateStr.match(/ typ\s+(host|srflx|relay)\b/i);
    const candType = typeMatch ? typeMatch[1].toLowerCase() : null;

    // Drop non-relay candidates when requested
    if (config.dropNonRelay && candType && candType !== 'relay') {
      return null;
    }

    // Parse the candidate string to extract IP
    const match = candidateStr.match(/candidate:\S+ \d+ \S+ \d+ (\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}) \d+/);
    
    if (match) {
      const ip = match[1];
      
      // If it's a private IP, replace it
      if (WebRTCProtection._ipPatterns.privateIPv4.test(ip)) {
        const newCandidateStr = candidateStr.replace(ip, config.localIP);
        
        // Create a new RTCIceCandidate-like object
        return {
          candidate: newCandidateStr,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment,
          // Preserve other properties
          component: candidate.component,
          foundation: candidate.foundation,
          port: candidate.port,
          priority: candidate.priority,
          protocol: candidate.protocol,
          type: candidate.type,
          address: config.localIP,
          relatedAddress: candidate.relatedAddress,
          relatedPort: candidate.relatedPort,
          tcpType: candidate.tcpType
        };
      }
      
      // For public IPs, optionally replace
      if (config.publicIP && config.publicIP !== 'auto') {
        const newCandidateStr = candidateStr.replace(ip, config.publicIP);
        return {
          candidate: newCandidateStr,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment,
          component: candidate.component,
          foundation: candidate.foundation,
          port: candidate.port,
          priority: candidate.priority,
          protocol: candidate.protocol,
          type: candidate.type,
          address: config.publicIP,
          relatedAddress: candidate.relatedAddress,
          relatedPort: candidate.relatedPort,
          tcpType: candidate.tcpType
        };
      }
    }

    return candidate;
  }


  /**
   * Check if an origin is whitelisted (Req 13.6)
   * @private
   */
  static _isWhitelisted(origin, whitelist) {
    if (!whitelist || !Array.isArray(whitelist) || whitelist.length === 0) {
      return false;
    }

    return whitelist.some(pattern => {
      // Exact match
      if (pattern === origin) {
        return true;
      }
      
      // Wildcard match (e.g., *.google.com)
      if (pattern.startsWith('*.')) {
        const domain = pattern.slice(2);
        return origin.endsWith(domain) || origin.endsWith('.' + domain);
      }
      
      // Domain match (e.g., google.com matches https://google.com)
      try {
        const url = new URL(origin);
        return url.hostname === pattern || url.hostname.endsWith('.' + pattern);
      } catch (e) {
        return false;
      }
    });
  }

  /**
   * Enable WebRTC for a specific origin temporarily (Req 13.8)
   * Used for delayed enable/fallback mechanism
   * 
   * @param {string} origin - The origin to enable WebRTC for
   * @param {number} [duration] - Duration in ms (default: fallbackTimeout from config)
   */
  static enableForOrigin(origin, duration) {
    const config = WebRTCProtection._appliedConfig || WebRTCProtection._defaultConfig;
    const timeout = duration || config.fallbackTimeout;

    // Add to temporary whitelist
    WebRTCProtection._delayedEnableState.set(origin, {
      enabledAt: Date.now(),
      expiresAt: Date.now() + timeout
    });

    // Set timeout to remove from whitelist
    setTimeout(() => {
      WebRTCProtection._delayedEnableState.delete(origin);
    }, timeout);
  }

  /**
   * Check if WebRTC is temporarily enabled for an origin
   * @param {string} origin - The origin to check
   * @returns {boolean} True if temporarily enabled
   */
  static isTemporarilyEnabled(origin) {
    const state = WebRTCProtection._delayedEnableState.get(origin);
    if (!state) {
      return false;
    }
    
    if (Date.now() > state.expiresAt) {
      WebRTCProtection._delayedEnableState.delete(origin);
      return false;
    }
    
    return true;
  }


  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return WebRTCProtection._appliedConfig ? { ...WebRTCProtection._appliedConfig } : null;
  }

  /**
   * Restore original WebRTC functionality
   * @param {Object} windowObj - The window object to restore
   * @returns {Object} Result object with restored items
   */
  static restore(windowObj) {
    const results = {
      restored: [],
      failed: []
    };

    if (WebRTCProtection._originalRTCPeerConnection) {
      try {
        windowObj.RTCPeerConnection = WebRTCProtection._originalRTCPeerConnection;
        results.restored.push('RTCPeerConnection');
      } catch (e) {
        results.failed.push({ item: 'RTCPeerConnection', error: e.message });
      }
    }

    // Clear state
    WebRTCProtection._appliedConfig = null;
    WebRTCProtection._delayedEnableState.clear();

    return results;
  }

  /**
   * Verify that WebRTC protection is correctly applied
   * @param {Object} windowObj - The window object to verify
   * @param {Object} expectedConfig - Expected configuration
   * @returns {Object} Verification result
   */
  static verify(windowObj, expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check mode
    const appliedConfig = WebRTCProtection._appliedConfig;
    result.checks.mode = {
      expected: expectedConfig.mode,
      actual: appliedConfig?.mode,
      pass: appliedConfig?.mode === expectedConfig.mode
    };

    // Check if RTCPeerConnection is properly wrapped/disabled
    if (expectedConfig.mode === WebRTCMode.DISABLE) {
      let isDisabled = false;
      try {
        new windowObj.RTCPeerConnection();
      } catch (e) {
        isDisabled = e.name === 'NotSupportedError';
      }
      result.checks.disabled = {
        expected: true,
        actual: isDisabled,
        pass: isDisabled
      };
    }

    result.valid = Object.values(result.checks).every(check => check.pass);
    return result;
  }


  /**
   * Generate injection script string for browser context
   * Creates a self-contained script that can be injected into a page
   * 
   * @param {Object} config - WebRTC configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...WebRTCProtection._defaultConfig, ...config };
    
    return `
(function() {
  'use strict';
  
  // WebRTC protection configuration
  const config = ${JSON.stringify(mergedConfig)};
  
  // IP patterns
  const ipPatterns = {
    privateIPv4: /^(10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|192\\.168\\.|127\\.)/,
    sdpCandidate: /candidate:(\\S+) (\\d+) (udp|tcp) (\\d+) (\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}) (\\d+)/gi
  };
  
  // Check whitelist
  function isWhitelisted(origin) {
    if (!config.whitelist || config.whitelist.length === 0) return false;
    return config.whitelist.some(pattern => {
      if (pattern === origin) return true;
      if (pattern.startsWith('*.')) {
        const domain = pattern.slice(2);
        return origin.endsWith(domain) || origin.endsWith('.' + domain);
      }
      try {
        const url = new URL(origin);
        return url.hostname === pattern || url.hostname.endsWith('.' + pattern);
      } catch (e) {
        return false;
      }
    });
  }
  
  // Filter SDP
  function filterSDP(sdp) {
    if (!sdp) return sdp;
    let filtered = sdp;
    
    // Replace private IPs in candidate lines
    filtered = filtered.replace(
      /candidate:(\\S+) (\\d+) (\\S+) (\\d+) (\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}) (\\d+)/g,
      function(match, f, c, p, pr, ip, port) {
        if (ipPatterns.privateIPv4.test(ip)) {
          return 'candidate:' + f + ' ' + c + ' ' + p + ' ' + pr + ' ' + config.localIP + ' ' + port;
        }
        if (config.publicIP && config.publicIP !== 'auto') {
          return 'candidate:' + f + ' ' + c + ' ' + p + ' ' + pr + ' ' + config.publicIP + ' ' + port;
        }
        return match;
      }
    );
    
    // Replace IPs in c= lines
    filtered = filtered.replace(
      /c=IN IP4 (\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})/g,
      function(match, ip) {
        if (ipPatterns.privateIPv4.test(ip)) {
          return 'c=IN IP4 ' + config.localIP;
        }
        if (config.publicIP && config.publicIP !== 'auto') {
          return 'c=IN IP4 ' + config.publicIP;
        }
        return match;
      }
    );
    
    return filtered;
  }

  
  // Filter ICE candidate
  function filterICECandidate(candidate) {
    if (!candidate || !candidate.candidate) return candidate;
    const match = candidate.candidate.match(/candidate:\\S+ \\d+ \\S+ \\d+ (\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}) \\d+/);
    if (match) {
      const ip = match[1];
      let newIP = ip;
      if (ipPatterns.privateIPv4.test(ip)) {
        newIP = config.localIP;
      } else if (config.publicIP && config.publicIP !== 'auto') {
        newIP = config.publicIP;
      }
      if (newIP !== ip) {
        return {
          candidate: candidate.candidate.replace(ip, newIP),
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment
        };
      }
    }
    return candidate;
  }
  
  // Store original
  const OriginalRTCPeerConnection = window.RTCPeerConnection;
  
  if (config.mode === 'disable') {
    // Disable mode
    const DisabledRTC = function() {
      throw new DOMException('RTCPeerConnection is disabled', 'NotSupportedError');
    };
    Object.defineProperty(DisabledRTC, 'name', { value: 'RTCPeerConnection' });
    DisabledRTC.toString = function() { return 'function RTCPeerConnection() { [native code] }'; };
    window.RTCPeerConnection = DisabledRTC;
    if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = DisabledRTC;
  } else if (config.mode === 'replace' && OriginalRTCPeerConnection) {
    // Replace mode
    const WrappedRTC = function(configuration, constraints) {
      if (isWhitelisted(window.location.origin)) {
        return new OriginalRTCPeerConnection(configuration, constraints);
      }
      
      const pc = new OriginalRTCPeerConnection(configuration, constraints);
      
      // Wrap setLocalDescription
      const origSetLocal = pc.setLocalDescription.bind(pc);
      pc.setLocalDescription = function(desc) {
        if (desc && desc.sdp) {
          desc = new RTCSessionDescription({ type: desc.type, sdp: filterSDP(desc.sdp) });
        }
        return origSetLocal(desc);
      };
      
      // Wrap createOffer
      const origOffer = pc.createOffer.bind(pc);
      pc.createOffer = function(opts) {
        return origOffer(opts).then(function(offer) {
          return new RTCSessionDescription({ type: offer.type, sdp: filterSDP(offer.sdp) });
        });
      };
      
      // Wrap createAnswer
      const origAnswer = pc.createAnswer.bind(pc);
      pc.createAnswer = function(opts) {
        return origAnswer(opts).then(function(answer) {
          return new RTCSessionDescription({ type: answer.type, sdp: filterSDP(answer.sdp) });
        });
      };

      
      // Intercept ICE candidates
      const origAddListener = pc.addEventListener.bind(pc);
      pc.addEventListener = function(type, listener, options) {
        if (type === 'icecandidate') {
          const wrapped = function(event) {
            if (event.candidate) {
              const filtered = filterICECandidate(event.candidate);
              if (filtered === null) return;
              listener.call(this, { ...event, candidate: filtered });
            } else {
              listener.call(this, event);
            }
          };
          return origAddListener(type, wrapped, options);
        }
        return origAddListener(type, listener, options);
      };
      
      // Handle onicecandidate
      let _handler = null;
      Object.defineProperty(pc, 'onicecandidate', {
        get: function() { return _handler; },
        set: function(h) {
          if (typeof h === 'function') {
            _handler = function(event) {
              if (event.candidate) {
                const filtered = filterICECandidate(event.candidate);
                if (filtered === null) return;
                h.call(this, { ...event, candidate: filtered });
              } else {
                h.call(this, event);
              }
            };
          } else {
            _handler = h;
          }
        }
      });
      
      return pc;
    };
    
    WrappedRTC.prototype = OriginalRTCPeerConnection.prototype;
    Object.defineProperty(WrappedRTC, 'name', { value: 'RTCPeerConnection' });
    WrappedRTC.toString = function() { return 'function RTCPeerConnection() { [native code] }'; };
    window.RTCPeerConnection = WrappedRTC;
    if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = WrappedRTC;
  }
  // 'real' mode: no changes needed
})();
`;
  }


  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} WebRTC configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...WebRTCProtection._defaultConfig };
    }

    const webrtcConfig = fingerprintConfig.webrtc || {};

    return {
      mode: webrtcConfig.mode || WebRTCProtection._defaultConfig.mode,
      publicIP: webrtcConfig.publicIP || WebRTCProtection._defaultConfig.publicIP,
      localIP: webrtcConfig.localIP || WebRTCProtection._defaultConfig.localIP,
      whitelist: webrtcConfig.whitelist || WebRTCProtection._defaultConfig.whitelist,
      enableFallback: webrtcConfig.enableFallback !== undefined 
        ? webrtcConfig.enableFallback 
        : WebRTCProtection._defaultConfig.enableFallback,
      fallbackTimeout: webrtcConfig.fallbackTimeout || WebRTCProtection._defaultConfig.fallbackTimeout
    };
  }

  /**
   * Get protection status information
   * Useful for UI display (Req 13.7)
   * 
   * @returns {Object} Status information
   */
  static getStatus() {
    const config = WebRTCProtection._appliedConfig;
    
    return {
      isProtected: config !== null,
      mode: config?.mode || null,
      modeDescription: WebRTCProtection._getModeDescription(config?.mode),
      whitelistCount: config?.whitelist?.length || 0,
      temporarilyEnabledOrigins: Array.from(WebRTCProtection._delayedEnableState.keys())
    };
  }

  /**
   * Get human-readable mode description
   * @private
   */
  static _getModeDescription(mode) {
    switch (mode) {
      case WebRTCMode.DISABLE:
        return 'WebRTC is completely disabled. Video calls will not work.';
      case WebRTCMode.REPLACE:
        return 'WebRTC IP addresses are being replaced to protect your privacy.';
      case WebRTCMode.REAL:
        return 'WebRTC is operating normally without protection.';
      default:
        return 'WebRTC protection status unknown.';
    }
  }
}

module.exports = {
  WebRTCProtection,
  WebRTCProtectionError,
  WebRTCMode
};
