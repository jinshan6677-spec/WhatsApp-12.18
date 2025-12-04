/**
 * TranslationIntegration - 翻译系统集成
 * 
 * 负责为每个账号注入翻译脚本并管理独立的翻译配置
 * 支持多窗口架构 (BrowserWindow) 和单窗口架构 (BrowserView)
 * 确保现有翻译功能在两种架构中都能正常工作
 * 
 * 主要功能:
 * - 注入 window.ACCOUNT_ID 到每个 BrowserView 上下文
 * - 注入翻译优化器脚本 (contentScriptWithOptimizer.js)
 * - 注入主翻译脚本 (contentScript.js)
 * - 处理脚本注入时机 (页面加载时)
 * - 管理每个账号的独立翻译配置
 */

const path = require('path');
const fs = require('fs').promises;

/**
 * @typedef {Object} TranslationConfig
 * @property {boolean} enabled - 是否启用翻译
 * @property {string} targetLanguage - 目标语言
 * @property {string} engine - 翻译引擎
 * @property {string} [apiKey] - API 密钥
 * @property {boolean} autoTranslate - 自动翻译
 * @property {boolean} translateInput - 翻译输入框
 * @property {Object} friendSettings - 好友独立设置
 */

/**
 * TranslationIntegration 类
 */
class TranslationIntegration {
  /**
   * 创建翻译集成实例
   * @param {Object} [instanceManager] - 实例管理器引用 (可选，用于向后兼容)
   */
  constructor(instanceManager = null) {
    this.instanceManager = instanceManager;
    
    // 存储每个账号的翻译配置 Map: accountId -> TranslationConfig
    this.translationConfigs = new Map();
    
    // 存储每个账号的翻译状态 Map: accountId -> status
    this.translationStatuses = new Map();
    
    // 缓存翻译脚本内容
    this.scriptCache = {
      optimizer: null,
      contentScript: null
    };
    
    // 日志函数
    this.log = this._createLogger();
  }

  /**
   * 创建日志记录器
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [TranslationIntegration] [${level.toUpperCase()}] ${message}`;
      
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
   * 初始化翻译集成
   * @returns {Promise<void>}
   */
  async initialize() {
    this.log('info', 'Initializing translation integration');
    
    try {
      // 预加载翻译脚本到缓存
      await this._loadScriptsToCache();
      this.log('info', 'Translation scripts loaded to cache');
    } catch (error) {
      this.log('error', 'Failed to load translation scripts:', error);
      throw error;
    }
  }

  /**
   * 加载翻译脚本到缓存
   * @private
   * @returns {Promise<void>}
   */
  async _loadScriptsToCache() {
    try {
      // 加载性能优化器脚本
      const optimizerPath = path.join(__dirname, '../translation/contentScriptWithOptimizer.js');
      this.scriptCache.optimizer = await fs.readFile(optimizerPath, 'utf8');
      this.log('info', 'Loaded optimizer script');
      
      // 加载主翻译脚本
      const contentScriptPath = path.join(__dirname, '../translation/contentScript.js');
      this.scriptCache.contentScript = await fs.readFile(contentScriptPath, 'utf8');
      this.log('info', 'Loaded content script');
      
    } catch (error) {
      this.log('error', 'Failed to load scripts to cache:', error);
      throw new Error(`Failed to load translation scripts: ${error.message}`);
    }
  }

