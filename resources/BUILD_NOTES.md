# Build Configuration Notes

## Icon Files Required

For proper packaging, you need to provide the following icon files in the `resources` directory:

### Windows
- `icon.ico` - Windows application icon (256x256 or multi-size .ico file)

### macOS
- `icon.icns` - macOS application icon (512x512@2x or multi-size .icns file)
- `entitlements.mac.plist` - macOS entitlements file for hardened runtime

### Linux
- `icons/` directory with PNG files:
  - `16x16.png`
  - `32x32.png`
  - `48x48.png`
  - `64x64.png`
  - `128x128.png`
  - `256x256.png`
  - `512x512.png`

## Creating Icons

You can create icons from a source image using tools like:
- **electron-icon-builder**: `npm install -g electron-icon-builder`
- **png2icons**: Online tool at https://www.npmjs.com/package/png2icons
- **ImageMagick**: Command-line tool for image conversion

Example using electron-icon-builder:
```bash
electron-icon-builder --input=./source-icon.png --output=./resources
```

## macOS Entitlements

Create `resources/entitlements.mac.plist` with the following content:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
</dict>
</plist>
```

## Build Commands

After adding icon files, you can build the application:

```bash
# Install dependencies
npm install

# Build for current platform
npm run build

# Build for specific platforms
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux

# Build for all platforms
npm run build:all

# Create unpacked directory (for testing)
npm run pack
```

## Testing the Build

Before distributing, test the packaged application:

1. Run `npm run pack` to create an unpacked build in `dist/`
2. Navigate to the unpacked directory
3. Run the executable to verify functionality
4. Test all translation features
5. Verify configuration persistence
6. Check for any console errors

## Distribution

Built files will be in the `dist/` directory:
- **Windows**: `.exe` installer and portable `.exe`
- **macOS**: `.dmg` disk image and `.zip` archive
- **Linux**: `.AppImage`, `.deb`, and `.rpm` packages

## Code Signing (Optional)

For production releases, consider code signing:

### Windows
Set environment variables:
```bash
set CSC_LINK=path/to/certificate.pfx
set CSC_KEY_PASSWORD=your_password
```

### macOS
Set environment variables:
```bash
export CSC_LINK=path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password
export APPLE_ID=your@apple.id
export APPLE_ID_PASSWORD=app-specific-password
```

## Troubleshooting

### Native Dependencies
If you encounter issues with native modules (like better-sqlite3):
```bash
npm run postinstall
```

### Build Fails
- Ensure all icon files are present
- Check that all dependencies are installed
- Verify Node.js and npm versions are compatible
- Review build logs in `dist/` directory

### Large Bundle Size
To reduce bundle size:
- Remove unnecessary files from `files` array in package.json
- Use `asar` packing (enabled by default)
- Exclude development dependencies
