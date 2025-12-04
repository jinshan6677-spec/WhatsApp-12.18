# Requirements Document

## Introduction

本文档定义了 WhatsApp 多账号管理应用的增强代理设置功能。该功能旨在为用户提供更便捷、更智能的代理配置体验，包括代理配置的保存与选择、代理服务检测、网络状态检测以及智能填写等功能。通过这些增强功能，用户可以更高效地管理多个代理配置，快速验证代理可用性，并通过智能识别简化配置流程。

## Glossary

- **System**: WhatsApp 多账号管理应用
- **User**: 使用该应用的最终用户
- **Proxy Configuration**: 代理配置，包括协议、主机、端口、用户名、密码等信息
- **Proxy Service**: 代理服务器，用于转发网络请求
- **Network Detection**: 网络检测，用于验证当前网络状态和 IP 地址
- **Smart Fill**: 智能填写，自动识别并解析粘贴的代理信息
- **Account**: 账号，指 WhatsApp 账号实例
- **Proxy List**: 代理列表，存储的多个代理配置

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望能够启用或禁用代理功能，以便根据需要控制是否使用代理连接。

#### Acceptance Criteria

1. WHEN the user toggles the proxy enable switch THEN the System SHALL enable or disable the proxy functionality accordingly
2. WHEN the proxy is disabled THEN the System SHALL prevent the user from editing proxy configuration fields
3. WHEN the proxy is enabled THEN the System SHALL allow the user to access and edit all proxy configuration fields
4. WHEN the proxy state changes THEN the System SHALL persist the new state to the account configuration

### Requirement 2

**User Story:** 作为用户，我希望能够保存多个代理配置并从列表中选择，以便快速切换不同的代理服务器。

#### Acceptance Criteria

1. WHEN the user saves a proxy configuration THEN the System SHALL store the configuration in the Proxy List with a unique identifier
2. WHEN the user opens the proxy selection dropdown THEN the System SHALL display all saved proxy configurations
3. WHEN the user selects a proxy from the dropdown THEN the System SHALL populate all proxy fields with the selected configuration
4. WHEN the user clicks the refresh button THEN the System SHALL reload the Proxy List from storage
5. WHEN a proxy configuration is selected THEN the System SHALL mark it as the active configuration for the current Account

### Requirement 3

**User Story:** 作为用户，我希望能够配置代理的协议类型、主机地址和端口，以便连接到不同类型的代理服务器。

#### Acceptance Criteria

1. WHEN the user selects a protocol from the dropdown THEN the System SHALL accept HTTP or HTTPS as valid options
2. WHEN the user enters a host address THEN the System SHALL validate the format as a valid hostname or IP address
3. WHEN the user enters a port number THEN the System SHALL validate it as a number between 1 and 65535
4. WHEN the user saves the configuration THEN the System SHALL store the protocol, host, and port values

### Requirement 4

**User Story:** 作为用户，我希望能够为需要认证的代理服务器配置用户名和密码，以便通过认证访问代理服务。

#### Acceptance Criteria

1. WHEN the user enters a username THEN the System SHALL accept any non-empty string as valid input
2. WHEN the user enters a password THEN the System SHALL mask the password characters by default
3. WHEN the user toggles password visibility THEN the System SHALL show or hide the password characters
4. WHEN the user saves the configuration THEN the System SHALL encrypt and store the username and password securely

### Requirement 5

**User Story:** 作为用户，我希望能够检测代理服务是否可用，以便在使用前验证代理配置的正确性。

#### Acceptance Criteria

1. WHEN the user clicks the "检测代理服务" button THEN the System SHALL attempt to connect to the configured proxy server
2. WHEN the proxy connection succeeds THEN the System SHALL display the proxy IP address, location, country code, and response time
3. WHEN the proxy connection fails THEN the System SHALL display an error message indicating the failure reason
4. WHEN the detection is in progress THEN the System SHALL display a loading indicator
5. WHEN the detection completes THEN the System SHALL persist the detection result for display

### Requirement 6

**User Story:** 作为用户，我希望能够检测当前网络状态，以便了解当前的 IP 地址和网络连接情况。

#### Acceptance Criteria

1. WHEN the user clicks the "检测当前网络" button THEN the System SHALL query the current network information
2. WHEN the network detection succeeds THEN the System SHALL display the current IP address, location, country code, and response time
3. WHEN the network detection fails THEN the System SHALL display an error message
4. WHEN the detection is in progress THEN the System SHALL display a loading indicator

### Requirement 7

**User Story:** 作为用户，我希望能够通过智能填写功能快速配置代理，以便节省手动输入的时间。

#### Acceptance Criteria

1. WHEN the user pastes text into the smart fill field THEN the System SHALL attempt to parse the text for proxy information
2. WHEN the pasted text contains valid proxy information THEN the System SHALL automatically populate the protocol, host, port, username, and password fields
3. WHEN the pasted text format is recognized THEN the System SHALL support common formats including "protocol://host:port", "host:port:username:password", and "protocol://username:password@host:port"
4. WHEN the parsing fails THEN the System SHALL display an error message indicating the text format is not recognized
5. WHEN the parsing succeeds THEN the System SHALL clear the smart fill field

### Requirement 8

**User Story:** 作为用户，我希望能够一键生成代理配置，以便快速保存当前填写的代理信息。

#### Acceptance Criteria

1. WHEN the user clicks the "一键生成结构" button THEN the System SHALL validate all required proxy fields
2. WHEN all required fields are valid THEN the System SHALL create a new proxy configuration entry
3. WHEN the configuration is created THEN the System SHALL add it to the Proxy List with a generated name
4. WHEN the configuration is created THEN the System SHALL display a success message

### Requirement 9

**User Story:** 作为用户，我希望能够应用代理配置到当前账号，以便使该账号使用配置的代理连接。

#### Acceptance Criteria

1. WHEN the user clicks the "应用" button THEN the System SHALL validate the current proxy configuration
2. WHEN the configuration is valid THEN the System SHALL apply the proxy settings to the current Account
3. WHEN the proxy is applied THEN the System SHALL restart the Account's network connection with the new proxy settings
4. WHEN the application succeeds THEN the System SHALL display a success message
5. WHEN the application fails THEN the System SHALL display an error message and maintain the previous proxy settings

### Requirement 10

**User Story:** 作为用户，我希望代理配置能够持久化存储，以便在应用重启后仍然可用。

#### Acceptance Criteria

1. WHEN the System starts THEN the System SHALL load all saved proxy configurations from persistent storage
2. WHEN a proxy configuration is added or modified THEN the System SHALL immediately save the changes to persistent storage
3. WHEN a proxy configuration is deleted THEN the System SHALL remove it from persistent storage
4. WHEN storage operations fail THEN the System SHALL display an error message and maintain the in-memory state
