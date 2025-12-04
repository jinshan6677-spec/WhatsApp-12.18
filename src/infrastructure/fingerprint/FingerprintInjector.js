/**
 * Fingerprint Injector
 * 指纹注入器
 * 
 * Aggregates all injection script modules and provides unified methods for
 * generating injection scripts for different contexts (main page, preload, iframe, worker).
 * 
 * @module infrastructure/fingerprint/FingerprintInjector
 * 
 * Requirements:
 * - 30.1: Complete fingerprint injection before any page script executes
 * - 30.2: Safely inject fingerprint overrides through contextBridge in preload scripts
 * - 30.3: Ensure iframes also apply the same fingerprint configuration
 */

'use strict';

const {
  ScriptGenerator,
  ScriptGeneratorError,
  WorkerInterceptor,
  NativeWrapper
} = require('./injection-scripts');

/**
 * Error class for fingerprint injector operations
 */
class FingerprintInjectorError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'FingerprintInjectorError';
    this.code = code;
    this.details = details;
  }

  static invalidConfig(details) {
    return new FingerprintInjectorError(
      'Invalid fingerprint configuration',
      'INVALID_CONFIG',
      details
    );
  }

  static generationFailed(context, originalError) {
    return new FingerprintInjectorError(
      `Failed to generate ${context} injection script`,
      'GENERATION_FAILED',
      { context, originalError: originalError.message }
    );
  }
}

/**
 * FingerprintInjector class
 * Provides unified interface for generating fingerprint injection scripts
 * for different execution contexts.
 * 
 * **Validates: Requirements 30.1, 30.2, 30.3**
 */
class FingerprintInjector {
  /**
   * Default options for script generation
   * @private
   */
  static _defaultOptions = {
    minify: false,
    includeWorkerInterceptor: true,
    includeIframeProtection: true,
    strictMode: true
  };

  /**
   * Creates a FingerprintInjector instance
   * @param {Object} fingerprintConfig - Fingerprint configuration object
   * @param {Object} [options] - Injector options
   * @param {boolean} [options.minify=false] - Whether to minify generated scripts
   * @param {boolean} [options.includeWorkerInterceptor=true] - Include worker interception
   * @param {boolean} [options.includeIframeProtection=true] - Include iframe protection
   * @param {boolean} [options.strictMode=true] - Use strict mode in generated scripts
   */
  constructor(fingerprintConfig, options = {}) {
    if (!fingerprintConfig || typeof fingerprintConfig !== 'object') {
      throw FingerprintInjectorError.invalidConfig({
        type: typeof fingerprintConfig,
        message: 'fingerprintConfig must be an object'
      });
    }

    this._config = fingerprintConfig;
    this._options = { ...FingerprintInjector._defaultOptions, ...options };
    this._cachedScripts = new Map();
    this._generationTime = null;
  }

  /**
   * Gets the fingerprint configuration
   * @returns {Object} Fingerprint configuration
   */
  getConfig() {
    return this._config;
  }

  /**
   * Updates the fingerprint configuration
   * @param {Object} newConfig - New fingerprint configuration
   */
  updateConfig(newConfig) {
    if (!newConfig || typeof newConfig !== 'object') {
      throw FingerprintInjectorError.invalidConfig({
        type: typeof newConfig,
        message: 'newConfig must be an object'
      });
    }
    this._config = { ...this._config, ...newConfig };
    this._invalidateCache();
  }

  /**
   * Invalidates the cached scripts
   * @private
   */
  _invalidateCache() {
    this._cachedScripts.clear();
    this._generationTime = null;
  }

  /**
   * Gets the complete injection script for main page context
   * This is the primary injection script that should be executed before any page scripts.
   * 
   * @param {Object} [options] - Generation options
   * @param {string[]} [options.include] - Modules to include
   * @param {string[]} [options.exclude] - Modules to exclude
   * @param {boolean} [options.minify] - Override minify option
   * @returns {string} Complete injection script
   * 
   * **Validates: Requirement 30.1**
   */
  getInjectionScript(options = {}) {
    const cacheKey = `injection:${JSON.stringify(options)}`;
    
    if (this._cachedScripts.has(cacheKey)) {
      return this._cachedScripts.get(cacheKey);
    }

    const startTime = Date.now();

    try {
      const mergedOptions = {
        ...this._options,
        ...options,
        minify: options.minify !== undefined ? options.minify : this._options.minify
      };

      let script = ScriptGenerator.generateScript(this._config, mergedOptions);

      // Add worker interceptor if enabled
      if (mergedOptions.includeWorkerInterceptor) {
        script = this._wrapWithWorkerInterceptor(script);
      }

      // Add iframe protection if enabled
      if (mergedOptions.includeIframeProtection) {
        script = this._wrapWithIframeProtection(script);
      }

      this._generationTime = Date.now() - startTime;
      this._cachedScripts.set(cacheKey, script);

      return script;
    } catch (error) {
      throw FingerprintInjectorError.generationFailed('main', error);
    }
  }

