#!/usr/bin/env node

/**
 * Electron 版本检查脚本
 * 
 * 验证 Electron 和相关依赖的版本
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

console.log('\n' + '='.repeat(60));
log('Electron 版本信息', 'blue');
console.log('='.repeat(60) + '\n');

// 读取 package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// 读取已安装的 Electron 版本
let installedElectronVersion = 'N/A';
let installedBuilderVersion = 'N/A';

try {
  const electronPackagePath = path.join(__dirname, '..', 'node_modules', 'electron', 'package.json');
  if (fs.existsSync(electronPackagePath)) {
    const electronPackage = JSON.parse(fs.readFileSync(electronPackagePath, 'utf-8'));
    installedElectronVersion = electronPackage.version;
  }
} catch (error) {
  // Ignore
}

try {
  const builderPackagePath = path.join(__dirname, '..', 'node_modules', 'electron-builder', 'package.json');
  if (fs.existsSync(builderPackagePath)) {
    const builderPackage = JSON.parse(fs.readFileSync(builderPackagePath, 'utf-8'));
    installedBuilderVersion = builderPackage.version;
  }
} catch (error) {
  // Ignore
}

// 显示版本信息
log('1. 依赖版本', 'cyan');
console.log('');

console.log('  package.json 中的版本：');
console.log(`    Electron: ${packageJson.devDependencies.electron || 'N/A'}`);
console.log(`    electron-builder: ${packageJson.devDependencies['electron-builder'] || 'N/A'}`);
console.log('');

console.log('  已安装的版本：');
log(`    Electron: ${installedElectronVersion}`, installedElectronVersion !== 'N/A' ? 'green' : 'red');
log(`    electron-builder: ${installedBuilderVersion}`, installedBuilderVersion !== 'N/A' ? 'green' : 'red');

// 检查 Electron 版本详情
if (installedElectronVersion !== 'N/A') {
  console.log('');
  log('2. Electron 详细信息', 'cyan');
  console.log('');
  
  // 尝试获取 Chrome 和 Node.js 版本
  try {
    const { execSync } = require('child_process');
    
    // 获取 Electron 的 Chrome 版本
    const electronExe = process.platform === 'win32' 
      ? path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe')
      : path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
    
    console.log(`  Electron 版本: ${installedElectronVersion}`);
    
    // 从 Electron 版本推断 Chrome 版本（近似）
    const majorVersion = parseInt(installedElectronVersion.split('.')[0]);
    let chromeVersion = 'Unknown';
    
    if (majorVersion >= 39) {
      chromeVersion = '132.x';
    } else if (majorVersion >= 28) {
      chromeVersion = '120.x';
    } else if (majorVersion >= 27) {
      chromeVersion = '118.x';
    }
    
    console.log(`  Chrome 版本: ~${chromeVersion}`);
    console.log(`  Node.js 版本: ${majorVersion >= 28 ? '20.x' : '18.x'}`);
    
  } catch (error) {
    console.log('  无法获取详细版本信息');
  }
}

// 版本建议
console.log('');
log('3. 版本状态', 'cyan');
console.log('');

const electronMajor = parseInt(installedElectronVersion.split('.')[0]);

if (electronMajor >= 39) {
  log('  ✓ Electron 版本是最新的！', 'green');
} else if (electronMajor >= 35) {
  log('  ⚠ Electron 版本较新，但建议升级到最新版本', 'yellow');
} else if (electronMajor >= 27) {
  log('  ⚠ Electron 版本较旧，建议升级', 'yellow');
} else {
  log('  ✗ Electron 版本过旧，强烈建议升级', 'red');
}

// 升级建议
if (electronMajor < 39) {
  console.log('');
  log('4. 升级建议', 'cyan');
  console.log('');
  console.log('  运行以下命令升级到最新版本：');
  log('  npm install electron@latest electron-builder@latest --save-dev', 'yellow');
}

// 兼容性检查
console.log('');
log('5. 兼容性检查', 'cyan');
console.log('');

const checks = [
  { name: 'Node.js 版本', check: () => {
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
    return nodeMajor >= 18;
  }},
  { name: '翻译服务', check: () => {
    return packageJson.dependencies['electron-store'] !== undefined;
  }},
  { name: 'package.json 配置', check: () => {
    return packageJson.main && packageJson.scripts && packageJson.scripts.start;
  }}
];

checks.forEach(({ name, check }) => {
  const passed = check();
  log(`  ${passed ? '✓' : '✗'} ${name}`, passed ? 'green' : 'red');
});

console.log('');
console.log('='.repeat(60));
log('检查完成', 'blue');
console.log('='.repeat(60));
console.log('');

// 提供下一步建议
if (installedElectronVersion !== 'N/A') {
  log('✓ Electron 已正确安装', 'green');
  console.log('');
  console.log('运行以下命令测试应用：');
  log('  npm start', 'yellow');
} else {
  log('✗ Electron 未安装', 'red');
  console.log('');
  console.log('运行以下命令安装：');
  log('  npm install', 'yellow');
}

console.log('');
