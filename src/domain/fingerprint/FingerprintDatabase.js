'use strict';

const fs = require('fs');
/**
 * FingerprintDatabase - Real Browser Fingerprint Database
 * 
 * Provides access to a database of real browser fingerprint configurations
 * for generating realistic and consistent fingerprints. Supports retrieval
 * by OS and browser type, and implements synthetic combination strategies
 * to avoid generating identical fingerprints.
 * 
 * Requirements: 26.1, 26.2, 26.3, 26.6, 26.7
 * 
 * Key Features:
 * - 100+ real browser configurations
 * - Retrieval by OS/browser type
 * - Synthetic combination strategy (avoids exact duplicates)
 * - Version management and backward compatibility
 * - Compliant data sources (public test datasets, synthetic combinations)
 */

/**
 * Supported Operating Systems
 * @readonly
 * @enum {string}
 */
const OSType = {
  Windows: 'windows',
  MacOS: 'macos',
  Linux: 'linux'
};

/**
 * Supported Browser Types
 * @readonly
 * @enum {string}
 */
const BrowserType = {
  Chrome: 'chrome',
  Firefox: 'firefox',
  Edge: 'edge',
  Safari: 'safari'
};

// Base fingerprint templates for synthetic generation
const BASE_TEMPLATES = {
  windows: {
    chrome: generateWindowsChromeTemplates(),
    firefox: generateWindowsFirefoxTemplates(),
    edge: generateWindowsEdgeTemplates()
  },
  macos: {
    chrome: generateMacOSChromeTemplates(),
    firefox: generateMacOSFirefoxTemplates(),
    safari: generateMacOSSafariTemplates()
  },
  linux: {
    chrome: generateLinuxChromeTemplates(),
    firefox: generateLinuxFirefoxTemplates()
  }
};

// ==================== Template Generation Functions ====================

/**
 * Generates Windows Chrome fingerprint templates
 * @returns {Array<Object>} Array of fingerprint templates
 */
