# Requirements Document

## Introduction

本文档定义了WhatsApp桌面客户端架构重构的需求规范。重构目标是提升代码的可维护性、功能扩展性和系统稳定性，为后续需求文档中定义的功能（如指纹设置、客户画像、快捷回复、群发消息、Web管理后台等）提供坚实的架构基础。

当前项目已有基础架构（依赖注入容器、模块化设计），但存在以下问题需要解决：
- 部分模块职责不清晰，耦合度较高
- 缺乏统一的插件/扩展机制
- 数据层与业务层混合
- 缺少完善的事件总线系统
- 配置管理分散

## Glossary

- **System**: WhatsApp桌面客户端应用程序
- **Module**: 具有独立职责的代码单元，可独立加载和卸载
- **Plugin**: 可热插拔的功能扩展单元
- **EventBus**: 事件总线，用于模块间解耦通信
- **Repository**: 数据访问层，负责数据持久化操作
- **Service**: 业务逻辑层，处理核心业务规则
- **Manager**: 管理器，协调多个服务完成复杂业务流程
- **DTO**: 数据传输对象，用于层间数据传递
- **DependencyContainer**: 依赖注入容器，管理服务实例的创建和生命周期
- **ConfigProvider**: 配置提供者，统一管理应用配置

## Requirements

### Requirement 1: 分层架构重构

**User Story:** As a developer, I want a clear layered architecture, so that I can easily understand, maintain and extend the codebase.

#### Acceptance Criteria

1. THE System SHALL organize code into four distinct layers: Presentation Layer, Application Layer, Domain Layer, and Infrastructure Layer
2. WHEN a component in one layer needs to communicate with another layer THEN the System SHALL use defined interfaces rather than direct implementation references
3. THE System SHALL enforce unidirectional dependency flow where upper layers depend on lower layers but not vice versa
4. WHEN adding new business logic THEN the System SHALL place it in the Domain Layer without modifying the Infrastructure Layer
5. THE System SHALL provide a pretty printer for configuration objects to enable round-trip testing of configuration serialization

### Requirement 2: 模块化插件系统

**User Story:** As a developer, I want a plugin system, so that I can add new features without modifying core code.

#### Acceptance Criteria

1. THE System SHALL provide a PluginManager that handles plugin registration, initialization, and lifecycle management
2. WHEN a plugin is registered THEN the System SHALL validate the plugin interface compliance before activation
3. WHEN the application starts THEN the System SHALL load and initialize all enabled plugins in dependency order
4. WHEN a plugin throws an error during initialization THEN the System SHALL log the error and continue loading other plugins without crashing
5. THE System SHALL provide hooks for plugins to extend UI, add IPC handlers, and register services
6. WHEN a plugin is disabled THEN the System SHALL unload the plugin and release its resources gracefully

### Requirement 3: 事件总线系统

**User Story:** As a developer, I want an event bus system, so that modules can communicate without direct dependencies.

#### Acceptance Criteria

1. THE System SHALL provide a centralized EventBus for publish-subscribe communication between modules
2. WHEN an event is published THEN the System SHALL deliver it to all registered subscribers asynchronously
3. THE System SHALL support typed events with payload validation
4. WHEN a subscriber throws an error THEN the System SHALL catch the error, log it, and continue notifying other subscribers
5. THE System SHALL provide event history for debugging purposes with configurable retention period
6. WHEN subscribing to an event THEN the System SHALL return an unsubscribe function for cleanup

### Requirement 4: 数据访问层重构

**User Story:** As a developer, I want a clean data access layer, so that I can change storage implementations without affecting business logic.

#### Acceptance Criteria

1. THE System SHALL define Repository interfaces for all data entities (Account, Proxy, Translation, Customer)
2. WHEN accessing data THEN the System SHALL use Repository interfaces rather than direct storage access
3. THE System SHALL implement a Unit of Work pattern for transactional operations across multiple repositories
4. WHEN data validation fails THEN the System SHALL return structured error objects with field-level details
5. THE System SHALL support data migration between schema versions with rollback capability
6. THE System SHALL provide a pretty printer for all data models to enable round-trip serialization testing

### Requirement 5: 配置管理统一化

**User Story:** As a developer, I want unified configuration management, so that I can easily manage and validate application settings.

