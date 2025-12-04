/**
 * Plugin System Module
 * 
 * Exports all plugin-related components.
 * 
 * @module infrastructure/plugins
 */

'use strict';

const { PluginManager, PluginState, PluginRegistration, REQUIRED_PLUGIN_INTERFACE } = require('./PluginManager');
const { PluginContext, createPluginContext } = require('./PluginContext');

module.exports = {
  // PluginManager
  PluginManager,
  PluginState,
  PluginRegistration,
  REQUIRED_PLUGIN_INTERFACE,
  
  // PluginContext
  PluginContext,
  createPluginContext
};
