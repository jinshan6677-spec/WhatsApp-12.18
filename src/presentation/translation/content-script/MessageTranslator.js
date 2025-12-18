/**
 * MessageTranslator - Handles message translation in chat window
 * Responsible for translating received messages
 */

class MessageTranslator {
  constructor(core, ui) {
    this.core = core;
    this.ui = ui;
  }

  /**
   * Handle new message
   */
  async handleNewMessage(messageNode) {
    try {
      // Check if config is loaded
      if (!this.core.config || !this.core.config.global) {
        console.log('[Translation] Config not loaded yet, skipping');
        return;
      }

      // Check if already translated
      if (messageNode.querySelector('.wa-translation-result')) {
        console.log('[Translation] Message already translated, skipping');
        return;
      }

      // Check if auto translate is enabled
      if (!this.core.config.global.autoTranslate) {
        console.log('[Translation] Auto translate disabled, skipping');
        return;
      }

      // Check if it's a group message
      const isGroup = this.core.isGroupChat();
      if (isGroup) {
        console.log('[Translation] This is a group chat, groupTranslation config:', this.core.config.global.groupTranslation);
        if (!this.core.config.global.groupTranslation) {
          console.log('[Translation] Group translation disabled, skipping');
          return;
        }
      }

      // Extract message text
      // Extract message text
      const textElement = messageNode.querySelector('.copyable-text span') ||
        messageNode.querySelector('.copyable-text') ||
        messageNode.querySelector('.selectable-text[dir="ltr"], .selectable-text[dir="rtl"]') ||
        messageNode.querySelector('.selectable-text') ||
        messageNode.querySelector('[data-testid="conversation-text"]') ||
        messageNode.querySelector('[data-testid="msg-text"]');
      if (!textElement || !textElement.textContent.trim()) {
        console.log('[Translation] No text found in message, skipping');
        return;
      }

      const messageText = textElement.textContent.trim();

      // Skip translation UI for pure Arabic numerals
      if (/^\d+$/.test(messageText)) {
        console.log('[Translation] Skipping UI for pure numerals:', messageText);
        return;
      }

      // Chat window translation uses global target language (usually Chinese)
      const targetLang = this.core.config.global.targetLang || 'zh-CN';

      // Only skip Chinese messages when target language is Chinese
      if (targetLang.startsWith('zh') && this.core.isChinese(messageText)) {
        messageNode.setAttribute('data-translation-skipped', 'true');
        return;
      }

      // Translate message (chat window translation, no style)
      await this.translateMessage(messageNode, messageText);

    } catch (error) {
      console.error('[Translation] Error handling message:', error);
    }
  }

  /**
   * Translate message (received messages in chat window)
   * Note: Chat window translation doesn't use style parameter
   */
  async translateMessage(messageNode, text) {
    try {
      if (!window.translationAPI) {
        console.error('[Translation] translationAPI not available');
        return;
      }

      // Chat window translation uses global engine (can be Google or AI)
      const engineName = this.core.config.global.engine;
      console.log(`[Translation] 🔄 Chat window translation, using engine: ${engineName} (no style)`);

      const response = await window.translationAPI.translate({
        accountId: this.core.accountId,
        text: text,
        sourceLang: this.core.config.global.sourceLang || 'auto',
        targetLang: this.core.config.global.targetLang || 'zh-CN',
        engineName: engineName,
        options: {} // Chat window translation doesn't pass style parameter
      });

      // The IPC handler returns the result directly (not wrapped in { success, data })
      // because ipcMain.handle returns response.data
      if (response) {
        // Check if response is wrapped or direct
        let translationResult;
        if (response.success !== undefined) {
          // Wrapped response: { success: true, data: result }
          if (response.success) {
            translationResult = response.data;
          } else {
            console.error('[Translation] Translation failed:', response.error);
            this.ui.displayError(messageNode, response.error);
            return;
          }
        } else {
          // Direct result object (translatedText, etc.)
          translationResult = response;
        }

        console.log(`[Translation] ✅ Translation successful, using engine: ${translationResult.engineName || engineName}`);
        this.ui.displayTranslation(messageNode, translationResult);
      } else {
        console.error('[Translation] Empty translation response');
        this.ui.displayError(messageNode, 'Empty response');
      }

    } catch (error) {
      console.error('[Translation] Translation error:', error);
      this.ui.displayError(messageNode, error.message);
    }
  }

  /**
   * Translate existing messages
   */
  translateExistingMessages() {
    const existingMessages = document.querySelectorAll('.message-in, .message-out');
    console.log(`[Translation] Found ${existingMessages.length} existing messages`);

    existingMessages.forEach(msg => {
      if (!msg.querySelector('.wa-translation-result')) {
        this.handleNewMessage(msg);
      }
    });
  }

  /**
   * Check if node is a message node
   */
  isMessageNode(node) {
    return node.matches && (
      node.matches('[data-testid="msg-container"]') ||
      node.matches('.message-in') ||
      node.matches('.message-out') ||
      node.querySelector('[data-testid="msg-container"]') ||
      node.querySelector('.message-in') ||
      node.querySelector('.message-out')
    );
  }

  /**
   * Start periodic check for new messages
   */
  startPeriodicCheck() {
    console.log('[Translation] Starting periodic message check (every 3s)');

    setInterval(() => {
      if (this.core.config && this.core.config.global && this.core.config.global.autoTranslate) {
        const messages = document.querySelectorAll('.message-in, .message-out');
        let newCount = 0;

        messages.forEach(msg => {
          // Skip already translated or marked as skipped messages
          if (!msg.querySelector('.wa-translation-result') &&
            !msg.hasAttribute('data-translation-skipped')) {
            const textElement = msg.querySelector('.selectable-text');
            if (textElement && textElement.textContent.trim()) {
              this.handleNewMessage(msg);
              newCount++;
            }
          }
        });

        if (newCount > 0) {
          console.log(`[Translation] Found ${newCount} new messages to translate`);
        }
      }
    }, 3000);

    // Cleanup invisible translations every 30 seconds
    setInterval(() => {
      this.cleanupInvisibleTranslations();
    }, 30000);
  }

  /**
   * Cleanup invisible translations
   */
  cleanupInvisibleTranslations() {
    const translations = document.querySelectorAll('.wa-translation-result');
    let cleanedCount = 0;

    translations.forEach(translation => {
      const messageNode = translation.closest('.message-in, .message-out');
      if (messageNode) {
        const rect = messageNode.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;

        // If message is not in viewport, remove translation result
        if (!isVisible) {
          translation.remove();
          cleanedCount++;
        }
      }
    });

    if (cleanedCount > 0) {
      console.log(`[Translation] Cleaned up ${cleanedCount} invisible translations`);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MessageTranslator;
}
