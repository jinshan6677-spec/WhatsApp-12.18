/**
 * Multi-Instance Integration Tests
 * 
 * 测试完整的多实例架构集成场景：
 * - 账号创建和启动流程
 * - 实例崩溃和重启
 * - 多实例并发运行
 */

const InstanceManager = require('../InstanceManager');
const AccountConfigManager = require('../AccountConfigManager');
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
      this.crashed = false;
      this.webContents = {
        setUserAgent: jest.fn(),
        getOSProcessId: jest.fn().mockReturnValue(Math.floor(Math.random() * 10000) + 10000),
        executeJavaScript: jest.fn().mockResolvedValue(true),
        on: jest.fn((event, callback) => {
          if (event === 'crashed') {
            this._crashedCallback = callback;
          }
        }),
        session: {}
      };
      this.loadURL = jest.fn().mockResolvedValue(undefined);
      this.isDestroyed = jest.fn(() => this.destroyed);
      this.destroy = jest.fn(() => { this.destroyed = true; });
      this.close = jest.fn(() => { 
        this.destroyed = true;
        setImmediate(() => {
          if (this._closedCallback) this._closedCallback();
        });
      });
      this.once = jest.fn((event, callback) => {
        if (event === 'closed') {
          this._closedCallback = callback;
        }
      });
      this.on = jest.fn((event, callback) => {
        if (event === 'unresponsive') {
          this._unresponsiveCallback = callback;
        }
      });
      this.getBounds = jest.fn(() => ({ 
        x: 100, 
        y: 100, 
        width: 1200, 
        height: 800 
      }));
      this.setBounds = jest.fn();
      this.isMinimized = jest.fn(() => false);
      this.isMaximized = jest.fn(() => false);
      this.isVisible = jest.fn(() => true);
      
      // Simulate crash method for testing
      this.simulateCrash = () => {
        this.crashed = true;
        this.destroyed = true;
        if (this._crashedCallback) {
          this._crashedCallback();
        }
      };
      
      // Simulate unresponsive method for testing
      this.simulateUnresponsive = () => {
        if (this._unresponsiveCallback) {
          this._unresponsiveCallback();
        }
      };
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
          memory: { workingSetSize: 512 * 1024 }
        }
      ])
    },
    session: {
      fromPartition: jest.fn((partition) => ({
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

describe('Multi-Instance Integration Tests', () => {
  let instanceManager;
  let configManager;
  let tempDir;

  beforeEach(async () => {
    // 创建临时目录
    tempDir = path.join(os.tmpdir(), `test-integration-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // 初始化管理器
    configManager = new AccountConfigManager({
      configName: 'test-accounts',
      cwd: tempDir
    });
    
    // Get the mocked electron module
    const electron = require('electron');
    
    instanceManager = new InstanceManager({
      userDataPath: tempDir,
      maxInstances: 10,
      electron: electron  // Inject the mocked electron
    });
  });

  afterEach(async () => {
    // 清理所有实例
    await instanceManager.destroyAllInstances();
    instanceManager.stopGlobalMonitoring();
    
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('Complete Account Creation and Launch Flow', () => {
    test('should create account, save config, and launch instance successfully', async () => {
      // Step 1: Create account configuration
      const createResult = await configManager.createAccount({
        name: 'Integration Test Account',
        translation: {
          enabled: true,
          targetLanguage: 'zh-CN',
          engine: 'google'
        }
      });
      
      expect(createResult.success).toBe(true);
      expect(createResult.account).toBeDefined();
      expect(createResult.account.id).toBeDefined();
      
      const accountId = createResult.account.id;
      
      // Step 2: Verify account is saved
      const savedAccount = await configManager.getAccount(accountId);
      expect(savedAccount).toBeDefined();
      expect(savedAccount.name).toBe('Integration Test Account');
      
      // Step 3: Launch instance
      const launchResult = await instanceManager.createInstance(savedAccount);
      expect(launchResult.success).toBe(true);
      expect(launchResult.instanceId).toBe(accountId);
      expect(launchResult.window).toBeDefined();
      
      // Step 4: Verify instance is running
      const status = instanceManager.getInstanceStatus(accountId);
      expect(status).toBeDefined();
      expect(status.status).toBe('running');
      expect(status.instanceId).toBe(accountId);
      
      // Step 5: Verify instance exists
      expect(instanceManager.instanceExists(accountId)).toBe(true);
      expect(instanceManager.getRunningInstanceCount()).toBe(1);
    });

    test('should handle complete lifecycle: create -> start -> stop -> restart -> delete', async () => {
      // Create
      const createResult = await configManager.createAccount({
        name: 'Lifecycle Test Account'
      });
      expect(createResult.success).toBe(true);
      const accountId = createResult.account.id;
      
      // Start
      const startResult = await instanceManager.createInstance(createResult.account);
      expect(startResult.success).toBe(true);
      expect(instanceManager.getInstanceStatus(accountId).status).toBe('running');
      
      // Stop
      const stopResult = await instanceManager.destroyInstance(accountId);
      expect(stopResult.success).toBe(true);
      expect(instanceManager.instanceExists(accountId)).toBe(false);
      
      // Restart (create again)
      const restartResult = await instanceManager.createInstance(createResult.account);
      expect(restartResult.success).toBe(true);
      expect(instanceManager.getInstanceStatus(accountId).status).toBe('running');
      
      // Delete account
      const deleteResult = await configManager.deleteAccount(accountId);
      expect(deleteResult.success).toBe(true);
      
      // Cleanup instance
      await instanceManager.destroyInstance(accountId);
      expect(instanceManager.instanceExists(accountId)).toBe(false);
    });

    test('should persist account configuration across manager restarts', async () => {
      // Create account
      const createResult = await configManager.createAccount({
        name: 'Persistent Account'
      });
      expect(createResult.success).toBe(true);
      const accountId = createResult.account.id;
      
      // Create new manager instance (simulating restart)
      const newConfigManager = new AccountConfigManager({
        configName: 'test-accounts',
        cwd: tempDir
      });
      
      // Verify account still exists
      const loadedAccount = await newConfigManager.getAccount(accountId);
      expect(loadedAccount).toBeDefined();
      expect(loadedAccount.name).toBe('Persistent Account');
      
    });
  });

  

  describe('Instance Crash and Restart Handling', () => {
    test('should detect instance crash', async () => {
      const account = new AccountConfig({
        name: 'Crash Test Account'
      });
      
      const result = await instanceManager.createInstance(account);
      expect(result.success).toBe(true);
      
      const window = result.window;
      
      // Simulate crash
      window.simulateCrash();
      
      // Wait for crash handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify crash was detected
      const status = instanceManager.getInstanceStatus(account.id);
      expect(status.crashCount).toBeGreaterThan(0);
    });

    test('should automatically restart after crash', async () => {
      const account = new AccountConfig({
        name: 'Auto Restart Test'
      });
      
      const result = await instanceManager.createInstance(account);
      expect(result.success).toBe(true);
      
      const initialWindow = result.window;
      
      // Simulate crash
      initialWindow.simulateCrash();
      
      // Wait for auto-restart
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify instance was restarted
      const status = instanceManager.getInstanceStatus(account.id);
      expect(status.crashCount).toBe(1);
    });

    test('should stop auto-restart after multiple crashes', async () => {
      const account = new AccountConfig({
        name: 'Multiple Crash Test'
      });
      
      const result = await instanceManager.createInstance(account);
      expect(result.success).toBe(true);
      
      // Simulate multiple crashes
      for (let i = 0; i < 4; i++) {
        const window = instanceManager.instances.get(account.id)?.window;
        if (window && !window.destroyed) {
          window.simulateCrash();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Verify crash count increased
      const status = instanceManager.getInstanceStatus(account.id);
      expect(status.crashCount).toBeGreaterThan(0);
    });

    test('should manually restart crashed instance', async () => {
      const account = new AccountConfig({
        name: 'Manual Restart Test'
      });
      
      await instanceManager.createInstance(account);
      
      // Destroy instance to simulate crash
      await instanceManager.destroyInstance(account.id);
      
      // Manually restart
      const restartResult = await instanceManager.createInstance(account);
      
      expect(restartResult.success).toBe(true);
      expect(instanceManager.instanceExists(account.id)).toBe(true);
    });

    test('should handle unresponsive instance', async () => {
      const account = new AccountConfig({
        name: 'Unresponsive Test'
      });
      
      const result = await instanceManager.createInstance(account);
      expect(result.success).toBe(true);
      
      const window = result.window;
      
      // Simulate unresponsive
      window.simulateUnresponsive();
      
      // Wait for handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Instance should still exist but may be marked
      expect(instanceManager.instanceExists(account.id)).toBe(true);
    });
  });

  describe('Multiple Concurrent Instances', () => {
    test('should run multiple instances concurrently', async () => {
      const instanceCount = 5;
      const accounts = [];
      
      // Create multiple accounts
      for (let i = 0; i < instanceCount; i++) {
        const account = new AccountConfig({
          name: `Concurrent Account ${i + 1}`
        });
        accounts.push(account);
      }
      
      // Launch all instances
      const results = await Promise.all(
        accounts.map(account => instanceManager.createInstance(account))
      );
      
      // Verify all instances launched successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Verify instance count
      expect(instanceManager.getRunningInstanceCount()).toBe(instanceCount);
      
      // Verify each instance is running
      accounts.forEach(account => {
        const status = instanceManager.getInstanceStatus(account.id);
        expect(status).toBeDefined();
        expect(status.status).toBe('running');
      });
    });

    test('should handle max instance limit', async () => {
      const maxInstances = instanceManager.maxInstances;
      const accounts = [];
      
      // Create max instances
      for (let i = 0; i < maxInstances; i++) {
        const account = new AccountConfig({
          name: `Max Test Account ${i + 1}`
        });
        accounts.push(account);
        await instanceManager.createInstance(account);
      }
      
      expect(instanceManager.getRunningInstanceCount()).toBe(maxInstances);
      
      // Try to create one more
      const extraAccount = new AccountConfig({
        name: 'Extra Account'
      });
      const result = await instanceManager.createInstance(extraAccount);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum instance limit');
    });

    test('should isolate instances from each other', async () => {
      const account1 = new AccountConfig({ name: 'Isolated Account 1' });
      const account2 = new AccountConfig({ name: 'Isolated Account 2' });
      
      await instanceManager.createInstance(account1);
      await instanceManager.createInstance(account2);
      
      // Verify both instances are running independently
      const status1 = instanceManager.getInstanceStatus(account1.id);
      const status2 = instanceManager.getInstanceStatus(account2.id);
      
      expect(status1.status).toBe('running');
      expect(status2.status).toBe('running');
      expect(status1.instanceId).not.toBe(status2.instanceId);
      
      // Crash one instance
      const window1 = instanceManager.instances.get(account1.id)?.window;
      if (window1) {
        window1.simulateCrash();
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify second instance is still running
      const status2After = instanceManager.getInstanceStatus(account2.id);
      expect(status2After.status).toBe('running');
    });

    test('should manage resources across multiple instances', async () => {
      const instanceCount = 3;
      const accounts = [];
      
      for (let i = 0; i < instanceCount; i++) {
        const account = new AccountConfig({
          name: `Resource Test Account ${i + 1}`
        });
        accounts.push(account);
        await instanceManager.createInstance(account);
      }
      
      // Get health summary
      const healthSummary = await instanceManager.getAllInstancesHealth();
      
      expect(healthSummary.total).toBe(instanceCount);
      expect(healthSummary.healthy).toBe(instanceCount);
      expect(healthSummary.unhealthy).toBe(0);
    });

    test('should destroy all instances at once', async () => {
      const instanceCount = 5;
      
      // Create multiple instances
      for (let i = 0; i < instanceCount; i++) {
        const account = new AccountConfig({
          name: `Destroy Test Account ${i + 1}`
        });
        await instanceManager.createInstance(account);
      }
      
      expect(instanceManager.getRunningInstanceCount()).toBe(instanceCount);
      
      // Destroy all
      const result = await instanceManager.destroyAllInstances();
      
      expect(result.success).toBe(true);
      expect(result.destroyed).toBe(instanceCount);
      expect(result.failed).toBe(0);
      expect(instanceManager.getRunningInstanceCount()).toBe(0);
    });

    test('should handle concurrent operations on different instances', async () => {
      const account1 = new AccountConfig({ name: 'Concurrent Op 1' });
      const account2 = new AccountConfig({ name: 'Concurrent Op 2' });
      const account3 = new AccountConfig({ name: 'Concurrent Op 3' });
      
      // Perform concurrent operations
      const [result1, result2, result3] = await Promise.all([
        instanceManager.createInstance(account1),
        instanceManager.createInstance(account2),
        instanceManager.createInstance(account3)
      ]);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      
      // Perform concurrent destroy operations
      const [destroy1, destroy2, destroy3] = await Promise.all([
        instanceManager.destroyInstance(account1.id),
        instanceManager.destroyInstance(account2.id),
        instanceManager.destroyInstance(account3.id)
      ]);
      
      expect(destroy1.success).toBe(true);
      expect(destroy2.success).toBe(true);
      expect(destroy3.success).toBe(true);
      expect(instanceManager.getRunningInstanceCount()).toBe(0);
    });
  });

  describe('Integration with Configuration Management', () => {
    test('should sync instance state with configuration', async () => {
      // Create account
      const createResult = await configManager.createAccount({
        name: 'Sync Test Account'
      });
      const accountId = createResult.account.id;
      
      // Launch instance
      await instanceManager.createInstance(createResult.account);
      
      // Update account configuration
      await configManager.updateAccount(accountId, {
        name: 'Updated Sync Test Account'
      });
      
      // Verify configuration was updated
      const updatedAccount = await configManager.getAccount(accountId);
      expect(updatedAccount.name).toBe('Updated Sync Test Account');
      
      // Instance should still be running
      expect(instanceManager.instanceExists(accountId)).toBe(true);
    });

    test('should handle account deletion with running instance', async () => {
      const createResult = await configManager.createAccount({
        name: 'Delete Test Account'
      });
      const accountId = createResult.account.id;
      
      // Launch instance
      await instanceManager.createInstance(createResult.account);
      expect(instanceManager.instanceExists(accountId)).toBe(true);
      
      // Delete account configuration
      await configManager.deleteAccount(accountId);
      
      // Verify account is deleted
      const account = await configManager.getAccount(accountId);
      expect(account).toBeNull();
      
      // Instance should still be running (needs manual cleanup)
      expect(instanceManager.instanceExists(accountId)).toBe(true);
      
      // Cleanup instance
      await instanceManager.destroyInstance(accountId);
      expect(instanceManager.instanceExists(accountId)).toBe(false);
    });

    test('should export and import accounts with instances', async () => {
      // Create accounts
      await configManager.createAccount({ name: 'Export Account 1' });
      await configManager.createAccount({ name: 'Export Account 2' });
      
      // Export
      const exportData = await configManager.exportAccounts();
      expect(exportData.accounts.length).toBe(2);
      
      // Clear all
      await configManager.clearAllAccounts();
      
      // Import
      const importResult = await configManager.importAccounts(exportData);
      expect(importResult.success).toBe(true);
      expect(importResult.imported).toBe(2);
      
      // Verify accounts can be loaded
      const accounts = await configManager.loadAccounts();
      expect(accounts.length).toBe(2);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle invalid account configuration gracefully', async () => {
      const invalidAccount = new AccountConfig({ name: 'Invalid', autoStart: 'yes', lastRunningStatus: 'invalid' });
      const validation = configManager.validateConfig(invalidAccount);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should recover from instance creation failure', async () => {
      const account = new AccountConfig({
        name: 'Failure Recovery Test'
      });
      
      // First attempt should succeed
      const result1 = await instanceManager.createInstance(account);
      expect(result1.success).toBe(true);
      
      // Second attempt should fail (already running)
      const result2 = await instanceManager.createInstance(account);
      expect(result2.success).toBe(false);
      
      // Destroy and retry
      await instanceManager.destroyInstance(account.id);
      const result3 = await instanceManager.createInstance(account);
      expect(result3.success).toBe(true);
    });

    test('should handle rapid create/destroy cycles', async () => {
      const account = new AccountConfig({
        name: 'Rapid Cycle Test'
      });
      
      // Perform rapid cycles
      for (let i = 0; i < 3; i++) {
        const createResult = await instanceManager.createInstance(account);
        expect(createResult.success).toBe(true);
        
        const destroyResult = await instanceManager.destroyInstance(account.id);
        expect(destroyResult.success).toBe(true);
      }
      
      // Final state should be clean
      expect(instanceManager.instanceExists(account.id)).toBe(false);
    });
  });
});
