#!/usr/bin/env node

/**
 * 重连测试脚本
 * 
 * 此脚本用于验证重连配置是否正确
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

console.log('\n' + '='.repeat(60));
log('重连配置检查', 'blue');
console.log('='.repeat(60) + '\n');

// 读取配置文件
const configPath = path.join(__dirname, '..', 'src', 'config.js');

if (!fs.existsSync(configPath)) {
  log(`${checkMark(false)} 配置文件不存在: ${configPath}`, 'red');
  process.exit(1);
}

log('1. 读取配置文件...', 'blue');
log(`   ${checkMark(true)} 配置文件存在`, 'green');

try {
  // 读取配置文件内容
  const configContent = fs.readFileSync(configPath, 'utf-8');
  
  // 简单解析重连配置（不使用 require 以避免缓存问题）
  const reconnectMatch = configContent.match(/reconnect:\s*{([^}]+)}/s);
  
  if (reconnectMatch) {
    log(`   ${checkMark(true)} 找到重连配置`, 'green');
    
    const reconnectConfig = reconnectMatch[1];
    
    // 提取配置值
    const enabledMatch = reconnectConfig.match(/enabled:\s*(true|false)/);
    const delayMatch = reconnectConfig.match(/delay:\s*(\d+)/);
    const maxAttemptsMatch = reconnectConfig.match(/maxAttempts:\s*(\d+)/);
    
    log('\n2. 重连配置详情...', 'blue');
    
    if (enabledMatch) {
      const enabled = enabledMatch[1] === 'true';
      log(`   启用状态: ${enabled ? '✓ 已启用' : '✗ 已禁用'}`, enabled ? 'green' : 'yellow');
      
      if (!enabled) {
        log('   警告: 自动重连已禁用', 'yellow');
      }
    }
    
    if (delayMatch) {
      const delay = parseInt(delayMatch[1]);
      const delaySeconds = delay / 1000;
      log(`   重连延迟: ${delay}ms (${delaySeconds}秒)`, 'yellow');
      
      if (delay < 1000) {
        log(`   ${checkMark(false)} 警告: 延迟过短，可能导致频繁重连`, 'yellow');
      } else if (delay > 30000) {
        log(`   ${checkMark(false)} 警告: 延迟过长，用户等待时间较长`, 'yellow');
      } else {
        log(`   ${checkMark(true)} 延迟设置合理`, 'green');
      }
    }
    
    if (maxAttemptsMatch) {
      const maxAttempts = parseInt(maxAttemptsMatch[1]);
      log(`   最大尝试次数: ${maxAttempts}`, 'yellow');
      
      if (maxAttempts < 3) {
        log(`   ${checkMark(false)} 警告: 尝试次数较少，可能无法应对临时网络问题`, 'yellow');
      } else if (maxAttempts > 10) {
        log(`   ${checkMark(false)} 警告: 尝试次数过多，可能导致长时间等待`, 'yellow');
      } else {
        log(`   ${checkMark(true)} 尝试次数设置合理`, 'green');
      }
      
      // 计算总等待时间
      if (delayMatch && maxAttemptsMatch) {
        const delay = parseInt(delayMatch[1]);
        const totalWaitTime = (delay * maxAttempts) / 1000;
        log(`   总等待时间: 约 ${totalWaitTime} 秒`, 'yellow');
        
        if (totalWaitTime > 60) {
          log(`   ${checkMark(false)} 提示: 总等待时间超过 1 分钟`, 'yellow');
        }
      }
    }
    
    // 检查主进程中的重连逻辑
    log('\n3. 检查重连逻辑实现...', 'blue');
    
    const mainPath = path.join(__dirname, '..', 'src', 'main-refactored.js');
    
    if (fs.existsSync(mainPath)) {
      const mainContent = fs.readFileSync(mainPath, 'utf-8');
      
      // 检查是否监听 disconnected 事件
      if (mainContent.includes("client.on('disconnected'")) {
        log(`   ${checkMark(true)} 已监听 disconnected 事件`, 'green');
      } else {
        log(`   ${checkMark(false)} 未找到 disconnected 事件监听`, 'red');
      }
      
      // 检查是否有重连逻辑
      if (mainContent.includes('reconnectAttempts')) {
        log(`   ${checkMark(true)} 已实现重连计数`, 'green');
      } else {
        log(`   ${checkMark(false)} 未找到重连计数逻辑`, 'red');
      }
      
      // 检查是否有延迟重连
      if (mainContent.includes('setTimeout')) {
        log(`   ${checkMark(true)} 已实现延迟重连`, 'green');
      } else {
        log(`   ${checkMark(false)} 未找到延迟重连逻辑`, 'red');
      }
      
      // 检查是否有最大尝试次数限制
      if (mainContent.includes('maxAttempts')) {
        log(`   ${checkMark(true)} 已实现最大尝试次数限制`, 'green');
      } else {
        log(`   ${checkMark(false)} 未找到最大尝试次数限制`, 'red');
      }
    }
    
  } else {
    log(`   ${checkMark(false)} 未找到重连配置`, 'red');
  }
  
} catch (error) {
  log(`${checkMark(false)} 读取配置文件失败: ${error.message}`, 'red');
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
log('测试建议', 'blue');
console.log('='.repeat(60) + '\n');

log('手动测试步骤:', 'yellow');
log('1. 启动应用并登录', 'yellow');
log('2. 断开网络连接', 'yellow');
log('3. 观察控制台输出，应该看到:', 'yellow');
log('   - "客户端已断开连接"', 'yellow');
log('   - "尝试重新连接 (1/N)..."', 'yellow');
log('   - "开始重新连接..."', 'yellow');
log('4. 恢复网络连接', 'yellow');
log('5. 验证应用自动重连成功', 'yellow');
log('\n6. 测试最大重连次数:', 'yellow');
log('   - 保持网络断开状态', 'yellow');
log('   - 观察是否在达到最大次数后停止重连', 'yellow');
log('   - 应该看到 "已达到最大重连次数，请手动重启应用"', 'yellow');

console.log('\n' + '='.repeat(60) + '\n');
