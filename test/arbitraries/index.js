/**
 * Test Generators (Arbitraries) for Property-Based Testing
 * 
 * Provides fast-check arbitraries for generating test data
 * that conforms to domain entity constraints.
 * 
 * @module test/arbitraries
 * Requirements: 10.3, 10.6
 */

'use strict';

const fc = require('fast-check');

// ==================== Basic Arbitraries ====================

/**
 * UUID v4 arbitrary
 */
const uuidArbitrary = fc.uuid();

/**
 * Non-empty string arbitrary with length constraints
 * @param {number} minLength - Minimum length
 * @param {number} maxLength - Maximum length
 */
const nonEmptyString = (minLength = 1, maxLength = 100) =>
  fc.string({ minLength, maxLength }).filter(s => s.trim().length > 0);

/**
 * Optional string arbitrary
 */
const optionalString = fc.option(fc.string({ maxLength: 255 }), { nil: null });

/**
 * Port number arbitrary (1-65535)
 */
const portArbitrary = fc.integer({ min: 1, max: 65535 });

/**
 * Date arbitrary within reasonable range
 */
const dateArbitrary = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31')
});

/**
 * Optional date arbitrary
 */
const optionalDateArbitrary = fc.option(dateArbitrary, { nil: null });

// ==================== Account Arbitraries ====================

/**
 * Account status arbitrary
 */
const accountStatusArbitrary = fc.constantFrom('inactive', 'loading', 'active', 'error');

/**
 * Valid account arbitrary - generates accounts that pass validation
 */
const validAccountArbitrary = fc.record({
  id: uuidArbitrary,
  name: nonEmptyString(1, 100),
  phoneNumber: fc.option(fc.string({ minLength: 1, maxLength: 32 }), { nil: null }),
  status: accountStatusArbitrary,
  autoStart: fc.boolean(),
  createdAt: dateArbitrary,
  lastActiveAt: optionalDateArbitrary,
  
  translationConfigId: fc.option(uuidArbitrary, { nil: null }),
  sessionDir: nonEmptyString(1, 255).map(s => `session-data/${s}`),
  profileName: optionalString,
  avatarUrl: optionalString,
  note: fc.string({ maxLength: 500 }),
  order: fc.nat({ max: 1000 })
});

/**
 * Account arbitrary (may include invalid data for testing validation)
 */
const accountArbitrary = fc.record({
  id: fc.oneof(uuidArbitrary, fc.constant(''), fc.constant(null)),
  name: fc.oneof(nonEmptyString(1, 100), fc.constant(''), fc.constant(null)),
  phoneNumber: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
  status: fc.oneof(accountStatusArbitrary, fc.constant('invalid-status')),
  autoStart: fc.oneof(fc.boolean(), fc.constant('true')),
  createdAt: fc.oneof(dateArbitrary, fc.constant('invalid-date')),
  lastActiveAt: optionalDateArbitrary,
  
  translationConfigId: fc.option(uuidArbitrary, { nil: null }),
  sessionDir: fc.oneof(nonEmptyString(1, 255), fc.constant('')),
  profileName: optionalString,
  avatarUrl: optionalString,
  note: fc.string({ maxLength: 500 }),
  order: fc.oneof(fc.nat({ max: 1000 }), fc.constant(-1))
});

 


// ==================== TranslationConfig Arbitraries ====================

/**
 * Translation engine arbitrary
 */
const translationEngineArbitrary = fc.constantFrom('google', 'gpt4', 'gemini', 'deepseek', 'custom');

/**
 * Translation style arbitrary
 */
const translationStyleArbitrary = fc.constantFrom(
  'general', 'formal', 'casual', 'friendly', 'humorous',
  'polite', 'firm', 'concise', 'motivational', 'neutral', 'professional'
);

/**
 * Language code arbitrary
 */
const languageCodeArbitrary = fc.constantFrom(
  'en', 'zh', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'ru', 'ar', 'hi', 'it'
);

/**
 * Friend settings arbitrary
 */
const friendSettingsArbitrary = fc.dictionary(
  uuidArbitrary,
  fc.record({
    enabled: fc.boolean(),
    targetLanguage: languageCodeArbitrary
  }),
  { maxKeys: 10 }
);

/**
 * Valid translation config arbitrary
 */
const validTranslationConfigArbitrary = fc.record({
  id: uuidArbitrary,
  enabled: fc.boolean(),
  engine: translationEngineArbitrary,
  apiKey: fc.option(nonEmptyString(10, 100), { nil: null }),
  targetLanguage: languageCodeArbitrary,
  sourceLanguage: fc.option(languageCodeArbitrary, { nil: null }),
  autoTranslate: fc.boolean(),
  translateInput: fc.boolean(),
  inputStyle: translationStyleArbitrary,
  friendSettings: friendSettingsArbitrary,
  createdAt: dateArbitrary,
  updatedAt: dateArbitrary
}).filter(config => {
  // Ensure API key is present for engines that require it
  const requiresKey = ['gpt4', 'gemini', 'deepseek', 'custom'].includes(config.engine);
  if (config.enabled && requiresKey) {
    return config.apiKey !== null && config.apiKey.trim().length > 0;
  }
  return true;
});

