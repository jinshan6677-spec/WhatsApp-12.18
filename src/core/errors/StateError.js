'use strict';

const AppError = require('./AppError');

/**
 * Error class for state management failures.
 * Used for state corruption, persistence, and restoration errors.
 * 
 * @class StateError
 * @extends AppError
 */
class StateError extends AppError {
  /**
   * Creates an instance of StateError.
   * 
   * @param {string} message - Human-readable error message
   * @param {Object} [context={}] - Additional context (e.g., state slice)
   * @param {boolean} [recoverable=true] - State errors may be recoverable
   */
  constructor(message, context = {}, recoverable = true) {
    super(message, 'STATE_ERROR', context, recoverable);
    this.stateSlice = context.stateSlice;
    this.operation = context.operation;
  }

  /**
   * Creates a StateError from a JSON object.
   * 
   * @param {Object} json - JSON representation of the error
   * @returns {StateError} Reconstructed error instance
   */
  static fromJSON(json) {
    const error = new StateError(json.message, json.context, json.recoverable);
    error.timestamp = json.timestamp;
    if (json.stack) {
      error.stack = json.stack;
    }
    return error;
  }

  /**
   * Creates a state corruption error.
   * 
   * @param {string} [stateSlice] - The corrupted state slice
   * @param {string} [reason] - Reason for corruption detection
   * @returns {StateError} Corruption error instance
   */
  static corruption(stateSlice, reason) {
    return new StateError(
      `State corruption detected${stateSlice ? ` in '${stateSlice}'` : ''}: ${reason}`,
      { stateSlice, operation: 'validation', reason }
    );
  }

  /**
   * Creates a state persistence error.
   * 
   * @param {Error} [originalError] - The original persistence error
   * @returns {StateError} Persistence error instance
   */
  static persistenceFailed(originalError) {
    return new StateError(
      'Failed to persist application state',
      { operation: 'persist', originalError }
    );
  }

  /**
   * Creates a state restoration error.
   * 
   * @param {Error} [originalError] - The original restoration error
   * @returns {StateError} Restoration error instance
   */
  static restorationFailed(originalError) {
    return new StateError(
      'Failed to restore application state',
      { operation: 'restore', originalError }
    );
  }
}

module.exports = StateError;
