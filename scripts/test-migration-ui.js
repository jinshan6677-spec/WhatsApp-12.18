/**
 * Test script for migration UI
 * Tests the migration dialog and progress feedback
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const MigrationManager = require('../src/single-window/migration/MigrationManager');
const MigrationDialog = require('../src/single-window/migration/MigrationDialog');

let mainWindow = null;
let migrationDialog = null;

/**
 * Create main window (for testing purposes)
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  mainWindow.loadURL('about:blank');
  
  console.log('Main window created');
}

/**
 * Test migration UI
 */
async function testMigrationUI() {
  console.log('\n=== Testing Migration UI ===\n');
  
  try {
    // Create migration manager
    const migrationManager = new MigrationManager({
      userDataPath: app.getPath('userData')
    });
    
    console.log('1. Checking if migration is needed...');
    const detection = await migrationManager.detectMigrationNeeded();
    console.log('   Detection result:', detection);
    
    // Create migration dialog
    console.log('\n2. Creating migration dialog...');
    migrationDialog = new MigrationDialog({
      width: 700,
      height: 600,
      parent: mainWindow
    });
    
    console.log('   Migration dialog created');
    
    // Show migration dialog
    console.log('\n3. Showing migration dialog...');
    await migrationDialog.show(migrationManager);
    console.log('   Migration dialog shown');
    
    console.log('\n✓ Migration UI test completed');
    console.log('\nThe migration dialog should now be visible.');
    console.log('You can:');
    console.log('  - Click "Start Migration" to begin the migration process');
    console.log('  - Click "Cancel" to close the dialog');
    console.log('\nThe dialog will show:');
    console.log('  - Detection screen with migration information');
    console.log('  - Progress screen with real-time updates');
    console.log('  - Results screen with migration summary');
    
  } catch (error) {
    console.error('\n✗ Migration UI test failed:', error);
    console.error(error.stack);
    app.quit();
  }
}

/**
 * App ready handler
 */
app.on('ready', async () => {
  console.log('Electron app ready');
  
  // Create main window
  createMainWindow();
  
  // Wait a moment for window to be ready
  setTimeout(async () => {
    await testMigrationUI();
  }, 500);
});

/**
 * Handle all windows closed
 */
app.on('window-all-closed', () => {
  console.log('\nAll windows closed, quitting app');
  app.quit();
});

/**
 * Handle app activation (macOS)
 */
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

