/**
 * IPC Module - Structured IPC communication layer
 * 
 * This module provides:
 * - IPCRouter: Typed IPC channels with validation and timeout handling
 * - IPCDocGenerator: Documentation generation for IPC channels
 * - handlers: Domain-specific IPC handlers for the single-window architecture
 * 
 * @module presentation/ipc
 */

'use strict';

const { IPCRouter, generateRequestId } = require('./IPCRouter');
const { IPCDocGenerator } = require('./IPCDocGenerator');
const handlers = require('./handlers');

module.exports = {
  // Core IPC infrastructure
  IPCRouter,
  IPCDocGenerator,
  generateRequestId,
  
  // Domain-specific handlers
  handlers,
  
  // Convenience exports for handlers
  AccountIPCHandlers: handlers.AccountIPCHandlers,
  ViewIPCHandlers: handlers.ViewIPCHandlers,
  SystemIPCHandlers: handlers.SystemIPCHandlers,
  TranslationIPCHandlers: handlers.TranslationIPCHandlers,
  
  // Aggregated handler registration
  registerAllHandlers: handlers.registerAllHandlers,
  unregisterAllHandlers: handlers.unregisterAllHandlers
};
