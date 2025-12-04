# Requirements Document

## Introduction

本功能旨在将现有的 WhatsApp 多账号管理应用升级为**专业级指纹浏览器系统**，参考 AdsPower、Multilogin、GoLogin 等行业标准，实现完整的浏览器指纹管理、代理隔离和环境配置功能。

**核心目标：**
1. **代理系统升级**：实现本地代理中继，解决 Chromium 兼容性问题（ERR_NO_SUPPORTED_PROXIES）
2. **浏览器指纹管理**：支持 WebGL、Canvas、Audio、WebRTC 等指纹参数的自定义和随机化
3. **环境隔离**：每个账号拥有独立的浏览器指纹、代理配置、设备信息
4. **专业级 UI**：提供直观的配置界面，支持一键生成指纹、智能填写等功能

**行业参考：**
- AdsPower：多账号管理 + 指纹管理
- Multilogin：浏览器指纹 + 代理隔离
- GoLogin：云端指纹库 + 本地运行

## Glossary

- **Fingerprint**: 浏览器指纹，包括 User-Agent、WebGL、Canvas、Audio 等可识别浏览器的特征
- **Proxy Relay Service**: 本地代理中继服务，运行在 127.0.0.1 上的轻量级代理服务器
- **WebGL Metadata**: WebGL 元数据，包括厂商（Vendor）和渲染器（Renderer）信息
- **Canvas Fingerprint**: Canvas 指纹，通过 Canvas API 绘制图像生成的唯一标识
- **Audio Fingerprint**: 音频指纹，通过 AudioContext API 生成的唯一标识
- **WebRTC**: Web Real-Time Communication，可能泄露真实 IP 的技术
- **ClientRects**: DOM 元素的边界矩形信息，可用于指纹识别
- **Device Profile**: 设备配置文件，包括 CPU、内存、MAC 地址等硬件信息
- **AccountConfig**: 账号配置实体，包含账号的所有配置信息
- **ProxyConfig**: 代理配置对象，定义代理协议、主机、端口、认证信息等

## Requirements

### Requirement 1: 本地代理中继服务

**User Story:** 作为应用开发者，我希望为每个启用代理的账号自动创建本地代理中继服务，以便解决 Chromium 与远程代理的兼容性问题，同时支持多账号独立 IP。

#### Acceptance Criteria

1. WHEN 账号启动且代理配置已启用 THEN 系统 SHALL 为该账号分配一个唯一的本地端口（范围 10000-60000）
2. WHEN 本地端口分配成功 THEN 系统 SHALL 使用 `socks` 或 `http-proxy` npm 包在该端口启动代理服务器
3. WHEN 代理中继服务启动 THEN 系统 SHALL 配置该服务转发所有流量到账号配置的远程代理
4. WHEN 账号关闭或代理禁用 THEN 系统 SHALL 停止对应的代理中继服务并释放端口
5. WHEN 端口分配冲突 THEN 系统 SHALL 自动重试分配下一个可用端口（最多尝试 10 次）
6. WHEN Chromium 实例创建时 THEN 系统 SHALL 配置 `--proxy-server=socks5://127.0.0.1:分配的端口`

### Requirement 2: 代理配置管理

**User Story:** 作为应用用户，我希望能够方便地管理代理配置，包括添加、编辑、测试和选择代理，以便快速切换不同的代理服务器。

#### Acceptance Criteria

1. WHEN 用户打开代理配置界面 THEN 系统 SHALL 显示所有已保存的代理配置列表
2. WHEN 用户点击"添加代理"按钮 THEN 系统 SHALL 显示代理配置表单（协议、主机、端口、用户名、密码）
3. WHEN 用户点击"检测代理服务"按钮 THEN 系统 SHALL 测试代理连通性并显示结果（成功/失败、响应时间、出口 IP）
4. WHEN 用户点击"检测当前网络"按钮 THEN 系统 SHALL 显示当前账号的出口 IP 和网络状态
5. WHEN 用户在"智能填写"文本框粘贴代理信息 THEN 系统 SHALL 自动解析并填充表单字段
6. WHEN 用户选择已有代理配置 THEN 系统 SHALL 自动填充该代理的所有信息到表单

### Requirement 3: 浏览器指纹 - User-Agent 和操作系统

**User Story:** 作为应用用户，我希望能够自定义浏览器的 User-Agent 和操作系统信息，以便模拟不同的浏览器环境。

#### Acceptance Criteria

