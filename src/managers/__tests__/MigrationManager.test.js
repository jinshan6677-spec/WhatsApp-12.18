/**
 * MigrationManager 单元测试
 */

const MigrationManager = require('../MigrationManager');
const AccountConfigManager = require('../AccountConfigManager');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('MigrationManager', () => {
  let tempDir;
  let migrationManager;
  let accountConfigManager;

  beforeEach(async () => {
    // 创建临时测试目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'migration-test-'));
    
    // 初始化管理器
    accountConfigManager = new AccountConfigManager({
      cwd: tempDir
    });
    
    migrationManager = new MigrationManager({
      userDataPath: tempDir,
      accountConfigManager
    });
  });

  afterEach(async () => {
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up temp directory:', error);
    }
  });

  describe('needsMigration', () => {
    test('should return false when no old session data exists', async () => {
      const needsMigration = await migrationManager.needsMigration();
      expect(needsMigration).toBe(false);
    });

    test('should return true when old session data exists and profiles do not', async () => {
      // 创建旧的 session-data 目录
      const oldSessionPath = path.join(tempDir, 'session-data', 'session');
      await fs.mkdir(oldSessionPath, { recursive: true });
      await fs.writeFile(path.join(oldSessionPath, 'test.txt'), 'test data');

      const needsMigration = await migrationManager.needsMigration();
      expect(needsMigration).toBe(true);
    });

    test('should return false when migration is already completed', async () => {
      // 创建迁移标记文件
      const markerPath = path.join(tempDir, '.migration-completed');
      await fs.writeFile(markerPath, JSON.stringify({ completed: true }));

      const needsMigration = await migrationManager.needsMigration();
      expect(needsMigration).toBe(false);
    });
  });

  describe('migrate', () => {
    test('should successfully migrate session data', async () => {
      // 创建旧的 session-data 目录和文件
      const oldSessionPath = path.join(tempDir, 'session-data', 'session');
      await fs.mkdir(oldSessionPath, { recursive: true });
      await fs.writeFile(path.join(oldSessionPath, 'Cookies'), 'cookie data');
      await fs.writeFile(path.join(oldSessionPath, 'test.txt'), 'test data');

      // 执行迁移
      const result = await migrationManager.migrate();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Migration completed successfully');

      // 验证文件已复制
      const newProfilePath = path.join(tempDir, 'profiles', 'default');
      const cookiesExist = await fs.access(path.join(newProfilePath, 'Cookies'))
        .then(() => true)
        .catch(() => false);
      const testFileExist = await fs.access(path.join(newProfilePath, 'test.txt'))
        .then(() => true)
        .catch(() => false);

      expect(cookiesExist).toBe(true);
      expect(testFileExist).toBe(true);
    });

    test('should create default account configuration', async () => {
      // 创建旧的 session-data 目录
      const oldSessionPath = path.join(tempDir, 'session-data', 'session');
      await fs.mkdir(oldSessionPath, { recursive: true });

      // 执行迁移
      const result = await migrationManager.migrate();

      expect(result.success).toBe(true);

      // 验证默认账号已创建
      const defaultAccount = await accountConfigManager.getAccount('default');
      expect(defaultAccount).not.toBeNull();
      expect(defaultAccount.id).toBe('default');
      expect(defaultAccount.name).toBe('Default Account');
    });

    test('should load translation configuration if exists', async () => {
      // 创建旧的 session-data 目录
      const oldSessionPath = path.join(tempDir, 'session-data', 'session');
      await fs.mkdir(oldSessionPath, { recursive: true });

      // 创建翻译配置文件
      const translationConfig = {
        accounts: {
          default: {
            global: {
              autoTranslate: true,
              engine: 'google',
              targetLang: 'zh-CN'
            },
            inputBox: {
              enabled: true
            }
          }
        }
      };
      const configPath = path.join(tempDir, 'enable-translation-config.json');
      await fs.writeFile(configPath, JSON.stringify(translationConfig));

      // 执行迁移
      const result = await migrationManager.migrate();

      expect(result.success).toBe(true);

      // 验证翻译配置已加载
      const defaultAccount = await accountConfigManager.getAccount('default');
      expect(defaultAccount.translation.enabled).toBe(true);
      expect(defaultAccount.translation.engine).toBe('google');
      expect(defaultAccount.translation.targetLanguage).toBe('zh-CN');
      expect(defaultAccount.translation.autoTranslate).toBe(true);
      expect(defaultAccount.translation.translateInput).toBe(true);
    });

    test('should mark migration as completed', async () => {
      // 创建旧的 session-data 目录
      const oldSessionPath = path.join(tempDir, 'session-data', 'session');
      await fs.mkdir(oldSessionPath, { recursive: true });

      // 执行迁移
      await migrationManager.migrate();

      // 验证迁移标记文件已创建
      const markerPath = path.join(tempDir, '.migration-completed');
      const markerExists = await fs.access(markerPath)
        .then(() => true)
        .catch(() => false);

      expect(markerExists).toBe(true);

      // 验证标记文件内容
      const markerContent = await fs.readFile(markerPath, 'utf8');
      const markerData = JSON.parse(markerContent);
      expect(markerData.version).toBe('1.0.0');
      expect(markerData.migratedFrom).toBe('single-instance');
      expect(markerData.migratedTo).toBe('multi-instance');
    });

    test('should not migrate if already completed', async () => {
      // 创建迁移标记文件
      const markerPath = path.join(tempDir, '.migration-completed');
      await fs.writeFile(markerPath, JSON.stringify({ completed: true }));

      // 执行迁移
      const result = await migrationManager.migrate();

      expect(result.success).toBe(true);
      expect(result.message).toBe('No migration needed');
    });
  });

  describe('getMigrationStatus', () => {
    test('should return not completed when no migration marker exists', async () => {
      const status = await migrationManager.getMigrationStatus();
      expect(status.completed).toBe(false);
    });

    test('should return completed status when migration marker exists', async () => {
      // 创建迁移标记文件
      const markerData = {
        migrationDate: new Date().toISOString(),
        version: '1.0.0'
      };
      const markerPath = path.join(tempDir, '.migration-completed');
      await fs.writeFile(markerPath, JSON.stringify(markerData));

      const status = await migrationManager.getMigrationStatus();
      expect(status.completed).toBe(true);
      expect(status.version).toBe('1.0.0');
    });
  });

  describe('resetMigration', () => {
    test('should remove migration marker', async () => {
      // 创建迁移标记文件
      const markerPath = path.join(tempDir, '.migration-completed');
      await fs.writeFile(markerPath, JSON.stringify({ completed: true }));

      // 重置迁移
      await migrationManager.resetMigration();

      // 验证标记文件已删除
      const markerExists = await fs.access(markerPath)
        .then(() => true)
        .catch(() => false);

      expect(markerExists).toBe(false);
    });
  });
});
