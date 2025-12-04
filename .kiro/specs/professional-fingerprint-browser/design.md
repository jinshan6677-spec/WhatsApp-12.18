# Design Document

## Overview

本设计文档描述了专业级指纹浏览器系统的技术架构和实现方案。系统基于现有的 WhatsApp 多账号管理应用，升级为具备完整浏览器指纹管理、代理隔离和环境配置功能的专业级指纹浏览器，对标 AdsPower、Multilogin 等商业产品。

**核心设计目标：**
1. **零信任网络模型**：100% 防止 IP 泄露，代理失败时阻止所有网络请求
2. **完整指纹管理**：覆盖 WebGL、Canvas、Audio、WebRTC、设备信息等所有指纹维度
3. **本地代理中继**：解决 Chromium 与 SOCKS5 代理的兼容性问题（ERR_NO_SUPPORTED_PROXIES）
4. **进程级隔离**：每个账号独立的指纹、代理、会话数据
5. **企业级稳定性**：进程监督、心跳检测、自动恢复机制

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Application Layer (应用层)                          │   │
│  │  ├─ FingerprintService (指纹服务)                    │   │
│  │  ├─ ProxyRelayService (代理中继服务)                 │   │
│  │  ├─ ProfileSupervisor (进程监督器)                   │   │
│  │  └─ FingerprintDetectionService (指纹检测服务)       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Infrastructure Layer (基础设施层)                   │   │
│  │  ├─ ProxySecurityManager (代理安全管理器)            │   │
│  │  ├─ KillSwitch (网络断路器)                          │   │
│  │  ├─ FingerprintInjector (指纹注入器)                 │   │
│  │  └─ FingerprintLibrary (指纹库)                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────┼─────────────────┐
        ↓                 ↓                 ↓
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  Account A    │ │  Account B    │ │  Account C    │
│  ┌─────────┐  │ │  ┌─────────┐  │ │  ┌─────────┐  │
│  │Browser  │  │ │  │Browser  │  │ │  │Browser  │  │
│  │View     │  │ │  │View     │  │ │  │View     │  │
│  └─────────┘  │ │  └─────────┘  │ │  └─────────┘  │
│  ┌─────────┐  │ │  ┌─────────┐  │ │  ┌─────────┐  │
│  │Proxy    │  │ │  │Proxy    │  │ │  │Proxy    │  │
│  │Relay    │  │ │  │Relay    │  │ │  │Relay    │  │
│  │:10001   │  │ │  │:10002   │  │ │  │:10003   │  │
│  └─────────┘  │ │  └─────────┘  │ │  └─────────┘  │
│       ↓       │ │       ↓       │ │       ↓       │
│  SOCKS5_A     │ │  SOCKS5_B     │ │  SOCKS5_C     │
│  (IP_A)       │ │  (IP_B)       │ │  (IP_C)       │
└───────────────┘ └───────────────┘ └───────────────┘
```

### 分层架构

#### 1. 表现层（Presentation Layer）
- **UI Components**: 指纹配置界面、代理管理界面、账号列表
- **IPC Handlers**: 处理渲染进程的指纹配置请求、代理测试请求

#### 2. 应用层（Application Layer）
- **FingerprintService**: 指纹配置管理、指纹生成、指纹验证
- **ProxyRelayService**: 本地代理中继服务管理、端口分配
- **ProfileSupervisor**: 进程监督、心跳检测、自动恢复
- **FingerprintDetectionService**: 指纹检测、风险分析、修复建议

#### 3. 领域层（Domain Layer）
- **FingerprintProfile**: 指纹配置实体
- **ProxyRelay**: 代理中继实体
- **AccountProfile**: 账号配置实体（扩展现有 AccountConfig）

#### 4. 基础设施层（Infrastructure Layer）
- **ProxySecurityManager**: 代理安全策略、KillSwitch 管理
- **FingerprintInjector**: 指纹脚本注入、生命周期管理
- **FingerprintLibrary**: 真实设备指纹库、指纹模板库
- **ProxyRelayServer**: 本地代理服务器实现（基于 `socks` npm 包）

## Components and Interfaces

### 1. FingerprintService

**职责**：管理指纹配置的创建、更新、验证和持久化

**接口**：
```typescript
interface FingerprintService {
  // 创建指纹配置
  createFingerprint(accountId: string, config: Partial<FingerprintProfile>): Promise<FingerprintProfile>;
  
  // 一键生成随机指纹
  generateRandomFingerprint(strategy?: FingerprintStrategy): Promise<FingerprintProfile>;
  
  // 更新指纹配置
  updateFingerprint(accountId: string, config: Partial<FingerprintProfile>): Promise<void>;
  
  // 获取指纹配置
  getFingerprint(accountId: string): Promise<FingerprintProfile | null>;
  
  // 验证指纹一致性
  validateFingerprint(config: FingerprintProfile): ValidationResult;
  
  // 保存指纹模板
  saveFingerprintTemplate(name: string, config: FingerprintProfile): Promise<void>;
  
