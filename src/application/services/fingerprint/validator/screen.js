'use strict';

const { COMMON_RESOLUTIONS } = require('./constants');

function validateResolution(config, strict = false) {
  const errors = [];
  const warnings = [];
  const screen = config.hardware?.screen || {};
  const width = screen.width || 0;
  const height = screen.height || 0;
  const availWidth = screen.availWidth || 0;
  const availHeight = screen.availHeight || 0;
  const devicePixelRatio = config.hardware?.devicePixelRatio || 1;
  const osType = config.os?.type || '';
  const allResolutions = [...COMMON_RESOLUTIONS.desktop, ...COMMON_RESOLUTIONS.laptop];
  const isCommonResolution = allResolutions.some(r => r.width === width && r.height === height);
  if (!isCommonResolution && strict) {
    warnings.push({ field: 'hardware.screen', reason: `Screen resolution ${width}x${height} is not a common resolution`, value: { width, height }, suggestion: 'Consider using a common resolution like 1920x1080 or 1366x768' });
  }
  const aspectRatio = width / height;
  if (aspectRatio < 1.2 || aspectRatio > 2.5) {
    warnings.push({ field: 'hardware.screen', reason: `Screen aspect ratio ${aspectRatio.toFixed(2)} is unusual`, value: { width, height, aspectRatio }, suggestion: 'Most screens have aspect ratios between 4:3 (1.33) and 21:9 (2.33)' });
  }
  if (availWidth > width) {
    errors.push({ field: 'hardware.screen.availWidth', reason: 'Available width cannot be greater than screen width', value: { availWidth, width }, suggestion: 'Set availWidth to be less than or equal to width' });
  }
  if (availHeight > height) {
    errors.push({ field: 'hardware.screen.availHeight', reason: 'Available height cannot be greater than screen height', value: { availHeight, height }, suggestion: 'Set availHeight to be less than or equal to height' });
  }
  if (osType === 'macos' && devicePixelRatio < 2) {
    warnings.push({ field: 'hardware.devicePixelRatio', reason: 'Most modern Macs have Retina displays with devicePixelRatio of 2', value: devicePixelRatio, suggestion: 'Consider setting devicePixelRatio to 2 for macOS' });
  }
  if (width >= 3840 && devicePixelRatio < 1.5) {
    warnings.push({ field: 'hardware.devicePixelRatio', reason: '4K+ resolution typically has higher devicePixelRatio', value: { width, devicePixelRatio }, suggestion: 'Consider increasing devicePixelRatio for high-resolution displays' });
  }
  return { errors, warnings };
}

module.exports = { validateResolution };

