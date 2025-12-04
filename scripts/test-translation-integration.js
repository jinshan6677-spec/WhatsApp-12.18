/**
 * Test script for TranslationIntegration with BrowserView support
 * 
 * This script verifies that:
 * 1. TranslationIntegration can be instantiated without instanceManager
 * 2. Script injection works with BrowserView
 * 3. window.ACCOUNT_ID is properly injected
 * 4. Translation scripts are loaded and cached
 * 5. Configuration can be applied to BrowserViews
 */

const { app, BrowserWindow, BrowserView, session } = require('electron');
const path = require('path');
const TranslationIntegration = require('../src/managers/TranslationIntegration');

// Test configuration
const TEST_ACCOUNT_ID = 'test-account-001';
const TEST_CONFIG = {
  enabled: true,
  targetLanguage: 'zh-CN',
  engine: 'google',
  autoTranslate: false,
  translateInput: true,
  friendSettings: {}
};

let mainWindow = null;
let testView = null;
let translationService = null;

/**
 * Create main window for testing
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  console.log('[Test] Main window created');
}

/**
 * Create test BrowserView
 */
function createTestView() {
  // Create isolated session for test account
  const testSession = session.fromPartition(`persist:account_${TEST_ACCOUNT_ID}`);

  // Create BrowserView
  testView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: `persist:account_${TEST_ACCOUNT_ID}`,
      session: testSession
    }
  });

  // Set bounds
  testView.setBounds({ x: 0, y: 0, width: 1200, height: 800 });

  // Attach to main window
  mainWindow.addBrowserView(testView);
  mainWindow.setTopBrowserView(testView);

  console.log('[Test] BrowserView created with session partition:', testSession.partition);
}

/**
 * Test 1: Initialize TranslationIntegration without instanceManager
 */
async function test1_InitializeWithoutInstanceManager() {
  console.log('\n=== Test 1: Initialize TranslationIntegration without instanceManager ===');
  
  try {
    translationService = new TranslationIntegration();
    console.log('[Test] ✓ TranslationIntegration instantiated without instanceManager');
    
    await translationService.initialize();
    console.log('[Test] ✓ TranslationIntegration initialized');
    
    // Check if scripts are cached
    if (translationService.scriptCache.optimizer && translationService.scriptCache.contentScript) {
      console.log('[Test] ✓ Translation scripts loaded to cache');
      console.log('[Test]   - Optimizer script length:', translationService.scriptCache.optimizer.length);
      console.log('[Test]   - Content script length:', translationService.scriptCache.contentScript.length);
    } else {
      throw new Error('Scripts not loaded to cache');
    }
    
    return true;
  } catch (error) {
    console.error('[Test] ✗ Test 1 failed:', error.message);
    return false;
  }
}

/**
 * Test 2: Inject scripts into BrowserView
 */
async function test2_InjectScriptsIntoBrowserView() {
  console.log('\n=== Test 2: Inject scripts into BrowserView ===');
  
  try {
    // Load a test page first
    await testView.webContents.loadURL('https://web.whatsapp.com');
    console.log('[Test] ✓ WhatsApp Web loaded');
    
    // Wait for page to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Inject scripts
    const result = await translationService.injectScripts(TEST_ACCOUNT_ID, testView, TEST_CONFIG);
    
    if (result.success) {
      console.log('[Test] ✓ Scripts injected successfully');
    } else {
      throw new Error(`Script injection failed: ${result.error}`);
    }
    
    // Wait for injection to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify window.ACCOUNT_ID is set
    const accountId = await testView.webContents.executeJavaScript('window.ACCOUNT_ID');
    if (accountId === TEST_ACCOUNT_ID) {
      console.log('[Test] ✓ window.ACCOUNT_ID injected correctly:', accountId);
    } else {
      throw new Error(`window.ACCOUNT_ID mismatch: expected ${TEST_ACCOUNT_ID}, got ${accountId}`);
    }
    
    // Verify WhatsAppTranslation is available
    const hasTranslation = await testView.webContents.executeJavaScript('typeof window.WhatsAppTranslation !== "undefined"');
    if (hasTranslation) {
      console.log('[Test] ✓ window.WhatsAppTranslation is available');
    } else {
      throw new Error('window.WhatsAppTranslation not found');
    }
    
    // Check translation status
    const status = translationService.getTranslationStatus(TEST_ACCOUNT_ID);
    if (status && status.injected) {
      console.log('[Test] ✓ Translation status updated correctly');
      console.log('[Test]   - Injected:', status.injected);
      console.log('[Test]   - Last injection time:', status.lastInjectionTime);
    } else {
      throw new Error('Translation status not updated');
    }
    
    return true;
  } catch (error) {
    console.error('[Test] ✗ Test 2 failed:', error.message);
    return false;
  }
}

