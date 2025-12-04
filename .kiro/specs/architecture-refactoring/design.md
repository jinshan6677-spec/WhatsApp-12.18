# Design Document

## Overview

本设计文档描述WhatsApp桌面客户端架构重构的技术方案。重构采用分层架构模式，结合插件系统、事件总线、Repository模式等设计模式，提升代码的可维护性和扩展性。

### 设计目标

1. **清晰的分层结构** - 表现层、应用层、领域层、基础设施层
2. **松耦合设计** - 通过接口、事件总线实现模块解耦
3. **可扩展性** - 插件系统支持功能热插拔
4. **可测试性** - 依赖注入、Mock支持便于单元测试
5. **向后兼容** - 渐进式迁移，不破坏现有功能

## Architecture

### 整体架构图

```mermaid
graph TB
    subgraph Presentation["表现层 (Presentation)"]
        UI[UI Components]
        IPC[IPC Handlers]
        Preload[Preload Scripts]
        ViewMgr[ViewManager]
    end
    
    subgraph Application["应用层 (Application)"]
        AcctSvc[AccountService]
        TransSvc[TranslationService]
        ProxySvc[ProxyService]
        FpSvc[FingerprintService]
    end
    
    subgraph Domain["领域层 (Domain)"]
        Entities[Entities]
        DomainEvents[Domain Events]
        RepoInterfaces[Repository Interfaces]
    end
    
    subgraph Infrastructure["基础设施层 (Infrastructure)"]
        subgraph ProxySecurity["代理安全模块 🔒"]
            SecurityMgr[ProxySecurityManager]
            ConnMgr[ProxyConnectionManager]
            HealthMon[ProxyHealthMonitor]
            IPProtect[IPProtectionInjector]
            LeakDetect[IPLeakDetector]
            KillSwitch[Kill-Switch]
        end
        
        subgraph Translation["翻译模块 🌐"]
            TransAdapters[Translation Adapters]
            TransCache[Translation Cache]
        end
        
        Repositories[Repository Implementations]
        Storage[Storage Adapters]
        Plugins[Plugin System]
    end
    
    subgraph CrossCutting["横切关注点"]
        EventBus[Event Bus]
        DI[Dependency Container]
        Config[Config Provider]
        ErrorHandler[Error Handler]
        StateMgr[State Manager]
    end
    
    %% 表现层到应用层
    UI --> AcctSvc
    IPC --> ProxySvc
    IPC --> TransSvc
    ViewMgr --> ProxySvc
    
    %% 应用层到基础设施层
    ProxySvc --> SecurityMgr
    ProxySvc --> ConnMgr
    ProxySvc --> HealthMon
    TransSvc --> TransAdapters
    
    %% 代理安全模块内部
    SecurityMgr --> IPProtect
    SecurityMgr --> LeakDetect
    ConnMgr --> KillSwitch
    HealthMon --> KillSwitch
    
    %% ViewManager集成代理安全
    ViewMgr --> IPProtect
    ViewMgr --> KillSwitch
    
    %% 横切关注点
    EventBus -.-> ProxySvc
    EventBus -.-> HealthMon
    EventBus -.-> KillSwitch
    DI -.-> ProxySvc
    DI -.-> TransSvc
    
    %% 样式
    style ProxySecurity fill:#ffcccc,stroke:#cc0000
    style KillSwitch fill:#ff6666,stroke:#cc0000
    style IPProtect fill:#ffcccc,stroke:#cc0000
```

### 代理安全架构详图

```mermaid
graph LR
    subgraph BrowserView["BrowserView (WhatsApp)"]
        WebContent[Web Content]
        Network[Network Requests]
    end
    
    subgraph ProxyLayer["代理安全层 🔒"]
        direction TB
        IPInjector[IP Protection Injector]
        ProxyEnforce[Proxy Enforcer]
        DNSProtect[DNS Leak Prevention]
        WebRTCBlock[WebRTC Blocker]
        KS[Kill-Switch]
    end
    
    subgraph ProxyServer["代理服务器"]
        Proxy[SOCKS5/HTTP Proxy]
    end
    
    subgraph Internet["互联网"]
        WhatsApp[WhatsApp Servers]
    end
    
    %% 正常流程
    WebContent --> IPInjector
    IPInjector --> ProxyEnforce
    ProxyEnforce --> DNSProtect
    DNSProtect --> WebRTCBlock
    WebRTCBlock --> Proxy
    Proxy --> WhatsApp
    
    %% Kill-Switch触发
    KS -.->|代理断开| ProxyEnforce
    KS -.->|阻断所有请求| Network
    
    %% 禁止直连
    Network -.->|❌ 禁止直连| WhatsApp
    
    style ProxyLayer fill:#ffcccc,stroke:#cc0000
    style KS fill:#ff6666,stroke:#cc0000
```

### 目录结构

```
src/
├── main.js                      # 应用入口
├── preload.js                   # 预加载脚本
│
├── presentation/                # 表现层
│   ├── windows/                 # 窗口管理
│   │   ├── MainWindow.js
│   │   └── ViewManager.js       # 集成代理安全
│   ├── ipc/                     # IPC处理器
│   │   ├── IPCRouter.js
│   │   ├── handlers/
│   │   └── schemas/
│   └── renderer/                # 渲染进程代码
│
├── application/                 # 应用层
│   ├── services/                # 应用服务
│   │   ├── AccountService.js
│   │   ├── TranslationService.js
│   │   ├── ProxyService.js      # 代理服务（安全增强）
│   │   └── FingerprintService.js
│   ├── usecases/                # 用例
│   └── dtos/                    # 数据传输对象
│
├── domain/                      # 领域层
│   ├── entities/                # 实体
│   │   ├── Account.js
│   │   ├── ProxyConfig.js
│   │   ├── ProxyConnectionStatus.js
│   │   ├── ProxyHealthStats.js
│   │   ├── ProxyError.js
│   │   ├── TranslationConfig.js
│   │   └── FingerprintConfig.js
│   ├── services/                # 领域服务
│   ├── events/                  # 领域事件
│   │   ├── ProxyConnectedEvent.js
│   │   ├── ProxyDisconnectedEvent.js
│   │   ├── KillSwitchActivatedEvent.js
│   │   └── IPLeakDetectedEvent.js
│   ├── repositories/            # Repository接口
│   └── errors/                  # 领域错误
│
├── infrastructure/              # 基础设施层
│   ├── proxy/                   # 🔒 代理安全模块（完全重写）
│   │   ├── ProxySecurityManager.js    # 安全策略管理
│   │   ├── ProxyConnectionManager.js  # 连接管理（禁止回退）
│   │   ├── ProxyHealthMonitor.js      # 健康监控
│   │   ├── IPProtectionInjector.js    # IP保护脚本注入
│   │   ├── IPLeakDetector.js          # IP泄露检测
│   │   ├── KillSwitch.js              # Kill-Switch机制
│   │   ├── DNSLeakPrevention.js       # DNS泄露防护
│   │   └── WebRTCBlocker.js           # WebRTC阻断
│   │
│   ├── translation/             # 🌐 翻译模块（渐进式重构）
│   │   ├── adapters/            # 翻译引擎适配器
│   │   │   ├── ITranslationAdapter.js
│   │   │   ├── GoogleTranslateAdapter.js
│   │   │   ├── GPT4Adapter.js
│   │   │   ├── GeminiAdapter.js
│   │   │   ├── DeepSeekAdapter.js
│   │   │   └── CustomAPIAdapter.js
│   │   └── TranslationCache.js
│   │
│   ├── fingerprint/             # 指纹模块
│   │   ├── FingerprintGenerator.js
│   │   └── FingerprintInjector.js
│   │
│   ├── repositories/            # Repository实现
│   ├── storage/                 # 存储适配器
│   └── plugins/                 # 插件系统
│
└── core/                        # 核心模块（横切关注点）
    ├── eventbus/                # 事件总线
    ├── container/               # 依赖注入容器
    ├── config/                  # 配置管理
    ├── errors/                  # 错误处理
    ├── state/                   # 状态管理
    └── logging/                 # 日志系统
```

### 代理安全模块组件说明

| 组件 | 职责 | 关键功能 |
|------|------|----------|
| **ProxySecurityManager** | 安全策略总管理 | 协调所有安全组件，强制proxy-only策略 |
| **ProxyConnectionManager** | 连接生命周期管理 | 安全连接、断开、重试（禁止回退直连） |
| **ProxyHealthMonitor** | 健康状态监控 | 定期检查、延迟监控、失败检测 |
| **IPProtectionInjector** | 脚本注入 | 在BrowserView中注入IP保护脚本 |
| **IPLeakDetector** | 泄露检测 | 检测WebRTC/DNS/WebSocket等泄露 |
| **KillSwitch** | 紧急断开 | 代理失效时立即阻断所有网络请求 |
| **DNSLeakPrevention** | DNS保护 | 确保DNS请求通过代理 |
| **WebRTCBlocker** | WebRTC阻断 | 完全禁用WebRTC防止IP泄露 |

## Components and Interfaces

### 1. 事件总线 (EventBus)

