# Design Document

## Overview

本文档描述了 WhatsApp Desktop 应用中手动控制账号启动和停止功能的技术设计。该功能允许用户通过账号列表中的按钮手动打开或关闭特定的 WhatsApp 账号，而不是在应用启动时自动加载所有账号。

### 当前架构

现有的单窗口架构包括：
- **MainWindow**: 管理主应用窗口
- **ViewManager**: 管理 BrowserView 实例的生命周期
- **AccountConfigManager**: 管理账号配置
- **SessionManager**: 处理会话持久化
- **账号侧边栏**: 显示账号列表的 HTML/CSS 界面

### 目标架构

新功能将增强现有架构：
- **延迟加载**: 仅在用户请求时创建 BrowserView
- **手动控制**: 通过 UI 按钮控制账号的打开和关闭
- **状态管理**: 跟踪每个账号的运行状态（未启动、加载中、已连接、已关闭）
- **资源优化**: 关闭账号时释放内存和网络资源

## Architecture

### 高层组件结构

```
┌─────────────────────────────────────────────────────────┐
│                    Main Window                          │
│  ┌──────────────┬───────────────────────────────────┐  │
│  │              │                                   │  │
│  │   Account    │      BrowserView Container        │  │
│  │   Sidebar    │                                   │  │
│  │              │                                   │  │
│  │  ┌────────┐  │   ┌───────────────────────────┐   │  │
│  │  │Account1│  │   │                           │   │  │
│  │  │[打开]  │  │   │   Active BrowserView      │   │  │
│  │  └────────┘  │   │   (WhatsApp Web)          │   │  │
│  │  ┌────────┐  │   │                           │   │  │
│  │  │Account2│  │   │                           │   │  │
│  │  │[关闭]  │  │   └───────────────────────────┘   │  │
│  │  └────────┘  │                                   │  │
│  │  ┌────────┐  │   未启动的账号:                    │  │
│  │  │Account3│  │   - Account3 (无 BrowserView)     │  │
│  │  │[打开]  │  │                                   │  │
│  │  └────────┘  │                                   │  │
│  │              │                                   │  │
│  └──────────────┴───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 状态转换图

```
未启动 ──[点击打开]──> 加载中 ──[加载成功]──> 已连接
                                  │
                                  └──[加载失败]──> 错误状态
                                  
已连接 ──[点击关闭]──> 关闭中 ──[关闭完成]──> 未启动
```


## Components and Interfaces

### 1. ViewManager 增强

**新增方法**:

```javascript
class ViewManager {
  /**
   * 打开账号 - 创建并显示 BrowserView
   * @param {string} accountId - 账号 ID
   * @param {Object} config - 账号配置
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async openAccount(accountId, config) {
    // 1. 检查账号是否已打开
    // 2. 创建 BrowserView (如果不存在)
    // 3. 加载 WhatsApp Web
    // 4. 更新账号状态
    // 5. 通知 UI 更新
  }

  /**
   * 关闭账号 - 销毁 BrowserView 并释放资源
   * @param {string} accountId - 账号 ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async closeAccount(accountId) {
    // 1. 检查账号是否已打开
    // 2. 隐藏 BrowserView (如果是当前活动账号)
    // 3. 销毁 BrowserView
    // 4. 清理资源
    // 5. 更新账号状态
    // 6. 通知 UI 更新
  }

  /**
   * 获取账号运行状态
   * @param {string} accountId - 账号 ID
   * @returns {string} 状态: 'not_started' | 'loading' | 'connected' | 'error'
   */
  getAccountRunningStatus(accountId) {
    // 返回账号的当前运行状态
  }

  /**
   * 检查账号是否正在运行
   * @param {string} accountId - 账号 ID
   * @returns {boolean}
   */
  isAccountRunning(accountId) {
    // 检查账号是否有活动的 BrowserView
  }
}
```

### 2. IPC 通信接口

**主进程 → 渲染进程**:

```javascript
// 账号状态变化通知
ipcMain.on('account-status-changed', (event, data) => {
  // data: { accountId, status, timestamp }
});

// 账号打开成功
ipcMain.on('account-opened', (event, data) => {
  // data: { accountId, timestamp }
});

// 账号关闭成功
ipcMain.on('account-closed', (event, data) => {
  // data: { accountId, timestamp }
});

// 账号操作失败
ipcMain.on('account-operation-failed', (event, data) => {
  // data: { accountId, operation, error, timestamp }
});
```

**渲染进程 → 主进程**:

```javascript
// 请求打开账号
ipcRenderer.invoke('open-account', accountId);

// 请求关闭账号
ipcRenderer.invoke('close-account', accountId);

// 获取账号状态
ipcRenderer.invoke('get-account-status', accountId);