1. WHEN 用户打开指纹配置界面 THEN 系统 SHALL 显示浏览器选择下拉菜单（Chrome 108、Chrome 120、Edge、Firefox 等）
2. WHEN 用户选择浏览器版本 THEN 系统 SHALL 自动生成对应的 User-Agent 字符串
3. WHEN 用户选择操作系统（Windows/MacOS） THEN 系统 SHALL 更新 User-Agent 中的操作系统信息
4. WHEN 用户点击"随机生成"按钮 THEN 系统 SHALL 生成随机但合理的 User-Agent 字符串
5. WHEN 用户手动修改 User-Agent THEN 系统 SHALL 验证格式并保存自定义值
6. WHEN 账号启动时 THEN Chromium 实例 SHALL 使用配置的 User-Agent

### Requirement 4: 浏览器指纹 - WebGL

**User Story:** 作为应用用户，我希望能够自定义 WebGL 指纹信息，以便防止通过 WebGL 进行浏览器指纹识别。

#### Acceptance Criteria

1. WHEN 用户选择 WebGL 元数据模式为"真实" THEN 系统 SHALL 使用系统真实的 WebGL 信息
2. WHEN 用户选择 WebGL 元数据模式为"自定义" THEN 系统 SHALL 允许用户输入厂商（Vendor）和渲染器（Renderer）
3. WHEN 用户点击"随机生成" THEN 系统 SHALL 从预设的 WebGL 配置库中随机选择合理的组合
4. WHEN 用户选择 WebGL 图像模式为"随机" THEN 系统 SHALL 在每次渲染时添加随机噪点
5. WHEN 账号启动时 THEN 系统 SHALL 注入脚本覆盖 `WebGLRenderingContext.getParameter` 方法
6. WHEN 网页查询 WebGL 信息时 THEN 系统 SHALL 返回配置的自定义值

### Requirement 5: 浏览器指纹 - WebRTC

**User Story:** 作为应用用户，我希望能够控制 WebRTC 行为，以便防止真实 IP 泄露。

#### Acceptance Criteria

1. WHEN 用户选择 WebRTC 模式为"禁用" THEN 系统 SHALL 完全禁用 `RTCPeerConnection` 和相关 API
2. WHEN 用户选择 WebRTC 模式为"替换" THEN 系统 SHALL 返回基于代理 IP 生成的虚假本地 IP
3. WHEN 用户选择 WebRTC 模式为"真实" THEN 系统 SHALL 允许 WebRTC 使用真实网络信息
4. WHEN WebRTC 模式为"禁用"或"替换" THEN 系统 SHALL 注入脚本覆盖 `navigator.mediaDevices.getUserMedia`
5. WHEN 网页尝试创建 WebRTC 连接时 THEN 系统 SHALL 根据配置阻止或修改连接参数

### Requirement 6: 浏览器指纹 - Canvas 和 Audio

**User Story:** 作为应用用户，我希望能够随机化 Canvas 和 Audio 指纹，以便防止通过这些技术进行跟踪。

#### Acceptance Criteria

1. WHEN 用户选择 Canvas 模式为"随机" THEN 系统 SHALL 在 Canvas 绘制时添加随机噪点
2. WHEN 用户选择 Canvas 模式为"真实" THEN 系统 SHALL 使用系统真实的 Canvas 渲染结果
3. WHEN 用户选择 Audio 模式为"随机" THEN 系统 SHALL 在 AudioContext 输出时添加随机噪声
4. WHEN 用户选择 Audio 模式为"真实" THEN 系统 SHALL 使用系统真实的音频处理结果
5. WHEN 用户选择 ClientRects 模式为"随机" THEN 系统 SHALL 在元素边界矩形计算时添加微小偏移
6. WHEN 账号启动时 THEN 系统 SHALL 注入脚本覆盖 Canvas、AudioContext 和 getBoundingClientRect 方法

### Requirement 7: 环境属性 - 时区、地理位置、语言

**User Story:** 作为应用用户，我希望能够自定义时区、地理位置和语言设置，以便模拟不同地区的用户环境。

#### Acceptance Criteria

1. WHEN 用户选择时区模式为"基于 IP" THEN 系统 SHALL 根据代理出口 IP 自动设置时区
2. WHEN 用户选择时区模式为"真实" THEN 系统 SHALL 使用系统真实时区
3. WHEN 用户选择时区模式为"自定义" THEN 系统 SHALL 允许用户从时区列表中选择
4. WHEN 用户选择地理位置模式为"基于 IP" THEN 系统 SHALL 根据代理出口 IP 生成经纬度
5. WHEN 用户选择地理位置模式为"询问" THEN 浏览器 SHALL 在网页请求位置时弹出权限提示
6. WHEN 用户选择地理位置模式为"禁止" THEN 系统 SHALL 拒绝所有地理位置请求
7. WHEN 用户选择语言模式为"基于 IP" THEN 系统 SHALL 根据代理出口 IP 设置 `navigator.language`
8. WHEN 用户选择语言模式为"自定义" THEN 系统 SHALL 允许用户输入语言代码（如 en-US、zh-CN）

