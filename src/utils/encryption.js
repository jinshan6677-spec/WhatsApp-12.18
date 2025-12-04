/**
 * Encryption Utilities for Sensitive Data
 * 
 * Provides AES-256-GCM encryption/decryption for sensitive data like proxy credentials.
 * Uses machine-specific key derivation to prevent credential theft if config files are copied.
 * 
 * @module utils/encryption
 */

'use strict';

const crypto = require('crypto');
const { machineIdSync } = require('node-machine-id');

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

/**
 * Derive encryption key from machine ID
 * @returns {Buffer} 32-byte encryption key
 */
function deriveKey() {
    try {
        const machineId = machineIdSync();
        // Use PBKDF2 to derive a key from machine ID
        const salt = Buffer.from('whatsapp-env-config-salt-v1', 'utf8');
        return crypto.pbkdf2Sync(machineId, salt, 100000, KEY_LENGTH, 'sha256');
    } catch (error) {
        console.error('[Encryption] Failed to derive key from machine ID:', error);
        // Fallback to a static key (less secure, but prevents app crash)
        const fallbackSeed = 'fallback-encryption-key-seed';
        const salt = Buffer.from('whatsapp-env-config-salt-v1', 'utf8');
        return crypto.pbkdf2Sync(fallbackSeed, salt, 100000, KEY_LENGTH, 'sha256');
    }
}

/**
 * Encrypt sensitive data
 * @param {string} plaintext - Data to encrypt
 * @returns {string} Encrypted data in format: iv:authTag:ciphertext (hex encoded)
 */
function encrypt(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') {
        return plaintext;
    }

    try {
        const key = deriveKey();
        const iv = crypto.randomBytes(IV_LENGTH);

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
        ciphertext += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Return format: iv:authTag:ciphertext (all hex encoded)
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
    } catch (error) {
        console.error('[Encryption] Encryption failed:', error);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypt encrypted data
 * @param {string} encryptedData - Encrypted data in format: iv:authTag:ciphertext
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'string') {
        return encryptedData;
    }

    // Check if data is encrypted (contains colons)
    if (!encryptedData.includes(':')) {
        return encryptedData;
    }

    try {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }

        const [ivHex, authTagHex, ciphertext] = parts;

        const key = deriveKey();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
        plaintext += decipher.final('utf8');

        return plaintext;
    } catch (error) {
        console.error('[Encryption] Decryption failed:', error);
        // Return original data if decryption fails (might be unencrypted legacy data)
        return encryptedData;
    }
}

/**
 * Check if data is encrypted
 * @param {string} data - Data to check
 * @returns {boolean} True if data appears to be encrypted
 */
function isEncrypted(data) {
    if (!data || typeof data !== 'string') {
        return false;
    }

    // Check for our encryption format: hex:hex:hex
    const parts = data.split(':');
    if (parts.length !== 3) {
        return false;
    }

    // Check if all parts are valid hex
    const hexRegex = /^[0-9a-f]+$/i;
    return parts.every(part => hexRegex.test(part));
}

/**
 * Encrypt an object's sensitive fields
 * @param {Object} obj - Object to encrypt
 * @param {string[]} fields - Array of field names to encrypt
 * @returns {Object} Object with encrypted fields
 */
function encryptFields(obj, fields) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const result = { ...obj };

    for (const field of fields) {
        if (result[field] && typeof result[field] === 'string') {
            result[field] = encrypt(result[field]);
        }
    }

    return result;
}

/**
 * Decrypt an object's encrypted fields
 * @param {Object} obj - Object to decrypt
 * @param {string[]} fields - Array of field names to decrypt
 * @returns {Object} Object with decrypted fields
 */
function decryptFields(obj, fields) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const result = { ...obj };

    for (const field of fields) {
        if (result[field] && typeof result[field] === 'string') {
            result[field] = decrypt(result[field]);
        }
    }

    return result;
}

module.exports = {
    encrypt,
    decrypt,
    isEncrypted,
    encryptFields,
    decryptFields
};
