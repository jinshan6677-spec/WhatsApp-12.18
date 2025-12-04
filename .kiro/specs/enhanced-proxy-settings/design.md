# Design Document

## Overview

本设计文档描述了 WhatsApp 多账号管理应用的增强代理设置功能的技术实现方案。该功能在现有的基础代理配置功能之上，增加了代理配置管理、代理服务检测、网络状态检测和智能填写等高级功能，旨在提供更便捷、更智能的代理配置体验。

### Key Features

1. **代理配置管理**：支持保存、选择和管理多个代理配置
2. **代理服务检测**：验证代理服务器的可用性和性能
3. **网络状态检测**：查看当前网络的 IP 地址和位置信息
4. **智能填写**：自动识别和解析粘贴的代理信息
5. **一键生成**：快速保存当前配置到代理列表
6. **配置持久化**：所有配置自动保存，应用重启后仍然可用

### Technology Stack

- **Frontend**: Vanilla JavaScript (现有架构)
- **Backend**: Electron Main Process (Node.js)
- **Storage**: electron-store (现有存储方案)
- **Network Testing**: axios 或 node-fetch (用于代理检测)
- **IP Detection API**: ipapi.co 或 ip-api.com (免费 IP 查询服务)

## Architecture

### Component Structure

```
enhanced-proxy-settings/
├── Frontend (Renderer Process)
│   ├── ProxySettingsPanel (Enhanced)
│   │   ├── UI Components
│   │   ├── Proxy List Dropdown
│   │   ├── Smart Fill Parser
│   │   └── Detection Result Display
│   └── Styles (CSS)
│
├── Backend (Main Process)
│   ├── ProxyConfigManager
│   │   ├── CRUD Operations
│   │   └── Storage Management
│   ├── ProxyDetectionService
│   │   ├── Proxy Connection Test
│   │   └── Network Information Query
│   └── SmartFillParser
│       └── Proxy String Parsing
│
└── Data Models
    ├── ProxyConfig (Enhanced)
    └── ProxyListEntry
```

### Data Flow

1. **Configuration Management Flow**:
   ```
   User Action → ProxySettingsPanel → IPC → ProxyConfigManager → electron-store
   ```

2. **Detection Flow**:
   ```
   User Click → ProxySettingsPanel → IPC → ProxyDetectionService → External API → Result Display
   ```

3. **Smart Fill Flow**:
   ```
   User Paste → SmartFillParser → Parsed Data → Auto-populate Fields
   ```

## Components and Interfaces

### 1. ProxySettingsPanel (Enhanced)

增强现有的 `ProxySettingsPanel` 类，添加新功能。

#### New UI Elements

```javascript
// 代理选择下拉框
<div class="setting-item">
  <label class="setting-title">选择代理</label>
  <div style="display: flex; gap: 8px;">
    <select id="proxySelect" class="setting-select" style="flex: 1;">
      <option value="">选择代理</option>
      <!-- 动态加载代理列表 -->
    </select>
    <button id="refreshProxyList" class="setting-button secondary">
      🔄
    </button>
  </div>
</div>

// 检测按钮
<div class="setting-item">
  <div style="display: flex; gap: 10px;">
    <button id="testProxyBtn" class="setting-button secondary">
      检测代理服务
    </button>
    <button id="testNetworkBtn" class="setting-button secondary">
      检测当前网络
    </button>
  </div>
</div>

// 检测结果显示
<div id="detectionResult" class="detection-result" style="display: none;">
  <!-- 动态显示检测结果 -->
</div>

// 智能填写
<div class="setting-item">
  <label class="setting-title">智能填写</label>
  <textarea id="smartFillInput" class="setting-input" 
            placeholder="粘贴IP信息到此处，自动识别" 
            rows="3"></textarea>
  <p class="setting-desc">支持格式: protocol://host:port, host:port:username:password, protocol://username:password@host:port</p>
</div>

// 一键生成按钮
<button id="generateConfigBtn" class="setting-button primary">
  一键生成结构
</button>
```

#### New Methods

