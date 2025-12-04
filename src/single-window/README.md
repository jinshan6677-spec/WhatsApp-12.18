# Single Window Architecture

This directory contains the implementation of the single-window architecture for WhatsApp Desktop, which replaces the multi-window approach with a unified interface.

## Components

### MainWindow.js

The main window manager that creates and manages the single application window.

**Features:**
- Window initialization with configurable dimensions (default: 1400x900, min: 1000x600)
- Window state persistence (bounds, position, maximized state)
- Sidebar width persistence
- IPC communication methods for renderer interaction
- Proper webPreferences configuration with contextIsolation and preload script

**Usage:**
```javascript
const MainWindow = require('./single-window/MainWindow');

const mainWindow = new MainWindow({
  width: 1400,
  height: 900,
  title: 'WhatsApp Desktop'
});

mainWindow.initialize();
```

**Key Methods:**
- `initialize()` - Create and show the window
- `getWindow()` - Get BrowserWindow instance
- `getBounds()` - Get window bounds
- `setBounds(bounds)` - Set window bounds
- `sendToRenderer(channel, data)` - Send IPC message to renderer
- `getSidebarWidth()` - Get saved sidebar width
- `setSidebarWidth(width)` - Save sidebar width

### Renderer Components

#### preload-main.js

Secure preload script that exposes IPC methods to the renderer via contextBridge.

**Exposed API:**
- `electronAPI.accounts.*` - Account management methods
- `electronAPI.views.*` - View management methods
- `electronAPI.window.*` - Window management methods
- `electronAPI.on()` - Event listener registration

#### app.html

Main HTML structure with:
- Sidebar for account list
- Resize handle for sidebar width adjustment
- View container for BrowserViews
- Account configuration dialog

#### styles.css

Complete styling for:
- Two-column layout (sidebar + content area)
- Responsive sidebar with drag handle
- Account list items with status indicators
- Dialog overlays and forms
- Buttons and form controls

#### app.js

Main application logic:
- Sidebar resize functionality
- Account dialog management
- Initial data loading
- Window state management

#### sidebar.js

Sidebar component logic:
- Account list rendering
- Account switching
- Account CRUD operations
- Status indicators
- Event handling

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Main Window                          │
│  ┌──────────────┬───────────────────────────────────┐  │
│  │   Sidebar    │      View Container               │  │
│  │              │                                   │  │
│  │  Account 1   │   BrowserView (WhatsApp Web)      │  │
│  │  Account 2   │                                   │  │
│  │  Account 3   │                                   │  │
│  │              │                                   │  │
│  │  [+ Add]     │                                   │  │
│  └──────────────┴───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## State Persistence

The MainWindow uses electron-store to persist:
- Window bounds (x, y, width, height)
- Maximized state
- Sidebar width

State is automatically saved on:
- Window resize
- Window move
- Sidebar resize
- Application close

## Requirements Coverage

This implementation satisfies the following requirements:

**Requirement 1.1:** Main Window is created as the sole primary window
**Requirement 1.2:** Contains Account Sidebar and Session Area
**Requirement 1.3:** Uses contextIsolation and preload script
**Requirement 1.4:** Persists window size and position
**Requirement 11.4:** Sidebar width is resizable and persisted

## Testing

Run tests with:
```bash
npm test src/single-window/__tests__/MainWindow.test.js
```

## Next Steps

The following components need to be implemented to complete the single-window architecture:

1. **ViewManager** - Manage BrowserView instances for each account
2. **SessionManager** - Handle isolated sessions per account
3. **IPC Handlers** - Implement account and view management IPC handlers
4. **Account Management** - Adapt AccountConfigManager for single-window
5. **Translation Integration** - Adapt translation service for BrowserViews

See `tasks.md` for the complete implementation plan.
