'use strict';

const TestCategory = require('../TestCategory');

function createPixelscanTests() {
  return [
    {
      name: 'Pixelscan - Automation Detection',
      testFn: (config) => ({
        passed: config.navigator?.webdriver === false || config.navigator?.webdriver === undefined,
        expected: 'No automation indicators',
        actual: config.navigator?.webdriver,
        details: 'Webdriver should be hidden'
      }),
      category: TestCategory.NAVIGATOR
    },
    {
      name: 'Pixelscan - Timezone Consistency',
      testFn: (config) => ({
        passed: config.timezone?.name && typeof config.timezone?.offset === 'number',
        expected: 'Consistent timezone configuration',
        actual: `Name: ${config.timezone?.name}, Offset: ${config.timezone?.offset}`,
        details: 'Timezone should be properly configured'
      }),
      category: TestCategory.TIMEZONE
    },
    {
      name: 'Pixelscan - Screen Consistency',
      testFn: (config) => {
        const screen = config.hardware?.screen;
        const isConsistent = screen && screen.availWidth <= screen.width && screen.availHeight <= screen.height;
        return {
          passed: isConsistent,
          expected: 'availWidth <= width, availHeight <= height',
          actual: screen ? `${screen.availWidth}x${screen.availHeight} vs ${screen.width}x${screen.height}` : 'No screen config',
          details: 'Screen dimensions should be consistent'
        };
      },
      category: TestCategory.SCREEN
    }
  ];
}

module.exports = { createPixelscanTests };