  /**
   * 为实例注入翻译脚本 (支持 BrowserWindow 和 BrowserView)
   * @param {string} accountId - 账号 ID
   * @param {BrowserWindow|BrowserView} target - 浏览器窗口或 BrowserView
   * @param {TranslationConfig} [translationConfig] - 翻译配置
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async injectScripts(accountId, target, translationConfig = null) {
    this.log('info', `Injecting translation scripts for account ${accountId}`);
    
    try {
      // 获取 webContents (支持 BrowserWindow 和 BrowserView)
      const webContents = target.webContents;
      
      // 检查 webContents 是否有效
      if (!webContents || webContents.isDestroyed()) {
        return {
          success: false,
          error: 'WebContents is invalid or destroyed'
        };
      }

      // 存储翻译配置
      if (translationConfig) {
        this.translationConfigs.set(accountId, translationConfig);
      }

      // 设置 did-finish-load 事件监听器
      webContents.on('did-finish-load', async () => {
        const url = webContents.getURL();
        this.log('info', `Page loaded for account ${accountId}, URL: ${url}`);
        
        // Only inject on WhatsApp Web pages
        if (!url.includes('web.whatsapp.com')) {
          this.log('info', `Skipping injection for non-WhatsApp page: ${url}`);
          return;
        }
        
        // 延迟注入，等待页面完全初始化
        this.log('info', `Waiting 2 seconds for page to fully initialize...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        this.log('info', `Injecting scripts for account ${accountId}`);
        
        try {
          // 测试 executeJavaScript 是否工作
          const testResult = await webContents.executeJavaScript(`
            console.log('[Translation] executeJavaScript test successful');
            'TEST_OK'
          `);
          this.log('info', `executeJavaScript test result: ${testResult}`);
          
          // 注入 window.ACCOUNT_ID
          await webContents.executeJavaScript(`
            window.ACCOUNT_ID = '${accountId}';
            console.log('[Translation] Account ID injected: ${accountId}');
          `);
          this.log('info', `Account ID injected for ${accountId}`);
          
          // 注入性能优化器
          if (this.scriptCache.optimizer) {
            await webContents.executeJavaScript(this.scriptCache.optimizer);
            this.log('info', `Optimizer injected for account ${accountId}`);
          } else {
            this.log('warn', `Optimizer script not loaded in cache`);
          }
          
          // 注入主翻译脚本
          if (this.scriptCache.contentScript) {
            this.log('info', `Injecting content script (${this.scriptCache.contentScript.length} chars)...`);
            await webContents.executeJavaScript(this.scriptCache.contentScript);
            this.log('info', `Content script injected for account ${accountId}`);
            
            // 验证注入 - 多次检查
            await new Promise(resolve => setTimeout(resolve, 500));
            const verifyResult = await webContents.executeJavaScript(`
              (function() {
                const result = {
                  hasWhatsAppTranslation: typeof window.WhatsAppTranslation !== 'undefined',
                  hasTranslationAPI: typeof window.translationAPI !== 'undefined',
                  hasAccountId: typeof window.ACCOUNT_ID !== 'undefined',
                  accountId: window.ACCOUNT_ID
                };
                console.log('[Translation] Verification result:', result);
                return result;
              })()
            `);
            this.log('info', `Verification result:`, JSON.stringify(verifyResult));
            
            if (!verifyResult.hasWhatsAppTranslation) {
              this.log('error', `WhatsAppTranslation not available after injection!`);
              throw new Error('WhatsAppTranslation not available after injection');
            }
          } else {
            this.log('error', `Content script not loaded in cache`);
          }
          
          // 初始化翻译系统
          const initResult = await webContents.executeJavaScript(`
            (async function() {
              try {
                if (window.WhatsAppTranslation) {
                  window.WhatsAppTranslation.accountId = '${accountId}';
                  await window.WhatsAppTranslation.init();
                  console.log('[Translation] Initialized for account ${accountId}');
                  return { success: true };
                } else {
                  console.error('[Translation] WhatsAppTranslation not found!');
                  return { success: false, error: 'WhatsAppTranslation not found' };
                }
              } catch (error) {
                console.error('[Translation] Initialization error:', error);
                return { success: false, error: error.message };
              }
            })();
          `);
          this.log('info', `Initialization result:`, JSON.stringify(initResult));
          
          // 更新状态
          this.translationStatuses.set(accountId, {
            injected: true,
            lastInjectionTime: new Date(),
            error: null
          });
          
          this.log('info', `Translation scripts successfully injected for account ${accountId}`);
          
        } catch (error) {
          this.log('error', `Failed to inject scripts for account ${accountId}:`, error);
          this.log('error', `Error stack:`, error.stack);
          this.log('error', `Error name:`, error.name);
          this.log('error', `Error message:`, error.message);
          
          // 更新状态
          this.translationStatuses.set(accountId, {
            injected: false,
            lastInjectionTime: new Date(),
            error: error.message
          });
        }
      });

      // 如果页面已经加载，立即注入
      const currentURL = webContents.getURL();
      if (currentURL.includes('web.whatsapp.com')) {
        this.log('info', `Page already loaded for account ${accountId}, injecting immediately`);
        
        // 延迟注入，等待页面完全初始化
        this.log('info', `Waiting 2 seconds for page to fully initialize...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          // 测试 executeJavaScript 是否工作
          const testResult = await webContents.executeJavaScript(`
            console.log('[Translation] executeJavaScript test successful (immediate)');
            'TEST_OK'
          `);
          this.log('info', `executeJavaScript test result (immediate): ${testResult}`);
          
          // 注入 window.ACCOUNT_ID
          await webContents.executeJavaScript(`
            window.ACCOUNT_ID = '${accountId}';
            console.log('[Translation] Account ID injected: ${accountId}');
          `);
          this.log('info', `Account ID injected for ${accountId}`);
          
          // 注入性能优化器
          if (this.scriptCache.optimizer) {
            await webContents.executeJavaScript(this.scriptCache.optimizer);
            this.log('info', `Optimizer injected immediately for account ${accountId}`);
          } else {
            this.log('warn', `Optimizer script not loaded in cache`);
          }
          
          // 注入主翻译脚本
          if (this.scriptCache.contentScript) {
            this.log('info', `Injecting content script immediately (${this.scriptCache.contentScript.length} chars)...`);
            await webContents.executeJavaScript(this.scriptCache.contentScript);
            this.log('info', `Content script injected immediately for account ${accountId}`);
            
            // 验证注入 - 多次检查
            await new Promise(resolve => setTimeout(resolve, 500));
            const verifyResult = await webContents.executeJavaScript(`
              (function() {
                const result = {
                  hasWhatsAppTranslation: typeof window.WhatsAppTranslation !== 'undefined',
                  hasTranslationAPI: typeof window.translationAPI !== 'undefined',
                  hasAccountId: typeof window.ACCOUNT_ID !== 'undefined',
                  accountId: window.ACCOUNT_ID
                };
                console.log('[Translation] Verification result (immediate):', result);
                return result;
              })()
            `);
            this.log('info', `Verification result (immediate):`, JSON.stringify(verifyResult));
            
            if (!verifyResult.hasWhatsAppTranslation) {
              this.log('error', `WhatsAppTranslation not available after immediate injection!`);
              throw new Error('WhatsAppTranslation not available after immediate injection');
            }
          } else {
            this.log('error', `Content script not loaded in cache`);
          }
          
          // 初始化翻译系统
          const initResult = await webContents.executeJavaScript(`
            (async function() {
              try {
                if (window.WhatsAppTranslation) {
                  window.WhatsAppTranslation.accountId = '${accountId}';
                  await window.WhatsAppTranslation.init();
                  console.log('[Translation] Initialized for account ${accountId}');
                  return { success: true };
                } else {
                  console.error('[Translation] WhatsAppTranslation not found!');
                  return { success: false, error: 'WhatsAppTranslation not found' };
                }
              } catch (error) {
                console.error('[Translation] Initialization error:', error);
                return { success: false, error: error.message };
              }
            })();
          `);
          this.log('info', `Initialization result (immediate):`, JSON.stringify(initResult));
          
          // 更新状态
          this.translationStatuses.set(accountId, {
            injected: true,
            lastInjectionTime: new Date(),
            error: null
          });
          
        } catch (error) {
          this.log('error', `Failed to inject scripts immediately for account ${accountId}:`, error);
          this.log('error', `Error stack:`, error.stack);
          this.log('error', `Error name:`, error.name);
          this.log('error', `Error message:`, error.message);
          
          // 更新状态
          this.translationStatuses.set(accountId, {
            injected: false,
            lastInjectionTime: new Date(),
            error: error.message
          });
        }
      } else {
        this.log('info', `Page not yet loaded for account ${accountId}, URL: ${currentURL}`);
      }

      return { success: true };
      
    } catch (error) {
      this.log('error', `Failed to setup script injection for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 配置账号的翻译设置 (支持 BrowserWindow 和 BrowserView)
   * @param {string} accountId - 账号 ID
   * @param {TranslationConfig} config - 翻译配置
   * @param {BrowserWindow|BrowserView} [target] - 可选的目标窗口/视图
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async configureTranslation(accountId, config, target = null) {
    this.log('info', `Configuring translation for account ${accountId}`);
    
    try {
      let webContents = null;

      // 如果提供了 target，直接使用
      if (target) {
        webContents = target.webContents;
      } 
      // 否则尝试从 instanceManager 获取 (向后兼容)
      else if (this.instanceManager) {
        const instance = this.instanceManager.instances.get(accountId);
        if (!instance) {
          return {
            success: false,
            error: 'Instance not found'
          };
        }
        webContents = instance.window ? instance.window.webContents : null;
      }

      // 检查 webContents 是否有效
      if (!webContents || webContents.isDestroyed()) {
        return {
          success: false,
          error: 'WebContents is invalid or destroyed'
        };
      }

      // 存储配置
      this.translationConfigs.set(accountId, config);

      // 通过 executeJavaScript 直接更新配置
      await webContents.executeJavaScript(`
        (async function() {
          if (window.WhatsAppTranslation) {
            // 更新配置
            window.WhatsAppTranslation.config = ${JSON.stringify(config)};
            console.log('[Translation] Configuration updated for account ${accountId}');
            
            // 重新初始化相关功能
            if (window.WhatsAppTranslation.initialized) {
              // 重新设置中文拦截
              window.WhatsAppTranslation.setupChineseBlock();
              
              // 重新设置实时翻译
              const inputBox = document.querySelector('footer [contenteditable="true"]') ||
                              document.querySelector('[data-testid="conversation-compose-box-input"]');
              if (inputBox) {
                window.WhatsAppTranslation.setupRealtimeTranslation(inputBox);
              }
              
              console.log('[Translation] Features reconfigured');
            }
          }
        })();
      `);

      this.log('info', `Translation configured successfully for account ${accountId}`);
      
      return { success: true };
      
    } catch (error) {
      this.log('error', `Failed to configure translation for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取账号的翻译状态
   * @param {string} accountId - 账号 ID
   * @returns {Object|null}
   */
  getTranslationStatus(accountId) {
    return this.translationStatuses.get(accountId) || null;
  }

