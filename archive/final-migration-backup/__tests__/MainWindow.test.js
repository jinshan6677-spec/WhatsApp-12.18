/**
 * MainWindow tests
 */

// Mock electron modules - must be before require
jest.mock('electron', () => {
  const mockBrowserWindow = jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    getBounds: jest.fn(() => ({ x: 100, y: 100, width: 1400, height: 900 })),
    setBounds: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    focus: jest.fn(),
    close: jest.fn(),
    maximize: jest.fn(),
    isMaximized: jest.fn(() => false),
    isMinimized: jest.fn(() => false),
    isDestroyed: jest.fn(() => false),
    on: jest.fn(),
    once: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn()
    }
  }));
  
  return {
    BrowserWindow: mockBrowserWindow,
    screen: {
      getAllDisplays: jest.fn(() => [
        {
          bounds: { x: 0, y: 0, width: 1920, height: 1080 }
        }
      ]),
      getPrimaryDisplay: jest.fn(() => ({
        workAreaSize: { width: 1920, height: 1080 },
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      }))
    }
  };
});

// Mock electron-store with actual storage
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => {
    const store = {};
    return {
      get: jest.fn((key, defaultValue) => store[key] !== undefined ? store[key] : defaultValue),
      set: jest.fn((key, value) => { store[key] = value; })
    };
  });
});

const MainWindow = require('../MainWindow');
const { BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

describe('MainWindow', () => {
  let mainWindow;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for test
    tempDir = path.join(os.tmpdir(), `test-mainwindow-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Clear mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up
    if (mainWindow && mainWindow.window) {
      mainWindow.window = null;
    }

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('constructor', () => {
    test('should create MainWindow instance with default options', () => {
      mainWindow = new MainWindow();
      
      expect(mainWindow).toBeDefined();
      expect(mainWindow.options.width).toBe(1400);
      expect(mainWindow.options.height).toBe(900);
      expect(mainWindow.options.minWidth).toBe(1000);
      expect(mainWindow.options.minHeight).toBe(600);
      expect(mainWindow.isInitialized).toBe(false);
    });

    test('should create MainWindow instance with custom options', () => {
      mainWindow = new MainWindow({
        width: 1600,
        height: 1000,
        title: 'Custom Title'
      });
      
      expect(mainWindow.options.width).toBe(1600);
      expect(mainWindow.options.height).toBe(1000);
      expect(mainWindow.options.title).toBe('Custom Title');
    });
  });

  describe('initialize', () => {
    test('should initialize window with correct configuration', () => {
      mainWindow = new MainWindow();
      const window = mainWindow.initialize();
      
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1400,
          height: 900,
          minWidth: 1000,
          minHeight: 600,
          title: 'WhatsApp Desktop',
          show: false,
          webPreferences: expect.objectContaining({
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
          })
        })
      );
      expect(mainWindow.isInitialized).toBe(true);
    });

    test('should not reinitialize if already initialized', () => {
      mainWindow = new MainWindow();
      mainWindow.initialize();
      
      const callCount = BrowserWindow.mock.calls.length;
      mainWindow.initialize();
      
      expect(BrowserWindow.mock.calls.length).toBe(callCount);
    });
  });

  describe('getWindow', () => {
    test('should return window instance', () => {
      mainWindow = new MainWindow();
      mainWindow.initialize();
      
      const window = mainWindow.getWindow();
      expect(window).toBeDefined();
    });

    test('should return null if not initialized', () => {
      mainWindow = new MainWindow();
      
      const window = mainWindow.getWindow();
      expect(window).toBeNull();
    });
  });

  describe('getBounds', () => {
    test('should return window bounds', () => {
      mainWindow = new MainWindow();
      mainWindow.initialize();
      
      const bounds = mainWindow.getBounds();
      expect(bounds).toEqual({ x: 100, y: 100, width: 1400, height: 900 });
    });

    test('should return null if window not initialized', () => {
      mainWindow = new MainWindow();
      
      const bounds = mainWindow.getBounds();
      expect(bounds).toBeNull();
    });
  });

  describe('sendToRenderer', () => {
    test('should send message to renderer', () => {
      mainWindow = new MainWindow();
      mainWindow.initialize();
      
      mainWindow.sendToRenderer('test-channel', { data: 'test' });
      
      expect(mainWindow.window.webContents.send).toHaveBeenCalledWith(
        'test-channel',
        { data: 'test' }
      );
    });

    test('should not send if window is destroyed', () => {
      mainWindow = new MainWindow();
      mainWindow.initialize();
      mainWindow.window.isDestroyed = jest.fn(() => true);
      
      mainWindow.sendToRenderer('test-channel', { data: 'test' });
      
      expect(mainWindow.window.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('isReady', () => {
    test('should return true when initialized and not destroyed', () => {
      mainWindow = new MainWindow();
      mainWindow.initialize();
      
      expect(mainWindow.isReady()).toBe(true);
    });

    test('should return false when not initialized', () => {
      mainWindow = new MainWindow();
      
      expect(mainWindow.isReady()).toBe(false);
    });
  });

  describe('sidebar width persistence', () => {
    test('should get default sidebar width', () => {
      mainWindow = new MainWindow();
      
      const width = mainWindow.getSidebarWidth();
      expect(width).toBe(280);
    });

    test('should save and retrieve sidebar width', () => {
      mainWindow = new MainWindow();
      
      mainWindow.setSidebarWidth(320);
      const width = mainWindow.getSidebarWidth();
      
      expect(width).toBe(320);
    });
  });
});
