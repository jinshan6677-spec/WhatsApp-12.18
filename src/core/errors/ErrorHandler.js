'use strict';

/**
 * ErrorHandler - Centralized error handling with recovery strategies
 * 
 * Provides error handling, recovery execution, structured logging,
 * localization support, and critical error state saving.
 * 
 * @module core/errors/ErrorHandler
 */

const AppError = require('./AppError');

/**
 * @typedef {Object} ErrorContext
 * @property {string} [component] - Component where error occurred
 * @property {string} [operation] - Operation being performed
 * @property {string} [userId] - User ID if applicable
 * @property {string} [accountId] - Account ID if applicable
 */

/**
 * @typedef {Object} RecoveryResult
 * @property {boolean} success - Whether recovery succeeded
 * @property {string} [message] - Recovery result message
 * @property {*} [data] - Any data returned from recovery
 */

/**
 * @typedef {Function} RecoveryStrategy
 * @param {AppError} error - The error to recover from
 * @param {ErrorContext} context - Error context
 * @returns {Promise<RecoveryResult>} Recovery result
 */

/**
 * @typedef {Object} ErrorRecord
 * @property {string} timestamp - ISO timestamp
 * @property {string} level - Error level
 * @property {string} errorType - Error type name
 * @property {string} errorCode - Error code
 * @property {string} message - Error message
 * @property {string} stack - Stack trace
 * @property {ErrorContext} context - Error context
 * @property {boolean} recoverable - Whether error is recoverable
 * @property {boolean} recovered - Whether recovery was attempted/succeeded
 */

/**
 * @typedef {Object} LocaleMessages
 * @property {Object.<string, string>} messages - Error code to message mapping
 */

/**
 * @typedef {Object} ErrorHandlerOptions
 * @property {Function} [logger] - Logger function
 * @property {number} [maxHistory=100] - Maximum error history size
 * @property {Object} [stateManager] - StateManager for critical error state saving
 * @property {string} [defaultLocale='en'] - Default locale for messages
 */

class ErrorHandler {
  /**
   * Creates a new ErrorHandler instance
   * @param {ErrorHandlerOptions} [options={}] - Configuration options
   */
  constructor(options = {}) {
    /** @type {Function} */
    this._logger = options.logger || console.error.bind(console);
    /** @type {number} */
    this._maxHistory = options.maxHistory || 100;
    /** @type {Object|null} */
    this._stateManager = options.stateManager || null;
    /** @type {string} */
    this._defaultLocale = options.defaultLocale || 'en';
    
    /** @type {Map<string, RecoveryStrategy>} */
    this._recoveryStrategies = new Map();
    /** @type {ErrorRecord[]} */
    this._errorHistory = [];
    /** @type {Map<string, LocaleMessages>} */
    this._locales = new Map();
    /** @type {Set<Function>} */
    this._errorListeners = new Set();
    
    // Initialize default locale
    this._initializeDefaultLocale();
  }

  /**
   * Initializes default locale messages (English and Chinese)
   * @private
   */
  _initializeDefaultLocale() {
    // English locale
    this._locales.set('en', {
      messages: {
        'VALIDATION_ERROR': 'The provided data is invalid. Please check your input.',
        'NETWORK_ERROR': 'A network error occurred. Please check your connection.',
        'STORAGE_ERROR': 'Failed to save or load data. Please try again.',
        'PLUGIN_ERROR': 'A plugin encountered an error.',
        'IPC_ERROR': 'Communication error occurred.',
        'STATE_ERROR': 'Application state error occurred.',
        'UNKNOWN_ERROR': 'An unexpected error occurred.',
        'TIMEOUT_ERROR': 'The operation timed out. Please try again.',
        'PERMISSION_ERROR': 'You do not have permission to perform this action.',
        'NOT_FOUND_ERROR': 'The requested resource was not found.',
        'CONFLICT_ERROR': 'A conflict occurred. Please refresh and try again.',
        'WRAPPED_ERROR': 'An error occurred during processing.',
        'CORRUPTION_ERROR': 'Data corruption detected. Please restart the application.',
        'INITIALIZATION_ERROR': 'Failed to initialize. Please restart the application.',
        'CONFIGURATION_ERROR': 'Configuration error. Please check your settings.'
      }
    });
    
    // Chinese locale
    this._locales.set('zh', {
      messages: {
        'VALIDATION_ERROR': '提供的数据无效，请检查您的输入。',
        'NETWORK_ERROR': '发生网络错误，请检查您的网络连接。',
        'STORAGE_ERROR': '保存或加载数据失败，请重试。',
        'PLUGIN_ERROR': '插件遇到错误。',
        'IPC_ERROR': '通信错误。',
        'STATE_ERROR': '应用程序状态错误。',
        'UNKNOWN_ERROR': '发生意外错误。',
        'TIMEOUT_ERROR': '操作超时，请重试。',
        'PERMISSION_ERROR': '您没有执行此操作的权限。',
        'NOT_FOUND_ERROR': '未找到请求的资源。',
        'CONFLICT_ERROR': '发生冲突，请刷新后重试。',
        'WRAPPED_ERROR': '处理过程中发生错误。',
        'CORRUPTION_ERROR': '检测到数据损坏，请重启应用程序。',
        'INITIALIZATION_ERROR': '初始化失败，请重启应用程序。',
        'CONFIGURATION_ERROR': '配置错误，请检查您的设置。'
      }
    });
  }

