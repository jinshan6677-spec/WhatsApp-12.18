# 设计文档

## 概述

WhatsApp Web 翻译系统是一个集成在桌面客户端中的全功能翻译解决方案。该系统基于 Electron + whatsapp-web.js 架构，通过内容脚本注入和消息拦截实现对 WhatsApp Web 界面的翻译增强。系统支持多种翻译引擎（Google翻译、GPT-4、Gemini、DeepSeek、自定义AI API），提供消息接收翻译、输入框发送翻译、语音翻译、图片OCR翻译等功能。

## 架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 主进程                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           翻译服务管理器 (TranslationManager)         │  │
│  │  - 翻译引擎注册与管理                                 │  │
│  │  - 配置持久化                                         │  │
│  │  - IPC 通信处理                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         翻译引擎适配器 (Translation Adapters)         │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │  │
│  │  │  Google  │ │   GPT-4  │ │  Gemini  │  ...        │  │
│  │  └──────────┘ └──────────┘ └──────────┘             │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            缓存管理器 (CacheManager)                  │  │
│  │  - LRU 缓存策略                                       │  │
│  │  - 持久化存储                                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │ IPC
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Electron 渲染进程 (WhatsApp Web)            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         内容脚本 (Content Script Injector)            │  │
│  │  - DOM 监听与操作                                     │  │
│  │  - 消息拦截与注入                                     │  │
│  │  - UI 组件渲染                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         翻译 UI 控制器 (TranslationUIController)      │  │
│  │  - 翻译按钮渲染                                       │  │
│  │  - 翻译结果显示                                       │  │
│  │  - 设置面板管理                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      消息处理器 (MessageProcessor)                    │  │
│  │  - 消息监听                                           │  │
│  │  - 语言检测                                           │  │
│  │  - 翻译触发                                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

- **前端框架**: Electron 39.x
- **WhatsApp 集成**: whatsapp-web.js 1.23.x
- **内容脚本注入**: Electron webContents.executeJavaScript
- **进程通信**: Electron IPC (ipcMain/ipcRenderer)
- **翻译引擎**: 
  - Google Translate API
  - OpenAI GPT-4 API
  - Google Gemini API
  - DeepSeek API
  - 自定义 AI API (兼容 OpenAI 格式)
- **语音识别**: Web Speech API / OpenAI Whisper API
- **OCR**: Tesseract.js / Google Cloud Vision API
- **缓存**: LRU Cache + SQLite
- **配置存储**: electron-store


## 组件和接口

### 1. 翻译服务管理器 (TranslationManager)

主进程中的核心组件，负责管理所有翻译相关的服务和配置。

```javascript
class TranslationManager {
  constructor() {
    this.engines = new Map();
    this.config = null;
    this.cache = null;
  }

  // 注册翻译引擎
  registerEngine(name, adapter) {}

  // 执行翻译
  async translate(text, sourceLang, targetLang, engineName, options) {}

  // 获取配置
  getConfig(accountId) {}

  // 保存配置
  saveConfig(accountId, config) {}

  // 语言检测
  async detectLanguage(text) {}
}
```

**接口定义**:

```typescript
interface TranslationRequest {
  text: string;
  sourceLang: string;  // 'auto' for auto-detect
  targetLang: string;
  engineName: string;
  style?: string;      // AI 翻译风格
  context?: string;    // 上下文信息
}

interface TranslationResponse {
  translatedText: string;
  detectedLang?: string;
  confidence?: number;
  cached: boolean;
  engineUsed: string;
}

interface TranslationConfig {
  accountId: string;
  global: {
    autoTranslate: boolean;
    engine: string;
    sourceLang: string;
    targetLang: string;
    groupTranslation: boolean;
  };
  inputBox: {
    enabled: boolean;
    style: string;
  };
  advanced: {
    friendIndependent: boolean;
    blockChinese: boolean;
    realtime: boolean;
    reverseTranslation: boolean;
    voiceTranslation: boolean;
    imageTranslation: boolean;
  };
  friendConfigs: Map<string, FriendTranslationConfig>;
}

interface FriendTranslationConfig {
  contactId: string;
  enabled: boolean;
  targetLang: string;
  blockChinese: boolean;
}
```

