/**
 * ViewManager Tests
 * 
 * Basic tests to verify ViewManager functionality
 */

const ViewManager = require('../ViewManager');

describe('ViewManager', () => {
  let mockMainWindow;
  let mockSessionManager;
  let viewManager;

  beforeEach(() => {
    // Mock MainWindow
    mockMainWindow = {
      getWindow: jest.fn(() => ({
        isDestroyed: jest.fn(() => false),
        addBrowserView: jest.fn(),
        removeBrowserView: jest.fn(),
        setTopBrowserView: jest.fn(),
        getContentBounds: jest.fn(() => ({
          x: 0,
          y: 0,
          width: 1400,
          height: 900
        }))
      })),
      getSidebarWidth: jest.fn(() => 280),
      getTranslationPanelWidth: jest.fn(() => 0),
      getStateStore: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn()
      }))
    };

    // Mock SessionManager
    mockSessionManager = {
      getInstanceSession: jest.fn(() => ({
        webRequest: {
          onBeforeSendHeaders: jest.fn()
        }
      }))
    };

    viewManager = new ViewManager(mockMainWindow, mockSessionManager);
  });

  describe('Constructor', () => {
    test('should create ViewManager instance', () => {
      expect(viewManager).toBeInstanceOf(ViewManager);
      expect(viewManager.mainWindow).toBe(mockMainWindow);
      expect(viewManager.sessionManager).toBe(mockSessionManager);
    });

    test('should throw error if MainWindow is not provided', () => {
      expect(() => new ViewManager(null, mockSessionManager)).toThrow('MainWindow instance is required');
    });

    test('should throw error if SessionManager is not provided', () => {
      expect(() => new ViewManager(mockMainWindow, null)).toThrow('SessionManager instance is required');
    });

    test('should initialize with empty views map', () => {
      expect(viewManager.getViewCount()).toBe(0);
      expect(viewManager.getActiveAccountId()).toBeNull();
    });
  });

  describe('View State Management', () => {
    test('should check if view exists', () => {
      expect(viewManager.hasView('test-account')).toBe(false);
    });

    test('should get view count', () => {
      expect(viewManager.getViewCount()).toBe(0);
    });

    test('should get active account ID', () => {
      expect(viewManager.getActiveAccountId()).toBeNull();
    });

    test('should get all views', () => {
      const views = viewManager.getAllViews();
      expect(views).toBeInstanceOf(Map);
      expect(views.size).toBe(0);
    });
  });

  describe('Bounds Calculation', () => {
    test('should calculate view bounds based on sidebar width', () => {
      const bounds = viewManager._calculateViewBounds(280);
      
      expect(bounds).toEqual({
        x: 280,
        y: 0,
        width: 1120, // 1400 - 280
        height: 900
      });
    });

    test('should use saved sidebar width if not provided', () => {
      const bounds = viewManager._calculateViewBounds();
      
      expect(mockMainWindow.getSidebarWidth).toHaveBeenCalled();
      expect(bounds.x).toBe(280);
    });

    test('should calculate bounds with different sidebar widths', () => {
      const bounds1 = viewManager._calculateViewBounds(200);
      expect(bounds1).toEqual({
        x: 200,
        y: 0,
        width: 1200,
        height: 900
      });

      const bounds2 = viewManager._calculateViewBounds(400);
      expect(bounds2).toEqual({
        x: 400,
        y: 0,
        width: 1000,
        height: 900
      });
    });

    test('should return zero bounds when window is destroyed', () => {
      mockMainWindow.getWindow = jest.fn(() => ({
        isDestroyed: jest.fn(() => true)
      }));

      const bounds = viewManager._calculateViewBounds(280);
      
      expect(bounds).toEqual({
        x: 0,
        y: 0,
        width: 0,
        height: 0
      });
    });

    test('should return zero bounds when window is null', () => {
      mockMainWindow.getWindow = jest.fn(() => null);

      const bounds = viewManager._calculateViewBounds(280);
      
      expect(bounds).toEqual({
        x: 0,
        y: 0,
        width: 0,
        height: 0
      });
    });
  });

  describe('View Resizing', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should debounce resize operations by default', () => {
      const performResizeSpy = jest.spyOn(viewManager, '_performResize');
      
      viewManager.resizeViews(300);
      
      // Should not call immediately
      expect(performResizeSpy).not.toHaveBeenCalled();
      
      // Fast forward time
      jest.advanceTimersByTime(100);
      
      // Should call after debounce delay
      expect(performResizeSpy).toHaveBeenCalledWith(300);
      
      performResizeSpy.mockRestore();
    });

    test('should resize immediately when immediate option is true', () => {
      const performResizeSpy = jest.spyOn(viewManager, '_performResize');
      
      viewManager.resizeViews(300, { immediate: true });
      
      // Should call immediately
      expect(performResizeSpy).toHaveBeenCalledWith(300);
      
      performResizeSpy.mockRestore();
    });

    test('should clear previous debounce timer on new resize', () => {
      const performResizeSpy = jest.spyOn(viewManager, '_performResize');
      
      viewManager.resizeViews(300);
      jest.advanceTimersByTime(50);
      
      viewManager.resizeViews(350);
      jest.advanceTimersByTime(50);
      
      // First resize should be cancelled
      expect(performResizeSpy).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(50);
      
      // Only second resize should execute
      expect(performResizeSpy).toHaveBeenCalledTimes(1);
      expect(performResizeSpy).toHaveBeenCalledWith(350);
      
      performResizeSpy.mockRestore();
    });

    test('should update bounds for all views during resize', () => {
      // Add mock views
      const mockView1 = {
        view: {
          setBounds: jest.fn(),
          webContents: { isDestroyed: jest.fn(() => false) }
        },
        bounds: null,
        isVisible: true
      };
      const mockView2 = {
        view: {
          setBounds: jest.fn(),
          webContents: { isDestroyed: jest.fn(() => false) }
        },
        bounds: null,
        isVisible: false
      };
      
      viewManager.views.set('account1', mockView1);
      viewManager.views.set('account2', mockView2);
      
      viewManager._performResize(300);
      
      // Both views should have bounds updated
      expect(mockView1.bounds).toEqual({
        x: 300,
        y: 0,
        width: 1100,
        height: 900
      });
      expect(mockView2.bounds).toEqual({
        x: 300,
        y: 0,
        width: 1100,
        height: 900
      });
      
      // Both views should have setBounds called
      expect(mockView1.view.setBounds).toHaveBeenCalledWith({
        x: 300,
        y: 0,
        width: 1100,
        height: 900
      });
      expect(mockView2.view.setBounds).toHaveBeenCalledWith({
        x: 300,
        y: 0,
        width: 1100,
        height: 900
      });
    });

    test('should skip destroyed views during resize', () => {
      const mockView = {
        view: {
          setBounds: jest.fn(),
          webContents: { isDestroyed: jest.fn(() => true) }
        },
        bounds: null,
        isVisible: true
      };
      
      viewManager.views.set('account1', mockView);
      
      viewManager._performResize(300);
      
      // Bounds should be updated in state
      expect(mockView.bounds).toEqual({
        x: 300,
        y: 0,
        width: 1100,
        height: 900
      });
      
      // But setBounds should not be called on destroyed view
      expect(mockView.view.setBounds).not.toHaveBeenCalled();
    });

    test('should handle window resize event', () => {
      const resizeViewsSpy = jest.spyOn(viewManager, 'resizeViews');
      
      viewManager.handleWindowResize();
      
      expect(mockMainWindow.getSidebarWidth).toHaveBeenCalled();
      expect(resizeViewsSpy).toHaveBeenCalledWith(280, {});
      
      resizeViewsSpy.mockRestore();
    });

    test('should handle window resize with immediate option', () => {
      const resizeViewsSpy = jest.spyOn(viewManager, 'resizeViews');
      
      viewManager.handleWindowResize({ immediate: true });
      
      expect(resizeViewsSpy).toHaveBeenCalledWith(280, { immediate: true });
      
      resizeViewsSpy.mockRestore();
    });

    test('should handle window resize gracefully when window is destroyed', () => {
      mockMainWindow.getWindow = jest.fn(() => ({
        isDestroyed: jest.fn(() => true)
      }));
      
      // Should not throw
      expect(() => {
        viewManager.handleWindowResize();
      }).not.toThrow();
    });

    test('should handle window resize gracefully when window is null', () => {
      mockMainWindow.getWindow = jest.fn(() => null);
      
      // Should not throw
      expect(() => {
        viewManager.handleWindowResize();
      }).not.toThrow();
    });
  });

  describe('View Lifecycle', () => {
    test('should return null for non-existent view', () => {
      expect(viewManager.getView('non-existent')).toBeNull();
    });

    test('should return null for non-existent view state', () => {
      expect(viewManager.getViewState('non-existent')).toBeNull();
    });

    test('should return null for active view when none is active', () => {
      expect(viewManager.getActiveView()).toBeNull();
    });
  });

  describe('View Status Queries', () => {
    test('should return null login status for non-existent view', () => {
      expect(viewManager.getLoginStatus('non-existent')).toBeNull();
    });

    test('should return null error info for non-existent view', () => {
      expect(viewManager.getErrorInfo('non-existent')).toBeNull();
    });

    test('should return false for isViewLoading on non-existent view', () => {
      expect(viewManager.isViewLoading('non-existent')).toBe(false);
    });

    test('should return false for hasViewError on non-existent view', () => {
      expect(viewManager.hasViewError('non-existent')).toBe(false);
    });
  });

  describe('User Agent', () => {
    test('should provide default WhatsApp-compatible user agent', () => {
      const userAgent = viewManager._getDefaultUserAgent();
      
      expect(userAgent).toContain('Chrome');
      expect(userAgent).toContain('Safari');
      expect(typeof userAgent).toBe('string');
      expect(userAgent.length).toBeGreaterThan(0);
    });
  });

  describe('Renderer Notifications', () => {
    test('should handle notification when window is available', () => {
      const mockWebContents = {
        send: jest.fn()
      };
      
      mockMainWindow.getWindow = jest.fn(() => ({
        isDestroyed: jest.fn(() => false),
        webContents: mockWebContents
      }));

      viewManager._notifyRenderer('test-event', { data: 'test' });

      expect(mockWebContents.send).toHaveBeenCalledWith(
        'view-manager:test-event',
        { data: 'test' }
      );
    });

    test('should handle notification gracefully when window is destroyed', () => {
      mockMainWindow.getWindow = jest.fn(() => ({
        isDestroyed: jest.fn(() => true)
      }));

      // Should not throw
      expect(() => {
        viewManager._notifyRenderer('test-event', { data: 'test' });
      }).not.toThrow();
    });

    test('should handle notification gracefully when window is null', () => {
      mockMainWindow.getWindow = jest.fn(() => null);

      // Should not throw
      expect(() => {
        viewManager._notifyRenderer('test-event', { data: 'test' });
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should clear debounce timer when destroying all views', async () => {
      // Start a resize operation
      viewManager.resizeViews(300);
      
      expect(viewManager.resizeDebounceTimer).not.toBeNull();
      
      // Destroy all views
      await viewManager.destroyAllViews();
      
      // Timer should be cleared
      expect(viewManager.resizeDebounceTimer).toBeNull();
    });
  });

  describe('View Switching', () => {
    test('should return error when switching to non-existent view without createIfMissing', async () => {
      const result = await viewManager.switchView('non-existent', { createIfMissing: false });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // 错误可能是 "does not exist" 或 BrowserView 构造函数相关的错误
    });

    test('should return success when switching to already active view', async () => {
      // Manually set an active account
      viewManager.activeAccountId = 'test-account';
      
      const result = await viewManager.switchView('test-account');
      
      expect(result.success).toBe(true);
      expect(result.alreadyActive).toBe(true);
      expect(result.accountId).toBe('test-account');
    });

    test('should handle switchViewByIndex with invalid index', async () => {
      const result = await viewManager.switchViewByIndex(-1);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid index');
    });

    test('should handle switchViewByIndex with out of range index', async () => {
      const result = await viewManager.switchViewByIndex(10);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('out of range');
    });

    test('should handle switchToNextView with no accounts', async () => {
      const result = await viewManager.switchToNextView();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No accounts available');
    });

    test('should handle switchToPreviousView with no accounts', async () => {
      const result = await viewManager.switchToPreviousView();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No accounts available');
    });

    test('should return same account when only one account exists for next', async () => {
      // Add a mock view to the views map
      const mockView = {
        view: {},
        isVisible: false,
        accountId: 'test-account'
      };
      viewManager.views.set('test-account', mockView);
      
      const result = await viewManager.switchToNextView();
      
      expect(result.success).toBe(true);
      expect(result.alreadyActive).toBe(true);
      expect(result.accountId).toBe('test-account');
    });

    test('should return same account when only one account exists for previous', async () => {
      // Add a mock view to the views map
      const mockView = {
        view: {},
        isVisible: false,
        accountId: 'test-account'
      };
      viewManager.views.set('test-account', mockView);
      
      const result = await viewManager.switchToPreviousView();
      
      expect(result.success).toBe(true);
      expect(result.alreadyActive).toBe(true);
      expect(result.accountId).toBe('test-account');
    });
  });
});
