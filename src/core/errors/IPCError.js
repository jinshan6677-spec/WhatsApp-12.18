'use strict';

const AppError = require('./AppError');

/**
 * Error class for IPC communication failures.
 * Used for inter-process communication errors between main and renderer.
 * 
 * @class IPCError
 * @extends AppError
 */
class IPCError extends AppError {
  /**
   * Creates an instance of IPCError.
   * 
   * @param {string} message - Human-readable error message
   * @param {Object} [context={}] - Additional context (e.g., channel, requestId)
   * @param {boolean} [recoverable=true] - IPC errors are often recoverable
   */
  constructor(message, context = {}, recoverable = true) {
    super(message, 'IPC_ERROR', context, recoverable);
    this.channel = context.channel;
    this.requestId = context.requestId;
  }

  /**
   * Creates an IPCError from a JSON object.
   * 
   * @param {Object} json - JSON representation of the error
   * @returns {IPCError} Reconstructed error instance
   */
  static fromJSON(json) {
    const error = new IPCError(json.message, json.context, json.recoverable);
    error.timestamp = json.timestamp;
    if (json.stack) {
      error.stack = json.stack;
    }
    return error;
  }

  /**
   * Creates a timeout error.
   * 
   * @param {string} channel - The IPC channel that timed out
   * @param {string} requestId - The request ID
   * @param {number} timeout - Timeout duration in milliseconds
   * @returns {IPCError} Timeout error instance
   */
  static timeout(channel, requestId, timeout) {
    return new IPCError(
      `IPC request to '${channel}' timed out after ${timeout}ms`,
      { channel, requestId, timeout, type: 'timeout' }
    );
  }

  /**
   * Creates a validation error.
   * 
   * @param {string} channel - The IPC channel with invalid payload
   * @param {string} requestId - The request ID
   * @param {string[]} errors - List of validation errors
   * @returns {IPCError} Validation error instance
   */
  static validationFailed(channel, requestId, errors) {
    return new IPCError(
      `IPC request to '${channel}' failed validation`,
      { channel, requestId, type: 'validation', validationErrors: errors }
    );
  }

  /**
   * Creates a handler error.
   * 
   * @param {string} channel - The IPC channel where handler failed
   * @param {string} requestId - The request ID
   * @param {Error} [originalError] - The original handler error
   * @returns {IPCError} Handler error instance
   */
  static handlerFailed(channel, requestId, originalError) {
    return new IPCError(
      `IPC handler for '${channel}' threw an error`,
      { channel, requestId, type: 'handler', originalError }
    );
  }
}

module.exports = IPCError;
