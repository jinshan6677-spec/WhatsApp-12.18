/**
 * Test script for single-window main.js integration
 * 
 * This script verifies that main.js correctly initializes the single-window architecture
 * and all required components are properly integrated.
 */

const path = require('path');
const fs = require('fs');

console.log('========================================');
console.log('Testing Single-Window Main.js Integration');
console.log('========================================\n');

// Test 1: Verify main.js exists and is readable
console.log('Test 1: Checking main.js file...');
const mainJsPath = path.join(__dirname, '..', 'src', 'main.js');
try {
  const mainJsContent = fs.readFileSync(mainJsPath, 'utf-8');
  console.log('✓ main.js file exists and is readable');
  
  // Test 2: Verify single-window imports
  console.log('\nTest 2: Checking single-window imports...');
  const requiredImports = [
    'MainWindow',
    'ViewManager',
    'MigrationManager',
    'MigrationDialog',
    'registerSingleWindowIPCHandlers'
  ];
  
  let allImportsFound = true;
  for (const importName of requiredImports) {
    if (mainJsContent.includes(importName)) {
      console.log(`  ✓ ${importName} imported`);
    } else {
      console.log(`  ✗ ${importName} NOT found`);
      allImportsFound = false;
    }
  }
  
  if (allImportsFound) {
    console.log('✓ All required imports present');
  } else {
    console.log('✗ Some imports missing');
  }
  
  // Test 3: Verify old multi-window components removed
  console.log('\nTest 3: Checking old multi-window components removed...');
  const removedComponents = [
    'InstanceManager',
    'MainApplicationWindow',
    'ErrorHandler',
    'ResourceManager',
    'registerContainerIPCHandlers'
  ];
  
  let allRemoved = true;
  for (const component of removedComponents) {
    // Check if it's imported (should not be)
    const importPattern = new RegExp(`require\\(['"].*${component}['"]\\)`, 'g');
    if (importPattern.test(mainJsContent)) {
      console.log(`  ✗ ${component} still imported`);
      allRemoved = false;
    } else {
      console.log(`  ✓ ${component} removed`);
    }
  }
  
  if (allRemoved) {
    console.log('✓ All old components removed');
  } else {
    console.log('✗ Some old components still present');
  }
  
  // Test 4: Verify initialization logic
  console.log('\nTest 4: Checking initialization logic...');
  const initChecks = [
    { name: 'MainWindow initialization', pattern: /mainWindow\s*=\s*new\s+MainWindow/ },
    { name: 'ViewManager initialization', pattern: /viewManager\s*=\s*new\s+ViewManager/ },
    { name: 'Migration detection', pattern: /migrationManager\.detectMigrationNeeded/ },
    { name: 'IPC handlers registration', pattern: /registerSingleWindowIPCHandlers/ }
  ];
  
  let allInitChecksPass = true;
  for (const check of initChecks) {
    if (check.pattern.test(mainJsContent)) {
      console.log(`  ✓ ${check.name} present`);
    } else {
      console.log(`  ✗ ${check.name} NOT found`);
      allInitChecksPass = false;
    }
  }
  
  if (allInitChecksPass) {
    console.log('✓ All initialization logic present');
  } else {
    console.log('✗ Some initialization logic missing');
  }
  
  // Test 5: Verify cleanup logic
  console.log('\nTest 5: Checking cleanup logic...');
  const cleanupChecks = [
    { name: 'ViewManager cleanup', pattern: /viewManager\.destroyAllViews|viewManager\.stopAllConnectionMonitoring/ },
    { name: 'IPC handlers unregistration', pattern: /unregisterSingleWindowIPCHandlers/ },
    { name: 'Account state saving', pattern: /accountConfigManager\.updateAccount/ }
  ];
  
  let allCleanupChecksPass = true;
  for (const check of cleanupChecks) {
    if (check.pattern.test(mainJsContent)) {
      console.log(`  ✓ ${check.name} present`);
    } else {
      console.log(`  ✗ ${check.name} NOT found`);
      allCleanupChecksPass = false;
    }
  }
  
  if (allCleanupChecksPass) {
    console.log('✓ All cleanup logic present');
  } else {
    console.log('✗ Some cleanup logic missing');
  }
  
  // Test 6: Verify required files exist
  console.log('\nTest 6: Checking required component files...');
  const requiredFiles = [
    'src/single-window/MainWindow.js',
    'src/presentation/windows/view-manager/ViewManager.js',
    'src/single-window/ipcHandlers.js',
    'src/single-window/migration/MigrationManager.js',
    'src/single-window/migration/MigrationDialog.js',
    'src/single-window/renderer/app.html',
    'src/single-window/renderer/preload-main.js'
  ];
  
  let allFilesExist = true;
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      console.log(`  ✓ ${file} exists`);
    } else {
      console.log(`  ✗ ${file} NOT found`);
      allFilesExist = false;
    }
  }
  
  if (allFilesExist) {
    console.log('✓ All required files exist');
  } else {
    console.log('✗ Some required files missing');
  }
  
  // Summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');
  
  const allTestsPass = allImportsFound && allRemoved && allInitChecksPass && allCleanupChecksPass && allFilesExist;
  
  if (allTestsPass) {
    console.log('✓ All tests passed!');
    console.log('\nThe main.js file has been successfully updated to use the single-window architecture.');
    console.log('Key changes:');
    console.log('  - Replaced InstanceManager with ViewManager');
    console.log('  - Replaced MainApplicationWindow with MainWindow');
    console.log('  - Added migration detection and handling');
    console.log('  - Updated IPC handler registration');
    console.log('  - Updated cleanup logic for BrowserViews');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed. Please review the output above.');
    process.exit(1);
  }
  
} catch (error) {
  console.error('✗ Error reading main.js:', error.message);
  process.exit(1);
}
