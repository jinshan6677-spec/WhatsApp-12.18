/**
 * 应用常量定义
 * 
 * 统一管理应用程序中的所有常量值
 * 避免常量值散布在各个文件中
 */

// 应用基本信息
const APP_INFO = {
  NAME: 'WhatsApp Desktop Translation',
  VERSION: '1.0.0',
  DESCRIPTION: 'WhatsApp Desktop application with comprehensive translation support',
  AUTHOR: 'WhatsApp Desktop Team',
  HOMEPAGE: 'https://github.com/your-org/whatsapp-desktop-translation'
};

// 文件路径常量
const PATHS = {
  // 数据目录
  DATA_DIR: 'profiles',
  SESSION_DIR: 'session-data',
  CACHE_DIR: 'cache',
  LOGS_DIR: 'logs',
  
  // 配置文件
  CONFIG_FILE: 'config.json',
  ACCOUNTS_FILE: 'accounts.json',
  
  // 应用资源
  RESOURCES_DIR: 'resources',
  ICONS_DIR: 'icons',
  BUILD_RESOURCES_DIR: 'build-resources'
};

// Electron 常量
const ELECTRON = {
  VERSION: '39.1.1',
  NODE_VERSION: '20.x',
  CHROMIUM_VERSION: '132.x'
};

// 窗口配置
const WINDOW_CONFIG = {
  DEFAULT_WIDTH: 1200,
  DEFAULT_HEIGHT: 800,
  MIN_WIDTH: 800,
  MIN_HEIGHT: 600,
  SIDEBAR_WIDTH: 280,
  SIDEBAR_MIN_WIDTH: 200,
  SIDEBAR_MAX_WIDTH: 400,
  
  // 窗口状态
  WINDOW_STATE_KEY: 'window-state',
  
  // 视窗配置
  VIEW_CONFIG: {
    WEB_PREFERENCES: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  }
};

// 账号管理常量
const ACCOUNT_CONFIG = {
  // 账号状态
  STATUS: {
    STOPPED: 'stopped',
    STARTING: 'starting',
    RUNNING: 'running',
    ERROR: 'error',
    OFFLINE: 'offline'
  },
  
  // 账号类型
  TYPES: {
    DEFAULT: 'default',
    WORK: 'work',
    PERSONAL: 'personal'
  },
  
  // 默认配置
  DEFAULTS: {
    AUTO_START: false,
    ENABLE_TRANSLATION: true,
    TRANSLATION_ENGINE: 'google',
    TARGET_LANGUAGE: 'zh-CN',
    
  }
};


// 翻译配置常量
const TRANSLATION_CONFIG = {
  // 支持的翻译引擎
  ENGINES: {
    GOOGLE: 'google',
    GPT4: 'gpt4',
    GEMINI: 'gemini',
    DEEPSEEK: 'deepseek'
  },
  
  // 支持的语言
  LANGUAGES: {
    zh: { code: 'zh', name: '中文', nativeName: '中文' },
    en: { code: 'en', name: 'English', nativeName: 'English' },
    ja: { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    ko: { code: 'ko', name: 'Korean', nativeName: '한국어' },
    es: { code: 'es', name: 'Spanish', nativeName: 'Español' },
    fr: { code: 'fr', name: 'French', nativeName: 'Français' },
    de: { code: 'de', name: 'German', nativeName: 'Deutsch' },
    ru: { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    pt: { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    it: { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية' }
  },
  
  // 翻译风格
  STYLES: {
    GENERAL: 'general',
    FORMAL: 'formal',
    CASUAL: 'casual',
    FRIENDLY: 'friendly',
    HUMOROUS: 'humorous',
    POLITE: 'polite',
    FORCEFUL: 'forceful',
    CONCISE: 'concise',
    INSPIRING: 'inspiring',
    NEUTRAL: 'neutral',
    PROFESSIONAL: 'professional'
  },
  
  // API配置
  API: {
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    REQUEST_TIMEOUT: 30000,
    RATE_LIMIT_DELAY: 100
  }
};

// 错误代码常量
const ERROR_CODES = {
  // 账号相关错误
  ACCOUNT: {
    NOT_FOUND: 'ACCOUNT_NOT_FOUND',
    ALREADY_EXISTS: 'ACCOUNT_ALREADY_EXISTS',
    INVALID_CONFIG: 'INVALID_ACCOUNT_CONFIG',
    START_FAILED: 'ACCOUNT_START_FAILED',
    STOP_FAILED: 'ACCOUNT_STOP_FAILED'
  },
  
  
  
  // 翻译相关错误
  TRANSLATION: {
    ENGINE_NOT_SUPPORTED: 'TRANSLATION_ENGINE_NOT_SUPPORTED',
    LANGUAGE_NOT_SUPPORTED: 'LANGUAGE_NOT_SUPPORTED',
    API_FAILED: 'TRANSLATION_API_FAILED',
    QUOTA_EXCEEDED: 'TRANSLATION_QUOTA_EXCEEDED'
  },
  
  // 系统相关错误
  SYSTEM: {
    INSUFFICIENT_MEMORY: 'INSUFFICIENT_MEMORY',
    DISK_FULL: 'DISK_FULL',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  }
};

// 事件名称常量
const EVENTS = {
  // 应用事件
  APP: {
    READY: 'app-ready',
    BEFORE_QUIT: 'before-quit',
    QUIT: 'quit',
    WINDOW_ALL_CLOSED: 'window-all-closed'
  },
  
  // 窗口事件
  WINDOW: {
    READY_TO_SHOW: 'ready-to-show',
    CLOSED: 'closed',
    FOCUS: 'focus',
    BLUR: 'blur'
  },
  
  // 账号事件
  ACCOUNT: {
    CREATED: 'account-created',
    DELETED: 'account-deleted',
    STARTED: 'account-started',
    STOPPED: 'account-stopped',
    ERROR: 'account-error',
    STATUS_CHANGED: 'account-status-changed'
  },
  
  // 翻译事件
  TRANSLATION: {
    TEXT_TRANSLATED: 'text-translated',
    TRANSLATION_ERROR: 'translation-error',
    ENGINE_CHANGED: 'translation-engine-changed'
  }
};

// 性能配置常量
const PERFORMANCE_CONFIG = {
  // 内存配置
  MEMORY: {
    MAX_CACHE_SIZE: 100 * 1024 * 1024, // 100MB
    CLEANUP_INTERVAL: 5 * 60 * 1000,   // 5分钟
    GC_INTERVAL: 30 * 1000             // 30秒
  },
  
  // 并发配置
  CONCURRENCY: {
    MAX_ACCOUNTS: 30,
    MAX_TRANSLATION_REQUESTS: 10,
    
  },
  
  // 缓存配置
  CACHE: {
    TTL: 24 * 60 * 60 * 1000,           // 24小时
    MAX_SIZE: 50 * 1024 * 1024,         // 50MB
    CLEANUP_BATCH_SIZE: 100
  }
};

module.exports = {
  APP_INFO,
  PATHS,
  ELECTRON,
  WINDOW_CONFIG,
  ACCOUNT_CONFIG,
  TRANSLATION_CONFIG,
  ERROR_CODES,
  EVENTS,
  PERFORMANCE_CONFIG
};