### 2. 翻译引擎适配器 (Translation Adapters)

统一的翻译引擎接口，支持多种翻译服务。

```javascript
// 基础适配器接口
class TranslationAdapter {
  constructor(config) {
    this.config = config;
  }

  async translate(text, sourceLang, targetLang, options) {
    throw new Error('Must implement translate method');
  }

  async detectLanguage(text) {
    throw new Error('Must implement detectLanguage method');
  }

  isAvailable() {
    return true;
  }
}

// Google 翻译适配器
class GoogleTranslateAdapter extends TranslationAdapter {
  async translate(text, sourceLang, targetLang, options) {
    // 使用 Google Translate API
  }
}

// AI 翻译适配器 (GPT-4, Gemini, DeepSeek)
class AITranslationAdapter extends TranslationAdapter {
  constructor(config) {
    super(config);
    this.apiEndpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  async translate(text, sourceLang, targetLang, options) {
    const style = options.style || '通用';
    const prompt = this.buildPrompt(text, sourceLang, targetLang, style);
    // 调用 AI API
  }

  buildPrompt(text, sourceLang, targetLang, style) {
    const stylePrompts = {
      '通用': '请将以下文本翻译成{targetLang}，保持原意。',
      '正式': '请将以下文本翻译成{targetLang}，使用正式、专业的语气。',
      '口语化': '请将以下文本翻译成{targetLang}，使用口语化、轻松的表达。',
      // ... 其他风格
    };
    return `${stylePrompts[style]}\n\n原文：${text}\n\n只输出翻译结果，不要包含任何解释或额外内容。`;
  }
}
```

### 3. 缓存管理器 (CacheManager)

管理翻译结果的缓存，提高性能并减少 API 调用。

```javascript
class CacheManager {
  constructor(maxSize = 1000, ttl = 7 * 24 * 60 * 60 * 1000) {
    this.cache = new LRUCache({ max: maxSize });
    this.ttl = ttl;
    this.db = null; // SQLite 数据库
  }

  // 生成缓存键
  generateKey(text, sourceLang, targetLang, engine) {
    return crypto.createHash('md5')
      .update(`${text}:${sourceLang}:${targetLang}:${engine}`)
      .digest('hex');
  }

  // 获取缓存
  async get(text, sourceLang, targetLang, engine) {}

  // 设置缓存
  async set(text, sourceLang, targetLang, engine, result) {}

  // 清理过期缓存
  async cleanup() {}

  // 获取统计信息
  getStats() {}
}
```


### 4. 内容脚本注入器 (Content Script Injector)

在 WhatsApp Web 页面中注入脚本，实现 DOM 操作和消息拦截。

