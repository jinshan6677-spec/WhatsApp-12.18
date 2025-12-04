/**
 * Check current account configurations
 */

const { app } = require('electron');
const AccountConfigManager = require('../src/managers/AccountConfigManager');

app.whenReady().then(async () => {
  try {
    console.log('\n=== Current Account Configurations ===\n');
    
    const accountManager = new AccountConfigManager({
      cwd: app.getPath('userData')
    });

    const accounts = await accountManager.loadAccounts({ sorted: true });
    
    console.log(`Total accounts: ${accounts.length}\n`);
    
    if (accounts.length === 0) {
      console.log('No accounts configured.');
    } else {
      accounts.forEach((account, index) => {
        console.log(`${index + 1}. ${account.name}`);
        console.log(`   ID: ${account.id}`);
        console.log(`   Note: ${account.note || '(none)'}`);
        console.log(`   Auto Start: ${account.autoStart || false}`);
        console.log(`   Created: ${account.createdAt}`);
        console.log(`   Last Active: ${account.lastActiveAt || '(never)'}`);
        console.log('');
      });
    }
    
    console.log('Config file:', accountManager.getConfigPath());
    console.log('');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    app.quit();
  }
});

app.on('window-all-closed', () => {});