  // 加载指纹模板
  loadFingerprintTemplate(name: string): Promise<FingerprintProfile>;
  
  // 批量应用指纹
  applyFingerprintBatch(accountIds: string[], template: FingerprintProfile): Promise<BatchResult>;
}

interface FingerprintProfile {
  // 浏览器信息
  userAgent: string;
  browserVersion: string;
  platform: 'Windows' | 'MacOS' | 'Linux';
  
  // WebGL 指纹
  webgl: {
    vendor: string;
    renderer: string;
    mode: 'real' | 'custom' | 'random';
  };
  
  // Canvas 指纹
  canvas: {
    mode: 'real' | 'random';
    noiseLevel?: number;
  };
  
  // Audio 指纹
  audio: {
    mode: 'real' | 'random';
    noiseLevel?: number;
  };
  
  // WebRTC 设置
  webrtc: {
    mode: 'disabled' | 'replaced' | 'real';
    fakeLocalIP?: string;
  };
  
  // 环境属性
  timezone: {
    mode: 'ip-based' | 'real' | 'custom';
    value?: string;
  };
  
  geolocation: {
    mode: 'ip-based' | 'prompt' | 'deny';
    latitude?: number;
    longitude?: number;
  };
  
  language: {
    mode: 'ip-based' | 'custom';
    value?: string;
  };
  
  // 设备信息
  screen: {
    mode: 'real' | 'custom';
    width?: number;
    height?: number;
  };
  
  hardware: {
    cpuCores: number;
    memory: number; // GB
    deviceName?: string;
    macAddress?: string;
  };
  
  // 其他
  doNotTrack: '0' | '1' | null;
  battery: {
    mode: 'real' | 'privacy' | 'disabled';
  };
  
  fonts: {
    mode: 'system' | 'custom';
    list?: string[];
  };
  
  plugins: {
    mode: 'real' | 'custom' | 'empty';
    list?: PluginInfo[];
  };
  
  mediaDevices: {
    mode: 'real' | 'custom' | 'disabled';
    devices?: MediaDeviceInfo[];
  };
  
  // 元数据
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

interface FingerprintStrategy {
  type: 'fixed' | 'random-on-start' | 'periodic' | 'partial-random';
  interval?: number; // 天数，用于 periodic 模式
  randomFields?: string[]; // 用于 partial-random 模式
}
```

### 2. ProxyRelayService

**职责**：管理本地代理中继服务的生命周期

**接口**：
```typescript
interface ProxyRelayService {
  // 启动代理中继
  startRelay(accountId: string, remoteProxy: ProxyConfig): Promise<ProxyRelayInfo>;
  
  // 停止代理中继
  stopRelay(accountId: string): Promise<void>;
  
  // 获取中继状态
  getRelayStatus(accountId: string): Promise<ProxyRelayStatus>;
  
  // 测试代理连通性
  testProxy(proxyConfig: ProxyConfig): Promise<ProxyTestResult>;
  
  // 获取出口 IP
  getExitIP(accountId: string): Promise<string>;
  
  // 热重载代理配置
  reloadProxy(accountId: string, newProxy: ProxyConfig): Promise<void>;
}

interface ProxyRelayInfo {
  accountId: string;
  localPort: number;
  remoteProxy: ProxyConfig;
  status: 'starting' | 'running' | 'stopped' | 'error';
  exitIP?: string;
  startedAt: Date;
}

interface ProxyRelayStatus {
  isRunning: boolean;
  localPort: number;
  remoteProxy: ProxyConfig;
  exitIP?: string;
  lastHealthCheck: Date;
  consecutiveFailures: number;
  bytesTransferred: number;
  connectionsCount: number;
}

interface ProxyTestResult {
  success: boolean;
  exitIP?: string;
  responseTime?: number; // 毫秒
  error?: string;
}
```

### 3. FingerprintInjector

**职责**：在浏览器启动的不同阶段注入指纹脚本

**接口**：
```typescript
interface FingerprintInjector {
  // 注入指纹脚本（完整生命周期）
  injectFingerprint(webContents: WebContents, profile: FingerprintProfile): Promise<void>;
  
  // Before Launch: 设置 Chromium 启动参数
  getChromiumArgs(profile: FingerprintProfile, proxyPort: number): string[];
  
  // Preload: 注入基础对象覆盖
  injectPreloadScript(webContents: WebContents, profile: FingerprintProfile): Promise<void>;
  
  // DOM Ready: 注入 WebGL/Canvas Hook
  injectDOMReadyScript(webContents: WebContents, profile: FingerprintProfile): Promise<void>;
  
  // Request Hook: 拦截请求并注入 Cookie
  setupRequestHooks(webContents: WebContents, profile: FingerprintProfile): void;
  
  // 生成指纹脚本
  generateFingerprintScript(profile: FingerprintProfile): string;
}
```

### 4. ProfileSupervisor

**职责**：监督账号进程的健康状态并自动恢复

**接口**：
```typescript
interface ProfileSupervisor {
  // 启动监督
  startSupervision(accountId: string): void;
  
