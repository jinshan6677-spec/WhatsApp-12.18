'use strict';

function generate() {
  const templates = [];
  const firefoxVersions = [
    { version: '110.0', major: 110, weight: 8 },
    { version: '111.0', major: 111, weight: 9 },
    { version: '112.0', major: 112, weight: 10 },
    { version: '113.0', major: 113, weight: 11 },
    { version: '114.0', major: 114, weight: 12 },
    { version: '115.0', major: 115, weight: 15 },
    { version: '116.0', major: 116, weight: 17 },
    { version: '117.0', major: 117, weight: 18 },
    { version: '119.0', major: 119, weight: 20 },
    { version: '120.0', major: 120, weight: 30 },
    { version: '121.0', major: 121, weight: 35 },
    { version: '122.0', major: 122, weight: 36 },
    { version: '123.0', major: 123, weight: 38 }
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
        weight: ffVer.weight || 1,
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

module.exports = { generate };
