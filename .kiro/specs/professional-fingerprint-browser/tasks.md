# Implementation Plan

## Phase 1: 代理中继服务基础设施（2 周）

- [x] 1. 设置项目结构和核心接口





  - 创建 `src/infrastructure/proxy/ProxyRelayServer.ts`
  - 创建 `src/infrastructure/proxy/PortAllocator.ts`
  - 创建 `src/domain/entities/ProxyRelay.ts`
  - 定义 ProxyRelayService 接口
  - _Requirements: 1.1, 1.2_

- [x] 1.1 实现端口分配器


  - 实现端口范围管理（10000-60000）
  - 实现端口冲突检测和重试逻辑（最多 10 次）
  - 实现端口释放机制
  - _Requirements: 1.1, 1.5_

- [x] 1.2 编写端口分配器的属性测试


  - **Property 1: 端口唯一性**
  - **Property 2: 端口范围约束**
  - **Validates: Requirements 1.1**

- [x] 1.3 实现 SOCKS5 代理中继服务器

  - 使用 `socks` npm 包创建本地 SOCKS5 服务器
  - 实现到远程代理的连接和认证
  - 实现流量转发逻辑
  - 实现流量统计（字节数、连接数）
  - _Requirements: 1.2, 1.3_

- [x] 1.4 编写代理中继的属性测试


  - **Property 3: 代理服务器可连接性**
  - **Property 4: 流量转发正确性**
  - **Validates: Requirements 1.2, 1.3**

- [x] 1.5 实现 HTTP/HTTPS 代理中继服务器

  - 使用 `http-proxy` npm 包创建本地 HTTP 代理
  - 实现 CONNECT 隧道
  - 实现到远程代理的转发
  - _Requirements: 1.2, 1.3_

- [x] 1.6 实现 ProxyRelayService

  - 实现 startRelay() 方法（启动中继服务）
  - 实现 stopRelay() 方法（停止中继服务）
  - 实现 getRelayStatus() 方法（获取状态）
  - 实现 testProxy() 方法（测试代理连通性）
  - 实现 getExitIP() 方法（获取出口 IP）
  - _Requirements: 1.1-1.6_

- [x] 1.7 编写 ProxyRelayService 的属性测试


  - **Property 5: 资源清理完整性**
  - **Property 8: 代理测试结果准确性**
  - **Property 9: 出口 IP 一致性**
  - **Validates: Requirements 1.4, 2.3, 2.4**

- [x] 1.8 集成到现有的 ProxySecurityManager


  - 修改 ProxySecurityManager 使用 ProxyRelayService
  - 更新 Chromium 启动参数配置
  - 实现代理中继与 KillSwitch 的联动
  - _Requirements: 1.6_

- [x] 1.9 编写 Chromium 代理参数的属性测试


  - **Property 7: Chromium 代理参数正确性**
  - **Validates: Requirements 1.6**

- [x] 1.10 Checkpoint - 确保所有测试通过


  - 确保所有测试通过，询问用户是否有问题

## Phase 2: 基础指纹管理（3 周）

- [x] 2. 创建指纹配置数据模型







  - 创建 `src/domain/entities/FingerprintProfile.ts`
  - 定义完整的 FingerprintProfile 接口
  - 实现 validate() 方法
  - 实现 toJSON() 和 fromJSON() 方法
  - _Requirements: 3.1-9.6, 21.1-23.5_

- [x] 2.1 编写指纹配置持久化的属性测试


  - **Property 26: 指纹配置持久化 Round-Trip**
  - **Validates: Requirements 12.1, 12.2**

- [x] 2.2 实现 FingerprintService



  - 实现 createFingerprint() 方法
  - 实现 updateFingerprint() 方法
  - 实现 getFingerprint() 方法
  - 实现配置持久化（保存到 session-data/account-{id}/fingerprint.json）
  - _Requirements: 12.1-12.5_

