'use strict';

const AppError = require('./AppError');

/**
 * Error class for storage-related failures.
 * Used for file system, database, and persistence errors.
 * 
 * @class StorageError
 * @extends AppError
 */
class StorageError extends AppError {
  /**
   * Creates an instance of StorageError.
   * 
   * @param {string} message - Human-readable error message
   * @param {Object} [context={}] - Additional context (e.g., path, operation)
   * @param {boolean} [recoverable=false] - Storage errors may not be recoverable
   */
  constructor(message, context = {}, recoverable = false) {
    super(message, 'STORAGE_ERROR', context, recoverable);
    this.path = context.path;
    this.operation = context.operation;
  }

  /**
   * Creates a StorageError from a JSON object.
   * 
   * @param {Object} json - JSON representation of the error
   * @returns {StorageError} Reconstructed error instance
   */
  static fromJSON(json) {
    const error = new StorageError(json.message, json.context, json.recoverable);
    error.timestamp = json.timestamp;
    if (json.stack) {
      error.stack = json.stack;
    }
    return error;
  }

  /**
   * Creates a read error.
   * 
   * @param {string} path - The path that failed to read
   * @param {Error} [originalError] - The original read error
   * @returns {StorageError} Read error instance
   */
  static readFailed(path, originalError) {
    return new StorageError(
      `Failed to read from '${path}'`,
      { path, operation: 'read', originalError },
      true // Read errors may be recoverable with defaults
    );
  }

  /**
   * Creates a write error.
   * 
   * @param {string} path - The path that failed to write
   * @param {Error} [originalError] - The original write error
   * @returns {StorageError} Write error instance
   */
  static writeFailed(path, originalError) {
    return new StorageError(
      `Failed to write to '${path}'`,
      { path, operation: 'write', originalError }
    );
  }

  /**
   * Creates a migration error.
   * 
   * @param {string} version - The migration version that failed
   * @param {Error} [originalError] - The original migration error
   * @returns {StorageError} Migration error instance
   */
  static migrationFailed(version, originalError) {
    return new StorageError(
      `Migration to version '${version}' failed`,
      { version, operation: 'migration', originalError }
    );
  }
}

module.exports = StorageError;
