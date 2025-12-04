# 设计文档

## 概述

本设计文档描述了如何将 **whatsapp-web.js** 库封装为桌面应用程序的技术方案。

**核心理念**：whatsapp-web.js 使用 Puppeteer 控制 Chromium 浏览器，打开**真正的 web.whatsapp.com**（官方 WhatsApp Web）。我们的工作是：
1. 使用 Electron 创建桌面应用外壳
2. 在 Electron 窗口中直接显示 whatsapp-web.js 打开的 WhatsApp Web 页面
3. 用户看到的就是完整的官方 WhatsApp Web 界面
4. 通过 Docker 实现容器化部署

**关键理解**：
- whatsapp-web.js 会在 Puppeteer 控制的 Chromium 中打开 web.whatsapp.com
- 这就是官方的 WhatsApp Web，包含完整的 UI 和所有功能
- 我们只需要把这个页面显示在 Electron 窗口中
- 不需要自己开发任何 WhatsApp UI 或功能

### 技术栈

- **桌面框架**: Electron
- **WhatsApp 客户端库**: whatsapp-web.js（内部使用 Puppeteer + Chromium）
- **运行时**: Node.js 18+
- **容器化**: Docker

### whatsapp-web.js 工作原理

1. whatsapp-web.js 使用 Puppeteer 启动 Chromium 浏览器
2. 在 Chromium 中打开 https://web.whatsapp.com
3. 这就是官方的 WhatsApp Web 页面，包含完整的聊天界面
4. whatsapp-web.js 提供 API 来监听事件和发送消息
5. LocalAuth 策略自动持久化登录会话

## 架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       Docker 容器                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 Electron 应用程序                      │  │
│  │                                                        │  │
│  │  ┌──────────────────────┐   ┌────────────────────┐   │  │
│  │  │   主进程 (Main)       │   │  Electron 窗口     │   │  │
│  │  │                      │   │  (BrowserWindow)   │   │  │
│  │  │  ┌────────────────┐  │   │                    │   │  │
│  │  │  │ whatsapp-web.js│  │   │  ┌──────────────┐  │   │  │
│  │  │  │ Client         │  │   │  │ 显示 Puppeteer│  │   │  │
│  │  │  │                │  │   │  │ 打开的页面    │  │   │  │
│  │  │  │ - 启动 Client  │  │   │  │              │  │   │  │
│  │  │  │ - 监听事件     │  │   │  │ web.whatsapp │  │   │  │
│  │  │  └────────┬───────┘  │   │  │    .com      │  │   │  │
│  │  │           │          │   │  │              │  │   │  │
│  │  │           ▼          │   │  │ (官方 UI)    │  │   │  │
│  │  │  ┌────────────────┐  │   │  └──────────────┘  │   │  │
│  │  │  │ Puppeteer      │  │   │                    │   │  │
│  │  │  │ 控制 Chromium  │──┼───┼──► 用户看到完整的  │   │  │
│  │  │  │                │  │   │    WhatsApp Web   │   │  │
│  │  │  │ 打开           │  │   │    界面           │   │  │
│  │  │  │ web.whatsapp   │  │   │                    │   │  │
│  │  │  │ .com           │  │   │                    │   │  │
│  │  │  └────────────────┘  │   └────────────────────┘   │  │
│  │  └──────────────────────┘                            │  │
│  └───────────────────────────────────────────────────────┘  │
│            │                                                │
│     ┌──────▼──────┐                                         │
│     │ .wwebjs_auth│  (会话数据，由 LocalAuth 管理)           │
│     └─────────────┘                                         │
└─────────────────────────────────────────────────────────────┘
         │                              
         ▼                              
   持久化卷 (Docker Volume)
```

**关键点**：
- whatsapp-web.js 在后台使用 Puppeteer 打开 web.whatsapp.com
- Electron 窗口直接显示这个页面
- 用户看到的是完整的官方 WhatsApp Web 界面，不是我们自己做的 UI


## 核心组件

### 实现方案

**方案 B**：直接在 Electron 窗口中显示 whatsapp-web.js 打开的 WhatsApp Web 页面。

有两种技术实现方式：

#### 方式 1：使用 Puppeteer 的 browserWSEndpoint

让 Electron 连接到 whatsapp-web.js 启动的 Chromium 实例。

```javascript
// main.js
const { app, BrowserWindow } = require('electron');
const { Client, LocalAuth } = require('whatsapp-web.js');
const puppeteer = require('puppeteer-core');

let mainWindow;
let client;
let browser;