  /**
   * Gets the preload script for Electron's contextBridge
   * This script is designed to be used in Electron's preload context.
   * 
   * @param {Object} [options] - Generation options
   * @returns {string} Preload-safe injection script
   * 
   * **Validates: Requirement 30.2**
   */
  getPreloadScript(options = {}) {
    const cacheKey = `preload:${JSON.stringify(options)}`;
    
    if (this._cachedScripts.has(cacheKey)) {
      return this._cachedScripts.get(cacheKey);
    }

    const startTime = Date.now();

    try {
      const configJSON = JSON.stringify(this._config);
      const allowNavigatorProxy = options.allowNavigatorProxy === true;
      const baseScript = this.getInjectionScript({
        ...options,
        minify: true // Preload scripts should be minified for performance
      });

      // Wrap in a format suitable for Electron preload
      const preloadScript = `
/**
 * Fingerprint Injection Preload Script
 * Generated at: ${new Date().toISOString()}
 * 
 * This script should be executed in Electron's preload context
 * using contextBridge.exposeInMainWorld or webFrame.executeJavaScript
 */

'use strict';

const { contextBridge, webFrame } = require('electron');

// Fingerprint configuration
const __fingerprintConfig__ = ${configJSON};

function forceNavigatorOverrides(cfg) {
  try {
    const overrides = {
      userAgent: cfg.userAgent,
      language: (cfg.navigator && cfg.navigator.language) || 'en-US',
      languages: (cfg.navigator && cfg.navigator.languages) || ['en-US','en'],
      hardwareConcurrency: (cfg.hardware && cfg.hardware.cpuCores) || 8,
      deviceMemory: (cfg.hardware && cfg.hardware.deviceMemory) || 8,
      platform: (cfg.os && cfg.os.platform) || 'Win32',
      webdriver: false
    };
    const proto = (typeof Navigator !== 'undefined') ? Navigator.prototype : null;
    const createGetter = (key, val) => { return function() { return val; } };
    if (proto) {
      for (const [k,v] of Object.entries(overrides)) {
        try { Object.defineProperty(proto, k, { get: createGetter(k,v), configurable: true, enumerable: true }); } catch (_) {}
      }
    }
    for (const [k,v] of Object.entries(overrides)) {
      try { Object.defineProperty(navigator, k, { get: createGetter(k,v), configurable: true, enumerable: true }); } catch (_) {}
    }
    if (${allowNavigatorProxy ? 'true' : 'false'}) {
      try {
        const proxied = new Proxy(navigator, { get(target, prop, receiver) {
          if (prop === 'userAgent') return overrides.userAgent;
          if (prop === 'language') return overrides.language;
          if (prop === 'languages') return Object.freeze([].concat(overrides.languages));
          if (prop === 'hardwareConcurrency') return overrides.hardwareConcurrency;
          if (prop === 'deviceMemory') return overrides.deviceMemory;
          if (prop === 'platform') return overrides.platform;
          if (prop === 'webdriver') return false;
          return Reflect.get(target, prop, receiver);
        }});
        Object.defineProperty(window, 'navigator', { get: function(){ return proxied; }, configurable: true, enumerable: true });
      } catch (_) {}
    }
  } catch (_) {}
}

/**
 * Inject fingerprint spoofing into the main world
 */
function injectFingerprint() {
  const injectionScript = ${JSON.stringify(baseScript)};
  
  try {
    forceNavigatorOverrides(__fingerprintConfig__);
    try {
      if (__fingerprintConfig__ && __fingerprintConfig__.hardware && typeof __fingerprintConfig__.hardware.devicePixelRatio === 'number' && __fingerprintConfig__.hardware.devicePixelRatio > 0 && typeof webFrame !== 'undefined' && typeof webFrame.setZoomFactor === 'function') {
        const currentDPR = (typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number' && window.devicePixelRatio > 0) ? window.devicePixelRatio : 1;
        const targetDPR = __fingerprintConfig__.hardware.devicePixelRatio;
        const targetZoom = targetDPR / currentDPR;
        if (targetZoom > 0 && targetZoom !== 1) {
          webFrame.setZoomFactor(targetZoom);
        }
      }
    } catch (_) {}
    // Execute in main world context
    webFrame.executeJavaScript(injectionScript, true);
    return { success: true };
  } catch (error) {
    console.error('[FingerprintInjector] Preload injection failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Expose fingerprint API to renderer (optional)
 */
function exposeAPI() {
  try {
    contextBridge.exposeInMainWorld('__fingerprintAPI__', {
      getConfig: () => ({ ...__fingerprintConfig__ }),
      isInjected: () => true,
      version: '1.0.0'
    });
  } catch (error) {
    // contextBridge may not be available in all contexts
    console.warn('[FingerprintInjector] Could not expose API:', error.message);
  }
}

// Auto-inject on load
const result = injectFingerprint();
if (result.success) {
  exposeAPI();
}

module.exports = {
  injectFingerprint,
  exposeAPI,
  config: __fingerprintConfig__
};
`.trim();

      this._generationTime = Date.now() - startTime;
      this._cachedScripts.set(cacheKey, preloadScript);

      return preloadScript;
    } catch (error) {
      throw FingerprintInjectorError.generationFailed('preload', error);
    }
  }