```javascript
class ProxySettingsPanel {
  // 加载代理列表
  async loadProxyList()
  
  // 选择代理配置
  async selectProxy(proxyId)
  
  // 刷新代理列表
  async refreshProxyList()
  
  // 检测代理服务
  async testProxyService()
  
  // 检测当前网络
  async testCurrentNetwork()
  
  // 智能填写解析
  parseSmartFill(text)
  
  // 一键生成配置
  async generateProxyConfig()
  
  // 显示检测结果
  displayDetectionResult(result)
}
```

### 2. ProxyConfigManager (New)

新建代理配置管理器，负责代理配置的 CRUD 操作。

```javascript
class ProxyConfigManager {
  constructor(store)
  
  // 获取所有代理配置
  async getAllProxyConfigs()
  
  // 获取单个代理配置
  async getProxyConfig(id)
  
  // 保存代理配置
  async saveProxyConfig(config)
  
  // 删除代理配置
  async deleteProxyConfig(id)
  
  // 生成配置名称
  generateConfigName(config)
  
  // 验证配置
  validateProxyConfig(config)
}
```

#### Storage Structure

```javascript
{
  "proxyConfigs": {
    "proxy-uuid-1": {
      "id": "proxy-uuid-1",
      "name": "US Proxy - HTTPS",
      "protocol": "https",
      "host": "us-proxy.example.com",
      "port": 1080,
      "username": "user",
      "password": "encrypted-password",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastUsedAt": "2025-01-15T10:30:00.000Z"
    },
    "proxy-uuid-2": {
      // ...
    }
  }
}
```

### 3. ProxyDetectionService (New)

新建代理检测服务，负责测试代理连接和查询网络信息。

```javascript
class ProxyDetectionService {
  constructor()
  
  // 测试代理连接
  async testProxy(proxyConfig)
  
  // 获取当前网络信息
  async getCurrentNetworkInfo()
  
  // 通过代理获取 IP 信息
  async getIPInfoThroughProxy(proxyConfig)
  
  // 解析 IP 信息响应
  parseIPInfo(response)
}
```

#### Detection Result Format

```javascript
{
  "success": true,
  "ip": "203.0.113.1",
  "location": "Can Gio",
  "country": "VN",
  "countryCode": "VN",
  "responseTime": 366, // ms
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### 4. SmartFillParser (New)

新建智能填写解析器，负责解析各种格式的代理信息。

```javascript
class SmartFillParser {
  // 解析代理字符串
  static parse(text)
  
  // 尝试各种格式
  static tryParseFormat1(text) // protocol://host:port
  static tryParseFormat2(text) // host:port:username:password
  static tryParseFormat3(text) // protocol://username:password@host:port
  static tryParseFormat4(text) // JSON format
  
  // 验证解析结果
  static validateParsedData(data)
}
```

#### Supported Formats

1. `protocol://host:port`
   - Example: `socks5://127.0.0.1:1080`

2. `host:port:username:password`
   - Example: `127.0.0.1:1080:user:pass`

3. `protocol://username:password@host:port`
   - Example: `socks5://user:pass@127.0.0.1:1080`

4. JSON format
   ```json
   {
     "protocol": "socks5",
     "host": "127.0.0.1",
     "port": 1080,
     "username": "user",
     "password": "pass"
   }
   ```

### 5. IPC Handlers

新增 IPC 通信接口，连接前端和后端。

```javascript
// Main Process
ipcMain.handle('proxy:get-all-configs', async () => {
  return await proxyConfigManager.getAllProxyConfigs();
});

ipcMain.handle('proxy:save-config', async (event, config) => {
  return await proxyConfigManager.saveProxyConfig(config);
});

ipcMain.handle('proxy:delete-config', async (event, id) => {
  return await proxyConfigManager.deleteProxyConfig(id);
});

ipcMain.handle('proxy:test-service', async (event, config) => {
  return await proxyDetectionService.testProxy(config);
});

ipcMain.handle('proxy:test-network', async () => {
  return await proxyDetectionService.getCurrentNetworkInfo();
});

// Preload Script
contextBridge.exposeInMainWorld('proxyAPI', {
  getAllConfigs: () => ipcRenderer.invoke('proxy:get-all-configs'),
  saveConfig: (config) => ipcRenderer.invoke('proxy:save-config', config),
  deleteConfig: (id) => ipcRenderer.invoke('proxy:delete-config', id),
  testService: (config) => ipcRenderer.invoke('proxy:test-service', config),
  testNetwork: () => ipcRenderer.invoke('proxy:test-network')
});
```