```javascript
// core/eventbus/EventBus.js
interface IEventBus {
  publish<T>(event: string, payload: T): Promise<void>;
  subscribe<T>(event: string, handler: (payload: T) => void): () => void;
  subscribeOnce<T>(event: string, handler: (payload: T) => void): () => void;
  getHistory(event?: string, limit?: number): EventRecord[];
  clear(): void;
}

interface EventRecord {
  event: string;
  payload: any;
  timestamp: number;
  subscribers: number;
}
```

### 2. 插件系统 (PluginManager)

```javascript
// infrastructure/plugins/PluginManager.js
interface IPlugin {
  name: string;
  version: string;
  dependencies?: string[];
  initialize(context: PluginContext): Promise<void>;
  destroy(): Promise<void>;
}

interface IPluginManager {
  register(plugin: IPlugin): void;
  unregister(pluginName: string): void;
  enable(pluginName: string): Promise<void>;
  disable(pluginName: string): Promise<void>;
  getPlugin(name: string): IPlugin | undefined;
  getAllPlugins(): IPlugin[];
}

interface PluginContext {
  eventBus: IEventBus;
  container: IDependencyContainer;
  config: IConfigProvider;
  registerService(name: string, service: any): void;
  registerIPCHandler(channel: string, handler: Function): void;
}
```

### 3. Repository接口

```javascript
// domain/repositories/IRepository.js
interface IRepository<T, ID> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  findBy(criteria: Partial<T>): Promise<T[]>;
  save(entity: T): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T>;
  delete(id: ID): Promise<boolean>;
  exists(id: ID): Promise<boolean>;
}

// domain/repositories/IAccountRepository.js
interface IAccountRepository extends IRepository<Account, string> {
  findByName(name: string): Promise<Account | null>;
  findActive(): Promise<Account[]>;
  updateLastActive(id: string): Promise<void>;
}

// domain/repositories/IProxyRepository.js
interface IProxyRepository extends IRepository<ProxyConfig, string> {
  findByProtocol(protocol: string): Promise<ProxyConfig[]>;
  findEnabled(): Promise<ProxyConfig[]>;
}
```

### 4. 配置提供者 (ConfigProvider)

```javascript
// core/config/ConfigProvider.js
interface IConfigProvider {
  get<T>(key: string, defaultValue?: T): T;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
  load(source: string): Promise<void>;
  save(): Promise<void>;
  validate(): ValidationResult;
  onChange(key: string, handler: (newValue: any, oldValue: any) => void): () => void;
  getSchema(): ConfigSchema;
  serialize(): string;
  deserialize(data: string): void;
}

interface ConfigSchema {
  properties: Record<string, PropertySchema>;
  required: string[];
}
```

### 5. 增强的依赖容器

```javascript
// core/container/DependencyContainer.js
interface IDependencyContainer {
  // 注册
  registerSingleton<T>(name: string, instance: T): void;
  registerTransient<T>(name: string, factory: () => T): void;
  registerScoped<T>(name: string, factory: (scope: IScope) => T): void;
  registerFactory<T>(name: string, factory: (...args: any[]) => T): void;
  
  // 解析
  resolve<T>(name: string): T;
  resolveAsync<T>(name: string): Promise<T>;
  tryResolve<T>(name: string): T | undefined;
  
  // 作用域
  createScope(): IScope;
  
  // 装饰器
  decorate<T>(name: string, decorator: (service: T) => T): void;
  
  // 验证
  validateRegistrations(): ValidationResult;
  getRegisteredServices(): ServiceInfo[];
}

enum ServiceScope {
  Singleton = 'singleton',
  Transient = 'transient',
  Scoped = 'scoped'
}
```

### 6. IPC路由器

```javascript
// presentation/ipc/IPCRouter.js
interface IIPCRouter {
  register(channel: string, handler: IPCHandler, schema?: RequestSchema): void;
  unregister(channel: string): void;
  handle(channel: string, request: IPCRequest): Promise<IPCResponse>;
  batch(requests: IPCRequest[]): Promise<IPCResponse[]>;
  getChannels(): ChannelInfo[];
}

interface IPCHandler {
  (request: IPCRequest, context: IPCContext): Promise<any>;
}

interface IPCRequest {
  channel: string;
  payload: any;
  requestId: string;
  timeout?: number;
}

interface IPCResponse {
  requestId: string;
  success: boolean;
  data?: any;
  error?: IPCError;
}
```

### 7. 状态管理器

```javascript
// core/state/StateManager.js
interface IStateManager<T> {
  getState(): T;
  getSlice<K extends keyof T>(key: K): T[K];
  setState(updater: (state: T) => T): void;
  setSlice<K extends keyof T>(key: K, value: T[K]): void;
  subscribe(listener: (state: T) => void): () => void;
  subscribeToSlice<K extends keyof T>(key: K, listener: (value: T[K]) => void): () => void;
  persist(): Promise<void>;
  restore(): Promise<void>;
  snapshot(): StateSnapshot<T>;
  serialize(): string;
  deserialize(data: string): T;
}

interface StateSnapshot<T> {
  state: T;
  timestamp: number;
  version: number;
}
```

### 8. 错误处理系统

```javascript
// core/errors/ErrorTypes.js
class AppError extends Error {
  code: string;
  context: Record<string, any>;
  recoverable: boolean;
  
  constructor(message: string, code: string, context?: Record<string, any>);
  toJSON(): ErrorDTO;
  static fromJSON(dto: ErrorDTO): AppError;
}

class ValidationError extends AppError { /* ... */ }
class NetworkError extends AppError { /* ... */ }
class StorageError extends AppError { /* ... */ }
class PluginError extends AppError { /* ... */ }
class IPCError extends AppError { /* ... */ }

// core/errors/ErrorHandler.js
interface IErrorHandler {
  handle(error: Error, context?: ErrorContext): void;
  recover(error: AppError): Promise<boolean>;
  registerRecoveryStrategy(errorCode: string, strategy: RecoveryStrategy): void;
  getErrorHistory(limit?: number): ErrorRecord[];
}
```

## Data Models

### Account实体

```javascript
// domain/entities/Account.js
class Account {
  id: string;
  name: string;
  phoneNumber?: string;
  status: AccountStatus;
  autoStart: boolean;
  createdAt: Date;
  lastActiveAt?: Date;
  proxy?: ProxyConfig;
  translation?: TranslationConfig;
  fingerprint?: FingerprintConfig;
  
  // 领域方法
  activate(): void;
  deactivate(): void;
  updateProxy(config: ProxyConfig): void;
  isActive(): boolean;
  
  // 序列化
  toJSON(): AccountDTO;
  static fromJSON(dto: AccountDTO): Account;
  static prettyPrint(account: Account): string;
}

enum AccountStatus {
  Inactive = 'inactive',
  Loading = 'loading',
  Active = 'active',
  Error = 'error'
}
```

### ProxyConfig实体

```javascript
// domain/entities/ProxyConfig.js
class ProxyConfig {
  id: string;
  enabled: boolean;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
  bypass?: string;
  
  // 领域方法
  getUrl(): string;
  validate(): ValidationResult;
  
  // 序列化
  toJSON(): ProxyConfigDTO;
  static fromJSON(dto: ProxyConfigDTO): ProxyConfig;
  static prettyPrint(config: ProxyConfig): string;
}

enum ProxyProtocol {
  HTTP = 'http',
  HTTPS = 'https',
  SOCKS5 = 'socks5'
}
```

### TranslationConfig实体

```javascript
// domain/entities/TranslationConfig.js
class TranslationConfig {
  enabled: boolean;
  engine: TranslationEngine;
  apiKey?: string;
  targetLanguage: string;
  sourceLanguage?: string;
  autoTranslate: boolean;
  translateInput: boolean;
  inputStyle?: TranslationStyle;
  friendSettings: Map<string, FriendTranslationConfig>;
  
  // 领域方法
  getEngineConfig(): EngineConfig;
  getFriendConfig(friendId: string): FriendTranslationConfig;
  
  // 序列化
  toJSON(): TranslationConfigDTO;
  static fromJSON(dto: TranslationConfigDTO): TranslationConfig;
  static prettyPrint(config: TranslationConfig): string;
}

enum TranslationEngine {
  Google = 'google',
  GPT4 = 'gpt4',
  Gemini = 'gemini',
  DeepSeek = 'deepseek',
  Custom = 'custom'
}

enum TranslationStyle {
  General = 'general',
  Formal = 'formal',
  Casual = 'casual',
  Friendly = 'friendly',
  Humorous = 'humorous',
  Polite = 'polite',
  Firm = 'firm',
  Concise = 'concise',
  Motivational = 'motivational',
  Neutral = 'neutral',
  Professional = 'professional'
}
```

### 应用状态

