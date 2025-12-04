/**
 * 性能优化演示示例
 * 展示如何使用性能优化器
 */

const { PerformanceOptimizer } = require('../utils/PerformanceOptimizer');

// 创建性能优化器实例
const optimizer = new PerformanceOptimizer({
  maxConcurrent: 3,
  cacheTimeout: 5000
});

// 模拟翻译 API
async function mockTranslateAPI(text, sourceLang, targetLang) {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    translatedText: `Translated: ${text}`,
    detectedLang: sourceLang,
    targetLang: targetLang
  };
}

// 示例 1: 并发控制
async function demo1_ConcurrencyControl() {
  console.log('\n=== 示例 1: 并发控制 ===');
  console.log('发起 10 个翻译请求，最大并发数为 3...\n');

  const startTime = Date.now();
  const requests = [];

  for (let i = 0; i < 10; i++) {
    const promise = optimizer.executeRequest(
      `text-${i}:en:zh`,
      () => mockTranslateAPI(`Hello ${i}`, 'en', 'zh')
    );
    requests.push(promise);
  }

  await Promise.all(requests);
  const duration = Date.now() - startTime;

  console.log(`✓ 所有请求完成，耗时: ${duration}ms`);
  console.log('统计信息:', optimizer.getStats());
}

// 示例 2: 请求去重
async function demo2_Deduplication() {
  console.log('\n=== 示例 2: 请求去重 ===');
  console.log('同时发起 5 个相同的请求...\n');

  const startTime = Date.now();
  const requests = [];

  // 发起 5 个相同的请求
  for (let i = 0; i < 5; i++) {
    const promise = optimizer.executeRequest(
      'same-text:en:zh',
      () => mockTranslateAPI('Hello World', 'en', 'zh')
    );
    requests.push(promise);
  }

  await Promise.all(requests);
  const duration = Date.now() - startTime;

  console.log(`✓ 所有请求完成，耗时: ${duration}ms`);
  console.log('注意: 5 个请求只调用了 1 次 API');
  console.log('统计信息:', optimizer.getStats());
}

// 示例 3: 缓存命中
async function demo3_CacheHit() {
  console.log('\n=== 示例 3: 缓存命中 ===');
  console.log('第一次请求...');

  let startTime = Date.now();
  await optimizer.executeRequest(
    'cached-text:en:zh',
    () => mockTranslateAPI('Cached Hello', 'en', 'zh')
  );
  let duration = Date.now() - startTime;
  console.log(`✓ 第一次请求完成，耗时: ${duration}ms`);

  console.log('\n第二次请求（应该命中缓存）...');
  startTime = Date.now();
  await optimizer.executeRequest(
    'cached-text:en:zh',
    () => mockTranslateAPI('Cached Hello', 'en', 'zh')
  );
  duration = Date.now() - startTime;
  console.log(`✓ 第二次请求完成，耗时: ${duration}ms`);
  console.log('注意: 第二次请求几乎瞬间完成（缓存命中）');
  console.log('统计信息:', optimizer.getStats());
}

// 示例 4: DOM 批处理
async function demo4_DOMBatching() {
  console.log('\n=== 示例 4: DOM 批处理 ===');
  console.log('调度 100 个 DOM 操作...\n');

  let operationCount = 0;

  for (let i = 0; i < 100; i++) {
    optimizer.scheduleDOMOperation(() => {
      operationCount++;
      // 模拟 DOM 操作
      // document.getElementById('result').textContent = `Operation ${i}`;
    });
  }

  // 等待 DOM 操作完成
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log(`✓ ${operationCount} 个 DOM 操作已批量执行`);
  console.log('统计信息:', optimizer.getStats());
  console.log('注意: 100 个操作被合并成少量批次执行');
}

// 示例 5: 防抖
async function demo5_Debounce() {
  console.log('\n=== 示例 5: 防抖 ===');
  console.log('模拟用户快速输入（每 100ms 输入一个字符）...\n');

  let translationCount = 0;
  const debouncedTranslate = optimizer.debounce(
    async () => {
      translationCount++;
      console.log(`执行翻译 #${translationCount}`);
    },
    500
  );

  // 模拟用户快速输入 10 个字符
  for (let i = 0; i < 10; i++) {
    console.log(`输入字符 ${i + 1}`);
    debouncedTranslate();
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 等待防抖完成
  await new Promise(resolve => setTimeout(resolve, 600));

  console.log(`\n✓ 用户输入了 10 个字符，但只触发了 ${translationCount} 次翻译`);
  console.log('注意: 防抖避免了频繁的 API 调用');
}

// 示例 6: 节流
async function demo6_Throttle() {
  console.log('\n=== 示例 6: 节流 ===');
  console.log('模拟滚动事件（每 50ms 触发一次）...\n');

  let updateCount = 0;
  const throttledUpdate = optimizer.throttle(
    () => {
      updateCount++;
      console.log(`更新可见范围 #${updateCount}`);
    },
    200
  );

  // 模拟 20 次滚动事件
  for (let i = 0; i < 20; i++) {
    throttledUpdate();
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log(`\n✓ 触发了 20 次滚动事件，但只执行了 ${updateCount} 次更新`);
  console.log('注意: 节流限制了更新频率');
}

// 运行所有示例
async function runAllDemos() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║        WhatsApp 翻译系统 - 性能优化演示               ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  try {
    await demo1_ConcurrencyControl();
    optimizer.resetStats();

    await demo2_Deduplication();
    optimizer.resetStats();

    await demo3_CacheHit();
    optimizer.resetStats();

    await demo4_DOMBatching();
    optimizer.resetStats();

    await demo5_Debounce();
    optimizer.resetStats();

    await demo6_Throttle();

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                  所有演示完成！                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('演示过程中出错:', error);
  } finally {
    optimizer.cleanup();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runAllDemos();
}

module.exports = {
  demo1_ConcurrencyControl,
  demo2_Deduplication,
  demo3_CacheHit,
  demo4_DOMBatching,
  demo5_Debounce,
  demo6_Throttle
};
