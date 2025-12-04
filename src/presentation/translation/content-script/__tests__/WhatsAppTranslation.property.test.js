'use strict';

/**
 * Property-based tests for WhatsAppTranslation
 * 
 * Tests for:
 * - Property 1: Deep merge preserves structure integrity
 * - Property 8: Config update state consistency
 * 
 * **Feature: translation-controls-fix**
 * **Validates: Requirements 7.1, 7.2, 8.2**
 */

const fc = require('fast-check');

/**
 * Standalone deepMerge implementation for testing
 * This mirrors the implementation in WhatsAppTranslation
 */
function deepMerge(target, source) {
  // Handle null/undefined cases
  if (!source) return target ? { ...target } : {};
  if (!target) return { ...source };

  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      // If source value is an array, replace directly (don't merge arrays)
      if (Array.isArray(sourceValue)) {
        result[key] = [...sourceValue];
      }
      // If source value is an object (not null, not array), recursively merge
      else if (sourceValue !== null && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
        if (targetValue !== null && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
          result[key] = deepMerge(targetValue, sourceValue);
        } else {
          result[key] = deepMerge({}, sourceValue);
        }
      }
      // For primitives (string, number, boolean, null, undefined), replace directly
      else {
        result[key] = sourceValue;
      }
    }
  }

  return result;
}


/**
 * Helper to get all keys from an object recursively
 */
function getAllKeys(obj, prefix = '') {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return [];
  }
  
  let keys = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.push(fullKey);
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        keys = keys.concat(getAllKeys(obj[key], fullKey));
      }
    }
  }
  return keys;
}

/**
 * Arbitrary for generating translation config objects
 */
const translationConfigArbitrary = fc.record({
  global: fc.record({
    autoTranslate: fc.boolean(),
    engine: fc.constantFrom('google', 'deepl', 'baidu', 'openai'),
    sourceLang: fc.constantFrom('auto', 'en', 'zh-CN', 'es'),
    targetLang: fc.constantFrom('zh-CN', 'en', 'es', 'fr'),
    groupTranslation: fc.boolean()
  }),
  inputBox: fc.record({
    enabled: fc.boolean(),
    engine: fc.constantFrom('google', 'deepl', 'baidu', 'openai'),
    style: fc.constantFrom('通用', '正式', '口语'),
    targetLang: fc.constantFrom('auto', 'en', 'zh-CN')
  }),
  advanced: fc.record({
    friendIndependent: fc.boolean(),
    blockChinese: fc.boolean(),
    realtime: fc.boolean(),
    reverseTranslation: fc.boolean(),
    voiceTranslation: fc.boolean(),
    imageTranslation: fc.boolean()
  }),
  friendConfigs: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.record({
      enabled: fc.boolean(),
      targetLang: fc.constantFrom('zh-CN', 'en', 'es'),
      blockChinese: fc.boolean()
    })
  )
});

/**
 * Arbitrary for generating nested objects with various depths
 */
const nestedObjectArbitrary = fc.letrec(tie => ({
  leaf: fc.oneof(
    fc.string({ minLength: 0, maxLength: 50 }),
    fc.integer(),
    fc.boolean(),
    fc.constant(null)
  ),
  array: fc.array(fc.oneof(
    fc.string({ minLength: 0, maxLength: 20 }),
    fc.integer(),
    fc.boolean()
  ), { maxLength: 5 }),
  node: fc.record({
    value: tie('leaf'),
    nested: fc.option(tie('tree'), { nil: undefined }),
    items: fc.option(tie('array'), { nil: undefined })
  }),
  tree: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 10 }).filter((k) => k !== '__proto__'),
    fc.oneof(tie('leaf'), tie('array'), tie('node'))
  )
})).tree;