```javascript
// core/state/AppState.js
interface AppState {
  accounts: AccountsState;
  ui: UIState;
  translation: TranslationState;
  plugins: PluginsState;
  config: ConfigState;
}

interface AccountsState {
  items: Record<string, Account>;
  activeId: string | null;
  loading: boolean;
  error: string | null;
}

interface UIState {
  sidebarWidth: number;
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: Notification[];
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Configuration Round-Trip Consistency
*For any* valid configuration object, serializing it to string and then deserializing should produce an equivalent configuration object.
**Validates: Requirements 1.5, 5.6**

### Property 2: Plugin Interface Validation
*For any* object that does not implement the required IPlugin interface (missing name, version, initialize, or destroy), registering it as a plugin should fail with a validation error describing the missing members.
**Validates: Requirements 2.2**

### Property 3: Plugin Dependency Order
*For any* set of plugins with declared dependencies, the initialization order should be a valid topological sort where each plugin is initialized only after all its dependencies have been initialized.
**Validates: Requirements 2.3**

### Property 4: Plugin Error Isolation
*For any* set of plugins where one or more throw errors during initialization, all non-throwing plugins should still be successfully initialized and the system should remain operational.
**Validates: Requirements 2.4**

### Property 5: Plugin Resource Cleanup
*For any* enabled plugin, disabling it should result in its destroy method being called and the plugin being removed from the active plugins list.
**Validates: Requirements 2.6**

### Property 6: Event Delivery Completeness
*For any* event and set of N subscribers, publishing the event should result in exactly N subscriber callbacks being invoked with the correct payload.
**Validates: Requirements 3.2**

### Property 7: Event Payload Validation
*For any* typed event with a defined schema, publishing a payload that does not conform to the schema should result in a validation error before any subscribers are notified.
**Validates: Requirements 3.3**

### Property 8: Subscriber Error Isolation
*For any* set of subscribers where one throws an error, all other subscribers should still receive the event and the error should be logged.
**Validates: Requirements 3.4**

### Property 9: Event History Retention
*For any* published event within the retention period, it should be retrievable from the event history with correct payload and timestamp.
**Validates: Requirements 3.5**

### Property 10: Subscription Cleanup
*For any* subscription, calling the returned unsubscribe function should remove the subscriber such that subsequent events are not delivered to it.
**Validates: Requirements 3.6**

### Property 11: Unit of Work Atomicity
*For any* unit of work containing multiple repository operations, either all operations should succeed and be persisted, or all should be rolled back leaving the data unchanged.
**Validates: Requirements 4.3**

### Property 12: Validation Error Detail
*For any* invalid data submitted to a repository, the validation error should contain field-level details identifying which fields failed and why.
**Validates: Requirements 4.4**

### Property 13: Migration Rollback
*For any* data migration, applying the migration and then rolling it back should restore the data to its original state.
**Validates: Requirements 4.5**

### Property 14: Data Model Round-Trip
*For any* data model entity (Account, ProxyConfig, TranslationConfig), converting to JSON and back should produce an equivalent entity.
**Validates: Requirements 4.6**

### Property 15: Config Schema Validation
*For any* configuration that does not conform to the defined schema, loading should fail with validation errors identifying the non-conforming fields.
**Validates: Requirements 5.2**

### Property 16: Config Inheritance Override
*For any* base configuration and environment-specific override, the merged configuration should have override values taking precedence over base values for overlapping keys.
**Validates: Requirements 5.3**

### Property 17: Config Change Notification
*For any* configuration change and set of registered listeners, all listeners should be notified with both the old and new values.
**Validates: Requirements 5.4**

### Property 18: Sensitive Config Encryption
*For any* sensitive configuration value (API keys, passwords), the value stored at rest should be encrypted and decrypting it should return the original value.
**Validates: Requirements 5.5**

### Property 19: Error Context Preservation
*For any* error that occurs, wrapping it in an AppError should preserve the original error message and stack trace while adding context information.
**Validates: Requirements 6.2**

### Property 20: Error Recovery Execution
*For any* recoverable error with a registered recovery strategy, the recovery strategy should be executed and its result should indicate success or failure.
**Validates: Requirements 6.3**

### Property 21: Error Logging Completeness
*For any* error handled by the error handler, a log entry should be created containing the error type, message, stack trace, and context metadata.
**Validates: Requirements 6.5**

### Property 22: Error Message Localization
*For any* error and supported locale, the user-facing message should be in the correct language and should not expose technical details.
**Validates: Requirements 6.6**

### Property 23: Service Scope Behavior
*For any* service registered as singleton, all resolutions should return the same instance. For transient services, each resolution should return a new instance.
**Validates: Requirements 7.1**

### Property 24: Circular Dependency Detection
*For any* service dependency graph containing a cycle, attempting to resolve any service in the cycle should throw an error describing the circular dependency path.
**Validates: Requirements 7.2**

### Property 25: Lazy Service Initialization
*For any* service registered as lazy, the factory function should not be called until the service is first resolved.
**Validates: Requirements 7.3**

### Property 26: Service Not Found Error
*For any* attempt to resolve a non-existent service, the error message should include the requested service name and a list of similar available services.
**Validates: Requirements 7.4**

### Property 27: Service Decoration
*For any* service with registered decorators, resolving the service should return an instance with all decorators applied in registration order.
**Validates: Requirements 7.5**

### Property 28: Service Interface Validation
*For any* service registration with a required interface, if the service does not implement the interface, registration should fail with details about missing members.
**Validates: Requirements 7.6**

### Property 29: IPC Payload Validation
*For any* IPC request with a defined schema, if the payload does not conform to the schema, the request should be rejected with a validation error before the handler is invoked.
**Validates: Requirements 8.2**

### Property 30: IPC Timeout Handling
*For any* IPC request with a timeout, if the handler does not respond within the timeout period, the request should fail with a timeout error.
**Validates: Requirements 8.3**

### Property 31: IPC Error Response
*For any* IPC handler that throws an error, the response should contain a structured error object with error code, message, and context.
**Validates: Requirements 8.4**

### Property 32: IPC Batch Processing
*For any* batch of IPC requests, all requests should be processed and responses should be returned in the same order as the requests.
**Validates: Requirements 8.5**

### Property 33: State Change Notification
*For any* state change and set of observers, all observers should be notified with the new state value.
**Validates: Requirements 9.2**

### Property 34: State Persistence Round-Trip
*For any* application state, persisting and then restoring should produce equivalent state.
**Validates: Requirements 9.3**

### Property 35: State Corruption Handling
*For any* corrupted state data, restoration should fail gracefully with an error and should not crash the application or leave the state in an inconsistent state.
**Validates: Requirements 9.4**

### Property 36: State Snapshot Accuracy
*For any* sequence of state changes, each snapshot should accurately capture the state at that point in time.
**Validates: Requirements 9.5**

### Property 37: State Serialization Round-Trip
*For any* application state, serializing and deserializing should produce equivalent state.
**Validates: Requirements 9.6**

### Property 38: Test Environment Isolation
*For any* test, state changes made during the test should not affect other tests running in the same test suite.
**Validates: Requirements 10.2**

### Property 39: Test Failure Context
*For any* failing test, the failure report should include the input data that caused the failure and a comparison of expected vs actual results.
**Validates: Requirements 10.4**

## Error Handling

### Error Types Hierarchy

```
AppError (base)
├── ValidationError
│   ├── SchemaValidationError
│   ├── FieldValidationError
│   └── TypeValidationError
├── NetworkError
│   ├── ConnectionError
│   ├── TimeoutError
│   └── ProxyError
├── StorageError
│   ├── ReadError
│   ├── WriteError
│   └── MigrationError
├── PluginError
│   ├── PluginLoadError
│   ├── PluginInitError
│   └── PluginRuntimeError
├── IPCError
│   ├── IPCTimeoutError
│   ├── IPCValidationError
│   └── IPCHandlerError
└── StateError
    ├── StateCorruptionError
    └── StatePersistenceError
```

### Error Recovery Strategies

| Error Type | Recovery Strategy |
|------------|-------------------|
| NetworkError | Retry with exponential backoff |
| StorageError (Read) | Use cached data or default values |
| StorageError (Write) | Queue for retry, notify user |
| PluginError | Disable plugin, continue operation |
| StateCorruptionError | Reset to default state, notify user |

### Error Logging Format

```javascript
{
  timestamp: ISO8601,
  level: 'error' | 'warn' | 'info',
  errorType: string,
  errorCode: string,
  message: string,
  stack: string,
  context: {
    component: string,
    operation: string,
    userId?: string,
    accountId?: string,
    ...additionalContext
  },
  recoverable: boolean,
  recovered: boolean
}
```

## Testing Strategy

### Dual Testing Approach

本项目采用单元测试和属性测试相结合的测试策略：

- **单元测试**: 验证具体示例、边界情况和错误条件
- **属性测试**: 验证应在所有输入上成立的通用属性

### Property-Based Testing Framework

使用 **fast-check** 作为属性测试库（已在package.json中配置）。

### Test Organization

```
src/
├── __tests__/                    # 集成测试
│   ├── integration/
│   └── e2e/
├── core/
│   ├── eventbus/
│   │   ├── EventBus.js
│   │   └── __tests__/
│   │       ├── EventBus.test.js           # 单元测试
│   │       └── EventBus.property.test.js  # 属性测试
│   ├── container/
│   │   ├── DependencyContainer.js
│   │   └── __tests__/
│   │       ├── DependencyContainer.test.js
│   │       └── DependencyContainer.property.test.js
│   └── ...
├── domain/
│   ├── entities/
│   │   └── __tests__/
│   │       ├── Account.test.js
│   │       └── Account.property.test.js
│   └── ...
└── infrastructure/
    └── plugins/
        └── __tests__/
            ├── PluginManager.test.js
            └── PluginManager.property.test.js
