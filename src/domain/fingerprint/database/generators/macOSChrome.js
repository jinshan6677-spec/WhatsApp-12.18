'use strict';

function generate() {
  const templates = [];
  const chromeVersions = [
    { version: '110.0.0.0', major: 110, weight: 2 },
    { version: '111.0.0.0', major: 111, weight: 3 },
    { version: '112.0.0.0', major: 112, weight: 4 },
    { version: '113.0.0.0', major: 113, weight: 5 },
    { version: '114.0.0.0', major: 114, weight: 5 },
    { version: '115.0.0.0', major: 115, weight: 7 },
    { version: '116.0.0.0', major: 116, weight: 9 },
    { version: '117.0.0.0', major: 117, weight: 10 },
    { version: '118.0.0.0', major: 118, weight: 12 },
    { version: '119.0.0.0', major: 119, weight: 15 },
    { version: '120.0.0.0', major: 120, weight: 20 },
    { version: '121.0.0.0', major: 121, weight: 25 },
    { version: '122.0.0.0', major: 122, weight: 30 },
    { version: '123.0.0.0', major: 123, weight: 35 },
    { version: '124.0.0.0', major: 124, weight: 40 }
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
        weight: chromeVer.weight || 1,
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

module.exports = { generate };
