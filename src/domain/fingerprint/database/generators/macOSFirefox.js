'use strict';

function generate() {
  const templates = [];
  const firefoxVersions = [
    { version: '110.0', major: 110, weight: 8 },
    { version: '111.0', major: 111, weight: 10 },
    { version: '112.0', major: 112, weight: 12 },
    { version: '113.0', major: 113, weight: 15 },
    { version: '119.0', major: 119, weight: 20 },
    { version: '120.0', major: 120, weight: 30 },
    { version: '121.0', major: 121, weight: 35 }
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
        weight: ffVer.weight || 1,
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

module.exports = { generate };
