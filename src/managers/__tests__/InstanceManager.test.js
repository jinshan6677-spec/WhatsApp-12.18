/**
 * InstanceManager 测试
 */

const InstanceManager = require('../InstanceManager');
const AccountConfig = require('../../models/AccountConfig');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

// Mock Electron modules
jest.mock('electron', () => {
  const mockPath = require('path');
  const mockOs = require('os');
  
  return {
    BrowserWindow: jest.fn().mockImplementation(function(options) {
      this.options = options;
      this.destroyed = false;
      this.webContents = {
        setUserAgent: jest.fn(),
        getOSProcessId: jest.fn().mockReturnValue(12345),
        executeJavaScript: jest.fn().mockResolvedValue(true),
        on: jest.fn()
      };
      this.loadURL = jest.fn().mockResolvedValue(undefined);
      this.isDestroyed = jest.fn(() => this.destroyed);
      this.destroy = jest.fn(() => { this.destroyed = true; });
      this._closedCallbacks = [];
      this.close = jest.fn(() => { 
        this.destroyed = true;
        // Trigger all closed callbacks synchronously
        process.nextTick(() => {
          this._closedCallbacks.forEach(cb => cb());
          this._closedCallbacks = [];
        });
      });
      this.once = jest.fn((event, callback) => {
        if (event === 'closed') {
          this._closedCallbacks.push(callback);
        }
      });
      this.on = jest.fn();
      this.getBounds = jest.fn(() => ({ x: 100, y: 100, width: 1200, height: 800 }));
      this.setBounds = jest.fn();
      this.isMinimized = jest.fn(() => false);
      this.isMaximized = jest.fn(() => false);
      this.isVisible = jest.fn(() => true);
    }),
    app: {
      getPath: jest.fn((name) => {
        if (name === 'userData') {
          return mockPath.join(mockOs.tmpdir(), 'test-user-data');
        }
        return mockOs.tmpdir();
      }),
      getAppMetrics: jest.fn(() => [
        {
          pid: 12345,
          type: 'Browser',
          cpu: { percentCPUUsage: 10.5 },
          memory: { workingSetSize: 512 * 1024 } // 512 MB in KB
        }
      ])
    },
    session: {
      fromPartition: jest.fn(() => ({
        webRequest: {
          onBeforeSendHeaders: jest.fn()
        }
      }))
    },
    screen: {
      getAllDisplays: jest.fn(() => [
        {
          workArea: { x: 0, y: 0, width: 1920, height: 1080 }
        }
      ]),
      getPrimaryDisplay: jest.fn(() => ({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 }
      }))
    }
  };
});

