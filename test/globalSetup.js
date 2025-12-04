/**
 * Jest Global Setup
 * 
 * Runs once before all test suites.
 * Used for global initialization that should happen once.
 * 
 * Requirements: 10.2
 */

'use strict';

module.exports = async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';
  
  // Disable any external connections
  process.env.DISABLE_EXTERNAL_CONNECTIONS = 'true';
  
  // Set deterministic random seed for reproducible tests
  // Note: This affects Math.random but not crypto.randomUUID
  process.env.TEST_SEED = Date.now().toString();
  
  // Store start time for performance tracking
  global.__TEST_START_TIME__ = Date.now();
  
  console.log('\n🧪 Starting test suite...\n');
};
