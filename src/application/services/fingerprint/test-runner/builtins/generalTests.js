'use strict';

function userAgentOSConsistencyTest(config) {
  const userAgent = (config.userAgent || '').toLowerCase();
  const osType = config.os?.type;
  let isConsistent = false;
  let expectedOS = '';
  if (osType === 'windows') {
    isConsistent = userAgent.includes('windows');
    expectedOS = 'Windows indicator in User-Agent';
  } else if (osType === 'macos') {
    isConsistent = userAgent.includes('macintosh') || userAgent.includes('mac os');
    expectedOS = 'Macintosh/Mac OS indicator in User-Agent';
  } else if (osType === 'linux') {
    isConsistent = userAgent.includes('linux');
    expectedOS = 'Linux indicator in User-Agent';
  }
  return {
    passed: isConsistent,
    expected: expectedOS,
    actual: isConsistent ? 'User-Agent matches OS type' : `User-Agent does not match OS type: ${osType}`,
    details: `OS type: ${osType}, User-Agent contains correct OS indicator: ${isConsistent}`
  };
}

function configurationValidityTest(config) {
  let isValid = true;
  let errors = [];
  if (config.validate) {
    const validation = config.validate();
    isValid = validation.valid;
    errors = validation.errors || [];
  }
  return {
    passed: isValid,
    expected: 'Valid configuration',
    actual: isValid ? 'Configuration is valid' : `Invalid: ${errors.map(e => e.reason).join(', ')}`,
    details: isValid ? 'All configuration fields are valid' : `${errors.length} validation error(s) found`
  };
}

module.exports = {
  userAgentOSConsistencyTest,
  configurationValidityTest
};