## Data Models

### ProxyConfig (Enhanced)

扩展现有的 ProxyConfig 数据模型。

```javascript
/**
 * @typedef {Object} ProxyConfig
 * @property {boolean} enabled - 是否启用代理
 * @property {'socks5'|'http'|'https'} protocol - 代理协议
 * @property {string} host - 代理服务器地址
 * @property {number} port - 代理服务器端口
 * @property {string} [username] - 代理认证用户名（可选）
 * @property {string} [password] - 代理认证密码（可选）
 * @property {string} [bypass] - 代理绕过规则（可选）
 */
```

### ProxyListEntry (New)

新建代理列表条目数据模型。

```javascript
/**
 * @typedef {Object} ProxyListEntry
 * @property {string} id - 唯一标识符
 * @property {string} name - 配置名称
 * @property {'socks5'|'http'|'https'} protocol - 代理协议
 * @property {string} host - 代理服务器地址
 * @property {number} port - 代理服务器端口
 * @property {string} [username] - 代理认证用户名（可选）
 * @property {string} [password] - 代理认证密码（加密存储）
 * @property {Date} createdAt - 创建时间
 * @property {Date} lastUsedAt - 最后使用时间
 */

class ProxyListEntry {
  constructor(config)
  toJSON()
  static fromJSON(data)
  validate()
}
```

### DetectionResult (New)

新建检测结果数据模型。

