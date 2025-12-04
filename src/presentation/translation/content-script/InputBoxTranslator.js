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
    this.languageCache = {};
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
      if (retryCount < 10) {
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

    // Setup message sent observer
    this.setupMessageSentObserver(inputBox);

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

    // Always try to find the current input box (don't trust passed reference)
    // This is important after chat switches
    const inputBoxSelectors = [
      '#main footer [contenteditable="true"]',
      'footer [contenteditable="true"]',
      '[data-testid="conversation-compose-box-input"]',
      '#main footer div[contenteditable="true"]',
      'div[contenteditable="true"][data-tab="10"]',
      'div[contenteditable="true"][role="textbox"]'
    ];

    let foundInputBox = null;
    for (const selector of inputBoxSelectors) {
      const element = document.querySelector(selector);
      if (element && element.isContentEditable) {
        foundInputBox = element;
        console.log('[Translation] Found input box with selector:', selector);
        break;
      }
    }

    // Use the found input box, or fall back to passed parameter
    inputBox = foundInputBox || inputBox;

    if (!inputBox) {
      this.ui.showToast('找不到输入框', 'error');
      console.error('[Translation] Input box not found');
      this.isTranslating = false;
      return;
    }

    // Wait a bit to ensure the input box is fully rendered (especially after chat switch)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get text - handle multiple editor types
    let text = '';

    console.log('[Translation] Input box attributes:', {
      hasLexical: inputBox.hasAttribute('data-lexical-editor'),
      contentEditable: inputBox.isContentEditable,
      childCount: inputBox.children.length,
      innerHTML: inputBox.innerHTML.substring(0, 100)
    });

    // Method 1: Lexical editor (data-lexical-editor attribute)
    if (inputBox.hasAttribute('data-lexical-editor')) {
      console.log('[Translation] Using Lexical editor text extraction');

      // Try to get text from paragraph elements
      const paragraphs = inputBox.querySelectorAll('p');
      if (paragraphs.length > 0) {
        text = Array.from(paragraphs).map(p => p.textContent || '').join('\n');
        console.log('[Translation] Got text from paragraphs:', paragraphs.length);
      }

      // If no paragraphs, try span elements with data-text attribute
      if (!text) {
        const textSpans = inputBox.querySelectorAll('span[data-text="true"]');
        if (textSpans.length > 0) {
          text = Array.from(textSpans).map(span => span.textContent || '').join('');
          console.log('[Translation] Got text from data-text spans:', textSpans.length);
        }
      }

      // Try all span elements
      if (!text) {
        const allSpans = inputBox.querySelectorAll('span');
        if (allSpans.length > 0) {
          text = Array.from(allSpans).map(span => span.textContent || '').join('');
          console.log('[Translation] Got text from all spans:', allSpans.length);
        }
      }

      // Fallback to innerText/textContent
      if (!text) {
        text = inputBox.innerText || inputBox.textContent || '';
        console.log('[Translation] Got text from innerText/textContent');
      }
    }
    // Method 2: Regular contenteditable
    else {
      console.log('[Translation] Using regular contenteditable text extraction');

      // Try innerText first (preserves line breaks better)
      text = inputBox.innerText || '';

      // Fallback to textContent
      if (!text) {
        text = inputBox.textContent || '';
      }

      // Last resort: try to get from child elements
      if (!text) {
        const children = inputBox.querySelectorAll('p, div, span');
        if (children.length > 0) {
          text = Array.from(children).map(el => el.textContent || '').join('\n');
          console.log('[Translation] Got text from child elements:', children.length);
        }
      }
    }

    // Clean up the text
    text = text.trim();

    // Remove placeholder text if present
    const placeholder = inputBox.getAttribute('data-placeholder') ||
      inputBox.getAttribute('placeholder') ||
      '输入消息';
    if (text === placeholder) {
      console.log('[Translation] Removed placeholder text');
      text = '';
    }

    console.log('[Translation] Final extracted text:', text ? `"${text.substring(0, 100)}..." (length: ${text.length})` : '(empty)');

    if (!text || text.length === 0) {
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

      // The IPC handler returns the result directly (not wrapped in { success, data })
      // because ipcMain.handle returns response.data
      let translationResult;
      if (response) {
        if (response.success !== undefined) {
          // Wrapped response
          if (response.success) {
            translationResult = response.data;
          } else {
            console.error('[Translation] Translation failed:', response.error);
            this.ui.showToast('翻译失败: ' + response.error, 'error');
            return;
          }
        } else {
          // Direct result object
          translationResult = response;
        }

        // Decode HTML entities
        const translatedText = this.core.decodeHTMLEntitiesInBrowser(translationResult.translatedText);

        console.log('[Translation] Translation successful:', translatedText);

        // Set translated text to input box
        await this.setInputBoxText(inputBox, translatedText);
        console.log('[Translation] Text set to input box');

        // If reverse translation is enabled, show reverse translation verification
        if (this.core.config.advanced.reverseTranslation) {
          await this.showInputBoxReverseTranslation(text, translatedText, targetLang);
        }
      } else {
        console.error('[Translation] Empty translation response');
        this.ui.showToast('翻译失败: 空响应', 'error');
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
      // Check cache first
      const contactId = this.core.getCurrentContactId();
      if (contactId && this.languageCache[contactId]) {
        console.log('[Translation] Using cached language for contact:', contactId, this.languageCache[contactId]);
        return this.languageCache[contactId];
      }

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

          // Handle both wrapped and direct response formats
          let detectedLang;
          if (result) {
            if (result.success !== undefined) {
              // Wrapped response
              detectedLang = result.success && result.data ? result.data.language : null;
            } else if (result.language) {
              // Direct result object
              detectedLang = result.language;
            }
          }

          if (detectedLang) {
            console.log('[Translation] Detected language from message:', detectedLang, 'Text:', text.substring(0, 50));

            // If detected language is not Chinese, use this language
            if (!detectedLang.startsWith('zh')) {
              if (contactId) {
                this.languageCache[contactId] = detectedLang;
              }
              return detectedLang;
            }
          }
        }
      }

      // If other party also uses Chinese, default to English
      if (contactId) {
        this.languageCache[contactId] = 'en';
      }
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

      // Add container styles
      reverseDiv.style.cssText = `
        margin: 8px 12px;
        padding: 12px;
        background: rgba(156, 39, 176, 0.08);
        border-left: 3px solid #9c27b0;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.5;
      `;

      // Style the header
      const header = reverseDiv.querySelector('.reverse-header');
      header.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        flex-wrap: wrap;
      `;

      // Style the close button
      const closeBtn = reverseDiv.querySelector('.reverse-close');
      closeBtn.style.cssText = `
        margin-left: auto;
        background: transparent;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
        padding: 0 4px;
        line-height: 1;
      `;

      // Insert above input box
      footer.insertBefore(reverseDiv, footer.firstChild);

      // Bind close button
      closeBtn.onclick = () => {
        reverseDiv.remove();
      };

      // First detect original language
      let sourceLang = 'zh-CN'; // Default Chinese
      try {
        const detectResult = await window.translationAPI.detectLanguage(originalText);
        // Handle both wrapped and direct response formats
        if (detectResult) {
          if (detectResult.success !== undefined) {
            // Wrapped response
            if (detectResult.success && detectResult.data && detectResult.data.language) {
              sourceLang = detectResult.data.language;
            }
          } else if (detectResult.language) {
            // Direct result object
            sourceLang = detectResult.language;
          }
        }
        console.log('[Translation] Detected original language:', sourceLang);
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

      // Handle both wrapped and direct response formats
      let reverseResult;
      let reverseError = null;
      if (response) {
        if (response.success !== undefined) {
          // Wrapped response
          if (response.success) {
            reverseResult = response.data;
          } else {
            reverseError = response.error;
          }
        } else if (response.translatedText) {
          // Direct result object
          reverseResult = response;
        } else {
          reverseError = 'Unknown response format';
        }
      } else {
        reverseError = 'Empty response';
      }

      if (reverseResult) {
        const reverseText = reverseResult.translatedText;

        // Calculate similarity
        const similarity = this.core.calculateSimilarity(originalText, reverseText);
        const similarityPercent = Math.round(similarity * 100);
        const needsWarning = similarityPercent < 70;

        // Update header with similarity badge
        const headerDiv = reverseDiv.querySelector('.reverse-header');
        headerDiv.innerHTML = `
          <span class="reverse-icon">🔄</span>
          <span class="reverse-title">反向翻译验证</span>
          <span class="similarity-badge">相似度: ${similarityPercent}%</span>
          <button class="reverse-close" title="关闭">×</button>
        `;

        // Re-apply header styles
        headerDiv.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        `;

        // Style similarity badge
        const badge = headerDiv.querySelector('.similarity-badge');
        badge.style.cssText = `
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          background: ${needsWarning ? 'rgba(255, 152, 0, 0.2)' : 'rgba(76, 175, 80, 0.2)'};
          color: ${needsWarning ? '#e65100' : '#2e7d32'};
        `;

        // Style new close button
        const newCloseBtn = headerDiv.querySelector('.reverse-close');
        newCloseBtn.style.cssText = `
          margin-left: auto;
          background: transparent;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #666;
          padding: 0 4px;
          line-height: 1;
        `;
        newCloseBtn.onclick = () => {
          reverseDiv.remove();
        };

        // Update content
        const content = reverseDiv.querySelector('.reverse-content');
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

        // Style content items
        const items = content.querySelectorAll('.reverse-item');
        items.forEach(item => {
          item.style.cssText = `
            margin-bottom: 8px;
            padding: 8px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 6px;
          `;
        });

        // Style labels
        const labels = content.querySelectorAll('.reverse-label');
        labels.forEach(label => {
          label.style.cssText = `
            font-size: 11px;
            color: #666;
            margin-bottom: 4px;
            font-weight: 500;
          `;
        });

        // Style text containers
        const texts = content.querySelectorAll('.reverse-text');
        texts.forEach(text => {
          text.style.cssText = `
            color: #333;
            word-wrap: break-word;
            white-space: pre-wrap;
          `;
        });

        // Style warning if present
        const warning = content.querySelector('.reverse-warning');
        if (warning) {
          warning.style.cssText = `
            margin-top: 8px;
            padding: 8px;
            background: rgba(255, 152, 0, 0.1);
            border-radius: 6px;
            color: #e65100;
            font-size: 12px;
          `;
        }

        // Decode HTML entities in browser and use textContent to set
        const decodedTranslated = this.core.decodeHTMLEntitiesInBrowser(translatedText);
        const decodedReverse = this.core.decodeHTMLEntitiesInBrowser(reverseText);
        content.querySelector('[data-type="translated"]').textContent = decodedTranslated;
        content.querySelector('[data-type="reverse"]').textContent = decodedReverse;

      } else {
        const content = reverseDiv.querySelector('.reverse-content');
        content.innerHTML = `
          <div class="reverse-error">
            <span>⚠️</span>
            <span>反向翻译失败: ${reverseError}</span>
          </div>
        `;
        const errorDiv = content.querySelector('.reverse-error');
        errorDiv.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          color: #d32f2f;
          padding: 8px;
          background: rgba(211, 47, 47, 0.1);
          border-radius: 6px;
        `;
      }
    } catch (error) {
      console.error('[Translation] Input box reverse translation error:', error);
    }
  }

  /**
   * Setup message sent observer
   */
  setupMessageSentObserver(inputBox) {
    console.log('[Translation] Setting up message sent observer (Robust Version)');

    // Cleanup old observer if exists
    if (this.messageSentObserver) {
      if (this.messageSentObserver.disconnect) {
        this.messageSentObserver.disconnect();
      }
      this.messageSentObserver = null;
    }

    // Strategy 1: MutationObserver to detect when input box becomes empty
    // This is the most reliable way to detect "sent" because WhatsApp clears the input box
    const mutationObserver = new MutationObserver((mutations) => {
      const currentText = inputBox.textContent || inputBox.innerText || '';
      if (!currentText.trim()) {
        console.log('[Translation] Input box became empty (MutationObserver) - clearing UI');
        this.handleMessageSent();
      }
    });

    mutationObserver.observe(inputBox, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // Strategy 2: Listen for Enter key on input box (Capture phase)
    const enterKeyHandler = (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
        console.log('[Translation] Enter key detected (Capture phase)');
        // We don't clear immediately, we wait for the input to actually clear or a short timeout
        setTimeout(() => {
          this.handleMessageSent();
        }, 200);
      }
    };
    // Use capture phase to ensure we get the event before WhatsApp potentially stops propagation
    inputBox.addEventListener('keydown', enterKeyHandler, true);

    // Strategy 3: Listen for click on send button (Capture phase on footer)
    const footer = document.querySelector('#main footer') || document.querySelector('footer');

    const sendButtonHandler = (event) => {
      const target = event.target;
      // Look for the send button (usually has specific icons or attributes)
      // WhatsApp send button often contains a span with data-icon="send"
      const sendButton = target.closest('[data-testid="send"], [aria-label="Send"], span[data-icon="send"]');

      if (sendButton) {
        console.log('[Translation] Send button click detected (Capture phase)');
        setTimeout(() => {
          this.handleMessageSent();
        }, 200);
      }
    };

    if (footer) {
      footer.addEventListener('click', sendButtonHandler, true);
    }

    // Store cleanup function
    this.messageSentObserver = {
      disconnect: () => {
        mutationObserver.disconnect();
        inputBox.removeEventListener('keydown', enterKeyHandler, true);
        if (footer) {
          footer.removeEventListener('click', sendButtonHandler, true);
        }
      }
    };
  }

  /**
   * Handle message sent event
   */
  handleMessageSent() {
    console.log('[Translation] Handling message sent - clearing UI');

    // Clear realtime preview
    if (this.ui && this.ui.hideRealtimePreview) {
      this.ui.hideRealtimePreview();
    }

    // Remove reverse translation
    const reverseDiv = document.querySelector('.wa-input-reverse-translation');
    if (reverseDiv) {
      reverseDiv.remove();
    }

    // Reset state
    this.isTranslating = false;
  }

  /**
   * Setup realtime translation
   */
  setupRealtimeTranslation(inputBox) {
    console.log('[Translation] setupRealtimeTranslation called');

    // Check if realtime translation is enabled
    if (!this.core.config.advanced.realtime) {
      this.cleanupRealtimeTranslation();
      // Remove ALL preview elements when disabling
      const allPreviews = document.querySelectorAll('.wa-realtime-preview');
      allPreviews.forEach(p => p.remove());
      console.log('[Translation] Realtime translation disabled, removed all previews');
      return;
    }

    // Cleanup old listeners first
    this.cleanupRealtimeTranslation();

    console.log('[Translation] Setting up realtime translation');

    let debounceTimer = null;
    let lastText = '';

    // ALWAYS create new preview element (createRealtimePreview will remove old ones)
    this.ui.createRealtimePreview();
    console.log('[Translation] Preview element created');

    // Create input listener - DON'T capture inputBox in closure, always find it fresh
    this.realtimeInputHandler = () => {
      // Clear previous timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Always find the current input box (important after chat switch)
      const currentInputBox = document.querySelector('#main footer [contenteditable="true"]') ||
        document.querySelector('footer [contenteditable="true"]') ||
        document.querySelector('[data-testid="conversation-compose-box-input"]');

      if (!currentInputBox) {
        console.warn('[Translation] Realtime: Input box not found');
        return;
      }

      // Get current text
      let text = '';
      if (currentInputBox.hasAttribute('data-lexical-editor')) {
        const textNodes = currentInputBox.querySelectorAll('p, span[data-text="true"]');
        if (textNodes.length > 0) {
          text = Array.from(textNodes).map(node => node.textContent).join('\n');
        } else {
          text = currentInputBox.innerText || currentInputBox.textContent || '';
        }
      } else {
        text = currentInputBox.textContent || currentInputBox.innerText || '';
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
      this.ui.showRealtimePreview('翻译中...', true, false, text);

      // Execute translation after 200ms
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

          // Handle both wrapped and direct response formats
          if (response) {
            let translatedText;
            if (response.success !== undefined) {
              // Wrapped response
              if (response.success) {
                translatedText = response.data.translatedText;
              } else {
                this.ui.showRealtimePreview('翻译失败: ' + response.error, false, true, text);
                return;
              }
            } else if (response.translatedText) {
              // Direct result object
              translatedText = response.translatedText;
            }

            if (translatedText) {
              this.ui.showRealtimePreview(translatedText, false, false, text);
            } else {
              this.ui.showRealtimePreview('翻译失败: 无翻译结果', false, true, text);
            }
          } else {
            this.ui.showRealtimePreview('翻译失败: 空响应', false, true, text);
          }
        } catch (error) {
          console.error('[Translation] Realtime translation error:', error);
          this.ui.showRealtimePreview('翻译失败: ' + error.message, false, true, text);
        }
      }, 200);
    };

    // Add listener to the current input box
    // Always find the current input box, don't use the passed parameter
    const currentInputBox = document.querySelector('#main footer [contenteditable="true"]') ||
      document.querySelector('footer [contenteditable="true"]') ||
      document.querySelector('[data-testid="conversation-compose-box-input"]');

    if (currentInputBox) {
      currentInputBox.addEventListener('input', this.realtimeInputHandler);
      console.log('[Translation] Realtime translation listener added to input box');
    } else {
      console.warn('[Translation] Could not find input box to attach realtime listener');
    }

    this._realtimeInitialized = true;
  }

  /**
   * Cleanup realtime translation
   */
  cleanupRealtimeTranslation() {
    console.log('[Translation] Cleaning up realtime translation');

    // Remove old listener from ALL possible input boxes
    if (this.realtimeInputHandler) {
      // Find all input boxes in the document
      const allInputBoxes = document.querySelectorAll('[contenteditable="true"]');
      allInputBoxes.forEach(inputBox => {
        inputBox.removeEventListener('input', this.realtimeInputHandler);
      });

      console.log('[Translation] Removed realtime listener from all input boxes');
      this.realtimeInputHandler = null;
    }

    // DON'T remove preview element during cleanup
    // It will be recreated by setupRealtimeTranslation

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