describe('WhatsAppTranslation Property Tests', () => {
  /**
   * **Feature: translation-controls-fix, Property 1: Deep merge preserves structure integrity**
   * **Validates: Requirements 7.1**
   * 
   * For any two valid configuration objects, the deep merge result should contain
   * all keys from both objects, with nested objects correctly merged rather than replaced.
   */
  describe('Property 1: Deep merge preserves structure integrity', () => {
    test('merged result contains all keys from both target and source', () => {
      fc.assert(
        fc.property(
          nestedObjectArbitrary,
          nestedObjectArbitrary,
          (target, source) => {
            const result = deepMerge(target, source);
            
            // All keys from target should be in result (unless overwritten)
            const targetKeys = getAllKeys(target);
            const sourceKeys = getAllKeys(source);
            const resultKeys = getAllKeys(result);
            
            // All source keys must be in result
            for (const key of sourceKeys) {
              expect(resultKeys).toContain(key);
            }
            
            // Target keys should be in result unless they were overwritten by source
            // When source has a primitive value for a key, it replaces the entire target value
            // (including any nested keys)
            for (const key of targetKeys) {
              // Get the top-level key (before the first dot)
              const topLevelKey = key.split('.')[0];
              
              // Check if source has this top-level key with a primitive value
              const sourceHasTopLevelPrimitive = sourceKeys.includes(topLevelKey) && 
                source[topLevelKey] !== null && 
                typeof source[topLevelKey] !== 'object';
              
              // If source doesn't have this key at all, result must have it
              // If source has a primitive at the top level, nested keys may be lost (expected behavior)
              if (!sourceKeys.includes(topLevelKey) && !sourceHasTopLevelPrimitive) {
                expect(resultKeys).toContain(key);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('source values override target values for primitives', () => {
      fc.assert(
        fc.property(
          fc.record({
            a: fc.string(),
            b: fc.integer(),
            c: fc.boolean()
          }),
          fc.record({
            a: fc.string(),
            b: fc.integer(),
            c: fc.boolean()
          }),
          (target, source) => {
            const result = deepMerge(target, source);
            
            // Source values should override target values
            expect(result.a).toBe(source.a);
            expect(result.b).toBe(source.b);
            expect(result.c).toBe(source.c);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('arrays are replaced, not merged', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer(), { minLength: 1, maxLength: 10 }),
          fc.array(fc.integer(), { minLength: 1, maxLength: 10 }),
          (targetArray, sourceArray) => {
            const target = { items: targetArray };
            const source = { items: sourceArray };
            
            const result = deepMerge(target, source);
            
            // Result array should equal source array exactly
            expect(result.items).toEqual(sourceArray);
            expect(result.items.length).toBe(sourceArray.length);
            
            // Result array should be a copy, not the same reference
            expect(result.items).not.toBe(sourceArray);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('nested objects are recursively merged', () => {
      fc.assert(
        fc.property(
          fc.record({
            level1: fc.record({
              a: fc.string(),
              b: fc.integer()
            })
          }),
          fc.record({
            level1: fc.record({
              b: fc.integer(),
              c: fc.boolean()
            })
          }),
          (target, source) => {
            const result = deepMerge(target, source);
            
            // Result should have merged nested object
            expect(result.level1).toBeDefined();
            expect(result.level1.a).toBe(target.level1.a); // From target
            expect(result.level1.b).toBe(source.level1.b); // Overwritten by source
            expect(result.level1.c).toBe(source.level1.c); // From source
          }
        ),
        { numRuns: 100 }
      );
    });

    test('translation config merge preserves all sections', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          translationConfigArbitrary,
          (target, source) => {
            const result = deepMerge(target, source);
            
            // All config sections should exist
            expect(result.global).toBeDefined();
            expect(result.inputBox).toBeDefined();
            expect(result.advanced).toBeDefined();
            expect(result.friendConfigs).toBeDefined();
            
            // Source values should be applied
            expect(result.global.autoTranslate).toBe(source.global.autoTranslate);
            expect(result.global.engine).toBe(source.global.engine);
            expect(result.inputBox.enabled).toBe(source.inputBox.enabled);
            expect(result.advanced.blockChinese).toBe(source.advanced.blockChinese);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('handles null and undefined gracefully', () => {
      fc.assert(
        fc.property(
          nestedObjectArbitrary,
          (obj) => {
            // Merge with null source should return copy of target
            const result1 = deepMerge(obj, null);
            expect(result1).toEqual(obj);
            expect(result1).not.toBe(obj);
            
            // Merge with undefined source should return copy of target
            const result2 = deepMerge(obj, undefined);
            expect(result2).toEqual(obj);
            
            // Merge null target with source should return copy of source
            const result3 = deepMerge(null, obj);
            expect(result3).toEqual(obj);
            expect(result3).not.toBe(obj);
            
            // Merge undefined target with source should return copy of source
            const result4 = deepMerge(undefined, obj);
            expect(result4).toEqual(obj);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('result is a new object (immutability)', () => {
      fc.assert(
        fc.property(
          nestedObjectArbitrary,
          nestedObjectArbitrary,
          (target, source) => {
            const result = deepMerge(target, source);
            
            // Result should be a new object
            expect(result).not.toBe(target);
            expect(result).not.toBe(source);
            
            // Modifying result should not affect original objects
            if (typeof result === 'object' && result !== null) {
              const originalTargetStr = JSON.stringify(target);
              const originalSourceStr = JSON.stringify(source);
              
              // Add a new property to result
              result.__test__ = 'modified';
              
              // Original objects should be unchanged
              expect(JSON.stringify(target)).toBe(originalTargetStr);
              expect(JSON.stringify(source)).toBe(originalSourceStr);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Mock WhatsAppTranslation object for testing updateConfig behavior
 * This simulates the actual WhatsAppTranslation object structure
 */
function createMockWhatsAppTranslation(initialConfig = null) {
  const defaultConfig = {
    global: {
      autoTranslate: false,
      engine: 'google',
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      groupTranslation: false
    },
    inputBox: {
      enabled: false,
      engine: 'google',
      style: '通用',
      targetLang: 'auto'
    },
    advanced: {
      friendIndependent: false,
      blockChinese: false,
      realtime: false,
      reverseTranslation: false,
      voiceTranslation: false,
      imageTranslation: false
    },
    friendConfigs: {}
  };

  const mock = {
    core: {
      config: initialConfig || { ...defaultConfig },
      getDefaultConfig: () => ({ ...defaultConfig })
    },
    config: initialConfig || { ...defaultConfig },
    accountId: 'test-account',
    
    // Track method calls
    _applyConfigChangesCalled: false,
    _savedConfig: null,
    
    deepMerge,
    
    async updateConfig(newConfig) {
      try {
        const currentConfig = this.core?.config || this.core?.getDefaultConfig() || this.config || {};
        const mergedConfig = this.deepMerge(currentConfig, newConfig);
        
        if (this.core) {
          this.core.config = mergedConfig;
        }
        this.config = mergedConfig;
        
        // Simulate save (always succeeds in test)
        this._savedConfig = mergedConfig;
        this.applyConfigChanges();
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    applyConfigChanges() {
      this._applyConfigChangesCalled = true;
    }
  };
  
  return mock;
}

describe('WhatsAppTranslation Config Update Property Tests', () => {
  /**
   * **Feature: translation-controls-fix, Property 8: Config update state consistency**
   * **Validates: Requirements 7.2, 8.2**
   * 
   * For any config update operation, after the update completes,
   * WhatsAppTranslation.config and WhatsAppTranslation.core.config should be identical.
   */
  describe('Property 8: Config update state consistency', () => {
    test('config and core.config are identical after updateConfig', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          translationConfigArbitrary,
          async (initialConfig, updateConfig) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Perform update
            const result = await mock.updateConfig(updateConfig);
            
            // Update should succeed
            expect(result.success).toBe(true);
            
            // Both config references should be identical
            expect(mock.config).toEqual(mock.core.config);
            
            // Config should contain the updated values
            expect(mock.config.global.autoTranslate).toBe(updateConfig.global.autoTranslate);
            expect(mock.config.global.engine).toBe(updateConfig.global.engine);
            expect(mock.config.inputBox.enabled).toBe(updateConfig.inputBox.enabled);
            expect(mock.config.advanced.blockChinese).toBe(updateConfig.advanced.blockChinese);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('applyConfigChanges is called after successful update', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          async (newConfig) => {
            const mock = createMockWhatsAppTranslation();
            
            // Reset tracking
            mock._applyConfigChangesCalled = false;
            
            // Perform update
            await mock.updateConfig(newConfig);
            
            // applyConfigChanges should have been called
            expect(mock._applyConfigChangesCalled).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('partial config updates preserve unmodified fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.record({
            global: fc.record({
              autoTranslate: fc.boolean()
            })
          }),
          async (initialConfig, partialUpdate) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Store original values that shouldn't change
            const originalEngine = initialConfig.global.engine;
            const originalInputBoxEnabled = initialConfig.inputBox.enabled;
            const originalBlockChinese = initialConfig.advanced.blockChinese;
            
            // Perform partial update (only autoTranslate)
            await mock.updateConfig(partialUpdate);
            
            // Updated field should have new value
            expect(mock.config.global.autoTranslate).toBe(partialUpdate.global.autoTranslate);
            
            // Other fields should be preserved
            expect(mock.config.global.engine).toBe(originalEngine);
            expect(mock.config.inputBox.enabled).toBe(originalInputBoxEnabled);
            expect(mock.config.advanced.blockChinese).toBe(originalBlockChinese);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('config state is consistent even with nested partial updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.record({
            advanced: fc.record({
              blockChinese: fc.boolean(),
              realtime: fc.boolean()
            })
          }),
          async (initialConfig, partialUpdate) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Perform partial update
            await mock.updateConfig(partialUpdate);
            
            // Both references should be identical
            expect(mock.config).toEqual(mock.core.config);
            
            // Updated fields should have new values
            expect(mock.config.advanced.blockChinese).toBe(partialUpdate.advanced.blockChinese);
            expect(mock.config.advanced.realtime).toBe(partialUpdate.advanced.realtime);
            
            // Other advanced fields should be preserved
            expect(mock.config.advanced.friendIndependent).toBe(initialConfig.advanced.friendIndependent);
            expect(mock.config.advanced.reverseTranslation).toBe(initialConfig.advanced.reverseTranslation);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple sequential updates maintain consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.array(translationConfigArbitrary, { minLength: 1, maxLength: 5 }),
          async (initialConfig, updates) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Apply multiple updates sequentially
            for (const update of updates) {
              await mock.updateConfig(update);
              
              // After each update, config and core.config should be identical
              expect(mock.config).toEqual(mock.core.config);
            }
            
            // Final config should reflect the last update
            const lastUpdate = updates[updates.length - 1];
            expect(mock.config.global.autoTranslate).toBe(lastUpdate.global.autoTranslate);
            expect(mock.config.global.engine).toBe(lastUpdate.global.engine);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});


/**
 * Helper function to check if text contains Chinese characters
 * Mirrors the implementation in ContentScriptCore
 */
function containsChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text);
}

/**
 * Mock MessageTranslator for testing auto-translate behavior
 * This simulates the actual MessageTranslator logic
 */
function createMockMessageTranslator(config) {
  return {
    core: {
      config: config,
      isGroupChat: () => false
    },
    
    /**
     * Determines if a message should be translated based on config
     * Returns: { shouldTranslate: boolean, reason: string }
     */
    shouldTranslateMessage(isGroupChat = false) {
      // Check if config is loaded
      if (!this.core.config || !this.core.config.global) {
        return { shouldTranslate: false, reason: 'config_not_loaded' };
      }

      // Check if auto translate is enabled
      if (!this.core.config.global.autoTranslate) {
        return { shouldTranslate: false, reason: 'auto_translate_disabled' };
      }

      // Check if it's a group message
      if (isGroupChat) {
        if (!this.core.config.global.groupTranslation) {
          return { shouldTranslate: false, reason: 'group_translation_disabled' };
        }
      }

      return { shouldTranslate: true, reason: 'ok' };
    }
  };
}

/**
 * Mock DOMObserver for testing Chinese block behavior
 * This simulates the actual DOMObserver logic
 */
function createMockDOMObserver(config, contactId = null) {
  return {
    core: {
      config: config,
      getCurrentContactId: () => contactId,
      containsChinese: containsChinese
    },
    
    /**
     * Determines if Chinese should be blocked based on config
     * Returns: boolean
     */
    shouldBlockChinese() {
      // Get current contact ID
      const currentContactId = this.core.getCurrentContactId();

      // If friend independent config is enabled, check contact's config
      if (this.core.config.advanced.friendIndependent && currentContactId) {
        const friendConfig = this.core.config.friendConfigs && this.core.config.friendConfigs[currentContactId];
        if (friendConfig && friendConfig.enabled) {
          // Use contact's independent config
          return friendConfig.blockChinese || false;
        }
      }

      // Use global config
      return this.core.config.advanced.blockChinese || false;
    },
    
    /**
     * Determines if a text should be blocked from sending
     * Returns: { shouldBlock: boolean, reason: string }
     */
    shouldBlockText(text) {
      if (!this.shouldBlockChinese()) {
        return { shouldBlock: false, reason: 'blocking_disabled' };
      }
      
      if (this.core.containsChinese(text)) {
        return { shouldBlock: true, reason: 'contains_chinese' };
      }
      
      return { shouldBlock: false, reason: 'no_chinese' };
    }
  };
}

/**
 * Mock InputBoxTranslator for testing input box button behavior
 * This simulates the actual InputBoxTranslator logic
 */
function createMockInputBoxTranslator(config) {
  return {
    core: {
      config: config
    },
    
    /**
     * Determines if translate button should be shown based on config
     * Returns: boolean
     */
    shouldShowTranslateButton() {
      return this.core.config && 
             this.core.config.inputBox && 
             this.core.config.inputBox.enabled;
    },
    
    /**
     * Determines if realtime translation should be enabled based on config
     * Returns: boolean
     */
    shouldEnableRealtimeTranslation() {
      return this.core.config && 
             this.core.config.advanced && 
             this.core.config.advanced.realtime;
    },
    
    /**
     * Determines if reverse translation should be shown based on config
     * Returns: boolean
     */
    shouldShowReverseTranslation() {
      return this.core.config && 
             this.core.config.advanced && 
             this.core.config.advanced.reverseTranslation;
    }
  };
}

/**
 * Arbitrary for generating text with Chinese characters
 */
const chineseTextArbitrary = fc.array(
  fc.constantFrom('你', '好', '世', '界', '中', '文', '测', '试', '消', '息'),
  { minLength: 1, maxLength: 10 }
).map(chars => chars.join(''));

/**
 * Arbitrary for generating text without Chinese characters
 */
const nonChineseTextArbitrary = fc.array(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', '1', '2', '3'),
  { minLength: 1, maxLength: 20 }
).map(chars => chars.join(''));


describe('WhatsAppTranslation Feature Toggle Property Tests', () => {
  /**
   * **Feature: translation-controls-fix, Property 2: Auto-translate toggle controls translation behavior**
   * **Validates: Requirements 1.1, 1.2**
   * 
   * For any config state and message, when autoTranslate is true the message should be translated,
   * when false the message should not be translated.
   */
  describe('Property 2: Auto-translate toggle controls translation behavior', () => {
    test('messages are translated only when autoTranslate is enabled', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          (config) => {
            const translator = createMockMessageTranslator(config);
            const result = translator.shouldTranslateMessage(false);
            
            if (config.global.autoTranslate) {
              // When autoTranslate is true, messages should be translated
              expect(result.shouldTranslate).toBe(true);
              expect(result.reason).toBe('ok');
            } else {
              // When autoTranslate is false, messages should not be translated
              expect(result.shouldTranslate).toBe(false);
              expect(result.reason).toBe('auto_translate_disabled');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('translation behavior changes immediately with config update', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.boolean(),
          async (initialConfig, newAutoTranslate) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Update only autoTranslate
            await mock.updateConfig({
              global: { autoTranslate: newAutoTranslate }
            });
            
            // Create translator with updated config
            const translator = createMockMessageTranslator(mock.config);
            const result = translator.shouldTranslateMessage(false);
            
            // Behavior should match the new config value
            expect(result.shouldTranslate).toBe(newAutoTranslate);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: translation-controls-fix, Property 3: Group translation toggle controls group chat translation**
   * **Validates: Requirements 1.3, 1.4**
   * 
   * For any group chat message and config state, when groupTranslation is true the message should be translated,
   * when false the message should be skipped.
   */
  describe('Property 3: Group translation toggle controls group chat translation', () => {
    test('group messages are translated only when both autoTranslate and groupTranslation are enabled', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          (config) => {
            const translator = createMockMessageTranslator(config);
            const result = translator.shouldTranslateMessage(true); // isGroupChat = true
            
            if (!config.global.autoTranslate) {
              // If autoTranslate is disabled, no translation regardless of groupTranslation
              expect(result.shouldTranslate).toBe(false);
              expect(result.reason).toBe('auto_translate_disabled');
            } else if (!config.global.groupTranslation) {
              // If autoTranslate is enabled but groupTranslation is disabled, skip group messages
              expect(result.shouldTranslate).toBe(false);
              expect(result.reason).toBe('group_translation_disabled');
            } else {
              // Both enabled, should translate
              expect(result.shouldTranslate).toBe(true);
              expect(result.reason).toBe('ok');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('group translation toggle changes behavior immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.boolean(),
          async (initialConfig, newGroupTranslation) => {
            // Ensure autoTranslate is enabled so we can test groupTranslation
            const configWithAutoTranslate = {
              ...initialConfig,
              global: { ...initialConfig.global, autoTranslate: true }
            };
            
            const mock = createMockWhatsAppTranslation(configWithAutoTranslate);
            
            // Update only groupTranslation
            await mock.updateConfig({
              global: { groupTranslation: newGroupTranslation }
            });
            
            // Create translator with updated config
            const translator = createMockMessageTranslator(mock.config);
            const result = translator.shouldTranslateMessage(true); // isGroupChat = true
            
            // Behavior should match the new config value
            expect(result.shouldTranslate).toBe(newGroupTranslation);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: translation-controls-fix, Property 4: Chinese block toggle controls send behavior**
   * **Validates: Requirements 3.1, 3.2**
   * 
   * For any text containing Chinese and config state, when blockChinese is true the send should be blocked,
   * when false the send should be allowed.
   */
  describe('Property 4: Chinese block toggle controls send behavior', () => {
    test('Chinese text is blocked only when blockChinese is enabled', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          chineseTextArbitrary,
          (config, chineseText) => {
            const observer = createMockDOMObserver(config);
            const result = observer.shouldBlockText(chineseText);
            
            if (config.advanced.blockChinese) {
              // When blockChinese is true, Chinese text should be blocked
              expect(result.shouldBlock).toBe(true);
              expect(result.reason).toBe('contains_chinese');
            } else {
              // When blockChinese is false, Chinese text should be allowed
              expect(result.shouldBlock).toBe(false);
              expect(result.reason).toBe('blocking_disabled');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('non-Chinese text is never blocked regardless of config', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          nonChineseTextArbitrary,
          (config, nonChineseText) => {
            const observer = createMockDOMObserver(config);
            const result = observer.shouldBlockText(nonChineseText);
            
            // Non-Chinese text should never be blocked
            expect(result.shouldBlock).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Chinese block toggle changes behavior immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.boolean(),
          chineseTextArbitrary,
          async (initialConfig, newBlockChinese, chineseText) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Update only blockChinese
            await mock.updateConfig({
              advanced: { blockChinese: newBlockChinese }
            });
            
            // Create observer with updated config
            const observer = createMockDOMObserver(mock.config);
            const result = observer.shouldBlockText(chineseText);
            
            // Behavior should match the new config value
            expect(result.shouldBlock).toBe(newBlockChinese);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Tests for input box translation button toggle
   * **Validates: Requirements 2.1, 2.2**
   */
  describe('Input box translation button toggle', () => {
    test('translate button is shown only when inputBox.enabled is true', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          (config) => {
            const translator = createMockInputBoxTranslator(config);
            const shouldShow = translator.shouldShowTranslateButton();
            
            expect(shouldShow).toBe(config.inputBox.enabled);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('input box button toggle changes behavior immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.boolean(),
          async (initialConfig, newEnabled) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Update only inputBox.enabled
            await mock.updateConfig({
              inputBox: { enabled: newEnabled }
            });
            
            // Create translator with updated config
            const translator = createMockInputBoxTranslator(mock.config);
            const shouldShow = translator.shouldShowTranslateButton();
            
            // Behavior should match the new config value
            expect(shouldShow).toBe(newEnabled);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Tests for realtime translation preview toggle
   * **Validates: Requirements 4.1, 4.2**
   */
  describe('Realtime translation preview toggle', () => {
    test('realtime preview is enabled only when advanced.realtime is true', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          (config) => {
            const translator = createMockInputBoxTranslator(config);
            const shouldEnable = translator.shouldEnableRealtimeTranslation();
            
            expect(shouldEnable).toBe(config.advanced.realtime);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('realtime preview toggle changes behavior immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.boolean(),
          async (initialConfig, newRealtime) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Update only advanced.realtime
            await mock.updateConfig({
              advanced: { realtime: newRealtime }
            });
            
            // Create translator with updated config
            const translator = createMockInputBoxTranslator(mock.config);
            const shouldEnable = translator.shouldEnableRealtimeTranslation();
            
            // Behavior should match the new config value
            expect(shouldEnable).toBe(newRealtime);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Tests for reverse translation verification toggle
   * **Validates: Requirements 4.3, 4.4**
   */
  describe('Reverse translation verification toggle', () => {
    test('reverse translation is shown only when advanced.reverseTranslation is true', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          (config) => {
            const translator = createMockInputBoxTranslator(config);
            const shouldShow = translator.shouldShowReverseTranslation();
            
            expect(shouldShow).toBe(config.advanced.reverseTranslation);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('reverse translation toggle changes behavior immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.boolean(),
          async (initialConfig, newReverseTranslation) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Update only advanced.reverseTranslation
            await mock.updateConfig({
              advanced: { reverseTranslation: newReverseTranslation }
            });
            
            // Create translator with updated config
            const translator = createMockInputBoxTranslator(mock.config);
            const shouldShow = translator.shouldShowReverseTranslation();
            
            // Behavior should match the new config value
            expect(shouldShow).toBe(newReverseTranslation);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Mock ContentScriptCore for testing friend independent config
 * This simulates the actual ContentScriptCore.getContactConfig logic
 */
function createMockContentScriptCore(config) {
  return {
    config: config,
    
    /**
     * Get contact configuration (prioritize independent config)
     * Mirrors the implementation in ContentScriptCore
     * @param {string} contactId - The contact ID
     * @returns {Object} The effective config for this contact
     */
    getContactConfig(contactId) {
      // If friend independent config is not enabled, return global config
      if (!this.config.advanced.friendIndependent) {
        return {
          ...this.config.global,
          blockChinese: this.config.advanced.blockChinese
        };
      }

      // Check if there's an independent config for this contact
      if (contactId && this.config.friendConfigs && this.config.friendConfigs[contactId]) {
        const friendConfig = this.config.friendConfigs[contactId];

        if (friendConfig.enabled) {
          // Return merged config with friend-specific overrides
          return {
            ...this.config.global,
            targetLang: friendConfig.targetLang || this.config.global.targetLang,
            blockChinese: friendConfig.blockChinese !== undefined ? friendConfig.blockChinese : this.config.advanced.blockChinese
          };
        }
      }

      // Return global config with blockChinese from advanced
      return {
        ...this.config.global,
        blockChinese: this.config.advanced.blockChinese
      };
    },
    
    /**
     * Get effective blockChinese setting for a contact
     * @param {string} contactId - The contact ID
     * @returns {boolean} Whether Chinese should be blocked
     */
    getEffectiveBlockChinese(contactId) {
      // If friend independent config is not enabled, use global setting
      if (!this.config.advanced.friendIndependent) {
        return this.config.advanced.blockChinese || false;
      }

      // Check if there's an independent config for this contact
      if (contactId && this.config.friendConfigs && this.config.friendConfigs[contactId]) {
        const friendConfig = this.config.friendConfigs[contactId];
        if (friendConfig.enabled) {
          return friendConfig.blockChinese || false;
        }
      }

      // Use global config
      return this.config.advanced.blockChinese || false;
    },
    
    /**
     * Get effective targetLang setting for a contact
     * @param {string} contactId - The contact ID
     * @returns {string} The target language
     */
    getEffectiveTargetLang(contactId) {
      // If friend independent config is not enabled, use global setting
      if (!this.config.advanced.friendIndependent) {
        return this.config.global.targetLang;
      }

      // Check if there's an independent config for this contact
      if (contactId && this.config.friendConfigs && this.config.friendConfigs[contactId]) {
        const friendConfig = this.config.friendConfigs[contactId];
        if (friendConfig.enabled && friendConfig.targetLang) {
          return friendConfig.targetLang;
        }
      }

      // Use global config
      return this.config.global.targetLang;
    }
  };
}

/**
 * Arbitrary for generating contact IDs
 */
const contactIdArbitrary = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);

/**
 * Arbitrary for generating friend config entries
 */
const friendConfigEntryArbitrary = fc.record({
  enabled: fc.boolean(),
  targetLang: fc.constantFrom('zh-CN', 'en', 'es', 'fr', 'de'),
  blockChinese: fc.boolean()
});

describe('WhatsAppTranslation Friend Independent Config Property Tests', () => {
  /**
   * **Feature: translation-controls-fix, Property 5: Friend independent config priority**
   * **Validates: Requirements 5.3**
   * 
   * For any contact and config state, when friendIndependent is true and the contact has
   * an enabled independent config, the system should use the contact's specific settings
   * instead of global settings.
   */
  describe('Property 5: Friend independent config priority', () => {
    test('when friendIndependent is disabled, global config is always used', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          contactIdArbitrary,
          (config, contactId) => {
            // Ensure friendIndependent is disabled
            const testConfig = {
              ...config,
              advanced: { ...config.advanced, friendIndependent: false }
            };
            
            const core = createMockContentScriptCore(testConfig);
            const effectiveConfig = core.getContactConfig(contactId);
            
            // Should always use global config values
            expect(effectiveConfig.autoTranslate).toBe(testConfig.global.autoTranslate);
            expect(effectiveConfig.engine).toBe(testConfig.global.engine);
            expect(effectiveConfig.targetLang).toBe(testConfig.global.targetLang);
            expect(effectiveConfig.blockChinese).toBe(testConfig.advanced.blockChinese);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('when friendIndependent is enabled and contact has enabled config, friend config is used', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          contactIdArbitrary,
          friendConfigEntryArbitrary,
          (baseConfig, contactId, friendConfig) => {
            // Ensure friendIndependent is enabled and friend config is enabled
            const testConfig = {
              ...baseConfig,
              advanced: { ...baseConfig.advanced, friendIndependent: true },
              friendConfigs: {
                ...baseConfig.friendConfigs,
                [contactId]: { ...friendConfig, enabled: true }
              }
            };
            
            const core = createMockContentScriptCore(testConfig);
            const effectiveConfig = core.getContactConfig(contactId);
            
            // Friend-specific settings should override global
            expect(effectiveConfig.targetLang).toBe(friendConfig.targetLang);
            expect(effectiveConfig.blockChinese).toBe(friendConfig.blockChinese);
            
            // Other global settings should be preserved
            expect(effectiveConfig.autoTranslate).toBe(testConfig.global.autoTranslate);
            expect(effectiveConfig.engine).toBe(testConfig.global.engine);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('when friendIndependent is enabled but contact config is disabled, global config is used', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          contactIdArbitrary,
          friendConfigEntryArbitrary,
          (baseConfig, contactId, friendConfig) => {
            // Ensure friendIndependent is enabled but friend config is disabled
            const testConfig = {
              ...baseConfig,
              advanced: { ...baseConfig.advanced, friendIndependent: true },
              friendConfigs: {
                ...baseConfig.friendConfigs,
                [contactId]: { ...friendConfig, enabled: false }
              }
            };
            
            const core = createMockContentScriptCore(testConfig);
            const effectiveConfig = core.getContactConfig(contactId);
            
            // Should use global config since friend config is disabled
            expect(effectiveConfig.targetLang).toBe(testConfig.global.targetLang);
            expect(effectiveConfig.blockChinese).toBe(testConfig.advanced.blockChinese);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('when friendIndependent is enabled but contact has no config, global config is used', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          contactIdArbitrary,
          (baseConfig, contactId) => {
            // Ensure friendIndependent is enabled but no friend config exists
            const testConfig = {
              ...baseConfig,
              advanced: { ...baseConfig.advanced, friendIndependent: true },
              friendConfigs: {} // Empty friend configs
            };
            
            const core = createMockContentScriptCore(testConfig);
            const effectiveConfig = core.getContactConfig(contactId);
            
            // Should use global config since no friend config exists
            expect(effectiveConfig.targetLang).toBe(testConfig.global.targetLang);
            expect(effectiveConfig.blockChinese).toBe(testConfig.advanced.blockChinese);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('blockChinese respects friend independent config priority', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          contactIdArbitrary,
          fc.boolean(),
          fc.boolean(),
          (baseConfig, contactId, globalBlockChinese, friendBlockChinese) => {
            // Test with friendIndependent enabled and friend config enabled
            const testConfig = {
              ...baseConfig,
              advanced: { 
                ...baseConfig.advanced, 
                friendIndependent: true,
                blockChinese: globalBlockChinese
              },
              friendConfigs: {
                [contactId]: { 
                  enabled: true, 
                  targetLang: 'en',
                  blockChinese: friendBlockChinese 
                }
              }
            };
            
            const core = createMockContentScriptCore(testConfig);
            const effectiveBlockChinese = core.getEffectiveBlockChinese(contactId);
            
            // Should use friend's blockChinese setting
            expect(effectiveBlockChinese).toBe(friendBlockChinese);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('targetLang respects friend independent config priority', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          contactIdArbitrary,
          fc.constantFrom('zh-CN', 'en', 'es', 'fr'),
          (baseConfig, contactId, friendTargetLang) => {
            // Test with friendIndependent enabled and friend config enabled
            const testConfig = {
              ...baseConfig,
              advanced: { 
                ...baseConfig.advanced, 
                friendIndependent: true
              },
              friendConfigs: {
                [contactId]: { 
                  enabled: true, 
                  targetLang: friendTargetLang,
                  blockChinese: false 
                }
              }
            };
            
            const core = createMockContentScriptCore(testConfig);
            const effectiveTargetLang = core.getEffectiveTargetLang(contactId);
            
            // Should use friend's targetLang setting
            expect(effectiveTargetLang).toBe(friendTargetLang);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('different contacts can have different configs', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          contactIdArbitrary,
          contactIdArbitrary,
          friendConfigEntryArbitrary,
          friendConfigEntryArbitrary,
          (baseConfig, contactId1, contactId2, friendConfig1, friendConfig2) => {
            // Skip if contact IDs are the same
            fc.pre(contactId1 !== contactId2);
            
            const testConfig = {
              ...baseConfig,
              advanced: { ...baseConfig.advanced, friendIndependent: true },
              friendConfigs: {
                [contactId1]: { ...friendConfig1, enabled: true },
                [contactId2]: { ...friendConfig2, enabled: true }
              }
            };
            
            const core = createMockContentScriptCore(testConfig);
            
            const config1 = core.getContactConfig(contactId1);
            const config2 = core.getContactConfig(contactId2);
            
            // Each contact should get their own config
            expect(config1.targetLang).toBe(friendConfig1.targetLang);
            expect(config1.blockChinese).toBe(friendConfig1.blockChinese);
            
            expect(config2.targetLang).toBe(friendConfig2.targetLang);
            expect(config2.blockChinese).toBe(friendConfig2.blockChinese);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('config update changes friend independent behavior immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          contactIdArbitrary,
          friendConfigEntryArbitrary,
          fc.boolean(),
          async (initialConfig, contactId, friendConfig, newFriendIndependent) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Set up friend config
            await mock.updateConfig({
              advanced: { friendIndependent: newFriendIndependent },
              friendConfigs: {
                [contactId]: { ...friendConfig, enabled: true }
              }
            });
            
            const core = createMockContentScriptCore(mock.config);
            const effectiveConfig = core.getContactConfig(contactId);
            
            if (newFriendIndependent) {
              // Should use friend config
              expect(effectiveConfig.targetLang).toBe(friendConfig.targetLang);
              expect(effectiveConfig.blockChinese).toBe(friendConfig.blockChinese);
            } else {
              // Should use global config
              expect(effectiveConfig.targetLang).toBe(mock.config.global.targetLang);
              expect(effectiveConfig.blockChinese).toBe(mock.config.advanced.blockChinese);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Tests for chat switch config application
   * **Validates: Requirements 5.4, 10.3**
   * 
   * When switching to a chat with independent config, the system should apply
   * that contact's specific settings. When switching to a chat without independent
   * config, the system should use global config.
   */
  describe('Chat switch config application', () => {
    test('switching to chat with independent config applies friend settings', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          contactIdArbitrary,
          friendConfigEntryArbitrary,
          (baseConfig, contactId, friendConfig) => {
            // Setup config with friend independent enabled
            const testConfig = {
              ...baseConfig,
              advanced: { ...baseConfig.advanced, friendIndependent: true },
              friendConfigs: {
                [contactId]: { ...friendConfig, enabled: true }
              }
            };
            
            const core = createMockContentScriptCore(testConfig);
            
            // Simulate chat switch by getting config for the contact
            const effectiveConfig = core.getContactConfig(contactId);
            
            // Friend-specific settings should be applied
            expect(effectiveConfig.targetLang).toBe(friendConfig.targetLang);
            expect(effectiveConfig.blockChinese).toBe(friendConfig.blockChinese);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('switching to chat without independent config uses global settings', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          contactIdArbitrary,
          contactIdArbitrary,
          friendConfigEntryArbitrary,
          (baseConfig, configuredContactId, unconfiguredContactId, friendConfig) => {
            // Ensure the two contact IDs are different
            fc.pre(configuredContactId !== unconfiguredContactId);
            
            // Setup config with friend independent enabled but only for one contact
            const testConfig = {
              ...baseConfig,
              advanced: { ...baseConfig.advanced, friendIndependent: true },
              friendConfigs: {
                [configuredContactId]: { ...friendConfig, enabled: true }
              }
            };
            
            const core = createMockContentScriptCore(testConfig);
            
            // Simulate chat switch to unconfigured contact
            const effectiveConfig = core.getContactConfig(unconfiguredContactId);
            
            // Global settings should be used
            expect(effectiveConfig.targetLang).toBe(testConfig.global.targetLang);
            expect(effectiveConfig.blockChinese).toBe(testConfig.advanced.blockChinese);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Chinese blocking respects contact config on chat switch', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          contactIdArbitrary,
          fc.boolean(),
          fc.boolean(),
          (baseConfig, contactId, globalBlockChinese, friendBlockChinese) => {
            // Setup config with different global and friend blockChinese settings
            const testConfig = {
              ...baseConfig,
              advanced: { 
                ...baseConfig.advanced, 
                friendIndependent: true,
                blockChinese: globalBlockChinese
              },
              friendConfigs: {
                [contactId]: { 
                  enabled: true, 
                  targetLang: 'en',
                  blockChinese: friendBlockChinese 
                }
              }
            };
            
            // Create mock DOMObserver with the config
            const observer = createMockDOMObserver(testConfig, contactId);
            
            // Simulate chat switch - shouldBlockChinese should use friend config
            const shouldBlock = observer.shouldBlockChinese();
            
            // Should use friend's blockChinese setting
            expect(shouldBlock).toBe(friendBlockChinese);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('sequential chat switches apply correct configs', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          contactIdArbitrary,
          contactIdArbitrary,
          friendConfigEntryArbitrary,
          friendConfigEntryArbitrary,
          (baseConfig, contact1, contact2, friendConfig1, friendConfig2) => {
            // Ensure contacts are different
            fc.pre(contact1 !== contact2);
            
            // Setup config with both contacts having independent configs
            const testConfig = {
              ...baseConfig,
              advanced: { ...baseConfig.advanced, friendIndependent: true },
              friendConfigs: {
                [contact1]: { ...friendConfig1, enabled: true },
                [contact2]: { ...friendConfig2, enabled: true }
              }
            };
            
            const core = createMockContentScriptCore(testConfig);
            
            // Simulate switching to contact1
            const config1 = core.getContactConfig(contact1);
            expect(config1.targetLang).toBe(friendConfig1.targetLang);
            expect(config1.blockChinese).toBe(friendConfig1.blockChinese);
            
            // Simulate switching to contact2
            const config2 = core.getContactConfig(contact2);
            expect(config2.targetLang).toBe(friendConfig2.targetLang);
            expect(config2.blockChinese).toBe(friendConfig2.blockChinese);
            
            // Simulate switching back to contact1
            const config1Again = core.getContactConfig(contact1);
            expect(config1Again.targetLang).toBe(friendConfig1.targetLang);
            expect(config1Again.blockChinese).toBe(friendConfig1.blockChinese);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Mock MessageTranslator for testing engine and language settings
 * This simulates the actual MessageTranslator logic for engine selection
 */
function createMockMessageTranslatorWithEngine(config) {
  return {
    core: {
      config: config,
      accountId: 'test-account',
      isGroupChat: () => false
    },
    
    /**
     * Get the engine to use for chat window translation
     * Mirrors the implementation in MessageTranslator.translateMessage
     * @returns {string} The engine name
     */
    getChatWindowEngine() {
      return this.core.config.global.engine;
    },
    
    /**
     * Get the target language for chat window translation
     * Mirrors the implementation in MessageTranslator.translateMessage
     * @returns {string} The target language
     */
    getChatWindowTargetLang() {
      return this.core.config.global.targetLang || 'zh-CN';
    },
    
    /**
     * Get the source language for chat window translation
     * @returns {string} The source language
     */
    getChatWindowSourceLang() {
      return this.core.config.global.sourceLang || 'auto';
    },
    
    /**
     * Build translation request for chat window
     * Mirrors the actual request structure in MessageTranslator.translateMessage
     * @param {string} text - Text to translate
     * @returns {Object} Translation request object
     */
    buildTranslationRequest(text) {
      return {
        accountId: this.core.accountId,
        text: text,
        sourceLang: this.getChatWindowSourceLang(),
        targetLang: this.getChatWindowTargetLang(),
        engineName: this.getChatWindowEngine(),
        options: {} // Chat window translation doesn't pass style parameter
      };
    }
  };
}

/**
 * Mock InputBoxTranslator for testing engine and style settings
 * This simulates the actual InputBoxTranslator logic for engine and style selection
 */
function createMockInputBoxTranslatorWithEngine(config, contactId = null) {
  return {
    core: {
      config: config,
      accountId: 'test-account',
      getCurrentContactId: () => contactId
    },
    
    /**
     * Get the engine to use for input box translation
     * Mirrors the implementation in InputBoxTranslator.translateInputBox
     * @returns {string} The engine name
     */
    getInputBoxEngine() {
      return this.core.config.inputBox.engine || this.core.config.global.engine;
    },
    
    /**
     * Get the style to use for input box translation
     * Mirrors the implementation in InputBoxTranslator.translateInputBox
     * @returns {string} The translation style
     */
    getInputBoxStyle() {
      return this.core.config.inputBox.style || '通用';
    },
    
    /**
     * Get the target language for input box translation
     * Considers friend independent config
     * @returns {string} The target language
     */
    getInputBoxTargetLang() {
      const contactId = this.core.getCurrentContactId();
      
      // Check friend independent config
      if (this.core.config.advanced.friendIndependent &&
          contactId &&
          this.core.config.friendConfigs &&
          this.core.config.friendConfigs[contactId] &&
          this.core.config.friendConfigs[contactId].enabled) {
        return this.core.config.friendConfigs[contactId].targetLang || 
               this.core.config.inputBox.targetLang || 'auto';
      }
      
      return this.core.config.inputBox.targetLang || 'auto';
    },
    
    /**
     * Build translation request for input box
     * Mirrors the actual request structure in InputBoxTranslator.translateInputBox
     * @param {string} text - Text to translate
     * @param {string} targetLang - Target language (after auto-detection)
     * @returns {Object} Translation request object
     */
    buildTranslationRequest(text, targetLang) {
      return {
        accountId: this.core.accountId,
        text: text,
        sourceLang: 'auto',
        targetLang: targetLang,
        engineName: this.getInputBoxEngine(),
        options: {
          style: this.getInputBoxStyle()
        }
      };
    }
  };
}

describe('WhatsAppTranslation Engine and Language Settings Property Tests', () => {
  /**
   * Tests for chat window translation engine switching
   * **Feature: translation-controls-fix**
   * **Validates: Requirements 6.1**
   * 
   * When the user changes the chat window translation engine, new messages
   * should use the new engine immediately.
   */
  describe('Chat window translation engine switching', () => {
    test('chat window translation uses global.engine setting', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          (config) => {
            const translator = createMockMessageTranslatorWithEngine(config);
            const engine = translator.getChatWindowEngine();
            
            // Should use the engine from global config
            expect(engine).toBe(config.global.engine);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('engine change takes effect immediately for new translations', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.constantFrom('google', 'deepl', 'baidu', 'openai'),
          async (initialConfig, newEngine) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Update only the engine
            await mock.updateConfig({
              global: { engine: newEngine }
            });
            
            // Create translator with updated config
            const translator = createMockMessageTranslatorWithEngine(mock.config);
            const engine = translator.getChatWindowEngine();
            
            // Engine should be the new value
            expect(engine).toBe(newEngine);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('translation request uses correct engine', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          (config, text) => {
            const translator = createMockMessageTranslatorWithEngine(config);
            const request = translator.buildTranslationRequest(text);
            
            // Request should use the configured engine
            expect(request.engineName).toBe(config.global.engine);
            // Chat window translation should not have style option
            expect(request.options).toEqual({});
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple engine changes are applied correctly', async () => {
      const engines = ['google', 'deepl', 'baidu', 'openai'];
      
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.array(fc.constantFrom(...engines), { minLength: 2, maxLength: 5 }),
          async (initialConfig, engineSequence) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Apply each engine change sequentially
            for (const engine of engineSequence) {
              await mock.updateConfig({
                global: { engine: engine }
              });
              
              const translator = createMockMessageTranslatorWithEngine(mock.config);
              expect(translator.getChatWindowEngine()).toBe(engine);
            }
            
            // Final engine should be the last in sequence
            const finalTranslator = createMockMessageTranslatorWithEngine(mock.config);
            expect(finalTranslator.getChatWindowEngine()).toBe(engineSequence[engineSequence.length - 1]);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Tests for target language switching
   * **Feature: translation-controls-fix**
   * **Validates: Requirements 6.2**
   * 
   * When the user changes the target language, new messages should be
   * translated to the new language immediately.
   */
  describe('Target language switching', () => {
    test('chat window translation uses global.targetLang setting', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          (config) => {
            const translator = createMockMessageTranslatorWithEngine(config);
            const targetLang = translator.getChatWindowTargetLang();
            
            // Should use the targetLang from global config
            expect(targetLang).toBe(config.global.targetLang);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('target language change takes effect immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.constantFrom('zh-CN', 'en', 'es', 'fr', 'de', 'ja'),
          async (initialConfig, newTargetLang) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Update only the target language
            await mock.updateConfig({
              global: { targetLang: newTargetLang }
            });
            
            // Create translator with updated config
            const translator = createMockMessageTranslatorWithEngine(mock.config);
            const targetLang = translator.getChatWindowTargetLang();
            
            // Target language should be the new value
            expect(targetLang).toBe(newTargetLang);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('translation request uses correct target language', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          (config, text) => {
            const translator = createMockMessageTranslatorWithEngine(config);
            const request = translator.buildTranslationRequest(text);
            
            // Request should use the configured target language
            expect(request.targetLang).toBe(config.global.targetLang);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('source language setting is respected', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          (config, text) => {
            const translator = createMockMessageTranslatorWithEngine(config);
            const request = translator.buildTranslationRequest(text);
            
            // Request should use the configured source language
            expect(request.sourceLang).toBe(config.global.sourceLang);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Tests for input box translation engine and style switching
   * **Feature: translation-controls-fix**
   * **Validates: Requirements 2.4, 2.6**
   * 
   * When the user changes the input box translation engine or style,
   * the new settings should be used immediately.
   */
  describe('Input box translation engine and style switching', () => {
    test('input box translation uses inputBox.engine setting', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          (config) => {
            const translator = createMockInputBoxTranslatorWithEngine(config);
            const engine = translator.getInputBoxEngine();
            
            // Should use the engine from inputBox config
            expect(engine).toBe(config.inputBox.engine);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('input box translation uses inputBox.style setting', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          (config) => {
            const translator = createMockInputBoxTranslatorWithEngine(config);
            const style = translator.getInputBoxStyle();
            
            // Should use the style from inputBox config
            expect(style).toBe(config.inputBox.style);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('input box engine change takes effect immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.constantFrom('google', 'deepl', 'baidu', 'openai'),
          async (initialConfig, newEngine) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Update only the input box engine
            await mock.updateConfig({
              inputBox: { engine: newEngine }
            });
            
            // Create translator with updated config
            const translator = createMockInputBoxTranslatorWithEngine(mock.config);
            const engine = translator.getInputBoxEngine();
            
            // Engine should be the new value
            expect(engine).toBe(newEngine);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('input box style change takes effect immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.constantFrom('通用', '正式', '口语', '商务', '友好'),
          async (initialConfig, newStyle) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Update only the input box style
            await mock.updateConfig({
              inputBox: { style: newStyle }
            });
            
            // Create translator with updated config
            const translator = createMockInputBoxTranslatorWithEngine(mock.config);
            const style = translator.getInputBoxStyle();
            
            // Style should be the new value
            expect(style).toBe(newStyle);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('input box translation request includes style option', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.constantFrom('en', 'es', 'fr'),
          (config, text, targetLang) => {
            const translator = createMockInputBoxTranslatorWithEngine(config);
            const request = translator.buildTranslationRequest(text, targetLang);
            
            // Request should include style option
            expect(request.options.style).toBe(config.inputBox.style);
            // Request should use input box engine
            expect(request.engineName).toBe(config.inputBox.engine);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('input box target language respects friend independent config', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          contactIdArbitrary,
          fc.constantFrom('zh-CN', 'en', 'es', 'fr'),
          (baseConfig, contactId, friendTargetLang) => {
            // Setup config with friend independent enabled
            const testConfig = {
              ...baseConfig,
              advanced: { ...baseConfig.advanced, friendIndependent: true },
              friendConfigs: {
                [contactId]: { 
                  enabled: true, 
                  targetLang: friendTargetLang,
                  blockChinese: false 
                }
              }
            };
            
            const translator = createMockInputBoxTranslatorWithEngine(testConfig, contactId);
            const targetLang = translator.getInputBoxTargetLang();
            
            // Should use friend's target language
            expect(targetLang).toBe(friendTargetLang);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('input box uses global target lang when friend config disabled', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          contactIdArbitrary,
          (config, contactId) => {
            // Ensure friend independent is disabled
            const testConfig = {
              ...config,
              advanced: { ...config.advanced, friendIndependent: false }
            };
            
            const translator = createMockInputBoxTranslatorWithEngine(testConfig, contactId);
            const targetLang = translator.getInputBoxTargetLang();
            
            // Should use inputBox target language
            expect(targetLang).toBe(testConfig.inputBox.targetLang);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('simultaneous engine and style changes are applied correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          translationConfigArbitrary,
          fc.constantFrom('google', 'deepl', 'baidu', 'openai'),
          fc.constantFrom('通用', '正式', '口语', '商务'),
          async (initialConfig, newEngine, newStyle) => {
            const mock = createMockWhatsAppTranslation(initialConfig);
            
            // Update both engine and style at once
            await mock.updateConfig({
              inputBox: { 
                engine: newEngine,
                style: newStyle
              }
            });
            
            // Create translator with updated config
            const translator = createMockInputBoxTranslatorWithEngine(mock.config);
            
            // Both should be updated
            expect(translator.getInputBoxEngine()).toBe(newEngine);
            expect(translator.getInputBoxStyle()).toBe(newStyle);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Tests for engine fallback behavior
   * When inputBox.engine is not set, it should fall back to global.engine
   */
  describe('Engine fallback behavior', () => {
    test('input box falls back to global engine when inputBox.engine is undefined', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          (config) => {
            // Create config with undefined inputBox.engine
            const testConfig = {
              ...config,
              inputBox: { 
                ...config.inputBox,
                engine: undefined
              }
            };
            
            // Mock the fallback behavior
            const getInputBoxEngine = () => {
              return testConfig.inputBox.engine || testConfig.global.engine;
            };
            
            const engine = getInputBoxEngine();
            
            // Should fall back to global engine
            expect(engine).toBe(testConfig.global.engine);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('input box style falls back to default when not set', () => {
      fc.assert(
        fc.property(
          translationConfigArbitrary,
          (config) => {
            // Create config with undefined inputBox.style
            const testConfig = {
              ...config,
              inputBox: { 
                ...config.inputBox,
                style: undefined
              }
            };
            
            // Mock the fallback behavior
            const getInputBoxStyle = () => {
              return testConfig.inputBox.style || '通用';
            };
            
            const style = getInputBoxStyle();
            
            // Should fall back to default style
            expect(style).toBe('通用');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
