/**
 * TranslationUI - Handles all UI components for translation
 * Responsible for displaying translations, toasts, alerts, and previews
 */

class TranslationUI {
  constructor(core) {
    this.core = core;
    this._copyHandlersAttached = false;
    this.attachCopyHandlers();
  }

  /**
   * Display translation result
   */
  displayTranslation(messageNode, result) {
    const existing = messageNode.querySelector('.wa-translation-result');
    if (existing) {
      existing.remove();
    }

    const translationDiv = document.createElement('div');
    translationDiv.className = 'wa-translation-result';

    const detectedLang = result.detectedLang || 'auto';
    const targetLang = this.core.config.global.targetLang;
    const engineName = result.engineName || this.core.config.global.engine;

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

    const textDiv = translationDiv.querySelector('.translation-text');
    const decodedText = this.core.decodeHTMLEntitiesInBrowser(result.translatedText);
    textDiv.textContent = decodedText;

    const messageContent = messageNode.querySelector('.copyable-text') ||
      messageNode.querySelector('[data-testid="msg-text"]') ||
      messageNode;

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
    console.log('[Translation] Creating realtime preview element');

    // ALWAYS remove ALL existing preview elements first
    const allPreviews = document.querySelectorAll('.wa-realtime-preview');
    allPreviews.forEach(preview => {
      console.log('[Translation] Removing existing preview element');
      preview.remove();
    });

    // Find the CURRENT active input box container
    // Use multiple strategies to find the correct footer
    let footer = null;

    // Strategy 1: Find footer that contains an active input box
    const footers = document.querySelectorAll('footer, [data-testid="conversation-compose-box"]');
    for (const f of footers) {
      const inputBox = f.querySelector('[contenteditable="true"]');
      if (inputBox && inputBox.isContentEditable) {
        footer = f;
        console.log('[Translation] Found footer with active input box');
        break;
      }
    }

    // Strategy 2: Fallback to standard selectors
    if (!footer) {
      footer = document.querySelector('#main footer') ||
        document.querySelector('[data-testid="conversation-compose-box"]') ||
        document.querySelector('footer');
    }

    if (!footer) {
      const preview = document.createElement('div');
      preview.className = 'wa-realtime-preview';
      preview.style.cssText = `
        position: fixed;
        left: 20px;
        right: 20px;
        bottom: 80px;
        z-index: 10000000;
        display: none;
      `;
      preview.innerHTML = `
        <div class="translation-header">
          <span class="translation-icon">⚡</span>
          <span class="translation-lang">实时翻译预览</span>
        </div>
        <div class="translation-content-wrapper">
          <div class="translation-panel original-panel" style="display: none;">
              <div class="translation-text original-text"></div>
          </div>
          <div class="translation-panel result-panel">
              <div class="translation-text result-text"></div>
          </div>
        </div>
      `;
      document.body.appendChild(preview);
      return;
    }

    // Create NEW preview element
    const preview = document.createElement('div');
    preview.className = 'wa-realtime-preview';
    preview.style.display = 'none';
    
    // New structure for dynamic layout - Compact Mode
    preview.innerHTML = `
      <div class="translation-header">
        <span class="translation-icon">⚡</span>
        <span class="translation-lang">实时翻译预览</span>
      </div>
      <div class="translation-content-wrapper">
        <div class="translation-panel original-panel" style="display: none;">
            <div class="translation-text original-text"></div>
        </div>
        <div class="translation-panel result-panel">
            <div class="translation-text result-text"></div>
        </div>
      </div>
    `;

    // Insert above input box
    footer.insertBefore(preview, footer.firstChild);

    console.log('[Translation] Realtime preview element created and inserted into footer');
  }

