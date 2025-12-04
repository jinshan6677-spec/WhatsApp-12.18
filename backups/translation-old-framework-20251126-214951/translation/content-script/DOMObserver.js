/**
 * DOMObserver - Handles DOM observation and monitoring
 * Responsible for observing messages, chat switches, and input box changes
 */

class DOMObserver {
  constructor(core, messageTranslator, inputBoxTranslator) {
    this.core = core;
    this.messageTranslator = messageTranslator;
    this.inputBoxTranslator = inputBoxTranslator;
    this.messageObserver = null;
    this.chatSwitchObserver = null;
    this._chineseBlockInitialized = false;
    this.chineseBlockHandler = null;
    this.chineseBlockKeypressHandler = null;
    this.chineseBlockClickHandler = null;
    this.chineseBlockMouseDownHandler = null;
    this.chineseBlockInputMonitor = null;
  }

  /**
   * Observe messages
   */
  observeMessages(retryCount = 0) {
    // Find main container
    const mainContainer = document.querySelector('#main');

    if (!mainContainer) {
      if (retryCount < 10) {
        setTimeout(() => this.observeMessages(retryCount + 1), 2000);
      }
      return;
    }

    console.log('[Translation] Starting message observation');

    // Disconnect old observer
    if (this.messageObserver) {
      this.messageObserver.disconnect();
    }

    // Create MutationObserver - observe entire #main container
    this.messageObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Check if node itself is a message
            if (node.classList && (node.classList.contains('message-in') || node.classList.contains('message-out'))) {
              console.log('[Translation] New message detected:', node);
              if (!node.querySelector('.wa-translation-result')) {
                this.messageTranslator.handleNewMessage(node);
              }
            }

            // Check if it contains message nodes
            if (this.messageTranslator.isMessageNode(node)) {
              this.messageTranslator.handleNewMessage(node);
            }

            // Also check child nodes for messages
            const messages = node.querySelectorAll('.message-in, .message-out');
            if (messages.length > 0) {
              console.log(`[Translation] Found ${messages.length} messages in added node`);
              messages.forEach(msg => {
                if (!msg.querySelector('.wa-translation-result')) {
                  this.messageTranslator.handleNewMessage(msg);
                }
              });
            }
          }
        });
      });
    });

    // Start observing entire #main container
    this.messageObserver.observe(mainContainer, {
      childList: true,
      subtree: true
    });

    // Handle existing messages in current chat window
    this.messageTranslator.translateExistingMessages();
  }

  /**
   * Observe chat switch
   */
  observeChatSwitch() {
    console.log('[Translation] Setting up chat switch observer');

    // Listen for URL changes (WhatsApp Web uses hash routing)
    let lastUrl = location.href;
    let urlChangeTimer = null;

    const urlObserver = new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('[Translation] Chat switched, re-translating messages');

        // Clear previous timer
        if (urlChangeTimer) {
          clearTimeout(urlChangeTimer);
        }

        // Delay a bit, wait for new chat to load
        urlChangeTimer = setTimeout(() => {
          this.messageTranslator.translateExistingMessages();

          // Reset initialization flags, allow re-initialization
          this._chineseBlockInitialized = false;
          this.inputBoxTranslator._realtimeInitialized = false;

          this.inputBoxTranslator.initInputBoxTranslation(); // Re-setup input box
          this.setupChineseBlock(); // Re-setup Chinese block
        }, 500);
      }
    });

    // Observe document.body changes
    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also listen for #main container changes
    const mainContainer = document.querySelector('#main');
    if (mainContainer) {
      let chatChangeTimer = null;

      const chatObserver = new MutationObserver((mutations) => {
        // Clear previous timer
        if (chatChangeTimer) {
          clearTimeout(chatChangeTimer);
        }

        // 500ms debounce
        chatChangeTimer = setTimeout(() => {
          // Check if there's significant DOM change (possibly chat switch)
          const hasSignificantChange = mutations.some(m =>
            m.addedNodes.length > 5 || m.removedNodes.length > 5
          );

          if (hasSignificantChange) {
            console.log('[Translation] Significant DOM change detected');
            setTimeout(() => {
              this.messageTranslator.translateExistingMessages();

              // Reset initialization flags
              this._chineseBlockInitialized = false;
              this.inputBoxTranslator._realtimeInitialized = false;

              this.inputBoxTranslator.initInputBoxTranslation();
              this.setupChineseBlock();
            }, 300);
          }
        }, 500);
      });

      chatObserver.observe(mainContainer, {
        childList: true,
        subtree: false // Only observe direct children
      });
    }
  }

  /**
   * Setup Chinese block
   */
  setupChineseBlock() {
    // Check if blocking is needed
    const shouldBlock = this.shouldBlockChinese();

    // If blocking not needed, cleanup resources and return
    if (!shouldBlock) {
      this.cleanupChineseBlock();
      if (this._chineseBlockInitialized) {
        console.log('[Translation] Chinese blocking disabled');
        this._chineseBlockInitialized = false;
      }
      return;
    }

    // If already initialized and config hasn't changed, return directly
    if (this._chineseBlockInitialized) {
      return;
    }

    // Cleanup old listeners
    this.cleanupChineseBlock();

    console.log('[Translation] Setting up Chinese blocking with multi-layer defense');

    // Helper function to get input box
    const getInputBox = () => {
      return document.querySelector('footer [contenteditable="true"]') ||
        document.querySelector('[data-testid="conversation-compose-box-input"]') ||
        document.querySelector('#main footer div[contenteditable="true"]');
    };

    // Helper function to get input box text
    const getInputText = (inputBox) => {
      if (!inputBox) return '';

      if (inputBox.hasAttribute('data-lexical-editor')) {
        const textNodes = inputBox.querySelectorAll('p, span[data-text="true"]');
        if (textNodes.length > 0) {
          return Array.from(textNodes).map(node => node.textContent).join('\n');
        }
      }

      return inputBox.textContent || inputBox.innerText || '';
    };

    // Core function to check and block
    const checkAndBlock = (e, source) => {
      const inputBox = getInputBox();
      if (!inputBox) {
        return false;
      }

      const text = getInputText(inputBox);

      if (this.core.containsChinese(text)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Show alert
        const ui = new TranslationUI(this.core);
        ui.showChineseBlockAlert();

        console.log(`[Translation] Blocked Chinese message send via ${source}`);
        return true;
      }

      return false;
    };

    // Layer 1: Intercept keydown event (Enter key)
    this.chineseBlockHandler = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        checkAndBlock(e, 'Enter key');
      }
    };

    // Layer 2: Intercept keypress event (backup)
    this.chineseBlockKeypressHandler = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        checkAndBlock(e, 'Enter keypress');
      }
    };

    // Layer 3: Intercept mousedown event (earlier than click)
    this.chineseBlockMouseDownHandler = (e) => {
      const target = e.target;
      const sendButton = target.closest('[data-testid="send"]') ||
        target.closest('button[aria-label*="发送"]') ||
        target.closest('button[aria-label*="Send"]') ||
        target.closest('span[data-icon="send"]')?.parentElement;

      if (sendButton) {
        checkAndBlock(e, 'mousedown on send button');
      }
    };

    // Layer 4: Intercept click event (double insurance)
    this.chineseBlockClickHandler = (e) => {
      const target = e.target;
      const sendButton = target.closest('[data-testid="send"]') ||
        target.closest('button[aria-label*="发送"]') ||
        target.closest('button[aria-label*="Send"]') ||
        target.closest('span[data-icon="send"]')?.parentElement;

      if (sendButton) {
        checkAndBlock(e, 'click on send button');
      }
    };

    // Layer 5: Continuously monitor input box, disable send button if Chinese detected
    this.chineseBlockInputMonitor = setInterval(() => {
      if (!this.shouldBlockChinese()) return;

      const inputBox = getInputBox();
      if (!inputBox) return;

      const text = getInputText(inputBox);
      const hasChinese = this.core.containsChinese(text);

      // Find send button
      const sendButton = document.querySelector('[data-testid="send"]') ||
        document.querySelector('button[aria-label*="发送"]') ||
        document.querySelector('button[aria-label*="Send"]') ||
        document.querySelector('span[data-icon="send"]')?.parentElement;

      if (sendButton) {
        if (hasChinese) {
          // Disable send button
          sendButton.style.pointerEvents = 'none';
          sendButton.style.opacity = '0.5';
          sendButton.setAttribute('data-chinese-blocked', 'true');
        } else {
          // Restore send button
          if (sendButton.getAttribute('data-chinese-blocked') === 'true') {
            sendButton.style.pointerEvents = '';
            sendButton.style.opacity = '';
            sendButton.removeAttribute('data-chinese-blocked');
          }
        }
      }
    }, 100); // Check every 100ms

    // Add all listeners (use capture phase, highest priority)
    document.addEventListener('keydown', this.chineseBlockHandler, true);
    document.addEventListener('keypress', this.chineseBlockKeypressHandler, true);
    document.addEventListener('mousedown', this.chineseBlockMouseDownHandler, true);
    document.addEventListener('click', this.chineseBlockClickHandler, true);

    // Mark as initialized
    this._chineseBlockInitialized = true;

    console.log('[Translation] Chinese blocking enabled with 5-layer defense');
  }

  /**
   * Check if Chinese should be blocked
   */
  shouldBlockChinese() {
    // Get current contact ID
    const contactId = this.core.getCurrentContactId();

    // If friend independent config is enabled, check contact's config
    if (this.core.config.advanced.friendIndependent && contactId) {
      const friendConfig = this.core.config.friendConfigs && this.core.config.friendConfigs[contactId];
      if (friendConfig && friendConfig.enabled) {
        // Use contact's independent config
        return friendConfig.blockChinese || false;
      }
    }

    // Use global config
    return this.core.config.advanced.blockChinese || false;
  }

  /**
   * Cleanup Chinese block
   */
  cleanupChineseBlock() {
    if (this.chineseBlockHandler) {
      document.removeEventListener('keydown', this.chineseBlockHandler, true);
      this.chineseBlockHandler = null;
    }
    if (this.chineseBlockKeypressHandler) {
      document.removeEventListener('keypress', this.chineseBlockKeypressHandler, true);
      this.chineseBlockKeypressHandler = null;
    }
    if (this.chineseBlockClickHandler) {
      document.removeEventListener('click', this.chineseBlockClickHandler, true);
      this.chineseBlockClickHandler = null;
    }
    if (this.chineseBlockMouseDownHandler) {
      document.removeEventListener('mousedown', this.chineseBlockMouseDownHandler, true);
      this.chineseBlockMouseDownHandler = null;
    }
    if (this.chineseBlockInputMonitor) {
      clearInterval(this.chineseBlockInputMonitor);
      this.chineseBlockInputMonitor = null;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.messageObserver) {
      this.messageObserver.disconnect();
      this.messageObserver = null;
    }

    if (this.chatSwitchObserver) {
      this.chatSwitchObserver.disconnect();
      this.chatSwitchObserver = null;
    }

    this.cleanupChineseBlock();

    this._chineseBlockInitialized = false;
    console.log('[Translation] DOMObserver cleaned up');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DOMObserver;
}
