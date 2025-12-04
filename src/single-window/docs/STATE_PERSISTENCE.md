# View State Persistence

This document describes the view state persistence feature implemented in the single-window architecture.

## Overview

The view state persistence feature automatically saves and restores the following state across application restarts:

1. **Active Account ID** - Which account was last active
2. **Sidebar Width** - User's preferred sidebar width
3. **Window Bounds** - Window position and size
4. **Window Maximized State** - Whether the window was maximized

## Architecture

### Storage

State is persisted using `electron-store`, which stores data in JSON format in the user's application data directory.

**Storage Location:**
- Windows: `%APPDATA%\<app-name>\window-state.json`
- macOS: `~/Library/Application Support/<app-name>/window-state.json`
- Linux: `~/.config/<app-name>/window-state.json`

**Storage Schema:**
```json
{
  "bounds": {
    "x": 100,
    "y": 100,
    "width": 1400,
    "height": 900
  },
  "isMaximized": false,
  "sidebarWidth": 280,
  "activeAccountId": "acc_001"
}
```

### Components

#### MainWindow

**Responsibilities:**
- Manages window bounds and maximized state persistence
- Manages sidebar width persistence
- Provides access to the state store

**Key Methods:**
```javascript
// Get saved sidebar width
const width = mainWindow.getSidebarWidth(); // Returns: number

// Set sidebar width (automatically persisted)
mainWindow.setSidebarWidth(320);

// Get state store for advanced usage
const store = mainWindow.getStateStore();
```

**Automatic Persistence:**
- Window bounds are saved on `resize` and `move` events
- Maximized state is saved on `maximize` and `unmaximize` events
- Sidebar width is saved when `setSidebarWidth()` is called

#### ViewManager

**Responsibilities:**
- Manages active account ID persistence
- Provides methods to save and restore active account

**Key Methods:**
```javascript
// Get saved active account ID
const accountId = viewManager.getSavedActiveAccountId(); // Returns: string | null

// Restore active account from saved state
const result = await viewManager.restoreActiveAccount(availableAccountIds);
// Returns: { success: boolean, accountId?: string, reason?: string }
```

**Automatic Persistence:**
- Active account ID is saved when `showView()` is called
- Active account ID is cleared when the active view is hidden

#### IPC Handlers

**New Handlers:**

1. `get-sidebar-width` - Get saved sidebar width
   ```javascript
   const result = await window.electronAPI.invoke('get-sidebar-width');
   // Returns: { success: boolean, width?: number }
   ```

2. `get-active-account-id` - Get saved active account ID
   ```javascript
   const result = await window.electronAPI.invoke('get-active-account-id');
   // Returns: { success: boolean, accountId?: string }
   ```

3. `restore-active-account` - Restore active account from saved state
   ```javascript
   const result = await window.electronAPI.invoke('restore-active-account');
   // Returns: { success: boolean, accountId?: string, reason?: string }
   ```

## Usage

### Basic Initialization with State Restoration

```javascript
const { app } = require('electron');
const MainWindow = require('./single-window/MainWindow');
const ViewManager = require('./single-window/ViewManager');
const SessionManager = require('./managers/SessionManager');
const AccountConfigManager = require('./managers/AccountConfigManager');

app.whenReady().then(async () => {
  // 1. Initialize components
  const mainWindow = new MainWindow();
  mainWindow.initialize();
  
  const sessionManager = new SessionManager({
    userDataPath: app.getPath('userData')
  });
  
  const viewManager = new ViewManager(mainWindow, sessionManager);
  
  const accountManager = new AccountConfigManager({
    cwd: app.getPath('userData')
  });
  
  // 2. Load accounts
  const accounts = await accountManager.loadAccounts();
  
  // 3. Restore active account
  const accountIds = accounts.map(acc => acc.id);
  const result = await viewManager.restoreActiveAccount(accountIds);
  
  if (result.success) {
    console.log(`Restored active account: ${result.accountId}`);
  } else {
    // Fallback: activate first account if available
    if (accounts.length > 0) {
      await viewManager.switchView(accounts[0].id, {
        createIfMissing: true
      });
    }
  }
  
  // Sidebar width is automatically restored by MainWindow
  console.log(`Sidebar width: ${mainWindow.getSidebarWidth()}px`);
});
```

### Renderer Side Initialization

The renderer automatically loads the saved sidebar width on startup:

```javascript
// In src/single-window/renderer/app.js
async function init() {
  await loadSidebarWidth(); // Loads from main process
  setupResizeHandle();
  applySidebarWidth(sidebarWidth);
  // ...
}
```

### Manual State Management

While state is automatically persisted, you can also manually manage it:

```javascript
// Check current saved state
const savedAccountId = viewManager.getSavedActiveAccountId();
const savedSidebarWidth = mainWindow.getSidebarWidth();

// Manually update state (will be persisted)
mainWindow.setSidebarWidth(350);

// Access state store directly for advanced usage
const stateStore = mainWindow.getStateStore();
const allState = {
  activeAccountId: stateStore.get('activeAccountId'),
  sidebarWidth: stateStore.get('sidebarWidth'),
  bounds: stateStore.get('bounds'),
  isMaximized: stateStore.get('isMaximized')
};
```

## State Restoration Flow

### On Application Startup

```
1. MainWindow.initialize()
   ├─ Load saved window bounds from store
   ├─ Load saved maximized state from store
   ├─ Load saved sidebar width from store
   └─ Create window with restored state

2. ViewManager initialization
   └─ Get reference to MainWindow's state store

3. Load accounts from AccountConfigManager

4. ViewManager.restoreActiveAccount(accountIds)
   ├─ Get saved active account ID from store
   ├─ Check if account still exists
   ├─ If exists: switchView(accountId)
   │  ├─ Create view if needed
   │  ├─ Show view
   │  └─ Save active account ID (confirmation)
   └─ If not exists: return failure reason

5. Renderer loads sidebar width
   ├─ Request from main process via IPC
   └─ Apply to UI layout
```