- [x] 2.3 实现 User-Agent 生成器


  - 创建 `src/infrastructure/fingerprint/generators/UserAgentGenerator.ts`
  - 实现浏览器版本到 User-Agent 的映射
  - 实现操作系统信息更新
  - 实现随机生成逻辑
  - _Requirements: 3.1-3.6_

- [x] 2.4 编写 User-Agent 的属性测试


  - **Property 12: User-Agent 生成正确性**
  - **Property 13: User-Agent 随机生成有效性**
  - **Property 14: User-Agent 应用正确性**
  - **Validates: Requirements 3.2-3.6**


- [x] 2.5 实现 WebGL 指纹生成器


  - 创建 `src/infrastructure/fingerprint/generators/WebGLGenerator.ts`
  - 实现 WebGL 厂商和渲染器的预设库
  - 实现随机选择逻辑
  - 实现一致性验证（厂商与操作系统匹配）
  - _Requirements: 4.1-4.6_

- [x] 2.6 编写 WebGL 的属性测试


  - **Property 15: WebGL 参数覆盖正确性**
  - **Validates: Requirements 4.2, 4.6**

- [x] 2.7 实现 Canvas 和 Audio 生成器


  - 创建 `src/infrastructure/fingerprint/generators/CanvasGenerator.ts`
  - 实现 Canvas 噪点生成算法
  - 实现 Audio 噪声生成算法
  - 实现 ClientRects 偏移生成
  - _Requirements: 6.1-6.6_

- [x] 2.8 编写 Canvas 和 Audio 的属性测试


  - **Property 17: Canvas 随机化不可预测性**
  - **Property 18: Audio 随机化不可预测性**
  - **Validates: Requirements 6.1, 6.3**

- [x] 2.9 实现 FingerprintScriptGenerator


  - 创建 `src/infrastructure/fingerprint/FingerprintScriptGenerator.ts`
  - 实现 User-Agent 覆盖脚本
  - 实现 WebGL 覆盖脚本
  - 实现 Canvas 噪点注入脚本
  - 实现 Audio 噪声注入脚本
  - 实现 WebRTC 禁用/替换脚本
  - _Requirements: 3.6, 4.6, 5.1-5.5, 6.6_

- [x] 2.10 实现 FingerprintInjector


  - 创建 `src/infrastructure/fingerprint/FingerprintInjector.ts`
  - 实现 getChromiumArgs() 方法（Before Launch）
  - 实现 injectPreloadScript() 方法（Preload 阶段）
  - 实现 injectDOMReadyScript() 方法（DOM Ready 阶段）
  - 实现 setupRequestHooks() 方法（Request Hook）
  - _Requirements: 13.1-13.5, 27.1-27.6_

- [x] 2.11 编写指纹注入的属性测试


  - **Property 16: WebRTC 禁用完整性**
  - **Validates: Requirements 5.1, 13.1-13.5**

- [x] 2.12 集成指纹注入到 ViewManager


  - 修改 `src/presentation/windows/view-manager/ViewManager.js`
  - 在 BrowserView 创建时注入指纹脚本
  - 实现指纹注入失败的降级处理
  - _Requirements: 13.1-13.5_

- [x] 2.13 Checkpoint - 确保所有测试通过


  - 确保所有测试通过，询问用户是否有问题

## Phase 3: 环境属性和设备信息（2 周）

- [x] 3. 实现设备信息生成器
  - 创建 `src/infrastructure/fingerprint/generators/DeviceInfoGenerator.ts`
  - 实现 CPU 内核数生成
  - 实现内存大小生成
  - 实现设备名称生成
  - 实现 MAC 地址生成
  - _Requirements: 8.1-8.8_

- [x] 3.1 编写设备信息的属性测试


  - **Property 23: CPU 内核数覆盖正确性**
  - **Property 24: 内存大小覆盖正确性**
  - **Validates: Requirements 8.5, 8.6**

- [x] 3.2 实现时区、地理位置、语言配置


  - 实现时区覆盖脚本（Intl.DateTimeFormat）
  - 实现地理位置覆盖脚本（navigator.geolocation）
  - 实现语言覆盖脚本（navigator.language）
  - _Requirements: 7.1-7.8_



