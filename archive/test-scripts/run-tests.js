#!/usr/bin/env node
/**
 * Simple test runner to check all tests
 */

const { execSync } = require('child_process');

console.log('Running all tests...\n');

try {
  const output = execSync('npx jest --no-coverage --runInBand --verbose', {
    encoding: 'utf8',
    stdio: 'inherit',
    maxBuffer: 10 * 1024 * 1024
  });
  
  console.log('\n✅ All tests passed!');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Tests failed!');
  process.exit(1);
}