  /**
   * 获取账号的翻译配置
   * @param {string} accountId - 账号 ID
   * @returns {TranslationConfig|null}
   */
  getTranslationConfig(accountId) {
    return this.translationConfigs.get(accountId) || null;
  }

  /**
   * 检查账号是否已注入翻译脚本
   * @param {string} accountId - 账号 ID
   * @returns {boolean}
   */
  isInjected(accountId) {
    const status = this.translationStatuses.get(accountId);
    return status ? status.injected : false;
  }

  /**
   * 获取所有账号的翻译配置
   * @returns {Map<string, TranslationConfig>}
   */
  getAllTranslationConfigs() {
    return new Map(this.translationConfigs);
  }

  /**
   * 清除账号的翻译缓存 (支持 BrowserWindow 和 BrowserView)
   * @param {string} accountId - 账号 ID
   * @param {BrowserWindow|BrowserView} [target] - 可选的目标窗口/视图
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async clearCache(accountId, target = null) {
    this.log('info', `Clearing translation cache for account ${accountId}`);
    
    try {
      let webContents = null;

      // 如果提供了 target，直接使用
      if (target) {
        webContents = target.webContents;
      } 
      // 否则尝试从 instanceManager 获取 (向后兼容)
      else if (this.instanceManager) {
        const instance = this.instanceManager.instances.get(accountId);
        if (!instance) {
          return {
            success: false,
            error: 'Instance not found'
          };
        }
        webContents = instance.window ? instance.window.webContents : null;
      }

      // 检查 webContents 是否有效
      if (!webContents || webContents.isDestroyed()) {
        return {
          success: false,
          error: 'WebContents is invalid or destroyed'
        };
      }

      // 清除渲染进程中的翻译缓存
      await webContents.executeJavaScript(`
        (function() {
          if (window.contentScriptOptimizer) {
            window.contentScriptOptimizer.translationCache.clear();
            console.log('[Translation] Cache cleared for account ${accountId}');
          }
        })();
      `);

      this.log('info', `Translation cache cleared for account ${accountId}`);
      
      return { success: true };
      
    } catch (error) {
      this.log('error', `Failed to clear cache for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 移除账号的翻译配置和状态
   * @param {string} accountId - 账号 ID
   */
  removeAccount(accountId) {
    this.log('info', `Removing translation data for account ${accountId}`);
    
    this.translationConfigs.delete(accountId);
    this.translationStatuses.delete(accountId);
  }

