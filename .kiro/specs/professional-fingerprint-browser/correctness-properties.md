# Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. 
Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

## 1. 代理中继服务属性

### Property 1: 端口唯一性
*For any* 两个同时运行的账号，它们分配的本地代理端口必须不同
**Validates: Requirements 1.1**

### Property 2: 端口范围约束
*For any* 账号启动时分配的本地端口，该端口必须在 10000-60000 范围内
**Validates: Requirements 1.1**

### Property 3: 代理服务器可连接性
*For any* 成功启动的代理中继服务，尝试连接其本地端口必须成功
**Validates: Requirements 1.2**

### Property 4: 流量转发正确性
*For any* 通过本地代理中继发送的请求，该请求必须通过配置的远程代理
**Validates: Requirements 1.3**

### Property 5: 资源清理完整性
*For any* 账号关闭后，其占用的本地端口必须被释放（可以被其他进程绑定）
**Validates: Requirements 1.4**

### Property 6: 端口冲突自动重试
*For any* 端口分配冲突的情况，系统必须自动尝试下一个端口，最多尝试 10 次
**Validates: Requirements 1.5**

### Property 7: Chromium 代理参数正确性
*For any* 创建的 Chromium 实例，其启动参数必须包含 `--proxy-server=socks5://127.0.0.1:分配的端口`
**Validates: Requirements 1.6**

## 2. 代理配置管理属性

### Property 8: 代理测试结果准确性
*For any* 有效的代理配置，测试结果必须返回成功、响应时间和出口 IP
**Validates: Requirements 2.3**

### Property 9: 出口 IP 一致性
*For any* 启用代理的账号，检测到的出口 IP 必须与代理配置的 IP 一致
**Validates: Requirements 2.4**

### Property 10: 智能填写解析正确性
*For any* 符合 `socks5://user:pass@host:port` 格式的字符串，解析后的字段必须与原始值匹配
**Validates: Requirements 2.5, 17.1**

### Property 11: 智能填写格式兼容性
*For any* 符合 `host:port:user:pass` 或 `host:port` 格式的字符串，系统必须正确解析并填充字段
**Validates: Requirements 17.2, 17.3**

## 3. 浏览器指纹属性

### Property 12: User-Agent 生成正确性
*For any* 选择的浏览器版本和操作系统组合，生成的 User-Agent 必须符合该组合的标准格式
**Validates: Requirements 3.2, 3.3**

### Property 13: User-Agent 随机生成有效性
*For any* 随机生成的 User-Agent，必须是有效的格式且包含合理的浏览器和操作系统信息
**Validates: Requirements 3.4**

### Property 14: User-Agent 应用正确性
*For any* 配置的 User-Agent，在页面中查询 `navigator.userAgent` 必须返回配置的值
**Validates: Requirements 3.6**

### Property 15: WebGL 参数覆盖正确性
*For any* 配置的 WebGL 厂商和渲染器，在页面中查询 `getParameter(VENDOR)` 和 `getParameter(RENDERER)` 必须返回配置的值
**Validates: Requirements 4.2, 4.6**

### Property 16: WebRTC 禁用完整性
*For any* WebRTC 模式设置为"禁用"的账号，页面中的 `RTCPeerConnection` 必须为 undefined
**Validates: Requirements 5.1**

### Property 17: Canvas 随机化不可预测性
*For any* Canvas 模式设置为"随机"的账号，多次调用 `toDataURL()` 必须返回不同的结果
**Validates: Requirements 6.1**

### Property 18: Audio 随机化不可预测性
*For any* Audio 模式设置为"随机"的账号，多次调用 `AudioContext.createOscillator()` 的输出必须不同
**Validates: Requirements 6.3**

## 4. 环境属性配置属性

### Property 19: 时区配置正确性
*For any* 配置的时区，在页面中查询 `Intl.DateTimeFormat().resolvedOptions().timeZone` 必须返回配置的时区
**Validates: Requirements 7.1, 7.2, 7.3**

