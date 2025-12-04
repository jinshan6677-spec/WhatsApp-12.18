/**
 * Create Placeholder Icons
 * Creates simple placeholder icon files for testing builds
 * Note: Replace these with proper icons for production!
 */

const fs = require('fs');
const path = require('path');

const resourcesDir = path.join(__dirname, '..', 'resources');
const iconsDir = path.join(resourcesDir, 'icons');

console.log('Creating placeholder icon files for testing...\n');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
  console.log('✓ Created resources/icons/ directory');
}

// Create placeholder text files (electron-builder will warn but won't fail)
const placeholderContent = 'PLACEHOLDER - Replace with actual icon file';

// Windows icon placeholder
const winIconPath = path.join(resourcesDir, 'icon.ico');
if (!fs.existsSync(winIconPath)) {
  fs.writeFileSync(winIconPath, placeholderContent);
  console.log('✓ Created placeholder: resources/icon.ico');
  console.log('  ⚠ This is NOT a valid icon file - build will fail for Windows');
}

// macOS icon placeholder
const macIconPath = path.join(resourcesDir, 'icon.icns');
if (!fs.existsSync(macIconPath)) {
  fs.writeFileSync(macIconPath, placeholderContent);
  console.log('✓ Created placeholder: resources/icon.icns');
  console.log('  ⚠ This is NOT a valid icon file - build will fail for macOS');
}

// Linux icon placeholders
const sizes = ['16x16', '32x32', '48x48', '64x64', '128x128', '256x256', '512x512'];
sizes.forEach(size => {
  const iconPath = path.join(iconsDir, `${size}.png`);
  if (!fs.existsSync(iconPath)) {
    fs.writeFileSync(iconPath, placeholderContent);
    console.log(`✓ Created placeholder: resources/icons/${size}.png`);
  }
});

console.log('\n⚠ WARNING: These are placeholder files, not actual icons!');
console.log('The build will likely fail. Please create proper icon files.');
console.log('See resources/BUILD_NOTES.md for instructions.\n');
