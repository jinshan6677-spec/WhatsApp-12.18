/**
 * 简单的脚本注入测试
 * 直接测试 executeJavaScript 是否能注入 window.WhatsAppTranslation
 */

const fs = require('fs');
const path = require('path');

async function testScriptContent() {
  console.log('='.repeat(60));
  console.log('测试脚本内容');
  console.log('='.repeat(60));

  try {
    // 1. 读取 contentScript.js
    const contentScriptPath = path.join(__dirname, 'src/translation/contentScript.js');
    const contentScript = fs.readFileSync(contentScriptPath, 'utf8');
    
    console.log(`\n✓ 读取 contentScript.js 成功 (${contentScript.length} 字符)`);

    // 2. 检查是否包含 window.WhatsAppTranslation 导出
    if (contentScript.includes('window.WhatsAppTranslation =')) {
      console.log('✓ 包含 window.WhatsAppTranslation 导出');
    } else {
      console.log('✗ 不包含 window.WhatsAppTranslation 导出');
    }

    // 3. 检查脚本结构
    console.log('\n检查脚本结构:');
    
    // 检查是否是 IIFE
    if (contentScript.trim().startsWith('(function')) {
      console.log('✓ 使用 IIFE 包装');
    } else {
      console.log('⚠ 未使用 IIFE 包装');
    }

    // 检查是否有语法错误（简单检查）
    const openParens = (contentScript.match(/\(/g) || []).length;
    const closeParens = (contentScript.match(/\)/g) || []).length;
    const openBraces = (contentScript.match(/\{/g) || []).length;
    const closeBraces = (contentScript.match(/\}/g) || []).length;
    
    console.log(`\n括号匹配检查:`);
    console.log(`  圆括号: ${openParens} 开 vs ${closeParens} 闭 ${openParens === closeParens ? '✓' : '✗'}`);
    console.log(`  花括号: ${openBraces} 开 vs ${closeBraces} 闭 ${openBraces === closeBraces ? '✓' : '✗'}`);

    // 4. 尝试在 Node.js 中执行（会失败，但可以检测语法错误）
    console.log('\n尝试语法检查...');
    try {
      // 创建一个模拟的浏览器环境
      const mockWindow = {
        translationAPI: {},
        location: { href: 'https://web.whatsapp.com' },
        document: {
          querySelector: () => null,
          querySelectorAll: () => [],
          createElement: () => ({
            style: {},
            classList: { add: () => {}, remove: () => {} },
            addEventListener: () => {}
          })
        },
        MutationObserver: class {},
        setTimeout: setTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        console: console
      };

      // 使用 Function 构造函数检查语法
      new Function('window', contentScript);
      console.log('✓ 脚本语法正确');

    } catch (syntaxError) {
      console.log('✗ 脚本有语法错误:');
      console.log('  ', syntaxError.message);
      console.log('  行号:', syntaxError.lineNumber || '未知');
    }

    // 5. 检查关键函数
    console.log('\n检查关键函数:');
    const keyFunctions = [
      'init',
      'loadConfig',
      'observeMessages',
      'translateMessage',
      'observeInputBox'
    ];

    for (const func of keyFunctions) {
      if (contentScript.includes(`${func}(`)) {
        console.log(`  ✓ ${func}`);
      } else {
        console.log(`  ✗ ${func} 未找到`);
      }
    }

    // 6. 生成测试用的简化脚本
    console.log('\n生成测试脚本...');
    const testScript = `
(function() {
  console.log('[Test] Starting injection test...');
  
  // 简化版的 WhatsAppTranslation
  window.WhatsAppTranslation = {
    initialized: false,
    config: null,
    accountId: 'test',
    
    init: async function() {
      console.log('[Test] WhatsAppTranslation.init() called');
      this.initialized = true;
      return true;
    },
    
    test: function() {
      console.log('[Test] WhatsAppTranslation.test() called');
      return 'Translation system is working!';
    }
  };
  
  console.log('[Test] window.WhatsAppTranslation created');
  console.log('[Test] Type:', typeof window.WhatsAppTranslation);
  console.log('[Test] Has init:', typeof window.WhatsAppTranslation.init);
})();
`;

    fs.writeFileSync('test-injection-script.js', testScript);
    console.log('✓ 测试脚本已保存到 test-injection-script.js');
    console.log('\n你可以在浏览器控制台中执行这个脚本来测试注入是否工作');

    // 7. 建议
    console.log('\n' + '='.repeat(60));
    console.log('建议的调试步骤:');
    console.log('='.repeat(60));
    console.log('1. 打开应用并打开一个账号');
    console.log('2. 按 F12 打开 DevTools');
    console.log('3. 在 Console 中执行:');
    console.log('   ```javascript');
    console.log('   // 复制 test-injection-script.js 的内容并执行');
    console.log('   // 然后检查:');
    console.log('   console.log(window.WhatsAppTranslation);');
    console.log('   window.WhatsAppTranslation.test();');
    console.log('   ```');
    console.log('4. 如果测试脚本工作，说明 executeJavaScript 本身没问题');
    console.log('5. 如果测试脚本不工作，说明有其他问题（CSP、权限等）');

  } catch (error) {
    console.error('\n✗ 测试失败:', error);
    console.error('错误堆栈:', error.stack);
  }
}

testScriptContent();
