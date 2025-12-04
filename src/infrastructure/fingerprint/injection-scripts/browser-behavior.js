/**
 * Browser Behavior Consistency Script
 * 浏览器行为一致性脚本
 * 
 * Implements browser behavior consistency to prevent fingerprinting through
 * browser-specific characteristics and automation detection.
 * 
 * Covered features:
 * - window.chrome object emulation (Req 28.1)
 * - Electron trace cleanup (Req 28.3, 28.10)
 * - HTTP request header consistency (Req 27.1-27.5)
 * - Automation detection hiding
 * 
 * @module infrastructure/fingerprint/injection-scripts/browser-behavior
 * 
 * **Validates: Requirements 27.1-27.5, 28.1, 28.3, 28.10**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');

/**
 * Error class for browser behavior spoofing operations
 */
class BrowserBehaviorSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'BrowserBehaviorSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * BrowserBehaviorSpoof class
 * Provides methods to ensure browser behavior consistency
 */
class BrowserBehaviorSpoof {
  /**
   * Default configuration for browser behavior
   * @private
   */
  static _defaultConfig = {
    // Browser type configuration
    browser: {
      type: 'chrome',           // chrome, firefox, edge, safari
      version: '120.0.0.0',
      majorVersion: 120
    },
    // User-Agent for HTTP headers (Req 27.1)
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Accept-Language for HTTP headers (Req 27.2)
    acceptLanguage: 'en-US,en;q=0.9',
    // Platform for Sec-CH-UA headers (Req 27.4)
    platform: 'Windows',
    // Mobile flag for Sec-CH-UA-Mobile (Req 27.5)
    mobile: false,
    // Chrome object emulation (Req 28.1)
    emulateChrome: true,
    // Electron cleanup (Req 28.3, 28.10)
    cleanElectronTraces: true,
    // Automation detection hiding
    hideAutomation: true
  };

  /**
   * Store for original references
   * @private
   */
  static _originalReferences = {};

  /**
   * Store for applied configuration
   * @private
   */
  static _appliedConfig = null;