async function createWindow() {
  // 创建 whatsapp-web.js 客户端
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './session-data'
    }),
    puppeteer: {
      headless: false,  // 非无头模式，这样可以看到页面
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--remote-debugging-port=9222'  // 启用远程调试
      ]
    }
  });

  // 获取 Puppeteer 浏览器实例
  client.on('ready', async () => {
    console.log('WhatsApp 已连接');
    
    // 获取 Puppeteer 的页面
    const pages = await client.pupPage.browser().pages();
    const whatsappPage = pages.find(page => 
      page.url().includes('web.whatsapp.com')
    );
    
    if (whatsappPage) {
      // 创建 Electron 窗口并加载 WhatsApp Web 页面
      mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      
      // 直接加载 WhatsApp Web URL
      mainWindow.loadURL('https://web.whatsapp.com');
    }
  });

  // 初始化客户端
  await client.initialize();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  if (client) {
    await client.destroy();
  }
  app.quit();
});
```

#### 方式 2：使用 BrowserView 嵌入 Puppeteer 页面

更简单的方式是让 Electron 直接加载 web.whatsapp.com，让 whatsapp-web.js 在后台处理认证。

```javascript
// main.js
const { app, BrowserWindow } = require('electron');
const { Client, LocalAuth } = require('whatsapp-web.js');

let mainWindow;
let client;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  // 直接加载 WhatsApp Web
  mainWindow.loadURL('https://web.whatsapp.com');
}

async function initializeWhatsApp() {
  // 在后台运行 whatsapp-web.js 处理认证
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './session-data'
    }),
    puppeteer: {
      headless: true,  // 后台运行
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    console.log('QR 码:', qr);
    // 可以将 QR 码发送到渲染进程显示
  });

  client.on('ready', () => {
    console.log('WhatsApp 已连接');
    // 认证完成后，Electron 窗口中的 web.whatsapp.com 也会自动登录
  });

  await client.initialize();
}

app.whenReady().then(async () => {
  createWindow();
  await initializeWhatsApp();
});

app.on('window-all-closed', async () => {
  if (client) {
    await client.destroy();
  }
  app.quit();
});
```

### 推荐方案

**最简单的方案**：直接在 Electron 中加载 web.whatsapp.com

```javascript
// main.js - 简化版本
const { app, BrowserWindow } = require('electron');
const { Client, LocalAuth } = require('whatsapp-web.js');

let mainWindow;
let client;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'WhatsApp Desktop',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  // 直接加载官方 WhatsApp Web
  mainWindow.loadURL('https://web.whatsapp.com');
}

async function initializeWhatsApp() {
  // whatsapp-web.js 在后台运行，用于：
  // 1. 自动处理认证和会话持久化
  // 2. 提供 API 用于未来的扩展功能（翻译、自动回复等）
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './session-data'
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('ready', () => {
    console.log('WhatsApp 客户端已就绪');
  });

  client.on('message', async (msg) => {
    console.log(`收到消息: ${msg.from} - ${msg.body}`);
    // 这里可以添加自定义逻辑，如翻译、自动回复等
  });

  await client.initialize();
}

app.whenReady().then(async () => {
  createWindow();
  await initializeWhatsApp();
});

app.on('window-all-closed', async () => {
  if (client) {
    await client.destroy();
  }
  app.quit();
});
```

**关键点**：
- Electron 窗口直接加载 https://web.whatsapp.com
- 用户看到的是完整的官方 WhatsApp Web 界面
- whatsapp-web.js 在后台运行，处理认证和提供 API
- 会话通过 LocalAuth 自动持久化
- 未来可以通过 whatsapp-web.js 的 API 添加翻译等功能

## 数据模型

### 会话数据

whatsapp-web.js 的 `LocalAuth` 策略会自动管理会话数据，存储在指定的目录中（例如 `./session-data/.wwebjs_auth`）。

**重要**：
- Electron 窗口中的 web.whatsapp.com 和 whatsapp-web.js 后台实例会共享同一个会话
- LocalAuth 自动处理会话持久化，重启后无需重新扫码
- 会话数据包含认证令牌和加密密钥

### 配置

```javascript
// config.js
module.exports = {
  sessionPath: process.env.SESSION_PATH || './session-data',
  windowConfig: {
    width: 1200,
    height: 800,
    title: 'WhatsApp Desktop'
  },
  puppeteerArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu'
  ]
};
```

## 容器化设计

### Dockerfile

```dockerfile
FROM node:18-slim

# 安装 Chromium 和依赖
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# 设置 Puppeteer 使用系统 Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 创建应用目录
WORKDIR /app

# 复制 package.json 并安装依赖
COPY package*.json ./
RUN npm ci --production

