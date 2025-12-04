/**
 * Worker Interceptor - Worker拦截器
 * 
 * Intercepts all Worker creation and injects fingerprint spoofing scripts.
 * **Validates: Requirements 30.4, 30.5, 30.6, 30.7, 30.8, 30.9**
 */

'use strict';

const { NativeWrapper } = require('./native-wrapper');

class WorkerInterceptorError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'WorkerInterceptorError';
    this.code = code;
    this.details = details;
  }
}

class WorkerInterceptor {
  static _originalConstructors = { Worker: null, SharedWorker: null };
  static _originalServiceWorkerMethods = { register: null };
  static _initialized = false;

  constructor(fingerprintConfig, options = {}) {
    if (!fingerprintConfig || typeof fingerprintConfig !== 'object') {
      throw new WorkerInterceptorError('fingerprintConfig must be an object', 'INVALID_CONFIG', { type: typeof fingerprintConfig });
    }
    this._config = fingerprintConfig;
    this._injectionScript = options.injectionScript || null;
    this._scope = options.scope || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : {});
  }

  initialize() {
    if (WorkerInterceptor._initialized) return true;
    try {
      this.interceptWebWorker();
      this.interceptSharedWorker();
      this.interceptServiceWorker();
      WorkerInterceptor._initialized = true;
      return true;
    } catch (error) {
      throw new WorkerInterceptorError('Failed to initialize worker interceptor', 'INIT_FAILED', { error: error.message });
    }
  }

  interceptWebWorker() {
    const scope = this._scope;
    if (!scope.Worker) return;
    if (!WorkerInterceptor._originalConstructors.Worker) {
      WorkerInterceptor._originalConstructors.Worker = scope.Worker;
    }
    const self = this;
    const OriginalWorker = WorkerInterceptor._originalConstructors.Worker;
    const WrappedWorker = NativeWrapper.wrap(OriginalWorker, function(original, args) {
      const [scriptURL, options] = args;
      let processedURL = scriptURL;
      if (typeof scriptURL === 'string') {
        processedURL = self._createInjectedBlobURL(scriptURL, 'worker');
      } else if (scriptURL instanceof URL) {
        processedURL = self._createInjectedBlobURL(scriptURL.href, 'worker');
      }
      return new original(processedURL, options);
    }, { name: 'Worker', length: 1 });
    WrappedWorker.prototype = OriginalWorker.prototype;
    scope.Worker = WrappedWorker;
  }


  interceptSharedWorker() {
    const scope = this._scope;
    if (!scope.SharedWorker) return;
    if (!WorkerInterceptor._originalConstructors.SharedWorker) {
      WorkerInterceptor._originalConstructors.SharedWorker = scope.SharedWorker;
    }
    const self = this;
    const OriginalSharedWorker = WorkerInterceptor._originalConstructors.SharedWorker;
    const WrappedSharedWorker = NativeWrapper.wrap(OriginalSharedWorker, function(original, args) {
      const [scriptURL, options] = args;
      let processedURL = scriptURL;
      if (typeof scriptURL === 'string') {
        processedURL = self._createInjectedBlobURL(scriptURL, 'sharedworker');
      } else if (scriptURL instanceof URL) {
        processedURL = self._createInjectedBlobURL(scriptURL.href, 'sharedworker');
      }
      return new original(processedURL, options);
    }, { name: 'SharedWorker', length: 1 });
    WrappedSharedWorker.prototype = OriginalSharedWorker.prototype;
    scope.SharedWorker = WrappedSharedWorker;
  }

  interceptServiceWorker() {
    const scope = this._scope;
    if (!scope.navigator || !scope.navigator.serviceWorker) return;
    const serviceWorker = scope.navigator.serviceWorker;
    if (!WorkerInterceptor._originalServiceWorkerMethods.register) {
      WorkerInterceptor._originalServiceWorkerMethods.register = serviceWorker.register.bind(serviceWorker);
    }
    const originalRegister = WorkerInterceptor._originalServiceWorkerMethods.register;
    const wrappedRegister = NativeWrapper.wrap(originalRegister, async function(original, args) {
      const [scriptURL, options] = args;
      return original.call(serviceWorker, scriptURL, options);
    }, { name: 'register', length: 1 });
    serviceWorker.register = wrappedRegister;
  }

  _createInjectedBlobURL(originalURL, workerType) {
    const injectedScript = this.createInjectedWorkerScript(originalURL, workerType);
    const scope = this._scope;
    const BlobClass = scope.Blob || Blob;
    const URLClass = scope.URL || URL;
    const blob = new BlobClass([injectedScript], { type: 'application/javascript' });
    return URLClass.createObjectURL(blob);
  }

  createInjectedWorkerScript(originalURL, workerType = 'worker') {
    const injectionScript = this._getInjectionScript();
    const configJSON = JSON.stringify(this._config);
    return `
(function() {
  'use strict';
  const __fingerprintConfig__ = ${configJSON};
  ${this._generateNavigatorSpoofing()}
  ${injectionScript}
  ${this._generateNestedWorkerInterception()}
})();
${this._generateImportStatement(originalURL, workerType)}
`;
  }


  _generateNavigatorSpoofing() {
    const config = this._config;
    const navigator = config.navigator || {};
    const hardware = config.hardware || {};
    return `
  if (typeof navigator !== 'undefined') {
    const navigatorOverrides = {
      userAgent: ${JSON.stringify(config.userAgent || navigator.userAgent || '')},
      language: ${JSON.stringify(navigator.language || 'en-US')},
      languages: ${JSON.stringify(navigator.languages || ['en-US'])},
      hardwareConcurrency: ${hardware.cpuCores || 4},
      deviceMemory: ${hardware.deviceMemory || 8},
      platform: ${JSON.stringify(config.os?.platform || 'Win32')}
    };
    for (const [key, value] of Object.entries(navigatorOverrides)) {
      try {
        Object.defineProperty(navigator, key, {
          get: function() { return value; },
          configurable: true,
          enumerable: true
        });
      } catch (e) {}
    }
  }
`;
  }

  _generateNestedWorkerInterception() {
    const configJSON = JSON.stringify(this._config);
    const injectionScript = this._getInjectionScript();
    const origin = (this._scope && this._scope.location && this._scope.location.origin) ? this._scope.location.origin : '';
    return `
  if (typeof Worker !== 'undefined') {
    const OriginalWorker = Worker;
    const __nestedConfig__ = ${configJSON};
    const __nestedInjectionScript__ = ${JSON.stringify(injectionScript)};
    self.Worker = function(scriptURL, options) {
      const __origin__ = ${JSON.stringify(origin)};
      const nestedScript = '(function() { const __fingerprintConfig__ = ' + JSON.stringify(__nestedConfig__) + '; ' + __nestedInjectionScript__ + ' })(); ' +
        'importScripts(' + (function(u){ try { return JSON.stringify(new URL(u, __origin__).href); } catch(e) { return JSON.stringify(u); } }) (String(scriptURL)) + ');';
      const blob = new Blob([nestedScript], { type: 'application/javascript' });
      const blobURL = URL.createObjectURL(blob);
      return new OriginalWorker(blobURL, options);
    };
    Object.defineProperty(self.Worker, 'name', { value: 'Worker' });
    Object.defineProperty(self.Worker, 'length', { value: 1 });
    self.Worker.toString = function() { return 'function Worker() { [native code] }'; };
    self.Worker.prototype = OriginalWorker.prototype;
  }
`;
  }

  _generateImportStatement(originalURL, workerType) {
    const origin = (this._scope && this._scope.location && this._scope.location.origin) ? this._scope.location.origin : '';
    return `
try {
  (function(){
    var __origin__ = ${JSON.stringify(origin)};
    var __url__ = ${JSON.stringify(originalURL)};
    try { __url__ = new URL(__url__, __origin__).href; } catch (e) {}
    importScripts(__url__);
  })();
} catch (e) {
  console.error('[FingerprintInjector] Failed to import ${workerType} script:', e);
  ${workerType !== 'serviceworker' ? 'throw e;' : ''}
}
`;
  }

  _getInjectionScript() {
    return this._injectionScript || `console.log('[FingerprintInjector] Worker fingerprint injection active');`;
  }

  setInjectionScript(script) {
    if (typeof script !== 'string') {
      throw new WorkerInterceptorError('Injection script must be a string', 'INVALID_SCRIPT', { type: typeof script });
    }
    this._injectionScript = script;
  }

  _isSameOrigin(url) {
    try {
      const scope = this._scope;
      const currentOrigin = scope.location?.origin;
      if (!currentOrigin) return false;
      const URLClass = scope.URL || URL;
      const targetURL = new URLClass(url, currentOrigin);
      return targetURL.origin === currentOrigin;
    } catch (e) {
      return false;
    }
  }

  getConfig() { return this._config; }

  updateConfig(newConfig) {
    if (!newConfig || typeof newConfig !== 'object') {
      throw new WorkerInterceptorError('newConfig must be an object', 'INVALID_CONFIG', { type: typeof newConfig });
    }
    this._config = { ...this._config, ...newConfig };
  }

  static isInitialized() { return WorkerInterceptor._initialized; }
  static getOriginalWorker() { return WorkerInterceptor._originalConstructors.Worker; }
  static getOriginalSharedWorker() { return WorkerInterceptor._originalConstructors.SharedWorker; }
  static getOriginalServiceWorkerRegister() { return WorkerInterceptor._originalServiceWorkerMethods.register; }


  static reset(scope) {
    if (WorkerInterceptor._originalConstructors.Worker && scope && scope.Worker) {
      scope.Worker = WorkerInterceptor._originalConstructors.Worker;
    }
    if (WorkerInterceptor._originalConstructors.SharedWorker && scope && scope.SharedWorker) {
      scope.SharedWorker = WorkerInterceptor._originalConstructors.SharedWorker;
    }
    if (WorkerInterceptor._originalServiceWorkerMethods.register && scope && scope.navigator && scope.navigator.serviceWorker) {
      scope.navigator.serviceWorker.register = WorkerInterceptor._originalServiceWorkerMethods.register;
    }
    WorkerInterceptor._originalConstructors = { Worker: null, SharedWorker: null };
    WorkerInterceptor._originalServiceWorkerMethods = { register: null };
    WorkerInterceptor._initialized = false;
  }

  static createStandaloneInjectionScript(config) {
    const configJSON = JSON.stringify(config);
    const navigator = config.navigator || {};
    const hardware = config.hardware || {};
    return `
(function() {
  'use strict';
  const __fingerprintConfig__ = ${configJSON};
  if (typeof navigator !== 'undefined') {
    const overrides = {
      userAgent: ${JSON.stringify(config.userAgent || '')},
      language: ${JSON.stringify(navigator.language || 'en-US')},
      languages: ${JSON.stringify(navigator.languages || ['en-US'])},
      hardwareConcurrency: ${hardware.cpuCores || 4},
      deviceMemory: ${hardware.deviceMemory || 8},
      platform: ${JSON.stringify(config.os?.platform || 'Win32')}
    };
    for (const [key, value] of Object.entries(overrides)) {
      try {
        Object.defineProperty(navigator, key, { get: () => value, configurable: true });
      } catch (e) {}
    }
  }
  console.log('[FingerprintInjector] Standalone injection active');
})();
`;
  }

  static verify(scope) {
    const result = { valid: true, checks: {} };
    if (scope && scope.Worker) {
      const workerToString = scope.Worker.toString();
      result.checks.worker = {
        intercepted: WorkerInterceptor._originalConstructors.Worker !== null,
        looksNative: workerToString.includes('[native code]'),
        hasCorrectName: scope.Worker.name === 'Worker'
      };
      if (!result.checks.worker.intercepted || !result.checks.worker.looksNative) result.valid = false;
    }
    if (scope && scope.SharedWorker) {
      const sharedWorkerToString = scope.SharedWorker.toString();
      result.checks.sharedWorker = {
        intercepted: WorkerInterceptor._originalConstructors.SharedWorker !== null,
        looksNative: sharedWorkerToString.includes('[native code]'),
        hasCorrectName: scope.SharedWorker.name === 'SharedWorker'
      };
      if (!result.checks.sharedWorker.intercepted || !result.checks.sharedWorker.looksNative) result.valid = false;
    }
    if (scope && scope.navigator && scope.navigator.serviceWorker) {
      const registerToString = scope.navigator.serviceWorker.register.toString();
      result.checks.serviceWorker = {
        intercepted: WorkerInterceptor._originalServiceWorkerMethods.register !== null,
        looksNative: registerToString.includes('[native code]'),
        hasCorrectName: scope.navigator.serviceWorker.register.name === 'register'
      };
      if (!result.checks.serviceWorker.intercepted || !result.checks.serviceWorker.looksNative) result.valid = false;
    }
    result.checks.initialized = WorkerInterceptor._initialized;
    return result;
  }
}

module.exports = { WorkerInterceptor, WorkerInterceptorError };
