# Requirements Document

## Introduction

本文档定义了 WhatsApp Desktop 应用中手动控制账号启动和停止的功能需求。该功能允许用户在应用启动后，通过账号列表中的按钮手动打开或关闭特定的 WhatsApp 账号，而不是自动加载所有账号。这提供了更好的资源控制和用户体验。

## Glossary

- **应用程序（Application）**: WhatsApp Desktop 主应用程序
- **账号（Account）**: 配置的 WhatsApp 账号实例
- **账号列表（Account List）**: 显示所有已配置账号的侧边栏界面
- **WebView**: 用于加载 WhatsApp Web 的嵌入式浏览器视图组件
- **打开按钮（Open Button）**: 账号列表中用于启动 WhatsApp 会话的控制按钮
- **关闭按钮（Close Button）**: 账号列表中用于停止 WhatsApp 会话的控制按钮
- **账号状态（Account Status）**: 账号的当前运行状态（未启动、加载中、已连接、已关闭）
- **ViewManager**: 负责管理 BrowserView 实例的模块
- **会话（Session）**: 与特定账号关联的隔离浏览器环境

## Requirements

### Requirement 1: 应用启动时不自动加载账号

**User Story:** 作为用户，我希望应用启动时不自动打开任何 WhatsApp 账号，这样我可以节省系统资源并选择性地打开需要的账号。

#### Acceptance Criteria

1. WHEN 应用程序启动时 THEN 系统 SHALL 显示主窗口和账号列表
2. WHEN 应用程序启动时 THEN 系统 SHALL NOT 自动创建任何账号的 WebView
3. WHEN 应用程序启动时 THEN 系统 SHALL NOT 自动加载任何 WhatsApp Web 页面
4. WHEN 账号列表显示时 THEN 系统 SHALL 显示所有账号的状态为"未启动"
5. WHEN 应用程序启动时 THEN 系统 SHALL 保持内存占用在最小水平

### Requirement 2: 账号列表显示打开按钮

**User Story:** 作为用户，我希望在账号列表中看到每个账号旁边的"打开"按钮，这样我可以手动启动需要使用的账号。

#### Acceptance Criteria

1. WHEN 账号状态为"未启动"时 THEN 账号列表 SHALL 显示"打开"按钮
2. WHEN 账号状态为"加载中"或"已连接"时 THEN 账号列表 SHALL NOT 显示"打开"按钮
3. THE "打开"按钮 SHALL 清晰可见且易于点击
4. THE "打开"按钮 SHALL 使用直观的图标或文字标识
5. WHEN 鼠标悬停在"打开"按钮上时 THEN 系统 SHALL 显示提示信息

### Requirement 3: 手动打开账号功能

**User Story:** 作为用户，我希望点击"打开"按钮后能够启动对应的 WhatsApp 账号，这样我可以开始使用该账号。

#### Acceptance Criteria

1. WHEN 用户点击"打开"按钮时 THEN ViewManager SHALL 为该账号创建 WebView
2. WHEN WebView 创建后 THEN 系统 SHALL 加载 WhatsApp Web 页面
3. WHEN 加载开始时 THEN 账号状态 SHALL 更新为"加载中"
4. WHEN WhatsApp Web 成功加载后 THEN 账号状态 SHALL 更新为"已连接"
5. WHEN 账号打开时 THEN 系统 SHALL 在会话区域显示该账号的 WebView

### Requirement 4: 账号列表显示关闭按钮

**User Story:** 作为用户，我希望在已打开的账号旁边看到"关闭"按钮，这样我可以停止不需要使用的账号以释放资源。

#### Acceptance Criteria

1. WHEN 账号状态为"已连接"时 THEN 账号列表 SHALL 显示"关闭"按钮
2. WHEN 账号状态为"未启动"时 THEN 账号列表 SHALL NOT 显示"关闭"按钮
3. THE "关闭"按钮 SHALL 清晰可见且易于点击
4. THE "关闭"按钮 SHALL 使用直观的图标或文字标识
5. WHEN 鼠标悬停在"关闭"按钮上时 THEN 系统 SHALL 显示提示信息

### Requirement 5: 手动关闭账号功能

**User Story:** 作为用户，我希望点击"关闭"按钮后能够停止对应的 WhatsApp 账号，这样我可以释放系统资源。

#### Acceptance Criteria

1. WHEN 用户点击"关闭"按钮时 THEN ViewManager SHALL 销毁该账号的 WebView
2. WHEN WebView 销毁时 THEN 系统 SHALL 断开 WhatsApp Web 连接
3. WHEN 关闭完成后 THEN 账号状态 SHALL 更新为"未启动"
4. WHEN 账号关闭时 THEN 系统 SHALL 从会话区域移除该账号的 WebView
5. WHEN 账号关闭时 THEN 系统 SHALL 释放该账号占用的内存资源

