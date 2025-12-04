/**
 * SessionRecovery - Session recovery and health monitoring
 * Handles session validation, recovery, and health checks
 */

class SessionRecovery {
  constructor(sessionStorage, logger) {
    this.sessionStorage = sessionStorage;
    this.log = logger;
    this.loginStatusCache = new Map();
  }

  /**
   * Get cached login status
   * @param {string} accountId - Account ID
   * @returns {boolean|null}
   */
  getCachedLoginStatus(accountId) {
    return this.loginStatusCache.get(accountId) ?? null;
  }

  /**
   * Set login status
   * @param {string} accountId - Account ID
   * @param {boolean} isLoggedIn - Whether logged in
   */
  setLoginStatus(accountId, isLoggedIn) {
    this.loginStatusCache.set(accountId, isLoggedIn);
  }

  /**
   * Clear login status cache
   * @param {string} accountId - Account ID
   */
  clearLoginStatusCache(accountId) {
    this.loginStatusCache.delete(accountId);
  }

  /**
   * Detect login status
   * @param {string} accountId - Account ID
   * @param {Electron.BrowserView|Electron.BrowserWindow} viewOrWindow - View or window
   * @returns {Promise<{success: boolean, isLoggedIn?: boolean, error?: string}>}
   */
  async detectLoginStatus(accountId, viewOrWindow) {
    try {
      this.log('info', `Detecting login status for account ${accountId}`);

      if (!viewOrWindow || !viewOrWindow.webContents) {
        throw new Error('Invalid view or window: webContents not found');
      }

      const webContents = viewOrWindow.webContents;

      // Check if page is loaded
      if (webContents.isLoading()) {
        this.log('info', `Page is still loading for account ${accountId}, waiting...`);
        await new Promise(resolve => {
          webContents.once('did-finish-load', resolve);
        });
      }

      // Execute script to detect login status
      const isLoggedIn = await webContents.executeJavaScript(`
        (function() {
          // Method 1: Check for chat list
          const chatList = document.querySelector('[data-testid="chat-list"]') ||
                          document.querySelector('div[role="grid"]') ||
                          document.querySelector('#pane-side');
          
          if (chatList) {
            return true;
          }

          // Method 2: Check for QR code (not logged in)
          const qrCode = document.querySelector('[data-testid="qrcode"]') ||
                        document.querySelector('canvas[aria-label*="QR"]');
          
          if (qrCode) {
            return false;
          }

          // Method 3: Check for main chat area
          const mainChat = document.querySelector('#main') ||
                          document.querySelector('[data-testid="conversation-panel-wrapper"]');
          
          if (mainChat) {
            return true;
          }

          // Default: assume not logged in
          return false;
        })();
      `);

      // Cache the result
      this.setLoginStatus(accountId, isLoggedIn);

      this.log('info', `Login status detected for account ${accountId}: ${isLoggedIn ? 'logged in' : 'not logged in'}`);

      return {
        success: true,
        isLoggedIn
      };
    } catch (error) {
      this.log('error', `Failed to detect login status for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Monitor session health
   * @param {string} accountId - Account ID
   * @param {Electron.BrowserView|Electron.BrowserWindow} viewOrWindow - View or window
   * @param {Function} onStatusChange - Callback when status changes
   * @returns {Object} Monitor object with stop() method
   */
  monitorSessionHealth(accountId, viewOrWindow, onStatusChange) {
    this.log('info', `Starting session health monitoring for account ${accountId}`);

    let lastStatus = null;
    let stopped = false;

    const checkHealth = async () => {
      if (stopped) return;

      try {
        const result = await this.detectLoginStatus(accountId, viewOrWindow);
        
        if (result.success) {
          const currentStatus = result.isLoggedIn;
          
          // If status changed, notify callback
          if (lastStatus !== null && lastStatus !== currentStatus) {
            this.log('info', `Login status changed for account ${accountId}: ${lastStatus} -> ${currentStatus}`);
            if (onStatusChange) {
              onStatusChange(currentStatus);
            }
          }
          
          lastStatus = currentStatus;
        }
      } catch (error) {
        this.log('error', `Health check failed for account ${accountId}:`, error);
      }

      // Schedule next check
      if (!stopped) {
        setTimeout(checkHealth, 30000); // Check every 30 seconds
      }
    };

    // Start monitoring
    checkHealth();

    // Return monitor object
    return {
      stop: () => {
        stopped = true;
        this.log('info', `Stopped session health monitoring for account ${accountId}`);
      }
    };
  }

  /**
   * Validate session
   * @param {string} accountId - Account ID
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async validateSession(accountId) {
    try {
      const accountSession = this.sessionStorage.getSession(accountId);
      
      if (!accountSession) {
        return {
          valid: false,
          error: 'Session not found'
        };
      }

      // Check if session has cookies
      const cookies = await accountSession.cookies.get({});
      
      if (cookies.length === 0) {
        return {
          valid: false,
          error: 'No cookies found in session'
        };
      }

      return { valid: true };
    } catch (error) {
      this.log('error', `Failed to validate session for account ${accountId}:`, error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Recover session
   * @param {string} accountId - Account ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async recoverSession(accountId) {
    try {
      this.log('info', `Attempting to recover session for account ${accountId}`);

      // Validate session first
      const validation = await this.validateSession(accountId);
      
      if (!validation.valid) {
        throw new Error(`Session validation failed: ${validation.error}`);
      }

      // Clear login status cache to force re-detection
      this.clearLoginStatusCache(accountId);

      this.log('info', `Session recovered successfully for account ${accountId}`);

      return { success: true };
    } catch (error) {
      this.log('error', `Failed to recover session for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SessionRecovery;
