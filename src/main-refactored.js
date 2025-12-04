/**
 * WhatsApp Desktop - 新架构主入口
 * 
 * 完全迁移到新架构，不再支持旧架构回退
 * 
 * 架构组件：
 * - EventBus: 事件总线
 * - ConfigProvider: 配置管理
 * - StateManager: 状态管理
 * - PluginManager: 插件系统
 * - IPCRouter: IPC路由
 */

const { app } = require('electron');

// 导入新的应用引导器
const { initializeApp } = require('./app/bootstrap');

// 导入IPC处理器
const { registerIPCHandlers: registerSingleWindowIPCHandlers, unregisterIPCHandlers: unregisterSingleWindowIPCHandlers } = require('./single-window/ipcHandlers');

// 导入新架构的IPC处理器
const TranslationServiceIPCHandlers = require('./presentation/ipc/handlers/TranslationServiceIPCHandlers');
const translationService = require('./translation/translationService');

 

// 导入自动清理工具
const OrphanedDataCleaner = require('./utils/OrphanedDataCleaner');

// 全局变量
let appBootstrap = null;

/**
 * 确保所有账号都启用了翻译功能
 */
async function ensureTranslationEnabled(accountManager) {
  try {
    const accounts = await accountManager.loadAccounts();
    let updatedCount = 0;

    for (const account of accounts) {
      let needsUpdate = false;

      if (!account.translation) {
        account.translation = {
          enabled: true,
          targetLanguage: 'zh-CN',
          engine: 'google',
          apiKey: '',
          autoTranslate: false,
          translateInput: false,
          friendSettings: {}
        };
        needsUpdate = true;
      } else if (!account.translation.enabled) {
        account.translation.enabled = true;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await accountManager.saveAccount(account);
        updatedCount++;
        console.log(`[INFO] 已为账号 ${account.name} 启用翻译功能`);
      }
    }

    if (updatedCount > 0) {
      console.log(`[INFO] 已为 ${updatedCount} 个账号启用翻译功能`);
    }
  } catch (error) {
    console.error('[ERROR] 检查翻译配置时出错:', error);
  }
}

/**
 * 注册所有IPC处理器
 */
async function registerAllIPCHandlers() {
  console.log('[INFO] 注册IPC处理器...');

  try {
    const accountManager = appBootstrap.getManager('accountConfigManager');
    const viewManager = appBootstrap.getViewManager();
    const mainWindow = appBootstrap.getMainWindow();
    const translationIntegration = appBootstrap.getManager('translationIntegration');
    const ipcRouter = appBootstrap.getIPCRouter();

    // 注册单窗口架构IPC处理器
    registerSingleWindowIPCHandlers(accountManager, viewManager, mainWindow, translationIntegration);
    console.log('[INFO] 单窗口IPC处理器注册完成');

    // 注册翻译服务IPC处理器 (IPCRouter架构)
    if (ipcRouter && translationService) {
      await translationService.initialize();
      TranslationServiceIPCHandlers.registerWithRouter(ipcRouter, { translationService });
      console.log('[INFO] 翻译服务IPC处理器注册完成 (IPCRouter - 13 channels)');
    }

 

    console.log('[INFO] 所有IPC处理器注册完成');
  } catch (error) {
    console.error('[ERROR] IPC处理器注册失败:', error);
    throw error;
  }
}

/**
 * 注销所有IPC处理器
 */
function unregisterAllIPCHandlers() {
  console.log('[INFO] 注销IPC处理器...');

  try {
    unregisterSingleWindowIPCHandlers();
    console.log('[INFO] 单窗口IPC处理器已注销');
  } catch (error) {
    console.error('[ERROR] 注销单窗口IPC处理器时出错:', error);
  }

  try {
    const ipcRouter = appBootstrap.getIPCRouter();
    if (ipcRouter) {
      TranslationServiceIPCHandlers.unregisterFromRouter(ipcRouter);
      console.log('[INFO] 翻译服务IPC处理器已注销 (IPCRouter)');
    }
  } catch (error) {
    console.error('[ERROR] 注销翻译服务IPC处理器时出错:', error);
  }

  

  console.log('[INFO] 所有IPC处理器注销完成');
}

/**
 * 加载账号列表并发送到渲染进程
 */
async function loadAndSendAccounts() {
  try {
    const accountManager = appBootstrap.getManager('accountConfigManager');
    const mainWindow = appBootstrap.getMainWindow();
    
    const accounts = await accountManager.loadAccounts();
    
    // 发送账号列表到渲染进程
    mainWindow.sendToRenderer('accounts-updated', accounts.map(acc => acc.toJSON()));
    
    console.log(`[INFO] 加载了 ${accounts.length} 个账号配置并发送到渲染进程`);
  } catch (error) {
    console.error('[ERROR] 加载账号列表失败:', error);
    
    // 发送空数组，避免UI显示错误
    const mainWindow = appBootstrap.getMainWindow();
    mainWindow.sendToRenderer('accounts-updated', []);
  }
}