```javascript
// 在主进程中注入
function injectTranslationScript(webContents) {
  webContents.executeJavaScript(`
    (function() {
      // 翻译系统初始化
      window.WhatsAppTranslation = {
        config: null,
        messageObserver: null,
        inputObserver: null,
        
        init: function() {
          this.observeMessages();
          this.observeInputBox();
          this.injectUI();
        },
        
        observeMessages: function() {
          // 监听消息 DOM 变化
          const chatContainer = document.querySelector('[data-testid="conversation-panel-messages"]');
          if (!chatContainer) return;
          
          this.messageObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && node.matches('[data-testid="msg-container"]')) {
                  this.handleNewMessage(node);
                }
              });
            });
          });
          
          this.messageObserver.observe(chatContainer, {
            childList: true,
            subtree: true
          });
        },
        
        handleNewMessage: async function(messageNode) {
          // 提取消息文本
          const textElement = messageNode.querySelector('.selectable-text');
          if (!textElement) return;
          
          const messageText = textElement.innerText;
          const isGroupChat = this.isGroupChat();
          
          // 检查是否需要翻译
          if (!this.config.global.autoTranslate) return;
          if (isGroupChat && !this.config.global.groupTranslation) return;
          
          // 请求翻译
          const result = await window.electronAPI.translate({
            text: messageText,
            sourceLang: this.config.global.sourceLang,
            targetLang: this.config.global.targetLang,
            engineName: this.config.global.engine
          });
          
          // 显示翻译结果
          this.displayTranslation(messageNode, result);
        },
        
        displayTranslation: function(messageNode, result) {
          // 创建翻译结果元素
          const translationDiv = document.createElement('div');
          translationDiv.className = 'wa-translation-result';
          translationDiv.innerHTML = \`
            <div class="translation-header">
              <span class="translation-icon">🌐</span>
              <span class="translation-lang">\${result.detectedLang} → \${this.config.global.targetLang}</span>
            </div>
            <div class="translation-text">\${result.translatedText}</div>
          \`;
          
          // 插入到消息下方
          const messageContent = messageNode.querySelector('.message-in, .message-out');
          messageContent.appendChild(translationDiv);
        },
        
        observeInputBox: function() {
          // 监听输入框
          const inputBox = document.querySelector('[data-testid="conversation-compose-box-input"]');
          if (!inputBox) return;
          
          // 添加翻译按钮
          this.addTranslateButton();
          
          // 实时翻译监听
          if (this.config.advanced.realtime) {
            let timeout;
            inputBox.addEventListener('input', () => {
              clearTimeout(timeout);
              timeout = setTimeout(() => {
                this.handleRealtimeTranslation(inputBox);
              }, 500);
            });
          }
        },
        
        addTranslateButton: function() {
          const composeBox = document.querySelector('[data-testid="compose-box"]');
          if (!composeBox) return;
          
          const translateBtn = document.createElement('button');
          translateBtn.className = 'wa-translate-btn';
          translateBtn.innerHTML = '🌐';
          translateBtn.title = '翻译';
          translateBtn.onclick = () => this.translateInputBox();
          
          composeBox.appendChild(translateBtn);
        },
        
        translateInputBox: async function() {
          const inputBox = document.querySelector('[data-testid="conversation-compose-box-input"]');
          const text = inputBox.innerText;
          
          if (!text.trim()) return;
          
          // 检查禁发中文
          if (this.config.advanced.blockChinese && this.containsChinese(text)) {
            alert('检测到中文内容，请先翻译后再发送');
            return;
          }
          
          // 请求翻译
          const result = await window.electronAPI.translate({
            text: text,
            sourceLang: 'auto',
            targetLang: this.config.global.targetLang,
            engineName: this.config.global.engine,
            style: this.config.inputBox.style
          });
          
          // 替换输入框内容
          inputBox.innerText = result.translatedText;
          
          // 触发输入事件以更新 WhatsApp 状态
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        },
        
        containsChinese: function(text) {
          return /[\u4e00-\u9fa5]/.test(text);
        },
        
        isGroupChat: function() {
          return document.querySelector('[data-testid="conversation-info-header-chat-title"]')
            ?.innerText.includes('群组');
        },
        
        injectUI: function() {
          // 注入翻译设置面板
          this.injectSettingsPanel();
          // 注入样式
          this.injectStyles();
        },
        
        injectSettingsPanel: function() {
          // 创建设置按钮和面板
          // 实现省略...
        },
        
        injectStyles: function() {
          const style = document.createElement('style');
          style.textContent = \`
            .wa-translation-result {
              margin-top: 8px;
              padding: 8px;
              background: rgba(0, 0, 0, 0.05);
              border-radius: 8px;
              font-size: 14px;
            }
            .translation-header {
              display: flex;
              align-items: center;
              gap: 6px;
              margin-bottom: 4px;
              font-size: 12px;
              color: #667781;
            }
            .translation-text {
              color: #111b21;
            }
            .wa-translate-btn {
              padding: 8px;
              background: transparent;
              border: none;
              cursor: pointer;
              font-size: 20px;
            }
            .wa-translate-btn:hover {
              background: rgba(0, 0, 0, 0.05);
              border-radius: 50%;
            }
          \`;
          document.head.appendChild(style);
        }
      };
      
      // 等待 WhatsApp Web 加载完成
      const waitForWhatsApp = setInterval(() => {
        if (document.querySelector('[data-testid="conversation-panel-messages"]')) {
          clearInterval(waitForWhatsApp);
          window.WhatsAppTranslation.init();
        }
      }, 1000);
    })();
  `);
}
```

### 5. IPC 通信接口

主进程和渲染进程之间的通信接口。

```javascript
// 主进程 (main.js)
const { ipcMain } = require('electron');

