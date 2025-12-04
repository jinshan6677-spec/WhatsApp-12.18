# Requirements Document

## Introduction

本文档定义了 WhatsApp Desktop 应用从单实例架构升级到本地多实例浏览器隔离架构的需求。该升级将使应用支持同时运行多个 WhatsApp 账号，每个账号在独立的浏览器实例中运行，拥有独立的存储、独立的网络出口和完全隔离的运行环境，同时保持本地高性能渲染和现有翻译功能的完全兼容性。

## Glossary

- **Main Application**: 主 Electron 应用程序，负责管理所有账号实例和提供用户界面
- **Account Instance**: 账号实例，每个 WhatsApp 账号对应的独立浏览器实例
- **Instance Manager**: 实例管理器，负责创建、监控和管理所有账号实例的核心组件
- **User Data Directory**: 用户数据目录，每个账号实例的独立存储目录，包含 Cookie、LocalStorage、IndexedDB 等
- **Proxy Configuration**: 代理配置，为每个账号实例分配的独立网络出口配置
- **Translation System**: 翻译系统，现有的消息翻译功能模块
- **BrowserWindow**: Electron 的浏览器窗口对象，用于创建独立的浏览器实例
- **Process Isolation**: 进程隔离，确保每个账号实例运行在独立的操作系统进程中
- **Session Persistence**: 会话持久化，保存账号登录状态以便下次启动时自动恢复

## Requirements

### Requirement 1

**User Story:** 作为应用管理员，我希望能够在主界面管理多个 WhatsApp 账号，以便集中控制所有账号的运行状态

#### Acceptance Criteria

1. WHEN the Main Application starts, THE Main Application SHALL display an account management interface listing all configured accounts
2. WHEN a user clicks the "Add Account" button, THE Main Application SHALL create a new account configuration with a unique identifier
3. WHEN a user selects an account from the list, THE Main Application SHALL display the account's configuration options including name, proxy settings, and translation preferences
4. WHEN a user clicks the "Delete Account" button for a specific account, THE Main Application SHALL remove the account configuration and its associated User Data Directory
5. THE Main Application SHALL persist all account configurations to disk and restore them on application restart

### Requirement 2

**User Story:** 作为应用用户，我希望每个 WhatsApp 账号在独立的浏览器实例中运行，以便实现完全的进程级隔离和防止账号间相互影响

#### Acceptance Criteria

1. WHEN a user starts an Account Instance, THE Instance Manager SHALL create a new BrowserWindow with a unique User Data Directory
2. THE Instance Manager SHALL ensure each Account Instance runs in a separate operating system process
3. WHEN one Account Instance crashes, THE Instance Manager SHALL prevent the crash from affecting other running Account Instances
4. THE Instance Manager SHALL allocate independent memory space for each Account Instance
5. THE Instance Manager SHALL ensure each Account Instance has an independent JavaScript engine and rendering process

### Requirement 3

**User Story:** 作为应用用户，我希望每个账号拥有独立的存储空间，以便确保账号数据完全隔离且不会相互干扰

#### Acceptance Criteria

1. WHEN creating an Account Instance, THE Instance Manager SHALL assign a unique User Data Directory path in the format `/profiles/account_{uuid}`
2. THE Instance Manager SHALL configure each Account Instance to store Cookies, LocalStorage, IndexedDB, Cache, and Service Workers in its dedicated User Data Directory
3. THE Instance Manager SHALL prevent any data sharing between different Account Instances' User Data Directories
4. WHEN an Account Instance is deleted, THE Instance Manager SHALL remove its associated User Data Directory and all contained data
5. THE Instance Manager SHALL ensure Session Persistence by maintaining login state in each account's User Data Directory

### Requirement 4

**User Story:** 作为应用用户，我希望为每个账号配置独立的网络代理，以便实现 IP 隔离和避免 WhatsApp 的风控检测

#### Acceptance Criteria

1. WHEN configuring an Account Instance, THE Main Application SHALL allow users to specify a unique Proxy Configuration including protocol (SOCKS5/HTTP), host, port, and optional authentication
2. WHEN starting an Account Instance, THE Instance Manager SHALL apply the account's Proxy Configuration to its BrowserWindow session
3. THE Instance Manager SHALL ensure each Account Instance's network traffic routes through its configured proxy independently
4. WHEN a Proxy Configuration is invalid or unreachable, THE Instance Manager SHALL display an error message and prevent the Account Instance from starting
5. THE Main Application SHALL support configuring no proxy for specific accounts to use direct network connection

### Requirement 5

**User Story:** 作为应用用户，我希望所有账号实例在本地渲染，以便获得流畅的用户体验和零延迟的界面响应

#### Acceptance Criteria

1. THE Instance Manager SHALL configure each Account Instance to use local GPU acceleration for rendering
2. THE Instance Manager SHALL ensure all UI animations, scrolling, and interactions are processed by the local system's GPU and CPU
3. WHEN displaying WhatsApp Web content, THE Account Instance SHALL render all elements locally without remote rendering or streaming
4. THE Account Instance SHALL support file drag-and-drop upload with local file system access
5. THE Account Instance SHALL support voice message recording using local audio devices