# 复制应用代码
COPY . .

# 创建会话数据目录
RUN mkdir -p /data/session

# 设置环境变量
ENV SESSION_PATH=/data/session

# 启动应用
CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  whatsapp-desktop:
    build: .
    container_name: whatsapp-desktop
    volumes:
      # 持久化会话数据
      - whatsapp-session:/data/session
    environment:
      - SESSION_PATH=/data/session
      - NODE_ENV=production
    restart: unless-stopped
    # 容器需要足够的共享内存给 Chromium
    shm_size: 2gb

volumes:
  whatsapp-session:
    driver: local
```

### 关键配置说明

1. **Chromium 依赖**：容器中需要安装 Chromium 和相关依赖，因为 whatsapp-web.js 使用 Puppeteer
2. **共享内存**：设置 `shm_size: 2gb` 避免 Chromium 崩溃
3. **会话持久化**：使用 Docker volume 挂载 `/data/session` 目录
4. **无头模式**：Puppeteer 配置 `headless: true`


## 错误处理

### 常见错误场景

#### 1. Puppeteer/Chromium 启动失败

```javascript
client.on('auth_failure', (msg) => {
  console.error('认证失败:', msg);
  mainWindow.webContents.send('status', '认证失败，请重试');
});

// 添加错误处理
client.initialize().catch((err) => {
  console.error('初始化失败:', err);
  mainWindow.webContents.send('status', '初始化失败: ' + err.message);
});
```

#### 2. 会话过期

whatsapp-web.js 会自动处理会话过期，重新生成二维码。我们只需要监听 `qr` 事件。

#### 3. 网络断开

```javascript
client.on('disconnected', (reason) => {
  console.log('断开连接:', reason);
  mainWindow.webContents.send('status', `已断开: ${reason}`);
  
  // 可以选择自动重连
  setTimeout(() => {
    console.log('尝试重新连接...');
    client.initialize();
  }, 5000);
});
```

### 日志记录

```javascript
// 简单的日志记录
const fs = require('fs');
const path = require('path');

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(logMessage);
  
  // 写入日志文件
  fs.appendFileSync(
    path.join(__dirname, 'app.log'),
    logMessage
  );
}