#### Acceptance Criteria

1. THE System SHALL provide a centralized ConfigProvider that manages all application configurations
2. WHEN configuration is loaded THEN the System SHALL validate it against a defined schema
3. THE System SHALL support configuration inheritance with environment-specific overrides
4. WHEN configuration changes at runtime THEN the System SHALL notify all registered listeners
5. THE System SHALL encrypt sensitive configuration values (API keys, passwords) at rest
6. WHEN parsing configuration files THEN the System SHALL validate against the configuration grammar and support round-trip serialization

### Requirement 6: 错误处理标准化

**User Story:** As a developer, I want standardized error handling, so that errors are consistently handled and reported across the application.

#### Acceptance Criteria

1. THE System SHALL define a hierarchy of error types (ValidationError, NetworkError, StorageError, PluginError)
2. WHEN an error occurs THEN the System SHALL wrap it in a standardized error object with context information
3. THE System SHALL provide error recovery strategies for recoverable errors
4. WHEN a critical error occurs THEN the System SHALL save application state before shutdown
5. THE System SHALL log all errors with structured metadata for debugging
6. WHEN displaying errors to users THEN the System SHALL show localized, user-friendly messages

### Requirement 7: 服务注册与发现

**User Story:** As a developer, I want improved dependency injection, so that services can be easily registered, discovered and replaced.

#### Acceptance Criteria

1. THE System SHALL enhance the DependencyContainer to support service scopes (singleton, transient, scoped)
2. WHEN resolving a service THEN the System SHALL check for circular dependencies and throw a descriptive error
3. THE System SHALL support lazy service initialization to improve startup performance
4. WHEN a service is not found THEN the System SHALL provide a clear error message with available alternatives
5. THE System SHALL support service decoration for cross-cutting concerns (logging, caching, retry)
6. WHEN registering services THEN the System SHALL validate interface compliance at registration time

### Requirement 8: IPC通信重构

**User Story:** As a developer, I want a structured IPC communication layer, so that main process and renderer process can communicate reliably.

#### Acceptance Criteria

1. THE System SHALL define typed IPC channels with request/response schemas
2. WHEN an IPC request is made THEN the System SHALL validate the request payload before processing
3. THE System SHALL implement request timeout handling with configurable timeout values
4. WHEN an IPC handler throws an error THEN the System SHALL return a structured error response to the caller
5. THE System SHALL support IPC request batching for performance optimization
6. THE System SHALL provide IPC channel documentation generated from type definitions

### Requirement 9: 状态管理优化

**User Story:** As a developer, I want centralized state management, so that application state is predictable and debuggable.

#### Acceptance Criteria

1. THE System SHALL provide a StateManager for centralized application state management
2. WHEN state changes THEN the System SHALL notify all registered observers with the changed state slice
3. THE System SHALL support state persistence with configurable storage backends
4. WHEN restoring state THEN the System SHALL validate state integrity and handle corruption gracefully
5. THE System SHALL provide state snapshots for debugging and time-travel debugging support
6. THE System SHALL serialize and deserialize state with round-trip consistency

### Requirement 10: 测试基础设施

**User Story:** As a developer, I want comprehensive testing infrastructure, so that I can write and run tests efficiently.

#### Acceptance Criteria

1. THE System SHALL provide mock implementations for all external dependencies (Electron APIs, network, storage)
2. WHEN running tests THEN the System SHALL isolate test environments to prevent cross-test contamination
3. THE System SHALL support property-based testing for data validation and transformation logic
4. WHEN a test fails THEN the System SHALL provide detailed failure context including input data and expected vs actual results
5. THE System SHALL generate test coverage reports with branch coverage metrics
6. THE System SHALL provide test fixtures and factories for common test data generation


### Requirement 11: 翻译功能模块化

**User Story:** As a developer, I want the translation feature to be modular and extensible, so that I can easily add new translation engines and customize translation behavior.

#### Acceptance Criteria

1. THE System SHALL define a standard ITranslationAdapter interface that all translation engines implement
2. WHEN a new translation engine is added THEN the System SHALL only require implementing the adapter interface without modifying core code
3. THE System SHALL support both message translation (chat window) and input translation (before sending) with independent configurations
4. WHEN translating input text THEN the System SHALL apply the selected translation style (11 styles available)
5. THE System SHALL support friend-specific translation configurations that override account-level settings
6. THE System SHALL provide a pretty printer for translation configurations to enable round-trip serialization testing