- [x] 3.3 编写环境属性的属性测试
  - **Property 19: 时区配置正确性**
  - **Property 21: 语言配置正确性**
  - **Validates: Requirements 7.1-7.8**

- [x] 3.4 实现分辨率和字体配置


  - 实现屏幕分辨率覆盖脚本（screen.width/height）
  - 实现字体列表覆盖脚本


  - _Requirements: 9.1-9.6_

- [x] 3.5 编写分辨率的属性测试
  - **Property 22: 分辨率覆盖正确性**
  - **Validates: Requirements 9.2, 9.3**



- [x] 3.6 实现其他指纹属性
  - 实现 Do Not Track 覆盖（navigator.doNotTrack）
  - 实现 Media Devices 覆盖（navigator.mediaDevices）
  - 实现 Plugins 列表覆盖（navigator.plugins）
  - 实现电池信息覆盖（navigator.getBattery）
  - _Requirements: 19.1-19.5, 21.1-21.5, 22.1-22.5, 23.1-23.5_

- [x] 3.7 编写其他指纹属性的属性测试
  - **Property 49: Do Not Track 配置正确性**
  - **Property 50: Media Devices 列表正确性**
  - **Property 51: Plugins 列表正确性**
  - **Property 52: 电池信息隐私模式**
  - **Validates: Requirements 19.2, 21.1-21.3, 22.2, 23.2**

- [x] 3.8 实现 Cookie 管理
  - 实现 Cookie JSON 验证
  - 实现 Cookie 注入（在页面加载前）
  - 实现 Cookie 导出功能
  - _Requirements: 10.1-10.5_

- [x] 3.9 编写 Cookie 的属性测试

  - **Property 25: Cookie 注入正确性**
  - **Validates: Requirements 10.3**


- [x] 3.10 Checkpoint - 确保所有测试通过


  - 确保所有测试通过，询问用户是否有问题

## Phase 4: 高级功能（3 周）

- [x] 4. 实现指纹库管理









  - 创建 `src/infrastructure/fingerprint/FingerprintLibrary.ts`
  - 创建 `resources/fingerprint-library.json`（100+ 真实设备配置）
  - 实现指纹库加载和查询
  - 实现从指纹库随机选择
  - _Requirements: 20.1-20.5_

- [x] 4.1 实现一键生成指纹


  - 在 FingerprintService 中实现 generateRandomFingerprint() 方法
  - 从指纹库中随机选择配置
  - 确保参数一致性（User-Agent、WebGL、操作系统匹配）
  - _Requirements: 11.1-11.5_

- [x] 4.2 编写一键生成指纹的属性测试


  - **Property 28: 一键生成指纹一致性**
  - **Validates: Requirements 11.2, 24.1-24.4**

- [x] 4.3 实现指纹一致性验证




  - 创建 `src/infrastructure/fingerprint/FingerprintValidator.ts`
  - 实现 User-Agent 与操作系统匹配验证
  - 实现 WebGL 与操作系统匹配验证
  - 实现分辨率合理性验证
  - 实现 CPU 与内存合理性验证
  - _Requirements: 24.1-24.6_

- [x] 4.4 编写指纹一致性验证的属性测试



  - **Property 29: 指纹一致性验证准确性**
  - **Validates: Requirements 24.1-24.5**

- [x] 4.5 实现指纹模板管理


  - 在 FingerprintService 中实现 saveFingerprintTemplate() 方法
  - 在 FingerprintService 中实现 loadFingerprintTemplate() 方法
  - 实现模板存储（JSON 文件）
  - 实现模板列表查询
  - _Requirements: 25.1-25.6_

- [x] 4.6 编写指纹模板的属性测试


  - **Property 27: 指纹模板 Round-Trip**
  - **Validates: Requirements 25.2, 25.4**

- [x] 4.7 实现指纹检测验证服务


  - 创建 `src/application/services/FingerprintDetectionService.ts`
  - 使用 Puppeteer 访问指纹检测网站（browserleaks.com）
  - 实现检测结果解析
  - 实现风险识别（WebGL 不一致、WebRTC 泄露等）
  - 实现修复建议生成
  - 实现自动修复功能
  - _Requirements: 26.1-26.6_

