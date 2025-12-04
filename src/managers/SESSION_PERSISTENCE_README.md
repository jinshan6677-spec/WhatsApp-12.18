# Session Persistence Implementation

## 概述

会话持久化功能允许 WhatsApp 账号在应用重启后自动恢复登录状态，无需重新扫描二维码。该功能通过 Electron 的 session API 和独立的用户数据目录实现。

## 核心组件

### SessionManager

会话管理器负责：
- 检测会话数据是否存在
- 检测登录状态
- 清除会话数据
- 备份和恢复会话数据
- 获取会话数据统计信息

### 关键方法

#### `hasSessionData(instanceId)`
检查指定实例是否有保存的会话数据。

```javascript
const hasData = await sessionManager.hasSessionData('account-001');
if (hasData) {
  console.log('Session data exists, will attempt to restore');
}
```

#### `detectLoginStatus(instanceId, window)`
检测实例的当前登录状态。

```javascript
const isLoggedIn = await sessionManager.detectLoginStatus('account-001', window);
if (isLoggedIn) {
  console.log('User is logged in');
} else {
  console.log('User needs to login');
}
```

#### `clearSessionData(instanceId)`
清除实例的所有会话数据，强制用户重新登录。

```javascript
const result = await sessionManager.clearSessionData('account-001');
if (result.success) {
  console.log('Session cleared, user will need to login again');
}
```

#### `configureSessionPersistence(instanceId)`
配置 session 的持久化选项。

```javascript
await sessionManager.configureSessionPersistence('account-001');
```

## 工作流程

### 1. 首次启动（无会话数据）

```
用户启动实例
    ↓
检查会话数据 (hasSessionData)
    ↓
无会话数据
    ↓
加载 WhatsApp Web
    ↓
显示二维码
    ↓
用户扫码登录
    ↓
会话数据自动保存到 userDataDir
```

### 2. 后续启动（有会话数据）

```
用户启动实例
    ↓
检查会话数据 (hasSessionData)
    ↓
发现会话数据
    ↓
加载 WhatsApp Web
    ↓
自动恢复会话
    ↓
检测登录状态 (detectLoginStatus)
    ↓
已登录 → 正常使用
未登录 → 显示二维码（会话已过期）
```

### 3. 会话过期处理

```
定期检测登录状态（每 30 秒）
    ↓
检测到登录状态变化
    ↓
从已登录变为未登录
    ↓
更新实例状态
    ↓
显示错误信息："Session expired, please scan QR code to login"
    ↓
显示二维码
    ↓
用户重新扫码登录
```

## 数据存储

### 用户数据目录结构

```
{userDataPath}/
└── profiles/
    └── {accountId}/
        ├── IndexedDB/          # WhatsApp Web 的主要数据存储
        ├── Local Storage/      # 本地存储数据
        ├── Session Storage/    # 会话存储数据
        ├── Cookies/            # Cookie 数据
        ├── Cache/              # 缓存数据
        └── Service Worker/     # Service Worker 数据
```

### Session Partition

每个账号使用独立的 session partition：
```javascript
const partition = `persist:account_${accountId}`;
const session = session.fromPartition(partition, { cache: true });
```

`persist:` 前缀确保 session 数据持久化到磁盘。

## 登录状态检测

### 检测逻辑

通过执行 JavaScript 检查 DOM 元素来判断登录状态：

```javascript
// 检查是否存在二维码（未登录）
const qrCode = document.querySelector('[data-ref], canvas[aria-label*="QR"]');
if (qrCode && qrCode.offsetParent !== null) {
  return false; // 未登录
}

// 检查是否存在聊天列表（已登录）
const chatList = document.querySelector('[data-testid="chat-list"]');
if (chatList && chatList.offsetParent !== null) {
  return true; // 已登录
}
```

### 检测时机

1. **页面加载完成后**：延迟 3 秒检测，等待 DOM 完全渲染
2. **定期检测**：每 30 秒检测一次，监控登录状态变化
3. **手动触发**：通过 IPC 调用手动检测

## IPC 接口

### `session:has-data`
检查会话数据是否存在。

```javascript
const hasData = await window.api.invoke('session:has-data', accountId);
```

### `session:clear`
清除会话数据，强制重新登录。

```javascript
const result = await window.api.invoke('session:clear', accountId);
```

### `session:stats`
获取会话数据统计信息。

```javascript
const stats = await window.api.invoke('session:stats', accountId);
console.log(`Size: ${stats.size} bytes, Files: ${stats.files}`);
```

## 集成到 InstanceManager

### 创建实例时

```javascript
// 1. 检查会话数据
const hasExistingSession = await this.sessionManager.hasSessionData(id);

// 2. 创建实例
const window = new BrowserWindow({ /* ... */ });

// 3. 配置 session 持久化
await this.sessionManager.configureSessionPersistence(id);

// 4. 加载 WhatsApp Web
await window.loadURL('https://web.whatsapp.com');

// 5. 监听页面加载完成，检测登录状态
window.webContents.on('did-finish-load', async () => {
  const isLoggedIn = await this.sessionManager.detectLoginStatus(id, window);
  
  if (hasExistingSession && !isLoggedIn) {
    // 会话过期
    console.log('Session expired, QR code will be displayed');
  } else if (hasExistingSession && isLoggedIn) {
    // 会话恢复成功
    console.log('Session restored successfully');
  }
});

// 6. 定期检测登录状态
setInterval(async () => {
  const isLoggedIn = await this.sessionManager.detectLoginStatus(id, window);
  // 更新状态...
}, 30000);
```

## 最佳实践

### 1. 会话数据备份

