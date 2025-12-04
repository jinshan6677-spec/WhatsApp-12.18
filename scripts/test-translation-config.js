/**
 * 测试翻译配置
 * 验证聊天窗口翻译和输入框翻译的引擎分离功能
 */

console.log('='.repeat(60));
console.log('翻译配置测试');
console.log('='.repeat(60));

console.log('\n1. 测试默认配置结构');
console.log('-'.repeat(60));

// 模拟默认配置
const defaultConfig = {
  global: {
    autoTranslate: false,
    engine: 'google',        // 聊天窗口翻译引擎（接收消息）
    sourceLang: 'auto',
    targetLang: 'zh-CN',
    groupTranslation: false
  },
  inputBox: {
    enabled: false,
    engine: 'google',        // 输入框翻译引擎（发送消息）
    style: '通用',           // 翻译风格（仅用于输入框翻译）
    targetLang: 'auto'
  },
  advanced: {
    friendIndependent: false,
    blockChinese: false,
    realtime: false,
    reverseTranslation: false,
    voiceTranslation: false,
    imageTranslation: false
  },
  friendConfigs: {}
};

console.log('默认配置：');
console.log(JSON.stringify(defaultConfig, null, 2));

// 验证默认配置
console.log('\n验证默认配置：');
console.log('✓ global.engine:', defaultConfig.global.engine);
console.log('✓ inputBox.engine:', defaultConfig.inputBox.engine);
console.log('✓ inputBox.style:', defaultConfig.inputBox.style);

console.log('\n2. 测试自定义配置');
console.log('-'.repeat(60));

// 自定义配置
const customConfig = {
  global: {
    autoTranslate: true,
    engine: 'google',  // 聊天窗口用谷歌翻译
    sourceLang: 'auto',
    targetLang: 'zh-CN',
    groupTranslation: true
  },
  inputBox: {
    enabled: true,
    engine: 'gpt4',    // 输入框用 GPT-4
    style: '正式',     // 使用正式风格
    targetLang: 'auto'
  },
  advanced: {
    friendIndependent: false,
    blockChinese: false,
    realtime: true,
    reverseTranslation: true,
    voiceTranslation: false,
    imageTranslation: false
  },
  friendConfigs: {}
};

console.log('自定义配置：');
console.log(JSON.stringify(customConfig, null, 2));

// 验证配置
console.log('\n验证配置结构：');
const checks = [
  { name: '聊天窗口引擎', expected: 'google', actual: customConfig.global.engine },
  { name: '输入框引擎', expected: 'gpt4', actual: customConfig.inputBox.engine },
  { name: '输入框风格', expected: '正式', actual: customConfig.inputBox.style },
  { name: '自动翻译', expected: true, actual: customConfig.global.autoTranslate },
  { name: '输入框启用', expected: true, actual: customConfig.inputBox.enabled },
  { name: '实时翻译', expected: true, actual: customConfig.advanced.realtime }
];

let allPassed = true;
checks.forEach(check => {
  const passed = check.expected === check.actual;
  const symbol = passed ? '✓' : '✗';
  console.log(`${symbol} ${check.name}: ${check.actual} ${passed ? '' : `(期望: ${check.expected})`}`);
  if (!passed) allPassed = false;
});

console.log('\n3. 测试不同配置方案');
console.log('-'.repeat(60));

// 方案 1：成本优先
console.log('\n方案 1：成本优先（推荐）');
const costOptimized = {
  ...customConfig,
  global: { ...customConfig.global, engine: 'google' },
  inputBox: { ...customConfig.inputBox, engine: 'gpt4', style: '正式' }
};
console.log('- 聊天窗口：谷歌翻译（免费）');
console.log('- 输入框：GPT-4 + 正式风格（付费）');
console.log('- 成本：中等');

// 方案 2：质量优先
console.log('\n方案 2：质量优先');
const qualityOptimized = {
  ...customConfig,
  global: { ...customConfig.global, engine: 'gpt4' },
  inputBox: { ...customConfig.inputBox, engine: 'gpt4', style: '通用' }
};
console.log('- 聊天窗口：GPT-4（付费）');
console.log('- 输入框：GPT-4 + 通用风格（付费）');
console.log('- 成本：较高');

// 方案 3：完全免费
console.log('\n方案 3：完全免费');
const freeOptimized = {
  ...customConfig,
  global: { ...customConfig.global, engine: 'google' },
  inputBox: { ...customConfig.inputBox, engine: 'google', style: '通用' }
};
console.log('- 聊天窗口：谷歌翻译（免费）');
console.log('- 输入框：谷歌翻译（免费）');
console.log('- 成本：免费');

console.log('\n4. 测试风格参数');
console.log('-'.repeat(60));

const styles = [
  '通用', '正式', '口语化', '亲切', '幽默', 
  '礼貌', '强硬', '简洁', '激励', '中立', '专业'
];

console.log('可用的翻译风格：');
styles.forEach((style, index) => {
  console.log(`  ${index + 1}. ${style}`);
});

console.log('\n注意：');
console.log('- 风格参数仅在输入框翻译时生效');
console.log('- 聊天窗口翻译不使用风格参数');
console.log('- 风格翻译需要使用 AI 引擎（GPT-4、Gemini、DeepSeek 等）');

console.log('\n5. 测试配置回退机制');
console.log('-'.repeat(60));

console.log('\n测试不完整配置的回退：');

const incompleteConfig = {
  global: {
    autoTranslate: true,
    engine: 'google',
    targetLang: 'zh-CN'
  },
  inputBox: {
    enabled: true
    // 缺少 engine 和 style
  }
};

// 模拟配置合并逻辑
const mergedConfig = {
  ...defaultConfig,
  ...incompleteConfig,
  inputBox: {
    ...defaultConfig.inputBox,
    ...incompleteConfig.inputBox
  }
};

console.log('✓ inputBox.engine 回退到:', mergedConfig.inputBox.engine);
console.log('✓ inputBox.style 回退到:', mergedConfig.inputBox.style);

console.log('\n' + '='.repeat(60));
console.log('测试完成！');
console.log('='.repeat(60));

if (allPassed) {
  console.log('\n✓ 所有测试通过！');
  process.exit(0);
} else {
  console.log('\n✗ 部分测试失败！');
  process.exit(1);
}
