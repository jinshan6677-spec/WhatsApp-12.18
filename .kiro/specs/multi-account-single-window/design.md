# Design Document

## Overview

This document outlines the technical design for transforming the WhatsApp Desktop application from a multi-window, multi-instance architecture to a unified single-window architecture with integrated multi-account management. The new design leverages Electron's BrowserView API to embed multiple isolated WhatsApp Web sessions within a single main window, providing a user experience similar to modern fingerprint browser applications.

### Current Architecture

The existing application uses:
- **Multiple BrowserWindows**: Each account runs in a separate window
- **InstanceManager**: Manages lifecycle of independent window instances
- **AccountConfigManager**: Stores account configurations
- **SessionManager**: Handles session persistence per account
- **TranslationIntegration**: Injects translation scripts into each window

### Target Architecture

The new architecture will feature:
- **Single Main Window**: One BrowserWindow containing the entire UI
- **Sidebar Panel**: HTML/CSS-based account list on the left
- **BrowserView Container**: Right panel hosting multiple BrowserViews
- **View Manager**: Switches between BrowserViews without destroying them
- **Preserved Isolation**: Each account maintains independent session/proxy

## Architecture

### High-Level Component Structure

```
┌─────────────────────────────────────────────────────────┐
│                    Main Window                          │
│  ┌──────────────┬───────────────────────────────────┐  │
│  │              │                                   │  │
│  │   Account    │      BrowserView Container        │  │
│  │   Sidebar    │                                   │  │
│  │              │   ┌───────────────────────────┐   │  │
│  │  ┌────────┐  │   │                           │   │  │
│  │  │Account1│  │   │   Active BrowserView      │   │  │
│  │  └────────┘  │   │   (WhatsApp Web)          │   │  │
│  │  ┌────────┐  │   │                           │   │  │
│  │  │Account2│  │   │                           │   │  │
│  │  └────────┘  │   └───────────────────────────┘   │  │
│  │  ┌────────┐  │                                   │  │
│  │  │Account3│  │   Hidden BrowserViews:            │  │
│  │  └────────┘  │   - Account2 BrowserView          │  │
│  │              │   - Account3 BrowserView          │  │
│  │  [+ Add]     │   (Maintained but not visible)    │  │
│  │              │                                   │  │
│  └──────────────┴───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Process Architecture

```
Main Process
├── main.js (Entry point)
├── MainWindow (Single window management)
├── AccountManager (CRUD operations on accounts)
├── SessionManager (Session isolation per account)
├── ViewManager (BrowserView lifecycle & switching)
├── TranslationService (Existing, adapted for multi-view)
└── IPC Handlers (Communication with renderer)

Renderer Process (Main Window)
├── app.html (UI shell)
├── sidebar.js (Account list UI logic)
├── viewContainer.js (BrowserView mount point)
└── styles.css (UI styling)

