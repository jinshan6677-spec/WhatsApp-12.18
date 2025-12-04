/**
 * Window State Management 使用示例
 * 
 * 演示如何使用 InstanceManager 管理窗口位置和大小的保存恢复
 */

const { app } = require('electron');
const InstanceManager = require('../managers/InstanceManager');
const AccountConfigManager = require('../managers/AccountConfigManager');
const AccountConfig = require('../models/AccountConfig');

// 示例：创建带有自定义窗口位置的实例
async function createInstanceWithCustomPosition() {
  const instanceManager = new InstanceManager();
  
  // 创建账号配置，指定窗口位置和大小
  const accountConfig = new AccountConfig({
    name: '测试账号',
    window: {
      x: 100,
      y: 100,
      width: 1200,
      height: 800,
      minimized: false
    }
  });
  
  // 创建实例
  const result = await instanceManager.createInstance(accountConfig);
  
  if (result.success) {
    console.log('Instance created with custom window position');
    console.log('Window bounds:', accountConfig.window);
  }
  
  return { instanceManager, instanceId: accountConfig.id };
}

// 示例：自动保存窗口状态
async function autoSaveWindowState() {
  const instanceManager = new InstanceManager();
  
  const accountConfig = new AccountConfig({
    name: '自动保存测试'
  });
  
  const result = await instanceManager.createInstance(accountConfig);
  
  if (result.success) {
    console.log('Instance created, window state will be auto-saved on move/resize');
    
    // 窗口移动或调整大小时会自动保存状态
    // 可以通过 instanceManager.saveWindowState(instanceId) 手动保存
    
    // 等待 5 秒后获取窗口状态
    setTimeout(() => {
      const stateResult = instanceManager.getWindowState(accountConfig.id);
      if (stateResult.success) {
        console.log('Current window state:', stateResult.bounds);
      }
    }, 5000);
  }
  
  return { instanceManager, instanceId: accountConfig.id };
}

// 示例：恢复窗口位置
async function restoreWindowPosition() {
  const configManager = new AccountConfigManager();
  const instanceManager = new InstanceManager();
  
  // 创建账号并设置窗口位置
  const accountConfig = new AccountConfig({
    name: '位置恢复测试',
    window: {
      x: 200,
      y: 200,
      width: 1000,
      height: 600
    }
  });
  
  // 保存配置
  await configManager.saveAccount(accountConfig);
  
  // 创建实例（会自动恢复窗口位置）
  const result = await instanceManager.createInstance(accountConfig);
  
  if (result.success) {
    console.log('Instance created with restored window position');
    
    // 获取当前窗口状态
    const stateResult = instanceManager.getWindowState(accountConfig.id);
    if (stateResult.success) {
      console.log('Restored window bounds:', stateResult.bounds);
    }
  }
  
  return { instanceManager, instanceId: accountConfig.id };
}

// 示例：处理多显示器场景
async function handleMultipleDisplays() {
  const { screen } = require('electron');
  const instanceManager = new InstanceManager();
  
  // 获取所有显示器
  const displays = screen.getAllDisplays();
  console.log(`Found ${displays.length} display(s)`);
  
  displays.forEach((display, index) => {
    console.log(`Display ${index}:`, {
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor
    });
  });
  
  // 创建账号配置，窗口位置在屏幕外（会被自动修正）
  const accountConfig = new AccountConfig({
    name: '多显示器测试',
    window: {
      x: -9999,  // 屏幕外的位置
      y: -9999,
      width: 1200,
      height: 800
    }
  });
  
  // 创建实例（窗口会被自动移到主显示器中心）
  const result = await instanceManager.createInstance(accountConfig);
  
  if (result.success) {
    console.log('Instance created, window position was corrected');
    
    const stateResult = instanceManager.getWindowState(accountConfig.id);
    if (stateResult.success) {
      console.log('Corrected window bounds:', stateResult.bounds);
    }
  }
  
  return { instanceManager, instanceId: accountConfig.id };
}

