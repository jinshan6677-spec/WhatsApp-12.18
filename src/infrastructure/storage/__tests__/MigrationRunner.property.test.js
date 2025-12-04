'use strict';

/**
 * Property-based tests for Migration Runner implementation
 * 
 * Tests the following property:
 * - Property 13: Migration Rollback
 * 
 * **Feature: architecture-refactoring, Property 13: Migration Rollback**
 * **Validates: Requirements 4.5**
 * 
 * For any data migration, applying the migration and then rolling it back
 * should restore the data to its original state.
 */

const fc = require('fast-check');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const MigrationRunner = require('../MigrationRunner');

describe('MigrationRunner Property Tests', () => {
  let testDir;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `migration-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  // ==================== Arbitraries ====================

  /**
   * Generates a valid semantic version string
   */
  const versionArbitrary = fc.tuple(
    fc.integer({ min: 0, max: 10 }),
    fc.integer({ min: 0, max: 10 }),
    fc.integer({ min: 0, max: 10 })
  ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

  /**
   * Generates a simple data object for migration context
   */
  const dataArbitrary = fc.record({
    users: fc.array(fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      email: fc.emailAddress()
    }), { minLength: 0, maxLength: 5 }),
    settings: fc.record({
      theme: fc.constantFrom('light', 'dark', 'system'),
      language: fc.constantFrom('en', 'zh', 'es', 'fr'),
      notifications: fc.boolean()
    }),
    version: fc.integer({ min: 1, max: 100 })
  });


  /**
   * Creates a reversible migration that transforms data
   * @param {string} version - Migration version
   * @param {function} upTransform - Transform function for up migration
   * @param {function} downTransform - Transform function for down migration
   * @returns {Object} Migration object
   */
  function createReversibleMigration(version, upTransform, downTransform) {
    return {
      version,
      description: `Migration ${version}`,
      up: async (context) => {
        return upTransform(context);
      },
      down: async (context) => {
        return downTransform(context);
      }
    };
  }

  /**
   * **Feature: architecture-refactoring, Property 13: Migration Rollback**
   * **Validates: Requirements 4.5**
   */
  describe('Property 13: Migration Rollback', () => {
    
    test('single migration up then down restores original state', async () => {
      await fc.assert(
        fc.asyncProperty(dataArbitrary, async (originalData) => {
          const runner = new MigrationRunner({
            storagePath: testDir,
            versionFile: `version-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
          });

          // Create a reversible migration that adds a field
          const migration = createReversibleMigration(
            '1.0.0',
            (ctx) => ({
              ...ctx,
              migrated: true,
              migratedAt: Date.now()
            }),
            (ctx) => {
              const { migrated, migratedAt, ...rest } = ctx;
              return rest;
            }
          );

          runner.register(migration);

          // Apply migration
          const upResult = await runner.migrateUp({ ...originalData });
          expect(upResult.success).toBe(true);
          expect(upResult.context.migrated).toBe(true);

          // Rollback
          const downResult = await runner.rollbackLast(upResult.context);
          expect(downResult.success).toBe(true);

          // Verify original state is restored
          const restoredData = downResult.context;
          expect(restoredData.migrated).toBeUndefined();
          expect(restoredData.migratedAt).toBeUndefined();
          expect(restoredData.users).toEqual(originalData.users);
          expect(restoredData.settings).toEqual(originalData.settings);
          expect(restoredData.version).toBe(originalData.version);
        }),
        { numRuns: 50 }
      );
    });

    test('multiple migrations up then rollback all restores original state', async () => {
      await fc.assert(
        fc.asyncProperty(dataArbitrary, async (originalData) => {
          const runner = new MigrationRunner({
            storagePath: testDir,
            versionFile: `version-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
          });

          // Create multiple reversible migrations
          const migrations = [
            createReversibleMigration(
              '1.0.0',
              (ctx) => ({ ...ctx, v1Applied: true }),
              (ctx) => { const { v1Applied, ...rest } = ctx; return rest; }
            ),
            createReversibleMigration(
              '2.0.0',
              (ctx) => ({ ...ctx, v2Applied: true }),
              (ctx) => { const { v2Applied, ...rest } = ctx; return rest; }
            ),
            createReversibleMigration(
              '3.0.0',
              (ctx) => ({ ...ctx, v3Applied: true }),
              (ctx) => { const { v3Applied, ...rest } = ctx; return rest; }
            )
          ];

          for (const m of migrations) {
            runner.register(m);
          }

          // Apply all migrations
          const upResult = await runner.migrateUp({ ...originalData });
          expect(upResult.success).toBe(true);
          expect(upResult.migrationsRun).toBe(3);
          expect(upResult.context.v1Applied).toBe(true);
          expect(upResult.context.v2Applied).toBe(true);
          expect(upResult.context.v3Applied).toBe(true);

          // Rollback all
          const downResult = await runner.rollbackAll(upResult.context);
          expect(downResult.success).toBe(true);
          expect(downResult.migrationsRun).toBe(3);

          // Verify original state is restored
          const restoredData = downResult.context;
          expect(restoredData.v1Applied).toBeUndefined();
          expect(restoredData.v2Applied).toBeUndefined();
          expect(restoredData.v3Applied).toBeUndefined();
          expect(restoredData.users).toEqual(originalData.users);
          expect(restoredData.settings).toEqual(originalData.settings);
        }),
        { numRuns: 50 }
      );
    });


    test('migrate to version then rollback to previous version restores state', async () => {
      await fc.assert(
        fc.asyncProperty(dataArbitrary, async (originalData) => {
          const runner = new MigrationRunner({
            storagePath: testDir,
            versionFile: `version-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
          });

          // Create migrations
          const migrations = [
            createReversibleMigration(
              '1.0.0',
              (ctx) => ({ ...ctx, step1: 'applied' }),
              (ctx) => { const { step1, ...rest } = ctx; return rest; }
            ),
            createReversibleMigration(
              '2.0.0',
              (ctx) => ({ ...ctx, step2: 'applied' }),
              (ctx) => { const { step2, ...rest } = ctx; return rest; }
            )
          ];

          for (const m of migrations) {
            runner.register(m);
          }

          // Migrate to version 2.0.0
          const upResult = await runner.migrateTo('2.0.0', { ...originalData });
          expect(upResult.success).toBe(true);
          expect(upResult.context.step1).toBe('applied');
          expect(upResult.context.step2).toBe('applied');

          // Rollback to version 1.0.0
          const downResult = await runner.migrateTo('1.0.0', upResult.context);
          expect(downResult.success).toBe(true);

          // Verify step2 is removed but step1 remains
          expect(downResult.context.step1).toBe('applied');
          expect(downResult.context.step2).toBeUndefined();
          expect(downResult.context.users).toEqual(originalData.users);
        }),
        { numRuns: 50 }
      );
    });

    test('snapshot preserves data for rollback', async () => {
      await fc.assert(
        fc.asyncProperty(dataArbitrary, async (originalData) => {
          const runner = new MigrationRunner({
            storagePath: testDir,
            versionFile: `version-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
          });

          // Take snapshot
          const snapshot = runner.takeSnapshot(originalData);

          // Modify data
          const modifiedData = {
            ...originalData,
            users: [...originalData.users, { id: 'new', name: 'New User', email: 'new@test.com' }],
            settings: { ...originalData.settings, theme: 'modified' }
          };

          // Restore from snapshot
          const restored = runner.restoreFromSnapshot(snapshot);

          // Verify restored data matches original
          expect(restored.users).toEqual(originalData.users);
          expect(restored.settings).toEqual(originalData.settings);
          expect(restored.version).toBe(originalData.version);

          // Verify snapshot is independent (deep clone)
          expect(restored).not.toBe(originalData);
          if (restored.users.length > 0) {
            expect(restored.users[0]).not.toBe(originalData.users[0]);
          }
        }),
        { numRuns: 50 }
      );
    });

    test('rollback last with no migrations is idempotent', async () => {
      await fc.assert(
        fc.asyncProperty(dataArbitrary, async (originalData) => {
          const runner = new MigrationRunner({
            storagePath: testDir,
            versionFile: `version-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
          });

          // Rollback with no migrations applied
          const result = await runner.rollbackLast({ ...originalData });

          expect(result.success).toBe(true);
          expect(result.migrationsRun).toBe(0);
          expect(result.context).toEqual(originalData);
        }),
        { numRuns: 50 }
      );
    });

    test('data transformation is reversible for complex operations', async () => {
      await fc.assert(
        fc.asyncProperty(dataArbitrary, async (originalData) => {
          const runner = new MigrationRunner({
            storagePath: testDir,
            versionFile: `version-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
          });

          // Create a migration that transforms user data structure
          const migration = createReversibleMigration(
            '1.0.0',
            (ctx) => ({
              ...ctx,
              users: ctx.users.map(u => ({
                ...u,
                displayName: u.name.toUpperCase(),
                originalName: u.name
              }))
            }),
            (ctx) => ({
              ...ctx,
              users: ctx.users.map(u => {
                const { displayName, originalName, ...rest } = u;
                return { ...rest, name: originalName || rest.name };
              })
            })
          );

          runner.register(migration);

          // Apply migration
          const upResult = await runner.migrateUp({ ...originalData });
          expect(upResult.success).toBe(true);

          // Verify transformation
          for (let i = 0; i < originalData.users.length; i++) {
            expect(upResult.context.users[i].displayName).toBe(originalData.users[i].name.toUpperCase());
            expect(upResult.context.users[i].originalName).toBe(originalData.users[i].name);
          }

          // Rollback
          const downResult = await runner.rollbackLast(upResult.context);
          expect(downResult.success).toBe(true);

          // Verify original structure is restored
          for (let i = 0; i < originalData.users.length; i++) {
            expect(downResult.context.users[i].name).toBe(originalData.users[i].name);
            expect(downResult.context.users[i].displayName).toBeUndefined();
            expect(downResult.context.users[i].originalName).toBeUndefined();
          }
        }),
        { numRuns: 50 }
      );
    });
  });


  // ==================== Additional Tests ====================

  describe('Migration Registration and Validation', () => {
    test('invalid migration without version throws error', () => {
      const runner = new MigrationRunner({ storagePath: testDir });

      expect(() => runner.register({
        up: async () => {},
        down: async () => {}
      })).toThrow('valid version');
    });

    test('invalid migration without up function throws error', () => {
      const runner = new MigrationRunner({ storagePath: testDir });

      expect(() => runner.register({
        version: '1.0.0',
        down: async () => {}
      })).toThrow('up()');
    });

    test('invalid migration without down function throws error', () => {
      const runner = new MigrationRunner({ storagePath: testDir });

      expect(() => runner.register({
        version: '1.0.0',
        up: async () => {}
      })).toThrow('down()');
    });

    test('duplicate version registration throws error', () => {
      const runner = new MigrationRunner({ storagePath: testDir });

      runner.register({
        version: '1.0.0',
        up: async () => {},
        down: async () => {}
      });

      expect(() => runner.register({
        version: '1.0.0',
        up: async () => {},
        down: async () => {}
      })).toThrow('already registered');
    });

    test('migrations are sorted by version', () => {
      const runner = new MigrationRunner({ storagePath: testDir });

      runner.register({ version: '2.0.0', up: async () => {}, down: async () => {} });
      runner.register({ version: '1.0.0', up: async () => {}, down: async () => {} });
      runner.register({ version: '1.5.0', up: async () => {}, down: async () => {} });
      runner.register({ version: '10.0.0', up: async () => {}, down: async () => {} });

      const migrations = runner.getMigrations();
      expect(migrations.map(m => m.version)).toEqual(['1.0.0', '1.5.0', '2.0.0', '10.0.0']);
    });
  });

  describe('Version Management', () => {
    test('getCurrentVersion returns null for fresh runner', async () => {
      const runner = new MigrationRunner({
        storagePath: testDir,
        versionFile: `version-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
      });

      const version = await runner.getCurrentVersion();
      expect(version).toBeNull();
    });

    test('getPendingMigrations returns all migrations when no version set', async () => {
      const runner = new MigrationRunner({
        storagePath: testDir,
        versionFile: `version-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
      });

      runner.register({ version: '1.0.0', up: async () => {}, down: async () => {} });
      runner.register({ version: '2.0.0', up: async () => {}, down: async () => {} });

      const pending = await runner.getPendingMigrations();
      expect(pending.length).toBe(2);
    });

    test('migrateTo non-existent version throws error', async () => {
      const runner = new MigrationRunner({
        storagePath: testDir,
        versionFile: `version-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
      });

      runner.register({ version: '1.0.0', up: async () => {}, down: async () => {} });

      await expect(runner.migrateTo('9.9.9', {})).rejects.toThrow('not found');
    });
  });

  describe('Serialization', () => {
    test('serialize and deserialize preserves state', async () => {
      const runner = new MigrationRunner({
        storagePath: testDir,
        versionFile: `version-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
      });

      runner.register({
        version: '1.0.0',
        up: async (ctx) => ({ ...ctx, migrated: true }),
        down: async (ctx) => { const { migrated, ...rest } = ctx; return rest; }
      });

      // Run migration to create history
      await runner.migrateUp({ data: 'test' });

      // Serialize
      const serialized = runner.serialize();
      expect(typeof serialized).toBe('string');

      // Create new runner and deserialize
      const runner2 = new MigrationRunner({ storagePath: testDir });
      runner2.deserialize(serialized);

      // Verify history is preserved
      const history = runner2.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].version).toBe('1.0.0');
      expect(history[0].direction).toBe('up');
    });
  });
});
