# Implementation Plan

- [x] 1. 增强 ViewManager 核心功能


  - 实现账号手动打开和关闭的核心逻辑
  - _Requirements: 3.1, 3.2, 5.1, 5.2_

- [x] 1.1 实现 openAccount 方法


  - 在 ViewManager 中添加 openAccount 方法
  - 实现账号 ID 验证
  - 实现账号数量限制检查
  - 调用 createView 创建 BrowserView
  - 调用 showView 显示 BrowserView
  - 实现错误处理和通知
  - _Requirements: 3.1, 3.2, 10.5_

- [x] 1.2 编写 openAccount 的属性测试
  - **Property 4: 打开账号创建 WebView**
  - **Validates: Requirements 3.1, 3.2**

- [x] 1.3 实现 closeAccount 方法

  - 在 ViewManager 中添加 closeAccount 方法
  - 实现账号状态检查
  - 处理当前活动账号的切换
  - 调用 destroyView 销毁 BrowserView
  - 实现错误处理和通知
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 1.4 编写 closeAccount 的属性测试
  - **Property 7: 关闭账号销毁 WebView**
  - **Validates: Requirements 5.1, 5.2, 5.4**

- [x] 1.5 实现账号状态查询方法

  - 实现 getAccountRunningStatus 方法
  - 实现 isAccountRunning 方法
  - 添加状态映射逻辑
  - _Requirements: 6.1, 6.5_

- [ ]* 1.6 编写状态查询的属性测试
  - **Property 9: 状态指示器显示**
  - **Validates: Requirements 6.1, 6.5**

- [x] 2. 实现状态管理和转换

  - 实现账号状态的正确转换逻辑
  - _Requirements: 3.3, 3.4, 5.3_

- [x] 2.1 增强 ViewManager 的状态跟踪

  - 在 createView 中添加状态更新逻辑（未启动 → 加载中）
  - 在 did-finish-load 事件中更新状态（加载中 → 已连接）
  - 在 did-fail-load 事件中更新状态（加载中 → 错误）
  - 在 destroyView 中更新状态（已连接 → 未启动）
  - _Requirements: 3.3, 3.4, 5.3_

- [x] 2.2 编写状态转换的属性测试
  - **Property 5: 打开账号的状态转换**
  - **Validates: Requirements 3.3, 3.4**

- [x] 2.3 编写关闭状态转换的属性测试
  - **Property 8: 关闭账号的状态转换**
  - **Validates: Requirements 5.3**

- [x] 3. 实现 IPC 通信接口



  - 实现主进程与渲染进程之间的通信
  - _Requirements: 3.1, 5.1_

- [x] 3.1 创建 IPC 处理器

  - 在 ipcHandlers.js 中实现 open-account 处理器
  - 实现 close-account 处理器
  - 实现 get-account-status 处理器
  - 实现 get-all-account-statuses 处理器
  - 添加错误处理
  - _Requirements: 3.1, 5.1, 6.1_

- [x] 3.2 实现事件通知机制

  - 在 ViewManager 中添加 account-opening 事件通知
  - 添加 account-opened 事件通知
  - 添加 account-open-failed 事件通知
  - 添加 account-closing 事件通知
  - 添加 account-closed 事件通知
  - 添加 account-close-failed 事件通知
  - _Requirements: 9.1, 9.2, 12.1_

- [ ]* 3.3 编写 IPC 通信的单元测试
  - 测试 open-account IPC 处理
  - 测试 close-account IPC 处理
  - 测试 get-account-status IPC 处理
  - 测试错误情况下的 IPC 响应
  - _Requirements: 3.1, 5.1_

- [x] 4. 更新 UI 组件



  - 更新账号列表 UI 以支持手动控制
  - _Requirements: 2.1, 2.2, 4.1, 4.2, 12.1_

- [x] 4.1 更新账号列表项渲染逻辑

  - 修改 sidebar.js 中的 renderAccountItem 函数
  - 添加打开按钮（仅在未启动时显示）
  - 添加关闭按钮（仅在已连接时显示）
  - 添加加载指示器（仅在加载中时显示）
  - 添加错误指示器（仅在错误时显示）
  - 更新状态指示器样式
  - _Requirements: 2.1, 2.2, 4.1, 4.2, 6.2, 6.3, 6.4, 12.1_

- [ ]* 4.2 编写 UI 渲染的属性测试
  - **Property 3: 按钮显示基于账号状态**
  - **Validates: Requirements 2.1, 2.2, 4.1, 4.2**

