#!/usr/bin/env node

/**
 * 重构功能验证测试
 * 验证新架构的核心组件是否正常工作
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('重构功能验证测试');
console.log('========================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    failed++;
  }
}

function assertExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description}不存在: ${filePath}`);
  }
}

function assertCanRequire(modulePath, description) {
  try {
    require(modulePath);
  } catch (error) {
    throw new Error(`${description}加载失败: ${error.message}`);
  }
}

// 测试1: 检查新架构文件是否存在
test('main-refactored.js 存在', () => {
  assertExists('src/main-refactored.js', 'main-refactored.js');
});

test('bootstrap.js 存在', () => {
  assertExists('src/app/bootstrap.js', 'bootstrap.js');
});

test('DependencyContainer.js 存在', () => {
  assertExists('src/app/DependencyContainer.js', 'DependencyContainer.js');
});

test('ViewBoundsManager.js 存在', () => {
  assertExists('src/ui/main-window/ViewBoundsManager.js', 'ViewBoundsManager.js');
});

test('ViewMemoryManager.js 存在', () => {
  assertExists('src/ui/main-window/ViewMemoryManager.js', 'ViewMemoryManager.js');
});

test('module-aliases.js 存在', () => {
  assertExists('src/config/module-aliases.js', 'module-aliases.js');
});

// 测试2: 检查旧文件是否已删除
test('旧的ErrorHandler.js 已删除', () => {
  if (fs.existsSync('src/managers/ErrorHandler.js')) {
    throw new Error('旧的ErrorHandler.js仍然存在');
  }
});

// 测试3: 测试依赖注入容器
test('DependencyContainer 可加载', () => {
  assertCanRequire('./src/app/DependencyContainer', 'DependencyContainer');
  
  const { DependencyContainer } = require('./src/app/DependencyContainer');
  const container = new DependencyContainer();
  
  if (typeof container.registerSingleton !== 'function') {
    throw new Error('registerSingleton方法不存在');
  }
  
  if (typeof container.get !== 'function') {
    throw new Error('get方法不存在');
  }
});

// 测试4: 测试ViewBoundsManager
test('ViewBoundsManager 可加载', () => {
  assertCanRequire('./src/ui/main-window/ViewBoundsManager', 'ViewBoundsManager');
  
  const ViewBoundsManager = require('./src/ui/main-window/ViewBoundsManager');
  
  if (typeof ViewBoundsManager !== 'function') {
    throw new Error('ViewBoundsManager不是构造函数');
  }
});

// 测试5: 测试ViewMemoryManager
test('ViewMemoryManager 可加载', () => {
  assertCanRequire('./src/ui/main-window/ViewMemoryManager', 'ViewMemoryManager');
  
  const ViewMemoryManager = require('./src/ui/main-window/ViewMemoryManager');
  
  if (typeof ViewMemoryManager !== 'function') {
    throw new Error('ViewMemoryManager不是构造函数');
  }
});

// 测试6: 测试bootstrap
test('bootstrap 可加载', () => {
  assertCanRequire('./src/app/bootstrap', 'bootstrap');
  
  const { initializeApp } = require('./src/app/bootstrap');
  
  if (typeof initializeApp !== 'function') {
    throw new Error('initializeApp不是函数');
  }
});

// 测试7: 测试模块别名配置
test('module-aliases 配置正确', () => {
  const aliases = require('./src/config/module-aliases');
  
  if (typeof aliases !== 'object') {
    throw new Error('module-aliases不是对象');
  }
  
  if (!aliases['@app']) {
    throw new Error('@app别名未定义');
  }
  
  if (!aliases['@core']) {
    throw new Error('@core别名未定义');
  }
  
  if (!aliases['@ui']) {
    throw new Error('@ui别名未定义');
  }
});

// 测试8: 测试统一导出
test('core/index.js 统一导出正确', () => {
  const core = require('./src/core');
  
  if (typeof core !== 'object') {
    throw new Error('core导出不是对象');
  }
  
  if (typeof core.managers !== 'object') {
    throw new Error('core.managers导出不正确');
  }
});

test('shared/utils/index.js 统一导出正确', () => {
  const utils = require('./src/shared/utils');
  
  if (typeof utils !== 'object') {
    throw new Error('shared/utils导出不是对象');
  }
  
  if (typeof utils.getErrorHandler !== 'function') {
    throw new Error('getErrorHandler方法不存在');
  }
});

// 测试9: 测试错误处理器（简化版，不测试需要Electron app的功能）
test('UnifiedErrorHandler 基本结构正确', () => {
  const { UnifiedErrorHandler, ErrorHandlerType } = require('./src/shared/utils/ErrorHandler');
  
  // 验证类和常量存在
  if (typeof UnifiedErrorHandler !== 'function') {
    throw new Error('UnifiedErrorHandler不是构造函数');
  }
  
  if (!ErrorHandlerType) {
    throw new Error('ErrorHandlerType未定义');
  }
  
  // 验证模块导出
  const errorHandlerModule = require('./src/shared/utils/ErrorHandler');
  if (typeof errorHandlerModule.createErrorHandler !== 'function') {
    throw new Error('createErrorHandler不是函数');
  }
  
  if (typeof errorHandlerModule.getErrorHandler !== 'function') {
    throw new Error('getErrorHandler不是函数');
  }
});

// 总结
console.log('\n========================================');
console.log('测试结果');
console.log('========================================');
console.log(`✅ 通过: ${passed}`);
console.log(`❌ 失败: ${failed}`);
console.log(`总计: ${passed + failed}`);

if (failed > 0) {
  console.log('\n❌ 部分测试失败，请检查错误信息');
  process.exit(1);
} else {
  console.log('\n✅ 所有测试通过！重构功能正常');
  process.exit(0);
}