- [x] 4.8 编写指纹检测的属性测试


  - **Property 30: 指纹检测风险识别**
  - **Validates: Requirements 26.2**

- [x] 4.9 实现批量指纹操作


  - 在 FingerprintService 中实现 applyFingerprintBatch() 方法
  - 实现批量应用指纹模板
  - 实现批量应用代理
  - 实现操作进度跟踪
  - 实现操作摘要生成
  - _Requirements: 32.1-32.7_

- [x] 4.10 编写批量操作的属性测试


  - **Property 40: 批量应用指纹一致性**
  - **Property 41: 批量应用代理一致性**
  - **Validates: Requirements 32.3, 32.5**

- [x] 4.11 Checkpoint - 确保所有测试通过


  - 确保所有测试通过，询问用户是否有问题

## Phase 5: 进程监督和恢复（2 周）

- [x] 5. 实现 ProfileSupervisor





  - 创建 `src/application/services/ProfileSupervisor.ts`
  - 实现 startSupervision() 方法
  - 实现 stopSupervision() 方法
  - 实现 getSupervisionStatus() 方法
  - _Requirements: 28.1-28.6, 29.1-29.6_

- [x] 5.1 实现心跳检测机制


  - 实现 performHeartbeat() 方法（每 10 秒执行）
  - 通过 executeJavaScript 发送心跳请求
  - 实现超时检测（5 秒）
  - 实现连续失败计数
  - _Requirements: 29.1-29.2_


- [x] 5.2 编写心跳检测的属性测试

  - **Property 36: 心跳检测及时性**
  - **Property 37: 冻结检测准确性**
  - **Validates: Requirements 29.1-29.3**

- [x] 5.3 实现自动恢复机制

  - 实现 recoverProfile() 方法
  - 实现浏览器冻结恢复（连续 3 次心跳超时）
  - 实现浏览器崩溃恢复
  - 实现代理失败恢复
  - 恢复时保留指纹配置和代理设置
  - _Requirements: 28.2, 29.3-29.5_

- [x] 5.4 编写自动恢复的属性测试


  - **Property 38: 崩溃自动恢复**
  - **Validates: Requirements 28.2, 27.5**

- [x] 5.5 实现资源监控

  - 实现 CPU 使用率监控
  - 实现内存使用监控
  - 实现资源过载检测
  - 实现新账号启动限制
  - _Requirements: 28.3-28.6_

- [x] 5.6 编写资源监控的属性测试


  - **Property 39: 资源过载限制**
  - **Validates: Requirements 28.5, 28.6**

- [x] 5.7 实现代理自动重连

  - 实现指数退避算法（1s、2s、4s、8s、16s）
  - 实现重连计数器（最多 5 次）
  - 实现重连期间的 KillSwitch 保持
  - 实现重连成功后的 IP 验证
  - _Requirements: 30.1-30.9_

- [x] 5.8 编写代理重连的属性测试


  - **Property 31: KillSwitch 触发及时性**
  - **Property 32: KillSwitch 阻止完整性**
  - **Property 33: 代理重连指数退避**
  - **Validates: Requirements 30.1-30.4**

- [x] 5.9 实现零信任网络模型

  - 实现默认禁止直连
  - 实现出口 IP 验证
  - 实现直连尝试检测和阻止
  - 实现安全日志记录
  - _Requirements: 36.1-36.7_

- [x] 5.10 编写零信任模型的属性测试


  - **Property 34: 出口 IP 验证正确性**
  - **Property 35: 直连尝试阻止**
  - **Validates: Requirements 36.3-36.5**

- [x] 5.11 Checkpoint - 确保所有测试通过


  - 确保所有测试通过，询问用户是否有问题

## Phase 6: UI 和用户体验（2 周）

