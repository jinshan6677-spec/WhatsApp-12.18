# Instance Manager

实例管理器 - 负责管理所有 WhatsApp 账号实例的生命周期。

## 概述

`InstanceManager` 是多实例架构的核心组件，负责：

- 创建独立的浏览器实例（BrowserWindow）
- 配置独立的用户数据目录和 session
- 监控实例状态
- 处理实例崩溃和重启
- 管理实例生命周期

## 核心特性

### 1. 完全隔离

每个账号实例拥有：
- 独立的操作系统进程
- 独立的用户数据目录 (`profiles/account_{uuid}`)
- 独立的 session 和存储空间


### 2. 本地渲染

所有实例使用本地 GPU 加速渲染，确保：
- 零延迟的用户体验
- 流畅的动画和滚动
- 完整的本地功能支持

### 3. 状态监控

实时监控每个实例的：
- 运行状态（stopped/starting/running/error/crashed）
- 进程 ID
- 内存和 CPU 使用
- 崩溃次数
- 错误信息

## 使用方法

### 初始化

```javascript
const InstanceManager = require('./managers/InstanceManager');

const instanceManager = new InstanceManager({
  userDataPath: app.getPath('userData'),
  maxInstances: 30
});
```

### 创建实例

```javascript
const accountConfig = {
  id: 'account-uuid',
  name: 'Work Account',
  translation: {
    enabled: true,
    targetLanguage: 'zh-CN',
    engine: 'google'
  },
  window: {
    width: 1200,
    height: 800
  }
};

const result = await instanceManager.createInstance(accountConfig);

if (result.success) {
  console.log('实例创建成功:', result.instanceId);
} else {
  console.error('实例创建失败:', result.error);
}
```

### 获取实例状态

```javascript
const status = instanceManager.getInstanceStatus('account-uuid');

console.log('状态:', status.status);
console.log('进程 ID:', status.pid);
console.log('内存使用:', status.memoryUsage, 'MB');
console.log('启动时间:', status.startTime);
```

### 获取运行中的实例

```javascript
const runningInstances = instanceManager.getRunningInstances();
console.log('运行中的实例数量:', runningInstances.length);

runningInstances.forEach(instance => {
  console.log(`- ${instance.config.name} (${instance.instanceId})`);
});
```


### 重启实例

```javascript
const result = await instanceManager.restartInstance('account-uuid');

if (result.success) {
  console.log('实例重启成功');
}
```

### 销毁实例

```javascript
// 销毁单个实例（保存窗口状态）
const result = await instanceManager.destroyInstance('account-uuid', {
  saveState: true
});

// 销毁所有实例
const batchResult = await instanceManager.destroyAllInstances();
console.log(`销毁了 ${batchResult.destroyed} 个实例`);
```

## API 参考

### 构造函数

```javascript
new InstanceManager(options)
```

**参数：**
- `options.userDataPath` (string): 用户数据根目录，默认为 `app.getPath('userData')`
- `options.maxInstances` (number): 最大实例数，默认为 30

### 方法

#### createInstance(accountConfig)

创建新的账号实例。

**参数：**
- `accountConfig` (Object): 账号配置对象

**返回：**
```javascript
{
  success: boolean,
  instanceId?: string,
  window?: BrowserWindow,
  error?: string
}
```

#### destroyInstance(instanceId, options)

销毁指定的实例。

**参数：**
- `instanceId` (string): 实例 ID
- `options.saveState` (boolean): 是否保存窗口状态

**返回：**
```javascript
{
  success: boolean,
  error?: string
}
```

#### restartInstance(instanceId)

重启指定的实例。

**参数：**
- `instanceId` (string): 实例 ID

**返回：**
```javascript
{
  success: boolean,
  error?: string
}
```

#### getInstanceStatus(instanceId)

获取实例状态。

**参数：**
- `instanceId` (string): 实例 ID

**返回：** `InstanceStatus` 对象或 `null`

#### getRunningInstances()

获取所有运行中的实例。

**返回：** `InstanceInfo[]` 数组

#### getAllInstances()

获取所有实例（包括已停止的）。

**返回：** `InstanceInfo[]` 数组

#### getInstanceCount()

获取实例总数。

**返回：** `number`

#### getRunningInstanceCount()

获取运行中的实例数量。

**返回：** `number`

#### instanceExists(instanceId)

检查实例是否存在。