- [x] 4.3 实现按钮事件处理

  - 实现 handleOpenAccount 函数
  - 实现 handleCloseAccount 函数
  - 实现 handleRetryAccount 函数
  - 添加 UI 状态更新逻辑
  - _Requirements: 3.1, 5.1, 9.5_

- [x] 4.4 实现事件监听器

  - 添加 onAccountStatusChanged 监听器
  - 添加 onAccountOpened 监听器
  - 添加 onAccountClosed 监听器
  - 添加 onAccountOperationFailed 监听器
  - 实现 updateAccountItemStatus 函数
  - _Requirements: 6.5, 12.3, 12.4_

- [x] 4.5 添加 CSS 样式

  - 在 styles.css 中添加打开/关闭按钮样式
  - 添加加载指示器样式和动画
  - 添加错误指示器样式
  - 添加状态指示器样式（不同状态的颜色）
  - 添加按钮禁用状态样式
  - _Requirements: 2.3, 4.3, 12.1, 12.2_

- [ ]* 4.6 编写 UI 反馈的属性测试
  - **Property 21: 操作时显示加载指示器**
  - **Validates: Requirements 12.1, 12.2**

- [ ]* 4.7 编写 UI 更新的属性测试
  - **Property 22: 操作完成后更新 UI**
  - **Validates: Requirements 12.3, 12.4**

- [x] 5. 实现自动启动功能



  - 添加账号自动启动配置和逻辑
  - _Requirements: 11.1, 11.2, 11.3_



- [x] 5.1 扩展 AccountConfig 模型

  - 在 AccountConfig.js 中添加 autoStart 字段（默认 false）
  - 添加 keepAlive 字段（默认 true）
  - 添加 lastRunningStatus 字段
  - 更新 validate 方法
  - 更新 toJSON 和 fromJSON 方法
  - _Requirements: 11.1_

- [x] 5.2 编写 AccountConfig 扩展的属性测试
  - **Property 18: 自动启动配置存在**
  - **Validates: Requirements 11.1**

- [x] 5.3 实现应用启动时的自动启动逻辑



  - 在 main.js 中添加启动时的账号检查
  - 遍历所有账号，检查 autoStart 配置
  - 对 autoStart 为 true 的账号调用 openAccount
  - 添加错误处理（单个账号失败不影响其他账号）
  - _Requirements: 11.2, 11.3_

- [x] 5.4 编写自动启动的属性测试
  - **Property 19: 自动启动行为**
  - **Validates: Requirements 11.2, 11.3**

- [x] 5.5 添加自动启动配置 UI


  - 在账号设置对话框中添加"自动启动"复选框
  - 实现配置保存逻辑
  - 实现配置加载逻辑
  - _Requirements: 11.4_

- [x] 5.6 编写自动启动配置持久化的属性测试
  - **Property 20: 自动启动配置持久化**
  - **Validates: Requirements 11.5**

- [x] 6. 实现会话持久化和恢复



  - 确保关闭账号后会话数据保留
  - _Requirements: 7.1, 7.2, 7.3, 7.4_



- [x] 6.1 验证会话数据持久化

  - 确认 destroyView 不删除会话数据目录
  - 确认 SessionManager 保留会话数据
  - 添加日志记录会话数据路径
  - _Requirements: 7.1, 7.2_

- [x] 6.2 编写会话持久化的属性测试
  - **Property 10: 会话数据持久化**
  - **Validates: Requirements 7.1, 7.2**

- [x] 6.3 测试会话恢复


  - 测试关闭后重新打开账号
  - 验证登录状态是否保留
  - 验证聊天记录是否保留
  - _Requirements: 7.3, 7.4_

- [x] 6.4 编写会话恢复的属性测试
  - **Property 11: 会话恢复往返**
  - **Validates: Requirements 7.3, 7.4, 7.5**

- [x] 7. 实现多账号独立性
  - 确保账号操作的独立性
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 7.1 编写多账号并发的属性测试
  - **Property 12: 多账号并发打开**
  - **Validates: Requirements 8.1**

- [x] 7.2 编写账号独立性的属性测试
  - **Property 13: 账号操作独立性**
  - **Validates: Requirements 8.2, 8.3, 8.4**

- [x] 7.3 编写操作顺序独立性的属性测试
  - **Property 14: 操作顺序独立性**
  - **Validates: Requirements 8.5**

