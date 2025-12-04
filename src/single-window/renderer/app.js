/**
 * Main application logic for the single-window UI
 * Handles sidebar resizing and layout management
 */

(function () {
  'use strict';

  // State
  let isResizing = false;
  let sidebarWidth = 300; // Default width
  let lastIpcSendTime = 0;
  const MIN_SIDEBAR_WIDTH = 200;
  const MAX_SIDEBAR_WIDTH = 500;
  const IPC_THROTTLE_DELAY = 16; // ~60fps throttle for IPC calls

  // DOM elements
  const sidebar = document.getElementById('sidebar');
  const resizeHandle = document.getElementById('resize-handle');
  const viewContainer = document.getElementById('view-container');

  /**
   * Initialize the application
   */
  async function init() {
    await loadSidebarWidth();
    setupResizeHandle();
    setupKeyboardShortcuts();
    setupViewSwitchingFeedback();
    applySidebarWidth(sidebarWidth);

    // Initialize error display
    if (typeof errorDisplay !== 'undefined') {
      errorDisplay.initialize();
    }

    // Notify main process that UI is ready
    if (window.electronAPI) {
      window.electronAPI.send('ui-ready');
    }
  }

  /**
   * Load saved sidebar width from main process storage
   */
  async function loadSidebarWidth() {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.invoke('get-sidebar-width');
        if (result && result.success && result.width) {
          const width = result.width;
          if (width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
            sidebarWidth = width;
            return;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load sidebar width from main process:', error);
    }

    // Fallback to localStorage for backward compatibility
    const saved = localStorage.getItem('sidebarWidth');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
        sidebarWidth = parsed;
      }
    }
  }

  /**
   * Save sidebar width to storage (no longer needed as main process handles it)
   * Kept for backward compatibility
   */
  function saveSidebarWidth() {
    // Main process now handles persistence via sidebar-resized IPC
    // Keep localStorage as backup
    localStorage.setItem('sidebarWidth', sidebarWidth.toString());
  }

  /**
   * Apply sidebar width to the layout
   */
  function applySidebarWidth(width) {
    sidebar.style.width = `${width}px`;
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);

    // Throttle IPC calls during resize for better performance
    const now = Date.now();
    const shouldSend = isResizing ? (now - lastIpcSendTime >= IPC_THROTTLE_DELAY) : true;

    if (window.electronAPI && shouldSend) {
      window.electronAPI.send('sidebar-resized', width);
      lastIpcSendTime = now;
    }
  }

  /**
   * Setup resize handle drag functionality
   */
  function setupResizeHandle() {
    resizeHandle.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  }

  /**
   * Start resizing
   */
  function startResize(e) {
    isResizing = true;
    resizeHandle.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  /**
   * Handle resize movement
   */
  function handleResize(e) {
    if (!isResizing) return;

    const newWidth = e.clientX;

    // Constrain width within min/max bounds
    if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
      sidebarWidth = newWidth;
      applySidebarWidth(sidebarWidth);
    }
  }

  /**
   * Stop resizing
   */
  function stopResize() {
    if (!isResizing) return;

    isResizing = false;
    resizeHandle.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Save the new width
    saveSidebarWidth();
  }

  /**
   * Handle window resize events
   */
  function handleWindowResize() {
    // Ensure sidebar width is still valid
    const windowWidth = window.innerWidth;
    const maxAllowed = Math.min(MAX_SIDEBAR_WIDTH, windowWidth * 0.5);

    if (sidebarWidth > maxAllowed) {
      sidebarWidth = maxAllowed;
      applySidebarWidth(sidebarWidth);
      saveSidebarWidth();
    }

    // Notify main process about window resize for view bounds recalculation
    if (window.electronAPI) {
      window.electronAPI.send('window-resize-complete');
    }
  }

  /**
   * Setup keyboard shortcuts for account switching
   */
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
      // Check for Ctrl+Number (1-9) shortcuts
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        const key = e.key;

        // Ctrl+1 through Ctrl+9 for switching to accounts 1-9
        if (key >= '1' && key <= '9') {
          e.preventDefault();
          const index = parseInt(key, 10) - 1; // Convert to 0-based index

          try {
            if (window.electronAPI) {
              const result = await window.electronAPI.invoke('switch-account-by-index', index);

              if (!result.success && result.error === 'Account index out of range') {
                // Silently ignore if account doesn't exist at that index
                console.log(`No account at position ${key}`);
              }
            }
          } catch (error) {
            console.error('Failed to switch account via keyboard shortcut:', error);
          }
          return;
        }

        // Ctrl+Tab for next account
        if (key === 'Tab') {
          e.preventDefault();

          try {
            if (window.electronAPI) {
              await window.electronAPI.invoke('switch-to-next-account');
            }
          } catch (error) {
            console.error('Failed to switch to next account:', error);
          }
          return;
        }
      }

      // Ctrl+Shift+Tab for previous account
      if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key === 'Tab') {
        e.preventDefault();

        try {
          if (window.electronAPI) {
            await window.electronAPI.invoke('switch-to-previous-account');
          }
        } catch (error) {
          console.error('Failed to switch to previous account:', error);
        }
        return;
      }
    });
  }

  /**
   * Setup visual feedback for view switching
   */
  function setupViewSwitchingFeedback() {
    if (!window.electronAPI) return;

    // Show loading indicator when switching starts
    window.electronAPI.on('view-manager:view-switching', (data) => {
      showSwitchingFeedback(data.toAccountId);
    });

    // Hide loading indicator when switching completes
    window.electronAPI.on('view-manager:view-switched', (data) => {
      hideSwitchingFeedback();

      // Update active state in sidebar if needed
      if (window.sidebar && window.sidebar.setActiveAccount) {
        window.sidebar.setActiveAccount(data.toAccountId);
      }
    });

    // Handle switch failures
    window.electronAPI.on('view-manager:view-switch-failed', (data) => {
      hideSwitchingFeedback();
      console.error('View switch failed:', data.error);

      // Show error notification
      showNotification('切换账号失败', 'error');
    });

    // Handle view errors (e.g. proxy connection failure)
    window.electronAPI.on('view-manager:view-error', (data) => {
      hideSwitchingFeedback();
      console.error('View error:', data.error);

      const errorMessage = data.error && data.error.message ? data.error.message : '未知错误';
      showNotification(`视图错误: ${errorMessage}`, 'error');
    });

    // Handle window resize events from main process
    window.electronAPI.on('window-resized', (data) => {
      console.log('Window resized:', data.bounds);
      // The main process will handle view bounds recalculation
      // This is just for logging/debugging
    });

    // Handle translation panel state changes
    window.electronAPI.on('translation-panel:state-changed', (data) => {
      console.log('Translation panel state changed:', data);
      // Update the translate settings panel if it exists
      if (window.TranslateSettingsPanel && typeof window.translateSettingsPanel !== 'undefined') {
        window.translateSettingsPanel.updateForPanelState(data.state);
      } else if (window.translatePanelLayout && typeof window.translatePanelLayout !== 'undefined') {
        // If we have a reference to the translate settings panel through the layout system
        // We'll handle this in the translatePanelLayout.js file
      }
    });
  }

  /**
   * Show visual feedback during account switching
   */
  function showSwitchingFeedback(accountId) {
    // Add a subtle loading overlay to the view container
    const viewContainer = document.getElementById('view-container');
    if (!viewContainer) return;

    // Remove any existing overlay
    const existingOverlay = viewContainer.querySelector('.switching-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Create overlay with smooth transition
    const overlay = document.createElement('div');
    overlay.className = 'switching-overlay';
    overlay.innerHTML = `
      <div class="switching-spinner"></div>
      <div class="switching-text">Switching account...</div>
    `;

    viewContainer.appendChild(overlay);

    // Add CSS if not already present
    if (!document.getElementById('switching-feedback-styles')) {
      const style = document.createElement('style');
      style.id = 'switching-feedback-styles';
      style.textContent = `
        .switching-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .switching-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e0e0e0;
          border-top-color: #25D366;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        
        .switching-text {
          margin-top: 16px;
          color: #666;
          font-size: 14px;
          font-weight: 500;
          animation: fadeIn 0.3s ease-in 0.1s both;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
          from { 
            opacity: 0;
            transform: translateY(10px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeOut {
          from { 
            opacity: 1;
            transform: scale(1);
          }
          to { 
            opacity: 0;
            transform: scale(0.95);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Hide switching feedback
   */
  function hideSwitchingFeedback() {
    const viewContainer = document.getElementById('view-container');
    if (!viewContainer) return;

    const overlay = viewContainer.querySelector('.switching-overlay');
    if (overlay) {
      // Smooth fade out animation
      overlay.style.animation = 'fadeOut 0.2s cubic-bezier(0.4, 0, 1, 1)';
      setTimeout(() => {
        overlay.remove();
      }, 200);
    }
  }

  /**
   * Show a notification message
   */
  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add to body
    document.body.appendChild(notification);

    // Add CSS if not already present
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        .notification {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 10000;
          animation: slideIn 0.3s ease-out, slideOut 0.3s ease-in 2.7s;
          font-size: 14px;
          max-width: 300px;
        }
        
        .notification-error {
          background: #fee;
          color: #c33;
          border-left: 4px solid #c33;
        }
        
        .notification-success {
          background: #efe;
          color: #3c3;
          border-left: 4px solid #3c3;
        }
        
        .notification-info {
          background: #eef;
          color: #33c;
          border-left: 4px solid #33c;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Remove after animation
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Debounce window resize handler
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleWindowResize, 100);
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for testing or external access
  window.appLayout = {
    getSidebarWidth: () => sidebarWidth,
    setSidebarWidth: (width) => {
      if (width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
        sidebarWidth = width;
        applySidebarWidth(sidebarWidth);
        saveSidebarWidth();
      }
    },
    showSwitchingFeedback,
    hideSwitchingFeedback,
    showNotification
  };

})();
