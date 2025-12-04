/**
 * ErrorLogger - Centralized Error Logging Utility
 * 
 * Provides comprehensive error logging with file persistence,
 * user-friendly error messages, and error categorization.
 */

const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

// IP address sanitization
const IPV4_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

function maskIP(ip) {
  try {
    const parts = String(ip).split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.x.x`;
    }
  } catch (_) {}
  return '[REDACTED_IP]';
}

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value.replace(IPV4_REGEX, (ip) => maskIP(ip));
  }
  return value;
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((v) => (typeof v === 'object' ? sanitizeObject(v) : sanitizeValue(v)));
  }
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'object' ? sanitizeObject(v) : sanitizeValue(v);
  }
  return out;
}

/**
 * Error severity levels
 */
const ErrorLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal'
};

/**
 * Error categories for better organization
 */
const ErrorCategory = {
  ACCOUNT: 'account',
  SESSION: 'session',
  VIEW: 'view',
  NETWORK: 'network',
  TRANSLATION: 'translation',
  MIGRATION: 'migration',
  IPC: 'ipc',
  SYSTEM: 'system',
  UNKNOWN: 'unknown'
};

/**
 * ErrorLogger class
 */
class ErrorLogger {
  /**
   * Create ErrorLogger instance
   * @param {Object} [options] - Configuration options
   * @param {string} [options.logDir] - Directory for log files
   * @param {string} [options.logFileName] - Log file name
   * @param {number} [options.maxLogSize] - Maximum log file size in bytes
   * @param {number} [options.maxLogFiles] - Maximum number of log files to keep
   * @param {boolean} [options.consoleOutput] - Whether to output to console
   */
  constructor(options = {}) {
    this.options = {
      logDir: options.logDir || path.join(app.getPath('userData'), 'logs'),
      logFileName: options.logFileName || 'error.log',
      maxLogSize: options.maxLogSize || 10 * 1024 * 1024, // 10MB
      maxLogFiles: options.maxLogFiles || 5,
      consoleOutput: options.consoleOutput !== false,
      ...options
    };

    this.logFilePath = path.join(this.options.logDir, this.options.logFileName);
    this.isInitialized = false;
    this.writeQueue = [];
    this.isWriting = false;
  }

  /**
   * Initialize the error logger
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure log directory exists
      await fs.mkdir(this.options.logDir, { recursive: true });

      // Check if log file needs rotation
      await this._rotateLogIfNeeded();

      this.isInitialized = true;
      
      // Log initialization
      await this.log(ErrorLevel.INFO, ErrorCategory.SYSTEM, 'ErrorLogger initialized', {
        logDir: this.options.logDir,
        logFile: this.logFilePath
      });
    } catch (error) {
      console.error('[ErrorLogger] Failed to initialize:', error);
      // Don't throw - allow app to continue even if logging fails
    }
  }

  /**
   * Log an error or message
   * @param {string} level - Error level (debug, info, warn, error, fatal)
   * @param {string} category - Error category
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   * @param {Error} [error] - Original error object
   * @returns {Promise<void>}
   */
  async log(level, category, message, details = {}, error = null) {
    try {
      const timestamp = new Date().toISOString();
      // Sanitize message and details to avoid leaking IPs
      const sanitizedMessage = sanitizeValue(message);
      const sanitizedDetails = sanitizeObject(details);

      const logEntry = {
        timestamp,
        level,
        category,
        message: sanitizedMessage,
        details: sanitizedDetails,
        stack: error ? error.stack : null,
        pid: process.pid
      };

      // Output to console if enabled
      if (this.options.consoleOutput) {
        this._consoleOutput(logEntry);
      }

      // Add to write queue
      this.writeQueue.push(logEntry);

      // Process write queue
      await this._processWriteQueue();
    } catch (err) {
      console.error('[ErrorLogger] Failed to log:', err);
    }
  }

  /**
   * Log debug message
   * @param {string} category - Error category
   * @param {string} message - Message
   * @param {Object} [details] - Additional details
   */
  async debug(category, message, details = {}) {
    return this.log(ErrorLevel.DEBUG, category, message, details);
  }

  /**
   * Log info message
   * @param {string} category - Error category
   * @param {string} message - Message
   * @param {Object} [details] - Additional details
   */
  async info(category, message, details = {}) {
    return this.log(ErrorLevel.INFO, category, message, details);
  }

  /**
   * Log warning
   * @param {string} category - Error category
   * @param {string} message - Warning message
   * @param {Object} [details] - Additional details
   * @param {Error} [error] - Original error object
   */
  async warn(category, message, details = {}, error = null) {
    return this.log(ErrorLevel.WARN, category, message, details, error);
  }

  /**
   * Log error
   * @param {string} category - Error category
   * @param {string} message - Error message
   * @param {Object} [details] - Additional details
   * @param {Error} [error] - Original error object
   */
  async error(category, message, details = {}, error = null) {
    return this.log(ErrorLevel.ERROR, category, message, details, error);
  }

  /**
   * Log fatal error
   * @param {string} category - Error category
   * @param {string} message - Error message
   * @param {Object} [details] - Additional details
   * @param {Error} [error] - Original error object
   */
  async fatal(category, message, details = {}, error = null) {
    return this.log(ErrorLevel.FATAL, category, message, details, error);
  }

  /**
   * Output log entry to console
   * @private
   * @param {Object} logEntry - Log entry
   */
  _consoleOutput(logEntry) {
    const { timestamp, level, category, message, details, stack } = logEntry;
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}`;

    switch (level) {
      case ErrorLevel.DEBUG:
        console.log(logMessage, details);
        break;
      case ErrorLevel.INFO:
        console.log(logMessage, details);
        break;
      case ErrorLevel.WARN:
        console.warn(logMessage, details);
        if (stack) console.warn(stack);
        break;
      case ErrorLevel.ERROR:
        console.error(logMessage, details);
        if (stack) console.error(stack);
        break;
      case ErrorLevel.FATAL:
        console.error(logMessage, details);
        if (stack) console.error(stack);
        break;
      default:
        console.log(logMessage, details);
    }
  }

  /**
   * Process write queue
   * @private
   * @returns {Promise<void>}
   */
  async _processWriteQueue() {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;

    try {
      while (this.writeQueue.length > 0) {
        const entries = this.writeQueue.splice(0, 10); // Process in batches
        const logLines = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';

        await fs.appendFile(this.logFilePath, logLines, 'utf8');

        // Check if rotation is needed after writing
        await this._rotateLogIfNeeded();
      }
    } catch (error) {
      console.error('[ErrorLogger] Failed to write to log file:', error);
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Rotate log file if it exceeds max size
   * @private
   * @returns {Promise<void>}
   */
  async _rotateLogIfNeeded() {
    try {
      // Check if log file exists and get its size
      let stats;
      try {
        stats = await fs.stat(this.logFilePath);
      } catch (error) {
        // File doesn't exist yet
        return;
      }

      // Check if rotation is needed
      if (stats.size < this.options.maxLogSize) {
        return;
      }

      // Rotate log files
      await this._rotateLogs();
    } catch (error) {
      console.error('[ErrorLogger] Failed to rotate logs:', error);
    }
  }

  /**
   * Rotate log files
   * @private
   * @returns {Promise<void>}
   */
  async _rotateLogs() {
    try {
      const baseName = path.basename(this.options.logFileName, path.extname(this.options.logFileName));
      const ext = path.extname(this.options.logFileName);

      // Delete oldest log file if we've reached the limit
      const oldestLogPath = path.join(
        this.options.logDir,
        `${baseName}.${this.options.maxLogFiles}${ext}`
      );
      
      try {
        await fs.unlink(oldestLogPath);
      } catch (error) {
        // File might not exist, ignore
      }

      // Rotate existing log files
      for (let i = this.options.maxLogFiles - 1; i >= 1; i--) {
        const oldPath = path.join(this.options.logDir, `${baseName}.${i}${ext}`);
        const newPath = path.join(this.options.logDir, `${baseName}.${i + 1}${ext}`);

        try {
          await fs.rename(oldPath, newPath);
        } catch (error) {
          // File might not exist, ignore
        }
      }

      // Rename current log file
      const rotatedPath = path.join(this.options.logDir, `${baseName}.1${ext}`);
      await fs.rename(this.logFilePath, rotatedPath);
    } catch (error) {
      console.error('[ErrorLogger] Failed to rotate log files:', error);
    }
  }

  /**
   * Get user-friendly error message
   * @param {string} category - Error category
   * @param {string} errorCode - Error code or type
   * @param {Object} [context] - Error context
   * @returns {string} User-friendly error message
   */
  getUserFriendlyMessage(category, errorCode, context = {}) {
    const messages = {
      [ErrorCategory.ACCOUNT]: {
        'create_failed': 'Failed to create account. Please check your input and try again.',
        'update_failed': 'Failed to update account settings. Please try again.',
        'delete_failed': 'Failed to delete account. Please try again.',
        'not_found': 'Account not found. It may have been deleted.',
        'duplicate_name': 'An account with this name already exists.',
        'invalid_config': 'Invalid account configuration. Please check your settings.'
      },
      [ErrorCategory.SESSION]: {
        'create_failed': 'Failed to create session. Please restart the application.',
        'expired': 'Your session has expired. Please log in again.',
        'corrupted': 'Session data is corrupted. You may need to log in again.',
        'clear_failed': 'Failed to clear session data. Please try again.'
      },
      [ErrorCategory.VIEW]: {
        'create_failed': 'Failed to create view. Please try again.',
        'load_failed': 'Failed to load WhatsApp Web. Please check your internet connection.',
        'crashed': 'The view has crashed. Please reload.',
        'unresponsive': 'The view is not responding. Please wait or reload.'
      },
      [ErrorCategory.NETWORK]: {
        'connection_failed': 'Network connection failed. Please check your internet connection.',
        'timeout': 'Connection timed out. Please try again.',
        'dns_failed': 'DNS resolution failed. Please check your network settings.'
      },
      [ErrorCategory.TRANSLATION]: {
        'injection_failed': 'Failed to inject translation scripts. Translation may not work.',
        'api_failed': 'Translation API request failed. Please try again.',
        'config_invalid': 'Invalid translation configuration. Please check your settings.'
      },
      [ErrorCategory.MIGRATION]: {
        'detection_failed': 'Failed to detect old configuration. Migration may not work correctly.',
        'backup_failed': 'Failed to create backup. Migration aborted for safety.',
        'migration_failed': 'Migration failed. Your old configuration is preserved.',
        'validation_failed': 'Migrated data validation failed. Please check your accounts.'
      },
      [ErrorCategory.IPC]: {
        'handler_failed': 'Internal communication error. Please try again.',
        'invalid_request': 'Invalid request. Please try again.',
        'timeout': 'Request timed out. Please try again.'
      },
      [ErrorCategory.SYSTEM]: {
        'initialization_failed': 'Failed to initialize application. Please restart.',
        'file_system_error': 'File system error. Please check permissions.',
        'out_of_memory': 'Out of memory. Please close some accounts or restart.',
        'unknown': 'An unexpected error occurred. Please try again.'
      }
    };

    const categoryMessages = messages[category] || messages[ErrorCategory.SYSTEM];
    const message = categoryMessages[errorCode] || categoryMessages['unknown'] || 'An error occurred. Please try again.';

    // Add context if available
    if (context.accountName) {
      return `${message} (Account: ${context.accountName})`;
    }

    return message;
  }

  /**
   * Read recent log entries
   * @param {number} [count=100] - Number of entries to read
   * @returns {Promise<Array>} Log entries
   */
  async getRecentLogs(count = 100) {
    try {
      const content = await fs.readFile(this.logFilePath, 'utf8');
      const lines = content.trim().split('\n');
      const recentLines = lines.slice(-count);

      return recentLines.map(line => {
        try {
          return JSON.parse(line);
        } catch (error) {
          return { raw: line };
        }
      });
    } catch (error) {
      console.error('[ErrorLogger] Failed to read logs:', error);
      return [];
    }
  }

  /**
   * Clear all log files
   * @returns {Promise<void>}
   */
  async clearLogs() {
    try {
      const files = await fs.readdir(this.options.logDir);
      
      for (const file of files) {
        if (file.startsWith(path.basename(this.options.logFileName, path.extname(this.options.logFileName)))) {
          await fs.unlink(path.join(this.options.logDir, file));
        }
      }

      await this.log(ErrorLevel.INFO, ErrorCategory.SYSTEM, 'All logs cleared');
    } catch (error) {
      console.error('[ErrorLogger] Failed to clear logs:', error);
      throw error;
    }
  }
}

// Create singleton instance
let errorLoggerInstance = null;

/**
 * Get ErrorLogger singleton instance
 * @param {Object} [options] - Configuration options (only used on first call)
 * @returns {ErrorLogger}
 */
function getErrorLogger(options = {}) {
  if (!errorLoggerInstance) {
    errorLoggerInstance = new ErrorLogger(options);
  }
  return errorLoggerInstance;
}

module.exports = {
  ErrorLogger,
  ErrorLevel,
  ErrorCategory,
  getErrorLogger
};
