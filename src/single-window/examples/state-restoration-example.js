/**
 * Example: View State Persistence and Restoration
 * 
 * This example demonstrates how to use the view state persistence features
 * to save and restore the active account and sidebar width across app restarts.
 */

const { app } = require('electron');
const MainWindow = require('../MainWindow');
const ViewManager = require('../ViewManager');
const SessionManager = require('../../managers/SessionManager');
const AccountConfigManager = require('../../managers/AccountConfigManager');

/**
 * Example initialization with state restoration
 */
async function initializeWithStateRestoration() {
  // 1. Initialize MainWindow
  const mainWindow = new MainWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600
  });
  
  mainWindow.initialize();
  
  // 2. Initialize SessionManager
  const sessionManager = new SessionManager({
    userDataPath: app.getPath('userData')
  });
  
  // 3. Initialize ViewManager
  const viewManager = new ViewManager(mainWindow, sessionManager);
  
  // 4. Initialize AccountConfigManager
  const accountManager = new AccountConfigManager({
    cwd: app.getPath('userData')
  });
  
  // 5. Load accounts
  const accounts = await accountManager.loadAccounts();
  console.log(`Loaded ${accounts.length} accounts`);
  
  // 6. Restore sidebar width (automatically done by MainWindow)
  const sidebarWidth = mainWindow.getSidebarWidth();
  console.log(`Restored sidebar width: ${sidebarWidth}px`);
  
  // 7. Restore active account from saved state
  const accountIds = accounts.map(acc => acc.id);
  const restoreResult = await viewManager.restoreActiveAccount(accountIds);
  
  if (restoreResult.success) {
    console.log(`Successfully restored active account: ${restoreResult.accountId}`);
  } else {
    console.log(`Could not restore active account: ${restoreResult.reason}`);
    
    // If no saved account or account not found, activate the first account
    if (accounts.length > 0) {
      const firstAccountId = accounts[0].id;
      console.log(`Activating first account: ${firstAccountId}`);
      
      const switchResult = await viewManager.switchView(firstAccountId, {
        createIfMissing: true,
        viewConfig: {
          url: 'https://web.whatsapp.com'
        }
      });
      
      if (switchResult.success) {
        console.log('First account activated successfully');
      }
    }
  }
  
  return {
    mainWindow,
    viewManager,
    sessionManager,
    accountManager
  };
}

/**
 * Example: Manual state saving
 */
function exampleManualStateSaving(viewManager, mainWindow) {
  // Active account ID is automatically saved when switching views
  // But you can also manually check the saved state:
  
  const savedAccountId = viewManager.getSavedActiveAccountId();
  console.log(`Currently saved active account: ${savedAccountId}`);
  
  // Sidebar width is automatically saved when resized
  // But you can also manually get/set it:
  
  const currentSidebarWidth = mainWindow.getSidebarWidth();
  console.log(`Current sidebar width: ${currentSidebarWidth}px`);
  
  // To manually set sidebar width (will be persisted):
  mainWindow.setSidebarWidth(320);
  console.log('Sidebar width updated to 320px');
}

/**
 * Example: Handling account switching with state persistence
 */
async function exampleAccountSwitching(viewManager, accountId) {
  // When you switch accounts, the active account ID is automatically saved
  const result = await viewManager.switchView(accountId, {
    createIfMissing: true
  });
  
  if (result.success) {
    console.log(`Switched to account ${accountId}`);
    console.log('Active account ID has been automatically saved');
    
    // Verify it was saved
    const savedId = viewManager.getSavedActiveAccountId();
    console.log(`Verified saved account ID: ${savedId}`);
  }
  
  return result;
}

/**
 * Example: Complete app lifecycle with state management
 */
async function completeLifecycleExample() {
  console.log('=== App Startup ===');
  
  // Initialize with state restoration
  const { mainWindow, viewManager, accountManager } = await initializeWithStateRestoration();
  
  console.log('\n=== During Runtime ===');
  
  // Simulate user switching accounts
  const accounts = await accountManager.loadAccounts();
  if (accounts.length > 1) {
    await exampleAccountSwitching(viewManager, accounts[1].id);
  }
  
  // Simulate user resizing sidebar
  mainWindow.setSidebarWidth(350);
  console.log('User resized sidebar to 350px (automatically saved)');
  
  console.log('\n=== App Shutdown ===');
  
  // On shutdown, state is already persisted
  // Active account ID: saved when last switched
  // Sidebar width: saved when last resized
  // Window bounds: saved by MainWindow on move/resize
  
  console.log('State has been automatically persisted throughout the session');
  console.log('On next startup, all state will be restored');
  
  // Clean up
  await viewManager.destroyAllViews();
  mainWindow.close();
}

/**
 * Example: Checking what state is currently saved
 */
function exampleCheckSavedState(viewManager, mainWindow) {
  console.log('=== Current Saved State ===');
  
  // Get state store from MainWindow
  const stateStore = mainWindow.getStateStore();
  
  // Check all saved state
  const savedState = {
    activeAccountId: stateStore.get('activeAccountId'),
    sidebarWidth: stateStore.get('sidebarWidth'),
    windowBounds: stateStore.get('bounds'),
    isMaximized: stateStore.get('isMaximized')
  };
  
  console.log('Saved state:', JSON.stringify(savedState, null, 2));
  
  return savedState;
}

// Export examples
module.exports = {
  initializeWithStateRestoration,
  exampleManualStateSaving,
  exampleAccountSwitching,
  completeLifecycleExample,
  exampleCheckSavedState
};

// If run directly, execute the complete lifecycle example
if (require.main === module) {
  app.whenReady().then(async () => {
    try {
      await completeLifecycleExample();
    } catch (error) {
      console.error('Example failed:', error);
      app.quit();
    }
  });
}
