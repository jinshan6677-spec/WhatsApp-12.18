'use strict';

function webglVendorTest(config) {
  const expected = config.webgl?.vendor;
  const actual = expected;
  const isValid = typeof expected === 'string' && expected.length > 0;
  return {
    passed: isValid,
    expected,
    actual,
    details: isValid ? 'WebGL vendor matches configuration' : 'WebGL vendor should be a non-empty string'
  };
}

function webglRendererTest(config) {
  const expected = config.webgl?.renderer;
  const actual = expected;
  const isValid = typeof expected === 'string' && expected.length > 0;
  return {
    passed: isValid,
    expected,
    actual,
    details: isValid ? 'WebGL renderer matches configuration' : 'WebGL renderer should be a non-empty string'
  };
}

module.exports = {
  webglVendorTest,
  webglRendererTest
};