### Requirement 8: 设备信息 - 硬件配置

**User Story:** 作为应用用户，我希望能够自定义设备硬件信息，以便模拟不同的设备环境。

#### Acceptance Criteria

1. WHEN 用户选择设备名称模式为"真实" THEN 系统 SHALL 使用系统真实的设备名称
2. WHEN 用户选择设备名称模式为"自定义" THEN 系统 SHALL 允许用户输入设备名称（如 LAPTOP-FZ3DGZ7）
3. WHEN 用户选择 MAC 地址模式为"真实" THEN 系统 SHALL 使用系统真实的 MAC 地址
4. WHEN 用户选择 MAC 地址模式为"自定义" THEN 系统 SHALL 允许用户输入 MAC 地址或随机生成
5. WHEN 用户选择 CPU 内核数 THEN 系统 SHALL 覆盖 `navigator.hardwareConcurrency` 返回值
6. WHEN 用户选择内存大小 THEN 系统 SHALL 覆盖 `navigator.deviceMemory` 返回值
7. WHEN 用户启用蓝牙 THEN 系统 SHALL 允许 `navigator.bluetooth` API 正常工作
8. WHEN 用户禁用蓝牙 THEN 系统 SHALL 返回 `navigator.bluetooth` 为 undefined

### Requirement 9: 设备信息 - 分辨率和字体

**User Story:** 作为应用用户，我希望能够自定义屏幕分辨率和字体列表，以便模拟不同的显示环境。

#### Acceptance Criteria

1. WHEN 用户选择分辨率模式为"真实" THEN 系统 SHALL 使用系统真实的屏幕分辨率
2. WHEN 用户选择分辨率模式为"自定义" THEN 系统 SHALL 允许用户输入宽度和高度
3. WHEN 自定义分辨率时 THEN 系统 SHALL 覆盖 `screen.width`、`screen.height` 等属性
4. WHEN 用户选择字体模式为"继承系统" THEN 系统 SHALL 使用系统已安装的字体列表
5. WHEN 用户选择字体模式为"自定义" THEN 系统 SHALL 允许用户输入字体名称列表
6. WHEN 网页查询可用字体时 THEN 系统 SHALL 返回配置的字体列表

### Requirement 10: Cookie 管理

**User Story:** 作为应用用户，我希望能够为每个账号预设 Cookie，以便实现自动登录或保持特定状态。

#### Acceptance Criteria

1. WHEN 用户打开 Cookie 配置界面 THEN 系统 SHALL 显示 JSON 格式的输入框
2. WHEN 用户输入 Cookie JSON 数据 THEN 系统 SHALL 验证 JSON 格式（必须包含 name、value、domain 字段）
3. WHEN 账号启动时 THEN 系统 SHALL 在加载页面前注入配置的 Cookie
4. WHEN Cookie 注入失败 THEN 系统 SHALL 记录错误并继续启动账号
5. WHEN 用户导出 Cookie THEN 系统 SHALL 将当前账号的所有 Cookie 导出为 JSON 格式

### Requirement 11: 一键生成指纹

**User Story:** 作为应用用户，我希望能够一键生成完整的浏览器指纹配置，以便快速创建新的账号环境。

#### Acceptance Criteria

1. WHEN 用户点击"一键生成指纹"按钮 THEN 系统 SHALL 生成所有指纹参数的随机但合理的组合
2. WHEN 生成指纹时 THEN 系统 SHALL 确保 User-Agent、WebGL、操作系统等参数相互匹配
3. WHEN 生成指纹时 THEN 系统 SHALL 从预设的指纹库中选择真实设备的配置组合
4. WHEN 生成完成后 THEN 系统 SHALL 在界面上显示所有生成的参数
5. WHEN 用户点击"应用"按钮 THEN 系统 SHALL 保存生成的指纹配置到账号

### Requirement 12: 指纹配置持久化

**User Story:** 作为应用开发者，我希望每个账号的指纹配置能够持久化存储，以便账号重启后保持相同的指纹。

#### Acceptance Criteria

1. WHEN 用户保存指纹配置 THEN 系统 SHALL 将配置存储到账号的配置文件中
2. WHEN 账号启动时 THEN 系统 SHALL 从配置文件加载指纹配置
3. WHEN 指纹配置不存在 THEN 系统 SHALL 使用默认配置（真实模式）
4. WHEN 指纹配置格式错误 THEN 系统 SHALL 记录错误并使用默认配置
5. WHEN 用户导出账号配置 THEN 导出的 JSON SHALL 包含完整的指纹配置