### Requirement 6

**User Story:** 作为应用用户，我希望现有的翻译功能在多实例架构中继续正常工作，以便在所有账号中使用消息翻译

#### Acceptance Criteria

1. WHEN an Account Instance loads WhatsApp Web, THE Instance Manager SHALL inject the Translation System scripts into the instance's DOM
2. THE Translation System SHALL monitor DOM changes and translate messages in each Account Instance independently
3. THE Translation System SHALL support per-account translation configuration including target language and translation engine
4. THE Translation System SHALL maintain translation cache separately for each Account Instance
5. THE Translation System SHALL provide the same translation features (real-time translation, input box translation, friend-specific settings) in all Account Instances

### Requirement 7

**User Story:** 作为应用用户，我希望能够独立启动、停止和重启每个账号实例，以便灵活管理账号的运行状态

#### Acceptance Criteria

1. WHEN a user clicks the "Start" button for an account, THE Instance Manager SHALL create and launch the corresponding Account Instance
2. WHEN a user clicks the "Stop" button for a running account, THE Instance Manager SHALL gracefully close the Account Instance and save its state
3. WHEN a user clicks the "Restart" button for an account, THE Instance Manager SHALL stop and then start the Account Instance
4. THE Instance Manager SHALL display the current status (stopped, starting, running, error) for each account in the management interface
5. WHEN an Account Instance crashes, THE Instance Manager SHALL update its status to "error" and provide an option to restart

### Requirement 8

**User Story:** 作为应用用户，我希望系统能够监控每个账号实例的运行状态，以便及时发现和处理异常情况

#### Acceptance Criteria

1. THE Instance Manager SHALL monitor each Account Instance's process status and detect crashes or unexpected terminations
2. WHEN an Account Instance becomes unresponsive, THE Instance Manager SHALL detect the condition within 30 seconds
3. THE Instance Manager SHALL log all instance lifecycle events (start, stop, crash, restart) with timestamps
4. THE Instance Manager SHALL provide health check information for each Account Instance including memory usage and CPU usage
5. WHEN an Account Instance crashes repeatedly (more than 3 times within 5 minutes), THE Instance Manager SHALL mark it as "failed" and stop automatic restart attempts

### Requirement 9

**User Story:** 作为应用用户，我希望能够为每个账号配置独立的翻译设置，以便根据不同账号的使用场景定制翻译行为

#### Acceptance Criteria

1. THE Main Application SHALL allow users to configure translation settings per account including enable/disable translation, target language, and translation engine
2. THE Main Application SHALL persist per-account translation settings and restore them when the Account Instance starts
3. WHEN translation settings are changed for an account, THE Main Application SHALL apply the changes to the running Account Instance without requiring restart
4. THE Translation System SHALL use the account-specific translation settings when processing messages in each Account Instance
5. THE Main Application SHALL provide a "Copy Settings" feature to duplicate translation configuration from one account to others

### Requirement 10

**User Story:** 作为应用用户，我希望主界面能够显示所有账号的概览信息，以便快速了解所有账号的状态

#### Acceptance Criteria

1. THE Main Application SHALL display a list view showing all configured accounts with their names, status, and last active time
2. WHEN an Account Instance receives a new message, THE Main Application SHALL display a notification badge on the corresponding account item
3. THE Main Application SHALL update account status indicators in real-time when instances start, stop, or encounter errors
4. THE Main Application SHALL provide a search/filter function to quickly locate specific accounts by name or status
5. THE Main Application SHALL support sorting accounts by name, status, or last active time

### Requirement 11

**User Story:** 作为应用开发者，我希望系统架构支持轻松扩展到支持 30+ 个并发账号，以便满足大规模使用场景

#### Acceptance Criteria

1. THE Instance Manager SHALL support creating and managing at least 30 concurrent Account Instances on a system with 16GB RAM
2. THE Instance Manager SHALL implement resource pooling to optimize memory usage when running multiple instances
3. THE Instance Manager SHALL provide configuration options to limit maximum concurrent instances based on system resources
4. THE Instance Manager SHALL implement lazy loading to start Account Instances on-demand rather than all at startup
5. THE Instance Manager SHALL monitor system resource usage and warn users when approaching resource limits

### Requirement 12

**User Story:** 作为应用用户，我希望账号实例能够自动保存登录状态，以便下次启动时无需重新扫码登录

#### Acceptance Criteria

1. WHEN a user successfully logs into WhatsApp Web in an Account Instance, THE Instance Manager SHALL persist the session data in the account's User Data Directory
2. WHEN starting an Account Instance that has saved session data, THE Instance Manager SHALL restore the session and automatically log in
3. WHEN WhatsApp session expires, THE Account Instance SHALL display the QR code for re-authentication
4. THE Instance Manager SHALL protect session data with appropriate file system permissions
5. THE Main Application SHALL provide an option to manually clear session data for an account to force re-login