  /**
   * Registers locale messages for error localization
   * @param {string} locale - Locale code (e.g., 'en', 'zh', 'es')
   * @param {Object.<string, string>} messages - Error code to message mapping
   */
  registerLocale(locale, messages) {
    if (!locale || typeof locale !== 'string') {
      throw new Error('Locale must be a non-empty string');
    }
    if (!messages || typeof messages !== 'object') {
      throw new Error('Messages must be an object');
    }
    
    const existing = this._locales.get(locale) || { messages: {} };
    this._locales.set(locale, {
      messages: { ...existing.messages, ...messages }
    });
  }

  /**
   * Gets supported locales
   * @returns {string[]} Array of supported locale codes
   */
  getSupportedLocales() {
    return Array.from(this._locales.keys());
  }

  /**
   * Registers a recovery strategy for an error code
   * @param {string} errorCode - Error code to handle
   * @param {RecoveryStrategy} strategy - Recovery strategy function
   */
  registerRecoveryStrategy(errorCode, strategy) {
    if (!errorCode || typeof errorCode !== 'string') {
      throw new Error('Error code must be a non-empty string');
    }
    if (typeof strategy !== 'function') {
      throw new Error('Strategy must be a function');
    }
    
    this._recoveryStrategies.set(errorCode, strategy);
  }

  /**
   * Unregisters a recovery strategy
   * @param {string} errorCode - Error code to unregister
   * @returns {boolean} Whether a strategy was removed
   */
  unregisterRecoveryStrategy(errorCode) {
    return this._recoveryStrategies.delete(errorCode);
  }

  /**
   * Gets registered recovery strategy codes
   * @returns {string[]} Array of error codes with registered strategies
   */
  getRegisteredStrategies() {
    return Array.from(this._recoveryStrategies.keys());
  }

  /**
   * Adds an error listener
   * @param {Function} listener - Listener function (error, record) => void
   * @returns {Function} Unsubscribe function
   */
  addErrorListener(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }
    
