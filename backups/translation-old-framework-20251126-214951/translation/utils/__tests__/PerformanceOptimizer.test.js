/**
 * 性能优化器测试
 */

const { PerformanceOptimizer, VirtualScrollManager } = require('../PerformanceOptimizer');

describe('PerformanceOptimizer', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      maxConcurrent: 2,
      cacheTimeout: 1000
    });
  });

  afterEach(() => {
    optimizer.cleanup();
  });

  describe('请求队列和并发控制', () => {
    test('应该限制并发请求数量', async () => {
      let activeCount = 0;
      let maxActive = 0;

      const requests = [];
      for (let i = 0; i < 5; i++) {
        const promise = optimizer.executeRequest(`req-${i}`, async () => {
          activeCount++;
          maxActive = Math.max(maxActive, activeCount);
          await new Promise(resolve => setTimeout(resolve, 100));
          activeCount--;
          return `result-${i}`;
        });
        requests.push(promise);
      }

      await Promise.all(requests);

      // 最大并发数应该不超过配置的值
      expect(maxActive).toBeLessThanOrEqual(2);
    });

    test('应该按顺序处理队列中的请求', async () => {
      const results = [];
      const requests = [];

      for (let i = 0; i < 3; i++) {
        const promise = optimizer.executeRequest(`req-${i}`, async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          results.push(i);
          return i;
        });
        requests.push(promise);
      }

      await Promise.all(requests);

      // 所有请求都应该完成
      expect(results).toHaveLength(3);
    });
  });

  describe('请求去重', () => {
    test('应该去重相同的请求', async () => {
      let callCount = 0;

      const requestFn = async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      };

      // 同时发起 3 个相同的请求
      const promises = [
        optimizer.executeRequest('same-key', requestFn),
        optimizer.executeRequest('same-key', requestFn),
        optimizer.executeRequest('same-key', requestFn)
      ];

      const results = await Promise.all(promises);

      // 应该只调用一次
      expect(callCount).toBe(1);
      // 所有请求都应该返回相同的结果
      expect(results).toEqual(['result', 'result', 'result']);
    });

    test('应该使用短期缓存', async () => {
      let callCount = 0;

      const requestFn = async () => {
        callCount++;
        return 'result';
      };

      // 第一次请求
      await optimizer.executeRequest('cache-key', requestFn);
      expect(callCount).toBe(1);

      // 第二次请求（应该使用缓存）
      await optimizer.executeRequest('cache-key', requestFn);
      expect(callCount).toBe(1);

      // 等待缓存过期
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 第三次请求（缓存已过期）
      await optimizer.executeRequest('cache-key', requestFn);
      expect(callCount).toBe(2);
    });
  });

  describe('DOM 操作批处理', () => {
    test('应该批量执行 DOM 操作', (done) => {
      const operations = [];

      // 调度多个 DOM 操作
      optimizer.scheduleDOMOperation(() => operations.push(1));
      optimizer.scheduleDOMOperation(() => operations.push(2));
      optimizer.scheduleDOMOperation(() => operations.push(3));

      // DOM 操作应该还没执行
      expect(operations).toHaveLength(0);

      // 等待 requestAnimationFrame
      setTimeout(() => {
        // 所有操作都应该执行了
        expect(operations).toEqual([1, 2, 3]);
        done();
      }, 50);
    });
  });

  describe('统计信息', () => {
    test('应该正确统计请求数据', async () => {
      await optimizer.executeRequest('req-1', async () => 'result-1');
      await optimizer.executeRequest('req-1', async () => 'result-1'); // 缓存命中
      await optimizer.executeRequest('req-2', async () => 'result-2');

      const stats = optimizer.getStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.cacheHits).toBe(1);
    });

    test('应该计算去重率和缓存命中率', async () => {
      // 发起一些请求
      await optimizer.executeRequest('req-1', async () => 'result');
      await optimizer.executeRequest('req-1', async () => 'result'); // 缓存
      await optimizer.executeRequest('req-2', async () => 'result');

      const stats = optimizer.getStats();

      expect(stats.cacheHitRate).toBe('33.33%');
    });
  });

  describe('防抖和节流', () => {
    test('防抖应该延迟执行', (done) => {
      let callCount = 0;
      const debouncedFn = optimizer.debounce(() => callCount++, 100);

      // 快速调用多次
      debouncedFn();
      debouncedFn();
      debouncedFn();

      // 立即检查，应该还没执行
      expect(callCount).toBe(0);

      // 等待防抖时间
      setTimeout(() => {
        // 应该只执行一次
        expect(callCount).toBe(1);
        done();
      }, 150);
    });

    test('节流应该限制执行频率', (done) => {
      let callCount = 0;
      const throttledFn = optimizer.throttle(() => callCount++, 100);

      // 快速调用多次
      throttledFn();
      throttledFn();
      throttledFn();

      // 应该只执行一次
      expect(callCount).toBe(1);

      // 等待节流时间
      setTimeout(() => {
        // 再次调用
        throttledFn();
        expect(callCount).toBe(2);
        done();
      }, 150);
    });
  });
});

describe('VirtualScrollManager', () => {
  let manager;
  let container;

  beforeEach(() => {
    // 创建模拟容器
    container = document.createElement('div');
    container.style.height = '500px';
    container.style.overflow = 'auto';
    document.body.appendChild(container);

    manager = new VirtualScrollManager({
      itemHeight: 100,
      bufferSize: 2
    });
  });

  afterEach(() => {
    manager.destroy();
    document.body.removeChild(container);
  });

  test('应该初始化虚拟滚动', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    
    let renderCalled = false;
    manager.renderCallback = () => {
      renderCalled = true;
    };

    manager.init(container, items);

    expect(renderCalled).toBe(true);
  });

  test('应该计算正确的可见范围', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    
    let visibleItems = [];
    manager.renderCallback = ({ items: visible }) => {
      visibleItems = visible;
    };

    manager.init(container, items);

    // 初始应该渲染前几项
    expect(visibleItems.length).toBeGreaterThan(0);
    expect(visibleItems.length).toBeLessThan(items.length);
  });
});
