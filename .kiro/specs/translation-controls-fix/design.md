# 设计文档

## 概述

本设计文档描述了修复翻译功能控制开关无效问题的技术方案。核心问题是新的模块化翻译系统缺少 `updateConfig` 方法和配置变更监听机制，导致用户在设置面板中更改配置后无法应用到 WhatsApp Web 页面中的翻译脚本。

### 设计目标

1. 在 `WhatsAppTranslation` 对象中实现 `updateConfig` 方法
2. 实现配置变更监听机制 (`setupConfigListener`)
3. 实现配置应用逻辑 (`applyConfigChanges`)
4. 确保配置变更后各模块正确重新初始化
5. 保持与现有架构的兼容性

## 架构

### 当前架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        主窗口 (Main Window)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              翻译设置面板 (translateSettingsPanel.js)      │   │
│  │  - 用户更改配置                                           │   │
│  │  - 调用 translationAPI.saveConfig()                      │   │
│  │  - 调用 applyConfigToView()                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ IPC: translation:saveConfig
                              │ IPC: translation:apply-config
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        主进程 (Main Process)                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           TranslationServiceIPCHandlers.js               │   │
│  │  - 处理 translation:saveConfig                           │   │
│  │  - 保存配置到后端                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   ipcHandlers.js                         │   │
│  │  - 处理 translation:apply-config                         │   │
│  │  - 调用 view.webContents.executeJavaScript()             │   │
│  │  - 执行 WhatsAppTranslation.updateConfig() ❌ 不存在      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ executeJavaScript
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BrowserView (WhatsApp Web)                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  WhatsAppTranslation                     │   │
│  │  - core: ContentScriptCore                               │   │
│  │  - ui: TranslationUI                                     │   │
│  │  - messageTranslator: MessageTranslator                  │   │
│  │  - inputBoxTranslator: InputBoxTranslator                │   │
│  │  - domObserver: DOMObserver                              │   │
│  │  - updateConfig() ❌ 缺失                                 │   │
│  │  - setupConfigListener() ❌ 缺失                          │   │
│  │  - applyConfigChanges() ❌ 缺失                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 修复后架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        主窗口 (Main Window)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              翻译设置面板 (translateSettingsPanel.js)      │   │
│  │  - 用户更改配置                                           │   │
│  │  - 调用 translationAPI.saveConfig()                      │   │
│  │  - 调用 applyConfigToView()                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ IPC: translation:saveConfig
                              │ IPC: translation:apply-config
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        主进程 (Main Process)                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           TranslationServiceIPCHandlers.js               │   │
│  │  - 处理 translation:saveConfig                           │   │
│  │  - 保存配置到后端                                         │   │
│  │  - 发送 translation:configChanged 事件 ✅ 新增            │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   ipcHandlers.js                         │   │
│  │  - 处理 translation:apply-config                         │   │
│  │  - 调用 view.webContents.executeJavaScript()             │   │
│  │  - 执行 WhatsAppTranslation.updateConfig() ✅ 存在        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ executeJavaScript
                              │ translation:configChanged
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BrowserView (WhatsApp Web)                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  WhatsAppTranslation                     │   │
│  │  - core: ContentScriptCore                               │   │
│  │  - ui: TranslationUI                                     │   │
│  │  - messageTranslator: MessageTranslator                  │   │
│  │  - inputBoxTranslator: InputBoxTranslator                │   │
│  │  - domObserver: DOMObserver                              │   │
│  │  - updateConfig() ✅ 新增                                 │   │
│  │  - setupConfigListener() ✅ 新增                          │   │
│  │  - applyConfigChanges() ✅ 新增                           │   │
│  │  - deepMerge() ✅ 新增                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 组件和接口

### 1. WhatsAppTranslation 对象扩展

在 `src/presentation/translation/content-script/index.js` 中添加以下方法：

