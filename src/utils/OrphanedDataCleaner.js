/**
 * OrphanedDataCleaner - 遗留数据自动清理器
 * 
 * 负责扫描和清理已删除账号遗留下的数据目录
 * 包括 Electron Session Partition 数据和其他相关文件
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * OrphanedDataCleaner 类
 */
class OrphanedDataCleaner {
  /**
   * 创建清理器实例
   * @param {Object} [options] - 配置选项
   * @param {string} [options.userDataPath] - 用户数据根目录
   * @param {string} [options.logFunction] - 日志函数
   */
  constructor(options = {}) {
    this.userDataPath = options.userDataPath;
    this.log = options.logFunction || this._defaultLogger();
    this.cleanupHistory = [];
  }

  /**
   * 默认日志记录器
   * @private
   * @returns {Function}
   */
  _defaultLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [OrphanedDataCleaner] [${level.toUpperCase()}] ${message}`;
      
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
   * 获取 Partitions 目录路径
   * @private
   * @returns {string}
   */
  _getPartitionsPath() {
    if (!this.userDataPath) {
      throw new Error('User data path not configured');
    }
    return path.join(this.userDataPath, 'Partitions');
  }

  /**
   * 获取 Profiles 目录路径
   * @private
   * @returns {string}
   */
  _getProfilesPath() {
    if (!this.userDataPath) {
      throw new Error('User data path not configured');
    }
    return path.join(this.userDataPath, 'profiles');
  }

  /**
   * 扫描并清理 orphaned 账号目录
   * @param {string[]} existingAccountIds - 现有账号 ID 列表
   * @returns {Promise<{success: boolean, cleaned: number, errors: string[], details: Object}>}
   */
  async scanAndClean(existingAccountIds = []) {
    try {
      this.log('info', 'Starting orphaned data cleanup scan');
      
      const cleaned = [];
      const errors = [];
      let totalSizeFreed = 0;

      // 转换为 Set 以提高查找效率
      const existingIdsSet = new Set(existingAccountIds);

      // 1. 清理 Partitions 目录
      await this._cleanPartitionsDirectory(existingIdsSet, cleaned, errors, (size) => { totalSizeFreed += size; });

      // 2. 清理 Profiles 目录
      await this._cleanProfilesDirectory(existingIdsSet, cleaned, errors, (size) => { totalSizeFreed += size; });
      
      // 记录清理历史
      this.cleanupHistory.push({
        timestamp: new Date().toISOString(),
        cleanedCount: cleaned.length,
        totalSizeFreed,
        errors: errors.length
      });

      const result = {
        success: errors.length === 0,
        cleaned: cleaned.length,
        errors,
        details: {
          totalSizeFreed,
          cleanedDirectories: cleaned,
          scanTime: new Date().toISOString()
        }
      };

      this.log('info', `Cleanup completed: ${cleaned.length} directories cleaned, ${totalSizeFreed} bytes freed`);
      if (errors.length > 0) {
        this.log('warn', `Cleanup completed with ${errors.length} errors`);
      }

      return result;

    } catch (error) {
      this.log('error', 'Failed to perform orphaned data cleanup:', error);
      return {
        success: false,
        cleaned: 0,
        errors: [`Cleanup failed: ${error.message}`],
        details: {
          totalSizeFreed: 0,
          cleanedDirectories: []
        }
      };
    }
  }

  /**
   * 清理 Partitions 目录中的孤立账号数据
   * @private
   * @param {Set<string>} existingIdsSet - 现有账号 ID 集合
   * @param {Array} cleaned - 已清理目录列表
   * @param {Array} errors - 错误列表
   * @param {Function} addSize - 添加大小的回调函数
   */
  async _cleanPartitionsDirectory(existingIdsSet, cleaned, errors, addSize) {
    const partitionsPath = this._getPartitionsPath();

    // 检查 Partitions 目录是否存在
    try {
      await fs.access(partitionsPath);
    } catch {
      this.log('info', 'Partitions directory does not exist, skipping');
      return;
    }

    // 读取目录内容
    const entries = await fs.readdir(partitionsPath, { withFileTypes: true });
    this.log('info', `Found ${entries.length} entries in Partitions directory`);

    // 筛选出账号目录 (account_* 格式)
    const accountDirs = entries.filter(entry => 
      entry.isDirectory() && entry.name.startsWith('account_')
    );

    this.log('info', `Found ${accountDirs.length} potential account directories in Partitions`);

    // 检查每个账号目录
    for (const dir of accountDirs) {
      const accountId = dir.name.replace('account_', '');
      
      if (!existingIdsSet.has(accountId)) {
        this.log('info', `Found orphaned Partitions directory: ${dir.name}`);
        
        try {
          const dirPath = path.join(partitionsPath, dir.name);
          const stats = await this._getDirectorySize(dirPath);
          
          await fs.rm(dirPath, { recursive: true, force: true });
          
          cleaned.push({
            type: 'Partitions',
            directory: dir.name,
            path: dirPath,
            size: stats.size,
            fileCount: stats.files
          });
          
          addSize(stats.size);
          
          this.log('info', `Cleaned orphaned Partitions directory: ${dir.name} (${stats.size} bytes, ${stats.files} files)`);
          
        } catch (error) {
          const errorMsg = `Failed to clean Partitions directory ${dir.name}: ${error.message}`;
          errors.push(errorMsg);
          this.log('error', errorMsg);
        }
      } else {
        this.log('debug', `Skipping existing Partitions account directory: ${dir.name}`);
      }
    }
  }

  /**
   * 清理 Profiles 目录中的孤立账号数据
   * @private
   * @param {Set<string>} existingIdsSet - 现有账号 ID 集合
   * @param {Array} cleaned - 已清理目录列表
   * @param {Array} errors - 错误列表
   * @param {Function} addSize - 添加大小的回调函数
   */
  async _cleanProfilesDirectory(existingIdsSet, cleaned, errors, addSize) {
    const profilesPath = this._getProfilesPath();

    // 检查 Profiles 目录是否存在
    try {
      await fs.access(profilesPath);
    } catch {
      this.log('info', 'Profiles directory does not exist, skipping');
      return;
    }

    // 读取目录内容
    const entries = await fs.readdir(profilesPath, { withFileTypes: true });
    this.log('info', `Found ${entries.length} entries in Profiles directory`);

    // 筛选出账号目录（直接使用账号 ID 作为目录名）
    const profileDirs = entries.filter(entry => entry.isDirectory());

    this.log('info', `Found ${profileDirs.length} potential profile directories`);

    // 检查每个账号目录
    for (const dir of profileDirs) {
      const accountId = dir.name;
      
      if (!existingIdsSet.has(accountId)) {
        this.log('info', `Found orphaned Profiles directory: ${dir.name}`);
        
        try {
          const dirPath = path.join(profilesPath, dir.name);
          const stats = await this._getDirectorySize(dirPath);
          
          await fs.rm(dirPath, { recursive: true, force: true });
          
          cleaned.push({
            type: 'Profiles',
            directory: dir.name,
            path: dirPath,
            size: stats.size,
            fileCount: stats.files
          });
          
          addSize(stats.size);
          
          this.log('info', `Cleaned orphaned Profiles directory: ${dir.name} (${stats.size} bytes, ${stats.files} files)`);
          
        } catch (error) {
          const errorMsg = `Failed to clean Profiles directory ${dir.name}: ${error.message}`;
          errors.push(errorMsg);
          this.log('error', errorMsg);
        }
      } else {
        this.log('debug', `Skipping existing Profiles account directory: ${dir.name}`);
      }
    }
  }

  /**
   * 清理特定账号的数据目录
   * @param {string} accountId - 账号 ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async cleanAccountData(accountId) {
    try {
      this.log('info', `Cleaning data for account: ${accountId}`);
      
      const partitionsPath = this._getPartitionsPath();
      const accountDirPath = path.join(partitionsPath, `account_${accountId}`);
      
      try {
        // 检查目录是否存在
        await fs.access(accountDirPath);
      } catch {
        this.log('info', `Account directory does not exist: ${accountDirPath}`);
        return { success: true };
      }

      // 获取目录信息
      const stats = await this._getDirectorySize(accountDirPath);
      
      // 删除目录
      await fs.rm(accountDirPath, { recursive: true, force: true });
      
      this.log('info', `Cleaned account data for ${accountId}: ${stats.size} bytes, ${stats.files} files`);
      
      return { success: true };

    } catch (error) {
      this.log('error', `Failed to clean account data for ${accountId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取清理统计信息
   * @returns {Object}
   */
  getCleanupStats() {
    const totalCleanups = this.cleanupHistory.length;
    const totalCleaned = this.cleanupHistory.reduce((sum, cleanup) => sum + cleanup.cleanedCount, 0);
    const totalSizeFreed = this.cleanupHistory.reduce((sum, cleanup) => sum + cleanup.totalSizeFreed, 0);
    const totalErrors = this.cleanupHistory.reduce((sum, cleanup) => sum + cleanup.errors, 0);

    return {
      totalCleanups,
      totalCleaned,
      totalSizeFreed,
      totalErrors,
      lastCleanup: this.cleanupHistory[this.cleanupHistory.length - 1] || null,
      history: this.cleanupHistory
    };
  }

  /**
   * 递归计算目录大小
   * @private
   * @param {string} dirPath - 目录路径
   * @returns {Promise<{size: number, files: number}>}
   */
  async _getDirectorySize(dirPath) {
    let totalSize = 0;
    let totalFiles = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subStats = await this._getDirectorySize(fullPath);
          totalSize += subStats.size;
          totalFiles += subStats.files;
        } else if (entry.isFile()) {
          const stat = await fs.stat(fullPath);
          totalSize += stat.size;
          totalFiles++;
        }
      }
    } catch (error) {
      this.log('warn', `Error calculating directory size for ${dirPath}:`, error.message);
    }
    
    return { size: totalSize, files: totalFiles };
  }

  /**
   * 设置用户数据路径
   * @param {string} userDataPath - 用户数据路径
   */
  setUserDataPath(userDataPath) {
    this.userDataPath = userDataPath;
  }

  /**
   * 启用/禁用详细日志
   * @param {boolean} verbose - 是否启用详细日志
   */
  setVerboseLogging(verbose) {
    if (verbose) {
      this.log = (level, message, ...args) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [OrphanedDataCleaner] [${level.toUpperCase()}] ${message}`;
        
        if (level === 'error') {
          console.error(logMessage, ...args);
        } else if (level === 'warn') {
          console.warn(logMessage, ...args);
        } else {
          console.log(logMessage, ...args);
        }
      };
    } else {
      this.log = this._defaultLogger();
    }
  }

  /**
   * 清除清理历史记录
   */
  clearHistory() {
    this.cleanupHistory = [];
    this.log('info', 'Cleanup history cleared');
  }
}

module.exports = OrphanedDataCleaner;