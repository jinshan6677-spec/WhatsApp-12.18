/**
 * Final Test Execution Script
 * Runs all available tests and generates a comprehensive report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test scripts to run
const testScripts = [
  { name: 'Requirements Verification', script: 'verify-requirements.js', critical: true },
  { name: 'Unit Tests', script: 'run-unit-tests.js', critical: true },
  { name: 'Account Management', script: 'test-setup.js', critical: true },
  { name: 'Session Isolation', script: 'test-session-isolation.js', critical: true },
  { name: 'Session Persistence', script: 'test-session-persistence.js', critical: true },
  { name: 'Translation Integration', script: 'test-translation-integration.js', critical: true },
  { name: 'Translation Routing', script: 'test-translation-routing.js', critical: true },
  { name: 'Status Monitoring', script: 'test-status-monitoring.js', critical: true },
  { name: 'Login Status Detection', script: 'test-login-status-detection.js', critical: false },
  { name: 'Migration Detection', script: 'test-migration-detection.js', critical: true },
  { name: 'Configuration Migration', script: 'test-configuration-migration.js', critical: true },
  { name: 'Session Data Migration', script: 'test-session-data-migration.js', critical: true },
  { name: 'Migration UI', script: 'test-migration-ui.js', critical: false },
  { name: 'Single Window Main', script: 'test-single-window-main.js', critical: true },
  { name: 'Lifecycle Management', script: 'test-lifecycle-management.js', critical: true },
  { name: 'Preload Main', script: 'test-preload-main.js', critical: true },
  { name: 'Error Handling', script: 'test-error-handling.js', critical: true },
  { name: 'Edge Case Validation', script: 'test-edge-case-validation.js', critical: true },
  { name: 'Recovery Mechanisms', script: 'test-recovery-mechanisms.js', critical: false },
  { name: 'Integration Tests', script: 'test-integration.js', critical: false },
  { name: 'Performance Optimization', script: 'test-performance-optimization.js', critical: false },
  { name: 'Memory Management', script: 'test-memory-management.js', critical: false }
];

// Results tracking
const results = {
  passed: [],
  failed: [],
  skipped: [],
  warnings: []
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runTest(testInfo) {
  const scriptPath = path.join(__dirname, testInfo.script);
  
  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    log(`  ⊘ SKIPPED: Script not found`, 'yellow');
    results.skipped.push({
      name: testInfo.name,
      reason: 'Script not found'
    });
    return;
  }

  try {
    log(`  → Running...`, 'cyan');
    
    // Run the test script
    const output = execSync(`node "${scriptPath}"`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 60000 // 60 second timeout
    });
    
    log(`  ✓ PASSED`, 'green');
    results.passed.push({
      name: testInfo.name,
      output: output
    });
    
  } catch (error) {
    if (testInfo.critical) {
      log(`  ✗ FAILED (Critical)`, 'red');
      results.failed.push({
        name: testInfo.name,
        error: error.message,
        output: error.stdout || error.stderr || '',
        critical: true
      });
    } else {
      log(`  ⚠ FAILED (Non-Critical)`, 'yellow');
      results.warnings.push({
        name: testInfo.name,
        error: error.message,
        output: error.stdout || error.stderr || ''
      });
    }
  }
}

function generateReport() {
  log('\n' + '='.repeat(80), 'bright');
  log('FINAL TEST REPORT', 'bright');
  log('='.repeat(80), 'bright');
  
  // Summary
  const total = testScripts.length;
  const passed = results.passed.length;
  const failed = results.failed.length;
  const warnings = results.warnings.length;
  const skipped = results.skipped.length;
  
  log(`\nTotal Tests: ${total}`, 'cyan');
  log(`✓ Passed: ${passed}`, 'green');
  log(`✗ Failed: ${failed}`, 'red');
  log(`⚠ Warnings: ${warnings}`, 'yellow');
  log(`⊘ Skipped: ${skipped}`, 'yellow');
  
  // Pass rate
  const passRate = ((passed / (total - skipped)) * 100).toFixed(2);
  log(`\nPass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'red');
  
  // Passed tests
  if (results.passed.length > 0) {
    log('\n' + '-'.repeat(80), 'green');
    log('PASSED TESTS', 'green');
    log('-'.repeat(80), 'green');
    results.passed.forEach(test => {
      log(`  ✓ ${test.name}`, 'green');
    });
  }
  
  // Failed tests
  if (results.failed.length > 0) {
    log('\n' + '-'.repeat(80), 'red');
    log('FAILED TESTS (CRITICAL)', 'red');
    log('-'.repeat(80), 'red');
    results.failed.forEach(test => {
      log(`  ✗ ${test.name}`, 'red');
      log(`    Error: ${test.error}`, 'red');
    });
  }
  
  // Warnings
  if (results.warnings.length > 0) {
    log('\n' + '-'.repeat(80), 'yellow');
    log('WARNINGS (NON-CRITICAL)', 'yellow');
    log('-'.repeat(80), 'yellow');
    results.warnings.forEach(test => {
      log(`  ⚠ ${test.name}`, 'yellow');
      log(`    Error: ${test.error}`, 'yellow');
    });
  }
  
  // Skipped tests
  if (results.skipped.length > 0) {
    log('\n' + '-'.repeat(80), 'yellow');
    log('SKIPPED TESTS', 'yellow');
    log('-'.repeat(80), 'yellow');
    results.skipped.forEach(test => {
      log(`  ⊘ ${test.name}: ${test.reason}`, 'yellow');
    });
  }
  
  // Final verdict
  log('\n' + '='.repeat(80), 'bright');
  if (results.failed.length === 0) {
    log('VERDICT: ✓ ALL CRITICAL TESTS PASSED', 'green');
    log('Status: READY FOR RELEASE', 'green');
  } else {
    log('VERDICT: ✗ CRITICAL TESTS FAILED', 'red');
    log('Status: NOT READY FOR RELEASE', 'red');
  }
  log('='.repeat(80), 'bright');
  
  // Save report to file
  const reportPath = path.join(__dirname, '..', 'docs', 'TEST_RESULTS.md');
  const reportContent = generateMarkdownReport();
  fs.writeFileSync(reportPath, reportContent);
  log(`\nDetailed report saved to: ${reportPath}`, 'cyan');
}

function generateMarkdownReport() {
  const timestamp = new Date().toISOString();
  const total = testScripts.length;
  const passed = results.passed.length;
  const failed = results.failed.length;
  const warnings = results.warnings.length;
  const skipped = results.skipped.length;
  const passRate = ((passed / (total - skipped)) * 100).toFixed(2);
  
  let report = `# Test Results Report\n\n`;
  report += `**Generated**: ${timestamp}\n\n`;
  report += `## Summary\n\n`;
  report += `- **Total Tests**: ${total}\n`;
  report += `- **Passed**: ${passed} ✓\n`;
  report += `- **Failed**: ${failed} ✗\n`;
  report += `- **Warnings**: ${warnings} ⚠\n`;
  report += `- **Skipped**: ${skipped} ⊘\n`;
  report += `- **Pass Rate**: ${passRate}%\n\n`;
  
  if (results.failed.length === 0) {
    report += `## Verdict: ✓ READY FOR RELEASE\n\n`;
    report += `All critical tests passed successfully.\n\n`;
  } else {
    report += `## Verdict: ✗ NOT READY FOR RELEASE\n\n`;
    report += `${results.failed.length} critical test(s) failed.\n\n`;
  }
  
  if (results.passed.length > 0) {
    report += `## Passed Tests\n\n`;
    results.passed.forEach(test => {
      report += `- ✓ ${test.name}\n`;
    });
    report += `\n`;
  }
  
  if (results.failed.length > 0) {
    report += `## Failed Tests (Critical)\n\n`;
    results.failed.forEach(test => {
      report += `### ✗ ${test.name}\n\n`;
      report += `**Error**: ${test.error}\n\n`;
      if (test.output) {
        report += `**Output**:\n\`\`\`\n${test.output.substring(0, 500)}\n\`\`\`\n\n`;
      }
    });
  }
  
  if (results.warnings.length > 0) {
    report += `## Warnings (Non-Critical)\n\n`;
    results.warnings.forEach(test => {
      report += `### ⚠ ${test.name}\n\n`;
      report += `**Error**: ${test.error}\n\n`;
    });
  }
  
  if (results.skipped.length > 0) {
    report += `## Skipped Tests\n\n`;
    results.skipped.forEach(test => {
      report += `- ⊘ ${test.name}: ${test.reason}\n`;
    });
    report += `\n`;
  }
  
  return report;
}

// Main execution
async function main() {
  log('='.repeat(80), 'bright');
  log('FINAL TEST SUITE EXECUTION', 'bright');
  log('='.repeat(80), 'bright');
  log(`\nRunning ${testScripts.length} test scripts...\n`, 'cyan');
  
  for (const testInfo of testScripts) {
    log(`\n${testInfo.name}${testInfo.critical ? ' (Critical)' : ' (Optional)'}`, 'bright');
    runTest(testInfo);
  }
  
  generateReport();
  
  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
main().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
