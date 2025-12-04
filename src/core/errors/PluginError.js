'use strict';

const AppError = require('./AppError');

/**
 * Error class for plugin-related failures.
 * Used for plugin loading, initialization, and runtime errors.
 * 
 * @class PluginError
 * @extends AppError
 */
class PluginError extends AppError {
  /**
   * Creates an instance of PluginError.
   * 
   * @param {string} message - Human-readable error message
   * @param {Object} [context={}] - Additional context (e.g., plugin name)
   * @param {boolean} [recoverable=true] - Plugin errors are often recoverable
   */
  constructor(message, context = {}, recoverable = true) {
    super(message, 'PLUGIN_ERROR', context, recoverable);
    this.pluginName = context.pluginName;
    this.phase = context.phase;
  }

  /**
   * Creates a PluginError from a JSON object.
   * 
   * @param {Object} json - JSON representation of the error
   * @returns {PluginError} Reconstructed error instance
   */
  static fromJSON(json) {
    const error = new PluginError(json.message, json.context, json.recoverable);
    error.timestamp = json.timestamp;
    if (json.stack) {
      error.stack = json.stack;
    }
    return error;
  }

  /**
   * Creates a plugin load error.
   * 
   * @param {string} pluginName - Name of the plugin that failed to load
   * @param {Error} [originalError] - The original load error
   * @returns {PluginError} Load error instance
   */
  static loadFailed(pluginName, originalError) {
    return new PluginError(
      `Failed to load plugin '${pluginName}'`,
      { pluginName, phase: 'load', originalError }
    );
  }

  /**
   * Creates a plugin initialization error.
   * 
   * @param {string} pluginName - Name of the plugin that failed to initialize
   * @param {Error} [originalError] - The original initialization error
   * @returns {PluginError} Initialization error instance
   */
  static initFailed(pluginName, originalError) {
    return new PluginError(
      `Failed to initialize plugin '${pluginName}'`,
      { pluginName, phase: 'init', originalError }
    );
  }

  /**
   * Creates a plugin interface validation error.
   * 
   * @param {string} pluginName - Name of the plugin with invalid interface
   * @param {string[]} missingMembers - List of missing interface members
   * @returns {PluginError} Interface validation error instance
   */
  static invalidInterface(pluginName, missingMembers) {
    return new PluginError(
      `Plugin '${pluginName}' does not implement required interface. Missing: ${missingMembers.join(', ')}`,
      { pluginName, phase: 'validation', missingMembers },
      false
    );
  }
}

module.exports = PluginError;
