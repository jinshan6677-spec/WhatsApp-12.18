# Implementation Plan

## Overview

本实现计划将本地多实例浏览器隔离架构分解为一系列可执行的编码任务。每个任务都是独立且可测试的，按照依赖关系逐步构建完整的多账号管理系统。

## Tasks

- [x] 1. 创建核心数据模型和配置管理





  - 实现 AccountConfig 数据模型的 TypeScript 接口定义
  - 创建 AccountConfigManager 类，实现账号配置的加载、保存、删除功能
  - 使用 electron-store 持久化账号配置到本地文件
  - 实现配置验证逻辑，确保代理和翻译配置的有效性
  - _Requirements: 1.5, 3.1, 4.1, 9.1_

- [x] 2. 实现 Instance Manager 核心功能





- [x] 2.1 创建 InstanceManager 类基础结构


  - 实现 InstanceManager 类的构造函数和基本属性
  - 创建实例状态管理的 Map 数据结构
  - 实现 getInstanceStatus() 和 getRunningInstances() 方法
  - _Requirements: 2.1, 2.2, 8.1_

- [x] 2.2 实现独立浏览器实例创建逻辑


  - 实现 createInstance() 方法，为每个账号创建独立的 BrowserWindow
  - 配置独立的 userDataDir 路径（profiles/account_{uuid}）
  - 使用 session.fromPartition() 创建独立的 session
  - 设置正确的 webPreferences（nodeIntegration: false, contextIsolation: true, sandbox: true）
  - 配置 User-Agent 以支持 WhatsApp Web
  - _Requirements: 2.1, 3.1, 3.2, 5.1, 5.2_

- [x] 2.3 实现代理配置功能


  - 在 createInstance() 中实现代理配置逻辑
  - 使用 session.setProxy() 为每个实例设置独立代理
  - 支持 SOCKS5、HTTP、HTTPS 代理协议
  - 实现代理认证（用户名/密码）
  - 处理代理连接失败的错误情况
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2.4 实现实例销毁和重启功能


  - 实现 destroyInstance() 方法，优雅关闭 BrowserWindow
  - 清理实例相关的事件监听器和资源
  - 实现 restartInstance() 方法，先销毁再创建实例
  - 保存实例状态以便重启后恢复
  - _Requirements: 7.2, 7.3_

- [x] 3. 实现翻译系统集成





- [x] 3.1 创建 TranslationIntegration 类


  - 实现 TranslationIntegration 类的基础结构
  - 为每个实例维护独立的翻译配置
  - 实现 injectScripts() 方法，在 did-finish-load 事件中注入翻译脚本
  - 复用现有的 contentScript.js 和 contentScriptWithOptimizer.js
  - _Requirements: 6.1, 6.2, 6.5_

- [x] 3.2 实现每个实例的独立翻译配置


  - 实现 configureTranslation() 方法，为每个实例应用独立的翻译设置
  - 通过 IPC 通信将翻译配置传递给渲染进程
  - 支持动态更新翻译配置而无需重启实例
  - 为每个实例维护独立的翻译缓存
  - _Requirements: 6.3, 6.4, 9.3, 9.4_

- [x] 4. 实现实例监控和健康检查




- [x] 4.1 实现实例状态监控


  - 创建 setupInstanceMonitoring() 方法
  - 监听 BrowserWindow 的 crashed、unresponsive、closed 事件
  - 实现心跳检测机制，定期检查实例是否响应
  - 记录实例的内存和 CPU 使用情况
  - _Requirements: 8.1, 8.2, 8.4_

- [x] 4.2 实现崩溃处理和自动重启


  - 创建 ErrorHandler 类处理各种错误情况
  - 实现崩溃计数器，跟踪每个实例的崩溃次数
  - 实现自动重启逻辑（崩溃次数 < 3 时）
  - 超过阈值后标记实例为 "failed" 并停止自动重启
  - 记录详细的错误日志
  - _Requirements: 2.3, 7.5, 8.1, 8.5_

- [x] 5. 创建主应用窗口和账号管理 UI




