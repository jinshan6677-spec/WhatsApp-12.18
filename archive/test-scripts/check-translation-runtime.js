/**
 * 运行时翻译功能检查脚本
 * 
 * 这个脚本会模拟应用启动流程，检查每个环节
 */

const { app, BrowserWindow, BrowserView } = require('electron');
const path = require('path');

let testWindow = null;
let testView = null;

async function runDiagnostics() {
  console.log('\n' + '='.repeat(70));
  console.log('翻译功能运行时诊断');
  console.log('='.repeat(70));

  try {
    // 1. 初始化 TranslationIntegration
    console.log('\n[步骤 1] 初始化 TranslationIntegration...');
    const TranslationIntegration = require('./src/managers/TranslationIntegration');
    const translationIntegration = new TranslationIntegration(null);
    await translationIntegration.initialize();
    console.log('✓ TranslationIntegration 初始化成功');
    console.log(`  - Optimizer 缓存: ${translationIntegration.scriptCache.optimizer ? '已加载' : '未加载'}`);
    console.log(`  - Content 缓存: ${translationIntegration.scriptCache.contentScript ? '已加载' : '未加载'}`);

    // 2. 创建测试窗口
    console.log('\n[步骤 2] 创建测试窗口...');
    testWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      }
    });
    console.log('✓ 测试窗口创建成功');

    // 3. 创建 BrowserView
    console.log('\n[步骤 3] 创建 BrowserView...');
    testView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        partition: 'persist:test-account'
      }
    });
    testWindow.setBrowserView(testView);
    testView.setBounds({ x: 0, y: 0, width: 1200, height: 800 });
    console.log('✓ BrowserView 创建成功');

    // 4. 注入脚本（模拟 injectScripts）
    console.log('\n[步骤 4] 注入翻译脚本...');
    const accountId = 'test-account-123';
    
    // 监听页面加载
    testView.webContents.on('did-finish-load', async () => {
      const url = testView.webContents.getURL();
      console.log(`\n[页面加载完成] URL: ${url}`);
      
      if (!url.includes('web.whatsapp.com')) {
        console.log('⚠ 不是 WhatsApp 页面，跳过注入');
        return;
      }

      try {
        // 注入 ACCOUNT_ID
        await testView.webContents.executeJavaScript(`
          window.ACCOUNT_ID = '${accountId}';
          console.log('[Test] Account ID injected:', '${accountId}');
        `);
        console.log('✓ Account ID 注入成功');

        // 注入 Optimizer
        if (translationIntegration.scriptCache.optimizer) {
          await testView.webContents.executeJavaScript(translationIntegration.scriptCache.optimizer);
          console.log('✓ Optimizer 脚本注入成功');
        }

        // 注入 Content Script
        if (translationIntegration.scriptCache.contentScript) {
          await testView.webContents.executeJavaScript(translationIntegration.scriptCache.contentScript);
          console.log('✓ Content 脚本注入成功');

          // 验证注入
          const hasWhatsAppTranslation = await testView.webContents.executeJavaScript(`
            typeof window.WhatsAppTranslation !== 'undefined'
          `);
          console.log(`✓ window.WhatsAppTranslation 可用: ${hasWhatsAppTranslation}`);

          if (hasWhatsAppTranslation) {
            // 尝试初始化
            const initResult = await testView.webContents.executeJavaScript(`
              (async function() {
                try {
                  if (window.WhatsAppTranslation) {
                    window.WhatsAppTranslation.accountId = '${accountId}';
                    // 不调用 init，因为 WhatsApp 页面还没完全加载
                    return { success: true, available: true };
                  }
                  return { success: false, available: false };
                } catch (error) {
                  return { success: false, error: error.message };
                }
              })();
            `);
            console.log('✓ 初始化结果:', initResult);
          } else {
            console.log('✗ window.WhatsAppTranslation 不可用！');
          }
        }

      } catch (error) {
        console.error('✗ 脚本注入失败:', error);
        console.error('  错误堆栈:', error.stack);
      }
    });

    // 5. 加载 WhatsApp Web
    console.log('\n[步骤 5] 加载 WhatsApp Web...');
    console.log('  URL: https://web.whatsapp.com');
    await testView.webContents.loadURL('https://web.whatsapp.com');
    console.log('✓ 页面加载请求已发送');

    // 等待一段时间让页面加载
    console.log('\n等待页面加载和脚本注入...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 6. 最终验证
    console.log('\n[步骤 6] 最终验证...');
    try {
      const finalCheck = await testView.webContents.executeJavaScript(`
        ({
          hasWhatsAppTranslation: typeof window.WhatsAppTranslation !== 'undefined',
          hasTranslationAPI: typeof window.translationAPI !== 'undefined',
          hasAccountId: typeof window.ACCOUNT_ID !== 'undefined',
          accountId: window.ACCOUNT_ID,
          url: window.location.href
        })
      `);
      
      console.log('最终检查结果:');
      console.log(`  - window.WhatsAppTranslation: ${finalCheck.hasWhatsAppTranslation ? '✓ 存在' : '✗ 不存在'}`);
      console.log(`  - window.translationAPI: ${finalCheck.hasTranslationAPI ? '✓ 存在' : '✗ 不存在'}`);
      console.log(`  - window.ACCOUNT_ID: ${finalCheck.hasAccountId ? '✓ 存在' : '✗ 不存在'}`);
      console.log(`  - Account ID 值: ${finalCheck.accountId}`);
      console.log(`  - 当前 URL: ${finalCheck.url}`);

      if (!finalCheck.hasWhatsAppTranslation) {
        console.log('\n❌ 问题确认: window.WhatsAppTranslation 未注入成功');
        console.log('\n可能的原因:');
        console.log('1. executeJavaScript 执行失败但没有抛出异常');
        console.log('2. contentScript.js 中有语法错误');
        console.log('3. 脚本被 CSP 阻止');
        console.log('4. 页面导航清除了注入的脚本');
      } else {
        console.log('\n✅ 翻译脚本注入成功！');
      }

    } catch (error) {
      console.error('✗ 最终验证失败:', error);
    }

  } catch (error) {
    console.error('\n✗ 诊断过程出错:', error);
    console.error('错误堆栈:', error.stack);
  } finally {
    console.log('\n' + '='.repeat(70));
    console.log('诊断完成，5秒后退出...');
    console.log('='.repeat(70));
    
    setTimeout(() => {
      if (testView) {
        testView.webContents.destroy();
      }
      if (testWindow) {
        testWindow.close();
      }
      app.quit();
    }, 5000);
  }
}

app.whenReady().then(() => {
  runDiagnostics();
});

app.on('window-all-closed', () => {
  app.quit();
});
