# Implementation Plan

## Overview

This implementation plan transforms the WhatsApp Desktop application from a multi-window architecture to a single-window architecture with integrated multi-account management. Tasks are organized to build incrementally, ensuring each step produces working, testable code.

---

## Phase 1: Core Infrastructure

- [x] 1. Create MainWindow component for single-window architecture





  - Create `src/single-window/MainWindow.js` class
  - Implement window initialization with proper dimensions (1400x900, min 1000x600)
  - Configure webPreferences with contextIsolation and preload script
  - Implement window state persistence (bounds, position)
  - Add IPC communication methods for renderer interaction
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 11.4_

- [x] 2. Create ViewManager for BrowserView lifecycle management





  - Create `src/single-window/ViewManager.js` class
  - Implement `createView(accountId, config)` to create BrowserView with isolated session
  - Implement `showView(accountId)` to attach and display a BrowserView
  - Implement `hideView(accountId)` to detach but keep BrowserView alive
  - Implement `destroyView(accountId)` for cleanup
  - Implement bounds calculation based on sidebar width
  - Maintain view state map (accountId -> ViewState)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 11.1, 11.2_

- [x] 3. Adapt SessionManager for BrowserView sessions





  - Update `src/managers/SessionManager.js` to support BrowserView sessions
  - Ensure `createSession(accountId, config)` creates partition for BrowserView
  - Implement proxy configuration for BrowserView sessions
  - Verify session isolation (cookies, localStorage, IndexedDB)
  - Add session validation and error handling
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 4. Create UI shell for main window





  - Create `src/single-window/renderer/app.html` with sidebar and view-container layout
  - Create `src/single-window/renderer/styles.css` for layout styling
  - Implement responsive two-column layout (sidebar + content area)
  - Add resizable sidebar with drag handle
  - Create placeholder content for empty states
  - _Requirements: 1.2, 11.1, 11.2, 11.3_

---

## Phase 2: Account Management

- [x] 5. Adapt AccountManager for single-window architecture





  - Update `src/managers/AccountConfigManager.js` to include `order` field for sidebar positioning
  - Remove window-specific fields (x, y, width, height) from account config
  - Add validation for new config schema
  - Ensure backward compatibility with existing accounts
  - _Requirements: 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. Build sidebar UI component




  - Create `src/single-window/renderer/sidebar.js` for account list rendering
  - Implement account list rendering from IPC data
  - Add account item template with name, status indicator, and actions
  - Implement account selection handler (send IPC to switch view)
  - Add "Add Account" button with handler
  - Add edit and delete buttons for each account
  - Style account items with hover and active states
  - _Requirements: 2.1, 2.2, 2.4, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 7. Implement account CRUD operations via IPC





  - Create `src/single-window/ipcHandlers.js` for IPC handlers
  - Implement `account:create` handler to create new account
  - Implement `account:update` handler to update account details
  - Implement `account:delete` handler to remove account
  - Implement `account:list` handler to send account list to renderer
  - Implement `account:switch` handler to change active view
  - Add error handling and validation for all operations
  - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

- [x] 8. Create account configuration dialog





  - Create `src/single-window/renderer/accountDialog.html` for account settings
  - Add form fields for name, note, proxy, and translation settings
  - Implement proxy configuration UI (protocol, host, port, auth)
  - Implement translation configuration UI (language, engine, options)
  - Add form validation and error display
  - Implement save and cancel handlers
  - _Requirements: 3.2, 3.3, 8.1, 8.2, 8.3, 8.4, 8.5_

---

## Phase 3: View Management and Switching

- [x] 9. Implement view creation and WhatsApp Web loading





  - In ViewManager, implement WhatsApp Web URL loading in BrowserView
  - Set appropriate User-Agent for WhatsApp Web compatibility
  - Handle initial QR code display for new accounts
  - Implement loading state indicators
  - Add error handling for load failures
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 10. Implement view switching mechanism





  - Implement view switching logic in ViewManager
  - Add transition handling to prevent flicker
  - Update sidebar active state on switch
  - Implement keyboard shortcuts for account switching (Ctrl+1-9)
  - Add visual feedback during switch
  - Ensure hidden views remain connected
  - _Requirements: 5.3, 5.4, 7.1, 7.2, 7.3, 7.4_

