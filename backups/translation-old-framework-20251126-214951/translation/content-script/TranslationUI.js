/**
 * TranslationUI - Handles all UI components for translation
 * Responsible for displaying translations, toasts, alerts, and previews
 */

class TranslationUI {
  constructor(core) {
    this.core = core;
  }

  /**
   * Display translation result
   */
  displayTranslation(messageNode, result) {
    // Check if translation result already exists
    const existing = messageNode.querySelector('.wa-translation-result');
    if (existing) {
      existing.remove();
    }

    // Create translation result element
    const translationDiv = document.createElement('div');
    translationDiv.className = 'wa-translation-result';

    const detectedLang = result.detectedLang || 'auto';
    const targetLang = this.core.config.global.targetLang;
    const engineName = result.engineName || this.core.config.global.engine;

    // Engine icon mapping
    const engineIcons = {
      'google': '🌐',
      'gpt4': '🤖',
      'gemini': '✨',
      'deepseek': '🧠',
      'custom': '⚙️'
    };
    const engineIcon = engineIcons[engineName] || '🌐';

    translationDiv.innerHTML = `
      <div class="translation-header">
        ${engineIcon} ${detectedLang} → ${targetLang}${result.cached ? ' 📦' : ''} [${engineName}]
      </div>
      <div class="translation-text"></div>
    `;

    // Use textContent to set text, avoid HTML entity encoding issues
    const textDiv = translationDiv.querySelector('.translation-text');

    // Decode HTML entities in browser
    const decodedText = this.core.decodeHTMLEntitiesInBrowser(result.translatedText);
    console.log('[ContentScript] Original text:', result.translatedText);
    console.log('[ContentScript] Decoded text:', decodedText);

    textDiv.textContent = decodedText;

    // Find message content container
    const messageContent = messageNode.querySelector('.copyable-text') ||
      messageNode.querySelector('[data-testid="msg-text"]') ||
      messageNode;

    // Insert translation result
    if (messageContent.parentNode) {
      messageContent.parentNode.appendChild(translationDiv);
    } else {
      messageNode.appendChild(translationDiv);
    }
  }

  /**
   * Display error message
   */
  displayError(messageNode, errorMessage) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'wa-translation-result wa-translation-error';
    errorDiv.innerHTML = `
      <div class="translation-header">
        <span class="translation-icon">⚠️</span>
        <span class="translation-lang">翻译失败</span>
      </div>
      <div class="translation-text">${this.core.escapeHtml(errorMessage)}</div>
    `;

    const messageContent = messageNode.querySelector('.copyable-text') ||
      messageNode.querySelector('[data-testid="msg-text"]') ||
      messageNode;

