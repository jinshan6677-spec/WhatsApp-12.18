/**
 * Content Script Entry Point
 * Integrates all modular components and maintains backward compatibility
 */

(function () {
  'use strict';

  console.log('[Translation] Content script initializing...');

  // Import modules (in browser context, these are loaded via script tags)
  // For now, we'll include them inline since this is a browser script

  // Main translation system object
  const WhatsAppTranslation = {
    // Core components
    core: null,
    ui: null,
    messageTranslator: null,
    inputBoxTranslator: null,
    domObserver: null,

    // Legacy properties for backward compatibility
    config: null,
    initialized: false,
    accountId: 'default',

    /**
     * Deep merge two configuration objects
     * Arrays are replaced (not merged), nested objects are recursively merged
     * @param {Object} target - Target object to merge into
     * @param {Object} source - Source object to merge from
     * @returns {Object} Merged object
     */
    deepMerge(target, source) {
      // Handle null/undefined cases
      if (!source) return target ? { ...target } : {};
      if (!target) return { ...source };

      const result = { ...target };

      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          const sourceValue = source[key];
          const targetValue = result[key];

          // If source value is an array, replace directly (don't merge arrays)
          if (Array.isArray(sourceValue)) {
            result[key] = [...sourceValue];
          }
          // If source value is an object (not null, not array), recursively merge
          else if (sourceValue !== null && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
            if (targetValue !== null && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
              result[key] = this.deepMerge(targetValue, sourceValue);
            } else {
              result[key] = this.deepMerge({}, sourceValue);
            }
          }
          // For primitives (string, number, boolean, null, undefined), replace directly
          else {
            result[key] = sourceValue;
          }
        }
      }

      return result;
    },

    /**
     * Update configuration
     * Merges new config with existing config, saves to backend, and applies changes
     * @param {Object} newConfig - New configuration object to merge
     * @returns {Promise<Object>} Result object with success status
     */
    async updateConfig(newConfig) {
      try {
        console.log('[Translation] Updating config:', newConfig);

        // Get current config or default
        const currentConfig = this.core?.config || this.core?.getDefaultConfig() || this.config || {};

        // Deep merge new config with current config
        const mergedConfig = this.deepMerge(currentConfig, newConfig);

        // Update internal config references
        if (this.core) {
          this.core.config = mergedConfig;
        }
        this.config = mergedConfig;

        // Save to backend via IPC
        if (window.translationAPI && window.translationAPI.saveConfig) {
          const accountId = this.accountId || this.core?.accountId || 'default';
          const response = await window.translationAPI.saveConfig(accountId, mergedConfig);

          if (response && response.success) {
            console.log('[Translation] ✓ Config updated and saved');
            // Apply config changes to all modules
            this.applyConfigChanges();
            return { success: true };
          } else {
            const errorMsg = response?.error || 'Unknown error saving config';
            console.error('[Translation] Failed to save config:', errorMsg);
            // Still apply changes locally even if save failed
            this.applyConfigChanges();
            return { success: false, error: errorMsg };
          }
        } else {
          console.warn('[Translation] translationAPI not available, applying changes locally only');
          // Apply changes locally even without backend
          this.applyConfigChanges();
          return { success: true, warning: 'translationAPI not available, changes applied locally only' };
        }
      } catch (error) {
        console.error('[Translation] Error updating config:', error);
        return { success: false, error: error.message };
      }
    },

    /**
     * Apply configuration changes to all modules
     * Reinitializes components that depend on configuration
     */
    applyConfigChanges() {
      console.log('[Translation] Applying config changes...');

      try {
        // Reinitialize input box translator
        if (this.inputBoxTranslator) {
          console.log('[Translation] Reinitializing input box translator...');
          this.inputBoxTranslator.cleanup();
          this.inputBoxTranslator.initInputBoxTranslation();
        }

        // Reinitialize Chinese block handler
        if (this.domObserver) {
          console.log('[Translation] Reinitializing Chinese block handler...');
          this.domObserver.setupChineseBlock();
        }

        // If auto translate is enabled, translate existing messages
        const config = this.config || this.core?.config;
        if (config?.global?.autoTranslate && this.messageTranslator) {
          console.log('[Translation] Auto translate enabled, translating existing messages...');
          this.messageTranslator.translateExistingMessages();
        }

        const vEnabled = !!(config && config.advanced && config.advanced.voiceTranslation);
        if (vEnabled) {
          if (!this.voiceTranslator && typeof window.VoiceMessageTranslator !== 'undefined') {
            this.voiceTranslator = new window.VoiceMessageTranslator(this.core, this.ui);
            this.voiceTranslator.startObserving();
          } else if (this.voiceTranslator) {
            this.voiceTranslator.updateConfig({
              sourceLang: config.global && config.global.sourceLang,
              targetLang: config.global && config.global.targetLang,
              engine: config.global && config.global.engine
            });
            this.voiceTranslator.addTranslateButtons();
          }
        } else {
          if (this.voiceTranslator) {
            this.voiceTranslator.cleanup();
            this.voiceTranslator = null;
          }
        }

        console.log('[Translation] ✓ Config changes applied');
      } catch (error) {
        console.error('[Translation] Error applying config changes:', error);
      }
    },

    /**
     * Setup configuration change listener
     * Listens for config changes from IPC and applies them
     * _Requirements: 8.4_
     */
    setupConfigListener() {
      if (window.translationAPI && window.translationAPI.onConfigChanged) {
        window.translationAPI.onConfigChanged((newConfig) => {
          console.log('[Translation] Config changed via IPC, reloading...', newConfig);

          // Update internal config references
          if (this.core) {
            this.core.config = newConfig;
          }
          this.config = newConfig;

          // Apply the configuration changes to all modules
          this.applyConfigChanges();
        });
        console.log('[Translation] ✓ Config change listener set up');
      } else {
        console.warn('[Translation] translationAPI.onConfigChanged not available, config listener not set up');
      }
    },

    /**
     * Initialize translation system
     */
    async init() {
      if (this.initialized) {
        console.log('[Translation] Already initialized');
        return;
      }

      try {
        // Initialize core
        this.core = new ContentScriptCore();
        await this.core.init();

        // Initialize UI
        this.ui = new TranslationUI(this.core);
        this.ui.injectStyles();

        // Initialize message translator
        this.messageTranslator = new MessageTranslator(this.core, this.ui);

        // Initialize input box translator
        this.inputBoxTranslator = new InputBoxTranslator(this.core, this.ui);

        // Initialize DOM observer
        this.domObserver = new DOMObserver(this.core, this.messageTranslator, this.inputBoxTranslator);

        // Start observing
        this.domObserver.observeMessages();
        this.domObserver.observeChatSwitch();

        // Setup input box
        this.inputBoxTranslator.initInputBoxTranslation();

        // Setup Chinese block
        this.domObserver.setupChineseBlock();

        // Start periodic check
        this.messageTranslator.startPeriodicCheck();

        // Expose config for backward compatibility
        this.config = this.core.config;
        this.initialized = true;

        // Initialize voice translation module if enabled
        if (this.core.config.advanced.voiceTranslation) {
          try {
            console.log('[Translation] Initializing voice translation module...');

            // 检查 VoiceMessageTranslator 是否可用
            if (typeof window.VoiceMessageTranslator !== 'undefined') {
              this.voiceTranslator = new window.VoiceMessageTranslator(this.core, this.ui);
              this.voiceTranslator.startObserving();
              console.log('[Translation] ✓ Voice translation module initialized and started');
            } else {
              console.warn('[Translation] VoiceMessageTranslator not available');
            }
          } catch (error) {
            console.error('[Translation] Failed to initialize voice translation:', error);
          }
        } else {
          console.log('[Translation] Voice translation is disabled in settings');
        }

        // Setup config change listener after all modules are initialized
        // _Requirements: 8.4_
        this.setupConfigListener();

        console.log('[Translation] Initialized successfully');

      } catch (error) {
        console.error('[Translation] Initialization failed:', error);
      }
    },

    /**
     * Translate existing messages (exposed for backward compatibility)
     */
    translateExistingMessages() {
      if (this.messageTranslator) {
        this.messageTranslator.translateExistingMessages();
      }
    },

    /**
     * Get current contact ID (exposed for backward compatibility)
     */
    getCurrentContactId() {
      if (this.core) {
        return this.core.getCurrentContactId();
      }
      return null;
    },

    /**
     * Cleanup resources
     */
    cleanup() {
      if (this.domObserver) {
        this.domObserver.cleanup();
      }
      if (this.inputBoxTranslator) {
        this.inputBoxTranslator.cleanup();
      }
      if (this.voiceTranslator) {
        this.voiceTranslator.cleanup();
      }
      if (this.ui) {
        this.ui.cleanup();
      }
      if (this.core) {
        this.core.cleanup();
      }

      this.initialized = false;
      console.log('[Translation] Cleaned up');
    }
  };

  // Initialize
  WhatsAppTranslation.init();

  // Expose to global (for debugging and manual triggering)
  window.WhatsAppTranslation = WhatsAppTranslation;

  // Add global shortcut functions
  window.translateCurrentChat = function () {
    console.log('[Translation] Manually translating current chat...');
    WhatsAppTranslation.translateExistingMessages();
  };

  // Debug: locate voice anchors and show insert points
  window.debugVoiceAnchors = function () {
    if (!WhatsAppTranslation?.ui?.debugVoiceAnchors) {
      console.warn('[Translation] debugVoiceAnchors unavailable');
      return;
    }
    const res = WhatsAppTranslation.ui.debugVoiceAnchors();
    console.log('[Translation] debugVoiceAnchors result:', res);
    return res;
  };

  window.clearVoiceDebug = function () {
    if (!WhatsAppTranslation?.ui?.clearVoiceDebug) {
      console.warn('[Translation] clearVoiceDebug unavailable');
      return;
    }
    const res = WhatsAppTranslation.ui.clearVoiceDebug();
    console.log('[Translation] clearVoiceDebug result:', res);
    return res;
  };

  // Translate all voice messages in current chat using deterministic anchors
  window.translateAllVoiceMessages = async function () {
    if (!WhatsAppTranslation?.voiceTranslator) {
      console.warn('[Translation] Voice translator unavailable');
      return { success: false };
    }
    const selectors = [
      '[data-testid="audio-player"]',
      '[data-testid="ptt-player"]',
      'audio',
      'canvas',
      '[data-icon="audio-play"]',
      '[data-icon="ptt-play"]',
      'button[aria-label*="Play"]',
      'span[data-icon="audio-play"]'
    ];
    const elements = [];
    selectors.forEach(sel => elements.push(...document.querySelectorAll(sel)));

    const seen = new Set();
    let attempted = 0;
    let succeeded = 0;
    for (const el of elements) {
      const bubble = WhatsAppTranslation.ui.findBubbleContainer(el);
      if (!bubble) continue;
      const id = (bubble.getAttribute('data-id')) || (bubble.getBoundingClientRect().top + ':' + bubble.getBoundingClientRect().left);
      if (seen.has(id)) continue;
      seen.add(id);
      attempted++;
      try {
        await WhatsAppTranslation.voiceTranslator.handleTranslateClick(bubble, null);
        succeeded++;
      } catch (e) {
        console.error('[Translation] translateAllVoiceMessages error:', e);
      }
    }
    const result = { attempted, succeeded };
    console.log('[Translation] translateAllVoiceMessages done:', result);
    return { success: true, ...result };
  };

  window.relocateVoiceResults = function () {
    if (!WhatsAppTranslation?.ui?.relocateVoiceResults) {
      console.warn('[Translation] relocateVoiceResults unavailable');
      return { moved: 0 };
    }
    const res = WhatsAppTranslation.ui.relocateVoiceResults();
    console.log('[Translation] relocateVoiceResults:', res);
    return res;
  };

  let __autoVoiceInterval = null;
  window.enableAutoVoiceTranslate = function () {
    if (__autoVoiceInterval) return { enabled: true };
    const scan = async () => {
      if (!WhatsAppTranslation?.voiceTranslator || !WhatsAppTranslation?.ui) return;
      const selectors = (WhatsAppTranslation.ui && typeof WhatsAppTranslation.ui.getVoiceAnchorSelectors === 'function')
        ? WhatsAppTranslation.ui.getVoiceAnchorSelectors()
        : [
            '[data-testid="audio-player"]',
            '[data-testid="ptt-player"]',
            'audio',
            'canvas',
            '[data-icon="audio-play"]',
            '[data-icon="ptt-play"]',
            'button[aria-label*="Play"]',
            'span[data-icon="audio-play"]'
          ];
      const seen = new Set();
      const elements = [];
      selectors.forEach(sel => elements.push(...document.querySelectorAll(sel)));
      for (const el of elements) {
        const bubble = WhatsAppTranslation.ui.findBubbleContainer(el);
        if (!bubble) continue;
        const id = bubble.getAttribute('data-id') || (bubble.getBoundingClientRect().top + ':' + bubble.getBoundingClientRect().left);
        if (seen.has(id)) continue;
        seen.add(id);
        if (bubble.getAttribute('data-wa-voice-auto') === '1') continue;
        try {
          bubble.setAttribute('data-wa-voice-auto', '1');
          await WhatsAppTranslation.voiceTranslator.handleTranslateClick(bubble, null);
        } catch (e) {
          console.error('[Translation] auto voice translate error:', e);
        }
      }
      try { WhatsAppTranslation.ui.relocateVoiceResults(); } catch (_) {}
    };
    __autoVoiceInterval = setInterval(scan, 2000);
    return { enabled: true };
  };

  window.disableAutoVoiceTranslate = function () {
    if (!__autoVoiceInterval) return { disabled: true };
    clearInterval(__autoVoiceInterval);
    __autoVoiceInterval = null;
    return { disabled: true };
  };

  try { window.enableAutoVoiceTranslate(); } catch (_) {}

  // Listen for click events (when clicking chat list)
  document.addEventListener('click', function (e) {
    // Check if clicked on chat list item
    const chatItem = e.target.closest('[data-testid="cell-frame-container"]') ||
      e.target.closest('._ak8l') ||
      e.target.closest('[role="listitem"]');

    if (chatItem) {
      console.log('[Translation] Chat item clicked, will translate after delay');
      // Delay translation, wait for chat to load
      setTimeout(() => {
        WhatsAppTranslation.translateExistingMessages();
      }, 1000);
    }
  }, true);

  console.log('[Translation] Global functions exposed: window.translateCurrentChat()');

})();
