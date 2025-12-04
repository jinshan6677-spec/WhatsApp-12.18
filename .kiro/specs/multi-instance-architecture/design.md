# Design Document

## Overview

本设计文档描述了 WhatsApp Desktop 应用从单实例架构升级到本地多实例浏览器隔离架构的技术实现方案。该架构通过为每个 WhatsApp 账号创建独立的 Electron BrowserWindow 实例，实现完全的进程级隔离、存储隔离和网络隔离，同时保持本地高性能渲染和现有翻译功能的完全兼容性。

### 核心设计原则

1. **完全隔离**：每个账号实例拥有独立的进程、存储和网络出口
2. **本地渲染**：所有 UI 渲染在本地执行，确保零延迟体验
3. **向后兼容**：保持现有翻译系统的完整功能
4. **可扩展性**：支持 30+ 个并发账号实例
5. **稳定性优先**：单个实例崩溃不影响其他实例

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Electron Process                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Main Application Window                   │  │
│  │  - Account List UI                                     │  │
│  │  - Account Configuration UI                            │  │
│  │  - Status Dashboard                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Instance Manager                          │  │
│  │  - createInstance()                                    │  │
│  │  - destroyInstance()                                   │  │
│  │  - monitorInstance()                                   │  │
│  │  - restartInstance()                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Account Configuration Manager                │  │
│  │  - loadAccounts()                                      │  │
│  │  - saveAccount()                                       │  │
│  │  - deleteAccount()                                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Account Instance│  │ Account Instance│  │ Account Instance│
│    (Process 1)  │  │    (Process 2)  │  │    (Process N)  │
│                 │  │                 │  │                 │
│ BrowserWindow   │  │ BrowserWindow   │  │ BrowserWindow   │
│ - userDataDir:  │  │ - userDataDir:  │  │ - userDataDir:  │
│   profiles/001  │  │   profiles/002  │  │   profiles/00N  │
│ - proxy: IP1    │  │ - proxy: IP2    │  │ - proxy: IPN    │
│ - GPU rendering │  │ - GPU rendering │  │ - GPU rendering │
│                 │  │                 │  │                 │
│ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │
│ │ WhatsApp Web│ │  │ │ WhatsApp Web│ │  │ │ WhatsApp Web│ │
│ │ + Translation│ │  │ │ + Translation│ │  │ │ + Translation│ │
│ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 架构层次

1. **主进程层（Main Process Layer）**
   - 负责应用生命周期管理
   - 提供账号管理 UI
   - 协调所有账号实例

2. **实例管理层（Instance Management Layer）**
   - 创建和销毁账号实例
   - 监控实例健康状态
   - 处理实例崩溃和重启

3. **账号实例层（Account Instance Layer）**
   - 独立的 BrowserWindow 进程
   - 独立的存储和网络配置
   - 本地渲染 WhatsApp Web

4. **翻译服务层（Translation Service Layer）**
   - 注入到每个实例的 DOM
   - 独立的翻译配置和缓存
   - 与现有翻译系统完全兼容

## Components and Interfaces

### 1. Main Application Window

主应用窗口，提供账号管理界面。

**职责：**
- 显示所有账号列表
- 提供添加/删除/配置账号的 UI
- 显示账号状态和通知
- 处理用户交互

**接口：**
```javascript
class MainApplicationWindow {
  constructor()
  
  // 初始化主窗口
  initialize()
  
  // 显示账号列表
  renderAccountList(accounts)
  
  // 显示账号配置对话框
  showAccountConfig(accountId)
  
  // 更新账号状态显示
  updateAccountStatus(accountId, status)
  
  // 显示通知
  showNotification(accountId, message)
}
```

### 2. Instance Manager

核心组件，负责管理所有账号实例的生命周期。

**职责：**
- 创建独立的 BrowserWindow 实例
- 配置独立的 userDataDir
- 应用代理配置
- 监控实例状态
- 处理崩溃和重启
- 注入翻译脚本

**接口：**
```javascript
class InstanceManager {
  constructor()
  
  // 创建新的账号实例
  async createInstance(accountConfig) {
    // 返回 { instanceId, window, status }
  }
  
  // 销毁账号实例
  async destroyInstance(instanceId)
  
  // 重启账号实例
  async restartInstance(instanceId)
  
  // 获取实例状态
  getInstanceStatus(instanceId) {
    // 返回 { status, memory, cpu, lastActive }
  }
  
  // 监控所有实例
  monitorInstances()
  
  // 注入翻译脚本
  injectTranslationScripts(instanceId)
  
  // 应用代理配置
  applyProxyConfig(instanceId, proxyConfig)
  
  // 获取所有运行中的实例
  getRunningInstances()
}
```

