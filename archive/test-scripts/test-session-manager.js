#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

try {
  const output = execSync('npx jest src/managers/__tests__/SessionManager.test.js --no-coverage --testTimeout=15000 --verbose 2>&1', {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  
  console.log(output);
  fs.writeFileSync('session-manager-test-output.txt', output);
  process.exit(0);
} catch (error) {
  console.log(error.stdout || error.message);
  if (error.stdout) {
    fs.writeFileSync('session-manager-test-output.txt', error.stdout);
  }
  process.exit(1);
}