// 使用
client.on('ready', () => {
  log('WhatsApp 客户端已就绪');
});
```

## 测试策略

### 本地测试

1. **基本功能测试**：
   - 启动应用，检查是否显示二维码
   - 扫描二维码，检查是否成功连接
   - 发送测试消息，检查是否能接收
   - 重启应用，检查会话是否持久化

2. **容器测试**：
   ```bash
   # 构建镜像
   docker build -t whatsapp-desktop:test .
   
   # 运行容器
   docker run -it --rm \
     -v whatsapp-test:/data/session \
     --shm-size=2gb \
     whatsapp-desktop:test
   
   # 查看日志
   docker logs -f <container-id>
   ```

### 自动化测试（可选）

由于 whatsapp-web.js 需要真实的 WhatsApp 账号认证，自动化测试比较困难。建议：
- 单元测试：测试辅助函数和工具类
- 集成测试：使用 mock 测试 IPC 通信
- 手动测试：测试完整的用户流程

## 项目结构

```
whatsapp-desktop-container/
├── src/
│   ├── main.js              # 主进程入口（核心文件）
│   └── config.js            # 配置文件
├── docker/
│   ├── Dockerfile           # Docker 镜像定义
│   └── docker-compose.yml   # Docker Compose 配置
├── resources/
│   └── icon.png             # 应用图标
├── package.json
├── .dockerignore
├── .gitignore
└── README.md
```

**说明**：
- 项目非常简单，主要代码在 main.js 中
- 不需要 preload.js、renderer.js 或 index.html
- Electron 窗口直接加载 web.whatsapp.com

### package.json

```json
{
  "name": "whatsapp-desktop-container",
  "version": "1.0.0",
  "main": "src/main.js",
  "scripts": {
    "start": "electron .",
    "dev": "electron . --inspect",
    "build": "electron-builder",
    "docker:build": "docker build -t whatsapp-desktop .",
    "docker:run": "docker-compose up -d"
  },
  "dependencies": {
    "whatsapp-web.js": "^1.23.0"
  },
  "devDependencies": {
    "electron": "^27.0.0",
    "electron-builder": "^24.0.0"
  },
  "build": {
    "appId": "com.whatsapp.desktop",
    "productName": "WhatsApp Desktop",
    "directories": {
      "output": "dist"
    },
    "files": [
      "src/**/*",
      "resources/**/*"
    ],
    "win": {
      "target": "nsis"
    },
    "mac": {
      "target": "dmg"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

**注意**：不需要 `qrcode` 依赖，因为官方 WhatsApp Web 会自己显示二维码。

## 部署方案

### 本地开发

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 生产模式运行
npm start

# 打包应用
npm run build
```

### 容器部署

```bash
# 构建镜像
docker build -t whatsapp-desktop:latest .

# 使用 docker-compose 运行
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止容器
docker-compose down

# 清理会话数据（重新扫码）
docker volume rm whatsapp-desktop_whatsapp-session
```

### 多账号部署（第二阶段）

未来支持多账号时，可以使用不同的容器实例：

```yaml
# docker-compose-multi.yml
version: '3.8'

services:
  whatsapp-account-1:
    build: .
    container_name: whatsapp-account-1
    volumes:
      - whatsapp-session-1:/data/session
    environment:
      - SESSION_PATH=/data/session
    shm_size: 2gb

  whatsapp-account-2:
    build: .
    container_name: whatsapp-account-2
    volumes:
      - whatsapp-session-2:/data/session
    environment:
      - SESSION_PATH=/data/session
    shm_size: 2gb

volumes:
  whatsapp-session-1:
  whatsapp-session-2:
```

## 性能优化

### 1. Puppeteer 优化

```javascript
puppeteer: {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-software-rasterizer'
  ]
}
```

### 2. 内存限制

```javascript
// 在 main.js 中限制 Node.js 内存
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
```

### 3. Docker 镜像优化

- 使用 `node:18-slim` 基础镜像
- 清理 apt 缓存
- 使用 `.dockerignore` 排除不必要的文件

## 安全考虑

### 1. Electron 安全

```javascript
// 在 BrowserWindow 配置中
webPreferences: {
  contextIsolation: true,      // 启用上下文隔离
  nodeIntegration: false,       // 禁用 Node 集成
  sandbox: true,                // 启用沙箱
  preload: path.join(__dirname, 'preload.js')
}
```

### 2. 会话数据保护

- 会话数据存储在 Docker volume 中，与容器隔离
- 使用适当的文件权限（仅容器内应用可访问）
- 定期备份会话数据

### 3. 容器安全

```dockerfile
# 创建非 root 用户
RUN useradd -m -u 1000 whatsapp && \
    chown -R whatsapp:whatsapp /app /data

USER whatsapp
```

## 未来扩展

### 第二阶段功能

#### 1. 多账号支持

- 每个账号运行独立的容器
- 使用容器编排工具（Docker Compose 或 Kubernetes）
- 提供账号管理界面

#### 2. 消息翻译

在消息处理中集成翻译 API：

```javascript
client.on('message', async (msg) => {
  // 检测语言
  const detectedLang = await detectLanguage(msg.body);
  
  // 如果不是目标语言，进行翻译
  if (detectedLang !== 'zh') {
    const translated = await translateText(msg.body, 'zh');
    console.log(`原文: ${msg.body}`);
    console.log(`译文: ${translated}`);
    
    // 可以选择自动回复译文
    // await msg.reply(translated);
  }
});
```

#### 3. 插件系统

- 定义插件接口
- 支持自定义消息处理逻辑
- 提供插件市场

## 可行性评估

### ✅ 可行的部分

1. **Electron 封装**：完全可行，Electron 可以运行 Node.js 代码
2. **whatsapp-web.js 集成**：完全可行，这是一个成熟的库
3. **容器化**：可行，但需要正确配置 Chromium 依赖
4. **会话持久化**：可行，LocalAuth 自动处理
5. **多账号支持**：可行，每个容器运行独立实例

### ⚠️ 需要注意的问题

1. **Chromium 依赖**：容器镜像会比较大（~500MB）
2. **内存占用**：每个实例需要 ~200-300MB 内存
3. **WhatsApp 限制**：WhatsApp 可能会检测并限制自动化行为
4. **认证问题**：需要手机扫码，无法完全自动化

### ❌ 不可行的部分

1. **完全无人值守**：首次启动必须扫码认证
2. **绕过 WhatsApp 限制**：无法绕过 WhatsApp 的反自动化机制

## 总结

这个项目是**完全可行的**。我们不需要重新实现 WhatsApp 的功能，只需要：

1. 用 Electron 封装 whatsapp-web.js
2. 创建简单的 UI 显示状态和二维码
3. 配置 Docker 容器支持 Chromium
4. 使用 Docker volume 持久化会话数据

第一阶段的工作量不大，主要是配置和集成工作。第二阶段的多账号和翻译功能也都是可行的扩展。
