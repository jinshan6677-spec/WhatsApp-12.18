/**
 * 为所有现有账号启用翻译功能
 * 运行方式: node scripts/enable-translation-for-all-accounts.js
 */

const { app } = require('electron');
const Store = require('electron-store');
const path = require('path');

// 如果不在 Electron 环境中，使用当前目录
const userDataPath = app ? app.getPath('userData') : process.cwd();

console.log('User data path:', userDataPath);

// 初始化 store
const store = new Store({
  name: 'accounts',
  cwd: userDataPath
});

// 获取所有账号
const accounts = store.get('accounts', {});
const accountIds = Object.keys(accounts);

console.log(`Found ${accountIds.length} accounts`);

if (accountIds.length === 0) {
  console.log('No accounts found. Nothing to update.');
  process.exit(0);
}

// 更新每个账号的翻译配置
let updatedCount = 0;

for (const accountId of accountIds) {
  const account = accounts[accountId];
  
  // 如果账号没有翻译配置或翻译未启用，则启用它
  if (!account.translation) {
    account.translation = {
      enabled: true,
      targetLanguage: 'zh-CN',
      engine: 'google',
      apiKey: '',
      autoTranslate: false,
      translateInput: false,
      friendSettings: {}
    };
    updatedCount++;
    console.log(`✓ Enabled translation for account: ${account.name || accountId}`);
  } else if (!account.translation.enabled) {
    account.translation.enabled = true;
    updatedCount++;
    console.log(`✓ Enabled translation for account: ${account.name || accountId}`);
  } else {
    console.log(`- Translation already enabled for account: ${account.name || accountId}`);
  }
}

// 保存更新后的配置
if (updatedCount > 0) {
  store.set('accounts', accounts);
  console.log(`\n✓ Successfully updated ${updatedCount} account(s)`);
  console.log('Please restart the application for changes to take effect.');
} else {
  console.log('\nNo accounts needed updating.');
}