- [x] 5.1 设计和实现主窗口 HTML/CSS


  - 创建主窗口的 HTML 结构（index.html）
  - 实现账号列表视图的 UI 布局
  - 设计账号卡片组件，显示账号名称、状态、最后活跃时间
  - 添加"添加账号"、"启动"、"停止"、"重启"、"删除"按钮
  - 实现响应式布局和主题支持（light/dark）
  - _Requirements: 1.1, 1.2, 10.1_

- [x] 5.2 实现账号列表渲染逻辑


  - 创建 MainApplicationWindow 类
  - 实现 renderAccountList() 方法，动态渲染账号列表
  - 实现 updateAccountStatus() 方法，实时更新账号状态显示
  - 添加状态指示器（stopped/starting/running/error）
  - 实现未读消息计数的显示
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 5.3 实现账号配置对话框

  - 创建账号配置对话框的 UI（模态窗口或侧边栏）
  - 实现账号名称、代理设置、翻译设置的表单
  - 添加表单验证逻辑
  - 实现"保存"和"取消"按钮的事件处理
  - 支持编辑现有账号和创建新账号
  - _Requirements: 1.3, 4.1, 9.1_

- [x] 5.4 实现账号操作功能


  - 实现"添加账号"按钮的点击事件，生成唯一 UUID
  - 实现"删除账号"按钮的点击事件，删除配置和 userDataDir
  - 实现"启动"按钮，调用 InstanceManager.createInstance()
  - 实现"停止"按钮，调用 InstanceManager.destroyInstance()
  - 实现"重启"按钮，调用 InstanceManager.restartInstance()
  - _Requirements: 1.2, 1.4, 7.1, 7.2, 7.3_

- [x] 6. 实现 IPC 通信机制





- [x] 6.1 定义主进程和渲染进程之间的 IPC 通道


  - 定义账号管理相关的 IPC 通道（account:create, account:delete, account:update）
  - 定义实例控制相关的 IPC 通道（instance:start, instance:stop, instance:restart）
  - 定义状态同步相关的 IPC 通道（status:update, status:request）
  - 定义翻译配置相关的 IPC 通道（translation:config, translation:status）
  - _Requirements: 1.2, 7.1, 9.3_

- [x] 6.2 实现主进程的 IPC 处理器

  - 在主进程中注册所有 IPC 处理器
  - 实现账号 CRUD 操作的处理逻辑
  - 实现实例控制操作的处理逻辑
  - 实现错误处理和响应返回
  - _Requirements: 1.2, 7.1, 7.2, 7.3_

- [x] 6.3 实现渲染进程的 IPC 调用

  - 在 preload.js 中暴露安全的 IPC API
  - 在主窗口的渲染进程中实现 IPC 调用逻辑
  - 处理 IPC 响应和错误
  - 实现状态更新的监听和 UI 刷新
  - _Requirements: 10.3_

- [x] 7. 实现会话持久化功能






- [x] 7.1 实现会话数据的自动保存

  - 确保每个实例的 session 数据保存在独立的 userDataDir
  - 配置 Electron session 的持久化选项
  - 实现登录状态的检测逻辑
  - _Requirements: 3.5, 12.1_


- [x] 7.2 实现会话恢复功能

  - 在启动实例时检查是否存在已保存的会话数据
  - 自动加载会话数据并尝试恢复登录状态
  - 处理会话过期的情况，显示二维码
  - 实现"清除会话"功能，强制重新登录
  - _Requirements: 12.2, 12.3, 12.5_

- [x] 8. 实现高级功能






- [x] 8.1 实现搜索和过滤功能


  - 在主窗口添加搜索框
  - 实现按账号名称搜索的逻辑
  - 实现按状态过滤的逻辑（显示所有/仅运行中/仅停止）
  - 实现排序功能（按名称/状态/最后活跃时间）
  - _Requirements: 10.4, 10.5_

- [x] 8.2 实现通知功能


  - 实现新消息通知的检测逻辑
  - 在主窗口的账号卡片上显示未读消息徽章
  - 实现系统通知（使用 Electron Notification API）
  - 支持通知的开关配置
  - _Requirements: 10.2_

