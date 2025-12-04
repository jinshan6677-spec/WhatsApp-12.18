# 启动失败修复报告

## 问题描述

运行 `npm run dev` 时应用启动失败，错误日志显示：

```
Error: No handler registered for 'translation:apply-config'
```

## 根本原因

1. **缺失的 IPC 处理器**: `translation:apply-config` IPC 通道在前端代码中被调用，但从未在后端注册
2. **模块引用错误**: `src/single-window/ipcHandlers.js` 中引用了不存在的 `TranslationIPCHandlers` 模块

## 修复内容

### 1. 修复模块引用 (src/single-window/ipcHandlers.js)

**移除了不存在的模块引用:**
```javascript
// 删除
const TranslationIPCHandlers = require('../presentation/ipc/handlers/TranslationIPCHandlers');
```

**添加 electron 导入:**
```javascript
const { ipcMain } = require('electron');
```

### 2. 实现缺失的 IPC 处理器

**添加 `translation:apply-config` 处理器:**
```javascript
// Register translation:apply-config handler
ipcMain.handle('translation:apply-config', async (event, accountId, config) => {
  try {
    if (!accountId) {
      return { success: false, error: 'Account ID is required' };
    }

    // Get the view for this account
    const view = viewManager.getView(accountId);
    if (!view || !view.webContents) {
      return { success: false, error: 'View not found for account' };
    }

    // Inject translation config into the view's webContents
    await view.webContents.executeJavaScript(`
      if (window.WhatsAppTranslation) {
        window.WhatsAppTranslation.updateConfig(${JSON.stringify(config)});
      }
    `);

    return { success: true };
  } catch (error) {
    console.error('[IPC] translation:apply-config error:', error);
    return { success: false, error: error.message };
  }
});
```

### 3. 添加清理逻辑

**在 unregisterIPCHandlers 中添加:**
```javascript
// Unregister translation:apply-config
ipcMain.removeHandler('translation:apply-config');
```

### 4. 清理导出

**移除不存在模块的导出:**
```javascript
module.exports = {
  registerIPCHandlers,
  unregisterIPCHandlers,
  
  // Export individual handler modules for selective use
  AccountIPCHandlers,
  ViewIPCHandlers,
  SystemIPCHandlers
  // 移除了 TranslationIPCHandlers
};
```

## 功能说明

`translation:apply-config` 处理器的作用：
- 接收账户 ID 和翻译配置
- 获取对应账户的 BrowserView
- 将配置注入到视图的 webContents 中
- 调用 `window.WhatsAppTranslation.updateConfig()` 更新前端配置

## 验证

修复后的代码：
- ✅ 没有语法错误（通过 getDiagnostics 验证）
- ✅ 模块引用正确
- ✅ IPC 处理器逻辑完整

## 影响范围

- **修改文件**: `src/single-window/ipcHandlers.js`
- **影响功能**: 翻译设置面板的配置保存和应用
- **向后兼容**: 完全兼容，只是补充了缺失的功能

## 后续建议

1. 应用启动后测试翻译设置面板的配置保存功能
2. 验证配置是否正确应用到 WhatsApp 视图
3. 检查是否还有其他缺失的 IPC 处理器

## 测试状态

当前测试结果（与修复前一致）：
- Test Suites: 14 failed, 20 passed, 34 total
- Tests: 130 failed, 475 passed, 605 total

修复不影响现有测试，因为这是补充缺失的运行时功能。