### Property 20: 地理位置基于 IP 的准确性
*For any* 地理位置模式设置为"基于 IP"的账号，查询到的经纬度必须与代理 IP 所在地区匹配
**Validates: Requirements 7.4**

### Property 21: 语言配置正确性
*For any* 配置的语言，在页面中查询 `navigator.language` 必须返回配置的语言代码
**Validates: Requirements 7.7, 7.8**

### Property 22: 分辨率覆盖正确性
*For any* 配置的屏幕分辨率，在页面中查询 `screen.width` 和 `screen.height` 必须返回配置的值
**Validates: Requirements 9.2, 9.3**

### Property 23: CPU 内核数覆盖正确性
*For any* 配置的 CPU 内核数，在页面中查询 `navigator.hardwareConcurrency` 必须返回配置的值
**Validates: Requirements 8.5**

### Property 24: 内存大小覆盖正确性
*For any* 配置的内存大小，在页面中查询 `navigator.deviceMemory` 必须返回配置的值（GB）
**Validates: Requirements 8.6**

## 5. Cookie 和持久化属性

### Property 25: Cookie 注入正确性
*For any* 配置的 Cookie 列表，在页面加载后查询 `document.cookie` 必须包含所有配置的 Cookie
**Validates: Requirements 10.3**

### Property 26: 指纹配置持久化 Round-Trip
*For any* 保存的指纹配置，重启应用后加载的配置必须与保存前完全一致
**Validates: Requirements 12.1, 12.2**

### Property 27: 指纹模板 Round-Trip
*For any* 保存的指纹模板，加载后的配置必须与保存前完全一致
**Validates: Requirements 25.2, 25.4**

## 6. 指纹生成和验证属性

### Property 28: 一键生成指纹一致性
*For any* 一键生成的指纹配置，User-Agent、WebGL、操作系统等参数必须相互匹配
**Validates: Requirements 11.2, 24.1-24.4**

### Property 29: 指纹一致性验证准确性
*For any* 不一致的指纹配置（如 Windows + Safari User-Agent），验证函数必须返回错误
**Validates: Requirements 24.1-24.5**

### Property 30: 指纹检测风险识别
*For any* 包含已知风险的指纹配置（如 WebGL 与操作系统不匹配），检测服务必须识别出该风险
**Validates: Requirements 26.2**

## 7. 代理安全和零信任属性

### Property 31: KillSwitch 触发及时性
*For any* 代理连接失败的情况，KillSwitch 必须在 1 秒内触发并阻止所有网络请求
**Validates: Requirements 30.1**

### Property 32: KillSwitch 阻止完整性
*For any* KillSwitch 激活期间，所有类型的网络请求（HTTP、WebSocket、DNS、WebRTC）必须被阻止
**Validates: Requirements 30.4, 36.2**

### Property 33: 代理重连指数退避
*For any* 代理重连尝试，重连间隔必须遵循指数退避算法（1s、2s、4s、8s、16s）
**Validates: Requirements 30.2**

### Property 34: 出口 IP 验证正确性
*For any* 代理连接成功后，验证的出口 IP 必须与配置的代理 IP 一致，否则触发 KillSwitch
**Validates: Requirements 36.3, 36.4**

### Property 35: 直连尝试阻止
*For any* 启用代理的账号，任何绕过代理的直连尝试必须被立即阻止并记录日志
**Validates: Requirements 36.5**

## 8. 进程监督和恢复属性

### Property 36: 心跳检测及时性
*For any* 运行中的账号，心跳检测必须每 10 秒执行一次
**Validates: Requirements 29.1**

### Property 37: 冻结检测准确性
*For any* 连续 3 次心跳超时的账号，系统必须标记为"冻结"状态并自动重启
**Validates: Requirements 29.2, 29.3**

### Property 38: 崩溃自动恢复
*For any* 浏览器进程崩溃的账号，系统必须自动重启并恢复指纹配置和代理设置
**Validates: Requirements 28.2, 27.5**

