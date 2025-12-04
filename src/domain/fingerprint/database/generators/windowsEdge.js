'use strict';

function generate() {
  const templates = [];
  const edgeVersions = [
    { version: '118.0.0.0', major: 118, weight: 20 },
    { version: '119.0.0.0', major: 119, weight: 25 },
    { version: '120.0.0.0', major: 120, weight: 35 },
    { version: '121.0.0.0', major: 121, weight: 40 },
    { version: '122.0.0.0', major: 122, weight: 45 },
    { version: '123.0.0.0', major: 123, weight: 48 },
    { version: '124.0.0.0', major: 124, weight: 50 }
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
        weight: edgeVer.weight || 1,
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
