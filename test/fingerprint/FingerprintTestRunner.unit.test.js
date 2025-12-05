'use strict';

const FingerprintTestRunner = require('../../src/application/services/fingerprint/FingerprintTestRunner');
const FingerprintConfig = require('../../src/domain/fingerprint/FingerprintConfig');

function sampleConfig() {
  return new FingerprintConfig({
    browser: { type: 'chrome', version: '121.0.0.0' },
    os: { type: 'windows', version: '10', platform: 'Win32' },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    hardware: { cpuCores: 8, deviceMemory: 8, screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 } },
    canvas: { mode: 'noise' },
    webgl: { mode: 'custom', vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    audio: { mode: 'noise' },
    fonts: { mode: 'custom', list: ['Arial'] },
    timezone: { name: 'America/New_York', offset: -300 },
    navigator: { webdriver: false, language: 'en-US' },
    webrtc: { mode: 'restricted' }
  });
}

describe('FingerprintTestRunner minimal coverage', () => {
  test('registerTest registers and runAll executes', async () => {
    const runner = new FingerprintTestRunner({ includeBuiltInTests: false });
    runner.registerTest('Custom', () => ({ passed: true, expected: 'ok', actual: 'ok' }));
    const report = await runner.runAll(sampleConfig());
    expect(report.summary.total).toBe(1);
    expect(report.summary.passed).toBe(1);
  });

  test('category filtering runs only selected categories', async () => {
    const runner = new FingerprintTestRunner({ includeBuiltInTests: false });
    runner.registerTest('Nav A', () => ({ passed: true, expected: 'ok', actual: 'ok' }), { category: FingerprintTestRunner.TestCategory.NAVIGATOR });
    runner.registerTest('WebGL A', () => ({ passed: true, expected: 'ok', actual: 'ok' }), { category: FingerprintTestRunner.TestCategory.WEBGL });
    const report = await runner.runAll(sampleConfig(), { categories: [FingerprintTestRunner.TestCategory.NAVIGATOR] });
    expect(report.summary.total).toBe(1);
    expect(report.byCategory.navigator.total).toBe(1);
    expect(report.byCategory.webgl).toBeUndefined();
  });

  test('generateReport groups by category with pass/fail counts', async () => {
    const runner = new FingerprintTestRunner({ includeBuiltInTests: false });
    runner.registerTest('Nav Pass', () => ({ passed: true, expected: 'ok', actual: 'ok' }), { category: FingerprintTestRunner.TestCategory.NAVIGATOR });
    runner.registerTest('Nav Fail', () => ({ passed: false, expected: 'ok', actual: 'bad' }), { category: FingerprintTestRunner.TestCategory.NAVIGATOR });
    runner.registerTest('WebGL Pass', () => ({ passed: true, expected: 'ok', actual: 'ok' }), { category: FingerprintTestRunner.TestCategory.WEBGL });
    const report = await runner.runAll(sampleConfig());
    expect(report.byCategory.navigator.total).toBe(2);
    expect(report.byCategory.navigator.passed).toBe(1);
    expect(report.byCategory.navigator.failed).toBe(1);
    expect(report.byCategory.webgl.total).toBe(1);
    expect(report.summary.total).toBe(3);
  });
});

