/**
 * Injection Scripts Module
 * 注入脚本模块
 * 
 * Aggregates all injection script modules for fingerprint spoofing.
 * Provides a unified script generation interface for fingerprint injection.
 * 
 * @module infrastructure/fingerprint/injection-scripts
 * 
 * **Validates: Requirements 30.1**
 */

'use strict';

// Core utilities
const { NativeWrapper, NativeWrapperError, PrototypeGuard, PrototypeGuardError } = require('./core');
const { WorkerInterceptor, WorkerInterceptorError } = require('./core/worker-interceptor');

// Individual spoof modules
const { NavigatorSpoof, NavigatorSpoofError } = require('./navigator');
const { CanvasSpoof, CanvasSpoofError } = require('./canvas');
const { WebGLSpoof, WebGLSpoofError, WebGLConstants } = require('./webgl');
const { AudioSpoof, AudioSpoofError } = require('./audio');
const { FontSpoof, FontSpoofError, SYSTEM_FONTS, BASE_FONTS, TEST_STRING } = require('./fonts');
const { WebRTCProtection: WebRTCSpoof, WebRTCProtectionError: WebRTCSpoofError } = require('./webrtc');
const { ClientRectsSpoof, ClientRectsSpoofError } = require('./clientrects');
const { TimezoneSpoof, TimezoneSpoofError } = require('./timezone');
const { GeolocationSpoof, GeolocationSpoofError } = require('./geolocation');
const { MediaDevicesSpoof, MediaDevicesSpoofError } = require('./media-devices');
const { BatterySpoof, BatterySpoofError } = require('./battery');
const { SensorSpoof, SensorSpoofError } = require('./sensors');
const { SpeechSpoof, SpeechSpoofError } = require('./speech');
const { PermissionsSpoof, PermissionsSpoofError } = require('./permissions');
const { StorageSpoof, StorageSpoofError } = require('./storage');
const { ConnectionSpoof, ConnectionSpoofError } = require('./connection');
const { KeyboardSpoof, KeyboardSpoofError } = require('./keyboard');
const { PerformanceSpoof, PerformanceSpoofError } = require('./performance');
const { AdvancedApisSpoof, AdvancedApisSpoofError } = require('./advanced-apis');
const { BrowserBehaviorSpoof, BrowserBehaviorSpoofError } = require('./browser-behavior');
const { ScreenSpoof, ScreenSpoofError } = require('./screen');

/**
 * Error class for script generation operations
 */
class ScriptGeneratorError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ScriptGeneratorError';
    this.code = code;
    this.details = details;
  }
}

/**
 * ScriptGenerator class
 * Provides a unified interface for generating fingerprint injection scripts
 * 
 * **Validates: Requirements 30.1**
 */
class ScriptGenerator {
  /**
   * All available spoof modules with their configuration keys
   * @private
   */
  static _modules = {
    navigator: { spoof: NavigatorSpoof, configKey: 'navigator' },
    canvas: { spoof: CanvasSpoof, configKey: 'canvas' },
    webgl: { spoof: WebGLSpoof, configKey: 'webgl' },
    audio: { spoof: AudioSpoof, configKey: 'audio' },
    fonts: { spoof: FontSpoof, configKey: 'fonts' },
    webrtc: { spoof: WebRTCSpoof, configKey: 'webrtc' },
    clientRects: { spoof: ClientRectsSpoof, configKey: 'clientRects' },
    timezone: { spoof: TimezoneSpoof, configKey: 'timezone' },
    geolocation: { spoof: GeolocationSpoof, configKey: 'geolocation' },
    mediaDevices: { spoof: MediaDevicesSpoof, configKey: 'mediaDevices' },
    battery: { spoof: BatterySpoof, configKey: 'battery' },
    sensors: { spoof: SensorSpoof, configKey: 'sensors' },
    speech: { spoof: SpeechSpoof, configKey: 'speech' },
    permissions: { spoof: PermissionsSpoof, configKey: 'permissions' },
    storage: { spoof: StorageSpoof, configKey: 'storage' },
    connection: { spoof: ConnectionSpoof, configKey: 'connection' },
    keyboard: { spoof: KeyboardSpoof, configKey: 'keyboard' },
    performance: { spoof: PerformanceSpoof, configKey: 'performance' },
    advancedApis: { spoof: AdvancedApisSpoof, configKey: 'advancedApis' },
    browserBehavior: { spoof: BrowserBehaviorSpoof, configKey: 'browserBehavior' },
    screen: { spoof: ScreenSpoof, configKey: 'hardware' }
  };