function generateWindowsChromeTemplates() {
  const templates = [];
  const chromeVersions = [
    { version: '120.0.0.0', major: 120 },
    { version: '119.0.0.0', major: 119 },
    { version: '121.0.0.0', major: 121 },
    { version: '118.0.0.0', major: 118 },
    { version: '122.0.0.0', major: 122 }
  ];
  
  const gpuConfigs = [
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'Intel Inc.', unmaskedRenderer: 'Intel(R) UHD Graphics 630' },
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'Intel Inc.', unmaskedRenderer: 'Intel(R) UHD Graphics 620' },
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'Intel Inc.', unmaskedRenderer: 'Intel(R) Iris Xe Graphics' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'NVIDIA Corporation', unmaskedRenderer: 'NVIDIA GeForce GTX 1660 SUPER' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'NVIDIA Corporation', unmaskedRenderer: 'NVIDIA GeForce RTX 3060' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'NVIDIA Corporation', unmaskedRenderer: 'NVIDIA GeForce GTX 1080' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'NVIDIA Corporation', unmaskedRenderer: 'NVIDIA GeForce RTX 2070' },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'AMD', unmaskedRenderer: 'AMD Radeon RX 580 Series' },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 5700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'AMD', unmaskedRenderer: 'AMD Radeon RX 5700 XT' },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'AMD', unmaskedRenderer: 'AMD Radeon RX 6800 XT' }
  ];
  
  const screenConfigs = [
    { width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1 },
    { width: 2560, height: 1440, colorDepth: 24, pixelRatio: 1 },
    { width: 1366, height: 768, colorDepth: 24, pixelRatio: 1 },
    { width: 1536, height: 864, colorDepth: 24, pixelRatio: 1.25 },
    { width: 3840, height: 2160, colorDepth: 24, pixelRatio: 1.5 },
    { width: 1680, height: 1050, colorDepth: 24, pixelRatio: 1 },
    { width: 1440, height: 900, colorDepth: 24, pixelRatio: 1 }
  ];
  
  const hardwareConfigs = [
    { cpuCores: 4, deviceMemory: 4, maxTouchPoints: 0 },
    { cpuCores: 6, deviceMemory: 8, maxTouchPoints: 0 },
    { cpuCores: 8, deviceMemory: 8, maxTouchPoints: 0 },
    { cpuCores: 8, deviceMemory: 16, maxTouchPoints: 0 },
    { cpuCores: 12, deviceMemory: 16, maxTouchPoints: 0 },
    { cpuCores: 16, deviceMemory: 32, maxTouchPoints: 0 },
    { cpuCores: 4, deviceMemory: 8, maxTouchPoints: 10 }
  ];
  
  const windowsFonts = ['Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
  
  let id = 1;
  for (const chromeVer of chromeVersions) {
    for (const gpu of gpuConfigs) {
      templates.push({
        id: `win-chrome-${String(id++).padStart(3, '0')}`,
        userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer.version} Safari/537.36`,
        platform: 'Win32',
        vendor: 'Google Inc.',
        browserVersion: chromeVer.version,
        majorVersion: chromeVer.major,
        osVersion: '10.0',
        webgl: { ...gpu },
        screen: screenConfigs[id % screenConfigs.length],
        hardware: hardwareConfigs[id % hardwareConfigs.length],
        fonts: [...windowsFonts]
      });
    }
  }
  
  return templates;
}

/**
 * Generates Windows Firefox fingerprint templates
 * @returns {Array<Object>} Array of fingerprint templates
 */
function generateWindowsFirefoxTemplates() {
  const templates = [];
  const firefoxVersions = [
    { version: '121.0', major: 121 },
    { version: '120.0', major: 120 },
    { version: '119.0', major: 119 },
    { version: '118.0', major: 118 }
  ];
  
  const gpuConfigs = [
    { vendor: 'Intel Inc.', renderer: 'Intel(R) UHD Graphics 630', unmaskedVendor: 'Intel Inc.', unmaskedRenderer: 'Intel(R) UHD Graphics 630' },
    { vendor: 'Intel Inc.', renderer: 'Intel(R) UHD Graphics 620', unmaskedVendor: 'Intel Inc.', unmaskedRenderer: 'Intel(R) UHD Graphics 620' },
    { vendor: 'NVIDIA Corporation', renderer: 'GeForce GTX 1660 SUPER/PCIe/SSE2', unmaskedVendor: 'NVIDIA Corporation', unmaskedRenderer: 'GeForce GTX 1660 SUPER/PCIe/SSE2' },
    { vendor: 'NVIDIA Corporation', renderer: 'GeForce RTX 3060/PCIe/SSE2', unmaskedVendor: 'NVIDIA Corporation', unmaskedRenderer: 'GeForce RTX 3060/PCIe/SSE2' },
    { vendor: 'ATI Technologies Inc.', renderer: 'AMD Radeon RX 580 Series', unmaskedVendor: 'ATI Technologies Inc.', unmaskedRenderer: 'AMD Radeon RX 580 Series' }
  ];
  
  const screenConfigs = [
    { width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1 },
    { width: 2560, height: 1440, colorDepth: 24, pixelRatio: 1 },
    { width: 1366, height: 768, colorDepth: 24, pixelRatio: 1 }
  ];
  
  const hardwareConfigs = [
    { cpuCores: 4, deviceMemory: 8, maxTouchPoints: 0 },
    { cpuCores: 8, deviceMemory: 8, maxTouchPoints: 0 },
    { cpuCores: 8, deviceMemory: 16, maxTouchPoints: 0 }
  ];
  
  const windowsFonts = ['Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
  
  let id = 1;
  for (const ffVer of firefoxVersions) {
    for (const gpu of gpuConfigs) {
      templates.push({
        id: `win-firefox-${String(id++).padStart(3, '0')}`,
        userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${ffVer.major}.0) Gecko/20100101 Firefox/${ffVer.version}`,
        platform: 'Win32',
        vendor: '',
        browserVersion: ffVer.version,
        majorVersion: ffVer.major,
        osVersion: '10.0',
        webgl: { ...gpu },
        screen: screenConfigs[id % screenConfigs.length],
        hardware: hardwareConfigs[id % hardwareConfigs.length],
        fonts: [...windowsFonts]
      });
    }
  }
  
  return templates;
}

/**
 * Generates Windows Edge fingerprint templates
 * @returns {Array<Object>} Array of fingerprint templates
 */