### During Runtime

```
User switches account:
├─ ViewManager.switchView(accountId)
├─ Show new view
├─ Update activeAccountId property
├─ Call _saveActiveAccountId()
└─ State persisted to disk

User resizes sidebar:
├─ Renderer detects resize
├─ Send 'sidebar-resized' IPC to main
├─ MainWindow.setSidebarWidth(width)
├─ State persisted to disk
└─ ViewManager updates view bounds

User resizes window:
├─ MainWindow 'resize' event
├─ _saveWindowState()
└─ State persisted to disk
```

### On Application Shutdown

No explicit action needed - all state has been persisted during runtime.

## Error Handling

### Account Not Found

If the saved active account no longer exists:

```javascript
const result = await viewManager.restoreActiveAccount(accountIds);

if (!result.success && result.reason === 'account_not_found') {
  console.log(`Account ${result.accountId} no longer exists`);
  // Saved account ID is automatically cleared
  // Fallback to first available account or show empty state
}
```

### No Saved Account

If no account was previously saved:

```javascript
const result = await viewManager.restoreActiveAccount(accountIds);

if (!result.success && result.reason === 'no_saved_account') {
  console.log('No previously active account');
  // Show account selection UI or activate first account
}
```

### State Store Errors

State store operations are wrapped in try-catch blocks and log errors without throwing:

```javascript
// If state store fails, defaults are used
const sidebarWidth = mainWindow.getSidebarWidth(); // Returns default 280 if error
```

## Testing

### Manual Testing

1. **Active Account Persistence:**
   - Start app, switch to account B
   - Close app
   - Restart app
   - Verify account B is active

2. **Sidebar Width Persistence:**
   - Start app, resize sidebar to 350px
   - Close app
   - Restart app
   - Verify sidebar is 350px wide

3. **Window Bounds Persistence:**
   - Start app, move and resize window
   - Close app
   - Restart app
   - Verify window position and size restored

4. **Account Deletion:**
   - Start app, activate account B
   - Delete account B
   - Close app
   - Restart app
   - Verify app handles missing account gracefully

### Automated Testing

See `src/single-window/__tests__/ViewManager.test.js` for unit tests.

Example test for state persistence:

```javascript
test('should save active account ID when showing view', async () => {
  const mockStore = {
    set: jest.fn(),
    get: jest.fn(),
    delete: jest.fn()
  };
  
  viewManager.stateStore = mockStore;
  
  await viewManager.showView('test-account');
  
  expect(mockStore.set).toHaveBeenCalledWith('activeAccountId', 'test-account');
});
```

## Migration from Multi-Window Architecture

When migrating from the old multi-window architecture:

1. **No Active Account State:** The old architecture didn't have a concept of "active account" since each account had its own window. The new architecture will start with no saved active account.

2. **Window Bounds:** Each account had its own window bounds. The new architecture has a single window. The migration should:
   - Use the bounds of the most recently active window
   - Or use default bounds if no previous windows

3. **Sidebar Width:** This is a new feature, so it will use the default value (280px) on first run.

## Performance Considerations

### Write Frequency

State is written to disk on:
- Every account switch (~1-10 times per session)
- Every sidebar resize (debounced to ~1-5 times per resize operation)
- Every window move/resize (debounced)

This is a low-frequency operation that doesn't impact performance.

### Read Frequency

State is read from disk:
- Once on application startup
- Once when renderer initializes

This is a one-time operation per session.

### Storage Size

The state file is typically < 1KB, containing only:
- Window bounds (4 numbers)
- Sidebar width (1 number)
- Active account ID (1 string)
- Maximized state (1 boolean)

## Security Considerations

### Data Sensitivity

The persisted state contains:
- Account IDs (UUIDs, not sensitive)
- UI preferences (not sensitive)
- Window position (not sensitive)

No sensitive data (passwords, tokens, messages) is stored in the state file.

### File Permissions

`electron-store` creates files with user-only read/write permissions by default.

### Data Validation

All loaded state is validated:
- Window bounds are checked to ensure visibility on screen
- Sidebar width is constrained to min/max values
- Account IDs are verified against available accounts

## Troubleshooting

### State Not Persisting

1. Check file permissions in app data directory
2. Check for errors in console logs
3. Verify `electron-store` is installed
4. Check if app has write access to user data directory

### State Not Restoring

1. Check if state file exists
2. Verify state file is valid JSON
3. Check for errors during state load
4. Verify account IDs match available accounts

### Corrupted State File

If the state file becomes corrupted:
1. Delete `window-state.json` from app data directory
2. Restart app
3. State will be recreated with defaults

## Future Enhancements

Potential improvements for future versions:

1. **Account-Specific UI State:**
   - Remember scroll position per account
   - Remember selected chat per account
   - Remember zoom level per account

2. **Session History:**
   - Track recently active accounts
   - Quick switch to recent accounts

3. **State Sync:**
   - Sync state across devices (cloud)
   - Import/export state

4. **Advanced Persistence:**
   - Persist view loading state
   - Persist error states for recovery
   - Persist network status

## References

- [electron-store Documentation](https://github.com/sindresorhus/electron-store)
- [Electron BrowserView API](https://www.electronjs.org/docs/latest/api/browser-view)
- [Requirements Document](../../.kiro/specs/multi-account-single-window/requirements.md)
- [Design Document](../../.kiro/specs/multi-account-single-window/design.md)
