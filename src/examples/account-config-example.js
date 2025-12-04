/**
 * AccountConfigManager 使用示例
 * 
 * 这个文件展示了如何在实际应用中使用 AccountConfigManager
 */

const AccountConfigManager = require('../managers/AccountConfigManager');
const AccountConfig = require('../models/AccountConfig');
const path = require('path');

/**
 * 示例：基本账号管理
 */
async function basicAccountManagement() {
  console.log('=== 基本账号管理示例 ===\n');

  // 创建管理器实例
  const manager = new AccountConfigManager({
    configName: 'example-accounts',
    cwd: path.join(__dirname, '../../temp')
  });

  // 1. 创建账号
  console.log('1. 创建新账号...');
  const result1 = await manager.createAccount({
    name: '个人账号',
    translation: {
      enabled: true,
      targetLanguage: 'zh-CN',
      engine: 'google',
      autoTranslate: true
    }
  });

  if (result1.success) {
    console.log(`✓ 账号创建成功: ${result1.account.name} (${result1.account.id})`);
  }

  // 2. 创建另一个账号
  console.log('\n2. 创建另一个账号...');
  const result2 = await manager.createAccount({
    name: '工作账号',
    translation: {
      enabled: true,
      targetLanguage: 'en',
      engine: 'google',
      autoTranslate: false
    }
  });

  if (result2.success) {
    console.log(`✓ 账号创建成功: ${result2.account.name} (${result2.account.id})`);
  }

  // 3. 加载所有账号
  console.log('\n3. 加载所有账号...');
  const accounts = await manager.loadAccounts();
  console.log(`✓ 找到 ${accounts.length} 个账号:`);
  accounts.forEach(account => {
    console.log(`  - ${account.name}`);
  });

  // 4. 更新账号
  console.log('\n4. 更新账号配置...');
  const updateResult = await manager.updateAccount(result1.account.id, {
    name: '个人账号（已更新）',
    notifications: {
      enabled: true,
      sound: true,
      badge: true
    }
  });

  if (updateResult.success) {
    console.log(`✓ 账号更新成功: ${updateResult.account.name}`);
  }

  // 5. 导出配置
  console.log('\n5. 导出所有账号配置...');
  const exportData = await manager.exportAccounts();
  console.log(`✓ 导出完成: ${exportData.accounts.length} 个账号`);
  console.log(`  导出时间: ${exportData.exportDate}`);

  // 6. 删除账号
  console.log('\n6. 删除账号...');
  const deleteResult = await manager.deleteAccount(result2.account.id);
  if (deleteResult.success) {
    console.log(`✓ 账号删除成功: ${result2.account.name}`);
  }

  // 7. 验证删除
  const remainingAccounts = await manager.loadAccounts();
  console.log(`\n剩余账号数: ${remainingAccounts.length}`);

  console.log('\n=== 示例完成 ===\n');
}

/**
 * 示例：配置验证
 */
async function configurationValidation() {
  console.log('=== 配置验证示例 ===\n');

  const manager = new AccountConfigManager({
    configName: 'validation-example',
    cwd: path.join(__dirname, '../../temp')
  });

  // 1. 有效配置
  console.log('1. 测试有效配置...');
  const validConfig = new AccountConfig({
    name: '有效账号'
  });

  const validation1 = manager.validateConfig(validConfig);
  console.log(`✓ 验证结果: ${validation1.valid ? '通过' : '失败'}`);

  

  // 3. 无效翻译配置
  console.log('\n3. 测试无效翻译配置...');
  const invalidTranslationConfig = new AccountConfig({
    name: '无效翻译',
    translation: {
      enabled: true,
      targetLanguage: '',
      engine: 'gpt4',
      apiKey: '' // GPT-4 需要 API 密钥
    }
  });

  const validation3 = manager.validateConfig(invalidTranslationConfig);
  console.log(`✗ 验证结果: ${validation3.valid ? '通过' : '失败'}`);
  if (!validation3.valid) {
    console.log('  错误信息:');
    validation3.errors.forEach(error => console.log(`    - ${error}`));
  }

  console.log('\n=== 示例完成 ===\n');
}

/**
 * 示例：导入导出
 */
async function importExportExample() {
  console.log('=== 导入导出示例 ===\n');

  const manager = new AccountConfigManager({
    configName: 'import-export-example',
    cwd: path.join(__dirname, '../../temp')
  });

  // 1. 创建一些账号
  console.log('1. 创建测试账号...');
  await manager.createAccount({ name: '账号 1' });
  await manager.createAccount({ name: '账号 2' });
  await manager.createAccount({ name: '账号 3' });
  console.log('✓ 创建了 3 个账号');

  // 2. 导出
  console.log('\n2. 导出账号配置...');
  const exportData = await manager.exportAccounts();
  console.log(`✓ 导出完成: ${exportData.accounts.length} 个账号`);

  // 3. 清除所有账号
  console.log('\n3. 清除所有账号...');
  await manager.clearAllAccounts();
  const afterClear = await manager.loadAccounts();
  console.log(`✓ 清除完成，剩余账号: ${afterClear.length}`);

  // 4. 导入
  console.log('\n4. 导入账号配置...');
  const importResult = await manager.importAccounts(exportData);
  console.log(`✓ 导入完成:`);
  console.log(`  - 成功导入: ${importResult.imported} 个`);
  console.log(`  - 跳过: ${importResult.skipped} 个`);
  console.log(`  - 错误: ${importResult.errors.length} 个`);

  // 5. 验证导入
  const afterImport = await manager.loadAccounts();
  console.log(`\n最终账号数: ${afterImport.length}`);

  console.log('\n=== 示例完成 ===\n');
}

/**
 * 运行所有示例
 */
async function runAllExamples() {
  try {
    await basicAccountManagement();
    await configurationValidation();
    await importExportExample();
  } catch (error) {
    console.error('示例运行出错:', error);
  }
}

// 如果直接运行此文件，执行所有示例
if (require.main === module) {
  runAllExamples().then(() => {
    console.log('所有示例运行完成');
    process.exit(0);
  }).catch(error => {
    console.error('运行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  basicAccountManagement,
  configurationValidation,
  importExportExample,
  runAllExamples
};
