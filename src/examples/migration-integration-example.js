/**
 * 迁移集成示例
 * 
 * 展示如何在主应用中集成自动迁移功能
 */

const { app, BrowserWindow } = require('electron');
const { autoMigrate } = require('../managers/autoMigration');
const path = require('path');

/**
 * 示例 1: 基本集成 - 在应用启动时自动迁移
 */
async function example1_BasicIntegration() {
  console.log('=== Example 1: Basic Integration ===\n');

  app.whenReady().then(async () => {
    console.log('App is ready, checking for migration...');

    // 执行自动迁移
    const migrationResult = await autoMigrate({
      userDataPath: app.getPath('userData'),
      silent: false
    });

    if (migrationResult.migrated) {
      console.log('✓ Migration completed successfully');
      console.log('  Message:', migrationResult.message);
      
      // 可选：显示通知给用户
      // showMigrationNotification(migrationResult);
    } else if (migrationResult.error) {
      console.error('✗ Migration failed:', migrationResult.message);
      
      // 可选：显示错误对话框
      // showMigrationError(migrationResult);
    } else {
      console.log('No migration needed');
    }

    // 继续正常的应用初始化
    createMainWindow();
  });
}

/**
 * 示例 2: 带进度显示的迁移
 */
async function example2_MigrationWithProgress() {
  console.log('=== Example 2: Migration with Progress ===\n');

  app.whenReady().then(async () => {
    // 创建一个简单的加载窗口
    const loadingWindow = new BrowserWindow({
      width: 400,
      height: 200,
      frame: false,
      transparent: true,
      alwaysOnTop: true
    });

    loadingWindow.loadURL('data:text/html,<h1>Checking for updates...</h1>');

    try {
      // 执行迁移
      const migrationResult = await autoMigrate({
        userDataPath: app.getPath('userData'),
        silent: false
      });

      if (migrationResult.migrated) {
        loadingWindow.webContents.send('migration-status', {
          status: 'completed',
          message: 'Migration completed successfully'
        });
        
        // 等待一会儿让用户看到成功消息
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // 关闭加载窗口
      loadingWindow.close();

      // 创建主窗口
      createMainWindow();
    } catch (error) {
      console.error('Migration error:', error);
      loadingWindow.close();
      
      // 显示错误并退出
      app.quit();
    }
  });
}

/**
 * 示例 3: 手动触发迁移（用于设置界面）
 */
async function example3_ManualMigration() {
  console.log('=== Example 3: Manual Migration ===\n');

  const { ipcMain } = require('electron');
  const { getMigrationStatus } = require('../managers/autoMigration');

  // 注册 IPC 处理器
  ipcMain.handle('migration:getStatus', async () => {
    const userDataPath = app.getPath('userData');
    return await getMigrationStatus(userDataPath);
  });

  ipcMain.handle('migration:execute', async () => {
    const userDataPath = app.getPath('userData');
    return await autoMigrate({
      userDataPath,
      silent: false
    });
  });

  // 在渲染进程中可以这样调用：
  // const status = await window.electron.invoke('migration:getStatus');
  // const result = await window.electron.invoke('migration:execute');
}

/**
 * 示例 4: 完整的错误处理
 */
async function example4_ErrorHandling() {
  console.log('=== Example 4: Error Handling ===\n');

  const { dialog } = require('electron');

  app.whenReady().then(async () => {
    try {
      const migrationResult = await autoMigrate({
        userDataPath: app.getPath('userData'),
        silent: false
      });

      if (migrationResult.error) {
        // 显示错误对话框
        const response = await dialog.showMessageBox({
          type: 'error',
          title: 'Migration Failed',
          message: 'Failed to migrate application data',
          detail: migrationResult.message,
          buttons: ['Retry', 'Continue Anyway', 'Exit'],
          defaultId: 0,
          cancelId: 2
        });

        if (response.response === 0) {
          // 重试
          console.log('Retrying migration...');
          // 递归调用或重新执行迁移逻辑
        } else if (response.response === 1) {
          // 继续
          console.log('Continuing without migration...');
          createMainWindow();
        } else {
          // 退出
          app.quit();
          return;
        }
      } else {
        // 成功或不需要迁移
        createMainWindow();
      }
    } catch (error) {
      console.error('Unexpected error during migration:', error);
      
      await dialog.showMessageBox({
        type: 'error',
        title: 'Critical Error',
        message: 'An unexpected error occurred',
        detail: error.message
      });

      app.quit();
    }
  });
}

/**
 * 示例 5: 静默迁移（生产环境推荐）
 */
async function example5_SilentMigration() {
  console.log('=== Example 5: Silent Migration ===\n');

  app.whenReady().then(async () => {
    // 静默执行迁移，只记录到日志
    const migrationResult = await autoMigrate({
      userDataPath: app.getPath('userData'),
      silent: true // 不输出控制台日志
    });

    // 只在出错时记录
    if (migrationResult.error) {
      console.error('[Migration] Failed:', migrationResult.message);
      // 可以发送到错误追踪服务
      // sendToErrorTracking(migrationResult);
    }

    // 无论如何都继续启动应用
    createMainWindow();
  });
}

/**
 * 创建主窗口（示例）
 */
function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js')
    }
  });

  mainWindow.loadURL('https://web.whatsapp.com');
  console.log('Main window created');
}

/**
 * 显示迁移通知（示例）
 */
function showMigrationNotification(migrationResult) {
  const { Notification } = require('electron');

  if (Notification.isSupported()) {
    const notification = new Notification({
      title: 'WhatsApp Desktop',
      body: 'Your data has been successfully migrated to the new version',
      silent: false
    });

    notification.show();
  }
}

/**
 * 显示迁移错误（示例）
 */
async function showMigrationError(migrationResult) {
  const { dialog } = require('electron');

  await dialog.showMessageBox({
    type: 'warning',
    title: 'Migration Warning',
    message: 'Data migration encountered an issue',
    detail: migrationResult.message + '\n\nThe application will continue, but some data may not be available.',
    buttons: ['OK']
  });
}

// 导出示例函数
module.exports = {
  example1_BasicIntegration,
  example2_MigrationWithProgress,
  example3_ManualMigration,
  example4_ErrorHandling,
  example5_SilentMigration
};

// 如果直接运行此文件，执行示例 1
if (require.main === module) {
  console.log('Running migration integration examples...\n');
  console.log('Note: These are examples and should be integrated into your main.js\n');
  
  // 取消注释以运行特定示例
  // example1_BasicIntegration();
  // example2_MigrationWithProgress();
  // example3_ManualMigration();
  // example4_ErrorHandling();
  // example5_SilentMigration();
}
