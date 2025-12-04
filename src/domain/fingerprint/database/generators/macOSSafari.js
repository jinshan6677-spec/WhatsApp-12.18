'use strict';

function generate() {
  const templates = [];
  const safariVersions = [
    { version: '16.5', major: 16, webkitVersion: '605.1.15', weight: 22 },
    { version: '16.6', major: 16, webkitVersion: '605.1.15', weight: 25 },
    { version: '17.0', major: 17, webkitVersion: '605.1.15', weight: 32 },
    { version: '17.1', major: 17, webkitVersion: '605.1.15', weight: 35 },
    { version: '17.2', major: 17, webkitVersion: '605.1.15', weight: 40 },
    { version: '17.3', major: 17, webkitVersion: '605.1.15', weight: 42 },
    { version: '17.4', major: 17, webkitVersion: '605.1.15', weight: 45 }
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
        vendor: 'Apple Inc.',
        browserVersion: safariVer.version,
        majorVersion: safariVer.major,
        weight: safariVer.weight || 1,
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