- [x] 8.3 实现窗口位置和大小的保存恢复


  - 在实例关闭时保存窗口的位置和大小
  - 在实例启动时恢复窗口的位置和大小
  - 处理多显示器场景
  - _Requirements: AccountConfig.window_

- [x] 8.4 实现资源限制和优化


  - 实现最大并发实例数的限制
  - 实现延迟加载（lazy loading），按需启动实例
  - 监控系统资源使用，接近限制时显示警告
  - 实现实例池，复用已停止的实例资源
  - _Requirements: 11.1, 11.3, 11.4_

- [x] 9. 实现数据迁移功能



- [x] 9.1 创建迁移脚本





  - 检测是否存在旧的 session-data 目录
  - 将旧的会话数据迁移到 profiles/default 目录
  - 创建默认账号配置
  - 从现有配置文件加载翻译设置
  - _Requirements: Migration Strategy_

- [x] 9.2 实现首次启动向导





  - 检测是否为首次启动
  - 显示欢迎界面和迁移说明
  - 提供文档链接
  - 自动执行迁移流程
  - _Requirements: Migration Strategy_

- [x] 10. 实现系统托盘集成









- [x] 10.1 创建系统托盘图标和菜单






  - 创建 Tray 实例
  - 设计托盘菜单（显示/隐藏主窗口、退出应用）
  - 实现托盘图标的点击事件
  - 支持最小化到托盘的配置选项
  - _Requirements: appConfig.minimizeToTray_


- [x] 10.2 实现托盘通知

  - 在托盘图标上显示未读消息总数
  - 实现托盘气泡通知
  - 点击通知时聚焦到对应的账号窗口
  - _Requirements: 10.2_

- [x] 11. 更新主进程入口文件




- [x] 11.1 重构 main.js


  - 移除单实例的 BrowserWindow 创建逻辑
  - 初始化 AccountConfigManager
  - 初始化 InstanceManager
  - 初始化 MainApplicationWindow
  - 注册所有 IPC 处理器
  - 实现应用启动时的自动启动逻辑（如果配置了 autoStart）
  - _Requirements: 1.1, 1.5_

- [x] 11.2 实现应用清理逻辑


  - 在应用退出前关闭所有运行中的实例
  - 保存所有实例的状态
  - 清理临时资源
  - _Requirements: 7.2_

- [x] 12. 更新配置文件和依赖






- [x] 12.1 更新 package.json

  - 添加新的依赖（如果需要）
  - 更新 electron-builder 配置，包含 profiles 目录
  - 更新脚本命令
  - _Requirements: Deployment Considerations_

- [x] 12.2 更新 config.js


  - 添加多实例相关的配置选项
  - 定义 profiles 目录路径
  - 定义最大并发实例数等参数
  - _Requirements: 11.3_

- [x] 13. 编写文档和示例






- [x] 13.1 更新 README.md

  - 添加多账号功能的说明
  - 更新使用指南
  - 添加代理配置示例
  - 添加常见问题解答
  - _Requirements: Documentation_

- [x] 13.2 创建用户指南


  - 编写详细的多账号使用教程
  - 添加截图和示例
  - 说明代理配置的最佳实践
  - 说明翻译配置的方法
  - _Requirements: Documentation_

- [x] 14. 编写测试





- [x] 14.1 编写单元测试






  - 测试 AccountConfigManager 的配置加载/保存/删除
  - 测试 InstanceManager 的实例创建/销毁逻辑
  - 测试代理配置验证逻辑
  - 测试翻译配置验证逻辑
  - _Requirements: Testing Strategy_

- [x] 14.2 编写集成测试






  - 测试完整的账号创建和启动流程
  - 测试代理配置的应用
  - 测试实例崩溃和重启
  - 测试多实例并发运行
  - _Requirements: Testing Strategy_

- [x] 14.3 执行性能测试






  - 测试同时运行 30 个实例的性能
  - 测量内存和 CPU 使用
  - 测量启动时间和响应延迟
  - 生成性能报告
  - _Requirements: 11.1, Testing Strategy_