  /**
   * Gets the injection script for iframe contexts
   * This script ensures iframes also apply the same fingerprint configuration.
   * 
   * @param {Object} [options] - Generation options
   * @param {boolean} [options.sameOriginOnly=true] - Only inject into same-origin iframes
   * @returns {string} Iframe injection script
   * 
   * **Validates: Requirement 30.3**
   */
  getIframeScript(options = {}) {
    const { sameOriginOnly = true } = options;
    const cacheKey = `iframe:${JSON.stringify(options)}`;
    
    if (this._cachedScripts.has(cacheKey)) {
      return this._cachedScripts.get(cacheKey);
    }

    const startTime = Date.now();

    try {
      const configJSON = JSON.stringify(this._config);
      const baseScript = this.getInjectionScript({
        ...options,
        includeWorkerInterceptor: false, // Workers handled separately in iframes
        includeIframeProtection: false,  // Prevent recursion
        minify: true
      });

      const iframeScript = `
/**
 * Fingerprint Injection Script for iframes
 * Generated at: ${new Date().toISOString()}
 */

(function() {
  'use strict';
  
  const __fingerprintConfig__ = ${configJSON};
  const __sameOriginOnly__ = ${sameOriginOnly};
  const __injectionScript__ = ${JSON.stringify(baseScript)};
  
  /**
   * Check if iframe is same-origin
   */
  function isSameOrigin(iframe) {
    try {
      // Accessing contentWindow.location will throw for cross-origin
      const iframeOrigin = iframe.contentWindow.location.origin;
      return iframeOrigin === window.location.origin;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Inject fingerprint into iframe
   */
  function injectIntoIframe(iframe) {
    if (__sameOriginOnly__ && !isSameOrigin(iframe)) {
      return false;
    }
    
    try {
      const iframeWindow = iframe.contentWindow;
      if (!iframeWindow) return false;
      
      // Check if already injected
      if (iframeWindow.__fingerprintInjected__) return true;

      // Create and execute script in iframe context
      const script = iframeWindow.document.createElement('script');
      script.textContent = __injectionScript__;
      
      // Insert at the beginning of head or body
      const target = iframeWindow.document.head || iframeWindow.document.body || iframeWindow.document.documentElement;
      if (target) {
        target.insertBefore(script, target.firstChild);
        iframeWindow.__fingerprintInjected__ = true;
        return true;
      }
    } catch (error) {
      // console.warn('[FingerprintInjector] Failed to inject into iframe:', error.message);
    }
    return false;
  }

  // 1. Intercept document.createElement
  // This helps catch iframes created via script before they are inserted
  try {
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName, options) {
      const element = originalCreateElement.call(document, tagName, options);
      if (tagName && String(tagName).toLowerCase() === 'iframe') {
        // Try to inject immediately if possible, or setup listeners
        try {
          element.addEventListener('load', function() { injectIntoIframe(element); });
        } catch (e) {}
      }
      return element;
    };
  } catch (e) {}

  // 2. Intercept Node.prototype methods to catch synchronous insertion
  try {
    const originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function(child) {
      const result = originalAppendChild.call(this, child);
      if (child && child.nodeName === 'IFRAME') {
        injectIntoIframe(child);
      }
      return result;
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function(newNode, referenceNode) {
      const result = originalInsertBefore.call(this, newNode, referenceNode);
      if (newNode && newNode.nodeName === 'IFRAME') {
        injectIntoIframe(newNode);
      }
      return result;
    };
  } catch (e) {}
  
  // 3. Intercept property access on iframes to catch late access
  try {
    const iframeProto = HTMLIFrameElement.prototype;
    const originalContentWindow = Object.getOwnPropertyDescriptor(iframeProto, 'contentWindow');
    const originalContentDocument = Object.getOwnPropertyDescriptor(iframeProto, 'contentDocument');

    if (originalContentWindow && originalContentWindow.get) {
      Object.defineProperty(iframeProto, 'contentWindow', {
        get: function() {
          const win = originalContentWindow.get.call(this);
          try {
            if (win && !win.__fingerprintInjected__) {
              injectIntoIframe(this);
            }
          } catch (e) {}
          return win;
        },
        configurable: true,
        enumerable: true
      });
    }
    
    if (originalContentDocument && originalContentDocument.get) {
       Object.defineProperty(iframeProto, 'contentDocument', {
        get: function() {
          const doc = originalContentDocument.get.call(this);
          try {
            if (doc && doc.defaultView && !doc.defaultView.__fingerprintInjected__) {
               injectIntoIframe(this);
            }
          } catch (e) {}
          return doc;
        },
        configurable: true,
        enumerable: true
      });
    }
  } catch(e) {}

  
  /**
   * Process all existing iframes
   */
  function processExistingIframes() {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(function(iframe) {
      if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        injectIntoIframe(iframe);
      } else {
        iframe.addEventListener('load', function() {
          injectIntoIframe(iframe);
        }, { once: true });
      }
    });
  }
  
  /**
   * Observe for new iframes
   */
  function observeNewIframes() {
    if (typeof MutationObserver === 'undefined') return;
    
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeName === 'IFRAME') {
            if (node.contentDocument && node.contentDocument.readyState === 'complete') {
              injectIntoIframe(node);
            } else {
              node.addEventListener('load', function() {
                injectIntoIframe(node);
              }, { once: true });
            }
          }
          // Also check for iframes in added subtrees
          if (node.querySelectorAll) {
            node.querySelectorAll('iframe').forEach(function(iframe) {
              if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                injectIntoIframe(iframe);
              } else {
                iframe.addEventListener('load', function() {
                  injectIntoIframe(iframe);
                }, { once: true });
              }
            });
          }
        });
      });
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      processExistingIframes();
      observeNewIframes();
    });
  } else {
    processExistingIframes();
    observeNewIframes();
  }
})();
`.trim();

      this._generationTime = Date.now() - startTime;
      this._cachedScripts.set(cacheKey, iframeScript);

      return iframeScript;
    } catch (error) {
      throw FingerprintInjectorError.generationFailed('iframe', error);
    }
  }