- [x] 6. 实现指纹配置界面







  - 创建指纹配置 UI 组件
  - 实现浏览器选择下拉菜单
  - 实现 WebGL 配置表单
  - 实现 Canvas/Audio 配置表单
  - 实现环境属性配置表单
  - 实现设备信息配置表单
  - 实现"一键生成指纹"按钮
  - 实现"应用"和"取消"按钮
  - _Requirements: 15.1-15.6_

- [x] 6.1 实现代理配置界面增强

  - 实现代理列表显示
  - 实现"添加代理"表单
  - 实现"检测代理服务"按钮
  - 实现"检测当前网络"按钮
  - 实现"智能填写"文本框
  - 实现代理选择下拉菜单
  - _Requirements: 2.1-2.6_

- [x] 6.2 编写智能填写的属性测试


  - **Property 10: 智能填写解析正确性**
  - **Property 11: 智能填写格式兼容性**
  - **Validates: Requirements 2.5, 17.1-17.3**

- [x] 6.3 实现账号状态监控界面


  - 实现代理状态图标（绿色/黄色/红色）
  - 实现代理状态详情悬停提示
  - 实现心跳状态显示
  - 实现资源使用显示（CPU、内存）
  - _Requirements: 16.4-16.5, 29.6_

- [x] 6.4 实现指纹随机化策略配置


  - 实现策略选择（固定/每次随机/定期更换/部分随机）
  - 实现定期更换间隔设置
  - 实现部分随机字段选择
  - _Requirements: 33.1-33.6_

- [x] 6.5 编写指纹随机化策略的属性测试


  - **Property 42: 固定指纹不变性**
  - **Property 43: 每次启动随机不可预测性**
  - **Property 44: 定期更换时间准确性**
  - **Validates: Requirements 33.1-33.3**

- [x] 6.6 实现指纹配置版本管理界面


  - 实现配置历史列表显示
  - 实现历史版本详情查看
  - 实现"恢复此版本"按钮
  - _Requirements: 31.1-31.6_

- [x] 6.7 编写版本管理的属性测试


  - **Property 53: 配置历史完整性**
  - **Property 54: 版本恢复正确性**
  - **Validates: Requirements 31.1, 31.5**

- [x] 6.8 实现代理与指纹智能匹配


  - 实现"智能匹配"开关
  - 实现 IP 地理位置查询
  - 实现基于 IP 的参数自动调整
  - 实现代理更换时的提示
  - _Requirements: 14.1-14.5, 35.1-35.6_

- [x] 6.9 编写智能匹配的属性测试




  - **Property 45: 基于 IP 的时区自动匹配**
  - **Property 46: 基于 IP 的语言自动匹配**
  - **Validates: Requirements 35.2, 14.2**


- [x] 6.10 实现端口扫描保护配置


  - 实现端口扫描保护开关
  - 实现保护规则配置
  - _Requirements: 18.1-18.5_

- [x] 6.11 编写端口扫描保护的属性测试


  - **Property 47: 本地地址连接阻止**
  - **Property 48: 敏感端口连接阻止**
  - **Validates: Requirements 18.2, 18.3**

- [x] 6.12 实现 IPC 处理器


  - 创建 `src/presentation/ipc/handlers/FingerprintHandlers.ts`
  - 创建 `src/presentation/ipc/handlers/ProxyRelayHandlers.ts`
  - 创建 `src/presentation/ipc/handlers/DetectionHandlers.ts`
  - 实现所有 IPC 通信接口
  - _Requirements: 所有 UI 相关需求_

- [x] 6.13 实现代理列表管理


  - 实现代理固定绑定到账号
  - 实现代理更换时的资源清理
  - 实现代理状态显示
  - _Requirements: 34.1-34.6_

- [x] 6.14 编写代理列表管理的属性测试


  - **Property 55: 代理固定绑定不变性**
  - **Property 56: 代理更换资源清理**
  - **Validates: Requirements 34.2-34.4**

- [x] 6.15 Final Checkpoint - 确保所有测试通过


  - 确保所有测试通过，询问用户是否有问题
  - 进行完整的端到端测试
  - 验证所有 56 个正确性属性
