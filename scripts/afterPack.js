/**
 * After Pack Script
 * Handles post-packaging tasks like native module verification
 */

const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  console.log('Running afterPack script...');
  
  const { appOutDir, packager, electronPlatformName } = context;
  
  // Log packaging information
  console.log(`Platform: ${electronPlatformName}`);
  console.log(`Output directory: ${appOutDir}`);
  
  // Verify app.asar exists
  const asarPath = path.join(appOutDir, 'resources', 'app.asar');
  
  if (fs.existsSync(asarPath)) {
    console.log('✓ Application archive (app.asar) created successfully');
    const stats = fs.statSync(asarPath);
    console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } else {
    console.warn('⚠ Application archive not found');
  }
  
  // Check for executable
  let executableName;
  if (electronPlatformName === 'win32') {
    executableName = `${packager.appInfo.productName}.exe`;
  } else if (electronPlatformName === 'darwin') {
    executableName = `${packager.appInfo.productName}.app`;
  } else {
    executableName = packager.appInfo.productName;
  }
  
  const executablePath = path.join(appOutDir, executableName);
  if (fs.existsSync(executablePath)) {
    console.log(`✓ Executable created: ${executableName}`);
  } else {
    console.warn(`⚠ Executable not found: ${executableName}`);
  }
  
  console.log('afterPack script completed');
};
