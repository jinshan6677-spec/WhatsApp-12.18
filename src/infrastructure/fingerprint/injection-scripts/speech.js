/**
 * Speech API Protection Script
 * 语音合成API保护脚本
 * 
 * Implements protection for Speech Synthesis API to prevent fingerprinting.
 * Controls the voice list returned by speechSynthesis.getVoices().
 * 
 * Covered methods:
 * - speechSynthesis.getVoices (Req 18.1)
 * - System mode returns real voice list (Req 18.2)
 * - Minimal mode returns minimal generic voice list (Req 18.3)
 * - Disable mode returns empty list (Req 18.4)
 * 
 * Features:
 * - Four modes: 'custom', 'system', 'minimal', 'disable'
 * - Custom voice list configuration
 * - Minimal generic voice list for privacy
 * - Native function characteristics preserved
 * - Event handling for voiceschanged
 * 
 * @module infrastructure/fingerprint/injection-scripts/speech
 * 
 * **Validates: Requirements 18.1, 18.2, 18.3, 18.4**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');

/**
 * Error class for speech spoofing operations
 */
class SpeechSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SpeechSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * SpeechSpoof class
 * Provides methods to spoof Speech Synthesis API
 */
class SpeechSpoof {
  /**
   * Minimal generic voice list for privacy mode
   * @private
   */
  static _minimalVoices = [
    { name: 'Google US English', lang: 'en-US', localService: false, default: true },
    { name: 'Google UK English Female', lang: 'en-GB', localService: false, default: false }
  ];

  /**
   * Default speech configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'minimal',        // 'custom', 'system', 'minimal', 'disable'
    voices: null            // Custom voice list (used when mode is 'custom')
  };

  /**
   * Store for original method references
   * @private
   */
  static _originalMethods = {};

  /**
   * Store for applied configuration
   * @private
   */
  static _appliedConfig = null;

  /**
   * Store for fake voices array
   * @private
   */
  static _fakeVoices = null;

  /**
   * Apply speech spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='minimal'] - Spoofing mode: 'custom', 'system', 'minimal', or 'disable'
   * @param {Array} [config.voices] - Custom voice list (used when mode is 'custom')
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = { ...SpeechSpoof._defaultConfig, ...config };
    
    // Validate mode
    if (!['custom', 'system', 'minimal', 'disable'].includes(mergedConfig.mode)) {
      throw new SpeechSpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'custom', 'system', 'minimal', or 'disable'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // Validate custom voices if mode is 'custom'
    if (mergedConfig.mode === 'custom') {
      if (!Array.isArray(mergedConfig.voices)) {
        throw new SpeechSpoofError(
          'Custom mode requires a voices array',
          'INVALID_VOICES',
          { voices: mergedConfig.voices }
        );
      }
    }

    // Store the applied configuration
    SpeechSpoof._appliedConfig = mergedConfig;

    // Build fake voices array based on mode
    SpeechSpoof._buildFakeVoices();

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // If mode is 'system', don't spoof anything (Req 18.2)
    if (mergedConfig.mode === 'system') {
      return results;
    }

    // Spoof speechSynthesis.getVoices (Req 18.1)
    try {
      SpeechSpoof._spoofGetVoices();
      results.spoofed.push('getVoices');
    } catch (e) {
      results.failed.push({ method: 'getVoices', error: e.message });
      results.success = false;
    }

    // Spoof voiceschanged event
    try {
      SpeechSpoof._spoofVoicesChangedEvent();
      results.spoofed.push('voiceschanged');
    } catch (e) {
      results.failed.push({ method: 'voiceschanged', error: e.message });
      // Not critical, don't set success to false
    }

    return results;
  }

  /**
   * Build fake voices array based on configuration
   * @private
   */
  static _buildFakeVoices() {
    const config = SpeechSpoof._appliedConfig;

    if (config.mode === 'disable') {
      // Req 18.4: Return empty list
      SpeechSpoof._fakeVoices = [];
    } else if (config.mode === 'minimal') {
      // Req 18.3: Return minimal generic voice list
      SpeechSpoof._fakeVoices = SpeechSpoof._minimalVoices.map(v => 
        SpeechSpoof._createFakeVoice(v)
      );
    } else if (config.mode === 'custom' && config.voices) {
      // Req 18.1: Return configured voice list
      SpeechSpoof._fakeVoices = config.voices.map(v => 
        SpeechSpoof._createFakeVoice(v)
      );
    } else {
      // Default to minimal
      SpeechSpoof._fakeVoices = SpeechSpoof._minimalVoices.map(v => 
        SpeechSpoof._createFakeVoice(v)
      );
    }
  }

