/**
 * Error Display Component for Sidebar
 * 
 * Displays account-specific errors and global errors in the sidebar UI.
 */

/**
 * Error display manager
 */
class ErrorDisplay {
  constructor() {
    this.accountErrors = new Map(); // accountId -> error info
    this.globalErrors = [];
    this.maxGlobalErrors = 5;
    this.errorTimeout = 10000; // Auto-dismiss after 10 seconds
  }

  /**
   * Initialize error display
   */
  initialize() {
    // Create global error container if it doesn't exist
    this._ensureGlobalErrorContainer();

    // Listen for error events from main process
    if (window.electronAPI) {
      window.electronAPI.onAccountError((data) => {
        this.showAccountError(data.accountId, data.error, data.category);
      });

      window.electronAPI.onGlobalError((data) => {
        this.showGlobalError(data.error, data.category, data.level);
      });

      window.electronAPI.onErrorCleared((data) => {
        if (data.accountId) {
          this.clearAccountError(data.accountId);
        } else {
          this.clearGlobalErrors();
        }
      });
    }
  }

  /**
   * Ensure global error container exists
   * @private
   */
  _ensureGlobalErrorContainer() {
    let container = document.getElementById('global-errors');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'global-errors';
      container.className = 'global-errors-container';
      
      // Insert at the top of sidebar
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.insertBefore(container, sidebar.firstChild);
      }
    }

    return container;
  }

  /**
   * Show account-specific error
   * @param {string} accountId - Account ID
   * @param {string} errorMessage - Error message
   * @param {string} [category='unknown'] - Error category
   * @param {Object} [options] - Display options
   */
  showAccountError(accountId, errorMessage, category = 'unknown', options = {}) {
    const {
      autoDismiss = true,
      dismissTimeout = this.errorTimeout,
      severity = 'error'
    } = options;

    // Store error info
    const errorInfo = {
      accountId,
      message: errorMessage,
      category,
      severity,
      timestamp: Date.now()
    };

    this.accountErrors.set(accountId, errorInfo);

    // Update account item in sidebar
    this._updateAccountErrorDisplay(accountId, errorInfo);

    // Auto-dismiss if requested
    if (autoDismiss) {
      setTimeout(() => {
        this.clearAccountError(accountId);
      }, dismissTimeout);
    }
  }

  /**
   * Update account error display in sidebar
   * @private
   * @param {string} accountId - Account ID
   * @param {Object} errorInfo - Error information
   */
  _updateAccountErrorDisplay(accountId, errorInfo) {
    const accountItem = document.querySelector(`[data-account-id="${accountId}"]`);
    
    if (!accountItem) {
      return;
    }

    // Add error class
    accountItem.classList.add('has-error');
    accountItem.classList.add(`error-${errorInfo.severity}`);

    // Find or create error indicator
    let errorIndicator = accountItem.querySelector('.account-error-indicator');
    
    if (!errorIndicator) {
      errorIndicator = document.createElement('div');
      errorIndicator.className = 'account-error-indicator';
      
      // Insert after status indicator
      const statusIndicator = accountItem.querySelector('.account-status');
      if (statusIndicator) {
        statusIndicator.parentNode.insertBefore(errorIndicator, statusIndicator.nextSibling);
      } else {
        accountItem.appendChild(errorIndicator);
      }
    }

    // Set error icon based on severity
    const icon = this._getErrorIcon(errorInfo.severity);
    errorIndicator.innerHTML = `
      <span class="error-icon" title="${this._escapeHtml(errorInfo.message)}">${icon}</span>
    `;

    // Add tooltip with full error message
    errorIndicator.title = errorInfo.message;

    // Add click handler to show full error
    errorIndicator.onclick = (e) => {
      e.stopPropagation();
      this._showErrorDetails(errorInfo);
    };
  }

  /**
   * Get error icon based on severity
   * @private
   * @param {string} severity - Error severity
   * @returns {string} Icon HTML
   */
  _getErrorIcon(severity) {
    const icons = {
      'error': '⚠️',
      'warning': '⚠',
      'info': 'ℹ️'
    };

    return icons[severity] || icons['error'];
  }

  /**
   * Clear account error
   * @param {string} accountId - Account ID
   */
  clearAccountError(accountId) {
    this.accountErrors.delete(accountId);

    const accountItem = document.querySelector(`[data-account-id="${accountId}"]`);
    
    if (!accountItem) {
      return;
    }

    // Remove error classes
    accountItem.classList.remove('has-error', 'error-error', 'error-warning', 'error-info');

    // Remove error indicator
    const errorIndicator = accountItem.querySelector('.account-error-indicator');
    if (errorIndicator) {
      errorIndicator.remove();
    }
  }

  /**
   * Show global error
   * @param {string} errorMessage - Error message
   * @param {string} [category='unknown'] - Error category
   * @param {string} [level='error'] - Error level
   * @param {Object} [options] - Display options
   */
  showGlobalError(errorMessage, category = 'unknown', level = 'error', options = {}) {
    const {
      autoDismiss = true,
      dismissTimeout = this.errorTimeout
    } = options;

    const errorInfo = {
      id: `error-${Date.now()}-${Math.random()}`,
      message: errorMessage,
      category,
      level,
      timestamp: Date.now()
    };

    // Add to global errors
    this.globalErrors.unshift(errorInfo);

    // Keep only max number of errors
    if (this.globalErrors.length > this.maxGlobalErrors) {
      this.globalErrors = this.globalErrors.slice(0, this.maxGlobalErrors);
    }

    // Update display
    this._updateGlobalErrorDisplay();

    // Auto-dismiss if requested
    if (autoDismiss) {
      setTimeout(() => {
        this.dismissGlobalError(errorInfo.id);
      }, dismissTimeout);
    }
  }

  /**
   * Update global error display
   * @private
   */
  _updateGlobalErrorDisplay() {
    const container = this._ensureGlobalErrorContainer();
    
    // Clear existing errors
    container.innerHTML = '';

    // Add each error
    this.globalErrors.forEach(errorInfo => {
      const errorElement = this._createGlobalErrorElement(errorInfo);
      container.appendChild(errorElement);
    });
  }

  /**
   * Create global error element
   * @private
   * @param {Object} errorInfo - Error information
   * @returns {HTMLElement} Error element
   */
  _createGlobalErrorElement(errorInfo) {
    const errorDiv = document.createElement('div');
    errorDiv.className = `global-error global-error-${errorInfo.level}`;
    errorDiv.dataset.errorId = errorInfo.id;

    const icon = this._getErrorIcon(errorInfo.level === 'warn' ? 'warning' : errorInfo.level);

    errorDiv.innerHTML = `
      <div class="global-error-content">
        <span class="global-error-icon">${icon}</span>
        <span class="global-error-message">${this._escapeHtml(errorInfo.message)}</span>
        <button class="global-error-dismiss" title="关闭">×</button>
      </div>
    `;

    // Add dismiss handler
    const dismissBtn = errorDiv.querySelector('.global-error-dismiss');
    dismissBtn.onclick = () => {
      this.dismissGlobalError(errorInfo.id);
    };

    // Add click handler to show details
    errorDiv.onclick = (e) => {
      if (e.target !== dismissBtn) {
        this._showErrorDetails(errorInfo);
      }
    };

    return errorDiv;
  }

  /**
   * Dismiss global error
   * @param {string} errorId - Error ID
   */
  dismissGlobalError(errorId) {
    this.globalErrors = this.globalErrors.filter(e => e.id !== errorId);
    this._updateGlobalErrorDisplay();
  }

  /**
   * Clear all global errors
   */
  clearGlobalErrors() {
    this.globalErrors = [];
    this._updateGlobalErrorDisplay();
  }

  /**
   * Show error details in a modal or expanded view
   * @private
   * @param {Object} errorInfo - Error information
   */
  _showErrorDetails(errorInfo) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'error-details-overlay';

    const modal = document.createElement('div');
    modal.className = 'error-details-modal';

    const timestamp = new Date(errorInfo.timestamp).toLocaleString();

    modal.innerHTML = `
      <div class="error-details-header">
        <h3>错误详情</h3>
        <button class="error-details-close">×</button>
      </div>
      <div class="error-details-body">
        <div class="error-detail-row">
          <span class="error-detail-label">类别:</span>
          <span class="error-detail-value">${this._escapeHtml(errorInfo.category)}</span>
        </div>
        <div class="error-detail-row">
          <span class="error-detail-label">时间:</span>
          <span class="error-detail-value">${timestamp}</span>
        </div>
        <div class="error-detail-row">
          <span class="error-detail-label">消息:</span>
          <span class="error-detail-value">${this._escapeHtml(errorInfo.message)}</span>
        </div>
        ${errorInfo.accountId ? `
          <div class="error-detail-row">
            <span class="error-detail-label">账号:</span>
            <span class="error-detail-value">${this._escapeHtml(errorInfo.accountId)}</span>
          </div>
        ` : ''}
      </div>
      <div class="error-details-footer">
        <button class="error-details-copy">复制错误</button>
        <button class="error-details-ok">确定</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close handlers
    const closeModal = () => {
      overlay.remove();
    };

    modal.querySelector('.error-details-close').onclick = closeModal;
    modal.querySelector('.error-details-ok').onclick = closeModal;
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    };

    // Copy handler
    modal.querySelector('.error-details-copy').onclick = () => {
      const errorText = `
类别: ${errorInfo.category}
时间: ${timestamp}
消息: ${errorInfo.message}
${errorInfo.accountId ? `账号: ${errorInfo.accountId}` : ''}
      `.trim();

      navigator.clipboard.writeText(errorText).then(() => {
        const btn = modal.querySelector('.error-details-copy');
        const originalText = btn.textContent;
        btn.textContent = '已复制！';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      });
    };
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get all account errors
   * @returns {Map} Account errors map
   */
  getAccountErrors() {
    return new Map(this.accountErrors);
  }

  /**
   * Get all global errors
   * @returns {Array} Global errors array
   */
  getGlobalErrors() {
    return [...this.globalErrors];
  }

  /**
   * Check if account has error
   * @param {string} accountId - Account ID
   * @returns {boolean} True if account has error
   */
  hasAccountError(accountId) {
    return this.accountErrors.has(accountId);
  }
}

// Create singleton instance
const errorDisplay = new ErrorDisplay();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = errorDisplay;
}
