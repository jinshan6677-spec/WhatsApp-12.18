/**
 * Performance Tests
 * 
 * 测试多实例架构的性能指标：
 * - 同时运行 30 个实例的性能
 * - 测量内存和 CPU 使用
 * - 测量启动时间和响应延迟
 * - 生成性能报告
 */

const InstanceManager = require('../InstanceManager');
const AccountConfigManager = require('../AccountConfigManager');
const AccountConfig = require('../../models/AccountConfig');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

// Mock Electron modules
jest.mock('electron', () => {
  const mockPath = require('path');
  const mockOs = require('os');
  
  return {
    BrowserWindow: jest.fn().mockImplementation(function(options) {
      this.options = options;
      this.destroyed = false;
      this.webContents = {
        setUserAgent: jest.fn(),
        getOSProcessId: jest.fn().mockReturnValue(Math.floor(Math.random() * 10000) + 10000),
        executeJavaScript: jest.fn().mockResolvedValue(true),
        on: jest.fn(),
        session: {}
      };
      this.loadURL = jest.fn().mockResolvedValue(undefined);
      this.isDestroyed = jest.fn(() => this.destroyed);
      this.destroy = jest.fn(() => { this.destroyed = true; });
      this.close = jest.fn(() => { 
        this.destroyed = true;
        setImmediate(() => {
          if (this._closedCallback) this._closedCallback();
        });
      });
      this.once = jest.fn((event, callback) => {
        if (event === 'closed') {
          this._closedCallback = callback;
        }
      });
      this.on = jest.fn();
      this.getBounds = jest.fn(() => ({ 
        x: 100, 
        y: 100, 
        width: 1200, 
        height: 800 
      }));
      this.setBounds = jest.fn();
      this.isMinimized = jest.fn(() => false);
      this.isMaximized = jest.fn(() => false);
      this.isVisible = jest.fn(() => true);
    }),
    app: {
      getPath: jest.fn((name) => {
        if (name === 'userData') {
          return mockPath.join(mockOs.tmpdir(), 'test-user-data');
        }
        return mockOs.tmpdir();
      }),
      getAppMetrics: jest.fn(() => {
        // Simulate realistic metrics for multiple processes
        const metrics = [];
        const processCount = Math.floor(Math.random() * 30) + 1;
        for (let i = 0; i < processCount; i++) {
          metrics.push({
            pid: 10000 + i,
            type: i === 0 ? 'Browser' : 'Renderer',
            cpu: { percentCPUUsage: Math.random() * 20 },
            memory: { workingSetSize: (256 + Math.random() * 256) * 1024 }
          });
        }
        return metrics;
      })
    },
    session: {
      fromPartition: jest.fn((partition) => ({
        webRequest: {
          onBeforeSendHeaders: jest.fn()
        }
      }))
    },
    screen: {
      getAllDisplays: jest.fn(() => [
        {
          workArea: { x: 0, y: 0, width: 1920, height: 1080 }
        }
      ]),
      getPrimaryDisplay: jest.fn(() => ({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 }
      }))
    }
  };
});

// Performance measurement utilities
class PerformanceMetrics {
  constructor() {
    this.metrics = {
      startupTimes: [],
      memoryUsage: [],
      cpuUsage: [],
      responseLatency: [],
      concurrentInstances: 0,
      totalInstances: 0,
      failedInstances: 0
    };
  }

  recordStartupTime(duration) {
    this.metrics.startupTimes.push(duration);
  }

  recordMemoryUsage(usage) {
    this.metrics.memoryUsage.push(usage);
  }

  recordCpuUsage(usage) {
    this.metrics.cpuUsage.push(usage);
  }

  recordResponseLatency(latency) {
    this.metrics.responseLatency.push(latency);
  }

  incrementConcurrentInstances() {
    this.metrics.concurrentInstances++;
    this.metrics.totalInstances++;
  }

  decrementConcurrentInstances() {
    this.metrics.concurrentInstances--;
  }

  incrementFailedInstances() {
    this.metrics.failedInstances++;
  }