  /**
   * Create a fake SpeechSynthesisVoice object
   * @private
   * @param {Object} voiceConfig - Voice configuration
   * @returns {Object} A fake SpeechSynthesisVoice-like object
   */
  static _createFakeVoice(voiceConfig) {
    const voice = {
      voiceURI: voiceConfig.voiceURI || voiceConfig.name || 'Unknown',
      name: voiceConfig.name || 'Unknown Voice',
      lang: voiceConfig.lang || 'en-US',
      localService: voiceConfig.localService !== undefined ? voiceConfig.localService : false,
      default: voiceConfig.default !== undefined ? voiceConfig.default : false
    };

    // Freeze the object to mimic native behavior
    return Object.freeze(voice);
  }

  /**
   * Spoof speechSynthesis.getVoices
   * Requirement 18.1: Return configured voice list
   * Requirement 18.3: Minimal mode returns minimal generic voice list
   * Requirement 18.4: Disable mode returns empty list
   * @private
   */
  static _spoofGetVoices() {
    // Check if speechSynthesis exists (browser environment)
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }

    const synthesis = window.speechSynthesis;
    const originalGetVoices = synthesis.getVoices;

    // Store original method
    if (originalGetVoices) {
      SpeechSpoof._originalMethods.getVoices = originalGetVoices;
    }

    // Create wrapped function
    const wrappedGetVoices = NativeWrapper.wrap(
      originalGetVoices || function() { return []; },
      function(original, args, thisArg) {
        const config = SpeechSpoof._appliedConfig;

        // If mode is 'system', return original result (Req 18.2)
        if (!config || config.mode === 'system') {
          if (original && typeof original === 'function') {
            return original.apply(thisArg, args);
          }
          return [];
        }

        // Return fake voices based on mode
        return SpeechSpoof._fakeVoices.slice(); // Return a copy
      },
      { name: 'getVoices', length: 0 }
    );

