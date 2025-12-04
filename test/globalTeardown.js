/**
 * Jest Global Teardown
 * 
 * Runs once after all test suites complete.
 * Used for global cleanup.
 * 
 * Requirements: 10.2
 */

'use strict';

module.exports = async () => {
  // Calculate total test duration
  const duration = Date.now() - (global.__TEST_START_TIME__ || Date.now());
  const seconds = (duration / 1000).toFixed(2);
  
  console.log(`\n✅ Test suite completed in ${seconds}s\n`);
  
  // Clean up any global state
  delete global.__TEST_START_TIME__;
  
  // Force garbage collection if available (helps with memory leaks)
  if (global.gc) {
    global.gc();
  }
};
