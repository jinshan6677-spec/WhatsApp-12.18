/**
 * InputBoxTranslator - Handles input box translation
 * Responsible for translating text before sending
 */

class InputBoxTranslator {
  constructor(core, ui) {
    this.core = core;
    this.ui = ui;
    this.isTranslating = false;
    this._realtimeInitialized = false;
    this._buttonMonitorInitialized = false;
    this.realtimeInputHandler = null;
    this.buttonMonitor = null;
    this.buttonCheckInterval = null;
    this.messageSentObserver = null;
  }

  /**
   * Initialize input box translation
   */
  initInputBoxTranslation(retryCount = 0) {
    // Remove old translate button if exists
    const oldButton = document.getElementById('wa-translate-btn');
    if (oldButton) {
      oldButton.remove();
    }

    // Find input box
    const inputBox = document.querySelector('#main footer [contenteditable="true"]') ||
      document.querySelector('footer [contenteditable="true"]') ||
      document.querySelector('[data-testid="conversation-compose-box-input"]') ||
      document.querySelector('[contenteditable="true"][data-tab="10"]') ||
      document.querySelector('div[contenteditable="true"][role="textbox"]');

    if (!inputBox) {
      if (retryCount < 5) {
        setTimeout(() => this.initInputBoxTranslation(retryCount + 1), 1000);
      }
      return;
    }

    // Add translate button
    if (this.core.config && this.core.config.inputBox && this.core.config.inputBox.enabled) {
      this.addTranslateButton(inputBox);
    } else {
      console.log('[Translation] Input box translation disabled in config');
    }

    // Setup realtime translation
    if (this.core.config && this.core.config.advanced && this.core.config.advanced.realtime) {
      this.setupRealtimeTranslation(inputBox);
    } else {
      this.cleanupRealtimeTranslation();
    }
  }

