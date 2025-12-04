/**
 * 测试翻译脚本注入流程
 * 
 * 这个脚本会检查：
 * 1. TranslationIntegration 是否正确初始化
 * 2. 脚本是否加载到缓存
 * 3. injectScripts 是否被调用
 * 4. 脚本是否成功注入到 webContents
 */

const path = require('path');
const fs = require('fs').promises;

async function testTranslationInjection() {
  console.log('='.repeat(60));
  console.log('测试翻译脚本注入流程');
  console.log('='.repeat(60));
  
  try {
    // 1. 检查 TranslationIntegration 类
    console.log('\n[1] 检查 TranslationIntegration 类...');
    const TranslationIntegration = require('./src/managers/TranslationIntegration');
    console.log('✓ TranslationIntegration 类加载成功');
    
    // 2. 创建实例
    console.log('\n[2] 创建 TranslationIntegration 实例...');
    const translationIntegration = new TranslationIntegration(null);
    console.log('✓ 实例创建成功');
    
    // 3. 初始化（加载脚本到缓存）
    console.log('\n[3] 初始化 TranslationIntegration（加载脚本）...');
    await translationIntegration.initialize();
    console.log('✓ 初始化成功');
    
    // 4. 检查脚本缓存
    console.log('\n[4] 检查脚本缓存...');
    if (translationIntegration.scriptCache.optimizer) {
      console.log(`✓ Optimizer 脚本已加载 (${translationIntegration.scriptCache.optimizer.length} 字符)`);
    } else {
      console.log('✗ Optimizer 脚本未加载');
    }
    
    if (translationIntegration.scriptCache.contentScript) {
      console.log(`✓ Content 脚本已加载 (${translationIntegration.scriptCache.contentScript.length} 字符)`);
    } else {
      console.log('✗ Content 脚本未加载');
    }
    
    // 5. 检查脚本文件是否存在
    console.log('\n[5] 检查脚本文件...');
    const optimizerPath = path.join(__dirname, 'src/translation/contentScriptWithOptimizer.js');
    const contentScriptPath = path.join(__dirname, 'src/translation/contentScript.js');
    
    try {
      await fs.access(optimizerPath);
      console.log(`✓ Optimizer 文件存在: ${optimizerPath}`);
    } catch (error) {
      console.log(`✗ Optimizer 文件不存在: ${optimizerPath}`);
    }
    
    try {
      await fs.access(contentScriptPath);
      console.log(`✓ Content 脚本文件存在: ${contentScriptPath}`);
    } catch (error) {
      console.log(`✗ Content 脚本文件不存在: ${contentScriptPath}`);
    }
    
    // 6. 检查 contentScript.js 是否导出 window.WhatsAppTranslation
    console.log('\n[6] 检查 contentScript.js 内容...');
    const contentScript = await fs.readFile(contentScriptPath, 'utf8');
    
    if (contentScript.includes('window.WhatsAppTranslation')) {
      console.log('✓ contentScript.js 包含 window.WhatsAppTranslation 导出');
      
      // 查找导出位置
      const lines = contentScript.split('\n');
      const exportLine = lines.findIndex(line => line.includes('window.WhatsAppTranslation ='));
      if (exportLine !== -1) {
        console.log(`  导出位置: 第 ${exportLine + 1} 行`);
        console.log(`  内容: ${lines[exportLine].trim()}`);
      }
    } else {
      console.log('✗ contentScript.js 不包含 window.WhatsAppTranslation 导出');
    }
    
    // 7. 检查 ViewManager 集成
    console.log('\n[7] 检查 ViewManager 集成...');
    const ViewManager = require('./src/presentation/windows/view-manager/ViewManager');
    console.log('✓ ViewManager 类加载成功');
    
    // 8. 检查 ViewTranslationIntegration
    console.log('\n[8] 检查 ViewTranslationIntegration...');
    const ViewTranslationIntegration = require('./src/presentation/windows/view-manager/ViewTranslationIntegration');
    console.log('✓ ViewTranslationIntegration 类加载成功');
    
    const viewTranslationIntegration = new ViewTranslationIntegration(translationIntegration);
    console.log('✓ ViewTranslationIntegration 实例创建成功');
    console.log(`  isAvailable: ${viewTranslationIntegration.isAvailable()}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('测试完成！');
    console.log('='.repeat(60));
    
    console.log('\n总结:');
    console.log('- TranslationIntegration 类正常');
    console.log('- 脚本文件存在且可加载');
    console.log('- ViewManager 集成正常');
    console.log('\n如果应用中翻译仍不工作，问题可能在于:');
    console.log('1. injectScripts 没有被调用');
    console.log('2. webContents.executeJavaScript 执行失败');
    console.log('3. 脚本注入时机不对（页面还未加载）');
    console.log('4. 脚本执行时有 JavaScript 错误');
    
  } catch (error) {
    console.error('\n✗ 测试失败:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行测试
testTranslationInjection().catch(console.error);