    this._errorListeners.add(listener);
    return () => this._errorListeners.delete(listener);
  }

  /**
   * Handles an error with logging and optional recovery
   * @param {Error} error - The error to handle
   * @param {ErrorContext} [context={}] - Additional context
   * @returns {ErrorRecord} The error record created
   */
  handle(error, context = {}) {
    // Wrap non-AppError errors
    const appError = error instanceof AppError 
      ? error 
      : AppError.wrap(error, 'WRAPPED_ERROR', context);
    
    // Merge context
    appError.context = { ...appError.context, ...context };
    
    // Create error record
    const record = this._createErrorRecord(appError);
    
    // Add to history
    this._addToHistory(record);
    
    // Log the error
    this._logError(record);
    
    // Notify listeners
    this._notifyListeners(appError, record);
    
    return record;
  }

  /**
   * Attempts to recover from an error using registered strategies
   * @param {AppError} error - The error to recover from
   * @param {ErrorContext} [context={}] - Additional context
   * @returns {Promise<RecoveryResult>} Recovery result
   */
  async recover(error, context = {}) {
    // Ensure we have an AppError
    const appError = error instanceof AppError 
      ? error 
      : AppError.wrap(error, 'WRAPPED_ERROR', context);
    
    // Check if error is recoverable
    if (!appError.recoverable) {
      return {
        success: false,
        message: 'Error is not marked as recoverable'
      };
    }
    
    // Find recovery strategy
    const strategy = this._recoveryStrategies.get(appError.code);
    
    if (!strategy) {
      return {
        success: false,
        message: `No recovery strategy registered for error code: ${appError.code}`
      };
    }
    
    try {
      const result = await strategy(appError, { ...appError.context, ...context });
      
      // Update the last error record with recovery status
      if (this._errorHistory.length > 0) {
        const lastRecord = this._errorHistory[this._errorHistory.length - 1];
        if (lastRecord.errorCode === appError.code) {
          lastRecord.recovered = result.success;
        }
      }
      
      return result;
    } catch (recoveryError) {
      this._logger('ErrorHandler: Recovery strategy failed:', recoveryError);
      
      return {
        success: false,
        message: `Recovery failed: ${recoveryError.message}`
      };
    }
  }

  /**
   * Handles a critical error by saving state before shutdown
   * @param {Error} error - The critical error
   * @param {ErrorContext} [context={}] - Additional context
   * @returns {Promise<void>}
   */
  async handleCritical(error, context = {}) {
    // Handle the error first
    const record = this.handle(error, { ...context, critical: true });
    
    // Save state if state manager is available
    if (this._stateManager) {
      try {
        // Take a snapshot before saving
        if (typeof this._stateManager.snapshot === 'function') {
          this._stateManager.snapshot();
        }
        
        // Persist state
        if (typeof this._stateManager.persist === 'function') {
          await this._stateManager.persist();
        }
        
        this._logger('ErrorHandler: State saved before critical error shutdown');
      } catch (saveError) {
        this._logger('ErrorHandler: Failed to save state on critical error:', saveError);
      }
    }
    
    return record;
  }

  /**
   * Gets the localized user-friendly message for an error
   * @param {Error|AppError} error - The error
   * @param {string} [locale] - Locale code (defaults to defaultLocale)
   * @returns {string} Localized message
   */
  getLocalizedMessage(error, locale) {
    const targetLocale = locale || this._defaultLocale;
    const localeData = this._locales.get(targetLocale) || this._locales.get('en');
    
    if (!localeData) {
      return 'An error occurred.';
    }
    
    const errorCode = error instanceof AppError ? error.code : 'UNKNOWN_ERROR';
    const message = localeData.messages[errorCode] || localeData.messages['UNKNOWN_ERROR'];
    
    return message || 'An error occurred.';
  }

  /**
   * Gets the error history
   * @param {number} [limit] - Maximum number of records to return
   * @returns {ErrorRecord[]} Error history
   */
  getErrorHistory(limit) {
    const records = [...this._errorHistory];
    if (limit && limit > 0) {
      return records.slice(-limit);
    }
    return records;
  }

  /**
   * Clears the error history
   */
  clearHistory() {
    this._errorHistory = [];
  }

  /**
   * Sets the state manager for critical error handling
   * @param {Object} stateManager - StateManager instance
   */
  setStateManager(stateManager) {
    this._stateManager = stateManager;
  }

  /**
   * Sets the default locale
   * @param {string} locale - Locale code
   */
  setDefaultLocale(locale) {
    if (!this._locales.has(locale)) {
      throw new Error(`Locale "${locale}" is not registered`);
    }
    this._defaultLocale = locale;
  }

  /**
   * Gets the default locale
   * @returns {string}
   */
  getDefaultLocale() {
    return this._defaultLocale;
  }

  /**
   * Creates an error record from an AppError
   * @private
   * @param {AppError} error - The error
   * @returns {ErrorRecord}
   */
  _createErrorRecord(error) {
    return {
      timestamp: error.timestamp || new Date().toISOString(),
      level: error.recoverable ? 'warn' : 'error',
      errorType: error.name || 'Error',
      errorCode: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      stack: error.stack,
      context: { ...error.context },
      recoverable: error.recoverable || false,
      recovered: false
    };
  }

  /**
   * Adds an error record to history
   * @private
   * @param {ErrorRecord} record - The error record
   */
  _addToHistory(record) {
    this._errorHistory.push(record);
    
    // Trim history if exceeds max
    if (this._errorHistory.length > this._maxHistory) {
      this._errorHistory = this._errorHistory.slice(-this._maxHistory);
    }
  }

  /**
   * Logs an error record
   * @private
   * @param {ErrorRecord} record - The error record
   */
  _logError(record) {
    const logEntry = {
      timestamp: record.timestamp,
      level: record.level,
      errorType: record.errorType,
      errorCode: record.errorCode,
      message: record.message,
      stack: record.stack,
      context: record.context,
      recoverable: record.recoverable,
      recovered: record.recovered
    };
    
    this._logger('ErrorHandler:', JSON.stringify(logEntry, null, 2));
  }

  /**
   * Notifies all error listeners
   * @private
   * @param {AppError} error - The error
   * @param {ErrorRecord} record - The error record
   */
  _notifyListeners(error, record) {
    for (const listener of this._errorListeners) {
      try {
        listener(error, record);
      } catch (listenerError) {
        this._logger('ErrorHandler: Listener error:', listenerError);
      }
    }
  }
}

// Factory functions

/**
 * Creates a new ErrorHandler instance
 * @param {ErrorHandlerOptions} [options] - Configuration options
 * @returns {ErrorHandler}
 */
function createErrorHandler(options) {
  return new ErrorHandler(options);
}

// Global instance
let globalErrorHandler = null;

/**
 * Gets the global ErrorHandler instance
 * @param {ErrorHandlerOptions} [options] - Configuration options (only used on first call)
 * @returns {ErrorHandler}
 */
function getGlobalErrorHandler(options) {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler(options);
  }
  return globalErrorHandler;
}

/**
 * Resets the global ErrorHandler instance (for testing)
 */
function resetGlobalErrorHandler() {
  globalErrorHandler = null;
}

module.exports = {
  ErrorHandler,
  createErrorHandler,
  getGlobalErrorHandler,
  resetGlobalErrorHandler
};
