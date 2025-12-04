/**
 * SessionManager 单元测试
 * 测试会话创建、隔离和登录状态检测
 */

const SessionManager = require('../SessionManager');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

// Create mock session object
const mockSessionInstance = {
  clearStorageData: jest.fn().mockResolvedValue(undefined),
  clearCache: jest.fn().mockResolvedValue(undefined),
  webRequest: {
    onBeforeSendHeaders: jest.fn()
  },
  setWebRTCIPHandlingPolicy: jest.fn()
};

// Mock Electron session
jest.mock('electron', () => {
  const mockSession = {
    fromPartition: jest.fn(() => mockSessionInstance)
  };
  return {
    session: mockSession,
    net: {
      request: jest.fn()
    }
  };
});

// Get the mocked electron module
const electron = require('electron');
const { session } = electron;

describe('SessionManager', () => {
  let sessionManager;
  let tempDir;
  let mockSession;

  beforeEach(async () => {
    // 创建临时目录
    tempDir = path.join(os.tmpdir(), `test-sessions-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Reset mock session
    mockSession = mockSessionInstance;
    mockSession.clearStorageData.mockClear();
    mockSession.clearCache.mockClear();
    mockSession.webRequest.onBeforeSendHeaders.mockClear();
    session.fromPartition.mockClear();
    session.fromPartition.mockReturnValue(mockSession);

    // 创建 SessionManager 实例，注入electron mock
    sessionManager = new SessionManager({
      userDataPath: tempDir,
      electron: electron
    });
  });

  afterEach(async () => {
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('清理临时目录失败:', error);
    }

    jest.clearAllMocks();
  });

  describe('会话创建和隔离', () => {
    test('应该成功创建账号会话', async () => {
      const result = await sessionManager.createSession('test-account-1');

      expect(result.success).toBe(true);
      expect(result.session).toBe(mockSession);
      expect(session.fromPartition).toHaveBeenCalledWith('persist:account_test-account-1');
    });

    test('应该为不同账号创建隔离的会话', async () => {
      await sessionManager.createSession('account-1');
      await sessionManager.createSession('account-2');

      expect(session.fromPartition).toHaveBeenCalledWith('persist:account_account-1');
      expect(session.fromPartition).toHaveBeenCalledWith('persist:account_account-2');
      expect(session.fromPartition).toHaveBeenCalledTimes(2);
    });

    test('应该缓存会话实例', async () => {
      await sessionManager.createSession('test-account');
      const session1 = sessionManager.getSession('test-account');
      const session2 = sessionManager.getSession('test-account');

      expect(session1).toBe(session2);
      expect(session1).toBe(mockSession);
    });

    test('应该拒绝无效的 accountId', async () => {
      const result1 = await sessionManager.createSession('');
      const result2 = await sessionManager.createSession(null);

      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Invalid accountId');
      expect(result2.success).toBe(false);
    });
  });

  

  describe('登录状态检测', () => {
    let mockWebContents;
    let mockView;

    beforeEach(() => {
      mockWebContents = {
        executeJavaScript: jest.fn(),
        isDestroyed: jest.fn().mockReturnValue(false)
      };

      mockView = {
        webContents: mockWebContents
      };
    });

    test('应该检测已登录状态', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      const isLoggedIn = await sessionManager.detectLoginStatus('test-account', mockView);

      expect(isLoggedIn).toBe(true);
      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
    });

    test('应该检测未登录状态', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(false);

      const isLoggedIn = await sessionManager.detectLoginStatus('test-account', mockView);

      expect(isLoggedIn).toBe(false);
    });

    test('应该缓存登录状态', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      await sessionManager.detectLoginStatus('test-account', mockView);
      const cached = sessionManager.getCachedLoginStatus('test-account');

      expect(cached).toBe(true);
    });

    test('应该处理无效的 view', async () => {
      const isLoggedIn = await sessionManager.detectLoginStatus('test-account', null);

      expect(isLoggedIn).toBe(false);
    });

    test('应该处理已销毁的 view', async () => {
      mockView.isDestroyed = jest.fn().mockReturnValue(true);

      const isLoggedIn = await sessionManager.detectLoginStatus('test-account', mockView);

      expect(isLoggedIn).toBe(false);
    });
  });

  describe('会话数据管理', () => {
    beforeEach(async () => {
      await sessionManager.createSession('test-account');
    });

    test('应该检测会话数据是否存在', async () => {
      const userDataDir = sessionManager.getUserDataDir('test-account');
      await fs.mkdir(path.join(userDataDir, 'IndexedDB'), { recursive: true });

      const hasData = await sessionManager.hasSessionData('test-account');

      expect(hasData).toBe(true);
    });

    test('应该检测不存在的会话数据', async () => {
      const hasData = await sessionManager.hasSessionData('non-existent');

      expect(hasData).toBe(false);
    });

    test('应该清除会话数据', async () => {
      const result = await sessionManager.clearSessionData('test-account');

      expect(result.success).toBe(true);
      expect(mockSession.clearStorageData).toHaveBeenCalled();
      expect(mockSession.clearCache).toHaveBeenCalled();
    });

    test('应该获取会话数据统计', async () => {
      const userDataDir = sessionManager.getUserDataDir('test-account');
      await fs.mkdir(userDataDir, { recursive: true });
      await fs.writeFile(path.join(userDataDir, 'test.txt'), 'test data');

      const stats = await sessionManager.getSessionDataStats('test-account');

      expect(stats.size).toBeGreaterThan(0);
      expect(stats.files).toBeGreaterThan(0);
    });
  });

  describe('会话隔离验证', () => {
    test('应该验证会话隔离性', async () => {
      await sessionManager.createSession('test-account');
      const result = await sessionManager.verifySessionIsolation('test-account');

      expect(result.isolated).toBe(true);
      expect(result.details.partition).toBe('persist:account_test-account');
      expect(result.details.userDataDir).toContain('test-account');
    });

    test('应该处理不存在的会话', async () => {
      const result = await sessionManager.verifySessionIsolation('non-existent');

      // Session 使用独立的 partition，即使还未创建也是隔离的
      // 所以 isolated 应该是 true
      expect(result.isolated).toBe(true);
      expect(result.details.partition).toBe('persist:account_non-existent');
    });
  });

  describe('缓存管理', () => {
    test('应该清除账号的所有缓存', () => {
      sessionManager.setLoginStatus('test-account', true);

      sessionManager.clearAccountCache('test-account');

      expect(sessionManager.getCachedLoginStatus('test-account')).toBeNull();
    });

    test('应该清除登录状态缓存', () => {
      sessionManager.setLoginStatus('test-account', true);
      sessionManager.clearLoginStatusCache('test-account');

      expect(sessionManager.getCachedLoginStatus('test-account')).toBeNull();
    });
  });

  describe('会话持久化', () => {
    test('应该配置会话持久化', async () => {
      await sessionManager.createSession('test-account');
      const result = await sessionManager.configureSessionPersistence('test-account');

      expect(result.success).toBe(true);
    });

    test('应该获取会话持久化状态', async () => {
      const status = await sessionManager.getSessionPersistenceStatus('test-account');

      expect(status).toHaveProperty('persisted');
      expect(status).toHaveProperty('dataSize');
    });
  });

  describe('用户数据目录', () => {
    test('应该返回正确的用户数据目录路径', () => {
      const dir = sessionManager.getUserDataDir('test-account');

      expect(dir).toContain('profiles');
      expect(dir).toContain('test-account');
    });

    test('应该删除用户数据目录', async () => {
      const userDataDir = sessionManager.getUserDataDir('test-account');
      await fs.mkdir(userDataDir, { recursive: true });

      const result = await sessionManager.deleteUserDataDir('test-account');

      expect(result.success).toBe(true);

      // 验证目录已删除
      await expect(fs.access(userDataDir)).rejects.toThrow();
    });
  });
});
