/**
 * 调试自动清理功能的脚本
 */

const fs = require('fs').promises;
const path = require('path');
const OrphanedDataCleaner = require('../src/utils/OrphanedDataCleaner');

// 测试配置
const TEST_CONFIG = {
  testUserDataPath: path.join(__dirname, '..', 'temp', 'debug-cleaner-data'),
  testPartitionsPath: null
};

/**
 * 创建测试环境
 */
async function setupTestEnvironment() {
  console.log('=== 设置调试环境 ===\n');
  
  TEST_CONFIG.testPartitionsPath = path.join(TEST_CONFIG.testUserDataPath, 'Partitions');
  
  try {
    // 清理之前的测试数据
    await fs.rm(TEST_CONFIG.testUserDataPath, { recursive: true, force: true });
    
    // 创建测试目录结构
    await fs.mkdir(TEST_CONFIG.testUserDataPath, { recursive: true });
    await fs.mkdir(TEST_CONFIG.testPartitionsPath, { recursive: true });
    
    console.log('✓ 测试目录创建完成');
    
    // 创建一些测试账号目录
    const testDirs = [
      'account_test-001',
      'account_test-002', 
      'account_test-003',
      'account_test-004'
    ];
    
    for (const dirName of testDirs) {
      const dirPath = path.join(TEST_CONFIG.testPartitionsPath, dirName);
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(path.join(dirPath, 'test.txt'), `Test file for ${dirName}`);
      console.log(`  ✓ 创建目录: ${dirName}`);
    }
    
  } catch (error) {
    throw new Error(`设置测试环境失败: ${error.message}`);
  }
}

/**
 * 调试清理功能
 */
async function debugCleanupFunction() {
  console.log('\n=== 调试清理功能 ===\n');
  
  try {
    // 模拟现有账号ID
    const existingAccountIds = ['test-001', 'test-003'];
    console.log(`现有账号ID: ${existingAccountIds.join(', ')}`);
    
    const cleaner = new OrphanedDataCleaner({
      userDataPath: TEST_CONFIG.testUserDataPath,
      logFunction: (level, message, ...args) => {
        console.log(`[${level.toUpperCase()}] ${message}`, ...args);
      }
    });
    
    // 列出所有目录
    console.log('\n目录扫描结果:');
    const entries = await fs.readdir(TEST_CONFIG.testPartitionsPath, { withFileTypes: true });
    const accountDirs = entries.filter(entry => 
      entry.isDirectory() && entry.name.startsWith('account_')
    );
    
    console.log(`找到 ${accountDirs.length} 个账号目录:`);
    for (const dir of accountDirs) {
      const accountId = dir.name.replace('account_', '');
      const shouldExist = existingAccountIds.includes(accountId);
      console.log(`  - ${dir.name} -> ID: ${accountId}, 应该保留: ${shouldExist}`);
    }
    
    // 执行清理
    const result = await cleaner.scanAndClean(existingAccountIds);
    
    console.log('\n=== 清理结果 ===');
    console.log(`成功: ${result.success}`);
    console.log(`清理目录数: ${result.cleaned}`);
    console.log(`错误数: ${result.errors.length}`);
    
    if (result.details.cleanedDirectories.length > 0) {
      console.log('\n清理的目录:');
      result.details.cleanedDirectories.forEach((dir, index) => {
        console.log(`  ${index + 1}. ${dir.directory} (${dir.size} 字节)`);
      });
    }
    
    // 验证结果
    console.log('\n=== 验证结果 ===');
    const remainingEntries = await fs.readdir(TEST_CONFIG.testPartitionsPath, { withFileTypes: true });
    const remainingDirs = remainingEntries.filter(entry => entry.isDirectory());
    
    console.log('剩余目录:');
    remainingDirs.forEach(dir => {
      console.log(`  - ${dir.name}/`);
    });
    
    return result;
    
  } catch (error) {
    console.error('调试清理功能失败:', error);
    throw error;
  }
}

/**
 * 清理测试环境
 */
async function cleanupTestEnvironment() {
  try {
    await fs.rm(TEST_CONFIG.testUserDataPath, { recursive: true, force: true });
    console.log('✓ 测试环境清理完成');
  } catch (error) {
    console.warn('⚠ 清理测试环境时出现警告:', error.message);
  }
}

/**
 * 主调试函数
 */
async function runDebug() {
  console.log('🔍 开始调试 OrphanedDataCleaner 功能\n');
  
  try {
    await setupTestEnvironment();
    await debugCleanupFunction();
    await cleanupTestEnvironment();
    
    console.log('\n✅ 调试完成');
    
  } catch (error) {
    console.error('\n❌ 调试过程中出现错误:', error);
    await cleanupTestEnvironment();
  }
}

runDebug();