/**
 * 自动启动配置的账号
 */
async function autoStartAccounts() {
  console.log('[INFO] 检查自动启动配置...');

  try {
    const accountManager = appBootstrap.getManager('accountConfigManager');
    const viewManager = appBootstrap.getViewManager();
    
    const accounts = await accountManager.loadAccounts();
    const autoStartAccounts = accounts.filter(account => account.autoStart === true);
    
    if (autoStartAccounts.length === 0) {
      console.log('[INFO] 没有配置自动启动的账号');
      return { success: 0, failed: 0, errors: [] };
    }

    console.log(`[INFO] 找到 ${autoStartAccounts.length} 个自动启动账号`);

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const account of autoStartAccounts) {
      try {
        console.log(`[INFO] 自动启动账号: ${account.name} (${account.id})`);
        
        const result = await viewManager.openAccount(account.id, {
          url: 'https://web.whatsapp.com',
          translation: account.translation
        });
        
        if (result.success) {
          console.log(`[INFO] 账号 ${account.name} 启动成功`);
          results.success++;
          
          await accountManager.updateAccount(account.id, {
            lastActiveAt: new Date()
          });
        } else {
          console.error(`[ERROR] 账号 ${account.name} 启动失败: ${result.error}`);
          results.failed++;
          results.errors.push({
            accountId: account.id,
            accountName: account.name,
            error: result.error
          });
        }
      } catch (error) {
        console.error(`[ERROR] 自动启动账号 ${account.name} 时出错:`, error);
        results.failed++;
        results.errors.push({
          accountId: account.id,
          accountName: account.name,
          error: error.message
        });
      }
    }

    console.log(`[INFO] 自动启动完成: ${results.success} 成功, ${results.failed} 失败`);
    
    if (results.failed > 0) {
      console.warn('[WARN] 部分账号启动失败:', results.errors);
    }

    return results;
  } catch (error) {
    console.error('[ERROR] 自动启动失败:', error);
    throw error;
  }
}

/**
 * 执行遗留数据自动清理
 */
async function performOrphanedDataCleanup() {
  try {
    console.log('[INFO] 开始执行自动数据清理...');

    const userDataPath = app.getPath('userData');
    const cleaner = new OrphanedDataCleaner({
      userDataPath,
      logFunction: (level, message, ...args) => {
        console.log(`[${level.toUpperCase()}] OrphanedDataCleaner: ${message}`, ...args);
      }
    });

    const accountManager = appBootstrap.getManager('accountConfigManager');
    const accounts = await accountManager.loadAccounts();
    const accountIds = accounts.map(acc => acc.id);

    console.log(`[INFO] 当前账号数量: ${accounts.length}`);
    
    const cleanupResult = await cleaner.scanAndClean(accountIds);

    if (cleanupResult.success) {
      console.log(`[INFO] 自动清理完成: 清理了 ${cleanupResult.cleaned} 个遗留目录`);
      if (cleanupResult.details.totalSizeFreed > 0) {
        console.log(`[INFO] 释放磁盘空间: ${cleanupResult.details.totalSizeFreed} 字节`);
      }
      
      // 向用户报告清理结果
      const mainWindow = appBootstrap.getMainWindow();
      if (cleanupResult.cleaned > 0 && mainWindow && mainWindow.isReady()) {
        mainWindow.sendToRenderer('cleanup-completed', {
          cleaned: cleanupResult.cleaned,
          totalSizeFreed: cleanupResult.details.totalSizeFreed,
          message: `自动清理完成: 清理了 ${cleanupResult.cleaned} 个遗留目录，释放了 ${Math.round(cleanupResult.details.totalSizeFreed / 1024)} KB 磁盘空间`
        });
      }
    } else {
      console.warn(`[WARN] 自动清理完成但有错误: ${cleanupResult.errors.join(', ')}`);
    }
  } catch (error) {
    console.error('[ERROR] 自动数据清理失败:', error);
  }
}

/**
 * 应用程序就绪事件
 */
