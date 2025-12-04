/**
 * ResourceManager 使用示例
 * 
 * 演示如何使用 ResourceManager 监控系统资源和实施资源限制
 */

const { app } = require('electron');
const ResourceManager = require('../managers/ResourceManager');
const InstanceManager = require('../managers/InstanceManager');
const AccountConfig = require('../models/AccountConfig');

// 示例：初始化资源管理器
async function initializeResourceManager() {
  const resourceManager = new ResourceManager({
    limits: {
      maxInstances: 30,
      maxMemoryUsagePercent: 90,
      maxCpuUsagePercent: 90,
      warningMemoryUsagePercent: 75,
      warningCpuUsagePercent: 75
    },
    onWarning: (type, resources) => {
      console.log(`⚠️  Warning: ${type} usage is high`);
      console.log(`Memory: ${resources.memoryUsagePercent.toFixed(1)}%`);
      console.log(`CPU: ${resources.cpuUsage.toFixed(1)}%`);
    },
    onLimit: (type, resources) => {
      console.log(`🚫 Limit reached: ${type}`);
      console.log(`Memory: ${resources.memoryUsagePercent.toFixed(1)}%`);
      console.log(`CPU: ${resources.cpuUsage.toFixed(1)}%`);
    }
  });
  
  console.log('ResourceManager initialized');
  console.log('Limits:', resourceManager.getLimits());
  
  return resourceManager;
}

// 示例：获取系统资源信息
async function getSystemResourceInfo() {
  const resourceManager = new ResourceManager();
  
  const resources = await resourceManager.getSystemResources();
  
  console.log('=== System Resources ===');
  console.log(`Total Memory: ${resources.totalMemory} MB`);
  console.log(`Used Memory: ${resources.usedMemory} MB`);
  console.log(`Free Memory: ${resources.freeMemory} MB`);
  console.log(`Memory Usage: ${resources.memoryUsagePercent.toFixed(1)}%`);
  console.log(`CPU Usage: ${resources.cpuUsage.toFixed(1)}%`);
  console.log(`Process Count: ${resources.processCount}`);
  
  return resources;
}

// 示例：检查是否可以创建新实例
async function checkCanCreateInstance() {
  const resourceManager = new ResourceManager({
    limits: {
      maxInstances: 5,
      maxMemoryUsagePercent: 80,
      maxCpuUsagePercent: 80
    }
  });
  
  // 模拟当前有 3 个实例
  const currentInstanceCount = 3;
  
  const result = await resourceManager.canCreateInstance(currentInstanceCount);
  
  if (result.allowed) {
    console.log('✅ Can create new instance');
    if (result.resources) {
      console.log(`Current resources: Memory ${result.resources.memoryUsagePercent.toFixed(1)}%, CPU ${result.resources.cpuUsage.toFixed(1)}%`);
    }
  } else {
    console.log('❌ Cannot create new instance');
    console.log(`Reason: ${result.reason}`);
  }
  
  return result;
}

// 示例：启动资源监控
async function startResourceMonitoring() {
  const resourceManager = new ResourceManager({
    onWarning: (type, resources) => {
      console.log(`\n⚠️  [${new Date().toLocaleTimeString()}] Warning: ${type} usage is high`);
      console.log(`Memory: ${resources.memoryUsagePercent.toFixed(1)}%, CPU: ${resources.cpuUsage.toFixed(1)}%`);
    }
  });
  
  // 启动监控（每 5 秒检查一次）
  resourceManager.startMonitoring(5000);
  
  console.log('Resource monitoring started');
  console.log('Monitoring every 5 seconds...\n');
  
  // 运行 30 秒后停止
  setTimeout(() => {
    resourceManager.stopMonitoring();
    console.log('\nResource monitoring stopped');
    
    // 显示资源历史
    const history = resourceManager.getResourceHistory(5);
    console.log('\nRecent resource history:');
    history.forEach((record, index) => {
      console.log(`${index + 1}. [${record.timestamp.toLocaleTimeString()}] Memory: ${record.memoryUsagePercent.toFixed(1)}%, CPU: ${record.cpuUsage.toFixed(1)}%`);
    });
  }, 30000);
  
  return resourceManager;
}

// 示例：获取平均资源使用情况
async function getAverageResourceUsage() {
  const resourceManager = new ResourceManager();
  
  // 启动监控
  resourceManager.startMonitoring(2000);
  
  console.log('Collecting resource data for 20 seconds...\n');
  
  // 等待 20 秒收集数据
  await new Promise(resolve => setTimeout(resolve, 20000));
  
  // 获取最近 5 分钟的平均值
  const average = resourceManager.getAverageResources(5);
  
  if (average) {
    console.log('=== Average Resource Usage (last 5 minutes) ===');
    console.log(`Memory: ${average.memoryUsagePercent.toFixed(1)}%`);
    console.log(`CPU: ${average.cpuUsage.toFixed(1)}%`);
    console.log(`Process Count: ${average.processCount}`);
    console.log(`Sample Count: ${average.sampleCount}`);
  } else {
    console.log('No resource data available');
  }
  
  resourceManager.stopMonitoring();
  
  return average;
}

