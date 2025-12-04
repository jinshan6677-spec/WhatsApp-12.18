/**
 * IPC Module - Unified IPC handler exports
 * 
 * Provides IPCRouter-based handlers and IPC Bridge.
 * 
 * @module ipc
 */

'use strict';

// IPC Bridge for connecting IPCRouter to ipcMain
const { IPCBridge, createIPCBridge } = require('./IPCBridge');

module.exports = {
  IPCBridge,
  createIPCBridge
};