```

### Property Test Annotation Format

每个属性测试必须使用以下格式注释：

```javascript
/**
 * **Feature: architecture-refactoring, Property 1: Configuration Round-Trip Consistency**
 * **Validates: Requirements 1.5, 5.6**
 */
test('configuration round-trip preserves data', () => {
  fc.assert(
    fc.property(configArbitrary, (config) => {
      const serialized = ConfigProvider.serialize(config);
      const deserialized = ConfigProvider.deserialize(serialized);
      return deepEqual(config, deserialized);
    }),
    { numRuns: 100 }
  );
});
```

### Test Generators (Arbitraries)

```javascript
// test/arbitraries/index.js

// Account arbitrary
const accountArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  status: fc.constantFrom('inactive', 'loading', 'active', 'error'),
  autoStart: fc.boolean(),
  createdAt: fc.date(),
  proxy: fc.option(proxyConfigArbitrary),
  translation: fc.option(translationConfigArbitrary)
});

// ProxyConfig arbitrary
const proxyConfigArbitrary = fc.record({
  enabled: fc.boolean(),
  protocol: fc.constantFrom('http', 'https', 'socks5'),
  host: fc.domain(),
  port: fc.integer({ min: 1, max: 65535 }),
  username: fc.option(fc.string()),
  password: fc.option(fc.string())
});

// Event arbitrary
const eventArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  payload: fc.anything()
});

// Plugin arbitrary
const pluginArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  version: fc.string().filter(s => /^\d+\.\d+\.\d+$/.test(s)),
  dependencies: fc.array(fc.string(), { maxLength: 5 })
});
```

### Mock Implementations

```javascript
// test/mocks/ElectronMock.js
class ElectronMock {
  app = {
    getPath: (name) => `/mock/path/${name}`,
    getVersion: () => '1.0.0',
    quit: jest.fn(),
    whenReady: () => Promise.resolve()
  };
  
  ipcMain = {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn()
  };
  
  BrowserWindow = jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    webContents: { send: jest.fn() },
    on: jest.fn(),
    close: jest.fn()
  }));
}

// test/mocks/StorageMock.js
class StorageMock {
  constructor() {
    this.data = new Map();
  }
  
  async read(key) {
    return this.data.get(key);
  }
  
  async write(key, value) {
    this.data.set(key, value);
  }
  
  async delete(key) {
    this.data.delete(key);
  }
  
  clear() {
    this.data.clear();
  }
}
```

### Test Coverage Requirements

- 语句覆盖率: ≥ 80%
- 分支覆盖率: ≥ 75%
- 函数覆盖率: ≥ 85%
- 属性测试: 每个属性至少100次迭代


## 翻译模块设计

### 翻译引擎适配器接口

```javascript
// infrastructure/translation/adapters/ITranslationAdapter.js
interface ITranslationAdapter {
  name: string;
  supportedLanguages: string[];
  supportsStyle: boolean;
  
  translate(request: TranslationRequest): Promise<TranslationResult>;
  detectLanguage(text: string): Promise<string>;
  validateConfig(config: EngineConfig): ValidationResult;
  getUsageStats(): UsageStats;
}

interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  style?: TranslationStyle;
  context?: TranslationContext;
}

interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
  confidence?: number;
  tokensUsed?: number;
  cached: boolean;
}
```

### 翻译服务

```javascript
// application/services/TranslationService.js
interface ITranslationService {
  // 消息翻译（聊天窗口）
  translateMessage(message: string, config: TranslationConfig): Promise<TranslationResult>;
  
  // 输入框翻译（发送前）
  translateInput(text: string, config: TranslationConfig, style?: TranslationStyle): Promise<TranslationResult>;
  
  // 好友独立配置
  getFriendConfig(accountId: string, friendId: string): FriendTranslationConfig;
  setFriendConfig(accountId: string, friendId: string, config: FriendTranslationConfig): Promise<void>;
  
  // 引擎管理
  getAvailableEngines(): TranslationEngine[];
  setEngine(engineName: string, config: EngineConfig): Promise<void>;
  testEngine(engineName: string): Promise<TestResult>;
}
```

### 翻译风格枚举

```javascript
// domain/entities/TranslationStyle.js
const TranslationStyle = {
  GENERAL: 'general',      // 通用
  FORMAL: 'formal',        // 正式
  CASUAL: 'casual',        // 口语化
  FRIENDLY: 'friendly',    // 亲切
  HUMOROUS: 'humorous',    // 幽默
  POLITE: 'polite',        // 礼貌
  FIRM: 'firm',            // 强硬
  CONCISE: 'concise',      // 简洁
  MOTIVATIONAL: 'motivational', // 激励
  NEUTRAL: 'neutral',      // 中立
  PROFESSIONAL: 'professional'  // 专业
};
```

## 代理模块设计（完全重写 - 企业级IP安全防护）

### 设计参考

参考市面上顶级指纹浏览器（AdsPower、Multilogin、GoLogin、VMLogin）的代理安全设计，采用**零信任网络模型**。

### 核心安全原则

1. **零信任网络** - 假设任何网络请求都可能泄露IP，必须经过验证
2. **禁止回退直连** - 代理失败时阻断所有网络请求，绝不暴露真实IP
3. **多层防护** - 不依赖单一防护机制，WebRTC/DNS/WebSocket/HTTP Header全面防护
4. **连接前验证** - 在创建BrowserView之前必须验证代理可用且IP正确
5. **实时监控** - 持续监控代理状态，异常时毫秒级响应
6. **Kill-Switch机制** - 代理断开时立即阻断所有网络活动

### IP泄露的常见途径（必须全部阻断）

| 泄露途径 | 风险等级 | 防护措施 |
|---------|---------|---------|
| WebRTC STUN/TURN | 🔴 高 | 完全禁用RTCPeerConnection |
| DNS请求 | 🔴 高 | 强制DNS通过代理 |
| WebSocket直连 | 🟡 中 | 审计并拦截非代理WebSocket |
| HTTP X-Forwarded-For | 🟡 中 | 移除泄露IP的HTTP头 |
| navigator.connection | 🟢 低 | 覆盖返回undefined |
| 代理失败回退 | 🔴 高 | Kill-Switch阻断 |

### 安全连接流程（核心流程）

```
┌─────────────────────────────────────────────────────────────────┐
│                    安全连接流程 (secureConnect)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 验证代理配置                                                 │
│     ├── 检查必填字段（host, port, protocol）                     │
│     ├── 验证端口范围（1-65535）                                  │
│     └── 验证协议类型（http/https/socks5）                        │
│                           ↓                                     │
│  2. 代理预检测（连接前验证）                                      │
│     ├── 测试代理连通性                                           │
│     ├── 测量延迟（超时3秒）                                      │
│     └── 获取代理出口IP                                           │
│                           ↓                                     │
│  3. IP一致性验证                                                 │
│     ├── 多源IP检测（ipinfo.io, ip-api.com）                      │
│     ├── 验证出口IP与预期一致                                     │
│     └── 检测是否为数据中心IP（可选告警）                          │
│                           ↓                                     │
│  4. 创建隔离Session                                              │
│     ├── 为账号创建独立Session                                    │
│     ├── 配置代理规则                                             │
│     └── 设置代理认证（如需要）                                   │
│                           ↓                                     │
│  5. 启用安全防护                                                 │
│     ├── 启用Kill-Switch                                         │
│     ├── 配置网络请求拦截                                         │
│     └── 阻止直连请求                                             │
│                           ↓                                     │
│  6. 创建BrowserView                                              │
│     ├── 注入IP保护脚本（禁用WebRTC等）                           │
│     ├── 配置DNS防泄露                                            │
│     └── 启动健康监控                                             │
│                           ↓                                     │
│  7. 持续监控                                                     │
│     ├── 定期健康检查（30秒）                                     │
│     ├── 延迟监控                                                 │
│     └── 异常时触发Kill-Switch                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Kill-Switch机制详解

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kill-Switch 触发条件                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  触发条件：                                                      │
│  ├── 代理连接断开                                                │
│  ├── 连续3次健康检查失败                                         │
│  ├── 检测到IP泄露                                                │
│  ├── 出口IP与预期不一致                                          │
│  └── 代理认证失败                                                │
│                                                                 │
│  触发动作（毫秒级响应）：                                         │
│  ├── 1. 立即阻断所有网络请求                                     │
│  ├── 2. 暂停BrowserView加载                                      │
│  ├── 3. 清除待发送的网络请求队列                                 │
│  ├── 4. 发送事件通知UI                                           │
│  ├── 5. 记录审计日志                                             │
│  └── 6. 等待用户处理（重试/更换代理/取消）                        │
│                                                                 │
│  恢复条件：                                                      │
│  ├── 用户手动重试且代理恢复正常                                  │
│  └── 用户更换代理且新代理验证通过                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 代理安全管理器