function generateWindowsEdgeTemplates() {
  const templates = [];
  const edgeVersions = [
    { version: '120.0.0.0', major: 120 },
    { version: '119.0.0.0', major: 119 },
    { version: '121.0.0.0', major: 121 }
  ];
  
  const gpuConfigs = [
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'Intel Inc.', unmaskedRenderer: 'Intel(R) UHD Graphics 630' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'NVIDIA Corporation', unmaskedRenderer: 'NVIDIA GeForce GTX 1660 SUPER' },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'AMD', unmaskedRenderer: 'AMD Radeon RX 580 Series' }
  ];
  
  const screenConfigs = [
    { width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1 },
    { width: 2560, height: 1440, colorDepth: 24, pixelRatio: 1 }
  ];
  
  const hardwareConfigs = [
    { cpuCores: 8, deviceMemory: 8, maxTouchPoints: 0 },
    { cpuCores: 8, deviceMemory: 16, maxTouchPoints: 0 }
  ];
  
  const windowsFonts = ['Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
  
  let id = 1;
  for (const edgeVer of edgeVersions) {
    for (const gpu of gpuConfigs) {
      templates.push({
        id: `win-edge-${String(id++).padStart(3, '0')}`,
        userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${edgeVer.version} Safari/537.36 Edg/${edgeVer.version}`,
        platform: 'Win32',
        vendor: 'Google Inc.',
        browserVersion: edgeVer.version,
        majorVersion: edgeVer.major,
        osVersion: '10.0',
        webgl: { ...gpu },
        screen: screenConfigs[id % screenConfigs.length],
        hardware: hardwareConfigs[id % hardwareConfigs.length],
        fonts: [...windowsFonts]
      });
    }
  }
  
  return templates;
}


/**
 * Generates macOS Chrome fingerprint templates
 * @returns {Array<Object>} Array of fingerprint templates
 */
function generateMacOSChromeTemplates() {
  const templates = [];
  const chromeVersions = [
    { version: '120.0.0.0', major: 120 },
    { version: '119.0.0.0', major: 119 },
    { version: '121.0.0.0', major: 121 },
    { version: '118.0.0.0', major: 118 }
  ];
  
  const gpuConfigs = [
    { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)', unmaskedVendor: 'Apple Inc.', unmaskedRenderer: 'Apple M1' },
    { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)', unmaskedVendor: 'Apple Inc.', unmaskedRenderer: 'Apple M2' },
    { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)', unmaskedVendor: 'Apple Inc.', unmaskedRenderer: 'Apple M1 Pro' },
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel Inc., Intel(R) Iris Plus Graphics 640, OpenGL 4.1)', unmaskedVendor: 'Intel Inc.', unmaskedRenderer: 'Intel(R) Iris Plus Graphics 640' },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon Pro 5500M, OpenGL 4.1)', unmaskedVendor: 'AMD', unmaskedRenderer: 'AMD Radeon Pro 5500M' }
  ];
  
  const screenConfigs = [
    { width: 1440, height: 900, colorDepth: 24, pixelRatio: 2 },
    { width: 1680, height: 1050, colorDepth: 24, pixelRatio: 2 },
    { width: 1920, height: 1080, colorDepth: 24, pixelRatio: 2 },
    { width: 2560, height: 1600, colorDepth: 24, pixelRatio: 2 },
    { width: 2880, height: 1800, colorDepth: 24, pixelRatio: 2 }
  ];
  
  const hardwareConfigs = [
    { cpuCores: 8, deviceMemory: 8, maxTouchPoints: 0 },
    { cpuCores: 8, deviceMemory: 16, maxTouchPoints: 0 },
    { cpuCores: 10, deviceMemory: 16, maxTouchPoints: 0 },
    { cpuCores: 10, deviceMemory: 32, maxTouchPoints: 0 }
  ];
  
  const macFonts = ['Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia', 'Helvetica', 'Helvetica Neue', 'Impact', 'Lucida Grande', 'Monaco', 'Palatino', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'SF Pro Display', 'SF Pro Text'];
  
  let id = 1;
  for (const chromeVer of chromeVersions) {
    for (const gpu of gpuConfigs) {
      templates.push({
        id: `mac-chrome-${String(id++).padStart(3, '0')}`,
        userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer.version} Safari/537.36`,
        platform: 'MacIntel',
        vendor: 'Google Inc.',
        browserVersion: chromeVer.version,
        majorVersion: chromeVer.major,
        osVersion: '10.15.7',
        webgl: { ...gpu },
        screen: screenConfigs[id % screenConfigs.length],
        hardware: hardwareConfigs[id % hardwareConfigs.length],
        fonts: [...macFonts]
      });
    }
  }
  
  return templates;
}

/**
 * Generates macOS Firefox fingerprint templates
 * @returns {Array<Object>} Array of fingerprint templates
 */