// 翻译请求
ipcMain.handle('translation:translate', async (event, request) => {
  return await translationManager.translate(
    request.text,
    request.sourceLang,
    request.targetLang,
    request.engineName,
    { style: request.style, context: request.context }
  );
});

// 获取配置
ipcMain.handle('translation:getConfig', async (event, accountId) => {
  return translationManager.getConfig(accountId);
});

// 保存配置
ipcMain.handle('translation:saveConfig', async (event, accountId, config) => {
  return translationManager.saveConfig(accountId, config);
});

// 语言检测
ipcMain.handle('translation:detectLanguage', async (event, text) => {
  return translationManager.detectLanguage(text);
});

// 语音翻译
ipcMain.handle('translation:translateVoice', async (event, audioData) => {
  // 1. 语音转文本
  const text = await voiceRecognitionService.recognize(audioData);
  // 2. 翻译文本
  return await translationManager.translate(text, 'auto', config.targetLang, config.engine);
});

// 图片翻译
ipcMain.handle('translation:translateImage', async (event, imageData) => {
  // 1. OCR 识别
  const text = await ocrService.recognize(imageData);
  // 2. 翻译文本
  return await translationManager.translate(text, 'auto', config.targetLang, config.engine);
});

// 预加载脚本 (preload.js)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  translate: (request) => ipcRenderer.invoke('translation:translate', request),
  getConfig: (accountId) => ipcRenderer.invoke('translation:getConfig', accountId),
  saveConfig: (accountId, config) => ipcRenderer.invoke('translation:saveConfig', accountId, config),
  detectLanguage: (text) => ipcRenderer.invoke('translation:detectLanguage', text),
  translateVoice: (audioData) => ipcRenderer.invoke('translation:translateVoice', audioData),
  translateImage: (imageData) => ipcRenderer.invoke('translation:translateImage', imageData)
});
```


## 数据模型

### 1. 翻译配置数据模型

```javascript
// 存储在 electron-store 中
{
  "accounts": {
    "account_1": {
      "global": {
        "autoTranslate": true,
        "engine": "google",
        "sourceLang": "auto",
        "targetLang": "zh-CN",
        "groupTranslation": false
      },
      "inputBox": {
        "enabled": true,
        "style": "通用"
      },
      "advanced": {
        "friendIndependent": true,
        "blockChinese": false,
        "realtime": false,
        "reverseTranslation": false,
        "voiceTranslation": true,
        "imageTranslation": true
      },
      "friendConfigs": {
        "1234567890@c.us": {
          "enabled": true,
          "targetLang": "en",
          "blockChinese": true
        }
      }
    }
  },
  "engines": {
    "google": {
      "type": "google",
      "enabled": true
    },
    "gpt4": {
      "type": "openai",
      "enabled": true,
      "apiKey": "sk-xxx",
      "model": "gpt-4",
      "endpoint": "https://api.openai.com/v1/chat/completions"
    },
    "gemini": {
      "type": "gemini",
      "enabled": true,
      "apiKey": "xxx",
      "model": "gemini-pro"
    },
    "deepseek": {
      "type": "openai",
      "enabled": true,
      "apiKey": "xxx",
      "model": "deepseek-chat",
      "endpoint": "https://api.deepseek.com/v1/chat/completions"
    },
    "custom": {
      "type": "custom",
      "enabled": false,
      "apiKey": "",
      "model": "",
      "endpoint": ""
    }
  }
}
```

### 2. 翻译缓存数据模型

```sql
-- SQLite 数据库结构
CREATE TABLE translation_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT UNIQUE NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  engine TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  accessed_at INTEGER NOT NULL,
  access_count INTEGER DEFAULT 1
);