app.whenReady().then(async () => {
  console.log('[INFO] ========================================');
  console.log('[INFO] WhatsApp Desktop - Refactored Architecture');
  console.log(`[INFO] 版本: ${app.getVersion()}`);
  console.log(`[INFO] Node.js: ${process.versions.node}`);
  console.log(`[INFO] Electron: ${process.versions.electron}`);
  console.log(`[INFO] Chromium: ${process.versions.chrome}`);
  console.log(`[INFO] 平台: ${process.platform}`);
  console.log(`[INFO] 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[INFO] 用户数据路径: ${app.getPath('userData')}`);
  console.log('[INFO] ========================================');

  try {
    // 1. 初始化应用（使用新的引导器）
    appBootstrap = await initializeApp();
    console.log('[INFO] 应用初始化完成');

    // 4. 确保所有账号启用翻译
    const accountManager = appBootstrap.getManager('accountConfigManager');
    if (accountManager) {
      await ensureTranslationEnabled(accountManager);
    }

    // 5. 执行自动数据清理
    await performOrphanedDataCleanup();

    // 6. 注册IPC处理器
    await registerAllIPCHandlers();

    // 7. 加载并发送账号列表
    await loadAndSendAccounts();

    // 8. 手动账户控制 - 延迟执行自动启动
    console.log('[INFO] 手动账户控制模式：等待用户手动打开账号');
    console.log('[INFO] 提示：如果某些账号配置了"自动启动"，将在 1 秒后自动打开');
    
    setTimeout(async () => {
      await autoStartAccounts();
    }, 1000);

    console.log('[INFO] 应用启动完成');

  } catch (error) {
    console.error('[ERROR] 应用启动失败:', error);
    console.error('[ERROR] 错误堆栈:', error.stack);
    app.quit();
  }

  // macOS特定：点击dock图标时显示主窗口
  app.on('activate', () => {
    if (appBootstrap) {
      const mainWindow = appBootstrap.getMainWindow();
      if (mainWindow) {
        mainWindow.focus();
      }
    }
  });
});

/**
 * 所有窗口关闭事件
 */
app.on('window-all-closed', async () => {
  console.log('[INFO] 所有窗口已关闭');

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * 应用退出前事件
 */
app.on('before-quit', async (event) => {
  console.log('[INFO] 应用即将退出');

  // 防止重复清理
  if (app.isQuitting) {
    console.log('[INFO] 清理已完成，允许退出');
    return;
  }

  // 标记正在退出
  app.isQuitting = true;

  try {
    // 1. 取消窗口关闭事件，防止重复触发
    event.preventDefault();
    
    // 2. 注销IPC处理器
    unregisterAllIPCHandlers();
    
    // 3. 使用bootstrap清理资源
    if (appBootstrap) {
      await appBootstrap.cleanup();
    }
    
    console.log('[INFO] 退出前清理完成');
    
    // 4. 允许应用退出
    app.quit();
    
  } catch (error) {
    console.error('[ERROR] 退出前清理失败:', error);
    
    // 即使清理失败也允许退出
    app.quit();
  }
});

/**
 * 应用即将退出事件
 */
app.on('will-quit', () => {
  console.log('[INFO] 应用正在退出');
  console.log('[INFO] 应用退出完成');
});

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  console.error('[ERROR] 未捕获的异常:', error);
  console.error('[ERROR] 错误堆栈:', error.stack);
  
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ERROR] 未处理的Promise拒绝:', reason);
  if (reason instanceof Error) {
    console.error('[ERROR] 错误堆栈:', reason.stack);
  }
});

/**
 * 发送账号错误到渲染进程
 * @param {string} accountId - 账号ID
 * @param {string} errorMessage - 错误消息
 * @param {string} category - 错误类别
 * @param {string} [severity='error'] - 错误严重程度
 */
function sendAccountError(accountId, errorMessage, category, severity = 'error') {
  if (appBootstrap && appBootstrap.getMainWindow() && appBootstrap.getMainWindow().isReady()) {
    appBootstrap.getMainWindow().sendToRenderer('account-error', {
      accountId,
      error: errorMessage,
      category,
      severity,
      timestamp: Date.now()
    });
  }
}

/**
 * 发送全局错误到渲染进程
 * @param {string} errorMessage - 错误消息
 * @param {string} category - 错误类别
 * @param {string} [level='error'] - 错误级别
 */
function sendGlobalError(errorMessage, category, level = 'error') {
  if (appBootstrap && appBootstrap.getMainWindow() && appBootstrap.getMainWindow().isReady()) {
    appBootstrap.getMainWindow().sendToRenderer('global-error', {
      error: errorMessage,
      category,
      level,
      timestamp: Date.now()
    });
  }
}

/**
 * 清除错误
 * @param {string} [accountId] - 账号ID（如果特定于账号）
 */
function clearError(accountId = null) {
  if (appBootstrap && appBootstrap.getMainWindow() && appBootstrap.getMainWindow().isReady()) {
    appBootstrap.getMainWindow().sendToRenderer('error-cleared', {
      accountId,
      timestamp: Date.now()
    });
  }
}

// 导出错误通知函数供其他模块使用
module.exports = {
  sendAccountError,
  sendGlobalError,
  clearError
};
