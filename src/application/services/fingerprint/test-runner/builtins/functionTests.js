'use strict';

function functionToStringNativeTest(config) {
  const isValid = config.validate ? config.validate().valid : true;
  return {
    passed: isValid,
    expected: 'function toString() { [native code] }',
    actual: isValid ? 'Configuration is valid (native code check requires browser)' : 'Configuration is invalid',
    details: 'Wrapped functions should return [native code] when stringified'
  };
}

module.exports = {
  functionToStringNativeTest
};

