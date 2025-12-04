# Requirements Document

## Introduction

This document specifies the requirements for transforming the current WhatsApp Desktop application from a multi-window, multi-instance architecture to a unified single-window architecture with integrated multi-account management. The new architecture will feature a single main window with a sidebar for account management and a content area that displays independent WebView instances for each WhatsApp account, similar to fingerprint browser applications.

## Glossary

- **Main Window**: The single primary application window that contains both the account management sidebar and the session display area
- **Account Sidebar**: The left panel of the Main Window that displays the list of WhatsApp accounts with their status, notes, and controls
- **Session Area**: The right panel of the Main Window where WhatsApp Web content is displayed via WebViews
- **WebView**: An embedded browser view component that loads WhatsApp Web for a specific account with isolated session data
- **Account Session**: The isolated browser environment (cookies, localStorage, IndexedDB) associated with a specific WhatsApp account
- **Account Manager**: The module responsible for creating, reading, updating, and deleting account configurations
- **Session Manager**: The module responsible for creating and managing isolated browser sessions for each account
- **View Manager**: The module responsible for creating, managing, and switching between WebView instances
- **Translation Service**: The existing translation functionality that will be adapted to work per-account
- **Proxy Configuration**: Network proxy settings that can be independently configured for each account
- **Account ID**: A unique identifier assigned to each WhatsApp account configuration

## Requirements

### Requirement 1: Single Main Window Architecture

**User Story:** As a user, I want to manage all my WhatsApp accounts in a single application window, so that I can avoid window clutter and have a unified interface.

#### Acceptance Criteria

1. WHEN the Application starts, THE Main Window SHALL be created as the sole primary window
2. THE Main Window SHALL contain two distinct areas: Account Sidebar on the left and Session Area on the right
3. THE Main Window SHALL NOT load WhatsApp Web directly but SHALL load a custom UI shell
4. THE Main Window SHALL persist its size and position between application restarts
5. WHEN the Main Window is closed, THE Application SHALL terminate all account sessions and exit

### Requirement 2: Account Management Interface

**User Story:** As a user, I want to view and manage my WhatsApp accounts from a sidebar, so that I can easily switch between accounts and monitor their status.

#### Acceptance Criteria

1. THE Account Sidebar SHALL display a list of all configured WhatsApp accounts
2. WHEN an account is displayed in the sidebar, THE Account Sidebar SHALL show the account name, status indicator, and optional note
3. THE Account Sidebar SHALL provide controls to add new accounts, edit existing accounts, and delete accounts
4. WHEN a user clicks on an account in the sidebar, THE Application SHALL switch the Session Area to display that account's WebView
5. THE Account Sidebar SHALL persist the account list order as configured by the user

### Requirement 3: Account Configuration Management

**User Story:** As a user, I want to configure each WhatsApp account with a name, proxy settings, and notes, so that I can organize and customize my accounts.

#### Acceptance Criteria

1. THE Account Manager SHALL store account configurations in a JSON file at the user data directory
2. WHEN a new account is created, THE Account Manager SHALL assign a unique Account ID
3. THE Account Manager SHALL allow users to specify an account name, proxy configuration, and optional notes
4. THE Account Manager SHALL persist account configurations including session directory path and proxy settings
5. WHEN an account is deleted, THE Account Manager SHALL remove the account configuration but SHALL preserve the session data directory

### Requirement 4: Isolated Account Sessions

**User Story:** As a user, I want each WhatsApp account to have its own isolated browser environment, so that accounts do not interfere with each other and I can maintain separate login states.

#### Acceptance Criteria

1. WHEN an account is created, THE Session Manager SHALL create a unique user data directory for that account
2. THE Session Manager SHALL create an isolated browser session using Electron's partition API with the account's unique identifier
3. THE Account Session SHALL maintain separate cookies, localStorage, IndexedDB, and Service Workers from other accounts
4. THE Account Session SHALL maintain separate cache and browsing data from other accounts
5. WHEN an account's proxy is configured, THE Session Manager SHALL apply the proxy settings only to that account's session

### Requirement 5: WebView Management and Switching

**User Story:** As a user, I want to quickly switch between my WhatsApp accounts without losing connection or having to re-login, so that I can efficiently manage multiple conversations.

#### Acceptance Criteria

1. WHEN an account is first accessed, THE View Manager SHALL create a WebView instance for that account
2. THE View Manager SHALL load WhatsApp Web URL in each account's WebView
3. WHEN a user switches to a different account, THE View Manager SHALL hide the current WebView and display the selected account's WebView
4. THE View Manager SHALL NOT destroy hidden WebViews so that accounts remain connected
5. THE View Manager SHALL maintain a mapping between Account IDs and their corresponding WebView instances

