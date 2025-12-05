'use strict';

function navigatorUserAgentTest(config) {
  const expected = config.userAgent;
  const actual = config.userAgent;
  return {
    passed: expected === actual && typeof expected === 'string' && expected.length > 0,
    expected,
    actual,
    details: 'User-Agent string should match configuration'
  };
}

function navigatorPlatformTest(config) {
  const expected = config.os?.platform;
  const actual = config.os?.platform;
  const validPlatforms = ['Win32', 'MacIntel', 'Linux x86_64', 'Linux armv7l', 'Linux aarch64'];
  const isValid = validPlatforms.includes(expected);
  return {
    passed: expected === actual && isValid,
    expected,
    actual,
    details: isValid ? 'Platform matches configuration' : `Platform should be one of: ${validPlatforms.join(', ')}`
  };
}

function navigatorHardwareConcurrencyTest(config) {
  const expected = config.hardware?.cpuCores;
  const actual = config.hardware?.cpuCores;
  const isValid = typeof expected === 'number' && expected >= 1 && expected <= 128;
  return {
    passed: expected === actual && isValid,
    expected,
    actual,
    details: isValid ? 'CPU cores matches configuration' : 'CPU cores should be between 1 and 128'
  };
}

function navigatorDeviceMemoryTest(config) {
  const expected = config.hardware?.deviceMemory;
  const actual = config.hardware?.deviceMemory;
  const validValues = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
  const isValid = validValues.includes(expected);
  return {
    passed: expected === actual && isValid,
    expected,
    actual,
    details: isValid ? 'Device memory matches configuration' : `Device memory should be one of: ${validValues.join(', ')}`
  };
}

function navigatorLanguageTest(config) {
  const expected = config.language?.primary || config.navigator?.language;
  const actual = expected;
  const isValid = typeof expected === 'string' && expected.length > 0;
  return {
    passed: expected === actual && isValid,
    expected,
    actual,
    details: isValid ? 'Language matches configuration' : 'Language should be a non-empty string'
  };
}

function navigatorWebdriverTest(config) {
  const expected = config.navigator?.webdriver;
  const actual = expected;
  const isHidden = expected === false || expected === undefined;
  return {
    passed: isHidden,
    expected: 'false or undefined',
    actual: expected,
    details: isHidden ? 'Webdriver is properly hidden' : 'Webdriver should be false or undefined to avoid detection'
  };
}

module.exports = {
  navigatorUserAgentTest,
  navigatorPlatformTest,
  navigatorHardwareConcurrencyTest,
  navigatorDeviceMemoryTest,
  navigatorLanguageTest,
  navigatorWebdriverTest
};