**实现细节：**

```javascript
// 创建实例的核心逻辑
async createInstance(accountConfig) {
  const { id, name, proxy, translation } = accountConfig;
  
  // 1. 创建独立的 userDataDir
  const userDataDir = path.join(app.getPath('userData'), 'profiles', id);
  await fs.ensureDir(userDataDir);
  
  // 2. 创建独立的 session
  const partition = `persist:account_${id}`;
  const session = require('electron').session.fromPartition(partition, {
    cache: true
  });
  
  // 3. 配置代理
  if (proxy && proxy.enabled) {
    await session.setProxy({
      proxyRules: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
      proxyBypassRules: proxy.bypass || ''
    });
  }
  
  // 4. 创建 BrowserWindow
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    title: `WhatsApp - ${name}`,
    webPreferences: {
      partition: partition,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  // 5. 设置 User-Agent
  const chromeVersion = process.versions.chrome;
  const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  window.webContents.setUserAgent(userAgent);
  
  // 6. 加载 WhatsApp Web
  await window.loadURL('https://web.whatsapp.com');
  
  // 7. 注入翻译脚本
  window.webContents.on('did-finish-load', () => {
    this.injectTranslationScripts(id, window, translation);
  });
  
  // 8. 监控实例
  this.setupInstanceMonitoring(id, window);
  
  return { instanceId: id, window, status: 'running' };
}
```

### 3. Account Configuration Manager

管理账号配置的持久化存储。

**职责：**
- 加载和保存账号配置
- 验证配置有效性
- 管理配置文件

**接口：**
```javascript
class AccountConfigManager {
  constructor(configPath)
  
  // 加载所有账号配置
  async loadAccounts()
  
  // 保存账号配置
  async saveAccount(accountConfig)
  
  // 删除账号配置
  async deleteAccount(accountId)
  
  // 获取单个账号配置
  getAccount(accountId)
  
  // 更新账号配置
  async updateAccount(accountId, updates)
  
  // 验证配置
  validateConfig(accountConfig)
}
```

### 4. Account Instance

代表单个账号的运行实例。

**职责：**
- 封装 BrowserWindow
- 管理实例状态
- 处理实例事件

**接口：**
```javascript
class AccountInstance {
  constructor(config, window)
  
  // 实例 ID
  id
  
  // 实例名称
  name
  
  // BrowserWindow 对象
  window
  
  // 实例状态
  status // 'stopped' | 'starting' | 'running' | 'error'
  
  // 代理配置
  proxyConfig
  
  // 翻译配置
  translationConfig
  
  // 启动实例
  async start()
  
  // 停止实例
  async stop()
  
  // 重启实例
  async restart()
  
  // 获取健康状态
  getHealthStatus()
  
  // 发送 IPC 消息
  sendMessage(channel, data)
}
```

### 5. Translation Integration

翻译系统集成模块，确保现有翻译功能在多实例环境中正常工作。

**职责：**
- 为每个实例注入翻译脚本
- 管理每个实例的翻译配置
- 维护独立的翻译缓存

**接口：**
```javascript
class TranslationIntegration {
  constructor(instanceManager)
  
  // 为实例注入翻译脚本
  async injectScripts(instanceId, window)
  
  // 配置实例的翻译设置
  async configureTranslation(instanceId, config)
  
  // 获取实例的翻译状态
  getTranslationStatus(instanceId)
  
  // 清除实例的翻译缓存
  clearCache(instanceId)
}
```

## Data Models

### Account Configuration

账号配置数据模型。

