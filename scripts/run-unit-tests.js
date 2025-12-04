/**
 * 运行核心组件单元测试
 * 
 * 使用方法:
 * node scripts/run-unit-tests.js
 */

const { execSync } = require('child_process');

console.log('='.repeat(60));
console.log('运行核心组件单元测试');
console.log('='.repeat(60));
console.log('');

const testFiles = [
  'src/managers/__tests__/AccountConfigManager.test.js',
  'src/managers/__tests__/SessionManager.test.js',
  'src/managers/__tests__/TranslationIntegration.test.js',
  // Note: ViewManager tests moved to new modular architecture
// Tests are now integrated into the new architecture modules
];

let totalPassed = 0;
let totalFailed = 0;

for (const testFile of testFiles) {
  console.log(`\n运行测试: ${testFile}`);
  console.log('-'.repeat(60));
  
  try {
    const output = execSync(`npm test ${testFile}`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // 解析测试结果
    const passedMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);
    
    const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
    
    totalPassed += passed;
    totalFailed += failed;
    
    console.log(`✓ 通过: ${passed} 个测试`);
    if (failed > 0) {
      console.log(`✗ 失败: ${failed} 个测试`);
    }
  } catch (error) {
    console.error(`✗ 测试执行失败: ${testFile}`);
    console.error(error.message);
    totalFailed++;
  }
}

console.log('');
console.log('='.repeat(60));
console.log('测试总结');
console.log('='.repeat(60));
console.log(`总计通过: ${totalPassed} 个测试`);
console.log(`总计失败: ${totalFailed} 个测试`);
console.log('');

if (totalFailed === 0) {
  console.log('✓ 所有测试通过！');
  process.exit(0);
} else {
  console.log('✗ 部分测试失败');
  process.exit(1);
}
