'use strict';

const WINDOWS_FONTS = [
  'Arial','Arial Black','Calibri','Cambria','Comic Sans MS','Consolas',
  'Courier New','Georgia','Impact','Lucida Console','Segoe UI','Tahoma',
  'Times New Roman','Trebuchet MS','Verdana','Microsoft Sans Serif',
  'Palatino Linotype','Lucida Sans Unicode','Franklin Gothic Medium'
];

const MACOS_FONTS = [
  'Arial','Arial Black','Comic Sans MS','Courier New','Georgia',
  'Helvetica','Helvetica Neue','Impact','Lucida Grande','Monaco',
  'Palatino','Tahoma','Times New Roman','Trebuchet MS','Verdana',
  'SF Pro Display','SF Pro Text','Menlo','Avenir','Futura'
];

const LINUX_FONTS = [
  'Arial','Bitstream Vera Sans','Courier New','DejaVu Sans',
  'DejaVu Sans Mono','DejaVu Serif','Droid Sans','FreeMono',
  'FreeSans','FreeSerif','Georgia','Liberation Mono','Liberation Sans',
  'Liberation Serif','Noto Sans','Times New Roman','Ubuntu','Verdana'
];

const WINDOWS_WEBGL_VENDORS = [
  'Google Inc.','Google Inc. (Intel)','Google Inc. (NVIDIA)','Google Inc. (AMD)',
  'Intel Inc.','NVIDIA Corporation','ATI Technologies Inc.','AMD'
];

const MACOS_WEBGL_VENDORS = [
  'Google Inc.','Google Inc. (Apple)','Google Inc. (Intel)','Google Inc. (AMD)',
  'Apple Inc.','Intel Inc.','AMD'
];

const LINUX_WEBGL_VENDORS = [
  'Google Inc.','Google Inc. (Intel)','Google Inc. (NVIDIA)','Google Inc. (AMD)',
  'Intel','NVIDIA Corporation','AMD','Mesa','X.Org'
];

const COMMON_RESOLUTIONS = {
  desktop: [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1680, height: 1050 },
    { width: 3840, height: 2160 },
    { width: 2880, height: 1800 },
    { width: 2560, height: 1600 }
  ],
  laptop: [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 2560, height: 1600 },
    { width: 2880, height: 1800 }
  ]
};

module.exports = {
  WINDOWS_FONTS,
  MACOS_FONTS,
  LINUX_FONTS,
  WINDOWS_WEBGL_VENDORS,
  MACOS_WEBGL_VENDORS,
  LINUX_WEBGL_VENDORS,
  COMMON_RESOLUTIONS
};

