/**
 * Core Injection Scripts Module
 * 核心注入脚本模块
 * 
 * Exports core utilities for fingerprint injection:
 * - NativeWrapper: Wrap native functions while preserving native characteristics
 * - PrototypeGuard: Protect prototype chains from detection
 * 
 * @module infrastructure/fingerprint/injection-scripts/core
 */

'use strict';

const { NativeWrapper, NativeWrapperError } = require('./native-wrapper');
const { PrototypeGuard, PrototypeGuardError } = require('./prototype-guard');

module.exports = {
  NativeWrapper,
  NativeWrapperError,
  PrototypeGuard,
  PrototypeGuardError
};