    // Replace the method on speechSynthesis
    try {
      Object.defineProperty(synthesis, 'getVoices', {
        value: wrappedGetVoices,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      // If defineProperty fails, try direct assignment
      synthesis.getVoices = wrappedGetVoices;
    }
  }

  /**
   * Spoof voiceschanged event to prevent detection
   * @private
   */
  static _spoofVoicesChangedEvent() {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }

    const synthesis = window.speechSynthesis;
    const config = SpeechSpoof._appliedConfig;

    // If mode is 'system', don't intercept events
    if (config.mode === 'system') {
      return;
    }

    // Store original onvoiceschanged setter
    const originalDescriptor = Object.getOwnPropertyDescriptor(synthesis, 'onvoiceschanged') ||
                               Object.getOwnPropertyDescriptor(Object.getPrototypeOf(synthesis), 'onvoiceschanged');

    if (originalDescriptor) {
      SpeechSpoof._originalMethods.onvoiceschangedDescriptor = originalDescriptor;
    }

    // Override onvoiceschanged to immediately trigger with fake voices
    let storedHandler = null;

    try {
      Object.defineProperty(synthesis, 'onvoiceschanged', {
        get: function() {
          return storedHandler;
        },
        set: function(handler) {
          storedHandler = handler;
          // Immediately call the handler with fake voices available
          if (typeof handler === 'function') {
            // Use setTimeout to mimic async behavior
            setTimeout(() => {
              try {
                handler.call(synthesis, new Event('voiceschanged'));
              } catch (e) {
                // Ignore errors in handler
              }
            }, 0);
          }
        },
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      // If we can't override the property, that's okay
    }
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return SpeechSpoof._appliedConfig ? { ...SpeechSpoof._appliedConfig } : null;
  }

  /**
   * Get the current fake voices array
   * @returns {Array} The fake voices array
   */
  static getFakeVoices() {
    return SpeechSpoof._fakeVoices ? SpeechSpoof._fakeVoices.slice() : [];
  }

  /**
   * Restore original speech methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return results;
    }

    const synthesis = window.speechSynthesis;

    // Restore getVoices
    if (SpeechSpoof._originalMethods.getVoices) {
      try {
        synthesis.getVoices = SpeechSpoof._originalMethods.getVoices;
        results.restored.push('getVoices');
      } catch (e) {
        results.failed.push({ method: 'getVoices', error: e.message });
      }
    }

    // Restore onvoiceschanged
    if (SpeechSpoof._originalMethods.onvoiceschangedDescriptor) {
      try {
        Object.defineProperty(synthesis, 'onvoiceschanged', 
          SpeechSpoof._originalMethods.onvoiceschangedDescriptor);
        results.restored.push('onvoiceschanged');
      } catch (e) {
        results.failed.push({ method: 'onvoiceschanged', error: e.message });
      }
    }

    // Clear stored data
    SpeechSpoof._originalMethods = {};
    SpeechSpoof._appliedConfig = null;
    SpeechSpoof._fakeVoices = null;

    return results;
  }


  /**
   * Generate injection script string for browser context
   * This creates a self-contained script that can be injected into a page
   * 
   * @param {Object} config - Speech configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...SpeechSpoof._defaultConfig, ...config };

    // Determine voices to use
    let voicesJson;
    if (mergedConfig.mode === 'disable') {
      voicesJson = '[]';
    } else if (mergedConfig.mode === 'minimal') {
      voicesJson = JSON.stringify(SpeechSpoof._minimalVoices);
    } else if (mergedConfig.mode === 'custom' && mergedConfig.voices) {
      voicesJson = JSON.stringify(mergedConfig.voices);
    } else {
      voicesJson = JSON.stringify(SpeechSpoof._minimalVoices);
    }

    return `
(function() {
  'use strict';
  
  // Speech spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)},
    voices: ${voicesJson}
  };
  
  // Skip if mode is 'system' (Req 18.2)
  if (config.mode === 'system') {
    return;
  }
  
  // Check if speechSynthesis exists
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return;
  }
  
  const synthesis = window.speechSynthesis;
  
  // Create fake voice objects
  function createFakeVoice(voiceConfig) {
    return Object.freeze({
      voiceURI: voiceConfig.voiceURI || voiceConfig.name || 'Unknown',
      name: voiceConfig.name || 'Unknown Voice',
      lang: voiceConfig.lang || 'en-US',
      localService: voiceConfig.localService !== undefined ? voiceConfig.localService : false,
      default: voiceConfig.default !== undefined ? voiceConfig.default : false
    });
  }
  
  // Build fake voices array
  const fakeVoices = config.voices.map(createFakeVoice);
  
  // Store original getVoices
  const originalGetVoices = synthesis.getVoices;
  
  // Create spoofed getVoices function (Req 18.1, 18.3, 18.4)
  function spoofedGetVoices() {
    return fakeVoices.slice(); // Return a copy
  }
  
  // Make the function appear native
  Object.defineProperty(spoofedGetVoices, 'name', {
    value: 'getVoices',
    writable: false,
    enumerable: false,
    configurable: true
  });
  Object.defineProperty(spoofedGetVoices, 'length', {
    value: 0,
    writable: false,
    enumerable: false,
    configurable: true
  });
  const nativeGetVoicesStr = 'function getVoices() { [native code] }';
  spoofedGetVoices.toString = function() { return nativeGetVoicesStr; };
  
  // Replace the method on speechSynthesis
  try {
    Object.defineProperty(synthesis, 'getVoices', {
      value: spoofedGetVoices,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } catch (e) {
    synthesis.getVoices = spoofedGetVoices;
  }
  
  // Handle onvoiceschanged event
  let storedHandler = null;
  
  try {
    Object.defineProperty(synthesis, 'onvoiceschanged', {
      get: function() {
        return storedHandler;
      },
      set: function(handler) {
        storedHandler = handler;
        // Immediately call the handler with fake voices available
        if (typeof handler === 'function') {
          setTimeout(function() {
            try {
              handler.call(synthesis, new Event('voiceschanged'));
            } catch (e) {
              // Ignore errors in handler
            }
          }, 0);
        }
      },
      enumerable: true,
      configurable: true
    });
  } catch (e) {
    // If we can't override the property, that's okay
  }
  
  // Also intercept addEventListener for voiceschanged
  const originalAddEventListener = synthesis.addEventListener;
  if (originalAddEventListener) {
    synthesis.addEventListener = function(type, listener, options) {
      if (type === 'voiceschanged' && typeof listener === 'function') {
        // Immediately call the listener
        setTimeout(function() {
          try {
            listener.call(synthesis, new Event('voiceschanged'));
          } catch (e) {
            // Ignore errors
          }
        }, 0);
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
    
    // Make addEventListener appear native
    Object.defineProperty(synthesis.addEventListener, 'name', {
      value: 'addEventListener',
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeAddEventStr = 'function addEventListener() { [native code] }';
    synthesis.addEventListener.toString = function() { return nativeAddEventStr; };
  }
})();
`;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Speech configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...SpeechSpoof._defaultConfig };
    }

    const speechConfig = fingerprintConfig.speech || {};
    
    return {
      mode: speechConfig.mode || SpeechSpoof._defaultConfig.mode,
      voices: speechConfig.voices || null
    };
  }

  /**
   * Verify that speech spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Object} Verification result
   */
  static verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = SpeechSpoof.getAppliedConfig();
    result.checks.configApplied = {
      expected: true,
      actual: appliedConfig !== null,
      pass: appliedConfig !== null
    };

    if (!appliedConfig) {
      result.valid = false;
      return result;
    }

    // Check mode
    if (expectedConfig.mode !== undefined) {
      result.checks.mode = {
        expected: expectedConfig.mode,
        actual: appliedConfig.mode,
        pass: appliedConfig.mode === expectedConfig.mode
      };
      if (!result.checks.mode.pass) result.valid = false;
    }

    // If in browser environment, verify actual getVoices behavior
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        const voices = window.speechSynthesis.getVoices();
        
        if (appliedConfig.mode === 'disable') {
          // Should return empty array (Req 18.4)
          result.checks.disableMode = {
            expected: 0,
            actual: voices.length,
            pass: voices.length === 0
          };
          if (!result.checks.disableMode.pass) result.valid = false;
        } else if (appliedConfig.mode === 'minimal') {
          // Should return minimal voice list (Req 18.3)
          result.checks.minimalMode = {
            expected: SpeechSpoof._minimalVoices.length,
            actual: voices.length,
            pass: voices.length === SpeechSpoof._minimalVoices.length
          };
          if (!result.checks.minimalMode.pass) result.valid = false;
        } else if (appliedConfig.mode === 'custom' && expectedConfig.voices) {
          // Should return custom voice list (Req 18.1)
          result.checks.customMode = {
            expected: expectedConfig.voices.length,
            actual: voices.length,
            pass: voices.length === expectedConfig.voices.length
          };
          if (!result.checks.customMode.pass) result.valid = false;
        }
        
        // Verify voice properties are frozen
        if (voices.length > 0) {
          const firstVoice = voices[0];
          const isFrozen = Object.isFrozen(firstVoice);
          result.checks.voiceFrozen = {
            expected: true,
            actual: isFrozen,
            pass: isFrozen
          };
          if (!result.checks.voiceFrozen.pass) result.valid = false;
        }
      } catch (e) {
        result.checks.getVoices = {
          expected: 'success',
          actual: e.message,
          pass: false
        };
        result.valid = false;
      }
    }

    return result;
  }

  /**
   * Get the minimal voices list
   * @returns {Array} The minimal voices array
   */
  static getMinimalVoices() {
    return SpeechSpoof._minimalVoices.slice();
  }
}

module.exports = {
  SpeechSpoof,
  SpeechSpoofError
};
