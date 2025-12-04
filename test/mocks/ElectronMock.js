/**
 * Mock implementation for Electron APIs
 * Used for testing components that depend on Electron without running in Electron environment
 * 
 * @module test/mocks/ElectronMock
 * Requirements: 10.1
 */

'use strict';

/**
 * Mock implementation of Electron's app module
 */
class AppMock {
  constructor() {
    this._paths = {
      userData: '/mock/path/userData',
      appData: '/mock/path/appData',
      temp: '/mock/path/temp',
      home: '/mock/path/home',
      desktop: '/mock/path/desktop',
      documents: '/mock/path/documents',
      downloads: '/mock/path/downloads',
      logs: '/mock/path/logs'
    };
    this._version = '1.0.0';
    this._name = 'MockApp';
    this._isReady = false;
    this._readyPromise = null;
  }

  getPath(name) {
    return this._paths[name] || `/mock/path/${name}`;
  }

  setPath(name, path) {
    this._paths[name] = path;
  }

  getVersion() {
    return this._version;
  }

  getName() {
    return this._name;
  }

  setName(name) {
    this._name = name;
  }

  quit() {
    // Mock quit - can be spied on
  }

  exit(exitCode = 0) {
    // Mock exit - can be spied on
  }

  relaunch(options = {}) {
    // Mock relaunch - can be spied on
  }

  isReady() {
    return this._isReady;
  }

  whenReady() {
    if (!this._readyPromise) {
      this._readyPromise = Promise.resolve().then(() => {
        this._isReady = true;
      });
    }
    return this._readyPromise;
  }

  focus() {
    // Mock focus
  }

  hide() {
    // Mock hide
  }

  show() {
    // Mock show
  }

  getLocale() {
    return 'en-US';
  }

  // For testing - reset state
  _reset() {
    this._isReady = false;
    this._readyPromise = null;
  }
}


/**
 * Mock implementation of Electron's ipcMain module
 */
class IpcMainMock {
  constructor() {
    this._handlers = new Map();
    this._listeners = new Map();
  }

  handle(channel, handler) {
    this._handlers.set(channel, handler);
  }

  handleOnce(channel, handler) {
    const wrappedHandler = async (...args) => {
      this._handlers.delete(channel);
      return handler(...args);
    };
    this._handlers.set(channel, wrappedHandler);
  }

  removeHandler(channel) {
    this._handlers.delete(channel);
  }

  on(channel, listener) {
    if (!this._listeners.has(channel)) {
      this._listeners.set(channel, []);
    }
    this._listeners.get(channel).push(listener);
  }

  once(channel, listener) {
    const wrappedListener = (...args) => {
      this.removeListener(channel, wrappedListener);
      listener(...args);
    };
    this.on(channel, wrappedListener);
  }

  removeListener(channel, listener) {
    const listeners = this._listeners.get(channel);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  removeAllListeners(channel) {
    if (channel) {
      this._listeners.delete(channel);
    } else {
      this._listeners.clear();
    }
  }

  // For testing - invoke a handler
  async _invoke(channel, event, ...args) {
    const handler = this._handlers.get(channel);
    if (handler) {
      return handler(event, ...args);
    }
    throw new Error(`No handler registered for channel: ${channel}`);
  }

  // For testing - emit to listeners
  _emit(channel, event, ...args) {
    const listeners = this._listeners.get(channel) || [];
    listeners.forEach(listener => listener(event, ...args));
  }

  // For testing - reset state
  _reset() {
    this._handlers.clear();
    this._listeners.clear();
  }
}

/**
 * Mock implementation of Electron's ipcRenderer module
 */
class IpcRendererMock {
  constructor() {
    this._listeners = new Map();
    this._invokeHandler = null;
  }

  invoke(channel, ...args) {
    if (this._invokeHandler) {
      return this._invokeHandler(channel, ...args);
    }
    return Promise.resolve(null);
  }

  send(channel, ...args) {
    // Mock send - can be intercepted
  }

  sendSync(channel, ...args) {
    return null;
  }

  on(channel, listener) {
    if (!this._listeners.has(channel)) {
      this._listeners.set(channel, []);
    }
    this._listeners.get(channel).push(listener);
    return this;
  }

  once(channel, listener) {
    const wrappedListener = (...args) => {
      this.removeListener(channel, wrappedListener);
      listener(...args);
    };
    this.on(channel, wrappedListener);
    return this;
  }