- [x] 8. 实现错误处理和恢复
  - 完善错误处理逻辑
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 8.1 增强错误状态管理
  - 在 openAccount 失败时设置错误状态
  - 在 closeAccount 失败时设置错误状态
  - 在 UI 中显示错误指示器
  - 添加错误消息显示
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 8.2 编写错误状态的属性测试
  - **Property 15: 错误状态转换**
  - **Validates: Requirements 9.3, 9.4**

- [x] 8.3 实现重试机制
  - 在错误指示器上添加点击重试功能
  - 实现 handleRetryAccount 函数
  - 清除错误状态后重新尝试操作
  - _Requirements: 9.5_

- [x] 8.4 编写错误恢复的属性测试
  - **Property 16: 错误后可重试**
  - **Validates: Requirements 9.5**

- [x] 9. 实现性能优化和限制
  - 添加性能优化和资源限制
  - _Requirements: 10.5_

- [x] 9.1 实现账号数量限制
  - 在 ViewManager 构造函数中添加 maxConcurrentViews 选项（默认 10）
  - 在 openAccount 中检查账号数量限制
  - 超过限制时返回错误
  - 在 UI 中显示限制提示
  - _Requirements: 10.5_

- [x] 9.2 编写账号数量限制的属性测试
  - **Property 17: 账号数量限制**
  - **Validates: Requirements 10.5**

- [ ] 9.3 添加内存监控
  - 实现内存使用监控
  - 在账号列表中显示内存使用情况（可选）
  - 超过阈值时警告用户
  - _Requirements: 5.5_

- [x] 10. 更新 preload 脚本
  - 更新 preload-main.js 以暴露新的 API
  - _Requirements: 3.1, 5.1_

- [x] 10.1 添加 API 方法
  - 添加 window.api.openAccount 方法
  - 添加 window.api.closeAccount 方法
  - 添加 window.api.getAccountStatus 方法
  - 添加 window.api.getAllAccountStatuses 方法
  - _Requirements: 3.1, 5.1_

- [x] 10.2 添加事件监听器
  - 添加 window.api.onAccountStatusChanged 监听器
  - 添加 window.api.onAccountOpened 监听器
  - 添加 window.api.onAccountClosed 监听器
  - 添加 window.api.onAccountOperationFailed 监听器
  - _Requirements: 6.5, 12.3_

- [x] 11. 更新应用启动逻辑
  - 修改应用启动时的行为
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 11.1 禁用自动加载
  - 在 main.js 中移除或注释掉自动创建 WebView 的代码
  - 确保应用启动时只显示账号列表，不创建任何 BrowserView
  - _Requirements: 1.2, 1.3_

- [x] 11.2 编写应用启动行为的属性测试
  - **Property 1: 应用启动时不自动创建 WebView**
  - **Validates: Requirements 1.2, 1.3**

- [x] 11.3 编写初始状态的属性测试
  - **Property 2: 初始账号状态为未启动**
  - **Validates: Requirements 1.4**

- [x] 12. 集成测试和验证
  - 确保所有功能正常工作
  - _Requirements: All_

- [x] 12.1 编写端到端集成测试
  - 测试完整的账号打开/关闭流程
  - 测试多账号并发操作
  - 测试自动启动功能
  - 测试会话持久化和恢复
  - 测试错误处理和恢复
  - _Requirements: All_

- [ ] 12.2 性能测试
  - 测试应用启动时间
  - 测试账号打开/关闭延迟
  - 测试内存使用情况
  - 测试多账号并发性能
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 12.3 用户验收测试
  - 手动测试所有用户工作流
  - 验证 UI 交互的流畅性
  - 验证错误消息的清晰性
  - 收集用户反馈
  - _Requirements: All_

- [x] 13. 文档和清理
  - 更新文档和清理代码
  - _Requirements: All_

- [ ] 13.1 更新代码注释
  - 为新方法添加 JSDoc 注释
  - 更新现有方法的注释
  - 添加使用示例
  - _Requirements: All_

- [x] 13.2 更新用户文档
  - 更新 README.md 说明新功能
  - 添加使用指南
  - 添加常见问题解答
  - _Requirements: All_

- [ ] 13.3 代码清理
  - 移除调试代码
  - 优化代码结构
  - 统一代码风格
  - _Requirements: All_

- [x] 14. 最终检查点
  - 确保所有测试通过，询问用户是否有问题
  - 已创建最终检查清单 (FINAL_CHECKLIST.md)
  - 项目状态：✅ 生产就绪
