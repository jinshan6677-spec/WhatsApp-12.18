/**
 * MainWindow - Single Window Architecture Main Window Manager
 * 
 * Manages the single main application window that contains both the account
 * management sidebar and the session display area for BrowserViews.
 */

const { BrowserWindow, screen } = require('electron');
const Store = require('electron-store');
const path = require('path');

const DEFAULT_TRANSLATION_PANEL_WIDTHS = {
  full: 380,
  mini: 140,
  icon: 56
};

/**
 * MainWindow class
 */
class MainWindow {
  /**
   * Create MainWindow instance
   * @param {Object} [options] - Configuration options
   * @param {number} [options.width] - Initial window width
   * @param {number} [options.height] - Initial window height
   * @param {number} [options.minWidth] - Minimum window width
   * @param {number} [options.minHeight] - Minimum window height
   * @param {string} [options.title] - Window title
   * @param {string} [options.preloadPath] - Path to preload script
   * @param {string} [options.htmlPath] - Path to HTML file to load
   */
  constructor(options = {}) {
    this.options = {
      width: options.width || 1400,
      height: options.height || 900,
      minWidth: options.minWidth || 1000,
      minHeight: options.minHeight || 600,
      title: options.title || 'WhatsApp Desktop',
      preloadPath: options.preloadPath || path.join(__dirname, 'renderer', 'preload-main.js'),
      htmlPath: options.htmlPath || path.join(__dirname, 'renderer', 'app.html'),
      ...options
    };

    this.window = null;
    this.isInitialized = false;

    // Initialize state store for window bounds persistence
    this.stateStore = new Store({
      name: 'window-state',
      defaults: {
        bounds: {
          x: undefined,
          y: undefined,
          width: this.options.width,
          height: this.options.height
        },
        isMaximized: false,
        sidebarWidth: 280,
        translationPanel: {
          state: 'full',
          widths: { ...DEFAULT_TRANSLATION_PANEL_WIDTHS }
        }
      }
    });
  }

