/**
 * TranslationIntegration 使用示例
 * 
 * 演示如何在多实例架构中使用翻译集成功能
 */

const { app } = require('electron');
const InstanceManager = require('../managers/InstanceManager');
const AccountConfigManager = require('../managers/AccountConfigManager');
const TranslationIntegration = require('../managers/TranslationIntegration');
const AccountConfig = require('../models/AccountConfig');

/**
 * 示例：初始化翻译集成
 */
async function initializeTranslationIntegration() {
  console.log('=== 初始化翻译集成示例 ===\n');

  // 1. 创建实例管理器
  const instanceManager = new InstanceManager({
    userDataPath: app.getPath('userData'),
    maxInstances: 30
  });

  // 2. 创建翻译集成实例
  const translationIntegration = new TranslationIntegration(instanceManager);

  // 3. 初始化翻译集成（加载脚本到缓存）
  await translationIntegration.initialize();
  console.log('✓ 翻译集成初始化完成\n');

  // 4. 将翻译集成关联到实例管理器
  instanceManager.translationIntegration = translationIntegration;

  return { instanceManager, translationIntegration };
}

/**
 * 示例：创建带翻译功能的实例
 */
async function createInstanceWithTranslation() {
  console.log('=== 创建带翻译功能的实例示例 ===\n');

  const { instanceManager, translationIntegration } = await initializeTranslationIntegration();

  // 创建账号配置（包含翻译配置）
  const accountConfig = new AccountConfig({
    name: '测试账号',
    translation: {
      enabled: true,
      targetLanguage: 'zh-CN',
      engine: 'google',
      autoTranslate: true,
      translateInput: true,
      friendSettings: {}
    }
  });

  console.log('账号配置:', {
    id: accountConfig.id,
    name: accountConfig.name,
    translation: accountConfig.translation
  });

  // 创建实例（会自动注入翻译脚本）
  const result = await instanceManager.createInstance(accountConfig);

  if (result.success) {
    console.log(`✓ 实例创建成功: ${result.instanceId}`);
    
    // 检查翻译状态
    const status = translationIntegration.getTranslationStatus(result.instanceId);
    console.log('翻译状态:', status);
  } else {
    console.error(`✗ 实例创建失败: ${result.error}`);
  }

  return { instanceManager, translationIntegration, accountConfig };
}

/**
 * 示例：动态更新翻译配置
 */
async function updateTranslationConfigExample() {
  console.log('\n=== 动态更新翻译配置示例 ===\n');

  const { instanceManager, translationIntegration, accountConfig } = 
    await createInstanceWithTranslation();

  const instanceId = accountConfig.id;

  // 等待实例完全启动
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 更新翻译配置
  const newConfig = {
    enabled: true,
    targetLanguage: 'en',  // 改为英文
    engine: 'google',
    autoTranslate: false,  // 关闭自动翻译
    translateInput: true,
    friendSettings: {}
  };

  console.log('更新翻译配置为:', newConfig);

  const result = await translationIntegration.configureTranslation(instanceId, newConfig);

  if (result.success) {
    console.log('✓ 翻译配置更新成功');
    
    // 验证配置已更新
    const currentConfig = translationIntegration.getTranslationConfig(instanceId);
    console.log('当前配置:', currentConfig);
  } else {
    console.error(`✗ 翻译配置更新失败: ${result.error}`);
  }

  // 清理
  await instanceManager.destroyInstance(instanceId);
}

/**
 * 示例：为多个实例配置独立的翻译设置
 */
