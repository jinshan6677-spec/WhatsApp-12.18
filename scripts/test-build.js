/**
 * Test Build Script
 * Tests the packaged application for basic functionality
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Testing packaged application...\n');

const distDir = path.join(__dirname, '..', 'dist');

// Check if dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ directory not found. Run npm run pack first.');
  process.exit(1);
}

console.log('✓ dist/ directory found');

// Find unpacked directory
const unpackedDirs = fs.readdirSync(distDir)
  .filter(f => f.includes('unpacked'))
  .map(f => path.join(distDir, f));

if (unpackedDirs.length === 0) {
  console.error('❌ No unpacked build found. Run npm run pack first.');
  process.exit(1);
}

const unpackedDir = unpackedDirs[0];
console.log(`✓ Found unpacked build: ${path.basename(unpackedDir)}`);

// Check for main files
const requiredFiles = [
  'resources/app.asar',
  'resources/app.asar.unpacked'
];

let allFilesPresent = true;
requiredFiles.forEach(file => {
  const filePath = path.join(unpackedDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${file}`);
  } else {
    console.error(`❌ Missing: ${file}`);
    allFilesPresent = false;
  }
});

if (!allFilesPresent) {
  console.error('\n❌ Build test failed: Missing required files');
  process.exit(1);
}

console.log('\n✓ All build tests passed!');
console.log('\nNext steps:');
console.log('1. Manually test the application in dist/');
console.log('2. Verify translation features work correctly');
console.log('3. Check configuration persistence');
console.log('4. Run npm run build to create installers\n');