定期备份重要账号的会话数据：

```javascript
const backupPath = path.join(app.getPath('userData'), 'backups');
await sessionManager.backupSessionData(accountId, backupPath);
```

### 2. 会话数据清理

提供用户界面选项清除会话数据：

```javascript
// 添加"清除会话"按钮
button.addEventListener('click', async () => {
  const confirmed = confirm('Are you sure you want to clear session data?');
  if (confirmed) {
    await window.api.invoke('session:clear', accountId);
    alert('Session cleared. Please restart the instance to login again.');
  }
});
```

### 3. 监控会话大小

定期检查会话数据大小，避免占用过多磁盘空间：

```javascript
const stats = await sessionManager.getSessionDataStats(accountId);
if (stats.size > 500 * 1024 * 1024) { // 500 MB
  console.warn('Session data is too large, consider clearing cache');
}
```

### 4. 处理会话过期

优雅地处理会话过期情况：

```javascript
if (hasExistingSession && !isLoggedIn) {
  // 显示友好的提示信息
  showNotification('Session expired', 'Please scan the QR code to login again');
  
  // 更新 UI 状态
  updateAccountStatus(accountId, {
    status: 'running',
    isLoggedIn: false,
    error: 'Session expired, please scan QR code to login'
  });
}
```

## 故障排除

### 问题：会话无法恢复

**可能原因：**
1. 会话数据损坏
2. WhatsApp 服务器端会话过期
3. 用户数据目录权限问题

**解决方案：**
```javascript
// 清除会话数据并重新登录
await sessionManager.clearSessionData(accountId);
await instanceManager.restartInstance(accountId);
```

### 问题：登录状态检测不准确

**可能原因：**
1. DOM 结构变化（WhatsApp Web 更新）
2. 页面加载未完成
3. 网络延迟

**解决方案：**
```javascript
// 增加检测延迟
setTimeout(async () => {
  const isLoggedIn = await sessionManager.detectLoginStatus(id, window);
}, 5000); // 增加到 5 秒

// 或者多次检测取最终结果
let loginCheckCount = 0;
const checkInterval = setInterval(async () => {
  loginCheckCount++;
  const isLoggedIn = await sessionManager.detectLoginStatus(id, window);
  
  if (isLoggedIn || loginCheckCount > 3) {
    clearInterval(checkInterval);
    // 使用最终结果
  }
}, 2000);
```

### 问题：会话数据占用过多空间

**解决方案：**
```javascript
// 定期清理缓存
const instanceSession = session.fromPartition(`persist:account_${accountId}`);
await instanceSession.clearCache();

// 或者完全清除会话数据
await sessionManager.clearSessionData(accountId);
```

## 安全考虑

### 1. 数据加密

会话数据包含敏感信息，应确保：
- 用户数据目录有适当的文件系统权限
- 考虑使用操作系统级别的加密（如 Windows BitLocker、macOS FileVault）

### 2. 会话隔离

每个账号的会话数据完全隔离：
- 独立的 userDataDir
- 独立的 session partition
- 无法跨账号访问会话数据

### 3. 会话过期

WhatsApp 会话有自然过期机制：
- 长时间不活跃（通常 14 天）会导致会话过期
- 在其他设备登录会使当前会话失效
- 应用会自动检测并提示用户重新登录

## 性能优化

### 1. 延迟加载

不要在应用启动时立即加载所有实例的会话数据：

```javascript
// 只在用户启动实例时才检查会话数据
ipcMain.handle('instance:start', async (event, accountId) => {
  const hasData = await sessionManager.hasSessionData(accountId);
  // 创建实例...
});
```

### 2. 缓存登录状态

避免频繁执行 JavaScript 检测：

```javascript
// 使用缓存
const cachedStatus = sessionManager.getCachedLoginStatus(accountId);
if (cachedStatus !== null) {
  return cachedStatus;
}

// 只在缓存失效时才重新检测
const actualStatus = await sessionManager.detectLoginStatus(accountId, window);
```

### 3. 批量操作

批量处理多个账号的会话操作：

```javascript
const accountIds = ['account-001', 'account-002', 'account-003'];
const results = await Promise.all(
  accountIds.map(id => sessionManager.hasSessionData(id))
);
```

## 测试

### 单元测试

```javascript
describe('SessionManager', () => {
  it('should detect session data existence', async () => {
    const hasData = await sessionManager.hasSessionData('test-account');
    expect(typeof hasData).toBe('boolean');
  });
  
  it('should clear session data', async () => {
    const result = await sessionManager.clearSessionData('test-account');
    expect(result.success).toBe(true);
  });
});
```

### 集成测试

```javascript
describe('Session Persistence Integration', () => {
  it('should restore session on second launch', async () => {
    // 第一次启动
    await instanceManager.createInstance(accountConfig);
    // 模拟登录...
    await instanceManager.destroyInstance(accountId);
    
    // 第二次启动
    await instanceManager.createInstance(accountConfig);
    const isLoggedIn = await sessionManager.detectLoginStatus(accountId, window);
    expect(isLoggedIn).toBe(true);
  });
});
```

## 相关文件

- `src/managers/SessionManager.js` - 会话管理器实现
- `src/managers/InstanceManager.js` - 实例管理器（集成会话管理）
- `src/container/ipcHandlers.js` - IPC 处理器（会话管理接口）
- `src/examples/session-manager-example.js` - 使用示例

## 参考资料

- [Electron Session API](https://www.electronjs.org/docs/latest/api/session)
- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window)
- [WhatsApp Web 逆向工程](https://github.com/sigalor/whatsapp-web-reveng)