// 示例：手动保存和恢复窗口状态
async function manualSaveRestore() {
  const instanceManager = new InstanceManager();
  
  const accountConfig = new AccountConfig({
    name: '手动保存测试'
  });
  
  // 创建实例
  const result = await instanceManager.createInstance(accountConfig);
  
  if (result.success) {
    const instanceId = accountConfig.id;
    
    // 等待 2 秒
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 手动保存窗口状态
    const saveResult = instanceManager.saveWindowState(instanceId);
    if (saveResult.success) {
      console.log('Window state saved manually:', saveResult.bounds);
    }
    
    // 修改窗口位置
    const setResult = instanceManager.setWindowState(instanceId, {
      x: 300,
      y: 300,
      width: 1000,
      height: 700
    });
    
    if (setResult.success) {
      console.log('Window position changed');
      
      // 获取新的窗口状态
      const newStateResult = instanceManager.getWindowState(instanceId);
      if (newStateResult.success) {
        console.log('New window state:', newStateResult.bounds);
      }
    }
  }
  
  return { instanceManager, instanceId: accountConfig.id };
}

// 示例：窗口最小化和最大化
async function windowMinimizeMaximize() {
  const instanceManager = new InstanceManager();
  
  const accountConfig = new AccountConfig({
    name: '最小化最大化测试'
  });
  
  const result = await instanceManager.createInstance(accountConfig);
  
  if (result.success) {
    const instance = instanceManager.instances.get(accountConfig.id);
    const window = instance.window;
    
    console.log('Window created');
    
    // 等待 2 秒后最小化
    setTimeout(() => {
      window.minimize();
      console.log('Window minimized');
    }, 2000);
    
    // 等待 4 秒后恢复
    setTimeout(() => {
      window.restore();
      console.log('Window restored');
    }, 4000);
    
    // 等待 6 秒后最大化
    setTimeout(() => {
      window.maximize();
      console.log('Window maximized');
    }, 6000);
    
    // 等待 8 秒后取消最大化
    setTimeout(() => {
      window.unmaximize();
      console.log('Window unmaximized');
      
      // 获取最终窗口状态
      const stateResult = instanceManager.getWindowState(accountConfig.id);
      if (stateResult.success) {
        console.log('Final window state:', stateResult.bounds);
      }
    }, 8000);
  }
  
  return { instanceManager, instanceId: accountConfig.id };
}

// 示例：销毁实例时保存窗口状态
async function saveOnDestroy() {
  const configManager = new AccountConfigManager();
  const instanceManager = new InstanceManager();
  
  const accountConfig = new AccountConfig({
    name: '销毁保存测试'
  });
  
  // 保存配置
  await configManager.saveAccount(accountConfig);
  
  // 创建实例
  const result = await instanceManager.createInstance(accountConfig);
  
  if (result.success) {
    console.log('Instance created');
    
    // 等待 3 秒后销毁实例（会自动保存窗口状态）
    setTimeout(async () => {
      const destroyResult = await instanceManager.destroyInstance(
        accountConfig.id,
        { saveState: true }  // 保存状态
      );
      
      if (destroyResult.success) {
        console.log('Instance destroyed, window state saved');
        
        // 重新加载配置查看保存的窗口状态
        const accounts = await configManager.loadAccounts();
        const savedAccount = accounts.find(a => a.id === accountConfig.id);
        if (savedAccount) {
          console.log('Saved window configuration:', savedAccount.window);
        }
      }
    }, 3000);
  }
  
  return { instanceManager, instanceId: accountConfig.id };
}

// 主函数
async function main() {
  await app.whenReady();
  
  console.log('=== Window State Management Examples ===\n');
  
  try {
    console.log('1. Create Instance with Custom Position');
    await createInstanceWithCustomPosition();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n2. Handle Multiple Displays');
    await handleMultipleDisplays();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n3. Manual Save and Restore');
    await manualSaveRestore();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n=== Examples completed ===');
  } catch (error) {
    console.error('Error running examples:', error);
  }
  
  // 保持应用运行
  setTimeout(() => {
    app.quit();
  }, 15000);
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = {
  createInstanceWithCustomPosition,
  autoSaveWindowState,
  restoreWindowPosition,
  handleMultipleDisplays,
  manualSaveRestore,
  windowMinimizeMaximize,
  saveOnDestroy
};
