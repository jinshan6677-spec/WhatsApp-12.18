'use strict';

const TestCategory = require('../TestCategory');

function createBrowserleaksTests() {
  return [
    {
      name: 'Browserleaks - Canvas Fingerprint',
      testFn: (config) => ({
        passed: config.canvas?.mode === 'noise' || config.canvas?.mode === 'off',
        expected: 'Canvas noise or disabled',
        actual: config.canvas?.mode,
        details: 'Canvas fingerprinting should be protected'
      }),
      category: TestCategory.CANVAS
    },
    {
      name: 'Browserleaks - WebGL Fingerprint',
      testFn: (config) => ({
        passed: config.webgl?.mode === 'custom' && config.webgl?.vendor && config.webgl?.renderer,
        expected: 'Custom WebGL with vendor and renderer',
        actual: `Mode: ${config.webgl?.mode}, Vendor: ${config.webgl?.vendor ? 'set' : 'missing'}`,
        details: 'WebGL fingerprinting should be customized'
      }),
      category: TestCategory.WEBGL
    },
    {
      name: 'Browserleaks - Audio Fingerprint',
      testFn: (config) => ({
        passed: config.audio?.mode === 'noise' || config.audio?.mode === 'off',
        expected: 'Audio noise or disabled',
        actual: config.audio?.mode,
        details: 'Audio fingerprinting should be protected'
      }),
      category: TestCategory.AUDIO
    },
    {
      name: 'Browserleaks - Font Detection',
      testFn: (config) => ({
        passed: config.fonts?.mode === 'custom' && Array.isArray(config.fonts?.list) && config.fonts.list.length > 0,
        expected: 'Custom font list',
        actual: `Mode: ${config.fonts?.mode}, Fonts: ${config.fonts?.list?.length || 0}`,
        details: 'Font enumeration should be controlled'
      }),
      category: TestCategory.FONTS
    }
  ];
}

module.exports = { createBrowserleaksTests };

