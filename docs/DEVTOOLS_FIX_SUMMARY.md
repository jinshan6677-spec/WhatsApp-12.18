# DevTools 启用修复总结

## 问题
无法打开 WhatsApp Web 的浏览器控制台（DevTools），导致无法调试翻译功能。

## 已实施的修复

### 1. 添加 F12 快捷键支持 ✅
**文件**: 
- `src/single-window/ViewManager.js`
- `src/presentation/windows/view-manager/ViewFactory.js`

**功能**:
- F12 键切换 DevTools
- Ctrl+Shift+I 也可以切换 DevTools

```javascript
view.webContents.on('before-input-event', (event, input) => {
  if (input.key === 'F12' || 
      (input.control && input.shift && input.key === 'I')) {
    if (view.webContents.isDevToolsOpened()) {
      view.webContents.closeDevTools();
    } else {
      view.webContents.openDevTools({ mode: 'detach' });
    }
  }
});
```

### 2. 添加调试模式自动打开 ✅
**功能**: 在开发模式下自动打开 DevTools

```javascript
if (process.env.NODE_ENV === 'development' || process.env.DEBUG_TRANSLATION === 'true') {
  view.webContents.once('did-finish-load', () => {
    view.webContents.openDevTools({ mode: 'detach' });
  });
}
```

### 3. 创建调试启动脚本 ✅
**文件**: `start-with-debug.bat`

**用途**: 一键启动调试模式

## 使用方法

### 方法 1: 调试模式启动（推荐）

#### Windows
```cmd
start-with-debug.bat
```

或
```cmd
set NODE_ENV=development
set DEBUG_TRANSLATION=true
npm start
```

#### Linux/Mac
```bash
NODE_ENV=development DEBUG_TRANSLATION=true npm start
```

**效果**: 
- ✅ 自动打开 DevTools
- ✅ 显示详细日志
- ✅ F12 可切换

### 方法 2: 正常启动后按 F12

1. 正常启动应用
2. 打开账号
3. **点击 WhatsApp Web 聊天区域**（确保焦点正确）
4. 按 **F12**

## 验证步骤

### 1. 启动应用
使用 `start-with-debug.bat` 或设置环境变量启动

### 2. 打开账号
在应用中打开一个 WhatsApp 账号

### 3. 确认 DevTools 打开
应该看到一个新窗口，包含 Console、Elements 等标签

### 4. 查看 Console
切换到 Console 标签，执行：
```javascript
console.log(window.WhatsAppTranslation);
```

### 5. 查看主进程日志
在主控制台查看：
```
[TranslationIntegration] [INFO] Translation scripts loaded to cache
[TranslationIntegration] [INFO] executeJavaScript test result: TEST_OK
[TranslationIntegration] [INFO] Verification result: {"hasWhatsAppTranslation":true,...}
```

## 预期结果

### ✅ DevTools 成功打开
- 看到 DevTools 窗口
- Console 标签可用
- 可以执行 JavaScript 命令

### ✅ 翻译脚本注入成功
**Console 中**:
```
[Translation] executeJavaScript test successful
[Translation] Account ID injected: <id>
[Translation] Content script initializing...
[Translation] Initialized successfully
```

**主进程中**:
```
[TranslationIntegration] [INFO] Translation scripts successfully injected
```

### ✅ 验证通过
```javascript
console.log(window.WhatsAppTranslation);
// 输出: {init: ƒ, config: {...}, ...}  ← 对象，不是 undefined
```

## 如果仍有问题

### 问题 A: DevTools 无法打开
**症状**: 按 F12 没反应

**解决**:
1. 使用 `start-with-debug.bat` 启动
2. 确保焦点在 WhatsApp Web 页面
3. 检查代码是否正确应用（重新构建）

### 问题 B: DevTools 打开但 window.WhatsAppTranslation 是 undefined
**症状**: DevTools 工作，但翻译脚本没注入

**原因**:
- executeJavaScript 被阻止
- CSP 限制
- 脚本执行错误

**解决**:
1. 查看 Console 中的错误消息
2. 查看主进程日志
3. 检查是否有 CSP 错误

### 问题 C: 看到 [Translation] 日志但功能不工作
**症状**: 脚本注入成功，但翻译不工作

**原因**: 配置或 UI 问题

**解决**:
1. 检查 `window.WhatsAppTranslation.config`
2. 检查 `window.WhatsAppTranslation.initialized`
3. 手动调用 `window.WhatsAppTranslation.init()`

## 文件清单

### 修改的文件
1. ✅ `src/single-window/ViewManager.js` - 添加 DevTools 支持
2. ✅ `src/presentation/windows/view-manager/ViewFactory.js` - 添加 DevTools 支持

### 新增的文件
1. ✅ `start-with-debug.bat` - 调试模式启动脚本
2. ✅ `ENABLE_DEVTOOLS.md` - DevTools 使用指南
3. ✅ `DEVTOOLS_FIX_SUMMARY.md` - 本文档

## 下一步行动

### 立即执行
1. **重启应用**（使用 `start-with-debug.bat`）
2. **打开账号**
3. **确认 DevTools 自动打开**
4. **在 Console 中执行**: `console.log(window.WhatsAppTranslation)`
5. **报告结果**

### 根据结果
- **如果 DevTools 打开** → 继续调试翻译功能
- **如果 DevTools 未打开** → 检查代码是否正确应用
- **如果翻译脚本注入成功** → 检查配置和 UI
- **如果翻译脚本未注入** → 查看错误日志

---

**状态**: ✅ DevTools 支持已添加
**下一步**: 使用调试模式启动并验证
**预期**: DevTools 自动打开，可以调试翻译功能