### Requirement 13: 指纹注入机制

**User Story:** 作为应用开发者，我希望在页面加载前注入指纹脚本，以便确保所有 JavaScript API 在页面执行前已被覆盖。

#### Acceptance Criteria

1. WHEN 账号的 BrowserView 创建时 THEN 系统 SHALL 通过 `webContents.executeJavaScript` 在页面加载前注入指纹脚本
2. WHEN 指纹脚本注入时 THEN 系统 SHALL 覆盖 `navigator`、`screen`、`WebGLRenderingContext` 等对象的属性
3. WHEN 指纹脚本注入时 THEN 系统 SHALL 使用 `Object.defineProperty` 确保属性不可被网页代码修改
4. WHEN 页面尝试检测指纹脚本 THEN 系统 SHALL 隐藏注入痕迹（如删除脚本标签、隐藏堆栈信息）
5. WHEN 指纹脚本执行失败 THEN 系统 SHALL 记录错误但继续加载页面

### Requirement 14: 代理与指纹联动

**User Story:** 作为应用用户，我希望代理和指纹配置能够智能联动，以便自动匹配代理 IP 所在地区的环境参数。

#### Acceptance Criteria

1. WHEN 用户启用"基于 IP"模式 THEN 系统 SHALL 在代理连接成功后查询出口 IP 的地理位置
2. WHEN 获取到 IP 地理位置后 THEN 系统 SHALL 自动设置时区、语言、地理位置等参数
3. WHEN IP 地理位置查询失败 THEN 系统 SHALL 使用默认值（UTC 时区、en-US 语言）
4. WHEN 用户更换代理 THEN 系统 SHALL 提示是否重新生成基于新 IP 的指纹配置
5. WHEN 用户确认重新生成 THEN 系统 SHALL 更新所有"基于 IP"模式的参数

### Requirement 15: 指纹配置界面

**User Story:** 作为应用用户，我希望有一个直观的指纹配置界面，以便方便地查看和修改所有指纹参数。

#### Acceptance Criteria

1. WHEN 用户打开账号配置界面 THEN 系统 SHALL 显示"指纹设置"标签页
2. WHEN 用户进入指纹设置 THEN 系统 SHALL 按分类显示所有指纹参数（浏览器、WebGL、Canvas、设备等）
3. WHEN 用户修改任何参数 THEN 系统 SHALL 实时显示"未保存"提示
4. WHEN 用户点击"应用"按钮 THEN 系统 SHALL 保存所有修改并关闭界面
5. WHEN 用户点击"取消"按钮 THEN 系统 SHALL 放弃所有修改并关闭界面
6. WHEN 用户点击"重置为默认"按钮 THEN 系统 SHALL 将所有参数恢复为默认值（真实模式）

### Requirement 16: 代理健康监控增强

**User Story:** 作为应用用户，我希望能够实时监控代理连接状态，以便及时发现和处理代理问题。

#### Acceptance Criteria

1. WHEN 代理中继服务运行时 THEN 系统 SHALL 每 30 秒执行一次健康检查
2. WHEN 健康检查执行时 THEN 系统 SHALL 测试代理连通性并记录响应时间
3. WHEN 连续 3 次健康检查失败 THEN 系统 SHALL 触发 KillSwitch 并通知用户
4. WHEN 用户查看账号状态 THEN 界面 SHALL 显示代理图标（绿色=正常、黄色=警告、红色=失败）
5. WHEN 用户悬停在代理图标上 THEN 系统 SHALL 显示详细信息（本地端口、远程代理、响应时间、最后检查时间）

### Requirement 17: 智能填写代理信息

**User Story:** 作为应用用户，我希望能够通过粘贴文本快速填写代理信息，以便节省手动输入的时间。

#### Acceptance Criteria

1. WHEN 用户在"智能填写"文本框粘贴 `socks5://user:pass@host:port` 格式的文本 THEN 系统 SHALL 自动解析并填充所有字段
2. WHEN 用户粘贴 `host:port:user:pass` 格式的文本 THEN 系统 SHALL 自动解析并填充所有字段
3. WHEN 用户粘贴 `host:port` 格式的文本 THEN 系统 SHALL 填充主机和端口，协议默认为 SOCKS5
4. WHEN 解析失败 THEN 系统 SHALL 显示错误提示并保持原有字段值
5. WHEN 解析成功 THEN 系统 SHALL 高亮显示已填充的字段

### Requirement 18: 端口扫描保护

**User Story:** 作为应用用户，我希望能够启用端口扫描保护，以便防止网页通过 WebSocket 或 Fetch API 扫描本地端口。

