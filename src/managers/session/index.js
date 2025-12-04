/**
 * Session Module Entry Point
 * Integrates all session management components
 */

const SessionStorage = require('./SessionStorage');
const SessionRecovery = require('./SessionRecovery');
const SessionValidator = require('./SessionValidator');

/**
 * SessionManager - Integrated session management
 * Maintains backward compatibility with original SessionManager
 */
class SessionManager {
  /**
   * Create session manager
   * @param {Object} [options] - Configuration options
   * @param {string} [options.userDataPath] - User data root directory
   */
  constructor(options = {}) {
    this.userDataPath = options.userDataPath;

    // Create logger
    this.log = this._createLogger();

    // Initialize modules
    this.storage = new SessionStorage(this.userDataPath, this.log);
    this.recovery = new SessionRecovery(this.storage, this.log);
    this.validator = new SessionValidator(this.storage, this.log);

    // Expose caches for backward compatibility
    this.sessionCache = this.storage.sessionCache;
    this.loginStatusCache = this.recovery.loginStatusCache;
    
  }

  /**
   * Create logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [SessionManager] [${level.toUpperCase()}] ${message}`;

      if (level === 'error') {
        console.error(logMessage, ...args);
      } else if (level === 'warn') {
        console.warn(logMessage, ...args);
      } else {
        console.log(logMessage, ...args);
      }
    };
  }

  /**
   * Create session for account
   * @param {string} accountId - Account ID
   * @param {Object} [config] - Configuration options
   * @returns {Promise<{success: boolean, session?: Electron.Session, error?: string}>}
   */
  async createSession(accountId, config = {}) {
    try {
      this.log('info', `Creating session for account ${accountId}`);

      // Validate accountId
      if (!accountId || typeof accountId !== 'string') {
        throw new Error('Invalid accountId: must be a non-empty string');
      }

      // Create session
      const accountSession = this.storage.createSession(accountId);

      

      // Configure session persistence
      await this.storage.configureSessionPersistence(accountId);

      this.log('info', `Session created successfully for account ${accountId}`);

      return {
        success: true,
        session: accountSession
      };
    } catch (error) {
      this.log('error', `Failed to create session for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get session for account
   * @param {string} accountId - Account ID
   * @returns {Electron.Session|null}
   */
  getSession(accountId) {
    return this.storage.getSession(accountId);
  }

  

  /**
   * Get user data directory
   * @param {string} accountId - Account ID
   * @returns {string}
   */
  getUserDataDir(accountId) {
    return this.storage.getUserDataDir(accountId);
  }

  /**
   * Configure session persistence
   * @param {string} accountId - Account ID
   * @returns {Promise<void>}
   */
  async configureSessionPersistence(accountId) {
    return this.storage.configureSessionPersistence(accountId);
  }

  /**
   * Get cached login status
   * @param {string} accountId - Account ID
   * @returns {boolean|null}
   */
  getCachedLoginStatus(accountId) {
    return this.recovery.getCachedLoginStatus(accountId);
  }

  /**
   * Set login status
   * @param {string} accountId - Account ID
   * @param {boolean} isLoggedIn - Whether logged in
   */
  setLoginStatus(accountId, isLoggedIn) {
    return this.recovery.setLoginStatus(accountId, isLoggedIn);
  }

  /**
   * Clear login status cache
   * @param {string} accountId - Account ID
   */
  clearLoginStatusCache(accountId) {
    return this.recovery.clearLoginStatusCache(accountId);
  }

  /**
   * Detect login status
   * @param {string} accountId - Account ID
   * @param {Electron.BrowserView|Electron.BrowserWindow} viewOrWindow - View or window
   * @returns {Promise<{success: boolean, isLoggedIn?: boolean, error?: string}>}
   */
  async detectLoginStatus(accountId, viewOrWindow) {
    return this.recovery.detectLoginStatus(accountId, viewOrWindow);
  }

  /**
   * Monitor session health
   * @param {string} accountId - Account ID
   * @param {Electron.BrowserView|Electron.BrowserWindow} viewOrWindow - View or window
   * @param {Function} onStatusChange - Callback when status changes
   * @returns {Object} Monitor object with stop() method
   */
  monitorSessionHealth(accountId, viewOrWindow, onStatusChange) {
    return this.recovery.monitorSessionHealth(accountId, viewOrWindow, onStatusChange);
  }

  /**
   * Validate session
   * @param {string} accountId - Account ID
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async validateSession(accountId) {
    return this.recovery.validateSession(accountId);
  }

  /**
   * Recover session
   * @param {string} accountId - Account ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async recoverSession(accountId) {
    return this.recovery.recoverSession(accountId);
  }

  /**
   * Clear account cache
   * @param {string} accountId - Account ID
   */
  clearAccountCache(accountId) {
    this.recovery.clearLoginStatusCache(accountId);
    this.storage.clearAccountCache(accountId);
  }

  /**
   * Clear session data
   * @param {string} accountId - Account ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async clearSessionData(accountId) {
    return this.storage.clearSessionData(accountId);
  }

  /**
   * Get instance session (alias for getSession)
   * @param {string} instanceId - Instance ID
   * @returns {Electron.Session}
   */
  getInstanceSession(instanceId) {
    return this.storage.getInstanceSession(instanceId);
  }
}

module.exports = SessionManager;
