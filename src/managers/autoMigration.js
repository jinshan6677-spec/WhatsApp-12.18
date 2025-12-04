/**
 * 自动迁移模块
 * 
 * 在应用启动时自动检测并执行迁移
 * 可以集成到 main.js 中
 */

const MigrationManager = require('./MigrationManager');
const AccountConfigManager = require('./AccountConfigManager');

/**
 * 在应用启动时执行自动迁移
 * @param {Object} options - 配置选项
 * @param {string} options.userDataPath - 用户数据路径
 * @param {boolean} [options.silent] - 是否静默模式（不输出日志）
 * @returns {Promise<{migrated: boolean, message: string}>}
 */
async function autoMigrate(options) {
  const { userDataPath, silent = false } = options;

  const log = (message, ...args) => {
    if (!silent) {
      console.log(`[AutoMigration] ${message}`, ...args);
    }
  };

  try {
    log('Checking for migration...');

    // 初始化账号配置管理器
    const accountConfigManager = new AccountConfigManager({
      cwd: userDataPath
    });

    // 初始化迁移管理器
    const migrationManager = new MigrationManager({
      userDataPath,
      accountConfigManager
    });

    // 检查是否需要迁移
    const needsMigration = await migrationManager.needsMigration();

    if (!needsMigration) {
      log('No migration needed');
      return {
        migrated: false,
        message: 'No migration needed'
      };
    }

    log('Migration needed, starting migration process...');

    // 执行迁移
    const result = await migrationManager.migrate();

    if (result.success) {
      log('Migration completed successfully');
      return {
        migrated: true,
        message: 'Migration completed successfully',
        details: result.details
      };
    } else {
      log('Migration failed:', result.message);
      return {
        migrated: false,
        message: result.message,
        error: true
      };
    }
  } catch (error) {
    log('Error during auto-migration:', error);
    return {
      migrated: false,
      message: `Migration error: ${error.message}`,
      error: true
    };
  }
}

/**
 * 获取迁移状态
 * @param {string} userDataPath - 用户数据路径
 * @returns {Promise<Object>}
 */
async function getMigrationStatus(userDataPath) {
  try {
    const accountConfigManager = new AccountConfigManager({
      cwd: userDataPath
    });

    const migrationManager = new MigrationManager({
      userDataPath,
      accountConfigManager
    });

    return await migrationManager.getMigrationStatus();
  } catch (error) {
    console.error('[AutoMigration] Error getting migration status:', error);
    return {
      completed: false,
      needsMigration: false,
      error: error.message
    };
  }
}

module.exports = {
  autoMigrate,
  getMigrationStatus
};
