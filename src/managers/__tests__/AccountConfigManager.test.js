/**
 * AccountConfigManager 测试
 */

const AccountConfigManager = require('../AccountConfigManager');
const AccountConfig = require('../../models/AccountConfig');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

describe('AccountConfigManager', () => {
  let manager;
  let tempDir;

  beforeEach(async () => {
    // 创建临时目录用于测试
    tempDir = path.join(os.tmpdir(), `test-accounts-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // 创建管理器实例
    manager = new AccountConfigManager({
      configName: 'test-accounts',
      cwd: tempDir
    });
  });

  afterEach(async () => {
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('createAccount', () => {
    test('should create a new account with default values', async () => {
      const result = await manager.createAccount({ name: 'Test Account' });
      
      expect(result.success).toBe(true);
      expect(result.account).toBeDefined();
      expect(result.account.name).toBe('Test Account');
      expect(result.account.id).toBeDefined();
      expect(result.account.order).toBe(0);
      expect(result.account.sessionDir).toBeDefined();
      expect(result.account.note).toBe('');
      expect(result.account.autoStart).toBe(false);
    });

    test('should auto-assign order for new accounts', async () => {
      const result1 = await manager.createAccount({ name: 'Account 1' });
      const result2 = await manager.createAccount({ name: 'Account 2' });
      const result3 = await manager.createAccount({ name: 'Account 3' });
      
      expect(result1.account.order).toBe(0);
      expect(result2.account.order).toBe(1);
      expect(result3.account.order).toBe(2);
    });

    
  });

  describe('loadAccounts', () => {
    test('should load all accounts', async () => {
      await manager.createAccount({ name: 'Account 1' });
      await manager.createAccount({ name: 'Account 2' });
      
      const accounts = await manager.loadAccounts();
      
      expect(accounts.length).toBe(2);
      expect(accounts[0]).toBeInstanceOf(AccountConfig);
    });

    test('should return empty array when no accounts exist', async () => {
      const accounts = await manager.loadAccounts();
      
      expect(accounts).toEqual([]);
    });

    test('should load accounts sorted by order', async () => {
      await manager.createAccount({ name: 'Account 1', order: 2 });
      await manager.createAccount({ name: 'Account 2', order: 0 });
      await manager.createAccount({ name: 'Account 3', order: 1 });
      
      const accounts = await manager.loadAccounts({ sorted: true });
      
      expect(accounts.length).toBe(3);
      expect(accounts[0].name).toBe('Account 2');
      expect(accounts[1].name).toBe('Account 3');
      expect(accounts[2].name).toBe('Account 1');
    });
  });

  describe('getAccount', () => {
    test('should get account by ID', async () => {
      const createResult = await manager.createAccount({ name: 'Test Account' });
      const accountId = createResult.account.id;
      
      const account = await manager.getAccount(accountId);
      
      expect(account).toBeDefined();
      expect(account.id).toBe(accountId);
      expect(account.name).toBe('Test Account');
    });

    test('should return null for non-existent account', async () => {
      const account = await manager.getAccount('non-existent-id');
      
      expect(account).toBeNull();
    });
  });

  describe('updateAccount', () => {
    test('should update account configuration', async () => {
      const createResult = await manager.createAccount({ name: 'Original Name' });
      const accountId = createResult.account.id;
      
      const updateResult = await manager.updateAccount(accountId, {
        name: 'Updated Name'
      });
      
      expect(updateResult.success).toBe(true);
      expect(updateResult.account.name).toBe('Updated Name');
    });

    test('should fail to update non-existent account', async () => {
      const result = await manager.updateAccount('non-existent-id', {
        name: 'New Name'
      });
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('deleteAccount', () => {
    test('should delete account', async () => {
      const createResult = await manager.createAccount({ name: 'To Delete' });
      const accountId = createResult.account.id;
      
      const deleteResult = await manager.deleteAccount(accountId);
      
      expect(deleteResult.success).toBe(true);
      
      const account = await manager.getAccount(accountId);
      expect(account).toBeNull();
    });

    test('should fail to delete non-existent account', async () => {
      const result = await manager.deleteAccount('non-existent-id');
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validateConfig', () => {
    
  });

  describe('exportAccounts and importAccounts', () => {
    test('should export and import accounts', async () => {
      await manager.createAccount({ name: 'Account 1' });
      await manager.createAccount({ name: 'Account 2' });
      
      const exportData = await manager.exportAccounts();
      
      expect(exportData.accounts.length).toBe(2);
      
      // 清除所有账号
      await manager.clearAllAccounts();
      
      // 导入账号
      const importResult = await manager.importAccounts(exportData);
      
      expect(importResult.success).toBe(true);
      expect(importResult.imported).toBe(2);
      expect(importResult.skipped).toBe(0);
    });

    test('should skip existing accounts when overwrite is false', async () => {
      const createResult = await manager.createAccount({ name: 'Existing Account' });
      
      const exportData = await manager.exportAccounts();
      
      const importResult = await manager.importAccounts(exportData, { overwrite: false });
      
      expect(importResult.imported).toBe(0);
      expect(importResult.skipped).toBe(1);
    });
  });

  describe('utility methods', () => {
    test('accountExists should return correct value', async () => {
      const createResult = await manager.createAccount({ name: 'Test' });
      const accountId = createResult.account.id;
      
      expect(manager.accountExists(accountId)).toBe(true);
      expect(manager.accountExists('non-existent')).toBe(false);
    });

    test('getAccountCount should return correct count', async () => {
      expect(manager.getAccountCount()).toBe(0);
      
      await manager.createAccount({ name: 'Account 1' });
      expect(manager.getAccountCount()).toBe(1);
      
      await manager.createAccount({ name: 'Account 2' });
      expect(manager.getAccountCount()).toBe(2);
    });

    test('getAllAccountIds should return all IDs', async () => {
      const result1 = await manager.createAccount({ name: 'Account 1' });
      const result2 = await manager.createAccount({ name: 'Account 2' });
      
      const ids = manager.getAllAccountIds();
      
      expect(ids).toContain(result1.account.id);
      expect(ids).toContain(result2.account.id);
      expect(ids.length).toBe(2);
    });
  });

  describe('reorderAccounts', () => {
    test('should reorder accounts correctly', async () => {
      const result1 = await manager.createAccount({ name: 'Account 1' });
      const result2 = await manager.createAccount({ name: 'Account 2' });
      const result3 = await manager.createAccount({ name: 'Account 3' });
      
      const newOrder = [result3.account.id, result1.account.id, result2.account.id];
      const reorderResult = await manager.reorderAccounts(newOrder);
      
      expect(reorderResult.success).toBe(true);
      
      const accounts = await manager.loadAccounts({ sorted: true });
      expect(accounts[0].id).toBe(result3.account.id);
      expect(accounts[1].id).toBe(result1.account.id);
      expect(accounts[2].id).toBe(result2.account.id);
    });

    test('should fail to reorder with non-existent account', async () => {
      const result1 = await manager.createAccount({ name: 'Account 1' });
      
      const newOrder = [result1.account.id, 'non-existent-id'];
      const reorderResult = await manager.reorderAccounts(newOrder);
      
      expect(reorderResult.success).toBe(false);
      expect(reorderResult.errors).toBeDefined();
    });
  });

  describe('getAccountsSorted', () => {
    test('should return accounts sorted by order', async () => {
      await manager.createAccount({ name: 'Account C', order: 2 });
      await manager.createAccount({ name: 'Account A', order: 0 });
      await manager.createAccount({ name: 'Account B', order: 1 });
      
      const accounts = await manager.getAccountsSorted();
      
      expect(accounts[0].name).toBe('Account A');
      expect(accounts[1].name).toBe('Account B');
      expect(accounts[2].name).toBe('Account C');
    });
  });

  describe('backward compatibility', () => {
    test('should handle accounts without order field', async () => {
      // Manually create an account without order field (simulating old config)
      const oldAccount = new AccountConfig({ name: 'Old Account' });
      delete oldAccount.order;
      
      manager.accountsCache.set(oldAccount.id, oldAccount);
      manager._saveCacheToStore();
      
      // Reload to trigger backward compatibility
      manager._loadAccountsToCache();
      
      const account = await manager.getAccount(oldAccount.id);
      expect(account.order).toBeDefined();
      expect(typeof account.order).toBe('number');
    });

    test('should handle accounts without sessionDir field', async () => {
      // Manually create an account without sessionDir field (simulating old config)
      const oldAccount = new AccountConfig({ name: 'Old Account' });
      delete oldAccount.sessionDir;
      
      manager.accountsCache.set(oldAccount.id, oldAccount);
      manager._saveCacheToStore();
      
      // Reload to trigger backward compatibility
      manager._loadAccountsToCache();
      
      const account = await manager.getAccount(oldAccount.id);
      expect(account.sessionDir).toBeDefined();
      expect(account.sessionDir).toContain('session-data/account-');
    });

    test('should ignore deprecated window field', async () => {
      const accountWithWindow = await manager.createAccount({
        name: 'Account with Window',
        window: { x: 100, y: 100, width: 800, height: 600 }
      });
      
      expect(accountWithWindow.success).toBe(true);
      expect(accountWithWindow.account.window).toBeUndefined();
    });
  });
});