- [x] 11. Implement view bounds management




  - Calculate BrowserView bounds based on sidebar width and window size
  - Implement resize handler for window resize events
  - Implement resize handler for sidebar width changes
  - Update all view bounds when layout changes
  - Add debouncing to prevent excessive recalculation
  - _Requirements: 11.1, 11.2, 11.3, 11.5_



- [x] 12. Add view state persistence



  - Save active account ID on switch
  - Persist sidebar width preference
  - Restore active account on app restart
  - Restore sidebar width on app restart
  - _Requirements: 1.4, 10.1, 10.2, 10.3, 11.3_

---

## Phase 4: Session and Proxy Management

- [x] 13. Implement session isolation for BrowserViews





  - Verify each BrowserView uses unique session partition
  - Test cookie isolation between accounts
  - Test localStorage isolation between accounts
  - Test IndexedDB isolation between accounts
  - Add session validation on view creation
  - _Requirements: 4.1, 4.2, 4.3, 4.4_



- [x] 14. Implement proxy configuration per account



  - Implement proxy setup in SessionManager for BrowserView sessions
  - Support HTTP, HTTPS, and SOCKS5 protocols
  - Implement proxy authentication (username/password)
  - Add proxy validation before applying
  - Implement proxy error handling and fallback
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
-

- [x] 15. Implement session persistence and restoration




  - Ensure session data persists in account-specific directories
  - Implement login state detection for BrowserViews
  - Restore login state on app restart
  - Handle session expiration gracefully
  - Add option to clear session data (force logout)
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

---

## Phase 5: Translation Integration
-

- [x] 16. Adapt TranslationService for BrowserView injection




  - Update `src/managers/TranslationIntegration.js` to inject scripts into BrowserViews
  - Inject `window.ACCOUNT_ID` into each BrowserView context
  - Inject translation optimizer script into BrowserViews
  - Inject main translation content script into BrowserViews
  - Handle script injection timing (on page load)
  - _Requirements: 7.1, 7.2_

- [x] 17. Implement per-account translation configuration



  - Store translation config per account in AccountManager
  - Pass account-specific translation config to BrowserView on creation
  - Implement translation config update for active BrowserView
  - Support different target languages per account
  - Support different translation engines per account
  - _Requirements: 7.3, 7.4, 7.5_


- [x] 18. Implement translation request routing




  - Update translation IPC handlers to include accountId
  - Route translation requests to correct account config
  - Maintain separate translation cache per account
  - Handle translation errors per account
  - _Requirements: 7.3, 7.4_

---

## Phase 6: Status Monitoring


- [x] 19. Implement account status monitoring




  - Add status field to account state (online/offline/error)
  - Implement connection status detection for BrowserViews
  - Update sidebar status indicators in real-time
  - Detect WhatsApp Web connection state
  - Handle connection errors and display in sidebar
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
- [x] 20. Implement login status detection




- [ ] 20. Implement login status detection

  - Detect QR code presence (not logged in)
  - Detect chat list presence (logged in)
  - Update account status based on login state
  - Show login prompt in sidebar for logged-out accounts
  - _Requirements: 6.3, 6.4, 10.3_

---

## Phase 7: Migration from Multi-Window Architecture

- [x] 21. Create migration detection and backup




  - Create `src/single-window/migration/MigrationManager.js`
  - Detect existing multi-window configuration on first run
  - Create backup of old configuration file
  - Create backup of old window state data
  - Log migration start and configuration details
  - _Requirements: 12.1, 12.5_

- [x] 22. Implement configuration migration




  - Map old account config format to new format
  - Convert window bounds to sidebar order
  - Preserve session directory paths
  - Preserve proxy configurations
  - Preserve translation configurations
  - Validate migrated data
  - _Requirements: 12.2, 12.3, 12.4_

- [x] 23. Implement session data migration




  - Verify session data directories are accessible
  - Update session paths in new configuration
  - No need to move actual session files (keep in place)
  - Validate session data integrity
  - _Requirements: 12.3_

- [x] 24. Create migration UI and progress feedback




- [ ] 24. Create migration UI and progress feedback
  - Create migration dialog to inform user
  - Show migration progress (accounts migrated)
  - Display migration results (success/failure)
  - Provide option to review migrated accounts
  - Handle migration errors gracefully
  - _Requirements: 12.1, 12.2_

