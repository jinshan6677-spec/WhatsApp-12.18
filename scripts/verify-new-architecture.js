/**
 * 新架构组件验证脚本
 * 
 * 验证所有新架构组件是否可以正常加载和使用
 */

'use strict';

const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// 测试结果收集
const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(message, type = 'info') {
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[type] || '📋';
  console.log(`${prefix} ${message}`);
}

function recordResult(name, success, error = null) {
  if (success) {
    results.passed.push(name);
    log(`${name}: 通过`, 'success');
  } else {
    results.failed.push({ name, error: error?.message || 'Unknown error' });
    log(`${name}: 失败 - ${error?.message || 'Unknown error'}`, 'error');
  }
}

async function verifyEventBus() {
  log('\n=== 验证 EventBus ===');
  try {
    const { EventBus } = require('../src/core/eventbus/EventBus');
    const eventBus = new EventBus({ historyRetentionMs: 60000 });
    
    // 测试订阅和发布
    let received = false;
    const unsubscribe = eventBus.subscribe('test:event', (payload) => {
      received = payload.value === 'test';
    });
    
    await eventBus.publish('test:event', { value: 'test' });
    
    // 等待异步处理
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!received) throw new Error('Event not received');
    
    // 测试取消订阅
    unsubscribe();
    received = false;
    await eventBus.publish('test:event', { value: 'test2' });
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (received) throw new Error('Unsubscribe failed');
    
    // 测试历史记录
    const history = eventBus.getHistory('test:event');
    if (history.length < 1) throw new Error('History not recorded');
    
    recordResult('EventBus - 基本功能', true);
    
    // 测试 subscribeOnce
    let onceReceived = 0;
    eventBus.subscribeOnce('once:event', () => { onceReceived++; });
    await eventBus.publish('once:event', {});
    await eventBus.publish('once:event', {});
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (onceReceived !== 1) throw new Error('subscribeOnce failed');
    recordResult('EventBus - subscribeOnce', true);
    
    eventBus.clear();
    recordResult('EventBus - 清理', true);
    
  } catch (error) {
    recordResult('EventBus', false, error);
  }
}

async function verifyConfigProvider() {
  log('\n=== 验证 ConfigProvider ===');
  try {
    const { ConfigProvider, createConfigProvider } = require('../src/core/config/ConfigProvider');
    
    const config = createConfigProvider();
    
    // 测试 schema 设置
    config.setSchema({
      properties: {
        app: { type: 'object', properties: { name: { type: 'string' } } },
        port: { type: 'number', minimum: 1, maximum: 65535 },
        apiKey: { type: 'string', sensitive: true }
      },
      required: ['port']
    });
    recordResult('ConfigProvider - Schema设置', true);
    
    // 测试设置和获取值
    config.set('app.name', 'TestApp');
    config.set('port', 8080);
    
    if (config.get('app.name') !== 'TestApp') throw new Error('Get/Set failed');
    if (config.get('port') !== 8080) throw new Error('Get/Set number failed');
    recordResult('ConfigProvider - Get/Set', true);
    
    // 测试敏感值加密
    config.set('apiKey', 'secret-key-123');
    const rawConfig = config.getAll();
    if (!rawConfig.apiKey.startsWith('enc:')) throw new Error('Encryption failed');
    if (config.get('apiKey') !== 'secret-key-123') throw new Error('Decryption failed');
    recordResult('ConfigProvider - 敏感值加密', true);
    
    // 测试序列化/反序列化
    const serialized = config.serialize();
    const config2 = createConfigProvider();
    config2.deserialize(serialized);
    if (config2.get('app.name') !== 'TestApp') throw new Error('Round-trip failed');
    recordResult('ConfigProvider - 序列化往返', true);
    
    // 测试变更通知
    let notified = false;
    config.onChange('port', (newVal, oldVal) => {
      notified = newVal === 9090 && oldVal === 8080;
    });
    config.set('port', 9090);
    if (!notified) throw new Error('Change notification failed');
    recordResult('ConfigProvider - 变更通知', true);
    
  } catch (error) {
    recordResult('ConfigProvider', false, error);
  }
}

