/**
 * Keyboard API Protection Script
 * 键盘API保护脚本
 * 
 * Implements protection for Keyboard API to prevent fingerprinting.
 * Controls keyboard layout information returned by navigator.keyboard.getLayoutMap().
 * 
 * Covered methods:
 * - navigator.keyboard.getLayoutMap (Req 36.1)
 * - Standard US keyboard layout (Req 36.2)
 * - Real keyboard layout (Req 36.3)
 * - Disable mode (Req 36.4)
 * 
 * Features:
 * - Standard US keyboard layout for privacy
 * - Real mode returns actual keyboard layout
 * - Disable mode makes keyboard API unavailable
 * - Native function characteristics preserved
 * 
 * @module infrastructure/fingerprint/injection-scripts/keyboard
 * 
 * **Validates: Requirements 36.1, 36.2, 36.3, 36.4**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');

/**
 * Error class for keyboard spoofing operations
 */
class KeyboardSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'KeyboardSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * KeyboardSpoof class
 * Provides methods to spoof Keyboard API
 */
class KeyboardSpoof {
  /**
   * Standard US keyboard layout map
   * @private
   */
  static _standardUSLayout = new Map([
    ['KeyA', 'a'], ['KeyB', 'b'], ['KeyC', 'c'], ['KeyD', 'd'], ['KeyE', 'e'],
    ['KeyF', 'f'], ['KeyG', 'g'], ['KeyH', 'h'], ['KeyI', 'i'], ['KeyJ', 'j'],
    ['KeyK', 'k'], ['KeyL', 'l'], ['KeyM', 'm'], ['KeyN', 'n'], ['KeyO', 'o'],
    ['KeyP', 'p'], ['KeyQ', 'q'], ['KeyR', 'r'], ['KeyS', 's'], ['KeyT', 't'],
    ['KeyU', 'u'], ['KeyV', 'v'], ['KeyW', 'w'], ['KeyX', 'x'], ['KeyY', 'y'],
    ['KeyZ', 'z'],
    ['Digit0', '0'], ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'],
    ['Digit4', '4'], ['Digit5', '5'], ['Digit6', '6'], ['Digit7', '7'],
    ['Digit8', '8'], ['Digit9', '9'],
    ['Minus', '-'], ['Equal', '='], ['BracketLeft', '['], ['BracketRight', ']'],
    ['Backslash', '\\'], ['Semicolon', ';'], ['Quote', "'"], ['Backquote', '`'],
    ['Comma', ','], ['Period', '.'], ['Slash', '/'],
    ['Space', ' '], ['Enter', 'Enter'], ['Tab', 'Tab'],
    ['Backspace', 'Backspace'], ['Delete', 'Delete'],
    ['ArrowUp', 'ArrowUp'], ['ArrowDown', 'ArrowDown'],
    ['ArrowLeft', 'ArrowLeft'], ['ArrowRight', 'ArrowRight'],
    ['Home', 'Home'], ['End', 'End'], ['PageUp', 'PageUp'], ['PageDown', 'PageDown'],
    ['Escape', 'Escape'], ['Insert', 'Insert'],
    ['F1', 'F1'], ['F2', 'F2'], ['F3', 'F3'], ['F4', 'F4'],
    ['F5', 'F5'], ['F6', 'F6'], ['F7', 'F7'], ['F8', 'F8'],
    ['F9', 'F9'], ['F10', 'F10'], ['F11', 'F11'], ['F12', 'F12']
  ]);

  /**
   * Default keyboard configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'standard',         // 'standard', 'real', 'disable'
    customLayout: null        // Custom layout map (optional)
  };

  /**
   * Store for original method references
   * @private
   */
  static _originalMethods = {};

  /**
   * Store for original property descriptor
   * @private
   */
  static _originalDescriptor = null;

  /**
   * Store for applied configuration
   * @private
   */
  static _appliedConfig = null;

  /**
   * Apply keyboard spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='standard'] - Spoofing mode: 'standard', 'real', or 'disable'
   * @param {Map|Object} [config.customLayout] - Custom keyboard layout map
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = { ...KeyboardSpoof._defaultConfig, ...config };
    
    // Validate mode
    if (!['standard', 'real', 'disable'].includes(mergedConfig.mode)) {
      throw new KeyboardSpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'standard', 'real', or 'disable'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // Store the applied configuration
    KeyboardSpoof._appliedConfig = mergedConfig;

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // If mode is 'real', don't spoof anything (Req 36.3)
    if (mergedConfig.mode === 'real') {
      return results;
    }

    // Spoof navigator.keyboard (Req 36.1, 36.2, 36.4)
    try {
      KeyboardSpoof._spoofKeyboard();
      results.spoofed.push('navigator.keyboard');
    } catch (e) {
      results.failed.push({ property: 'navigator.keyboard', error: e.message });
      results.success = false;
    }

    return results;
  }

  /**
   * Create a fake KeyboardLayoutMap object
   * @private
   * @param {Map} layoutMap - The layout map to use
   * @returns {Object} A fake KeyboardLayoutMap-like object
   */
  static _createFakeLayoutMap(layoutMap) {
    const map = layoutMap instanceof Map ? layoutMap : new Map(Object.entries(layoutMap || {}));
    
    const fakeLayoutMap = {
      get size() {
        return map.size;
      },
      get(key) {
        return map.get(key);
      },
      has(key) {
        return map.has(key);
      },
      entries() {
        return map.entries();
      },
      keys() {
        return map.keys();
      },
      values() {
        return map.values();
      },
      forEach(callback, thisArg) {
        map.forEach(callback, thisArg);
      },
      [Symbol.iterator]() {
        return map[Symbol.iterator]();
      }
    };

    // Make methods appear native
    const methods = ['get', 'has', 'entries', 'keys', 'values', 'forEach'];
    methods.forEach(methodName => {
      const method = fakeLayoutMap[methodName];
      Object.defineProperty(method, 'name', {
        value: methodName,
        writable: false,
        enumerable: false,
        configurable: true
      });
      const nativeStr = `function ${methodName}() { [native code] }`;
      method.toString = function() { return nativeStr; };
    });

    return fakeLayoutMap;
  }