```typescript
interface AccountConfig {
  // 唯一标识符（UUID）
  id: string;
  
  // 账号名称
  name: string;
  
  // 创建时间
  createdAt: Date;
  
  // 最后活跃时间
  lastActiveAt: Date;
  
  // 代理配置
  proxy: {
    enabled: boolean;
    protocol: 'socks5' | 'http' | 'https';
    host: string;
    port: number;
    username?: string;
    password?: string;
    bypass?: string;
  };
  
  // 翻译配置
  translation: {
    enabled: boolean;
    targetLanguage: string;
    engine: 'google' | 'gpt4' | 'gemini' | 'deepseek';
    apiKey?: string;
    autoTranslate: boolean;
    translateInput: boolean;
    friendSettings: Record<string, FriendTranslationConfig>;
  };
  
  // 窗口配置
  window: {
    x?: number;
    y?: number;
    width: number;
    height: number;
    minimized: boolean;
  };
  
  // 通知配置
  notifications: {
    enabled: boolean;
    sound: boolean;
    badge: boolean;
  };
}
```

### Instance Status

实例状态数据模型。

```typescript
interface InstanceStatus {
  // 实例 ID
  instanceId: string;
  
  // 状态
  status: 'stopped' | 'starting' | 'running' | 'error' | 'crashed';
  
  // 进程 ID
  pid?: number;
  
  // 内存使用（MB）
  memoryUsage: number;
  
  // CPU 使用率（%）
  cpuUsage: number;
  
  // 启动时间
  startTime?: Date;
  
  // 最后心跳时间
  lastHeartbeat: Date;
  
  // 崩溃次数
  crashCount: number;
  
  // 错误信息
  error?: string;
  
  // 是否已登录
  isLoggedIn: boolean;
  
  // 未读消息数
  unreadCount: number;
}
```

### Application State

应用全局状态。

```typescript
interface ApplicationState {
  // 所有账号配置
  accounts: Map<string, AccountConfig>;
  
  // 所有实例状态
  instances: Map<string, InstanceStatus>;
  
  // 系统资源使用
  systemResources: {
    totalMemory: number;
    usedMemory: number;
    cpuUsage: number;
  };
  
  // 应用配置
  appConfig: {
    maxConcurrentInstances: number;
    autoStart: boolean;
    minimizeToTray: boolean;
    theme: 'light' | 'dark' | 'system';
  };
}
```

## Error Handling

### 错误类型

1. **实例创建失败**
   - 原因：资源不足、配置错误
   - 处理：显示错误消息，不创建实例

2. **代理连接失败**
   - 原因：代理服务器不可达、认证失败
   - 处理：显示错误消息，提供重试选项

3. **实例崩溃**
   - 原因：内存溢出、渲染进程崩溃
   - 处理：记录日志，提供重启选项，超过阈值后停止自动重启

4. **会话过期**
   - 原因：WhatsApp 会话过期
   - 处理：显示二维码，等待用户重新登录

5. **翻译服务失败**
   - 原因：API 密钥无效、网络错误
   - 处理：显示错误消息，降级到无翻译模式

### 错误处理策略

```javascript
class ErrorHandler {
  // 处理实例崩溃
  handleInstanceCrash(instanceId, error) {
    const status = this.instanceManager.getInstanceStatus(instanceId);
    
    // 增加崩溃计数
    status.crashCount++;
    
    // 记录日志
    logger.error(`Instance ${instanceId} crashed`, error);
    
    // 判断是否自动重启
    if (status.crashCount < 3) {
      // 延迟重启
      setTimeout(() => {
        this.instanceManager.restartInstance(instanceId);
      }, 5000);
    } else {
      // 标记为失败
      status.status = 'failed';
      this.mainWindow.showNotification(instanceId, 
        'Instance crashed multiple times. Please check configuration.');
    }
  }
  
  // 处理代理错误
  handleProxyError(instanceId, error) {
    logger.error(`Proxy error for instance ${instanceId}`, error);
    this.mainWindow.showNotification(instanceId,
      'Proxy connection failed. Please check proxy settings.');
  }
  
  // 处理翻译错误
  handleTranslationError(instanceId, error) {
    logger.warn(`Translation error for instance ${instanceId}`, error);
    // 翻译失败不影响核心功能，只记录警告
  }
}
```

## Testing Strategy

### 单元测试

测试各个组件的独立功能。

**测试范围：**
- AccountConfigManager 的配置加载/保存
- InstanceManager 的实例创建/销毁逻辑
- 代理配置的验证逻辑
- 翻译配置的验证逻辑

**测试工具：** Jest

### 集成测试

测试组件之间的交互。

**测试场景：**
- 创建账号 → 启动实例 → 注入翻译 → 验证运行
- 配置代理 → 启动实例 → 验证网络流量
- 实例崩溃 → 自动重启 → 验证状态恢复
- 多实例并发 → 验证隔离性