  /**
   * Show realtime preview
   * Optimized for speech translation with dynamic layout
   * @param {string} text - The translated text or status message
   * @param {boolean} isLoading - Whether it is loading
   * @param {boolean} isError - Whether it is an error
   * @param {string} originalText - The original text (optional)
   */
  showRealtimePreview(text, isLoading = false, isError = false, originalText = null) {
    let preview = document.querySelector('.wa-realtime-preview');

    // If preview doesn't exist, try to recreate it
    if (!preview) {
      console.log('[Translation] Preview not found, recreating...');
      this.createRealtimePreview();
      preview = document.querySelector('.wa-realtime-preview');
    }

    if (!preview) {
      console.warn('[Translation] Could not create or find realtime preview element');
      return;
    }

    const resultTextDiv = preview.querySelector('.result-text');
    const originalPanel = preview.querySelector('.original-panel');
    const originalTextDiv = preview.querySelector('.original-text');
    
    if (!resultTextDiv) {
      console.warn('[Translation] Result text div not found in preview');
      return;
    }

    // Handle Original Text Display
    if (originalText && originalText.trim().length > 0) {
        originalPanel.style.display = 'flex';
        originalTextDiv.textContent = originalText;
    } else {
        originalPanel.style.display = 'none';
    }

    // Handle Translated Text Display
    if (isLoading) {
      resultTextDiv.textContent = text;
      resultTextDiv.className = 'translation-text result-text translation-loading';
    } else if (isError) {
      resultTextDiv.textContent = text;
      resultTextDiv.className = 'translation-text result-text translation-error';
    } else {
      const decodedText = this.core.decodeHTMLEntitiesInBrowser(text);
      resultTextDiv.textContent = decodedText;
      resultTextDiv.className = 'translation-text result-text';
    }

      // Apply Dynamic Layout Optimization
      this.optimizeLayout(preview, originalText, text);
    
      preview.style.display = 'block';
      // console.log('[Translation] Realtime preview shown');
    }
  
    /**
     * Optimize layout based on text analysis
     */
    optimizeLayout(previewElement, originalText, translatedText) {
        if (!originalText || !translatedText) return;
  
        const originalLen = originalText.length;
        const translatedLen = translatedText.length;
        const totalLen = originalLen + translatedLen;
        const isVoiceResult = previewElement.classList.contains('wa-voice-result');
        
        // 1. Text Length Analysis
        const isLongText = totalLen > 100;
        const isVeryLongText = totalLen > 300;
        
        // 2. Complexity Assessment
        const originalLines = originalText.split('\n').length;
        const hasLineBreaks = originalLines > 1;
  
        const wrapper = previewElement.querySelector('.translation-content-wrapper');
        const originalPanel = previewElement.querySelector('.original-panel');
        const resultPanel = previewElement.querySelector('.result-panel');
  
        // Reset basic styles
        wrapper.style.flexDirection = 'column';
        originalPanel.style.flex = '1';
        resultPanel.style.flex = '1';
        
        // 3. Responsive & Dynamic Layout Strategy
        if (isVeryLongText) {
            // For very long text, limit max height and allow scroll
            wrapper.style.maxHeight = '250px';
            wrapper.style.overflowY = 'auto';
        } else {
            wrapper.style.maxHeight = 'none';
            wrapper.style.overflowY = 'visible';
        }
  
        // 5. Visual Weight Allocation
        const baseFontSize = isVoiceResult ? '12px' : '13px';
        const smallFontSize = isVoiceResult ? '11px' : '12px';

        if (isLongText) {
            // Make result slightly more prominent
            resultPanel.style.flex = '1.2';
            originalPanel.style.opacity = '0.7'; // Dim original more
            
            // Dynamic font sizing for better fit
            if (totalLen > 200) {
                previewElement.style.fontSize = smallFontSize;
            } else {
                previewElement.style.fontSize = baseFontSize;
            }
        } else {
            originalPanel.style.opacity = '0.6';
            previewElement.style.fontSize = baseFontSize;
        }
  
        // 4. Smart Line Breaking / Spacing - Compact
        const gapSize = isVoiceResult ? (hasLineBreaks ? '4px' : '2px') : (hasLineBreaks ? '6px' : '4px');
        wrapper.style.gap = gapSize;
    }