```javascript
const WhatsAppTranslation = {
  // ... 现有属性 ...

  /**
   * 深度合并配置对象
   * @param {Object} target - 目标对象
   * @param {Object} source - 源对象
   * @returns {Object} 合并后的对象
   */
  deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  },

  /**
   * 更新配置
   * @param {Object} newConfig - 新配置对象
   * @returns {Promise<Object>} 更新结果
   */
  async updateConfig(newConfig) {
    try {
      console.log('[Translation] Updating config:', newConfig);
      
      // 深度合并配置
      const mergedConfig = this.deepMerge(this.core.config || this.core.getDefaultConfig(), newConfig);
      this.core.config = mergedConfig;
      this.config = mergedConfig;
      
      // 保存到后端
      if (window.translationAPI) {
        const response = await window.translationAPI.saveConfig(this.accountId, mergedConfig);
        if (response.success) {
          console.log('[Translation] ✓ Config updated and saved');
          this.applyConfigChanges();
          return { success: true };
        } else {
          console.error('[Translation] Failed to save config:', response.error);
          return { success: false, error: response.error };
        }
      } else {
        console.warn('[Translation] translationAPI not available');
        return { success: false, error: 'translationAPI not available' };
      }
    } catch (error) {
      console.error('[Translation] Error updating config:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 应用配置变更
   */
  applyConfigChanges() {
    console.log('[Translation] Applying config changes...');
    
    // 重新初始化输入框翻译
    if (this.inputBoxTranslator) {
      this.inputBoxTranslator.cleanup();
      this.inputBoxTranslator.initInputBoxTranslation();
    }
    
    // 重新设置中文拦截
    if (this.domObserver) {
      this.domObserver.setupChineseBlock();
    }
    
    // 如果自动翻译已启用，翻译现有消息
    if (this.core.config.global.autoTranslate && this.messageTranslator) {
      this.messageTranslator.translateExistingMessages();
    }
    
    console.log('[Translation] ✓ Config changes applied');
  },

  /**
   * 设置配置变更监听
   */
  setupConfigListener() {
    if (window.translationAPI && window.translationAPI.onConfigChanged) {
      window.translationAPI.onConfigChanged((newConfig) => {
        console.log('[Translation] Config changed via IPC, reloading...', newConfig);
        this.core.config = newConfig;
        this.config = newConfig;
        this.applyConfigChanges();
      });
      console.log('[Translation] Config change listener set up');
    }
  }
};
```

### 2. 初始化流程更新

在 `init()` 方法中添加配置监听器设置：

```javascript
async init() {
  // ... 现有初始化代码 ...

  // 设置配置变更监听
  this.setupConfigListener();

  // ... 其余代码 ...
}
```

### 3. IPC 处理器更新

在 `TranslationServiceIPCHandlers.js` 的 `saveConfig` 方法中添加配置变更通知：

```javascript
async saveConfig(request) {
  const { accountId, config } = request.payload;
  
  if (!accountId) {
    throw new Error('Account ID is required to save translation config');
  }
  
  _translationService.saveConfig(accountId, config);
  console.log(`[IPC:Translation] Translation config saved for account ${accountId}`);
  
  // 通知对应的 BrowserView 配置已更改
  const { BrowserView } = require('electron');
  const allViews = BrowserView.getAllViews();
  
  for (const view of allViews) {
    if (view && view.webContents && !view.webContents.isDestroyed()) {
      try {
        const viewAccountId = await view.webContents.executeJavaScript('window.ACCOUNT_ID').catch(() => null);
        if (viewAccountId === accountId) {
          console.log(`[IPC:Translation] Notifying BrowserView for account ${accountId} about config change`);
          view.webContents.send('translation:configChanged', config);
        }
      } catch (err) {
        // 忽略错误
      }
    }
  }
  
  return {
    success: true,
    accountId
  };
}
```

## 数据模型

### 配置对象结构