  removeListener(channel, listener) {
    const listeners = this._listeners.get(channel);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  removeAllListeners(channel) {
    if (channel) {
      this._listeners.delete(channel);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  // For testing - set invoke handler
  _setInvokeHandler(handler) {
    this._invokeHandler = handler;
  }

  // For testing - emit to listeners
  _emit(channel, event, ...args) {
    const listeners = this._listeners.get(channel) || [];
    listeners.forEach(listener => listener(event, ...args));
  }

  // For testing - reset state
  _reset() {
    this._listeners.clear();
    this._invokeHandler = null;
  }
}


/**
 * Mock implementation of Electron's BrowserWindow
 */
class BrowserWindowMock {
  static _instances = [];
  static _focusedWindow = null;

  constructor(options = {}) {
    this.id = BrowserWindowMock._instances.length + 1;
    this._options = options;
    this._isDestroyed = false;
    this._isVisible = false;
    this._isFocused = false;
    this._isMinimized = false;
    this._isMaximized = false;
    this._isFullScreen = false;
    this._bounds = {
      x: options.x || 0,
      y: options.y || 0,
      width: options.width || 800,
      height: options.height || 600
    };
    this._listeners = new Map();
    this._url = null;

    this.webContents = new WebContentsMock(this);

    BrowserWindowMock._instances.push(this);
  }

  loadURL(url, options = {}) {
    this._url = url;
    return Promise.resolve();
  }

  loadFile(filePath, options = {}) {
    this._url = `file://${filePath}`;
    return Promise.resolve();
  }

  show() {
    this._isVisible = true;
  }

  hide() {
    this._isVisible = false;
  }

  close() {
    this._emit('close');
    this.destroy();
  }

  destroy() {
    this._isDestroyed = true;
    this._emit('closed');
    const index = BrowserWindowMock._instances.indexOf(this);
    if (index !== -1) {
      BrowserWindowMock._instances.splice(index, 1);
    }
  }

  focus() {
    this._isFocused = true;
    BrowserWindowMock._focusedWindow = this;
  }

  blur() {
    this._isFocused = false;
    if (BrowserWindowMock._focusedWindow === this) {
      BrowserWindowMock._focusedWindow = null;
    }
  }

  minimize() {
    this._isMinimized = true;
  }

  restore() {
    this._isMinimized = false;
    this._isMaximized = false;
  }

  maximize() {
    this._isMaximized = true;
  }

  unmaximize() {
    this._isMaximized = false;
  }

  setFullScreen(flag) {
    this._isFullScreen = flag;
  }

  isFullScreen() {
    return this._isFullScreen;
  }

  isVisible() {
    return this._isVisible;
  }

  isDestroyed() {
    return this._isDestroyed;
  }

  isFocused() {
    return this._isFocused;
  }

  isMinimized() {
    return this._isMinimized;
  }

  isMaximized() {
    return this._isMaximized;
  }

  getBounds() {
    return { ...this._bounds };
  }

  setBounds(bounds) {
    Object.assign(this._bounds, bounds);
  }

  getSize() {
    return [this._bounds.width, this._bounds.height];
  }

  setSize(width, height) {
    this._bounds.width = width;
    this._bounds.height = height;
  }

  getPosition() {
    return [this._bounds.x, this._bounds.y];
  }

  setPosition(x, y) {
    this._bounds.x = x;
    this._bounds.y = y;
  }

  setTitle(title) {
    this._title = title;
  }

  getTitle() {
    return this._title || '';
  }

  on(event, listener) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(listener);
    return this;
  }

  once(event, listener) {
    const wrappedListener = (...args) => {
      this.removeListener(event, wrappedListener);
      listener(...args);
    };
    this.on(event, wrappedListener);
    return this;
  }

  removeListener(event, listener) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  removeAllListeners(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  _emit(event, ...args) {
    const listeners = this._listeners.get(event) || [];
    listeners.forEach(listener => listener(...args));
  }

  // Static methods
  static getAllWindows() {
    return [...BrowserWindowMock._instances];
  }

  static getFocusedWindow() {
    return BrowserWindowMock._focusedWindow;
  }

  static fromId(id) {
    return BrowserWindowMock._instances.find(w => w.id === id) || null;
  }

  // For testing - reset all instances
  static _resetAll() {
    BrowserWindowMock._instances = [];
    BrowserWindowMock._focusedWindow = null;
  }
}


/**
 * Mock implementation of Electron's webContents
 */
class WebContentsMock {
  constructor(browserWindow) {
    this._browserWindow = browserWindow;
    this._listeners = new Map();
    this._userAgent = 'MockUserAgent/1.0';
  }

  send(channel, ...args) {
    // Mock send to renderer
  }

  executeJavaScript(code, userGesture = false) {
    return Promise.resolve(null);
  }

  insertCSS(css) {
    return Promise.resolve('mock-css-key');
  }

  removeInsertedCSS(key) {
    return Promise.resolve();
  }

  setUserAgent(userAgent) {
    this._userAgent = userAgent;
  }

  getUserAgent() {
    return this._userAgent;
  }

  openDevTools(options = {}) {
    // Mock open dev tools
  }

  closeDevTools() {
    // Mock close dev tools
  }

  isDevToolsOpened() {
    return false;
  }

  reload() {
    // Mock reload
  }

  getURL() {
    return this._browserWindow._url || '';
  }

  on(event, listener) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(listener);
    return this;
  }

  once(event, listener) {
    const wrappedListener = (...args) => {
      this.removeListener(event, wrappedListener);
      listener(...args);
    };
    this.on(event, wrappedListener);
    return this;
  }

  removeListener(event, listener) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  _emit(event, ...args) {
    const listeners = this._listeners.get(event) || [];
    listeners.forEach(listener => listener(...args));
  }
}

/**
 * Mock implementation of Electron's session
 */
class SessionMock {
  constructor(partition = '') {
    this._partition = partition;
    this._cookies = new CookiesMock();
    this._cache = new Map();
  }

  get cookies() {
    return this._cookies;
  }

  clearCache() {
    this._cache.clear();
    return Promise.resolve();
  }

  clearStorageData(options = {}) {
    return Promise.resolve();
  }

  

  setUserAgent(userAgent, acceptLanguages) {
    this._userAgent = userAgent;
    this._acceptLanguages = acceptLanguages;
  }

  getUserAgent() {
    return this._userAgent || 'MockUserAgent/1.0';
  }

  // For testing
  _reset() {
    this._cache.clear();
  }
}

/**
 * Mock implementation of Electron's cookies
 */
class CookiesMock {
  constructor() {
    this._cookies = [];
  }

  get(filter = {}) {
    return Promise.resolve(this._cookies.filter(cookie => {
      if (filter.url && !cookie.url.includes(filter.url)) return false;
      if (filter.name && cookie.name !== filter.name) return false;
      if (filter.domain && cookie.domain !== filter.domain) return false;
      return true;
    }));
  }

  set(details) {
    this._cookies.push(details);
    return Promise.resolve();
  }

  remove(url, name) {
    this._cookies = this._cookies.filter(c => !(c.url === url && c.name === name));
    return Promise.resolve();
  }

  flushStore() {
    return Promise.resolve();
  }

  // For testing
  _reset() {
    this._cookies = [];
  }
}

/**
 * Mock implementation of Electron's dialog
 */
class DialogMock {
  constructor() {
    this._nextResponse = null;
  }

  showOpenDialog(browserWindow, options) {
    if (this._nextResponse) {
      const response = this._nextResponse;
      this._nextResponse = null;
      return Promise.resolve(response);
    }
    return Promise.resolve({ canceled: true, filePaths: [] });
  }

  showSaveDialog(browserWindow, options) {
    if (this._nextResponse) {
      const response = this._nextResponse;
      this._nextResponse = null;
      return Promise.resolve(response);
    }
    return Promise.resolve({ canceled: true, filePath: undefined });
  }

  showMessageBox(browserWindow, options) {
    if (this._nextResponse) {
      const response = this._nextResponse;
      this._nextResponse = null;
      return Promise.resolve(response);
    }
    return Promise.resolve({ response: 0, checkboxChecked: false });
  }

  showErrorBox(title, content) {
    // Mock error box
  }

  // For testing - set next response
  _setNextResponse(response) {
    this._nextResponse = response;
  }

  _reset() {
    this._nextResponse = null;
  }
}


/**
 * Main ElectronMock class that aggregates all Electron API mocks
 */
class ElectronMock {
  constructor() {
    this.app = new AppMock();
    this.ipcMain = new IpcMainMock();
    this.ipcRenderer = new IpcRendererMock();
    this.BrowserWindow = BrowserWindowMock;
    this.dialog = new DialogMock();
    this._sessions = new Map();
  }

  get session() {
    return {
      defaultSession: this.getSession(),
      fromPartition: (partition) => this.getSession(partition)
    };
  }

  getSession(partition = '') {
    if (!this._sessions.has(partition)) {
      this._sessions.set(partition, new SessionMock(partition));
    }
    return this._sessions.get(partition);
  }

  /**
   * Reset all mocks to initial state
   * Useful for test isolation
   */
  reset() {
    this.app._reset();
    this.ipcMain._reset();
    this.ipcRenderer._reset();
    BrowserWindowMock._resetAll();
    this.dialog._reset();
    this._sessions.forEach(session => session._reset());
    this._sessions.clear();
  }

  /**
   * Create a fresh instance of ElectronMock
   * Useful for complete isolation between tests
   */
  static create() {
    return new ElectronMock();
  }
}

// Export individual mocks for direct use
module.exports = {
  ElectronMock,
  AppMock,
  IpcMainMock,
  IpcRendererMock,
  BrowserWindowMock,
  WebContentsMock,
  SessionMock,
  CookiesMock,
  DialogMock
};