    if (messageContent.parentNode) {
      messageContent.parentNode.appendChild(errorDiv);
    }
  }

  /**
   * Show non-blocking toast message
   */
  showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'wa-toast wa-toast-' + type;
    toast.textContent = message;

    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      font-size: 14px;
      z-index: 10000000;
      animation: slideInRight 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      max-width: 300px;
    `;

    // Set background color based on type
    if (type === 'error') {
      toast.style.background = '#ef4444';
    } else if (type === 'warning') {
      toast.style.background = '#f59e0b';
    } else if (type === 'success') {
      toast.style.background = '#10b981';
    } else {
      toast.style.background = '#3b82f6';
    }

    document.body.appendChild(toast);

    // Auto remove after 2 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    }, 2000);
  }

  /**
   * Show Chinese block alert
   */
  showChineseBlockAlert() {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = 'wa-chinese-block-alert';
    alert.innerHTML = `
      <div class="alert-content">
        <span class="alert-icon">🚫</span>
        <div class="alert-text">
          <strong>检测到中文内容</strong>
          <p>已启用禁发中文功能，请先翻译后再发送</p>
        </div>
        <button class="alert-close">×</button>
      </div>
    `;

    alert.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000000;
      animation: slideInRight 0.3s ease;
      max-width: 350px;
    `;

    const content = alert.querySelector('.alert-content');
    content.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 12px;
    `;

    const icon = alert.querySelector('.alert-icon');
    icon.style.cssText = `
      font-size: 24px;
      flex-shrink: 0;
    `;

    const text = alert.querySelector('.alert-text');
    text.style.cssText = `
      flex: 1;
    `;

    const strong = alert.querySelector('strong');
    strong.style.cssText = `
      display: block;
      color: #856404;
      margin-bottom: 4px;
      font-size: 14px;
    `;

    const p = alert.querySelector('p');
    p.style.cssText = `
      margin: 0;
      color: #856404;
      font-size: 13px;
      line-height: 1.4;
    `;

    const closeBtn = alert.querySelector('.alert-close');
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      font-size: 24px;
      color: #856404;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `;

    closeBtn.onclick = () => {
      if (alert.parentNode) {
        alert.parentNode.removeChild(alert);
      }
    };

    document.body.appendChild(alert);

    // Auto remove after 3 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.parentNode.removeChild(alert);
      }
    }, 3000);
  }

  /**
   * Create realtime preview element
   */
  createRealtimePreview() {
    // Check if already exists
    if (document.querySelector('.wa-realtime-preview')) {
      return;
    }

    // Find input box container
    const footer = document.querySelector('#main footer') ||
      document.querySelector('[data-testid="conversation-compose-box"]') ||
      document.querySelector('footer');

    if (!footer) {
      console.warn('[Translation] Footer not found for realtime preview');
      return;
    }

    // Create preview element
    const preview = document.createElement('div');
    preview.className = 'wa-realtime-preview';
    preview.style.display = 'none';
    preview.innerHTML = `
      <div class="translation-header">
        <span class="translation-icon">⚡</span>
        <span class="translation-lang">实时翻译预览</span>
      </div>
      <div class="translation-text"></div>
    `;

    // Insert above input box
    footer.insertBefore(preview, footer.firstChild);

    console.log('[Translation] Realtime preview element created');
  }

  /**
   * Show realtime preview
   */
  showRealtimePreview(text, isLoading = false, isError = false) {
    const preview = document.querySelector('.wa-realtime-preview');
    if (!preview) {
      return;
    }

    const textDiv = preview.querySelector('.translation-text');

    if (isLoading) {
      textDiv.textContent = text;
      textDiv.className = 'translation-text translation-loading';
    } else if (isError) {
      textDiv.textContent = text;
      textDiv.className = 'translation-text translation-error';
    } else {
      const decodedText = this.core.decodeHTMLEntitiesInBrowser(text);
      textDiv.textContent = decodedText;
      textDiv.className = 'translation-text';
    }

    preview.style.display = 'block';
  }

  /**
   * Hide realtime preview
   */
  hideRealtimePreview() {
    const preview = document.querySelector('.wa-realtime-preview');
    if (preview) {
      preview.style.display = 'none';
    }
  }

  /**
   * Inject styles
   */
  injectStyles() {
    const style = document.createElement('style');
    style.id = 'wa-translation-styles';
    style.textContent = `
      /* Translation result styles */
      .wa-translation-result {
        margin-top: 8px;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 8px;
        font-size: 14px;
        line-height: 1.5;
        animation: fadeIn 0.3s ease-in;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .wa-translation-result.wa-translation-error {
        background: rgba(255, 0, 0, 0.1);
        border-left: 3px solid #ff4444;
      }

      .translation-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
        font-size: 12px;
        color: #667781;
        font-weight: 500;
      }

      .translation-icon {
        font-size: 14px;
      }

      .translation-text {
        color: #111b21;
        word-wrap: break-word;
        white-space: pre-wrap;
      }

      /* Translate button styles */
      .wa-translate-btn {
        padding: 8px;
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 20px;
        border-radius: 50%;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
      }

      .wa-translate-btn:hover {
        background: rgba(0, 0, 0, 0.05);
        transform: scale(1.1);
      }

      .wa-translate-btn:active {
        transform: scale(0.95);
      }

      .wa-translate-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Realtime translation preview */
      .wa-realtime-preview {
        padding: 12px;
        background: rgba(0, 150, 255, 0.1);
        border-left: 3px solid #0096ff;
        margin: 8px 0;
        border-radius: 8px;
        font-size: 14px;
      }

      .wa-realtime-preview .translation-header {
        color: #0096ff;
        margin-bottom: 8px;
      }

      .wa-realtime-preview .translation-loading {
        color: #667781;
        font-style: italic;
      }

      /* Input box reverse translation styles */
      .wa-input-reverse-translation {
        animation: slideDown 0.3s ease;
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes slideUp {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(-10px);
        }
      }

      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes fadeOut {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }

      /* Dark mode support */
      [data-theme="dark"] .wa-translation-result {
        background: rgba(255, 255, 255, 0.1);
      }

      [data-theme="dark"] .translation-text {
        color: #e9edef;
      }

      [data-theme="dark"] .translation-header {
        color: #8696a0;
      }

      [data-theme="dark"] .wa-translate-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      [data-theme="dark"] .wa-realtime-preview {
        background: rgba(0, 150, 255, 0.15);
      }

      [data-theme="dark"] .wa-translation-result.wa-translation-error {
        background: rgba(255, 68, 68, 0.15);
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .wa-translation-result {
          font-size: 13px;
          padding: 6px 10px;
        }

        .translation-header {
          font-size: 11px;
        }

        .wa-translate-btn {
          width: 36px;
          height: 36px;
          font-size: 18px;
        }
      }

      /* Print styles */
      @media print {
        .wa-translate-btn {
          display: none;
        }

        .wa-translation-result {
          background: #f5f5f5;
          border: 1px solid #ddd;
        }
      }
    `;

    document.head.appendChild(style);
    console.log('[Translation] Styles injected');
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    const styles = document.getElementById('wa-translation-styles');
    if (styles) {
      styles.remove();
    }
    console.log('[Translation] TranslationUI cleaned up');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslationUI;
}
