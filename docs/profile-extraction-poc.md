# WhatsApp Web 账号信息提取 - 技术文档

## 概述

这是一个从 WhatsApp Web 中自动提取账号信息（昵称、头像、号码）并在账号列表中显示的功能。

## 功能特性

- ✅ **自动检测登录状态** - 页面加载后自动监测是否已登录
- ✅ **自动提取账号信息** - 登录成功后自动打开个人资料面板提取信息
- ✅ **定期更新** - 每分钟检查一次信息是否有变化
- ✅ **变化检测** - 只在信息发生变化时更新 UI
- ✅ **自动发送到主进程** - 通过 IPC 自动更新账号列表显示

## 文件说明

### 核心脚本

| 文件 | 用途 |
|------|------|
| `scripts/whatsapp-profile-autoextract.js` | 自动提取模块，页面加载后自动运行 |
| `scripts/whatsapp-profile-extractor.js` | 手动提取脚本，可在控制台运行测试 |

### 修改的源代码

| 文件 | 修改内容 |
|------|----------|
| `src/preload-view.js` | 添加 electronAPI 暴露和自动注入脚本 |
| `src/presentation/ipc/handlers/AccountIPCHandlers.js` | 新增 `view:update-profile` IPC 处理器 |

## 数据流

```
WhatsApp Web 页面（BrowserView）
    │
    ├─ 登录检测（每2秒）
    │
    ▼ 登录成功后
打开个人资料面板
    │
    ▼ 提取信息
{
  profileName: "9911",
  phoneNumber: "+37254002883", 
  avatarUrl: "https://..."
}
    │
    ▼ electronAPI.invoke('view:update-profile', data)
    │
主进程 AccountIPCHandlers
    │
    ├─▶ 更新 viewState
    │
    └─▶ 发送 'view-manager:account-profile-updated'
              │
              ▼
         渲染进程 (sidebar.js)
              │
              ▼
         更新账号列表 UI
```

## 配置选项

自动提取模块的配置在 `whatsapp-profile-autoextract.js` 中：

```javascript
const CONFIG = {
  loginCheckInterval: 2000,      // 登录检测间隔
  extractDelay: 3000,            // 登录后等待时间
  maxRetries: 5,                 // 提取重试次数
  retryInterval: 2000,           // 重试间隔
  periodicCheckInterval: 60000,  // 定期检查间隔
  debug: false                   // 调试模式
};
```

## 调试 API

在 WhatsApp Web 的控制台中可用：

```javascript
// 手动触发提取
window.WhatsAppProfileExtractor.extract()

// 检查登录状态
window.WhatsAppProfileExtractor.isLoggedIn()

// 获取最后提取的数据
window.WhatsAppProfileExtractor.getLastData()

// 开启调试模式
window.WhatsAppProfileExtractor.setDebug(true)

// 停止自动提取
window.WhatsAppProfileExtractor.stop()
```

## 提取逻辑

### 昵称提取
1. 查找 "姓名" 或 "Name" 标签
2. 获取其后第一个有效的文本内容
3. 排除图标名称（pencil, edit, phone 等）
4. 排除电话号码格式的文本

### 电话号码提取
- 匹配格式：以 `+` 开头，7-15 位数字
- 例如：`+37254002883`

### 头像提取
- 查找 `img[src*="pps.whatsapp.net"]`
- 优先选择宽度大于 50px 的图片

## 注意事项

1. **需要打开个人资料面板** - 脚本会自动尝试点击头像打开面板
2. **DOM 结构可能变化** - WhatsApp Web 更新后可能需要调整选择器
3. **跨域限制** - 头像 URL 有时效性签名，可能需要代理下载

## 测试步骤

1. 启动应用
2. 打开一个 WhatsApp 账号
3. 等待登录完成
4. 观察控制台日志，应显示：
   - `[ProfileExtractor] 自动提取模块已加载`
   - `[ProfileExtractor] 检测到已登录，等待页面加载...`
   - `[ProfileExtractor] ✅ 账号信息已更新: 9911 +37254002883`
5. 检查左侧账号列表，信息应已更新
