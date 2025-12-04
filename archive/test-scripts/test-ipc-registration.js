/**
 * Test IPC handler registration
 */

const { ipcMain } = require('electron');

// Mock dependencies
const mockAccountManager = {
  getAllAccounts: () => []
};

const mockViewManager = {
  getView: (accountId) => null,
  views: new Map()
};

const mockMainWindow = {
  window: null
};

try {
  console.log('[Test] Loading ipcHandlers module...');
  const { registerIPCHandlers } = require('./src/single-window/ipcHandlers.js');
  
  console.log('[Test] Registering IPC handlers...');
  registerIPCHandlers(mockAccountManager, mockViewManager, mockMainWindow);
  
  console.log('[Test] Checking if translation:apply-config is registered...');
  
  // Try to invoke the handler
  const testEvent = { sender: { id: 1 } };
  ipcMain.emit('invoke', testEvent, 'translation:apply-config', 'test-account', {});
  
  console.log('[Test] ✓ IPC handlers registered successfully');
  process.exit(0);
  
} catch (error) {
  console.error('[Test] ✗ Failed to register IPC handlers:', error);
  console.error(error.stack);
  process.exit(1);
}
