/**
 * IPC 处理器
 * 处理渲染进程的翻译请求
 */

const { ipcMain } = require('electron');
const translationService = require('./translationService');

/**
 * 注册所有 IPC 处理器
 */
async function registerIPCHandlers() {
  // 初始化翻译服务
  if (!translationService.initialized) {
    try {
      await translationService.initialize();
      console.log('[IPC] Translation service initialized');
    } catch (error) {
      console.error('[IPC] Failed to initialize translation service:', error);
    }
  }
  
  // 翻译请求 (with account routing)
  ipcMain.handle('translation:translate', async (event, request) => {
    try {
      const { accountId, text, sourceLang, targetLang, engineName, options } = request;
      
      // Validate accountId
      if (!accountId) {
        throw new Error('Account ID is required for translation requests');
      }
      
      // Get account-specific translation config
      const accountConfig = translationService.getConfig(accountId);
      
      // Merge account config with request options
      const mergedOptions = {
        ...options,
        accountId, // Include accountId in options for cache key generation
        ...accountConfig
      };
      
      // Use account-specific engine if not specified
      const effectiveEngine = engineName || accountConfig.engine || 'google';
      const effectiveTargetLang = targetLang || accountConfig.targetLanguage || 'zh-CN';
      
      const result = await translationService.translate(
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
    } catch (error) {
      console.error(`[IPC] Translation error for account ${request.accountId}:`, error);
      return {
        success: false,
        error: error.message,
        accountId: request.accountId
      };
    }
  });

  // 语言检测
  ipcMain.handle('translation:detectLanguage', async (event, text) => {
    try {
      const lang = await translationService.detectLanguage(text);
      return {
        success: true,
        data: lang
      };
    } catch (error) {
      console.error('[IPC] Language detection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 获取配置 (account-specific)
  ipcMain.handle('translation:getConfig', async (event, accountId) => {
    try {
      // Require accountId for proper routing
      if (!accountId) {
        throw new Error('Account ID is required to get translation config');
      }
      
      const config = translationService.getConfig(accountId);
      return {
        success: true,
        data: config,
        accountId
      };
    } catch (error) {
      console.error(`[IPC] Get config error for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message,
        accountId
      };
    }
  });

  // 保存配置 (account-specific)
  ipcMain.handle('translation:saveConfig', async (event, accountId, config) => {
    try {
      // Require accountId for proper routing
      if (!accountId) {
        throw new Error('Account ID is required to save translation config');
      }
      
      translationService.saveConfig(accountId, config);
      
      console.log(`[IPC] Translation config saved for account ${accountId}`);
      
      // 通知对应的 BrowserView 配置已更改
      const { BrowserView } = require('electron');
      const allViews = BrowserView.getAllViews();
      
      for (const view of allViews) {
        if (view && view.webContents && !view.webContents.isDestroyed()) {
          try {
            // 检查这个 view 是否属于当前账号
            const viewAccountId = await view.webContents.executeJavaScript('window.ACCOUNT_ID').catch(() => null);
            
            if (viewAccountId === accountId) {
              console.log(`[IPC] Notifying BrowserView for account ${accountId} about config change`);
              view.webContents.send('translation:configChanged', config);
            }
          } catch (err) {
            // 忽略错误，可能是 view 已经销毁
          }
        }
      }
      
      return {
        success: true,
        accountId
      };
    } catch (error) {
      console.error(`[IPC] Save config error for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message,
        accountId
      };
    }
  });

  // 获取统计信息
  ipcMain.handle('translation:getStats', async (event) => {
    try {
      const stats = translationService.getStats();
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('[IPC] Get stats error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 清除缓存 (全局或按账号)
  ipcMain.handle('translation:clearCache', async (event, accountId = null) => {
    try {
      if (accountId) {
        // Clear cache for specific account
        await translationService.cacheManager.clearByAccount(accountId);
        console.log(`[IPC] Translation cache cleared for account ${accountId}`);
        return {
          success: true,
          accountId
        };
      } else {
        // Clear all cache
        await translationService.cacheManager.clear();
        console.log('[IPC] All translation cache cleared');
        return {
          success: true
        };
      }
    } catch (error) {
      console.error(`[IPC] Clear cache error${accountId ? ` for account ${accountId}` : ''}:`, error);
      return {
        success: false,
        error: error.message,
        accountId
      };
    }
  });

  // 保存引擎配置
  ipcMain.handle('translation:saveEngineConfig', async (event, engineName, config) => {
    try {
      translationService.configManager.saveEngineConfig(engineName, config);
      console.log(`[IPC] Saved engine config for: ${engineName}`);
      
      // 强制重新注册引擎
      translationService.registerEngines();
      console.log('[IPC] Engines reregistered with new config');
      console.log('[IPC] Available engines:', Array.from(translationService.translationManager.engines.keys()));
      
      return {
        success: true
      };
    } catch (error) {
      console.error('[IPC] Save engine config error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 获取引擎配置
  ipcMain.handle('translation:getEngineConfig', async (event, engineName) => {
    try {
      const config = translationService.configManager.getEngineConfig(engineName);
      return {
        success: true,
        data: config
      };
    } catch (error) {
      console.error('[IPC] Get engine config error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 隐私保护：清除翻译历史
  ipcMain.handle('translation:clearHistory', async (event) => {
    try {
      await translationService.clearTranslationHistory();
      return {
        success: true,
        message: 'Translation history cleared successfully'
      };
    } catch (error) {
      console.error('[IPC] Clear history error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 隐私保护：清除用户数据
  ipcMain.handle('translation:clearUserData', async (event) => {
    try {
      await translationService.clearAllUserData();
      return {
        success: true,
        message: 'User data cleared successfully'
      };
    } catch (error) {
      console.error('[IPC] Clear user data error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 隐私保护：清除所有数据
  ipcMain.handle('translation:clearAllData', async (event) => {
    try {
      await translationService.clearAllData();
      return {
        success: true,
        message: 'All data cleared successfully'
      };
    } catch (error) {
      console.error('[IPC] Clear all data error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 隐私保护：获取隐私报告
  ipcMain.handle('translation:getPrivacyReport', async (event) => {
    try {
      const report = translationService.getPrivacyReport();
      return {
        success: true,
        data: report
      };
    } catch (error) {
      console.error('[IPC] Get privacy report error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 获取账号的翻译统计
  ipcMain.handle('translation:getAccountStats', async (event, accountId) => {
    try {
      if (!accountId) {
        throw new Error('Account ID is required to get translation stats');
      }
      
      // Get overall stats (could be extended to track per-account stats)
      const stats = translationService.getStats();
      
      return {
        success: true,
        data: stats,
        accountId
      };
    } catch (error) {
      console.error(`[IPC] Get account stats error for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message,
        accountId
      };
    }
  });

  console.log('[IPC] Translation handlers registered');
}

/**
 * 注销所有 IPC 处理器
 */
function unregisterIPCHandlers() {
  ipcMain.removeHandler('translation:translate');
  ipcMain.removeHandler('translation:detectLanguage');
  ipcMain.removeHandler('translation:getConfig');
  ipcMain.removeHandler('translation:saveConfig');
  ipcMain.removeHandler('translation:getStats');
  ipcMain.removeHandler('translation:clearCache');
  ipcMain.removeHandler('translation:saveEngineConfig');
  ipcMain.removeHandler('translation:getEngineConfig');
  ipcMain.removeHandler('translation:clearHistory');
  ipcMain.removeHandler('translation:clearUserData');
  ipcMain.removeHandler('translation:clearAllData');
  ipcMain.removeHandler('translation:getPrivacyReport');
  ipcMain.removeHandler('translation:getAccountStats');
  
  console.log('[IPC] Translation handlers unregistered');
}

module.exports = {
  registerIPCHandlers,
  unregisterIPCHandlers
};
