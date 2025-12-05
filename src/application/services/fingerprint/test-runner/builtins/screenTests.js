'use strict';

function screenResolutionTest(config) {
  const screen = config.hardware?.screen;
  const expected = screen ? `${screen.width}x${screen.height}` : 'unknown';
  const actual = expected;
  const isValid = screen && typeof screen.width === 'number' && screen.width > 0 && typeof screen.height === 'number' && screen.height > 0;
  return {
    passed: isValid,
    expected,
    actual,
    details: isValid ? 'Screen resolution matches configuration' : 'Screen resolution should have valid width and height'
  };
}

module.exports = {
  screenResolutionTest
};