```javascript
/**
 * @typedef {Object} DetectionResult
 * @property {boolean} success - 检测是否成功
 * @property {string} [ip] - IP 地址
 * @property {string} [location] - 位置
 * @property {string} [country] - 国家
 * @property {string} [countryCode] - 国家代码
 * @property {number} [responseTime] - 响应时间（毫秒）
 * @property {string} [error] - 错误信息（失败时）
 * @property {Date} timestamp - 检测时间
 */
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. 
Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Proxy state toggle consistency
*For any* proxy configuration, toggling the enabled state should result in the configuration's enabled field being updated to the new state.
**Validates: Requirements 1.1**

### Property 2: Field editability follows proxy state
*For any* proxy configuration UI, when the proxy is disabled, all configuration fields should be non-editable, and when enabled, all fields should be editable.
**Validates: Requirements 1.2, 1.3**

### Property 3: Proxy state persistence
*For any* proxy state change, after persisting and reloading the configuration, the state should match the changed value.
**Validates: Requirements 1.4**

### Property 4: Proxy configuration storage uniqueness
*For any* saved proxy configuration, it should be stored with a unique identifier that doesn't conflict with existing configurations.
**Validates: Requirements 2.1**

### Property 5: Proxy list completeness
*For any* set of saved proxy configurations, opening the dropdown should display all of them.
**Validates: Requirements 2.2**

### Property 6: Proxy selection round trip
*For any* saved proxy configuration, selecting it from the dropdown should populate all fields with values that match the stored configuration.
**Validates: Requirements 2.3**

### Property 7: Proxy list refresh synchronization
*For any* external modification to proxy storage, clicking refresh should update the displayed list to match the storage state.
**Validates: Requirements 2.4**

### Property 8: Active proxy marking
*For any* proxy selection, the selected proxy should be marked as active in the account configuration.
**Validates: Requirements 2.5**

### Property 9: Host validation correctness
*For any* string input, the host validation should accept valid hostnames and IP addresses and reject invalid ones.
**Validates: Requirements 3.2**

### Property 10: Port boundary validation
*For any* numeric input, the port validation should accept values between 1 and 65535 (inclusive) and reject values outside this range.
**Validates: Requirements 3.3**

### Property 11: Configuration field persistence
*For any* proxy configuration with protocol, host, and port values, after saving and reloading, all three values should match the original.
**Validates: Requirements 3.4**

### Property 12: Username validation
*For any* non-empty string, the username field should accept it as valid input.
**Validates: Requirements 4.1**

### Property 13: Password visibility toggle
*For any* password field state, toggling visibility should change the field type between "password" and "text".
**Validates: Requirements 4.3**

### Property 14: Credential encryption
*For any* saved proxy configuration with username and password, the stored values in persistent storage should be encrypted (not plaintext).
**Validates: Requirements 4.4**

### Property 15: Detection result persistence
*For any* completed proxy detection, the result should be stored and remain accessible until the next detection.
**Validates: Requirements 5.5**

### Property 16: Smart fill parsing attempt
*For any* text pasted into the smart fill field, the system should attempt to parse it for proxy information.
**Validates: Requirements 7.1**

### Property 17: Smart fill field population
*For any* valid proxy information in the smart fill field, after parsing, all extractable fields (protocol, host, port, username, password) should be populated with the parsed values.
**Validates: Requirements 7.2**

### Property 18: Smart fill error handling
*For any* invalid or unrecognized text format in the smart fill field, parsing should fail and display an error message.
**Validates: Requirements 7.4**

### Property 19: Smart fill field cleanup
*For any* successful smart fill parsing, the smart fill field should be cleared after populating the configuration fields.
**Validates: Requirements 7.5**

### Property 20: Generate configuration validation
*For any* state of the proxy configuration fields, clicking "一键生成结构" should trigger validation of all required fields.
**Validates: Requirements 8.1**

### Property 21: Configuration creation
*For any* valid set of proxy fields, clicking "一键生成结构" should create a new entry in the proxy list.
**Validates: Requirements 8.2**

### Property 22: Generated configuration naming
*For any* created proxy configuration, it should appear in the proxy list with a generated name.
**Validates: Requirements 8.3**

### Property 23: Apply configuration validation
*For any* state of the proxy configuration fields, clicking "应用" should trigger validation of the configuration.
**Validates: Requirements 9.1**

### Property 24: Configuration application
*For any* valid proxy configuration, clicking "应用" should update the account's proxy settings to match the configuration.
**Validates: Requirements 9.2**

### Property 25: Application failure rollback
*For any* proxy application failure, the system should display an error message and the account's proxy settings should remain unchanged.
**Validates: Requirements 9.5**

### Property 26: Startup configuration loading
*For any* set of saved proxy configurations, after system restart, all configurations should be loaded and available.
**Validates: Requirements 10.1**

### Property 27: Immediate persistence
*For any* proxy configuration addition or modification, the changes should be immediately written to persistent storage.
**Validates: Requirements 10.2**

### Property 28: Deletion persistence
*For any* proxy configuration deletion, the configuration should be immediately removed from persistent storage.
**Validates: Requirements 10.3**

### Property 29: Storage failure state consistency
*For any* storage operation failure, the system should display an error message and the in-memory state should remain consistent with the last successful storage state.
**Validates: Requirements 10.4**



## Error Handling

### Error Categories

1. **Validation Errors**
   - Invalid host format
   - Port out of range
   - Missing required fields
   - Invalid protocol selection

2. **Network Errors**
   - Proxy connection timeout
   - Proxy authentication failure
   - Network unreachable
   - DNS resolution failure

3. **Storage Errors**
   - Failed to save configuration
   - Failed to load configuration
   - Storage quota exceeded
   - Corrupted configuration data

4. **Parsing Errors**
   - Unrecognized smart fill format
   - Invalid JSON format
   - Incomplete proxy information

### Error Handling Strategy

#### Validation Errors

```javascript
// 在用户输入时进行实时验证
validateHost(host) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!host || host.trim().length === 0) {
    return { valid: false, error: '主机地址不能为空' };
  }
  
  if (ipv4Regex.test(host)) {
    // 验证 IP 地址范围
    const parts = host.split('.');
    if (parts.some(part => parseInt(part) > 255)) {
      return { valid: false, error: '无效的 IP 地址' };
    }
    return { valid: true };
  }
  
  if (hostnameRegex.test(host)) {
    return { valid: true };
  }
  
  return { valid: false, error: '无效的主机地址格式' };
}