```javascript
// infrastructure/proxy/ProxySecurityManager.js
interface IProxySecurityManager {
  // 安全策略
  enforceProxyOnly(session: Electron.Session): void;
  disableWebRTC(webContents: WebContents): Promise<void>;
  preventDNSLeak(session: Electron.Session): void;
  blockDirectConnections(session: Electron.Session): void;
  
  // IP验证
  verifyExitIP(expectedIP: string): Promise<IPVerificationResult>;
  detectIPLeak(): Promise<IPLeakDetectionResult>;
  
  // Kill-Switch
  enableKillSwitch(accountId: string): void;
  triggerKillSwitch(accountId: string, reason: string): Promise<void>;
  
  // 审计
  logNetworkRequest(request: NetworkRequest): void;
  getAuditLog(accountId: string): NetworkAuditLog[];
}

interface IPVerificationResult {
  verified: boolean;
  actualIP: string;
  expectedIP: string;
  location?: string;
  mismatchReason?: string;
}

interface IPLeakDetectionResult {
  leaked: boolean;
  leakSources: LeakSource[];
  recommendations: string[];
}

type LeakSource = 'webrtc' | 'dns' | 'websocket' | 'http_header' | 'browser_api';
```

### 代理连接管理器

```javascript
// infrastructure/proxy/ProxyConnectionManager.js
interface IProxyConnectionManager {
  // 连接管理
  connect(config: ProxyConfig): Promise<ConnectionResult>;
  disconnect(accountId: string): Promise<void>;
  reconnect(accountId: string): Promise<ConnectionResult>;
  
  // 连接状态
  getConnectionStatus(accountId: string): ConnectionStatus;
  isConnected(accountId: string): boolean;
  
  // 失败处理（禁止回退）
  handleConnectionFailure(accountId: string, error: ProxyError): Promise<FailureHandlingResult>;
  
  // 重试策略
  setRetryPolicy(policy: RetryPolicy): void;
  retryConnection(accountId: string): Promise<ConnectionResult>;
}

interface ConnectionResult {
  success: boolean;
  accountId: string;
  proxyIP?: string;
  latency?: number;
  error?: ProxyConnectionError;
  // 重要：失败时不会回退到直连
  fallbackBlocked: boolean;
}

interface ConnectionStatus {
  connected: boolean;
  proxyIP: string | null;
  latency: number;
  lastCheck: Date;
  failureCount: number;
  // Kill-Switch状态
  killSwitchActive: boolean;
}

// 代理连接错误类型
enum ProxyConnectionErrorType {
  AUTHENTICATION_FAILED = 'auth_failed',
  CONNECTION_REFUSED = 'connection_refused',
  CONNECTION_TIMEOUT = 'connection_timeout',
  PROXY_UNREACHABLE = 'proxy_unreachable',
  INVALID_RESPONSE = 'invalid_response',
  SSL_ERROR = 'ssl_error',
  DNS_RESOLUTION_FAILED = 'dns_failed'
}
```

### 代理健康监控器

```javascript
// infrastructure/proxy/ProxyHealthMonitor.js
interface IProxyHealthMonitor {
  // 健康检查
  startMonitoring(accountId: string, config: ProxyConfig): void;
  stopMonitoring(accountId: string): void;
  checkHealth(accountId: string): Promise<HealthCheckResult>;
  
  // 配置
  setCheckInterval(intervalMs: number): void;
  setLatencyThreshold(thresholdMs: number): void;
  setFailureThreshold(count: number): void;
  
  // 统计
  getHealthStats(accountId: string): ProxyHealthStats;
  
  // 事件
  onHealthCheckFailed(callback: (accountId: string, result: HealthCheckResult) => void): void;
  onLatencyWarning(callback: (accountId: string, latency: number) => void): void;
  onProxyUnstable(callback: (accountId: string, stats: ProxyHealthStats) => void): void;
}

interface HealthCheckResult {
  healthy: boolean;
  latency: number;
  exitIP: string;
  timestamp: Date;
  error?: string;
}

interface ProxyHealthStats {
  uptime: number;           // 百分比
  averageLatency: number;   // 毫秒
  failureCount: number;
  lastFailure?: Date;
  consecutiveFailures: number;
  totalChecks: number;
}
```

### 代理服务接口（增强版）

```javascript
// application/services/ProxyService.js
interface IProxyService {
  // 代理配置
  getProxyConfig(accountId: string): Promise<ProxyConfig | null>;
  setProxyConfig(accountId: string, config: ProxyConfig): Promise<void>;
  validateProxyConfig(config: ProxyConfig): ValidationResult;
  
  // 安全连接（核心方法）
  secureConnect(accountId: string, config: ProxyConfig): Promise<SecureConnectionResult>;
  secureDisconnect(accountId: string): Promise<void>;
  
  // 代理测试
  testProxy(config: ProxyConfig): Promise<ProxyTestResult>;
  testCurrentNetwork(): Promise<NetworkInfo>;
  verifyNoIPLeak(accountId: string): Promise<IPLeakDetectionResult>;
  
  // 智能填写
  parseProxyString(input: string): ProxyConfig | null;
  
  // 代理列表
  getProxyList(): Promise<ProxyConfig[]>;
  addProxy(config: ProxyConfig): Promise<void>;
  removeProxy(proxyId: string): Promise<void>;
  
  // 健康监控
  getHealthStatus(accountId: string): ProxyHealthStats;
  
  // Kill-Switch
  isKillSwitchActive(accountId: string): boolean;
  resetKillSwitch(accountId: string): Promise<void>;
}

interface SecureConnectionResult {
  success: boolean;
  accountId: string;
  proxyIP: string;
  verifiedNoLeak: boolean;
  webrtcDisabled: boolean;
  dnsLeakPrevented: boolean;
  killSwitchEnabled: boolean;
  error?: ProxyConnectionError;
}

interface ProxyTestResult {
  success: boolean;
  latency?: number;
  ip?: string;
  location?: string;
  error?: string;
  // 安全检查结果
  securityCheck: {
    webrtcBlocked: boolean;
    dnsSecure: boolean;
    noDirectConnection: boolean;
  };
}

interface NetworkInfo {
  ip: string;
  location?: string;
  isp?: string;
  isProxy: boolean;
  // 警告：如果isProxy为false，说明可能存在IP泄露
  leakWarning?: string;
}
```

### 代理连接失败场景处理矩阵

以下是所有可能的代理连接失败场景及其处理方式：

**核心策略原则**：
1. **打开WhatsApp前失败** → 禁止创建视图，显示警告提示
2. **WhatsApp已打开后失败** → 保持视图，禁止网络连接，提供重连机制，静默处理
3. **只在网络真正无法连接时才显示警告**，避免影响用户体验

#### 场景1：打开WhatsApp前的代理失败（连接前失败）

| 场景 | 错误类型 | 触发时机 | 处理方式 | 用户提示 | 用户操作 |
|-----|---------|---------|---------|---------|---------|
| 代理配置无效 | `INVALID_CONFIG` | secureConnect()验证阶段 | ❌ 禁止创建视图 | ⚠️ "代理配置无效：[具体原因]" | 修改配置后重试 |
| 代理服务器不可达 | `PROXY_UNREACHABLE` | 预检测阶段 | ❌ 禁止创建视图 | ⚠️ "无法连接到代理服务器" | 检查代理地址 |
| 代理连接超时 | `CONNECTION_TIMEOUT` | 预检测阶段（3秒） | ❌ 禁止创建视图 | ⚠️ "代理连接超时" | 检查网络或更换代理 |
| 代理认证失败 | `AUTHENTICATION_FAILED` | 预检测阶段 | ❌ 禁止创建视图 | ⚠️ "代理认证失败" | 检查用户名密码 |
| IP验证失败 | `IP_VERIFICATION_FAILED` | IP验证阶段 | ❌ 禁止创建视图 | ⚠️ "代理IP验证失败" | 更换代理或跳过验证 |

**处理流程**：
```
用户点击打开账号
    ↓
验证代理配置
    ↓
预检测代理连接 ──失败──▶ ❌ 不创建BrowserView
    ↓成功                  ⚠️ 显示错误提示
验证出口IP                 提供重试/修改配置选项
    ↓成功
✅ 创建BrowserView
启动健康监控
```

#### 场景2：WhatsApp已打开后的代理失败（运行中失败）

| 场景 | 错误类型 | 触发时机 | 处理方式 | 视图状态 | 网络状态 | 用户提示 | 重连机制 |
|-----|---------|---------|---------|---------|---------|---------|---------|
| 代理连接断开 | `CONNECTION_LOST` | 健康监控检测 | 触发Kill-Switch | ✅ 保持视图 | ❌ 禁止网络 | 🔇 静默 + 重连按钮 | 自动重试3次 |
| 连续健康检查失败 | `HEALTH_CHECK_FAILED` | 连续3次失败 | 触发Kill-Switch | ✅ 保持视图 | ❌ 禁止网络 | 🔇 静默 + 重连按钮 | 自动重试3次 |
| 检测到IP泄露 | `IP_LEAK_DETECTED` | 定期IP验证 | 触发Kill-Switch | ✅ 保持视图 | ❌ 禁止网络 | 🔇 静默 + 重连按钮 | 手动重连 |
| 出口IP变化 | `IP_CHANGED` | 定期IP验证 | 触发Kill-Switch | ✅ 保持视图 | ❌ 禁止网络 | 🔇 静默 + 重连按钮 | 手动重连 |
| 延迟过高 | `HIGH_LATENCY` | 健康监控 | 继续运行 | ✅ 保持视图 | ✅ 允许网络 | 🔇 静默 | 无需重连 |
| 页面加载失败 | `PROXY_FAILED` | 页面加载错误 | 触发Kill-Switch | ✅ 保持视图 | ❌ 禁止网络 | 🔇 静默 + 重连按钮 | 自动重试3次 |
| 渲染进程崩溃 | `RENDER_CRASHED` | 进程崩溃 | 触发Kill-Switch | ✅ 保持视图 | ❌ 禁止网络 | 🔇 静默 + 重连按钮 | 手动重连 |