/**
 * Test 3: Configure translation for BrowserView
 */
async function test3_ConfigureTranslation() {
  console.log('\n=== Test 3: Configure translation for BrowserView ===');
  
  try {
    const newConfig = {
      ...TEST_CONFIG,
      targetLanguage: 'en',
      autoTranslate: true
    };
    
    const result = await translationService.configureTranslation(TEST_ACCOUNT_ID, newConfig, testView);
    
    if (result.success) {
      console.log('[Test] ✓ Translation configured successfully');
    } else {
      throw new Error(`Configuration failed: ${result.error}`);
    }
    
    // Verify config is stored
    const storedConfig = translationService.getTranslationConfig(TEST_ACCOUNT_ID);
    if (storedConfig && storedConfig.targetLanguage === 'en') {
      console.log('[Test] ✓ Configuration stored correctly');
      console.log('[Test]   - Target language:', storedConfig.targetLanguage);
      console.log('[Test]   - Auto translate:', storedConfig.autoTranslate);
    } else {
      throw new Error('Configuration not stored correctly');
    }
    
    return true;
  } catch (error) {
    console.error('[Test] ✗ Test 3 failed:', error.message);
    return false;
  }
}

/**
 * Test 4: Clear translation cache
 */
async function test4_ClearCache() {
  console.log('\n=== Test 4: Clear translation cache ===');
  
  try {
    const result = await translationService.clearCache(TEST_ACCOUNT_ID, testView);
    
    if (result.success) {
      console.log('[Test] ✓ Cache cleared successfully');
    } else {
      throw new Error(`Cache clear failed: ${result.error}`);
    }
    
    return true;
  } catch (error) {
    console.error('[Test] ✗ Test 4 failed:', error.message);
    return false;
  }
}

/**
 * Test 5: Remove account
 */
async function test5_RemoveAccount() {
  console.log('\n=== Test 5: Remove account ===');
  
  try {
    translationService.removeAccount(TEST_ACCOUNT_ID);
    console.log('[Test] ✓ Account removed');
    
    // Verify config and status are removed
    const config = translationService.getTranslationConfig(TEST_ACCOUNT_ID);
    const status = translationService.getTranslationStatus(TEST_ACCOUNT_ID);
    
    if (!config && !status) {
      console.log('[Test] ✓ Account data cleaned up');
    } else {
      throw new Error('Account data not fully removed');
    }
    
    return true;
  } catch (error) {
    console.error('[Test] ✗ Test 5 failed:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n========================================');
  console.log('Translation Integration BrowserView Test');
  console.log('========================================\n');
  
  const results = {
    total: 5,
    passed: 0,
    failed: 0
  };
  
  // Create test environment
  createMainWindow();
  createTestView();
  
  // Run tests
  if (await test1_InitializeWithoutInstanceManager()) results.passed++;
  else results.failed++;
  
  if (await test2_InjectScriptsIntoBrowserView()) results.passed++;
  else results.failed++;
  
  if (await test3_ConfigureTranslation()) results.passed++;
  else results.failed++;
  
  if (await test4_ClearCache()) results.passed++;
  else results.failed++;
  
  if (await test5_RemoveAccount()) results.passed++;
  else results.failed++;
  
  // Print summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');
  console.log(`Total tests: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log('========================================\n');
  
  // Cleanup
  if (testView && !testView.webContents.isDestroyed()) {
    testView.webContents.destroy();
  }
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  
  // Exit
  setTimeout(() => {
    app.quit();
  }, 1000);
}

// App lifecycle
app.whenReady().then(() => {
  runTests().catch(error => {
    console.error('[Test] Fatal error:', error);
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