  /**
   * Generate a complete injection script from fingerprint configuration
   * 
   * @param {Object} fingerprintConfig - Complete fingerprint configuration
   * @param {Object} options - Generation options
   * @param {string[]} options.include - Modules to include (default: all)
   * @param {string[]} options.exclude - Modules to exclude
   * @param {boolean} options.minify - Whether to minify the output
   * @returns {string} Complete injection script
   */
  static generateScript(fingerprintConfig, options = {}) {
    if (!fingerprintConfig || typeof fingerprintConfig !== 'object') {
      throw new ScriptGeneratorError(
        'fingerprintConfig must be an object',
        'INVALID_CONFIG',
        { type: typeof fingerprintConfig }
      );
    }

    const { include, exclude = [], minify = false } = options;
    
    // Determine which modules to include
    let moduleNames = include || Object.keys(ScriptGenerator._modules);
    moduleNames = moduleNames.filter(name => !exclude.includes(name));

    const scripts = [];

    // Add header
    scripts.push(ScriptGenerator._generateHeader());

    // Generate script for each module
    for (const moduleName of moduleNames) {
      const moduleInfo = ScriptGenerator._modules[moduleName];
      if (!moduleInfo) continue;

      try {
        const moduleScript = ScriptGenerator._generateModuleScript(
          moduleName,
          moduleInfo,
          fingerprintConfig
        );
        if (moduleScript) {
          scripts.push(moduleScript);
        }
      } catch (error) {
        // Log error but continue with other modules
        console.warn(`Failed to generate script for module ${moduleName}:`, error.message);
      }
    }

    // Add footer
    scripts.push(ScriptGenerator._generateFooter());

    let result = scripts.join('\n\n');

    if (minify) {
      result = ScriptGenerator._minifyScript(result);
    }

    return result;
  }

  /**
   * Generate script header with common utilities
   * @private
   */
  static _generateHeader() {
    return `
(function() {
  'use strict';
  
  // Fingerprint Injection Script
  // Generated at: ${new Date().toISOString()}
  
  // Native function wrapper utility
  const wrapNative = (function() {
    return function(originalFn, wrapperFn, options) {
      options = options || {};
      const wrapped = function() {
        return wrapperFn.call(this, originalFn, arguments, this);
      };
      
      Object.defineProperty(wrapped, 'name', {
        value: options.name || originalFn.name,
        configurable: true
      });
      
      Object.defineProperty(wrapped, 'length', {
        value: options.length !== undefined ? options.length : originalFn.length,
        configurable: true
      });
      
      const nativeString = 'function ' + (options.name || originalFn.name) + '() { [native code] }';
      wrapped.toString = function() { return nativeString; };
      wrapped.toSource = function() { return nativeString; };
      
      return wrapped;
    };
  })();
`.trim();
  }

  /**
   * Generate script footer
   * @private
   */
  static _generateFooter() {
    return `
  // Fingerprint injection complete
})();
`.trim();
  }

  /**
   * Generate script for a specific module
   * @private
   */
  static _generateModuleScript(moduleName, moduleInfo, fingerprintConfig) {
    const { spoof, configKey } = moduleInfo;
    
    // Check if module has generateInjectionScript method
    if (typeof spoof.generateInjectionScript === 'function') {
      let moduleConfig;
      if (typeof spoof.fromFingerprintConfig === 'function') {
        try {
          moduleConfig = spoof.fromFingerprintConfig(fingerprintConfig);
        } catch (e) {
          moduleConfig = ScriptGenerator._extractModuleConfig(fingerprintConfig, configKey);
        }
      } else {
        moduleConfig = ScriptGenerator._extractModuleConfig(fingerprintConfig, configKey);
      }
      return `
  // === ${moduleName.toUpperCase()} SPOOFING ===
  ${spoof.generateInjectionScript(moduleConfig)}
`.trim();
    }

    return null;
  }