  /**
   * Create a fake Keyboard object
   * @private
   * @returns {Object} A fake Keyboard-like object
   */
  static _createFakeKeyboard() {
    const config = KeyboardSpoof._appliedConfig;
    
    // Determine which layout to use
    let layoutMap;
    if (config.customLayout) {
      layoutMap = config.customLayout instanceof Map 
        ? config.customLayout 
        : new Map(Object.entries(config.customLayout));
    } else {
      layoutMap = KeyboardSpoof._standardUSLayout;
    }

    const fakeLayoutMap = KeyboardSpoof._createFakeLayoutMap(layoutMap);

    const fakeKeyboard = {
      getLayoutMap() {
        return Promise.resolve(fakeLayoutMap);
      },
      lock(keyCodes) {
        // Keyboard lock is typically restricted to fullscreen
        return Promise.resolve();
      },
      unlock() {
        // No-op
      }
    };

    // Make methods appear native
    const methods = ['getLayoutMap', 'lock', 'unlock'];
    methods.forEach(methodName => {
      const method = fakeKeyboard[methodName];
      Object.defineProperty(method, 'name', {
        value: methodName,
        writable: false,
        enumerable: false,
        configurable: true
      });
      const nativeStr = `function ${methodName}() { [native code] }`;
      method.toString = function() { return nativeStr; };
    });

    return fakeKeyboard;
  }