  /**
   * Gets the injection script for Worker contexts
   * This script is designed to be injected into Web Workers, Shared Workers, and Service Workers.
   * 
   * @param {Object} [options] - Generation options
   * @param {string} [options.workerType='worker'] - Type of worker (worker, sharedworker, serviceworker)
   * @returns {string} Worker injection script
   * 
   * **Validates: Requirements 30.4, 30.5, 30.6**
   */
  getWorkerScript(options = {}) {
    const { workerType = 'worker' } = options;
    const cacheKey = `worker:${workerType}:${JSON.stringify(options)}`;
    
    if (this._cachedScripts.has(cacheKey)) {
      return this._cachedScripts.get(cacheKey);
    }

    const startTime = Date.now();

    try {
      // Generate a worker-safe injection script including navigator + webgl + screen
      const workerBaseScript = ScriptGenerator.generateScript(this._config, {
        include: ['navigator','webgl','screen'],
        includeWorkerInterceptor: false,
        includeIframeProtection: false,
        minify: true
      });

      const workerScript = workerBaseScript;

      this._generationTime = Date.now() - startTime;
      this._cachedScripts.set(cacheKey, workerScript);

      return workerScript;
    } catch (error) {
      throw FingerprintInjectorError.generationFailed('worker', error);
    }
  }

