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
