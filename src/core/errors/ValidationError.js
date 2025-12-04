'use strict';

const AppError = require('./AppError');

/**
 * Error class for validation failures.
 * Used when data does not conform to expected schema or constraints.
 * 
 * @class ValidationError
 * @extends AppError
 */
class ValidationError extends AppError {
  /**
   * Creates an instance of ValidationError.
   * 
   * @param {string} message - Human-readable error message
   * @param {Object} [context={}] - Additional context (e.g., field details)
   * @param {boolean} [recoverable=true] - Validation errors are typically recoverable
   */
  constructor(message, context = {}, recoverable = true) {
    super(message, 'VALIDATION_ERROR', context, recoverable);
    this.fields = context.fields || [];
  }

  /**
   * Creates a ValidationError from a JSON object.
   * 
   * @param {Object} json - JSON representation of the error
   * @returns {ValidationError} Reconstructed error instance
   */
  static fromJSON(json) {
    const error = new ValidationError(json.message, json.context, json.recoverable);
    error.timestamp = json.timestamp;
    if (json.stack) {
      error.stack = json.stack;
    }
    return error;
  }

  /**
   * Creates a ValidationError for a specific field.
   * 
   * @param {string} fieldName - Name of the invalid field
   * @param {string} reason - Reason for validation failure
   * @param {*} [value] - The invalid value
   * @returns {ValidationError} Field-specific validation error
   */
  static forField(fieldName, reason, value) {
    return new ValidationError(
      `Validation failed for field '${fieldName}': ${reason}`,
      {
        fields: [{ field: fieldName, reason, value }]
      }
    );
  }
}

module.exports = ValidationError;