**处理流程**：
```
代理连接失败（运行中）
    ↓
触发Kill-Switch
    ├─ ✅ 保持BrowserView（不关闭）
    ├─ ❌ 禁止所有网络请求
    ├─ 🔇 静默处理（不弹窗）
    └─ 📝 记录日志
    ↓
显示重连UI（在视图内）
    ├─ 🔄 重连按钮
    ├─ 🔀 更换代理按钮
    └─ ❌ 关闭会话按钮
    ↓
自动重连机制（可选）
    ├─ 第1次：等待2秒后重试
    ├─ 第2次：等待3秒后重试
    ├─ 第3次：等待5秒后重试
    └─ 失败后：等待用户手动操作
```

#### 场景3：其他需要考虑的失败场景

| 场景 | 错误类型 | 触发时机 | 处理方式 | 说明 |
|-----|---------|---------|---------|------|
| 代理服务器维护 | `PROXY_MAINTENANCE` | 健康检查 | 自动切换备用代理 | 如果配置了备用代理列表 |
| 代理流量耗尽 | `QUOTA_EXCEEDED` | API响应 | 暂停会话，提示用户 | 需要用户充值或更换代理 |
| 代理被封禁 | `PROXY_BANNED` | 连接被拒绝 | 暂停会话，提示更换 | WhatsApp可能封禁了该代理IP |
| 网络环境切换 | `NETWORK_CHANGED` | 系统网络变化 | 重新验证代理 | 用户从WiFi切换到移动网络 |
| 系统代理冲突 | `SYSTEM_PROXY_CONFLICT` | 启动时检测 | 警告用户 | 系统级代理可能影响应用代理 |

**图例说明**：
- ⚠️ = 显示警告提示（仅在打开前失败）
- 🔇 = 静默处理（运行中失败，不弹窗）
- ✅ = 保持/允许
- ❌ = 禁止/阻止
- 🔄 = 自动重连
- 📝 = 记录日志

### 重连机制设计

#### 自动重连策略

```javascript
// infrastructure/proxy/ProxyReconnectionManager.js
interface IProxyReconnectionManager {
  // 启动自动重连
  startAutoReconnect(accountId: string, config: ReconnectionConfig): void;
  
  // 停止自动重连
  stopAutoReconnect(accountId: string): void;
  
  // 手动重连
  manualReconnect(accountId: string): Promise<ReconnectionResult>;
  
  // 获取重连状态
  getReconnectionStatus(accountId: string): ReconnectionStatus;
  
  // 事件
  onReconnecting(callback: (accountId: string, attempt: number) => void): void;
  onReconnected(callback: (accountId: string) => void): void;
  onReconnectionFailed(callback: (accountId: string, error: Error) => void): void;
}

interface ReconnectionConfig {
  maxAttempts: number;        // 最大重试次数，默认3次
  initialDelay: number;       // 初始延迟，默认2秒
  backoffMultiplier: number;  // 退避倍数，默认1.5
  maxDelay: number;           // 最大延迟，默认10秒
  autoReconnect: boolean;     // 是否自动重连，默认true
}

interface ReconnectionStatus {
  isReconnecting: boolean;
  currentAttempt: number;
  maxAttempts: number;
  nextRetryIn: number;        // 毫秒
  lastError?: string;
}

interface ReconnectionResult {
  success: boolean;
  attemptsMade: number;
  finalError?: Error;
  proxyIP?: string;
}
```

#### 重连流程详解

```
┌─────────────────────────────────────────────────────────────────┐
│                    自动重连流程                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  检测到代理失败                                                  │
│      ↓                                                          │
│  触发Kill-Switch                                                │
│      ├─ 禁止网络请求                                            │
│      ├─ 保持视图显示                                            │
│      └─ 显示重连UI                                              │
│      ↓                                                          │
│  启动自动重连（如果启用）                                        │
│      ↓                                                          │
│  ┌─────────────────────────────────┐                           │
│  │ 第1次重试（2秒后）               │                           │
│  │  ├─ 验证代理配置                 │                           │
│  │  ├─ 测试代理连接                 │                           │
│  │  └─ 验证出口IP                   │                           │
│  └─────────────────────────────────┘                           │
│      ↓ 失败                                                     │
│  ┌─────────────────────────────────┐                           │
│  │ 第2次重试（3秒后）               │                           │
│  │  ├─ 验证代理配置                 │                           │
│  │  ├─ 测试代理连接                 │                           │
│  │  └─ 验证出口IP                   │                           │
│  └─────────────────────────────────┘                           │
│      ↓ 失败                                                     │
│  ┌─────────────────────────────────┐                           │
│  │ 第3次重试（5秒后）               │                           │
│  │  ├─ 验证代理配置                 │                           │
│  │  ├─ 测试代理连接                 │                           │
│  │  └─ 验证出口IP                   │                           │
│  └─────────────────────────────────┘                           │
│      ↓ 失败                                                     │
│  停止自动重连                                                    │
│      ├─ 保持Kill-Switch激活                                     │
│      ├─ 保持视图显示                                            │
│      └─ 等待用户手动操作                                        │
│                                                                 │
│  任意重试成功 ──▶ 恢复连接                                       │
│      ├─ 解除Kill-Switch                                         │
│      ├─ 恢复网络请求                                            │
│      ├─ 刷新页面                                                │
│      └─ 重启健康监控                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 重连UI设计（在BrowserView内显示）

**场景A：自动重连中**
```
┌─────────────────────────────────────────────────────────────────┐
│                    🔄 正在重连代理...                            │
│                                                                 │
│  代理连接已断开，正在尝试重新连接                                │
│                                                                 │
│  重试进度：第 2/3 次                                             │
│  [████████░░░░░░░░░░] 下次重试：3秒后                           │
│                                                                 │
│  [⏸️ 停止重连]  [🔀 更换代理]  [❌ 关闭会话]                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**场景B：自动重连失败，等待用户操作**
```
┌─────────────────────────────────────────────────────────────────┐
│                    ⚠️ 代理连接失败                               │
│                                                                 │
│  已尝试3次重连，但代理仍然无法连接                                │
│  您的会话已暂停以保护您的真实IP                                  │
│                                                                 │
│  请选择操作：                                                    │
│                                                                 │
│  [🔄 手动重试]  - 再次尝试连接当前代理                           │
│  [🔀 更换代理]  - 选择其他代理服务器                             │
│  [❌ 关闭会话]  - 关闭此账号的会话                               │
│                                                                 │
│  💡 提示：检查代理服务器状态或更换其他代理                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**场景C：重连成功**
```
┌─────────────────────────────────────────────────────────────────┐
│                    ✅ 代理已重新连接                             │
│                                                                 │
│  代理连接已恢复，正在加载WhatsApp...                             │
│                                                                 │
│  [自动消失，3秒后]                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 补充场景：其他需要考虑的情况

#### 1. 多账号同时使用同一代理

**场景**：用户配置多个账号使用同一个代理服务器

**问题**：
- 一个账号检测到代理失败，其他账号是否也应该暂停？
- 代理恢复后，如何协调多个账号的重连？

**解决方案**：
```javascript
// infrastructure/proxy/SharedProxyManager.js
interface ISharedProxyManager {
  // 注册账号使用的代理
  registerProxyUsage(accountId: string, proxyId: string): void;
  
  // 获取使用同一代理的所有账号
  getAccountsByProxy(proxyId: string): string[];
  
  // 代理失败时通知所有使用该代理的账号
  notifyProxyFailure(proxyId: string, error: ProxyError): void;
  
  // 代理恢复时通知所有账号
  notifyProxyRecovery(proxyId: string): void;
}
```

**处理策略**：
- 当一个账号检测到代理失败时，**不立即影响其他账号**
- 每个账号独立进行健康检查和重连
- 如果多个账号同时检测到同一代理失败，共享重连状态，避免重复测试

#### 2. 代理切换过程中的状态管理

**场景**：用户在运行中更换代理配置

**问题**：
- 如何平滑切换到新代理？
- 切换过程中如何保护IP不泄露？
- 切换失败如何回滚？

**解决方案**：
```javascript
// infrastructure/proxy/ProxySwitchManager.js
interface IProxySwitchManager {
  // 平滑切换代理
  switchProxy(accountId: string, newConfig: ProxyConfig): Promise<SwitchResult>;
  
  // 切换流程：
  // 1. 验证新代理配置
  // 2. 测试新代理连接
  // 3. 触发Kill-Switch（暂停当前会话）
  // 4. 应用新代理配置
  // 5. 重新连接
  // 6. 成功后解除Kill-Switch
  // 7. 失败则回滚到旧配置
}

interface SwitchResult {
  success: boolean;
  oldProxyIP?: string;
  newProxyIP?: string;
  rolledBack: boolean;
  error?: Error;
}
```

