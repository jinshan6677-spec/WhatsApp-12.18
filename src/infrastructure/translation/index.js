/**
 * Translation Infrastructure Module
 * 
 * Exports translation adapters and related infrastructure components.
 * 
 * @module infrastructure/translation
 */

'use strict';

const adapters = require('./adapters');

module.exports = {
  // Adapter interface and implementations
  ...adapters
};
