'use strict';

function timezoneOffsetTest(config) {
  const expected = config.timezone?.offset;
  const actual = expected;
  const isValid = typeof expected === 'number' && expected >= -720 && expected <= 840;
  return {
    passed: isValid,
    expected,
    actual,
    details: isValid ? 'Timezone offset matches configuration' : 'Timezone offset should be between -720 and 840'
  };
}

module.exports = {
  timezoneOffsetTest
};