// 示例：获取资源使用趋势
async function getResourceTrend() {
  const resourceManager = new ResourceManager();
  
  // 启动监控
  resourceManager.startMonitoring(1000);
  
  console.log('Monitoring resource trend for 15 seconds...\n');
  
  // 等待 15 秒收集数据
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  // 获取趋势
  const trend = resourceManager.getResourceTrend();
  
  console.log('=== Resource Usage Trend ===');
  console.log(`Memory: ${trend.memory} (${trend.memoryChange > 0 ? '+' : ''}${trend.memoryChange.toFixed(1)}%)`);
  console.log(`CPU: ${trend.cpu} (${trend.cpuChange > 0 ? '+' : ''}${trend.cpuChange.toFixed(1)}%)`);
  
  resourceManager.stopMonitoring();
  
  return trend;
}

// 示例：集成到 InstanceManager
async function integrateWithInstanceManager() {
  // 创建资源管理器
  const resourceManager = new ResourceManager({
    limits: {
      maxInstances: 10,
      maxMemoryUsagePercent: 85,
      warningMemoryUsagePercent: 70
    },
    onWarning: (type, resources) => {
      console.log(`⚠️  System resources warning: ${type} at ${resources[type === 'memory' ? 'memoryUsagePercent' : 'cpuUsage'].toFixed(1)}%`);
    }
  });
  
  // 启动资源监控
  resourceManager.startMonitoring(10000);
  
  // 创建 InstanceManager 并传入 ResourceManager
  const instanceManager = new InstanceManager({
    resourceManager: resourceManager
  });
  
  console.log('InstanceManager created with ResourceManager integration');
  
  // 尝试创建实例（会自动检查资源）
  const accountConfig = new AccountConfig({
    name: '测试账号'
  });
  
  const result = await instanceManager.createInstance(accountConfig);
  
  if (result.success) {
    console.log('✅ Instance created successfully');
  } else {
    console.log(`❌ Failed to create instance: ${result.error}`);
  }
  
  return { instanceManager, resourceManager };
}

// 示例：获取推荐的最大实例数
async function getRecommendedMaxInstances() {
  const resourceManager = new ResourceManager();
  
  const recommended = await resourceManager.getRecommendedMaxInstances();
  
  console.log('=== Recommended Configuration ===');
  console.log(`Recommended max instances: ${recommended}`);
  
  const resources = await resourceManager.getSystemResources();
  console.log(`Based on: ${resources.totalMemory} MB total memory, ${resources.freeMemory} MB free`);
  
  return recommended;
}

// 示例：动态调整资源限制
async function dynamicResourceLimits() {
  const resourceManager = new ResourceManager({
    limits: {
      maxInstances: 20,
      maxMemoryUsagePercent: 80
    }
  });
  
  console.log('Initial limits:', resourceManager.getLimits());
  
  // 获取系统资源
  const resources = await resourceManager.getSystemResources();
  
  // 根据可用内存动态调整限制
  if (resources.freeMemory < 2000) {
    // 可用内存少于 2GB，降低限制
    resourceManager.updateLimits({
      maxInstances: 10,
      maxMemoryUsagePercent: 70
    });
    console.log('Low memory detected, limits adjusted');
  } else if (resources.freeMemory > 8000) {
    // 可用内存大于 8GB，提高限制
    resourceManager.updateLimits({
      maxInstances: 40,
      maxMemoryUsagePercent: 90
    });
    console.log('High memory available, limits increased');
  }
  
  console.log('Updated limits:', resourceManager.getLimits());
  
  return resourceManager;
}

// 示例：处理资源警告和限制
async function handleResourceWarnings() {
  let warningCount = 0;
  let limitCount = 0;
  
  const resourceManager = new ResourceManager({
    limits: {
      maxMemoryUsagePercent: 60,  // 设置较低的限制以便测试
      warningMemoryUsagePercent: 50
    },
    onWarning: (type, resources) => {
      warningCount++;
      console.log(`\n⚠️  Warning #${warningCount}: ${type} usage at ${resources.memoryUsagePercent.toFixed(1)}%`);
      console.log('Action: Consider stopping some instances');
    },
    onLimit: (type, resources) => {
      limitCount++;
      console.log(`\n🚫 Limit #${limitCount}: ${type} exceeded at ${resources.memoryUsagePercent.toFixed(1)}%`);
      console.log('Action: Preventing new instance creation');
    }
  });
  
  resourceManager.startMonitoring(3000);
  
  console.log('Monitoring for warnings and limits...\n');
  
  // 运行 20 秒
  await new Promise(resolve => setTimeout(resolve, 20000));
  
  resourceManager.stopMonitoring();
  
  console.log(`\nTotal warnings: ${warningCount}`);
  console.log(`Total limits reached: ${limitCount}`);
  
  return { warningCount, limitCount };
}

// 主函数
async function main() {
  await app.whenReady();
  
  console.log('=== ResourceManager Examples ===\n');
  
  try {
    console.log('1. Get System Resource Info');
    await getSystemResourceInfo();
    
    console.log('\n2. Check Can Create Instance');
    await checkCanCreateInstance();
    
    console.log('\n3. Get Recommended Max Instances');
    await getRecommendedMaxInstances();
    
    console.log('\n4. Dynamic Resource Limits');
    await dynamicResourceLimits();
    
    console.log('\n=== Examples completed ===');
  } catch (error) {
    console.error('Error running examples:', error);
  }
  
  setTimeout(() => {
    app.quit();
  }, 5000);
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = {
  initializeResourceManager,
  getSystemResourceInfo,
  checkCanCreateInstance,
  startResourceMonitoring,
  getAverageResourceUsage,
  getResourceTrend,
  integrateWithInstanceManager,
  getRecommendedMaxInstances,
  dynamicResourceLimits,
  handleResourceWarnings
};