#### 3. 代理认证信息过期

**场景**：代理需要定期更新认证信息（如临时密码、Token）

**问题**：
- 如何检测认证过期？
- 如何提示用户更新认证信息？
- 更新过程中如何保持会话？

**解决方案**：
```javascript
// domain/entities/ProxyAuth.js
interface ProxyAuth {
  type: 'basic' | 'token' | 'oauth';
  credentials: string;
  expiresAt?: Date;
  refreshToken?: string;
}

// infrastructure/proxy/ProxyAuthManager.js
interface IProxyAuthManager {
  // 检查认证是否过期
  isAuthExpired(proxyId: string): boolean;
  
  // 刷新认证信息
  refreshAuth(proxyId: string): Promise<ProxyAuth>;
  
  // 提示用户更新认证
  promptAuthUpdate(accountId: string): void;
}
```

**处理策略**：
- 在连接前检查认证是否即将过期（提前5分钟）
- 如果支持自动刷新（如OAuth），自动更新Token
- 如果需要用户输入，显示更新提示但不中断当前会话
- 认证完全过期后才触发Kill-Switch

#### 4. 网络环境变化检测

**场景**：用户设备网络环境变化（WiFi ↔ 移动网络）

**问题**：
- 网络切换可能导致代理连接中断
- 如何快速检测并恢复？

**解决方案**：
```javascript
// infrastructure/proxy/NetworkChangeDetector.js
interface INetworkChangeDetector {
  // 监听网络变化
  startMonitoring(): void;
  
  // 网络变化事件
  onNetworkChanged(callback: (info: NetworkInfo) => void): void;
  
  // 处理网络变化
  handleNetworkChange(accountId: string): Promise<void>;
  // 流程：
  // 1. 检测到网络变化
  // 2. 暂停健康检查（避免误报）
  // 3. 等待2秒（网络稳定）
  // 4. 重新验证代理连接
  // 5. 恢复健康检查
}
```

#### 5. 代理服务器负载均衡

**场景**：用户配置了多个备用代理

**问题**：
- 主代理失败时如何自动切换到备用代理？
- 如何选择最优的备用代理？

**解决方案**：
```javascript
// infrastructure/proxy/ProxyLoadBalancer.js
interface IProxyLoadBalancer {
  // 配置代理池
  setProxyPool(accountId: string, proxies: ProxyConfig[]): void;
  
  // 获取最优代理
  getBestProxy(accountId: string): Promise<ProxyConfig>;
  
  // 故障转移
  failover(accountId: string, failedProxyId: string): Promise<ProxyConfig>;
  
  // 选择策略：
  // 1. 延迟最低
  // 2. 成功率最高
  // 3. 最近使用时间
}
```

**处理策略**：
- 主代理失败后，自动尝试备用代理列表
- 每次重连尝试使用不同的备用代理
- 记录每个代理的成功率和延迟，智能选择

#### 6. 代理黑名单机制

**场景**：某些代理IP被WhatsApp封禁

**问题**：
- 如何检测代理被封禁？
- 如何避免继续使用被封禁的代理？

**解决方案**：
```javascript
// infrastructure/proxy/ProxyBlacklistManager.js
interface IProxyBlacklistManager {
  // 添加到黑名单
  addToBlacklist(proxyId: string, reason: string, duration?: number): void;
  
  // 检查是否在黑名单
  isBlacklisted(proxyId: string): boolean;
  
  // 黑名单原因
  getBlacklistReason(proxyId: string): string;
  
  // 自动解除黑名单（可选）
  scheduleUnblacklist(proxyId: string, afterMs: number): void;
}
```

**检测被封禁的信号**：
- 连接成功但无法加载WhatsApp（403/451错误）
- 频繁的验证码要求
- 账号被临时限制

#### 7. 用户主动暂停/恢复会话

**场景**：用户想临时暂停某个账号的会话

**问题**：
- 暂停时是否断开代理？
- 恢复时如何快速重连？

**解决方案**：
```javascript
// application/services/SessionControlService.js
interface ISessionControlService {
  // 暂停会话
  pauseSession(accountId: string): Promise<void>;
  // 流程：
  // 1. 停止健康监控
  // 2. 保持代理连接（可选）
  // 3. 暂停页面渲染
  // 4. 保存会话状态
  
  // 恢复会话
  resumeSession(accountId: string): Promise<void>;
  // 流程：
  // 1. 验证代理连接
  // 2. 恢复页面渲染
  // 3. 重启健康监控
  // 4. 恢复会话状态
}
```

#### 8. 代理性能监控和告警

**场景**：代理性能下降但未完全失败

**问题**：
- 如何提前发现代理问题？
- 何时建议用户更换代理？

**解决方案**：
```javascript
// infrastructure/proxy/ProxyPerformanceMonitor.js
interface IProxyPerformanceMonitor {
  // 性能指标
  getPerformanceMetrics(proxyId: string): ProxyMetrics;
  
  // 性能告警阈值
  setThresholds(thresholds: PerformanceThresholds): void;
  
  // 性能告警
  onPerformanceWarning(callback: (proxyId: string, metrics: ProxyMetrics) => void): void;
}

interface ProxyMetrics {
  averageLatency: number;      // 平均延迟
  p95Latency: number;          // P95延迟
  successRate: number;         // 成功率
  bandwidthUsage: number;      // 带宽使用
  connectionStability: number; // 连接稳定性评分
}

interface PerformanceThresholds {
  maxAverageLatency: number;   // 默认500ms
  minSuccessRate: number;      // 默认95%
  maxP95Latency: number;       // 默认1000ms
}
```

**告警策略**：
- 延迟持续超过阈值 → 建议更换代理（不强制）
- 成功率低于阈值 → 警告用户（不中断）
- 连接频繁波动 → 记录日志（静默）

### 错误恢复流程

```
用户点击"重试连接"
        │
        ▼
┌───────────────────┐
│ 1. 停止健康监控    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 2. 重置Kill-Switch │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 3. 重新预检测代理  │──失败──▶ 显示错误，保持Kill-Switch
└─────────┬─────────┘
          │成功
          ▼
┌───────────────────┐
│ 4. 重新验证IP     │──失败──▶ 显示错误，保持Kill-Switch
└─────────┬─────────┘
          │成功
          ▼
┌───────────────────┐
│ 5. 恢复会话       │
│   - 解除Kill-Switch│
│   - 重新加载页面   │
│   - 启动健康监控   │
└───────────────────┘
```

### IP保护脚本注入

```javascript
// infrastructure/proxy/IPProtectionInjector.js
interface IIPProtectionInjector {
  // 注入保护脚本
  inject(webContents: WebContents): Promise<void>;
  
  // 保护内容
  // 1. 禁用 WebRTC
  // 2. 覆盖 navigator.connection
  // 3. 阻止 STUN/TURN 请求
  // 4. 拦截可能泄露IP的API
}

// 注入的保护脚本示例
const IP_PROTECTION_SCRIPT = `
  // 禁用 WebRTC
  Object.defineProperty(navigator, 'mediaDevices', { get: () => undefined });
  Object.defineProperty(window, 'RTCPeerConnection', { get: () => undefined });
  Object.defineProperty(window, 'RTCDataChannel', { get: () => undefined });
  Object.defineProperty(window, 'RTCSessionDescription', { get: () => undefined });
  
  // 禁用 navigator.connection (可能泄露网络信息)
  Object.defineProperty(navigator, 'connection', { get: () => undefined });
  
  // 禁用 WebSocket 直连检测
  const originalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    // 记录并审计 WebSocket 连接
    console.log('[IP Protection] WebSocket connection:', url);
    return new originalWebSocket(url, protocols);
  };
`;
```

### 智能填写解析器

```javascript
// utils/SmartFillParser.js (增强)
interface ISmartFillParser {
  // 解析各种格式的代理字符串
  parse(input: string): ProxyConfig | null;
  
  // 支持的格式:
  // - host:port
  // - protocol://host:port
  // - protocol://user:pass@host:port
  // - JSON格式
  // - 从剪贴板粘贴的IP信息
}
```

## 指纹模块设计

### 指纹配置实体

```javascript
// domain/entities/FingerprintConfig.js
class FingerprintConfig {
  // 浏览器与系统
  browser: BrowserConfig;
  os: OSConfig;
  userAgent: string;
  
  // WebGL
  webgl: WebGLConfig;
  
  // WebRTC
  webrtc: WebRTCConfig;
  
  // 环境属性
  timezone: TimezoneConfig;
  geolocation: GeolocationConfig;
  language: LanguageConfig;
  resolution: ResolutionConfig;
  fonts: FontConfig;
  
  // Canvas & Audio
  canvas: CanvasConfig;
  audio: AudioConfig;
  clientRects: ClientRectsConfig;
  
  // 设备信息
  device: DeviceConfig;
  
  // 其他硬件
  hardware: HardwareConfig;
  
  // Cookie
  cookies: CookieConfig[];
  
  // 方法
  static generate(): FingerprintConfig;
  validate(): ValidationResult;
  apply(webContents: WebContents): Promise<void>;
  toJSON(): FingerprintConfigDTO;
  static fromJSON(dto: FingerprintConfigDTO): FingerprintConfig;
}

interface BrowserConfig {
  name: 'chrome' | 'edge' | 'firefox';
  version: string;
}

interface WebGLConfig {
  mode: 'real' | 'custom';
  vendor?: string;
  renderer?: string;
  imageMode: 'random' | 'real';
}

interface WebRTCConfig {
  mode: 'replace' | 'real' | 'disabled';
}
```