**参数：**
- `instanceId` (string): 实例 ID

**返回：** `boolean`


#### destroyAllInstances()

销毁所有实例。

**返回：**
```javascript
{
  success: boolean,
  destroyed: number,
  failed: number
}
```

## 数据结构

### InstanceStatus

```typescript
{
  instanceId: string;
  status: 'stopped' | 'starting' | 'running' | 'error' | 'crashed';
  pid?: number;
  memoryUsage: number;
  cpuUsage: number;
  startTime?: Date;
  lastHeartbeat: Date;
  crashCount: number;
  error?: string;
  isLoggedIn: boolean;
  unreadCount: number;
}
```

### InstanceInfo

```typescript
{
  instanceId: string;
  window: BrowserWindow;
  config: AccountConfig;
  status: InstanceStatus;
}
```

## 事件处理

InstanceManager 自动处理以下窗口事件：

- `closed`: 窗口关闭时清理资源
- `crashed`: 渲染进程崩溃时更新状态
- `unresponsive`: 窗口无响应时记录警告
- `responsive`: 窗口恢复响应时清除错误
- `did-finish-load`: 页面加载完成
- `did-fail-load`: 页面加载失败

## 错误处理

所有方法都返回包含 `success` 字段的结果对象：

```javascript
const result = await instanceManager.createInstance(config);

if (result.success) {
  // 操作成功
  console.log('成功:', result.instanceId);
} else {
  // 操作失败
  console.error('失败:', result.error);
}
```

## 最佳实践

### 1. 资源管理

```javascript
// 应用退出前销毁所有实例
app.on('before-quit', async () => {
  await instanceManager.destroyAllInstances();
});
```

### 2. 错误处理

```javascript
// 始终检查操作结果
const result = await instanceManager.createInstance(config);
if (!result.success) {
  // 显示错误消息给用户
  showErrorDialog(result.error);
}
```

### 3. 状态监控

```javascript
// 定期检查实例状态
setInterval(() => {
  const instances = instanceManager.getAllInstances();
  instances.forEach(instance => {
    const status = instanceManager.getInstanceStatus(instance.instanceId);
    if (status.status === 'crashed') {
      // 处理崩溃的实例
      handleCrashedInstance(instance.instanceId);
    }
  });
}, 30000); // 每 30 秒检查一次
```

 

## 示例

完整的使用示例请参考：
- `src/examples/instance-manager-example.js`

## 相关文档

- [AccountConfigManager](./AccountConfigManager.js) - 账号配置管理
- [AccountConfig](../models/AccountConfig.js) - 账号配置数据模型
- [设计文档](../../.kiro/specs/multi-instance-architecture/design.md)
- [需求文档](../../.kiro/specs/multi-instance-architecture/requirements.md)

## 技术细节

### Session 隔离

每个实例使用独立的 session partition：

```javascript
const partition = `persist:account_${accountId}`;
const session = session.fromPartition(partition, { cache: true });
```

### 用户数据目录

每个实例的数据存储在：

```
{userDataPath}/profiles/{accountId}/
├── Cache/
├── Cookies
├── Local Storage/
├── IndexedDB/
└── Session Storage/
```

 

## 性能考虑

- 每个实例约占用 200-300MB 内存
- 推荐配置：16GB RAM 支持 30 个并发实例
- 最低配置：8GB RAM 支持 5 个并发实例
- 实例启动时间：约 2-5 秒

## 故障排查

### 实例创建失败

1. 检查是否达到最大实例数限制
2. 检查用户数据目录权限
4. 查看日志中的详细错误信息

### 实例崩溃

1. 检查系统资源使用情况
2. 查看崩溃计数和错误信息
3. 尝试重启实例
4. 如果频繁崩溃，检查账号配置

 

## 许可证

MIT


---

# Translation Integration

翻译系统集成 - 负责为每个账号实例注入翻译脚本并管理独立的翻译配置。

## 概述

`TranslationIntegration` 确保现有的翻译功能在多实例架构中正常工作，为每个账号实例提供：

- 独立的翻译配置
- 自动脚本注入
- 动态配置更新
- 独立的翻译缓存
- 性能统计

## 核心特性

### 1. 自动脚本注入

在实例加载 WhatsApp Web 时自动注入：
- 性能优化器脚本 (`contentScriptWithOptimizer.js`)
- 主翻译脚本 (`contentScript.js`)

### 2. 独立配置管理