```typescript
interface TranslationConfig {
  global: {
    autoTranslate: boolean;      // 自动翻译消息
    engine: string;              // 聊天窗口翻译引擎
    sourceLang: string;          // 源语言
    targetLang: string;          // 目标语言
    groupTranslation: boolean;   // 群组消息翻译
  };
  inputBox: {
    enabled: boolean;            // 启用输入框翻译按钮
    engine: string;              // 输入框翻译引擎
    style: string;               // 翻译风格
    targetLang: string;          // 输入框翻译目标语言
  };
  advanced: {
    friendIndependent: boolean;  // 好友独立配置
    blockChinese: boolean;       // 禁发中文
    realtime: boolean;           // 实时翻译预览
    reverseTranslation: boolean; // 反向翻译验证
    voiceTranslation: boolean;   // 语音翻译
    imageTranslation: boolean;   // 图片翻译
  };
  friendConfigs: {
    [contactId: string]: {
      enabled: boolean;          // 启用独立配置
      targetLang: string;        // 目标语言
      blockChinese: boolean;     // 禁发中文
    };
  };
}
```

## 正确性属性

*属性是系统在所有有效执行中应保持为真的特征或行为——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1：深度合并保持结构完整性
*对于任意*两个有效的配置对象，深度合并后的结果应包含两个对象的所有键，且嵌套对象应正确合并而非覆盖
**验证: 需求 7.1**

### 属性 2：自动翻译开关控制翻译行为
*对于任意*配置状态和消息，当 autoTranslate 为 true 时消息应被翻译，当为 false 时消息不应被翻译
**验证: 需求 1.1, 1.2**

### 属性 3：群组翻译开关控制群聊翻译
*对于任意*群聊消息和配置状态，当 groupTranslation 为 true 时群聊消息应被翻译，当为 false 时应跳过
**验证: 需求 1.3, 1.4**

### 属性 4：中文拦截开关控制发送行为
*对于任意*包含中文的文本和配置状态，当 blockChinese 为 true 时应阻止发送，当为 false 时应允许发送
**验证: 需求 3.1, 3.2**

### 属性 5：好友独立配置优先级
*对于任意*联系人和配置状态，当 friendIndependent 为 true 且该联系人有独立配置时，应使用独立配置而非全局配置
**验证: 需求 5.3**

### 属性 6：相似度计算一致性
*对于任意*两个文本，相似度计算结果应在 0 到 1 之间，且相同文本的相似度应为 1
**验证: 需求 4.5**

### 属性 7：翻译结果显示完整性
*对于任意*翻译结果，显示的内容应包含源语言、目标语言和使用的引擎信息
**验证: 需求 9.3**

### 属性 8：配置更新后状态一致性
*对于任意*配置更新操作，更新后 WhatsAppTranslation.config 和 WhatsAppTranslation.core.config 应保持一致
**验证: 需求 7.2, 8.2**

## 错误处理

### 配置更新错误

1. **translationAPI 不可用**: 返回错误响应，不影响本地配置
2. **IPC 通信失败**: 记录错误日志，配置仍保存到本地
3. **配置格式无效**: 使用默认配置填充缺失字段

### 模块重新初始化错误

1. **输入框翻译器初始化失败**: 记录错误，不影响其他功能
2. **中文拦截设置失败**: 记录错误，不影响其他功能
3. **DOM 观察器错误**: 使用定时器作为备选方案

## 测试策略

### 单元测试

1. **deepMerge 方法测试**
   - 测试基本对象合并
   - 测试嵌套对象合并
   - 测试数组处理
   - 测试空对象处理

2. **updateConfig 方法测试**
   - 测试配置合并正确性
   - 测试 IPC 调用
   - 测试错误处理

3. **applyConfigChanges 方法测试**
   - 测试输入框翻译器重新初始化
   - 测试中文拦截重新设置
   - 测试自动翻译触发

### 属性测试

使用 fast-check 库进行属性测试：

1. **深度合并属性测试**
   - 生成任意配置对象
   - 验证合并结果的结构完整性

2. **配置状态属性测试**
   - 生成任意配置状态
   - 验证功能行为与配置一致

3. **相似度计算属性测试**
   - 生成任意文本对
   - 验证相似度计算的数学属性

### 集成测试

1. **配置同步测试**
   - 测试设置面板到 BrowserView 的配置同步
   - 测试 IPC 事件传递

2. **功能开关测试**
   - 测试各开关的即时生效
   - 测试聊天切换后的配置应用
