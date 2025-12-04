/**
 * 测试翻译引擎配置的保存和加载
 * 验证修复后的翻译设置面板能够正确处理多个引擎的配置
 */

const path = require('path');
const fs = require('fs');

console.log('='.repeat(60));
console.log('翻译引擎配置测试');
console.log('='.repeat(60));

// 测试配置文件路径
const userDataPath = path.join(__dirname, '..', 'userData');
const translationConfigPath = path.join(userDataPath, 'translation');

console.log('\n1. 检查翻译配置目录...');
if (fs.existsSync(translationConfigPath)) {
  console.log('✓ 翻译配置目录存在:', translationConfigPath);
  
  // 列出所有配置文件
  const files = fs.readdirSync(translationConfigPath);
  console.log('\n配置文件列表:');
  files.forEach(file => {
    console.log(`  - ${file}`);
    
    // 读取并显示配置内容
    const filePath = path.join(translationConfigPath, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(content);
      
      if (file.includes('engine-')) {
        console.log(`    引擎: ${file.replace('engine-', '').replace('.json', '')}`);
        console.log(`    配置: ${JSON.stringify({
          hasApiKey: !!config.apiKey,
          endpoint: config.endpoint,
          model: config.model
        }, null, 2).split('\n').map(line => '    ' + line).join('\n')}`);
      } else if (file.includes('account-')) {
        console.log(`    账号配置:`);
        console.log(`      聊天窗口引擎: ${config.global?.engine || 'N/A'}`);
        console.log(`      输入框引擎: ${config.inputBox?.engine || 'N/A'}`);
      }
    } catch (error) {
      console.log(`    ✗ 读取失败: ${error.message}`);
    }
  });
} else {
  console.log('✗ 翻译配置目录不存在');
}

console.log('\n2. 测试场景说明:');
console.log('   场景 1: 聊天窗口使用 Google，输入框使用 Custom API');
console.log('   场景 2: 聊天窗口使用 GPT-4，输入框使用 DeepSeek');
console.log('   场景 3: 两个引擎都使用 Custom API（但配置不同）');

console.log('\n3. 验证要点:');
console.log('   ✓ 两个引擎的配置都应该被保存');
console.log('   ✓ 切换引擎时应该加载对应的配置');
console.log('   ✓ 保存设置后重新加载应该显示正确的配置');
console.log('   ✓ 翻译时应该使用正确的引擎，不应该回退到 Google');

console.log('\n4. 手动测试步骤:');
console.log('   1) 启动应用');
console.log('   2) 打开翻译设置面板');
console.log('   3) 设置聊天窗口引擎为 "Google 翻译"');
console.log('   4) 设置输入框引擎为 "自定义 API"');
console.log('   5) 填写自定义 API 配置');
console.log('   6) 点击保存');
console.log('   7) 重新打开设置面板，确认配置正确');
console.log('   8) 测试翻译功能');

console.log('\n5. 预期结果:');
console.log('   ✓ 不应该出现 "Translation engine not found: custom" 错误');
console.log('   ✓ 不应该回退到 Google 翻译');
console.log('   ✓ 自定义 API 应该正常工作');

console.log('\n' + '='.repeat(60));
console.log('测试完成');
console.log('='.repeat(60));