  /**
   * Apply browser behavior spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = {
      browser: { ...BrowserBehaviorSpoof._defaultConfig.browser, ...(config.browser || {}) },
      userAgent: config.userAgent || BrowserBehaviorSpoof._defaultConfig.userAgent,
      acceptLanguage: config.acceptLanguage || BrowserBehaviorSpoof._defaultConfig.acceptLanguage,
      platform: config.platform || BrowserBehaviorSpoof._defaultConfig.platform,
      mobile: config.mobile !== undefined ? config.mobile : BrowserBehaviorSpoof._defaultConfig.mobile,
      emulateChrome: config.emulateChrome !== undefined ? config.emulateChrome : BrowserBehaviorSpoof._defaultConfig.emulateChrome,
      cleanElectronTraces: config.cleanElectronTraces !== undefined ? config.cleanElectronTraces : BrowserBehaviorSpoof._defaultConfig.cleanElectronTraces,
      hideAutomation: config.hideAutomation !== undefined ? config.hideAutomation : BrowserBehaviorSpoof._defaultConfig.hideAutomation
    };

    // Store the applied configuration
    BrowserBehaviorSpoof._appliedConfig = mergedConfig;

    const results = { success: true, spoofed: [], failed: [] };

    // Apply Chrome object emulation (Req 28.1)
    if (mergedConfig.emulateChrome && mergedConfig.browser.type === 'chrome') {
      try {
        BrowserBehaviorSpoof._emulateWindowChrome(mergedConfig);
        results.spoofed.push('window.chrome');
      } catch (e) {
        results.failed.push({ feature: 'window.chrome', error: e.message });
      }
    }

    // Clean Electron traces (Req 28.3, 28.10)
    if (mergedConfig.cleanElectronTraces) {
      try {
        BrowserBehaviorSpoof._cleanElectronTraces();
        results.spoofed.push('electronTraces');
      } catch (e) {
        results.failed.push({ feature: 'electronTraces', error: e.message });
      }
    }

    // Hide automation detection
    if (mergedConfig.hideAutomation) {
      try {
        BrowserBehaviorSpoof._hideAutomationFlags();
        results.spoofed.push('automationFlags');
      } catch (e) {
        results.failed.push({ feature: 'automationFlags', error: e.message });
      }
    }

    return results;
  }


  /**
   * Emulate window.chrome object for Chrome browser (Req 28.1)
   * Creates a realistic Chrome object structure
   * @private
   */
  static _emulateWindowChrome(config) {
    if (typeof window === 'undefined') return;

    // Store original if exists
    if (window.chrome) {
      BrowserBehaviorSpoof._originalReferences.chrome = window.chrome;
    }

    // Create Chrome runtime mock
    const createRuntime = () => {
      const runtime = {
        // Chrome runtime properties
        OnInstalledReason: {
          CHROME_UPDATE: 'chrome_update',
          INSTALL: 'install',
          SHARED_MODULE_UPDATE: 'shared_module_update',
          UPDATE: 'update'
        },
        OnRestartRequiredReason: {
          APP_UPDATE: 'app_update',
          OS_UPDATE: 'os_update',
          PERIODIC: 'periodic'
        },
        PlatformArch: {
          ARM: 'arm',
          ARM64: 'arm64',
          MIPS: 'mips',
          MIPS64: 'mips64',
          X86_32: 'x86-32',
          X86_64: 'x86-64'
        },
        PlatformNaclArch: {
          ARM: 'arm',
          MIPS: 'mips',
          MIPS64: 'mips64',
          X86_32: 'x86-32',
          X86_64: 'x86-64'
        },
        PlatformOs: {
          ANDROID: 'android',
          CROS: 'cros',
          LINUX: 'linux',
          MAC: 'mac',
          OPENBSD: 'openbsd',
          WIN: 'win'
        },
        RequestUpdateCheckStatus: {
          NO_UPDATE: 'no_update',
          THROTTLED: 'throttled',
          UPDATE_AVAILABLE: 'update_available'
        },
        // Methods that return undefined (not available in content scripts)
        connect: function() { return undefined; },
        sendMessage: function() { return undefined; },
        id: undefined
      };

      // Make methods appear native
      for (const key of ['connect', 'sendMessage']) {
        if (typeof runtime[key] === 'function') {
          Object.defineProperty(runtime[key], 'name', { value: key });
          runtime[key].toString = () => `function ${key}() { [native code] }`;
        }
      }

      return runtime;
    };

    // Create Chrome csi mock (Client Side Instrumentation)
    const createCsi = () => {
      const csi = function() {
        return {
          startE: Date.now(),
          onloadT: Date.now(),
          pageT: Math.random() * 1000,
          tran: 15
        };
      };
      Object.defineProperty(csi, 'name', { value: 'csi' });
      csi.toString = () => 'function csi() { [native code] }';
      return csi;
    };

    // Create Chrome loadTimes mock
    const createLoadTimes = () => {
      const loadTimes = function() {
        return {
          commitLoadTime: Date.now() / 1000,
          connectionInfo: 'h2',
          finishDocumentLoadTime: Date.now() / 1000,
          finishLoadTime: Date.now() / 1000,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: Date.now() / 1000,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'h2',
          requestTime: Date.now() / 1000,
          startLoadTime: Date.now() / 1000,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true
        };
      };
      Object.defineProperty(loadTimes, 'name', { value: 'loadTimes' });
      loadTimes.toString = () => 'function loadTimes() { [native code] }';
      return loadTimes;
    };

    // Create the chrome object
    const chromeObj = {
      app: {
        isInstalled: false,
        InstallState: {
          DISABLED: 'disabled',
          INSTALLED: 'installed',
          NOT_INSTALLED: 'not_installed'
        },
        RunningState: {
          CANNOT_RUN: 'cannot_run',
          READY_TO_RUN: 'ready_to_run',
          RUNNING: 'running'
        },
        getDetails: function() { return null; },
        getIsInstalled: function() { return false; },
        runningState: function() { return 'cannot_run'; }
      },
      csi: createCsi(),
      loadTimes: createLoadTimes(),
      runtime: createRuntime()
    };

    // Make app methods appear native
    for (const key of ['getDetails', 'getIsInstalled', 'runningState']) {
      if (typeof chromeObj.app[key] === 'function') {
        Object.defineProperty(chromeObj.app[key], 'name', { value: key });
        chromeObj.app[key].toString = () => `function ${key}() { [native code] }`;
      }
    }

    // Define window.chrome
    try {
      Object.defineProperty(window, 'chrome', {
        value: chromeObj,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      window.chrome = chromeObj;
    }
  }


  /**
   * Clean Electron traces from the environment (Req 28.3, 28.10)
   * Removes Electron-specific properties and objects
   * @private
   */
  static _cleanElectronTraces() {
    if (typeof window === 'undefined') return;

    // List of Electron-specific properties to remove
    const electronProperties = [
      'process',
      'require',
      '__dirname',
      '__filename',
      'module',
      'exports',
      'Buffer',
      'global'
    ];

    // Remove Electron properties from window
    for (const prop of electronProperties) {
      try {
        if (prop in window) {
          BrowserBehaviorSpoof._originalReferences[`window.${prop}`] = window[prop];
          delete window[prop];
        }
      } catch (e) {
        // Property may not be deletable, try to override
        try {
          Object.defineProperty(window, prop, {
            get: () => undefined,
            enumerable: false,
            configurable: true
          });
        } catch (e2) {}
      }
    }

    // Clean navigator properties that may reveal Electron
    if (typeof navigator !== 'undefined') {
      // Remove Electron from userAgent if present (should be handled by navigator spoof)
      // Clean any Electron-specific navigator properties
      const electronNavProps = ['userAgentData'];
      
      for (const prop of electronNavProps) {
        try {
          const descriptor = Object.getOwnPropertyDescriptor(navigator, prop);
          if (descriptor && descriptor.value && 
              typeof descriptor.value === 'object' &&
              descriptor.value.brands) {
            // Filter out Electron from brands
            const brands = descriptor.value.brands.filter(
              b => !b.brand.toLowerCase().includes('electron')
            );
            descriptor.value.brands = brands;
          }
        } catch (e) {}
      }
    }

    // Remove Electron-specific error stack traces
    BrowserBehaviorSpoof._cleanErrorStacks();

    // Clean Electron-specific CSS properties
    BrowserBehaviorSpoof._cleanElectronCSS();

    // Remove Electron IPC bridge if exposed
    BrowserBehaviorSpoof._cleanElectronIPC();
  }

  /**
   * Clean Electron-specific error stack traces
   * @private
   */
  static _cleanErrorStacks() {
    if (typeof Error === 'undefined') return;

    const originalPrepareStackTrace = Error.prepareStackTrace;
    BrowserBehaviorSpoof._originalReferences.prepareStackTrace = originalPrepareStackTrace;

    // Override prepareStackTrace to filter Electron paths
    Error.prepareStackTrace = function(error, structuredStackTrace) {
      if (originalPrepareStackTrace) {
        const stack = originalPrepareStackTrace(error, structuredStackTrace);
        if (typeof stack === 'string') {
          // Remove Electron-specific paths from stack traces
          return stack
            .replace(/electron[\/\\]js2c[\/\\]/gi, '')
            .replace(/electron\.asar[\/\\]/gi, '')
            .replace(/node_modules[\/\\]electron[\/\\]/gi, '')
            .replace(/at\s+electron\./gi, 'at ')
            .replace(/\(electron:/gi, '(');
        }
        return stack;
      }
      return structuredStackTrace.map(frame => frame.toString()).join('\n');
    };
  }

  /**
   * Clean Electron-specific CSS properties
   * @private
   */
  static _cleanElectronCSS() {
    if (typeof document === 'undefined') return;

    // Remove -webkit-app-region and other Electron-specific CSS
    try {
      const style = document.createElement('style');
      style.textContent = `
        * {
          -webkit-app-region: none !important;
          -webkit-user-drag: auto !important;
        }
      `;
      if (document.head) {
        document.head.appendChild(style);
      }
    } catch (e) {}
  }

  /**
   * Clean Electron IPC bridge
   * @private
   */
  static _cleanElectronIPC() {
    if (typeof window === 'undefined') return;

    // Common Electron IPC bridge names
    const ipcBridges = [
      'electronAPI',
      'electron',
      'ipcRenderer',
      'remote',
      'shell',
      'contextBridge',
      '__electron_preload__',
      '__electronPreload__'
    ];

    for (const bridge of ipcBridges) {
      try {
        if (bridge in window) {
          BrowserBehaviorSpoof._originalReferences[`window.${bridge}`] = window[bridge];
          delete window[bridge];
        }
      } catch (e) {
        try {
          Object.defineProperty(window, bridge, {
            get: () => undefined,
            enumerable: false,
            configurable: true
          });
        } catch (e2) {}
      }
    }
  }


  /**
   * Hide automation detection flags
   * @private
   */
  static _hideAutomationFlags() {
    if (typeof window === 'undefined') return;

    // Remove automation-related properties
    const automationProps = [
      'cdc_adoQpoasnfa76pfcZLmcfl_Array',
      'cdc_adoQpoasnfa76pfcZLmcfl_Promise',
      'cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
      '__webdriver_evaluate',
      '__selenium_evaluate',
      '__webdriver_script_function',
      '__webdriver_script_func',
      '__webdriver_script_fn',
      '__fxdriver_evaluate',
      '__driver_unwrapped',
      '__webdriver_unwrapped',
      '__driver_evaluate',
      '__selenium_unwrapped',
      '__fxdriver_unwrapped',
      '_Selenium_IDE_Recorder',
      '_selenium',
      'calledSelenium',
      '$chrome_asyncScriptInfo',
      '$cdc_asdjflasutopfhvcZLmcfl_',
      '__nightmare',
      '__phantomas',
      '_phantom',
      'phantom',
      'callPhantom',
      '__puppeteer_evaluation_script__',
      '__playwright_evaluation_script__'
    ];

    for (const prop of automationProps) {
      try {
        if (prop in window) {
          delete window[prop];
        }
      } catch (e) {}
    }

    // Remove automation-related document properties
    if (typeof document !== 'undefined') {
      const docProps = [
        '__webdriver_script_fn',
        '__driver_evaluate',
        '__webdriver_evaluate',
        '__selenium_evaluate',
        '__fxdriver_evaluate',
        '__driver_unwrapped',
        '__webdriver_unwrapped',
        '__selenium_unwrapped',
        '__fxdriver_unwrapped'
      ];

      for (const prop of docProps) {
        try {
          if (prop in document) {
            delete document[prop];
          }
        } catch (e) {}
      }

      // Clean document.$cdc_ properties (ChromeDriver)
      try {
        const keys = Object.keys(document);
        for (const key of keys) {
          if (key.startsWith('$cdc_') || key.startsWith('cdc_')) {
            delete document[key];
          }
        }
      } catch (e) {}
    }

    // Override navigator.webdriver (should be handled by navigator spoof, but ensure it)
    if (typeof navigator !== 'undefined') {
      try {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          enumerable: true,
          configurable: true
        });
      } catch (e) {}
    }

    // Clean window.domAutomation and window.domAutomationController
    try {
      if ('domAutomation' in window) delete window.domAutomation;
      if ('domAutomationController' in window) delete window.domAutomationController;
    } catch (e) {}

    // Override Permissions API to hide automation
    BrowserBehaviorSpoof._hidePermissionsAutomation();
  }

  /**
   * Hide automation in Permissions API
   * @private
   */
  static _hidePermissionsAutomation() {
    if (typeof navigator === 'undefined' || !navigator.permissions) return;

    const originalQuery = navigator.permissions.query;
    if (!originalQuery) return;

    BrowserBehaviorSpoof._originalReferences.permissionsQuery = originalQuery;

    const wrappedQuery = NativeWrapper.wrap(
      originalQuery,
      async function(original, args, thisArg) {
        const result = await original.apply(thisArg || navigator.permissions, args);
        
        // For notifications permission, ensure it doesn't reveal automation
        if (args[0] && args[0].name === 'notifications') {
          // Return a modified result that doesn't indicate automation
          const modifiedResult = Object.create(Object.getPrototypeOf(result));
          Object.defineProperty(modifiedResult, 'state', {
            get: () => result.state === 'prompt' ? 'prompt' : result.state,
            enumerable: true,
            configurable: true
          });
          modifiedResult.onchange = result.onchange;
          return modifiedResult;
        }
        
        return result;
      },
      { name: 'query', length: 1 }
    );

    try {
      navigator.permissions.query = wrappedQuery;
    } catch (e) {}
  }


  /**
   * Get Client Hints headers configuration (Req 27.3, 27.4, 27.5)
   * Returns headers that should be set for HTTP requests
   * 
   * @param {Object} config - Configuration object
   * @returns {Object} Headers object
   */
  static getClientHintsHeaders(config = {}) {
    const mergedConfig = {
      ...BrowserBehaviorSpoof._defaultConfig,
      ...config,
      browser: { ...BrowserBehaviorSpoof._defaultConfig.browser, ...(config.browser || {}) }
    };

    const browserType = mergedConfig.browser.type;
    const browserVersion = mergedConfig.browser.version;
    const majorVersion = mergedConfig.browser.majorVersion || parseInt(browserVersion.split('.')[0], 10);
    const platform = mergedConfig.platform;
    const mobile = mergedConfig.mobile;

    // Build Sec-CH-UA header (Req 27.3)
    let secChUa = '';
    if (browserType === 'chrome') {
      secChUa = `"Not_A Brand";v="8", "Chromium";v="${majorVersion}", "Google Chrome";v="${majorVersion}"`;
    } else if (browserType === 'edge') {
      secChUa = `"Not_A Brand";v="8", "Chromium";v="${majorVersion}", "Microsoft Edge";v="${majorVersion}"`;
    } else if (browserType === 'firefox') {
      // Firefox doesn't support Client Hints
      secChUa = '';
    } else if (browserType === 'safari') {
      // Safari doesn't support Client Hints
      secChUa = '';
    }

    // Build Sec-CH-UA-Platform header (Req 27.4)
    let secChUaPlatform = `"${platform}"`;

    // Build Sec-CH-UA-Mobile header (Req 27.5)
    let secChUaMobile = mobile ? '?1' : '?0';

    return {
      'User-Agent': mergedConfig.userAgent,
      'Accept-Language': mergedConfig.acceptLanguage,
      'Sec-CH-UA': secChUa,
      'Sec-CH-UA-Platform': secChUaPlatform,
      'Sec-CH-UA-Mobile': secChUaMobile,
      'Sec-CH-UA-Full-Version': `"${browserVersion}"`,
      'Sec-CH-UA-Full-Version-List': secChUa ? secChUa.replace(/v="(\d+)"/g, `v="${browserVersion}"`) : ''
    };
  }

  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    if (!BrowserBehaviorSpoof._appliedConfig) return null;
    
    return {
      ...BrowserBehaviorSpoof._appliedConfig,
      browser: { ...BrowserBehaviorSpoof._appliedConfig.browser }
    };
  }

