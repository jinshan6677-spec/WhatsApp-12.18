/**
 * Environment Configuration Manager
 * 
 * Manages environment configurations (proxy) for each account.
 * Handles loading, saving, encryption, and validation of environment settings.
 * 
 * Note: Fingerprint configuration has been removed as part of the professional
 * fingerprint system refactoring. The new fingerprint system will be implemented
 * in src/domain/fingerprint, src/application/services/fingerprint, and
 * src/infrastructure/fingerprint directories.
 * 
 * @module environment/EnvironmentConfigManager
 */

'use strict';

const Store = require('electron-store');
const { encryptFields, decryptFields } = require('../utils/encryption');

// Default environment configuration
// Note: fingerprint配置已移除，将在新指纹系统中实现
const DEFAULT_CONFIG = {
    proxy: {
        enabled: false,
        configName: '',
        protocol: 'http',
        host: '',
        port: '',
        username: '',
        password: ''
    }
    // TODO: 新的指纹配置将在新指纹系统实现后通过FingerprintRepository管理
};

// Fields to encrypt
const ENCRYPTED_FIELDS = ['password'];

/**
 * Environment Configuration Manager
 */
class EnvironmentConfigManager {
    constructor() {
        this.store = new Store({
            name: 'environment-configs',
            encryptionKey: 'whatsapp-env-config-key-v1'
        });
    }

    /**
     * Get environment configuration for an account
     * @param {string} accountId - Account ID
     * @returns {Object} Environment configuration
     */
    getConfig(accountId) {
        if (!accountId) {
            throw new Error('Account ID is required');
        }

        const config = this.store.get(`accounts.${accountId}`, null);

        if (!config) {
            return this._getDefaultConfig();
        }

        // Decrypt sensitive fields
        if (config.proxy && config.proxy.password) {
            config.proxy = decryptFields(config.proxy, ENCRYPTED_FIELDS);
        }

        // Merge with defaults to ensure all fields exist
        return this._mergeWithDefaults(config);
    }

    /**
     * Save environment configuration for an account
     * @param {string} accountId - Account ID
     * @param {Object} config - Environment configuration
     * @returns {boolean} Success status
     */
    saveConfig(accountId, config) {
        if (!accountId) {
            throw new Error('Account ID is required');
        }

        if (!config || typeof config !== 'object') {
            throw new Error('Invalid configuration object');
        }

        try {
            // Validate configuration
            this._validateConfig(config);

            // Create a copy to avoid modifying original
            const configToSave = JSON.parse(JSON.stringify(config));

            // Encrypt sensitive fields
            if (configToSave.proxy && configToSave.proxy.password) {
                configToSave.proxy = encryptFields(configToSave.proxy, ENCRYPTED_FIELDS);
            }

            // Save to store
            this.store.set(`accounts.${accountId}`, configToSave);

            console.log(`[EnvironmentConfigManager] Saved config for account ${accountId}`);
            return true;
        } catch (error) {
            console.error(`[EnvironmentConfigManager] Failed to save config for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Delete environment configuration for an account
     * @param {string} accountId - Account ID
     * @returns {boolean} Success status
     */
    deleteConfig(accountId) {
        if (!accountId) {
            throw new Error('Account ID is required');
        }

        try {
            this.store.delete(`accounts.${accountId}`);
            console.log(`[EnvironmentConfigManager] Deleted config for account ${accountId}`);
            return true;
        } catch (error) {
            console.error(`[EnvironmentConfigManager] Failed to delete config for account ${accountId}:`, error);
            return false;
        }
    }

    /**
     * Get all account IDs with environment configurations
     * @returns {string[]} Array of account IDs
     */
    getAllAccountIds() {
        const accounts = this.store.get('accounts', {});
        return Object.keys(accounts);
    }

    /**
     * Clear all environment configurations
     * @returns {boolean} Success status
     */
    clearAll() {
        try {
            this.store.clear();
            console.log('[EnvironmentConfigManager] Cleared all configurations');
            return true;
        } catch (error) {
            console.error('[EnvironmentConfigManager] Failed to clear configurations:', error);
            return false;
        }
    }

    /**
     * Get default configuration
     * @returns {Object} Default environment configuration
     * @private
     */
    _getDefaultConfig() {
        return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }

    /**
     * Merge configuration with defaults
     * @param {Object} config - Configuration to merge
     * @returns {Object} Merged configuration
     * @private
     */
    _mergeWithDefaults(config) {
        const defaults = this._getDefaultConfig();

        return {
            proxy: { ...defaults.proxy, ...(config.proxy || {}) }
            // Note: fingerprint合并已移除，将在新指纹系统中实现
        };
    }

    /**
     * Validate configuration structure
     * @param {Object} config - Configuration to validate
     * @throws {Error} If configuration is invalid
     * @private
     */
    _validateConfig(config) {
        // 代理配置验证（可选，因为代理可能未启用）
        if (config.proxy && typeof config.proxy !== 'object') {
            throw new Error('Invalid proxy configuration');
        }

        // Validate proxy fields
        if (config.proxy && config.proxy.enabled) {
            if (config.proxy.protocol && !['http', 'https'].includes(config.proxy.protocol)) {
                throw new Error('Invalid proxy protocol');
            }
        }

        // Note: fingerprint验证已移除，将在新指纹系统中实现
        return true;
    }
}

module.exports = EnvironmentConfigManager;
