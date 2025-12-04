/**
 * Environment Module
 * 
 * Exports all environment-related modules for proxy management.
 * 
 * Note: Fingerprint modules (FingerprintGenerator, FingerprintInjector) have been removed
 * as part of the professional fingerprint system refactoring. The new fingerprint system
 * will be implemented in src/domain/fingerprint, src/application/services/fingerprint,
 * and src/infrastructure/fingerprint directories.
 * 
 * @module environment
 */

'use strict';

const EnvironmentConfigManager = require('./EnvironmentConfigManager');
const ProxyManager = require('./ProxyManager');
const ProxyConfigStore = require('./ProxyConfigStore');
const ProxyValidator = require('./ProxyValidator');
const CookieManager = require('./CookieManager');

module.exports = {
    EnvironmentConfigManager,
    ProxyManager,
    ProxyConfigStore,
    ProxyValidator,
    CookieManager
};