// 获取所有账号状态
ipcRenderer.invoke('get-all-account-statuses');
```

### 3. UI 组件更新

**账号列表项结构**:

```html
<div class="account-item" data-account-id="acc_001" data-status="not_started">
  <div class="account-avatar"></div>
  <div class="account-info">
    <div class="account-name">WhatsApp Business</div>
    <div class="account-status">
      <span class="status-indicator not-started"></span>
      <span class="status-text">未启动</span>
    </div>
  </div>
  <div class="account-actions">
    <!-- 打开按钮 (仅在未启动时显示) -->
    <button class="open-btn" data-action="open">
      <span class="icon">▶</span>
      <span class="text">打开</span>
    </button>
    
    <!-- 关闭按钮 (仅在已连接时显示) -->
    <button class="close-btn" data-action="close" style="display: none;">
      <span class="icon">⏹</span>
      <span class="text">关闭</span>
    </button>
    
    <!-- 加载指示器 (仅在加载中时显示) -->
    <div class="loading-indicator" style="display: none;">
      <span class="spinner"></span>
      <span class="text">加载中...</span>
    </div>
    
    <!-- 其他操作按钮 -->
    <button class="edit-btn">⚙️</button>
    <button class="delete-btn">🗑️</button>
  </div>
</div>
```


## Data Models

### 账号运行状态

```javascript
{
  accountId: String,           // 账号 ID
  runningStatus: String,       // 'not_started' | 'loading' | 'connected' | 'error'
  hasView: Boolean,            // 是否有 BrowserView 实例
  isVisible: Boolean,          // BrowserView 是否可见
  lastOpened: Date,            // 最后打开时间
  lastClosed: Date,            // 最后关闭时间
  memoryUsage: Number,         // 内存占用 (MB)
  error: {                     // 错误信息 (如果有)
    message: String,
    code: String,
    timestamp: Date
  }
}
```

### 账号配置扩展

在现有的 AccountConfig 模型中添加：

```javascript
{
  // ... 现有字段 ...
  
  autoStart: Boolean,          // 是否自动启动 (默认: false)
  keepAlive: Boolean,          // 关闭后是否保持会话 (默认: true)
  lastRunningStatus: String    // 上次运行状态
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. 
Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

在编写正确性属性之前，让我先分析每个验收标准的可测试性：

### Acceptence Criteria Testing Prework:

1.1 WHEN 应用程序启动时 THEN 系统 SHALL 显示主窗口和账号列表
Thoughts: 这是测试应用启动时的初始状态。我们可以启动应用，然后检查主窗口是否存在，账号列表是否被渲染。
Testable: yes - example

1.2 WHEN 应用程序启动时 THEN 系统 SHALL NOT 自动创建任何账号的 WebView
Thoughts: 这是一个通用规则，适用于所有账号。我们可以在应用启动后检查 ViewManager 中是否没有任何 BrowserView 实例。
Testable: yes - property

1.3 WHEN 应用程序启动时 THEN 系统 SHALL NOT 自动加载任何 WhatsApp Web 页面
Thoughts: 这与 1.2 相关，是检查没有 WebView 被创建的另一个方面。可以合并到 1.2 的属性中。
Testable: yes - property (与 1.2 合并)

1.4 WHEN 账号列表显示时 THEN 系统 SHALL 显示所有账号的状态为"未启动"
Thoughts: 这是测试所有账号的初始状态。我们可以生成随机数量的账号，启动应用，然后检查所有账号的状态。
Testable: yes - property

1.5 WHEN 应用程序启动时 THEN 系统 SHALL 保持内存占用在最小水平
Thoughts: 这是性能测试，涉及测量内存使用。虽然可以测试，但"最小水平"是主观的。
Testable: no

2.1 WHEN 账号状态为"未启动"时 THEN 账号列表 SHALL 显示"打开"按钮
Thoughts: 这是 UI 渲染规则。我们可以生成随机账号，设置状态为"未启动"，然后检查渲染的 HTML 是否包含打开按钮。
Testable: yes - property

2.2 WHEN 账号状态为"加载中"或"已连接"时 THEN 账号列表 SHALL NOT 显示"打开"按钮
Thoughts: 这是 UI 渲染规则的反面。可以测试当状态不是"未启动"时，打开按钮不应该显示。
Testable: yes - property

2.3 THE "打开"按钮 SHALL 清晰可见且易于点击
Thoughts: 这是 UI 设计要求，涉及主观判断（"清晰可见"、"易于点击"）。
Testable: no

2.4 THE "打开"按钮 SHALL 使用直观的图标或文字标识
Thoughts: 这是 UI 设计要求，涉及主观判断（"直观"）。
Testable: no

2.5 WHEN 鼠标悬停在"打开"按钮上时 THEN 系统 SHALL 显示提示信息
Thoughts: 这是 UI 交互测试。我们可以模拟鼠标悬停事件，然后检查是否显示了提示信息。
Testable: yes - example

3.1 WHEN 用户点击"打开"按钮时 THEN ViewManager SHALL 为该账号创建 WebView
Thoughts: 这是核心功能测试。我们可以生成随机账号，调用打开操作，然后检查 ViewManager 是否创建了 WebView。
Testable: yes - property

3.2 WHEN WebView 创建后 THEN 系统 SHALL 加载 WhatsApp Web 页面
Thoughts: 这是测试 WebView 创建后的行为。可以检查 WebView 的 URL 是否指向 WhatsApp Web。
Testable: yes - property

3.3 WHEN 加载开始时 THEN 账号状态 SHALL 更新为"加载中"
Thoughts: 这是状态转换测试。我们可以触发加载，然后检查状态是否更新。
Testable: yes - property

3.4 WHEN WhatsApp Web 成功加载后 THEN 账号状态 SHALL 更新为"已连接"
Thoughts: 这是状态转换测试。我们可以等待加载完成，然后检查状态。
Testable: yes - property

3.5 WHEN 账号打开时 THEN 系统 SHALL 在会话区域显示该账号的 WebView
Thoughts: 这是 UI 显示测试。我们可以检查 WebView 是否被添加到主窗口并设置为可见。
Testable: yes - property

4.1 WHEN 账号状态为"已连接"时 THEN 账号列表 SHALL 显示"关闭"按钮
Thoughts: 这是 UI 渲染规则。类似于 2.1，可以测试。
Testable: yes - property

4.2 WHEN 账号状态为"未启动"时 THEN 账号列表 SHALL NOT 显示"关闭"按钮
Thoughts: 这是 UI 渲染规则的反面。
Testable: yes - property

4.3 THE "关闭"按钮 SHALL 清晰可见且易于点击
Thoughts: UI 设计要求，主观判断。
Testable: no

4.4 THE "关闭"按钮 SHALL 使用直观的图标或文字标识
Thoughts: UI 设计要求，主观判断。
Testable: no

4.5 WHEN 鼠标悬停在"关闭"按钮上时 THEN 系统 SHALL 显示提示信息
Thoughts: UI 交互测试，类似于 2.5。
Testable: yes - example

5.1 WHEN 用户点击"关闭"按钮时 THEN ViewManager SHALL 销毁该账号的 WebView
Thoughts: 这是核心功能测试。我们可以先打开账号，然后关闭，检查 WebView 是否被销毁。
Testable: yes - property

5.2 WHEN WebView 销毁时 THEN 系统 SHALL 断开 WhatsApp Web 连接
Thoughts: 这是 WebView 销毁的副作用。可以通过检查 WebView 是否被销毁来间接测试。
Testable: yes - property (与 5.1 合并)

5.3 WHEN 关闭完成后 THEN 账号状态 SHALL 更新为"未启动"
Thoughts: 这是状态转换测试。
Testable: yes - property

5.4 WHEN 账号关闭时 THEN 系统 SHALL 从会话区域移除该账号的 WebView
Thoughts: 这是 UI 更新测试。可以检查 WebView 是否从主窗口移除。
Testable: yes - property

5.5 WHEN 账号关闭时 THEN 系统 SHALL 释放该账号占用的内存资源
Thoughts: 这是资源管理测试。我们可以测量关闭前后的内存使用，但"释放"的程度取决于垃圾回收。
Testable: edge-case

6.1 THE 账号列表 SHALL 为每个账号显示状态指示器
Thoughts: 这是 UI 渲染要求。我们可以生成随机账号，然后检查每个账号是否有状态指示器。
Testable: yes - property

6.2 WHEN 账号未启动时 THEN 状态指示器 SHALL 显示灰色或"未启动"标识
Thoughts: 这是 UI 渲染规则。可以测试特定状态下的渲染结果。
Testable: yes - example

6.3 WHEN 账号加载中时 THEN 状态指示器 SHALL 显示加载动画或"加载中"标识
Thoughts: 这是 UI 渲染规则。
Testable: yes - example

6.4 WHEN 账号已连接时 THEN 状态指示器 SHALL 显示绿色或"在线"标识
Thoughts: 这是 UI 渲染规则。
Testable: yes - example

6.5 WHEN 账号状态变化时 THEN 状态指示器 SHALL 实时更新
Thoughts: 这是 UI 响应性测试。我们可以改变账号状态，然后检查 UI 是否更新。
Testable: yes - property

7.1 WHEN 账号关闭时 THEN SessionManager SHALL 保留该账号的会话数据
Thoughts: 这是会话持久化测试。我们可以关闭账号，然后检查会话数据目录是否仍然存在。
Testable: yes - property

7.2 WHEN 账号关闭时 THEN 系统 SHALL 保存 cookies、localStorage 和 IndexedDB 数据
Thoughts: 这是会话持久化的具体方面。可以检查这些数据是否被保存。
Testable: yes - property

7.3 WHEN 账号重新打开时 THEN SessionManager SHALL 恢复之前的会话数据
Thoughts: 这是会话恢复测试。这是一个往返属性：关闭然后重新打开应该恢复状态。
Testable: yes - property

7.4 WHEN 账号重新打开时 THEN WhatsApp Web SHALL 自动恢复登录状态
Thoughts: 这是会话恢复的结果。可以通过检查登录状态来测试。
Testable: yes - property

7.5 WHEN 账号重新打开时 THEN 用户 SHALL NOT 需要重新扫描 QR 码
Thoughts: 这是 7.4 的另一种表述。可以合并。
Testable: yes - property (与 7.4 合并)

8.1 THE 系统 SHALL 允许同时打开多个账号
Thoughts: 这是测试系统能否处理多个并发账号。我们可以生成多个账号，同时打开它们，然后检查所有账号是否都在运行。
Testable: yes - property

8.2 THE 系统 SHALL 允许关闭任意已打开的账号而不影响其他账号
Thoughts: 这是测试账号独立性。我们可以打开多个账号，关闭其中一个，然后检查其他账号是否仍在运行。
Testable: yes - property

8.3 WHEN 一个账号打开或关闭时 THEN 其他账号的状态 SHALL 保持不变
Thoughts: 这是账号独立性的另一个方面。可以与 8.2 合并。
Testable: yes - property (与 8.2 合并)

8.4 WHEN 一个账号打开或关闭时 THEN 其他账号的连接 SHALL 不受影响
Thoughts: 这是账号独立性的连接方面。可以与 8.2 合并。
Testable: yes - property (与 8.2 合并)

8.5 THE 系统 SHALL 支持任意顺序的账号打开和关闭操作
Thoughts: 这是测试操作顺序的独立性。我们可以生成随机的打开/关闭操作序列，然后验证系统状态的一致性。
Testable: yes - property

9.1 WHEN 账号打开失败时 THEN 系统 SHALL 显示错误消息
Thoughts: 这是错误处理测试。我们可以模拟打开失败的情况，然后检查是否显示了错误消息。
Testable: yes - example

9.2 WHEN 账号关闭失败时 THEN 系统 SHALL 显示错误消息
Thoughts: 这是错误处理测试。
Testable: yes - example

9.3 WHEN 发生错误时 THEN 账号状态 SHALL 更新为"错误"状态
Thoughts: 这是错误状态转换测试。
Testable: yes - property

9.4 WHEN 发生错误时 THEN 系统 SHALL 在账号列表中显示错误指示器
Thoughts: 这是 UI 错误显示测试。
Testable: yes - property

9.5 WHEN 错误发生后 THEN 用户 SHALL 能够重试打开或关闭操作
Thoughts: 这是错误恢复测试。我们可以触发错误，然后尝试重试操作。
Testable: yes - property

10.1 WHEN 用户点击"打开"按钮时 THEN 系统 SHALL 在 2 秒内开始加载 WhatsApp Web
Thoughts: 这是性能测试，涉及时间测量。虽然可以测试，但 2 秒是一个具体的阈值，可能因环境而异。
Testable: edge-case

10.2 WHEN 用户点击"关闭"按钮时 THEN 系统 SHALL 在 1 秒内完成 WebView 销毁
Thoughts: 这是性能测试。
Testable: edge-case

10.3 WHEN 账号关闭时 THEN 系统 SHALL 立即释放至少 80% 的该账号占用内存
Thoughts: 这是性能测试，涉及内存测量。80% 是一个具体的阈值。
Testable: edge-case

10.4 WHEN 多个账号同时操作时 THEN 系统 SHALL 保持界面响应性
Thoughts: 这是性能测试，"响应性"是主观的。
Testable: no

10.5 THE 系统 SHALL 限制同时打开的账号数量以避免性能问题
Thoughts: 这是资源限制测试。我们可以尝试打开超过限制的账号数量，然后检查系统是否拒绝。
Testable: yes - property

11.1 THE AccountManager SHALL 为每个账号提供"自动启动"配置选项
Thoughts: 这是配置管理测试。我们可以检查账号配置是否包含 autoStart 字段。
Testable: yes - property

11.2 WHEN 账号的"自动启动"选项启用时 THEN 应用启动时 SHALL 自动打开该账号
Thoughts: 这是自动启动功能测试。我们可以设置 autoStart 为 true，重启应用，然后检查账号是否自动打开。
Testable: yes - property

11.3 WHEN 账号的"自动启动"选项禁用时 THEN 应用启动时 SHALL NOT 自动打开该账号
Thoughts: 这是 11.2 的反面。
Testable: yes - property (与 11.2 合并)

11.4 THE 用户 SHALL 能够通过账号设置界面修改"自动启动"选项
Thoughts: 这是 UI 功能测试。我们可以通过 UI 修改设置，然后检查配置是否更新。
Testable: yes - example

11.5 THE "自动启动"配置 SHALL 在应用重启后保持有效
Thoughts: 这是配置持久化测试。这是一个往返属性：设置配置，重启应用，配置应该保持不变。
Testable: yes - property

12.1 WHEN 用户点击"打开"或"关闭"按钮时 THEN 系统 SHALL 显示加载指示器
Thoughts: 这是 UI 反馈测试。我们可以触发操作，然后检查是否显示了加载指示器。
Testable: yes - property

12.2 WHEN 操作进行中时 THEN 按钮 SHALL 显示为禁用状态
Thoughts: 这是 UI 状态测试。
Testable: yes - property

12.3 WHEN 操作完成时 THEN 系统 SHALL 移除加载指示器
Thoughts: 这是 UI 反馈测试。
Testable: yes - property

12.4 WHEN 操作完成时 THEN 按钮状态 SHALL 更新为新的可用状态
Thoughts: 这是 UI 状态测试。
Testable: yes - property

12.5 WHEN 操作失败时 THEN 系统 SHALL 显示错误动画或提示
Thoughts: 这是错误 UI 反馈测试。
Testable: yes - example


### Property Reflection

在编写正确性属性之前，让我审查所有可测试的属性，消除冗余：

**冗余分析**:
1. 属性 1.2 和 1.3 都测试应用启动时不创建 WebView，可以合并
2. 属性 2.1 和 2.2 测试打开按钮的显示逻辑，可以合并为一个属性
3. 属性 4.1 和 4.2 测试关闭按钮的显示逻辑，可以合并为一个属性
4. 属性 5.1 和 5.2 都测试关闭账号时销毁 WebView，可以合并
5. 属性 7.4 和 7.5 都测试会话恢复后的登录状态，可以合并
6. 属性 8.2、8.3 和 8.4 都测试账号独立性，可以合并为一个综合属性
7. 属性 11.2 和 11.3 测试自动启动的正反两面，可以合并

**保留的核心属性**:
- 应用启动行为（不自动加载）
- UI 按钮显示逻辑（基于状态）
- 账号打开/关闭的核心功能
- 状态转换的正确性
- 会话持久化和恢复
- 多账号独立性
- 错误处理和恢复
- 自动启动配置
- UI 反馈和响应性

### Correctness Properties

Property 1: 应用启动时不自动创建 WebView
*For any* 配置的账号集合，当应用启动时，ViewManager 中不应该存在任何 BrowserView 实例
**Validates: Requirements 1.2, 1.3**

Property 2: 初始账号状态为未启动
*For any* 配置的账号集合，当应用启动并显示账号列表时，所有账号的状态应该为"未启动"
**Validates: Requirements 1.4**

Property 3: 按钮显示基于账号状态
*For any* 账号和其状态，UI 渲染应该满足：当状态为"未启动"时显示"打开"按钮，当状态为"已连接"时显示"关闭"按钮，其他状态下两个按钮都不显示
**Validates: Requirements 2.1, 2.2, 4.1, 4.2**

Property 4: 打开账号创建 WebView
*For any* 账号，当调用打开操作时，ViewManager 应该为该账号创建一个 BrowserView 实例，并加载 WhatsApp Web URL
**Validates: Requirements 3.1, 3.2**

Property 5: 打开账号的状态转换
*For any* 账号，打开操作应该触发状态转换：未启动 → 加载中 → 已连接（成功时）或 错误（失败时）
**Validates: Requirements 3.3, 3.4**

Property 6: 打开账号显示 WebView
*For any* 账号，当账号成功打开时，该账号的 WebView 应该被添加到主窗口并设置为可见
**Validates: Requirements 3.5**

Property 7: 关闭账号销毁 WebView
*For any* 已打开的账号，当调用关闭操作时，ViewManager 应该销毁该账号的 BrowserView 实例，并从主窗口移除
**Validates: Requirements 5.1, 5.2, 5.4**

Property 8: 关闭账号的状态转换
*For any* 已打开的账号，关闭操作完成后，账号状态应该更新为"未启动"
**Validates: Requirements 5.3**

Property 9: 状态指示器显示
*For any* 账号，UI 应该为该账号显示状态指示器，且指示器的显示应该与账号的当前状态一致
**Validates: Requirements 6.1, 6.5**

Property 10: 会话数据持久化
*For any* 账号，当账号关闭时，SessionManager 应该保留该账号的会话数据目录和所有会话数据（cookies、localStorage、IndexedDB）
**Validates: Requirements 7.1, 7.2**

Property 11: 会话恢复往返
*For any* 已登录的账号，执行关闭然后重新打开操作后，账号应该自动恢复登录状态，无需重新扫描 QR 码
**Validates: Requirements 7.3, 7.4, 7.5**

Property 12: 多账号并发打开
*For any* 账号集合，系统应该允许同时打开多个账号，且所有账号都应该处于运行状态
**Validates: Requirements 8.1**

Property 13: 账号操作独立性
*For any* 已打开的多个账号，当对其中一个账号执行打开或关闭操作时，其他账号的状态和连接应该保持不变
**Validates: Requirements 8.2, 8.3, 8.4**

Property 14: 操作顺序独立性
*For any* 随机生成的账号打开/关闭操作序列，系统应该正确处理所有操作，最终状态应该与操作序列一致
**Validates: Requirements 8.5**

Property 15: 错误状态转换
*For any* 账号，当打开或关闭操作失败时，账号状态应该更新为"错误"状态，并在 UI 中显示错误指示器
**Validates: Requirements 9.3, 9.4**

Property 16: 错误后可重试
*For any* 处于错误状态的账号，用户应该能够重新尝试打开或关闭操作
**Validates: Requirements 9.5**

Property 17: 账号数量限制
*For any* 超过系统限制的账号数量，当尝试打开超过限制的账号时，系统应该拒绝操作并返回错误
**Validates: Requirements 10.5**

Property 18: 自动启动配置存在
*For any* 账号，AccountManager 应该为该账号提供 autoStart 配置字段
**Validates: Requirements 11.1**

Property 19: 自动启动行为
*For any* 账号，当 autoStart 设置为 true 时，应用启动时应该自动打开该账号；当设置为 false 时，应用启动时不应该自动打开该账号
**Validates: Requirements 11.2, 11.3**

Property 20: 自动启动配置持久化
*For any* 账号，设置 autoStart 配置后重启应用，配置应该保持不变
**Validates: Requirements 11.5**

Property 21: 操作时显示加载指示器
*For any* 账号，当执行打开或关闭操作时，UI 应该显示加载指示器，并禁用操作按钮
**Validates: Requirements 12.1, 12.2**

Property 22: 操作完成后更新 UI
*For any* 账号，当打开或关闭操作完成时，UI 应该移除加载指示器，并更新按钮状态为新的可用状态
**Validates: Requirements 12.3, 12.4**


## Error Handling

### 错误类别

1. **账号打开错误**
   - WebView 创建失败
   - WhatsApp Web 加载失败
   - 网络连接失败
   - 超过账号数量限制

2. **账号关闭错误**
   - WebView 销毁失败
   - 资源释放失败

3. **状态同步错误**
   - UI 状态与实际状态不一致
   - IPC 通信失败

4. **配置错误**
   - 账号配置无效
   - 自动启动配置错误

### 错误处理策略

**优雅降级**:
- 如果单个账号打开失败，不影响其他账号
- 如果 UI 更新失败，提供手动刷新选项
- 如果自动启动失败，记录错误但继续启动应用

**用户反馈**:
- 在账号列表中显示错误状态
- 显示具体的错误消息
- 提供重试按钮
- 记录错误日志供调试

**恢复机制**:
- 自动重试瞬态错误（网络超时等）
- 提供手动重试选项
- 清理失败的 WebView 实例
- 重置错误状态

## Testing Strategy

### 单元测试

**ViewManager 增强功能**:
- 测试 openAccount 方法
- 测试 closeAccount 方法
- 测试 getAccountRunningStatus 方法
- 测试 isAccountRunning 方法
- 测试错误处理逻辑

**IPC 处理器**:
- 测试 open-account IPC 处理
- 测试 close-account IPC 处理
- 测试 get-account-status IPC 处理
- 测试错误情况下的 IPC 响应

**UI 组件**:
- 测试按钮显示逻辑
- 测试状态指示器更新
- 测试加载指示器显示/隐藏
- 测试错误消息显示

### 属性测试

本功能将使用 **fast-check** 作为属性测试库（JavaScript/TypeScript 的标准 PBT 库）。

每个属性测试应该：
- 运行至少 100 次迭代
- 使用注释标记对应的设计文档属性
- 生成随机的账号配置和操作序列
- 验证系统状态的一致性

**属性测试标记格式**:
```javascript
/**
 * Feature: manual-account-control, Property 1: 应用启动时不自动创建 WebView
 * Validates: Requirements 1.2, 1.3
 */
```

**测试生成器**:
- 账号配置生成器：生成随机的账号 ID、名称、配置
- 操作序列生成器：生成随机的打开/关闭操作序列
- 状态生成器：生成各种账号状态组合

### 集成测试

**账号生命周期流程**:
- 创建账号 → 打开账号 → 加载 WhatsApp → 关闭账号 → 清理资源
- 打开多个账号 → 切换账号 → 关闭部分账号 → 验证独立性
- 设置自动启动 → 重启应用 → 验证自动打开

**会话持久化流程**:
- 打开账号 → 登录 WhatsApp → 关闭账号 → 重新打开 → 验证登录状态

**错误恢复流程**:
- 触发打开错误 → 显示错误状态 → 重试操作 → 验证恢复

### 端到端测试

**用户工作流**:
1. 启动应用 → 查看账号列表 → 所有账号未启动
2. 点击打开按钮 → 查看加载指示器 → WhatsApp 加载成功
3. 点击关闭按钮 → 账号关闭 → 资源释放
4. 打开多个账号 → 切换账号 → 验证独立性
5. 设置自动启动 → 重启应用 → 验证自动打开
6. 触发错误 → 查看错误消息 → 重试操作

**性能测试**:
- 测试打开 10 个账号的性能
- 测量账号打开/关闭的延迟
- 监控内存使用情况
- 测试并发操作的响应性


## Implementation Details

### ViewManager 方法实现细节

#### openAccount 方法

```javascript
async openAccount(accountId, config) {
  try {
    // 1. 验证账号 ID
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    // 2. 检查账号是否已打开
    if (this.hasView(accountId)) {
      this.log('warn', `Account ${accountId} is already open`);
      return { success: true, alreadyOpen: true };
    }

    // 3. 检查账号数量限制
    if (this.views.size >= this.options.maxConcurrentViews) {
      throw new Error(`Maximum concurrent accounts limit (${this.options.maxConcurrentViews}) reached`);
    }

    // 4. 通知 UI 开始打开
    this._notifyRenderer('account-opening', { accountId });

    // 5. 创建 BrowserView
    await this.createView(accountId, config);

    // 6. 显示 BrowserView
    await this.showView(accountId);

    // 7. 通知 UI 打开成功
    this._notifyRenderer('account-opened', { accountId });

    return { success: true };
  } catch (error) {
    this.log('error', `Failed to open account ${accountId}:`, error);
    
    // 通知 UI 打开失败
    this._notifyRenderer('account-open-failed', {
      accountId,
      error: error.message
    });

    return { success: false, error: error.message };
  }
}
```

#### closeAccount 方法

```javascript
async closeAccount(accountId) {
  try {
    // 1. 验证账号 ID
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    // 2. 检查账号是否已打开
    if (!this.hasView(accountId)) {
      this.log('warn', `Account ${accountId} is not open`);
      return { success: true, alreadyClosed: true };
    }

    // 3. 通知 UI 开始关闭
    this._notifyRenderer('account-closing', { accountId });

    // 4. 如果是当前活动账号，切换到其他账号或隐藏
    if (this.activeAccountId === accountId) {
      const otherAccountIds = Array.from(this.views.keys())
        .filter(id => id !== accountId);
      
      if (otherAccountIds.length > 0) {
        await this.switchView(otherAccountIds[0]);
      }
    }

    // 5. 销毁 BrowserView
    await this.destroyView(accountId);

    // 6. 通知 UI 关闭成功
    this._notifyRenderer('account-closed', { accountId });

    return { success: true };
  } catch (error) {
    this.log('error', `Failed to close account ${accountId}:`, error);
    
    // 通知 UI 关闭失败
    this._notifyRenderer('account-close-failed', {
      accountId,
      error: error.message
    });

    return { success: false, error: error.message };
  }
}
```

#### getAccountRunningStatus 方法

```javascript
getAccountRunningStatus(accountId) {
  const viewState = this.views.get(accountId);
  
  if (!viewState) {
    return 'not_started';
  }

  // 根据 viewState.status 映射到运行状态
  switch (viewState.status) {
    case 'created':
    case 'loading':
      return 'loading';
    case 'ready':
      return 'connected';
    case 'error':
      return 'error';
    default:
      return 'not_started';
  }
}
```

### IPC 处理器实现

```javascript
// 在 main.js 或 ipcHandlers.js 中

ipcMain.handle('open-account', async (event, accountId) => {
  try {
    const account = await accountConfigManager.getAccount(accountId);
    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const result = await viewManager.openAccount(accountId, {
      proxy: account.proxy,
      translation: account.translation,
      url: 'https://web.whatsapp.com'
    });

    return result;
  } catch (error) {
    console.error('Failed to open account:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('close-account', async (event, accountId) => {
  try {
    const result = await viewManager.closeAccount(accountId);
    return result;
  } catch (error) {
    console.error('Failed to close account:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-account-status', async (event, accountId) => {
  try {
    const status = viewManager.getAccountRunningStatus(accountId);
    const viewState = viewManager.getViewState(accountId);
    
    return {
      success: true,
      status,
      isRunning: viewManager.isAccountRunning(accountId),
      details: viewState ? {
        isVisible: viewState.isVisible,
        isLoaded: viewState.isLoaded,
        loginStatus: viewState.loginStatus,
        connectionStatus: viewState.connectionStatus
      } : null
    };
  } catch (error) {
    console.error('Failed to get account status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-all-account-statuses', async (event) => {
  try {
    const accounts = await accountConfigManager.loadAccounts({ sorted: true });
    const statuses = {};

    for (const account of accounts) {
      statuses[account.id] = {
        status: viewManager.getAccountRunningStatus(account.id),
        isRunning: viewManager.isAccountRunning(account.id)
      };
    }

    return { success: true, statuses };
  } catch (error) {
    console.error('Failed to get all account statuses:', error);
    return { success: false, error: error.message };
  }
});
```

### UI 组件实现（sidebar.js）

```javascript
// 渲染账号列表项
function renderAccountItem(account, status) {
  const item = document.createElement('div');
  item.className = 'account-item';
  item.dataset.accountId = account.id;
  item.dataset.status = status;

  // 状态指示器
  const statusIndicator = document.createElement('span');
  statusIndicator.className = `status-indicator ${status}`;
  
  // 账号信息
  const accountInfo = document.createElement('div');
  accountInfo.className = 'account-info';
  accountInfo.innerHTML = `
    <div class="account-name">${escapeHtml(account.name)}</div>
    <div class="account-status">
      ${statusIndicator.outerHTML}
      <span class="status-text">${getStatusText(status)}</span>
    </div>
  `;

  // 操作按钮
  const actions = document.createElement('div');
  actions.className = 'account-actions';

  // 打开按钮（仅在未启动时显示）
  if (status === 'not_started') {
    const openBtn = document.createElement('button');
    openBtn.className = 'open-btn';
    openBtn.dataset.action = 'open';
    openBtn.title = '打开账号';
    openBtn.innerHTML = '<span class="icon">▶</span><span class="text">打开</span>';
    openBtn.onclick = () => handleOpenAccount(account.id);
    actions.appendChild(openBtn);
  }

  // 关闭按钮（仅在已连接时显示）
  if (status === 'connected') {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.dataset.action = 'close';
    closeBtn.title = '关闭账号';
    closeBtn.innerHTML = '<span class="icon">⏹</span><span class="text">关闭</span>';
    closeBtn.onclick = () => handleCloseAccount(account.id);
    actions.appendChild(closeBtn);
  }

  // 加载指示器（仅在加载中时显示）
  if (status === 'loading') {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = '<span class="spinner"></span><span class="text">加载中...</span>';
    actions.appendChild(loadingIndicator);
  }

  // 错误指示器（仅在错误时显示）
  if (status === 'error') {
    const errorIndicator = document.createElement('div');
    errorIndicator.className = 'error-indicator';
    errorIndicator.innerHTML = '<span class="icon">⚠️</span><span class="text">错误</span>';
    errorIndicator.title = '点击重试';
    errorIndicator.onclick = () => handleRetryAccount(account.id);
    actions.appendChild(errorIndicator);
  }

  // 其他操作按钮
  const editBtn = document.createElement('button');
  editBtn.className = 'edit-btn';
  editBtn.innerHTML = '⚙️';
  editBtn.title = '编辑账号';
  editBtn.onclick = () => handleEditAccount(account.id);
  actions.appendChild(editBtn);

  item.appendChild(accountInfo);
  item.appendChild(actions);

  return item;
}

// 处理打开账号
async function handleOpenAccount(accountId) {
  try {
    // 更新 UI 为加载状态
    updateAccountItemStatus(accountId, 'loading');

    // 调用 IPC
    const result = await window.api.openAccount(accountId);

    if (!result.success) {
      throw new Error(result.error);
    }

    // 成功后 UI 会通过事件监听器自动更新
  } catch (error) {
    console.error('Failed to open account:', error);
    updateAccountItemStatus(accountId, 'error');
    showErrorMessage(`打开账号失败: ${error.message}`);
  }
}

// 处理关闭账号
async function handleCloseAccount(accountId) {
  try {
    // 更新 UI 为加载状态
    updateAccountItemStatus(accountId, 'loading');

    // 调用 IPC
    const result = await window.api.closeAccount(accountId);

    if (!result.success) {
      throw new Error(result.error);
    }

    // 成功后 UI 会通过事件监听器自动更新
  } catch (error) {
    console.error('Failed to close account:', error);
    updateAccountItemStatus(accountId, 'error');
    showErrorMessage(`关闭账号失败: ${error.message}`);
  }
}

// 监听账号状态变化事件
window.api.onAccountStatusChanged((data) => {
  const { accountId, status } = data;
  updateAccountItemStatus(accountId, status);
});

window.api.onAccountOpened((data) => {
  const { accountId } = data;
  updateAccountItemStatus(accountId, 'connected');
});

window.api.onAccountClosed((data) => {
  const { accountId } = data;
  updateAccountItemStatus(accountId, 'not_started');
});

window.api.onAccountOperationFailed((data) => {
  const { accountId, operation, error } = data;
  updateAccountItemStatus(accountId, 'error');
  showErrorMessage(`${operation} 失败: ${error}`);
});
```

## Performance Considerations

### 内存管理

**挑战**: 每个 BrowserView 消耗大量内存（150-200MB）

**策略**:
1. **延迟加载**: 仅在用户请求时创建 BrowserView
2. **主动关闭**: 提供关闭按钮让用户释放不需要的账号
3. **账号数量限制**: 限制同时打开的账号数量（默认 10 个）
4. **内存监控**: 监控每个账号的内存使用，超过阈值时警告用户

**目标指标**:
- 基础内存: ~200MB（主窗口）
- 每个账号: ~150-200MB
- 最大 10 个账号: ~2GB 总内存

### 启动性能

**挑战**: 应用启动时不应该有明显延迟

**策略**:
1. **不自动加载**: 启动时不创建任何 BrowserView
2. **快速渲染**: 快速显示账号列表 UI
3. **异步加载**: 账号配置异步加载

**目标指标**:
- 应用启动到显示 UI: <1 秒
- 账号列表渲染: <100ms

### 操作响应性

**挑战**: 打开/关闭操作应该快速响应

**策略**:
1. **立即 UI 反馈**: 点击按钮后立即显示加载指示器
2. **异步操作**: 所有操作都是异步的，不阻塞 UI
3. **进度反馈**: 显示操作进度

**目标指标**:
- 按钮点击到 UI 反馈: <50ms
- 账号打开（创建 WebView）: <2 秒
- 账号关闭（销毁 WebView）: <1 秒

## Security Considerations

### 会话隔离

**要求**:
- 关闭账号不应该影响会话数据的隔离
- 重新打开账号应该使用相同的隔离会话

**实现**:
- 使用 Electron 的 partition API
- 会话数据目录在账号关闭后保留
- 重新打开时使用相同的 partition

### 资源清理

**要求**:
- 关闭账号时彻底清理 WebView 资源
- 防止内存泄漏

**实现**:
- 调用 webContents.destroy()
- 从 views Map 中移除
- 清理事件监听器

## Deployment Plan

### 开发阶段

1. **Week 1**: ViewManager 增强
   - 实现 openAccount 方法
   - 实现 closeAccount 方法
   - 实现状态查询方法

2. **Week 2**: IPC 通信
   - 实现 IPC 处理器
   - 实现事件通知机制
   - 测试主进程与渲染进程通信

3. **Week 3**: UI 组件
   - 更新账号列表 UI
   - 实现打开/关闭按钮
   - 实现状态指示器和加载动画

4. **Week 4**: 自动启动功能
   - 扩展 AccountConfig 模型
   - 实现自动启动逻辑
   - 实现配置 UI

5. **Week 5**: 测试和优化
   - 编写单元测试
   - 编写属性测试
   - 性能优化
   - 错误处理完善

### 测试阶段

1. **Alpha 测试** (内部)
   - 测试基本功能
   - 验证内存管理
   - 修复关键 bug

2. **Beta 测试** (有限用户)
   - 收集用户反馈
   - 测试各种使用场景
   - 优化用户体验

3. **Release Candidate**
   - 完整功能测试
   - 性能基准测试
   - 安全审计

### 发布阶段

1. **分阶段发布**
   - 发布给 10% 用户
   - 监控问题
   - 逐步增加到 100%

2. **发布后**
   - 监控错误报告
   - 收集用户反馈
   - 计划增量改进

## Future Enhancements

### Phase 2 功能

1. **智能内存管理**
   - 自动关闭长时间未使用的账号
   - 基于内存使用的自动清理
   - 内存使用统计和可视化

2. **批量操作**
   - 批量打开/关闭账号
   - 账号分组管理
   - 组级别的自动启动

3. **高级自动启动**
   - 按时间计划自动启动
   - 基于条件的自动启动（如网络状态）
   - 启动优先级设置

4. **性能优化**
   - WebView 池化和重用
   - 更快的启动时间
   - 更低的内存占用

5. **用户体验增强**
   - 拖拽排序账号
   - 键盘快捷键
   - 自定义主题和图标
