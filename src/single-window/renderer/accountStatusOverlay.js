/**
 * Account Status Overlay
 * Handles displaying loading states and errors over the webview area
 */

class AccountStatusOverlay {
    constructor() {
        this.overlay = null;
        this.init();
    }

    init() {
        // Check if overlay already exists
        if (document.getElementById('account-status-overlay')) return;

        // Create overlay element
        this.overlay = document.createElement('div');
        this.overlay.id = 'account-status-overlay';
        this.overlay.className = 'account-status-overlay hidden';
        this.overlay.innerHTML = `
      <div class="status-content">
        <div class="status-icon"></div>
        <div class="status-message"></div>
        <div class="status-action"></div>
      </div>
    `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
      .account-status-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        opacity: 1;
        transition: opacity 0.3s ease;
      }
      .account-status-overlay.hidden {
        opacity: 0;
        pointer-events: none;
      }
      .status-content {
        text-align: center;
        max-width: 400px;
        padding: 20px;
      }
      .status-message {
        margin: 15px 0;
        font-size: 16px;
        color: #333;
      }
      .status-action button {
        padding: 8px 16px;
        background: #00a884;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    `;

        document.head.appendChild(style);
        const container = document.getElementById('view-container');
        if (container) {
            container.appendChild(this.overlay);
        }
    }

    showLoading(message = 'Loading...') {
        if (!this.overlay) return;
        this.overlay.querySelector('.status-message').textContent = message;
        this.overlay.classList.remove('hidden');
    }

    showError(message, actionText, actionCallback) {
        if (!this.overlay) return;
        this.overlay.querySelector('.status-message').textContent = message;
        this.overlay.querySelector('.status-message').style.color = '#d32f2f';

        const actionContainer = this.overlay.querySelector('.status-action');
        actionContainer.innerHTML = '';

        if (actionText && actionCallback) {
            const btn = document.createElement('button');
            btn.textContent = actionText;
            btn.onclick = actionCallback;
            actionContainer.appendChild(btn);
        }

        this.overlay.classList.remove('hidden');
    }

    hide() {
        if (!this.overlay) return;
        this.overlay.classList.add('hidden');
    }
}

// Export instance
window.accountStatusOverlay = new AccountStatusOverlay();
