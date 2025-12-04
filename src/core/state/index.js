/**
 * State Management Module
 * 
 * Exports StateManager and related utilities for centralized state management.
 * 
 * @module core/state
 */

'use strict';

const { StateManager, createStateManager, getGlobalStateManager } = require('./StateManager');

module.exports = {
  StateManager,
  createStateManager,
  getGlobalStateManager
};