  // 停止监督
  stopSupervision(accountId: string): void;
  
  // 心跳检测
  performHeartbeat(accountId: string): Promise<HeartbeatResult>;
  
  // 自动恢复
  recoverProfile(accountId: string, reason: RecoveryReason): Promise<void>;
  
  // 获取监督状态
  getSupervisionStatus(accountId: string): SupervisionStatus;
}

interface HeartbeatResult {
  success: boolean;
  responseTime: number;
  timestamp: Date;
}

interface SupervisionStatus {
  accountId: string;
  isSupervised: boolean;
  lastHeartbeat: Date;
  consecutiveFailures: number;
  cpuUsage: number;
  memoryUsage: number;
  status: 'healthy' | 'warning' | 'frozen' | 'crashed';
}

type RecoveryReason = 'frozen' | 'crashed' | 'proxy-failed' | 'manual';
```

### 5. FingerprintDetectionService

**职责**：检测指纹配置的有效性并提供修复建议

**接口**：
```typescript
interface FingerprintDetectionService {
  // 检测指纹
  detectFingerprint(profile: FingerprintProfile): Promise<DetectionResult>;
  
  // 自动修复
  autoFix(profile: FingerprintProfile, risks: RiskItem[]): Promise<FingerprintProfile>;
  
  // 获取修复建议
  getFixSuggestions(risks: RiskItem[]): FixSuggestion[];
}

interface DetectionResult {
  score: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  risks: RiskItem[];
  timestamp: Date;
}

interface RiskItem {
  category: 'webgl' | 'webrtc' | 'ua' | 'canvas' | 'audio' | 'consistency';
  severity: 'low' | 'medium' | 'high';
  description: string;
  detectedValue?: string;
  expectedValue?: string;
}

interface FixSuggestion {
  riskItem: RiskItem;
  suggestion: string;
  autoFixable: boolean;
  fixAction?: () => void;
}
```

## Data Models

### FingerprintProfile Entity

```typescript
class FingerprintProfile {
  id: string;
  accountId: string;
  
  // 浏览器信息
  userAgent: string;
  browserVersion: string;
  platform: Platform;
  
  // 指纹配置（详见 Components 章节）
  webgl: WebGLConfig;
  canvas: CanvasConfig;
  audio: AudioConfig;
  webrtc: WebRTCConfig;
  timezone: TimezoneConfig;
  geolocation: GeolocationConfig;
  language: LanguageConfig;
  screen: ScreenConfig;
  hardware: HardwareConfig;
  doNotTrack: DoNotTrackValue;
  battery: BatteryConfig;
  fonts: FontsConfig;
  plugins: PluginsConfig;
  mediaDevices: MediaDevicesConfig;
  
  // 元数据
  createdAt: Date;
  updatedAt: Date;
  version: number;
  
  // 方法
  validate(): ValidationResult;
  toJSON(): object;
  static fromJSON(data: object): FingerprintProfile;
}
```

### ProxyRelay Entity

```typescript
class ProxyRelay {
  id: string;
  accountId: string;
  localPort: number;
  remoteProxy: ProxyConfig;
  server: net.Server | null;
  status: ProxyRelayStatus;
  
  // 统计信息
  bytesTransferred: number;
  connectionsCount: number;
  lastHealthCheck: Date;
  consecutiveFailures: number;
  
  // 方法
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getExitIP(): Promise<string>;
}
```

### AccountProfile Entity (扩展现有 AccountConfig)

```typescript
class AccountProfile extends AccountConfig {
  // 新增字段
  fingerprint: FingerprintProfile;
  proxyRelay: ProxyRelayInfo | null;
  supervisionStatus: SupervisionStatus;
  