  getAverageStartupTime() {
    if (this.metrics.startupTimes.length === 0) return 0;
    const sum = this.metrics.startupTimes.reduce((a, b) => a + b, 0);
    return sum / this.metrics.startupTimes.length;
  }

  getMedianStartupTime() {
    if (this.metrics.startupTimes.length === 0) return 0;
    const sorted = [...this.metrics.startupTimes].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  getMaxStartupTime() {
    if (this.metrics.startupTimes.length === 0) return 0;
    return Math.max(...this.metrics.startupTimes);
  }

  getMinStartupTime() {
    if (this.metrics.startupTimes.length === 0) return 0;
    return Math.min(...this.metrics.startupTimes);
  }

  getAverageMemoryUsage() {
    if (this.metrics.memoryUsage.length === 0) return 0;
    const sum = this.metrics.memoryUsage.reduce((a, b) => a + b, 0);
    return sum / this.metrics.memoryUsage.length;
  }

  getPeakMemoryUsage() {
    if (this.metrics.memoryUsage.length === 0) return 0;
    return Math.max(...this.metrics.memoryUsage);
  }

  getAverageCpuUsage() {
    if (this.metrics.cpuUsage.length === 0) return 0;
    const sum = this.metrics.cpuUsage.reduce((a, b) => a + b, 0);
    return sum / this.metrics.cpuUsage.length;
  }

  getPeakCpuUsage() {
    if (this.metrics.cpuUsage.length === 0) return 0;
    return Math.max(...this.metrics.cpuUsage);
  }

  getAverageResponseLatency() {
    if (this.metrics.responseLatency.length === 0) return 0;
    const sum = this.metrics.responseLatency.reduce((a, b) => a + b, 0);
    return sum / this.metrics.responseLatency.length;
  }

  generateReport() {
    return {
      summary: {
        totalInstances: this.metrics.totalInstances,
        failedInstances: this.metrics.failedInstances,
        successRate: this.metrics.totalInstances > 0 
          ? ((this.metrics.totalInstances - this.metrics.failedInstances) / this.metrics.totalInstances * 100).toFixed(2) + '%'
          : '0%'
      },
      startupTime: {
        average: this.getAverageStartupTime().toFixed(2) + ' ms',
        median: this.getMedianStartupTime().toFixed(2) + ' ms',
        min: this.getMinStartupTime().toFixed(2) + ' ms',
        max: this.getMaxStartupTime().toFixed(2) + ' ms',
        samples: this.metrics.startupTimes.length
      },
      memory: {
        average: (this.getAverageMemoryUsage() / 1024 / 1024).toFixed(2) + ' MB',
        peak: (this.getPeakMemoryUsage() / 1024 / 1024).toFixed(2) + ' MB',
        samples: this.metrics.memoryUsage.length
      },
      cpu: {
        average: this.getAverageCpuUsage().toFixed(2) + '%',
        peak: this.getPeakCpuUsage().toFixed(2) + '%',
        samples: this.metrics.cpuUsage.length
      },
      responseLatency: {
        average: this.getAverageResponseLatency().toFixed(2) + ' ms',
        samples: this.metrics.responseLatency.length
      }
    };
  }
}

describe('Performance Tests', () => {
  let instanceManager;
  let configManager;
  let tempDir;
  let performanceMetrics;

  beforeEach(async () => {
    // 创建临时目录
    tempDir = path.join(os.tmpdir(), `test-performance-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // 初始化管理器
    configManager = new AccountConfigManager({
      configName: 'test-accounts',
      cwd: tempDir
    });
    
    // Get the mocked electron module
    const electron = require('electron');
    
    instanceManager = new InstanceManager({
      userDataPath: tempDir,
      maxInstances: 50,  // Allow more instances for performance testing
      electron: electron  // Inject the mocked electron
    });

    performanceMetrics = new PerformanceMetrics();
  });

  afterEach(async () => {
    // 清理所有实例
    await instanceManager.destroyAllInstances();
    instanceManager.stopGlobalMonitoring();
    
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('Startup Time Performance', () => {
    test('should measure single instance startup time', async () => {
      const account = new AccountConfig({
        name: 'Startup Time Test'
      });

      const startTime = Date.now();
      const result = await instanceManager.createInstance(account);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      
      const startupTime = endTime - startTime;
      performanceMetrics.recordStartupTime(startupTime);

      console.log(`Single instance startup time: ${startupTime}ms`);
      
      // Startup should be reasonably fast (< 5 seconds in test environment)
      expect(startupTime).toBeLessThan(5000);
    });

    test('should measure sequential startup time for 10 instances', async () => {
      const instanceCount = 10;
      const accounts = [];

      for (let i = 0; i < instanceCount; i++) {
        const account = new AccountConfig({
          name: `Sequential Test ${i + 1}`
        });
        accounts.push(account);
      }

      const totalStartTime = Date.now();

      for (const account of accounts) {
        const startTime = Date.now();
        const result = await instanceManager.createInstance(account);
        const endTime = Date.now();

        if (result.success) {
          performanceMetrics.recordStartupTime(endTime - startTime);
          performanceMetrics.incrementConcurrentInstances();
        } else {
          performanceMetrics.incrementFailedInstances();
        }
      }

      const totalEndTime = Date.now();
      const totalTime = totalEndTime - totalStartTime;

      console.log(`Sequential startup of ${instanceCount} instances:`);
      console.log(`  Total time: ${totalTime}ms`);
      console.log(`  Average per instance: ${(totalTime / instanceCount).toFixed(2)}ms`);
      console.log(`  Min: ${performanceMetrics.getMinStartupTime().toFixed(2)}ms`);
      console.log(`  Max: ${performanceMetrics.getMaxStartupTime().toFixed(2)}ms`);

      expect(instanceManager.getRunningInstanceCount()).toBe(instanceCount);
    });

    test('should measure parallel startup time for 10 instances', async () => {
      const instanceCount = 10;
      const accounts = [];

      for (let i = 0; i < instanceCount; i++) {
        const account = new AccountConfig({
          name: `Parallel Test ${i + 1}`
        });
        accounts.push(account);
      }

      const totalStartTime = Date.now();

      const promises = accounts.map(async (account) => {
        const startTime = Date.now();
        const result = await instanceManager.createInstance(account);
        const endTime = Date.now();

        if (result.success) {
          performanceMetrics.recordStartupTime(endTime - startTime);
          performanceMetrics.incrementConcurrentInstances();
        } else {
          performanceMetrics.incrementFailedInstances();
        }

        return result;
      });

      await Promise.all(promises);

      const totalEndTime = Date.now();
      const totalTime = totalEndTime - totalStartTime;

      console.log(`Parallel startup of ${instanceCount} instances:`);
      console.log(`  Total time: ${totalTime}ms`);
      console.log(`  Average per instance: ${performanceMetrics.getAverageStartupTime().toFixed(2)}ms`);
      console.log(`  Median: ${performanceMetrics.getMedianStartupTime().toFixed(2)}ms`);

      expect(instanceManager.getRunningInstanceCount()).toBe(instanceCount);
    });
  });

  describe('30 Concurrent Instances Performance', () => {
    test('should successfully run 30 concurrent instances', async () => {
      const instanceCount = 30;
      const accounts = [];

      console.log(`\n=== Starting 30 Concurrent Instances Test ===\n`);

      // Create accounts
      for (let i = 0; i < instanceCount; i++) {
        const account = new AccountConfig({
          name: `Concurrent Instance ${i + 1}`
        });
        accounts.push(account);
      }

      const totalStartTime = Date.now();

      // Launch all instances in parallel
      const promises = accounts.map(async (account, index) => {
        const startTime = Date.now();
        
        try {
          const result = await instanceManager.createInstance(account);
          const endTime = Date.now();

          if (result.success) {
            performanceMetrics.recordStartupTime(endTime - startTime);
            performanceMetrics.incrementConcurrentInstances();
            
            // Measure initial memory and CPU
            const status = instanceManager.getInstanceStatus(account.id);
            if (status) {
              performanceMetrics.recordMemoryUsage(status.memoryUsage * 1024);
              performanceMetrics.recordCpuUsage(status.cpuUsage);
            }
          } else {
            performanceMetrics.incrementFailedInstances();
          }

          return result;
        } catch (error) {
          performanceMetrics.incrementFailedInstances();
          return { success: false, error: error.message };
        }
      });

      const results = await Promise.all(promises);
      const totalEndTime = Date.now();
      const totalTime = totalEndTime - totalStartTime;

      // Wait a bit for instances to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Measure resource usage after stabilization
      const runningCount = instanceManager.getRunningInstanceCount();
      const healthSummary = await instanceManager.getAllInstancesHealth();

      console.log(`\n=== 30 Concurrent Instances Results ===`);
      console.log(`Total startup time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
      console.log(`Successfully started: ${runningCount}/${instanceCount}`);
      console.log(`Failed: ${performanceMetrics.metrics.failedInstances}`);
      console.log(`\nStartup Time Statistics:`);
      console.log(`  Average: ${performanceMetrics.getAverageStartupTime().toFixed(2)}ms`);
      console.log(`  Median: ${performanceMetrics.getMedianStartupTime().toFixed(2)}ms`);
      console.log(`  Min: ${performanceMetrics.getMinStartupTime().toFixed(2)}ms`);
      console.log(`  Max: ${performanceMetrics.getMaxStartupTime().toFixed(2)}ms`);
      console.log(`\nResource Usage:`);
      console.log(`  Average Memory: ${(performanceMetrics.getAverageMemoryUsage() / 1024 / 1024).toFixed(2)} MB per instance`);
      console.log(`  Peak Memory: ${(performanceMetrics.getPeakMemoryUsage() / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Total Memory (estimated): ${(performanceMetrics.getAverageMemoryUsage() * runningCount / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Average CPU: ${performanceMetrics.getAverageCpuUsage().toFixed(2)}%`);
      console.log(`  Peak CPU: ${performanceMetrics.getPeakCpuUsage().toFixed(2)}%`);
      console.log(`\nHealth Summary:`);
      console.log(`  Total: ${healthSummary.total}`);
      console.log(`  Healthy: ${healthSummary.healthy}`);
      console.log(`  Unhealthy: ${healthSummary.unhealthy}`);

      // Assertions
      expect(runningCount).toBeGreaterThanOrEqual(25); // At least 25 out of 30 should succeed
      expect(performanceMetrics.getAverageStartupTime()).toBeLessThan(5000); // Average startup < 5s
      expect(healthSummary.healthy).toBeGreaterThanOrEqual(25);
    }, 120000); // 2 minute timeout for this test

    test('should measure response latency under load', async () => {
      const instanceCount = 30;
      const accounts = [];

      // Create and start instances
      for (let i = 0; i < instanceCount; i++) {
        const account = new AccountConfig({
          name: `Latency Test ${i + 1}`
        });
        accounts.push(account);
        await instanceManager.createInstance(account);
      }

      console.log(`\n=== Response Latency Test (${instanceCount} instances) ===\n`);

      // Measure response latency for various operations
      const operations = [
        { name: 'getInstanceStatus', fn: (id) => instanceManager.getInstanceStatus(id) },
        { name: 'instanceExists', fn: (id) => instanceManager.instanceExists(id) },
        { name: 'getRunningInstanceCount', fn: () => instanceManager.getRunningInstanceCount() }
      ];

      for (const operation of operations) {
        const latencies = [];

        for (let i = 0; i < 10; i++) {
          const startTime = Date.now();
          
          if (operation.name === 'getRunningInstanceCount') {
            operation.fn();
          } else {
            const randomAccount = accounts[Math.floor(Math.random() * accounts.length)];
            operation.fn(randomAccount.id);
          }
          
          const endTime = Date.now();
          latencies.push(endTime - startTime);
        }

        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        performanceMetrics.recordResponseLatency(avgLatency);

        console.log(`${operation.name}: ${avgLatency.toFixed(2)}ms average`);
      }

      console.log(`\nOverall average response latency: ${performanceMetrics.getAverageResponseLatency().toFixed(2)}ms`);

      // Response latency should be reasonable even under load
      expect(performanceMetrics.getAverageResponseLatency()).toBeLessThan(100);
    }, 120000);

    test('should handle resource monitoring for 30 instances', async () => {
      const instanceCount = 30;
      const accounts = [];

      console.log(`\n=== Resource Monitoring Test (${instanceCount} instances) ===\n`);

      // Create and start instances
      for (let i = 0; i < instanceCount; i++) {
        const account = new AccountConfig({
          name: `Monitor Test ${i + 1}`
        });
        accounts.push(account);
        await instanceManager.createInstance(account);
      }

      // Monitor resources over time
      const monitoringDuration = 3000; // 3 seconds
      const monitoringInterval = 500; // 500ms
      const iterations = monitoringDuration / monitoringInterval;

      for (let i = 0; i < iterations; i++) {
        await new Promise(resolve => setTimeout(resolve, monitoringInterval));

        // Collect metrics from all instances
        for (const account of accounts) {
          const status = instanceManager.getInstanceStatus(account.id);
          if (status) {
            performanceMetrics.recordMemoryUsage(status.memoryUsage * 1024);
            performanceMetrics.recordCpuUsage(status.cpuUsage);
          }
        }
      }

      console.log(`Monitoring Results (${iterations} iterations):`);
      console.log(`  Average Memory per instance: ${(performanceMetrics.getAverageMemoryUsage() / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Peak Memory: ${(performanceMetrics.getPeakMemoryUsage() / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Average CPU: ${performanceMetrics.getAverageCpuUsage().toFixed(2)}%`);
      console.log(`  Peak CPU: ${performanceMetrics.getPeakCpuUsage().toFixed(2)}%`);
      console.log(`  Total samples: ${performanceMetrics.metrics.memoryUsage.length}`);

      // Memory usage should be reasonable
      const avgMemoryMB = performanceMetrics.getAverageMemoryUsage() / 1024 / 1024;
      expect(avgMemoryMB).toBeLessThan(1024); // Less than 1GB per instance on average
    }, 120000);
  });

  describe('Scalability Tests', () => {
    test('should measure performance degradation with increasing instances', async () => {
      const testSizes = [5, 10, 15, 20, 25, 30];
      const results = [];

      console.log(`\n=== Scalability Test ===\n`);

      for (const size of testSizes) {
        const metrics = new PerformanceMetrics();
        const accounts = [];

        // Create accounts
        for (let i = 0; i < size; i++) {
          accounts.push(new AccountConfig({
            name: `Scale Test ${size}-${i + 1}`
          }));
        }

        // Measure startup time
        const startTime = Date.now();
        
        for (const account of accounts) {
          const instanceStart = Date.now();
          await instanceManager.createInstance(account);
          const instanceEnd = Date.now();
          metrics.recordStartupTime(instanceEnd - instanceStart);
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // Measure resource usage
        for (const account of accounts) {
          const status = instanceManager.getInstanceStatus(account.id);
          if (status) {
            metrics.recordMemoryUsage(status.memoryUsage * 1024);
            metrics.recordCpuUsage(status.cpuUsage);
          }
        }

        results.push({
          instanceCount: size,
          totalTime,
          avgStartupTime: metrics.getAverageStartupTime(),
          avgMemory: metrics.getAverageMemoryUsage() / 1024 / 1024,
          avgCpu: metrics.getAverageCpuUsage()
        });

        console.log(`${size} instances:`);
        console.log(`  Total time: ${totalTime}ms`);
        console.log(`  Avg startup: ${metrics.getAverageStartupTime().toFixed(2)}ms`);
        console.log(`  Avg memory: ${(metrics.getAverageMemoryUsage() / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Avg CPU: ${metrics.getAverageCpuUsage().toFixed(2)}%`);

        // Clean up for next iteration
        await instanceManager.destroyAllInstances();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`\n=== Scalability Summary ===`);
      console.log('Instances | Total Time | Avg Startup | Avg Memory | Avg CPU');
      console.log('----------|------------|-------------|------------|--------');
      results.forEach(r => {
        console.log(
          `${r.instanceCount.toString().padEnd(9)} | ` +
          `${r.totalTime.toString().padEnd(10)}ms | ` +
          `${r.avgStartupTime.toFixed(0).padEnd(11)}ms | ` +
          `${r.avgMemory.toFixed(0).padEnd(10)}MB | ` +
          `${r.avgCpu.toFixed(1)}%`
        );
      });

      // Performance should scale reasonably
      const first = results[0];
      const last = results[results.length - 1];
      const scalingFactor = last.avgStartupTime / first.avgStartupTime;
      
      console.log(`\nScaling factor (30 vs 5 instances): ${scalingFactor.toFixed(2)}x`);
      
      // Startup time shouldn't degrade more than 3x
      expect(scalingFactor).toBeLessThan(3);
    }, 180000); // 3 minute timeout
  });

  describe('Performance Report Generation', () => {
    test('should generate comprehensive performance report', async () => {
      const instanceCount = 30;
      const accounts = [];

      console.log(`\n=== Generating Performance Report ===\n`);

      // Create and launch instances
      for (let i = 0; i < instanceCount; i++) {
        const account = new AccountConfig({
          name: `Report Test ${i + 1}`
        });
        accounts.push(account);
      }

      const startTime = Date.now();

      for (const account of accounts) {
        const instanceStart = Date.now();
        const result = await instanceManager.createInstance(account);
        const instanceEnd = Date.now();

        if (result.success) {
          performanceMetrics.recordStartupTime(instanceEnd - instanceStart);
          performanceMetrics.incrementConcurrentInstances();
          
          const status = instanceManager.getInstanceStatus(account.id);
          if (status) {
            performanceMetrics.recordMemoryUsage(status.memoryUsage * 1024);
            performanceMetrics.recordCpuUsage(status.cpuUsage);
          }
        } else {
          performanceMetrics.incrementFailedInstances();
        }
      }

      const endTime = Date.now();

      // Measure response latency
      for (let i = 0; i < 20; i++) {
        const latencyStart = Date.now();
        instanceManager.getRunningInstanceCount();
        const latencyEnd = Date.now();
        performanceMetrics.recordResponseLatency(latencyEnd - latencyStart);
      }

      // Generate report
      const report = performanceMetrics.generateReport();

      console.log('\n=== PERFORMANCE REPORT ===\n');
      console.log('Summary:');
      console.log(`  Total Instances: ${report.summary.totalInstances}`);
      console.log(`  Failed Instances: ${report.summary.failedInstances}`);
      console.log(`  Success Rate: ${report.summary.successRate}`);
      console.log('\nStartup Time:');
      console.log(`  Average: ${report.startupTime.average}`);
      console.log(`  Median: ${report.startupTime.median}`);
      console.log(`  Min: ${report.startupTime.min}`);
      console.log(`  Max: ${report.startupTime.max}`);
      console.log(`  Samples: ${report.startupTime.samples}`);
      console.log('\nMemory Usage:');
      console.log(`  Average: ${report.memory.average}`);
      console.log(`  Peak: ${report.memory.peak}`);
      console.log(`  Samples: ${report.memory.samples}`);
      console.log('\nCPU Usage:');
      console.log(`  Average: ${report.cpu.average}`);
      console.log(`  Peak: ${report.cpu.peak}`);
      console.log(`  Samples: ${report.cpu.samples}`);
      console.log('\nResponse Latency:');
      console.log(`  Average: ${report.responseLatency.average}`);
      console.log(`  Samples: ${report.responseLatency.samples}`);
      console.log('\n=========================\n');

      // Save report to file
      const reportPath = path.join(tempDir, 'performance-report.json');
      await fs.writeFile(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        testDuration: endTime - startTime,
        report,
        rawMetrics: performanceMetrics.metrics
      }, null, 2));

      console.log(`Performance report saved to: ${reportPath}`);

      // Assertions
      expect(report.summary.totalInstances).toBe(instanceCount);
      expect(parseFloat(report.summary.successRate)).toBeGreaterThan(80); // At least 80% success rate
      expect(performanceMetrics.metrics.startupTimes.length).toBeGreaterThan(0);
      expect(performanceMetrics.metrics.memoryUsage.length).toBeGreaterThan(0);
      expect(performanceMetrics.metrics.cpuUsage.length).toBeGreaterThan(0);
    }, 120000);
  });
});