  /**
   * Extract module-specific configuration from fingerprint config
   * @private
   */
  static _extractModuleConfig(fingerprintConfig, configKey) {
    // Some modules need the full config, others need specific sections
    const fullConfigModules = ['navigator', 'browserBehavior', 'advancedApis'];
    
    if (fullConfigModules.includes(configKey)) {
      return fingerprintConfig;
    }

    return fingerprintConfig[configKey] || {};
  }

  /**
   * Simple script minification
   * @private
   */
  static _minifyScript(script) {
    return script
      .replace(/\/\/[^\n]*/g, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*([{};,:])\s*/g, '$1') // Remove space around punctuation
      .trim();
  }

  /**
   * Get list of available modules
   * @returns {string[]} Array of module names
   */
  static getAvailableModules() {
    return Object.keys(ScriptGenerator._modules);
  }

  /**
   * Check if a module is available
   * @param {string} moduleName - Name of the module
   * @returns {boolean} True if module exists
   */
  static hasModule(moduleName) {
    return moduleName in ScriptGenerator._modules;
  }

  /**
   * Get module information
   * @param {string} moduleName - Name of the module
   * @returns {Object|null} Module info or null if not found
   */
  static getModuleInfo(moduleName) {
    const info = ScriptGenerator._modules[moduleName];
    if (!info) return null;
    
    return {
      name: moduleName,
      configKey: info.configKey,
      hasInjectionScript: typeof info.spoof.generateInjectionScript === 'function'
    };
  }
}

/**
 * InjectionScriptManager class
 * High-level manager for applying fingerprint spoofing
 */
class InjectionScriptManager {
  /**
   * Create a new InjectionScriptManager
   * @param {Object} fingerprintConfig - Fingerprint configuration
   */
  constructor(fingerprintConfig) {
    if (!fingerprintConfig || typeof fingerprintConfig !== 'object') {
      throw new ScriptGeneratorError(
        'fingerprintConfig must be an object',
        'INVALID_CONFIG',
        { type: typeof fingerprintConfig }
      );
    }
    this._config = fingerprintConfig;
    this._appliedModules = [];
    this._workerInterceptor = null;
  }

  /**
   * Apply all fingerprint spoofing modules
   * @param {Object} options - Application options
   * @returns {Object} Result with applied modules and any errors
   */
  apply(options = {}) {
    const { include, exclude = [] } = options;
    const results = { success: true, applied: [], failed: [] };

    let moduleNames = include || Object.keys(ScriptGenerator._modules);
    moduleNames = moduleNames.filter(name => !exclude.includes(name));

    for (const moduleName of moduleNames) {
      try {
        const result = this._applyModule(moduleName);
        if (result) {
          results.applied.push(moduleName);
          this._appliedModules.push(moduleName);
        }
      } catch (error) {
        results.failed.push({ module: moduleName, error: error.message });
        results.success = false;
      }
    }

    // Initialize worker interceptor if not excluded
    if (!exclude.includes('workers')) {
      try {
        this._initializeWorkerInterceptor();
        results.applied.push('workers');
      } catch (error) {
        results.failed.push({ module: 'workers', error: error.message });
      }
    }

    return results;
  }

  /**
   * Apply a specific module
   * @private
   */
  _applyModule(moduleName) {
    const moduleInfo = ScriptGenerator._modules[moduleName];
    if (!moduleInfo) return false;

    const { spoof, configKey } = moduleInfo;
    
    if (typeof spoof.apply !== 'function') {
      return false;
    }

    const moduleConfig = this._extractModuleConfig(configKey);
    spoof.apply(moduleConfig);
    return true;
  }

  /**
   * Extract module configuration
   * @private
   */
  _extractModuleConfig(configKey) {
    const fullConfigModules = ['navigator', 'browserBehavior', 'advancedApis'];
    
    if (fullConfigModules.includes(configKey)) {
      return this._config;
    }

    return this._config[configKey] || {};
  }

