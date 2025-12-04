'use strict';

function generate() {
  const templates = [];
  const chromeVersions = [
    { version: '114.0.0.0', major: 114, weight: 5 },
    { version: '115.0.0.0', major: 115, weight: 6 },
    { version: '116.0.0.0', major: 116, weight: 7 },
    { version: '117.0.0.0', major: 117, weight: 8 },
    { version: '118.0.0.0', major: 118, weight: 10 },
    { version: '119.0.0.0', major: 119, weight: 15 },
    { version: '120.0.0.0', major: 120, weight: 20 },
    { version: '121.0.0.0', major: 121, weight: 25 },
    { version: '122.0.0.0', major: 122, weight: 30 },
    { version: '123.0.0.0', major: 123, weight: 35 },
    { version: '124.0.0.0', major: 124, weight: 40 }
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
        weight: chromeVer.weight || 1,
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