    attachCopyHandlers() {
      if (this._copyHandlersAttached) return;
      const isTranslationContainer = (el) => {
        if (!el) return false;
        return (
          el.closest('.wa-realtime-preview') ||
          el.closest('.wa-translation-result') ||
          el.closest('.wa-voice-result-container')
        );
      };
      const resolveTargetTextEl = (target) => {
        if (!target) return null;
        return target.closest('.original-text, .result-text, .translation-text, .wa-voice-original-text, .wa-voice-translated-text');
      };
      const getSelectionTextIfInside = (container) => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return '';
        const range = sel.getRangeAt(0);
        const ancestor = range.commonAncestorContainer.nodeType === 1
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;
        if (ancestor && container.contains(ancestor)) {
          return sel.toString();
        }
        return '';
      };
      const copyText = async (text) => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
          }
        } catch (_) {}
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.top = '-1000px';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          return ok;
        } catch (_) {
          return false;
        }
      };
      document.addEventListener('click', async (e) => {
        if (!e.ctrlKey) return;
        const targetEl = resolveTargetTextEl(e.target);
        if (!targetEl) return;
        if (!isTranslationContainer(targetEl)) return;
        const selected = getSelectionTextIfInside(targetEl).trim();
        const text = selected || (targetEl.textContent || '').trim();
        if (!text) return;
        e.preventDefault();
        e.stopPropagation();
        const ok = await copyText(text);
        if (ok) {
          const isOriginal = targetEl.classList.contains('original-text') || targetEl.classList.contains('wa-voice-original-text');
          const isTranslated = targetEl.classList.contains('result-text') || targetEl.classList.contains('wa-voice-translated-text') || targetEl.classList.contains('translation-text');
          const msg = isOriginal ? '已复制原文' : (isTranslated ? '已复制译文' : '已复制');
          this.showToast(msg, 'success');
        } else {
          this.showToast('复制失败', 'error');
        }
      }, true);
      this._copyHandlersAttached = true;
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
        margin-top: 6px;
        padding: 6px 10px;
        background: rgba(0, 0, 0, 0.04);
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.4;
        animation: fadeIn 0.3s ease-in;
      }

      .wa-translation-result.wa-voice-result {
        margin-top: 0;
        padding: 2px 0;
        background: transparent;
        border: none;
      }
      
      .wa-translation-result.wa-voice-result .translation-header {
        display: none;
      }

      .wa-translation-result.wa-voice-result .translation-text {
        font-size: 12px;
      }

      .wa-voice-original {
        opacity: 0.6;
        font-size: 0.85em;
        margin-bottom: 2px;
        line-height: 1.2;
      }
      
      .wa-voice-separator {
        border-top: 1px solid rgba(0, 0, 0, 0.06);
        margin: 2px 0;
        width: 100%;
      }
      
      .wa-voice-translated {
        line-height: 1.3;
        font-weight: 400;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-3px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .wa-translation-result.wa-translation-error {
        background: rgba(255, 0, 0, 0.08);
        border-left: 2px solid #ff4444;
      }

      .translation-header {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 2px;
        font-size: 11px;
        color: #667781;
        font-weight: 500;
      }

      .translation-icon {
        font-size: 12px;
      }

      .translation-text {
        color: inherit;
        word-wrap: break-word;
        white-space: pre-wrap;
      }

      /* Translate button styles */
      .wa-translate-btn {
        padding: 6px;
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 18px;
        border-radius: 50%;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
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
        padding: 8px 10px;
        background: rgba(0, 150, 255, 0.08);
        border-left: 2px solid #0096ff;
        margin: 4px 0;
        border-radius: 6px;
        font-size: 13px;
      }

      .wa-realtime-preview .translation-header {
        color: #0096ff;
        margin-bottom: 4px;
        font-size: 11px;
      }

      .wa-realtime-preview .translation-loading {
        color: #667781;
        font-style: italic;
      }

      /* Realtime translation preview dynamic layout */
      .translation-content-wrapper {
        display: flex;
        flex-direction: column;
        gap: 4px;
        transition: all 0.2s ease;
      }

      .translation-panel {
        display: flex;
        flex-direction: column;
        gap: 0;
        transition: all 0.2s ease;
      }

      .translation-panel.original-panel {
        border-left: 2px solid rgba(0, 0, 0, 0.08);
        padding-left: 6px;
        margin-bottom: 2px;
      }

      .translation-panel.result-panel {
        /* Result panel stands out more */
      }

      [data-theme="dark"] .translation-panel.original-panel {
        border-left-color: rgba(255, 255, 255, 0.08);
      }


      /* Input box reverse translation styles */
      .wa-input-reverse-translation {
        animation: slideDown 0.3s ease;
        margin: 8px 12px;
        padding: 12px;
        background: rgba(156, 39, 176, 0.08);
        border-left: 3px solid #9c27b0;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.5;
      }

      .wa-input-reverse-translation .reverse-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }

      .wa-input-reverse-translation .reverse-title {
        font-weight: 500;
        color: #9c27b0;
      }

      .wa-input-reverse-translation .reverse-close {
        margin-left: auto;
        background: transparent;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
        padding: 0 4px;
        line-height: 1;
      }

      .wa-input-reverse-translation .reverse-close:hover {
        color: #333;
      }

      .wa-input-reverse-translation .similarity-badge {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
      }

      .wa-input-reverse-translation .similarity-badge.good {
        background: rgba(76, 175, 80, 0.2);
        color: #2e7d32;
      }

      .wa-input-reverse-translation .similarity-badge.warning {
        background: rgba(255, 152, 0, 0.2);
        color: #e65100;
      }

      .wa-input-reverse-translation .reverse-item {
        margin-bottom: 8px;
        padding: 8px;
        background: rgba(255, 255, 255, 0.5);
        border-radius: 6px;
      }

      .wa-input-reverse-translation .reverse-label {
        font-size: 11px;
        color: #666;
        margin-bottom: 4px;
        font-weight: 500;
      }

      .wa-input-reverse-translation .reverse-text {
        color: #333;
        word-wrap: break-word;
        white-space: pre-wrap;
      }

      .wa-input-reverse-translation .reverse-warning {
        margin-top: 8px;
        padding: 8px;
        background: rgba(255, 152, 0, 0.1);
        border-radius: 6px;
        color: #e65100;
        font-size: 12px;
      }

      .wa-input-reverse-translation .reverse-error {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #d32f2f;
        padding: 8px;
        background: rgba(211, 47, 47, 0.1);
        border-radius: 6px;
      }

      /* Dark mode support for reverse translation */
      [data-theme="dark"] .wa-input-reverse-translation {
        background: rgba(156, 39, 176, 0.15);
      }

      [data-theme="dark"] .wa-input-reverse-translation .reverse-item {
        background: rgba(255, 255, 255, 0.1);
      }

      [data-theme="dark"] .wa-input-reverse-translation .reverse-text {
        color: #e9edef;
      }

      [data-theme="dark"] .wa-input-reverse-translation .reverse-label {
        color: #8696a0;
      }

      [data-theme="dark"] .wa-input-reverse-translation .reverse-close {
        color: #8696a0;
      }

      [data-theme="dark"] .wa-input-reverse-translation .reverse-close:hover {
        color: #e9edef;
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

      /* Voice Translation Button - Full Width Style */
      .wa-voice-translate-block {
        display: flex;
        flex-direction: column;
        width: 100%;
        margin-top: 6px;
        cursor: pointer;
      }

      .wa-voice-separator-dashed {
        width: 100%;
        border-top: 1px dashed rgba(0, 0, 0, 0.15);
        margin-bottom: 6px;
      }
      
      [data-theme="dark"] .wa-voice-separator-dashed {
        border-top-color: rgba(255, 255, 255, 0.15);
      }

      .wa-voice-translate-btn-inner {
        background-color: #007bff; /* Blue */
        color: white;
        text-align: center;
        padding: 6px 0;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .wa-voice-translate-btn-inner:hover {
        background-color: #0069d9;
      }
      
      /* Voice Translation Result - New Layout */
      .wa-voice-result-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        margin-top: 6px;
      }
      
      /* Silent translation: suppress audio player UI while capturing */
      .wa-silent-translation [data-testid="audio-player"],
      .wa-silent-translation [data-testid="ptt-player"] {
        display: none !important;
      }
      .wa-silent-translation[data-testid="audio-player"],
      .wa-silent-translation[data-testid="ptt-player"] {
        display: none !important;
      }
      .wa-silent-translation [data-icon="audio-play"],
      .wa-silent-translation [data-icon="audio-pause"] {
        visibility: hidden;
      }

      .wa-silent-mode [data-testid="audio-player"],
      .wa-silent-mode [data-testid="ptt-player"] {
        display: none !important;
      }
      .wa-silent-mode [data-icon="audio-play"],
      .wa-silent-mode [data-icon="audio-pause"] {
        visibility: hidden;
      }
      .wa-silent-mode [data-icon="ptt-in-blue"],
      .wa-silent-mode [data-icon="ptt-play"],
      .wa-silent-mode span[data-icon="audio-play"],
      .wa-silent-mode button[aria-label*="Play"],
      .wa-silent-mode button[aria-label*="Pause"] {
        display: none !important;
      }
      .wa-silent-mode [role="progressbar"],
      .wa-silent-mode [role="slider"],
      .wa-silent-mode .progress,
      .wa-silent-mode .duration,
      .wa-silent-mode .timeline,
      .wa-silent-mode canvas {
        display: none !important;
      }
      
      .wa-voice-content-row {
        display: flex;
        flex-direction: row;
        gap: 8px;
        padding-top: 4px;
      }
      
      .wa-voice-refresh-icon {
        color: #007bff;
        font-size: 16px;
        margin-top: 2px;
        cursor: pointer;
        flex-shrink: 0;
      }
      
      .wa-voice-text-col {
        display: flex;
        flex-direction: column;
        flex: 1;
        gap: 4px;
      }
      
      .wa-voice-translated-text {
        font-size: 14px;
        color: #111b21;
        line-height: 1.4;
      }
      
      .wa-voice-separator-dashed-thin {
        width: 100%;
        border-top: 1px dashed rgba(0, 0, 0, 0.1);
        margin: 4px 0;
      }
      
      .wa-voice-original-text {
        font-size: 12px;
        color: #667781;
        line-height: 1.3;
      }
      
      [data-theme="dark"] .wa-voice-translated-text {
        color: #e9edef;
      }
      
      [data-theme="dark"] .wa-voice-original-text {
        color: #8696a0;
      }
      
      [data-theme="dark"] .wa-voice-separator-dashed-thin {
        border-top-color: rgba(255, 255, 255, 0.1);
      }

      /* Hide old styles if any remain */
      .wa-voice-translate-btn {
        display: none !important;
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

  findBubbleContainer(element) {
    const root = element.closest('[data-testid="msg-container"]') ||
      element.closest('.message-in, .message-out') ||
      element;

    const candidate = (
      root.querySelector('div[class*="_ak49"]') ||
      root.querySelector('div[class*="_ak4q"]') ||
      root.querySelector('div[class*="_ak4o"]') ||
      root.querySelector('div[class*="_ak4a"]') ||
      root.querySelector('div[class*="_ak6"]') ||
      root.querySelector('div[class*="_amk"]') ||
      root.querySelector('div[class*="_ak8l"]')
    );
    if (candidate) return candidate;

    let node = element;
    const stopAt = root.parentElement || document.body;
    let steps = 0;
    while (node && node !== stopAt && steps < 24) {
      const style = window.getComputedStyle(node);
      const bg = style.backgroundColor;
      const br = Math.max(
        parseFloat(style.borderTopLeftRadius) || 0,
        parseFloat(style.borderTopRightRadius) || 0,
        parseFloat(style.borderBottomLeftRadius) || 0,
        parseFloat(style.borderBottomRightRadius) || 0
      );
      const pad = Math.max(
        parseFloat(style.paddingTop) || 0,
        parseFloat(style.paddingBottom) || 0
      );
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && br >= 6 && pad >= 4) {
        return node;
      }
      steps++;
      node = node.parentElement;
    }

    return root;
  }

  getOrCreateSharedContainer(messageNode, anchorElement) {
    const bubble = this.findBubbleContainer(anchorElement || messageNode);
    let container = bubble.querySelector('.wa-translation-result');
    if (!container) {
      container = document.createElement('div');
      container.className = 'wa-translation-result';
      const header = document.createElement('div');
      header.className = 'translation-header';
      const textDiv = document.createElement('div');
      textDiv.className = 'translation-text';
      container.appendChild(header);
      container.appendChild(textDiv);

      if (anchorElement && anchorElement.parentElement === bubble) {
        bubble.insertBefore(container, anchorElement.nextSibling);
      } else {
        bubble.appendChild(container);
      }
    }
    return container;
  }

  getVoiceAnchorSelectors() {
    return [
      '[data-testid="audio-player"]',
      '[data-testid="ptt-player"]',
      'audio',
      'canvas',
      'button[aria-label*="Play"]',
      'span[data-icon="audio-play"]',
      'span[data-icon="ptt-in-blue"]'
    ];
  }

  /**
   * 统一解析气泡与播放器锚点
   */
  resolveBubbleAndAnchor(messageElement, targetPlayer) {
    const bubble = this.findBubbleContainer(targetPlayer || messageElement);

    let anchor = targetPlayer || null;
    if (!anchor) {
      for (const sel of this.getVoiceAnchorSelectors()) {
        const el = bubble.querySelector(sel);
        if (el) { anchor = el; break; }
      }
    }
    return { bubble, anchor };
  }

  /**
   * 将节点插入到锚点之后，如无锚点则附加到气泡末尾
   */
  insertAfterAnchor(bubble, anchor, node) {
    if (!anchor) {
      bubble.appendChild(node);
      return;
    }

    // 寻找“锚点所在的气泡顶层子节点”，避免插入到行容器导致宽度异常
    let current = anchor;
    while (current && current.parentElement && current.parentElement !== bubble) {
      current = current.parentElement;
    }
    const bubbleChild = current && current.parentElement === bubble ? current : anchor;
    bubble.insertBefore(node, bubbleChild.nextSibling);
  }

  debugVoiceAnchors() {
    const oldProbes = document.querySelectorAll('.wa-debug-probe');
    oldProbes.forEach(p => p.remove());

    const candidates = document.querySelectorAll('[data-testid="audio-player"],[data-testid="ptt-player"],audio,canvas,button[aria-label*="Play"],span[data-icon="audio-play"],span[data-icon="ptt-in-blue"]');
    const seen = new Set();
    let count = 0;
    candidates.forEach(el => {
      const msg = el.closest('[data-testid="msg-container"]') || el.closest('.message-in, .message-out') || this.findBubbleContainer(el);
      if (!msg) return;
      const rect = msg.getBoundingClientRect();
      const key = rect.top + ':' + rect.left;
      if (seen.has(key)) return;
      seen.add(key);

      const { bubble, anchor } = this.resolveBubbleAndAnchor(msg, el);
      if (bubble) {
        bubble.classList.add('wa-debug-bubble');
        bubble.style.outline = '2px dashed #0096ff';
      }
      if (anchor) {
        anchor.classList.add('wa-debug-anchor');
        anchor.style.outline = '2px dashed #22c55e';
      }

      const probe = document.createElement('div');
      probe.className = 'wa-voice-result-container wa-debug-probe';
      probe.style.cssText = 'background: rgba(239,68,68,0.08); border: 1px dashed #ef4444; margin-top: 6px; padding: 2px 6px; font-size: 11px; color: #ef4444;';
      probe.textContent = 'DEBUG INSERT POINT';
      this.insertAfterAnchor(bubble, anchor, probe);
      count++;
    });
    return { count };
  }

  clearVoiceDebug() {
    document.querySelectorAll('.wa-debug-probe').forEach(p => p.remove());
    document.querySelectorAll('.wa-debug-bubble').forEach(b => {
      b.style.outline = '';
      b.classList.remove('wa-debug-bubble');
    });
    document.querySelectorAll('.wa-debug-anchor').forEach(a => {
      a.style.outline = '';
      a.classList.remove('wa-debug-anchor');
    });
    return { cleared: true };
  }

  relocateVoiceResults() {
    const results = document.querySelectorAll('.wa-voice-result-container');
    let moved = 0;
    results.forEach(cont => {
      const msg = cont.closest('[data-testid="msg-container"], .message-in, .message-out') || cont.parentElement;
      if (!msg) return;
      const { bubble, anchor } = this.resolveBubbleAndAnchor(msg, null);
      if (!bubble) return;
      if (cont.parentElement !== bubble) {
        this.insertAfterAnchor(bubble, anchor, cont);
        moved++;
      }
    });
    return { moved };
  }

  /**
   * 为语音消息创建翻译按钮 (New UI)
   * @param {HTMLElement} voiceMessageElement - 语音消息元素
   * @returns {HTMLElement} 翻译按钮容器
   */
  createVoiceTranslateButton(voiceMessageElement) {
    // 检查是否已存在翻译按钮
    const existing = voiceMessageElement.querySelector('.wa-voice-translate-block');
    if (existing) {
      return existing;
    }

    const container = document.createElement('div');
    container.className = 'wa-voice-translate-block';
    
    const targetLang = this.core.config.global.targetLang || '中文';
    
    container.innerHTML = `
      <div class="wa-voice-separator-dashed"></div>
      <div class="wa-voice-translate-btn-inner">
        点击翻译 【${targetLang}】
      </div>
    `;
    
    return container;
  }

  /**
   * 显示语音翻译加载状态 (New UI)
   * @param {HTMLElement} voiceMessageElement - 语音消息元素
   */
  showVoiceTranslationLoading(voiceMessageElement, targetPlayer = null) {
    // 尝试找到现有的翻译按钮块
    const translateBlock = voiceMessageElement.querySelector('.wa-voice-translate-block');
    
    if (translateBlock) {
        const inner = translateBlock.querySelector('.wa-voice-translate-btn-inner');
        if (inner) {
            inner.innerHTML = '⏳ 正在翻译...';
            inner.style.backgroundColor = '#6c757d'; // Grey
            inner.style.cursor = 'wait';
        }
        // 同步在播放器下方创建/复用结果容器，以保证“同框”位置一致
        const { bubble, anchor } = this.resolveBubbleAndAnchor(voiceMessageElement, targetPlayer);
        let container = bubble.querySelector('.wa-voice-result-container');
        if (!container) {
          container = document.createElement('div');
          container.className = 'wa-voice-result-container';
          this.insertAfterAnchor(bubble, anchor, container);
        }

        container.innerHTML = `
      <div class="wa-voice-separator-dashed"></div>
      <div class="wa-voice-content-row">
           <div class="wa-voice-refresh-icon">⏳</div>
           <div class="wa-voice-text-col">
                <div class="wa-voice-translated-text" style="color: #667781; font-style: italic;">正在识别语音并翻译...</div>
           </div>
      </div>
    `;
        return;
    }

    // 如果没有按钮（可能是重试），则查找或创建结果容器
    let container = voiceMessageElement.querySelector('.wa-voice-result-container');
    if (!container) {
        const { bubble, anchor } = this.resolveBubbleAndAnchor(voiceMessageElement, targetPlayer);
        container = document.createElement('div');
        container.className = 'wa-voice-result-container';
        this.insertAfterAnchor(bubble, anchor, container);
    }

    container.innerHTML = `
      <div class="wa-voice-separator-dashed"></div>
      <div class="wa-voice-content-row">
           <div class="wa-voice-refresh-icon">⏳</div>
           <div class="wa-voice-text-col">
                <div class="wa-voice-translated-text" style="color: #667781; font-style: italic;">正在识别语音并翻译...</div>
           </div>
      </div>
    `;
  }

  /**
   * 显示语音翻译结果 (New UI)
   * @param {HTMLElement} voiceMessageElement - 语音消息元素
   * @param {Object} result - 翻译结果 {original, translated, sourceLang, targetLang}
   * @param {HTMLElement} targetPlayer - 目标播放器容器
   * @param {Function} onRetry - 重试/刷新回调函数
   */
  displayVoiceTranslation(voiceMessageElement, result, targetPlayer = null, onRetry = null) {
    // 移除点击翻译按钮
    const translateBtn = voiceMessageElement.querySelector('.wa-voice-translate-block');
    if (translateBtn) translateBtn.remove();

    // 移除旧的翻译结果
    const existing = voiceMessageElement.querySelector('.wa-voice-result-container');
    if (existing) existing.remove();
    
    // 获取或创建结果容器
    // 我们直接附加到 voiceMessageElement (bubble) 的底部
    // 假设 voiceMessageElement 是从 findBubbleContainer 返回的或者传递进来的正确气泡
    
    // 确保我们有正确的气泡容器
    const { bubble, anchor } = this.resolveBubbleAndAnchor(voiceMessageElement, targetPlayer);

    const container = document.createElement('div');
    container.className = 'wa-voice-result-container';
    
    const original = result.original || '';
    const translated = result.translated || '';
    
    container.innerHTML = `
      <div class="wa-voice-separator-dashed"></div>
      <div class="wa-voice-content-row">
           <div class="wa-voice-refresh-icon" title="重新翻译">🔄</div>
           <div class="wa-voice-text-col">
                <div class="wa-voice-translated-text">${this.core.escapeHtml(translated)}</div>
                <div class="wa-voice-separator-dashed-thin"></div>
                <div class="wa-voice-original-text">${this.core.escapeHtml(original)}</div>
           </div>
      </div>
    `;
    
    // 绑定刷新按钮事件
    const refreshBtn = container.querySelector('.wa-voice-refresh-icon');
    if (onRetry) {
        refreshBtn.onclick = (e) => {
            e.stopPropagation();
            onRetry();
        };
    } else {
        refreshBtn.style.display = 'none'; // 如果没有回调，隐藏按钮
    }
    
    this.insertAfterAnchor(bubble, anchor, container);
    console.log('[Translation] Voice translation displayed with new UI');
  }

  /**
   * 显示语音翻译错误 (New UI)
   * @param {HTMLElement} voiceMessageElement - 语音消息元素
   * @param {string} errorMessage - 错误消息
   * @param {Function} onRetry - 重试回调函数
   */
  displayVoiceTranslationError(voiceMessageElement, errorMessage, targetPlayer = null, onRetry = null) {
    // 移除翻译按钮
    const translateBtn = voiceMessageElement.querySelector('.wa-voice-translate-block');
    if (translateBtn) translateBtn.remove();

    // 查找或创建结果容器
    let container = voiceMessageElement.querySelector('.wa-voice-result-container');
    if (!container) {
      const { bubble, anchor } = this.resolveBubbleAndAnchor(voiceMessageElement, targetPlayer);
      container = document.createElement('div');
      container.className = 'wa-voice-result-container';
      this.insertAfterAnchor(bubble, anchor, container);
    }
    
    container.innerHTML = `
      <div class="wa-voice-separator-dashed"></div>
      <div class="wa-voice-content-row">
           <div class="wa-voice-refresh-icon" title="重试" style="color: #d32f2f; cursor: pointer;">⚠️</div>
           <div class="wa-voice-text-col">
                <div class="wa-voice-translated-text" style="color: #d32f2f;">翻译失败: ${this.core.escapeHtml(errorMessage)}</div>
           </div>
      </div>
    `;
    
    // 绑定重试事件
    const refreshBtn = container.querySelector('.wa-voice-refresh-icon');
    if (onRetry) {
        refreshBtn.onclick = (e) => {
            e.stopPropagation();
            onRetry();
        };
    } else {
        refreshBtn.style.cursor = 'default';
    }
    
    console.log('[Translation] Voice translation error displayed:', errorMessage);
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