BrowserView Processes (One per account)
├── WhatsApp Web content
├── Injected translation scripts
└── Isolated session data
```

## Components and Interfaces

### 1. MainWindow

**Purpose**: Manages the single main application window

**Responsibilities**:
- Create and configure the main BrowserWindow
- Load the custom UI shell (app.html)
- Handle window lifecycle events
- Persist window size/position

**Key Methods**:
```javascript
class MainWindow {
  constructor(options)
  initialize()                    // Create window and load UI
  getWindow()                     // Return BrowserWindow instance
  getBounds()                     // Get window dimensions
  setBounds(bounds)               // Set window dimensions
  show()                          // Show window
  hide()                          // Hide window
  close()                         // Close window
  sendToRenderer(channel, data)   // IPC to renderer
}
```

**Configuration**:
```javascript
{
  width: 1400,
  height: 900,
  minWidth: 1000,
  minHeight: 600,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: 'preload-main.js'
  }
}
```

### 2. AccountManager

**Purpose**: Manages account configurations (CRUD operations)

**Responsibilities**:
- Load/save account configurations from storage
- Validate account data
- Generate unique account IDs
- Manage account metadata (name, proxy, notes)

**Key Methods**:
```javascript
class AccountManager {
  constructor(options)
  loadAccounts()                          // Load all accounts
  getAccount(accountId)                   // Get single account
  createAccount(config)                   // Create new account
  updateAccount(accountId, updates)       // Update account
  deleteAccount(accountId, options)       // Delete account
  accountExists(accountId)                // Check existence
  exportAccounts()                        // Export to JSON
  importAccounts(data, options)           // Import from JSON
}
```

**Data Model**:
```javascript
{
  id: 'acc_001',                    // Unique identifier
  name: 'WhatsApp Business',        // Display name
  note: 'Customer support account', // Optional note
  proxy: {                          // Proxy configuration
    enabled: true,
    protocol: 'socks5',
    host: '127.0.0.1',
    port: 1080,
    username: '',                   // Optional
    password: ''                    // Optional
  },
  translation: {                    // Translation settings
    enabled: true,
    targetLanguage: 'zh-CN',
    engine: 'google',
    autoTranslate: false
  },
  sessionDir: '/sessions/acc_001', // Session data path
  createdAt: '2024-01-01T00:00:00Z',
  lastActiveAt: '2024-01-15T10:30:00Z',
  autoStart: false                  // Auto-start on app launch
}
```

### 3. SessionManager

**Purpose**: Creates and manages isolated browser sessions for each account

**Responsibilities**:
- Create unique session partitions
- Configure session-specific proxies
- Manage session persistence
- Detect login status
- Clear session data

**Key Methods**:
```javascript
class SessionManager {
  constructor(options)
  createSession(accountId, config)        // Create isolated session
  getSession(accountId)                   // Get session instance
  configureProxy(accountId, proxyConfig)  // Set proxy for session
  hasSessionData(accountId)               // Check if session exists
  detectLoginStatus(accountId, view)      // Check WhatsApp login
  clearSessionData(accountId)             // Force logout
  deleteSessionData(accountId)            // Remove all data
}
```

**Session Isolation**:
- Each account uses `session.fromPartition('persist:account_${accountId}')`
- Separate storage for:
  - Cookies
  - LocalStorage
  - IndexedDB
  - Service Workers
  - Cache
- Independent proxy configuration per session

### 4. ViewManager

**Purpose**: Manages BrowserView instances and handles switching between accounts

**Responsibilities**:
- Create BrowserView for each account
- Attach/detach views from main window
- Maintain view lifecycle (keep hidden views alive)
- Handle view positioning and resizing
- Coordinate with SessionManager for isolation

**Key Methods**:
```javascript
class ViewManager {
  constructor(mainWindow, sessionManager)
  createView(accountId, config)           // Create new BrowserView
  getView(accountId)                      // Get existing view
  showView(accountId)                     // Switch to account view
  hideView(accountId)                     // Hide view (keep alive)
  destroyView(accountId)                  // Destroy view completely
  resizeViews(sidebarWidth)               // Adjust view bounds
  getAllViews()                           // Get all view instances
  getActiveView()                         // Get currently visible view
}
```

**View Lifecycle**:
```
Created → Hidden → Active → Hidden → ... → Destroyed
   ↑                  ↑
   └──────────────────┘
   (Views stay alive when hidden)
