/**
 * TranslationServiceIPCHandlers - Translation Service IPC Handlers for IPCRouter
 * 
 * Handles 13 translation IPC channels using the new IPCRouter architecture
 * with request validation and error handling.
 * 
 * IPC Channels:
 * - translation:translate - Translate text
 * - translation:detectLanguage - Detect language
 * - translation:getConfig - Get account config
 * - translation:saveConfig - Save account config
 * - translation:getStats - Get statistics
 * - translation:clearCache - Clear cache
 * - translation:saveEngineConfig - Save engine config
 * - translation:getEngineConfig - Get engine config
 * - translation:clearHistory - Clear translation history
 * - translation:clearUserData - Clear user data
 * - translation:clearAllData - Clear all data
 * - translation:getPrivacyReport - Get privacy report
 * - translation:getAccountStats - Get account stats
 * 
 * @module presentation/ipc/handlers/TranslationServiceIPCHandlers
 */

'use strict';

const { EventSchema } = require('../../../core/eventbus/EventSchema');
const { BrowserView } = require('electron');

// Store reference to translation service
let _translationService = null;

/**
 * Request schemas for validation
 */
const schemas = {
  translate: new EventSchema({
    type: 'object',
    properties: {
      accountId: { type: 'string', required: true },
      text: { type: 'string', required: true },
      sourceLang: { type: 'string' },
      targetLang: { type: 'string' },
      engineName: { type: 'string' },
      options: { type: 'object' }
    }
  }),
  
  detectLanguage: new EventSchema({
    type: 'string',
    required: true
  }),
  
  getConfig: new EventSchema({
    type: 'string',
    required: true
  }),
  
  saveConfig: new EventSchema({
    type: 'object',
    properties: {
      accountId: { type: 'string', required: true },
      config: { type: 'object', required: true }
    }
  }),
  
  clearCache: new EventSchema({
    type: 'string'  // accountId is optional
  }),
  
  saveEngineConfig: new EventSchema({
    type: 'object',
    properties: {
      engineName: { type: 'string', required: true },
      config: { type: 'object', required: true }
    }
  }),
  
  getEngineConfig: new EventSchema({
    type: 'string',
    required: true
  }),
  
  getAccountStats: new EventSchema({
    type: 'string',
    required: true
  })
};

/**
 * Handler implementations
 */
const handlers = {
  /**
   * Translate text
   */
  async translate(request) {
    const { accountId, text, sourceLang, targetLang, engineName, options } = request.payload;
    
    if (!accountId) {
      throw new Error('Account ID is required for translation requests');
    }
    
    // Get account-specific translation config
    const accountConfig = _translationService.getConfig(accountId);
    
    // Merge account config with request options
    const mergedOptions = {
      ...options,
      accountId,
      ...accountConfig
    };
    
    // Use account-specific engine if not specified
    const effectiveEngine = engineName || accountConfig.engine || 'google';
    const effectiveTargetLang = targetLang || accountConfig.targetLanguage || 'zh-CN';
    
    const result = await _translationService.translate(
      text,
      sourceLang || 'auto',
      effectiveTargetLang,
      effectiveEngine,
      mergedOptions
    );

    return {
      success: true,
      data: result,
      accountId
    };
  },

  /**
   * Detect language
   */
  async detectLanguage(request) {
    const text = request.payload;
    const lang = await _translationService.detectLanguage(text);
    return {
      success: true,
      data: lang
    };
  },

  /**
   * Get account config
   */
  async getConfig(request) {
    const accountId = request.payload;
    
    if (!accountId) {
      throw new Error('Account ID is required to get translation config');
    }
    
    const config = _translationService.getConfig(accountId);
    return {
      success: true,
      data: config,
      accountId
    };
  },

  /**
   * Save account config
   */
  async saveConfig(request) {
    const { accountId, config } = request.payload;
    
    if (!accountId) {
      throw new Error('Account ID is required to save translation config');
    }
    
    _translationService.saveConfig(accountId, config);
    console.log(`[IPC:Translation] Translation config saved for account ${accountId}`);
    
    // Notify corresponding BrowserView about config change
    await notifyBrowserViewConfigChanged(accountId, config);
    
    return {
      success: true,
      accountId
    };
  },

  /**
   * Get statistics
   */
  async getStats() {
    const stats = _translationService.getStats();
    return {
      success: true,
      data: stats
    };
  },

  /**
   * Clear cache
   */
  async clearCache(request) {
    const accountId = request.payload || null;
    
    if (accountId) {
      await _translationService.cacheManager.clearByAccount(accountId);
      console.log(`[IPC:Translation] Translation cache cleared for account ${accountId}`);
      return {
        success: true,
        accountId
      };
    } else {
      await _translationService.cacheManager.clear();
      console.log('[IPC:Translation] All translation cache cleared');
      return {
        success: true
      };
    }
  },

  /**
   * Save engine config
   */
  async saveEngineConfig(request) {
    const { engineName, config } = request.payload;
    
    _translationService.configManager.saveEngineConfig(engineName, config);
    console.log(`[IPC:Translation] Saved engine config for: ${engineName}`);
    
    // Force re-register engines
    _translationService.registerEngines();
    console.log('[IPC:Translation] Engines reregistered with new config');
    
    return {
      success: true
    };
  },

  /**
   * Get engine config
   */
  async getEngineConfig(request) {
    const engineName = request.payload;
    const config = _translationService.configManager.getEngineConfig(engineName);
    return {
      success: true,
      data: config
    };
  },

  /**
   * Clear translation history (privacy)
   */
  async clearHistory() {
    await _translationService.clearTranslationHistory();
    return {
      success: true,
      message: 'Translation history cleared successfully'
    };
  },

  /**
   * Clear user data (privacy)
   */
  async clearUserData() {
    await _translationService.clearAllUserData();
    return {
      success: true,
      message: 'User data cleared successfully'
    };
  },

  /**
   * Clear all data (privacy)
   */
  async clearAllData() {
    await _translationService.clearAllData();
    return {
      success: true,
      message: 'All data cleared successfully'
    };
  },

  /**
   * Get privacy report
   */
  async getPrivacyReport() {
    const report = _translationService.getPrivacyReport();
    return {
      success: true,
      data: report
    };
  },

  /**
   * Get account stats
   */
  async getAccountStats(request) {
    const accountId = request.payload;
    
    if (!accountId) {
      throw new Error('Account ID is required to get translation stats');
    }
    
    const stats = _translationService.getStats();
    return {
      success: true,
      data: stats,
      accountId
    };
  }
};

