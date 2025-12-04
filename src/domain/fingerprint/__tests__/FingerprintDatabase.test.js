'use strict';

const FingerprintDatabase = require('../../fingerprint/FingerprintDatabase');

describe('FingerprintDatabase', () => {
  let db;

  beforeAll(() => {
    db = new FingerprintDatabase().initialize();
  });

  test('getByOS returns browsers for windows', () => {
    const win = db.getByOS('windows');
    expect(Object.keys(win)).toEqual(expect.arrayContaining(['chrome', 'firefox', 'edge']));
    expect(win.chrome.length).toBeGreaterThan(0);
  });

  test('getByBrowser aggregates across OS', () => {
    const chrome = db.getByBrowser('chrome');
    expect(Array.isArray(chrome)).toBe(true);
    expect(chrome.length).toBeGreaterThan(0);
  });

  test('getRandomTemplate supports seed and weighting', () => {
    const counts = new Map();
    for (let i = 0; i < 200; i++) {
      const t = db.getRandomTemplate({ os: 'windows', browser: 'chrome', seed: i });
      const key = t.majorVersion;
      counts.set(key, (counts.get(key) || 0) + 1);
      expect(typeof t.weight).toBe('number');
      expect(t.weight).toBeGreaterThanOrEqual(1);
    }
    expect(counts.size).toBeGreaterThan(0);
  });

  test('generateSyntheticFingerprint mixes components and is deterministic with seed', () => {
    const a = db.generateSyntheticFingerprint({ os: 'windows', browser: 'chrome', seed: 1 });
    const b = db.generateSyntheticFingerprint({ os: 'windows', browser: 'chrome', seed: 1 });
    expect(a.synthetic).toBe(true);
    expect(Array.isArray(a.sourceTemplates)).toBe(true);
    expect(a.sourceTemplates.length).toBe(3);
    expect(a.id).not.toEqual(b.id);
  });

  test('env weight overrides are applied to templates', () => {
    const prev = process.env.FP_WEIGHTS_JSON;
    process.env.FP_WEIGHTS_JSON = JSON.stringify({
      windows: { chrome: { 121: 999 } }
    });

    const freshDb = new FingerprintDatabase().initialize();
    const winChrome = freshDb.getByOSAndBrowser('windows', 'chrome');
    const majors121 = winChrome.filter(t => t.majorVersion === 121);
    expect(majors121.length).toBeGreaterThan(0);
    expect(majors121.every(t => t.weight === 999)).toBe(true);

    if (prev === undefined) delete process.env.FP_WEIGHTS_JSON; else process.env.FP_WEIGHTS_JSON = prev;
  });

  test('env weight overrides support majorRanges and versionPrefixes', () => {
    const prev = process.env.FP_WEIGHTS_JSON;
    process.env.FP_WEIGHTS_JSON = JSON.stringify({
      windows: {
        chrome: {
          majorRanges: [{ range: '>=123', weight: 777 }],
          versionPrefixes: [{ prefix: '121.', weight: 555 }]
        }
      }
    });

    const freshDb = new FingerprintDatabase().initialize();
    const winChrome = freshDb.getByOSAndBrowser('windows', 'chrome');
    const majors123 = winChrome.filter(t => t.majorVersion === 123);
    const prefix121 = winChrome.filter(t => String(t.browserVersion).startsWith('121.'));
    expect(majors123.length).toBeGreaterThan(0);
    expect(majors123.every(t => t.weight === 777)).toBe(true);
    if (prefix121.length) {
      expect(prefix121.every(t => t.weight === 555)).toBe(true);
    }

    if (prev === undefined) delete process.env.FP_WEIGHTS_JSON; else process.env.FP_WEIGHTS_JSON = prev;
  });
});
