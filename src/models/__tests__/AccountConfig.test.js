/**
 * AccountConfig 模型测试
 * 专注于翻译配置验证逻辑
 */

const AccountConfig = require('../AccountConfig');

describe('AccountConfig', () => {
  describe('initialization', () => {
    test('should create account with default values', () => {
      const account = new AccountConfig();
      
      expect(account.id).toBeDefined();
      expect(account.name).toBeDefined();
      expect(account.note).toBe('');
      expect(account.order).toBe(0);
      expect(account.createdAt).toBeInstanceOf(Date);
      expect(account.lastActiveAt).toBeInstanceOf(Date);
      expect(account.autoStart).toBe(false);
      expect(account.sessionDir).toBeDefined();
      expect(account.translation).toBeDefined();
      expect(account.notifications).toBeDefined();
      expect(account.window).toBeUndefined();
    });

    test('should create account with custom values', () => {
      const config = {
        name: 'Custom Account',
        note: 'Test note',
        order: 5,
        autoStart: true,
      };
      
      const account = new AccountConfig(config);
      
      expect(account.name).toBe('Custom Account');
      expect(account.note).toBe('Test note');
      expect(account.order).toBe(5);
      expect(account.autoStart).toBe(true);
    });

    test('should handle backward compatibility with window config', () => {
      const config = {
        name: 'Old Account',
        window: {
          x: 100,
          y: 100,
          width: 800,
          height: 600
        }
      };
      
      const account = new AccountConfig(config);
      
      expect(account.name).toBe('Old Account');
      expect(account.window).toBeUndefined();
    });
  });

  

  describe('translation configuration validation', () => {
    test('should validate valid translation configuration', () => {
      const account = new AccountConfig({
        name: 'Valid Translation',
        translation: {
          enabled: true,
          targetLanguage: 'zh-CN',
          engine: 'google',
          autoTranslate: true
        }
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('should reject invalid translation engine', () => {
      const account = new AccountConfig({
        name: 'Invalid Engine',
        translation: {
          enabled: true,
          targetLanguage: 'zh-CN',
          engine: 'invalid',
          autoTranslate: true
        }
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid translation engine. Must be google, gpt4, gemini, or deepseek');
    });

    test('should reject missing target language', () => {
      const account = new AccountConfig({
        name: 'Missing Language',
        translation: {
          enabled: true,
          targetLanguage: '',
          engine: 'google',
          autoTranslate: true
        }
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Target language is required when translation is enabled');
    });

    test('should require API key for GPT-4', () => {
      const account = new AccountConfig({
        name: 'GPT-4 No Key',
        translation: {
          enabled: true,
          targetLanguage: 'zh-CN',
          engine: 'gpt4',
          apiKey: ''
        }
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('API key is required for gpt4 translation engine');
    });

    test('should require API key for Gemini', () => {
      const account = new AccountConfig({
        name: 'Gemini No Key',
        translation: {
          enabled: true,
          targetLanguage: 'zh-CN',
          engine: 'gemini',
          apiKey: ''
        }
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('API key is required for gemini translation engine');
    });

    test('should require API key for DeepSeek', () => {
      const account = new AccountConfig({
        name: 'DeepSeek No Key',
        translation: {
          enabled: true,
          targetLanguage: 'zh-CN',
          engine: 'deepseek',
          apiKey: ''
        }
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('API key is required for deepseek translation engine');
    });

    test('should not require API key for Google Translate', () => {
      const account = new AccountConfig({
        name: 'Google Translate',
        translation: {
          enabled: true,
          targetLanguage: 'zh-CN',
          engine: 'google',
          apiKey: ''
        }
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(true);
    });

    test('should accept all valid translation engines', () => {
      const engines = ['google', 'gpt4', 'gemini', 'deepseek'];
      
      engines.forEach(engine => {
        const account = new AccountConfig({
          name: `${engine} Translation`,
          translation: {
            enabled: true,
            targetLanguage: 'zh-CN',
            engine: engine,
            apiKey: engine !== 'google' ? 'test-api-key' : ''
          }
        });
        
        const validation = account.validate();
        expect(validation.valid).toBe(true);
      });
    });

    test('should not validate translation when disabled', () => {
      const account = new AccountConfig({
        name: 'Disabled Translation',
        translation: {
          enabled: false,
          targetLanguage: '',
          engine: 'invalid',
          apiKey: ''
        }
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(true);
    });
  });

  describe('order and sessionDir validation', () => {
    test('should validate valid order', () => {
      const account = new AccountConfig({
        name: 'Valid Order',
        order: 5
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(true);
    });

    test('should reject negative order', () => {
      const account = new AccountConfig({
        name: 'Negative Order',
        order: -1
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Order must be a non-negative number');
    });

    test('should validate valid sessionDir', () => {
      const account = new AccountConfig({
        name: 'Valid Session',
        sessionDir: 'session-data/account-123'
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(true);
    });

    test('should use default sessionDir when not provided', () => {
      const account = new AccountConfig({
        name: 'Default Session'
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(true);
      expect(account.sessionDir).toContain('session-data/account-');
    });
  });

  describe('combined validation', () => {
    test('should detect multiple validation errors', () => {
      const account = new AccountConfig({
        name: '',
        order: -1,
        sessionDir: '',
        translation: {
          enabled: true,
          targetLanguage: '',
          engine: 'invalid',
          apiKey: ''
        }
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(5);
    });

    test('should validate complex valid configuration', () => {
      const account = new AccountConfig({
        name: 'Complex Account',
        note: 'Business account',
        order: 1,
        autoStart: true,
        sessionDir: 'session-data/account-complex',
        translation: {
          enabled: true,
          targetLanguage: 'zh-CN',
          engine: 'gpt4',
          apiKey: 'sk-test-key',
          autoTranslate: true,
          translateInput: true
        },
        notifications: {
          enabled: true,
          sound: true,
          badge: true
        }
      });
      
      const validation = account.validate();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe('JSON serialization', () => {
    test('should serialize to JSON', () => {
      const account = new AccountConfig({
        name: 'Test Account',
        note: 'Test note',
        order: 3
      });
      
      const json = account.toJSON();
      
      expect(json.id).toBe(account.id);
      expect(json.name).toBe('Test Account');
      expect(json.note).toBe('Test note');
      expect(json.order).toBe(3);
      expect(json.createdAt).toBeDefined();
      expect(json.sessionDir).toBeDefined();
      expect(json.autoStart).toBeDefined();
      expect(json.translation).toBeDefined();
      expect(json.window).toBeUndefined();
    });

    test('should deserialize from JSON', () => {
      const originalAccount = new AccountConfig({
        name: 'Original Account',
        note: 'Original note',
        order: 2,
        autoStart: true,
      });
      
      const json = originalAccount.toJSON();
      const restoredAccount = AccountConfig.fromJSON(json);
      
      expect(restoredAccount.id).toBe(originalAccount.id);
      expect(restoredAccount.name).toBe(originalAccount.name);
      expect(restoredAccount.note).toBe(originalAccount.note);
      expect(restoredAccount.order).toBe(2);
      expect(restoredAccount.autoStart).toBe(true);
      
    });
  });

  describe('utility methods', () => {
    test('should update last active time', () => {
      const account = new AccountConfig({ name: 'Test' });
      const originalTime = account.lastActiveAt;
      
      // Wait a bit
      setTimeout(() => {
        account.updateLastActive();
        expect(account.lastActiveAt.getTime()).toBeGreaterThan(originalTime.getTime());
      }, 10);
    });
  });
});