### Requirement 12: 代理功能完全重写（IP安全防护）

**User Story:** As a user, I want a secure proxy system that guarantees my real IP is never exposed, so that my WhatsApp accounts are protected from being banned due to IP leakage.

#### Acceptance Criteria

1. THE System SHALL define a ProxyConfig entity with validation for all proxy types (HTTP, HTTPS, SOCKS5)
2. WHEN a proxy configuration is invalid THEN the System SHALL return detailed validation errors with field-level information
3. THE System SHALL provide proxy connectivity testing with latency measurement and IP detection
4. WHEN parsing proxy strings THEN the System SHALL support multiple formats (host:port, protocol://host:port, with authentication)
5. THE System SHALL implement smart fill parsing that auto-detects proxy information from pasted text
6. THE System SHALL provide a pretty printer for proxy configurations to enable round-trip serialization testing

### Requirement 12.1: 代理连接失败处理（禁止回退直连）

**User Story:** As a user, I want the system to never fall back to direct connection when proxy fails, so that my real IP is never exposed to WhatsApp servers.

#### Acceptance Criteria

1. WHEN proxy connection fails THEN the System SHALL block all network requests rather than falling back to direct connection
2. WHEN proxy connection fails THEN the System SHALL display a clear error message indicating proxy failure
3. WHEN proxy connection fails THEN the System SHALL provide retry options without exposing real IP
4. THE System SHALL implement a proxy-only network policy that prevents any direct connections
5. WHEN BrowserView is created THEN the System SHALL verify proxy is active before allowing any network requests
6. IF proxy becomes unavailable during session THEN the System SHALL immediately suspend all network activity

### Requirement 12.2: IP泄露防护（100%防护）

**User Story:** As a user, I want 100% guarantee that my real IP will never be leaked, so that I can safely use multiple WhatsApp accounts without risk of being banned.

#### Acceptance Criteria

1. THE System SHALL disable WebRTC to prevent IP leakage through STUN/TURN servers
2. THE System SHALL block all DNS requests that bypass the proxy (DNS leak prevention)
3. THE System SHALL verify the exit IP matches expected proxy IP before allowing WhatsApp connection
4. WHEN creating a BrowserView THEN the System SHALL inject IP protection scripts before any page loads
5. THE System SHALL implement a kill-switch that terminates the session if proxy connection is lost
6. THE System SHALL log all network requests to audit for potential IP leaks
7. THE System SHALL block WebSocket connections that attempt to bypass proxy
8. THE System SHALL disable browser features that could leak IP (navigator.connection, etc.)

### Requirement 12.3: 代理健康监控

**User Story:** As a user, I want continuous proxy health monitoring, so that I am immediately notified if my proxy becomes unstable or fails.

#### Acceptance Criteria

1. THE System SHALL perform periodic proxy health checks (configurable interval, default 30 seconds)
2. WHEN proxy health check fails THEN the System SHALL immediately notify the user
3. THE System SHALL track proxy latency and warn when latency exceeds threshold
4. WHEN proxy is detected as unstable THEN the System SHALL recommend switching to a backup proxy
5. THE System SHALL maintain proxy connection statistics (uptime, average latency, failure count)
6. WHEN multiple consecutive health checks fail THEN the System SHALL automatically suspend the account session

### Requirement 13: 大文件拆分重构

**User Story:** As a developer, I want large files to be split into smaller, focused modules, so that the codebase is easier to maintain and understand.

#### Acceptance Criteria

1. THE System SHALL split ViewManager.js (4096 lines) into modules under 500 lines each
2. THE System SHALL split ipcHandlers.js (1933 lines) into domain-specific handler modules
3. THE System SHALL split contentScript.js (3990 lines) into focused functional modules
4. THE System SHALL split SessionManager.js (1408 lines) into responsibility-based modules
5. THE System SHALL split InstanceManager.js (1402 lines) into responsibility-based modules
6. WHEN splitting files THEN the System SHALL maintain backward compatibility with existing APIs
