#!/usr/bin/env node

/**
 * 检查项目配置是否正确
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('WhatsApp Desktop - 配置检查');
console.log('========================================\n');

let allGood = true;

// 检查 Node.js 版本
console.log('✓ 检查 Node.js 版本...');
const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0]);
if (majorVersion >= 18) {
  console.log(`  ✓ Node.js ${nodeVersion} (满足要求 >= 18)\n`);
} else {
  console.log(`  ✗ Node.js ${nodeVersion} (需要 >= 18)\n`);
  allGood = false;
}

// 检查必要文件
console.log('✓ 检查项目文件...');
const requiredFiles = [
  'package.json',
  'src/main-refactored.js',
  'src/config.js'
];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✓ ${file}`);
  } else {
    console.log(`  ✗ ${file} (缺失)`);
    allGood = false;
  }
});
console.log();

// 检查依赖
console.log('✓ 检查依赖安装...');
try {
  require('electron');
  console.log('  ✓ electron');
} catch (e) {
  console.log('  ✗ electron (未安装)');
  allGood = false;
}

try {
  require('electron-store');
  console.log('  ✓ electron-store');
} catch (e) {
  console.log('  ✗ electron-store (未安装)');
  allGood = false;
}
console.log();

// 检查配置文件
console.log('✓ 检查配置...');
try {
  const config = require('../src/config.js');
  console.log(`  ✓ 会话路径: ${config.sessionPath}`);
  console.log(`  ✓ 窗口大小: ${config.windowConfig.width}x${config.windowConfig.height}`);
  console.log(`  ✓ 控制台过滤: ${config.consoleFilter.enabled ? '启用' : '禁用'}`);
} catch (e) {
  console.log('  ✗ 配置文件加载失败');
  console.log(`  错误: ${e.message}`);
  allGood = false;
}
console.log();

// 总结
console.log('========================================');
if (allGood) {
  console.log('✓ 所有检查通过！');
  console.log('\n准备启动应用:');
  console.log('  npm start\n');
  process.exit(0);
} else {
  console.log('✗ 发现问题，请修复后再启动');
  console.log('\n建议:');
  console.log('  1. 运行 npm install 安装依赖');
  console.log('  2. 检查 Node.js 版本 (node --version)');
  console.log('  3. 查看错误信息\n');
  process.exit(1);
}