validatePort(port) {
  const portNum = parseInt(port, 10);
  
  if (isNaN(portNum)) {
    return { valid: false, error: '端口必须是数字' };
  }
  
  if (portNum < 1 || portNum > 65535) {
    return { valid: false, error: '端口范围必须在 1-65535 之间' };
  }
  
  return { valid: true };
}
```

#### Network Errors

```javascript
async testProxy(proxyConfig) {
  try {
    const startTime = Date.now();
    
    // 设置超时时间
    const timeout = 10000; // 10 seconds
    
    const result = await Promise.race([
      this.makeProxyRequest(proxyConfig),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('连接超时')), timeout)
      )
    ]);
    
    const responseTime = Date.now() - startTime;
    
    return {
      success: true,
      ...result,
      responseTime
    };
  } catch (error) {
    return {
      success: false,
      error: this.formatNetworkError(error),
      timestamp: new Date()
    };
  }
}

formatNetworkError(error) {
  if (error.message.includes('timeout')) {
    return '代理服务器连接超时，请检查地址和端口是否正确';
  }
  if (error.message.includes('ECONNREFUSED')) {
    return '代理服务器拒绝连接，请确认服务器正在运行';
  }
  if (error.message.includes('ENOTFOUND')) {
    return '无法解析主机地址，请检查域名是否正确';
  }
  if (error.message.includes('authentication')) {
    return '代理认证失败，请检查用户名和密码';
  }
  return `连接失败: ${error.message}`;
}
```

#### Storage Errors

```javascript
async saveProxyConfig(config) {
  try {
    // 验证配置
    const validation = this.validateProxyConfig(config);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }
    
    // 保存到存储
    const configs = this.store.get('proxyConfigs', {});
    configs[config.id] = config;
    this.store.set('proxyConfigs', configs);
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save proxy config:', error);
    
    // 根据错误类型返回不同的消息
    if (error.message.includes('quota')) {
      return {
        success: false,
        errors: ['存储空间不足，请删除一些旧的配置']
      };
    }
    
    return {
      success: false,
      errors: [`保存失败: ${error.message}`]
    };
  }
}
```

#### Parsing Errors

```javascript
parseSmartFill(text) {
  try {
    // 尝试各种格式
    const formats = [
      this.tryParseFormat1,
      this.tryParseFormat2,
      this.tryParseFormat3,
      this.tryParseFormat4
    ];
    
    for (const format of formats) {
      const result = format.call(this, text);
      if (result.success) {
        return result;
      }
    }
    
    // 所有格式都失败
    return {
      success: false,
      error: '无法识别的代理信息格式。支持的格式:\n' +
             '- protocol://host:port\n' +
             '- host:port:username:password\n' +
             '- protocol://username:password@host:port\n' +
             '- JSON 格式'
    };
  } catch (error) {
    return {
      success: false,
      error: `解析失败: ${error.message}`
    };
  }
}
```

### User Feedback

所有错误都应该通过 UI 清晰地展示给用户：

```javascript
showError(message) {
  const errorEl = document.createElement('div');
  errorEl.className = 'settings-message error';
  errorEl.textContent = message;
  this.panel.appendChild(errorEl);
  
  // 3 秒后自动消失
  setTimeout(() => errorEl.remove(), 3000);
}