  /**
   * Initialize and create the main window
   * @returns {BrowserWindow} The created window instance
   */
  initialize() {
    if (this.isInitialized) {
      console.warn('MainWindow already initialized');
      return this.window;
    }

    // Load saved window state
    const savedState = this.stateStore.get('bounds');
    const isMaximized = this.stateStore.get('isMaximized', false);

    // Ensure window is visible on screen
    const bounds = this._ensureVisibleBounds(savedState);

    // Create the browser window
    this.window = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      minWidth: this.options.minWidth,
      minHeight: this.options.minHeight,
      title: this.options.title,
      show: false, // Don't show until ready
      backgroundColor: '#ffffff',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: this.options.preloadPath
      }
    });

    // Load the HTML file
    this.window.loadFile(this.options.htmlPath);

    // Show window when ready
    this.window.once('ready-to-show', () => {
      if (isMaximized) {
        this.window.maximize();
      }
      this.window.show();
    });

    // Set up event handlers
    this._setupEventHandlers();

    this.isInitialized = true;

    return this.window;
  }

  /**
   * Set up window event handlers
   * @private
   */
  _setupEventHandlers() {
    // Save window state on resize
    this.window.on('resize', () => {
      this._saveWindowState();
      
      // Notify about window resize for view bounds recalculation
      this._notifyWindowResize();
    });

    // Save window state on move
    this.window.on('move', () => {
      this._saveWindowState();
    });

    // Save maximized state
    this.window.on('maximize', () => {
      this.stateStore.set('isMaximized', true);
      
      // Recalculate view bounds when maximized
      this._notifyWindowResize();
    });

    this.window.on('unmaximize', () => {
      this.stateStore.set('isMaximized', false);
      
      // Recalculate view bounds when unmaximized
      this._notifyWindowResize();
    });

    // Clean up on close
    this.window.on('closed', () => {
      this.window = null;
      this.isInitialized = false;
    });

    // Handle console messages from renderer (for debugging)
    this.window.webContents.on('console-message', (_event, _level, message) => {
      // 始终将渲染进程的日志转发到主进程控制台，方便在 dev 模式下调试
      console.log(`[Renderer Console] ${message}`);
    });
  }

  /**
   * Notify about window resize event
   * @private
   */
  _notifyWindowResize() {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    // Send event to renderer
    this.window.webContents.send('window-resized', {
      bounds: this.window.getBounds(),
      timestamp: Date.now()
    });
  }

  /**
   * Save current window state to persistent storage
   * @private
   */
  _saveWindowState() {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    // Don't save bounds if window is maximized or minimized
    if (this.window.isMaximized() || this.window.isMinimized()) {
      return;
    }

    const bounds = this.window.getBounds();
    this.stateStore.set('bounds', bounds);
  }

  /**
   * Ensure window bounds are visible on current displays
   * @param {Object} bounds - Window bounds to validate
   * @returns {Object} Validated bounds
   * @private
   */
  _ensureVisibleBounds(bounds) {
    const displays = screen.getAllDisplays();
    
    // If no saved bounds, center on primary display
    if (!bounds || bounds.x === undefined || bounds.y === undefined) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      
      return {
        x: Math.floor((width - this.options.width) / 2),
        y: Math.floor((height - this.options.height) / 2),
        width: this.options.width,
        height: this.options.height
      };
    }

    // Check if window is visible on any display
    const isVisible = displays.some(display => {
      const { x, y, width, height } = display.bounds;
      return (
        bounds.x >= x &&
        bounds.y >= y &&
        bounds.x + bounds.width <= x + width &&
        bounds.y + bounds.height <= y + height
      );
    });

    // If not visible, center on primary display
    if (!isVisible) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      
      return {
        x: Math.floor((width - bounds.width) / 2),
        y: Math.floor((height - bounds.height) / 2),
        width: bounds.width,
        height: bounds.height
      };
    }

    return bounds;
  }

  /**
   * Get the BrowserWindow instance
   * @returns {BrowserWindow|null}
   */
  getWindow() {
    return this.window;
  }

  /**
   * Get current window bounds
   * @returns {Object|null} Window bounds {x, y, width, height}
   */
  getBounds() {
    if (!this.window || this.window.isDestroyed()) {
      return null;
    }
    return this.window.getBounds();
  }

  /**
   * Set window bounds
   * @param {Object} bounds - Window bounds {x, y, width, height}
   */
  setBounds(bounds) {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }
    this.window.setBounds(bounds);
  }

  /**
   * Show the window
   */
  show() {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }
    this.window.show();
  }

  /**
   * Hide the window
   */
  hide() {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }
    this.window.hide();
  }

  /**
   * Focus the window
   */
  focus() {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }
    if (this.window.isMinimized()) {
      this.window.restore();
    }
    this.window.focus();
  }

  /**
   * Close the window
   */
  close() {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }
    this.window.close();
  }

  /**
   * Check if window is destroyed
   * @returns {boolean}
   */
  isDestroyed() {
    return !this.window || this.window.isDestroyed();
  }

  /**
   * Send message to renderer process via IPC
   * @param {string} channel - IPC channel name
   * @param {*} data - Data to send
   */
  sendToRenderer(channel, data) {
    if (!this.window || this.window.isDestroyed()) {
      console.warn('Cannot send to renderer: window is destroyed');
      return;
    }
    this.window.webContents.send(channel, data);
  }

  /**
   * Get saved sidebar width
   * @returns {number} Sidebar width in pixels
   */
  getSidebarWidth() {
    return this.stateStore.get('sidebarWidth', 280);
  }

  /**
   * Save sidebar width
   * @param {number} width - Sidebar width in pixels
   */
  setSidebarWidth(width) {
    this.stateStore.set('sidebarWidth', width);
  }

  /**
   * Get saved translation panel layout
   * @returns {{state: string, widths: Object, width: number}}
   */
  getTranslationPanelLayout() {
    const translationPanel = this.stateStore.get('translationPanel', {
      state: 'full',
      widths: { ...DEFAULT_TRANSLATION_PANEL_WIDTHS }
    });

    const widths = {
      ...DEFAULT_TRANSLATION_PANEL_WIDTHS,
      ...(translationPanel.widths || {})
    };
    const state = translationPanel.state || 'full';
    const width = Math.max(0, widths[state] || 0);

    return { state, widths, width };
  }

  /**
   * Get current translation panel width for a state
   * @param {string} [state] - Layout state
   * @returns {number} width in pixels
   */
  getTranslationPanelWidth(state = null) {
    const layout = this.getTranslationPanelLayout();
    const targetState = state || layout.state || 'full';
    const width = layout.widths[targetState];
    return Math.max(0, width || 0);
  }

  /**
   * Save translation panel layout
   * @param {Object} layout - Layout info
   * @param {string} [layout.state] - Panel state
   * @param {Object} [layout.widths] - Width map per state
   * @param {number} [layout.width] - Current state's width override
   * @returns {{state: string, widths: Object, width: number}}
   */
  setTranslationPanelLayout({ state, widths, width } = {}) {
    const current = this.stateStore.get('translationPanel', {
      state: 'full',
      widths: { ...DEFAULT_TRANSLATION_PANEL_WIDTHS }
    });

    const nextWidths = {
      ...DEFAULT_TRANSLATION_PANEL_WIDTHS,
      ...(current.widths || {})
    };

    if (width && state) {
      nextWidths[state] = width;
    }

    if (widths && typeof widths === 'object') {
      Object.assign(nextWidths, widths);
    }

    const nextState = state || current.state || 'full';

    this.stateStore.set('translationPanel', {
      state: nextState,
      widths: nextWidths
    });

    return {
      state: nextState,
      widths: nextWidths,
      width: Math.max(0, nextWidths[nextState] || 0)
    };
  }

  /**
   * Get window state store
   * @returns {Store} The electron-store instance
   */
  getStateStore() {
    return this.stateStore;
  }

  /**
   * Check if window is initialized
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized && this.window && !this.window.isDestroyed();
  }
}

module.exports = MainWindow;