function generateMacOSFirefoxTemplates() {
  const templates = [];
  const firefoxVersions = [
    { version: '121.0', major: 121 },
    { version: '120.0', major: 120 },
    { version: '119.0', major: 119 }
  ];
  
  const gpuConfigs = [
    { vendor: 'Apple Inc.', renderer: 'Apple M1', unmaskedVendor: 'Apple Inc.', unmaskedRenderer: 'Apple M1' },
    { vendor: 'Apple Inc.', renderer: 'Apple M2', unmaskedVendor: 'Apple Inc.', unmaskedRenderer: 'Apple M2' },
    { vendor: 'Intel Inc.', renderer: 'Intel(R) Iris Plus Graphics 640', unmaskedVendor: 'Intel Inc.', unmaskedRenderer: 'Intel(R) Iris Plus Graphics 640' }
  ];
  
  const screenConfigs = [
    { width: 1440, height: 900, colorDepth: 24, pixelRatio: 2 },
    { width: 1680, height: 1050, colorDepth: 24, pixelRatio: 2 }
  ];
  
  const hardwareConfigs = [
    { cpuCores: 8, deviceMemory: 8, maxTouchPoints: 0 },
    { cpuCores: 8, deviceMemory: 16, maxTouchPoints: 0 }
  ];
  
  const macFonts = ['Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia', 'Helvetica', 'Helvetica Neue', 'Impact', 'Lucida Grande', 'Monaco', 'Palatino', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
  
  let id = 1;
  for (const ffVer of firefoxVersions) {
    for (const gpu of gpuConfigs) {
      templates.push({
        id: `mac-firefox-${String(id++).padStart(3, '0')}`,
        userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${ffVer.major}.0) Gecko/20100101 Firefox/${ffVer.version}`,
        platform: 'MacIntel',
        vendor: '',
        browserVersion: ffVer.version,
        majorVersion: ffVer.major,
        osVersion: '10.15',
        webgl: { ...gpu },
        screen: screenConfigs[id % screenConfigs.length],
        hardware: hardwareConfigs[id % hardwareConfigs.length],
        fonts: [...macFonts]
      });
    }
  }
  
  return templates;
}

/**
 * Generates macOS Safari fingerprint templates
 * @returns {Array<Object>} Array of fingerprint templates
 */
function generateMacOSSafariTemplates() {
  const templates = [];
  const safariVersions = [
    { version: '17.2', major: 17, webkitVersion: '605.1.15' },
    { version: '17.1', major: 17, webkitVersion: '605.1.15' },
    { version: '16.6', major: 16, webkitVersion: '605.1.15' }
  ];
  
  const gpuConfigs = [
    { vendor: 'Apple Inc.', renderer: 'Apple M1', unmaskedVendor: 'Apple Inc.', unmaskedRenderer: 'Apple M1' },
    { vendor: 'Apple Inc.', renderer: 'Apple M2', unmaskedVendor: 'Apple Inc.', unmaskedRenderer: 'Apple M2' },
    { vendor: 'Apple Inc.', renderer: 'Apple M1 Pro', unmaskedVendor: 'Apple Inc.', unmaskedRenderer: 'Apple M1 Pro' },
    { vendor: 'Intel Inc.', renderer: 'Intel(R) Iris Plus Graphics 640', unmaskedVendor: 'Intel Inc.', unmaskedRenderer: 'Intel(R) Iris Plus Graphics 640' }
  ];
  
  const screenConfigs = [
    { width: 1440, height: 900, colorDepth: 24, pixelRatio: 2 },
    { width: 1680, height: 1050, colorDepth: 24, pixelRatio: 2 },
    { width: 2560, height: 1600, colorDepth: 24, pixelRatio: 2 }
  ];
  
  const hardwareConfigs = [
    { cpuCores: 8, deviceMemory: 8, maxTouchPoints: 0 },
    { cpuCores: 8, deviceMemory: 16, maxTouchPoints: 0 },
    { cpuCores: 10, deviceMemory: 16, maxTouchPoints: 0 }
  ];
  
  const macFonts = ['Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia', 'Helvetica', 'Helvetica Neue', 'Impact', 'Lucida Grande', 'Monaco', 'Palatino', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'SF Pro Display', 'SF Pro Text'];
  
  let id = 1;
  for (const safariVer of safariVersions) {
    for (const gpu of gpuConfigs) {
      templates.push({
        id: `mac-safari-${String(id++).padStart(3, '0')}`,
        userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/${safariVer.webkitVersion} (KHTML, like Gecko) Version/${safariVer.version} Safari/${safariVer.webkitVersion}`,
        platform: 'MacIntel',
        vendor: 'Apple Computer, Inc.',
        browserVersion: safariVer.version,
        majorVersion: safariVer.major,
        osVersion: '10.15.7',
        webgl: { ...gpu },
        screen: screenConfigs[id % screenConfigs.length],
        hardware: hardwareConfigs[id % hardwareConfigs.length],
        fonts: [...macFonts]
      });
    }
  }
  
  return templates;
}

/**
 * Generates Linux Chrome fingerprint templates
 * @returns {Array<Object>} Array of fingerprint templates
 */
