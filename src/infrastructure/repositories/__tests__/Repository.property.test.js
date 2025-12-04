'use strict';

/**
 * Property-based tests for Repository implementations
 * 
 * Tests the following property:
 * - Property 12: Validation Error Detail
 * 
 * **Feature: architecture-refactoring, Property 12: Validation Error Detail**
 * **Validates: Requirements 4.4**
 * 
 * For any invalid data submitted to a repository, the validation error should
 * contain field-level details identifying which fields failed and why.
 */

const fc = require('fast-check');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const AccountRepository = require('../AccountRepository');
const Account = require('../../../domain/entities/Account');
const ValidationError = require('../../../core/errors/ValidationError');

describe('Repository Property Tests', () => {
  let testDir;
  let accountRepo;

  beforeAll(async () => {
    // Create a single temp directory for all tests
    testDir = path.join(os.tmpdir(), `repo-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  beforeEach(async () => {
    // Create fresh repositories for each test
    accountRepo = new AccountRepository({ 
      storagePath: testDir, 
      fileName: `accounts-${Date.now()}.json`,
      cacheTTL: 0 
    });
  });

  afterAll(async () => {
    // Clean up temp directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  // ==================== Arbitraries ====================

  // Valid date arbitrary
  const dateArbitrary = fc.integer({
    min: new Date('2020-01-01').getTime(),
    max: new Date('2030-12-31').getTime()
  }).map(ts => new Date(ts));


  /**
   * **Feature: architecture-refactoring, Property 12: Validation Error Detail**
   * **Validates: Requirements 4.4**
   */
  describe('Property 12: Validation Error Detail', () => {
    
    describe('AccountRepository Validation', () => {
      test('empty name produces field-level error for name field', async () => {
        // Generate test data
        const testCases = fc.sample(fc.record({
          id: fc.uuid(),
          status: fc.constantFrom('inactive', 'loading', 'active', 'error'),
          autoStart: fc.boolean(),
          createdAt: dateArbitrary,
          sessionDir: fc.string({ minLength: 1, maxLength: 50 }).map(s => `session-data/${s}`),
          order: fc.integer({ min: 0, max: 100 })
        }), 20);

        for (const data of testCases) {
          const account = new Account(data);
          // Force empty name after construction (constructor auto-generates)
          account.name = '';
          
          await expect(accountRepo.save(account)).rejects.toThrow(ValidationError);
          
          try {
            await accountRepo.save(account);
          } catch (error) {
            expect(error).toBeInstanceOf(ValidationError);
            expect(error.fields).toBeDefined();
            expect(error.fields.length).toBeGreaterThan(0);
            
            const nameError = error.fields.find(f => f.field === 'name');
            expect(nameError).toBeDefined();
            expect(nameError.reason).toBeDefined();
            expect(typeof nameError.reason).toBe('string');
          }
        }
      });

      test('invalid status produces field-level error for status field', async () => {
        const testCases = fc.sample(fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          status: fc.string({ minLength: 1, maxLength: 20 }).filter(s => !['inactive', 'loading', 'active', 'error'].includes(s)),
          autoStart: fc.boolean(),
          createdAt: dateArbitrary,
          sessionDir: fc.string({ minLength: 1, maxLength: 50 }).map(s => `session-data/${s}`),
          order: fc.integer({ min: 0, max: 100 })
        }), 20);

        for (const data of testCases) {
          const account = new Account(data);
          
          await expect(accountRepo.save(account)).rejects.toThrow(ValidationError);
          
          try {
            await accountRepo.save(account);
          } catch (error) {
            expect(error).toBeInstanceOf(ValidationError);
            expect(error.fields).toBeDefined();
            
            const statusError = error.fields.find(f => f.field === 'status');
            expect(statusError).toBeDefined();
            expect(statusError.reason).toBeDefined();
            expect(statusError.value).toBe(data.status);
          }
        }
      });

      test('negative order produces field-level error for order field', async () => {
        const testCases = fc.sample(fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          status: fc.constantFrom('inactive', 'loading', 'active', 'error'),
          autoStart: fc.boolean(),
          createdAt: dateArbitrary,
          sessionDir: fc.string({ minLength: 1, maxLength: 50 }).map(s => `session-data/${s}`),
          order: fc.integer({ min: -1000, max: -1 })
        }), 20);

        for (const data of testCases) {
          const account = new Account(data);
          
          await expect(accountRepo.save(account)).rejects.toThrow(ValidationError);
          
          try {
            await accountRepo.save(account);
          } catch (error) {
            expect(error).toBeInstanceOf(ValidationError);
            expect(error.fields).toBeDefined();
            
            const orderError = error.fields.find(f => f.field === 'order');
            expect(orderError).toBeDefined();
            expect(orderError.reason).toBeDefined();
          }
        }
      });

      test('empty sessionDir produces field-level error for sessionDir field', async () => {
        const testCases = fc.sample(fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          status: fc.constantFrom('inactive', 'loading', 'active', 'error'),
          autoStart: fc.boolean(),
          createdAt: dateArbitrary,
          order: fc.integer({ min: 0, max: 100 })
        }), 20);

        for (const data of testCases) {
          const account = new Account(data);
          // Force empty sessionDir after construction (constructor auto-generates)
          account.sessionDir = '';
          
          await expect(accountRepo.save(account)).rejects.toThrow(ValidationError);
          
          try {
            await accountRepo.save(account);
          } catch (error) {
            expect(error).toBeInstanceOf(ValidationError);
            expect(error.fields).toBeDefined();
            
            const sessionDirError = error.fields.find(f => f.field === 'sessionDir');
            expect(sessionDirError).toBeDefined();
            expect(sessionDirError.reason).toBeDefined();
          }
        }
      });
    });


    


    describe('Error Structure Consistency', () => {
      test('all validation errors have consistent structure', async () => {
        // Create accounts with invalid data by setting properties after construction
        const createInvalidAccounts = () => {
          const accounts = [];
          
          // Empty name
          const a1 = new Account({ sessionDir: 'test' });
          a1.name = '';
          accounts.push(a1);
          
          // Invalid status
          const a2 = new Account({ name: 'test', sessionDir: 'test' });
          a2.status = 'invalid';
          accounts.push(a2);
          
          // Negative order
          const a3 = new Account({ name: 'test', sessionDir: 'test' });
          a3.order = -1;
          accounts.push(a3);
          
          // Empty sessionDir
          const a4 = new Account({ name: 'test' });
          a4.sessionDir = '';
          accounts.push(a4);
          
          return accounts;
        };

        for (const account of createInvalidAccounts()) {
          try {
            await accountRepo.save(account);
            throw new Error('Should have thrown ValidationError');
          } catch (error) {
            // Verify error structure
            expect(error).toBeInstanceOf(ValidationError);
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.message).toBeDefined();
            expect(typeof error.message).toBe('string');
            expect(error.fields).toBeDefined();
            expect(Array.isArray(error.fields)).toBe(true);
            
            // Each field error should have required properties
            for (const fieldError of error.fields) {
              expect(fieldError.field).toBeDefined();
              expect(typeof fieldError.field).toBe('string');
              expect(fieldError.reason).toBeDefined();
              expect(typeof fieldError.reason).toBe('string');
            }
          }
        }
      });
    });
  });
});
