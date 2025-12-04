#!/usr/bin/env node

/**
 * 测试设置检查脚本
 * 
 * 这个脚本用于验证测试环境是否正确配置
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// 测试结果
const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

console.log('\n' + '='.repeat(60));
log('WhatsApp Desktop - 测试环境检查', 'blue');
console.log('='.repeat(60) + '\n');

// 1. 检查 Node.js 版本
log('1. 检查 Node.js 版本...', 'blue');
try {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion >= 18) {
    log(`   ${checkMark(true)} Node.js 版本: ${nodeVersion} (满足要求)`, 'green');
    results.passed++;
  } else {
    log(`   ${checkMark(false)} Node.js 版本: ${nodeVersion} (需要 18+)`, 'red');
    results.failed++;
  }
} catch (error) {
  log(`   ${checkMark(false)} 无法检测 Node.js 版本`, 'red');
  results.failed++;
}

// 2. 检查 npm 版本
log('\n2. 检查 npm 版本...', 'blue');
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
  log(`   ${checkMark(true)} npm 版本: ${npmVersion}`, 'green');
  results.passed++;
} catch (error) {
  log(`   ${checkMark(false)} npm 未安装`, 'red');
  results.failed++;
}

// 3. 检查项目依赖
log('\n3. 检查项目依赖...', 'blue');
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');

if (fs.existsSync(packageJsonPath)) {
  log(`   ${checkMark(true)} package.json 存在`, 'green');
  results.passed++;
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (fs.existsSync(nodeModulesPath)) {
    log(`   ${checkMark(true)} node_modules 目录存在`, 'green');
    results.passed++;
    
    // 检查关键依赖
    const criticalDeps = ['electron', 'whatsapp-web.js'];
    let allDepsInstalled = true;
    
    for (const dep of criticalDeps) {
      const depPath = path.join(nodeModulesPath, dep);
      if (fs.existsSync(depPath)) {
        log(`   ${checkMark(true)} ${dep} 已安装`, 'green');
        results.passed++;
      } else {
        log(`   ${checkMark(false)} ${dep} 未安装`, 'red');
        results.failed++;
        allDepsInstalled = false;
      }
    }
    
    if (!allDepsInstalled) {
      log('   提示: 运行 "npm install" 安装依赖', 'yellow');
    }
  } else {
    log(`   ${checkMark(false)} node_modules 目录不存在`, 'red');
    log('   提示: 运行 "npm install" 安装依赖', 'yellow');
    results.failed++;
  }
} else {
  log(`   ${checkMark(false)} package.json 不存在`, 'red');
  results.failed++;
}

// 4. 检查源代码文件
log('\n4. 检查源代码文件...', 'blue');
const requiredFiles = [
  'src/main-refactored.js',
  'src/config.js'
];

for (const file of requiredFiles) {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    log(`   ${checkMark(true)} ${file} 存在`, 'green');
    results.passed++;
  } else {
    log(`   ${checkMark(false)} ${file} 不存在`, 'red');
    results.failed++;
  }
}

// 5. 检查会话数据目录
log('\n5. 检查会话数据目录...', 'blue');
const sessionDataPath = path.join(__dirname, '..', 'session-data');

if (fs.existsSync(sessionDataPath)) {
  log(`   ${checkMark(true)} session-data 目录存在`, 'yellow');
  
  // 检查是否有会话文件
  const authPath = path.join(sessionDataPath, '.wwebjs_auth');
  if (fs.existsSync(authPath)) {
    log(`   ${checkMark(true)} 发现已保存的会话数据`, 'yellow');
    log('   提示: 如需重新测试登录，请删除 session-data 目录', 'yellow');
    results.warnings++;
  } else {
    log(`   ${checkMark(true)} 会话数据目录为空（首次运行）`, 'green');
    results.passed++;
  }
} else {
  log(`   ${checkMark(true)} session-data 目录不存在（首次运行）`, 'green');
  log('   提示: 首次运行时会自动创建', 'yellow');
  results.passed++;
}

// 6. 检查资源文件
log('\n6. 检查资源文件...', 'blue');
const resourcesPath = path.join(__dirname, '..', 'resources');

if (fs.existsSync(resourcesPath)) {
  log(`   ${checkMark(true)} resources 目录存在`, 'green');
  results.passed++;
  
  const iconPath = path.join(resourcesPath, 'icon.png');
  if (fs.existsSync(iconPath)) {
    log(`   ${checkMark(true)} icon.png 存在`, 'green');
    results.passed++;
  } else {
    log(`   ${checkMark(false)} icon.png 不存在`, 'yellow');
    log('   提示: 应用图标缺失，不影响功能', 'yellow');
    results.warnings++;
  }
} else {
  log(`   ${checkMark(false)} resources 目录不存在`, 'yellow');
  log('   提示: 应用图标缺失，不影响功能', 'yellow');
  results.warnings++;
}

// 7. 检查测试文档
log('\n7. 检查测试文档...', 'blue');
const testingGuidePath = path.join(__dirname, '..', 'TESTING_GUIDE.md');

if (fs.existsSync(testingGuidePath)) {
  log(`   ${checkMark(true)} TESTING_GUIDE.md 存在`, 'green');
  results.passed++;
} else {
  log(`   ${checkMark(false)} TESTING_GUIDE.md 不存在`, 'yellow');
  results.warnings++;
}

// 8. 检查网络连接
log('\n8. 检查网络连接...', 'blue');
try {
  const https = require('https');
  
  const checkUrl = (url) => {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        resolve(res.statusCode === 200);
      }).on('error', reject);
    });
  };
  
  // 这是一个同步检查的简化版本
  log(`   提示: 请确保可以访问 https://web.whatsapp.com`, 'yellow');
  results.warnings++;
} catch (error) {
  log(`   ${checkMark(false)} 网络检查失败`, 'yellow');
  results.warnings++;
}

// 总结
console.log('\n' + '='.repeat(60));
log('测试环境检查总结', 'blue');
console.log('='.repeat(60));

log(`\n通过: ${results.passed}`, 'green');
if (results.failed > 0) {
  log(`失败: ${results.failed}`, 'red');
}
if (results.warnings > 0) {
  log(`警告: ${results.warnings}`, 'yellow');
}

if (results.failed === 0) {
  log('\n✓ 测试环境配置正确，可以开始测试！', 'green');
  log('\n运行以下命令开始测试:', 'blue');
  log('  npm start', 'yellow');
  process.exit(0);
} else {
  log('\n✗ 测试环境配置不完整，请解决上述问题后再测试', 'red');
  process.exit(1);
}