describe('InstanceManager', () => {
  let manager;
  let tempDir;

  beforeEach(async () => {
    // 创建临时目录用于测试
    tempDir = path.join(os.tmpdir(), `test-instances-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Get mocked electron from jest.mock
    const { BrowserWindow, app, session, screen } = require('electron');
    
    // Mock dependencies
    const mockSessionManager = {
      hasSessionData: jest.fn().mockResolvedValue(false),
      configureSessionPersistence: jest.fn().mockResolvedValue({ success: true }),
      detectLoginStatus: jest.fn().mockResolvedValue(true)
    };
    
    const mockResourceManager = {
      canCreateInstance: jest.fn((currentCount) => {
        // Simulate max instance limit check
        const maxInstances = 5;
        if (currentCount >= maxInstances) {
          return Promise.resolve({
            allowed: false,
            reason: `Maximum instance limit reached: ${maxInstances}`
          });
        }
        return Promise.resolve({
          allowed: true,
          resources: {
            memoryUsagePercent: 50,
            cpuUsage: 30
          }
        });
      })
    };
    
    const mockTranslationIntegration = {
      injectScripts: jest.fn().mockResolvedValue({ success: true }),
      removeInstance: jest.fn()
    };
    
    const mockNotificationManager = {
      startUnreadMonitoring: jest.fn().mockReturnValue(setInterval(() => {}, 5000)),
      stopUnreadMonitoring: jest.fn((interval) => clearInterval(interval)),
      clearUnreadCount: jest.fn()
    };
    
    // 创建管理器实例，注入electron mock
    manager = new InstanceManager({
      userDataPath: tempDir,
      maxInstances: 5,
      sessionManager: mockSessionManager,
      resourceManager: mockResourceManager,
      translationIntegration: mockTranslationIntegration,
      notificationManager: mockNotificationManager,
      electron: { BrowserWindow, app, session, screen }
    });
  });

  afterEach(async () => {
    // 停止监控
    manager.stopGlobalMonitoring();
    
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('initialization', () => {
    test('should initialize with default options', () => {
      const defaultManager = new InstanceManager({
        userDataPath: tempDir // Provide userDataPath to avoid app.getPath call
      });
      
      expect(defaultManager.instances).toBeInstanceOf(Map);
      expect(defaultManager.instanceStatuses).toBeInstanceOf(Map);
      expect(defaultManager.maxInstances).toBe(30);
    });

    test('should initialize with custom options', () => {
      expect(manager.userDataPath).toBe(tempDir);
      expect(manager.maxInstances).toBe(5);
    });
  });

  describe('getInstanceStatus', () => {
    test('should return null for non-existent instance', () => {
      const status = manager.getInstanceStatus('non-existent-id');
      
      expect(status).toBeNull();
    });

    test('should return status after instance creation', async () => {
      const account = new AccountConfig({ name: 'Test Account' });
      const result = await manager.createInstance(account);
      
      expect(result.success).toBe(true);
      
      const status = manager.getInstanceStatus(account.id);
      expect(status).toBeDefined();
      expect(status.instanceId).toBe(account.id);
      expect(status.status).toBe('running');
    });
  });

  describe('getRunningInstances', () => {
    test('should return empty array when no instances running', () => {
      const running = manager.getRunningInstances();
      
      expect(running).toEqual([]);
    });

    test('should return running instances', async () => {
      const account1 = new AccountConfig({ name: 'Account 1' });
      const account2 = new AccountConfig({ name: 'Account 2' });
      
      await manager.createInstance(account1);
      await manager.createInstance(account2);
      
      const running = manager.getRunningInstances();
      
      expect(running.length).toBe(2);
    });
  });

  describe('createInstance', () => {
    test('should create instance successfully', async () => {
      const account = new AccountConfig({ name: 'Test Account' });
      
      const result = await manager.createInstance(account);
      
      expect(result.success).toBe(true);
      expect(result.instanceId).toBe(account.id);
      expect(result.window).toBeDefined();
    });

    test('should fail when instance already running', async () => {
      const account = new AccountConfig({ name: 'Test Account' });
      
      await manager.createInstance(account);
      const result = await manager.createInstance(account);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already running');
    });

    test('should fail when max instances reached', async () => {
      // Create max instances
      for (let i = 0; i < 5; i++) {
        const account = new AccountConfig({ name: `Account ${i}` });
        await manager.createInstance(account);
      }
      
      // Try to create one more
      const extraAccount = new AccountConfig({ name: 'Extra Account' });
      const result = await manager.createInstance(extraAccount);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum instance limit');
    });

    
  });

  describe('destroyInstance', () => {
    test('should destroy instance successfully', async () => {
      const account = new AccountConfig({ name: 'Test Account' });
      await manager.createInstance(account);
      
      const result = await manager.destroyInstance(account.id);
      
      expect(result.success).toBe(true);
      expect(manager.instanceExists(account.id)).toBe(false);
    });

    test('should fail to destroy non-existent instance', async () => {
      const result = await manager.destroyInstance('non-existent-id');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should save window state when destroying', async () => {
      const account = new AccountConfig({ name: 'Test Account' });
      await manager.createInstance(account);
      
      const result = await manager.destroyInstance(account.id, { saveState: true });
      
      expect(result.success).toBe(true);
    });
  });

  describe('restartInstance', () => {
    test('should restart instance successfully', async () => {
      const account = new AccountConfig({ name: 'Test Account' });
      await manager.createInstance(account);
      
      const result = await manager.restartInstance(account.id);
      
      expect(result.success).toBe(true);
      expect(manager.instanceExists(account.id)).toBe(true);
    });

    test('should fail to restart non-existent instance', async () => {
      const result = await manager.restartInstance('non-existent-id');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('instance counting', () => {
    test('getInstanceCount should return correct count', async () => {
      expect(manager.getInstanceCount()).toBe(0);
      
      const account1 = new AccountConfig({ name: 'Account 1' });
      await manager.createInstance(account1);
      expect(manager.getInstanceCount()).toBe(1);
      
      const account2 = new AccountConfig({ name: 'Account 2' });
      await manager.createInstance(account2);
      expect(manager.getInstanceCount()).toBe(2);
    });

    test('getRunningInstanceCount should return correct count', async () => {
      const account1 = new AccountConfig({ name: 'Account 1' });
      const account2 = new AccountConfig({ name: 'Account 2' });
      
      await manager.createInstance(account1);
      await manager.createInstance(account2);
      
      expect(manager.getRunningInstanceCount()).toBe(2);
      
      await manager.destroyInstance(account1.id);
      expect(manager.getRunningInstanceCount()).toBe(1);
    });
  });

  describe('instanceExists', () => {
    test('should return false for non-existent instance', () => {
      expect(manager.instanceExists('non-existent-id')).toBe(false);
    });

    test('should return true for existing instance', async () => {
      const account = new AccountConfig({ name: 'Test Account' });
      await manager.createInstance(account);
      
      expect(manager.instanceExists(account.id)).toBe(true);
    });
  });

  describe('window state management', () => {
    test('should save window state', async () => {
      const account = new AccountConfig({ name: 'Test Account' });
      await manager.createInstance(account);
      
      const result = manager.saveWindowState(account.id);
      
      expect(result.success).toBe(true);
      expect(result.bounds).toBeDefined();
    });

    test('should get window state', async () => {
      const account = new AccountConfig({ name: 'Test Account' });
      await manager.createInstance(account);
      
      const result = manager.getWindowState(account.id);
      
      expect(result.success).toBe(true);
      expect(result.bounds).toBeDefined();
      expect(result.bounds.width).toBe(1200);
      expect(result.bounds.height).toBe(800);
    });

    test('should set window state', async () => {
      const account = new AccountConfig({ name: 'Test Account' });
      await manager.createInstance(account);
      
      const result = manager.setWindowState(account.id, {
        x: 200,
        y: 200,
        width: 1400,
        height: 900
      });
      
      expect(result.success).toBe(true);
    });
  });

  

  describe('health monitoring', () => {
    test('should get instance health', async () => {
      const account = new AccountConfig({ name: 'Test Account' });
      await manager.createInstance(account);
      
      const health = await manager.getInstanceHealth(account.id);
      
      expect(health.healthy).toBe(true);
      expect(health.status).toBeDefined();
      expect(health.issues).toEqual([]);
    });

    test('should detect unhealthy instance', async () => {
      const account = new AccountConfig({ name: 'Test Account' });
      await manager.createInstance(account);
      
      // Manually set error status
      manager._updateStatus(account.id, {
        status: 'error',
        error: 'Test error'
      });
      
      const health = await manager.getInstanceHealth(account.id);
      
      expect(health.healthy).toBe(false);
      expect(health.issues.length).toBeGreaterThan(0);
    });

    test('should get all instances health summary', async () => {
      const account1 = new AccountConfig({ name: 'Account 1' });
      const account2 = new AccountConfig({ name: 'Account 2' });
      
      await manager.createInstance(account1);
      await manager.createInstance(account2);
      
      const summary = await manager.getAllInstancesHealth();
      
      expect(summary.total).toBe(2);
      expect(summary.healthy).toBe(2);
      expect(summary.unhealthy).toBe(0);
    });
  });

  describe('destroyAllInstances', () => {
    test('should destroy all instances', async () => {
      const account1 = new AccountConfig({ name: 'Account 1' });
      const account2 = new AccountConfig({ name: 'Account 2' });
      
      await manager.createInstance(account1);
      await manager.createInstance(account2);
      
      const result = await manager.destroyAllInstances();
      
      expect(result.success).toBe(true);
      expect(result.destroyed).toBe(2);
      expect(result.failed).toBe(0);
      expect(manager.getInstanceCount()).toBe(0);
    });
  });
});