### Requirement 6: 账号状态指示

**User Story:** 作为用户，我希望清楚地看到每个账号的当前状态，这样我可以了解哪些账号正在运行，哪些已关闭。

#### Acceptance Criteria

1. THE 账号列表 SHALL 为每个账号显示状态指示器
2. WHEN 账号未启动时 THEN 状态指示器 SHALL 显示灰色或"未启动"标识
3. WHEN 账号加载中时 THEN 状态指示器 SHALL 显示加载动画或"加载中"标识
4. WHEN 账号已连接时 THEN 状态指示器 SHALL 显示绿色或"在线"标识
5. WHEN 账号状态变化时 THEN 状态指示器 SHALL 实时更新

### Requirement 7: 会话数据持久化

**User Story:** 作为用户，我希望关闭账号后再次打开时，登录状态和聊天记录仍然保留，这样我不需要重新扫码登录。

#### Acceptance Criteria

1. WHEN 账号关闭时 THEN SessionManager SHALL 保留该账号的会话数据
2. WHEN 账号关闭时 THEN 系统 SHALL 保存 cookies、localStorage 和 IndexedDB 数据
3. WHEN 账号重新打开时 THEN SessionManager SHALL 恢复之前的会话数据
4. WHEN 账号重新打开时 THEN WhatsApp Web SHALL 自动恢复登录状态
5. WHEN 账号重新打开时 THEN 用户 SHALL NOT 需要重新扫描 QR 码

### Requirement 8: 多账号独立控制

**User Story:** 作为用户，我希望能够独立地打开和关闭不同的账号，这样我可以灵活地管理多个账号的使用。

#### Acceptance Criteria

1. THE 系统 SHALL 允许同时打开多个账号
2. THE 系统 SHALL 允许关闭任意已打开的账号而不影响其他账号
3. WHEN 一个账号打开或关闭时 THEN 其他账号的状态 SHALL 保持不变
4. WHEN 一个账号打开或关闭时 THEN 其他账号的连接 SHALL 不受影响
5. THE 系统 SHALL 支持任意顺序的账号打开和关闭操作

### Requirement 9: 错误处理

**User Story:** 作为用户，我希望在账号打开或关闭失败时能够看到清晰的错误提示，这样我可以了解问题并采取相应措施。

#### Acceptance Criteria

1. WHEN 账号打开失败时 THEN 系统 SHALL 显示错误消息
2. WHEN 账号关闭失败时 THEN 系统 SHALL 显示错误消息
3. WHEN 发生错误时 THEN 账号状态 SHALL 更新为"错误"状态
4. WHEN 发生错误时 THEN 系统 SHALL 在账号列表中显示错误指示器
5. WHEN 错误发生后 THEN 用户 SHALL 能够重试打开或关闭操作

### Requirement 10: 性能优化

**User Story:** 作为用户，我希望打开和关闭账号的操作响应迅速，这样我可以获得流畅的使用体验。

#### Acceptance Criteria

1. WHEN 用户点击"打开"按钮时 THEN 系统 SHALL 在 2 秒内开始加载 WhatsApp Web
2. WHEN 用户点击"关闭"按钮时 THEN 系统 SHALL 在 1 秒内完成 WebView 销毁
3. WHEN 账号关闭时 THEN 系统 SHALL 立即释放至少 80% 的该账号占用内存
4. WHEN 多个账号同时操作时 THEN 系统 SHALL 保持界面响应性
5. THE 系统 SHALL 限制同时打开的账号数量以避免性能问题

### Requirement 11: 用户偏好设置

**User Story:** 作为用户，我希望能够配置某些账号在应用启动时自动打开，这样我可以为常用账号设置自动启动。

#### Acceptance Criteria

1. THE AccountManager SHALL 为每个账号提供"自动启动"配置选项
2. WHEN 账号的"自动启动"选项启用时 THEN 应用启动时 SHALL 自动打开该账号
3. WHEN 账号的"自动启动"选项禁用时 THEN 应用启动时 SHALL NOT 自动打开该账号
4. THE 用户 SHALL 能够通过账号设置界面修改"自动启动"选项
5. THE "自动启动"配置 SHALL 在应用重启后保持有效

### Requirement 12: 视觉反馈

**User Story:** 作为用户，我希望在执行打开或关闭操作时看到清晰的视觉反馈，这样我可以确认操作正在进行。

#### Acceptance Criteria

1. WHEN 用户点击"打开"或"关闭"按钮时 THEN 系统 SHALL 显示加载指示器
2. WHEN 操作进行中时 THEN 按钮 SHALL 显示为禁用状态
3. WHEN 操作完成时 THEN 系统 SHALL 移除加载指示器
4. WHEN 操作完成时 THEN 按钮状态 SHALL 更新为新的可用状态
5. WHEN 操作失败时 THEN 系统 SHALL 显示错误动画或提示