/**
 * Notify BrowserView about config change
 * @param {string} accountId - Account ID
 * @param {Object} config - New configuration
 */
async function notifyBrowserViewConfigChanged(accountId, config) {
  try {
    const allViews = BrowserView.getAllViews();
    
    for (const view of allViews) {
      if (view && view.webContents && !view.webContents.isDestroyed()) {
        try {
          // Get the account ID from the view's window context
          const viewAccountId = await view.webContents.executeJavaScript('window.ACCOUNT_ID').catch(() => null);
          
          if (viewAccountId === accountId) {
            console.log(`[IPC:Translation] Notifying BrowserView for account ${accountId} about config change`);
            view.webContents.send('translation:configChanged', config);
          }
        } catch (err) {
          // Ignore errors for individual views (e.g., view might be loading)
          console.debug(`[IPC:Translation] Could not check view for account ID: ${err.message}`);
        }
      }
    }
  } catch (error) {
    console.error(`[IPC:Translation] Error notifying BrowserView about config change:`, error);
  }
}

/**
 * Wraps a handler with error handling
 * @param {Function} handler - Handler function
 * @param {string} name - Handler name for logging
 * @returns {Function} Wrapped handler
 */
function wrapHandler(handler, name) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error(`[IPC:Translation] ${name} error:`, error);
      return {
        success: false,
        error: error.message,
        accountId: request.payload?.accountId
      };
    }
  };
}

/**
 * List of all translation IPC channels
 */
const TRANSLATION_CHANNELS = [
  'translation:translate',
  'translation:detectLanguage',
  'translation:getConfig',
  'translation:saveConfig',
  'translation:getStats',
  'translation:clearCache',
  'translation:saveEngineConfig',
  'translation:getEngineConfig',
  'translation:clearHistory',
  'translation:clearUserData',
  'translation:clearAllData',
  'translation:getPrivacyReport',
  'translation:getAccountStats'
];

/**
 * Registers translation IPC handlers with IPCRouter AND ipcMain
 * @param {IPCRouter} router - IPCRouter instance
 * @param {Object} dependencies - Handler dependencies
 * @param {Object} dependencies.translationService - Translation service instance
 */