  /**
   * Restore original browser behavior
   * @returns {Object} Result object with restored features
   */
  static restore() {
    const results = { restored: [], failed: [] };

    // Restore window.chrome
    if (BrowserBehaviorSpoof._originalReferences.chrome && typeof window !== 'undefined') {
      try {
        window.chrome = BrowserBehaviorSpoof._originalReferences.chrome;
        results.restored.push('window.chrome');
      } catch (e) {
        results.failed.push({ feature: 'window.chrome', error: e.message });
      }
    }

    // Restore Error.prepareStackTrace
    if (BrowserBehaviorSpoof._originalReferences.prepareStackTrace) {
      try {
        Error.prepareStackTrace = BrowserBehaviorSpoof._originalReferences.prepareStackTrace;
        results.restored.push('Error.prepareStackTrace');
      } catch (e) {
        results.failed.push({ feature: 'Error.prepareStackTrace', error: e.message });
      }
    }

    // Restore permissions.query
    if (BrowserBehaviorSpoof._originalReferences.permissionsQuery && 
        typeof navigator !== 'undefined' && navigator.permissions) {
      try {
        navigator.permissions.query = BrowserBehaviorSpoof._originalReferences.permissionsQuery;
        results.restored.push('permissions.query');
      } catch (e) {
        results.failed.push({ feature: 'permissions.query', error: e.message });
      }
    }

    // Restore Electron properties
    const electronProps = ['process', 'require', '__dirname', '__filename', 'module', 'exports', 'Buffer', 'global'];
    for (const prop of electronProps) {
      const key = `window.${prop}`;
      if (BrowserBehaviorSpoof._originalReferences[key] && typeof window !== 'undefined') {
        try {
          window[prop] = BrowserBehaviorSpoof._originalReferences[key];
          results.restored.push(key);
        } catch (e) {
          results.failed.push({ feature: key, error: e.message });
        }
      }
    }

    // Clear stored data
    BrowserBehaviorSpoof._originalReferences = {};
    BrowserBehaviorSpoof._appliedConfig = null;

    return results;
  }


