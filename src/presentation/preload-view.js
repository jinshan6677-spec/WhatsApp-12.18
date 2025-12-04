'use strict';

const { contextBridge, webFrame } = require('electron');

function parseFingerprintArg() {
  try {
    const arg = (process.argv || []).find(a => typeof a === 'string' && a.startsWith('--fp-config='));
    if (!arg) return null;
    const b64 = arg.substring('--fp-config='.length);
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function injectFingerprint(config) {
  try {
    const { FingerprintInjector } = require('../infrastructure/fingerprint');
    const injector = new FingerprintInjector(config, {
      minify: true,
      includeWorkerInterceptor: false,
      includeIframeProtection: true,
      strictMode: true
    });
    const essentialModules = ['navigator','browserBehavior','webgl','canvas','fonts','clientRects','timezone','geolocation','mediaDevices','webrtc','screen'];
    const script = injector.getInjectionScript({ includeWorkerInterceptor: false, include: essentialModules });
    const exec = () => { try { webFrame.executeJavaScript(script, true); } catch (_) {} };
    exec();
    try { window.addEventListener('DOMContentLoaded', exec, { once: true }); } catch (_) {}
    try { window.addEventListener('load', exec, { once: true }); } catch (_) {}
  } catch (_) {}
}

const fpConfig = parseFingerprintArg();
if (fpConfig) {
  injectFingerprint(fpConfig);
}

try {
  contextBridge.exposeInMainWorld('__fingerprintPreload__', {
    injected: !!fpConfig
  });
} catch (_) {}
