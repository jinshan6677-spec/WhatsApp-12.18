/**
 * Preload script for BrowserView (WhatsApp Web)
 * 
 * This script runs in the BrowserView context and injects the modular translation system
 * Injects modules in correct order to maintain dependencies
 */

const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

console.log('[Preload-View] Starting preload script for BrowserView');

// Get account ID from additional arguments or environment
const accountArg = (process.argv || []).find(a => typeof a === 'string' && a.startsWith('--account-id='));
const accountId = accountArg ? (accountArg.split('=')[1] || 'unknown') : (process.env.ACCOUNT_ID || 'unknown');
console.log('[Preload-View] Account ID:', accountId);

// Inject account ID into page
window.ACCOUNT_ID = accountId;

// Fingerprint injection
try {
  const fpArg = (process.argv || []).find(a => typeof a === 'string' && a.startsWith('--fp-config='));
  let fpConfig = null;
  if (fpArg) {
    const encoded = fpArg.split('=')[1] || '';
    if (encoded) {
      fpConfig = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    }
  }
  const injectFingerprint = async (config) => {
    if (!config) return;
    try {
      const { FingerprintInjector } = require('./infrastructure/fingerprint');
      const { webFrame } = require('electron');
      const fs = require('fs');
      const path = require('path');
      const os = require('os');

      const injector = new FingerprintInjector(config, {
        minify: false,  // 禁用 minify 以便调试
        includeWorkerInterceptor: true,
        includeIframeProtection: true,
        strictMode: true
      });
      const essentialModules = ['navigator', 'browserBehavior', 'webgl', 'canvas', 'fonts', 'clientRects', 'timezone', 'geolocation', 'mediaDevices', 'webrtc', 'screen'];
      const injectionScript = injector.getInjectionScript({ minify: false, includeWorkerInterceptor: true, include: essentialModules });

      // 保存脚本到临时文件以便调试
      try {
        const tempPath = path.join(os.tmpdir(), `fp-injection-${Date.now()}.js`);
        fs.writeFileSync(tempPath, injectionScript);
        console.log('[Preload-View] Script saved to:', tempPath);
      } catch (saveError) {
        console.warn('[Preload-View] Could not save script:', saveError.message);
      }

      // 测试脚本语法
      try {
        new Function(injectionScript);
        console.log('[Preload-View] ✓ Script syntax is valid');
      } catch (syntaxError) {
        console.error('[Preload-View] ✗ Script has syntax error:', syntaxError.message);
        throw syntaxError;
      }

      await webFrame.executeJavaScript(injectionScript, true);
      console.log('[Preload-View] ✓ Fingerprint injected at preload');

      // Inject runtime patches into the main world early
      const runtimePatches = `(() => {
        try {
          // Suppress noisy ErrorUtils logs
          const _origErr = console.error;
          console.error = function(...args) {
            const s = (args && args[0] && typeof args[0] === 'string') ? args[0] : '';
            if (s.includes('ErrorUtils caught an error') || s.includes('Missing catch or finally after try') || s.includes('fburl.com/debugjs')) {
              return;
            }
            return _origErr.apply(this, args);
          };

          // Worker error suppression wrapper (attach early)
          if (typeof Worker !== 'undefined') {
            const OriginalWorker = Worker;
            // Avoid double-wrapping
            if (!OriginalWorker.__wrapped__) {
              const WrappedWorker = function(scriptURL, options) {
                const w = new OriginalWorker(scriptURL, options);
                try {
                  w.addEventListener('error', function(ev) {
                    const msg = ev && ev.message ? ev.message : '';
                    if (msg && msg.includes('Missing catch or finally after try')) {
                      if (ev.preventDefault) ev.preventDefault();
                    }
                  }, true);
                } catch (_) {}
                return w;
              };
              Object.setPrototypeOf(WrappedWorker, OriginalWorker);
              WrappedWorker.prototype = OriginalWorker.prototype;
              Object.defineProperty(WrappedWorker, '__wrapped__', { value: true });
              try { window.Worker = WrappedWorker; } catch (_) {}
            }
          }

          // Canvas getContext default willReadFrequently for heavy readback
          if (typeof HTMLCanvasElement !== 'undefined') {
            const proto = HTMLCanvasElement.prototype;
            const origGetContext = proto.getContext;
            if (origGetContext && !origGetContext.__patched__) {
              proto.getContext = function(type, options) {
                if (type === '2d') {
                  if (!options || typeof options !== 'object') {
                    options = { willReadFrequently: true };
                  } else if (options.willReadFrequently === undefined) {
                    options = { ...options, willReadFrequently: true };
                  }
                }
                return origGetContext.call(this, type, options);
              };
              Object.defineProperty(proto.getContext, '__patched__', { value: true });
            }
          }
        } catch (_) {}
      })();`;
      await webFrame.executeJavaScript(runtimePatches, true);
    } catch (e) {
      console.error('[Preload-View] ✗ Fingerprint preload injection failed:', e);
      console.error('[Preload-View] Error stack:', e.stack);
    }
  };
  const reinject = (cfg) => {
    injectFingerprint(cfg).catch(() => { });
    try {
      window.addEventListener('DOMContentLoaded', () => {
        injectFingerprint(cfg).catch(() => { });
      }, { once: true });
    } catch (_) { }
    try {
      window.addEventListener('load', () => {
        injectFingerprint(cfg).catch(() => { });
      }, { once: true });
    } catch (_) { }
  };
  if (fpConfig) {
    console.log('[Preload-View] Using command-line fingerprint config');
    reinject(fpConfig);
  } else {
    console.log('[Preload-View] Loading fingerprint config from IPC for account:', accountId);
    ipcRenderer.invoke('fingerprint:get', accountId).then(res => {
      if (res && res.success && res.config) {
        console.log('[Preload-View] ✓ Fingerprint config loaded successfully');
        console.log('[Preload-View] Config preview:', {
          userAgent: res.config.userAgent?.substring(0, 50) + '...',
          screen: res.config.hardware?.screen,
          webgl: { vendor: res.config.webgl?.vendor, renderer: res.config.webgl?.renderer?.substring(0, 50) + '...' }
        });
        reinject(res.config);
      } else {
        console.warn('[Preload-View] ✗ Failed to load fingerprint config:', res);
      }
    }).catch((err) => {
      console.error('[Preload-View] ✗ Error loading fingerprint config:', err);
    });
  }
} catch (e) {
  console.error('[Preload-View] ✗ Fingerprint setup error:', e);
}

