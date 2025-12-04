/**
 * TranslationIntegration 单元测试
 * 测试翻译配置管理和脚本注入
 */

// Create mock readFile function - must be defined before jest.mock
let mockReadFile = jest.fn();

// Mock fs 模块 - Jest hoists this to the top
jest.mock('fs', () => {
  return {
    promises: {
      readFile: jest.fn().mockImplementation((...args) => mockReadFile(...args))
    }
  };
});

// Get the mocked fs module
const fs = require('fs');

const TranslationIntegration = require('../TranslationIntegration');
const path = require('path');

describe('TranslationIntegration', () => {
  let translationIntegration;
  let mockWebContents;
  let mockView;

  beforeEach(() => {
    // Reset mock
    mockReadFile.mockReset();
    fs.promises.readFile.mockReset();
    fs.promises.readFile.mockImplementation((...args) => mockReadFile(...args));
    
    // 创建 mock webContents
    mockWebContents = {
      executeJavaScript: jest.fn().mockResolvedValue(undefined),
      isDestroyed: jest.fn().mockReturnValue(false),
      on: jest.fn(),
      getURL: jest.fn().mockReturnValue('https://web.whatsapp.com')
    };

    // 创建 mock view
    mockView = {
      webContents: mockWebContents
    };

    // Mock 脚本文件读取 - match the actual module loading pattern
    mockReadFile.mockImplementation((filePath) => {
      // Match the new modular script loading pattern
      if (filePath.includes('ContentScriptCore.js')) {
        return Promise.resolve('// ContentScriptCore module');
      }
      if (filePath.includes('TranslationUI.js')) {
        return Promise.resolve('// TranslationUI module');
      }
      if (filePath.includes('MessageTranslator.js')) {
        return Promise.resolve('// MessageTranslator module');
      }
      if (filePath.includes('InputBoxTranslator.js')) {
        return Promise.resolve('// InputBoxTranslator module');
      }
      if (filePath.includes('DOMObserver.js')) {
        return Promise.resolve('// DOMObserver module');
      }
      if (filePath.includes('index.js')) {
        return Promise.resolve('// index module');
      }
      // Legacy paths for backward compatibility
      if (filePath.includes('contentScriptWithOptimizer.js')) {
        return Promise.resolve('// Optimizer script');
      }
      if (filePath.includes('contentScript.js')) {
        return Promise.resolve('// Content script');
      }
      return Promise.reject(new Error('File not found'));
    });

    translationIntegration = new TranslationIntegration();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('初始化', () => {
    test('应该成功初始化并加载脚本', async () => {
      await translationIntegration.initialize();

      // The new implementation loads multiple modules into contentScript
      expect(translationIntegration.scriptCache.contentScript).toContain('ContentScriptCore');
      expect(translationIntegration.scriptCache.contentScript).toContain('TranslationUI');
    });

    test('应该处理脚本加载失败', async () => {
      mockReadFile.mockRejectedValue(new Error('读取失败'));

      await expect(translationIntegration.initialize()).rejects.toThrow();
    });
  });

  describe('脚本注入', () => {
    beforeEach(async () => {
      await translationIntegration.initialize();
    });

    test('应该成功注入翻译脚本', async () => {
      const result = await translationIntegration.injectScripts('test-account', mockView);

      expect(result.success).toBe(true);
      expect(mockWebContents.on).toHaveBeenCalledWith('did-finish-load', expect.any(Function));
    });

    test('应该在页面已加载时立即注入', async () => {
      const result = await translationIntegration.injectScripts('test-account', mockView);

      expect(result.success).toBe(true);
      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
    });

    test('应该注入 ACCOUNT_ID', async () => {
      await translationIntegration.injectScripts('test-account', mockView);

      const calls = mockWebContents.executeJavaScript.mock.calls;
      const accountIdCall = calls.find(call => 
        call[0].includes('window.ACCOUNT_ID')
      );

      expect(accountIdCall).toBeDefined();
      expect(accountIdCall[0]).toContain('test-account');
    });

    test('应该处理无效的 webContents', async () => {
      mockWebContents.isDestroyed.mockReturnValue(true);

      const result = await translationIntegration.injectScripts('test-account', mockView);

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid or destroyed');
    });

    test('应该存储翻译配置', async () => {
      const config = {
        enabled: true,
        targetLanguage: 'zh-CN',
        engine: 'google'
      };

      await translationIntegration.injectScripts('test-account', mockView, config);

      const stored = translationIntegration.getTranslationConfig('test-account');
      expect(stored).toEqual(config);
    });
  });

  describe('翻译配置管理', () => {
    beforeEach(async () => {
      await translationIntegration.initialize();
    });

    test('应该成功配置翻译', async () => {
      const config = {
        enabled: true,
        targetLanguage: 'zh-CN',
        engine: 'google',
        autoTranslate: true
      };

      const result = await translationIntegration.configureTranslation(
        'test-account',
        config,
        mockView
      );

      expect(result.success).toBe(true);
      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
    });

    test('应该存储翻译配置', async () => {
      const config = {
        enabled: true,
        targetLanguage: 'en',
        engine: 'deepl'
      };

      await translationIntegration.configureTranslation('test-account', config, mockView);

      const stored = translationIntegration.getTranslationConfig('test-account');
      expect(stored).toEqual(config);
    });

    test('应该更新翻译配置', async () => {
      const initialConfig = {
        enabled: true,
        targetLanguage: 'zh-CN',
        engine: 'google'
      };

      await translationIntegration.configureTranslation('test-account', initialConfig, mockView);

      const updates = {
        targetLanguage: 'en',
        engine: 'deepl'
      };

      const result = await translationIntegration.updateTranslationConfig(
        'test-account',
        updates,
        mockView
      );

      expect(result.success).toBe(true);

      const updated = translationIntegration.getTranslationConfig('test-account');
      expect(updated.targetLanguage).toBe('en');
      expect(updated.engine).toBe('deepl');
      expect(updated.enabled).toBe(true); // 保留原有配置
    });

    test('应该处理不存在的配置更新', async () => {
      const result = await translationIntegration.updateTranslationConfig(
        'non-existent',
        { enabled: false },
        mockView
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('翻译状态管理', () => {
    test('应该获取翻译状态', () => {
      translationIntegration.translationStatuses.set('test-account', {
        injected: true,
        lastInjectionTime: new Date(),
        error: null
      });

      const status = translationIntegration.getTranslationStatus('test-account');

      expect(status).toBeDefined();
      expect(status.injected).toBe(true);
    });

    test('应该检查是否已注入', () => {
      translationIntegration.translationStatuses.set('test-account', {
        injected: true
      });

      expect(translationIntegration.isInjected('test-account')).toBe(true);
      expect(translationIntegration.isInjected('non-existent')).toBe(false);
    });

    test('应该获取所有翻译配置', () => {
      translationIntegration.translationConfigs.set('account-1', { enabled: true });
      translationIntegration.translationConfigs.set('account-2', { enabled: false });

      const allConfigs = translationIntegration.getAllTranslationConfigs();

      expect(allConfigs.size).toBe(2);
      expect(allConfigs.get('account-1').enabled).toBe(true);
    });

    test('应该获取所有翻译状态', () => {
      translationIntegration.translationStatuses.set('account-1', { injected: true });
      translationIntegration.translationStatuses.set('account-2', { injected: false });

      const allStatuses = translationIntegration.getAllTranslationStatuses();

      expect(allStatuses.size).toBe(2);
    });
  });

  describe('缓存管理', () => {
    beforeEach(async () => {
      await translationIntegration.initialize();
    });

    test('应该清除翻译缓存', async () => {
      const result = await translationIntegration.clearCache('test-account', mockView);

      expect(result.success).toBe(true);
      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
    });

    test('应该处理无效的 webContents', async () => {
      mockWebContents.isDestroyed.mockReturnValue(true);

      const result = await translationIntegration.clearCache('test-account', mockView);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('账号管理', () => {
    test('应该移除账号数据', () => {
      translationIntegration.translationConfigs.set('test-account', { enabled: true });
      translationIntegration.translationStatuses.set('test-account', { injected: true });

      translationIntegration.removeAccount('test-account');

      expect(translationIntegration.getTranslationConfig('test-account')).toBeNull();
      expect(translationIntegration.getTranslationStatus('test-account')).toBeNull();
    });

    test('应该支持 removeInstance 别名', () => {
      translationIntegration.translationConfigs.set('test-instance', { enabled: true });

      translationIntegration.removeInstance('test-instance');

      expect(translationIntegration.getTranslationConfig('test-instance')).toBeNull();
    });
  });

  describe('批量操作', () => {
    beforeEach(async () => {
      await translationIntegration.initialize();
    });

    test('应该为所有账号应用配置', async () => {
      const views = new Map([
        ['account-1', { view: mockView }],
        ['account-2', { view: mockView }]
      ]);

      const config = {
        enabled: true,
        targetLanguage: 'zh-CN'
      };

      const result = await translationIntegration.applyConfigToAllAccounts(config, views);

      expect(result.success).toBe(true);
      expect(result.applied).toBe(2);
      expect(result.failed).toBe(0);
    });

    test('应该处理部分失败', async () => {
      const mockView2 = {
        webContents: {
          ...mockWebContents,
          isDestroyed: jest.fn().mockReturnValue(true)
        }
      };

      const views = new Map([
        ['account-1', { view: mockView }],
        ['account-2', { view: mockView2 }]
      ]);

      const config = { enabled: true };

      const result = await translationIntegration.applyConfigToAllAccounts(config, views);

      expect(result.applied).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('性能统计', () => {
    beforeEach(async () => {
      await translationIntegration.initialize();
    });

    test('应该获取性能统计', async () => {
      const mockStats = {
        translationCount: 100,
        cacheHitRate: 0.85,
        averageLatency: 150
      };

      mockWebContents.executeJavaScript.mockResolvedValue(mockStats);

      const result = await translationIntegration.getPerformanceStats('test-account', mockView);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStats);
    });

    test('应该处理不可用的性能统计', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(null);

      const result = await translationIntegration.getPerformanceStats('test-account', mockView);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });
  });

  describe('脚本重新加载', () => {
    test('应该重新加载脚本', async () => {
      await translationIntegration.initialize();

      // 清除之前的 mock 并设置新的返回值
      mockReadFile.mockReset();
      mockReadFile.mockImplementation((filePath) => {
        if (filePath.includes('ContentScriptCore.js')) {
          return Promise.resolve('// UPDATED_MARKER ContentScriptCore');
        }
        if (filePath.includes('TranslationUI.js')) {
          return Promise.resolve('// UPDATED_MARKER TranslationUI');
        }
        if (filePath.includes('MessageTranslator.js')) {
          return Promise.resolve('// UPDATED_MARKER MessageTranslator');
        }
        if (filePath.includes('InputBoxTranslator.js')) {
          return Promise.resolve('// UPDATED_MARKER InputBoxTranslator');
        }
        if (filePath.includes('DOMObserver.js')) {
          return Promise.resolve('// UPDATED_MARKER DOMObserver');
        }
        if (filePath.includes('index.js')) {
          return Promise.resolve('// UPDATED_MARKER index');
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await translationIntegration.reloadScripts();

      expect(result.success).toBe(true);
      // 检查脚本缓存是否包含更新后的标记
      expect(translationIntegration.scriptCache.contentScript).toContain('UPDATED_MARKER');
    });

    test('应该处理重新加载失败', async () => {
      // 创建新实例以避免缓存问题
      const freshIntegration = new TranslationIntegration();
      
      // 先初始化
      await freshIntegration.initialize();
      
      // 然后设置 mock 为失败
      mockReadFile.mockReset();
      mockReadFile.mockImplementation(() => {
        return Promise.reject(new Error('读取失败'));
      });

      const result = await freshIntegration.reloadScripts();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('清理', () => {
    test('应该清理所有资源', async () => {
      await translationIntegration.initialize();

      translationIntegration.translationConfigs.set('account-1', { enabled: true });
      translationIntegration.translationStatuses.set('account-1', { injected: true });

      translationIntegration.cleanup();

      expect(translationIntegration.translationConfigs.size).toBe(0);
      expect(translationIntegration.translationStatuses.size).toBe(0);
      expect(translationIntegration.scriptCache.optimizer).toBeNull();
      expect(translationIntegration.scriptCache.contentScript).toBeNull();
    });
  });
});
