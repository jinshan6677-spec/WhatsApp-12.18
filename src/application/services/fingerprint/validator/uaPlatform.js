'use strict';

function validateUserAgentPlatform(config) {
  const errors = [];
  const warnings = [];
  const userAgent = config.userAgent || '';
  const platform = config.os?.platform || '';
  const osType = config.os?.type || '';
  const uaLower = userAgent.toLowerCase();
  const hasWindows = uaLower.includes('windows');
  const hasMac = uaLower.includes('macintosh') || uaLower.includes('mac os');
  const hasLinux = uaLower.includes('linux') && !uaLower.includes('android');
  if (hasWindows) {
    if (platform !== 'Win32') {
      errors.push({ field: 'os.platform', reason: 'User-Agent indicates Windows but platform is not "Win32"', value: platform, suggestion: 'Set platform to "Win32" for Windows User-Agent' });
    }
    if (osType !== 'windows') {
      errors.push({ field: 'os.type', reason: 'User-Agent indicates Windows but os.type is not "windows"', value: osType, suggestion: 'Set os.type to "windows" for Windows User-Agent' });
    }
  } else if (hasMac) {
    if (platform !== 'MacIntel') {
      errors.push({ field: 'os.platform', reason: 'User-Agent indicates macOS but platform is not "MacIntel"', value: platform, suggestion: 'Set platform to "MacIntel" for macOS User-Agent' });
    }
    if (osType !== 'macos') {
      errors.push({ field: 'os.type', reason: 'User-Agent indicates macOS but os.type is not "macos"', value: osType, suggestion: 'Set os.type to "macos" for macOS User-Agent' });
    }
  } else if (hasLinux) {
    const validLinuxPlatforms = ['Linux x86_64','Linux armv7l','Linux aarch64'];
    if (!validLinuxPlatforms.includes(platform)) {
      errors.push({ field: 'os.platform', reason: 'User-Agent indicates Linux but platform is not a valid Linux platform', value: platform, suggestion: 'Set platform to "Linux x86_64" for Linux User-Agent' });
    }
    if (osType !== 'linux') {
      errors.push({ field: 'os.type', reason: 'User-Agent indicates Linux but os.type is not "linux"', value: osType, suggestion: 'Set os.type to "linux" for Linux User-Agent' });
    }
  }
  const browserType = config.browser?.type || '';
  const hasChrome = uaLower.includes('chrome') && !uaLower.includes('edg');
  const hasFirefox = uaLower.includes('firefox');
  const hasEdge = uaLower.includes('edg/') || uaLower.includes('edge/');
  const hasSafari = uaLower.includes('safari') && !uaLower.includes('chrome');
  if (hasChrome && browserType !== 'chrome') {
    warnings.push({ field: 'browser.type', reason: 'User-Agent indicates Chrome but browser.type does not match', value: browserType, suggestion: 'Set browser.type to "chrome"' });
  } else if (hasFirefox && browserType !== 'firefox') {
    warnings.push({ field: 'browser.type', reason: 'User-Agent indicates Firefox but browser.type does not match', value: browserType, suggestion: 'Set browser.type to "firefox"' });
  } else if (hasEdge && browserType !== 'edge') {
    warnings.push({ field: 'browser.type', reason: 'User-Agent indicates Edge but browser.type does not match', value: browserType, suggestion: 'Set browser.type to "edge"' });
  } else if (hasSafari && browserType !== 'safari') {
    warnings.push({ field: 'browser.type', reason: 'User-Agent indicates Safari but browser.type does not match', value: browserType, suggestion: 'Set browser.type to "safari"' });
  }
  if (browserType === 'safari' && osType !== 'macos') {
    errors.push({ field: 'browser.type', reason: 'Safari browser is only available on macOS', value: browserType, suggestion: 'Change browser type or set os.type to "macos"' });
  }
  return { errors, warnings };
}

function getExpectedPlatform(osType) {
  switch (osType) {
    case 'windows':
      return 'Win32';
    case 'macos':
      return 'MacIntel';
    case 'linux':
      return 'Linux x86_64';
    default:
      return 'Win32';
  }
}

module.exports = { validateUserAgentPlatform, getExpectedPlatform };

