#!/usr/bin/env node

/**
 * 清理会话数据脚本
 * 
 * 用于测试时清理会话数据，以便重新测试登录流程
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 递归删除目录
function removeDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        removeDirectory(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}

console.log('\n' + '='.repeat(60));
log('清理会话数据', 'blue');
console.log('='.repeat(60) + '\n');

const sessionDataPath = path.join(__dirname, '..', 'session-data');

if (fs.existsSync(sessionDataPath)) {
  log('⚠️  警告: 此操作将删除所有保存的会话数据', 'yellow');
  log('   删除后需要重新扫码登录', 'yellow');
  log(`\n   目录: ${sessionDataPath}`, 'yellow');
  
  // 在实际使用中，可以添加确认提示
  // 这里直接执行删除
  
  try {
    log('\n正在删除会话数据...', 'blue');
    removeDirectory(sessionDataPath);
    log('✓ 会话数据已清理', 'green');
    log('\n提示: 下次启动应用时需要重新扫码登录', 'yellow');
  } catch (error) {
    log(`✗ 删除失败: ${error.message}`, 'red');
    log('\n请手动删除 session-data 目录', 'yellow');
    process.exit(1);
  }
} else {
  log('✓ 会话数据目录不存在，无需清理', 'green');
}

console.log('\n' + '='.repeat(60) + '\n');