/**
 * Translation config arbitrary (may include invalid data)
 */
const translationConfigArbitrary = fc.record({
  id: fc.oneof(uuidArbitrary, fc.constant('')),
  enabled: fc.oneof(fc.boolean(), fc.constant('true')),
  engine: fc.oneof(translationEngineArbitrary, fc.constant('invalid')),
  apiKey: optionalString,
  targetLanguage: fc.oneof(languageCodeArbitrary, fc.constant('')),
  sourceLanguage: fc.option(languageCodeArbitrary, { nil: null }),
  autoTranslate: fc.oneof(fc.boolean(), fc.constant('false')),
  translateInput: fc.oneof(fc.boolean(), fc.constant('true')),
  inputStyle: fc.oneof(translationStyleArbitrary, fc.constant('invalid')),
  friendSettings: fc.oneof(friendSettingsArbitrary, fc.constant(null)),
  createdAt: dateArbitrary,
  updatedAt: dateArbitrary
});

// ==================== Event Arbitraries ====================

/**
 * Event name arbitrary
 */
const eventNameArbitrary = fc.string({ minLength: 1, maxLength: 50 })
  .map(s => s.replace(/[^a-z.:_-]/g, 'a'))
  .filter(s => s.length > 0);

/**
 * Event payload arbitrary
 */
const eventPayloadArbitrary = fc.oneof(
  fc.constant(null),
  fc.boolean(),
  fc.integer(),
  fc.double(),
  fc.string(),
  fc.array(fc.jsonValue()),
  fc.dictionary(fc.string(), fc.jsonValue())
);

/**
 * Event arbitrary
 */
const eventArbitrary = fc.record({
  name: eventNameArbitrary,
  payload: eventPayloadArbitrary,
  timestamp: fc.nat()
});

/**
 * Event with schema arbitrary
 */
const typedEventArbitrary = fc.record({
  name: eventNameArbitrary,
  schema: fc.record({
    type: fc.constantFrom('object', 'string', 'number', 'boolean', 'array'),
    required: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 })
  }),
  payload: eventPayloadArbitrary
});

// ==================== Plugin Arbitraries ====================

/**
 * Semantic version arbitrary
 */
const semverArbitrary = fc.tuple(
  fc.nat({ max: 99 }),
  fc.nat({ max: 99 }),
  fc.nat({ max: 99 })
).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

/**
 * Plugin name arbitrary
 */
const pluginNameArbitrary = fc.string({ minLength: 1, maxLength: 50 })
  .map(s => s.replace(/[^a-z0-9_-]/g, 'a'))
  .filter(s => s.length > 0);

/**
 * Valid plugin arbitrary
 */
const validPluginArbitrary = fc.record({
  name: pluginNameArbitrary,
  version: semverArbitrary,
  dependencies: fc.array(pluginNameArbitrary, { maxLength: 5 }),
  enabled: fc.boolean()
});

/**
 * Plugin arbitrary (may include invalid data)
 */
const pluginArbitrary = fc.record({
  name: fc.oneof(pluginNameArbitrary, fc.constant(''), fc.constant(null)),
  version: fc.oneof(semverArbitrary, fc.constant('invalid'), fc.constant('')),
  dependencies: fc.oneof(
    fc.array(pluginNameArbitrary, { maxLength: 5 }),
    fc.constant(null)
  ),
  enabled: fc.boolean()
});


// ==================== IPC Arbitraries ====================

/**
 * IPC channel name arbitrary
 */
const ipcChannelArbitrary = fc.string({ minLength: 1, maxLength: 50 })
  .map(s => s.replace(/[^a-z:_-]/g, 'a'))
  .filter(s => s.length > 0);

/**
 * IPC request arbitrary
 */
const ipcRequestArbitrary = fc.record({
  channel: ipcChannelArbitrary,
  payload: eventPayloadArbitrary,
  requestId: uuidArbitrary,
  timeout: fc.option(fc.integer({ min: 100, max: 30000 }), { nil: undefined })
});

/**
 * IPC response arbitrary
 */
const ipcResponseArbitrary = fc.record({
  requestId: uuidArbitrary,
  success: fc.boolean(),
  data: fc.option(eventPayloadArbitrary, { nil: undefined }),
  error: fc.option(fc.record({
    code: fc.string({ minLength: 1, maxLength: 20 }),
    message: fc.string({ maxLength: 200 }),
    context: fc.dictionary(fc.string(), fc.jsonValue())
  }), { nil: undefined })
});

// ==================== State Arbitraries ====================

/**
 * UI state arbitrary
 */
const uiStateArbitrary = fc.record({
  sidebarWidth: fc.integer({ min: 100, max: 500 }),
  theme: fc.constantFrom('light', 'dark', 'system'),
  language: languageCodeArbitrary,
  notifications: fc.array(fc.record({
    id: uuidArbitrary,
    type: fc.constantFrom('info', 'warning', 'error', 'success'),
    message: fc.string({ maxLength: 200 }),
    timestamp: fc.nat()
  }), { maxLength: 10 })
});

