/**
 * Preload script for the main window
 * Exposes secure IPC communication to the renderer process
 * 
 * This script provides the context bridge between the main process and the
 * renderer process for account management, view switching, and status updates.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for main window
contextBridge.exposeInMainWorld('electronAPI', {
  // ============================================================================
  // Account Management Methods
  // ============================================================================

  /**
   * Get a single account by ID
   * @param {string} accountId - Account ID
   * @returns {Promise<Object|null>} Account data or null if not found
   */
  getAccount: (accountId) => {
    return ipcRenderer.invoke('get-account', accountId);
  },

  /**
   * Get list of all accounts
   * @returns {Promise<Array>} Array of account objects
   */
  getAccounts: () => {
    return ipcRenderer.invoke('get-accounts');
  },

  /**
   * Get list of all accounts with status information
   * @returns {Promise<Object>} Result with accounts array and status
   */
  listAccounts: () => {
    return ipcRenderer.invoke('account:list');
  },

  /**
   * Create a new account
   * @param {Object} config - Account configuration
   * @returns {Promise<Object>} Result with success status and account data
   */
  createAccount: (config) => {
    return ipcRenderer.invoke('create-account', config);
  },

  /**
   * Update an existing account
   * @param {string} accountId - Account ID
   * @param {Object} updates - Account updates
   * @returns {Promise<Object>} Result with success status and updated account
   */
  updateAccount: (accountId, updates) => {
    return ipcRenderer.invoke('update-account', accountId, updates);
  },

  /**
   * Delete an account
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Delete options (deleteUserData, etc.)
   * @returns {Promise<Object>} Result with success status
   */
  deleteAccount: (accountId, options) => {
    return ipcRenderer.invoke('delete-account', accountId, options);
  },

  /**
   * Reorder accounts in sidebar
   * @param {Array<string>} accountIds - Ordered array of account IDs
   * @returns {Promise<Object>} Result with success status
   */
  reorderAccounts: (accountIds) => {
    return ipcRenderer.invoke('account:reorder', accountIds);
  },

  /**
   * Open account creation dialog
   */
  openCreateAccountDialog: () => {
    ipcRenderer.send('account:create');
  },

  /**
   * Open account edit dialog
   * @param {string} accountId - Account ID to edit
   */
  openEditAccountDialog: (accountId) => {
    ipcRenderer.send('account:edit', accountId);
  },

  // ============================================================================
  // View Switching Methods
  // ============================================================================

  /**
   * Switch to a different account view
   * @param {string} accountId - Account ID to switch to
   * @returns {Promise<Object>} Result with success status
   */
  switchAccount: (accountId) => {
    return ipcRenderer.invoke('switch-account', accountId);
  },

  /**
   * Switch to account by index (for keyboard shortcuts)
   * @param {number} index - Account index (0-based)
   * @returns {Promise<Object>} Result with success status
   */
  switchAccountByIndex: (index) => {
    return ipcRenderer.invoke('switch-account-by-index', index);
  },

  /**
   * Switch to next account
   * @returns {Promise<Object>} Result with success status
   */
  switchToNextAccount: () => {
    return ipcRenderer.invoke('switch-to-next-account');
  },

  /**
   * Switch to previous account
   * @returns {Promise<Object>} Result with success status
   */
  switchToPreviousAccount: () => {
    return ipcRenderer.invoke('switch-to-previous-account');
  },

  /**
   * Get current active account
   * @returns {Promise<Object>} Result with active account ID and data
   */
  getActiveAccount: () => {
    return ipcRenderer.invoke('account:get-active');
  },

  /**
   * Restore active account from saved state
   * @returns {Promise<Object>} Result with success status and account ID
   */
  restoreActiveAccount: () => {
    return ipcRenderer.invoke('restore-active-account');
  },

  // ============================================================================
  // Manual Account Control Methods
  // ============================================================================

  /**
   * Open an account - Create and display BrowserView
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Result with success status
   */
  openAccount: (accountId) => {
    return ipcRenderer.invoke('open-account', accountId);
  },

  /**
   * Close an account - Destroy BrowserView and release resources
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Result with success status
   */
  closeAccount: (accountId) => {
    return ipcRenderer.invoke('close-account', accountId);
  },

  /**
   * Get account status (running status)
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Account status information
   */
  getAccountStatus: (accountId) => {
    return ipcRenderer.invoke('get-account-status', accountId);
  },

  /**
   * Get all account statuses
   * @returns {Promise<Object>} All account statuses
   */
  getAllAccountStatuses: () => {
    return ipcRenderer.invoke('get-all-account-statuses');
  },

  // ============================================================================
  // View Status Methods
  // ============================================================================

  /**
   * Get view status for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} View status information
   */
  getViewStatus: (accountId) => {
    return ipcRenderer.invoke('account:view-status', accountId);
  },

  /**
   * Reload a view
   * @param {string} accountId - Account ID
   * @param {boolean} [ignoreCache=false] - Whether to ignore cache
   * @returns {Promise<Object>} Result with success status
   */
  reloadView: (accountId, ignoreCache = false) => {
    return ipcRenderer.invoke('account:reload-view', accountId, ignoreCache);
  },

  /**
   * Recreate a view (destroy and create again)
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Result with success status
   */
  recreateView: (accountId) => {
    return ipcRenderer.invoke('account:recreate-view', accountId);
  },

  /**
   * Load a specific URL in a view
   * @param {string} accountId - Account ID
   * @param {string} url - URL to load
   * @returns {Promise<Object>} Result with success status
   */
  loadURL: (accountId, url) => {
    return ipcRenderer.invoke('account:load-url', accountId, url);
  },

  // ============================================================================
  // Login Status Methods
  // ============================================================================

  /**
   * Get login status for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Login status information
   */
  getLoginStatus: (accountId) => {
    return ipcRenderer.invoke('account:login-status', accountId);
  },

  /**
   * Check login status for an account (manual check)
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Login status check result
   */
  checkLoginStatus: (accountId) => {
    return ipcRenderer.invoke('account:check-login-status', accountId);
  },

  /**
   * Start login status monitoring for an account
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Monitoring options
   * @returns {Promise<Object>} Result with success status
   */
  startLoginStatusMonitoring: (accountId, options) => {
    return ipcRenderer.invoke('account:start-login-status-monitoring', accountId, options);
  },

  /**
   * Stop login status monitoring for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Result with success status
   */
  stopLoginStatusMonitoring: (accountId) => {
    return ipcRenderer.invoke('account:stop-login-status-monitoring', accountId);
  },

  /**
   * Start login status monitoring for all accounts
   * @param {Object} [options] - Monitoring options
   * @returns {Promise<Object>} Result with success status
   */
  startAllLoginStatusMonitoring: (options) => {
    return ipcRenderer.invoke('account:start-all-login-status-monitoring', options);
  },

  /**
   * Stop login status monitoring for all accounts
   * @returns {Promise<Object>} Result with success status
   */
  stopAllLoginStatusMonitoring: () => {
    return ipcRenderer.invoke('account:stop-all-login-status-monitoring');
  },

  // ============================================================================
  // Connection Status Methods
  // ============================================================================

  /**
   * Get connection status for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Connection status information
   */
  getConnectionStatus: (accountId) => {
    return ipcRenderer.invoke('account:connection-status', accountId);
  },

  /**
   * Check connection status for an account (manual check)
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Connection status check result
   */
  checkConnectionStatus: (accountId) => {
    return ipcRenderer.invoke('account:check-connection-status', accountId);
  },

  /**
   * Start connection monitoring for an account
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Monitoring options
   * @returns {Promise<Object>} Result with success status
   */
  startConnectionMonitoring: (accountId, options) => {
    return ipcRenderer.invoke('account:start-connection-monitoring', accountId, options);
  },

  /**
   * Stop connection monitoring for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Result with success status
   */
  stopConnectionMonitoring: (accountId) => {
    return ipcRenderer.invoke('account:stop-connection-monitoring', accountId);
  },

  /**
   * Start connection monitoring for all accounts
   * @param {Object} [options] - Monitoring options
   * @returns {Promise<Object>} Result with success status
   */
  startAllConnectionMonitoring: (options) => {
    return ipcRenderer.invoke('account:start-all-connection-monitoring', options);
  },

  /**
   * Stop connection monitoring for all accounts
   * @returns {Promise<Object>} Result with success status
   */
  stopAllConnectionMonitoring: () => {
    return ipcRenderer.invoke('account:stop-all-connection-monitoring');
  },

  // ============================================================================
  // Session Management Methods
  // ============================================================================

  /**
   * Force logout an account (clear session data)
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Result with success status
   */
  forceLogout: (accountId) => {
    return ipcRenderer.invoke('account:force-logout', accountId);
  },

  /**
   * Handle session expiration for an account
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Handling options
   * @returns {Promise<Object>} Result with success status
   */
  handleSessionExpiration: (accountId, options) => {
    return ipcRenderer.invoke('account:handle-session-expiration', accountId, options);
  },

  /**
   * Check session expiration for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Session expiration check result
   */
  checkSessionExpiration: (accountId) => {
    return ipcRenderer.invoke('account:check-session-expiration', accountId);
  },

  /**
   * Get session persistence status for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Session persistence status
   */
  getSessionPersistenceStatus: (accountId) => {
    return ipcRenderer.invoke('account:session-persistence-status', accountId);
  },

  /**
   * Restore login states for all accounts
   * @returns {Promise<Object>} Restoration result
   */
  restoreAllLoginStates: () => {
    return ipcRenderer.invoke('account:restore-all-login-states');
  },

  /**
   * Start session health monitoring for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Result with success status
   */
  startSessionMonitoring: (accountId) => {
    return ipcRenderer.invoke('account:start-session-monitoring', accountId);
  },

  // ============================================================================
  // Window and Layout Methods
  // ============================================================================

  /**
   * Get current view bounds
   * @returns {Promise<Object>} View bounds information
   */
  getViewBounds: () => {
    return ipcRenderer.invoke('get-view-bounds');
  },

  /**
   * Get saved sidebar width
   * @returns {Promise<Object>} Sidebar width
   */
  getSidebarWidth: () => {
    return ipcRenderer.invoke('get-sidebar-width');
  },

  /**
   * Get saved translation panel layout
   * @returns {Promise<Object>} Translation panel layout
   */
  getTranslationPanelLayout: () => {
    return ipcRenderer.invoke('get-translation-panel-layout');
  },

  /**
   * Get saved active account ID
   * @returns {Promise<Object>} Active account ID
   */
  getActiveAccountId: () => {
    return ipcRenderer.invoke('get-active-account-id');
  },

  /**
   * Notify main process about sidebar resize
   * @param {number} sidebarWidth - New sidebar width
   */
  notifySidebarResized: (sidebarWidth) => {
    ipcRenderer.send('sidebar-resized', sidebarWidth);
  },

  /**
   * Notify main process about translation panel layout change
   * @param {Object} payload - Layout payload
   */
  notifyTranslationPanelResized: (payload) => {
    ipcRenderer.send('translation-panel-resized', payload);
  },

  /**
   * Notify main process about window resize completion
   */
  notifyWindowResizeComplete: () => {
    ipcRenderer.send('window-resize-complete');
  },

  // ============================================================================
  // Environment Settings Methods
  // ============================================================================

  /**
   * Get environment configuration for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Environment configuration
   */
  getEnvironmentConfig: (accountId) => {
    return ipcRenderer.invoke('env:get-config', accountId);
  },

  /**
   * Save environment configuration for an account
   * @param {string} accountId - Account ID
   * @param {Object} config - Configuration object
   * @returns {Promise<Object>} Result
   */
  saveEnvironmentConfig: (accountId, config) => {
    return ipcRenderer.invoke('env:save-config', accountId, config);
  },

  /**
   * Test a proxy configuration
   * @param {Object} config - Proxy configuration
   * @returns {Promise<Object>} Test result
   */
  testProxy: (config) => {
    return ipcRenderer.invoke('env:test-proxy', config);
  },

  /**
   * Detect current network (test without proxy)
   * @returns {Promise<Object>} Test result
   */
  detectNetwork: () => {
    return ipcRenderer.invoke('env:detect-network');
  },

  // Note: 指纹API已在专业指纹系统重构中重新实现
  // 请参阅上方的 Fingerprint Management Methods 部分

  /**
   * Get saved named proxy configurations
   * @returns {Promise<Array>} Array of proxy configs
   */
  getProxyConfigs: () => {
    return ipcRenderer.invoke('env:get-proxy-configs');
  },

  /**
   * Save a named proxy configuration
   * @param {string} name - Configuration name
   * @param {Object} config - Proxy configuration
   * @returns {Promise<Object>} Result
   */
  saveProxyConfig: (name, config) => {
    return ipcRenderer.invoke('env:save-proxy-config', name, config);
  },

  /**
   * Delete a named proxy configuration
   * @param {string} name - Configuration name
   * @returns {Promise<Object>} Result
   */
  deleteNamedProxy: (name) => {
    return ipcRenderer.invoke('env:delete-proxy-config', name);
  },

  /**
   * Parse proxy string
   * @param {string} proxyString - Proxy string
   * @returns {Promise<Object>} Result
   */
  parseProxyString: (proxyString) => {
    return ipcRenderer.invoke('env:parse-proxy-string', proxyString);
  },

  // ============================================================================
  // Fingerprint Management Methods
  // ============================================================================

  /**
   * Generate a new fingerprint configuration
   * @param {Object} [options] - Generation options (os, browser, etc.)
   * @returns {Promise<Object>} Result with generated fingerprint config
   */
  generateFingerprint: (options = {}) => {
    return ipcRenderer.invoke('fingerprint:generate', options);
  },

  /**
   * Save a fingerprint configuration for an account
   * @param {string} accountId - Account ID
   * @param {Object} config - Fingerprint configuration
   * @returns {Promise<Object>} Result with success status
   */
  saveFingerprint: (accountId, config) => {
    return ipcRenderer.invoke('fingerprint:save', accountId, config);
  },

  /**
   * Get fingerprint configuration for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Result with fingerprint config
   */
  getFingerprint: (accountId) => {
    return ipcRenderer.invoke('fingerprint:get', accountId);
  },

  /**
   * Validate a fingerprint configuration
   * @param {Object} config - Fingerprint configuration to validate
   * @returns {Promise<Object>} Validation result with errors and suggestions
   */
  validateFingerprint: (config) => {
    return ipcRenderer.invoke('fingerprint:validate', config);
  },

  /**
   * Apply fingerprint configuration to an account (generate injection scripts)
   * @param {string} accountId - Account ID
   * @param {Object} [options] - Apply options
   * @returns {Promise<Object>} Result with injection scripts
   */
  applyFingerprint: (accountId, options = {}) => {
    return ipcRenderer.invoke('fingerprint:apply', accountId, options);
  },

  deleteFingerprint: (accountId) => {
    return ipcRenderer.invoke('fingerprint:delete', accountId);
  },
  updateFingerprint: (accountId) => {
    return ipcRenderer.invoke('fingerprint:update', accountId);
  },

  /**
   * Get fingerprint preview (summary of how fingerprint appears to websites)
   * @param {Object} config - Fingerprint configuration
   * @returns {Promise<Object>} Preview data
   */
  previewFingerprint: (config) => {
    return ipcRenderer.invoke('fingerprint:preview', config);
  },

  /**
   * Get injection script for a fingerprint configuration (without saving)
   * @param {Object} config - Fingerprint configuration
   * @param {Object} [options] - Script generation options
   * @returns {Promise<Object>} Result with injection script
   */
  getFingerprintScript: (config, options = {}) => {
    return ipcRenderer.invoke('fingerprint:getScript', config, options);
  },

  /**
   * Load all fingerprint configurations (for app startup)
   * @returns {Promise<Object>} Result with all fingerprint configs
   */
  loadAllFingerprints: () => {
    return ipcRenderer.invoke('fingerprint:loadAll');
  },

  // ============================================================================
  // Fingerprint Template Methods
  // ============================================================================

  /**
   * Create a fingerprint template
   * @param {Object} options - Template options (name, description, config)
   * @returns {Promise<Object>} Result with created template
   */
  createFingerprintTemplate: (options) => {
    return ipcRenderer.invoke('fingerprint:template:create', options);
  },

  /**
   * Apply a fingerprint template to an account
   * @param {string} templateId - Template ID
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Result with applied config
   */
  applyFingerprintTemplate: (templateId, accountId) => {
    return ipcRenderer.invoke('fingerprint:template:apply', templateId, accountId);
  },

  /**
   * Export a fingerprint template to JSON
   * @param {string} templateId - Template ID
   * @param {Object} [options] - Export options (includeSeed, etc.)
   * @returns {Promise<Object>} Result with exported JSON data
   */
  exportFingerprintTemplate: (templateId, options = {}) => {
    return ipcRenderer.invoke('fingerprint:template:export', templateId, options);
  },

  /**
   * Import a fingerprint template from JSON
   * @param {string} jsonData - JSON data string
   * @param {Object} [options] - Import options
   * @returns {Promise<Object>} Result with imported template
   */
  importFingerprintTemplate: (jsonData, options = {}) => {
    return ipcRenderer.invoke('fingerprint:template:import', jsonData, options);
  },

  /**
   * Delete a fingerprint template
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>} Result with success status
   */
  deleteFingerprintTemplate: (templateId) => {
    return ipcRenderer.invoke('fingerprint:template:delete', templateId);
  },

  /**
   * List all fingerprint templates
   * @param {Object} [options] - List options (filter, sort, etc.)
   * @returns {Promise<Object>} Result with templates array
   */
  listFingerprintTemplates: (options = {}) => {
    return ipcRenderer.invoke('fingerprint:template:list', options);
  },

  /**
   * Get a specific fingerprint template
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>} Result with template data
   */
  getFingerprintTemplate: (templateId) => {
    return ipcRenderer.invoke('fingerprint:template:get', templateId);
  },

  // ============================================================================
  // Fingerprint Test Methods
  // ============================================================================

  /**
   * Run fingerprint detection tests
   * @param {Object} config - Fingerprint configuration to test
   * @param {Object} [options] - Test options
   * @returns {Promise<Object>} Test report with results
   */
  runFingerprintTests: (config, options = {}) => {
    return ipcRenderer.invoke('fingerprint:test:run', config, options);
  },

  // ============================================================================

  // Translation Helpers
  // ============================================================================

  /**
   * Get active chat info from the current WhatsApp view
   * @returns {Promise<Object>} Active chat info
   */
  getActiveChatInfo: () => {
    return ipcRenderer.invoke('translation:get-active-chat');
  },

  /**
   * Apply translation configuration to a view
   * @param {string} accountId - Account ID
   * @param {Object} config - Configuration object
   * @returns {Promise<Object>} Result with success status
   */
  applyTranslationConfig: (accountId, config) => {
    return ipcRenderer.invoke('translation:apply-config', accountId, config);
  },

  /**
   * Generic invoke method for IPC communication
   * @param {string} channel - IPC channel
   * @param {...any} args - Arguments to pass
   * @returns {Promise<any>} Result from main process
   */
  invoke: async (channel, ...args) => {
    // Whitelist of allowed invoke channels
    const validChannels = [
      'get-account',
      'get-accounts',
      'account:list',
      'create-account',
      'update-account',
      'delete-account',
      'switch-account',
      'switch-account-by-index',
      'switch-to-next-account',
      'switch-to-previous-account',
      'account:get-active',
      'account:get-profile',
      'account:reorder',
      'reorder-accounts',
      'account:view-status',
      'account:reload-view',
      'account:login-status',
      'account:load-url',
      'get-view-bounds',
      'get-sidebar-width',
      'get-translation-panel-layout',
      'get-active-account-id',
      'restore-active-account',
      'account:force-logout',
      'account:handle-session-expiration',
      'account:check-session-expiration',
      'account:session-persistence-status',
      'account:restore-all-login-states',
      'account:start-session-monitoring',
      'account:connection-status',
      'account:check-connection-status',
      'account:start-connection-monitoring',
      'account:stop-connection-monitoring',
      'account:start-all-connection-monitoring',
      'account:stop-all-connection-monitoring',
      'account:check-login-status',
      'account:start-login-status-monitoring',
      'account:stop-login-status-monitoring',
      'account:start-all-login-status-monitoring',
      'account:stop-all-login-status-monitoring',
      'open-account',
      'close-account',
      'get-account-status',
      'get-all-account-statuses',
      'translation:get-active-chat',
      'translation:apply-config',
      'recovery:recover-session',
      'recovery:reset-account',
      'recovery:reconnect',
      'recovery:start-auto-reconnect',
      'recovery:stop-auto-reconnect',
      'env:get-config',
      'env:save-config',
      'env:test-proxy',
      'env:detect-network',
      // Note: 指纹相关channels已在上方添加（fingerprint:*）
      'env:get-proxy-configs',
      'env:save-proxy-config',
      'env:delete-proxy-config',
      'env:parse-proxy-string',
      // Fingerprint channels
      'fingerprint:generate',
      'fingerprint:save',
      'fingerprint:get',
      'fingerprint:validate',
      'fingerprint:apply',
      'fingerprint:delete',
      'fingerprint:preview',
      'fingerprint:getScript',
      'fingerprint:loadAll',
      'fingerprint:update',
      // Fingerprint template channels
      'fingerprint:template:create',
      'fingerprint:template:apply',
      'fingerprint:template:export',
      'fingerprint:template:import',
      'fingerprint:template:delete',
      'fingerprint:template:list',
      'fingerprint:template:get',
      // Fingerprint test channels
      'fingerprint:test:run',
      'recovery:start-monitor',
      'recovery:stop-monitor',
      'recovery:get-status',
      'recovery:get-all-status',
      'recovery:retry-operation'
    ];

    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, ...args);
    } else {
      console.warn(`[Preload] Attempted to invoke invalid channel: ${channel}`);
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
  },

  /**
   * Generic send method for IPC communication
   * @param {string} channel - IPC channel
   * @param {...any} args - Arguments to pass
   */
  send: (channel, ...args) => {
    // Whitelist of allowed send channels
    const validChannels = [
      'account:create',
      'account:edit',
      'sidebar-resized',
      'translation-panel-resized',
      'window-resize-complete',
      'ui-ready'
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      console.warn(`[Preload] Attempted to send to invalid channel: ${channel}`);
    }
  },

  // ============================================================================
  // Event Listeners (Receive from Main Process)
  // ============================================================================

  /**
   * Listen for events from main process
   * @param {string} channel - Event channel
   * @param {Function} callback - Callback function
   */
  on: (channel, callback) => {
    // Whitelist of allowed channels for receiving events
    const validChannels = [
      'accounts-updated',
      'account:list-updated',
      'account:active-changed',
      'account:logged-out',
      'account:login-states-restored',
      'account:operation-start',
      'account:operation-complete',
      'account:operation-error',
      'view-ready',
      'view-error',
      'login-status-changed',
      'login-status-restored',
      'connection-status-changed',
      'window-resize',
      'window-resized',
      'account-switched',
      'account-status-changed',
      'translation-config-updated',
      'translation-panel:state-changed',
      'translation:chat-switched',
      'view-manager:view-loading',
      'view-manager:view-ready',
      'view-manager:view-error',
      'view-manager:login-status-changed',
      'view-manager:view-crashed',
      'view-manager:connection-status-changed',
      'view-manager:view-switching',
      'view-manager:view-switched',
      'view-manager:view-switch-failed',
      'view-manager:account-opening',
      'view-manager:account-opened',
      'view-manager:account-open-failed',
      'view-manager:account-closing',
      'view-manager:account-closed',
      'view-manager:account-close-failed',
      'view-manager:account-profile-updated'
    ];

    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    } else {
      console.warn(`[Preload] Attempted to listen to invalid channel: ${channel}`);
    }
  },

  /**
   * Remove event listener
   * @param {string} channel - Event channel
   * @param {Function} callback - Callback function to remove
   */
  removeListener: (channel, callback) => {
    const validChannels = [
      'accounts-updated',
      'account:list-updated',
      'account:active-changed',
      'account:logged-out',
      'account:login-states-restored',
      'account:operation-start',
      'account:operation-complete',
      'account:operation-error',
      'view-ready',
      'view-error',
      'login-status-changed',
      'login-status-restored',
      'connection-status-changed',
      'window-resize',
      'window-resized',
      'account-switched',
      'account-status-changed',
      'translation-config-updated',
      'translation-panel:state-changed',
      'translation:chat-switched',
      'view-manager:view-loading',
      'view-manager:view-ready',
      'view-manager:view-error',
      'view-manager:login-status-changed',
      'view-manager:view-crashed',
      'view-manager:connection-status-changed',
      'view-manager:view-switching',
      'view-manager:view-switched',
      'view-manager:view-switch-failed',
      'view-manager:account-opening',
      'view-manager:account-opened',
      'view-manager:account-open-failed',
      'view-manager:account-closing',
      'view-manager:account-closed',
      'view-manager:account-close-failed',
      'view-manager:account-profile-updated'
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },

  /**
   * Remove all listeners for a channel
   * @param {string} channel - Event channel
   */
  removeAllListeners: (channel) => {
    const validChannels = [
      'accounts-updated',
      'account:list-updated',
      'account:active-changed',
      'account:logged-out',
      'account:login-states-restored',
      'account:operation-start',
      'account:operation-complete',
      'account:operation-error',
      'view-ready',
      'view-error',
      'login-status-changed',
      'login-status-restored',
      'connection-status-changed',
      'window-resize',
      'window-resized',
      'account-switched',
      'account-status-changed',
      'translation-config-updated',
      'translation-panel:state-changed',
      'view-manager:view-loading',
      'view-manager:view-ready',
      'view-manager:view-error',
      'view-manager:login-status-changed',
      'view-manager:view-crashed',
      'view-manager:connection-status-changed',
      'view-manager:view-switching',
      'view-manager:view-switched',
      'view-manager:view-switch-failed',
      'view-manager:account-opening',
      'view-manager:account-opened',
      'view-manager:account-open-failed',
      'view-manager:account-closing',
      'view-manager:account-closed',
      'view-manager:account-close-failed',
      'view-manager:view-switch-failed',
      'view-manager:account-profile-updated'
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },

  // ============================================================================
  // Error Handling Methods
  // ============================================================================

  /**
   * Listen for account-specific errors
   * @param {Function} callback - Callback function (data) => void
   * @returns {Function} Cleanup function to remove listener
   */
  onAccountError: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('account-error', listener);
    return () => ipcRenderer.removeListener('account-error', listener);
  },

  /**
   * Listen for global errors
   * @param {Function} callback - Callback function (data) => void
   * @returns {Function} Cleanup function to remove listener
   */
  onGlobalError: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('global-error', listener);
    return () => ipcRenderer.removeListener('global-error', listener);
  },

  /**
   * Listen for error cleared events
   * @param {Function} callback - Callback function (data) => void
   * @returns {Function} Cleanup function to remove listener
   */
  onErrorCleared: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('error-cleared', listener);
    return () => ipcRenderer.removeListener('error-cleared', listener);
  }
});

// Expose translation API to renderer (mirrors content script interface)
// Note: The IPCRouter expects payload as a single object, so we wrap parameters accordingly
contextBridge.exposeInMainWorld('translationAPI', {
  translate: (request) => ipcRenderer.invoke('translation:translate', request),
  detectLanguage: (text) => ipcRenderer.invoke('translation:detectLanguage', text),
  getConfig: (accountId) => ipcRenderer.invoke('translation:getConfig', accountId),
  // saveConfig expects { accountId, config } as payload
  saveConfig: (accountId, config) => ipcRenderer.invoke('translation:saveConfig', { accountId, config }),
  getStats: () => ipcRenderer.invoke('translation:getStats'),
  clearCache: (accountId = null) => ipcRenderer.invoke('translation:clearCache', accountId),
  // saveEngineConfig expects { engineName, config } as payload
  saveEngineConfig: (engineName, config) => ipcRenderer.invoke('translation:saveEngineConfig', { engineName, config }),
  getEngineConfig: (engineName) => ipcRenderer.invoke('translation:getEngineConfig', engineName)
});

// Log that preload script has loaded
console.log('[Preload] Main window preload script loaded');
console.log('[Preload] electronAPI exposed to renderer');