  // 新增方法
  applyFingerprint(profile: FingerprintProfile): void;
  enableProxyRelay(remoteProxy: ProxyConfig): Promise<void>;
  disableProxyRelay(): Promise<void>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. 
Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**完整的正确性属性列表请参考：[correctness-properties.md](./correctness-properties.md)**

本系统定义了 56 个正确性属性，覆盖以下类别：
1. 代理中继服务（Property 1-7）
2. 代理配置管理（Property 8-11）
3. 浏览器指纹（Property 12-18）
4. 环境属性配置（Property 19-24）
5. Cookie 和持久化（Property 25-27）
6. 指纹生成和验证（Property 28-30）
7. 代理安全和零信任（Property 31-35）
8. 进程监督和恢复（Property 36-39）
9. 批量操作（Property 40-41）
10. 指纹随机化策略（Property 42-44）
11. 代理与指纹联动（Property 45-46）
12. 端口扫描保护（Property 47-48）
13. 其他指纹属性（Property 49-52）
14. 版本管理（Property 53-54）
15. 代理列表管理（Property 55-56）

## Error Handling

### 错误分类

#### 1. 代理相关错误
- **ProxyConnectionError**: 代理连接失败
- **ProxyAuthenticationError**: 代理认证失败
- **ProxyTimeoutError**: 代理连接超时
- **PortAllocationError**: 本地端口分配失败
- **IPVerificationError**: 出口 IP 验证失败

**处理策略**：
- 触发 KillSwitch
- 使用指数退避算法自动重连
- 记录详细错误日志
- 通知用户

#### 2. 指纹注入错误
- **FingerprintInjectionError**: 指纹脚本注入失败
- **FingerprintValidationError**: 指纹配置验证失败
- **FingerprintInconsistencyError**: 指纹参数不一致

**处理策略**：
- 记录错误但继续加载页面（降级处理）
- 使用默认指纹配置（真实模式）
- 通知用户检查配置

#### 3. 进程监督错误
- **HeartbeatTimeoutError**: 心跳检测超时
- **BrowserCrashError**: 浏览器进程崩溃
- **ResourceExhaustedError**: 系统资源耗尽

**处理策略**：
- 自动重启账号（最多 3 次）
- 限制新账号启动
- 通知用户

#### 4. 配置持久化错误
- **ConfigLoadError**: 配置加载失败
- **ConfigSaveError**: 配置保存失败
- **ConfigCorruptedError**: 配置文件损坏

**处理策略**：
- 使用默认配置
- 尝试从备份恢复
- 通知用户

### 错误恢复机制

```typescript
interface ErrorRecoveryStrategy {
  // 错误类型
  errorType: string;
  
  // 恢复策略
  strategy: 'retry' | 'fallback' | 'notify' | 'abort';
  
  // 最大重试次数
  maxRetries?: number;
  
  // 重试间隔（毫秒）
  retryInterval?: number;
  
  // 降级方案
  fallbackAction?: () => Promise<void>;
  
  // 用户通知
  notifyUser?: boolean;
}
```

## Testing Strategy

### 测试方法论

本系统采用**双重测试策略**：单元测试 + 属性测试（Property-Based Testing）

#### 单元测试
- 覆盖具体的功能点和边界情况
- 验证特定输入的预期输出
- 测试错误处理逻辑

#### 属性测试
- 验证系统的通用正确性属性
- 使用随机生成的输入测试
- 确保属性在所有情况下都成立

### 属性测试框架

**选择**：`fast-check` (JavaScript/TypeScript 的属性测试库)

**配置**：
- 每个属性测试运行 **100 次迭代**
- 使用随机种子确保可重现性
- 失败时自动缩小（shrinking）到最小反例

### 测试覆盖目标

| 测试类型 | 目标覆盖率 | 测试数量 |
|---------|-----------|---------|
| 单元测试 | 80%+ | 60+ |
| 属性测试 | 90%+ | 56 |
| 集成测试 | 70%+ | 20+ |
| **总计** | **85%+** | **136+** |

### 属性测试标注规范

每个属性测试必须使用以下格式标注：

```typescript
/**
 * Feature: professional-fingerprint-browser, Property 1: 端口唯一性
 * Validates: Requirements 1.1
 */
test('Property 1: Port uniqueness for concurrent accounts', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(accountConfigArbitrary(), { minLength: 2, maxLength: 10 }),
      async (accounts) => {
        // 启动所有账号
        const ports = await Promise.all(
          accounts.map(acc => proxyRelayService.startRelay(acc.id, acc.proxy))
        );
        
        // 验证端口唯一性
        const uniquePorts = new Set(ports.map(p => p.localPort));
        expect(uniquePorts.size).toBe(ports.length);
      }
    ),
    { numRuns: 100 }
  );
});
```

### 测试数据生成器

使用 `fast-check` 的 Arbitrary 生成器创建测试数据：

```typescript
// 生成随机指纹配置
const fingerprintProfileArbitrary = (): fc.Arbitrary<FingerprintProfile> => {
  return fc.record({
    userAgent: fc.string({ minLength: 50, maxLength: 200 }),
    platform: fc.constantFrom('Windows', 'MacOS', 'Linux'),
    webgl: fc.record({
      vendor: fc.string(),
      renderer: fc.string(),
      mode: fc.constantFrom('real', 'custom', 'random')
    }),
    // ... 其他字段
  });
};

// 生成随机代理配置
const proxyConfigArbitrary = (): fc.Arbitrary<ProxyConfig> => {
  return fc.record({
    protocol: fc.constantFrom('socks5', 'http', 'https'),
    host: fc.ipV4(),
    port: fc.integer({ min: 1024, max: 65535 }),
    username: fc.option(fc.string(), { nil: '' }),
    password: fc.option(fc.string(), { nil: '' })
  });
};
```

### 集成测试场景

1. **完整账号生命周期测试**
   - 创建账号 → 配置指纹 → 启动代理 → 加载页面 → 验证指纹 → 关闭账号

2. **代理故障恢复测试**
   - 启动账号 → 模拟代理失败 → 验证 KillSwitch → 恢复代理 → 验证网络恢复

3. **批量操作测试**
   - 创建多个账号 → 批量应用指纹模板 → 验证所有账号配置一致

4. **指纹检测测试**
   - 配置指纹 → 访问检测网站 → 解析检测结果 → 验证风险识别

### 性能测试

- **并发账号测试**：测试同时运行 30 个账号的性能
- **内存泄漏测试**：长时间运行账号，监控内存使用
- **代理吞吐量测试**：测试代理中继的最大吞吐量

## Technology Stack

### 技术选型表

| 类别 | 技术/工具 | 版本 | 用途 | 选择理由 |
|------|----------|------|------|---------|
| **核心框架** |
| 运行时 | Node.js | 20.x | JavaScript 运行环境 | 与现有项目一致 |
| 桌面框架 | Electron | 39.1.1 | 桌面应用框架 | 与现有项目一致 |
| 语言 | TypeScript | 5.x | 类型安全的 JavaScript | 提高代码质量和可维护性 |
| **代理相关** |
| SOCKS5 代理 | `socks` | 2.8.x | SOCKS5 客户端和服务器 | 成熟稳定、支持认证 |
| HTTP 代理 | `http-proxy` | 1.18.x | HTTP/HTTPS 代理 | 标准库、性能良好 |
| IP 查询 | `axios` | 1.6.x | HTTP 客户端 | 用于查询出口 IP 和地理位置 |
| **指纹相关** |
| 指纹库 | JSON 文件 | - | 存储真实设备指纹 | 简单高效、易于更新 |
| 指纹检测 | Puppeteer | 21.x | 自动化浏览器 | 用于访问指纹检测网站 |
| **测试框架** |
| 单元测试 | Jest | 29.x | JavaScript 测试框架 | 与现有项目一致 |
| 属性测试 | fast-check | 3.x | 属性测试库 | JavaScript 最佳属性测试库 |
| E2E 测试 | Playwright | 1.40.x | 端到端测试 | 支持多浏览器、性能好 |
| **数据存储** |
| 配置存储 | JSON 文件 | - | 账号配置、指纹配置 | 简单、人类可读 |
| 日志存储 | `winston` | 3.x | 日志库 | 功能强大、支持多种输出 |
| **工具库** |
| 加密 | `crypto` (Node.js) | - | 密码加密 | 内置库、安全可靠 |
| 日期处理 | `date-fns` | 3.x | 日期时间处理 | 轻量级、函数式 |
| 验证 | `joi` | 17.x | 数据验证 | 强大的 schema 验证 |
| **开发工具** |
| 代码检查 | ESLint | 8.x | 代码质量检查 | 标准工具 |
| 代码格式化 | Prettier | 3.x | 代码格式化 | 统一代码风格 |
| 类型检查 | TypeScript | 5.x | 静态类型检查 | 提前发现类型错误 |

### 项目目录结构

```
whatsapp-desktop-translation/
├── src/
│   ├── main-refactored.js                    # 主入口（现有）
│   ├── preload.js                             # 预加载脚本（现有）
│   ├── config.js                              # 应用配置（现有）
│   │
│   ├── app/                                   # 应用核心（现有）
│   │   ├── bootstrap.js
│   │   ├── DependencyContainer.js
│   │   └── constants/
│   │
│   ├── core/                                  # 核心组件（现有）
│   │   ├── eventbus/
│   │   ├── config/
│   │   ├── state/
│   │   ├── container/
│   │   ├── errors/
│   │   ├── managers/
│   │   └── services/
│   │
│   ├── domain/                                # 领域层（现有）
│   │   ├── entities/
│   │   │   ├── ProxyConfig.js                 # 现有
│   │   │   ├── FingerprintProfile.ts          # 新增：指纹配置实体
│   │   │   ├── ProxyRelay.ts                  # 新增：代理中继实体
│   │   │   └── AccountProfile.ts              # 新增：扩展账号实体
│   │   ├── events/
│   │   │   ├── FingerprintEvents.ts           # 新增：指纹相关事件
│   │   │   └── ProxyRelayEvents.ts            # 新增：代理中继事件
│   │   ├── repositories/
│   │   │   ├── FingerprintRepository.ts       # 新增：指纹配置仓库接口
│   │   │   └── ProxyRelayRepository.ts        # 新增：代理中继仓库接口
│   │   └── errors/
│   │       ├── FingerprintErrors.ts           # 新增：指纹相关错误
│   │       └── ProxyRelayErrors.ts            # 新增：代理中继错误
│   │
│   ├── application/                           # 应用层（现有）
│   │   ├── services/
│   │   │   ├── ProxyService.js                # 现有
│   │   │   ├── FingerprintService.ts          # 新增：指纹服务
│   │   │   ├── ProxyRelayService.ts           # 新增：代理中继服务
│   │   │   ├── ProfileSupervisor.ts           # 新增：进程监督器
│   │   │   └── FingerprintDetectionService.ts # 新增：指纹检测服务
│   │   ├── usecases/
│   │   │   ├── CreateFingerprintUseCase.ts    # 新增：创建指纹用例
│   │   │   ├── ApplyFingerprintUseCase.ts     # 新增：应用指纹用例
│   │   │   ├── StartProxyRelayUseCase.ts      # 新增：启动代理中继用例
│   │   │   └── DetectFingerprintUseCase.ts    # 新增：检测指纹用例
│   │   └── dtos/
│   │       ├── FingerprintDTO.ts              # 新增：指纹数据传输对象
│   │       └── ProxyRelayDTO.ts               # 新增：代理中继数据传输对象
│   │
│   ├── infrastructure/                        # 基础设施层（现有）
│   │   ├── proxy/                             # 代理安全模块（现有）
│   │   │   ├── ProxyService.js
│   │   │   ├── ProxySecurityManager.js
│   │   │   ├── KillSwitch.js
│   │   │   ├── ProxyHealthMonitor.js
│   │   │   ├── IPProtectionInjector.js
│   │   │   ├── IPLeakDetector.js
│   │   │   ├── ProxyRelayServer.ts            # 新增：本地代理服务器实现
│   │   │   └── PortAllocator.ts               # 新增：端口分配器
│   │   ├── fingerprint/                       # 新增：指纹模块
│   │   │   ├── FingerprintInjector.ts         # 指纹注入器
│   │   │   ├── FingerprintScriptGenerator.ts  # 指纹脚本生成器
│   │   │   ├── FingerprintLibrary.ts          # 指纹库管理
│   │   │   ├── FingerprintValidator.ts        # 指纹验证器
│   │   │   └── generators/                    # 指纹生成器
│   │   │       ├── UserAgentGenerator.ts
│   │   │       ├── WebGLGenerator.ts
│   │   │       ├── CanvasGenerator.ts
│   │   │       └── DeviceInfoGenerator.ts
│   │   ├── translation/                       # 翻译适配器（现有）
│   │   ├── repositories/                      # Repository 实现（现有）
│   │   │   ├── ProxyRepository.js
│   │   │   ├── FingerprintRepositoryImpl.ts   # 新增：指纹配置仓库实现
│   │   │   └── ProxyRelayRepositoryImpl.ts    # 新增：代理中继仓库实现
│   │   ├── storage/                           # 存储适配器（现有）
│   │   └── plugins/                           # 插件系统（现有）
│   │
│   ├── presentation/                          # 表现层（现有）
│   │   ├── ipc/                               # IPC 路由和处理器（现有）
│   │   │   ├── IPCRouter.js
│   │   │   └── handlers/
│   │   │       ├── FingerprintHandlers.ts     # 新增：指纹相关 IPC 处理器
│   │   │       ├── ProxyRelayHandlers.ts      # 新增：代理中继 IPC 处理器
│   │   │       └── DetectionHandlers.ts       # 新增：检测相关 IPC 处理器
│   │   ├── windows/                           # 窗口管理（现有）
│   │   │   └── view-manager/
│   │   │       ├── ViewManager.js
│   │   │       ├── ViewFactory.js
│   │   │       ├── ViewLifecycle.js
│   │   │       ├── ViewBoundsManager.js
│   │   │       ├── ViewProxyIntegration.js
│   │   │       └── ViewFingerprintIntegration.ts # 新增：视图指纹集成
│   │   └── translation/                       # 翻译内容脚本（现有）
│   │
│   ├── managers/                              # 管理器实现（现有）
│   ├── translation/                           # 翻译服务（现有）
│   ├── single-window/                         # 单窗口架构（现有）
│   ├── models/                                # 数据模型（现有）
│   └── utils/                                 # 工具类（现有）
│
├── resources/                                 # 应用资源
│   ├── fingerprint-library.json               # 新增：指纹库
│   ├── fingerprint-templates/                 # 新增：指纹模板目录
│   │   ├── windows-chrome-108.json
│   │   ├── macos-safari-17.json
│   │   └── ...
│   └── icons/                                 # 应用图标（现有）
│
├── session-data/                              # 会话数据（现有）
│   └── account-{id}/
│       ├── fingerprint.json                   # 新增：指纹配置
│       ├── fingerprint-history/               # 新增：指纹历史版本
│       │   ├── v1.json
│       │   ├── v2.json
│       │   └── ...
│       ├── proxy-relay.json                   # 新增：代理中继配置
│       └── ...                                # 现有会话数据
│
├── test/                                      # 测试文件
│   ├── unit/                                  # 单元测试
│   │   ├── fingerprint/
│   │   │   ├── FingerprintService.test.ts
│   │   │   ├── FingerprintInjector.test.ts
│   │   │   └── FingerprintValidator.test.ts
│   │   ├── proxy-relay/
│   │   │   ├── ProxyRelayService.test.ts
│   │   │   ├── ProxyRelayServer.test.ts
│   │   │   └── PortAllocator.test.ts
│   │   └── supervisor/
│   │       └── ProfileSupervisor.test.ts
│   ├── property/                              # 属性测试
│   │   ├── fingerprint.property.test.ts       # 指纹相关属性测试
│   │   ├── proxy-relay.property.test.ts       # 代理中继属性测试
│   │   ├── security.property.test.ts          # 安全相关属性测试
│   │   └── arbitraries/                       # 测试数据生成器
│   │       ├── FingerprintArbitraries.ts
│   │       ├── ProxyArbitraries.ts
│   │       └── AccountArbitraries.ts
│   ├── integration/                           # 集成测试
│   │   ├── account-lifecycle.test.ts
│   │   ├── proxy-failover.test.ts
│   │   └── batch-operations.test.ts
│   └── e2e/                                   # 端到端测试
│       ├── fingerprint-detection.test.ts
│       └── full-workflow.test.ts
│
├── docs/                                      # 文档（现有）
│   ├── ARCHITECTURE_MIGRATION_COMPLETE.md
│   ├── FINGERPRINT_BROWSER_GUIDE.md           # 新增：指纹浏览器使用指南
│   └── ...
│
├── .kiro/                                     # Kiro 配置（现有）
│   └── specs/
│       └── professional-fingerprint-browser/  # 本 spec
│           ├── requirements.md
│           ├── design.md
│           ├── correctness-properties.md
│           └── tasks.md
│
├── package.json                               # 依赖配置
├── tsconfig.json                              # TypeScript 配置
├── jest.config.js                             # Jest 配置
└── README.md                                  # 项目说明
```

### 新增文件说明

#### 核心服务（`src/application/services/`）
- **FingerprintService.ts**: 指纹配置的 CRUD 操作、验证、模板管理
- **ProxyRelayService.ts**: 代理中继服务的生命周期管理、端口分配
- **ProfileSupervisor.ts**: 账号进程监督、心跳检测、自动恢复
- **FingerprintDetectionService.ts**: 指纹检测、风险分析、修复建议

#### 基础设施（`src/infrastructure/`）
- **fingerprint/**: 指纹相关的底层实现
  - **FingerprintInjector.ts**: 在不同阶段注入指纹脚本
  - **FingerprintScriptGenerator.ts**: 生成指纹覆盖脚本
  - **FingerprintLibrary.ts**: 管理真实设备指纹库
  - **generators/**: 各种指纹参数的生成器

- **proxy/ProxyRelayServer.ts**: 本地 SOCKS5/HTTP 代理服务器实现
- **proxy/PortAllocator.ts**: 端口分配和管理

#### 测试（`test/`）
- **property/**: 56 个属性测试，使用 fast-check
- **arbitraries/**: 测试数据生成器（Arbitraries）
- **integration/**: 集成测试场景
- **e2e/**: 端到端测试

#### 资源（`resources/`）
- **fingerprint-library.json**: 100+ 真实设备的完整指纹配置
- **fingerprint-templates/**: 预设的指纹模板

## Implementation Notes

### 技术栈选择

#### 代理中继实现
- **库选择**：`socks` npm 包（用于 SOCKS5 代理）
- **原因**：成熟稳定、支持认证、性能良好
- **备选**：`http-proxy`（用于 HTTP/HTTPS 代理）

#### 指纹注入实现
- **方法**：`webContents.executeJavaScript` + `webContents.session.webRequest`
- **时机**：Before Launch → Preload → DOM Ready → Request Hook
- **隐蔽性**：使用 `Object.defineProperty` 确保属性不可修改

#### 指纹库存储
- **格式**：JSON 文件
- **位置**：`resources/fingerprint-library.json`
- **内容**：100+ 真实设备的完整指纹配置

#### 配置持久化
- **格式**：JSON 文件
- **位置**：`session-data/account-{id}/fingerprint.json`
- **备份**：每次修改时创建快照

### 关键实现细节

#### 1. 本地代理中继实现

```typescript
class ProxyRelayServer {
  private server: net.Server;
  private remoteProxy: ProxyConfig;
  
  async start(localPort: number, remoteProxy: ProxyConfig): Promise<void> {
    this.remoteProxy = remoteProxy;
    
    // 创建 SOCKS5 服务器
    this.server = socks.createServer((info, accept, deny) => {
      // 连接远程代理
      const socket = net.connect({
        host: remoteProxy.host,
        port: remoteProxy.port
      });
      
      // 处理认证
      if (remoteProxy.username && remoteProxy.password) {
        // SOCKS5 认证握手
        this.performAuthentication(socket, remoteProxy);
      }
      
      // 转发流量
      const clientSocket = accept(true);
      socket.pipe(clientSocket);
      clientSocket.pipe(socket);
      
      // 统计流量
      socket.on('data', (data) => {
        this.bytesTransferred += data.length;
      });
    });
    
    // 监听本地端口
    await new Promise((resolve, reject) => {
      this.server.listen(localPort, '127.0.0.1', () => resolve());
      this.server.on('error', reject);
    });
  }
  
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }
}
```

#### 2. 指纹脚本生成

```typescript
class FingerprintScriptGenerator {
  generate(profile: FingerprintProfile): string {
    return `
      (function() {
        // 覆盖 navigator.userAgent
        Object.defineProperty(navigator, 'userAgent', {
          get: () => '${profile.userAgent}',
          configurable: false
        });
        
        // 覆盖 WebGL
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(param) {
          if (param === 0x1F00) return '${profile.webgl.vendor}';
          if (param === 0x1F01) return '${profile.webgl.renderer}';
          return getParameter.call(this, param);
        };
        
        // 覆盖 Canvas
        if ('${profile.canvas.mode}' === 'random') {
          const toDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function() {
            const ctx = this.getContext('2d');
            // 添加随机噪点
            const imageData = ctx.getImageData(0, 0, this.width, this.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] += Math.random() * ${profile.canvas.noiseLevel || 1};
            }
            ctx.putImageData(imageData, 0, 0);
            return toDataURL.call(this);
          };
        }
        
        // 禁用 WebRTC
        if ('${profile.webrtc.mode}' === 'disabled') {
          delete window.RTCPeerConnection;
          delete window.RTCDataChannel;
          delete window.RTCSessionDescription;
        }
        
        // 覆盖时区
        if ('${profile.timezone.mode}' === 'custom') {
          const DateTimeFormat = Intl.DateTimeFormat;
          Intl.DateTimeFormat = function(...args) {
            const fmt = new DateTimeFormat(...args);
            const resolvedOptions = fmt.resolvedOptions.bind(fmt);
            fmt.resolvedOptions = function() {
              const options = resolvedOptions();
              options.timeZone = '${profile.timezone.value}';
              return options;
            };
            return fmt;
          };
        }
        
        // ... 其他指纹覆盖
      })();
    `;
  }
}
```

#### 3. KillSwitch 实现

```typescript
class KillSwitch {
  private isActive: boolean = false;
  
  activate(webContents: WebContents): void {
    this.isActive = true;
    
    // 阻止所有网络请求
    webContents.session.webRequest.onBeforeRequest((details, callback) => {
      if (this.isActive) {
        callback({ cancel: true });
      } else {
        callback({});
      }
    });
    
    // 注入脚本阻止 WebSocket 和 Fetch
    webContents.executeJavaScript(`
      window.fetch = () => Promise.reject(new Error('Network blocked by KillSwitch'));
      window.WebSocket = class {
        constructor() {
          throw new Error('WebSocket blocked by KillSwitch');
        }
      };
    `);
  }
  
  deactivate(): void {
    this.isActive = false;
  }
}
```

### 性能优化

1. **端口分配优化**：使用位图（Bitmap）快速查找可用端口
2. **指纹脚本缓存**：缓存生成的指纹脚本，避免重复生成
3. **代理连接池**：复用代理连接，减少握手开销
4. **异步操作**：所有 I/O 操作使用异步，避免阻塞主线程

### 安全考虑

1. **密码加密**：代理密码使用 AES-256 加密存储
2. **日志脱敏**：日志中不记录完整的代理密码和敏感信息
3. **权限最小化**：代理中继服务仅监听 127.0.0.1，不暴露到外网
4. **输入验证**：所有用户输入必须经过严格验证

## Deployment and Rollout

### 分阶段部署

#### Phase 1: 代理中继服务（2 周）
- 实现 ProxyRelayService
- 实现端口分配和管理
- 集成到现有的 ProxySecurityManager
- 测试代理连通性和流量转发

#### Phase 2: 基础指纹管理（3 周）
- 实现 FingerprintService
- 实现 User-Agent、WebGL、Canvas、Audio 指纹
- 实现指纹注入机制
- 测试指纹覆盖正确性

#### Phase 3: 环境属性和设备信息（2 周）
- 实现时区、地理位置、语言配置
- 实现设备信息（CPU、内存、分辨率等）
- 实现 Cookie 管理
- 测试环境属性正确性

#### Phase 4: 高级功能（3 周）
- 实现一键生成指纹
- 实现指纹检测验证
- 实现指纹模板管理
- 实现批量操作

#### Phase 5: 进程监督和恢复（2 周）
- 实现 ProfileSupervisor
- 实现心跳检测
- 实现自动恢复机制
- 测试稳定性和可靠性

#### Phase 6: UI 和用户体验（2 周）
- 实现指纹配置界面
- 实现代理管理界面
- 实现状态监控界面
- 用户测试和反馈

### 兼容性保证

- **向后兼容**：新系统必须能够加载旧版本的账号配置
- **数据迁移**：提供自动迁移工具，将旧配置转换为新格式
- **降级方案**：如果指纹功能失败，降级到真实模式（不影响基本功能）

### 监控和日志

- **性能监控**：监控代理中继的吞吐量、延迟、错误率
- **安全监控**：监控 IP 泄露尝试、端口扫描尝试
- **用户行为监控**：监控指纹配置的使用情况、检测结果

## Future Enhancements

1. **云端指纹库**：从远程服务器同步最新的真实设备指纹
2. **AI 指纹生成**：使用机器学习生成更真实的指纹组合
3. **指纹评分系统**：为每个指纹配置评分，帮助用户选择最安全的配置
4. **代理质量评估**：自动评估代理的质量（速度、稳定性、匿名性）
5. **指纹市场**：用户可以分享和购买高质量的指纹模板