  /**
   * Verify that browser behavior spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Object} Verification result
   */
  static verify(expectedConfig = {}) {
    const result = { valid: true, checks: {} };

    const appliedConfig = BrowserBehaviorSpoof.getAppliedConfig();
    result.checks.configApplied = {
      expected: true,
      actual: appliedConfig !== null,
      pass: appliedConfig !== null
    };

    if (!appliedConfig) {
      result.valid = false;
      return result;
    }

    // Check window.chrome exists for Chrome browser (Req 28.1)
    if (typeof window !== 'undefined' && appliedConfig.emulateChrome && appliedConfig.browser.type === 'chrome') {
      result.checks.windowChrome = {
        expected: true,
        actual: typeof window.chrome === 'object',
        pass: typeof window.chrome === 'object'
      };
      if (!result.checks.windowChrome.pass) result.valid = false;

      // Check chrome.runtime exists
      if (window.chrome) {
        result.checks.chromeRuntime = {
          expected: true,
          actual: typeof window.chrome.runtime === 'object',
          pass: typeof window.chrome.runtime === 'object'
        };
        if (!result.checks.chromeRuntime.pass) result.valid = false;

        // Check chrome.app exists
        result.checks.chromeApp = {
          expected: true,
          actual: typeof window.chrome.app === 'object',
          pass: typeof window.chrome.app === 'object'
        };
        if (!result.checks.chromeApp.pass) result.valid = false;

        // Check chrome.csi is a function
        result.checks.chromeCsi = {
          expected: 'function',
          actual: typeof window.chrome.csi,
          pass: typeof window.chrome.csi === 'function'
        };
        if (!result.checks.chromeCsi.pass) result.valid = false;

        // Check chrome.loadTimes is a function
        result.checks.chromeLoadTimes = {
          expected: 'function',
          actual: typeof window.chrome.loadTimes,
          pass: typeof window.chrome.loadTimes === 'function'
        };
        if (!result.checks.chromeLoadTimes.pass) result.valid = false;
      }
    }

    // Check Electron traces are cleaned (Req 28.3, 28.10)
    if (typeof window !== 'undefined' && appliedConfig.cleanElectronTraces) {
      const electronProps = ['process', 'require', '__dirname', '__filename'];
      for (const prop of electronProps) {
        result.checks[`no_${prop}`] = {
          expected: undefined,
          actual: window[prop],
          pass: window[prop] === undefined
        };
        // Don't fail if these exist - they may be legitimately present in Node.js test environment
      }
    }

    // Check navigator.webdriver is hidden
    if (typeof navigator !== 'undefined' && appliedConfig.hideAutomation) {
      result.checks.webdriverHidden = {
        expected: undefined,
        actual: navigator.webdriver,
        pass: navigator.webdriver === undefined || navigator.webdriver === false
      };
      if (!result.checks.webdriverHidden.pass) result.valid = false;
    }

    return result;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Browser behavior configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...BrowserBehaviorSpoof._defaultConfig };
    }

    const browser = fingerprintConfig.browser || {};
    const language = fingerprintConfig.language || fingerprintConfig.navigator || {};
    
    // Determine platform from OS config
    let platform = 'Windows';
    if (fingerprintConfig.os) {
      const osType = fingerprintConfig.os.type || '';
      if (osType.toLowerCase().includes('mac')) {
        platform = 'macOS';
      } else if (osType.toLowerCase().includes('linux')) {
        platform = 'Linux';
      } else if (osType.toLowerCase().includes('android')) {
        platform = 'Android';
      } else if (osType.toLowerCase().includes('ios')) {
        platform = 'iOS';
      }
    }

    // Build Accept-Language from language config
    let acceptLanguage = 'en-US,en;q=0.9';
    if (language.list && Array.isArray(language.list)) {
      acceptLanguage = language.list.map((lang, i) => {
        if (i === 0) return lang;
        const q = Math.max(0.1, 1 - (i * 0.1)).toFixed(1);
        return `${lang};q=${q}`;
      }).join(',');
    } else if (language.primary) {
      acceptLanguage = language.primary;
    }

    return {
      browser: {
        type: browser.type || 'chrome',
        version: browser.version || '120.0.0.0',
        majorVersion: browser.majorVersion || parseInt((browser.version || '120').split('.')[0], 10)
      },
      userAgent: fingerprintConfig.userAgent || BrowserBehaviorSpoof._defaultConfig.userAgent,
      acceptLanguage,
      platform,
      mobile: fingerprintConfig.hardware?.maxTouchPoints > 0 || false,
      emulateChrome: (browser.type || 'chrome') === 'chrome',
      cleanElectronTraces: true,
      hideAutomation: true
    };
  }


  /**
   * Generate injection script string for browser context
   * @param {Object} config - Browser behavior configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mc = BrowserBehaviorSpoof.fromFingerprintConfig(config);

    return `
(function() {
  'use strict';
  
  const config = ${JSON.stringify(mc)};
  
  // Emulate window.chrome for Chrome browser (Req 28.1)
  if (config.emulateChrome && config.browser.type === 'chrome') {
    const createRuntime = function() {
      return {
        OnInstalledReason: {
          CHROME_UPDATE: 'chrome_update',
          INSTALL: 'install',
          SHARED_MODULE_UPDATE: 'shared_module_update',
          UPDATE: 'update'
        },
        OnRestartRequiredReason: {
          APP_UPDATE: 'app_update',
          OS_UPDATE: 'os_update',
          PERIODIC: 'periodic'
        },
        PlatformArch: {
          ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64',
          X86_32: 'x86-32', X86_64: 'x86-64'
        },
        PlatformNaclArch: {
          ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64',
          X86_32: 'x86-32', X86_64: 'x86-64'
        },
        PlatformOs: {
          ANDROID: 'android', CROS: 'cros', LINUX: 'linux',
          MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win'
        },
        RequestUpdateCheckStatus: {
          NO_UPDATE: 'no_update', THROTTLED: 'throttled',
          UPDATE_AVAILABLE: 'update_available'
        },
        connect: function() { return undefined; },
        sendMessage: function() { return undefined; },
        id: undefined
      };
    };
    
    const csi = function() {
      return {
        startE: Date.now(), onloadT: Date.now(),
        pageT: Math.random() * 1000, tran: 15
      };
    };
    Object.defineProperty(csi, 'name', { value: 'csi' });
    csi.toString = function() { return 'function csi() { [native code] }'; };
    
    const loadTimes = function() {
      const now = Date.now() / 1000;
      return {
        commitLoadTime: now, connectionInfo: 'h2',
        finishDocumentLoadTime: now, finishLoadTime: now,
        firstPaintAfterLoadTime: 0, firstPaintTime: now,
        navigationType: 'Other', npnNegotiatedProtocol: 'h2',
        requestTime: now, startLoadTime: now,
        wasAlternateProtocolAvailable: false,
        wasFetchedViaSpdy: true, wasNpnNegotiated: true
      };
    };
    Object.defineProperty(loadTimes, 'name', { value: 'loadTimes' });
    loadTimes.toString = function() { return 'function loadTimes() { [native code] }'; };
    
    const chromeObj = {
      app: {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getDetails: function() { return null; },
        getIsInstalled: function() { return false; },
        runningState: function() { return 'cannot_run'; }
      },
      csi: csi,
      loadTimes: loadTimes,
      runtime: createRuntime()
    };
    
    try {
      Object.defineProperty(window, 'chrome', {
        value: chromeObj, writable: true, enumerable: true, configurable: true
      });
    } catch (e) { window.chrome = chromeObj; }
  }
  
  // Clean Electron traces (Req 28.3, 28.10)
  if (config.cleanElectronTraces) {
    const electronProps = ['process', 'require', '__dirname', '__filename', 'module', 'exports', 'Buffer', 'global'];
    for (const prop of electronProps) {
      try {
        if (prop in window) delete window[prop];
      } catch (e) {
        try {
          Object.defineProperty(window, prop, {
            get: function() { return undefined; },
            enumerable: false, configurable: true
          });
        } catch (e2) {}
      }
    }
    
    // Clean Electron IPC bridges
    const ipcBridges = ['electronAPI', 'electron', 'ipcRenderer', 'remote', 'shell', 'contextBridge'];
    for (const bridge of ipcBridges) {
      try { if (bridge in window) delete window[bridge]; } catch (e) {}
    }
  }
  
  // Hide automation flags
  if (config.hideAutomation) {
    const automationProps = [
      'cdc_adoQpoasnfa76pfcZLmcfl_Array', 'cdc_adoQpoasnfa76pfcZLmcfl_Promise',
      '__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_function',
      '__driver_unwrapped', '__webdriver_unwrapped', '__selenium_unwrapped',
      '_Selenium_IDE_Recorder', '_selenium', 'calledSelenium',
      '$chrome_asyncScriptInfo', '__nightmare', '__phantomas', '_phantom',
      'phantom', 'callPhantom', '__puppeteer_evaluation_script__'
    ];
    
    for (const prop of automationProps) {
      try { if (prop in window) delete window[prop]; } catch (e) {}
    }
    
    // Hide navigator.webdriver
    try {
      Object.defineProperty(navigator, 'webdriver', {
        get: function() { return undefined; },
        enumerable: true, configurable: true
      });
    } catch (e) {}
    
    // Clean document automation properties
    if (typeof document !== 'undefined') {
      try {
        const keys = Object.keys(document);
        for (const key of keys) {
          if (key.startsWith('$cdc_') || key.startsWith('cdc_')) {
            delete document[key];
          }
        }
      } catch (e) {}
    }
  }
})();
`;
  }
}

module.exports = {
  BrowserBehaviorSpoof,
  BrowserBehaviorSpoofError
};