// Expose translation API to the page
// Note: The IPCRouter expects payload as a single object, so we wrap parameters accordingly
contextBridge.exposeInMainWorld('translationAPI', {
  translate: (request) => ipcRenderer.invoke('translation:translate', request),
  detectLanguage: (text) => ipcRenderer.invoke('translation:detectLanguage', text),
  getConfig: (accountId) => ipcRenderer.invoke('translation:getConfig', accountId),
  // saveConfig expects { accountId, config } as payload
  saveConfig: (accountId, config) => ipcRenderer.invoke('translation:saveConfig', { accountId, config }),
  getStats: () => ipcRenderer.invoke('translation:getStats'),
  clearCache: (accountId = null) => ipcRenderer.invoke('translation:clearCache', accountId),
  // saveEngineConfig expects { engineName, config } as payload
  saveEngineConfig: (engineName, config) => ipcRenderer.invoke('translation:saveEngineConfig', { engineName, config }),
  getEngineConfig: (engineName) => ipcRenderer.invoke('translation:getEngineConfig', engineName),

  // 配置变更监听
  onConfigChanged: (callback) => {
    ipcRenderer.on('translation:configChanged', (_, config) => callback(config));
  }
});

// Expose STT API for voice translation (绕过 CORS 限制)
contextBridge.exposeInMainWorld('sttAPI', {
  callGroq: async (audioBlob, apiKey, model) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      return await ipcRenderer.invoke('stt:groq', {
        audioBlob: Array.from(uint8Array),
        apiKey,
        model
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

contextBridge.exposeInMainWorld('llmAPI', {
  translateWithGroq: async (apiKey, model, prompt) => {
    try {
      return await ipcRenderer.invoke('llm:groq-translate', {
        apiKey,
        model,
        prompt
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

// Expose electronAPI for WhatsApp Web profile extraction
// This allows the injected scripts to communicate with the main process
contextBridge.exposeInMainWorld('electronAPI', {
  // Update account profile (nickname, avatar, phone number)
  invoke: (channel, data) => {
    const allowedChannels = ['view:update-profile', 'view:update-unread-count'];
    if (allowedChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    console.warn(`[Preload-View] Channel not allowed: ${channel}`);
    return Promise.reject(new Error(`Channel not allowed: ${channel}`));
  },

  // Send a message to main process (fire and forget)
  send: (channel, data) => {
    const allowedChannels = ['account-profile-update'];
    if (allowedChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`[Preload-View] Channel not allowed: ${channel}`);
    }
  },

  // Get current account ID
  getAccountId: () => accountId
});

console.log('[Preload-View] Translation API exposed');
console.log('[Preload-View] electronAPI exposed for profile extraction');

/**
 * Inject a script file into the page
 * @param {string} scriptPath - Path to the script file
 * @param {string} scriptId - ID for the script element
 * @returns {Promise<void>}
 */
async function injectScript(scriptPath, scriptId) {
  try {
    const scriptContent = await fs.promises.readFile(scriptPath, 'utf8');
    const script = document.createElement('script');
    script.textContent = scriptContent;
    script.id = scriptId;
    (document.head || document.documentElement).appendChild(script);
    console.log(`[Preload-View] ✓ Injected: ${scriptId}`);
  } catch (error) {
    console.error(`[Preload-View] ✗ Failed to inject ${scriptId}:`, error);
    throw error;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryInjectScript(scriptPath, scriptId, retries = 2, delayMs = 500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await injectScript(scriptPath, scriptId);
      return true;
    } catch (e) {
      if (attempt < retries) {
        await sleep(delayMs * Math.pow(2, attempt));
        continue;
      }
      console.warn(`[Preload-View] Inject retry exhausted: ${scriptId}`);
      return false;
    }
  }
}

async function checkTranslationAvailable() {
  try {
    const { webFrame } = require('electron');
    const available = await webFrame.executeJavaScript('typeof window.WhatsAppTranslation !== "undefined"');
    return Boolean(available);
  } catch (_) {
    return false;
  }
}

// Load and inject translation scripts when DOM is ready
window.addEventListener('DOMContentLoaded', async () => {
  console.log('[Preload-View] DOMContentLoaded, injecting modular translation scripts');

  try {
    // Define module paths in dependency order
    const modulesDir = path.join(__dirname, 'presentation/translation/content-script');
    const voiceTranslationDir = path.join(__dirname, 'single-window/renderer/voice-translation');

    // Core translation modules
    const modules = [
      { file: 'ContentScriptCore.js', id: 'translation-core' },
      { file: 'TranslationUI.js', id: 'translation-ui' },
      { file: 'MessageTranslator.js', id: 'translation-message' },
      { file: 'InputBoxTranslator.js', id: 'translation-inputbox' },
      { file: 'DOMObserver.js', id: 'translation-observer' }
    ];

    // Voice translation modules
    const voiceModules = [
      { file: 'AudioInterceptor.js', id: 'voice-translation-interceptor' },
      { file: 'SilentPlaybackController.js', id: 'voice-translation-playback' },
      { file: 'AudioDownloader.js', id: 'voice-translation-downloader' },
      { file: 'GroqSTT.js', id: 'voice-translation-stt-groq' },
      { file: 'VoiceTranslationModule.js', id: 'voice-translation-module' }
    ];

    // Voice message translator (content script)
    const voiceContentScript = [
      { file: 'VoiceMessageTranslator.js', id: 'voice-message-translator' }
    ];

    console.log(`[Preload-View] Injecting ${modules.length} core translation modules...`);

    // Inject core modules in order with retry
    for (const module of modules) {
      const modulePath = path.join(modulesDir, module.file);
      const ok = await tryInjectScript(modulePath, module.id, 2, 500);
      if (!ok) {
        console.warn(`[Preload-View] Core module failed: ${module.id}`);
      }
    }

    // Inject voice translation modules
    console.log(`[Preload-View] Injecting ${voiceModules.length} voice translation modules...`);
    for (const module of voiceModules) {
      const modulePath = path.join(voiceTranslationDir, module.file);
      const ok = await tryInjectScript(modulePath, module.id, 1, 700);
      if (!ok) {
        console.warn(`[Preload-View] Failed to inject ${module.id}`);
      }
    }

    // Inject voice content script
    console.log(`[Preload-View] Injecting voice message translator...`);
    for (const module of voiceContentScript) {
      const modulePath = path.join(modulesDir, module.file);
      const ok = await tryInjectScript(modulePath, module.id, 1, 700);
      if (!ok) {
        console.warn(`[Preload-View] Failed to inject ${module.id}`);
      }
    }

    // Finally inject main index.js
    const mainModulePath = path.join(modulesDir, 'index.js');
    await tryInjectScript(mainModulePath, 'translation-main', 2, 500);

    console.log('[Preload-View] ✓ All translation modules injected');

    // Verify injection and set account ID
    // Note: Scripts injected via <script> tags run in the main world,
    // while preload scripts run in an isolated world. We need to use
    // a script injection to check and set values in the main world.
    setTimeout(() => {
      // Inject a script to check and configure WhatsAppTranslation in the main world
      const configScript = document.createElement('script');
      configScript.textContent = `
        (function() {
          if (typeof window.WhatsAppTranslation !== 'undefined') {
            console.log('[Preload-View] ✓ WhatsAppTranslation is available in main world');

            // Set account ID
            window.WhatsAppTranslation.accountId = '${accountId}';
            if (window.WhatsAppTranslation.core) {
              window.WhatsAppTranslation.core.accountId = '${accountId}';
            }

            // Expose voice translation modules globally
            if (typeof VoiceTranslationModule !== 'undefined') {
              window.VoiceTranslationModule = VoiceTranslationModule;
              console.log('[Preload-View] ✓ VoiceTranslationModule exposed globally');
            }

            if (typeof VoiceMessageTranslator !== 'undefined') {
              window.VoiceMessageTranslator = VoiceMessageTranslator;
              console.log('[Preload-View] ✓ VoiceMessageTranslator exposed globally');
            }

            console.log('[Preload-View] ✓ Translation system ready with account: ${accountId}');
          } else {
            console.error('[Preload-View] ✗ WhatsAppTranslation is not available in main world');
          }
        })();
      `;
      configScript.id = 'translation-config';
      (document.head || document.documentElement).appendChild(configScript);
    }, 500);

    setTimeout(async () => {
      const healthy = await checkTranslationAvailable();
      if (!healthy) {
        console.warn('[Preload-View] Translation not available, attempting minimal fallback');
        const minimal = [
          { file: 'ContentScriptCore.js', id: 'translation-core' },
          { file: 'MessageTranslator.js', id: 'translation-message' },
          { file: 'InputBoxTranslator.js', id: 'translation-inputbox' },
          { file: 'DOMObserver.js', id: 'translation-observer' }
        ];
        for (const m of minimal) {
          const p = path.join(modulesDir, m.file);
          await tryInjectScript(p, m.id, 2, 500);
        }
        const idx = path.join(modulesDir, 'index.js');
        await tryInjectScript(idx, 'translation-main', 2, 500);
      }
    }, 1500);

  } catch (error) {
    console.error('[Preload-View] Failed to inject translation scripts:', error);
    try {
      const modulesDir = path.join(__dirname, 'presentation/translation/content-script');
      console.warn('[Preload-View] Attempting minimal fallback injection');
      const minimal = [
        { file: 'ContentScriptCore.js', id: 'translation-core' },
        { file: 'MessageTranslator.js', id: 'translation-message' },
        { file: 'InputBoxTranslator.js', id: 'translation-inputbox' },
        { file: 'DOMObserver.js', id: 'translation-observer' }
      ];
      for (const m of minimal) {
        const p = path.join(modulesDir, m.file);
        await tryInjectScript(p, m.id, 2, 500);
      }
      const idx = path.join(modulesDir, 'index.js');
      await tryInjectScript(idx, 'translation-main', 2, 500);
    } catch (e) {
      console.error('[Preload-View] Fallback injection failed:', e);
    }
  }
});

// Inject profile auto-extraction script
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Wait a bit for the page to stabilize
    await new Promise(r => setTimeout(r, 2000));

    // Path to the auto-extraction script
    const scriptPath = path.join(__dirname, '../scripts/whatsapp-profile-autoextract.js');

    // Check if file exists
    if (fs.existsSync(scriptPath)) {
      const scriptContent = await fs.promises.readFile(scriptPath, 'utf8');

      // Inject the script with account ID
      const wrappedScript = `
        window.ACCOUNT_ID = '${accountId}';
        ${scriptContent}
      `;

      const script = document.createElement('script');
      script.textContent = wrappedScript;
      script.id = 'whatsapp-profile-autoextract';
      (document.head || document.documentElement).appendChild(script);

      console.log('[Preload-View] ✓ Profile auto-extraction script injected');
    } else {
      console.log('[Preload-View] Profile auto-extraction script not found:', scriptPath);
    }
  } catch (error) {
    console.error('[Preload-View] Failed to inject profile extraction script:', error);
  }

  // Inject unread count observer
  try {
    const unreadScriptPath = path.join(__dirname, '../scripts/whatsapp-unread-observer.js');
    if (fs.existsSync(unreadScriptPath)) {
      const scriptContent = await fs.promises.readFile(unreadScriptPath, 'utf8');
      const wrappedScript = `
        window.ACCOUNT_ID = '${accountId}';
        ${scriptContent}
      `;
      const script = document.createElement('script');
      script.textContent = wrappedScript;
      script.id = 'whatsapp-unread-observer';
      (document.head || document.documentElement).appendChild(script);
      console.log('[Preload-View] ✓ Unread observer script injected');
    }
  } catch (error) {
    console.error('[Preload-View] Failed to inject unread observer script:', error);
  }


});

console.log('[Preload-View] Preload script completed');