### Requirement 6: WhatsApp Web Integration

**User Story:** As a user, I want each account to load WhatsApp Web and maintain login state, so that I can use WhatsApp functionality without repeated authentication.

#### Acceptance Criteria

1. WHEN a WebView is created for an account, THE WebView SHALL navigate to https://web.whatsapp.com
2. WHEN an account is accessed for the first time, THE WebView SHALL display the WhatsApp QR code for authentication
3. WHEN a user scans the QR code, THE Account Session SHALL store the authentication state
4. WHEN an account is accessed subsequently, THE WebView SHALL restore the logged-in state from the Account Session
5. THE WebView SHALL maintain the WhatsApp Web connection even when hidden from view

### Requirement 7: Per-Account Translation Integration

**User Story:** As a user, I want translation functionality to work independently for each account with separate configurations, so that I can use different translation settings for different accounts.

#### Acceptance Criteria

1. WHEN a WebView loads WhatsApp Web, THE Translation Service SHALL inject translation scripts into that WebView
2. THE Translation Service SHALL inject a unique account identifier into each WebView's window context
3. WHEN translation is requested from a WebView, THE Translation Service SHALL identify the requesting account using the injected identifier
4. THE Translation Service SHALL maintain separate translation configurations for each account
5. THE Translation Service SHALL allow different target languages and translation engines per account

### Requirement 8: Independent Proxy Configuration

**User Story:** As a user, I want to configure different proxy settings for each account, so that I can route different accounts through different network paths for privacy or access requirements.

#### Acceptance Criteria

1. THE Account Manager SHALL allow users to specify proxy configuration including protocol, host, port, and optional authentication
2. THE Session Manager SHALL support HTTP, HTTPS, and SOCKS5 proxy protocols
3. WHEN an account session is created, THE Session Manager SHALL apply the account's proxy configuration to that session only
4. WHEN an account's proxy configuration is updated, THE Session Manager SHALL apply the new proxy settings to the account's session
5. THE Session Manager SHALL validate proxy connectivity before applying proxy settings

### Requirement 9: Account Status Monitoring

**User Story:** As a user, I want to see the connection status of each account in the sidebar, so that I can quickly identify which accounts are online, offline, or have issues.

#### Acceptance Criteria

1. THE Account Sidebar SHALL display a status indicator for each account showing online, offline, or error states
2. WHEN a WebView successfully loads WhatsApp Web, THE Application SHALL update the account status to online
3. WHEN a WebView loses connection, THE Application SHALL update the account status to offline
4. WHEN a WebView encounters an error, THE Application SHALL update the account status to error
5. THE Account Sidebar SHALL update status indicators in real-time as account states change

### Requirement 10: Session Data Persistence

**User Story:** As a user, I want my account login states and data to persist between application restarts, so that I don't have to re-authenticate every time I open the application.

#### Acceptance Criteria

1. WHEN the Application closes, THE Session Manager SHALL preserve all account session data in their respective directories
2. WHEN the Application starts, THE Session Manager SHALL restore account sessions from their persisted data
3. THE Session Manager SHALL maintain separate session directories for each account under a common sessions parent directory
4. WHEN an account is deleted, THE Session Manager SHALL optionally allow users to delete or preserve the session data
5. THE Session Manager SHALL handle session data corruption gracefully by allowing re-authentication

### Requirement 11: UI Responsiveness and Layout

**User Story:** As a user, I want the application interface to be responsive and allow me to resize the sidebar, so that I can customize the layout to my preferences.

#### Acceptance Criteria

1. THE Main Window SHALL allow users to resize the Account Sidebar width within defined minimum and maximum bounds
2. THE Session Area SHALL automatically adjust its width when the Account Sidebar is resized
3. THE Main Window SHALL persist the sidebar width preference between application restarts
4. THE Account Sidebar SHALL display account information clearly even at minimum width
5. THE Session Area SHALL occupy all remaining horizontal space after the Account Sidebar

### Requirement 12: Migration from Multi-Window Architecture

**User Story:** As an existing user, I want my current account configurations and session data to be automatically migrated to the new architecture, so that I don't lose my existing accounts and login states.

#### Acceptance Criteria

1. WHEN the Application starts with the new architecture for the first time, THE Application SHALL detect existing multi-window account configurations
2. THE Application SHALL migrate existing account configurations to the new single-window format
3. THE Application SHALL migrate existing session data directories to the new session structure
4. THE Application SHALL preserve all account settings including names, proxies, and notes during migration
5. WHEN migration is complete, THE Application SHALL create a backup of the old configuration before removing it