CREATE INDEX idx_cache_key ON translation_cache(cache_key);
CREATE INDEX idx_created_at ON translation_cache(created_at);
```

### 3. 翻译统计数据模型

```sql
CREATE TABLE translation_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  date TEXT NOT NULL,
  engine TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  total_chars INTEGER DEFAULT 0,
  avg_response_time INTEGER DEFAULT 0,
  UNIQUE(account_id, date, engine)
);

CREATE INDEX idx_account_date ON translation_stats(account_id, date);
```

## 错误处理

### 错误类型定义

```javascript
class TranslationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'TranslationError';
    this.code = code;
    this.details = details;
  }
}

// 错误代码
const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_KEY_INVALID: 'API_KEY_INVALID',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNSUPPORTED_LANGUAGE: 'UNSUPPORTED_LANGUAGE',
  TEXT_TOO_LONG: 'TEXT_TOO_LONG',
  ENGINE_NOT_AVAILABLE: 'ENGINE_NOT_AVAILABLE',
  TRANSLATION_FAILED: 'TRANSLATION_FAILED',
  OCR_FAILED: 'OCR_FAILED',
  VOICE_RECOGNITION_FAILED: 'VOICE_RECOGNITION_FAILED'
};
```

### 错误处理策略

1. **网络错误**: 自动重试 3 次，间隔 1s、2s、4s
2. **API 密钥错误**: 立即通知用户，停止使用该引擎
3. **速率限制**: 切换到备用引擎或延迟重试
4. **不支持的语言**: 提示用户选择其他语言对
5. **文本过长**: 自动分段翻译，最大 5000 字符/段
6. **引擎不可用**: 自动切换到备用引擎
7. **翻译失败**: 显示原文，记录错误日志

### 错误处理实现

```javascript
class TranslationManager {
  async translate(text, sourceLang, targetLang, engineName, options = {}) {
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 检查缓存
        const cached = await this.cache.get(text, sourceLang, targetLang, engineName);
        if (cached) {
          return { ...cached, cached: true };
        }
        
        // 获取引擎
        const engine = this.engines.get(engineName);
        if (!engine || !engine.isAvailable()) {
          throw new TranslationError(
            ErrorCodes.ENGINE_NOT_AVAILABLE,
            `Engine ${engineName} is not available`
          );
        }
        
        // 执行翻译
        const result = await engine.translate(text, sourceLang, targetLang, options);
        
        // 缓存结果
        await this.cache.set(text, sourceLang, targetLang, engineName, result);
        
        // 记录统计
        await this.recordStats(engineName, true, text.length, Date.now() - startTime);
        
        return { ...result, cached: false };
        
      } catch (error) {
        lastError = error;
        
        // 记录失败统计
        await this.recordStats(engineName, false, text.length, 0);
        
        // 根据错误类型决定是否重试
        if (error.code === ErrorCodes.API_KEY_INVALID) {
          // 不重试，直接失败
          break;
        }
        
        if (error.code === ErrorCodes.RATE_LIMIT_EXCEEDED) {
          // 尝试切换引擎
          const fallbackEngine = this.getFallbackEngine(engineName);
          if (fallbackEngine) {
            engineName = fallbackEngine;
            continue;
          }
        }
        
        // 网络错误，等待后重试
        if (attempt < maxRetries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    // 所有重试失败
    throw lastError;
  }
  
  getFallbackEngine(currentEngine) {
    const fallbackOrder = ['google', 'gpt4', 'gemini', 'deepseek'];
    const currentIndex = fallbackOrder.indexOf(currentEngine);
    
    for (let i = currentIndex + 1; i < fallbackOrder.length; i++) {
      const engine = this.engines.get(fallbackOrder[i]);
      if (engine && engine.isAvailable()) {
        return fallbackOrder[i];
      }
    }
    
    return null;
  }
}
```


## 测试策略

### 单元测试

**测试范围**:
- 翻译引擎适配器
- 缓存管理器
- 配置管理器
- 语言检测器
- 错误处理逻辑

**测试框架**: Jest

**测试示例**:

```javascript
describe('GoogleTranslateAdapter', () => {
  let adapter;
  
  beforeEach(() => {
    adapter = new GoogleTranslateAdapter({ apiKey: 'test-key' });
  });
  
  test('should translate text correctly', async () => {
    const result = await adapter.translate('Hello', 'en', 'zh-CN');
    expect(result.translatedText).toBe('你好');
  });
  
  test('should detect language correctly', async () => {
    const lang = await adapter.detectLanguage('Hello world');
    expect(lang).toBe('en');
  });
  
  test('should handle API errors gracefully', async () => {
    adapter.config.apiKey = 'invalid-key';
    await expect(adapter.translate('Hello', 'en', 'zh-CN'))
      .rejects.toThrow(TranslationError);
  });
});

describe('CacheManager', () => {
  let cache;
  
  beforeEach(() => {
    cache = new CacheManager(100, 1000);
  });
  
  test('should cache translation results', async () => {
    await cache.set('Hello', 'en', 'zh-CN', 'google', { translatedText: '你好' });
    const result = await cache.get('Hello', 'en', 'zh-CN', 'google');
    expect(result.translatedText).toBe('你好');
  });
  
  test('should return null for cache miss', async () => {
    const result = await cache.get('NonExistent', 'en', 'zh-CN', 'google');
    expect(result).toBeNull();
  });
});
```

### 集成测试

**测试范围**:
- 主进程与渲染进程 IPC 通信
- 翻译引擎与缓存的集成
- 配置加载与保存
- 内容脚本注入与 DOM 操作

**测试框架**: Jest + Spectron (Electron 测试)

### 端到端测试

**测试场景**:
1. 用户启用自动翻译，接收消息时自动显示翻译
2. 用户在输入框输入文本，点击翻译按钮，文本被翻译
3. 用户为特定好友设置独立翻译配置
4. 用户启用禁发中文，尝试发送中文被拦截
5. 用户启用实时翻译，输入时显示实时翻译预览
6. 用户接收语音消息，自动转文本并翻译
7. 用户接收图片消息，自动 OCR 并翻译

**测试工具**: Playwright + Electron

### 性能测试

**测试指标**:
- 翻译响应时间: < 2s (95th percentile)
- 缓存命中率: > 60%
- 内存占用: < 100MB (翻译模块)
- CPU 占用: < 5% (空闲时)

**测试方法**:
- 使用 Lighthouse 进行性能分析
- 使用 Chrome DevTools 进行内存和 CPU 分析
- 模拟大量翻译请求进行压力测试

### 兼容性测试

**测试平台**:
- Windows 10/11
- macOS 12+
- Linux (Ubuntu 20.04+)

**测试浏览器内核**:
- Chromium (Electron 内置)

**测试 WhatsApp Web 版本**:
- 当前稳定版
- Beta 版 (如有)

## 性能优化

### 1. 翻译缓存策略

- **LRU 缓存**: 内存中保留最近 1000 条翻译结果
- **持久化缓存**: SQLite 存储所有翻译历史，7 天过期
- **缓存预热**: 应用启动时加载常用翻译对
- **批量翻译**: 合并多个短文本为一次请求

### 2. DOM 操作优化

- **虚拟滚动**: 只渲染可见区域的翻译结果
- **防抖处理**: 实时翻译使用 500ms 防抖
- **批量更新**: 使用 requestAnimationFrame 批量更新 DOM
- **事件委托**: 使用事件委托减少事件监听器数量

### 3. 网络请求优化

- **请求队列**: 限制并发翻译请求数量 (最多 5 个)
- **请求合并**: 相同文本的重复请求合并为一次
- **超时控制**: 翻译请求超时时间 10s
- **连接复用**: 使用 HTTP/2 或 keep-alive

### 4. 内存管理

- **定期清理**: 每小时清理过期缓存
- **内存限制**: 缓存总大小不超过 50MB
- **懒加载**: 翻译引擎按需加载
- **资源释放**: 及时释放不再使用的资源

## 安全考虑

### 1. API 密钥保护

- 使用 Electron safeStorage 加密存储 API 密钥
- 不在日志中记录完整的 API 密钥
- 支持环境变量配置 API 密钥

```javascript
const { safeStorage } = require('electron');

class SecureStorage {
  encryptApiKey(apiKey) {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(apiKey).toString('base64');
    }
    return apiKey; // 降级方案
  }
  
