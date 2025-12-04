/**
 * SessionStorage - Session storage and persistence
 * Handles session data storage, retrieval, and cleanup
 */

const { session } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class SessionStorage {
  constructor(userDataPath, logger) {
    this.userDataPath = userDataPath;
    this.log = logger;
    this.sessionCache = new Map();
  }

  /**
   * Create or get account session
   * @param {string} accountId - Account ID
   * @returns {Electron.Session}
   */
  getSession(accountId) {
    // Get from cache first
    if (this.sessionCache.has(accountId)) {
      return this.sessionCache.get(accountId);
    }

    // If not in cache, try to get from partition
    try {
      const partition = `persist:account_${accountId}`;
      const accountSession = session.fromPartition(partition);
      this.sessionCache.set(accountId, accountSession);
      return accountSession;
    } catch (error) {
      this.log('error', `Failed to get session for account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Create session for account
   * @param {string} accountId - Account ID
   * @returns {Electron.Session}
   */
  createSession(accountId) {
    if (!accountId || typeof accountId !== 'string') {
      throw new Error('Invalid accountId: must be a non-empty string');
    }

    const partition = `persist:account_${accountId}`;
    const accountSession = session.fromPartition(partition);

    // Cache session instance
    this.sessionCache.set(accountId, accountSession);

    return accountSession;
  }

  /**
   * Get user data directory for account
   * @param {string} accountId - Account ID
   * @returns {string}
   */
  getUserDataDir(accountId) {
    return path.join(this.userDataPath, 'profiles', accountId);
  }

  /**
   * Configure session persistence
   * @param {string} accountId - Account ID
   * @returns {Promise<void>}
   */
  async configureSessionPersistence(accountId) {
    try {
      const accountSession = this.getSession(accountId);
      if (!accountSession) {
        throw new Error(`Session not found for account ${accountId}`);
      }

      // Configure session persistence options
      const userDataDir = this.getUserDataDir(accountId);

      // Ensure directory exists
      await fs.mkdir(userDataDir, { recursive: true });

      this.log('info', `Session persistence configured for account ${accountId}`);
    } catch (error) {
      this.log('error', `Failed to configure session persistence for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Clear account cache
   * @param {string} accountId - Account ID
   */
  clearAccountCache(accountId) {
    this.sessionCache.delete(accountId);
  }

  /**
   * Clear all session data for account
   * @param {string} accountId - Account ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async clearSessionData(accountId) {
    try {
      this.log('info', `Clearing session data for account ${accountId}`);

      const accountSession = this.getSession(accountId);
      if (!accountSession) {
        throw new Error(`Session not found for account ${accountId}`);
      }

      // Clear all session data
      await accountSession.clearStorageData({
        storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
      });

      // Clear cache
      await accountSession.clearCache();

      // Remove from cache
      this.clearAccountCache(accountId);

      this.log('info', `Session data cleared successfully for account ${accountId}`);

      return { success: true };
    } catch (error) {
      this.log('error', `Failed to clear session data for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get instance session (alias for getSession)
   * @param {string} instanceId - Instance ID
   * @returns {Electron.Session}
   */
  getInstanceSession(instanceId) {
    return this.getSession(instanceId);
  }
}

module.exports = SessionStorage;
