'use strict';

/**
 * Property-based tests for SeedManager
 * 
 * Tests the following property:
 * - Property 15: 噪声种子加密安全性 (Noise Seed Encryption Security)
 * 
 * **Validates: Requirements 51.2**
 * 
 * For any stored noise seed, it should be encrypted and the original seed
 * value cannot be directly obtained from the stored data.
 */

const fc = require('fast-check');
const { SeedManager, SeedError } = require('../../src/infrastructure/fingerprint/SeedManager');

// ==================== Arbitraries ====================

/**
 * Valid seed arbitrary - 32-bit unsigned integer
 */
const seedArbitrary = fc.integer({ min: 0, max: 0xFFFFFFFF });

/**
 * Valid account ID arbitrary
 */
const accountIdArbitrary = fc.uuid();

/**
 * Valid encryption key arbitrary - 32 bytes
 */
const encryptionKeyArbitrary = fc.uint8Array({ minLength: 32, maxLength: 32 })
  .map(arr => Buffer.from(arr));

/**
 * Invalid seed arbitrary - non-integer values
 */
const invalidSeedArbitrary = fc.oneof(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.double({ min: 0.1, max: 100, noNaN: true }).filter(n => !Number.isInteger(n)),
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(NaN)
);

/**
 * Invalid account ID arbitrary
 */
const invalidAccountIdArbitrary = fc.oneof(
  fc.constant(''),
  fc.constant(null),
  fc.constant(undefined),
  fc.integer()
);

// ==================== Property Tests ====================

