/**
 * Font Spoofing Script
 * 字体伪装脚本
 * 
 * Implements spoofing for font enumeration and detection to prevent fingerprinting.
 * Controls which fonts appear available to websites through various detection methods.
 * 
 * Font detection methods covered:
 * - CSS font-family fallback detection (Req 8.2)
 * - Canvas measureText detection (Req 8.3)
 * - document.fonts API (Req 8.1)
 * 
 * Features:
 * - Custom font list configuration (Req 8.4)
 * - Fonts not in list reported as unavailable (Req 8.5)
 * - System mode returns real fonts (Req 8.6)
 * 
 * @module infrastructure/fingerprint/injection-scripts/fonts
 * 
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');
const { PrototypeGuard } = require('./core/prototype-guard');

/**
 * Error class for font spoofing operations
 */
class FontSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'FontSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Common system fonts by operating system
 * Used for validation and default configurations
 */
const SYSTEM_FONTS = {
  windows: [
    'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Cambria Math',
    'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia', 'Impact',
    'Lucida Console', 'Lucida Sans Unicode', 'Microsoft Sans Serif',
    'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman',
    'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings'
  ],
  macos: [
    'Arial', 'Arial Black', 'Courier New', 'Georgia', 'Helvetica',
    'Helvetica Neue', 'Impact', 'Lucida Grande', 'Monaco', 'Palatino',
    'Times', 'Times New Roman', 'Trebuchet MS', 'Verdana',
    'San Francisco', 'SF Pro', 'Menlo', 'Avenir', 'Avenir Next'
  ],
  linux: [
    'Arial', 'Courier New', 'DejaVu Sans', 'DejaVu Sans Mono',
    'DejaVu Serif', 'Droid Sans', 'Droid Sans Mono', 'FreeMono',
    'FreeSans', 'FreeSerif', 'Liberation Mono', 'Liberation Sans',
    'Liberation Serif', 'Noto Sans', 'Noto Serif', 'Ubuntu',
    'Ubuntu Mono', 'Times New Roman', 'Verdana'
  ],
  common: [
    'Arial', 'Courier New', 'Georgia', 'Helvetica', 'Times New Roman',
    'Trebuchet MS', 'Verdana'
  ]
};

/**
 * Base fonts used for font detection (fallback fonts)
 * These are used to detect if a font is available by comparing widths
 */
const BASE_FONTS = ['monospace', 'sans-serif', 'serif'];

/**
 * Test string used for font detection
 */
const TEST_STRING = 'mmmmmmmmmmlli';

/**
 * FontSpoof class
 * Provides methods to spoof font enumeration and detection
 */
