/**
 * Preload script for BrowserView (WhatsApp Web)
 * 
 * This script runs in the BrowserView context and injects the translation system
 * This is more reliable than using executeJavaScript
 */

const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

console.log('[Preload-View] Starting preload script for BrowserView');

// Get account ID from command line args or environment
const accountId = process.env.ACCOUNT_ID || 'unknown';
console.log('[Preload-View] Account ID:', accountId);

// Inject account ID into page
window.ACCOUNT_ID = accountId;

// Expose translation API to the page
contextBridge.exposeInMainWorld('translationAPI', {
  translate: (request) => ipcRenderer.invoke('translation:translate', request),
  detectLanguage: (text) => ipcRenderer.invoke('translation:detectLanguage', text),
  getConfig: (accountId) => ipcRenderer.invoke('translation:getConfig', accountId),
  saveConfig: (accountId, config) => ipcRenderer.invoke('translation:saveConfig', accountId, config),
  getStats: () => ipcRenderer.invoke('translation:getStats'),
  clearCache: (accountId = null) => ipcRenderer.invoke('translation:clearCache', accountId),
  saveEngineConfig: (engineName, config) => ipcRenderer.invoke('translation:saveEngineConfig', engineName, config),
  getEngineConfig: (engineName) => ipcRenderer.invoke('translation:getEngineConfig', engineName),
  
  // 配置变更监听
  onConfigChanged: (callback) => {
    ipcRenderer.on('translation:configChanged', (event, config) => callback(config));
  }
});

console.log('[Preload-View] Translation API exposed');

// Load and inject translation scripts when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  console.log('[Preload-View] DOMContentLoaded, injecting translation scripts');
  
  try {
    // Load content script
    const contentScriptPath = path.join(__dirname, 'translation/contentScript.js');
    const contentScript = fs.readFileSync(contentScriptPath, 'utf8');
    
    console.log('[Preload-View] Content script loaded, size:', contentScript.length);
    
    // Inject the script by creating a script element
    const script = document.createElement('script');
    script.textContent = contentScript;
    script.id = 'whatsapp-translation-script';
    
    // Inject into page
    (document.head || document.documentElement).appendChild(script);
    
    console.log('[Preload-View] Translation script injected into page');
    
    // Verify injection
    setTimeout(() => {
      if (typeof window.WhatsAppTranslation !== 'undefined') {
        console.log('[Preload-View] ✓ WhatsAppTranslation is available');
        window.WhatsAppTranslation.accountId = accountId;
        window.WhatsAppTranslation.init().then(() => {
          console.log('[Preload-View] ✓ Translation system initialized');
        }).catch(error => {
          console.error('[Preload-View] ✗ Translation initialization failed:', error);
        });
      } else {
        console.error('[Preload-View] ✗ WhatsAppTranslation is not available after injection');
      }
    }, 1000);
    
  } catch (error) {
    console.error('[Preload-View] Failed to inject translation script:', error);
  }
});

console.log('[Preload-View] Preload script completed');
