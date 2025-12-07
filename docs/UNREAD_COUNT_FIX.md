# 未读消息显示修复说明

## 问题描述

在打包后的 exe 中，账号列表的卡片式账号头像和未读信息徽章无法显示，但在开发环境中正常工作。

## 根本原因

有两个问题导致未读消息功能在打包后失效：

### 1. 头像显示问题
在 `src/single-window/renderer/sidebar.js` 的 `createAccountItem` 函数中，创建账号卡片时没有检查 `account.avatarUrl` 来显示头像图片，只显示了账号名称的首字母缩写。

### 2. 未读消息脚本未打包
`scripts/whatsapp-unread-observer.js` 脚本负责监控 WhatsApp Web 页面的未读消息数量，但该脚本没有被打包到最终的 asar 文件中。

原因：
- `package.json` 的 `build.files` 配置只包含 `src/**/*` 和 `resources/**/*`
- `scripts` 目录在根目录，不在 `src` 下，因此被排除在打包之外
- `src/preload-view.js` 使用 `path.join(__dirname, '../scripts/whatsapp-unread-observer.js')` 引用脚本
- 在开发环境中路径正确，但打包后 asar 中没有该文件

## 解决方案

### 1. 修复头像显示
在 `src/single-window/renderer/sidebar.js` 中，更新 `createAccountItem` 函数，添加对 `account.avatarUrl` 的检查：

```javascript
// Avatar
const avatar = document.createElement('div');
avatar.className = 'account-avatar';

// Check if there's an avatar URL first
if (account.avatarUrl) {
  const img = document.createElement('img');
  img.src = account.avatarUrl;
  img.alt = account.name || account.profileName || '';
  img.className = 'account-avatar-image';
  avatar.appendChild(img);
} else if (account.name || account.profileName) {
  // Show initial and color if there is a name but no avatar
  avatar.textContent = getAccountInitial(account.name || account.profileName);
  avatar.style.background = getAccountColor(account.id);
}
```

### 2. 修复未读消息脚本打包
将 WhatsApp 相关脚本移动到 `src/scripts/` 目录：
- `whatsapp-unread-observer.js`
- `whatsapp-profile-autoextract.js`
- `whatsapp-profile-extractor.js`
- `whatsapp-diagnose.js`

更新 `src/preload-view.js` 中的路径引用：
```javascript
// 从
const unreadScriptPath = path.join(__dirname, '../scripts/whatsapp-unread-observer.js');
// 改为
const unreadScriptPath = path.join(__dirname, 'scripts/whatsapp-unread-observer.js');
```

## 工作原理

### 未读消息监控流程

1. **脚本注入**：`src/preload-view.js` 在 WhatsApp Web 页面加载时注入 `whatsapp-unread-observer.js`
2. **DOM 监控**：观察器使用 MutationObserver 监控聊天列表的变化
3. **计数检测**：通过 DOM 查询 `[aria-label*="unread"]` 元素计算未读消息数
4. **过滤静音**：自动排除已静音的聊天
5. **IPC 通信**：通过 `window.electronAPI.invoke('view:update-unread-count')` 发送到主进程
6. **状态更新**：主进程更新 ViewState 并通知渲染进程
7. **UI 更新**：`sidebar.js` 的 `handleUnreadCountUpdated` 更新徽章显示

### 徽章显示

未读徽章通过 `renderUnreadBadge` 函数渲染：
- 位置：头像容器的右上角（`position: absolute; top: -4px; right: -4px`）
- 样式：红色圆形徽章，白色文字
- 显示逻辑：未读数 > 0 时显示，否则隐藏
- 数字格式：超过 99 显示为 "99+"

## 验证

打包后验证脚本是否存在：
```bash
npx asar list dist/win-unpacked/resources/app.asar | grep whatsapp-unread-observer
```

应该看到：
```
\src\scripts\whatsapp-unread-observer.js
```

## 相关文件

- `src/single-window/renderer/sidebar.js` - 账号列表 UI 和未读徽章渲染
- `src/single-window/renderer/styles.css` - 头像和徽章样式
- `src/scripts/whatsapp-unread-observer.js` - 未读消息监控脚本
- `src/preload-view.js` - 脚本注入逻辑
- `src/presentation/ipc/handlers/AccountIPCHandlers.js` - IPC 处理
- `package.json` - 打包配置

## 修复日期

2025-12-07