  /**
   * Initialize worker interceptor
   * @private
   */
  _initializeWorkerInterceptor() {
    const injectionScript = ScriptGenerator.generateScript(this._config, { minify: true });
    this._workerInterceptor = new WorkerInterceptor(this._config, { injectionScript });
    this._workerInterceptor.initialize();
  }

  /**
   * Restore all applied spoofing
   * @returns {Object} Result with restored modules
   */
  restore() {
    const results = { restored: [], failed: [] };

    for (const moduleName of this._appliedModules) {
      try {
        const moduleInfo = ScriptGenerator._modules[moduleName];
        if (moduleInfo && typeof moduleInfo.spoof.restore === 'function') {
          moduleInfo.spoof.restore();
          results.restored.push(moduleName);
        }
      } catch (error) {
        results.failed.push({ module: moduleName, error: error.message });
      }
    }

    // Restore worker interceptor
    if (this._workerInterceptor && typeof WorkerInterceptor.restore === 'function') {
      try {
        WorkerInterceptor.restore();
        results.restored.push('workers');
      } catch (error) {
        results.failed.push({ module: 'workers', error: error.message });
      }
    }

    this._appliedModules = [];
    this._workerInterceptor = null;

    return results;
  }

  /**
   * Get list of applied modules
   * @returns {string[]} Array of applied module names
   */
  getAppliedModules() {
    return [...this._appliedModules];
  }

  /**
   * Verify all applied spoofing
   * @returns {Object} Verification results for each module
   */
  verify() {
    const results = {};

    for (const moduleName of this._appliedModules) {
      const moduleInfo = ScriptGenerator._modules[moduleName];
      if (moduleInfo && typeof moduleInfo.spoof.verify === 'function') {
        try {
          results[moduleName] = moduleInfo.spoof.verify(this._config);
        } catch (error) {
          results[moduleName] = { valid: false, error: error.message };
        }
      }
    }

    return results;
  }
}

module.exports = {
  // Core utilities
  NativeWrapper,
  NativeWrapperError,
  PrototypeGuard,
  PrototypeGuardError,
  WorkerInterceptor,
  WorkerInterceptorError,
  
  // Navigator spoofing
  NavigatorSpoof,
  NavigatorSpoofError,
  
  // Canvas spoofing
  CanvasSpoof,
  CanvasSpoofError,
  
  // WebGL spoofing
  WebGLSpoof,
  WebGLSpoofError,
  WebGLConstants,
  
  // Audio spoofing
  AudioSpoof,
  AudioSpoofError,
  
  // Font spoofing
  FontSpoof,
  FontSpoofError,
  SYSTEM_FONTS,
  BASE_FONTS,
  TEST_STRING,
  
  // WebRTC spoofing
  WebRTCSpoof,
  WebRTCSpoofError,
  
  // ClientRects spoofing
  ClientRectsSpoof,
  ClientRectsSpoofError,
  
  // Timezone spoofing
  TimezoneSpoof,
  TimezoneSpoofError,
  
  // Geolocation spoofing
  GeolocationSpoof,
  GeolocationSpoofError,
  
  // Media Devices spoofing
  MediaDevicesSpoof,
  MediaDevicesSpoofError,
  
  // Battery spoofing
  BatterySpoof,
  BatterySpoofError,
  
  // Sensor spoofing
  SensorSpoof,
  SensorSpoofError,
  
  // Speech spoofing
  SpeechSpoof,
  SpeechSpoofError,
  
  // Permissions spoofing
  PermissionsSpoof,
  PermissionsSpoofError,
  
  // Storage spoofing
  StorageSpoof,
  StorageSpoofError,
  
  // Connection spoofing
  ConnectionSpoof,
  ConnectionSpoofError,
  
  // Keyboard spoofing
  KeyboardSpoof,
  KeyboardSpoofError,
  
  // Performance spoofing
  PerformanceSpoof,
  PerformanceSpoofError,
  
  // Advanced APIs spoofing
  AdvancedApisSpoof,
  AdvancedApisSpoofError,
  
  // Browser behavior spoofing
  BrowserBehaviorSpoof,
  BrowserBehaviorSpoofError,
  ScreenSpoof,
  ScreenSpoofError,
  
  // Unified script generation
  ScriptGenerator,
  ScriptGeneratorError,
  InjectionScriptManager
};
