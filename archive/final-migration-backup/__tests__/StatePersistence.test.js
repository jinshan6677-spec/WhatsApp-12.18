/**
 * State Persistence Tests
 * 
 * Tests for view state persistence functionality
 */

// Mock electron module - must be before require
jest.mock('electron', () => ({
  BrowserView: jest.fn().mockImplementation(() => ({
    webContents: {
      setUserAgent: jest.fn(),
      loadURL: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      isDestroyed: jest.fn(() => false),
      executeJavaScript: jest.fn().mockResolvedValue(undefined)
    },
    setBounds: jest.fn()
  }))
}));

const ViewManager = require('../ViewManager');
const MainWindow = require('../MainWindow');

describe('State Persistence', () => {
  let mockMainWindow;
  let mockSessionManager;
  let mockStateStore;
  let viewManager;

  beforeEach(() => {
    // Mock state store
    mockStateStore = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn()
    };

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
        })),
        webContents: {
          send: jest.fn()
        }
      })),
      getSidebarWidth: jest.fn(() => 280),
      getTranslationPanelWidth: jest.fn(() => 0),
      setSidebarWidth: jest.fn(),
      getStateStore: jest.fn(() => mockStateStore)
    };

    // Mock SessionManager
    mockSessionManager = {
      getInstanceSession: jest.fn(() => ({
        setProxy: jest.fn(),
        webRequest: {
          onBeforeSendHeaders: jest.fn(),
          onHeadersReceived: jest.fn()
        }
      }))
    };

    viewManager = new ViewManager(mockMainWindow, mockSessionManager);
  });

  describe('Active Account ID Persistence', () => {
    test('should save active account ID when showing view', async () => {
      // Mock BrowserView
      const mockView = {
        webContents: {
          setUserAgent: jest.fn(),
          loadURL: jest.fn().mockResolvedValue(undefined),
          on: jest.fn(),
          isDestroyed: jest.fn(() => false)
        },
        setBounds: jest.fn()
      };

      // Mock BrowserView constructor
      const BrowserView = require('electron').BrowserView;
      BrowserView.mockImplementation(() => mockView);

      // Create a view
      await viewManager.createView('test-account-1');

      // Show the view
      await viewManager.showView('test-account-1');

      // Verify active account ID was saved
      expect(mockStateStore.set).toHaveBeenCalledWith('activeAccountId', 'test-account-1');
    });

    test('should clear active account ID when hiding active view', async () => {
      // Mock BrowserView
      const mockView = {
        webContents: {
          setUserAgent: jest.fn(),
          loadURL: jest.fn().mockResolvedValue(undefined),
          on: jest.fn(),
          isDestroyed: jest.fn(() => false)
        },
        setBounds: jest.fn()
      };

      const BrowserView = require('electron').BrowserView;
      BrowserView.mockImplementation(() => mockView);

      // Create and show a view
      await viewManager.createView('test-account-1');
      await viewManager.showView('test-account-1');

      // Clear mock calls
      mockStateStore.set.mockClear();
      mockStateStore.delete.mockClear();

      // Hide the view
      await viewManager.hideView('test-account-1');

      // Verify active account ID was cleared
      expect(mockStateStore.delete).toHaveBeenCalledWith('activeAccountId');
    });

    test('should get saved active account ID', () => {
      mockStateStore.get.mockReturnValue('saved-account-id');

      const savedId = viewManager.getSavedActiveAccountId();

      expect(savedId).toBe('saved-account-id');
      expect(mockStateStore.get).toHaveBeenCalledWith('activeAccountId', null);
    });

    test('should return null if no saved active account ID', () => {
      mockStateStore.get.mockReturnValue(null);

      const savedId = viewManager.getSavedActiveAccountId();

      expect(savedId).toBeNull();
    });
  });

  describe('Active Account Restoration', () => {
    test('should restore active account if it exists', async () => {
      // Mock saved account ID
      mockStateStore.get.mockReturnValue('account-1');

      // Mock BrowserView
      const mockView = {
        webContents: {
          setUserAgent: jest.fn(),
          loadURL: jest.fn().mockResolvedValue(undefined),
          on: jest.fn(),
          isDestroyed: jest.fn(() => false)
        },
        setBounds: jest.fn()
      };

      const BrowserView = require('electron').BrowserView;
      BrowserView.mockImplementation(() => mockView);

      // Restore active account
      const result = await viewManager.restoreActiveAccount(['account-1', 'account-2']);

      expect(result.success).toBe(true);
      expect(result.accountId).toBe('account-1');
    });

    test('should fail if saved account does not exist', async () => {
      // Mock saved account ID that doesn't exist
      mockStateStore.get.mockReturnValue('non-existent-account');

      const result = await viewManager.restoreActiveAccount(['account-1', 'account-2']);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('account_not_found');
      expect(result.accountId).toBe('non-existent-account');
      
      // Verify saved account ID was cleared
      expect(mockStateStore.delete).toHaveBeenCalledWith('activeAccountId');
    });

    test('should fail if no saved account', async () => {
      // Mock no saved account ID
      mockStateStore.get.mockReturnValue(null);

      const result = await viewManager.restoreActiveAccount(['account-1', 'account-2']);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_saved_account');
    });

    test('should handle empty account list', async () => {
      mockStateStore.get.mockReturnValue('account-1');

      const result = await viewManager.restoreActiveAccount([]);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('account_not_found');
    });
  });

  describe('Sidebar Width Persistence', () => {
    test('MainWindow should get saved sidebar width', () => {
      // This is tested in MainWindow, but we verify the interface
      expect(mockMainWindow.getSidebarWidth).toBeDefined();
      expect(typeof mockMainWindow.getSidebarWidth()).toBe('number');
    });

    test('MainWindow should set sidebar width', () => {
      mockMainWindow.setSidebarWidth(350);
      
      expect(mockMainWindow.setSidebarWidth).toHaveBeenCalledWith(350);
    });
  });

  describe('State Store Access', () => {
    test('should have access to state store', () => {
      expect(viewManager.stateStore).toBe(mockStateStore);
    });

    test('should get state store from MainWindow', () => {
      const store = mockMainWindow.getStateStore();
      
      expect(store).toBe(mockStateStore);
      expect(mockMainWindow.getStateStore).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle state store errors gracefully when saving', async () => {
      mockStateStore.set.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Mock BrowserView
      const mockView = {
        webContents: {
          setUserAgent: jest.fn(),
          loadURL: jest.fn().mockResolvedValue(undefined),
          on: jest.fn(),
          isDestroyed: jest.fn(() => false)
        },
        setBounds: jest.fn()
      };

      const BrowserView = require('electron').BrowserView;
      BrowserView.mockImplementation(() => mockView);

      // Create and show view - should not throw
      await viewManager.createView('test-account');
      await expect(viewManager.showView('test-account')).resolves.toBe(true);
    });

    test('should handle state store errors gracefully when loading', () => {
      mockStateStore.get.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should return null instead of throwing
      const savedId = viewManager.getSavedActiveAccountId();
      expect(savedId).toBeNull();
    });
  });
});
