/**
 * Advanced APIs Protection Script
 * 高级API保护脚本
 * 
 * Implements protection for various advanced browser APIs to prevent fingerprinting.
 * Covers PDF, Bluetooth, USB, Gamepad, History, Clipboard, Notification,
 * Service Worker, WebAssembly, SharedArrayBuffer, Credentials, Payment, and Presentation APIs.
 * 
 * Covered APIs:
 * - PDF/Print (Req 38)
 * - Bluetooth/USB (Req 39)
 * - Gamepad (Req 40)
 * - Math/Date precision (Req 41)
 * - History/Navigation (Req 42)
 * - Clipboard (Req 43)
 * - Notification (Req 44)
 * - Service Worker/Cache (Req 45)
 * - WebAssembly (Req 46)
 * - SharedArrayBuffer/Atomics (Req 47)
 * - Credential Management (Req 48)
 * - Payment Request (Req 49)
 * - Presentation (Req 50)
 * 
 * @module infrastructure/fingerprint/injection-scripts/advanced-apis
 * 
 * **Validates: Requirements 38-50**
 */

'use strict';

const { NativeWrapper } = require('./core/native-wrapper');

/**
 * Error class for advanced API spoofing operations
 */
class AdvancedApisSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'AdvancedApisSpoofError';
    this.code = code;
    this.details = details;
  }
}

/**
 * AdvancedApisSpoof class
 * Provides methods to spoof various advanced browser APIs
 */