#### Acceptance Criteria

1. WHEN 用户启用端口扫描保护 THEN 系统 SHALL 注入脚本拦截 WebSocket 和 Fetch 请求
2. WHEN 网页尝试连接本地地址（127.0.0.1、localhost、192.168.x.x） THEN 系统 SHALL 阻止请求并返回错误
3. WHEN 网页尝试连接常见端口（22、3389、5900 等） THEN 系统 SHALL 阻止请求并返回错误
4. WHEN 用户禁用端口扫描保护 THEN 系统 SHALL 允许所有网络请求正常执行
5. WHEN 端口扫描被阻止时 THEN 系统 SHALL 记录日志但不显示用户提示（避免干扰正常使用）

### Requirement 19: 电池信息管理

**User Story:** 作为应用用户，我希望能够控制电池信息的暴露，以便防止通过电池 API 进行指纹识别。

#### Acceptance Criteria

1. WHEN 用户选择电池模式为"真实" THEN 系统 SHALL 允许 `navigator.getBattery()` 返回真实电池信息
2. WHEN 用户选择电池模式为"隐私模式" THEN 系统 SHALL 返回固定的电池信息（100% 电量、充电中）
3. WHEN 用户选择电池模式为"禁用" THEN 系统 SHALL 返回 `navigator.getBattery()` 为 undefined
4. WHEN 账号启动时 THEN 系统 SHALL 注入脚本覆盖 `navigator.getBattery` 方法
5. WHEN 网页查询电池信息时 THEN 系统 SHALL 根据配置返回对应的值

### Requirement 20: 指纹库管理

**User Story:** 作为应用开发者，我希望维护一个真实设备的指纹库，以便生成指纹时选择真实且常见的配置组合。

#### Acceptance Criteria

1. WHEN 系统初始化时 THEN 系统 SHALL 加载预设的指纹库（包含 100+ 真实设备配置）
2. WHEN 指纹库加载时 THEN 每个配置 SHALL 包含 User-Agent、WebGL、分辨率、CPU、内存等完整参数
3. WHEN 用户点击"一键生成指纹" THEN 系统 SHALL 从指纹库中随机选择一个配置
4. WHEN 用户手动修改指纹参数 THEN 系统 SHALL 验证参数的合理性（如 Windows 不应有 Safari User-Agent）
5. WHEN 指纹库更新时 THEN 系统 SHALL 支持从远程服务器下载最新的指纹库


### Requirement 21: Do Not Track 设置

**User Story:** 作为应用用户，我希望能够控制 Do Not Track (DNT) 标头，以便模拟不同的隐私偏好设置。

#### Acceptance Criteria

1. WHEN 用户选择 DNT 模式为"启用" THEN 系统 SHALL 设置 `navigator.doNotTrack` 为 "1"
2. WHEN 用户选择 DNT 模式为"禁用" THEN 系统 SHALL 设置 `navigator.doNotTrack` 为 "0"
3. WHEN 用户选择 DNT 模式为"未指定" THEN 系统 SHALL 设置 `navigator.doNotTrack` 为 null
4. WHEN 账号启动时 THEN 系统 SHALL 注入脚本覆盖 `navigator.doNotTrack` 属性
5. WHEN 网页查询 DNT 设置时 THEN 系统 SHALL 返回配置的值

### Requirement 22: Media Devices 管理

**User Story:** 作为应用用户，我希望能够控制媒体设备列表，以便模拟不同的硬件配置。

#### Acceptance Criteria

1. WHEN 用户选择媒体设备模式为"真实" THEN 系统 SHALL 使用系统真实的媒体设备列表
2. WHEN 用户选择媒体设备模式为"自定义" THEN 系统 SHALL 允许用户配置虚拟的摄像头、麦克风、扬声器
3. WHEN 用户选择媒体设备模式为"禁用" THEN 系统 SHALL 返回空的媒体设备列表
4. WHEN 账号启动时 THEN 系统 SHALL 注入脚本覆盖 `navigator.mediaDevices.enumerateDevices` 方法
5. WHEN 网页查询媒体设备时 THEN 系统 SHALL 返回配置的设备列表（包括 deviceId、label、kind）

### Requirement 23: Plugins 列表管理

**User Story:** 作为应用用户，我希望能够自定义浏览器插件列表，以便模拟不同的浏览器配置。

#### Acceptance Criteria