每个实例可以有独立的翻译配置：
- 目标语言
- 翻译引擎
- 自动翻译开关
- 输入框翻译
- 好友独立设置

### 3. 动态更新

支持在运行时更新翻译配置，无需重启实例。

### 4. 缓存管理

为每个实例维护独立的翻译缓存，提高性能。

## 使用方法

### 初始化

```javascript
const TranslationIntegration = require('./managers/TranslationIntegration');

// 创建实例管理器
const instanceManager = new InstanceManager();

// 创建翻译集成
const translationIntegration = new TranslationIntegration(instanceManager);

// 初始化（加载脚本到缓存）
await translationIntegration.initialize();

// 关联到实例管理器
instanceManager.translationIntegration = translationIntegration;
```

### 注入翻译脚本

```javascript
// 方式1: 在创建实例时自动注入
const accountConfig = {
  id: 'account-uuid',
  name: 'Test Account',
  translation: {
    enabled: true,
    targetLanguage: 'zh-CN',
    engine: 'google',
    autoTranslate: true,
    translateInput: true
  }
};

// 创建实例时会自动注入翻译脚本
const result = await instanceManager.createInstance(accountConfig);

// 方式2: 手动注入
const result = await translationIntegration.injectScripts(
  instanceId,
  window,
  translationConfig
);
```

### 配置翻译

```javascript
const translationConfig = {
  enabled: true,
  targetLanguage: 'en',
  engine: 'google',
  autoTranslate: false,
  translateInput: true,
  friendSettings: {
    'contact-id': {
      enabled: true,
      targetLanguage: 'ja',
      blockChinese: false
    }
  }
};

const result = await translationIntegration.configureTranslation(
  instanceId,
  translationConfig
);

if (result.success) {
  console.log('翻译配置成功');
}
```

### 动态更新配置

```javascript
// 更新部分配置
const updates = {
  autoTranslate: true,
  targetLanguage: 'es'
};

const result = await translationIntegration.updateTranslationConfig(
  instanceId,
  updates
);
```

### 获取翻译状态

```javascript
const status = translationIntegration.getTranslationStatus(instanceId);

console.log('脚本已注入:', status.injected);
console.log('注入时间:', status.lastInjectionTime);
console.log('错误:', status.error);
```

### 获取翻译配置

```javascript
const config = translationIntegration.getTranslationConfig(instanceId);

console.log('目标语言:', config.targetLanguage);
console.log('翻译引擎:', config.engine);
console.log('自动翻译:', config.autoTranslate);
```

### 清除翻译缓存

```javascript
const result = await translationIntegration.clearCache(instanceId);

if (result.success) {
  console.log('缓存已清除');
}
```

### 获取性能统计

```javascript
const result = await translationIntegration.getPerformanceStats(instanceId);

if (result.success) {
  console.log('性能统计:', result.data);
  // {
  //   domBatches: 150,
  //   domOperations: 450,
  //   translationRequests: 100,
  //   deduplicatedRequests: 20,
  //   cacheHits: 50,
  //   cacheHitRate: '50.00%',
  //   deduplicationRate: '20.00%'
  // }
}
```

### 批量应用配置

```javascript
// 为所有运行中的实例应用相同的配置
const config = {
  enabled: true,
  targetLanguage: 'zh-CN',
  engine: 'google',
  autoTranslate: true
};

const result = await translationIntegration.applyConfigToAllInstances(config);

console.log(`成功: ${result.applied}, 失败: ${result.failed}`);
```

## API 参考

### 构造函数

```javascript
new TranslationIntegration(instanceManager)
```

**参数：**
- `instanceManager` (InstanceManager): 实例管理器引用

### 方法

#### initialize()

初始化翻译集成，加载脚本到缓存。

**返回：** `Promise<void>`

#### injectScripts(instanceId, window, translationConfig)

为实例注入翻译脚本。

**参数：**
- `instanceId` (string): 实例 ID
- `window` (BrowserWindow): 浏览器窗口
- `translationConfig` (Object, 可选): 翻译配置

**返回：**
```javascript
{
  success: boolean,
  error?: string
}
```

#### configureTranslation(instanceId, config)

配置实例的翻译设置。

**参数：**
- `instanceId` (string): 实例 ID
- `config` (TranslationConfig): 翻译配置

**返回：**
```javascript
{
  success: boolean,
  error?: string
}
```

