/**
 * Proxy Configuration Store
 * 
 * Manages saved proxy configurations that can be reused across accounts.
 * Stores named proxy configs with encrypted credentials.
 * 
 * @module environment/ProxyConfigStore
 */

'use strict';

const Store = require('electron-store');
const { encryptFields, decryptFields } = require('../utils/encryption');

// Fields to encrypt
const ENCRYPTED_FIELDS = ['password'];

/**
 * Proxy Configuration Store
 */
class ProxyConfigStore {
    constructor() {
        this.store = new Store({
            name: 'proxy-configs',
            encryptionKey: 'whatsapp-proxy-config-key-v1'
        });
    }

    /**
     * Save a named proxy configuration
     * @param {string} name - Configuration name
     * @param {Object} config - Proxy configuration
     * @param {string} config.protocol - Proxy protocol
     * @param {string} config.host - Proxy host
     * @param {string} config.port - Proxy port
     * @param {string} [config.username] - Proxy username
     * @param {string} [config.password] - Proxy password
     * @returns {boolean} Success status
     */
    saveProxyConfig(name, config) {
        if (!name || typeof name !== 'string') {
            throw new Error('Proxy configuration name is required');
        }

        if (!config || typeof config !== 'object') {
            throw new Error('Invalid proxy configuration');
        }

        if (!config.host || !config.port) {
            throw new Error('Proxy host and port are required');
        }

        try {
            // Create a copy to avoid modifying original
            const configToSave = {
                protocol: config.protocol || 'http',
                host: config.host,
                port: config.port,
                username: config.username || '',
                password: config.password || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Encrypt sensitive fields
            const encryptedConfig = encryptFields(configToSave, ENCRYPTED_FIELDS);

            // Save to store
            this.store.set(`configs.${name}`, encryptedConfig);

            console.log(`[ProxyConfigStore] Saved proxy config: ${name}`);
            return true;
        } catch (error) {
            console.error(`[ProxyConfigStore] Failed to save proxy config ${name}:`, error);
            throw error;
        }
    }

    /**
     * Get a proxy configuration by name
     * @param {string} name - Configuration name
     * @returns {Object|null} Proxy configuration or null if not found
     */
    getProxyConfig(name) {
        if (!name || typeof name !== 'string') {
            return null;
        }

        try {
            const config = this.store.get(`configs.${name}`, null);

            if (!config) {
                return null;
            }

            // Decrypt sensitive fields
            const decryptedConfig = decryptFields(config, ENCRYPTED_FIELDS);

            return decryptedConfig;
        } catch (error) {
            console.error(`[ProxyConfigStore] Failed to get proxy config ${name}:`, error);
            return null;
        }
    }

    /**
     * Get all saved proxy configurations
     * @returns {Object} Object with config names as keys and configs as values
     */
    getProxyConfigs() {
        try {
            const configs = this.store.get('configs', {});
            const decryptedConfigs = {};

            for (const [name, config] of Object.entries(configs)) {
                decryptedConfigs[name] = decryptFields(config, ENCRYPTED_FIELDS);
            }

            return decryptedConfigs;
        } catch (error) {
            console.error('[ProxyConfigStore] Failed to get proxy configs:', error);
            return {};
        }
    }

    /**
     * Get list of proxy configuration names
     * @returns {string[]} Array of configuration names
     */
    getProxyConfigNames() {
        try {
            const configs = this.store.get('configs', {});
            return Object.keys(configs).sort();
        } catch (error) {
            console.error('[ProxyConfigStore] Failed to get proxy config names:', error);
            return [];
        }
    }

    /**
     * Delete a proxy configuration
     * @param {string} name - Configuration name
     * @returns {boolean} Success status
     */
    deleteProxyConfig(name) {
        if (!name || typeof name !== 'string') {
            return false;
        }

        try {
            this.store.delete(`configs.${name}`);
            console.log(`[ProxyConfigStore] Deleted proxy config: ${name}`);
            return true;
        } catch (error) {
            console.error(`[ProxyConfigStore] Failed to delete proxy config ${name}:`, error);
            return false;
        }
    }

    /**
     * Check if a proxy configuration exists
     * @param {string} name - Configuration name
     * @returns {boolean} True if configuration exists
     */
    hasProxyConfig(name) {
        if (!name || typeof name !== 'string') {
            return false;
        }

        return this.store.has(`configs.${name}`);
    }

    /**
     * Update an existing proxy configuration
     * @param {string} name - Configuration name
     * @param {Object} config - Updated proxy configuration
     * @returns {boolean} Success status
     */
    updateProxyConfig(name, config) {
        if (!this.hasProxyConfig(name)) {
            throw new Error(`Proxy configuration '${name}' does not exist`);
        }

        try {
            const existingConfig = this.getProxyConfig(name);

            const updatedConfig = {
                ...existingConfig,
                ...config,
                updatedAt: new Date().toISOString()
            };

            // Encrypt sensitive fields
            const encryptedConfig = encryptFields(updatedConfig, ENCRYPTED_FIELDS);

            this.store.set(`configs.${name}`, encryptedConfig);

            console.log(`[ProxyConfigStore] Updated proxy config: ${name}`);
            return true;
        } catch (error) {
            console.error(`[ProxyConfigStore] Failed to update proxy config ${name}:`, error);
            throw error;
        }
    }

    /**
     * Clear all proxy configurations
     * @returns {boolean} Success status
     */
    clearAll() {
        try {
            this.store.clear();
            console.log('[ProxyConfigStore] Cleared all proxy configurations');
            return true;
        } catch (error) {
            console.error('[ProxyConfigStore] Failed to clear proxy configurations:', error);
            return false;
        }
    }

    /**
     * Export proxy configurations (for backup)
     * @returns {Object} All proxy configurations (decrypted)
     */
    exportConfigs() {
        return this.getProxyConfigs();
    }

    /**
     * Import proxy configurations (from backup)
     * @param {Object} configs - Proxy configurations to import
     * @param {boolean} [merge=true] - Whether to merge with existing configs or replace
     * @returns {boolean} Success status
     */
    importConfigs(configs, merge = true) {
        if (!configs || typeof configs !== 'object') {
            throw new Error('Invalid configurations object');
        }

        try {
            if (!merge) {
                this.clearAll();
            }

            for (const [name, config] of Object.entries(configs)) {
                this.saveProxyConfig(name, config);
            }

            console.log(`[ProxyConfigStore] Imported ${Object.keys(configs).length} proxy configurations`);
            return true;
        } catch (error) {
            console.error('[ProxyConfigStore] Failed to import proxy configurations:', error);
            throw error;
        }
    }
}

module.exports = ProxyConfigStore;
