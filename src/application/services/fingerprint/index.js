'use strict';

/**
 * Application Services - Fingerprint Module
 * 
 * Exports all fingerprint application services.
 * 
 * This module provides the application layer for the fingerprint system,
 * including:
 * - FingerprintService: Unified facade for all fingerprint operations
 * - FingerprintGenerator: Generate complete fingerprint configurations
 * - FingerprintValidator: Validate fingerprint consistency
 * - TemplateManager: Manage fingerprint templates
 * - FingerprintTestRunner: Test fingerprint configurations
 * 
 * Requirements: 31.1
 */

const FingerprintService = require('./FingerprintService');
const FingerprintValidator = require('./FingerprintValidator');
const FingerprintGenerator = require('./FingerprintGenerator');
const TemplateManager = require('./TemplateManager');
const FingerprintTestRunner = require('./FingerprintTestRunner');

module.exports = {
  // Main facade service
  FingerprintService,
  
  // Individual services
  FingerprintValidator,
  FingerprintGenerator,
  TemplateManager,
  FingerprintTestRunner
};
