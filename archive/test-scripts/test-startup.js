/**
 * Test if the application can start without errors
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

let testPassed = false;

app.on('ready', async () => {
  try {
    console.log('[Test] Starting application initialization test...');
    
    // Load the main application
    require('./src/main-refactored.js');
    
    // Wait a bit for initialization
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('[Test] ✓ Application initialized successfully');
    testPassed = true;
    
    // Exit after test
    setTimeout(() => {
      console.log('[Test] Test completed, exiting...');
      app.quit();
    }, 1000);
    
  } catch (error) {
    console.error('[Test] ✗ Application initialization failed:', error);
    process.exit(1);
  }
});

app.on('window-all-closed', () => {
  // Don't quit on window close during test
});

app.on('will-quit', () => {
  if (testPassed) {
    console.log('[Test] ✓ All tests passed');
    process.exit(0);
  } else {
    console.log('[Test] ✗ Tests failed');
    process.exit(1);
  }
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('[Test] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('[Test] Unhandled rejection:', error);
  process.exit(1);
});
