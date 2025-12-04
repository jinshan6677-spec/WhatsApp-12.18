'use strict';

/**
 * Property-based tests for Unit of Work implementation
 * 
 * Tests the following property:
 * - Property 11: Unit of Work Atomicity
 * 
 * **Feature: architecture-refactoring, Property 11: Unit of Work Atomicity**
 * **Validates: Requirements 4.3**
 * 
 * For any unit of work containing multiple repository operations, either all
 * operations should succeed and be persisted, or all should be rolled back
 * leaving the data unchanged.
 */

const fc = require('fast-check');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const UnitOfWork = require('../UnitOfWork');
const AccountRepository = require('../AccountRepository');
const Account = require('../../../domain/entities/Account');

describe('UnitOfWork Property Tests', () => {
  let testDir;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `uow-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

  const dateArbitrary = fc.integer({
    min: new Date('2020-01-01').getTime(),
    max: new Date('2030-12-31').getTime()
  }).map(ts => new Date(ts));

  // Generate valid account names (non-empty after trimming)
  const validNameArbitrary = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => s.trim().length > 0);

  // Generate valid session directory names (non-empty after trimming)
  const validSessionDirArbitrary = fc.string({ minLength: 1, maxLength: 30 })
    .filter(s => s.trim().length > 0)
    .map(s => `session-data/${s.replace(/[/\\]/g, '_')}`);

  const validAccountArbitrary = fc.record({
    id: fc.uuid(),
    name: validNameArbitrary,
    status: fc.constantFrom('inactive', 'loading', 'active', 'error'),
    autoStart: fc.boolean(),
    createdAt: dateArbitrary,
    sessionDir: validSessionDirArbitrary,
    order: fc.integer({ min: 0, max: 100 })
  });

  


  /**
   * **Feature: architecture-refactoring, Property 11: Unit of Work Atomicity**
   * **Validates: Requirements 4.3**
   */
  describe('Property 11: Unit of Work Atomicity', () => {
    
    

    test('failed operation rolls back all changes', async () => {
      const testCases = fc.sample(fc.tuple(
        fc.array(validAccountArbitrary, { minLength: 1, maxLength: 2 }),
        validAccountArbitrary
      ), 10);

      for (const [validAccountsData, invalidAccountData] of testCases) {
        // Create fresh repositories
        const accountRepo = new AccountRepository({
          storagePath: testDir,
          fileName: `accounts-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
          cacheTTL: 0
        });

        // Pre-populate with some data
        const initialAccount = new Account({
          id: 'initial-account',
          name: 'Initial Account',
          sessionDir: 'session-data/initial'
        });
        await accountRepo.save(initialAccount);

        // Create unit of work
        const uow = new UnitOfWork();
        uow.registerRepository('accounts', accountRepo);

        // Schedule valid operations
        const validAccounts = validAccountsData.map(d => new Account(d));
        for (const account of validAccounts) {
          uow.scheduleSave('accounts', account);
        }

        // Schedule an invalid operation (empty name)
        const invalidAccount = new Account(invalidAccountData);
        invalidAccount.name = ''; // Make it invalid
        uow.scheduleSave('accounts', invalidAccount);

        // Commit should fail
        const result = await uow.commit();

        // Verify failure
        expect(result.success).toBe(false);
        expect(uow.isRolledBack()).toBe(true);

        // Verify rollback - only initial account should exist
        const savedAccounts = await accountRepo.findAll();
        expect(savedAccounts.length).toBe(1);
        expect(savedAccounts[0].id).toBe('initial-account');
      }
    });

    test('rollback restores original state', async () => {
      const testCases = fc.sample(fc.tuple(
        fc.array(validAccountArbitrary, { minLength: 1, maxLength: 2 }),
        fc.array(validAccountArbitrary, { minLength: 1, maxLength: 2 })
      ), 10);

      for (const [initialData, newData] of testCases) {
        // Create fresh repository
        const accountRepo = new AccountRepository({
          storagePath: testDir,
          fileName: `accounts-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
          cacheTTL: 0
        });

        // Pre-populate with initial data
        const initialAccounts = initialData.map(d => new Account(d));
        for (const account of initialAccounts) {
          await accountRepo.save(account);
        }

        // Capture initial state
        const initialState = (await accountRepo.findAll()).map(a => a.toJSON());

        // Create unit of work
        const uow = new UnitOfWork();
        uow.registerRepository('accounts', accountRepo);

        // Schedule new operations
        const newAccounts = newData.map(d => new Account(d));
        for (const account of newAccounts) {
          uow.scheduleSave('accounts', account);
        }

        // Take snapshots (simulating what commit does)
        await uow.commit();

        // If commit succeeded, we can't test rollback
        // So let's create a new UoW that will fail
        const uow2 = new UnitOfWork();
        uow2.registerRepository('accounts', accountRepo);

        // Schedule a delete and an invalid save
        if (initialAccounts.length > 0) {
          uow2.scheduleDelete('accounts', initialAccounts[0].id);
        }
        const invalidAccount = new Account({ name: 'test', sessionDir: 'test' });
        invalidAccount.name = ''; // Make invalid
        uow2.scheduleSave('accounts', invalidAccount);

        // This should fail and rollback
        const result2 = await uow2.commit();
        expect(result2.success).toBe(false);

        // State should be restored to before uow2 started
        const finalAccounts = await accountRepo.findAll();
        
        // The number of accounts should match what was there before uow2
        // (which includes both initial and new accounts from uow1)
        expect(finalAccounts.length).toBe(initialAccounts.length + newAccounts.length);
      }
    });

    test('empty unit of work commits successfully', async () => {
      const accountRepo = new AccountRepository({
        storagePath: testDir,
        fileName: `accounts-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
        cacheTTL: 0
      });

      const uow = new UnitOfWork();
      uow.registerRepository('accounts', accountRepo);

      // Commit with no operations
      const result = await uow.commit();

      expect(result.success).toBe(true);
      expect(result.results.length).toBe(0);
      expect(uow.isCommitted()).toBe(true);
    });

    test('cannot commit twice', async () => {
      const accountRepo = new AccountRepository({
        storagePath: testDir,
        fileName: `accounts-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
        cacheTTL: 0
      });

      const uow = new UnitOfWork();
      uow.registerRepository('accounts', accountRepo);

      await uow.commit();

      // Second commit should throw
      await expect(uow.commit()).rejects.toThrow('already committed');
    });

    test('cannot schedule operations after commit', async () => {
      const accountRepo = new AccountRepository({
        storagePath: testDir,
        fileName: `accounts-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
        cacheTTL: 0
      });

      const uow = new UnitOfWork();
      uow.registerRepository('accounts', accountRepo);

      await uow.commit();

      const account = new Account({ name: 'test', sessionDir: 'test' });
      expect(() => uow.scheduleSave('accounts', account)).toThrow('after commit');
    });

    test('operations are executed in order', async () => {
      const testCases = fc.sample(validAccountArbitrary, 5);

      const accountRepo = new AccountRepository({
        storagePath: testDir,
        fileName: `accounts-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
        cacheTTL: 0
      });

      const uow = new UnitOfWork();
      uow.registerRepository('accounts', accountRepo);

      // Schedule operations in specific order
      const accounts = testCases.map(d => new Account(d));
      for (const account of accounts) {
        uow.scheduleSave('accounts', account);
      }

      const result = await uow.commit();

      expect(result.success).toBe(true);
      expect(result.results.length).toBe(accounts.length);

      // Verify order
      for (let i = 0; i < accounts.length; i++) {
        expect(result.results[i].operation.entity.id).toBe(accounts[i].id);
      }
    });
  });
});
