#!/usr/bin/env node

/**
 * 清理 whatsapp-web.js 相关文件
 * 由于文件可能被占用，需要手动清理
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('清理 whatsapp-web.js 相关文件');
console.log('========================================\n');

// 需要删除的目录
const dirsToRemove = [
  'node_modules/whatsapp-web.js',
  'node_modules/puppeteer',
  'node_modules/puppeteer-core',
  'node_modules/.puppeteer-core-*'
];

console.log('请按照以下步骤手动清理：\n');
console.log('1. 关闭所有 Electron 应用和 Chrome 进程');
console.log('2. 运行以下命令：\n');
console.log('   rmdir /s /q node_modules\\whatsapp-web.js');
console.log('   rmdir /s /q node_modules\\puppeteer');
console.log('   rmdir /s /q node_modules\\puppeteer-core');
console.log('   npm install\n');
console.log('3. 或者直接删除整个 node_modules 文件夹后重新安装：\n');
console.log('   rmdir /s /q node_modules');
console.log('   npm install\n');
console.log('========================================');