async function multipleInstancesWithDifferentTranslationExample() {
  console.log('\n=== 多实例独立翻译配置示例 ===\n');

  const { instanceManager, translationIntegration } = await initializeTranslationIntegration();

  // 创建配置管理器
  const configManager = new AccountConfigManager();

  // 创建三个账号，每个有不同的翻译配置
  const accounts = [
    {
      name: '中文账号',
      translation: {
        enabled: true,
        targetLanguage: 'zh-CN',
        engine: 'google',
        autoTranslate: true,
        translateInput: false
      }
    },
    {
      name: '英文账号',
      translation: {
        enabled: true,
        targetLanguage: 'en',
        engine: 'google',
        autoTranslate: true,
        translateInput: true
      }
    },
    {
      name: '日文账号',
      translation: {
        enabled: true,
        targetLanguage: 'ja',
        engine: 'google',
        autoTranslate: false,
        translateInput: true
      }
    }
  ];

  const instanceIds = [];

  // 创建所有实例
  for (const accountData of accounts) {
    const accountConfig = new AccountConfig(accountData);
    await configManager.saveAccount(accountConfig);

    const result = await instanceManager.createInstance(accountConfig);
    
    if (result.success) {
      console.log(`✓ 创建实例: ${accountData.name} (${result.instanceId})`);
      console.log(`  - 目标语言: ${accountData.translation.targetLanguage}`);
      console.log(`  - 自动翻译: ${accountData.translation.autoTranslate}`);
      instanceIds.push(result.instanceId);
    } else {
      console.error(`✗ 创建实例失败: ${result.error}`);
    }
  }

  // 等待所有实例启动
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 显示所有实例的翻译状态
  console.log('\n所有实例的翻译状态:');
  for (const instanceId of instanceIds) {
    const status = translationIntegration.getTranslationStatus(instanceId);
    const config = translationIntegration.getTranslationConfig(instanceId);
    console.log(`\n实例 ${instanceId}:`);
    console.log('  状态:', status);
    console.log('  配置:', config);
  }

  // 清理所有实例
  console.log('\n清理所有实例...');
  await instanceManager.destroyAllInstances();
  console.log('✓ 清理完成');
}

/**
 * 示例：清除翻译缓存
 */
async function clearTranslationCacheExample() {
  console.log('\n=== 清除翻译缓存示例 ===\n');

  const { instanceManager, translationIntegration, accountConfig } = 
    await createInstanceWithTranslation();

  const instanceId = accountConfig.id;

  // 等待实例启动
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 清除缓存
  console.log('清除翻译缓存...');
  const result = await translationIntegration.clearCache(instanceId);

  if (result.success) {
    console.log('✓ 缓存清除成功');
  } else {
    console.error(`✗ 缓存清除失败: ${result.error}`);
  }

  // 清理
  await instanceManager.destroyInstance(instanceId);
}

/**
 * 示例：获取翻译性能统计
 */
async function getPerformanceStatsExample() {
  console.log('\n=== 获取翻译性能统计示例 ===\n');

  const { instanceManager, translationIntegration, accountConfig } = 
    await createInstanceWithTranslation();

  const instanceId = accountConfig.id;

  // 等待实例启动并进行一些翻译操作
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 获取性能统计
  console.log('获取性能统计...');
  const result = await translationIntegration.getPerformanceStats(instanceId);

  if (result.success) {
    console.log('✓ 性能统计:');
    console.log(JSON.stringify(result.data, null, 2));
  } else {
    console.error(`✗ 获取性能统计失败: ${result.error}`);
  }

  // 清理
  await instanceManager.destroyInstance(instanceId);
}

/**
 * 主函数
 */
async function main() {
  try {
    // 等待 Electron 应用就绪
    await app.whenReady();

    console.log('TranslationIntegration 使用示例\n');
    console.log('=====================================\n');

    // 运行示例（取消注释想要运行的示例）
    
    // await createInstanceWithTranslation();
    // await updateTranslationConfigExample();
    // await multipleInstancesWithDifferentTranslationExample();
    // await clearTranslationCacheExample();
    // await getPerformanceStatsExample();

    console.log('\n示例运行完成！');
    console.log('\n提示：取消注释 main() 函数中的示例代码来运行不同的示例');

  } catch (error) {
    console.error('示例运行失败:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  initializeTranslationIntegration,
  createInstanceWithTranslation,
  updateTranslationConfigExample,
  multipleInstancesWithDifferentTranslationExample,
  clearTranslationCacheExample,
  getPerformanceStatsExample
};
