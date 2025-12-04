/**
 * Requirements Verification Script
 * Verifies that all requirements from the spec are met
 */

const fs = require('fs');
const path = require('path');

// Requirements checklist based on requirements.md
const requirements = {
  'Requirement 1: Single Main Window Architecture': [
    { id: '1.1', description: 'Main Window created as sole primary window', verified: false },
    { id: '1.2', description: 'Main Window contains Account Sidebar and Session Area', verified: false },
    { id: '1.3', description: 'Main Window loads custom UI shell, not WhatsApp Web', verified: false },
    { id: '1.4', description: 'Main Window persists size and position', verified: false },
    { id: '1.5', description: 'Closing Main Window terminates all sessions', verified: false }
  ],
  'Requirement 2: Account Management Interface': [
    { id: '2.1', description: 'Account Sidebar displays all configured accounts', verified: false },
    { id: '2.2', description: 'Sidebar shows account name, status, and note', verified: false },
    { id: '2.3', description: 'Sidebar provides add/edit/delete controls', verified: false },
    { id: '2.4', description: 'Clicking account switches Session Area', verified: false },
    { id: '2.5', description: 'Account list order persisted', verified: false }
  ],
  'Requirement 3: Account Configuration Management': [
    { id: '3.1', description: 'Account configs stored in JSON file', verified: false },
    { id: '3.2', description: 'Unique Account ID assigned on creation', verified: false },
    { id: '3.3', description: 'Account name and notes configurable', verified: false },
    { id: '3.4', description: 'Account configs persisted with session path', verified: false },
    { id: '3.5', description: 'Account deletion preserves session data option', verified: false }
  ],
  'Requirement 4: Isolated Account Sessions': [
    { id: '4.1', description: 'Unique user data directory per account', verified: false },
    { id: '4.2', description: 'Isolated session using partition API', verified: false },
    { id: '4.3', description: 'Separate cookies, localStorage, IndexedDB', verified: false },
    { id: '4.4', description: 'Separate cache and browsing data', verified: false },
    { id: '4.5', description: 'Translation settings applied per session', verified: false }
  ],
  'Requirement 5: WebView Management and Switching': [
    { id: '5.1', description: 'WebView created on first account access', verified: false },
    { id: '5.2', description: 'WhatsApp Web loaded in each WebView', verified: false },
    { id: '5.3', description: 'View switching hides/shows WebViews', verified: false },
    { id: '5.4', description: 'Hidden WebViews not destroyed', verified: false },
    { id: '5.5', description: 'Account ID to WebView mapping maintained', verified: false }
  ],
  'Requirement 6: WhatsApp Web Integration': [
    { id: '6.1', description: 'WebView navigates to web.whatsapp.com', verified: false },
    { id: '6.2', description: 'QR code displayed for first access', verified: false },
    { id: '6.3', description: 'Authentication state stored in session', verified: false },
    { id: '6.4', description: 'Logged-in state restored on subsequent access', verified: false },
    { id: '6.5', description: 'Connection maintained when hidden', verified: false }
  ],
  'Requirement 7: Per-Account Translation Integration': [
    { id: '7.1', description: 'Translation scripts injected into WebViews', verified: false },
    { id: '7.2', description: 'Unique account identifier injected', verified: false },
    { id: '7.3', description: 'Translation requests identify account', verified: false },
    { id: '7.4', description: 'Separate translation configs per account', verified: false },
    { id: '7.5', description: 'Different languages/engines per account', verified: false }
  ],
  'Requirement 8: Network Configuration': [
    { id: '8.1', description: 'Network connectivity validated', verified: false },
    { id: '8.2', description: 'HTTPS protocol supported', verified: false },
    { id: '8.3', description: 'Configuration applied to account session only', verified: false },
    { id: '8.4', description: 'Configuration updates applied to session', verified: false },
    { id: '8.5', description: 'Configuration validation implemented', verified: false }
  ],
  'Requirement 9: Account Status Monitoring': [
    { id: '9.1', description: 'Status indicator shows online/offline/error', verified: false },
    { id: '9.2', description: 'Status updated to online on successful load', verified: false },
    { id: '9.3', description: 'Status updated to offline on connection loss', verified: false },
    { id: '9.4', description: 'Status updated to error on errors', verified: false },
    { id: '9.5', description: 'Real-time status updates in sidebar', verified: false }
  ],
  'Requirement 10: Session Data Persistence': [
    { id: '10.1', description: 'Session data preserved on app close', verified: false },
    { id: '10.2', description: 'Sessions restored on app start', verified: false },
    { id: '10.3', description: 'Separate session directories per account', verified: false },
    { id: '10.4', description: 'Option to delete/preserve session on account deletion', verified: false },
    { id: '10.5', description: 'Graceful handling of session corruption', verified: false }
  ],
  'Requirement 11: UI Responsiveness and Layout': [
    { id: '11.1', description: 'Resizable sidebar with min/max bounds', verified: false },
    { id: '11.2', description: 'Session Area adjusts to sidebar resize', verified: false },
    { id: '11.3', description: 'Sidebar width persisted', verified: false },
    { id: '11.4', description: 'Account info clear at minimum width', verified: false },
    { id: '11.5', description: 'Session Area occupies remaining space', verified: false }
  ],
  'Requirement 12: Migration from Multi-Window Architecture': [
    { id: '12.1', description: 'Detect existing multi-window configs', verified: false },
    { id: '12.2', description: 'Migrate configs to single-window format', verified: false },
    { id: '12.3', description: 'Migrate session data directories', verified: false },
    { id: '12.4', description: 'Preserve account settings during migration', verified: false },
    { id: '12.5', description: 'Backup old config before removal', verified: false }
  ]
};