### Property 39: 资源过载限制
*For any* 系统总 CPU 使用率超过 80% 或可用内存低于 2GB 的情况，系统必须拒绝新账号的启动
**Validates: Requirements 28.5, 28.6**

## 9. 批量操作属性

### Property 40: 批量应用指纹一致性
*For any* 批量应用指纹模板的操作，所有成功的账号必须拥有相同的指纹配置
**Validates: Requirements 32.3**

### Property 41: 批量应用代理一致性
*For any* 批量应用代理的操作，所有成功的账号必须使用相同的代理配置
**Validates: Requirements 32.5**

## 10. 指纹随机化策略属性

### Property 42: 固定指纹不变性
*For any* 指纹策略设置为"固定指纹"的账号，多次启动后的指纹配置必须完全相同
**Validates: Requirements 33.1**

### Property 43: 每次启动随机不可预测性
*For any* 指纹策略设置为"每次启动随机"的账号，每次启动后的指纹配置必须不同
**Validates: Requirements 33.2**

### Property 44: 定期更换时间准确性
*For any* 指纹策略设置为"定期更换"且间隔为 N 天的账号，指纹更换时间必须在 N 天后的 24 小时内
**Validates: Requirements 33.3**

## 11. 代理与指纹联动属性

### Property 45: 基于 IP 的时区自动匹配
*For any* 时区模式设置为"基于 IP"的账号，连接代理后的时区必须与代理 IP 所在地区的时区一致
**Validates: Requirements 35.2, 14.2**

### Property 46: 基于 IP 的语言自动匹配
*For any* 语言模式设置为"基于 IP"的账号，连接代理后的语言必须与代理 IP 所在地区的主要语言一致
**Validates: Requirements 35.2, 14.2**

## 12. 端口扫描保护属性

### Property 47: 本地地址连接阻止
*For any* 启用端口扫描保护的账号，尝试连接 127.0.0.1、localhost 或 192.168.x.x 的请求必须被阻止
**Validates: Requirements 18.2**

### Property 48: 敏感端口连接阻止
*For any* 启用端口扫描保护的账号，尝试连接常见敏感端口（22、3389、5900 等）的请求必须被阻止
**Validates: Requirements 18.3**

## 13. 其他指纹属性

### Property 49: Do Not Track 配置正确性
*For any* 配置的 DNT 值，在页面中查询 `navigator.doNotTrack` 必须返回配置的值
**Validates: Requirements 21.1-21.3**

### Property 50: Media Devices 列表正确性
*For any* 配置的媒体设备列表，在页面中查询 `navigator.mediaDevices.enumerateDevices()` 必须返回配置的设备
**Validates: Requirements 22.2, 22.4**

### Property 51: Plugins 列表正确性
*For any* 配置的插件列表，在页面中查询 `navigator.plugins` 必须返回配置的插件信息
**Validates: Requirements 23.2, 23.4**

### Property 52: 电池信息隐私模式
*For any* 电池模式设置为"隐私模式"的账号，查询 `navigator.getBattery()` 必须返回固定值（100% 电量、充电中）
**Validates: Requirements 19.2**

## 14. 版本管理属性

### Property 53: 配置历史完整性
*For any* 指纹配置的修改操作，系统必须保存历史快照，且最近 10 个版本必须可查询
**Validates: Requirements 31.1, 31.2**

### Property 54: 版本恢复正确性
*For any* 选择的历史版本，恢复后的配置必须与该历史版本完全一致
**Validates: Requirements 31.5**

## 15. 代理列表管理属性

### Property 55: 代理固定绑定不变性
*For any* 为账号指定的固定代理，账号启动时必须始终使用该代理（不自动更换）
**Validates: Requirements 34.2, 34.3**

### Property 56: 代理更换资源清理
*For any* 手动更换账号代理的操作，旧代理的中继服务必须被停止，新代理的中继服务必须被启动
**Validates: Requirements 34.4**