  decryptApiKey(encrypted) {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encrypted, 'base64');
      return safeStorage.decryptString(buffer);
    }
    return encrypted;
  }
}
```

### 2. 数据隐私

- 翻译内容不上传到第三方服务器（除翻译 API）
- 缓存数据本地存储，不同步到云端
- 支持用户手动清除所有翻译历史
- 遵守 GDPR 和其他隐私法规

### 3. 内容安全

- 对用户输入进行 XSS 过滤
- 翻译结果进行 HTML 转义
- 防止 SQL 注入（使用参数化查询）
- 限制翻译文本长度（最大 10000 字符）

### 4. 网络安全

- 所有 API 请求使用 HTTPS
- 验证 SSL 证书
- 实现请求签名防止篡改
- 设置合理的超时时间防止 DoS

## 部署和配置

### 1. 配置文件结构

```
.kiro/
└── translation/
    ├── config.json          # 翻译配置
    ├── cache.db             # 翻译缓存数据库
    └── stats.db             # 统计数据库
```

### 2. 环境变量

```bash
# Google Translate API
GOOGLE_TRANSLATE_API_KEY=xxx

# OpenAI API
OPENAI_API_KEY=sk-xxx
OPENAI_API_ENDPOINT=https://api.openai.com/v1/chat/completions