  /**
   * Add translate button
   */
  addTranslateButton(inputBox, retryCount = 0) {
    // Check if button already exists
    const existingButton = document.getElementById('wa-translate-btn');
    if (existingButton) {
      console.log('[Translation] Translate button already exists, skipping');
      return;
    }

    const button = document.createElement('button');
    button.id = 'wa-translate-btn';
    button.className = 'wa-translate-btn';
    button.innerHTML = '🌐';
    button.title = '翻译';
    button.type = 'button';

    button.onclick = async () => {
      if (button.disabled) {
        console.log('[Translation] Button already disabled, skipping');
        return;
      }

      button.disabled = true;
      button.innerHTML = '⏳';
      console.log('[Translation] Button clicked, starting translation');

      try {
        await this.translateInputBox(inputBox);
      } catch (error) {
        console.error('[Translation] Translation error:', error);
      } finally {
        button.disabled = false;
        button.innerHTML = '🌐';
        console.log('[Translation] Button re-enabled');
      }
    };

    // Add button styles - fixed position
    button.style.cssText = `
      position: fixed;
      bottom: 100px;
      right: 20px;
      padding: 8px;
      background: rgba(102, 126, 234, 0.95);
      border: none;
      cursor: pointer;
      font-size: 22px;
      border-radius: 50%;
      transition: all 0.2s;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    button.onmouseenter = () => {
      button.style.background = 'rgba(102, 126, 234, 1)';
      button.style.transform = 'scale(1.15)';
      button.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
    };

    button.onmouseleave = () => {
      button.style.background = 'rgba(102, 126, 234, 0.95)';
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
    };

    // Add to body (fixed positioning, doesn't depend on footer)
    document.body.appendChild(button);

    console.log('[Translation] Translate button added (floating position)');
  }

  /**
   * Translate input box
   */
  async translateInputBox(inputBox) {
    // Prevent duplicate translation
    if (this.isTranslating) {
      console.log('[Translation] Already translating, skipping');
      return;
    }

    this.isTranslating = true;

    // If inputBox not passed, try to find it
    if (!inputBox) {
      inputBox = document.querySelector('footer [contenteditable="true"]') ||
        document.querySelector('[data-testid="conversation-compose-box-input"]') ||
        document.querySelector('#main footer div[contenteditable="true"]');
    }

    if (!inputBox) {
      this.ui.showToast('找不到输入框', 'error');
      console.error('[Translation] Input box not found');
      this.isTranslating = false;
      return;
    }

    // Get text - handle Lexical editor
    let text = '';

    if (inputBox.hasAttribute('data-lexical-editor')) {
      const textNodes = inputBox.querySelectorAll('p, span[data-text="true"]');
      if (textNodes.length > 0) {
        text = Array.from(textNodes).map(node => node.textContent).join('\n');
      } else {
        text = inputBox.innerText || inputBox.textContent || '';
      }
    } else {
      text = inputBox.textContent || inputBox.innerText || '';
    }

    text = text.trim();

    if (!text) {
      this.ui.showToast('请输入要翻译的内容', 'warning');
      this.isTranslating = false;
      return;
    }

    console.log('[Translation] Translating input box text:', text);

    try {
      const button = document.getElementById('wa-translate-btn');
      if (button) {
        button.innerHTML = '⏳';
        button.disabled = true;
      }

      // Get current contact ID
      const contactId = this.core.getCurrentContactId();
      console.log('[Translation] Input box translation for contact:', contactId);

      // Get target language
      const langSelector = document.getElementById('wa-lang-selector');
      let targetLang = langSelector ? langSelector.value : null;

      // If language selector not selected or set to auto
      if (!targetLang || targetLang === 'auto') {
        if (this.core.config.advanced.friendIndependent &&
          contactId &&
          this.core.config.friendConfigs &&
          this.core.config.friendConfigs[contactId] &&
          this.core.config.friendConfigs[contactId].enabled) {
          targetLang = this.core.config.friendConfigs[contactId].targetLang || this.core.config.inputBox.targetLang || 'auto';
          console.log('[Translation] Using friend-specific targetLang:', targetLang);
        } else {
          targetLang = this.core.config.inputBox.targetLang || 'auto';
          console.log('[Translation] Using inputBox targetLang:', targetLang);
        }
      }

      // If set to auto detect, detect the language used by the other party
      if (targetLang === 'auto') {
        targetLang = await this.detectChatLanguage();
        console.log('[Translation] Auto-detected chat language:', targetLang);
      }

      // If still can't detect, default to English
      if (!targetLang || targetLang === 'auto') {
        targetLang = 'en';
      }

      console.log('[Translation] Final target language:', targetLang);

      // Input box translation uses independent engine config and style parameter
      const inputBoxEngine = this.core.config.inputBox.engine || this.core.config.global.engine;
      const inputBoxStyle = this.core.config.inputBox.style || '通用';
      console.log(`[Translation] 🎨 Input box translation, using engine: ${inputBoxEngine}, style: ${inputBoxStyle}`);

      const response = await window.translationAPI.translate({
        accountId: this.core.accountId,
        text: text,
        sourceLang: 'auto',
        targetLang: targetLang,
        engineName: inputBoxEngine,
        options: {
          style: inputBoxStyle // Input box translation uses style parameter
        }
      });

      if (response.success) {
        // Decode HTML entities
        const translatedText = this.core.decodeHTMLEntitiesInBrowser(response.data.translatedText);

        console.log('[Translation] Translation successful:', translatedText);

        // Set translated text to input box
        await this.setInputBoxText(inputBox, translatedText);
        console.log('[Translation] Text set to input box');

        // If reverse translation is enabled, show reverse translation verification
        if (this.core.config.advanced.reverseTranslation) {
          await this.showInputBoxReverseTranslation(text, translatedText, targetLang);
        }
      } else {
        console.error('[Translation] Translation failed:', response.error);
        this.ui.showToast('翻译失败: ' + response.error, 'error');
      }

    } catch (error) {
      console.error('[Translation] Input box translation error:', error);
      this.ui.showToast('翻译失败: ' + error.message, 'error');
    } finally {
      this.isTranslating = false;
    }
  }

  /**
   * Detect chat language
   */
  async detectChatLanguage() {
    try {
      // Get recent incoming messages
      const incomingMessages = document.querySelectorAll('.message-in');

      if (incomingMessages.length === 0) {
        console.log('[Translation] No incoming messages found');
        return 'en'; // Default to English
      }

      // Detect from latest messages
      for (let i = incomingMessages.length - 1; i >= Math.max(0, incomingMessages.length - 5); i--) {
        const msg = incomingMessages[i];
        const textElement = msg.querySelector('.selectable-text');

        if (textElement && textElement.textContent.trim()) {
          const text = textElement.textContent.trim();

          // Call language detection API
          const result = await window.translationAPI.detectLanguage(text);

          if (result.success && result.data.language) {
            const detectedLang = result.data.language;
            console.log('[Translation] Detected language from message:', detectedLang, 'Text:', text.substring(0, 50));

            // If detected language is not Chinese, use this language
            if (!detectedLang.startsWith('zh')) {
              return detectedLang;
            }
          }
        }
      }

      // If other party also uses Chinese, default to English
      return 'en';

    } catch (error) {
      console.error('[Translation] Error detecting chat language:', error);
      return 'en';
    }
  }

  /**
   * Set input box text
   */
  async setInputBoxText(inputBox, text) {
    console.log('[Translation] Setting input box text:', text);

    // Focus input box
    inputBox.focus();

    // Wait to ensure focus
    await new Promise(resolve => setTimeout(resolve, 100));

    // Select all content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(inputBox);
    selection.removeAllRanges();
    selection.addRange(range);

    console.log('[Translation] Content selected');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simulate keyboard input to replace content
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', text);

    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    });

    inputBox.dispatchEvent(pasteEvent);

    console.log('[Translation] Paste event dispatched');

    // If paste event was blocked, use fallback method
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if successful
    const currentText = inputBox.textContent || inputBox.innerText || '';
    if (!currentText.includes(text)) {
      console.log('[Translation] Paste failed, using fallback method');

      // Fallback method: input character by character
      inputBox.textContent = '';

      for (let char of text) {
        const keyEvent = new KeyboardEvent('keydown', {
          key: char,
          bubbles: true,
          cancelable: true
        });
        inputBox.dispatchEvent(keyEvent);

        document.execCommand('insertText', false, char);

        const inputEvent = new InputEvent('input', {
          bubbles: true,
          data: char,
          inputType: 'insertText'
        });
        inputBox.dispatchEvent(inputEvent);
      }

      console.log('[Translation] Text inserted character by character');
    } else {
      console.log('[Translation] Text successfully pasted');
    }
  }

  /**
   * Show input box reverse translation
   */
  async showInputBoxReverseTranslation(originalText, translatedText, targetLang) {
    try {
      // Remove old reverse translation display
      const oldReverse = document.querySelector('.wa-input-reverse-translation');
      if (oldReverse) {
        oldReverse.remove();
      }

      // Find input box container
      const footer = document.querySelector('#main footer') ||
        document.querySelector('[data-testid="conversation-compose-box"]') ||
        document.querySelector('footer');

      if (!footer) {
        console.warn('[Translation] Footer not found for reverse translation');
        return;
      }

      // Create reverse translation container
      const reverseDiv = document.createElement('div');
      reverseDiv.className = 'wa-input-reverse-translation';
      reverseDiv.innerHTML = `
        <div class="reverse-header">
          <span class="reverse-icon">🔄</span>
          <span class="reverse-title">反向翻译验证中...</span>
          <button class="reverse-close" title="关闭">×</button>
        </div>
        <div class="reverse-content"></div>
      `;

      // Add styles
      reverseDiv.style.cssText = `
        margin: 8px 12px;
        padding: 12px;
        background: rgba(156, 39, 176, 0.05);
        border-left: 3px solid #9c27b0;
        border-radius: 8px;
        font-size: 13px;
      `;

      // Insert above input box
      footer.insertBefore(reverseDiv, footer.firstChild);

      // Bind close button
      const closeBtn = reverseDiv.querySelector('.reverse-close');
      closeBtn.onclick = () => {
        reverseDiv.remove();
      };

      // First detect original language
      let sourceLang = 'zh-CN'; // Default Chinese
      try {
        const detectResult = await window.translationAPI.detectLanguage(originalText);
        if (detectResult.success && detectResult.data.language) {
          sourceLang = detectResult.data.language;
          console.log('[Translation] Detected original language:', sourceLang);
        }
      } catch (error) {
        console.warn('[Translation] Language detection failed, using default zh-CN:', error);
      }

      // Perform reverse translation - translate back to original language
      const inputBoxEngine = this.core.config.inputBox.engine || this.core.config.global.engine;
      const response = await window.translationAPI.translate({
        accountId: this.core.accountId,
        text: translatedText,
        sourceLang: targetLang,
        targetLang: sourceLang,
        engineName: inputBoxEngine,
        options: {} // Reverse translation doesn't use style
      });

      if (response.success) {
        const reverseText = response.data.translatedText;

        // Calculate similarity
        const similarity = this.core.calculateSimilarity(originalText, reverseText);
        const similarityPercent = Math.round(similarity * 100);
        const needsWarning = similarityPercent < 70;

        // Update display
        const header = reverseDiv.querySelector('.reverse-header');
        const content = reverseDiv.querySelector('.reverse-content');

        header.innerHTML = `
          <span class="reverse-icon">🔄</span>
          <span class="reverse-title">反向翻译验证</span>
          <span class="similarity-badge ${needsWarning ? 'warning' : 'good'}">
            相似度: ${similarityPercent}%
          </span>
          <button class="reverse-close" title="关闭">×</button>
        `;

        content.innerHTML = `
          <div class="reverse-item">
            <div class="reverse-label">实时翻译</div>
            <div class="reverse-text" data-type="translated"></div>
          </div>
          <div class="reverse-item">
            <div class="reverse-label">反向结果</div>
            <div class="reverse-text" data-type="reverse"></div>
          </div>
          ${needsWarning ? '<div class="reverse-warning">⚠️ 相似度较低，翻译可能不够准确</div>' : ''}
        `;

        // Decode HTML entities in browser and use textContent to set
        const decodedTranslated = this.core.decodeHTMLEntitiesInBrowser(translatedText);
        const decodedReverse = this.core.decodeHTMLEntitiesInBrowser(reverseText);
        content.querySelector('[data-type="translated"]').textContent = decodedTranslated;
        content.querySelector('[data-type="reverse"]').textContent = decodedReverse;

        // Re-bind close button
        const newCloseBtn = reverseDiv.querySelector('.reverse-close');
        newCloseBtn.onclick = () => {
          reverseDiv.remove();
        };
      } else {
        const content = reverseDiv.querySelector('.reverse-content');
        content.innerHTML = `
          <div class="reverse-error">
            <span>⚠️</span>
            <span>反向翻译失败: ${response.error}</span>
          </div>
        `;
      }
    } catch (error) {
      console.error('[Translation] Input box reverse translation error:', error);
    }
  }

  /**
   * Setup realtime translation
   */
  setupRealtimeTranslation(inputBox) {
    // Check if realtime translation is enabled
    if (!this.core.config.advanced.realtime) {
      this.cleanupRealtimeTranslation();
      console.log('[Translation] Realtime translation disabled');
      return;
    }

    // Cleanup old listeners
    this.cleanupRealtimeTranslation();

    console.log('[Translation] Setting up realtime translation');

    let debounceTimer = null;
    let lastText = '';

    // Create preview element
    this.ui.createRealtimePreview();

    // Create input listener
    this.realtimeInputHandler = () => {
      // Clear previous timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Get current text
      let text = '';
      if (inputBox.hasAttribute('data-lexical-editor')) {
        const textNodes = inputBox.querySelectorAll('p, span[data-text="true"]');
        if (textNodes.length > 0) {
          text = Array.from(textNodes).map(node => node.textContent).join('\n');
        } else {
          text = inputBox.innerText || inputBox.textContent || '';
        }
      } else {
        text = inputBox.textContent || inputBox.innerText || '';
      }

      text = text.trim();

      // If text is empty, hide preview
      if (!text) {
        this.ui.hideRealtimePreview();
        lastText = '';
        return;
      }

      // If text hasn't changed, don't translate
      if (text === lastText) {
        return;
      }

      lastText = text;

      // Show loading state
      this.ui.showRealtimePreview('翻译中...', true);

      // Execute translation after 500ms
      debounceTimer = setTimeout(async () => {
        try {
          const contactId = this.core.getCurrentContactId();
          const langSelector = document.getElementById('wa-lang-selector');
          let targetLang = langSelector ? langSelector.value : null;

          if (!targetLang || targetLang === 'auto') {
            if (this.core.config.advanced.friendIndependent &&
              contactId &&
              this.core.config.friendConfigs &&
              this.core.config.friendConfigs[contactId] &&
              this.core.config.friendConfigs[contactId].enabled) {
              targetLang = this.core.config.friendConfigs[contactId].targetLang || this.core.config.inputBox.targetLang || 'auto';
            } else {
              targetLang = this.core.config.inputBox.targetLang || 'auto';
            }
          }

          if (targetLang === 'auto') {
            targetLang = await this.detectChatLanguage();
          }

          if (!targetLang || targetLang === 'auto') {
            targetLang = 'en';
          }

          const inputBoxEngine = this.core.config.inputBox.engine || this.core.config.global.engine;
          const inputBoxStyle = this.core.config.inputBox.style || '通用';

          const response = await window.translationAPI.translate({
            accountId: this.core.accountId,
            text: text,
            sourceLang: 'auto',
            targetLang: targetLang,
            engineName: inputBoxEngine,
            options: {
              style: inputBoxStyle
            }
          });

          if (response.success) {
            this.ui.showRealtimePreview(response.data.translatedText, false);
          } else {
            this.ui.showRealtimePreview('翻译失败: ' + response.error, false, true);
          }
        } catch (error) {
          console.error('[Translation] Realtime translation error:', error);
          this.ui.showRealtimePreview('翻译失败: ' + error.message, false, true);
        }
      }, 500);
    };

    // Add listener
    inputBox.addEventListener('input', this.realtimeInputHandler);

    this._realtimeInitialized = true;
  }

  /**
   * Cleanup realtime translation
   */
  cleanupRealtimeTranslation() {
    // Remove old listener
    if (this.realtimeInputHandler) {
      const inputBox = document.querySelector('#main footer [contenteditable="true"]') ||
        document.querySelector('footer [contenteditable="true"]');
      if (inputBox) {
        inputBox.removeEventListener('input', this.realtimeInputHandler);
      }
      this.realtimeInputHandler = null;
    }

    // Only remove preview element when disabling realtime translation
    if (!this.core.config || !this.core.config.advanced || !this.core.config.advanced.realtime) {
      const preview = document.querySelector('.wa-realtime-preview');
      if (preview) {
        preview.remove();
      }
    }

    this._realtimeInitialized = false;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.cleanupRealtimeTranslation();

    if (this.buttonMonitor) {
      this.buttonMonitor.disconnect();
      this.buttonMonitor = null;
    }

    if (this.buttonCheckInterval) {
      clearInterval(this.buttonCheckInterval);
      this.buttonCheckInterval = null;
    }

    if (this.messageSentObserver) {
      this.messageSentObserver.disconnect();
      this.messageSentObserver = null;
    }

    const button = document.getElementById('wa-translate-btn');
    if (button) {
      button.remove();
    }

    this._buttonMonitorInitialized = false;
    console.log('[Translation] InputBoxTranslator cleaned up');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InputBoxTranslator;
}
