/**
 * IPCBridge - Bridge between IPCRouter and Electron's ipcMain
 * 
 * Connects the new IPCRouter pattern to Electron's native IPC system,
 * providing request validation, error handling, and structured responses.
 * 
 * @module ipc/IPCBridge
 */

'use strict';

const { ipcMain } = require('electron');

/**
 * IPCBridge class
 * 
 * Bridges IPCRouter handlers to Electron's ipcMain system.
 */
class IPCBridge {
  /**
   * Creates an IPCBridge instance
   * @param {Object} options - Configuration options
   * @param {IPCRouter} options.ipcRouter - IPCRouter instance
   * @param {Function} [options.logger] - Logger function
   */
  constructor(options = {}) {
    if (!options.ipcRouter) {
      throw new Error('IPCBridge requires an ipcRouter');
    }
    
    this._ipcRouter = options.ipcRouter;
    this._logger = options.logger || console.error.bind(console);
    this._registeredChannels = new Set();
    this._bridgeActive = false;
  }

  /**
   * Activates the bridge, connecting all IPCRouter channels to ipcMain
   */
  activate() {
    if (this._bridgeActive) {
      console.warn('[IPCBridge] Bridge is already active');
      return;
    }

    const channels = this._ipcRouter.getChannels();
    
    for (const channelInfo of channels) {
      this._registerChannel(channelInfo.channel);
    }

    this._bridgeActive = true;
    console.log(`[IPCBridge] Activated with ${channels.length} channels`);
  }


  /**
   * Registers a single channel with ipcMain
   * @private
   * @param {string} channel - Channel name
   */
  _registerChannel(channel) {
    if (this._registeredChannels.has(channel)) {
      return;
    }

    ipcMain.handle(channel, async (event, payload) => {
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const request = {
        channel,
        payload,
        requestId
      };

      try {
        const response = await this._ipcRouter.handle(channel, request);
        
        if (response.success) {
          return response.data;
        } else {
          // Return error in a format compatible with existing code
          return {
            success: false,
            error: response.error?.message || 'Unknown error',
            errors: response.error?.context?.validationErrors || [response.error?.message]
          };
        }
      } catch (error) {
        this._logger(`[IPCBridge] Error handling ${channel}:`, error);
        return {
          success: false,
          error: error.message,
          errors: [error.message]
        };
      }
    });

    this._registeredChannels.add(channel);
  }

  /**
   * Deactivates the bridge, removing all ipcMain handlers
   */
  deactivate() {
    if (!this._bridgeActive) {
      return;
    }

    for (const channel of this._registeredChannels) {
      try {
        ipcMain.removeHandler(channel);
      } catch (error) {
        this._logger(`[IPCBridge] Error removing handler for ${channel}:`, error);
      }
    }

    this._registeredChannels.clear();
    this._bridgeActive = false;
    console.log('[IPCBridge] Deactivated');
  }

  /**
   * Registers a new channel dynamically
   * @param {string} channel - Channel name
   */
  registerChannel(channel) {
    if (!this._bridgeActive) {
      console.warn('[IPCBridge] Bridge is not active, channel will be registered on activation');
      return;
    }

    if (!this._ipcRouter.hasChannel(channel)) {
      throw new Error(`Channel "${channel}" is not registered in IPCRouter`);
    }

    this._registerChannel(channel);
  }

  /**
   * Unregisters a channel
   * @param {string} channel - Channel name
   */
  unregisterChannel(channel) {
    if (!this._registeredChannels.has(channel)) {
      return;
    }

    try {
      ipcMain.removeHandler(channel);
      this._registeredChannels.delete(channel);
    } catch (error) {
      this._logger(`[IPCBridge] Error unregistering channel ${channel}:`, error);
    }
  }

  /**
   * Gets all registered channels
   * @returns {string[]}
   */
  getRegisteredChannels() {
    return Array.from(this._registeredChannels);
  }

  /**
   * Checks if the bridge is active
   * @returns {boolean}
   */
  isActive() {
    return this._bridgeActive;
  }

  /**
   * Gets bridge status
   * @returns {Object}
   */
  getStatus() {
    return {
      active: this._bridgeActive,
      registeredChannels: this._registeredChannels.size,
      channels: Array.from(this._registeredChannels)
    };
  }
}

/**
 * Creates an IPCBridge instance
 * @param {Object} options - Configuration options
 * @returns {IPCBridge}
 */
function createIPCBridge(options) {
  return new IPCBridge(options);
}

module.exports = {
  IPCBridge,
  createIPCBridge
};