# Gemini API
GEMINI_API_KEY=xxx

# DeepSeek API
DEEPSEEK_API_KEY=xxx
DEEPSEEK_API_ENDPOINT=https://api.deepseek.com/v1/chat/completions

# 缓存配置
TRANSLATION_CACHE_SIZE=1000
TRANSLATION_CACHE_TTL=604800000  # 7 days in ms

# 日志级别
TRANSLATION_LOG_LEVEL=info
```

### 3. 初始化流程

1. 应用启动时加载翻译配置
2. 初始化翻译引擎（根据配置）
3. 连接缓存数据库
4. 注入内容脚本到 WhatsApp Web
5. 建立 IPC 通信通道
6. 开始监听消息和用户操作

### 4. 更新和维护

- 支持热更新翻译引擎配置
- 定期检查翻译 API 可用性
- 自动清理过期缓存和日志
- 提供配置导入导出功能

## 扩展性设计

### 1. 插件化翻译引擎

支持用户自定义翻译引擎插件：

```javascript
// 插件接口
class TranslationPlugin {
  constructor(config) {
    this.name = config.name;
    this.version = config.version;
  }
  
  async translate(text, sourceLang, targetLang, options) {
    // 插件实现
  }
  
  async detectLanguage(text) {
    // 插件实现
  }
}

// 插件注册
translationManager.registerPlugin(new CustomTranslationPlugin({
  name: 'MyTranslator',
  version: '1.0.0',
  apiEndpoint: 'https://my-api.com/translate'
}));
```

### 2. 多平台支持

设计支持扩展到其他聊天平台：

- Telegram
- Facebook Messenger
- WeChat (如果可行)

### 3. 翻译历史和学习

- 记录用户的翻译偏好
- 基于历史优化翻译质量
- 支持用户自定义术语表

### 4. 协作翻译

- 支持团队共享翻译配置
- 统一的术语库管理
- 翻译质量评分和反馈