#### updateTranslationConfig(instanceId, updates)

更新实例的翻译配置（支持部分更新）。

**参数：**
- `instanceId` (string): 实例 ID
- `updates` (Partial<TranslationConfig>): 配置更新

**返回：**
```javascript
{
  success: boolean,
  error?: string
}
```

#### getTranslationStatus(instanceId)

获取实例的翻译状态。

**参数：**
- `instanceId` (string): 实例 ID

**返回：** 状态对象或 `null`

#### getTranslationConfig(instanceId)

获取实例的翻译配置。

**参数：**
- `instanceId` (string): 实例 ID

**返回：** 配置对象或 `null`

#### clearCache(instanceId)

清除实例的翻译缓存。

**参数：**
- `instanceId` (string): 实例 ID

**返回：**
```javascript
{
  success: boolean,
  error?: string
}
```

#### getPerformanceStats(instanceId)

获取翻译性能统计。

**参数：**
- `instanceId` (string): 实例 ID

**返回：**
```javascript
{
  success: boolean,
  data?: Object,
  error?: string
}
```

#### applyConfigToAllInstances(config)

为所有运行中的实例应用配置。

**参数：**
- `config` (TranslationConfig): 翻译配置

**返回：**
```javascript
{
  success: boolean,
  applied: number,
  failed: number
}
```

#### removeInstance(instanceId)

移除实例的翻译配置和状态。

**参数：**
- `instanceId` (string): 实例 ID

#### getAllTranslationStatuses()

获取所有实例的翻译状态。

**返回：** `Map<string, Object>`

#### reloadScripts()

重新加载翻译脚本缓存。

**返回：**
```javascript
{
  success: boolean,
  error?: string
}
```

#### cleanup()

清理资源。

## 数据结构

### TranslationConfig

```typescript
{
  enabled: boolean;
  targetLanguage: string;
  engine: 'google' | 'gpt4' | 'gemini' | 'deepseek';
  apiKey?: string;
  autoTranslate: boolean;
  translateInput: boolean;
  friendSettings: {
    [contactId: string]: {
      enabled: boolean;
      targetLanguage: string;
      blockChinese: boolean;
    }
  };
}
```

### TranslationStatus

```typescript
{
  injected: boolean;
  lastInjectionTime: Date;
  error: string | null;
}
```

## 工作原理

### 脚本注入流程

1. 实例创建时，InstanceManager 调用 `injectScripts()`
2. TranslationIntegration 监听 `did-finish-load` 事件
3. 页面加载完成后，依次注入：
   - 性能优化器脚本
   - 主翻译脚本
4. 初始化翻译系统，设置 accountId
5. 更新注入状态

### 配置更新流程

1. 调用 `configureTranslation()` 或 `updateTranslationConfig()`
2. 存储新配置到内存
3. 通过 `executeJavaScript` 将配置传递给渲染进程
4. 渲染进程更新 `WhatsAppTranslation.config`
5. 重新初始化相关功能（中文拦截、实时翻译等）

### 缓存管理

每个实例的翻译缓存独立存储在渲染进程中：
- 使用 `contentScriptOptimizer.translationCache`
- 5 秒过期时间
- 支持手动清除

## 最佳实践

### 1. 初始化顺序

```javascript
// 正确的初始化顺序
const instanceManager = new InstanceManager();
const translationIntegration = new TranslationIntegration(instanceManager);
await translationIntegration.initialize();
instanceManager.translationIntegration = translationIntegration;
```

### 2. 错误处理

```javascript
const result = await translationIntegration.configureTranslation(
  instanceId,
  config
);

if (!result.success) {
  console.error('配置失败:', result.error);
  // 显示错误消息给用户
  showErrorNotification(result.error);
}
```

### 3. 配置验证

```javascript
function validateTranslationConfig(config) {
  const validEngines = ['google', 'gpt4', 'gemini', 'deepseek'];
  if (!validEngines.includes(config.engine)) {
    throw new Error('Invalid translation engine');
  }
  
  const validLanguages = ['zh-CN', 'en', 'ja', 'ko', 'es', 'fr', 'de'];
  if (!validLanguages.includes(config.targetLanguage)) {
    throw new Error('Invalid target language');
  }
}

try {
  validateTranslationConfig(config);
  await translationIntegration.configureTranslation(instanceId, config);
} catch (error) {
  console.error('配置验证失败:', error);
}
```

