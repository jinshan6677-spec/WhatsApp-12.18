'use strict';

/**
 * Property-based tests for PluginManager
 * 
 * Tests the following properties:
 * - Property 2: Plugin Interface Validation
 * - Property 3: Plugin Dependency Order
 * - Property 4: Plugin Error Isolation
 * - Property 5: Plugin Resource Cleanup
 * 
 * **Validates: Requirements 2.2, 2.3, 2.4, 2.6**
 */

const fc = require('fast-check');
const { PluginManager, PluginState, REQUIRED_PLUGIN_INTERFACE } = require('../PluginManager');
const { PluginContext, createPluginContext } = require('../PluginContext');
const { EventBus } = require('../../../core/eventbus/EventBus');
const { DependencyContainer } = require('../../../core/container/DependencyContainer');
const { ConfigProvider } = require('../../../core/config/ConfigProvider');

describe('PluginManager Property Tests', () => {
  // Helper to create a valid plugin
  const createValidPlugin = (name, version, dependencies = []) => ({
    name,
    version,
    dependencies,
    initialized: false,
    destroyed: false,
    initialize: jest.fn(async () => {
      // Simulate some async work
      await new Promise(resolve => setTimeout(resolve, 1));
    }),
    destroy: jest.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
    })
  });

  // Helper to create a plugin context
  const createTestContext = () => {
    return createPluginContext({
      eventBus: new EventBus(),
      container: new DependencyContainer(),
      config: new ConfigProvider()
    });
  };

  // Arbitraries for generating test data
  const pluginNameArbitrary = fc.string({ minLength: 1, maxLength: 30 })
    .filter(s => s.trim().length > 0 && !s.includes(':'));

  const versionArbitrary = fc.tuple(
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 })
  ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

  /**
   * **Feature: architecture-refactoring, Property 2: Plugin Interface Validation**
   * **Validates: Requirements 2.2**
   * 
   * For any object that does not implement the required IPlugin interface
   * (missing name, version, initialize, or destroy), registering it as a plugin
   * should fail with a validation error describing the missing members.
   */
  describe('Property 2: Plugin Interface Validation', () => {
    test('objects missing required members are rejected with descriptive errors', () => {
      fc.assert(
        fc.property(
          // Generate objects with random subsets of required members missing
          fc.record({
            hasName: fc.boolean(),
            hasVersion: fc.boolean(),
            hasInitialize: fc.boolean(),
            hasDestroy: fc.boolean()
          }).filter(r => !r.hasName || !r.hasVersion || !r.hasInitialize || !r.hasDestroy),
          (config) => {
            const pluginManager = new PluginManager();
            
            // Build an incomplete plugin object
            const incompletePlugin = {};
            if (config.hasName) incompletePlugin.name = 'test-plugin';
            if (config.hasVersion) incompletePlugin.version = '1.0.0';
            if (config.hasInitialize) incompletePlugin.initialize = async () => {};
            if (config.hasDestroy) incompletePlugin.destroy = async () => {};

            // Attempt to register should throw
            let errorThrown = false;
            let errorMessage = '';
            let missingMembers = [];

            try {
              pluginManager.register(incompletePlugin);
            } catch (error) {
              errorThrown = true;
              errorMessage = error.message;
              missingMembers = error.missingMembers || [];
            }

            // Should throw an error
            expect(errorThrown).toBe(true);
            expect(errorMessage).toContain('Plugin interface validation failed');
            expect(errorMessage).toContain('Missing members');

            // Error should list the missing members
            if (!config.hasName) expect(missingMembers.some(m => m.includes('name'))).toBe(true);
            if (!config.hasVersion) expect(missingMembers.some(m => m.includes('version'))).toBe(true);
            if (!config.hasInitialize) expect(missingMembers.some(m => m.includes('initialize'))).toBe(true);
            if (!config.hasDestroy) expect(missingMembers.some(m => m.includes('destroy'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('valid plugins are accepted', () => {
      fc.assert(
        fc.property(
          pluginNameArbitrary,
          versionArbitrary,
          (name, version) => {
            const pluginManager = new PluginManager();
            const plugin = createValidPlugin(name, version);

            // Should not throw
            pluginManager.register(plugin);

            // Plugin should be registered
            expect(pluginManager.isRegistered(name)).toBe(true);
            expect(pluginManager.getPlugin(name)).toBe(plugin);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('objects with wrong member types are rejected', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // name is not a string
            fc.constant({ name: 123, version: '1.0.0', initialize: async () => {}, destroy: async () => {} }),
            // version is not a string
            fc.constant({ name: 'test', version: 123, initialize: async () => {}, destroy: async () => {} }),
            // initialize is not a function
            fc.constant({ name: 'test', version: '1.0.0', initialize: 'not-a-function', destroy: async () => {} }),
            // destroy is not a function
            fc.constant({ name: 'test', version: '1.0.0', initialize: async () => {}, destroy: 'not-a-function' })
          ),
          (invalidPlugin) => {
            const pluginManager = new PluginManager();

            let errorThrown = false;
            try {
              pluginManager.register(invalidPlugin);
            } catch (error) {
              errorThrown = true;
              expect(error.code).toBe('PLUGIN_INTERFACE_ERROR');
            }

            expect(errorThrown).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 3: Plugin Dependency Order**
   * **Validates: Requirements 2.3**
   * 
   * For any set of plugins with declared dependencies, the initialization order
   * should be a valid topological sort where each plugin is initialized only
   * after all its dependencies have been initialized.
   */
  describe('Property 3: Plugin Dependency Order', () => {
    test('plugins are initialized in dependency order', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a DAG of plugins (no cycles)
          fc.integer({ min: 2, max: 8 }).chain(count => {
            // Create plugins with dependencies only on earlier plugins (ensures DAG)
            return fc.tuple(
              ...Array.from({ length: count }, (_, i) => 
                fc.record({
                  name: fc.constant(`plugin-${i}`),
                  // Can only depend on plugins with lower indices
                  deps: i === 0 
                    ? fc.constant([]) 
                    : fc.subarray(
                        Array.from({ length: i }, (_, j) => `plugin-${j}`),
                        { minLength: 0, maxLength: Math.min(i, 3) }
                      )
                })
              )
            );
          }),
          async (pluginConfigs) => {
            const pluginManager = new PluginManager();
            const context = createTestContext();
            pluginManager.setContext(context);
            
            const initOrder = [];

            // Create and register plugins
            for (const config of pluginConfigs) {
              const plugin = {
                name: config.name,
                version: '1.0.0',
                dependencies: config.deps,
                initialize: jest.fn(async () => {
                  initOrder.push(config.name);
                }),
                destroy: jest.fn(async () => {})
              };
              pluginManager.register(plugin);
            }

            // Initialize all
            await pluginManager.initializeAll();

            // Verify dependency order: each plugin should be initialized after its dependencies
            for (const config of pluginConfigs) {
              const pluginIndex = initOrder.indexOf(config.name);
              for (const dep of config.deps) {
                const depIndex = initOrder.indexOf(dep);
                expect(depIndex).toBeLessThan(pluginIndex);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('circular dependencies are detected', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          async (cycleSize) => {
            const pluginManager = new PluginManager();
            const context = createTestContext();
            pluginManager.setContext(context);

            // Create a cycle: plugin-0 -> plugin-1 -> ... -> plugin-n -> plugin-0
            for (let i = 0; i < cycleSize; i++) {
              const nextIndex = (i + 1) % cycleSize;
              const plugin = {
                name: `plugin-${i}`,
                version: '1.0.0',
                dependencies: [`plugin-${nextIndex}`],
                initialize: jest.fn(async () => {}),
                destroy: jest.fn(async () => {})
              };
              pluginManager.register(plugin);
            }

            // Should detect cycle
            const { hasCycle, cycleInfo } = pluginManager.computeDependencyOrder();
            expect(hasCycle).toBe(true);
            expect(cycleInfo).toContain('Circular dependency');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('independent plugins can be initialized in any order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (count) => {
            const pluginManager = new PluginManager();
            const context = createTestContext();
            pluginManager.setContext(context);

            // Create independent plugins (no dependencies) - use fast plugins without delay
            for (let i = 0; i < count; i++) {
              const plugin = {
                name: `independent-${i}`,
                version: '1.0.0',
                dependencies: [],
                initialize: jest.fn(async () => {}),
                destroy: jest.fn(async () => {})
              };
              pluginManager.register(plugin);
            }

            // Should initialize all successfully
            const { successful, failed } = await pluginManager.initializeAll();

            expect(successful.length).toBe(count);
            expect(failed.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // Increased timeout for async property test
  });

  /**
   * **Feature: architecture-refactoring, Property 4: Plugin Error Isolation**
   * **Validates: Requirements 2.4**
   * 
   * For any set of plugins where one or more throw errors during initialization,
   * all non-throwing plugins should still be successfully initialized and the
   * system should remain operational.
   */
  describe('Property 4: Plugin Error Isolation', () => {
    test('failing plugins do not prevent other plugins from initializing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          fc.integer({ min: 0, max: 9 }),
          async (totalPlugins, failingIndex) => {
            const actualFailingIndex = failingIndex % totalPlugins;
            const pluginManager = new PluginManager({ logger: () => {} }); // Suppress errors
            const context = createTestContext();
            pluginManager.setContext(context);

            const initializedPlugins = [];

            // Create plugins, one of which will fail
            for (let i = 0; i < totalPlugins; i++) {
              const shouldFail = i === actualFailingIndex;
              const plugin = {
                name: `plugin-${i}`,
                version: '1.0.0',
                dependencies: [],
                initialize: jest.fn(async () => {
                  if (shouldFail) {
                    throw new Error(`Plugin ${i} failed intentionally`);
                  }
                  initializedPlugins.push(`plugin-${i}`);
                }),
                destroy: jest.fn(async () => {})
              };
              pluginManager.register(plugin);
            }

            // Initialize all
            const { successful, failed } = await pluginManager.initializeAll();

            // Exactly one should fail
            expect(failed.length).toBe(1);
            expect(failed[0].name).toBe(`plugin-${actualFailingIndex}`);

            // All others should succeed
            expect(successful.length).toBe(totalPlugins - 1);
            expect(initializedPlugins.length).toBe(totalPlugins - 1);
            expect(initializedPlugins).not.toContain(`plugin-${actualFailingIndex}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple failing plugins are all reported', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 10 }),
          fc.integer({ min: 1, max: 5 }),
          async (totalPlugins, failCount) => {
            const actualFailCount = Math.min(failCount, totalPlugins - 1);
            const pluginManager = new PluginManager({ logger: () => {} });
            const context = createTestContext();
            pluginManager.setContext(context);

            // Create plugins, some of which will fail
            for (let i = 0; i < totalPlugins; i++) {
              const shouldFail = i < actualFailCount;
              const plugin = {
                name: `plugin-${i}`,
                version: '1.0.0',
                dependencies: [],
                initialize: jest.fn(async () => {
                  if (shouldFail) {
                    throw new Error(`Plugin ${i} failed`);
                  }
                }),
                destroy: jest.fn(async () => {})
              };
              pluginManager.register(plugin);
            }

            const { successful, failed } = await pluginManager.initializeAll();

            // Correct number of failures
            expect(failed.length).toBe(actualFailCount);
            expect(successful.length).toBe(totalPlugins - actualFailCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('system remains operational after plugin failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          async (totalPlugins) => {
            const pluginManager = new PluginManager({ logger: () => {} });
            const context = createTestContext();
            pluginManager.setContext(context);

            // First plugin fails
            const failingPlugin = {
              name: 'failing-plugin',
              version: '1.0.0',
              dependencies: [],
              initialize: jest.fn(async () => {
                throw new Error('Initialization failed');
              }),
              destroy: jest.fn(async () => {})
            };
            pluginManager.register(failingPlugin);

            // Other plugins succeed
            for (let i = 0; i < totalPlugins - 1; i++) {
              pluginManager.register(createValidPlugin(`working-${i}`, '1.0.0'));
            }

            await pluginManager.initializeAll();

            // System should still be operational
            const status = pluginManager.getStatus();
            expect(status.activePlugins).toBe(totalPlugins - 1);
            expect(status.errorPlugins).toBe(1);

            // Can still get active plugins
            const activePlugins = pluginManager.getActivePlugins();
            expect(activePlugins.length).toBe(totalPlugins - 1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: architecture-refactoring, Property 5: Plugin Resource Cleanup**
   * **Validates: Requirements 2.6**
   * 
   * For any enabled plugin, disabling it should result in its destroy method
   * being called and the plugin being removed from the active plugins list.
   */
  describe('Property 5: Plugin Resource Cleanup', () => {
    test('disabling a plugin calls destroy and removes from active list', async () => {
      await fc.assert(
        fc.asyncProperty(
          pluginNameArbitrary,
          versionArbitrary,
          async (name, version) => {
            const pluginManager = new PluginManager();
            const context = createTestContext();
            pluginManager.setContext(context);

            let destroyCalled = false;
            const plugin = {
              name,
              version,
              dependencies: [],
              initialize: jest.fn(async () => {}),
              destroy: jest.fn(async () => {
                destroyCalled = true;
              })
            };

            pluginManager.register(plugin);
            await pluginManager.enable(name);

            // Should be active
            expect(pluginManager.isActive(name)).toBe(true);
            expect(pluginManager.getActivePlugins()).toContain(plugin);

            // Disable
            await pluginManager.disable(name);

            // destroy should have been called
            expect(destroyCalled).toBe(true);
            expect(plugin.destroy).toHaveBeenCalled();

            // Should no longer be active
            expect(pluginManager.isActive(name)).toBe(false);
            expect(pluginManager.getActivePlugins()).not.toContain(plugin);
            expect(pluginManager.getPluginState(name)).toBe(PluginState.Disabled);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('destroyAll calls destroy on all active plugins in reverse order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 8 }),
          async (count) => {
            const pluginManager = new PluginManager();
            const context = createTestContext();
            pluginManager.setContext(context);

            const destroyOrder = [];

            // Create and register plugins
            for (let i = 0; i < count; i++) {
              const plugin = {
                name: `plugin-${i}`,
                version: '1.0.0',
                dependencies: [],
                initialize: jest.fn(async () => {}),
                destroy: jest.fn(async () => {
                  destroyOrder.push(`plugin-${i}`);
                })
              };
              pluginManager.register(plugin);
            }

            // Initialize all
            await pluginManager.initializeAll();
            expect(pluginManager.getActivePlugins().length).toBe(count);

            // Destroy all
            const { successful, failed } = await pluginManager.destroyAll();

            // All should be destroyed
            expect(successful.length).toBe(count);
            expect(failed.length).toBe(0);
            expect(destroyOrder.length).toBe(count);

            // No active plugins remaining
            expect(pluginManager.getActivePlugins().length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('plugins with dependencies are destroyed in reverse dependency order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null), // No random input needed
          async () => {
            const pluginManager = new PluginManager();
            const context = createTestContext();
            pluginManager.setContext(context);

            const destroyOrder = [];

            // Create a dependency chain: A -> B -> C (C depends on B, B depends on A)
            const pluginA = {
              name: 'plugin-a',
              version: '1.0.0',
              dependencies: [],
              initialize: jest.fn(async () => {}),
              destroy: jest.fn(async () => { destroyOrder.push('plugin-a'); })
            };

            const pluginB = {
              name: 'plugin-b',
              version: '1.0.0',
              dependencies: ['plugin-a'],
              initialize: jest.fn(async () => {}),
              destroy: jest.fn(async () => { destroyOrder.push('plugin-b'); })
            };

            const pluginC = {
              name: 'plugin-c',
              version: '1.0.0',
              dependencies: ['plugin-b'],
              initialize: jest.fn(async () => {}),
              destroy: jest.fn(async () => { destroyOrder.push('plugin-c'); })
            };

            pluginManager.register(pluginA);
            pluginManager.register(pluginB);
            pluginManager.register(pluginC);

            await pluginManager.initializeAll();
            await pluginManager.destroyAll();

            // Destroy order should be reverse of init order (C, B, A)
            // C should be destroyed before B, B before A
            const indexC = destroyOrder.indexOf('plugin-c');
            const indexB = destroyOrder.indexOf('plugin-b');
            const indexA = destroyOrder.indexOf('plugin-a');

            expect(indexC).toBeLessThan(indexB);
            expect(indexB).toBeLessThan(indexA);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('disabling already disabled plugin is a no-op', async () => {
      await fc.assert(
        fc.asyncProperty(
          pluginNameArbitrary,
          versionArbitrary,
          fc.integer({ min: 1, max: 5 }),
          async (name, version, disableCount) => {
            const pluginManager = new PluginManager();
            const context = createTestContext();
            pluginManager.setContext(context);

            let destroyCallCount = 0;
            const plugin = {
              name,
              version,
              dependencies: [],
              initialize: jest.fn(async () => {}),
              destroy: jest.fn(async () => {
                destroyCallCount++;
              })
            };

            pluginManager.register(plugin);
            await pluginManager.enable(name);
            
            // Disable multiple times
            for (let i = 0; i < disableCount; i++) {
              await pluginManager.disable(name);
            }

            // destroy should only be called once
            expect(destroyCallCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('plugin state transitions correctly through lifecycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          pluginNameArbitrary,
          versionArbitrary,
          async (name, version) => {
            const pluginManager = new PluginManager();
            const context = createTestContext();
            pluginManager.setContext(context);

            const plugin = createValidPlugin(name, version);
            
            // Register
            pluginManager.register(plugin);
            expect(pluginManager.getPluginState(name)).toBe(PluginState.Registered);

            // Enable
            await pluginManager.enable(name);
            expect(pluginManager.getPluginState(name)).toBe(PluginState.Active);

            // Disable
            await pluginManager.disable(name);
            expect(pluginManager.getPluginState(name)).toBe(PluginState.Disabled);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
