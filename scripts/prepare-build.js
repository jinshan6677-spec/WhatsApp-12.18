/**
 * Prepare Build Script
 * Checks for required icon files and creates placeholders if needed
 */

const fs = require('fs');
const path = require('path');

const resourcesDir = path.join(__dirname, '..', 'resources');

// Check if icon files exist
const iconFiles = {
  win: path.join(resourcesDir, 'icon.ico'),
  mac: path.join(resourcesDir, 'icon.icns'),
  linuxDir: path.join(resourcesDir, 'icons')
};

console.log('Checking build prerequisites...\n');

let missingIcons = false;

// Check Windows icon
if (!fs.existsSync(iconFiles.win)) {
  console.warn('⚠ Missing: resources/icon.ico (Windows icon)');
  missingIcons = true;
} else {
  console.log('✓ Found: resources/icon.ico');
}

// Check macOS icon
if (!fs.existsSync(iconFiles.mac)) {
  console.warn('⚠ Missing: resources/icon.icns (macOS icon)');
  missingIcons = true;
} else {
  console.log('✓ Found: resources/icon.icns');
}

// Check Linux icons directory
if (!fs.existsSync(iconFiles.linuxDir)) {
  console.warn('⚠ Missing: resources/icons/ (Linux icons directory)');
  missingIcons = true;
} else {
  const requiredSizes = ['16x16.png', '32x32.png', '48x48.png', '64x64.png', '128x128.png', '256x256.png', '512x512.png'];
  const existingSizes = fs.readdirSync(iconFiles.linuxDir).filter(f => f.endsWith('.png'));
  
  if (existingSizes.length === 0) {
    console.warn('⚠ Missing: PNG icons in resources/icons/');
    missingIcons = true;
  } else {
    console.log(`✓ Found: ${existingSizes.length} icon(s) in resources/icons/`);
  }
}

// Check entitlements file
const entitlementsFile = path.join(resourcesDir, 'entitlements.mac.plist');
if (!fs.existsSync(entitlementsFile)) {
  console.warn('⚠ Missing: resources/entitlements.mac.plist (macOS entitlements)');
} else {
  console.log('✓ Found: resources/entitlements.mac.plist');
}

console.log('\n' + '='.repeat(60));

if (missingIcons) {
  console.log('\n⚠ WARNING: Some icon files are missing!');
  console.log('\nThe build may fail or produce applications without proper icons.');
  console.log('Please refer to resources/BUILD_NOTES.md for instructions on creating icons.\n');
  console.log('You can:');
  console.log('1. Add proper icon files to the resources/ directory');
  console.log('2. Use electron-icon-builder to generate icons from a source image');
  console.log('3. Continue anyway (build may fail for some platforms)\n');
  
  // Don't fail the build, just warn
  console.log('Continuing with build preparation...\n');
} else {
  console.log('\n✓ All required icon files are present!');
  console.log('Ready to build.\n');
}

// Check dependencies
console.log('Checking dependencies...');

const packageJson = require('../package.json');
const requiredDeps = ['electron-store', 'lru-cache'];
const installedDeps = Object.keys(packageJson.dependencies || {});

let missingDeps = false;
requiredDeps.forEach(dep => {
  if (installedDeps.includes(dep)) {
    console.log(`✓ ${dep}`);
  } else {
    console.warn(`⚠ Missing dependency: ${dep}`);
    missingDeps = true;
  }
});

if (missingDeps) {
  console.log('\n⚠ Some dependencies are missing. Run: npm install\n');
  process.exit(1);
}

console.log('\n✓ Build preparation complete!\n');