1. WHEN 用户选择插件模式为"真实" THEN 系统 SHALL 使用 Chromium 默认的插件列表
2. WHEN 用户选择插件模式为"自定义" THEN 系统 SHALL 允许用户配置插件列表（如 PDF Viewer、Chrome PDF Plugin）
3. WHEN 用户选择插件模式为"空列表" THEN 系统 SHALL 返回空的插件列表
4. WHEN 账号启动时 THEN 系统 SHALL 注入脚本覆盖 `navigator.plugins` 和 `navigator.mimeTypes` 属性
5. WHEN 网页查询插件列表时 THEN 系统 SHALL 返回配置的插件信息（包括 name、description、filename、mimeTypes）

### Requirement 24: 指纹一致性验证

**User Story:** 作为应用开发者，我希望系统能够验证指纹配置的一致性，以便防止不合理的参数组合被检测。

#### Acceptance Criteria

1. WHEN 用户保存指纹配置 THEN 系统 SHALL 验证 User-Agent 与操作系统的匹配性
2. WHEN 用户保存指纹配置 THEN 系统 SHALL 验证 WebGL 厂商与操作系统的匹配性
3. WHEN 用户保存指纹配置 THEN 系统 SHALL 验证分辨率与设备类型的合理性
4. WHEN 用户保存指纹配置 THEN 系统 SHALL 验证 CPU 内核数与内存大小的合理性
5. WHEN 发现不一致时 THEN 系统 SHALL 显示警告提示但允许用户强制保存
6. WHEN 用户点击"一键生成指纹" THEN 系统 SHALL 确保生成的所有参数相互一致

### Requirement 25: 指纹模板管理

**User Story:** 作为应用用户，我希望能够保存和复用指纹配置模板，以便快速为多个账号应用相同的指纹策略。

#### Acceptance Criteria

1. WHEN 用户配置完指纹后 THEN 系统 SHALL 提供"保存为模板"按钮
2. WHEN 用户保存模板时 THEN 系统 SHALL 要求输入模板名称并存储完整的指纹配置
3. WHEN 用户打开指纹配置界面 THEN 系统 SHALL 显示"从模板加载"下拉菜单
4. WHEN 用户选择模板 THEN 系统 SHALL 将模板的所有参数应用到当前账号
5. WHEN 用户删除模板 THEN 系统 SHALL 从模板列表中移除该模板
6. WHEN 用户导出账号配置 THEN 系统 SHALL 支持同时导出关联的指纹模板


### Requirement 26: 指纹检测验证模块

**User Story:** 作为应用用户，我希望系统能够自动检测指纹配置的有效性，以便发现和修复可能被识别的指纹问题。

#### Acceptance Criteria

1. WHEN 用户点击"检测指纹"按钮 THEN 系统 SHALL 在隐藏的 BrowserView 中访问指纹检测网站（如 browserleaks.com、pixelscan.net）
2. WHEN 指纹检测完成 THEN 系统 SHALL 分析检测结果并识别风险项（WebGL 不一致、WebRTC 泄露、User-Agent 异常等）
3. WHEN 发现风险项 THEN 系统 SHALL 为每个风险项提供修复建议（如"WebGL 厂商与操作系统不匹配，建议修改为 XXX"）
4. WHEN 检测完成 THEN 系统 SHALL 输出指纹评分（0-100 分）和风险等级（低/中/高）
5. WHEN 用户点击"自动修复"按钮 THEN 系统 SHALL 根据建议自动调整指纹配置
6. WHEN 检测失败（网络错误、超时） THEN 系统 SHALL 显示错误信息并允许用户重试

### Requirement 27: 指纹注入生命周期管理

**User Story:** 作为应用开发者，我希望在浏览器启动的不同阶段执行不同的指纹注入操作，以便确保指纹的完整性和隐蔽性。

#### Acceptance Criteria

1. WHEN 账号启动前（Before Launch） THEN 系统 SHALL 设置 Chromium 启动参数（User-Agent、Proxy、Flags）
2. WHEN Preload 阶段 THEN 系统 SHALL 通过 `webContents.executeJavaScript` 覆盖 `navigator`、`screen` 等基础对象
3. WHEN DOM Ready 阶段 THEN 系统 SHALL 注入 WebGL、Canvas、Audio 的 Hook 脚本
4. WHEN 页面发起请求时（Request Hook） THEN 系统 SHALL 拦截并注入 Cookie、阻止端口扫描
5. WHEN 浏览器崩溃后（onCrash） THEN 系统 SHALL 在重启时恢复相同的指纹配置和代理设置
6. WHEN 任何阶段注入失败 THEN 系统 SHALL 记录详细错误日志并尝试降级方案

### Requirement 28: Profile 进程监督器

**User Story:** 作为应用开发者，我希望实现 Profile 进程监督器，以便自动处理代理崩溃、浏览器崩溃、资源过载等异常情况。

#### Acceptance Criteria

