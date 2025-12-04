# 实现计划

## 任务列表

- [x] 1. 在 WhatsAppTranslation 对象中实现配置更新方法





  - [x] 1.1 实现 deepMerge 方法


    - 在 `src/presentation/translation/content-script/index.js` 中添加 `deepMerge` 方法
    - 实现递归深度合并逻辑，正确处理嵌套对象
    - 确保数组不被合并而是直接覆盖
    - _需求: 7.1_


  - [x] 1.2 编写 deepMerge 属性测试

    - **属性 1: 深度合并保持结构完整性**
    - **验证: 需求 7.1**
    - 使用 fast-check 生成任意配置对象
    - 验证合并结果包含两个对象的所有键

  - [x] 1.3 实现 updateConfig 方法


    - 在 `src/presentation/translation/content-script/index.js` 中添加 `updateConfig` 方法
    - 调用 `deepMerge` 合并新旧配置
    - 更新 `this.core.config` 和 `this.config`
    - 调用 `translationAPI.saveConfig` 保存到后端
    - 调用 `applyConfigChanges` 应用配置变更
    - 返回操作结果（成功/失败）
    - _需求: 7.1, 7.2, 7.3, 7.4_


  - [x] 1.4 实现 applyConfigChanges 方法

    - 在 `src/presentation/translation/content-script/index.js` 中添加 `applyConfigChanges` 方法
    - 清理并重新初始化 `inputBoxTranslator`
    - 重新设置中文拦截 (`domObserver.setupChineseBlock`)
    - 如果 `autoTranslate` 为 true，触发 `translateExistingMessages`
    - _需求: 7.2, 7.5, 7.6_


  - [x] 1.5 编写配置更新后状态一致性属性测试

    - **属性 8: 配置更新后状态一致性**
    - **验证: 需求 7.2, 8.2**
    - 验证更新后 `WhatsAppTranslation.config` 和 `WhatsAppTranslation.core.config` 一致

- [x] 2. 实现配置变更监听机制






  - [x] 2.1 实现 setupConfigListener 方法

    - 在 `src/presentation/translation/content-script/index.js` 中添加 `setupConfigListener` 方法
    - 调用 `translationAPI.onConfigChanged` 注册监听器
    - 在回调中更新配置并调用 `applyConfigChanges`
    - _需求: 8.4_


  - [x] 2.2 在 init 方法中调用 setupConfigListener

    - 修改 `init` 方法，在初始化完成后调用 `setupConfigListener`
    - 确保在所有模块初始化后再设置监听器
    - _需求: 8.4_

- [x] 3. 更新 IPC 处理器添加配置变更通知





  - [x] 3.1 修改 TranslationServiceIPCHandlers.js 的 saveConfig 方法


    - 在保存配置后，获取所有 BrowserView
    - 查找匹配 accountId 的视图
    - 发送 `translation:configChanged` 事件到对应视图
    - _需求: 8.1_

  - [x] 3.2 编写 IPC 配置同步单元测试


    - 测试 saveConfig 方法正确发送配置变更通知
    - 测试只通知匹配 accountId 的视图
    - _需求: 8.1, 8.2_

- [x] 4. 检查点 - 确保所有测试通过





  - 确保所有测试通过，如有问题请询问用户

- [x] 5. 验证功能开关即时生效

  - [x] 5.1 验证自动翻译开关
    - 测试开启/关闭自动翻译后消息翻译行为
    - 确保配置变更后立即生效
    - _需求: 1.1, 1.2_

  - [x] 5.2 编写自动翻译开关属性测试
    - **属性 2: 自动翻译开关控制翻译行为**
    - **验证: 需求 1.1, 1.2**
    - 生成任意配置状态，验证翻译行为与配置一致

  - [x] 5.3 验证群组翻译开关
    - 测试开启/关闭群组翻译后群聊消息翻译行为
    - 确保配置变更后立即生效
    - _需求: 1.3, 1.4_

  - [x] 5.4 编写群组翻译开关属性测试
    - **属性 3: 群组翻译开关控制群聊翻译**
    - **验证: 需求 1.3, 1.4**
    - 生成任意群聊消息和配置状态，验证翻译行为

  - [x] 5.5 验证输入框翻译按钮开关
    - 测试开启/关闭输入框翻译按钮后按钮显示/隐藏
    - 确保配置变更后立即生效
    - _需求: 2.1, 2.2_

  - [x] 5.6 验证中文拦截开关
    - 测试开启/关闭中文拦截后发送行为
    - 确保配置变更后立即生效
    - _需求: 3.1, 3.2_

  - [x] 5.7 编写中文拦截开关属性测试
    - **属性 4: 中文拦截开关控制发送行为**
    - **验证: 需求 3.1, 3.2**
    - 生成任意包含中文的文本和配置状态，验证拦截行为

  - [x] 5.8 验证实时翻译预览开关
    - 测试开启/关闭实时翻译预览后预览显示/隐藏
    - 确保配置变更后立即生效
    - _需求: 4.1, 4.2_

  - [x] 5.9 验证反向翻译验证开关

    - 测试开启/关闭反向翻译验证后验证显示/隐藏
    - 确保配置变更后立即生效
    - _需求: 4.3, 4.4_

- [x] 6. 验证好友独立配置功能





  - [x] 6.1 验证好友独立配置开关


    - 测试开启/关闭好友独立配置后配置选项显示/隐藏
    - 确保配置变更后立即生效
    - _需求: 5.1, 5.2_

  - [x] 6.2 编写好友独立配置优先级属性测试


    - **属性 5: 好友独立配置优先级**
    - **验证: 需求 5.3**
    - 生成任意联系人和配置状态，验证配置优先级

  - [x] 6.3 验证聊天切换时配置应用


    - 测试切换到有独立配置的聊天时配置正确应用
    - 测试切换到无独立配置的聊天时使用全局配置
    - _需求: 5.4, 10.3_

- [x] 7. 验证翻译引擎和语言设置





  - [x] 7.1 验证聊天窗口翻译引擎切换


    - 测试切换翻译引擎后新消息使用新引擎
    - 确保配置变更后立即生效
    - _需求: 6.1_


  - [x] 7.2 验证目标语言切换

    - 测试切换目标语言后新消息翻译到新语言
    - 确保配置变更后立即生效
    - _需求: 6.2_


  - [x] 7.3 验证输入框翻译引擎和风格切换

    - 测试切换输入框翻译引擎后使用新引擎
    - 测试切换翻译风格后使用新风格
    - _需求: 2.4, 2.6_

- [x] 8. 最终检查点 - 确保所有测试通过





  - 确保所有测试通过，如有问题请询问用户