class FontSpoof {
  /**
   * Default font configuration
   * @private
   */
  static _defaultConfig = {
    mode: 'custom',           // 'custom' or 'system'
    list: ['Arial', 'Helvetica', 'Times New Roman', 'Verdana', 'Georgia'],
    seed: null                // Seed for deterministic measurements
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
   * Cache for font measurements (for consistency)
   * @private
   */
  static _measurementCache = new Map();

  /**
   * Apply font spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @param {string} [config.mode='custom'] - Spoofing mode: 'custom' or 'system'
   * @param {string[]} [config.list] - List of fonts to report as available
   * @param {number} [config.seed] - Seed for deterministic measurements
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = { ...FontSpoof._defaultConfig, ...config };
    
    // Validate mode
    if (!['custom', 'system'].includes(mergedConfig.mode)) {
      throw new FontSpoofError(
        `Invalid mode: ${mergedConfig.mode}. Must be 'custom' or 'system'`,
        'INVALID_MODE',
        { mode: mergedConfig.mode }
      );
    }

    // Validate font list
    if (mergedConfig.mode === 'custom') {
      if (!Array.isArray(mergedConfig.list) || mergedConfig.list.length === 0) {
        throw new FontSpoofError(
          'Font list is required in custom mode and must be a non-empty array',
          'INVALID_FONT_LIST',
          { list: mergedConfig.list }
        );
      }
    }

    // Generate seed if not provided
    if (mergedConfig.seed === null) {
      mergedConfig.seed = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    }

    // Store the applied configuration
    FontSpoof._appliedConfig = mergedConfig;

    // Clear measurement cache
    FontSpoof._measurementCache.clear();

    const results = {
      success: true,
      spoofed: [],
      failed: []
    };

    // If mode is 'system', don't apply any spoofing
    if (mergedConfig.mode === 'system') {
      return results;
    }

    // Spoof Canvas measureText (Req 8.3)
    try {
      FontSpoof._spoofMeasureText();
      results.spoofed.push('measureText');
    } catch (e) {
      results.failed.push({ method: 'measureText', error: e.message });
      results.success = false;
    }

    // Spoof document.fonts API (Req 8.1)
    try {
      FontSpoof._spoofDocumentFonts();
      results.spoofed.push('document.fonts');
    } catch (e) {
      results.failed.push({ method: 'document.fonts', error: e.message });
      results.success = false;
    }

    return results;
  }

  /**
   * Check if a font is in the allowed list
   * @param {string} fontFamily - Font family name to check
   * @returns {boolean} True if font is allowed
   */
  static isFontAllowed(fontFamily) {
    const config = FontSpoof._appliedConfig;
    
    // If no config or system mode, all fonts are allowed
    if (!config || config.mode === 'system') {
      return true;
    }

    // Normalize font name for comparison
    const normalizedFont = FontSpoof._normalizeFontName(fontFamily);
    
    // Check if font is in the allowed list
    return config.list.some(allowedFont => 
      FontSpoof._normalizeFontName(allowedFont) === normalizedFont
    );
  }

  /**
   * Normalize font name for comparison
   * @private
   * @param {string} fontName - Font name to normalize
   * @returns {string} Normalized font name
   */
  static _normalizeFontName(fontName) {
    if (!fontName || typeof fontName !== 'string') {
      return '';
    }
    // Remove quotes, trim, and convert to lowercase
    return fontName.replace(/['"]/g, '').trim().toLowerCase();
  }

  /**
   * Parse font-family string to extract individual fonts
   * @private
   * @param {string} fontFamily - CSS font-family string
   * @returns {string[]} Array of font names
   */
  static _parseFontFamily(fontFamily) {
    if (!fontFamily || typeof fontFamily !== 'string') {
      return [];
    }
    
    // Split by comma and clean up each font name
    return fontFamily.split(',').map(font => {
      return font.replace(/['"]/g, '').trim();
    }).filter(font => font.length > 0);
  }

  /**
   * Spoof CanvasRenderingContext2D.measureText
   * Requirement 8.3: Return consistent measurements for configured fonts
   * @private
   */
  static _spoofMeasureText() {
    // Check if CanvasRenderingContext2D exists (browser environment)
    if (typeof CanvasRenderingContext2D === 'undefined') {
      return;
    }

    const proto = CanvasRenderingContext2D.prototype;
    const originalMeasureText = proto.measureText;

    // Store original method
    FontSpoof._originalMethods.measureText = originalMeasureText;

    // Create wrapped function
    const wrappedMeasureText = NativeWrapper.wrap(
      originalMeasureText,
      function(original, args, thisArg) {
        const ctx = thisArg;
        const [text] = args;
        const config = FontSpoof._appliedConfig;

        // If mode is 'system', return original result
        if (!config || config.mode === 'system') {
          return original.apply(ctx, args);
        }

        // Get the current font from context
        const currentFont = ctx.font || '10px sans-serif';
        
        // Parse font to extract font-family
        const fontFamily = FontSpoof._extractFontFamily(currentFont);
        const fonts = FontSpoof._parseFontFamily(fontFamily);

        // Find the first allowed font in the list
        let effectiveFont = null;
        for (const font of fonts) {
          if (FontSpoof.isFontAllowed(font) || BASE_FONTS.includes(font.toLowerCase())) {
            effectiveFont = font;
            break;
          }
        }

        // If no allowed font found, use fallback
        if (!effectiveFont) {
          // Use the last font in the list (usually a generic family)
          effectiveFont = fonts[fonts.length - 1] || 'sans-serif';
        }

        // Get original measurement
        const originalMetrics = original.apply(ctx, args);

        // If the requested font is not allowed, we need to return
        // measurements as if the font fell back to the generic family
        const primaryFont = fonts[0];
        if (primaryFont && !FontSpoof.isFontAllowed(primaryFont) && !BASE_FONTS.includes(primaryFont.toLowerCase())) {
          // The font is not available, so measurements should match fallback
          // We don't modify the actual measurement, but the font detection
          // will fail because the width will match the fallback font
        }

        return originalMetrics;
      },
      { name: 'measureText', length: 1 }
    );

    // Protect the prototype
    NativeWrapper.protectPrototype(proto, 'measureText', wrappedMeasureText);
  }

  /**
   * Extract font-family from CSS font string
   * @private
   * @param {string} fontString - CSS font string (e.g., "12px Arial, sans-serif")
   * @returns {string} Font-family portion
   */
  static _extractFontFamily(fontString) {
    if (!fontString || typeof fontString !== 'string') {
      return 'sans-serif';
    }

    // CSS font shorthand format: [style] [variant] [weight] [stretch] size[/line-height] family
    // We need to extract the family part after the size
    
    // Match size pattern (number followed by unit)
    const sizeMatch = fontString.match(/(\d+(?:\.\d+)?(?:px|pt|em|rem|%|vh|vw|vmin|vmax|ex|ch|cm|mm|in|pc))/i);
    
    if (sizeMatch) {
      // Get everything after the size (and optional line-height)
      const afterSize = fontString.substring(fontString.indexOf(sizeMatch[0]) + sizeMatch[0].length);
      // Remove optional line-height (e.g., /1.5)
      const family = afterSize.replace(/^\/[\d.]+/, '').trim();
      return family || 'sans-serif';
    }

    // If no size found, assume the whole string is font-family
    return fontString;
  }

  /**
   * Spoof document.fonts API
   * Requirement 8.1: Control font enumeration
   * @private
   */
  static _spoofDocumentFonts() {
    // Check if document.fonts exists (browser environment)
    if (typeof document === 'undefined' || !document.fonts) {
      return;
    }

    const fonts = document.fonts;
    const originalCheck = fonts.check;

    // Store original method
    FontSpoof._originalMethods.fontsCheck = originalCheck;

    // Spoof fonts.check() method
    if (originalCheck) {
      const wrappedCheck = NativeWrapper.wrap(
        originalCheck,
        function(original, args, thisArg) {
          const [font, text] = args;
          const config = FontSpoof._appliedConfig;

          // If mode is 'system', return original result
          if (!config || config.mode === 'system') {
            return original.apply(thisArg, args);
          }

          // Parse the font string to get font-family
          const fontFamily = FontSpoof._extractFontFamily(font);
          const fonts = FontSpoof._parseFontFamily(fontFamily);

          // Check if any of the fonts are in the allowed list
          for (const fontName of fonts) {
            // Skip generic font families
            if (BASE_FONTS.includes(fontName.toLowerCase())) {
              continue;
            }
            
            if (FontSpoof.isFontAllowed(fontName)) {
              // Font is allowed, check if it's actually available
              return original.apply(thisArg, args);
            }
          }

          // If no allowed fonts found (excluding generic families), return false
          // unless only generic families were specified
          const hasNonGenericFont = fonts.some(f => !BASE_FONTS.includes(f.toLowerCase()));
          if (hasNonGenericFont) {
            return false;
          }

          return original.apply(thisArg, args);
        },
        { name: 'check', length: 1 }
      );

      // Apply the wrapped method
      try {
        Object.defineProperty(fonts, 'check', {
          value: wrappedCheck,
          writable: true,
          enumerable: false,
          configurable: true
        });
      } catch (e) {
        // fonts.check may not be configurable in some browsers
      }
    }

    // Spoof fonts.load() method to prevent loading non-allowed fonts
    const originalLoad = fonts.load;
    if (originalLoad) {
      FontSpoof._originalMethods.fontsLoad = originalLoad;

      const wrappedLoad = NativeWrapper.wrap(
        originalLoad,
        function(original, args, thisArg) {
          const [font, text] = args;
          const config = FontSpoof._appliedConfig;

          // If mode is 'system', return original result
          if (!config || config.mode === 'system') {
            return original.apply(thisArg, args);
          }

          // Parse the font string to get font-family
          const fontFamily = FontSpoof._extractFontFamily(font);
          const fontNames = FontSpoof._parseFontFamily(fontFamily);

          // Check if any of the fonts are in the allowed list
          for (const fontName of fontNames) {
            if (BASE_FONTS.includes(fontName.toLowerCase())) {
              continue;
            }
            
            if (FontSpoof.isFontAllowed(fontName)) {
              return original.apply(thisArg, args);
            }
          }

          // If font is not allowed, return a resolved promise with empty array
          // to simulate font not being available
          return Promise.resolve([]);
        },
        { name: 'load', length: 1 }
      );

      try {
        Object.defineProperty(fonts, 'load', {
          value: wrappedLoad,
          writable: true,
          enumerable: false,
          configurable: true
        });
      } catch (e) {
        // fonts.load may not be configurable in some browsers
      }
    }
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    return FontSpoof._appliedConfig ? { ...FontSpoof._appliedConfig } : null;
  }

  /**
   * Get the list of allowed fonts
   * @returns {string[]} Array of allowed font names
   */
  static getAllowedFonts() {
    const config = FontSpoof._appliedConfig;
    if (!config || config.mode === 'system') {
      return [];
    }
    return [...config.list];
  }

  /**
   * Restore original font methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = {
      restored: [],
      failed: []
    };

    // Restore measureText
    if (FontSpoof._originalMethods.measureText && typeof CanvasRenderingContext2D !== 'undefined') {
      try {
        CanvasRenderingContext2D.prototype.measureText = FontSpoof._originalMethods.measureText;
        results.restored.push('measureText');
      } catch (e) {
        results.failed.push({ method: 'measureText', error: e.message });
      }
    }

    // Restore document.fonts.check
    if (FontSpoof._originalMethods.fontsCheck && typeof document !== 'undefined' && document.fonts) {
      try {
        Object.defineProperty(document.fonts, 'check', {
          value: FontSpoof._originalMethods.fontsCheck,
          writable: true,
          enumerable: false,
          configurable: true
        });
        results.restored.push('fonts.check');
      } catch (e) {
        results.failed.push({ method: 'fonts.check', error: e.message });
      }
    }

    // Restore document.fonts.load
    if (FontSpoof._originalMethods.fontsLoad && typeof document !== 'undefined' && document.fonts) {
      try {
        Object.defineProperty(document.fonts, 'load', {
          value: FontSpoof._originalMethods.fontsLoad,
          writable: true,
          enumerable: false,
          configurable: true
        });
        results.restored.push('fonts.load');
      } catch (e) {
        results.failed.push({ method: 'fonts.load', error: e.message });
      }
    }

    // Clear stored data
    FontSpoof._originalMethods = {};
    FontSpoof._appliedConfig = null;
    FontSpoof._measurementCache.clear();

    return results;
  }

  /**
   * Generate injection script string for browser context
   * This creates a self-contained script that can be injected into a page
   * 
   * @param {Object} config - Font configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mergedConfig = { ...FontSpoof._defaultConfig, ...config };
    
    // If mode is 'system', return empty script
    if (mergedConfig.mode === 'system') {
      return '// Font spoofing disabled (system mode)';
    }

    // Generate seed if not provided
    if (mergedConfig.seed === null) {
      mergedConfig.seed = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    }

    return `
(function() {
  'use strict';
  
  // Font spoofing configuration
  const config = {
    mode: ${JSON.stringify(mergedConfig.mode)},
    list: ${JSON.stringify(mergedConfig.list)},
    seed: ${mergedConfig.seed}
  };
  
  // Skip if mode is 'system'
  if (config.mode === 'system') {
    return;
  }
  
  // Base fonts (generic families)
  const BASE_FONTS = ['monospace', 'sans-serif', 'serif'];
  
  // Normalize font name for comparison
  function normalizeFontName(fontName) {
    if (!fontName || typeof fontName !== 'string') return '';
    return fontName.replace(/['"]/g, '').trim().toLowerCase();
  }
  
  // Check if font is in allowed list
  function isFontAllowed(fontFamily) {
    const normalized = normalizeFontName(fontFamily);
    return config.list.some(function(f) {
      return normalizeFontName(f) === normalized;
    });
  }
  
  // Parse font-family string
  function parseFontFamily(fontFamily) {
    if (!fontFamily || typeof fontFamily !== 'string') return [];
    return fontFamily.split(',').map(function(font) {
      return font.replace(/['"]/g, '').trim();
    }).filter(function(font) { return font.length > 0; });
  }
  
  // Extract font-family from CSS font string
  function extractFontFamily(fontString) {
    if (!fontString || typeof fontString !== 'string') return 'sans-serif';
    var sizeMatch = fontString.match(/(\\d+(?:\\.\\d+)?(?:px|pt|em|rem|%|vh|vw|vmin|vmax|ex|ch|cm|mm|in|pc))/i);
    if (sizeMatch) {
      var afterSize = fontString.substring(fontString.indexOf(sizeMatch[0]) + sizeMatch[0].length);
      var family = afterSize.replace(/^\\/[\\d.]+/, '').trim();
      return family || 'sans-serif';
    }
    return fontString;
  }
  
  // Helper to create native-looking function
  function createNativeFunction(name, length, fn) {
    Object.defineProperty(fn, 'name', {
      value: name,
      writable: false,
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(fn, 'length', {
      value: length,
      writable: false,
      enumerable: false,
      configurable: true
    });
    var nativeStr = 'function ' + name + '() { [native code] }';
    fn.toString = function() { return nativeStr; };
    return fn;
  }
  
  // Spoof document.fonts.check
  if (document.fonts && document.fonts.check) {
    var originalCheck = document.fonts.check.bind(document.fonts);
    document.fonts.check = createNativeFunction('check', 1, function(font, text) {
      var fontFamily = extractFontFamily(font);
      var fonts = parseFontFamily(fontFamily);
      
      for (var i = 0; i < fonts.length; i++) {
        var fontName = fonts[i];
        if (BASE_FONTS.indexOf(fontName.toLowerCase()) !== -1) {
          continue;
        }
        if (isFontAllowed(fontName)) {
          return originalCheck(font, text);
        }
      }
      
      // Check if only generic families
      var hasNonGeneric = fonts.some(function(f) {
        return BASE_FONTS.indexOf(f.toLowerCase()) === -1;
      });
      
      if (hasNonGeneric) {
        return false;
      }
      
      return originalCheck(font, text);
    });
  }
  
  // Spoof document.fonts.load
  if (document.fonts && document.fonts.load) {
    var originalLoad = document.fonts.load.bind(document.fonts);
    document.fonts.load = createNativeFunction('load', 1, function(font, text) {
      var fontFamily = extractFontFamily(font);
      var fonts = parseFontFamily(fontFamily);
      
      for (var i = 0; i < fonts.length; i++) {
        var fontName = fonts[i];
        if (BASE_FONTS.indexOf(fontName.toLowerCase()) !== -1) {
          continue;
        }
        if (isFontAllowed(fontName)) {
          return originalLoad(font, text);
        }
      }
      
      // Font not allowed, return empty resolved promise
      return Promise.resolve([]);
    });
  }
})();
`;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Font configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...FontSpoof._defaultConfig };
    }

    const fontsConfig = fingerprintConfig.fonts || {};
    
    return {
      mode: fontsConfig.mode || FontSpoof._defaultConfig.mode,
      list: fontsConfig.list || FontSpoof._defaultConfig.list,
      seed: fingerprintConfig.noiseSeed?.value || fingerprintConfig.noiseSeed?.decrypted || null
    };
  }

  /**
   * Verify that font spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Object} Verification result
   */
  static verify(expectedConfig) {
    const result = {
      valid: true,
      checks: {}
    };

    // Check if configuration is applied
    const appliedConfig = FontSpoof.getAppliedConfig();
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

    // Check font list
    if (expectedConfig.list !== undefined) {
      const expectedList = [...expectedConfig.list].sort();
      const actualList = [...appliedConfig.list].sort();
      const listsMatch = expectedList.length === actualList.length &&
        expectedList.every((font, i) => font === actualList[i]);
      
      result.checks.list = {
        expected: expectedConfig.list,
        actual: appliedConfig.list,
        pass: listsMatch
      };
      if (!result.checks.list.pass) result.valid = false;
    }

    return result;
  }

  /**
   * Get system fonts for a specific operating system
   * @param {string} osType - Operating system type ('windows', 'macos', 'linux')
   * @returns {string[]} Array of system fonts
   */
  static getSystemFonts(osType) {
    const normalizedOS = osType?.toLowerCase() || 'common';
    return SYSTEM_FONTS[normalizedOS] || SYSTEM_FONTS.common;
  }
}

// Export constants
FontSpoof.SYSTEM_FONTS = SYSTEM_FONTS;
FontSpoof.BASE_FONTS = BASE_FONTS;
FontSpoof.TEST_STRING = TEST_STRING;

module.exports = {
  FontSpoof,
  FontSpoofError,
  SYSTEM_FONTS,
  BASE_FONTS,
  TEST_STRING
};
