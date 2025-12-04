/**
 * Test Auto-Start Functionality
 * 
 * This script tests the auto-start feature by:
 * 1. Loading all accounts
 * 2. Checking which accounts have autoStart enabled
 * 3. Verifying the autoStart configuration
 */

const path = require('path');
const fs = require('fs');

// Get user data path
const userDataPath = process.env.APPDATA || 
  (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : 
   path.join(process.env.HOME, '.config'));

const appDataPath = path.join(userDataPath, 'whatsapp-desktop');
const accountsFile = path.join(appDataPath, 'accounts.json');

console.log('=== Auto-Start Configuration Test ===\n');
console.log(`User Data Path: ${appDataPath}`);
console.log(`Accounts File: ${accountsFile}\n`);

// Check if accounts file exists
if (!fs.existsSync(accountsFile)) {
  console.log('❌ Accounts file not found!');
  console.log('   Please create at least one account first.');
  process.exit(1);
}

// Load accounts
try {
  const accountsData = fs.readFileSync(accountsFile, 'utf8');
  const accounts = JSON.parse(accountsData);

  console.log(`Found ${accounts.length} account(s):\n`);

  let autoStartCount = 0;
  accounts.forEach((account, index) => {
    console.log(`${index + 1}. ${account.name} (${account.id})`);
    console.log(`   Auto-Start: ${account.autoStart ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Keep-Alive: ${account.keepAlive !== undefined ? (account.keepAlive ? '✅ Yes' : '❌ No') : '⚠️  Not set'}`);
    console.log(`   Last Running Status: ${account.lastRunningStatus || 'null'}`);
    console.log(`   Created: ${new Date(account.createdAt).toLocaleString()}`);
    console.log(`   Last Active: ${new Date(account.lastActiveAt).toLocaleString()}`);
    console.log('');

    if (account.autoStart) {
      autoStartCount++;
    }
  });

  console.log('=== Summary ===');
  console.log(`Total Accounts: ${accounts.length}`);
  console.log(`Auto-Start Enabled: ${autoStartCount}`);
  console.log(`Auto-Start Disabled: ${accounts.length - autoStartCount}`);

  if (autoStartCount === 0) {
    console.log('\n⚠️  No accounts have auto-start enabled.');
    console.log('   To enable auto-start for an account:');
    console.log('   1. Open the application');
    console.log('   2. Click the edit button (✏️) next to an account');
    console.log('   3. Check the "应用启动时自动启动此账号" checkbox');
    console.log('   4. Save the changes');
  } else {
    console.log(`\n✅ ${autoStartCount} account(s) will auto-start when the application launches.`);
  }

} catch (error) {
  console.error('❌ Error reading accounts file:', error.message);
  process.exit(1);
}