function generateLinuxChromeTemplates() {
  const templates = [];
  const chromeVersions = [
    { version: '120.0.0.0', major: 120 },
    { version: '119.0.0.0', major: 119 },
    { version: '121.0.0.0', major: 121 }
  ];
  
  const gpuConfigs = [
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)', unmaskedVendor: 'Intel', unmaskedRenderer: 'Mesa Intel(R) UHD Graphics 630 (CFL GT2)' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER/PCIe/SSE2, OpenGL 4.6)', unmaskedVendor: 'NVIDIA Corporation', unmaskedRenderer: 'NVIDIA GeForce GTX 1660 SUPER/PCIe/SSE2' },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Series (polaris10, LLVM 15.0.7, DRM 3.49, 6.1.0-13-amd64), OpenGL 4.6)', unmaskedVendor: 'AMD', unmaskedRenderer: 'AMD Radeon RX 580 Series' }
  ];
  
  const screenConfigs = [
    { width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1 },
    { width: 2560, height: 1440, colorDepth: 24, pixelRatio: 1 },
    { width: 1366, height: 768, colorDepth: 24, pixelRatio: 1 }
  ];
  
  const hardwareConfigs = [
    { cpuCores: 4, deviceMemory: 8, maxTouchPoints: 0 },
    { cpuCores: 8, deviceMemory: 16, maxTouchPoints: 0 },
    { cpuCores: 12, deviceMemory: 32, maxTouchPoints: 0 }
  ];
  
  const linuxFonts = ['Arial', 'Bitstream Vera Sans', 'Courier New', 'DejaVu Sans', 'DejaVu Sans Mono', 'DejaVu Serif', 'Droid Sans', 'FreeMono', 'FreeSans', 'FreeSerif', 'Georgia', 'Liberation Mono', 'Liberation Sans', 'Liberation Serif', 'Noto Sans', 'Times New Roman', 'Ubuntu', 'Verdana'];
  
  let id = 1;
  for (const chromeVer of chromeVersions) {
    for (const gpu of gpuConfigs) {
      templates.push({
        id: `linux-chrome-${String(id++).padStart(3, '0')}`,
        userAgent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer.version} Safari/537.36`,
        platform: 'Linux x86_64',
        vendor: 'Google Inc.',
        browserVersion: chromeVer.version,
        majorVersion: chromeVer.major,
        osVersion: '6.1.0',
        webgl: { ...gpu },
        screen: screenConfigs[id % screenConfigs.length],
        hardware: hardwareConfigs[id % hardwareConfigs.length],
        fonts: [...linuxFonts]
      });
    }
  }
  
  return templates;
}

/**
 * Generates Linux Firefox fingerprint templates
 * @returns {Array<Object>} Array of fingerprint templates
 */
function generateLinuxFirefoxTemplates() {
  const templates = [];
  const firefoxVersions = [
    { version: '121.0', major: 121 },
    { version: '120.0', major: 120 },
    { version: '119.0', major: 119 },
    { version: '115.0', major: 115 }
  ];
  
  const gpuConfigs = [
    { vendor: 'Intel', renderer: 'Mesa Intel(R) UHD Graphics 630 (CFL GT2)', unmaskedVendor: 'Intel', unmaskedRenderer: 'Mesa Intel(R) UHD Graphics 630 (CFL GT2)' },
    { vendor: 'NVIDIA Corporation', renderer: 'GeForce GTX 1660 SUPER/PCIe/SSE2', unmaskedVendor: 'NVIDIA Corporation', unmaskedRenderer: 'GeForce GTX 1660 SUPER/PCIe/SSE2' },
    { vendor: 'AMD', renderer: 'AMD Radeon RX 580 Series (polaris10, LLVM 15.0.7, DRM 3.49, 6.1.0-13-amd64)', unmaskedVendor: 'AMD', unmaskedRenderer: 'AMD Radeon RX 580 Series' }
  ];
  
  const screenConfigs = [
    { width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1 },
    { width: 2560, height: 1440, colorDepth: 24, pixelRatio: 1 }
  ];
  
  const hardwareConfigs = [
    { cpuCores: 4, deviceMemory: 8, maxTouchPoints: 0 },
    { cpuCores: 8, deviceMemory: 16, maxTouchPoints: 0 }
  ];
  
  const linuxFonts = ['Arial', 'Bitstream Vera Sans', 'Courier New', 'DejaVu Sans', 'DejaVu Sans Mono', 'DejaVu Serif', 'Droid Sans', 'FreeMono', 'FreeSans', 'FreeSerif', 'Georgia', 'Liberation Mono', 'Liberation Sans', 'Liberation Serif', 'Noto Sans', 'Times New Roman', 'Ubuntu', 'Verdana'];
  
  let id = 1;
  for (const ffVer of firefoxVersions) {
    for (const gpu of gpuConfigs) {
      templates.push({
        id: `linux-firefox-${String(id++).padStart(3, '0')}`,
        userAgent: `Mozilla/5.0 (X11; Linux x86_64; rv:${ffVer.major}.0) Gecko/20100101 Firefox/${ffVer.version}`,
        platform: 'Linux x86_64',
        vendor: '',
        browserVersion: ffVer.version,
        majorVersion: ffVer.major,
        osVersion: '6.1.0',
        webgl: { ...gpu },
        screen: screenConfigs[id % screenConfigs.length],
        hardware: hardwareConfigs[id % hardwareConfigs.length],
        fonts: [...linuxFonts]
      });
    }
  }
  
  return templates;
}

// ==================== FingerprintDatabase Class ====================

/**
 * FingerprintDatabase class for managing real browser fingerprint configurations
 */
class FingerprintDatabase {
  /**
   * Creates a FingerprintDatabase instance
   * @param {Object} options - Configuration options
   * @param {string} [options.dataPath] - Path to external JSON database file
   */
  constructor(options = {}) {
    this.version = '1.0.0';
    this.lastUpdated = new Date().toISOString();
    this._templates = null;
    this._externalDataPath = options.dataPath || null;
    this._usedCombinations = new Set();
  }

  /**
   * Initializes the database by loading templates
   * @returns {FingerprintDatabase} This instance for chaining
   */
  initialize() {
    if (this._templates === null) {
      this._templates = this._loadTemplates();
    }
    return this;
  }

  /**
   * Loads fingerprint templates from built-in data and optional external file
   * @private
   * @returns {Object} Loaded templates organized by OS and browser
   */
  _loadTemplates() {
    // Start with built-in templates
    const templates = JSON.parse(JSON.stringify(BASE_TEMPLATES));
    
    // Try to load external data if path is provided
    if (this._externalDataPath) {
      try {
        const externalData = JSON.parse(fs.readFileSync(this._externalDataPath, 'utf8'));
        if (externalData.fingerprints) {
          this._mergeTemplates(templates, externalData.fingerprints);
        }
      } catch (error) {
        // External file not found or invalid, continue with built-in templates
        console.warn(`Could not load external fingerprint database: ${error.message}`);
      }
    }
    
    return templates;
  }

  /**
   * Merges external templates into the main template collection
   * @private
   * @param {Object} target - Target template collection
   * @param {Object} source - Source templates to merge
   */
  _mergeTemplates(target, source) {
    for (const os of Object.keys(source)) {
      if (!target[os]) {
        target[os] = {};
      }
      for (const browser of Object.keys(source[os])) {
        if (!target[os][browser]) {
          target[os][browser] = [];
        }
        target[os][browser].push(...source[os][browser]);
      }
    }
  }

 
 /**
   * Gets all fingerprint templates
   * @returns {Object} All templates organized by OS and browser
   */
  getAllTemplates() {
    this.initialize();
    return this._templates;
  }

  /**
   * Gets the total count of fingerprint templates
   * @returns {number} Total number of templates
   */
  getTemplateCount() {
    this.initialize();
    let count = 0;
    for (const os of Object.keys(this._templates)) {
      for (const browser of Object.keys(this._templates[os])) {
        count += this._templates[os][browser].length;
      }
    }
    return count;
  }

  /**
   * Gets fingerprint templates by OS type
   * @param {string} osType - Operating system type (windows, macos, linux)
   * @returns {Object} Templates for the specified OS, organized by browser
   */
  getByOS(osType) {
    this.initialize();
    const normalizedOS = osType.toLowerCase();
    if (!this._templates[normalizedOS]) {
      return {};
    }
    return this._templates[normalizedOS];
  }

  /**
   * Gets fingerprint templates by browser type
   * @param {string} browserType - Browser type (chrome, firefox, edge, safari)
   * @returns {Array<Object>} All templates for the specified browser across all OSes
   */
  getByBrowser(browserType) {
    this.initialize();
    const normalizedBrowser = browserType.toLowerCase();
    const results = [];
    
    for (const os of Object.keys(this._templates)) {
      if (this._templates[os][normalizedBrowser]) {
        results.push(...this._templates[os][normalizedBrowser]);
      }
    }
    
    return results;
  }

  /**
   * Gets fingerprint templates by OS and browser type
   * @param {string} osType - Operating system type
   * @param {string} browserType - Browser type
   * @returns {Array<Object>} Templates matching both criteria
   */
  getByOSAndBrowser(osType, browserType) {
    this.initialize();
    const normalizedOS = osType.toLowerCase();
    const normalizedBrowser = browserType.toLowerCase();
    
    if (!this._templates[normalizedOS] || !this._templates[normalizedOS][normalizedBrowser]) {
      return [];
    }
    
    return this._templates[normalizedOS][normalizedBrowser];
  }

  /**
   * Gets a random fingerprint template
   * @param {Object} [filters] - Optional filters
   * @param {string} [filters.os] - Filter by OS type
   * @param {string} [filters.browser] - Filter by browser type
   * @returns {Object|null} A random template or null if none match
   */
  getRandomTemplate(filters = {}) {
    this.initialize();
    let candidates = [];
    
    if (filters.os && filters.browser) {
      candidates = this.getByOSAndBrowser(filters.os, filters.browser);
    } else if (filters.os) {
      const osBrowsers = this.getByOS(filters.os);
      for (const browser of Object.keys(osBrowsers)) {
        candidates.push(...osBrowsers[browser]);
      }
    } else if (filters.browser) {
      candidates = this.getByBrowser(filters.browser);
    } else {
      // Get all templates
      for (const os of Object.keys(this._templates)) {
        for (const browser of Object.keys(this._templates[os])) {
          candidates.push(...this._templates[os][browser]);
        }
      }
    }
    
    if (candidates.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return { ...candidates[randomIndex] };
  }

  /**
   * Generates a synthetic fingerprint combination
   * This avoids generating fingerprints identical to those in the database
   * by mixing components from different templates
   * 
   * @param {Object} [options] - Generation options
   * @param {string} [options.os] - Target OS type
   * @param {string} [options.browser] - Target browser type
   * @param {number} [options.seed] - Random seed for deterministic generation
   * @returns {Object} A synthetic fingerprint configuration
   */
  generateSyntheticFingerprint(options = {}) {
    this.initialize();
    
    const os = options.os || this._getRandomOS();
    const browser = options.browser || this._getRandomBrowserForOS(os);
    
    // Get templates for the target OS/browser combination
    const templates = this.getByOSAndBrowser(os, browser);
    if (templates.length === 0) {
      throw new Error(`No templates available for ${os}/${browser}`);
    }
    
    // Use seed for deterministic random if provided
    const random = options.seed !== undefined 
      ? this._seededRandom(options.seed)
      : Math.random;
    
    // Select base template
    const baseTemplate = templates[Math.floor(random() * templates.length)];
    
    // Get all templates for the same OS to mix components
    const osTemplates = [];
    const osBrowsers = this.getByOS(os);
    for (const b of Object.keys(osBrowsers)) {
      osTemplates.push(...osBrowsers[b]);
    }
    
    // Mix components from different templates to create synthetic combination
    const screenTemplate = osTemplates[Math.floor(random() * osTemplates.length)];
    const hardwareTemplate = osTemplates[Math.floor(random() * osTemplates.length)];
    
    // Create synthetic fingerprint
    const synthetic = {
      id: `synthetic-${Date.now()}-${Math.floor(random() * 10000)}`,
      userAgent: baseTemplate.userAgent,
      platform: baseTemplate.platform,
      vendor: baseTemplate.vendor,
      browserVersion: baseTemplate.browserVersion,
      majorVersion: baseTemplate.majorVersion,
      osVersion: baseTemplate.osVersion,
      webgl: { ...baseTemplate.webgl },
      screen: { ...screenTemplate.screen },
      hardware: { ...hardwareTemplate.hardware },
      fonts: [...baseTemplate.fonts],
      synthetic: true,
      sourceTemplates: [baseTemplate.id, screenTemplate.id, hardwareTemplate.id]
    };
    
    // Track used combinations to avoid duplicates
    const combinationKey = `${baseTemplate.id}-${screenTemplate.id}-${hardwareTemplate.id}`;
    if (this._usedCombinations.has(combinationKey)) {
      // Recursively try again with different seed
      return this.generateSyntheticFingerprint({
        ...options,
        seed: (options.seed || 0) + 1
      });
    }
    this._usedCombinations.add(combinationKey);
    
    return synthetic;
  }

  /**
   * Gets a random OS type
   * @private
   * @returns {string} Random OS type
   */
  _getRandomOS() {
    const osTypes = Object.keys(this._templates);
    return osTypes[Math.floor(Math.random() * osTypes.length)];
  }

  /**
   * Gets a random browser type for a given OS
   * @private
   * @param {string} os - OS type
   * @returns {string} Random browser type
   */
  _getRandomBrowserForOS(os) {
    const browsers = Object.keys(this._templates[os] || {});
    if (browsers.length === 0) {
      throw new Error(`No browsers available for OS: ${os}`);
    }
    return browsers[Math.floor(Math.random() * browsers.length)];
  }

  /**
   * Creates a seeded random number generator
   * @private
   * @param {number} seed - Seed value
   * @returns {Function} Random number generator function
   */
  _seededRandom(seed) {
    let state = seed >>> 0;
    return function() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  /**
   * Clears the used combinations cache
   * Call this to allow previously generated combinations to be reused
   */
  clearUsedCombinations() {
    this._usedCombinations.clear();
  }

  /**
   * Gets available OS types
   * @returns {Array<string>} List of available OS types
   */
  getAvailableOSTypes() {
    this.initialize();
    return Object.keys(this._templates);
  }

  /**
   * Gets available browser types for a given OS
   * @param {string} osType - OS type
   * @returns {Array<string>} List of available browser types
   */
  getAvailableBrowsersForOS(osType) {
    this.initialize();
    const normalizedOS = osType.toLowerCase();
    if (!this._templates[normalizedOS]) {
      return [];
    }
    return Object.keys(this._templates[normalizedOS]);
  }

  /**
   * Searches templates by criteria
   * @param {Object} criteria - Search criteria
   * @param {string} [criteria.os] - OS type filter
   * @param {string} [criteria.browser] - Browser type filter
   * @param {number} [criteria.minMajorVersion] - Minimum browser major version
   * @param {number} [criteria.maxMajorVersion] - Maximum browser major version
   * @param {string} [criteria.gpuVendor] - GPU vendor filter (partial match)
   * @returns {Array<Object>} Matching templates
   */
  search(criteria = {}) {
    this.initialize();
    let results = [];
    
    // Start with all templates or filtered by OS/browser
    if (criteria.os && criteria.browser) {
      results = this.getByOSAndBrowser(criteria.os, criteria.browser);
    } else if (criteria.os) {
      const osBrowsers = this.getByOS(criteria.os);
      for (const browser of Object.keys(osBrowsers)) {
        results.push(...osBrowsers[browser]);
      }
    } else if (criteria.browser) {
      results = this.getByBrowser(criteria.browser);
    } else {
      for (const os of Object.keys(this._templates)) {
        for (const browser of Object.keys(this._templates[os])) {
          results.push(...this._templates[os][browser]);
        }
      }
    }
    
    // Apply additional filters
    if (criteria.minMajorVersion !== undefined) {
      results = results.filter(t => t.majorVersion >= criteria.minMajorVersion);
    }
    
    if (criteria.maxMajorVersion !== undefined) {
      results = results.filter(t => t.majorVersion <= criteria.maxMajorVersion);
    }
    
    if (criteria.gpuVendor) {
      const vendorLower = criteria.gpuVendor.toLowerCase();
      results = results.filter(t => 
        t.webgl.vendor.toLowerCase().includes(vendorLower) ||
        t.webgl.unmaskedVendor.toLowerCase().includes(vendorLower)
      );
    }
    
    return results;
  }

  /**
   * Imports fingerprint data from an external source
   * @param {Object} data - Fingerprint data to import
   * @param {Object} data.fingerprints - Fingerprints organized by OS and browser
   * @returns {number} Number of fingerprints imported
   */
  importData(data) {
    this.initialize();
    
    if (!data || !data.fingerprints) {
      throw new Error('Invalid import data: missing fingerprints property');
    }
    
    let importCount = 0;
    
    for (const os of Object.keys(data.fingerprints)) {
      if (!this._templates[os]) {
        this._templates[os] = {};
      }
      
      for (const browser of Object.keys(data.fingerprints[os])) {
        if (!this._templates[os][browser]) {
          this._templates[os][browser] = [];
        }
        
        const newTemplates = data.fingerprints[os][browser];
        if (Array.isArray(newTemplates)) {
          // Avoid duplicates by checking IDs
          const existingIds = new Set(this._templates[os][browser].map(t => t.id));
          for (const template of newTemplates) {
            if (!existingIds.has(template.id)) {
              this._templates[os][browser].push(template);
              importCount++;
            }
          }
        }
      }
    }
    
    return importCount;
  }

  /**
   * Exports the database to a JSON-serializable object
   * @returns {Object} Exportable database object
   */
  exportData() {
    this.initialize();
    return {
      version: this.version,
      lastUpdated: this.lastUpdated,
      description: 'Real browser fingerprint database for professional fingerprint spoofing',
      sources: ['public-test-datasets', 'synthetic-combinations'],
      fingerprints: JSON.parse(JSON.stringify(this._templates))
    };
  }

  /**
   * Gets database statistics
   * @returns {Object} Statistics about the database
   */
  getStatistics() {
    this.initialize();
    const stats = {
      version: this.version,
      lastUpdated: this.lastUpdated,
      totalTemplates: 0,
      byOS: {},
      byBrowser: {}
    };
    
    for (const os of Object.keys(this._templates)) {
      stats.byOS[os] = 0;
      for (const browser of Object.keys(this._templates[os])) {
        const count = this._templates[os][browser].length;
        stats.byOS[os] += count;
        stats.totalTemplates += count;
        
        if (!stats.byBrowser[browser]) {
          stats.byBrowser[browser] = 0;
        }
        stats.byBrowser[browser] += count;
      }
    }
    
    return stats;
  }
}

// Attach enums to the class
FingerprintDatabase.OSType = OSType;
FingerprintDatabase.BrowserType = BrowserType;

module.exports = FingerprintDatabase;