/**
 * Accounts state arbitrary
 */
const accountsStateArbitrary = fc.record({
  items: fc.dictionary(uuidArbitrary, validAccountArbitrary, { maxKeys: 10 }),
  activeId: fc.option(uuidArbitrary, { nil: null }),
  loading: fc.boolean(),
  error: fc.option(fc.string({ maxLength: 200 }), { nil: null })
});

/**
 * Application state arbitrary
 */
const appStateArbitrary = fc.record({
  accounts: accountsStateArbitrary,
  ui: uiStateArbitrary,
  version: fc.nat()
});

// ==================== Config Arbitraries ====================

/**
 * Config value arbitrary
 */
const configValueArbitrary = fc.oneof(
  fc.boolean(),
  fc.integer(),
  fc.double(),
  fc.string({ maxLength: 200 }),
  fc.array(fc.jsonValue(), { maxLength: 10 }),
  fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue(), { maxKeys: 5 })
);

/**
 * Config schema property arbitrary
 */
const configSchemaPropertyArbitrary = fc.record({
  type: fc.constantFrom('string', 'number', 'boolean', 'object', 'array'),
  required: fc.boolean(),
  default: fc.option(configValueArbitrary, { nil: undefined }),
  sensitive: fc.boolean()
});

/**
 * Config schema arbitrary
 */
const configSchemaArbitrary = fc.record({
  properties: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 30 }),
    configSchemaPropertyArbitrary,
    { maxKeys: 20 }
  ),
  required: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 })
});

/**
 * Application config arbitrary
 */
const appConfigArbitrary = fc.record({
  app: fc.record({
    name: nonEmptyString(1, 50),
    version: semverArbitrary,
    debug: fc.boolean()
  }),
  window: fc.record({
    width: fc.integer({ min: 400, max: 2000 }),
    height: fc.integer({ min: 300, max: 1500 }),
    x: fc.option(fc.integer({ min: 0, max: 3000 }), { nil: undefined }),
    y: fc.option(fc.integer({ min: 0, max: 2000 }), { nil: undefined })
  }),
  
  translation: fc.option(validTranslationConfigArbitrary, { nil: null })
});

// ==================== Error Arbitraries ====================

/**
 * Error code arbitrary
 */
const errorCodeArbitrary = fc.string({ minLength: 3, maxLength: 30 })
  .map(s => s.toUpperCase().replace(/[^A-Z_]/g, 'A'))
  .filter(s => s.length >= 3);

/**
 * Error context arbitrary
 */
const errorContextArbitrary = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  { maxKeys: 10 }
);

/**
 * App error arbitrary
 */
const appErrorArbitrary = fc.record({
  message: fc.string({ minLength: 1, maxLength: 200 }),
  code: errorCodeArbitrary,
  context: errorContextArbitrary,
  recoverable: fc.boolean(),
  stack: fc.option(fc.string({ maxLength: 1000 }), { nil: undefined })
});

// ==================== Migration Arbitraries ====================

/**
 * Migration arbitrary
 */
const migrationArbitrary = fc.record({
  version: fc.integer({ min: 1, max: 100 }),
  name: nonEmptyString(1, 50),
  timestamp: fc.nat()
});

/**
 * Migration history arbitrary
 */
const migrationHistoryArbitrary = fc.array(migrationArbitrary, { maxLength: 20 })
  .map(migrations => {
    // Ensure unique versions and sorted order
    const seen = new Set();
    return migrations
      .filter(m => {
        if (seen.has(m.version)) return false;
        seen.add(m.version);
        return true;
      })
      .sort((a, b) => a.version - b.version);
  });

// ==================== Exports ====================

module.exports = {
  // Basic
  uuidArbitrary,
  nonEmptyString,
  optionalString,
  portArbitrary,
  dateArbitrary,
  optionalDateArbitrary,
  
  // Account
  accountStatusArbitrary,
  validAccountArbitrary,
  accountArbitrary,
  
  
  
  // TranslationConfig
  translationEngineArbitrary,
  translationStyleArbitrary,
  languageCodeArbitrary,
  friendSettingsArbitrary,
  validTranslationConfigArbitrary,
  translationConfigArbitrary,
  
  // Event
  eventNameArbitrary,
  eventPayloadArbitrary,
  eventArbitrary,
  typedEventArbitrary,
  
  // Plugin
  semverArbitrary,
  pluginNameArbitrary,
  validPluginArbitrary,
  pluginArbitrary,
  
  // IPC
  ipcChannelArbitrary,
  ipcRequestArbitrary,
  ipcResponseArbitrary,
  
  // State
  uiStateArbitrary,
  accountsStateArbitrary,
  appStateArbitrary,
  
  // Config
  configValueArbitrary,
  configSchemaPropertyArbitrary,
  configSchemaArbitrary,
  appConfigArbitrary,
  
  // Error
  errorCodeArbitrary,
  errorContextArbitrary,
  appErrorArbitrary,
  
  // Migration
  migrationArbitrary,
  migrationHistoryArbitrary
};
