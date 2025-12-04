/**
 * Infrastructure Fingerprint Module
 * 基础设施层指纹模块
 * 
 * Exports all infrastructure-level fingerprint components including:
 * - SeedManager: Secure seed generation and encryption
 * - FingerprintRepository: Fingerprint configuration persistence
 * - FingerprintInjector: Unified fingerprint injection script generation
 * - NativeWrapper: Native function wrapping for anti-detection
 * 
 * @module infrastructure/fingerprint
 * 
 * **Validates: Requirements 31.1**
 */

'use strict';

const { SeedManager, SeedError, CURRENT_VERSION } = require('./SeedManager');
const { FingerprintRepository, FingerprintRepositoryError } = require('./FingerprintRepository');
const { FingerprintInjector, FingerprintInjectorError } = require('./FingerprintInjector');
const { 
  NativeWrapper, 
  NativeWrapperError,
  ScriptGenerator,
  ScriptGeneratorError,
  InjectionScriptManager,
  WorkerInterceptor,
  WorkerInterceptorError
} = require('./injection-scripts');

module.exports = {
  // Seed management
  SeedManager,
  SeedError,
  SEED_VERSION: CURRENT_VERSION,
  
  // Repository
  FingerprintRepository,
  FingerprintRepositoryError,
  
  // Injector
  FingerprintInjector,
  FingerprintInjectorError,
  
  // Script generation
  ScriptGenerator,
  ScriptGeneratorError,
  InjectionScriptManager,
  
  // Core utilities
  NativeWrapper,
  NativeWrapperError,
  WorkerInterceptor,
  WorkerInterceptorError
};
