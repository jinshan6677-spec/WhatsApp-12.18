'use strict';

/**
 * Property-based tests for ConfigProvider
 * 
 * Tests the following properties:
 * - Property 1: Configuration Round-Trip Consistency
 * - Property 15: Config Schema Validation
 * - Property 16: Config Inheritance Override
 * - Property 17: Config Change Notification
 * - Property 18: Sensitive Config Encryption
 * 
 * **Validates: Requirements 1.5, 5.2, 5.3, 5.4, 5.5, 5.6**
 */

const fc = require('fast-check');
const { ConfigProvider, createConfigProvider } = require('../ConfigProvider');

describe('ConfigProvider Property Tests', () => {
  // Arbitraries for generating test data
  
  // Simple value arbitrary (primitives only for JSON compatibility)
  // Note: We filter out -0 because JSON.stringify converts -0 to 0, which is standard JSON behavior
  const simpleValueArbitrary = fc.oneof(
    fc.string({ minLength: 0, maxLength: 100 }),
    fc.integer({ min: -1000000, max: 1000000 }),
    fc.double({ min: -1000, max: 1000, noNaN: true }).filter(n => !Object.is(n, -0)),
    fc.boolean()
  );

  // Configuration object arbitrary (nested objects with simple values)
  const configObjectArbitrary = fc.letrec(tie => ({
    value: fc.oneof(
      simpleValueArbitrary,
      fc.array(simpleValueArbitrary, { minLength: 0, maxLength: 5 }),
      tie('object')
    ),
    object: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
      fc.oneof(
        simpleValueArbitrary,
        fc.array(simpleValueArbitrary, { minLength: 0, maxLength: 3 })
      ),
      { minKeys: 0, maxKeys: 5 }
    )
  })).object;

  // Reserved JavaScript property names that cannot be accessed in strict mode
  const reservedPropertyNames = new Set([
    'caller', 'callee', 'arguments', 'prototype', '__proto__',
    'constructor', 'valueOf', 'toString', 'hasOwnProperty',
    'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString'
  ]);

  // Key path arbitrary - excludes reserved property names
  const keyPathArbitrary = fc.array(
    fc.string({ minLength: 1, maxLength: 20 })
      .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s))
      .filter(s => !reservedPropertyNames.has(s)),
    { minLength: 1, maxLength: 3 }
  ).map(parts => parts.join('.'));

  // Environment name arbitrary
  const environmentArbitrary = fc.constantFrom('development', 'production', 'test', 'staging');


  /**
   * **Feature: architecture-refactoring, Property 1: Configuration Round-Trip Consistency**
   * **Validates: Requirements 1.5, 5.6**
   * 
   * For any valid configuration object, serializing it to string and then
   * deserializing should produce an equivalent configuration object.
   */
  describe('Property 1: Configuration Round-Trip Consistency', () => {
    test('serialize then deserialize produces equivalent configuration', () => {
      fc.assert(
        fc.property(
          configObjectArbitrary,
          (config) => {
            const provider = createConfigProvider();
            
            // Set the configuration
            provider.setAll(config);
            
            // Serialize
            const serialized = provider.serialize();
            
            // Create new provider and deserialize
            const provider2 = createConfigProvider();
            provider2.deserialize(serialized);
            
            // Get the configuration back
            const restored = provider2.getAll();
            
            // Should be equivalent
            expect(restored).toEqual(config);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('JSON round-trip preserves all values', () => {
      fc.assert(
        fc.property(
          configObjectArbitrary,
          (config) => {
            const provider = createConfigProvider();
            provider.setAll(config);
            
            // Double round-trip
            const serialized1 = provider.serialize();
            provider.deserialize(serialized1);
            const serialized2 = provider.serialize();
            
            // Both serializations should be identical
            expect(JSON.parse(serialized1)).toEqual(JSON.parse(serialized2));
          }
        ),
        { numRuns: 100 }
      );
    });

    test('nested values are preserved through round-trip', () => {
      fc.assert(
        fc.property(
          fc.record({
            level1: fc.record({
              level2: fc.record({
                value: simpleValueArbitrary
              })
            })
          }),
          (config) => {
            const provider = createConfigProvider();
            provider.setAll(config);
            
            const serialized = provider.serialize();
            const provider2 = createConfigProvider();
            provider2.deserialize(serialized);
            
            expect(provider2.get('level1.level2.value')).toEqual(config.level1.level2.value);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 15: Config Schema Validation**
   * **Validates: Requirements 5.2**
   * 
   * For any configuration that does not conform to the defined schema,
   * loading should fail with validation errors identifying the non-conforming fields.
   */
  describe('Property 15: Config Schema Validation', () => {
    const testSchema = {
      properties: {
        name: { type: 'string', minLength: 1 },
        port: { type: 'number', minimum: 1, maximum: 65535 },
        enabled: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['name', 'port']
    };

    test('invalid type values are rejected with field-level errors', () => {
      fc.assert(
        fc.property(
          fc.integer(), // Invalid type for 'name' (should be string)
          (invalidName) => {
            const provider = createConfigProvider({ schema: testSchema });
            
            const invalidConfig = {
              name: invalidName, // number instead of string
              port: 8080
            };
            
            const result = provider.validateConfig(invalidConfig);
            
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.field === 'name')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('missing required fields are reported', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (name) => {
            const provider = createConfigProvider({ schema: testSchema });
            
            const incompleteConfig = {
              name: name
              // missing 'port' which is required
            };
            
            const result = provider.validateConfig(incompleteConfig);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'port')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('values outside range are rejected', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 65536, max: 100000 }), // Port out of range
          (name, invalidPort) => {
            const provider = createConfigProvider({ schema: testSchema });
            
            const invalidConfig = {
              name: name,
              port: invalidPort
            };
            
            const result = provider.validateConfig(invalidConfig);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'port')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('valid configurations pass validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 65535 }),
          fc.boolean(),
          fc.array(fc.string({ minLength: 0, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
          (name, port, enabled, tags) => {
            const provider = createConfigProvider({ schema: testSchema });
            
            const validConfig = {
              name,
              port,
              enabled,
              tags
            };
            
            const result = provider.validateConfig(validConfig);
            
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('setAll rejects invalid configuration', () => {
      fc.assert(
        fc.property(
          fc.integer(), // Invalid type for name
          (invalidName) => {
            const provider = createConfigProvider({ schema: testSchema });
            
            const invalidConfig = {
              name: invalidName,
              port: 8080
            };
            
            expect(() => provider.setAll(invalidConfig)).toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 16: Config Inheritance Override**
   * **Validates: Requirements 5.3**
   * 
   * For any base configuration and environment-specific override, the merged
   * configuration should have override values taking precedence over base values
   * for overlapping keys.
   */
  describe('Property 16: Config Inheritance Override', () => {
    test('environment overrides take precedence over base values', () => {
      fc.assert(
        fc.property(
          configObjectArbitrary,
          configObjectArbitrary,
          environmentArbitrary,
          (baseConfig, overrideConfig, environment) => {
            const provider = createConfigProvider({ environment });
            
            // Set base configuration
            provider.setAll(baseConfig);
            
            // Set environment overrides
            provider.setEnvironmentOverrides(environment, overrideConfig);
            
            // Re-apply by setting environment (triggers merge)
            provider.setEnvironment(environment);
            
            // Check that override values take precedence
            for (const key of Object.keys(overrideConfig)) {
              const value = provider.get(key);
              expect(value).toEqual(overrideConfig[key]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('base values are preserved when not overridden', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseOnly: fc.string({ minLength: 1, maxLength: 50 }),
            shared: fc.string({ minLength: 1, maxLength: 50 })
          }),
          fc.record({
            shared: fc.string({ minLength: 1, maxLength: 50 }),
            overrideOnly: fc.string({ minLength: 1, maxLength: 50 })
          }),
          environmentArbitrary,
          (baseConfig, overrideConfig, environment) => {
            const provider = createConfigProvider({ environment });
            
            provider.setAll(baseConfig);
            provider.setEnvironmentOverrides(environment, overrideConfig);
            provider.setEnvironment(environment);
            
            // Base-only value should be preserved
            expect(provider.get('baseOnly')).toEqual(baseConfig.baseOnly);
            
            // Shared value should be overridden
            expect(provider.get('shared')).toEqual(overrideConfig.shared);
            
            // Override-only value should be present
            expect(provider.get('overrideOnly')).toEqual(overrideConfig.overrideOnly);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('nested overrides merge correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            database: fc.record({
              host: fc.string({ minLength: 1, maxLength: 50 }),
              port: fc.integer({ min: 1, max: 65535 }),
              name: fc.string({ minLength: 1, maxLength: 50 })
            })
          }),
          fc.record({
            database: fc.record({
              host: fc.string({ minLength: 1, maxLength: 50 })
              // Only override host, not port or name
            })
          }),
          environmentArbitrary,
          (baseConfig, overrideConfig, environment) => {
            const provider = createConfigProvider({ environment });
            
            provider.setAll(baseConfig);
            provider.setEnvironmentOverrides(environment, overrideConfig);
            provider.setEnvironment(environment);
            
            // Host should be overridden
            expect(provider.get('database.host')).toEqual(overrideConfig.database.host);
            
            // Port and name should be preserved from base
            expect(provider.get('database.port')).toEqual(baseConfig.database.port);
            expect(provider.get('database.name')).toEqual(baseConfig.database.name);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('different environments have independent overrides', () => {
      fc.assert(
        fc.property(
          fc.record({ value: fc.string({ minLength: 1, maxLength: 50 }) }),
          fc.record({ value: fc.string({ minLength: 1, maxLength: 50 }) }),
          fc.record({ value: fc.string({ minLength: 1, maxLength: 50 }) }),
          (baseConfig, devOverride, prodOverride) => {
            const provider = createConfigProvider({ environment: 'development' });
            
            provider.setAll(baseConfig);
            provider.setEnvironmentOverrides('development', devOverride);
            provider.setEnvironmentOverrides('production', prodOverride);
            
            // In development environment
            provider.setEnvironment('development');
            expect(provider.get('value')).toEqual(devOverride.value);
            
            // Switch to production
            provider.setEnvironment('production');
            expect(provider.get('value')).toEqual(prodOverride.value);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 17: Config Change Notification**
   * **Validates: Requirements 5.4**
   * 
   * For any configuration change and set of registered listeners, all listeners
   * should be notified with both the old and new values.
   */
  describe('Property 17: Config Change Notification', () => {
    test('listeners are notified on value change with old and new values', () => {
      fc.assert(
        fc.property(
          keyPathArbitrary,
          simpleValueArbitrary,
          simpleValueArbitrary,
          (key, oldValue, newValue) => {
            const provider = createConfigProvider();
            const notifications = [];
            
            // Set initial value
            provider.set(key, oldValue);
            
            // Register listener
            provider.onChange(key, (newVal, oldVal) => {
              notifications.push({ newVal, oldVal });
            });
            
            // Change value
            provider.set(key, newValue);
            
            // Listener should have been notified
            expect(notifications.length).toBe(1);
            expect(notifications[0].newVal).toEqual(newValue);
            expect(notifications[0].oldVal).toEqual(oldValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple listeners all receive notifications', () => {
      fc.assert(
        fc.property(
          keyPathArbitrary,
          simpleValueArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (key, value, listenerCount) => {
            const provider = createConfigProvider();
            const notifications = [];
            
            // Register multiple listeners
            for (let i = 0; i < listenerCount; i++) {
              const index = i;
              provider.onChange(key, (newVal) => {
                notifications.push({ index, newVal });
              });
            }
            
            // Change value
            provider.set(key, value);
            
            // All listeners should have been notified
            expect(notifications.length).toBe(listenerCount);
            notifications.forEach(n => {
              expect(n.newVal).toEqual(value);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('wildcard listeners receive all changes', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(keyPathArbitrary, simpleValueArbitrary),
            { minLength: 1, maxLength: 5 }
          ),
          (changes) => {
            const provider = createConfigProvider();
            const notifications = [];
            
            // Register wildcard listener
            provider.onChange('*', (newVal) => {
              notifications.push(newVal);
            });
            
            // Make multiple changes
            for (const [key, value] of changes) {
              provider.set(key, value);
            }
            
            // Should have received notification for each change
            expect(notifications.length).toBe(changes.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('unsubscribe prevents future notifications', () => {
      fc.assert(
        fc.property(
          keyPathArbitrary,
          simpleValueArbitrary,
          simpleValueArbitrary,
          (key, value1, value2) => {
            const provider = createConfigProvider();
            const notifications = [];
            
            // Register listener and get unsubscribe function
            const unsubscribe = provider.onChange(key, (newVal) => {
              notifications.push(newVal);
            });
            
            // First change - should notify
            provider.set(key, value1);
            expect(notifications.length).toBe(1);
            
            // Unsubscribe
            unsubscribe();
            
            // Second change - should NOT notify
            provider.set(key, value2);
            expect(notifications.length).toBe(1); // Still 1
          }
        ),
        { numRuns: 100 }
      );
    });

    test('setAll notifies wildcard listeners', () => {
      fc.assert(
        fc.property(
          // Use non-empty configs to ensure meaningful test
          fc.record({
            key1: fc.string({ minLength: 1, maxLength: 20 }),
            key2: fc.integer()
          }),
          fc.record({
            key1: fc.string({ minLength: 1, maxLength: 20 }),
            key2: fc.integer()
          }),
          (config1, config2) => {
            const provider = createConfigProvider();
            const notifications = [];
            
            // Set initial config WITHOUT listener
            provider.setAll(config1);
            
            // Now register listener
            provider.onChange('*', (newVal, oldVal) => {
              notifications.push({ newVal, oldVal });
            });
            
            // Change to second config - should trigger exactly one notification
            provider.setAll(config2);
            
            // Should have exactly one notification
            expect(notifications.length).toBe(1);
            expect(notifications[0].newVal).toEqual(config2);
            expect(notifications[0].oldVal).toEqual(config1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 18: Sensitive Config Encryption**
   * **Validates: Requirements 5.5**
   * 
   * For any sensitive configuration value (API keys, passwords), the value stored
   * at rest should be encrypted and decrypting it should return the original value.
   */
  describe('Property 18: Sensitive Config Encryption', () => {
    const sensitiveSchema = {
      properties: {
        apiKey: { type: 'string', sensitive: true },
        password: { type: 'string', sensitive: true },
        username: { type: 'string' }, // Not sensitive
        database: {
          type: 'object',
          properties: {
            connectionString: { type: 'string', sensitive: true },
            name: { type: 'string' }
          }
        }
      }
    };

    test('sensitive values are encrypted when stored', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (secretValue) => {
            const provider = createConfigProvider({ schema: sensitiveSchema });
            
            // Set a sensitive value
            provider.set('apiKey', secretValue);
            
            // Get the raw stored value (bypass decryption)
            const rawConfig = provider.getAll();
            const storedValue = rawConfig.apiKey;
            
            // Stored value should be encrypted (starts with 'enc:')
            expect(storedValue).toMatch(/^enc:[0-9a-f]{32}:[0-9a-f]+$/i);
            
            // Stored value should NOT equal the original
            expect(storedValue).not.toEqual(secretValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('sensitive values are decrypted when retrieved', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (secretValue) => {
            const provider = createConfigProvider({ schema: sensitiveSchema });
            
            // Set a sensitive value
            provider.set('apiKey', secretValue);
            
            // Get the value (should be decrypted)
            const retrievedValue = provider.get('apiKey');
            
            // Retrieved value should equal the original
            expect(retrievedValue).toEqual(secretValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('encryption round-trip preserves original value', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (apiKey, password) => {
            const provider = createConfigProvider({ schema: sensitiveSchema });
            
            // Set multiple sensitive values
            provider.set('apiKey', apiKey);
            provider.set('password', password);
            
            // Retrieve and verify
            expect(provider.get('apiKey')).toEqual(apiKey);
            expect(provider.get('password')).toEqual(password);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('non-sensitive values are not encrypted', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (username) => {
            const provider = createConfigProvider({ schema: sensitiveSchema });
            
            // Set a non-sensitive value
            provider.set('username', username);
            
            // Get the raw stored value
            const rawConfig = provider.getAll();
            
            // Should NOT be encrypted
            expect(rawConfig.username).toEqual(username);
            expect(rawConfig.username).not.toMatch(/^enc:/);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('nested sensitive values are encrypted', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (connectionString) => {
            const provider = createConfigProvider({ schema: sensitiveSchema });
            
            // Set a nested sensitive value
            provider.set('database.connectionString', connectionString);
            
            // Get the raw stored value
            const rawConfig = provider.getAll();
            const storedValue = rawConfig.database?.connectionString;
            
            // Should be encrypted
            expect(storedValue).toMatch(/^enc:[0-9a-f]{32}:[0-9a-f]+$/i);
            
            // Retrieved value should be decrypted
            expect(provider.get('database.connectionString')).toEqual(connectionString);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('same value encrypted twice produces different ciphertext (IV randomness)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (secretValue) => {
            const provider1 = createConfigProvider({ schema: sensitiveSchema });
            const provider2 = createConfigProvider({ schema: sensitiveSchema });
            
            // Set the same value in both providers
            provider1.set('apiKey', secretValue);
            provider2.set('apiKey', secretValue);
            
            // Get raw stored values
            const stored1 = provider1.getAll().apiKey;
            const stored2 = provider2.getAll().apiKey;
            
            // Both should be encrypted
            expect(stored1).toMatch(/^enc:/);
            expect(stored2).toMatch(/^enc:/);
            
            // But ciphertext should be different (due to random IV)
            expect(stored1).not.toEqual(stored2);
            
            // Both should decrypt to the same value
            expect(provider1.get('apiKey')).toEqual(secretValue);
            expect(provider2.get('apiKey')).toEqual(secretValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('prettyPrint masks sensitive values', () => {
      fc.assert(
        fc.property(
          // Use UUID-like strings to ensure uniqueness and no substring overlap
          fc.uuid(),
          fc.uuid(),
          (apiKey, username) => {
            // Ensure they are different and neither is substring of the other
            fc.pre(apiKey !== username);
            fc.pre(!apiKey.includes(username) && !username.includes(apiKey));
            
            const provider = createConfigProvider({ schema: sensitiveSchema });
            
            provider.set('apiKey', apiKey);
            provider.set('username', username);
            
            const output = provider.prettyPrint();
            
            // Sensitive value should be masked (not appear in output)
            expect(output).not.toContain(apiKey);
            expect(output).toContain('********');
            
            // Non-sensitive value should be visible
            expect(output).toContain(username);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
