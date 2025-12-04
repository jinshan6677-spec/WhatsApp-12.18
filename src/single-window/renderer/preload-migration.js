/**
 * Preload script for the migration dialog window
 * Exposes secure IPC communication to the renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for migration dialog
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Send message to main process
   */
  send: (channel, data) => {
    // Whitelist of allowed channels
    const validChannels = [
      'migration:cancel',
      'migration:continue',
      'migration:open-backup',
      'close-window'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  /**
   * Receive message from main process
   */
  on: (channel, callback) => {
    // Whitelist of allowed channels
    const validChannels = [
      'migration:progress',
      'migration:log',
      'migration:complete',
      'migration:error'
    ];
    
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  /**
   * Invoke method on main process and wait for response
   */
  invoke: async (channel, ...args) => {
    // Whitelist of allowed channels
    const validChannels = [
      'migration:start',
      'migration:get-status'
    ];
    
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, ...args);
    }
    
    throw new Error(`Invalid channel: ${channel}`);
  },

  /**
   * Remove listener
   */
  removeListener: (channel, callback) => {
    const validChannels = [
      'migration:progress',
      'migration:log',
      'migration:complete',
      'migration:error'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  }
});

// Log that preload script has loaded
console.log('Migration dialog preload script loaded');

