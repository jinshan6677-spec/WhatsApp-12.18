/**
 * Test Utilities Index
 * 
 * Exports all test utilities, mocks, and arbitraries for easy importing.
 * 
 * @module test
 * Requirements: 10.1, 10.2, 10.3, 10.6
 */

'use strict';

// Mocks
const mocks = require('./mocks');

// Arbitraries
const arbitraries = require('./arbitraries');

// Test helpers
const helpers = require('./helpers');

module.exports = {
  // Re-export all mocks
  ...mocks,
  mocks,
  
  // Re-export all arbitraries
  ...arbitraries,
  arbitraries,
  
  // Re-export helpers
  ...helpers,
  helpers
};