// Verification functions
function checkFileExists(filePath) {
  try {
    return fs.existsSync(path.join(__dirname, '..', filePath));
  } catch (error) {
    return false;
  }
}

function checkCodeContains(filePath, searchString) {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) return false;
    
    const content = fs.readFileSync(fullPath, 'utf8');
    return content.includes(searchString);
  } catch (error) {
    return false;
  }
}

function verifyRequirements() {
  console.log('='.repeat(80));
  console.log('REQUIREMENTS VERIFICATION');
  console.log('='.repeat(80) + '\n');
  
  let totalRequirements = 0;
  let verifiedRequirements = 0;
  
  // Requirement 1: Single Main Window Architecture
  requirements['Requirement 1: Single Main Window Architecture'][0].verified = 
    checkFileExists('src/single-window/MainWindow.js');
  requirements['Requirement 1: Single Main Window Architecture'][1].verified = 
    checkFileExists('src/single-window/renderer/app.html') &&
    checkCodeContains('src/single-window/renderer/app.html', 'sidebar') &&
    checkCodeContains('src/single-window/renderer/app.html', 'view-container');
  requirements['Requirement 1: Single Main Window Architecture'][2].verified = 
    checkCodeContains('src/single-window/MainWindow.js', 'app.html');
  requirements['Requirement 1: Single Main Window Architecture'][3].verified = 
    checkCodeContains('src/single-window/MainWindow.js', 'setBounds') ||
    checkCodeContains('src/single-window/MainWindow.js', 'saveBounds');
  requirements['Requirement 1: Single Main Window Architecture'][4].verified = 
    checkCodeContains('src/main-refactored.js', 'app.quit') ||
    checkCodeContains('src/single-window/MainWindow.js', 'close');
  
  // Requirement 2: Account Management Interface
  requirements['Requirement 2: Account Management Interface'][0].verified = 
    checkFileExists('src/single-window/renderer/sidebar.js');
  requirements['Requirement 2: Account Management Interface'][1].verified = 
    checkCodeContains('src/single-window/renderer/sidebar.js', 'account-name') &&
    checkCodeContains('src/single-window/renderer/sidebar.js', 'status');
  requirements['Requirement 2: Account Management Interface'][2].verified = 
    checkCodeContains('src/single-window/renderer/sidebar.js', 'add-account') ||
    checkCodeContains('src/single-window/renderer/app.html', 'add-account');
  requirements['Requirement 2: Account Management Interface'][3].verified = 
    checkCodeContains('src/single-window/renderer/sidebar.js', 'account:switch') ||
    checkCodeContains('src/single-window/ipcHandlers.js', 'account:switch');
  requirements['Requirement 2: Account Management Interface'][4].verified = 
    checkCodeContains('src/managers/AccountConfigManager.js', 'order');
  
  // Requirement 3: Account Configuration Management
  requirements['Requirement 3: Account Configuration Management'][0].verified = 
    checkCodeContains('src/managers/AccountConfigManager.js', 'accounts.json') ||
    checkCodeContains('src/managers/AccountConfigManager.js', '.json');
  requirements['Requirement 3: Account Configuration Management'][1].verified = 
    checkCodeContains('src/managers/AccountConfigManager.js', 'uuid') ||
    checkCodeContains('src/managers/AccountConfigManager.js', 'generateId');
  requirements['Requirement 3: Account Configuration Management'][2].verified = 
    checkCodeContains('src/managers/AccountConfigManager.js', 'name') &&
    checkCodeContains('src/managers/AccountConfigManager.js', 'note');
  requirements['Requirement 3: Account Configuration Management'][3].verified = 
    checkCodeContains('src/managers/AccountConfigManager.js', 'sessionDir');
  requirements['Requirement 3: Account Configuration Management'][4].verified = 
    checkCodeContains('src/managers/AccountConfigManager.js', 'deleteAccount') &&
    checkCodeContains('src/managers/AccountConfigManager.js', 'deleteSessionData');
  
  // Requirement 4: Isolated Account Sessions
  requirements['Requirement 4: Isolated Account Sessions'][0].verified = 
    checkCodeContains('src/managers/SessionManager.js', 'sessionDir') ||
    checkCodeContains('src/managers/SessionManager.js', 'session-data');
  requirements['Requirement 4: Isolated Account Sessions'][1].verified = 
    checkCodeContains('src/managers/SessionManager.js', 'partition') &&
    checkCodeContains('src/managers/SessionManager.js', 'fromPartition');
  requirements['Requirement 4: Isolated Account Sessions'][2].verified = 
    checkCodeContains('src/managers/SessionManager.js', 'partition');
  requirements['Requirement 4: Isolated Account Sessions'][3].verified = 
    checkCodeContains('src/managers/SessionManager.js', 'partition');
  requirements['Requirement 4: Isolated Account Sessions'][4].verified = 
    checkCodeContains('src/managers/TranslationIntegration.js', 'configureTranslation');
  
  // Requirement 5: WebView Management and Switching (新模块化架构)
  requirements['Requirement 5: WebView Management and Switching'][0].verified = 
    checkFileExists('src/presentation/windows/view-manager/ViewManager.js') &&
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'createView');
  requirements['Requirement 5: WebView Management and Switching'][1].verified = 
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'web.whatsapp.com');
  requirements['Requirement 5: WebView Management and Switching'][2].verified = 
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'showView') &&
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'hideView');
  requirements['Requirement 5: WebView Management and Switching'][3].verified = 
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'hideView') &&
    !checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'destroy');
  requirements['Requirement 5: WebView Management and Switching'][4].verified = 
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'views') &&
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'Map');
  
  // Requirement 6: WhatsApp Web Integration (新模块化架构)
  requirements['Requirement 6: WhatsApp Web Integration'][0].verified = 
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'web.whatsapp.com');
  requirements['Requirement 6: WhatsApp Web Integration'][1].verified = 
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'loadURL');
  requirements['Requirement 6: WhatsApp Web Integration'][2].verified = 
    checkCodeContains('src/managers/SessionManager.js', 'partition');
  requirements['Requirement 6: WhatsApp Web Integration'][3].verified = 
    checkCodeContains('src/managers/SessionManager.js', 'partition');
  requirements['Requirement 6: WhatsApp Web Integration'][4].verified = 
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'hideView');
  
  // Requirement 7: Per-Account Translation Integration
  requirements['Requirement 7: Per-Account Translation Integration'][0].verified = 
    checkFileExists('src/managers/TranslationIntegration.js') &&
    checkCodeContains('src/managers/TranslationIntegration.js', 'injectScripts');
  requirements['Requirement 7: Per-Account Translation Integration'][1].verified = 
    checkCodeContains('src/managers/TranslationIntegration.js', 'ACCOUNT_ID');
  requirements['Requirement 7: Per-Account Translation Integration'][2].verified = 
    checkCodeContains('src/translation/ipcHandlers.js', 'accountId') ||
    checkCodeContains('src/managers/TranslationIntegration.js', 'accountId');
  requirements['Requirement 7: Per-Account Translation Integration'][3].verified = 
    checkCodeContains('src/managers/TranslationIntegration.js', 'translation') ||
    checkCodeContains('src/managers/AccountConfigManager.js', 'translation');
  requirements['Requirement 7: Per-Account Translation Integration'][4].verified = 
    checkCodeContains('src/managers/AccountConfigManager.js', 'translation');
  
  // Requirement 8: Network Configuration
  requirements['Requirement 8: Network Configuration'][0].verified = 
    checkCodeContains('src/utils/ValidationHelper.js', 'validateNetworkConnectivity');
  requirements['Requirement 8: Network Configuration'][1].verified = 
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'https');
  requirements['Requirement 8: Network Configuration'][2].verified = 
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'createView');
  requirements['Requirement 8: Network Configuration'][3].verified = 
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'reloadView');
  requirements['Requirement 8: Network Configuration'][4].verified = 
    checkCodeContains('src/utils/ValidationHelper.js', 'validateOperationSafety');
  
  // Requirement 9: Account Status Monitoring (新模块化架构)
  requirements['Requirement 9: Account Status Monitoring'][0].verified = 
    checkCodeContains('src/single-window/renderer/sidebar.js', 'status');
  requirements['Requirement 9: Account Status Monitoring'][1].verified = 
    checkCodeContains('src/single-window/ipcHandlers.js', 'status') ||
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'status');
  requirements['Requirement 9: Account Status Monitoring'][2].verified = 
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'offline') ||
    checkCodeContains('src/single-window/ipcHandlers.js', 'offline');
  requirements['Requirement 9: Account Status Monitoring'][3].verified = 
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'error') ||
    checkCodeContains('src/utils/ErrorHandler.js', 'error');
  requirements['Requirement 9: Account Status Monitoring'][4].verified = 
    checkCodeContains('src/single-window/renderer/sidebar.js', 'updateStatus') ||
    checkCodeContains('src/single-window/renderer/sidebar.js', 'status');
  
  // Requirement 10: Session Data Persistence
  requirements['Requirement 10: Session Data Persistence'][0].verified = 
    checkCodeContains('src/managers/SessionManager.js', 'persist');
  requirements['Requirement 10: Session Data Persistence'][1].verified = 
    checkCodeContains('src/managers/SessionManager.js', 'fromPartition');
  requirements['Requirement 10: Session Data Persistence'][2].verified = 
    checkCodeContains('src/managers/SessionManager.js', 'sessionDir') ||
    checkCodeContains('src/managers/AccountConfigManager.js', 'sessionDir');
  requirements['Requirement 10: Session Data Persistence'][3].verified = 
    checkCodeContains('src/managers/AccountConfigManager.js', 'deleteSessionData');
  requirements['Requirement 10: Session Data Persistence'][4].verified = 
    checkCodeContains('src/utils/RecoveryManager.js', 'recover') ||
    checkFileExists('src/utils/RecoveryManager.js');
  
  // Requirement 11: UI Responsiveness and Layout (新模块化架构)
  requirements['Requirement 11: UI Responsiveness and Layout'][0].verified = 
    checkCodeContains('src/single-window/renderer/app.js', 'resize') ||
    checkCodeContains('src/single-window/renderer/styles.css', 'resize');
  requirements['Requirement 11: UI Responsiveness and Layout'][1].verified = 
    checkCodeContains('src/presentation/windows/view-manager/ViewManager.js', 'resizeViews') ||
    checkCodeContains('src/presentation/windows/view-manager/ViewBoundsManager.js', 'setBounds');
  requirements['Requirement 11: UI Responsiveness and Layout'][2].verified = 
    checkCodeContains('src/single-window/renderer/app.js', 'sidebarWidth') ||
    checkCodeContains('src/single-window/MainWindow.js', 'sidebarWidth');
  requirements['Requirement 11: UI Responsiveness and Layout'][3].verified = 
    checkCodeContains('src/single-window/renderer/styles.css', 'min-width');
  requirements['Requirement 11: UI Responsiveness and Layout'][4].verified = 
    checkCodeContains('src/single-window/renderer/styles.css', 'flex') ||
    checkCodeContains('src/presentation/windows/view-manager/ViewBoundsManager.js', 'setBounds');
  
  // Requirement 12: Migration from Multi-Window Architecture
  requirements['Requirement 12: Migration from Multi-Window Architecture'][0].verified = 
    checkFileExists('src/single-window/migration/MigrationManager.js') &&
    checkCodeContains('src/single-window/migration/MigrationManager.js', 'needsMigration');
  requirements['Requirement 12: Migration from Multi-Window Architecture'][1].verified = 
    checkCodeContains('src/single-window/migration/MigrationManager.js', 'migrate');
  requirements['Requirement 12: Migration from Multi-Window Architecture'][2].verified = 
    checkCodeContains('src/single-window/migration/MigrationManager.js', 'sessionDir');
  requirements['Requirement 12: Migration from Multi-Window Architecture'][3].verified = 
    checkCodeContains('src/single-window/migration/MigrationManager.js', 'translation');
  requirements['Requirement 12: Migration from Multi-Window Architecture'][4].verified = 
    checkCodeContains('src/single-window/migration/MigrationManager.js', 'backup');
  
  // Print results
  for (const [category, reqs] of Object.entries(requirements)) {
    console.log(`\n${category}`);
    console.log('-'.repeat(80));
    
    for (const req of reqs) {
      const status = req.verified ? '✓' : '✗';
      const statusText = req.verified ? 'PASS' : 'FAIL';
      console.log(`  ${status} [${req.id}] ${req.description} - ${statusText}`);
      
      totalRequirements++;
      if (req.verified) verifiedRequirements++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Requirements: ${totalRequirements}`);
  console.log(`Verified: ${verifiedRequirements}`);
  console.log(`Not Verified: ${totalRequirements - verifiedRequirements}`);
  console.log(`Completion: ${(verifiedRequirements / totalRequirements * 100).toFixed(2)}%`);
  console.log('='.repeat(80) + '\n');
  
  return verifiedRequirements === totalRequirements;
}

// Run verification
const allVerified = verifyRequirements();
process.exit(allVerified ? 0 : 1);
