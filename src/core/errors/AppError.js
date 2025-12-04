'use strict';

/**
 * Base error class for all application errors.
 * Provides standardized error handling with code, context, and recoverability information.
 * 
 * @class AppError
 * @extends Error
 */
class AppError extends Error {
  /**
   * Creates an instance of AppError.
   * 
   * @param {string} message - Human-readable error message
   * @param {string} code - Error code for programmatic handling
   * @param {Object} [context={}] - Additional context information
   * @param {boolean} [recoverable=false] - Whether the error is recoverable
   */
  constructor(message, code, context = {}, recoverable = false) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.recoverable = recoverable;
    this.timestamp = new Date().toISOString();
    
    // Capture the original stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    // Preserve the original error if wrapped
    if (context.originalError instanceof Error) {
      this.originalError = context.originalError;
      this.originalStack = context.originalError.stack;
      this.originalMessage = context.originalError.message;
    }
  }

  /**
   * Serializes the error to a JSON-compatible object.
   * 
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      stack: this.stack,
      originalMessage: this.originalMessage,
      originalStack: this.originalStack
    };
  }

  /**
   * Creates an AppError instance from a JSON object.
   * 
   * @param {Object} json - JSON representation of the error
   * @returns {AppError} Reconstructed error instance
   */
  static fromJSON(json) {
    const error = new AppError(
      json.message,
      json.code,
      json.context,
      json.recoverable
    );
    error.timestamp = json.timestamp;
    error.originalMessage = json.originalMessage;
    error.originalStack = json.originalStack;
    
    // Restore the stack if available
    if (json.stack) {
      error.stack = json.stack;
    }
    
    return error;
  }

  /**
   * Wraps an existing error with additional context.
   * 
   * @param {Error} error - The original error to wrap
   * @param {string} [code] - Error code (defaults to 'WRAPPED_ERROR')
   * @param {Object} [additionalContext={}] - Additional context to add
   * @returns {AppError} Wrapped error instance
   */
  static wrap(error, code = 'WRAPPED_ERROR', additionalContext = {}) {
    if (error instanceof AppError) {
      // Merge context if already an AppError
      error.context = { ...error.context, ...additionalContext };
      return error;
    }
    
    return new AppError(
      error.message,
      code,
      { ...additionalContext, originalError: error },
      false
    );
  }
}

module.exports = AppError;