### 性能测试

测试系统在高负载下的表现。

**测试场景：**
- 同时运行 30 个实例
- 测量内存使用
- 测量 CPU 使用
- 测量启动时间
- 测量响应延迟

### 手动测试

验证用户体验和边缘情况。

**测试清单：**
- [ ] 添加/删除账号流程
- [ ] 配置代理并验证 IP
- [ ] 扫码登录并验证会话持久化
- [ ] 翻译功能在多实例中正常工作
- [ ] 实例崩溃后的恢复
- [ ] 窗口位置和大小的保存/恢复
- [ ] 通知功能
- [ ] 系统托盘集成

## Security Considerations

### 1. 会话数据保护

- 每个账号的 userDataDir 设置适当的文件系统权限
- 敏感配置（如代理密码、API 密钥）使用加密存储
- 定期清理过期的会话数据

### 2. 代理认证

- 代理密码不以明文存储
- 使用系统密钥链（keytar）存储敏感信息
- 支持环境变量配置

### 3. 进程隔离

- 每个实例运行在独立的沙箱中
- 禁用 nodeIntegration
- 启用 contextIsolation
- 使用 sandbox 模式

### 4. 网络安全

- 验证代理服务器证书
- 支持 HTTPS 代理
- 记录所有网络错误

## Performance Optimization

### 1. 资源管理

- 实现实例池，复用已停止的实例
- 延迟加载：只在需要时启动实例
- 内存限制：为每个实例设置内存上限
- 自动清理：定期清理未使用的缓存

### 2. 启动优化

- 并行创建多个实例
- 预加载常用资源
- 缓存翻译脚本

### 3. 渲染优化

- 启用 GPU 加速
- 使用硬件加速
- 优化 DOM 操作

### 4. 监控优化

- 使用节流的心跳检测
- 批量更新状态
- 异步日志记录

## Migration Strategy

从现有单实例架构迁移到多实例架构。

### 迁移步骤

1. **保留现有会话数据**
   - 将现有 `session-data/` 目录迁移到 `profiles/default/`
   - 创建默认账号配置

2. **向后兼容**
   - 首次启动时自动创建默认账号
   - 保持现有翻译配置

3. **数据迁移**
   ```javascript
   async migrateFromSingleInstance() {
     const oldSessionPath = path.join(app.getPath('userData'), 'session-data');
     const newProfilePath = path.join(app.getPath('userData'), 'profiles', 'default');
     
     if (await fs.pathExists(oldSessionPath)) {
       await fs.move(oldSessionPath, newProfilePath);
       
       // 创建默认账号配置
       const defaultAccount = {
         id: 'default',
         name: 'Default Account',
         createdAt: new Date(),
         proxy: { enabled: false },
         translation: { /* 从现有配置加载 */ }
       };
       
       await this.configManager.saveAccount(defaultAccount);
     }
   }
   ```

4. **用户通知**
   - 首次启动显示迁移说明
   - 提供文档链接

## Deployment Considerations

### 打包配置

更新 `electron-builder` 配置以包含新的目录结构。

```json
{
  "build": {
    "files": [
      "src/**/*",
      "!src/**/*.test.js"
    ],
    "extraResources": [
      {
        "from": "profiles",
        "to": "profiles",
        "filter": ["**/*"]
      }
    ]
  }
}
```

### 系统要求

- **最低配置：** 8GB RAM，支持 5 个并发实例
- **推荐配置：** 16GB RAM，支持 30 个并发实例
- **操作系统：** Windows 10+, macOS 10.14+, Linux (Ubuntu 20.04+)

### 更新策略

- 支持自动更新
- 保留用户配置和会话数据
- 提供回滚机制

## Future Enhancements

### 短期（1-3 个月）

- [ ] 实例分组功能
- [ ] 批量操作（批量启动/停止）
- [ ] 导入/导出账号配置
- [ ] 更丰富的状态监控

### 中期（3-6 个月）

- [ ] 云同步账号配置
- [ ] 自动化消息处理
- [ ] 高级代理轮换
- [ ] 性能分析工具

### 长期（6-12 个月）

- [ ] 插件系统
- [ ] API 接口
- [ ] 移动端管理应用
- [ ] 集群部署支持
