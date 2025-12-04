/**
 * OrphanedDataCleaner 测试用例
 * 
 * 测试自动清理功能的各个方面
 */

// Mock fs methods - must be before require
const mockFs = {
  access: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  mkdir: jest.fn(),
  rm: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn()
};

jest.mock('fs', () => ({
  promises: mockFs
}));

const fs = require('fs').promises;
const path = require('path');
const OrphanedDataCleaner = require('../OrphanedDataCleaner');

// Mock console methods to reduce test output noise
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

describe('OrphanedDataCleaner', () => {
  let cleaner;
  let mockUserDataPath;
  let mockPartitionsPath;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    mockUserDataPath = '/mock/user/data';
    mockPartitionsPath = path.join(mockUserDataPath, 'Partitions');
    
    cleaner = new OrphanedDataCleaner({
      userDataPath: mockUserDataPath,
      logFunction: jest.fn()
    });
  });
  
  describe('构造函数', () => {
    test('应该正确初始化清理器', () => {
      expect(cleaner.userDataPath).toBe(mockUserDataPath);
      expect(cleaner.log).toBeDefined();
      expect(cleaner.cleanupHistory).toEqual([]);
    });
    
    test('应该使用默认日志记录器', () => {
      const cleanerWithoutLogger = new OrphanedDataCleaner();
      expect(cleanerWithoutLogger.log).toBeDefined();
      expect(cleanerWithoutLogger.userDataPath).toBeUndefined();
    });
  });
  
  describe('scanAndClean 方法', () => {
    beforeEach(() => {
      // Mock fs.access to succeed (directory exists)
      fs.access.mockResolvedValue(undefined);
    });
    
    test('当 Partitions 目录不存在时应该成功', async () => {
      // Mock fs.access to fail (directory doesn't exist)
      fs.access.mockRejectedValue(new Error('Directory not found'));
      
      const result = await cleaner.scanAndClean(['account1', 'account2']);
      
      expect(result.success).toBe(true);
      expect(result.cleaned).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.details.totalSizeFreed).toBe(0);
    });
    
    test('当没有账号目录时应该成功', async () => {
      // Mock empty directory
      fs.readdir.mockResolvedValue([]);
      
      const result = await cleaner.scanAndClean(['account1', 'account2']);
      
      expect(result.success).toBe(true);
      expect(result.cleaned).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.details.cleanedDirectories).toEqual([]);
    });
    
    test('应该正确清理 orphaned 目录', async () => {
      // Mock directory structure
      const mockEntries = [
        { name: 'account_orphaned-1', isDirectory: () => true },
        { name: 'account_existing-1', isDirectory: () => true },
        { name: 'account_orphaned-2', isDirectory: () => true },
        { name: 'regular-dir', isDirectory: () => true },
        { name: 'regular-file.txt', isDirectory: () => false }
      ];
      
      fs.readdir.mockResolvedValue(mockEntries);
      
      // Mock directory stats
      const mockStats = { size: 100, files: 5 };
      fs.stat.mockResolvedValue(mockStats);
      cleaner._getDirectorySize = jest.fn().mockResolvedValue(mockStats);
      
      const existingAccountIds = ['existing-1'];
      const result = await cleaner.scanAndClean(existingAccountIds);
      
      expect(result.success).toBe(true);
      expect(result.cleaned).toBe(2); // orphaned-1 and orphaned-2
      expect(result.errors).toEqual([]);
      expect(result.details.totalSizeFreed).toBe(200); // 100 * 2
      expect(result.details.cleanedDirectories).toHaveLength(2);
      
      // Verify that orphaned directories were removed
      expect(fs.rm).toHaveBeenCalledTimes(2);
      
      // Check which directories were removed
      const rmCalls = fs.rm.mock.calls.map(call => call[0]);
      expect(rmCalls).toContain(path.join(mockPartitionsPath, 'account_orphaned-1'));
      expect(rmCalls).toContain(path.join(mockPartitionsPath, 'account_orphaned-2'));
    });
    
    test('应该保留现有的账号目录', async () => {
      // Mock directory structure
      const mockEntries = [
        { name: 'account_existing-1', isDirectory: () => true },
        { name: 'account_existing-2', isDirectory: () => true }
      ];
      
      fs.readdir.mockResolvedValue(mockEntries);
      
      const existingAccountIds = ['existing-1', 'existing-2'];
      const result = await cleaner.scanAndClean(existingAccountIds);
      
      expect(result.success).toBe(true);
      expect(result.cleaned).toBe(0);
      expect(result.errors).toEqual([]);
      
      // Verify that no directories were removed
      expect(fs.rm).not.toHaveBeenCalled();
    });
    
    test('应该处理清理错误', async () => {
      // Mock directory structure
      const mockEntries = [
        { name: 'account_orphaned-1', isDirectory: () => true },
        { name: 'account_existing-1', isDirectory: () => true }
      ];
      
      fs.readdir.mockResolvedValue(mockEntries);
      
      // Mock successful removal for existing account
      // Mock failed removal for orphaned account
      fs.rm.mockImplementation((path) => {
        if (path.includes('account_orphaned-1')) {
          return Promise.reject(new Error('Permission denied'));
        }
        return Promise.resolve();
      });
      
      // Mock successful directory size calculation
      cleaner._getDirectorySize = jest.fn().mockResolvedValue({ size: 100, files: 5 });
      
      const existingAccountIds = ['existing-1'];
      const result = await cleaner.scanAndClean(existingAccountIds);
      
      expect(result.success).toBe(false); // Should fail due to error
      expect(result.cleaned).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Permission denied');
    });
    
    test('应该记录清理历史', async () => {
      // Mock directory structure
      const mockEntries = [
        { name: 'account_orphaned-1', isDirectory: () => true }
      ];
      
      fs.readdir.mockResolvedValue(mockEntries);
      
      // Mock directory stats and removal
      const mockStats = { size: 100, files: 5 };
      cleaner._getDirectorySize = jest.fn().mockResolvedValue(mockStats);
      fs.rm.mockResolvedValue(undefined);
      
      const existingAccountIds = [];
      const result = await cleaner.scanAndClean(existingAccountIds);
      
      expect(cleaner.cleanupHistory).toHaveLength(1);
      expect(cleaner.cleanupHistory[0]).toMatchObject({
        cleanedCount: 1,
        totalSizeFreed: 100,
        errors: 0
      });
    });
  });
  
  describe('cleanAccountData 方法', () => {
    test('应该成功清理指定账号的数据', async () => {
      const accountId = 'test-account';
      const expectedPath = path.join(mockPartitionsPath, `account_${accountId}`);
      
      // Mock directory exists
      fs.access.mockResolvedValue(undefined);
      
      // Mock directory stats
      const mockStats = { size: 50, files: 3 };
      cleaner._getDirectorySize = jest.fn().mockResolvedValue(mockStats);
      
      const result = await cleaner.cleanAccountData(accountId);
      
      expect(result.success).toBe(true);
      expect(fs.rm).toHaveBeenCalledWith(expectedPath, { recursive: true, force: true });
    });
    
    test('当目录不存在时应该成功', async () => {
      const accountId = 'nonexistent-account';
      
      // Mock directory doesn't exist
      fs.access.mockRejectedValue(new Error('Directory not found'));
      
      const result = await cleaner.cleanAccountData(accountId);
      
      expect(result.success).toBe(true);
      expect(fs.rm).not.toHaveBeenCalled();
    });
    
    test('应该处理清理错误', async () => {
      const accountId = 'test-account';
      const expectedPath = path.join(mockPartitionsPath, `account_${accountId}`);
      
      // Mock directory exists
      fs.access.mockResolvedValue(undefined);
      
      // Mock removal failure
      fs.rm.mockRejectedValue(new Error('Permission denied'));
      
      const result = await cleaner.cleanAccountData(accountId);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
      expect(fs.rm).toHaveBeenCalledWith(expectedPath, { recursive: true, force: true });
    });
  });
  
  describe('getCleanupStats 方法', () => {
    test('应该返回正确的统计信息', () => {
      // Mock cleanup history
      cleaner.cleanupHistory = [
        {
          timestamp: '2023-01-01T00:00:00.000Z',
          cleanedCount: 2,
          totalSizeFreed: 200,
          errors: 0
        },
        {
          timestamp: '2023-01-02T00:00:00.000Z',
          cleanedCount: 1,
          totalSizeFreed: 100,
          errors: 1
        }
      ];
      
      const stats = cleaner.getCleanupStats();
      
      expect(stats.totalCleanups).toBe(2);
      expect(stats.totalCleaned).toBe(3);
      expect(stats.totalSizeFreed).toBe(300);
      expect(stats.totalErrors).toBe(1);
      expect(stats.lastCleanup).toBe(cleaner.cleanupHistory[1]);
      expect(stats.history).toBe(cleaner.cleanupHistory);
    });
    
    test('当没有清理历史时应该返回默认值', () => {
      const stats = cleaner.getCleanupStats();
      
      expect(stats.totalCleanups).toBe(0);
      expect(stats.totalCleaned).toBe(0);
      expect(stats.totalSizeFreed).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.lastCleanup).toBeNull();
      expect(stats.history).toEqual([]);
    });
  });
  
  describe('_getDirectorySize 方法', () => {
    test('应该正确计算目录大小', async () => {
      const testDir = '/test/directory';
      
      // Mock readdir to return mixed files and directories
      const mockEntries = [
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'subdir', isDirectory: () => true, isFile: () => false },
        { name: 'file2.txt', isDirectory: () => false, isFile: () => true }
      ];
      
      fs.readdir.mockResolvedValue(mockEntries);
      
      // Mock stat for files
      fs.stat.mockImplementation((filePath) => {
        if (filePath.includes('file1.txt')) {
          return Promise.resolve({ size: 10 });
        } else if (filePath.includes('file2.txt')) {
          return Promise.resolve({ size: 20 });
        }
        return Promise.resolve({ size: 0 });
      });
      
      // Mock recursive call for subdir
      cleaner._getDirectorySize = jest.fn()
        .mockResolvedValueOnce({ size: 30, files: 2 }); // For subdir
      
      const result = await cleaner._getDirectorySize(testDir);
      
      expect(result.size).toBe(60); // 10 + 20 + 30
      expect(result.files).toBe(4); // 2 files + 2 files in subdir
    });
    
    test('应该处理权限错误', async () => {
      const testDir = '/test/directory';
      
      // Mock readdir to throw error
      fs.readdir.mockRejectedValue(new Error('Permission denied'));
      
      const result = await cleaner._getDirectorySize(testDir);
      
      expect(result.size).toBe(0);
      expect(result.files).toBe(0);
    });
  });
  
  describe('工具方法', () => {
    test('setUserDataPath 应该正确设置路径', () => {
      const newPath = '/new/path';
      cleaner.setUserDataPath(newPath);
      expect(cleaner.userDataPath).toBe(newPath);
    });
    
    test('setVerboseLogging 应该切换日志详细程度', () => {
      const originalLogger = cleaner.log;
      cleaner.setVerboseLogging(true);
      
      // Should still have a logger function
      expect(cleaner.log).toBeDefined();
      expect(cleaner.log).not.toBe(originalLogger);
    });
    
    test('clearHistory 应该清除历史记录', () => {
      // Mock some history
      cleaner.cleanupHistory = [{ timestamp: '2023-01-01', cleanedCount: 1 }];
      
      cleaner.clearHistory();
      
      expect(cleaner.cleanupHistory).toEqual([]);
    });
  });
});