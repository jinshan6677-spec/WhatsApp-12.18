'use strict';

function generate() {
  const templates = [];
  const firefoxVersions = [
    { version: '114.0', major: 114, weight: 8 },
    { version: '115.0', major: 115, weight: 9 },
    { version: '116.0', major: 116, weight: 10 },
    { version: '117.0', major: 117, weight: 10 },
    { version: '118.0', major: 118, weight: 15 },
    { version: '119.0', major: 119, weight: 20 },
    { version: '120.0', major: 120, weight: 25 },
    { version: '121.0', major: 121, weight: 30 },
    { version: '122.0', major: 122, weight: 35 },
    { version: '123.0', major: 123, weight: 38 },
    { version: '124.0', major: 124, weight: 40 }
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
        weight: ffVer.weight || 1,
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

module.exports = { generate };