  /**
   * Spoof navigator.keyboard
   * Requirement 36.1: Return configured keyboard layout
   * Requirement 36.2: Standard mode returns US keyboard layout
   * Requirement 36.4: Disable mode makes keyboard API unavailable
   * @private
   */
  static _spoofKeyboard() {
    // Check if navigator exists (browser environment)
    if (typeof navigator === 'undefined') {
      return;
    }

    const config = KeyboardSpoof._appliedConfig;

    // Store original descriptor
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'keyboard') ||
                               Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'keyboard');
    
    if (originalDescriptor) {
      KeyboardSpoof._originalDescriptor = originalDescriptor;
    }

    // If mode is 'disable', make keyboard undefined (Req 36.4)
    if (config.mode === 'disable') {
      try {
        Object.defineProperty(navigator, 'keyboard', {
          get: function() {
            return undefined;
          },
          enumerable: true,
          configurable: true
        });
      } catch (e) {
        // If defineProperty fails, try delete
        try {
          delete navigator.keyboard;
        } catch (e2) {
          // Ignore
        }
      }
      return;
    }

    // Create fake keyboard object (Req 36.1, 36.2)
    const fakeKeyboard = KeyboardSpoof._createFakeKeyboard();

    // Replace navigator.keyboard
    try {
      Object.defineProperty(navigator, 'keyboard', {
        get: function() {
          return fakeKeyboard;
        },
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      // If defineProperty fails, that's okay
    }
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return KeyboardSpoof._appliedConfig ? { ...KeyboardSpoof._appliedConfig } : null;
  }

  /**
   * Restore original keyboard property
   * @returns {Object} Result object with restored properties
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    // Restore keyboard
    if (KeyboardSpoof._originalDescriptor && typeof navigator !== 'undefined') {
      try {
        Object.defineProperty(navigator, 'keyboard', KeyboardSpoof._originalDescriptor);
        results.restored.push('keyboard');
      } catch (e) {
        results.failed.push({ property: 'keyboard', error: e.message });
      }
    }

    // Clear stored data
    KeyboardSpoof._originalDescriptor = null;
    KeyboardSpoof._originalMethods = {};
    KeyboardSpoof._appliedConfig = null;

    return results;
  }

  /**
   * Generate injection script string for browser context
   * @param {Object} config - Keyboard configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...KeyboardSpoof._defaultConfig, ...config };

    // Convert standard layout to array for JSON serialization
    const standardLayoutArray = Array.from(KeyboardSpoof._standardUSLayout.entries());

    return `
(function() {
  'use strict';
  
  // Keyboard spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)}
  };
  
  // Skip if mode is 'real' (Req 36.3)
  if (config.mode === 'real') {
    return;
  }
  
  // Check if navigator exists
  if (typeof navigator === 'undefined') {
    return;
  }
  
  // If mode is 'disable', make keyboard undefined (Req 36.4)
  if (config.mode === 'disable') {
    try {
      Object.defineProperty(navigator, 'keyboard', {
        get: function() {
          return undefined;
        },
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      try {
        delete navigator.keyboard;
      } catch (e2) {}
    }
    return;
  }
  
  // Standard US keyboard layout (Req 36.2)
  const standardLayout = new Map(${JSON.stringify(standardLayoutArray)});
  
  // Create fake KeyboardLayoutMap
  function createFakeLayoutMap(layoutMap) {
    const map = layoutMap;
    
    const fakeLayoutMap = {
      get size() { return map.size; },
      get: function(key) { return map.get(key); },
      has: function(key) { return map.has(key); },
      entries: function() { return map.entries(); },
      keys: function() { return map.keys(); },
      values: function() { return map.values(); },
      forEach: function(callback, thisArg) { map.forEach(callback, thisArg); }
    };
    
    // Add iterator
    fakeLayoutMap[Symbol.iterator] = function() { return map[Symbol.iterator](); };
    
    // Make methods appear native
    ['get', 'has', 'entries', 'keys', 'values', 'forEach'].forEach(function(methodName) {
      const method = fakeLayoutMap[methodName];
      Object.defineProperty(method, 'name', {
        value: methodName,
        writable: false,
        enumerable: false,
        configurable: true
      });
      const nativeStr = 'function ' + methodName + '() { [native code] }';
      method.toString = function() { return nativeStr; };
    });
    
    return fakeLayoutMap;
  }
  
  // Create fake Keyboard object (Req 36.1)
  const fakeLayoutMap = createFakeLayoutMap(standardLayout);
  
  const fakeKeyboard = {
    getLayoutMap: function() {
      return Promise.resolve(fakeLayoutMap);
    },
    lock: function(keyCodes) {
      return Promise.resolve();
    },
    unlock: function() {}
  };
  
  // Make methods appear native
  ['getLayoutMap', 'lock', 'unlock'].forEach(function(methodName) {
    const method = fakeKeyboard[methodName];
    Object.defineProperty(method, 'name', {
      value: methodName,
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeStr = 'function ' + methodName + '() { [native code] }';
    method.toString = function() { return nativeStr; };
  });
  
  // Replace navigator.keyboard
  try {
    Object.defineProperty(navigator, 'keyboard', {
      get: function() {
        return fakeKeyboard;
      },
      enumerable: true,
      configurable: true
    });
  } catch (e) {
    // If defineProperty fails, that's okay
  }
})();
`;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Keyboard configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...KeyboardSpoof._defaultConfig };
    }

    const advancedApis = fingerprintConfig.advancedApis || {};
    const keyboardConfig = advancedApis.keyboard || {};
    
    return {
      mode: keyboardConfig.mode || KeyboardSpoof._defaultConfig.mode,
      customLayout: keyboardConfig.customLayout || null
    };
  }

  /**
   * Verify that keyboard spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Promise<Object>} Verification result
   */
  static async verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = KeyboardSpoof.getAppliedConfig();
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

    // If in browser environment, verify actual keyboard behavior
    if (typeof navigator !== 'undefined') {
      if (appliedConfig.mode === 'disable') {
        // Should be undefined (Req 36.4)
        result.checks.disableMode = {
          expected: undefined,
          actual: navigator.keyboard,
          pass: navigator.keyboard === undefined
        };
        if (!result.checks.disableMode.pass) result.valid = false;
      } else if (appliedConfig.mode === 'standard' && navigator.keyboard) {
        try {
          const layoutMap = await navigator.keyboard.getLayoutMap();
          
          // Check that it returns a layout map (Req 36.1)
          result.checks.hasLayoutMap = {
            expected: true,
            actual: layoutMap !== null && layoutMap !== undefined,
            pass: layoutMap !== null && layoutMap !== undefined
          };
          if (!result.checks.hasLayoutMap.pass) result.valid = false;

          // Check standard US layout key (Req 36.2)
          if (layoutMap) {
            const keyA = layoutMap.get('KeyA');
            result.checks.standardLayout = {
              expected: 'a',
              actual: keyA,
              pass: keyA === 'a'
            };
            if (!result.checks.standardLayout.pass) result.valid = false;
          }
        } catch (e) {
          result.checks.getLayoutMap = {
            expected: 'success',
            actual: e.message,
            pass: false
          };
          result.valid = false;
        }
      }
    }

    return result;
  }

  /**
   * Get the standard US keyboard layout
   * @returns {Map} The standard US keyboard layout map
   */
  static getStandardUSLayout() {
    return new Map(KeyboardSpoof._standardUSLayout);
  }
}

module.exports = {
  KeyboardSpoof,
  KeyboardSpoofError
};
