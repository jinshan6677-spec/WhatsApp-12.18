/**
 * System IPC Handlers
 * 
 * Handles IPC communication for system-level operations:
 * - Sidebar resize
 * - Window resize
 * - Layout management
 * 
 * @module presentation/ipc/handlers/SystemIPCHandlers
 */

'use strict';

const { ipcMain } = require('electron');

// Store references for cleanup
let _viewManager = null;
let _mainWindow = null;

/**
 * Register system IPC handlers
 * @param {Object} dependencies - Handler dependencies
 */
function register(dependencies) {
  const { viewManager, mainWindow } = dependencies;
  
  _viewManager = viewManager;
  _mainWindow = mainWindow;

  // Handle sidebar resize event
  ipcMain.on('sidebar-resized', (event, sidebarWidth) => {
    try {
      if (typeof sidebarWidth !== 'number' || sidebarWidth <= 0) {
        console.warn('[IPC:System] Invalid sidebar width:', sidebarWidth);
        return;
      }

      // Save the new sidebar width
      mainWindow.setSidebarWidth(sidebarWidth);

      // Update all view bounds with debouncing
      viewManager.resizeViews(sidebarWidth);

      console.log(`[IPC:System] Sidebar resized to ${sidebarWidth}px`);
    } catch (error) {
      console.error('[IPC:System] Failed to handle sidebar resize:', error);
    }
  });

  // Handle window resize event from renderer
  ipcMain.on('window-resize-complete', () => {
    try {
      // Handle window resize with debouncing
      viewManager.handleWindowResize();

      console.log('[IPC:System] Window resize handled');
    } catch (error) {
      console.error('[IPC:System] Failed to handle window resize:', error);
    }
  });

  // Get saved sidebar width
  ipcMain.handle('get-sidebar-width', () => {
    try {
      const sidebarWidth = mainWindow.getSidebarWidth();
      return { success: true, width: sidebarWidth };
    } catch (error) {
      console.error('[IPC:System] Failed to get sidebar width:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC:System] System handlers registered');
}

/**
 * Unregister system IPC handlers
 */
function unregister() {
  ipcMain.removeHandler('get-sidebar-width');
  ipcMain.removeAllListeners('sidebar-resized');
  ipcMain.removeAllListeners('window-resize-complete');
  
  _viewManager = null;
  _mainWindow = null;
  
  console.log('[IPC:System] System handlers unregistered');
}

module.exports = {
  register,
  unregister
};