```

**View Management Strategy**:
- **Lazy Creation**: Create views only when account is first accessed
- **Keep Alive**: Hidden views remain in memory to maintain WhatsApp connection
- **Bounds Management**: Calculate view position based on sidebar width
- **Z-Index Control**: Use `setTopBrowserView()` to control visibility

### 5. TranslationService (Adapted)

**Purpose**: Inject and manage translation functionality per account

**Responsibilities**:
- Inject translation scripts into each BrowserView
- Maintain per-account translation configurations
- Handle translation requests with account context
- Manage translation cache per account

**Key Methods**:
```javascript
class TranslationService {
  constructor()
  injectScripts(accountId, view, config)  // Inject into BrowserView
  configureTranslation(accountId, config) // Update config
  handleTranslationRequest(accountId, text, options)
  clearCache(accountId)                   // Clear account cache
  removeAccount(accountId)                // Cleanup on account removal
}
```

**Adaptation Strategy**:
- Inject `window.ACCOUNT_ID` into each BrowserView
- Translation requests include accountId for routing
- Separate translation cache per account
- Reuse existing translation engines (Google, GPT-4, Gemini, DeepSeek)

### 6. UI Components (Renderer Process)

#### Sidebar Component

**Purpose**: Display account list and controls

**Structure**:
```html
<div id="sidebar">
  <div class="sidebar-header">
    <h2>Accounts</h2>
    <button id="add-account">+ Add</button>
  </div>
  <div class="account-list">
    <div class="account-item" data-account-id="acc_001">
      <div class="account-avatar"></div>
      <div class="account-info">
        <div class="account-name">WhatsApp Business</div>
        <div class="account-status online">Online</div>
      </div>
      <div class="account-actions">
        <button class="edit-btn">⚙️</button>
        <button class="delete-btn">🗑️</button>
      </div>
    </div>
    <!-- More accounts... -->
  </div>
</div>
```

**Functionality**:
- Render account list from IPC data
- Handle account selection (send IPC to switch view)
- Show account status indicators (online/offline/error)
- Provide add/edit/delete controls
- Support drag-to-reorder (optional)

#### View Container

**Purpose**: Define the area where BrowserViews are mounted

**Structure**:
```html
<div id="view-container">
  <!-- BrowserViews are attached here by main process -->
  <!-- This div serves as a positioning reference -->
