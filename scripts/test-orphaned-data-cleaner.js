/**
 * 测试自动清理功能的脚本
 * 
 * 此脚本用于测试 OrphanedDataCleaner 类的功能
 * 包括扫描和清理遗留账号目录的能力
 */

const fs = require('fs').promises;
const path = require('path');
const OrphanedDataCleaner = require('../src/utils/OrphanedDataCleaner');

// 测试配置
const TEST_CONFIG = {
  testUserDataPath: path.join(__dirname, '..', 'temp', 'test-cleaner-data'),
  testPartitionsPath: null
};

/**
 * 创建测试环境
 */
async function setupTestEnvironment() {
  console.log('=== 设置测试环境 ===\n');
  
  TEST_CONFIG.testPartitionsPath = path.join(TEST_CONFIG.testUserDataPath, 'Partitions');
  
  try {
    // 清理之前的测试数据
    await fs.rm(TEST_CONFIG.testUserDataPath, { recursive: true, force: true });
    
    // 创建测试目录结构
    await fs.mkdir(TEST_CONFIG.testUserDataPath, { recursive: true });
    await fs.mkdir(TEST_CONFIG.testPartitionsPath, { recursive: true });
    
    console.log('✓ 测试目录创建完成');
    
    // 创建一些测试账号目录
    await createTestAccountDir('account_test-001', 'existing');
    await createTestAccountDir('account_test-002', 'orphaned');
    await createTestAccountDir('account_test-003', 'existing');
    await createTestAccountDir('account_test-004', 'orphaned');
    await createTestAccountDir('account_non-matching-dir', 'should-not-match');
    
    // 创建一些非账号目录作为干扰项
    await fs.mkdir(path.join(TEST_CONFIG.testPartitionsPath, 'other-directory'), { recursive: true });
    await fs.mkdir(path.join(TEST_CONFIG.testPartitionsPath, 'session_data'), { recursive: true });
    
    console.log('✓ 测试账号目录创建完成');
    
    // 列出创建的目录
    console.log('\n创建的目录:');
    const entries = await fs.readdir(TEST_CONFIG.testPartitionsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        console.log(`  - ${entry.name}/`);
      }
    }
    
  } catch (error) {
    throw new Error(`设置测试环境失败: ${error.message}`);
  }
}

/**
 * 创建测试账号目录
 */
async function createTestAccountDir(accountId, type) {
  const dirPath = path.join(TEST_CONFIG.testPartitionsPath, `account_${accountId}`);
  await fs.mkdir(dirPath, { recursive: true });
  
  // 创建一些测试文件
  await fs.writeFile(path.join(dirPath, 'test-file-1.txt'), `Test file 1 for ${accountId}`);
  await fs.writeFile(path.join(dirPath, 'test-file-2.txt'), `Test file 2 for ${accountId}`);
  
  // 创建子目录
  await fs.mkdir(path.join(dirPath, 'subdirectory'), { recursive: true });
  await fs.writeFile(path.join(dirPath, 'subdirectory', 'nested-file.txt'), `Nested file for ${accountId}`);
  
  console.log(`  ✓ 创建 ${type} 账号目录: account_${accountId}`);
}

/**
 * 运行清理功能测试
 */