  /**
   * 移除实例的翻译配置和状态 (向后兼容别名)
   * @param {string} instanceId - 实例 ID
   */
  removeInstance(instanceId) {
    return this.removeAccount(instanceId);
  }

  /**
   * 获取所有实例的翻译状态
   * @returns {Map<string, Object>}
   */
  getAllTranslationStatuses() {
    return new Map(this.translationStatuses);
  }

  /**
   * 重新加载翻译脚本缓存
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async reloadScripts() {
    this.log('info', 'Reloading translation scripts');
    
    try {
      await this._loadScriptsToCache();
      this.log('info', 'Translation scripts reloaded successfully');
      return { success: true };
    } catch (error) {
      this.log('error', 'Failed to reload translation scripts:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 更新账号的翻译配置（支持动态更新）
   * @param {string} accountId - 账号 ID
   * @param {Partial<TranslationConfig>} updates - 配置更新
   * @param {BrowserWindow|BrowserView} [target] - 可选的目标窗口/视图
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async updateTranslationConfig(accountId, updates, target = null) {
    this.log('info', `Updating translation config for account ${accountId}`);
    
    try {
      // 获取当前配置
      const currentConfig = this.translationConfigs.get(accountId);
      if (!currentConfig) {
        return {
          success: false,
          error: 'Translation config not found for account'
        };
      }

      // 合并更新
      const newConfig = {
        ...currentConfig,
        ...updates
      };

      // 应用新配置
      return await this.configureTranslation(accountId, newConfig, target);
      
    } catch (error) {
      this.log('error', `Failed to update translation config for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 为所有运行中的账号应用翻译配置
   * @param {TranslationConfig} config - 翻译配置
   * @param {Map<string, Object>} [views] - 可选的视图映射 (accountId -> {view})
   * @returns {Promise<{success: boolean, applied: number, failed: number}>}
   */
  async applyConfigToAllAccounts(config, views = null) {
    this.log('info', 'Applying translation config to all accounts');
    
    let applied = 0;
    let failed = 0;

    // 如果提供了 views (单窗口架构)
    if (views && views.size > 0) {
      for (const [accountId, viewState] of views) {
        const result = await this.configureTranslation(accountId, config, viewState.view);
        if (result.success) {
          applied++;
        } else {
          failed++;
        }
      }
    }
    // 否则使用 instanceManager (多窗口架构，向后兼容)
    else if (this.instanceManager) {
      const runningInstances = this.instanceManager.getRunningInstances();
      
      for (const instance of runningInstances) {
        const result = await this.configureTranslation(instance.instanceId, config);
        if (result.success) {
          applied++;
        } else {
          failed++;
        }
      }
    }

    this.log('info', `Applied config to ${applied} accounts, ${failed} failed`);
    
    return {
      success: failed === 0,
      applied,
      failed
    };
  }

