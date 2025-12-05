'use strict';

const { WINDOWS_FONTS, MACOS_FONTS, LINUX_FONTS } = require('./constants');

function validateFontsOS(config, strict = false) {
  const errors = [];
  const warnings = [];
  const osType = config.os?.type || '';
  const fontsMode = config.fonts?.mode || 'custom';
  const fontList = config.fonts?.list || [];
  if (fontsMode === 'system') {
    return { errors, warnings };
  }
  let expectedFonts;
  let osSpecificFonts;
  switch (osType) {
    case 'windows':
      expectedFonts = WINDOWS_FONTS;
      osSpecificFonts = ['Segoe UI','Calibri','Consolas'];
      break;
    case 'macos':
      expectedFonts = MACOS_FONTS;
      osSpecificFonts = ['Helvetica Neue','SF Pro Display','Lucida Grande','Monaco'];
      break;
    case 'linux':
      expectedFonts = LINUX_FONTS;
      osSpecificFonts = ['DejaVu Sans','Liberation Sans','Ubuntu','Noto Sans'];
      break;
    default:
      return { errors, warnings };
  }
  const hasOSFonts = fontList.some(font => expectedFonts.includes(font));
  if (!hasOSFonts && fontList.length > 0) {
    warnings.push({ field: 'fonts.list', reason: `Font list does not contain any fonts typical for ${osType}`, value: fontList, suggestion: `Consider adding fonts like: ${osSpecificFonts.join(', ')}` });
  }
  if (osType !== 'windows') {
    const windowsOnlyFonts = ['Segoe UI','Calibri','Consolas'];
    const hasWindowsFonts = fontList.some(font => windowsOnlyFonts.includes(font));
    if (hasWindowsFonts) {
      warnings.push({ field: 'fonts.list', reason: 'Font list contains Windows-specific fonts on non-Windows OS', value: fontList.filter(f => windowsOnlyFonts.includes(f)), suggestion: 'Remove Windows-specific fonts for better consistency' });
    }
  }
  if (osType !== 'macos') {
    const macOnlyFonts = ['SF Pro Display','SF Pro Text','Helvetica Neue','Lucida Grande'];
    const hasMacFonts = fontList.some(font => macOnlyFonts.includes(font));
    if (hasMacFonts) {
      warnings.push({ field: 'fonts.list', reason: 'Font list contains macOS-specific fonts on non-macOS', value: fontList.filter(f => macOnlyFonts.includes(f)), suggestion: 'Remove macOS-specific fonts for better consistency' });
    }
  }
  if (osType !== 'linux') {
    const linuxOnlyFonts = ['DejaVu Sans','Liberation Sans','Ubuntu','Noto Sans'];
    const hasLinuxFonts = fontList.some(font => linuxOnlyFonts.includes(font));
    if (hasLinuxFonts && strict) {
      warnings.push({ field: 'fonts.list', reason: 'Font list contains Linux-specific fonts on non-Linux OS', value: fontList.filter(f => linuxOnlyFonts.includes(f)), suggestion: 'Remove Linux-specific fonts for better consistency' });
    }
  }
  return { errors, warnings };
}

function getExpectedFonts(osType) {
  switch (osType) {
    case 'windows':
      return [...WINDOWS_FONTS];
    case 'macos':
      return [...MACOS_FONTS];
    case 'linux':
      return [...LINUX_FONTS];
    default:
      return [...WINDOWS_FONTS];
  }
}

module.exports = { validateFontsOS, getExpectedFonts };