---

## Phase 8: Main Process Integration


- [x] 25. Update main.js to use single-window architecture



  - Replace multi-window initialization with MainWindow
  - Initialize ViewManager with MainWindow reference
  - Remove old InstanceManager initialization
  - Update IPC handler registration for single-window
  - Update cleanup logic for single-window architecture
  - _Requirements: 1.1, 1.5_


- [x] 26. Implement application lifecycle management



  - Handle app ready event to initialize MainWindow
  - Handle window close event to save state
  - Handle app quit event to cleanup resources
  - Implement graceful shutdown for all BrowserViews
  - Save all account states on quit
  - _Requirements: 1.5, 10.1, 10.2_


- [x] 27. Create preload script for main window



  - Create `src/single-window/renderer/preload-main.js`
  - Expose IPC methods for account management
  - Expose IPC methods for view switching
  - Expose IPC methods for status updates
  - Implement secure context bridge
  - _Requirements: 1.3_

---

## Phase 9: Error Handling and Edge Cases

- [x] 28. Implement comprehensive error handling





  - Add try-catch blocks for all async operations
  - Implement error display in sidebar for account-specific errors
  - Add global error handler for uncaught exceptions
  - Log errors to file for debugging
  - Provide user-friendly error messages
  - _Requirements: 9.4_

-

- [x] 29. Handle edge cases and validation



  - Validate account configuration before saving
  - Handle duplicate account names
  - Handle invalid proxy configurations
  - Handle network failures gracefully
  - Handle BrowserView creation failures
  - Prevent switching to non-existent accounts
  - _Requirements: 3.4, 8.5_

- [x] 30. Implement recovery mechanisms




- [ ] 30. Implement recovery mechanisms
  - Add retry logic for transient failures
  - Implement session data recovery for corrupted data
  - Add "Reset Account" option to clear and restart
  - Implement automatic reconnection for network issues
  - _Requirements: 10.5_

---

## Phase 10: Testing and Optimization

- [x] 31. Write unit tests for core components







  - Test AccountManager CRUD operations
  - Test SessionManager session creation and isolation
  - Test ViewManager view lifecycle
  - Test proxy configuration logic
  - Test translation config management
  - _Requirements: All_
- [x] 32. Write integration tests





- [ ] 32. Write integration tests


  - Test account creation to view creation flow
  - Test account switching and state preservation
  - Test translation injection and configuration
  - Test proxy application and isolation
  - Test session persistence and restoration
  - _Requirements: All_

- [x] 33. Optimize performance




- [ ] 33. Optimize performance
  - Implement view lazy loading (create on first access)
  - Add bounds calculation caching
  - Optimize sidebar rendering for many accounts
  - Reduce memory footprint per BrowserView
  - Profile and optimize view switching latency
  - _Requirements: 5.3, 11.2_


- [x] 34. Optimize memory management






  - Implement view pooling for destroyed views
  - Add memory usage monitoring
  - Implement automatic view cleanup for inactive accounts
  - Set memory limits per BrowserView
  - _Requirements: 5.4_

---

## Phase 11: Polish and Documentation


- [x] 35. Enhance UI/UX





  - Add smooth transitions for view switching
  - Implement loading spinners for account operations
  - Add tooltips for sidebar buttons
  - Implement drag-to-reorder accounts in sidebar
  - Add keyboard shortcuts documentation
  - _Requirements: 2.5, 11.1_

- [x] 36. Add user documentation




- [ ] 36. Add user documentation


  - Create user guide for single-window interface
  - Document account management features
  - Document proxy configuration
  - Document translation features
  - Create migration guide for existing users
  - _Requirements: All_

-

- [x] 37. Final testing and bug fixes





  - Perform end-to-end testing of all features
  - Test with 10+ accounts for performance
  - Test migration from old version
  - Fix any remaining bugs
  - Verify all requirements are met
  - _Requirements: All_

---

## Notes

- Tasks marked with `*` are optional and focus on testing
- Each task should be completed and tested before moving to the next
- Integration points between components should be carefully validated
- Performance should be monitored throughout implementation
- User feedback should be incorporated during development
