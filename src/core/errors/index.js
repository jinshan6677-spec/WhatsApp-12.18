'use strict';

const AppError = require('./AppError');
const ValidationError = require('./ValidationError');
const NetworkError = require('./NetworkError');
const StorageError = require('./StorageError');
const PluginError = require('./PluginError');
const IPCError = require('./IPCError');
const StateError = require('./StateError');
const { 
  ErrorHandler, 
  createErrorHandler, 
  getGlobalErrorHandler,
  resetGlobalErrorHandler 
} = require('./ErrorHandler');

/**
 * Error type registry for deserialization.
 * Maps error names to their constructors.
 */
const ErrorTypes = {
  AppError,
  ValidationError,
  NetworkError,
  StorageError,
  PluginError,
  IPCError,
  StateError
};

/**
 * Deserializes an error from JSON, using the correct error type.
 * 
 * @param {Object} json - JSON representation of the error
 * @returns {AppError} Reconstructed error instance of the correct type
 */
function fromJSON(json) {
  const ErrorClass = ErrorTypes[json.name] || AppError;
  return ErrorClass.fromJSON(json);
}

module.exports = {
  AppError,
  ValidationError,
  NetworkError,
  StorageError,
  PluginError,
  IPCError,
  StateError,
  ErrorTypes,
  fromJSON,
  // ErrorHandler exports
  ErrorHandler,
  createErrorHandler,
  getGlobalErrorHandler,
  resetGlobalErrorHandler
};