  /**
   * 为所有运行中的实例应用翻译配置 (向后兼容别名)
   * @param {TranslationConfig} config - 翻译配置
   * @returns {Promise<{success: boolean, applied: number, failed: number}>}
   */
  async applyConfigToAllInstances(config) {
    return this.applyConfigToAllAccounts(config);
  }

  /**
   * 获取翻译性能统计 (支持 BrowserWindow 和 BrowserView)
   * @param {string} accountId - 账号 ID
   * @param {BrowserWindow|BrowserView} [target] - 可选的目标窗口/视图
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async getPerformanceStats(accountId, target = null) {
    this.log('info', `Getting performance stats for account ${accountId}`);
    
    try {
      let webContents = null;

      // 如果提供了 target，直接使用
      if (target) {
        webContents = target.webContents;
      } 
      // 否则尝试从 instanceManager 获取 (向后兼容)
      else if (this.instanceManager) {
        const instance = this.instanceManager.instances.get(accountId);
        if (!instance) {
          return {
            success: false,
            error: 'Instance not found'
          };
        }
        webContents = instance.window ? instance.window.webContents : null;
      }

      // 检查 webContents 是否有效
      if (!webContents || webContents.isDestroyed()) {
        return {
          success: false,
          error: 'WebContents is invalid or destroyed'
        };
      }

      // 获取性能统计
      const stats = await webContents.executeJavaScript(`
        (function() {
          if (window.getTranslationPerformanceStats) {
            return window.getTranslationPerformanceStats();
          }
          return null;
        })();
      `);

      if (stats) {
        return {
          success: true,
          data: stats
        };
      } else {
        return {
          success: false,
          error: 'Performance stats not available'
        };
      }
      
    } catch (error) {
      this.log('error', `Failed to get performance stats for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.log('info', 'Cleaning up translation integration');
    
    this.translationConfigs.clear();
    this.translationStatuses.clear();
    this.scriptCache.optimizer = null;
    this.scriptCache.contentScript = null;
  }
}

module.exports = TranslationIntegration;
