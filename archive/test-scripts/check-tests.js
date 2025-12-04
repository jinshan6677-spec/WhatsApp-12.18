#!/usr/bin/env node
/**
 * Check test status
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🧪 Running test suite...\n');

try {
  // Run tests and capture output
  const output = execSync('npx jest --no-coverage --runInBand --testTimeout=10000 2>&1', {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
  
  console.log(output);
  
  // Write output to file for analysis
  fs.writeFileSync('test-results.txt', output);
  
  console.log('\n✅ All tests passed!');
  console.log('Results saved to test-results.txt');
  process.exit(0);
} catch (error) {
  console.log(error.stdout || error.message);
  
  // Write output to file for analysis
  if (error.stdout) {
    fs.writeFileSync('test-results.txt', error.stdout);
  }
  
  console.log('\n❌ Some tests failed!');
  console.log('Results saved to test-results.txt');
  process.exit(1);
}