describe('SeedManager Property Tests', () => {
  
  /**
   * **Feature: professional-fingerprint-refactoring, Property 15: 噪声种子加密安全性**
   * **Validates: Requirements 51.2**
   * 
   * For any stored noise seed, it should be encrypted using secure encryption,
   * and the original seed value cannot be directly obtained from the stored data.
   */
  describe('Property 15: Noise Seed Encryption Security', () => {
    
    test('encrypted seed data does not contain original seed value in plaintext', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          accountIdArbitrary,
          encryptionKeyArbitrary,
          async (seed, accountId, encryptionKey) => {
            const seedManager = new SeedManager({ encryptionKey });
            
            // Encrypt the seed
            const encrypted = seedManager.encryptSeed(seed, accountId);
            
            // The encrypted data should not contain the seed in plaintext
            const encryptedString = JSON.stringify(encrypted);
            const seedString = seed.toString();
            
            // The seed value should not appear directly in the encrypted data
            // (except by coincidence in very short seeds, which we'll allow)
            if (seedString.length > 4) {
              expect(encryptedString).not.toContain(seedString);
            }
            
            // The encrypted data should have proper structure
            expect(encrypted).toHaveProperty('iv');
            expect(encrypted).toHaveProperty('authTag');
            expect(encrypted).toHaveProperty('data');
            expect(encrypted).toHaveProperty('version');
            expect(encrypted).toHaveProperty('accountId');
            
            // IV, authTag, and data should be hex strings
            expect(typeof encrypted.iv).toBe('string');
            expect(typeof encrypted.authTag).toBe('string');
            expect(typeof encrypted.data).toBe('string');
            expect(/^[0-9a-f]+$/i.test(encrypted.iv)).toBe(true);
            expect(/^[0-9a-f]+$/i.test(encrypted.authTag)).toBe(true);
            expect(/^[0-9a-f]+$/i.test(encrypted.data)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('encrypted seed can be decrypted back to original value', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          accountIdArbitrary,
          encryptionKeyArbitrary,
          async (seed, accountId, encryptionKey) => {
            const seedManager = new SeedManager({ encryptionKey });
            
            // Encrypt the seed
            const encrypted = seedManager.encryptSeed(seed, accountId);
            
            // Decrypt the seed
            const decrypted = seedManager.decryptSeed(encrypted, accountId);
            
            // The decrypted seed should match the original
            expect(decrypted.seed).toBe(seed);
            expect(decrypted.accountId).toBe(accountId);
            expect(decrypted.version).toBe(1);
            expect(decrypted.createdAt).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('different encryption keys produce different encrypted data', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          accountIdArbitrary,
          encryptionKeyArbitrary,
          encryptionKeyArbitrary,
          async (seed, accountId, key1, key2) => {
            // Skip if keys are identical
            if (key1.equals(key2)) {
              return;
            }
            
            const seedManager1 = new SeedManager({ encryptionKey: key1 });
            const seedManager2 = new SeedManager({ encryptionKey: key2 });
            
            const encrypted1 = seedManager1.encryptSeed(seed, accountId);
            const encrypted2 = seedManager2.encryptSeed(seed, accountId);
            
            // The encrypted data should be different (different keys)
            expect(encrypted1.data).not.toBe(encrypted2.data);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('decryption with wrong key fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          accountIdArbitrary,
          encryptionKeyArbitrary,
          encryptionKeyArbitrary,
          async (seed, accountId, key1, key2) => {
            // Skip if keys are identical
            if (key1.equals(key2)) {
              return;
            }
            
            const seedManager1 = new SeedManager({ encryptionKey: key1 });
            const seedManager2 = new SeedManager({ encryptionKey: key2 });
            
            // Encrypt with key1
            const encrypted = seedManager1.encryptSeed(seed, accountId);
            
            // Attempt to decrypt with key2 should fail
            expect(() => {
              seedManager2.decryptSeed(encrypted, accountId);
            }).toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('decryption with wrong account ID fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          accountIdArbitrary,
          accountIdArbitrary,
          encryptionKeyArbitrary,
          async (seed, accountId1, accountId2, encryptionKey) => {
            // Skip if account IDs are identical
            if (accountId1 === accountId2) {
              return;
            }
            
            const seedManager = new SeedManager({ encryptionKey });
            
            // Encrypt with accountId1
            const encrypted = seedManager.encryptSeed(seed, accountId1);
            
            // Attempt to decrypt with accountId2 should fail
            expect(() => {
              seedManager.decryptSeed(encrypted, accountId2);
            }).toThrow(SeedError);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('same seed encrypted twice produces different ciphertext (due to random IV)', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          accountIdArbitrary,
          encryptionKeyArbitrary,
          async (seed, accountId, encryptionKey) => {
            const seedManager = new SeedManager({ encryptionKey });
            
            // Encrypt the same seed twice
            const encrypted1 = seedManager.encryptSeed(seed, accountId);
            const encrypted2 = seedManager.encryptSeed(seed, accountId);
            
            // The IVs should be different (random)
            expect(encrypted1.iv).not.toBe(encrypted2.iv);
            
            // The encrypted data should be different
            expect(encrypted1.data).not.toBe(encrypted2.data);
            
            // But both should decrypt to the same seed
            const decrypted1 = seedManager.decryptSeed(encrypted1, accountId);
            const decrypted2 = seedManager.decryptSeed(encrypted2, accountId);
            
            expect(decrypted1.seed).toBe(seed);
            expect(decrypted2.seed).toBe(seed);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('hashed seed does not reveal original seed', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          async (seed) => {
            const seedManager = new SeedManager();
            
            const hash = seedManager.hashSeed(seed);
            
            // Hash should be a hex string
            expect(typeof hash).toBe('string');
            expect(/^[0-9a-f]+$/i.test(hash)).toBe(true);
            
            // Hash should not contain the seed value directly
            const seedString = seed.toString();
            if (seedString.length > 4) {
              expect(hash).not.toContain(seedString);
            }
            
            // Hash should be deterministic
            const hash2 = seedManager.hashSeed(seed);
            expect(hash).toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('generateSecureSeed produces valid 32-bit unsigned integers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (iterations) => {
            const seedManager = new SeedManager();
            const seeds = new Set();
            
            for (let i = 0; i < iterations; i++) {
              const seed = seedManager.generateSecureSeed();
              
              // Should be a valid 32-bit unsigned integer
              expect(typeof seed).toBe('number');
              expect(Number.isInteger(seed)).toBe(true);
              expect(seed).toBeGreaterThanOrEqual(0);
              expect(seed).toBeLessThanOrEqual(0xFFFFFFFF);
              
              seeds.add(seed);
            }
            
            // Seeds should be unique (with high probability)
            // Allow for some collisions in small samples
            if (iterations > 10) {
              expect(seeds.size).toBeGreaterThan(iterations * 0.9);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('rotateSeed produces new unique seed', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          accountIdArbitrary,
          async (oldSeed, accountId) => {
            const seedManager = new SeedManager();
            
            const result = seedManager.rotateSeed(accountId, oldSeed);
            
            // Should have all required fields
            expect(result).toHaveProperty('newSeed');
            expect(result).toHaveProperty('rotatedAt');
            expect(result).toHaveProperty('previousSeedHash');
            expect(result).toHaveProperty('accountId');
            expect(result).toHaveProperty('version');
            
            // New seed should be different from old seed (with very high probability)
            // Note: There's a 1 in 2^32 chance they're the same, which is negligible
            expect(result.newSeed).not.toBe(oldSeed);
            
            // Previous seed hash should match
            expect(result.previousSeedHash).toBe(seedManager.hashSeed(oldSeed));
            
            // Account ID should be preserved
            expect(result.accountId).toBe(accountId);
            
            // Rotated timestamp should be valid ISO string
            expect(() => new Date(result.rotatedAt)).not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('validateEncryptedData correctly identifies valid and invalid data', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          accountIdArbitrary,
          encryptionKeyArbitrary,
          async (seed, accountId, encryptionKey) => {
            const seedManager = new SeedManager({ encryptionKey });
            
            // Valid encrypted data should pass validation
            const encrypted = seedManager.encryptSeed(seed, accountId);
            const validResult = seedManager.validateEncryptedData(encrypted);
            
            expect(validResult.isValid).toBe(true);
            expect(validResult.errors).toHaveLength(0);
            
            // Invalid data should fail validation
            const invalidResult1 = seedManager.validateEncryptedData(null);
            expect(invalidResult1.isValid).toBe(false);
            
            const invalidResult2 = seedManager.validateEncryptedData({});
            expect(invalidResult2.isValid).toBe(false);
            
            const invalidResult3 = seedManager.validateEncryptedData({
              iv: 'not-hex!',
              authTag: encrypted.authTag,
              data: encrypted.data
            });
            expect(invalidResult3.isValid).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('prepareForExport without includeSeed does not expose seed', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          accountIdArbitrary,
          encryptionKeyArbitrary,
          async (seed, accountId, encryptionKey) => {
            const seedManager = new SeedManager({ encryptionKey });
            
            const encrypted = seedManager.encryptSeed(seed, accountId);
            const exported = seedManager.prepareForExport(encrypted, { includeSeed: false });
            
            // Should not contain the seed
            expect(exported).not.toHaveProperty('seed');
            expect(exported.includedSeed).toBe(false);
            
            // Should have metadata
            expect(exported).toHaveProperty('seedHash');
            expect(exported).toHaveProperty('version');
            expect(exported).toHaveProperty('exportedAt');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('prepareForExport with includeSeed exposes seed correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          accountIdArbitrary,
          encryptionKeyArbitrary,
          async (seed, accountId, encryptionKey) => {
            const seedManager = new SeedManager({ encryptionKey });
            
            const encrypted = seedManager.encryptSeed(seed, accountId);
            const exported = seedManager.prepareForExport(encrypted, { 
              includeSeed: true, 
              accountId 
            });
            
            // Should contain the seed
            expect(exported.seed).toBe(seed);
            expect(exported.includedSeed).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('importSeed creates valid encrypted data', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          accountIdArbitrary,
          accountIdArbitrary,
          encryptionKeyArbitrary,
          async (seed, originalAccountId, newAccountId, encryptionKey) => {
            const seedManager = new SeedManager({ encryptionKey });
            
            // Export with seed
            const encrypted = seedManager.encryptSeed(seed, originalAccountId);
            const exported = seedManager.prepareForExport(encrypted, { 
              includeSeed: true, 
              accountId: originalAccountId 
            });
            
            // Import to new account
            const imported = seedManager.importSeed(exported, newAccountId);
            
            // Should be valid encrypted data
            const validation = seedManager.validateEncryptedData(imported);
            expect(validation.isValid).toBe(true);
            
            // Should decrypt to the original seed but bound to new account
            const decrypted = seedManager.decryptSeed(imported, newAccountId);
            expect(decrypted.seed).toBe(seed);
            expect(decrypted.accountId).toBe(newAccountId);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Error Handling', () => {
    test('invalid seed type throws SeedError', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidSeedArbitrary,
          accountIdArbitrary,
          async (invalidSeed, accountId) => {
            const seedManager = new SeedManager();
            
            expect(() => {
              seedManager.encryptSeed(invalidSeed, accountId);
            }).toThrow(SeedError);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('invalid account ID throws SeedError', async () => {
      await fc.assert(
        fc.asyncProperty(
          seedArbitrary,
          invalidAccountIdArbitrary,
          async (seed, invalidAccountId) => {
            const seedManager = new SeedManager();
            
            expect(() => {
              seedManager.encryptSeed(seed, invalidAccountId);
            }).toThrow(SeedError);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('hashSeed with invalid input throws SeedError', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.string(),
            fc.constant(null),
            fc.constant(undefined)
          ),
          async (invalidSeed) => {
            const seedManager = new SeedManager();
            
            expect(() => {
              seedManager.hashSeed(invalidSeed);
            }).toThrow(SeedError);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