1. WHEN 代理中继服务崩溃 THEN 系统 SHALL 自动重连远程代理并触发 KillSwitch（阻止网络请求直到恢复）
2. WHEN 浏览器进程崩溃 THEN 系统 SHALL 自动重启该账号的 BrowserView 并恢复指纹配置
3. WHEN 单个账号 CPU 使用率超过 50% 持续 30 秒 THEN 系统 SHALL 记录警告并通知用户
4. WHEN 单个账号内存使用超过 1GB THEN 系统 SHALL 记录警告并建议用户关闭该账号
5. WHEN 系统总 CPU 使用率超过 80% THEN 系统 SHALL 限制新账号的启动
6. WHEN 系统可用内存低于 2GB THEN 系统 SHALL 限制新账号的启动并提示用户关闭部分账号

### Requirement 29: 浏览器心跳检测与自动恢复

**User Story:** 作为应用开发者，我希望实现浏览器心跳检测机制，以便及时发现和恢复冻结或无响应的浏览器实例。

#### Acceptance Criteria

1. WHEN 账号运行时 THEN 系统 SHALL 每 10 秒向 BrowserView 发送心跳请求（通过 `executeJavaScript` 执行简单脚本）
2. WHEN 心跳请求超时（超过 5 秒无响应） THEN 系统 SHALL 标记该账号为"疑似冻结"状态
3. WHEN 连续 3 次心跳超时 THEN 系统 SHALL 确认浏览器冻结并自动重启该账号
4. WHEN 重启账号时 THEN 系统 SHALL 保留会话数据、指纹配置和代理设置
5. WHEN 重启失败（连续 3 次） THEN 系统 SHALL 停止自动重启并通知用户手动处理
6. WHEN 用户查看账号状态 THEN 界面 SHALL 显示心跳状态（正常/警告/冻结）

### Requirement 30: 代理自动重连与零信任策略

**User Story:** 作为应用用户，我希望代理连接失败时系统能够自动重连用户指定的代理，并在任何情况下都不泄露本机 IP，以便确保绝对的 IP 隔离安全。

#### Acceptance Criteria

1. WHEN 代理连接失败 THEN 系统 SHALL 立即触发 KillSwitch（阻止所有网络请求）
2. WHEN KillSwitch 触发后 THEN 系统 SHALL 使用指数退避算法自动重连用户指定的代理（1 秒、2 秒、4 秒、8 秒、16 秒）
3. WHEN 重连次数超过 5 次 THEN 系统 SHALL 停止自动重连、保持 KillSwitch 状态并通知用户
4. WHEN 重连期间 THEN 系统 SHALL 持续阻止所有网络请求（包括 DNS、HTTP、WebSocket、WebRTC）
5. WHEN 用户手动点击"重试连接" THEN 系统 SHALL 重置重连计数器并重新尝试连接
6. WHEN 代理恢复连接 THEN 系统 SHALL 验证出口 IP 后解除 KillSwitch 并恢复正常网络访问
7. WHEN 用户禁用代理 THEN 系统 SHALL 显示警告"禁用代理将暴露本机 IP，是否继续？"并要求用户明确确认
8. WHEN 用户确认禁用代理 THEN 系统 SHALL 解除 KillSwitch 并允许直连（用户自行承担风险）
9. WHEN 用户取消禁用代理 THEN 系统 SHALL 保持 KillSwitch 状态并继续阻止网络请求

### Requirement 31: 指纹配置版本管理

**User Story:** 作为应用用户，我希望系统能够记录指纹配置的历史版本，以便在出现问题时回滚到之前的配置。

#### Acceptance Criteria

1. WHEN 用户保存指纹配置 THEN 系统 SHALL 创建配置快照并记录时间戳
2. WHEN 用户修改指纹配置 THEN 系统 SHALL 保留最近 10 个历史版本
3. WHEN 用户打开"配置历史"界面 THEN 系统 SHALL 显示所有历史版本（时间、修改内容摘要）
4. WHEN 用户选择历史版本 THEN 系统 SHALL 显示该版本的完整配置详情
5. WHEN 用户点击"恢复此版本" THEN 系统 SHALL 将当前配置替换为选中的历史版本
6. WHEN 恢复历史版本 THEN 系统 SHALL 创建新的快照（避免丢失当前配置）

### Requirement 32: 批量指纹操作

**User Story:** 作为应用用户，我希望能够批量为多个账号应用相同的指纹配置或代理设置，以便快速管理大量账号。

#### Acceptance Criteria

