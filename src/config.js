/**
 * 应用程序配置
 */

const path = require('path');
const { app } = require('electron');

module.exports = {
  // 会话数据存储路径（已弃用，保留用于迁移）
  sessionPath: process.env.SESSION_PATH || './session-data',
  
  // Electron 窗口配置（已弃用，保留用于兼容性）
  windowConfig: {
    width: 1200,
    height: 800,
    title: '老板稳了！天天旺',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  },
  
  // 多实例配置
  multiInstance: {
    // 最大并发实例数
    maxConcurrentInstances: parseInt(process.env.MAX_INSTANCES) || 30,
    
    // profiles 目录路径
    profilesDir: process.env.PROFILES_DIR || 
      (app ? path.join(app.getPath('userData'), 'profiles') : './profiles'),
    
    // 账号配置文件路径
    accountsConfigPath: process.env.ACCOUNTS_CONFIG_PATH || 
      (app ? path.join(app.getPath('userData'), 'accounts.json') : './accounts.json'),
    
    // 实例默认配置
    defaultInstanceConfig: {
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, 'preload.js')
      }
    },
    
    // 实例监控配置
    monitoring: {
      // 心跳检测间隔（毫秒）
      heartbeatInterval: 30000,
      
      // 崩溃重启最大次数
      maxCrashRestarts: 3,
      
      // 崩溃重启延迟（毫秒）
      crashRestartDelay: 5000,
      
      // 内存使用警告阈值（MB）
      memoryWarningThreshold: 1024,
      
      // CPU 使用警告阈值（%）
      cpuWarningThreshold: 80
    },
    
    // 资源限制
    resourceLimits: {
      // 单个实例最大内存（MB）
      maxMemoryPerInstance: 2048,
      
      // 延迟加载
      lazyLoading: true,
      
      // 实例池大小
      instancePoolSize: 5
    }
  },
  
  // 自动启动配置
  autoStart: process.env.AUTO_START !== 'false',
  
  // 日志级别
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // 控制台过滤配置
  consoleFilter: {
    // 是否过滤 WhatsApp Web 的内部错误
    enabled: process.env.FILTER_CONSOLE !== 'false',
    // 要过滤的错误模式
    ignoredPatterns: [
      'ErrorUtils caught an error',
      'x-storagemutated',
      'Subsequent non-fatal errors',
      'debugjs',
      'fburl.com'
    ]
  },
  
  // 系统托盘配置
  trayConfig: {
    // 是否启用系统托盘
    enabled: process.env.TRAY_ENABLED !== 'false',
    // 是否最小化到托盘
    minimizeToTray: process.env.MINIMIZE_TO_TRAY !== 'false'
  },
  
  
  
  // 翻译配置
  translation: {
    // 支持的翻译引擎
    supportedEngines: ['google', 'gpt4', 'gemini', 'deepseek'],
    
    // 默认目标语言
    defaultTargetLanguage: 'zh-CN',
    
    // 翻译缓存大小
    cacheSize: 1000,
    
    // 翻译超时（毫秒）
    timeout: 5000
  },
  
  // 应用主题
  theme: process.env.THEME || 'system', // 'light' | 'dark' | 'system'
  
  // 通知配置
  notifications: {
    // 是否启用通知
    enabled: process.env.NOTIFICATIONS_ENABLED !== 'false',
    
    // 是否启用声音
    sound: process.env.NOTIFICATION_SOUND !== 'false',
    
    // 是否显示徽章
    badge: process.env.NOTIFICATION_BADGE !== 'false'
  }
};