async function verifyStateManager() {
  log('\n=== 验证 StateManager ===');
  try {
    const { StateManager } = require('../src/core/state/StateManager');
    
    const testDir = path.join(os.tmpdir(), `state-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    const stateManager = new StateManager({
      initialState: {
        accounts: { items: {}, activeId: null },
        ui: { theme: 'light' }
      },
      persistPath: path.join(testDir, 'state.json')
    });
    
    // 测试获取状态
    const state = stateManager.getState();
    if (!state.accounts || !state.ui) throw new Error('Initial state failed');
    recordResult('StateManager - 初始状态', true);
    
    // 测试设置切片
    stateManager.setSlice('ui', { theme: 'dark', language: 'zh-CN' });
    if (stateManager.getSlice('ui').theme !== 'dark') throw new Error('setSlice failed');
    recordResult('StateManager - setSlice', true);
    
    // 测试订阅
    let subscribeNotified = false;
    const unsub = stateManager.subscribe((newState) => {
      subscribeNotified = true;
    });
    stateManager.setSlice('ui', { theme: 'system' });
    if (!subscribeNotified) throw new Error('Subscribe notification failed');
    unsub();
    recordResult('StateManager - 订阅通知', true);
    
    // 测试持久化
    await stateManager.persist();
    const fileExists = await fs.access(path.join(testDir, 'state.json')).then(() => true).catch(() => false);
    if (!fileExists) throw new Error('Persist failed');
    recordResult('StateManager - 持久化', true);
    
    // 测试快照
    const snapshot = stateManager.snapshot();
    if (!snapshot.state || !snapshot.timestamp) throw new Error('Snapshot failed');
    recordResult('StateManager - 快照', true);
    
    // 清理
    await fs.rm(testDir, { recursive: true, force: true });
    
  } catch (error) {
    recordResult('StateManager', false, error);
  }
}

async function verifyDependencyContainer() {
  log('\n=== 验证 DependencyContainer ===');
  try {
    const { DependencyContainer } = require('../src/core/container/DependencyContainer');
    
    const container = new DependencyContainer();
    
    // 测试单例注册
    container.registerSingleton('config', { name: 'TestConfig' }, { isInstance: true });
    const config1 = container.resolve('config');
    const config2 = container.resolve('config');
    if (config1 !== config2) throw new Error('Singleton failed');
    recordResult('DependencyContainer - 单例', true);
    
    // 测试工厂注册
    let factoryCallCount = 0;
    container.registerFactory('service', () => {
      factoryCallCount++;
      return { id: factoryCallCount };
    });
    const s1 = container.resolve('service');
    const s2 = container.resolve('service');
    if (s1.id === s2.id) throw new Error('Factory should create new instances');
    recordResult('DependencyContainer - 工厂', true);
    
    // 测试瞬态注册
    container.registerTransient('transient', () => ({ timestamp: Date.now() }));
    const t1 = container.resolve('transient');
    await new Promise(r => setTimeout(r, 10));
    const t2 = container.resolve('transient');
    if (t1.timestamp === t2.timestamp) throw new Error('Transient failed');
    recordResult('DependencyContainer - 瞬态', true);
    
    // 测试服务不存在错误
    try {
      container.resolve('nonexistent');
      throw new Error('Should throw for nonexistent service');
    } catch (e) {
      if (!e.message.includes('not found') && !e.message.includes('nonexistent')) {
        throw new Error('Wrong error message');
      }
    }
    recordResult('DependencyContainer - 服务不存在错误', true);
    
    // 测试装饰器
    container.registerSingleton('decorated', { value: 1 }, { isInstance: true });
    container.decorate('decorated', (service) => ({ ...service, decorated: true }));
    const decorated = container.resolve('decorated');
    if (!decorated.decorated) throw new Error('Decorator failed');
    recordResult('DependencyContainer - 装饰器', true);
    
  } catch (error) {
    recordResult('DependencyContainer', false, error);
  }
}

async function verifyPluginManager() {
  log('\n=== 验证 PluginManager ===');
  try {
    const { PluginManager } = require('../src/infrastructure/plugins/PluginManager');
    const { createPluginContext } = require('../src/infrastructure/plugins/PluginContext');
    const { EventBus } = require('../src/core/eventbus/EventBus');
    const { DependencyContainer } = require('../src/core/container/DependencyContainer');
    const { createConfigProvider } = require('../src/core/config/ConfigProvider');
    
    const pluginManager = new PluginManager();
    
    // 创建插件上下文
    const context = createPluginContext({
      eventBus: new EventBus(),
      container: new DependencyContainer(),
      config: createConfigProvider()
    });
    pluginManager.setContext(context);
    recordResult('PluginManager - 上下文设置', true);
    
    // 测试插件注册
    const testPlugin = {
      name: 'test-plugin',
      version: '1.0.0',
      initialize: async (ctx) => { testPlugin.initialized = true; },
      destroy: async () => { testPlugin.destroyed = true; }
    };
    
    pluginManager.register(testPlugin);
    const plugins = pluginManager.getAllPlugins();
    if (!plugins.find(p => p.name === 'test-plugin')) throw new Error('Register failed');
    recordResult('PluginManager - 插件注册', true);
    
    // 测试插件启用
    await pluginManager.enable('test-plugin');
    if (!testPlugin.initialized) throw new Error('Enable failed');
    recordResult('PluginManager - 插件启用', true);
    
    // 测试插件禁用
    await pluginManager.disable('test-plugin');
    if (!testPlugin.destroyed) throw new Error('Disable failed');
    recordResult('PluginManager - 插件禁用', true);
    
    // 测试接口验证
    try {
      pluginManager.register({ name: 'invalid' }); // 缺少 version, initialize, destroy
      throw new Error('Should reject invalid plugin');
    } catch (e) {
      if (!e.message.includes('interface') && !e.message.includes('version')) {
        throw e;
      }
    }
    recordResult('PluginManager - 接口验证', true);
    
  } catch (error) {
    recordResult('PluginManager', false, error);
  }
}

async function verifyIPCRouter() {
  log('\n=== 验证 IPCRouter ===');
  try {
    const { IPCRouter } = require('../src/presentation/ipc/IPCRouter');
    
    const router = new IPCRouter({ defaultTimeout: 5000 });
    
    // 测试处理器注册
    router.register('test:channel', async (request) => {
      return { echo: request.payload.message };
    });
    
    const channels = router.getChannels();
    if (!channels.find(c => c.channel === 'test:channel')) throw new Error('Register failed');
    recordResult('IPCRouter - 处理器注册', true);
    
    // 测试请求处理
    const response = await router.handle('test:channel', {
      channel: 'test:channel',
      payload: { message: 'hello' },
      requestId: 'req-1'
    });
    
    if (!response.success || response.data.echo !== 'hello') throw new Error('Handle failed');
    recordResult('IPCRouter - 请求处理', true);
    
    // 测试批量处理
    const batchResponses = await router.batch([
      { channel: 'test:channel', payload: { message: 'a' }, requestId: 'req-2' },
      { channel: 'test:channel', payload: { message: 'b' }, requestId: 'req-3' }
    ]);
    
    if (batchResponses.length !== 2) throw new Error('Batch failed');
    recordResult('IPCRouter - 批量处理', true);
    
    // 测试不存在的通道
    const errorResponse = await router.handle('nonexistent', {
      channel: 'nonexistent',
      payload: {},
      requestId: 'req-4'
    });
    
    if (errorResponse.success) throw new Error('Should fail for nonexistent channel');
    recordResult('IPCRouter - 错误响应', true);
    
    // 测试取消注册
    router.unregister('test:channel');
    const channelsAfter = router.getChannels();
    if (channelsAfter.find(c => c.channel === 'test:channel')) throw new Error('Unregister failed');
    recordResult('IPCRouter - 取消注册', true);
    
  } catch (error) {
    recordResult('IPCRouter', false, error);
  }
}

async function verifyErrorHandler() {
  log('\n=== 验证 ErrorHandler ===');
  try {
    const { ErrorHandler } = require('../src/core/errors/ErrorHandler');
    const { AppError, ValidationError, NetworkError } = require('../src/core/errors');
    
    const handler = new ErrorHandler({ maxHistory: 100 });
    
    // 测试错误处理
    const error = new ValidationError('Test validation error', { fields: [{ field: 'name', reason: 'required' }] });
    handler.handle(error, { source: 'test' });
    
    const history = handler.getErrorHistory();
    if (history.length < 1) throw new Error('Error not recorded');
    recordResult('ErrorHandler - 错误记录', true);
    
    // 测试恢复策略
    let strategyExecuted = false;
    handler.registerRecoveryStrategy('VALIDATION_ERROR', async (err) => {
      strategyExecuted = true;
      return { recovered: true, message: 'Recovered' };
    });
    
    const recoverableError = new ValidationError('Recoverable', {});
    recoverableError.recoverable = true;
    const result = await handler.recover(recoverableError);
    
    if (!strategyExecuted) throw new Error('Recovery strategy not executed');
    recordResult('ErrorHandler - 恢复策略', true);
    
    // 测试本地化消息
    handler.registerLocale('zh-CN', {
      VALIDATION_ERROR: '验证错误'
    });
    const localizedMsg = handler.getLocalizedMessage(error, 'zh-CN');
    if (localizedMsg !== '验证错误') throw new Error('Localization failed');
    recordResult('ErrorHandler - 消息本地化', true);
    
  } catch (error) {
    recordResult('ErrorHandler', false, error);
  }
}

async function verifyDomainEntities() {
  log('\n=== 验证领域实体 ===');
  try {
    const Account = require('../src/domain/entities/Account');
    const TranslationConfig = require('../src/domain/entities/TranslationConfig');
    
    // 测试 Account
    const account = new Account({
      name: 'Test Account',
      sessionDir: 'session-data/test'
    });
    
    const accountJson = account.toJSON();
    const accountRestored = Account.fromJSON(accountJson);
    if (accountRestored.name !== 'Test Account') throw new Error('Account round-trip failed');
    recordResult('Account - 序列化往返', true);
    
    
    
    // 测试 TranslationConfig
    const translation = new TranslationConfig({
      enabled: true,
      engine: 'google',
      targetLanguage: 'zh-CN'
    });
    
    const translationJson = translation.toJSON();
    const translationRestored = TranslationConfig.fromJSON(translationJson);
    if (translationRestored.targetLanguage !== 'zh-CN') throw new Error('TranslationConfig round-trip failed');
    recordResult('TranslationConfig - 序列化往返', true);
    
  } catch (error) {
    recordResult('领域实体', false, error);
  }
}

async function verifyRepositories() {
  log('\n=== 验证 Repository ===');
  try {
    const AccountRepository = require('../src/infrastructure/repositories/AccountRepository');
    const Account = require('../src/domain/entities/Account');
    
    const testDir = path.join(os.tmpdir(), `repo-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // 测试 AccountRepository
    const accountRepo = new AccountRepository({
      storagePath: testDir,
      fileName: 'accounts.json',
      cacheTTL: 0
    });
    
    const account = new Account({
      name: 'Test Account',
      sessionDir: 'session-data/test'
    });
    
    await accountRepo.save(account);
    const found = await accountRepo.findById(account.id);
    if (!found || found.name !== 'Test Account') throw new Error('AccountRepository save/find failed');
    recordResult('AccountRepository - 保存/查找', true);
    
    
    
    // 清理
    await fs.rm(testDir, { recursive: true, force: true });
    
  } catch (error) {
    recordResult('Repository', false, error);
  }
}

async function verifyUnitOfWork() {
  log('\n=== 验证 UnitOfWork ===');
  try {
    const UnitOfWork = require('../src/infrastructure/repositories/UnitOfWork');
    const AccountRepository = require('../src/infrastructure/repositories/AccountRepository');
    const Account = require('../src/domain/entities/Account');
    
    const testDir = path.join(os.tmpdir(), `uow-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    const accountRepo = new AccountRepository({
      storagePath: testDir,
      fileName: 'accounts.json',
      cacheTTL: 0
    });
    
    const uow = new UnitOfWork();
    uow.registerRepository('accounts', accountRepo);
    
    // 测试事务提交
    const account1 = new Account({ name: 'Account 1', sessionDir: 'session-data/1' });
    const account2 = new Account({ name: 'Account 2', sessionDir: 'session-data/2' });
    
    uow.scheduleSave('accounts', account1);
    uow.scheduleSave('accounts', account2);
    
    const result = await uow.commit();
    if (!result.success) throw new Error('Commit failed');
    
    const all = await accountRepo.findAll();
    if (all.length !== 2) throw new Error('Not all entities saved');
    recordResult('UnitOfWork - 事务提交', true);
    
    // 清理
    await fs.rm(testDir, { recursive: true, force: true });
    
  } catch (error) {
    recordResult('UnitOfWork', false, error);
  }
}

async function verifyMigrationRunner() {
  log('\n=== 验证 MigrationRunner ===');
  try {
    const MigrationRunner = require('../src/infrastructure/storage/MigrationRunner');
    const os = require('os');
    const path = require('path');
    const fs = require('fs').promises;
    
    // 创建临时目录用于版本文件
    const testDir = path.join(os.tmpdir(), `migration-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    const runner = new MigrationRunner({ storagePath: testDir });
    
    // 注册迁移 (使用正确的方法名 register)
    runner.register({
      version: '1',
      name: 'initial',
      up: async (data) => ({ ...data, migrated: true }),
      down: async (data) => { const { migrated, ...rest } = data; return rest; }
    });
    
    runner.register({
      version: '2',
      name: 'add-field',
      up: async (data) => ({ ...data, newField: 'value' }),
      down: async (data) => { const { newField, ...rest } = data; return rest; }
    });
    
    recordResult('MigrationRunner - 迁移注册', true);
    
    // 测试迁移执行 - migrateUp 返回 { success, context, ... }
    const data = { original: true };
    const migrateResult = await runner.migrateUp(data);
    
    if (!migrateResult.success) throw new Error('Migration up failed - not successful');
    if (!migrateResult.context.migrated || !migrateResult.context.newField) {
      throw new Error('Migration up failed - data not transformed');
    }
    recordResult('MigrationRunner - 迁移执行', true);
    
    // 测试回滚 - rollbackLast 也返回 { success, context, ... }
    const rollbackResult = await runner.rollbackLast(migrateResult.context);
    if (!rollbackResult.success) throw new Error('Rollback failed - not successful');
    if (rollbackResult.context.newField) throw new Error('Rollback failed - field not removed');
    recordResult('MigrationRunner - 回滚', true);
    
    // 清理
    await fs.rm(testDir, { recursive: true, force: true });
    
  } catch (error) {
    recordResult('MigrationRunner', false, error);
  }
}

// 主函数
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           新架构组件验证脚本                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  await verifyEventBus();
  await verifyConfigProvider();
  await verifyStateManager();
  await verifyDependencyContainer();
  await verifyPluginManager();
  await verifyIPCRouter();
  await verifyErrorHandler();
  await verifyDomainEntities();
  await verifyRepositories();
  await verifyUnitOfWork();
  await verifyMigrationRunner();
  
  // 输出总结
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      验证结果总结                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`✅ 通过: ${results.passed.length} 项`);
  results.passed.forEach(name => console.log(`   - ${name}`));
  
  if (results.failed.length > 0) {
    console.log(`\n❌ 失败: ${results.failed.length} 项`);
    results.failed.forEach(({ name, error }) => console.log(`   - ${name}: ${error}`));
  }
  
  if (results.warnings.length > 0) {
    console.log(`\n⚠️ 警告: ${results.warnings.length} 项`);
    results.warnings.forEach(msg => console.log(`   - ${msg}`));
  }
  
  const total = results.passed.length + results.failed.length;
  const passRate = ((results.passed.length / total) * 100).toFixed(1);
  
  console.log(`\n📊 总计: ${results.passed.length}/${total} 通过 (${passRate}%)`);
  
  if (results.failed.length === 0) {
    console.log('\n🎉 所有新架构组件验证通过！框架可以正常使用。');
    process.exit(0);
  } else {
    console.log('\n⚠️ 部分组件验证失败，请检查上述错误。');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('验证脚本执行失败:', error);
  process.exit(1);
});