### 指纹服务

```javascript
// application/services/FingerprintService.js
interface IFingerprintService {
  // 生成指纹
  generateFingerprint(options?: GenerateOptions): FingerprintConfig;
  
  // 应用指纹
  applyFingerprint(webContents: WebContents, config: FingerprintConfig): Promise<void>;
  
  // 验证指纹
  validateFingerprint(config: FingerprintConfig): ValidationResult;
  
  // 指纹模板
  getTemplates(): FingerprintTemplate[];
  saveTemplate(name: string, config: FingerprintConfig): Promise<void>;
  loadTemplate(name: string): FingerprintConfig;
}
```

## 新增正确性属性

### Property 40: Translation Engine Adapter Consistency
*For any* translation adapter implementing ITranslationAdapter, calling translate() with valid input should return a TranslationResult with non-empty translatedText.
**Validates: Requirements 需求文档 3.1**

### Property 41: Translation Config Round-Trip
*For any* valid TranslationConfig, serializing to JSON and deserializing should produce an equivalent configuration.
**Validates: Requirements 需求文档 3**

### Property 42: Proxy Config Validation
*For any* ProxyConfig with invalid host or port, validation should fail with specific field errors.
**Validates: Requirements 需求文档 2.1**

### Property 43: Proxy URL Generation
*For any* valid ProxyConfig, getUrl() should return a properly formatted URL string that can be parsed back to equivalent config.
**Validates: Requirements 需求文档 2.1**

### Property 44: Smart Fill Parser
*For any* valid proxy string in supported formats, parsing should produce a valid ProxyConfig.
**Validates: Requirements 需求文档 2.1**

### Property 45: Fingerprint Generation Uniqueness
*For any* two calls to generateFingerprint(), the resulting fingerprints should have different random values (canvas, audio, etc.).
**Validates: Requirements 需求文档 2.2**

### Property 46: Fingerprint Config Round-Trip
*For any* valid FingerprintConfig, serializing and deserializing should produce an equivalent configuration.
**Validates: Requirements 需求文档 2.2**

### Property 47: Proxy Failure Never Falls Back to Direct Connection
*For any* proxy connection failure scenario, the system should block all network requests rather than falling back to direct connection, ensuring the real IP is never exposed.
**Validates: Requirements 12.1**

### Property 48: WebRTC Always Disabled
*For any* BrowserView created with proxy configuration, WebRTC should be completely disabled to prevent IP leakage through STUN/TURN servers.
**Validates: Requirements 12.2**

### Property 49: DNS Leak Prevention
*For any* DNS request made through a proxied BrowserView, the request should go through the proxy and never directly to the system DNS resolver.
**Validates: Requirements 12.2**

### Property 50: Kill-Switch Activation on Proxy Loss
*For any* proxy connection that becomes unavailable during an active session, the kill-switch should immediately suspend all network activity for that account.
**Validates: Requirements 12.1, 12.2**

### Property 51: IP Verification Before Connection
*For any* account attempting to connect to WhatsApp, the system should verify the exit IP matches the expected proxy IP before allowing the connection to proceed.
**Validates: Requirements 12.2**

### Property 52: Proxy Health Check Accuracy
*For any* proxy health check, the result should accurately reflect the proxy's current connectivity status and latency.
**Validates: Requirements 12.3**

### Property 53: Consecutive Failure Detection
*For any* sequence of N consecutive proxy health check failures (where N equals the configured threshold), the system should trigger an automatic session suspension.
**Validates: Requirements 12.3**


## 大文件拆分策略

### 当前大文件分析

| 文件 | 大小 | 问题 | 拆分方案 |
|------|------|------|----------|
| contentScript.js | 138KB | 翻译注入脚本过大，职责混杂 | 拆分为多个专用模块 |
| ViewManager.js | 130KB | 视图管理器职责过多 | 拆分为多个管理器 |
| ipcHandlers.js | 55KB | IPC处理器集中 | 按功能域拆分 |
| translateSettingsPanel.js | 50KB | UI组件过大 | 拆分为子组件 |
| SessionManager.js | 45KB | 会话管理职责过多 | 拆分为专用服务 |
| InstanceManager.js | 43KB | 实例管理职责过多 | 拆分为专用服务 |

### 拆分方案详情

#### 1. contentScript.js (138KB) → 翻译注入模块

```
src/infrastructure/translation/injection/
├── ContentScriptCore.js           # 核心注入逻辑 (~15KB)
├── MessageTranslator.js           # 消息翻译处理 (~20KB)
├── InputBoxTranslator.js          # 输入框翻译处理 (~15KB)
├── TranslationUI.js               # 翻译UI组件 (~20KB)
├── DOMObserver.js                 # DOM变化监听 (~10KB)
├── StyleInjector.js               # 样式注入 (~5KB)
├── EventHandlers.js               # 事件处理 (~15KB)
├── TranslationCache.js            # 客户端缓存 (~10KB)
└── index.js                       # 统一导出
```

#### 2. ViewManager.js (130KB) → 视图管理模块

```
src/presentation/windows/view-manager/
├── ViewManager.js                 # 核心管理器 (~20KB)
├── ViewFactory.js                 # 视图创建工厂 (~15KB)
├── ViewLifecycle.js               # 生命周期管理 (~15KB)
├── ViewBoundsManager.js           # 边界计算 (~10KB)
├── ViewMemoryManager.js           # 内存管理 (~10KB)
├── ViewProxyIntegration.js        # 代理集成 (~15KB) ⭐新增
├── ViewTranslationIntegration.js  # 翻译集成 (~10KB)
├── ViewStateManager.js            # 状态管理 (~10KB)
├── ViewEventEmitter.js            # 事件发射 (~5KB)
└── index.js                       # 统一导出
```

#### 3. ipcHandlers.js (55KB) → IPC处理器模块

```
src/presentation/ipc/handlers/
├── AccountIPCHandlers.js          # 账号相关IPC (~10KB)
├── ProxyIPCHandlers.js            # 代理相关IPC (~10KB) ⭐重写
├── TranslationIPCHandlers.js      # 翻译相关IPC (~10KB)
├── ViewIPCHandlers.js             # 视图相关IPC (~10KB)
├── SystemIPCHandlers.js           # 系统相关IPC (~5KB)
├── FingerprintIPCHandlers.js      # 指纹相关IPC (~5KB) ⭐新增
└── index.js                       # 统一注册
```

#### 4. SessionManager.js (45KB) → 会话管理模块

```
src/infrastructure/session/
├── SessionManager.js              # 核心管理器 (~15KB)
├── SessionStorage.js              # 会话存储 (~10KB)
├── SessionRecovery.js             # 会话恢复 (~10KB)
├── SessionValidator.js            # 会话验证 (~5KB)
└── index.js                       # 统一导出
```

#### 5. 代理模块（完全重写）

```
src/infrastructure/proxy/
├── core/
│   ├── ProxySecurityManager.js    # 安全策略管理 (~15KB)
│   ├── ProxyConnectionManager.js  # 连接管理 (~15KB)
│   └── ProxyConfigValidator.js    # 配置验证 (~5KB)
│
├── security/
│   ├── IPProtectionInjector.js    # IP保护注入 (~10KB)
│   ├── IPLeakDetector.js          # 泄露检测 (~10KB)
│   ├── WebRTCBlocker.js           # WebRTC阻断 (~5KB)
│   ├── DNSLeakPrevention.js       # DNS泄露防护 (~5KB)
│   └── KillSwitch.js              # Kill-Switch (~10KB)
│
├── monitoring/
│   ├── ProxyHealthMonitor.js      # 健康监控 (~10KB)
│   ├── ProxyLatencyTracker.js     # 延迟追踪 (~5KB)
│   └── ProxyAuditLogger.js        # 审计日志 (~5KB)
│
├── utils/
│   ├── SmartFillParser.js         # 智能填写解析 (~5KB)
│   └── ProxyURLBuilder.js         # URL构建 (~3KB)
│
└── index.js                       # 统一导出
```

### 模块化原则

1. **单一职责** - 每个文件只负责一个明确的功能
2. **文件大小限制** - 单个文件不超过20KB（约500行）
3. **统一导出** - 每个模块目录有index.js统一导出
4. **依赖注入** - 模块间通过接口和依赖注入解耦
5. **可测试性** - 每个模块可独立测试

### 拆分优先级

| 优先级 | 模块 | 原因 |
|--------|------|------|
| P0 | 代理模块 | 完全重写，安全关键 |
| P1 | ViewManager | 需要集成代理安全 |
| P2 | ipcHandlers | 需要迁移到IPCRouter |
| P3 | contentScript | 翻译渐进式重构 |
| P4 | SessionManager | 功能稳定，可后续优化 |