</div>
```

**Functionality**:
- Calculate and communicate bounds to main process
- Handle resize events
- Provide visual feedback during view switching

## Data Models

### Account Configuration Schema

```javascript
{
  // Identity
  id: String,              // Unique ID (e.g., 'acc_001')
  name: String,            // Display name
  note: String,            // Optional notes
  
  // Session
  sessionDir: String,      // Path to session data
  
  // Network
  proxy: {
    enabled: Boolean,
    protocol: String,      // 'http' | 'https' | 'socks5'
    host: String,
    port: Number,
    username: String,      // Optional
    password: String,      // Optional
    bypass: String         // Optional bypass rules
  },
  
  // Translation
  translation: {
    enabled: Boolean,
    targetLanguage: String,
    engine: String,        // 'google' | 'gpt4' | 'gemini' | 'deepseek'
    apiKey: String,        // Optional, for paid engines
    autoTranslate: Boolean,
    translateInput: Boolean,
    friendSettings: Object // Per-contact settings
  },
  
  // UI State
  order: Number,           // Display order in sidebar
  
  // Metadata
  createdAt: Date,
  lastActiveAt: Date,
  autoStart: Boolean       // Auto-start on app launch
}
```

### View State

```javascript
{
  accountId: String,
  view: BrowserView,       // Electron BrowserView instance
  session: Session,        // Electron Session instance
  isVisible: Boolean,
  isLoaded: Boolean,
  bounds: {
    x: Number,
    y: Number,
    width: Number,
    height: Number
  },
  status: String,          // 'loading' | 'ready' | 'error'
  loginStatus: Boolean     // WhatsApp login state
}
```

### Application State

```javascript
{
  mainWindow: BrowserWindow,
  activeAccountId: String,
  sidebarWidth: Number,
  accounts: Map<String, AccountConfig>,
  views: Map<String, ViewState>,
  sessions: Map<String, Session>
}
```

## Error Handling

### Error Categories

1. **Account Management Errors**
   - Invalid account configuration
   - Duplicate account ID
   - Account not found
   - Storage write failure

2. **Session Errors**
   - Session creation failure
   - Proxy connection failure
   - Session data corruption
   - Login detection failure

3. **View Management Errors**
   - View creation failure
   - View attachment failure
   - WhatsApp Web load failure
   - Script injection failure

4. **Translation Errors**
   - Script injection failure
   - Translation API failure
   - Configuration error
   - Cache corruption

### Error Handling Strategy

**Graceful Degradation**:
- If translation fails, WhatsApp still works
- If proxy fails, offer direct connection
- If view creation fails, show error in sidebar

**User Feedback**:
- Display error messages in sidebar status
- Show notification for critical errors
- Provide retry mechanisms
- Log errors for debugging

**Recovery Mechanisms**:
- Auto-retry for transient failures
- Session data backup before operations
- Fallback to default configurations
- Clear cache/data as last resort

## Testing Strategy

### Unit Tests

**AccountManager**:
- Test CRUD operations
- Validate configuration schema
- Test import/export functionality
- Test error handling

**SessionManager**:
- Test session creation
- Test proxy configuration
- Test login detection
- Test data persistence

**ViewManager**:
- Test view creation
- Test view switching
- Test bounds calculation
- Test lifecycle management

### Integration Tests

**Account-to-View Flow**:
- Create account → Create view → Load WhatsApp
- Switch accounts → Switch views → Maintain state
- Delete account → Destroy view → Clean up data

**Translation Integration**:
- Inject scripts → Configure per account → Translate messages
- Switch accounts → Maintain separate configs
- Update config → Apply to active view

**Proxy Integration**:
- Configure proxy → Apply to session → Verify connection
- Switch accounts → Verify independent proxies
- Update proxy → Reconnect session

### End-to-End Tests

**User Workflows**:
1. Launch app → See account list → Add new account → Scan QR → Login
2. Switch between accounts → Verify independent sessions
3. Configure translation → Translate messages → Verify per-account settings
4. Configure proxy → Verify network isolation
5. Close app → Reopen → Verify state persistence

**Performance Tests**:
- Test with 10+ accounts
- Measure view switching latency
- Monitor memory usage
- Test concurrent message handling

### Manual Testing Checklist

- [ ] Account creation and deletion
- [ ] Account switching (rapid switching)
- [ ] WhatsApp login/logout
- [ ] Message sending/receiving
- [ ] Translation functionality
- [ ] Proxy configuration
- [ ] Session persistence
- [ ] Window resize behavior
- [ ] Sidebar resize behavior
- [ ] Error recovery
- [ ] Migration from old architecture

## Migration Strategy

### Phase 1: Preparation

1. **Backup Existing Data**
   - Export all account configurations
   - Backup session data directories
   - Save window states

2. **Create Migration Script**
   - Detect old configuration format
   - Map old data to new schema
   - Preserve session data paths

### Phase 2: Data Migration

1. **Account Configuration Migration**
   ```javascript
   // Old format (multi-window)
   {
     id: 'acc_001',
     window: { x, y, width, height },
     ...
   }
   
   // New format (single-window)
   {
     id: 'acc_001',
     order: 0,  // Position in sidebar
     ...
   }
   ```

2. **Session Data Migration**
   - Keep existing session directories
   - Update paths in new configuration
   - No need to move actual session files

3. **Translation Config Migration**
   - Preserve per-account translation settings
   - Migrate to new config structure

### Phase 3: First Run Experience

1. **Detection**
   - Check for old configuration file
   - Prompt user about migration

2. **Migration Execution**
   - Show progress dialog
   - Migrate data in background
   - Validate migrated data

3. **Verification**
   - Load migrated accounts
   - Verify session data accessibility
   - Test one account login

4. **Cleanup**
   - Archive old configuration
   - Keep session data intact
   - Log migration results

### Phase 4: Rollback Plan

1. **Backup Strategy**
   - Keep old configuration file
   - Don't delete session data
   - Store migration log

2. **Rollback Procedure**
   - Restore old configuration
   - Revert to old application version
   - Session data remains intact

## Performance Considerations

### Memory Management

**Challenge**: Multiple BrowserViews consume significant memory

**Strategies**:
1. **Lazy Loading**: Create views only when needed
2. **View Pooling**: Reuse destroyed views for new accounts
3. **Memory Limits**: Set max concurrent active views
4. **Garbage Collection**: Explicitly destroy unused views

**Target Metrics**:
- Base memory: ~200MB (main window)
- Per-view memory: ~150-200MB
- Max 10 concurrent views: ~2GB total

### View Switching Performance

**Challenge**: Switching views should feel instant

**Strategies**:
1. **Pre-render**: Keep views loaded in background
2. **Bounds Caching**: Cache calculated bounds
3. **Debounce Resize**: Avoid excessive recalculation
4. **CSS Transitions**: Smooth visual transitions

**Target Metrics**:
- View switch latency: <100ms
- Sidebar resize: <50ms
- No visible flicker

### Network Optimization

**Challenge**: Multiple accounts making concurrent requests

**Strategies**:
1. **Connection Pooling**: Reuse connections per session
2. **Request Prioritization**: Prioritize active view
3. **Bandwidth Limiting**: Optional per-account limits
4. **Proxy Caching**: Cache proxy connections

## Security Considerations

### Session Isolation

**Requirements**:
- Complete isolation between account sessions
- No cookie/storage sharing
- Independent proxy configurations
- Separate cache directories

**Implementation**:
- Use Electron's partition API
- Verify isolation in tests
- Monitor for cross-contamination

### Proxy Security

**Requirements**:
- Secure storage of proxy credentials
- Encrypted transmission
- Proxy authentication support
- Connection validation

**Implementation**:
- Use electron-store encryption
- Validate proxy before use
- Handle authentication errors
- Log connection attempts

### Translation Privacy

**Requirements**:
- Per-account translation configs
- No cross-account data leakage
- Secure API key storage
- Optional local-only translation

**Implementation**:
- Isolate translation caches
- Encrypt API keys
- Provide local translation option
- Clear cache on logout

## Deployment Plan

### Development Phase

1. **Week 1-2**: Core architecture
   - Implement MainWindow
   - Implement ViewManager
   - Basic account switching

2. **Week 3-4**: Account management
   - Implement AccountManager
   - Build sidebar UI
   - Add CRUD operations

3. **Week 5-6**: Session & proxy
   - Implement SessionManager
   - Add proxy configuration
   - Test isolation

4. **Week 7-8**: Translation integration
   - Adapt TranslationService
   - Test per-account configs
   - Verify script injection

5. **Week 9-10**: Migration & polish
   - Build migration tool
   - Add error handling
   - Performance optimization

### Testing Phase

1. **Alpha Testing** (Internal)
   - Test with 5-10 accounts
   - Verify core functionality
   - Fix critical bugs

2. **Beta Testing** (Limited users)
   - Test migration from old version
   - Gather performance feedback
   - Refine UI/UX

3. **Release Candidate**
   - Full feature testing
   - Performance benchmarks
   - Security audit

### Release Phase

1. **Staged Rollout**
   - Release to 10% of users
   - Monitor for issues
   - Gradual increase to 100%

2. **Post-Release**
   - Monitor error reports
   - Collect user feedback
   - Plan incremental improvements

## Future Enhancements

### Phase 2 Features

1. **Account Groups**
   - Organize accounts into folders
   - Bulk operations on groups
   - Group-level settings

2. **Advanced Proxy**
   - Proxy rotation
   - Automatic failover
   - Proxy health monitoring

3. **Enhanced Translation**
   - Custom translation models
   - Offline translation
   - Translation history

4. **Automation**
   - Scheduled messages
   - Auto-reply rules
   - Message templates

5. **Analytics**
   - Per-account statistics
   - Message volume tracking
   - Response time metrics

### Long-term Vision

- Cloud sync for account configs
- Mobile companion app
- Team collaboration features
- Advanced security features (2FA, encryption)
- Plugin system for extensions