showSuccess(message) {
  const successEl = document.createElement('div');
  successEl.className = 'settings-message success';
  successEl.textContent = message;
  this.panel.appendChild(successEl);
  
  setTimeout(() => successEl.remove(), 3000);
}
```

## Testing Strategy

### Unit Testing

使用 Jest 作为测试框架，对各个组件进行单元测试。

#### ProxyConfigManager Tests

```javascript
describe('ProxyConfigManager', () => {
  test('should save and retrieve proxy configuration', async () => {
    const config = {
      id: 'test-1',
      name: 'Test Proxy',
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 1080
    };
    
    await manager.saveProxyConfig(config);
    const retrieved = await manager.getProxyConfig('test-1');
    
    expect(retrieved).toEqual(config);
  });
  
  test('should validate proxy configuration', () => {
    const invalidConfig = {
      protocol: 'invalid',
      host: '',
      port: 99999
    };
    
    const validation = manager.validateProxyConfig(invalidConfig);
    expect(validation.valid).toBe(false);
  });
});
```

#### SmartFillParser Tests

```javascript
describe('SmartFillParser', () => {
  test('should parse protocol://host:port format', () => {
    const result = SmartFillParser.parse('socks5://127.0.0.1:1080');
    
    expect(result.success).toBe(true);
    expect(result.data.protocol).toBe('socks5');
    expect(result.data.host).toBe('127.0.0.1');
    expect(result.data.port).toBe(1080);
  });
  
  test('should parse host:port:username:password format', () => {
    const result = SmartFillParser.parse('127.0.0.1:1080:user:pass');
    
    expect(result.success).toBe(true);
    expect(result.data.host).toBe('127.0.0.1');
    expect(result.data.username).toBe('user');
  });
});
```

#### ProxyDetectionService Tests

```javascript
describe('ProxyDetectionService', () => {
  test('should detect proxy connection', async () => {
    const config = {
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 1080
    };
    
    const result = await service.testProxy(config);
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('timestamp');
  });
  
  test('should handle connection timeout', async () => {
    const config = {
      protocol: 'socks5',
      host: '192.0.2.1', // TEST-NET-1, should timeout
      port: 1080
    };
    
    const result = await service.testProxy(config);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('超时');
  });
});
```

### Property-Based Testing

使用 fast-check 库进行属性测试，验证系统在各种输入下的正确性。

#### Configuration

```javascript
const fc = require('fast-check');

