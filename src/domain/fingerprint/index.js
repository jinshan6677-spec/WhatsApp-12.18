'use strict';

/**
 * Domain Fingerprint Module
 * 
 * Exports all fingerprint domain entities and value objects.
 */

const FingerprintConfig = require('./FingerprintConfig');
const FingerprintTemplate = require('./FingerprintTemplate');
const NoiseEngine = require('./NoiseEngine');
const FingerprintDatabase = require('./FingerprintDatabase');

module.exports = {
  FingerprintConfig,
  FingerprintTemplate,
  NoiseEngine,
  FingerprintDatabase,
  BrowserType: FingerprintConfig.BrowserType,
  OSType: FingerprintConfig.OSType,
  NoiseLevel: FingerprintConfig.NoiseLevel,
  NoiseDistribution: FingerprintConfig.NoiseDistribution
};
