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
    this.chatSwitchInterval = null;
    this.headerObserver = null;
    this._chineseBlockInitialized = false;
    this.chineseBlockHandler = null;
    this.chineseBlockMouseDownHandler = null;
    this.chineseBlockClickHandler = null;
    this.chineseBlockInputHandler = null;
    this.lastBlockTimestamp = 0; // For deduplication
  }

  /**
   * Observe messages
   */
  observeMessages(retryCount = 0) {
    // Find main container
    const mainContainer = document.querySelector('[data-testid="conversation-panel-messages"]') ||
      document.querySelector('#main');

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

    // Create MutationObserver - observe entire chat container
    this.messageObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Check if node itself is a message
            if (this.messageTranslator && this.messageTranslator.isMessageNode(node)) {
              console.log('[Translation] New message detected:', node);
              if (node.classList &&
                node.classList.contains('message-out') &&
                this.inputBoxTranslator &&
                this.inputBoxTranslator.handleMessageSent) {
                try { this.inputBoxTranslator.handleMessageSent(); } catch (_) {}
              }
              if (!node.querySelector('.wa-translation-result')) {
                this.messageTranslator.handleNewMessage(node);
              }
            }

            // Also check child nodes for messages
            const messages = node.querySelectorAll('[data-testid="msg-container"], .message-in, .message-out');
            if (messages.length > 0) {
              console.log(`[Translation] Found ${messages.length} messages in added node`);
              messages.forEach(msg => {
                if (msg.classList && msg.classList.contains('message-out') && this.inputBoxTranslator && this.inputBoxTranslator.handleMessageSent) {
                  try { this.inputBoxTranslator.handleMessageSent(); } catch (_) {}
                }
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

    let lastContactId = this.core.getCurrentContactId();
    let reinitTimer = null;

    // Method 1: Monitor contact ID changes by polling
    const checkContactChange = () => {
      const currentContactId = this.core.getCurrentContactId();

      if (currentContactId && currentContactId !== lastContactId) {
        console.log('[Translation] 🔄 Chat switched detected!');
        console.log('[Translation] From:', lastContactId, '→ To:', currentContactId);
        lastContactId = currentContactId;

        // Clear previous timer
        if (reinitTimer) {
          clearTimeout(reinitTimer);
        }

        // Reinitialize after a short delay
        reinitTimer = setTimeout(() => {
          console.log('[Translation] Reinitializing translation for new chat...');

          // Translate messages in new chat
          this.messageTranslator.translateExistingMessages();

          // Reset initialization flags
          this._chineseBlockInitialized = false;
          this.inputBoxTranslator._realtimeInitialized = false;

          // Re-setup input box and realtime translation
          this.inputBoxTranslator.initInputBoxTranslation();
          this.setupChineseBlock();

          console.log('[Translation] ✅ Reinitialization complete');
        }, 300);
      }
    };

    // Poll every 500ms to check for contact changes
    this.chatSwitchInterval = setInterval(checkContactChange, 500);
    console.log('[Translation] Chat switch polling started (every 500ms)');

    // Method 2: Also observe header changes as backup
    const observeHeader = () => {
      const header = document.querySelector('#main header');
      if (header) {
        const headerObserver = new MutationObserver(() => {
          checkContactChange();
        });

        headerObserver.observe(header, {
          childList: true,
          subtree: true,
          characterData: true
        });

        this.headerObserver = headerObserver;
        console.log('[Translation] Header observer set up');
      } else {
        // Retry if header not found
        setTimeout(observeHeader, 1000);
      }
    };

    observeHeader();
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

    console.log('[Translation] Setting up Chinese blocking (Event-Driven)');

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

    // Helper function to update send button visual state
    const updateSendButtonState = (hasChinese) => {
      const sendButton = document.querySelector('[data-testid="send"]') ||
        document.querySelector('button[aria-label*="发送"]') ||
        document.querySelector('button[aria-label*="Send"]') ||
        document.querySelector('span[data-icon="send"]')?.parentElement;

      if (sendButton) {
        if (hasChinese) {
          // Visual cue only - button remains clickable for interception
          sendButton.style.opacity = '0.5';
          sendButton.setAttribute('data-chinese-blocked', 'true');
        } else {
          // Restore visual state
          if (sendButton.getAttribute('data-chinese-blocked') === 'true') {
            sendButton.style.opacity = '';
            sendButton.removeAttribute('data-chinese-blocked');
          }
        }
      }
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

        // Deduplication: only show alert if more than 300ms since last block
        const now = Date.now();
        if (now - this.lastBlockTimestamp > 300) {
          // Show alert
          const ui = new TranslationUI(this.core);
          ui.showChineseBlockAlert();
          this.lastBlockTimestamp = now;
        }

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

    // Layer 2: Intercept mousedown event on send button
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

    // Layer 3: Intercept click event on send button (backup)
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

    // Layer 4: Event-driven input monitoring (replaces polling)
    this.chineseBlockInputHandler = () => {
      if (!this.shouldBlockChinese()) return;

      const inputBox = getInputBox();
      if (!inputBox) return;

      const text = getInputText(inputBox);
      const hasChinese = this.core.containsChinese(text);

      // Update visual state only - button remains clickable
      updateSendButtonState(hasChinese);
    };

    // Add all listeners (use capture phase, highest priority)
    document.addEventListener('keydown', this.chineseBlockHandler, true);
    document.addEventListener('mousedown', this.chineseBlockMouseDownHandler, true);
    document.addEventListener('click', this.chineseBlockClickHandler, true);

    // Add input listener to input box
    const inputBox = getInputBox();
    if (inputBox) {
      inputBox.addEventListener('input', this.chineseBlockInputHandler);
      console.log('[Translation] Input event listener added to input box');
    }

    // Mark as initialized
    this._chineseBlockInitialized = true;

    console.log('[Translation] Chinese blocking enabled (Event-Driven)');
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
    if (this.chineseBlockMouseDownHandler) {
      document.removeEventListener('mousedown', this.chineseBlockMouseDownHandler, true);
      this.chineseBlockMouseDownHandler = null;
    }
    if (this.chineseBlockClickHandler) {
      document.removeEventListener('click', this.chineseBlockClickHandler, true);
      this.chineseBlockClickHandler = null;
    }
    if (this.chineseBlockInputHandler) {
      // Remove from all input boxes
      const allInputBoxes = document.querySelectorAll('[contenteditable="true"]');
      allInputBoxes.forEach(inputBox => {
        inputBox.removeEventListener('input', this.chineseBlockInputHandler);
      });
      this.chineseBlockInputHandler = null;
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

    if (this.chatSwitchInterval) {
      clearInterval(this.chatSwitchInterval);
      this.chatSwitchInterval = null;
    }

    if (this.headerObserver) {
      this.headerObserver.disconnect();
      this.headerObserver = null;
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