async function testCleanupFunction() {
  console.log('\n=== 测试清理功能 ===\n');
  
  try {
    // 模拟现有账号ID（test-001 和 test-003 存在）
    const existingAccountIds = ['test-001', 'test-003', 'test-005'];
    
    const cleaner = new OrphanedDataCleaner({
      userDataPath: TEST_CONFIG.testUserDataPath,
      logFunction: (level, message, ...args) => {
        const logMessage = `[OrphanedDataCleaner] [${level.toUpperCase()}] ${message}`;
        if (level === 'error') {
          console.error(logMessage, ...args);
        } else if (level === 'warn') {
          console.warn(logMessage, ...args);
        } else {
          console.log(logMessage, ...args);
        }
      }
    });
    
    console.log(`测试场景: 现有账号 ID: ${existingAccountIds.join(', ')}`);
    console.log('预期结果: 应该清理 test-002 和 test-004 目录');
    
    // 执行清理
    const result = await cleaner.scanAndClean(existingAccountIds);
    
    console.log('\n=== 清理结果 ===');
    console.log(`成功: ${result.success}`);
    console.log(`清理目录数: ${result.cleaned}`);
    console.log(`错误数: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('错误列表:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n=== 清理详情 ===');
    console.log(`释放空间: ${result.details.totalSizeFreed} 字节`);
    console.log(`清理时间: ${result.details.scanTime}`);
    
    if (result.details.cleanedDirectories.length > 0) {
      console.log('\n清理的目录:');
      result.details.cleanedDirectories.forEach((dir, index) => {
        console.log(`  ${index + 1}. ${dir.directory} (${dir.size} 字节, ${dir.fileCount} 文件)`);
      });
    }
    
    // 验证结果
    await verifyCleanupResult(result);
    
    return result;
    
  } catch (error) {
    console.error('测试清理功能失败:', error);
    throw error;
  }
}

/**
 * 验证清理结果
 */
async function verifyCleanupResult(result) {
  console.log('\n=== 验证清理结果 ===');
  
  // 检查目录是否还存在
  const entries = await fs.readdir(TEST_CONFIG.testPartitionsPath, { withFileTypes: true });
  const remainingDirs = entries.filter(entry => entry.isDirectory());
  
  console.log('剩余目录:');
  remainingDirs.forEach(dir => {
    console.log(`  - ${dir.name}/`);
  });
  
  // 验证预期结果
  const expectedOrphaned = ['account_test-002', 'account_test-004'];
  const expectedExisting = ['account_test-001', 'account_test-003'];
  
  const remainingDirNames = remainingDirs.map(dir => dir.name);
  
  let testPassed = true;
  
  // 检查 orphaned 目录是否被清理
  for (const orphaned of expectedOrphaned) {
    if (remainingDirNames.includes(orphaned)) {
      console.error(`❌ 测试失败: orphaned 目录 ${orphaned} 仍然存在`);
      testPassed = false;
    } else {
      console.log(`✓ orphaned 目录 ${orphaned} 已清理`);
    }
  }
  
  // 检查 existing 目录是否被保留
  for (const existing of expectedExisting) {
    if (remainingDirNames.includes(existing)) {
      console.log(`✓ existing 目录 ${existing} 已保留`);
    } else {
      console.error(`❌ 测试失败: existing 目录 ${existing} 被意外清理`);
      testPassed = false;
    }
  }
  
  // 检查非匹配目录是否被保留
  if (remainingDirNames.includes('account_non-matching-dir')) {
    console.log('✓ 非匹配目录已保留');
  } else {
    console.error('❌ 测试失败: 非匹配目录被意外清理');
    testPassed = false;
  }
  
  // 检查其他目录是否被保留
  const otherDirs = ['other-directory', 'session_data'];
  for (const otherDir of otherDirs) {
    if (remainingDirNames.includes(otherDir)) {
      console.log(`✓ 其他目录 ${otherDir} 已保留`);
    } else {
      console.error(`❌ 测试失败: 其他目录 ${otherDir} 被意外清理`);
      testPassed = false;
    }
  }
  
  if (testPassed) {
    console.log('\n✅ 所有测试通过！清理功能工作正常。');
  } else {
    console.log('\n❌ 部分测试失败！清理功能可能存在问题。');
  }
  
  return testPassed;
}

/**
 * 清理测试环境
 */
async function cleanupTestEnvironment() {
  console.log('\n=== 清理测试环境 ===\n');
  
  try {
    await fs.rm(TEST_CONFIG.testUserDataPath, { recursive: true, force: true });
    console.log('✓ 测试环境清理完成');
  } catch (error) {
    console.warn('⚠ 清理测试环境时出现警告:', error.message);
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🚀 开始测试 OrphanedDataCleaner 功能\n');
  
  try {
    // 1. 设置测试环境
    await setupTestEnvironment();
    
    // 2. 测试清理功能
    const result = await testCleanupFunction();
    
    // 3. 清理测试环境
    await cleanupTestEnvironment();
    
    console.log('\n=== 测试总结 ===');
    console.log(`清理功能测试: ${result.success ? '✅ 通过' : '❌ 失败'}`);
    console.log(`清理目录数: ${result.cleaned}`);
    console.log(`释放空间: ${result.details.totalSizeFreed} 字节`);
    console.log(`错误数: ${result.errors.length}`);
    
    if (result.errors.length === 0 && result.cleaned === 2) {
      console.log('\n🎉 所有测试成功完成！自动清理功能工作正常。');
      return true;
    } else {
      console.log('\n⚠️ 测试结果与预期不符，请检查实现。');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ 测试过程中出现错误:', error);
    await cleanupTestEnvironment();
    return false;
  }
}

// 如果直接运行此脚本，执行测试
if (require.main === module) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('测试脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = {
  runTests,
  setupTestEnvironment,
  testCleanupFunction,
  cleanupTestEnvironment
};