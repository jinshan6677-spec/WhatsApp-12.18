/**
 * MigrationDialog - 迁移对话框管理器
 * 
 * 负责创建和管理迁移UI窗口，显示迁移进度和结果
 */

const { BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

/**
 * MigrationDialog 类
 */
class MigrationDialog {
  /**
   * 创建迁移对话框实例
   * @param {Object} [options] - 配置选项
   * @param {number} [options.width] - 窗口宽度
   * @param {number} [options.height] - 窗口高度
   * @param {BrowserWindow} [options.parent] - 父窗口
   */
  constructor(options = {}) {
    this.window = null;
    this.options = {
      width: options.width || 700,
      height: options.height || 600,
      parent: options.parent || null
    };
    
    this.migrationManager = null;
    this.isOpen = false;
    
    // Bind methods
    this.handleStartMigration = this.handleStartMigration.bind(this);
    this.handleCancelMigration = this.handleCancelMigration.bind(this);
    this.handleContinue = this.handleContinue.bind(this);
    this.handleOpenBackup = this.handleOpenBackup.bind(this);
    this.handleCloseWindow = this.handleCloseWindow.bind(this);
  }

  /**
   * 创建并显示迁移对话框
   * @param {Object} migrationManager - MigrationManager 实例
   * @returns {Promise<BrowserWindow>}
   */
  async show(migrationManager) {
    if (this.isOpen && this.window && !this.window.isDestroyed()) {
      this.window.focus();
      return this.window;
    }
    
    this.migrationManager = migrationManager;
    
    // Create window
    this.window = new BrowserWindow({
      width: this.options.width,
      height: this.options.height,
      minWidth: 600,
      minHeight: 500,
      parent: this.options.parent,
      modal: true,
      show: false,
      resizable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../renderer/preload-migration.js')
      }
    });
    
    // Load the migration dialog HTML
    const dialogPath = path.join(__dirname, '../renderer/migrationDialog.html');
    await this.window.loadFile(dialogPath);
    
    // Register IPC handlers
    this.registerIpcHandlers();
    
    // Handle window close
    this.window.on('closed', () => {
      this.cleanup();
    });
    
    // Show window when ready
    this.window.once('ready-to-show', () => {
      this.window.show();
      this.isOpen = true;
    });
    
    return this.window;
  }

  /**
   * 注册 IPC 处理器
   * @private
   */
  registerIpcHandlers() {
    // Start migration
    ipcMain.handle('migration:start', this.handleStartMigration);
    
    // Cancel migration
    ipcMain.on('migration:cancel', this.handleCancelMigration);
    
    // Continue to app
    ipcMain.on('migration:continue', this.handleContinue);
    
    // Open backup location
    ipcMain.on('migration:open-backup', this.handleOpenBackup);
    
    // Close window
    ipcMain.on('close-window', this.handleCloseWindow);
  }

  /**
   * 移除 IPC 处理器
   * @private
   */
  unregisterIpcHandlers() {
    ipcMain.removeHandler('migration:start');
    ipcMain.removeListener('migration:cancel', this.handleCancelMigration);
    ipcMain.removeListener('migration:continue', this.handleContinue);
    ipcMain.removeListener('migration:open-backup', this.handleOpenBackup);
    ipcMain.removeListener('close-window', this.handleCloseWindow);
  }

  /**
   * 处理开始迁移请求
   * @private
   */
  async handleStartMigration() {
    if (!this.migrationManager) {
      throw new Error('MigrationManager not set');
    }
    
    try {
      console.log('[MigrationDialog] Starting migration...');
      
      // Send initial progress
      this.sendProgress(0, 'Starting migration...');
      this.sendLog('info', 'Migration process started');
      
      // Step 1: Detect and backup (10%)
      this.sendProgress(10, 'Detecting old configuration...');
      this.sendLog('info', 'Checking for old configuration files');
      
      const backupResult = await this.migrationManager.detectAndBackup();
      
      if (!backupResult.needed) {
        this.sendLog('info', 'No migration needed');
        this.sendComplete({
          success: true,
          errors: [],
          warnings: ['No migration needed - configuration is already up to date'],
          migratedAccounts: [],
          backupPath: null
        });
        return;
      }
      
      if (!backupResult.success) {
        throw new Error(`Backup failed: ${backupResult.errors.join(', ')}`);
      }
      
      this.sendProgress(20, 'Backup created successfully');
      this.sendLog('success', `Backup created: ${backupResult.backupPath}`);
      
      // Step 2: Migrate configuration (40%)
      this.sendProgress(40, 'Migrating account configurations...');
      this.sendLog('info', 'Converting configuration format');
      
      const migrationResult = await this.migrationManager.migrateConfiguration(backupResult.oldConfig);
      
      if (!migrationResult.success) {
        throw new Error(`Configuration migration failed: ${migrationResult.errors.join(', ')}`);
      }
      
      const accountCount = Object.keys(migrationResult.migratedConfig.accounts || {}).length;
      this.sendProgress(60, `Migrated ${accountCount} account(s)`);
      this.sendLog('success', `Successfully migrated ${accountCount} account configurations`);
      
      // Step 3: Migrate session data (80%)
      this.sendProgress(80, 'Verifying session data...');
      this.sendLog('info', 'Checking session data accessibility');
      
      const sessionResult = await this.migrationManager.migrateSessionData(migrationResult.migratedConfig);
      
      this.sendLog('info', `Processed session data for ${sessionResult.updated} accounts`);
      
      // Step 4: Save migrated configuration (90%)
      this.sendProgress(90, 'Saving migrated configuration...');
      this.sendLog('info', 'Writing new configuration file');
      
      const saveResult = await this.migrationManager.saveMigratedConfig(migrationResult.migratedConfig);
      
      if (!saveResult.success) {
        throw new Error(`Failed to save configuration: ${saveResult.error}`);
      }
      
      this.sendLog('success', 'Configuration saved successfully');
      
      // Step 5: Complete (100%)
      this.sendProgress(100, 'Migration complete!');
      this.sendLog('success', 'Migration completed successfully');
      
      // Prepare migrated accounts list
      const migratedAccounts = Object.entries(migrationResult.migratedConfig.accounts || {}).map(([id, account]) => ({
        id,
        name: account.name,
        error: null
      }));
      
      // Collect all warnings
      const allWarnings = [
        ...(backupResult.warnings || []),
        ...(migrationResult.warnings || []),
        ...(sessionResult.warnings || [])
      ];
      
      // Send completion event
      this.sendComplete({
        success: true,
        errors: [],
        warnings: allWarnings,
        migratedAccounts,
        backupPath: backupResult.backupPath
      });
      
    } catch (error) {
      console.error('[MigrationDialog] Migration failed:', error);
      this.sendLog('error', `Migration failed: ${error.message}`);
      this.sendError({
        message: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 处理取消迁移请求
   * @private
   */
  handleCancelMigration() {
    console.log('[MigrationDialog] Migration cancelled by user');
    this.close();
  }

  /**
   * 处理继续到应用请求
   * @private
   */
  handleContinue() {
    console.log('[MigrationDialog] User continuing to app');
    this.close();
  }

  /**
   * 处理打开备份位置请求
   * @private
   */
  handleOpenBackup(event, backupPath) {
    console.log('[MigrationDialog] Opening backup location:', backupPath);
    
    if (backupPath) {
      // Open the folder containing the backup file
      const folderPath = path.dirname(backupPath);
      shell.showItemInFolder(backupPath);
    }
  }

  /**
   * 处理关闭窗口请求
   * @private
   */
  handleCloseWindow() {
    this.close();
  }

  /**
   * 发送进度更新到渲染进程
   * @param {number} progress - 进度百分比 (0-100)
   * @param {string} status - 状态文本
   * @param {string} [step] - 当前步骤描述
   */
  sendProgress(progress, status, step) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('migration:progress', {
        progress,
        status,
        step
      });
    }
  }

  /**
   * 发送日志条目到渲染进程
   * @param {string} level - 日志级别 (info, success, warning, error)
   * @param {string} message - 日志消息
   */
  sendLog(level, message) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('migration:log', {
        level,
        message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 发送完成事件到渲染进程
   * @param {Object} data - 完成数据
   */
  sendComplete(data) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('migration:complete', data);
    }
  }

  /**
   * 发送错误事件到渲染进程
   * @param {Object} error - 错误数据
   */
  sendError(error) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('migration:error', error);
    }
  }

  /**
   * 关闭对话框
   */
  close() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
  }

  /**
   * 清理资源
   * @private
   */
  cleanup() {
    this.unregisterIpcHandlers();
    this.window = null;
    this.migrationManager = null;
    this.isOpen = false;
  }

  /**
   * 检查对话框是否打开
   * @returns {boolean}
   */
  isDialogOpen() {
    return this.isOpen && this.window && !this.window.isDestroyed();
  }
}

module.exports = MigrationDialog;

