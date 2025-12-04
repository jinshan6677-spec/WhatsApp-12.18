/**
 * ErrorHandler - Utility for wrapping async operations with error handling
 * 
 * Provides decorators and wrappers for consistent error handling across the application.
 */

const { getErrorLogger, ErrorLevel, ErrorCategory } = require('./ErrorLogger');

/**
 * Wrap an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Options
 * @param {string} options.category - Error category
 * @param {string} options.operation - Operation name for logging
 * @param {Function} [options.onError] - Custom error handler
 * @param {boolean} [options.rethrow=false] - Whether to rethrow the error
 * @returns {Function} Wrapped function
 */
function wrapAsync(fn, options) {
  const { category, operation, onError, rethrow = false } = options;
  const logger = getErrorLogger();

  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      // Log the error
      await logger.error(
        category,
        `${operation} failed`,
        {
          operation,
          args: args.length > 0 ? args[0] : undefined,
          errorMessage: error.message
        },
        error
      );

      // Call custom error handler if provided
      if (onError && typeof onError === 'function') {
        try {
          return await onError(error, ...args);
        } catch (handlerError) {
          await logger.error(
            category,
            `Error handler for ${operation} failed`,
            { errorMessage: handlerError.message },
            handlerError
          );
        }
      }

      // Rethrow if requested
      if (rethrow) {
        throw error;
      }

      // Return error result
      return {
        success: false,
        error: error.message
      };
    }
  };
}

/**
 * Wrap an IPC handler with error handling
 * @param {Function} handler - IPC handler function
 * @param {Object} options - Options
 * @param {string} options.channel - IPC channel name
 * @param {string} options.category - Error category
 * @returns {Function} Wrapped handler
 */
function wrapIPCHandler(handler, options) {
  const { channel, category } = options;
  const logger = getErrorLogger();

  return async function(event, ...args) {
    try {
      return await handler.call(this, event, ...args);
    } catch (error) {
      // Log the error
      await logger.error(
        category,
        `IPC handler '${channel}' failed`,
        {
          channel,
          args: args.length > 0 ? args[0] : undefined,
          errorMessage: error.message
        },
        error
      );

      // Return error response
      return {
        success: false,
        error: error.message
      };
    }
  };
}

/**
 * Create a safe version of a method that catches and logs errors
 * @param {Object} instance - Object instance
 * @param {string} methodName - Method name
 * @param {Object} options - Options
 * @param {string} options.category - Error category
 * @param {*} [options.defaultReturn] - Default return value on error
 * @returns {Function} Safe method
 */
function createSafeMethod(instance, methodName, options) {
  const { category, defaultReturn = null } = options;
  const logger = getErrorLogger();
  const originalMethod = instance[methodName];

  if (typeof originalMethod !== 'function') {
    throw new Error(`Method ${methodName} not found on instance`);
  }

  return async function(...args) {
    try {
      return await originalMethod.apply(instance, args);
    } catch (error) {
      await logger.error(
        category,
        `Method ${methodName} failed`,
        {
          method: methodName,
          args: args.length > 0 ? args[0] : undefined,
          errorMessage: error.message
        },
        error
      );

      return defaultReturn;
    }
  };
}

/**
 * Handle uncaught exceptions
 * @param {Error} error - Uncaught error
 * @param {string} [source='uncaughtException'] - Error source
 */
async function handleUncaughtException(error, source = 'uncaughtException') {
  const logger = getErrorLogger();
  
  await logger.fatal(
    ErrorCategory.SYSTEM,
    `Uncaught exception from ${source}`,
    {
      source,
      errorMessage: error.message,
      errorName: error.name
    },
    error
  );

  // Give logger time to write
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Handle unhandled promise rejections
 * @param {*} reason - Rejection reason
 * @param {Promise} promise - Rejected promise
 */
async function handleUnhandledRejection(reason, promise) {
  const logger = getErrorLogger();
  
  const error = reason instanceof Error ? reason : new Error(String(reason));
  
  await logger.fatal(
    ErrorCategory.SYSTEM,
    'Unhandled promise rejection',
    {
      reason: String(reason),
      errorMessage: error.message
    },
    error
  );
}

/**
 * Setup global error handlers
 */
function setupGlobalErrorHandlers() {
  const logger = getErrorLogger();

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    await handleUncaughtException(error, 'uncaughtException');
    
    // Log to console as well
    console.error('[FATAL] Uncaught Exception:', error);
    
    // Exit gracefully
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    await handleUnhandledRejection(reason, promise);
    
    // Log to console as well
    console.error('[FATAL] Unhandled Rejection:', reason);
  });

  // Handle warnings
  process.on('warning', async (warning) => {
    await logger.warn(
      ErrorCategory.SYSTEM,
      'Process warning',
      {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      }
    );
  });

  logger.info(ErrorCategory.SYSTEM, 'Global error handlers initialized');
}

/**
 * Create error result object
 * @param {Error} error - Error object
 * @param {string} [category] - Error category
 * @param {string} [errorCode] - Error code
 * @returns {Object} Error result
 */
function createErrorResult(error, category = ErrorCategory.UNKNOWN, errorCode = 'unknown') {
  const logger = getErrorLogger();
  
  return {
    success: false,
    error: error.message,
    errorCode,
    userMessage: logger.getUserFriendlyMessage(category, errorCode, {
      errorMessage: error.message
    })
  };
}

/**
 * Validate and sanitize error for IPC response
 * @param {*} error - Error to sanitize
 * @returns {Object} Sanitized error object
 */
function sanitizeError(error) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      code: error.code,
      // Don't send stack traces to renderer for security
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }

  return {
    message: String(error),
    name: 'Error'
  };
}

/**
 * Retry an async operation with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Options
 * @param {number} [options.maxRetries=3] - Maximum number of retries
 * @param {number} [options.initialDelay=1000] - Initial delay in ms
 * @param {number} [options.maxDelay=10000] - Maximum delay in ms
 * @param {Function} [options.shouldRetry] - Function to determine if should retry
 * @returns {Promise<*>} Result of the operation
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt < maxRetries && shouldRetry(error, attempt)) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Exponential backoff
        delay = Math.min(delay * 2, maxDelay);
      } else {
        break;
      }
    }
  }

  throw lastError;
}

module.exports = {
  wrapAsync,
  wrapIPCHandler,
  createSafeMethod,
  handleUncaughtException,
  handleUnhandledRejection,
  setupGlobalErrorHandlers,
  createErrorResult,
  sanitizeError,
  retryWithBackoff
};
