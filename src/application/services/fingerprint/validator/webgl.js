'use strict';

const { WINDOWS_WEBGL_VENDORS, MACOS_WEBGL_VENDORS, LINUX_WEBGL_VENDORS } = require('./constants');

function validateWebGLOS(config) {
  const errors = [];
  const warnings = [];
  const osType = config.os?.type || '';
  const webglMode = config.webgl?.mode || 'custom';
  if (webglMode === 'off' || webglMode === 'real') {
    return { errors, warnings };
  }
  const vendor = config.webgl?.vendor || '';
  const renderer = config.webgl?.renderer || '';
  const unmaskedVendor = config.webgl?.unmaskedVendor || '';
  const unmaskedRenderer = config.webgl?.unmaskedRenderer || '';
  let validVendors;
  switch (osType) {
    case 'windows':
      validVendors = WINDOWS_WEBGL_VENDORS;
      break;
    case 'macos':
      validVendors = MACOS_WEBGL_VENDORS;
      break;
    case 'linux':
      validVendors = LINUX_WEBGL_VENDORS;
      break;
    default:
      validVendors = [...WINDOWS_WEBGL_VENDORS, ...MACOS_WEBGL_VENDORS, ...LINUX_WEBGL_VENDORS];
  }
  const vendorLower = vendor.toLowerCase();
  const isValidVendor = validVendors.some(v => vendorLower.includes(v.toLowerCase()));
  if (!isValidVendor && vendor) {
    warnings.push({ field: 'webgl.vendor', reason: `WebGL vendor "${vendor}" may not be compatible with ${osType}`, value: vendor, suggestion: `Consider using a vendor compatible with ${osType}` });
  }
  const rendererLower = renderer.toLowerCase();
  const unmaskedRendererLower = unmaskedRenderer.toLowerCase();
  if (osType !== 'macos') {
    if (rendererLower.includes('apple m') || unmaskedRendererLower.includes('apple m')) {
      errors.push({ field: 'webgl.renderer', reason: 'Apple Silicon GPU (M1/M2/M3) is only available on macOS', value: renderer || unmaskedRenderer, suggestion: 'Use a GPU renderer compatible with the configured OS' });
    }
  }
  if (osType !== 'windows') {
    if (rendererLower.includes('direct3d') || rendererLower.includes('d3d11')) {
      errors.push({ field: 'webgl.renderer', reason: 'Direct3D renderer is only available on Windows', value: renderer, suggestion: 'Use OpenGL or Metal renderer for non-Windows OS' });
    }
  }
  if (osType === 'windows') {
    if (rendererLower.includes('mesa') || unmaskedRendererLower.includes('mesa')) {
      warnings.push({ field: 'webgl.renderer', reason: 'Mesa renderer is typically found on Linux, not Windows', value: renderer || unmaskedRenderer, suggestion: 'Consider using ANGLE or native Windows renderer' });
    }
  }
  return { errors, warnings };
}

function getValidWebGLVendors(osType) {
  switch (osType) {
    case 'windows':
      return [...WINDOWS_WEBGL_VENDORS];
    case 'macos':
      return [...MACOS_WEBGL_VENDORS];
    case 'linux':
      return [...LINUX_WEBGL_VENDORS];
    default:
      return [...WINDOWS_WEBGL_VENDORS];
  }
}

module.exports = { validateWebGLOS, getValidWebGLVendors };