### 4. 性能监控

```javascript
// 定期检查翻译性能
setInterval(async () => {
  const instances = instanceManager.getRunningInstances();
  
  for (const instance of instances) {
    const stats = await translationIntegration.getPerformanceStats(
      instance.instanceId
    );
    
    if (stats.success) {
      // 检查缓存命中率
      const hitRate = parseFloat(stats.data.cacheHitRate);
      if (hitRate < 30) {
        console.warn(`Low cache hit rate for ${instance.instanceId}: ${hitRate}%`);
      }
    }
  }
}, 60000); // 每分钟检查一次
```

### 5. 资源清理

```javascript
// 实例销毁时自动清理
instanceManager.on('instance-destroyed', (instanceId) => {
  translationIntegration.removeInstance(instanceId);
});

// 应用退出时清理
app.on('before-quit', () => {
  translationIntegration.cleanup();
});
```

## 示例

完整的使用示例请参考：
- `src/examples/translation-integration-example.js`

## 与现有翻译系统的兼容性

TranslationIntegration 完全兼容现有的翻译系统：

- ✅ 复用现有的翻译脚本
- ✅ 支持所有翻译引擎
- ✅ 保持相同的 API 接口
- ✅ 支持好友独立配置
- ✅ 支持中文拦截功能
- ✅ 支持实时翻译
- ✅ 支持反向翻译验证

## 故障排查

### 脚本注入失败

1. 检查脚本文件是否存在
2. 检查窗口是否有效
3. 查看控制台错误信息
4. 尝试重新加载脚本缓存

### 配置不生效

1. 检查实例是否正在运行
2. 验证配置格式是否正确
3. 查看翻译状态中的错误信息
4. 尝试重启实例

### 性能问题

1. 检查缓存命中率
2. 清除翻译缓存
3. 减少并发翻译请求
4. 优化翻译配置

## 相关文档