1. WHEN 用户选择多个账号 THEN 系统 SHALL 显示"批量操作"菜单
2. WHEN 用户点击"批量应用指纹模板" THEN 系统 SHALL 显示模板选择界面
3. WHEN 用户选择模板并确认 THEN 系统 SHALL 为所有选中账号应用该指纹模板
4. WHEN 用户点击"批量应用代理" THEN 系统 SHALL 显示代理选择界面
5. WHEN 用户选择代理并确认 THEN 系统 SHALL 为所有选中账号配置该代理
6. WHEN 批量操作执行时 THEN 系统 SHALL 显示进度条和成功/失败的账号列表
7. WHEN 批量操作完成 THEN 系统 SHALL 显示操作摘要（成功 X 个、失败 Y 个、跳过 Z 个）

### Requirement 33: 指纹随机化策略

**User Story:** 作为应用用户，我希望能够配置指纹随机化策略，以便在每次启动账号时自动生成新的指纹或保持固定指纹。

#### Acceptance Criteria

1. WHEN 用户选择指纹策略为"固定指纹" THEN 系统 SHALL 在每次启动时使用相同的指纹配置
2. WHEN 用户选择指纹策略为"每次启动随机" THEN 系统 SHALL 在每次启动时生成新的随机指纹
3. WHEN 用户选择指纹策略为"定期更换"并设置间隔（如 7 天） THEN 系统 SHALL 在间隔到期后自动生成新指纹
4. WHEN 用户选择指纹策略为"部分随机" THEN 系统 SHALL 允许用户选择哪些参数随机（如仅随机 Canvas、Audio）
5. WHEN 生成随机指纹时 THEN 系统 SHALL 确保新指纹与旧指纹的一致性（如保持相同的操作系统）
6. WHEN 指纹更换后 THEN 系统 SHALL 记录更换历史并允许用户查看

### Requirement 34: 代理列表管理

**User Story:** 作为应用用户，我希望能够管理代理列表并为每个账号手动指定固定代理，以便实现账号与 IP 的稳定绑定。

#### Acceptance Criteria

1. WHEN 用户打开代理列表界面 THEN 系统 SHALL 显示所有已保存的代理配置
2. WHEN 用户为账号选择代理 THEN 系统 SHALL 将该代理固定绑定到账号（不自动更换）
3. WHEN 账号启动时 THEN 系统 SHALL 始终使用用户指定的固定代理
4. WHEN 用户手动更换账号的代理 THEN 系统 SHALL 停止旧代理中继服务并启动新代理中继服务
5. WHEN 代理连接失败 THEN 系统 SHALL 通知用户但不自动切换到其他代理
6. WHEN 用户查看账号列表 THEN 界面 SHALL 显示每个账号当前使用的代理名称和状态

### Requirement 35: 指纹与代理的智能匹配

**User Story:** 作为应用用户，我希望系统能够智能匹配指纹和代理，以便确保指纹参数（如时区、语言）与代理 IP 所在地区一致。

#### Acceptance Criteria

1. WHEN 用户启用"智能匹配" THEN 系统 SHALL 在代理连接成功后查询出口 IP 的地理位置
2. WHEN 获取到地理位置后 THEN 系统 SHALL 自动调整时区、语言、地理位置等参数以匹配该地区
3. WHEN 用户更换代理 THEN 系统 SHALL 提示"检测到代理地区变化，是否更新指纹配置？"
4. WHEN 用户确认更新 THEN 系统 SHALL 自动调整所有"基于 IP"模式的参数
5. WHEN 地理位置查询失败 THEN 系统 SHALL 使用代理配置中的国家/地区信息（如果有）
6. WHEN 无法确定地区 THEN 系统 SHALL 使用默认值（UTC 时区、en-US 语言）并记录警告


### Requirement 36: 零信任网络模型强化

**User Story:** 作为应用开发者，我希望实现零信任网络模型，以便在任何情况下都不允许未经授权的网络请求泄露本机 IP。

#### Acceptance Criteria

1. WHEN 账号启用代理 THEN 系统 SHALL 默认禁止所有直连网络请求（零信任原则）
2. WHEN 代理未连接时 THEN 系统 SHALL 阻止 BrowserView 的所有网络请求（包括页面加载）
3. WHEN 代理连接成功后 THEN 系统 SHALL 验证出口 IP 与配置的代理 IP 一致后才允许网络请求
4. WHEN 出口 IP 验证失败 THEN 系统 SHALL 触发 KillSwitch 并显示错误"检测到 IP 泄露风险"
5. WHEN 系统检测到任何直连尝试（绕过代理） THEN 系统 SHALL 立即阻止并记录安全日志
6. WHEN 用户查看安全日志 THEN 系统 SHALL 显示所有被阻止的直连尝试（时间、目标地址、来源）
7. WHEN 应用退出时 THEN 系统 SHALL 确保所有代理中继服务已停止（防止后台泄露）
