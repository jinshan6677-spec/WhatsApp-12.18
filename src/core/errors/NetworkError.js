'use strict';

const AppError = require('./AppError');

/**
 * Error class for network-related failures.
 * Used for connection issues and timeouts.
 * 
 * @class NetworkError
 * @extends AppError
 */
class NetworkError extends AppError {
  /**
   * Creates an instance of NetworkError.
   * 
   * @param {string} message - Human-readable error message
   * @param {Object} [context={}] - Additional context (e.g., URL, status code)
   * @param {boolean} [recoverable=true] - Network errors are often recoverable via retry
   */
  constructor(message, context = {}, recoverable = true) {
    super(message, 'NETWORK_ERROR', context, recoverable);
    this.statusCode = context.statusCode;
    this.url = context.url;
  }

  /**
   * Creates a NetworkError from a JSON object.
   * 
   * @param {Object} json - JSON representation of the error
   * @returns {NetworkError} Reconstructed error instance
   */
  static fromJSON(json) {
    const error = new NetworkError(json.message, json.context, json.recoverable);
    error.timestamp = json.timestamp;
    if (json.stack) {
      error.stack = json.stack;
    }
    return error;
  }

  /**
   * Creates a timeout error.
   * 
   * @param {string} url - The URL that timed out
   * @param {number} timeout - Timeout duration in milliseconds
   * @returns {NetworkError} Timeout error instance
   */
  static timeout(url, timeout) {
    return new NetworkError(
      `Request to '${url}' timed out after ${timeout}ms`,
      { url, timeout, type: 'timeout' }
    );
  }

  /**
   * Creates a connection error.
   * 
   * @param {string} url - The URL that failed to connect
   * @param {Error} [originalError] - The original connection error
   * @returns {NetworkError} Connection error instance
   */
  static connectionFailed(url, originalError) {
    return new NetworkError(
      `Failed to connect to '${url}'`,
      { url, type: 'connection', originalError }
    );
  }
}

module.exports = NetworkError;