- [InstanceManager](#instance-manager) - 实例管理器
- [翻译服务](../translation/translationService.js) - 翻译服务实现
- [内容脚本](../translation/contentScript.js) - 翻译内容脚本
- [设计文档](../../.kiro/specs/multi-instance-architecture/design.md)


---

# Error Handler

错误处理器 - 负责处理实例崩溃、翻译错误等各种错误情况，并实现自动重启逻辑。

## 概述

`ErrorHandler` 是多实例架构的错误处理核心组件，负责：

- 检测和记录实例崩溃
- 实现自动重启逻辑
- 管理崩溃历史和统计
- 记录详细的错误日志
- 处理多种错误类型
- 防止无限重启循环

## 核心特性

### 1. 智能崩溃处理

- 自动跟踪崩溃次数
- 基于时间窗口的崩溃计数重置
- 可配置的最大崩溃次数阈值
- 延迟重启机制
- 超过阈值后停止自动重启

### 2. 多种错误类型支持

- **实例崩溃** (CRASH): 渲染进程崩溃
- **翻译错误** (TRANSLATION_ERROR): 翻译服务错误
- **页面加载错误** (PAGE_LOAD_ERROR): WhatsApp Web 加载失败
- **实例无响应** (UNRESPONSIVE): 窗口无响应
- **重启失败** (RESTART_FAILED): 自动重启失败
- **超过最大崩溃次数** (MAX_CRASH_COUNT_EXCEEDED): 崩溃次数超限

### 3. 详细日志记录

- JSON 格式的结构化日志
- 包含时间戳、实例 ID、错误类型、详细信息
- 支持日志文件持久化
- 支持日志查询和过滤

### 4. 崩溃统计

- 总崩溃次数
- 最近时间窗口内的崩溃次数
- 最后崩溃时间
- 支持按实例查询统计

## 使用方法

### 初始化

```javascript
const { UnifiedErrorHandler } = require('../shared/utils/ErrorHandler');
const InstanceManager = require('./managers/InstanceManager');
const path = require('path');

// 创建实例管理器
const instanceManager = new InstanceManager();

// 创建错误处理器
const errorHandler = new UnifiedErrorHandler({
  type: 'manager',
  instanceManager: instanceManager,
  maxCrashCount: 3,           // 最大崩溃次数
  crashResetTime: 300000,     // 5 分钟内的崩溃计数
  restartDelay: 5000          // 重启延迟 5 秒
});

// 关联到实例管理器
instanceManager.errorHandler = errorHandler;
```

### 处理实例崩溃

```javascript
// 通常由 InstanceManager 自动调用
// 也可以手动调用

await errorHandler.handleInstanceCrash(
  instanceId,
  new Error('Renderer process crashed'),
  false // killed: 是否被强制终止
);
```

**自动重启逻辑：**
1. 记录崩溃到历史
2. 计算最近时间窗口内的崩溃次数
3. 如果崩溃次数 < 最大次数：
   - 延迟 5 秒后自动重启
4. 如果崩溃次数 >= 最大次数：
   - 标记实例为 "error" 状态
   - 停止自动重启
   - 记录错误日志

 

### 处理翻译错误

```javascript
await errorHandler.handleTranslationError(
  instanceId,
  new Error('Translation API key invalid')
);
```

### 处理页面加载错误

```javascript
await errorHandler.handlePageLoadError(
  instanceId,
  -106, // 错误代码
  'ERR_INTERNET_DISCONNECTED' // 错误描述
);
```

### 处理实例无响应

```javascript
await errorHandler.handleInstanceUnresponsive(instanceId);
```

### 获取崩溃统计

```javascript
// 获取单个实例的统计
const stats = errorHandler.getCrashStats(instanceId);

console.log('总崩溃次数:', stats.totalCrashes);
console.log('最近崩溃次数:', stats.recentCrashes);
console.log('最后崩溃时间:', stats.lastCrash);

// 获取所有实例的统计
const allStats = errorHandler.getAllCrashStats();

for (const [instanceId, stats] of allStats.entries()) {
  console.log(`${instanceId}: ${stats.recentCrashes} 次最近崩溃`);
}
```

### 清除崩溃历史

```javascript
// 清除单个实例的崩溃历史
errorHandler.clearCrashHistory(instanceId);

// 清除所有实例的崩溃历史
errorHandler.clearAllCrashHistory();
```

### 读取错误日志

```javascript
// 读取所有错误日志
const logs = await errorHandler.readErrorLogs();

// 读取特定实例的日志
const instanceLogs = await errorHandler.readErrorLogs({
  instanceId: 'account-uuid'
});

// 读取特定错误类型的日志
const crashLogs = await errorHandler.readErrorLogs({
  errorType: 'CRASH'
});

// 限制返回数量（最新的 50 条）
const recentLogs = await errorHandler.readErrorLogs({
  limit: 50
});

// 组合过滤
const filteredLogs = await errorHandler.readErrorLogs({
  instanceId: 'account-uuid',
  limit: 10
});

// 处理日志
logs.forEach(log => {
  console.log(`[${log.timestamp.toISOString()}] ${log.errorType}: ${log.message}`);
  console.log('  实例:', log.instanceId);
  console.log('  详情:', log.details);
});
```

### 清除错误日志文件

```javascript
await errorHandler.clearErrorLogs();
```

## API 参考

### 构造函数

```javascript
new ErrorHandler(instanceManager, options)
```

**参数：**
- `instanceManager` (InstanceManager): 实例管理器引用
- `options.maxCrashCount` (number, 默认: 3): 最大崩溃次数
- `options.crashResetTime` (number, 默认: 300000): 崩溃计数重置时间（毫秒）
- `options.restartDelay` (number, 默认: 5000): 重启延迟（毫秒）
- `options.logPath` (string, 可选): 日志文件路径

### 方法

#### handleInstanceCrash(instanceId, error, killed)

处理实例崩溃。

**参数：**
- `instanceId` (string): 实例 ID
- `error` (Object): 错误对象
- `killed` (boolean, 默认: false): 是否被强制终止

**返回：** `Promise<void>`

 

#### handleTranslationError(instanceId, error)

处理翻译错误。

**参数：**
- `instanceId` (string): 实例 ID
- `error` (Object): 错误对象

**返回：** `Promise<void>`

#### handlePageLoadError(instanceId, errorCode, errorDescription)

处理页面加载错误。

**参数：**
- `instanceId` (string): 实例 ID
- `errorCode` (number): 错误代码
- `errorDescription` (string): 错误描述

**返回：** `Promise<void>`

#### handleInstanceUnresponsive(instanceId)

处理实例无响应。

**参数：**
- `instanceId` (string): 实例 ID

**返回：** `Promise<void>`

#### getCrashStats(instanceId)

获取实例的崩溃统计。

**参数：**
- `instanceId` (string): 实例 ID

**返回：**
```javascript
{
  totalCrashes: number,
  recentCrashes: number,
  lastCrash: Date | null
}
```

#### getAllCrashStats()

获取所有实例的崩溃统计。

**返回：** `Map<string, CrashStats>`

#### clearCrashHistory(instanceId)

清除实例的崩溃历史。

**参数：**
- `instanceId` (string): 实例 ID

#### clearAllCrashHistory()

清除所有实例的崩溃历史。

#### readErrorLogs(options)

读取错误日志。

**参数：**
- `options.limit` (number, 可选): 限制返回的日志数量
- `options.instanceId` (string, 可选): 过滤特定实例的日志
- `options.errorType` (string, 可选): 过滤特定错误类型

**返回：** `Promise<ErrorLog[]>`

#### clearErrorLogs()

清除错误日志文件。

**返回：** `Promise<void>`

## 数据结构

### ErrorLog

```typescript
{
  timestamp: Date;
  instanceId: string;
  errorType: string;
  message: string;
  details?: Object;
}
```

### CrashStats

```typescript
{
  totalCrashes: number;
  recentCrashes: number;
  lastCrash: Date | null;
}
```

## 工作原理

### 崩溃处理流程

```
实例崩溃
  ↓
记录崩溃到历史
  ↓
计算最近时间窗口内的崩溃次数
  ↓
崩溃次数 < 最大次数？
  ↓ 是
延迟 N 秒
  ↓
尝试重启实例
  ↓
重启成功？
  ↓ 是
实例恢复运行
  
  ↓ 否（崩溃次数 >= 最大次数）
标记实例为 "error"
  ↓
停止自动重启
  ↓
记录错误日志
```

### 崩溃计数重置

崩溃计数基于时间窗口：
- 默认时间窗口：5 分钟（300000 毫秒）
- 只统计时间窗口内的崩溃
- 超过时间窗口的崩溃不计入

**示例：**
```
时间轴：
0:00 - 崩溃 #1 ✓ 计入（重启）
0:30 - 崩溃 #2 ✓ 计入（重启）
1:00 - 崩溃 #3 ✓ 计入（重启）
1:30 - 崩溃 #4 ✗ 超过阈值（停止重启）

6:00 - 崩溃 #5 ✓ 计入（0:00 的崩溃已过期，重新开始计数）
```

### 日志格式

错误日志以 JSON Lines 格式存储：

```json
{"timestamp":"2025-11-16T10:30:00.000Z","instanceId":"account-123","errorType":"CRASH","message":"Instance crashed","details":{"error":"Error: Renderer process crashed","killed":false}}
{"timestamp":"2025-11-16T10:35:00.000Z","instanceId":"account-123","errorType":"RESTART_FAILED","message":"Failed to restart instance: Network timeout","details":{}}
 
```

## 最佳实践

### 1. 合理配置参数

```javascript
// 开发环境：快速重启，更多重试次数
const devErrorHandler = new ErrorHandler(instanceManager, {
  maxCrashCount: 5,
  crashResetTime: 60000,  // 1 分钟
  restartDelay: 2000      // 2 秒
});

// 生产环境：保守配置，避免资源浪费
const prodErrorHandler = new ErrorHandler(instanceManager, {
  maxCrashCount: 3,
  crashResetTime: 300000, // 5 分钟
  restartDelay: 5000      // 5 秒
});
```

### 2. 监控崩溃趋势

```javascript
// 定期检查崩溃统计
setInterval(() => {
  const allStats = errorHandler.getAllCrashStats();
  
  for (const [instanceId, stats] of allStats.entries()) {
    if (stats.recentCrashes >= 2) {
      console.warn(`Instance ${instanceId} has ${stats.recentCrashes} recent crashes`);
      // 发送告警通知
      sendAlert(`Instance ${instanceId} is unstable`);
    }
  }
}, 60000); // 每分钟检查一次
```

### 3. 日志分析

```javascript
// 分析错误日志，找出常见问题
async function analyzeErrorLogs() {
  const logs = await errorHandler.readErrorLogs({ limit: 1000 });
  
  // 按错误类型统计
  const errorCounts = {};
  logs.forEach(log => {
    errorCounts[log.errorType] = (errorCounts[log.errorType] || 0) + 1;
  });
  
  console.log('错误类型统计:');
  Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  
  // 找出问题最多的实例
  const instanceCounts = {};
  logs.forEach(log => {
    instanceCounts[log.instanceId] = (instanceCounts[log.instanceId] || 0) + 1;
  });
  
  console.log('\n问题最多的实例:');
  Object.entries(instanceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([instanceId, count]) => {
      console.log(`  ${instanceId}: ${count} 个错误`);
    });
}

// 每天运行一次分析
setInterval(analyzeErrorLogs, 86400000);
```

### 4. 手动干预

```javascript
// 对于频繁崩溃的实例，提供手动干预选项
async function handleProblematicInstance(instanceId) {
  const stats = errorHandler.getCrashStats(instanceId);
  
  if (stats.recentCrashes >= 2) {
    // 显示对话框询问用户
    const action = await showDialog({
      title: '实例不稳定',
      message: `实例 ${instanceId} 最近崩溃了 ${stats.recentCrashes} 次。`,
      buttons: ['清除崩溃历史并重试', '禁用实例', '查看日志']
    });
    
    switch (action) {
      case 0: // 清除崩溃历史并重试
        errorHandler.clearCrashHistory(instanceId);
        await instanceManager.restartInstance(instanceId);
        break;
        
      case 1: // 禁用实例
        await instanceManager.destroyInstance(instanceId);
        break;
        
      case 2: // 查看日志
        const logs = await errorHandler.readErrorLogs({
          instanceId,
          limit: 20
        });
        showLogViewer(logs);
        break;
    }
  }
}
```

### 5. 日志轮转

```javascript
// 定期清理旧日志，避免日志文件过大
async function rotateErrorLogs() {
  const logs = await errorHandler.readErrorLogs();
  
  // 如果日志超过 10000 条，只保留最新的 5000 条
  if (logs.length > 10000) {
    const recentLogs = logs.slice(-5000);
    
    // 清除旧日志
    await errorHandler.clearErrorLogs();
    
    // 重新写入最新日志
    for (const log of recentLogs) {
      await errorHandler._logError(log);
    }
    
    console.log(`日志已轮转: 保留 ${recentLogs.length} 条，删除 ${logs.length - recentLogs.length} 条`);
  }
}

// 每天运行一次日志轮转
setInterval(rotateErrorLogs, 86400000);
```

## 示例

完整的使用示例请参考：
- `src/examples/error-handler-example.js`

## 与 InstanceManager 的集成

ErrorHandler 与 InstanceManager 紧密集成：

```javascript
// InstanceManager 自动调用 ErrorHandler 的方法

// 窗口崩溃时
window.webContents.on('crashed', (event, killed) => {
  if (this.errorHandler) {
    this.errorHandler.handleInstanceCrash(instanceId, error, killed);
  }
});

// 窗口无响应时
window.on('unresponsive', () => {
  if (this.errorHandler) {
    this.errorHandler.handleInstanceUnresponsive(instanceId);
  }
});

// 页面加载失败时
window.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
  if (this.errorHandler) {
    this.errorHandler.handlePageLoadError(instanceId, errorCode, errorDescription);
  }
});

 
```

## 故障排查

### 实例不断重启

**原因：** 崩溃次数未达到阈值，持续自动重启

**解决方案：**
1. 检查崩溃原因（查看错误日志）
2. 修复根本问题（内存不足等）
3. 如果无法修复，手动停止实例
4. 调整 `maxCrashCount` 或 `crashResetTime` 参数

### 日志文件过大

**原因：** 长时间运行，错误日志累积

**解决方案：**
1. 实现日志轮转（见最佳实践）
2. 定期清理旧日志
3. 减少日志记录级别
4. 使用外部日志管理工具

### 重启延迟过长

**原因：** `restartDelay` 设置过大

**解决方案：**
1. 调整 `restartDelay` 参数
2. 根据实际情况平衡重启速度和系统稳定性

## 性能考虑

- 崩溃历史存储在内存中，占用空间很小
- 日志写入是异步的，不会阻塞主线程
- 重启定时器使用 `setTimeout`，资源占用极小
- 建议定期清理崩溃历史和日志文件

## 相关文档

- [InstanceManager](#instance-manager) - 实例管理器
- [设计文档](../../.kiro/specs/multi-instance-architecture/design.md) - 错误处理策略
- [需求文档](../../.kiro/specs/multi-instance-architecture/requirements.md) - 需求 2.3, 7.5, 8.1, 8.5

## 许可证

MIT