  /**
   * Wraps the injection script with worker interceptor code
   * @private
   */
  _wrapWithWorkerInterceptor(script) {
    const configJSON = JSON.stringify(this._config);
    const workerScript = this.getWorkerScript({ workerType: 'worker' });

    return `
${script}

// === WORKER INTERCEPTOR ===
(function() {
  'use strict';
  
  const __workerConfig__ = ${configJSON};
  const __workerInjectionScript__ = ${JSON.stringify(workerScript)};
  const __pageOrigin__ = (function(){ try { return window.location.origin; } catch (e) { return ''; } })();
  
  if (typeof Worker !== 'undefined') {
    const OriginalWorker = Worker;
    
    window.Worker = function(scriptURL, options) {
      let processedURL = scriptURL;
      
      if (typeof scriptURL === 'string' || scriptURL instanceof URL) {
        const urlString = scriptURL instanceof URL ? scriptURL.href : scriptURL;
        let absUrl = urlString; try { absUrl = new URL(urlString, __pageOrigin__).href; } catch (e) {}
        const injectedScript = __workerInjectionScript__ + '\\n\\nimportScripts("' + absUrl + '");';
        const blob = new Blob([injectedScript], { type: 'application/javascript' });
        processedURL = URL.createObjectURL(blob);
      }
      
      return new OriginalWorker(processedURL, options);
    };
    
    Object.defineProperty(window.Worker, 'name', { value: 'Worker', configurable: true });
    Object.defineProperty(window.Worker, 'length', { value: 1, configurable: true });
    window.Worker.toString = function() { return 'function Worker() { [native code] }'; };
    window.Worker.prototype = OriginalWorker.prototype;
  }
  
  if (typeof SharedWorker !== 'undefined') {
    const OriginalSharedWorker = SharedWorker;
    
    window.SharedWorker = function(scriptURL, options) {
      let processedURL = scriptURL;
      
      if (typeof scriptURL === 'string' || scriptURL instanceof URL) {
        const urlString = scriptURL instanceof URL ? scriptURL.href : scriptURL;
        let absUrl = urlString; try { absUrl = new URL(urlString, __pageOrigin__).href; } catch (e) {}
        const injectedScript = __workerInjectionScript__ + '\\n\\nimportScripts("' + absUrl + '");';
        const blob = new Blob([injectedScript], { type: 'application/javascript' });
        processedURL = URL.createObjectURL(blob);
      }
      
      return new OriginalSharedWorker(processedURL, options);
    };
    
    Object.defineProperty(window.SharedWorker, 'name', { value: 'SharedWorker', configurable: true });
    Object.defineProperty(window.SharedWorker, 'length', { value: 1, configurable: true });
    window.SharedWorker.toString = function() { return 'function SharedWorker() { [native code] }'; };
    window.SharedWorker.prototype = OriginalSharedWorker.prototype;
  }
})();
`.trim();
  }

  /**
   * Wraps the injection script with iframe protection code
   * @private
   */
  _wrapWithIframeProtection(script) {
    const iframeScript = this.getIframeScript({ sameOriginOnly: true });
    
    return `
${script}

// === IFRAME PROTECTION ===
${iframeScript}
`.trim();
  }

  /**
   * Gets the last script generation time in milliseconds
   * @returns {number|null} Generation time or null if not generated yet
   */
  getGenerationTime() {
    return this._generationTime;
  }

  /**
   * Clears the script cache
   */
  clearCache() {
    this._invalidateCache();
  }

  /**
   * Gets statistics about cached scripts
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      cachedScripts: this._cachedScripts.size,
      lastGenerationTime: this._generationTime,
      cacheKeys: Array.from(this._cachedScripts.keys())
    };
  }

  /**
   * Validates that the injector is properly configured
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Check required config fields
    if (!this._config.userAgent) {
      warnings.push('userAgent is not set, using default');
    }

    if (!this._config.navigator) {
      warnings.push('navigator config is not set, using defaults');
    }

    if (!this._config.hardware) {
      warnings.push('hardware config is not set, using defaults');
    }

    // Check for potential issues
    if (this._config.webrtc?.mode === 'real') {
      warnings.push('WebRTC mode is "real", IP may be exposed');
    }

    if (this._config.canvas?.mode === 'off') {
      warnings.push('Canvas spoofing is disabled');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Creates a standalone injection script that can be used without the injector
   * @param {Object} config - Fingerprint configuration
   * @param {Object} [options] - Generation options
   * @returns {string} Standalone injection script
   */
  static createStandaloneScript(config, options = {}) {
    const injector = new FingerprintInjector(config, options);
    return injector.getInjectionScript(options);
  }

  /**
   * Gets the list of available spoof modules
   * @returns {string[]} Array of module names
   */
  static getAvailableModules() {
    return ScriptGenerator.getAvailableModules();
  }

  /**
   * Checks if a specific module is available
   * @param {string} moduleName - Name of the module
   * @returns {boolean} True if module exists
   */
  static hasModule(moduleName) {
    return ScriptGenerator.hasModule(moduleName);
  }
}

module.exports = {
  FingerprintInjector,
  FingerprintInjectorError
};