// 配置每个属性测试运行 100 次
const testConfig = { numRuns: 100 };
```

#### Property Tests

每个属性测试必须使用注释标记对应的设计文档中的属性：

```javascript
describe('Property-Based Tests', () => {
  test('Property 1: Proxy state toggle consistency', () => {
    // **Feature: enhanced-proxy-settings, Property 1: Proxy state toggle consistency**
    fc.assert(
      fc.property(
        fc.record({
          enabled: fc.boolean(),
          protocol: fc.constantFrom('socks5', 'http', 'https'),
          host: fc.string(),
          port: fc.integer({ min: 1, max: 65535 })
        }),
        (config) => {
          const newState = !config.enabled;
          config.enabled = newState;
          expect(config.enabled).toBe(newState);
        }
      ),
      testConfig
    );
  });
  
  test('Property 6: Proxy selection round trip', () => {
    // **Feature: enhanced-proxy-settings, Property 6: Proxy selection round trip**
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1 }),
          protocol: fc.constantFrom('socks5', 'http', 'https'),
          host: fc.domain(),
          port: fc.integer({ min: 1, max: 65535 }),
          username: fc.option(fc.string()),
          password: fc.option(fc.string())
        }),
        async (config) => {
          await manager.saveProxyConfig(config);
          const retrieved = await manager.getProxyConfig(config.id);
          
          expect(retrieved.protocol).toBe(config.protocol);
          expect(retrieved.host).toBe(config.host);
          expect(retrieved.port).toBe(config.port);
        }
      ),
      testConfig
    );
  });
  
  test('Property 10: Port boundary validation', () => {
    // **Feature: enhanced-proxy-settings, Property 10: Port boundary validation**
    fc.assert(
      fc.property(
        fc.integer(),
        (port) => {
          const validation = validatePort(port);
          const isValid = port >= 1 && port <= 65535;
          expect(validation.valid).toBe(isValid);
        }
      ),
      testConfig
    );
  });
  
  test('Property 17: Smart fill field population', () => {
    // **Feature: enhanced-proxy-settings, Property 17: Smart fill field population**
    fc.assert(
      fc.property(
        fc.record({
          protocol: fc.constantFrom('socks5', 'http', 'https'),
          host: fc.domain(),
          port: fc.integer({ min: 1, max: 65535 })
        }),
        (config) => {
          const text = `${config.protocol}://${config.host}:${config.port}`;
          const result = SmartFillParser.parse(text);
          
          expect(result.success).toBe(true);
          expect(result.data.protocol).toBe(config.protocol);
          expect(result.data.host).toBe(config.host);
          expect(result.data.port).toBe(config.port);
        }
      ),
      testConfig
    );
  });
});
```

### Integration Testing

测试各组件之间的集成，确保整个流程正常工作。

```javascript
describe('Integration Tests', () => {
  test('should complete full proxy configuration workflow', async () => {
    // 1. 创建代理配置
    const config = {
      name: 'Test Proxy',
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 1080,
      username: 'user',
      password: 'pass'
    };
    
    const saveResult = await manager.saveProxyConfig(config);
    expect(saveResult.success).toBe(true);
    
    // 2. 加载代理列表
    const configs = await manager.getAllProxyConfigs();
    expect(configs.length).toBeGreaterThan(0);
    
    // 3. 选择代理
    const selected = configs[0];
    
    // 4. 应用到账号
    const account = await accountManager.getAccount('test-account');
    account.proxy = selected;
    await accountManager.updateAccount('test-account', account);
    
    // 5. 验证应用成功
    const updated = await accountManager.getAccount('test-account');
    expect(updated.proxy.host).toBe(config.host);
  });
});
```

### Manual Testing Checklist

- [ ] 启用/禁用代理开关
- [ ] 选择不同的代理协议
- [ ] 输入有效和无效的主机地址
- [ ] 输入边界值端口号（0, 1, 65535, 65536）
- [ ] 启用/禁用身份验证
- [ ] 保存代理配置到列表
- [ ] 从列表选择代理配置
- [ ] 刷新代理列表
- [ ] 检测代理服务（成功和失败情况）
- [ ] 检测当前网络
- [ ] 智能填写各种格式的代理信息
- [ ] 一键生成配置
- [ ] 应用配置到账号
- [ ] 重启应用后验证配置持久化

## Implementation Notes

### Security Considerations

1. **密码加密**：使用 Node.js 的 `crypto` 模块加密存储密码
   ```javascript
   const crypto = require('crypto');
   
   function encryptPassword(password, key) {
     const iv = crypto.randomBytes(16);
     const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
     let encrypted = cipher.update(password, 'utf8', 'hex');
     encrypted += cipher.final('hex');
     return iv.toString('hex') + ':' + encrypted;
   }
   
   function decryptPassword(encrypted, key) {
     const parts = encrypted.split(':');
     const iv = Buffer.from(parts[0], 'hex');
     const encryptedText = parts[1];
     const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
     let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
     decrypted += decipher.final('utf8');
     return decrypted;
   }
   ```

2. **输入验证**：所有用户输入都必须经过验证和清理

3. **错误信息**：不要在错误信息中泄露敏感信息

### Performance Considerations

1. **代理列表缓存**：在内存中缓存代理列表，减少磁盘读取

2. **检测超时**：设置合理的超时时间（10 秒），避免长时间等待

3. **异步操作**：所有网络操作都应该是异步的，不阻塞 UI

4. **防抖动**：对于实时验证，使用防抖动技术减少验证次数

### Backward Compatibility

1. **配置迁移**：如果现有账号有代理配置，应该自动迁移到新的存储结构

2. **默认值**：为新字段提供合理的默认值

3. **版本标记**：在配置中添加版本号，便于未来升级

### Future Enhancements

1. **代理测速**：显示代理的延迟和速度

2. **代理轮换**：支持自动切换代理

3. **代理分组**：按地区或用途对代理进行分组

4. **批量导入**：支持从文件批量导入代理配置

5. **代理健康检查**：定期检查代理可用性

6. **代理使用统计**：记录每个代理的使用次数和成功率