function registerWithRouter(router, dependencies) {
  const { ipcMain } = require('electron');
  
  _translationService = dependencies.translationService;
  
  if (!_translationService) {
    console.warn('[IPC:Translation] Translation service not provided, handlers may not work');
  }

  // Register all handlers with the router
  router.register('translation:translate', wrapHandler(handlers.translate, 'translate'), {
    schema: schemas.translate,
    description: 'Translate text with account-specific configuration',
    defaultTimeout: 30000
  });

  router.register('translation:detectLanguage', wrapHandler(handlers.detectLanguage, 'detectLanguage'), {
    schema: schemas.detectLanguage,
    description: 'Detect the language of input text',
    defaultTimeout: 10000
  });

  router.register('translation:getConfig', wrapHandler(handlers.getConfig, 'getConfig'), {
    schema: schemas.getConfig,
    description: 'Get translation configuration for an account',
    defaultTimeout: 5000
  });

  router.register('translation:saveConfig', wrapHandler(handlers.saveConfig, 'saveConfig'), {
    schema: schemas.saveConfig,
    description: 'Save translation configuration for an account',
    defaultTimeout: 5000
  });

  router.register('translation:getStats', wrapHandler(handlers.getStats, 'getStats'), {
    description: 'Get translation statistics',
    defaultTimeout: 5000
  });

  router.register('translation:clearCache', wrapHandler(handlers.clearCache, 'clearCache'), {
    schema: schemas.clearCache,
    description: 'Clear translation cache (optionally for specific account)',
    defaultTimeout: 10000
  });

  router.register('translation:saveEngineConfig', wrapHandler(handlers.saveEngineConfig, 'saveEngineConfig'), {
    schema: schemas.saveEngineConfig,
    description: 'Save configuration for a translation engine',
    defaultTimeout: 5000
  });

  router.register('translation:getEngineConfig', wrapHandler(handlers.getEngineConfig, 'getEngineConfig'), {
    schema: schemas.getEngineConfig,
    description: 'Get configuration for a translation engine',
    defaultTimeout: 5000
  });

  router.register('translation:clearHistory', wrapHandler(handlers.clearHistory, 'clearHistory'), {
    description: 'Clear translation history (privacy)',
    defaultTimeout: 10000
  });

  router.register('translation:clearUserData', wrapHandler(handlers.clearUserData, 'clearUserData'), {
    description: 'Clear all user data (privacy)',
    defaultTimeout: 10000
  });

  router.register('translation:clearAllData', wrapHandler(handlers.clearAllData, 'clearAllData'), {
    description: 'Clear all data including API keys (privacy)',
    defaultTimeout: 10000
  });

  router.register('translation:getPrivacyReport', wrapHandler(handlers.getPrivacyReport, 'getPrivacyReport'), {
    description: 'Get privacy data report',
    defaultTimeout: 5000
  });

  router.register('translation:getAccountStats', wrapHandler(handlers.getAccountStats, 'getAccountStats'), {
    schema: schemas.getAccountStats,
    description: 'Get translation statistics for an account',
    defaultTimeout: 5000
  });

  console.log('[IPC:Translation] Translation service handlers registered with IPCRouter');
  
  // ========== CRITICAL: Register with ipcMain ==========
  // The IPCRouter is an internal router, but we need to connect it to Electron's ipcMain
  // so that renderer processes can actually invoke these handlers
  
  for (const channel of TRANSLATION_CHANNELS) {
    // Remove existing handler if any (to avoid duplicate registration errors)
    try {
      ipcMain.removeHandler(channel);
    } catch (e) {
      // Ignore - handler might not exist
    }
    
    // Register the handler with ipcMain
    ipcMain.handle(channel, async (event, ...args) => {
      // Build request object for IPCRouter
      const request = {
        payload: args.length === 1 ? args[0] : args,
        requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      // Route through IPCRouter
      const response = await router.handle(channel, request);
      
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Unknown error');
      }
    });
    
    console.log(`[IPC:Translation] ✓ Registered ipcMain.handle for: ${channel}`);
  }
  
  console.log(`[IPC:Translation] ✓ All ${TRANSLATION_CHANNELS.length} channels registered with ipcMain`);
}

/**
 * Unregisters translation IPC handlers from IPCRouter and ipcMain
 * @param {IPCRouter} router - IPCRouter instance
 */
function unregisterFromRouter(router) {
  const { ipcMain } = require('electron');
  
  for (const channel of TRANSLATION_CHANNELS) {
    // Unregister from IPCRouter
    router.unregister(channel);
    
    // Unregister from ipcMain
    try {
      ipcMain.removeHandler(channel);
    } catch (e) {
      // Ignore - handler might not exist
    }
  }

  _translationService = null;
  console.log('[IPC:Translation] Translation service handlers unregistered from IPCRouter and ipcMain');
}

module.exports = {
  registerWithRouter,
  unregisterFromRouter,
  handlers,
  schemas
};
