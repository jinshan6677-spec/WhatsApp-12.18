#!/usr/bin/env node

/**
 * 检查会话数据脚本
 * 
 * 用于验证会话数据是否正确保存
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

function checkMark(passed) {
  return passed ? '✓' : '✗';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  if (!fs.existsSync(dirPath)) {
    return 0;
  }
  
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      totalSize += getDirectorySize(filePath);
    } else {
      totalSize += stats.size;
    }
  }
  
  return totalSize;
}

function getFileCount(dirPath) {
  let count = 0;
  
  if (!fs.existsSync(dirPath)) {
    return 0;
  }
  
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      count += getFileCount(filePath);
    } else {
      count++;
    }
  }
  
  return count;
}

console.log('\n' + '='.repeat(60));
log('会话数据检查', 'blue');
console.log('='.repeat(60) + '\n');

const sessionDataPath = path.join(__dirname, '..', 'session-data');
const authPath = path.join(sessionDataPath, '.wwebjs_auth');

// 检查会话数据目录
log('1. 检查会话数据目录...', 'blue');

if (fs.existsSync(sessionDataPath)) {
  log(`   ${checkMark(true)} session-data 目录存在`, 'green');
  
  const stats = fs.statSync(sessionDataPath);
  log(`   创建时间: ${stats.birthtime.toLocaleString()}`, 'yellow');
  log(`   修改时间: ${stats.mtime.toLocaleString()}`, 'yellow');
  
  // 检查 .wwebjs_auth 目录
  log('\n2. 检查认证数据目录...', 'blue');
  
  if (fs.existsSync(authPath)) {
    log(`   ${checkMark(true)} .wwebjs_auth 目录存在`, 'green');
    
    const authStats = fs.statSync(authPath);
    log(`   创建时间: ${authStats.birthtime.toLocaleString()}`, 'yellow');
    log(`   修改时间: ${authStats.mtime.toLocaleString()}`, 'yellow');
    
    // 统计文件数量和大小
    const fileCount = getFileCount(authPath);
    const totalSize = getDirectorySize(authPath);
    
    log(`\n3. 会话数据统计...`, 'blue');
    log(`   ${checkMark(true)} 文件数量: ${fileCount}`, 'green');
    log(`   ${checkMark(true)} 总大小: ${formatBytes(totalSize)}`, 'green');
    
    if (fileCount === 0) {
      log(`   ${checkMark(false)} 警告: 认证目录为空`, 'yellow');
      log('   提示: 可能尚未完成首次登录', 'yellow');
    } else if (totalSize < 1024) {
      log(`   ${checkMark(false)} 警告: 会话数据过小`, 'yellow');
      log('   提示: 会话数据可能不完整', 'yellow');
    } else {
      log(`   ${checkMark(true)} 会话数据看起来正常`, 'green');
    }
    
    // 列出主要文件
    log(`\n4. 会话文件列表...`, 'blue');
    
    try {
      const files = fs.readdirSync(authPath);
      
      if (files.length > 0) {
        files.forEach((file) => {
          const filePath = path.join(authPath, file);
          const fileStats = fs.statSync(filePath);
          
          if (fileStats.isDirectory()) {
            const subFileCount = getFileCount(filePath);
            log(`   📁 ${file}/ (${subFileCount} 个文件)`, 'yellow');
          } else {
            log(`   📄 ${file} (${formatBytes(fileStats.size)})`, 'yellow');
          }
        });
      } else {
        log(`   ${checkMark(false)} 目录为空`, 'yellow');
      }
    } catch (error) {
      log(`   ${checkMark(false)} 无法读取文件列表: ${error.message}`, 'red');
    }
    
    // 检查会话有效性
    log(`\n5. 会话状态评估...`, 'blue');
    
    const now = Date.now();
    const lastModified = authStats.mtime.getTime();
    const daysSinceModified = Math.floor((now - lastModified) / (1000 * 60 * 60 * 24));
    
    log(`   最后修改: ${daysSinceModified} 天前`, 'yellow');
    
    if (daysSinceModified > 30) {
      log(`   ${checkMark(false)} 警告: 会话可能已过期`, 'yellow');
      log('   提示: WhatsApp 会话通常在 30 天后过期', 'yellow');
    } else if (daysSinceModified > 14) {
      log(`   ${checkMark(true)} 会话可能即将过期`, 'yellow');
      log('   提示: 建议定期使用应用以保持会话活跃', 'yellow');
    } else {
      log(`   ${checkMark(true)} 会话应该仍然有效`, 'green');
    }
    
  } else {
    log(`   ${checkMark(false)} .wwebjs_auth 目录不存在`, 'yellow');
    log('   提示: 尚未完成首次登录，或会话数据已被清理', 'yellow');
  }
  
} else {
  log(`   ${checkMark(false)} session-data 目录不存在`, 'yellow');
  log('   提示: 尚未运行过应用，或会话数据已被清理', 'yellow');
}

console.log('\n' + '='.repeat(60));
log('检查完成', 'blue');
console.log('='.repeat(60) + '\n');

// 提供建议
if (fs.existsSync(authPath) && getFileCount(authPath) > 0) {
  log('✓ 会话数据存在，应用重启时应该可以自动登录', 'green');
} else {
  log('⚠ 会话数据不存在或为空，首次启动需要扫码登录', 'yellow');
}

console.log('');