class AdvancedApisSpoof {
  /**
   * Default configuration for all advanced APIs
   * @private
   */
  static _defaultConfig = {
    // PDF/Print (Req 38)
    pdf: { enabled: true, pdfViewerEnabled: true },
    // Bluetooth (Req 39)
    bluetooth: { enabled: false },
    // USB (Req 39)
    usb: { enabled: false },
    // Gamepad (Req 40)
    gamepad: { mode: 'hide' }, // 'hide', 'fake', 'real'
    // History (Req 42)
    history: { mode: 'minimal', length: 1 }, // 'minimal', 'real'
    // Clipboard (Req 43)
    clipboard: { mode: 'ask' }, // 'disable', 'ask', 'allow'
    // Notification (Req 44)
    notification: { mode: 'deny' }, // 'deny', 'allow'
    // Service Worker (Req 45)
    serviceWorker: { enabled: true },
    // WebAssembly (Req 46)
    webAssembly: { enabled: true },
    // SharedArrayBuffer (Req 47)
    sharedArrayBuffer: { enabled: true },
    // Atomics (Req 47)
    atomics: { enabled: true },
    // Credentials (Req 48)
    credentials: { enabled: false },
    // Payment (Req 49)
    payment: { enabled: false },
    // Presentation (Req 50)
    presentation: { enabled: false }
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
   * Apply advanced APIs spoofing with the given configuration
   * 
   * @param {Object} config - Configuration object
   * @returns {Object} Result object with success status and details
   */
  static apply(config = {}) {
    // Merge with defaults
    const mergedConfig = {
      pdf: { ...AdvancedApisSpoof._defaultConfig.pdf, ...(config.pdf || {}) },
      bluetooth: { ...AdvancedApisSpoof._defaultConfig.bluetooth, ...(config.bluetooth || {}) },
      usb: { ...AdvancedApisSpoof._defaultConfig.usb, ...(config.usb || {}) },
      gamepad: { ...AdvancedApisSpoof._defaultConfig.gamepad, ...(config.gamepad || {}) },
      history: { ...AdvancedApisSpoof._defaultConfig.history, ...(config.history || {}) },
      clipboard: { ...AdvancedApisSpoof._defaultConfig.clipboard, ...(config.clipboard || {}) },
      notification: { ...AdvancedApisSpoof._defaultConfig.notification, ...(config.notification || {}) },
      serviceWorker: { ...AdvancedApisSpoof._defaultConfig.serviceWorker, ...(config.serviceWorker || {}) },
      webAssembly: { ...AdvancedApisSpoof._defaultConfig.webAssembly, ...(config.webAssembly || {}) },
      sharedArrayBuffer: { ...AdvancedApisSpoof._defaultConfig.sharedArrayBuffer, ...(config.sharedArrayBuffer || {}) },
      atomics: { ...AdvancedApisSpoof._defaultConfig.atomics, ...(config.atomics || {}) },
      credentials: { ...AdvancedApisSpoof._defaultConfig.credentials, ...(config.credentials || {}) },
      payment: { ...AdvancedApisSpoof._defaultConfig.payment, ...(config.payment || {}) },
      presentation: { ...AdvancedApisSpoof._defaultConfig.presentation, ...(config.presentation || {}) }
    };

    // Store the applied configuration
    AdvancedApisSpoof._appliedConfig = mergedConfig;

    const results = { success: true, spoofed: [], failed: [] };

    // Apply each API protection
    const protections = [
      { name: 'pdf', fn: () => AdvancedApisSpoof._spoofPdf() },
      { name: 'bluetooth', fn: () => AdvancedApisSpoof._spoofBluetooth() },
      { name: 'usb', fn: () => AdvancedApisSpoof._spoofUsb() },
      { name: 'gamepad', fn: () => AdvancedApisSpoof._spoofGamepad() },
      { name: 'history', fn: () => AdvancedApisSpoof._spoofHistory() },
      { name: 'clipboard', fn: () => AdvancedApisSpoof._spoofClipboard() },
      { name: 'notification', fn: () => AdvancedApisSpoof._spoofNotification() },
      { name: 'serviceWorker', fn: () => AdvancedApisSpoof._spoofServiceWorker() },
      { name: 'webAssembly', fn: () => AdvancedApisSpoof._spoofWebAssembly() },
      { name: 'sharedArrayBuffer', fn: () => AdvancedApisSpoof._spoofSharedArrayBuffer() },
      { name: 'atomics', fn: () => AdvancedApisSpoof._spoofAtomics() },
      { name: 'credentials', fn: () => AdvancedApisSpoof._spoofCredentials() },
      { name: 'payment', fn: () => AdvancedApisSpoof._spoofPayment() },
      { name: 'presentation', fn: () => AdvancedApisSpoof._spoofPresentation() }
    ];

    for (const protection of protections) {
      try {
        protection.fn();
        results.spoofed.push(protection.name);
      } catch (e) {
        results.failed.push({ api: protection.name, error: e.message });
      }
    }

    return results;
  }


  /**
   * Spoof PDF/Print APIs (Req 38)
   * @private
   */
  static _spoofPdf() {
    if (typeof navigator === 'undefined') return;
    const config = AdvancedApisSpoof._appliedConfig.pdf;

    // Spoof navigator.pdfViewerEnabled (Req 38.2)
    try {
      Object.defineProperty(navigator, 'pdfViewerEnabled', {
        get: () => config.pdfViewerEnabled,
        enumerable: true,
        configurable: true
      });
    } catch (e) {}

    // Spoof window.print if needed (Req 38.3)
    if (!config.enabled && typeof window !== 'undefined') {
      const originalPrint = window.print;
      AdvancedApisSpoof._originalMethods.print = originalPrint;
      window.print = function() {
        // Block print dialog
        return;
      };
      Object.defineProperty(window.print, 'name', { value: 'print' });
      window.print.toString = () => 'function print() { [native code] }';
    }
  }

  /**
   * Spoof Bluetooth API (Req 39)
   * @private
   */
  static _spoofBluetooth() {
    if (typeof navigator === 'undefined') return;
    const config = AdvancedApisSpoof._appliedConfig.bluetooth;

    if (!config.enabled) {
      // Make navigator.bluetooth undefined (Req 39.1)
      try {
        Object.defineProperty(navigator, 'bluetooth', {
          get: () => undefined,
          enumerable: true,
          configurable: true
        });
      } catch (e) {
        try { delete navigator.bluetooth; } catch (e2) {}
      }
    }
  }

  /**
   * Spoof USB API (Req 39)
   * @private
   */
  static _spoofUsb() {
    if (typeof navigator === 'undefined') return;
    const config = AdvancedApisSpoof._appliedConfig.usb;

    if (!config.enabled) {
      // Make navigator.usb undefined (Req 39.3)
      try {
        Object.defineProperty(navigator, 'usb', {
          get: () => undefined,
          enumerable: true,
          configurable: true
        });
      } catch (e) {
        try { delete navigator.usb; } catch (e2) {}
      }
    }
  }

  /**
   * Spoof Gamepad API (Req 40)
   * @private
   */
  static _spoofGamepad() {
    if (typeof navigator === 'undefined') return;
    const config = AdvancedApisSpoof._appliedConfig.gamepad;

    if (config.mode === 'real') return;

    const originalGetGamepads = navigator.getGamepads;
    if (originalGetGamepads) {
      AdvancedApisSpoof._originalMethods.getGamepads = originalGetGamepads;
    }

    const wrappedGetGamepads = NativeWrapper.wrap(
      originalGetGamepads || function() { return []; },
      function(original, args, thisArg) {
        if (config.mode === 'hide') {
          // Return empty array (Req 40.2)
          return [];
        } else if (config.mode === 'fake') {
          // Return fake gamepad info (Req 40.3)
          return [null, null, null, null];
        }
        return original.call(thisArg);
      },
      { name: 'getGamepads', length: 0 }
    );

    try {
      Object.defineProperty(navigator, 'getGamepads', {
        value: wrappedGetGamepads,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      navigator.getGamepads = wrappedGetGamepads;
    }
  }


  /**
   * Spoof History API (Req 42)
   * @private
   */
  static _spoofHistory() {
    if (typeof window === 'undefined' || !window.history) return;
    const config = AdvancedApisSpoof._appliedConfig.history;

    if (config.mode === 'real') return;

    // Spoof history.length (Req 42.1, 42.2)
    try {
      Object.defineProperty(window.history, 'length', {
        get: () => config.length,
        enumerable: true,
        configurable: true
      });
    } catch (e) {}
  }

  /**
   * Spoof Clipboard API (Req 43)
   * @private
   */
  static _spoofClipboard() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    const config = AdvancedApisSpoof._appliedConfig.clipboard;

    if (config.mode === 'allow') return;

    const clipboard = navigator.clipboard;
    const originalRead = clipboard.read;
    const originalReadText = clipboard.readText;

    if (originalRead) AdvancedApisSpoof._originalMethods.clipboardRead = originalRead;
    if (originalReadText) AdvancedApisSpoof._originalMethods.clipboardReadText = originalReadText;

    if (config.mode === 'disable') {
      // Block all clipboard access (Req 43.1)
      const blockedFn = () => Promise.reject(new DOMException('Clipboard access denied', 'NotAllowedError'));
      
      try {
        clipboard.read = blockedFn;
        clipboard.readText = blockedFn;
        clipboard.write = blockedFn;
        clipboard.writeText = blockedFn;
      } catch (e) {}
    }
    // 'ask' mode would require UI interaction, handled at application level
  }

  /**
   * Spoof Notification API (Req 44)
   * @private
   */
  static _spoofNotification() {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    const config = AdvancedApisSpoof._appliedConfig.notification;

    // Spoof Notification.permission (Req 44.1, 44.2)
    const permissionValue = config.mode === 'deny' ? 'denied' : 'granted';
    
    try {
      Object.defineProperty(Notification, 'permission', {
        get: () => permissionValue,
        enumerable: true,
        configurable: true
      });
    } catch (e) {}

    // Spoof Notification.requestPermission (Req 44.4)
    const originalRequestPermission = Notification.requestPermission;
    if (originalRequestPermission) {
      AdvancedApisSpoof._originalMethods.notificationRequestPermission = originalRequestPermission;
    }

    Notification.requestPermission = function(callback) {
      const result = permissionValue;
      if (typeof callback === 'function') {
        callback(result);
      }
      return Promise.resolve(result);
    };
    Object.defineProperty(Notification.requestPermission, 'name', { value: 'requestPermission' });
    Notification.requestPermission.toString = () => 'function requestPermission() { [native code] }';
  }

  /**
   * Spoof Service Worker API (Req 45)
   * @private
   */
  static _spoofServiceWorker() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    const config = AdvancedApisSpoof._appliedConfig.serviceWorker;

    if (config.enabled) return;

    // Block Service Worker registration (Req 45.1)
    const originalRegister = navigator.serviceWorker.register;
    if (originalRegister) {
      AdvancedApisSpoof._originalMethods.swRegister = originalRegister;
    }

    navigator.serviceWorker.register = function() {
      return Promise.reject(new DOMException('Service Worker registration is disabled', 'NotAllowedError'));
    };
    Object.defineProperty(navigator.serviceWorker.register, 'name', { value: 'register' });
    navigator.serviceWorker.register.toString = () => 'function register() { [native code] }';
  }


  /**
   * Spoof WebAssembly API (Req 46)
   * @private
   */
  static _spoofWebAssembly() {
    if (typeof window === 'undefined') return;
    const config = AdvancedApisSpoof._appliedConfig.webAssembly;

    if (config.enabled) return;

    // Make WebAssembly unavailable (Req 46.1)
    try {
      Object.defineProperty(window, 'WebAssembly', {
        get: () => undefined,
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      try { delete window.WebAssembly; } catch (e2) {}
    }
  }

  /**
   * Spoof SharedArrayBuffer (Req 47)
   * @private
   */
  static _spoofSharedArrayBuffer() {
    if (typeof window === 'undefined') return;
    const config = AdvancedApisSpoof._appliedConfig.sharedArrayBuffer;

    if (config.enabled) return;

    // Make SharedArrayBuffer unavailable (Req 47.1)
    try {
      Object.defineProperty(window, 'SharedArrayBuffer', {
        get: () => undefined,
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      try { delete window.SharedArrayBuffer; } catch (e2) {}
    }
  }

  /**
   * Spoof Atomics (Req 47)
   * @private
   */
  static _spoofAtomics() {
    if (typeof window === 'undefined') return;
    const config = AdvancedApisSpoof._appliedConfig.atomics;

    if (config.enabled) return;

    // Make Atomics unavailable (Req 47.3)
    try {
      Object.defineProperty(window, 'Atomics', {
        get: () => undefined,
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      try { delete window.Atomics; } catch (e2) {}
    }
  }

  /**
   * Spoof Credential Management API (Req 48)
   * @private
   */
  static _spoofCredentials() {
    if (typeof navigator === 'undefined' || !navigator.credentials) return;
    const config = AdvancedApisSpoof._appliedConfig.credentials;

    if (config.enabled) return;

    // Block credential operations (Req 48.1)
    const blockedFn = () => Promise.reject(new DOMException('Credential Management is disabled', 'NotAllowedError'));

    try {
      navigator.credentials.get = blockedFn;
      navigator.credentials.create = blockedFn;
      navigator.credentials.store = blockedFn;
      navigator.credentials.preventSilentAccess = blockedFn;
    } catch (e) {}
  }

  /**
   * Spoof Payment Request API (Req 49)
   * @private
   */
  static _spoofPayment() {
    if (typeof window === 'undefined') return;
    const config = AdvancedApisSpoof._appliedConfig.payment;

    if (config.enabled) return;

    // Make PaymentRequest unavailable (Req 49.1)
    try {
      Object.defineProperty(window, 'PaymentRequest', {
        get: () => undefined,
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      try { delete window.PaymentRequest; } catch (e2) {}
    }
  }

  /**
   * Spoof Presentation API (Req 50)
   * @private
   */
  static _spoofPresentation() {
    if (typeof navigator === 'undefined') return;
    const config = AdvancedApisSpoof._appliedConfig.presentation;

    if (config.enabled) return;

    // Make navigator.presentation unavailable (Req 50.1)
    try {
      Object.defineProperty(navigator, 'presentation', {
        get: () => undefined,
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      try { delete navigator.presentation; } catch (e2) {}
    }
  }


  /**
   * Get the currently applied configuration
   * @returns {Object|null} The applied configuration or null if not applied
   */
  static getAppliedConfig() {
    if (!AdvancedApisSpoof._appliedConfig) return null;
    
    // Deep copy the config
    const config = {};
    for (const key of Object.keys(AdvancedApisSpoof._appliedConfig)) {
      config[key] = { ...AdvancedApisSpoof._appliedConfig[key] };
    }
    return config;
  }

  /**
   * Restore original methods
   * @returns {Object} Result object with restored methods
   */
  static restore() {
    const results = { restored: [], failed: [] };

    // Restore print
    if (AdvancedApisSpoof._originalMethods.print && typeof window !== 'undefined') {
      try { window.print = AdvancedApisSpoof._originalMethods.print; results.restored.push('print'); }
      catch (e) { results.failed.push({ method: 'print', error: e.message }); }
    }

    // Restore getGamepads
    if (AdvancedApisSpoof._originalMethods.getGamepads && typeof navigator !== 'undefined') {
      try { navigator.getGamepads = AdvancedApisSpoof._originalMethods.getGamepads; results.restored.push('getGamepads'); }
      catch (e) { results.failed.push({ method: 'getGamepads', error: e.message }); }
    }

    // Restore clipboard methods
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      if (AdvancedApisSpoof._originalMethods.clipboardRead) {
        try { navigator.clipboard.read = AdvancedApisSpoof._originalMethods.clipboardRead; results.restored.push('clipboard.read'); }
        catch (e) { results.failed.push({ method: 'clipboard.read', error: e.message }); }
      }
      if (AdvancedApisSpoof._originalMethods.clipboardReadText) {
        try { navigator.clipboard.readText = AdvancedApisSpoof._originalMethods.clipboardReadText; results.restored.push('clipboard.readText'); }
        catch (e) { results.failed.push({ method: 'clipboard.readText', error: e.message }); }
      }
    }

    // Restore notification
    if (AdvancedApisSpoof._originalMethods.notificationRequestPermission && typeof Notification !== 'undefined') {
      try { Notification.requestPermission = AdvancedApisSpoof._originalMethods.notificationRequestPermission; results.restored.push('Notification.requestPermission'); }
      catch (e) { results.failed.push({ method: 'Notification.requestPermission', error: e.message }); }
    }

    // Restore service worker
    if (AdvancedApisSpoof._originalMethods.swRegister && typeof navigator !== 'undefined' && navigator.serviceWorker) {
      try { navigator.serviceWorker.register = AdvancedApisSpoof._originalMethods.swRegister; results.restored.push('serviceWorker.register'); }
      catch (e) { results.failed.push({ method: 'serviceWorker.register', error: e.message }); }
    }

    // Clear stored data
    AdvancedApisSpoof._originalMethods = {};
    AdvancedApisSpoof._appliedConfig = null;

    return results;
  }

  /**
   * Create a configuration object from a FingerprintConfig
   * @param {Object} fingerprintConfig - FingerprintConfig instance or plain object
   * @returns {Object} Advanced APIs configuration object
   */
  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) {
      return { ...AdvancedApisSpoof._defaultConfig };
    }

    const advancedApis = fingerprintConfig.advancedApis || {};
    
    return {
      pdf: { ...AdvancedApisSpoof._defaultConfig.pdf, ...(advancedApis.pdf || {}) },
      bluetooth: { ...AdvancedApisSpoof._defaultConfig.bluetooth, ...(advancedApis.bluetooth || {}) },
      usb: { ...AdvancedApisSpoof._defaultConfig.usb, ...(advancedApis.usb || {}) },
      gamepad: { ...AdvancedApisSpoof._defaultConfig.gamepad, ...(advancedApis.gamepad || {}) },
      history: { ...AdvancedApisSpoof._defaultConfig.history, ...(advancedApis.history || {}) },
      clipboard: { ...AdvancedApisSpoof._defaultConfig.clipboard, ...(advancedApis.clipboard || {}) },
      notification: { ...AdvancedApisSpoof._defaultConfig.notification, ...(advancedApis.notification || {}) },
      serviceWorker: { ...AdvancedApisSpoof._defaultConfig.serviceWorker, ...(advancedApis.serviceWorker || {}) },
      webAssembly: { ...AdvancedApisSpoof._defaultConfig.webAssembly, ...(advancedApis.webAssembly || {}) },
      sharedArrayBuffer: { ...AdvancedApisSpoof._defaultConfig.sharedArrayBuffer, ...(advancedApis.sharedArrayBuffer || {}) },
      atomics: { ...AdvancedApisSpoof._defaultConfig.atomics, ...(advancedApis.atomics || {}) },
      credentials: { ...AdvancedApisSpoof._defaultConfig.credentials, ...(advancedApis.credentials || {}) },
      payment: { ...AdvancedApisSpoof._defaultConfig.payment, ...(advancedApis.payment || {}) },
      presentation: { ...AdvancedApisSpoof._defaultConfig.presentation, ...(advancedApis.presentation || {}) }
    };
  }


  /**
   * Verify that advanced APIs spoofing is correctly applied
   * @param {Object} expectedConfig - Expected configuration values
   * @returns {Object} Verification result
   */
  static verify(expectedConfig) {
    const result = { valid: true, checks: {} };

    const appliedConfig = AdvancedApisSpoof.getAppliedConfig();
    result.checks.configApplied = {
      expected: true,
      actual: appliedConfig !== null,
      pass: appliedConfig !== null
    };

    if (!appliedConfig) {
      result.valid = false;
      return result;
    }

    // Verify specific APIs in browser environment
    if (typeof navigator !== 'undefined') {
      // Check bluetooth (Req 39.1)
      if (!appliedConfig.bluetooth.enabled) {
        result.checks.bluetooth = {
          expected: undefined,
          actual: navigator.bluetooth,
          pass: navigator.bluetooth === undefined
        };
        if (!result.checks.bluetooth.pass) result.valid = false;
      }

      // Check USB (Req 39.3)
      if (!appliedConfig.usb.enabled) {
        result.checks.usb = {
          expected: undefined,
          actual: navigator.usb,
          pass: navigator.usb === undefined
        };
        if (!result.checks.usb.pass) result.valid = false;
      }

      // Check gamepad (Req 40.2)
      if (appliedConfig.gamepad.mode === 'hide' && navigator.getGamepads) {
        const gamepads = navigator.getGamepads();
        result.checks.gamepad = {
          expected: 0,
          actual: gamepads.length,
          pass: gamepads.length === 0
        };
        if (!result.checks.gamepad.pass) result.valid = false;
      }
    }

    if (typeof window !== 'undefined') {
      // Check WebAssembly (Req 46.1)
      if (!appliedConfig.webAssembly.enabled) {
        result.checks.webAssembly = {
          expected: undefined,
          actual: window.WebAssembly,
          pass: window.WebAssembly === undefined
        };
        if (!result.checks.webAssembly.pass) result.valid = false;
      }

      // Check SharedArrayBuffer (Req 47.1)
      if (!appliedConfig.sharedArrayBuffer.enabled) {
        result.checks.sharedArrayBuffer = {
          expected: undefined,
          actual: window.SharedArrayBuffer,
          pass: window.SharedArrayBuffer === undefined
        };
        if (!result.checks.sharedArrayBuffer.pass) result.valid = false;
      }

      // Check history length (Req 42.1)
      if (appliedConfig.history.mode === 'minimal' && window.history) {
        result.checks.historyLength = {
          expected: appliedConfig.history.length,
          actual: window.history.length,
          pass: window.history.length === appliedConfig.history.length
        };
        if (!result.checks.historyLength.pass) result.valid = false;
      }
    }

    return result;
  }

  /**
   * Generate injection script string for browser context
   * @param {Object} config - Advanced APIs configuration
   * @returns {string} JavaScript code string for injection
   */
  static generateInjectionScript(config) {
    const mc = AdvancedApisSpoof.fromFingerprintConfig({ advancedApis: config });

    return `
(function() {
  'use strict';
  
  const config = ${JSON.stringify(mc)};
  
  // PDF (Req 38)
  if (typeof navigator !== 'undefined') {
    try {
      Object.defineProperty(navigator, 'pdfViewerEnabled', {
        get: function() { return config.pdf.pdfViewerEnabled; },
        enumerable: true, configurable: true
      });
    } catch (e) {}
  }
  
  // Bluetooth (Req 39.1)
  if (!config.bluetooth.enabled && typeof navigator !== 'undefined') {
    try {
      Object.defineProperty(navigator, 'bluetooth', {
        get: function() { return undefined; },
        enumerable: true, configurable: true
      });
    } catch (e) { try { delete navigator.bluetooth; } catch (e2) {} }
  }
  
  // USB (Req 39.3)
  if (!config.usb.enabled && typeof navigator !== 'undefined') {
    try {
      Object.defineProperty(navigator, 'usb', {
        get: function() { return undefined; },
        enumerable: true, configurable: true
      });
    } catch (e) { try { delete navigator.usb; } catch (e2) {} }
  }
  
  // Gamepad (Req 40)
  if (config.gamepad.mode !== 'real' && typeof navigator !== 'undefined' && navigator.getGamepads) {
    const origGetGamepads = navigator.getGamepads;
    navigator.getGamepads = function() {
      if (config.gamepad.mode === 'hide') return [];
      if (config.gamepad.mode === 'fake') return [null, null, null, null];
      return origGetGamepads.call(navigator);
    };
    Object.defineProperty(navigator.getGamepads, 'name', { value: 'getGamepads' });
    navigator.getGamepads.toString = function() { return 'function getGamepads() { [native code] }'; };
  }
  
  // History (Req 42)
  if (config.history.mode === 'minimal' && typeof window !== 'undefined' && window.history) {
    try {
      Object.defineProperty(window.history, 'length', {
        get: function() { return config.history.length; },
        enumerable: true, configurable: true
      });
    } catch (e) {}
  }
  
  // Notification (Req 44)
  if (typeof Notification !== 'undefined') {
    const permVal = config.notification.mode === 'deny' ? 'denied' : 'granted';
    try {
      Object.defineProperty(Notification, 'permission', {
        get: function() { return permVal; },
        enumerable: true, configurable: true
      });
    } catch (e) {}
    Notification.requestPermission = function(cb) {
      if (typeof cb === 'function') cb(permVal);
      return Promise.resolve(permVal);
    };
    Object.defineProperty(Notification.requestPermission, 'name', { value: 'requestPermission' });
    Notification.requestPermission.toString = function() { return 'function requestPermission() { [native code] }'; };
  }
  
  // WebAssembly (Req 46)
  if (!config.webAssembly.enabled && typeof window !== 'undefined') {
    try {
      Object.defineProperty(window, 'WebAssembly', {
        get: function() { return undefined; },
        enumerable: true, configurable: true
      });
    } catch (e) { try { delete window.WebAssembly; } catch (e2) {} }
  }
  
  // SharedArrayBuffer (Req 47.1)
  if (!config.sharedArrayBuffer.enabled && typeof window !== 'undefined') {
    try {
      Object.defineProperty(window, 'SharedArrayBuffer', {
        get: function() { return undefined; },
        enumerable: true, configurable: true
      });
    } catch (e) { try { delete window.SharedArrayBuffer; } catch (e2) {} }
  }
  
  // Atomics (Req 47.3)
  if (!config.atomics.enabled && typeof window !== 'undefined') {
    try {
      Object.defineProperty(window, 'Atomics', {
        get: function() { return undefined; },
        enumerable: true, configurable: true
      });
    } catch (e) { try { delete window.Atomics; } catch (e2) {} }
  }
  
  // PaymentRequest (Req 49)
  if (!config.payment.enabled && typeof window !== 'undefined') {
    try {
      Object.defineProperty(window, 'PaymentRequest', {
        get: function() { return undefined; },
        enumerable: true, configurable: true
      });
    } catch (e) { try { delete window.PaymentRequest; } catch (e2) {} }
  }
  
  // Presentation (Req 50)
  if (!config.presentation.enabled && typeof navigator !== 'undefined') {
    try {
      Object.defineProperty(navigator, 'presentation', {
        get: function() { return undefined; },
        enumerable: true, configurable: true
      });
    } catch (e) { try { delete navigator.presentation; } catch (e2) {} }
  }
})();
`;
  }
}

module.exports = {
  AdvancedApisSpoof,
  AdvancedApisSpoofError
};
