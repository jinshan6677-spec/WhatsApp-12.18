(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    global: {
      autoTranslate: false,
      engine: 'google',
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      groupTranslation: false
    },
    inputBox: {
      enabled: false,
      engine: 'google',
      style: '通用',
      targetLang: 'auto'
    },
    advanced: {
      friendIndependent: false,
      blockChinese: false,
      realtime: false,
      reverseTranslation: false,
      voiceTranslation: false,
      imageTranslation: false
    },
    friendConfigs: {}
  };

  function cloneDefaultConfig() {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  class TranslateSettingsPanel {
    constructor(options = {}) {
      this.host = options.host || null;
      this.placeholderEl = options.placeholderEl || null;
      this.onCollapse = options.onCollapse || null;
      this.getActiveChatInfo = options.getActiveChatInfo || (async () => ({}));
      this.applyConfigToView = options.applyConfigToView || (async () => ({ success: true }));
      this.accountId = null;
      this.panel = null;
      this.config = cloneDefaultConfig();
      this.currentEngine = null;
    }

    async init() {
      if (!this.host) {
        console.warn('[TranslateSettingsPanel] host element not provided');
        return;
      }
      this.injectStyles();
      this.createPanel();
      this.bindEvents();
    }

    injectStyles() {
      if (document.getElementById('translate-settings-styles')) {
        return;
      }
      const style = document.createElement('style');
      style.id = 'translate-settings-styles';
      style.textContent = `
.translate-settings-wrapper {
  width: 100%;
  height: 100%;
}

.translate-settings-wrapper .settings-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #ffffff;
  overflow: hidden;
}

.translate-settings-wrapper .settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.translate-settings-wrapper .settings-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.translate-settings-wrapper .settings-overlay {
  display: none;
}

.translate-settings-wrapper .settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  background: #fafbff;
}

.translate-settings-wrapper .settings-section {
  padding: 18px 20px;
  border-bottom: 1px solid #f1f3f7;
  background: #fff;
}

.translate-settings-wrapper .settings-section h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.translate-settings-wrapper .setting-item {
  margin-bottom: 14px;
}

.translate-settings-wrapper .setting-item:last-child {
  margin-bottom: 0;
}

.translate-settings-wrapper .setting-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  color: #111827;
}

.translate-settings-wrapper .setting-checkbox {
  width: 16px;
  height: 16px;
}

.translate-settings-wrapper .setting-title {
  font-size: 14px;
}

.translate-settings-wrapper .setting-desc {
  margin: 6px 0 0 26px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}

.translate-settings-wrapper .setting-select,
.translate-settings-wrapper .setting-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  margin-top: 6px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.translate-settings-wrapper .setting-select:focus,
.translate-settings-wrapper .setting-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.25);
}

.translate-settings-wrapper .setting-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: 13px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  cursor: pointer;
  transition: all 0.2s ease;
}

.translate-settings-wrapper .setting-button.primary {
  background: #25d366;
  border-color: #25d366;
  color: #fff;
}

.translate-settings-wrapper .setting-button.primary:hover {
  background: #1fb75a;
  border-color: #1fb75a;
}

.translate-settings-wrapper .setting-button.secondary {
  background: #fff;
}

.translate-settings-wrapper .setting-button.secondary:hover {
  border-color: #25d366;
  color: #128c7e;
}

.translate-settings-wrapper .settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 18px;
  border-top: 1px solid #f1f3f7;
  background: #fff;
}

.translate-settings-wrapper .api-test {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}

.translate-settings-wrapper .stats-content {
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  color: #374151;
}

.translate-settings-wrapper .stats-content .stat-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.translate-settings-wrapper .settings-message {
  position: absolute;
  right: 16px;
  bottom: 16px;
  padding: 10px 14px;
  border-radius: 8px;
  color: #111827;
  background: #e5f6ff;
  border: 1px solid #bae6fd;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.translate-settings-wrapper .settings-message.success {
  background: #ecfdf3;
  border-color: #bbf7d0;
}

.translate-settings-wrapper .settings-message.error {
  background: #fef2f2;
  border-color: #fecdd3;
  color: #991b1b;
}

/* Switch Styles */
.translate-settings-wrapper .switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.translate-settings-wrapper .switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.translate-settings-wrapper .slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e5e7eb;
  transition: .3s;
  border-radius: 22px;
  border: 1px solid #d1d5db;
}

.translate-settings-wrapper .slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.translate-settings-wrapper input:checked + .slider {
  background-color: #25d366;
  border-color: #25d366;
}

.translate-settings-wrapper input:checked + .slider:before {
  transform: translateX(18px);
}

.translate-settings-wrapper .save-status {
  font-size: 12px;
  color: #fff;
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 10px;
  border-radius: 12px;
  opacity: 0;
  transition: opacity 0.3s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.translate-settings-wrapper .save-status.visible {
  opacity: 1;
}
`;
      document.head.appendChild(style);
    }

    createPanel() {
      if (this.panel) return this.panel;
      this.panel = document.createElement('div');
      this.panel.className = 'translate-settings-wrapper';
      this.panel.innerHTML = `        <div class="settings-overlay"></div>
        <div class="settings-container">
          <div class="settings-header">
            <h2>🌐 翻译设置</h2>
            <div id="saveStatus" class="save-status">
              <span>✓</span> 已保存
            </div>
          </div>
          
          <div class="settings-content">
            <!-- 基础设置 -->
            <div class="settings-section">
              <h3>📝 基础设置</h3>
              
              <div class="setting-item">
                <label class="setting-label">
                  <label class="switch">
                    <input type="checkbox" id="autoTranslate">
                    <span class="slider"></span>
                  </label>
                  <span class="setting-title">自动翻译消息</span>
                </label>
              </div>
              
              <div class="setting-item">
                <label class="setting-label">
                  <label class="switch">
                    <input type="checkbox" id="groupTranslation">
                    <span class="slider"></span>
                  </label>
                  <span class="setting-title">群组消息翻译</span>
                </label>
              </div>
              
              <div class="setting-item">
                <label class="setting-title">聊天窗口翻译引擎（接收消息）</label>
                <select id="translationEngine" class="setting-select">
                  <option value="google">Google 翻译（免费，推荐）</option>
                  <option value="gpt4">GPT-4</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="custom">自定义 API</option>
                </select>
              </div>
              
              <div class="setting-item">
                <label class="setting-title">目标语言</label>
                <select id="targetLanguage" class="setting-select">
                  <option value="zh-CN">🇨🇳 中文简体</option>
                  <option value="zh-TW">🇹🇼 中文繁体</option>
                  <option value="en">🇬🇧 英语</option>
                  <option value="vi">🇻🇳 越南语</option>
                  <option value="ja">🇯🇵 日语</option>
                  <option value="ko">🇰🇷 韩语</option>
                  <option value="th">🇹🇭 泰语</option>
                  <option value="id">🇮🇩 印尼语</option>
                  <option value="ms">🇲🇾 马来语</option>
                  <option value="tl">🇵🇭 菲律宾语</option>
                  <option value="my">🇲🇲 缅甸语</option>
                  <option value="km">🇰🇭 高棉语</option>
                  <option value="lo">🇱🇦 老挝语</option>
                  <option value="es">🇪🇸 西班牙语</option>
                  <option value="fr">🇫🇷 法语</option>
                  <option value="de">🇩🇪 德语</option>
                  <option value="it">🇮🇹 意大利语</option>
                  <option value="pt">🇵🇹 葡萄牙语</option>
                  <option value="ru">🇷🇺 俄语</option>
                  <option value="ar">🇸🇦 阿拉伯语</option>
                  <option value="hi">🇮🇳 印地语</option>
                  <option value="bn">🇧🇩 孟加拉语</option>
                  <option value="ur">🇵🇰 乌尔都语</option>
                  <option value="tr">🇹🇷 土耳其语</option>
                  <option value="fa">🇮🇷 波斯语</option>
                  <option value="he">🇮🇱 希伯来语</option>
                  <option value="nl">🇳🇱 荷兰语</option>
                  <option value="pl">🇵🇱 波兰语</option>
                  <option value="uk">🇺🇦 乌克兰语</option>
                  <option value="cs">🇨🇿 捷克语</option>
                  <option value="ro">🇷🇴 罗马尼亚语</option>
                  <option value="sv">🇸🇪 瑞典语</option>
                  <option value="da">🇩🇰 丹麦语</option>
                  <option value="no">🇳🇴 挪威语</option>
                  <option value="fi">🇫🇮 芬兰语</option>
                  <option value="el">🇬🇷 希腊语</option>
                  <option value="hu">🇭🇺 匈牙利语</option>
                  <option value="bg">🇧🇬 保加利亚语</option>
                  <option value="sr">🇷🇸 塞尔维亚语</option>
                  <option value="hr">🇭🇷 克罗地亚语</option>
                  <option value="sk">🇸🇰 斯洛伐克语</option>
                  <option value="sl">🇸🇮 斯洛文尼亚语</option>
                  <option value="lt">🇱🇹 立陶宛语</option>
                  <option value="lv">🇱🇻 拉脱维亚语</option>
                  <option value="et">🇪🇪 爱沙尼亚语</option>
                  <option value="sw">🇰🇪 斯瓦希里语</option>
                  <option value="af">🇿🇦 南非荷兰语</option>
                  <option value="am">🇪🇹 阿姆哈拉语</option>
                </select>
                </select>
              </div>
            </div>
            
            <!-- 输入框设置 -->
            <div class="settings-section">
              <h3>✏️ 输入框翻译</h3>
              
              <div class="setting-item">
                <label class="setting-label">
                  <label class="switch">
                    <input type="checkbox" id="inputBoxEnabled">
                    <span class="slider"></span>
                  </label>
                  <span class="setting-title">启用输入框翻译按钮</span>
                </label>
              </div>
              
              <div class="setting-item">
                <label class="setting-title">输入框翻译引擎（发送消息）</label>
                <select id="inputBoxEngine" class="setting-select">
                  <option value="google">Google 翻译（免费）</option>
                  <option value="gpt4">GPT-4（支持风格）</option>
                  <option value="gemini">Google Gemini（支持风格）</option>
                  <option value="deepseek">DeepSeek（支持风格）</option>
                  <option value="custom">自定义 API（支持风格）</option>
                </select>
              </div>
              
              <div class="setting-item">
                <label class="setting-title">输入框翻译目标语言</label>
                <select id="inputBoxTargetLang" class="setting-select">
                  <option value="auto">🤖 自动检测（根据对方语言）</option>
                  <option value="zh-CN">🇨🇳 中文简体</option>
                  <option value="zh-TW">🇹🇼 中文繁体</option>
                  <option value="en">🇬🇧 英语</option>
                  <option value="vi">🇻🇳 越南语</option>
                  <option value="ja">🇯🇵 日语</option>
                  <option value="ko">🇰🇷 韩语</option>
                  <option value="th">🇹🇭 泰语</option>
                  <option value="id">🇮🇩 印尼语</option>
                  <option value="ms">🇲🇾 马来语</option>
                  <option value="tl">🇵🇭 菲律宾语</option>
                  <option value="my">🇲🇲 缅甸语</option>
                  <option value="km">🇰🇭 高棉语</option>
                  <option value="lo">🇱🇦 老挝语</option>
                  <option value="es">🇪🇸 西班牙语</option>
                  <option value="fr">🇫🇷 法语</option>
                  <option value="de">🇩🇪 德语</option>
                  <option value="it">🇮🇹 意大利语</option>
                  <option value="pt">🇵🇹 葡萄牙语</option>
                  <option value="ru">🇷🇺 俄语</option>
                  <option value="ar">🇸🇦 阿拉伯语</option>
                  <option value="hi">🇮🇳 印地语</option>
                  <option value="bn">🇧🇩 孟加拉语</option>
                  <option value="ur">🇵🇰 乌尔都语</option>
                  <option value="tr">🇹🇷 土耳其语</option>
                  <option value="fa">🇮🇷 波斯语</option>
                  <option value="he">🇮🇱 希伯来语</option>
                  <option value="nl">🇳🇱 荷兰语</option>
                  <option value="pl">🇵🇱 波兰语</option>
                  <option value="uk">🇺🇦 乌克兰语</option>
                  <option value="cs">🇨🇿 捷克语</option>
                  <option value="ro">🇷🇴 罗马尼亚语</option>
                  <option value="sv">🇸🇪 瑞典语</option>
                  <option value="da">🇩🇰 丹麦语</option>
                  <option value="no">🇳🇴 挪威语</option>
                  <option value="fi">🇫🇮 芬兰语</option>
                  <option value="el">🇬🇷 希腊语</option>
                  <option value="hu">🇭🇺 匈牙利语</option>
                  <option value="bg">🇧🇬 保加利亚语</option>
                  <option value="sr">🇷🇸 塞尔维亚语</option>
                  <option value="hr">🇭🇷 克罗地亚语</option>
                  <option value="sk">🇸🇰 斯洛伐克语</option>
                  <option value="sl">🇸🇮 斯洛文尼亚语</option>
                  <option value="lt">🇱🇹 立陶宛语</option>
                  <option value="lv">🇱🇻 拉脱维亚语</option>
                  <option value="et">🇪🇪 爱沙尼亚语</option>
                  <option value="sw">🇰🇪 斯瓦希里语</option>
                  <option value="af">🇿🇦 南非荷兰语</option>
                  <option value="am">🇪🇹 阿姆哈拉语</option>
                </select>
                </select>
              </div>
              
              <div class="setting-item">
                <label class="setting-title">翻译风格（仅输入框 AI 引擎）</label>
                <select id="translationStyle" class="setting-select">
                  <option value="通用">通用 - 自然流畅的表达</option>
                  <option value="正式">正式 - 商务沟通、正式场合</option>
                  <option value="口语化">口语化 - 朋友聊天、轻松场合</option>
                  <option value="亲切">亲切 - 客户服务、关怀问候</option>
                  <option value="幽默">幽默 - 风趣俏皮、营销推广</option>
                  <option value="礼貌">礼貌 - 初次接触、正式请求</option>
                  <option value="强硬">强硬 - 谈判维权、坚定表达</option>
                  <option value="简洁">简洁 - 快速沟通、精炼直接</option>
                  <option value="激励">激励 - 团队激励、销售推广</option>
                  <option value="中立">中立 - 客观陈述、不带情绪</option>
                  <option value="专业">专业 - 技术讨论、专业领域</option>
                </select>
              </div>
            </div>
            
            <!-- 高级设置 -->
            <div class="settings-section">
              <h3>⚙️ 高级设置</h3>
              
              <div class="setting-item">
                <label class="setting-label">
                  <label class="switch">
                    <input type="checkbox" id="blockChinese">
                    <span class="slider"></span>
                  </label>
                  <span class="setting-title">禁发中文</span>
                </label>
              </div>
              
              <div class="setting-item">
                <label class="setting-label">
                  <label class="switch">
                    <input type="checkbox" id="friendIndependent">
                    <span class="slider"></span>
                  </label>
                  <span class="setting-title">好友独立配置</span>
                </label>
              </div>
              
              <div class="setting-item">
                <label class="setting-label">
                  <label class="switch">
                    <input type="checkbox" id="realtimeTranslation">
                    <span class="slider"></span>
                  </label>
                  <span class="setting-title">实时翻译预览</span>
                </label>
              </div>
              
              <div class="setting-item">
                <label class="setting-label">
                  <label class="switch">
                    <input type="checkbox" id="reverseTranslation">
                    <span class="slider"></span>
                  </label>
                  <span class="setting-title">反向翻译验证</span>
                </label>
              </div>
              
              <div class="setting-item">
                <label class="setting-label">
                  <label class="switch">
                    <input type="checkbox" id="voiceTranslation">
                    <span class="slider"></span>
                  </label>
                  <span class="setting-title">语音翻译</span>
                </label>
                <p class="setting-desc">启用后可翻译语音消息（使用浏览器语音识别）</p>
              </div>
            </div>
            
            <!-- 好友独立配置 -->
            <div class="settings-section" id="friendConfigSection" style="display: none;">
              <h3>👥 当前联系人配置</h3>
              
              <div class="setting-item">
                <label class="setting-label">
                  <label class="switch">
                    <input type="checkbox" id="currentFriendEnabled">
                    <span class="slider"></span>
                  </label>
                  <span class="setting-title">为当前联系人启用独立配置</span>
                </label>
                <p class="setting-desc" id="currentContactName">当前联系人：未知</p>
              </div>
              
              <div id="friendConfigOptions" style="display: none;">
                <div class="setting-item">
                  <label class="setting-title">目标语言</label>
                  <select id="friendTargetLang" class="setting-select">
                    <option value="zh-CN">🇨🇳 中文简体</option>
                    <option value="zh-TW">🇹🇼 中文繁体</option>
                    <option value="en">🇬🇧 英语</option>
                    <option value="vi">🇻🇳 越南语</option>
                    <option value="ja">🇯🇵 日语</option>
                    <option value="ko">🇰🇷 韩语</option>
                    <option value="th">🇹🇭 泰语</option>
                    <option value="id">🇮🇩 印尼语</option>
                    <option value="ms">🇲🇾 马来语</option>
                    <option value="tl">🇵🇭 菲律宾语</option>
                    <option value="my">🇲🇲 缅甸语</option>
                    <option value="km">🇰🇭 高棉语</option>
                    <option value="lo">🇱🇦 老挝语</option>
                    <option value="es">🇪🇸 西班牙语</option>
                    <option value="fr">🇫🇷 法语</option>
                    <option value="de">🇩🇪 德语</option>
                    <option value="it">🇮🇹 意大利语</option>
                    <option value="pt">🇵🇹 葡萄牙语</option>
                    <option value="ru">🇷🇺 俄语</option>
                    <option value="ar">🇸🇦 阿拉伯语</option>
                    <option value="hi">🇮🇳 印地语</option>
                    <option value="bn">🇧🇩 孟加拉语</option>
                    <option value="ur">🇵🇰 乌尔都语</option>
                    <option value="tr">🇹🇷 土耳其语</option>
                    <option value="fa">🇮🇷 波斯语</option>
                    <option value="he">🇮🇱 希伯来语</option>
                    <option value="nl">🇳🇱 荷兰语</option>
                    <option value="pl">🇵🇱 波兰语</option>
                    <option value="uk">🇺🇦 乌克兰语</option>
                    <option value="cs">🇨🇿 捷克语</option>
                    <option value="ro">🇷🇴 罗马尼亚语</option>
                    <option value="sv">🇸🇪 瑞典语</option>
                    <option value="da">🇩🇰 丹麦语</option>
                    <option value="no">🇳🇴 挪威语</option>
                    <option value="fi">🇫🇮 芬兰语</option>
                    <option value="el">🇬🇷 希腊语</option>
                    <option value="hu">🇭🇺 匈牙利语</option>
                    <option value="bg">🇧🇬 保加利亚语</option>
                    <option value="sr">🇷🇸 塞尔维亚语</option>
                    <option value="hr">🇭🇷 克罗地亚语</option>
                    <option value="sk">🇸🇰 斯洛伐克语</option>
                    <option value="sl">🇸🇮 斯洛文尼亚语</option>
                    <option value="lt">🇱🇹 立陶宛语</option>
                    <option value="lv">🇱🇻 拉脱维亚语</option>
                    <option value="et">🇪🇪 爱沙尼亚语</option>
                    <option value="sw">🇰🇪 斯瓦希里语</option>
                    <option value="af">🇿🇦 南非荷兰语</option>
                    <option value="am">🇪🇹 阿姆哈拉语</option>
                  </select>
                  </select>
                </div>
                
                <div class="setting-item">
                  <label class="setting-label">
                    <label class="switch">
                      <input type="checkbox" id="friendBlockChinese">
                      <span class="slider"></span>
                    </label>
                    <span class="setting-title">对该联系人禁发中文</span>
                  </label>
                </div>
              </div>
              
              <div class="setting-item">
                <button id="manageFriendsBtn" class="setting-button secondary">管理所有联系人配置</button>
              </div>
            </div>
            
            <!-- API 配置 -->
            <div class="settings-section" id="apiConfigSection" style="display: none;">
              <h3>🔑 API 配置</h3>
              
              <div class="setting-item">
                <label class="setting-title">API 密钥</label>
                <input type="password" id="apiKey" class="setting-input" placeholder="输入 API 密钥">
              </div>
              
              <div class="setting-item" id="customEndpointItem" style="display: none;">
                <label class="setting-title">API 端点</label>
                <input type="text" id="apiEndpoint" class="setting-input" placeholder="https://api.example.com/v1/chat/completions">
              </div>
              
              <div class="setting-item" id="customModelItem" style="display: none;">
                <label class="setting-title">模型名称</label>
                <input type="text" id="apiModel" class="setting-input" placeholder="gpt-4">
              </div>
              
              <button id="testApiBtn" class="setting-button">测试连接</button>
            </div>
            
            <!-- 统计信息 -->
            <div class="settings-section">
              <h3>📊 使用统计</h3>
              <div id="statsContent" class="stats-content">
                <p>加载中...</p>
              </div>
              <button id="clearCacheBtn" class="setting-button secondary">清除缓存</button>
            </div>
          </div>
          
          <div class="settings-footer">
            <button id="resetBtn" class="setting-button secondary">重置设置</button>
          </div>
        </div>
      `;
      this.host.innerHTML = '';
      this.host.appendChild(this.panel);
      return this.panel;
    }

    bindEvents() {
      // 自动保存监听器
      const autoSaveInputs = [
        '#autoTranslate', '#groupTranslation', '#translationEngine', '#targetLanguage',
        '#inputBoxEnabled', '#inputBoxEngine', '#inputBoxTargetLang', '#translationStyle',
        '#blockChinese', '#friendIndependent', '#realtimeTranslation', '#reverseTranslation',
        '#voiceTranslation',
        '#apiKey', '#apiEndpoint', '#apiModel'
      ];

      autoSaveInputs.forEach(selector => {
        const el = this.panel.querySelector(selector);
        if (el) {
          const eventType = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
          el.addEventListener(eventType, () => {
            // 对于输入框，使用防抖
            if (eventType === 'input') {
              if (this.saveTimeout) clearTimeout(this.saveTimeout);
              this.saveTimeout = setTimeout(() => this.autoSave(), 1000);
            } else {
              this.autoSave();
            }
          });
        }
      });

      // 好友配置的自动保存
      const friendInputs = ['#currentFriendEnabled', '#friendTargetLang', '#friendBlockChinese'];
      friendInputs.forEach(selector => {
        const el = this.panel.querySelector(selector);
        if (el) {
          el.addEventListener('change', () => {
            if (selector === '#currentFriendEnabled') {
              this.updateFriendConfigOptions();
            }
            this.saveCurrentFriendConfig();
          });
        }
      });

      const engineSelect = this.panel.querySelector('#translationEngine');
      engineSelect?.addEventListener('change', async (e) => {
        const prev = this.currentEngine || this.config?.global?.engine;
        const next = e.target.value;
        if (prev && prev !== 'google') {
          await this.saveCurrentEngineConfig(prev);
        }
        this.currentEngine = next;
        await this.loadEngineConfig();
        await this.updateAPIConfigVisibility();
        this.updateTranslationStyleVisibility();
      });

      const inputBoxEngineSelect = this.panel.querySelector('#inputBoxEngine');
      inputBoxEngineSelect?.addEventListener('change', async (e) => {
        const inputBoxEngine = e.target.value;
        // 如果输入框引擎需要 API 配置，加载其配置
        if (['custom', 'gpt4', 'gemini', 'deepseek'].includes(inputBoxEngine)) {
          await this.loadEngineConfig(inputBoxEngine);
        }
        await this.updateAPIConfigVisibility();
        this.updateTranslationStyleVisibility();
      });

      this.panel.querySelector('#testApiBtn')?.addEventListener('click', () => {
        this.testAPI();
      });

      this.panel.querySelector('#resetBtn')?.addEventListener('click', () => {
        this.resetSettings();
      });

      this.panel.querySelector('#clearCacheBtn')?.addEventListener('click', () => {
        this.clearCache();
      });

      this.panel.querySelector('#friendIndependent')?.addEventListener('change', () => {
        this.updateFriendConfigVisibility();
        // 当启用好友独立配置时，立即加载当前联系人信息
        if (this.panel.querySelector('#friendIndependent').checked) {
          this.loadCurrentFriendConfig();
        }
      });

      this.panel.querySelector('#manageFriendsBtn')?.addEventListener('click', () => {
        this.showFriendConfigManager();
      });
    }

    async autoSave() {
      await this.saveSettings(true);
    }

    setPlaceholderVisible(visible) {
      if (!this.placeholderEl) return;
      this.placeholderEl.style.display = visible ? 'block' : 'none';
      if (this.host) {
        // 控制设置内容host的可见性
        this.host.style.display = visible ? 'none' : 'block';
      }
    }

    async setAccount(accountId) {
      this.accountId = accountId;
      if (!accountId) {
        this.config = cloneDefaultConfig();
        this.setPlaceholderVisible(true);
        return;
      }
      this.setPlaceholderVisible(false);
      await this.loadSettings();
    }

    async loadSettings() {
      try {
        if (!window.translationAPI) {
          throw new Error('translationAPI 未初始化');
        }
        const response = await window.translationAPI.getConfig(this.accountId);
        if (response.success && (response.config || response.data)) {
          this.config = response.config || response.data;
        } else {
          this.config = cloneDefaultConfig();
        }
        await this.updateUI(); // updateUI 内部会调用 updateAPIConfigVisibility，它会加载引擎配置
        await this.loadCurrentFriendConfig();
        this.loadStats();
      } catch (error) {
        console.error('[TranslateSettingsPanel] loadSettings error:', error);
        this.showMessage('加载配置失败：' + error.message, 'error');
      }
    }

    async updateUI() {
      if (!this.config || !this.panel) return;
      this.panel.querySelector('#autoTranslate').checked = !!this.config.global.autoTranslate;
      this.panel.querySelector('#groupTranslation').checked = !!this.config.global.groupTranslation;
      this.panel.querySelector('#translationEngine').value = this.config.global.engine;
      this.panel.querySelector('#targetLanguage').value = this.config.global.targetLang;
      this.currentEngine = this.config.global.engine;

      this.panel.querySelector('#inputBoxEnabled').checked = !!this.config.inputBox.enabled;
      this.panel.querySelector('#inputBoxEngine').value = this.config.inputBox.engine || this.config.global.engine;
      this.panel.querySelector('#inputBoxTargetLang').value = this.config.inputBox.targetLang || 'auto';
      this.panel.querySelector('#translationStyle').value = this.config.inputBox.style || '通用';

      this.panel.querySelector('#blockChinese').checked = !!this.config.advanced.blockChinese;
      this.panel.querySelector('#friendIndependent').checked = !!this.config.advanced.friendIndependent;
      this.panel.querySelector('#realtimeTranslation').checked = !!this.config.advanced.realtime;
      this.panel.querySelector('#reverseTranslation').checked = !!this.config.advanced.reverseTranslation;
      this.panel.querySelector('#voiceTranslation').checked = !!this.config.advanced.voiceTranslation;

      this.updateFriendConfigVisibility();
      this.updateTranslationStyleVisibility();
      await this.updateAPIConfigVisibility();
    }

    updateTranslationStyleVisibility() {
      const styleItem = this.panel.querySelector('#translationStyle')?.closest('.setting-item');
      const inputBoxEngine = this.panel.querySelector('#inputBoxEngine').value;
      if (!styleItem) return;
      styleItem.style.display = inputBoxEngine === 'google' ? 'none' : 'block';
    }

    async updateAPIConfigVisibility() {
      const chatEngine = this.panel.querySelector('#translationEngine').value;
      const inputBoxEngine = this.panel.querySelector('#inputBoxEngine').value;
      const apiSection = this.panel.querySelector('#apiConfigSection');
      const customEndpoint = this.panel.querySelector('#customEndpointItem');
      const customModel = this.panel.querySelector('#customModelItem');

      const needsAPI = chatEngine !== 'google' || inputBoxEngine !== 'google';
      if (apiSection) {
        apiSection.style.display = needsAPI ? 'block' : 'none';
      }
      if (customEndpoint && customModel) {
        const needsCustom = chatEngine === 'custom' || inputBoxEngine === 'custom';
        customEndpoint.style.display = needsCustom ? 'block' : 'none';
        customModel.style.display = needsCustom ? 'block' : 'none';
      }

      // 智能加载引擎配置：优先加载非 google 的引擎配置
      // 如果两个引擎都不是 google，优先加载聊天窗口引擎的配置
      if (needsAPI) {
        const engineToLoad = chatEngine !== 'google' ? chatEngine : inputBoxEngine;
        if (['custom', 'gpt4', 'gemini', 'deepseek'].includes(engineToLoad)) {
          await this.loadEngineConfig(engineToLoad);
        }
      }
    }

    async loadEngineConfig(engineName = null) {
      try {
        if (!window.translationAPI) return;

        // 如果没有指定引擎名称，使用聊天窗口翻译引擎
        const selectedEngine = engineName || this.panel.querySelector('#translationEngine').value;

        if (!['custom', 'gpt4', 'gemini', 'deepseek'].includes(selectedEngine)) {
          return;
        }

        console.log(`[TranslateSettingsPanel] Loading engine config for: ${selectedEngine}`);
        const engineConfigResponse = await window.translationAPI.getEngineConfig(selectedEngine);

        if (engineConfigResponse.success && engineConfigResponse.data) {
          const engineConfig = engineConfigResponse.data;
          console.log(`[TranslateSettingsPanel] Loaded config for ${selectedEngine}:`, {
            hasApiKey: !!engineConfig.apiKey,
            endpoint: engineConfig.endpoint,
            model: engineConfig.model
          });

          if (engineConfig.apiKey) {
            this.panel.querySelector('#apiKey').value = engineConfig.apiKey;
          }
          if (selectedEngine === 'custom') {
            if (engineConfig.endpoint) {
              this.panel.querySelector('#apiEndpoint').value = engineConfig.endpoint;
            }
            if (engineConfig.model) {
              this.panel.querySelector('#apiModel').value = engineConfig.model;
            }
          } else if (engineConfig.model) {
            this.panel.querySelector('#apiModel').value = engineConfig.model;
          }
        } else {
          console.log(`[TranslateSettingsPanel] No config found for ${selectedEngine}`);
        }
      } catch (error) {
        console.error('[TranslateSettingsPanel] loadEngineConfig error:', error);
      }
    }

    async saveCurrentEngineConfig(engineName) {
      try {
        if (!window.translationAPI) return;
        if (!['custom', 'gpt4', 'gemini', 'deepseek'].includes(engineName)) {
          return;
        }

        const apiKey = this.panel.querySelector('#apiKey')?.value;
        const apiEndpoint = this.panel.querySelector('#apiEndpoint')?.value;
        const apiModel = this.panel.querySelector('#apiModel')?.value;

        // 如果没有输入 API Key，尝试获取已保存的配置
        if (!apiKey) {
          console.log(`[TranslateSettingsPanel] No API key in input for ${engineName}, checking existing config`);
          const existingConfigResponse = await window.translationAPI.getEngineConfig(engineName);
          if (existingConfigResponse.success && existingConfigResponse.data?.apiKey) {
            console.log(`[TranslateSettingsPanel] Using existing API key for ${engineName}`);
            // 已有配置，不需要重新保存
            return;
          } else {
            console.log(`[TranslateSettingsPanel] No API key found for ${engineName}, skipping save`);
            return;
          }
        }

        const engineConfig = {
          apiKey,
          enabled: true  // 关键：必须设置 enabled: true 才能注册引擎
        };
        if (engineName === 'custom') {
          engineConfig.endpoint = apiEndpoint || '';
          engineConfig.model = apiModel || 'gpt-4';
          engineConfig.name = 'Custom API';
        } else if (engineName === 'gpt4') {
          engineConfig.endpoint = 'https://api.openai.com/v1/chat/completions';
          engineConfig.model = apiModel || 'gpt-4';
        } else if (engineName === 'gemini') {
          engineConfig.endpoint = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';
          engineConfig.model = apiModel || 'gemini-pro';
        } else if (engineName === 'deepseek') {
          engineConfig.endpoint = 'https://api.deepseek.com/v1/chat/completions';
          engineConfig.model = apiModel || 'deepseek-chat';
        }

        console.log(`[TranslateSettingsPanel] Saving engine config for ${engineName}:`, {
          hasApiKey: !!engineConfig.apiKey,
          enabled: engineConfig.enabled,
          endpoint: engineConfig.endpoint,
          model: engineConfig.model
        });
        await window.translationAPI.saveEngineConfig(engineName, engineConfig);
      } catch (error) {
        console.error('[TranslateSettingsPanel] saveCurrentEngineConfig error:', error);
      }
    }

    async saveSettings(isAutoSave = false) {
      try {
        if (!this.accountId) {
          throw new Error('请先选择账号');
        }

        // 收集当前配置
        const newConfig = {
          global: {
            autoTranslate: this.panel.querySelector('#autoTranslate').checked,
            engine: this.panel.querySelector('#translationEngine').value,
            targetLang: this.panel.querySelector('#targetLanguage').value,
            groupTranslation: this.panel.querySelector('#groupTranslation').checked
          },
          inputBox: {
            enabled: this.panel.querySelector('#inputBoxEnabled').checked,
            engine: this.panel.querySelector('#inputBoxEngine').value,
            style: this.panel.querySelector('#translationStyle').value,
            targetLang: this.panel.querySelector('#inputBoxTargetLang').value
          },
          advanced: {
            friendIndependent: this.panel.querySelector('#friendIndependent').checked,
            blockChinese: this.panel.querySelector('#blockChinese').checked,
            realtime: this.panel.querySelector('#realtimeTranslation').checked,
            reverseTranslation: this.panel.querySelector('#reverseTranslation').checked,
            voiceTranslation: this.panel.querySelector('#voiceTranslation').checked,
            imageTranslation: false
          },
          friendConfigs: this.config.friendConfigs || {}
        };

        // 保存当前引擎的 API 配置
        const currentEngine = newConfig.global.engine;
        if (['custom', 'gpt4', 'gemini', 'deepseek'].includes(currentEngine)) {
          await this.saveCurrentEngineConfig(currentEngine);
        }

        // 同时也保存输入框引擎的 API 配置（如果不同）
        const inputBoxEngine = newConfig.inputBox.engine;
        if (['custom', 'gpt4', 'gemini', 'deepseek'].includes(inputBoxEngine) && inputBoxEngine !== currentEngine) {
          await this.saveCurrentEngineConfig(inputBoxEngine);
        }

        console.log('[TranslateSettingsPanel] Saving config for account:', this.accountId, newConfig);
        const response = await window.translationAPI.saveConfig(this.accountId, newConfig);

        if (response.success) {
          console.log('[TranslateSettingsPanel] Config saved successfully');
          this.config = newConfig;

          // 立即应用配置到视图
          if (this.applyConfigToView) {
            console.log('[TranslateSettingsPanel] Applying config to view...');
            const applyResult = await this.applyConfigToView(this.accountId, newConfig);

            if (applyResult && applyResult.success) {
              console.log('[TranslateSettingsPanel] Config applied to view successfully');
            } else {
              console.warn('[TranslateSettingsPanel] Failed to apply config to view:', applyResult);
              // 即使应用失败，也显示保存成功，因为配置已经保存
              // 但在非自动保存模式下，提示用户可能需要刷新
              if (!isAutoSave) {
                this.showMessage('设置已保存，但应用到视图失败，请尝试刷新页面', 'error');
                return;
              }
            }
          } else {
            console.warn('[TranslateSettingsPanel] applyConfigToView function not available');
          }

          if (isAutoSave) {
            this.showSaveStatus();
          } else {
            this.showMessage('设置已保存并应用', 'success');
          }
        } else {
          console.error('[TranslateSettingsPanel] Failed to save config:', response.error);
          this.showMessage('保存失败：' + (response.error || '未知错误'), 'error');
        }
      } catch (error) {
        console.error('[TranslateSettingsPanel] saveSettings error:', error);
        this.showMessage('保存失败：' + error.message, 'error');
      }
    }

    showSaveStatus() {
      const statusEl = this.panel.querySelector('#saveStatus');
      if (statusEl) {
        statusEl.classList.add('visible');
        if (this.statusTimeout) clearTimeout(this.statusTimeout);
        this.statusTimeout = setTimeout(() => {
          statusEl.classList.remove('visible');
        }, 2000);
      }
    }

    async loadCurrentFriendConfig() {
      console.log('[TranslateSettingsPanel] Loading current friend config');

      // 检查面板和必要元素是否存在
      if (!this.panel) {
        console.log('[TranslateSettingsPanel] Panel not initialized');
        return;
      }

      const info = await this.getActiveChatInfo();
      console.log('[TranslateSettingsPanel] Active chat info:', info);
      const contactId = info?.contactId;
      const contactName = info?.contactName || contactId;
      const currentContactEl = this.panel.querySelector('#currentContactName');
      const currentFriendEnabled = this.panel.querySelector('#currentFriendEnabled');

      if (!currentContactEl) {
        console.log('[TranslateSettingsPanel] Contact name element not found');
        return;
      }

      if (!contactId) {
        console.log('[TranslateSettingsPanel] No contact ID found');
        currentContactEl.textContent = '当前联系人：未打开聊天窗口';
        if (currentFriendEnabled) currentFriendEnabled.disabled = true;
        this.updateFriendConfigOptions();
        return;
      }
      console.log('[TranslateSettingsPanel] Contact detected:', contactName);

      if (currentContactEl) {
        currentContactEl.textContent = `当前联系人：${contactName}`;
      }
      if (currentFriendEnabled) currentFriendEnabled.disabled = false;

      const friendConfig = this.config.friendConfigs && this.config.friendConfigs[contactId];
      if (friendConfig && friendConfig.enabled) {
        currentFriendEnabled.checked = true;
        this.panel.querySelector('#friendTargetLang').value = friendConfig.targetLang || 'en';
        this.panel.querySelector('#friendBlockChinese').checked = friendConfig.blockChinese || false;
      } else {
        currentFriendEnabled.checked = false;
        this.panel.querySelector('#friendTargetLang').value = 'en';
        this.panel.querySelector('#friendBlockChinese').checked = false;
      }
      this.updateFriendConfigOptions();
    }

    updateFriendConfigVisibility() {
      const friendIndependent = this.panel.querySelector('#friendIndependent').checked;
      const friendConfigSection = this.panel.querySelector('#friendConfigSection');
      if (friendConfigSection) {
        friendConfigSection.style.display = friendIndependent ? 'block' : 'none';
      }
    }

    updateFriendConfigOptions() {
      const enabled = this.panel.querySelector('#currentFriendEnabled').checked;
      const options = this.panel.querySelector('#friendConfigOptions');
      if (options) {
        options.style.display = enabled ? 'block' : 'none';
      }
    }

    async saveCurrentFriendConfig() {
      console.log('[TranslateSettingsPanel] Saving current friend config');

      try {
        // Get current contact info
        const chatInfo = await this.getActiveChatInfo();
        const contactId = chatInfo.contactId;

        if (!contactId) {
          console.warn('[TranslateSettingsPanel] No contact ID, cannot save friend config');
          return;
        }

        // Get friend config values
        const enabled = this.panel.querySelector('#currentFriendEnabled')?.checked || false;
        const targetLang = this.panel.querySelector('#friendTargetLang')?.value || 'en';
        const blockChinese = this.panel.querySelector('#friendBlockChinese')?.checked || false;

        console.log('[TranslateSettingsPanel] Friend config for', contactId, ':', {
          enabled,
          targetLang,
          blockChinese
        });

        // Update config
        if (!this.config.friendConfigs) {
          this.config.friendConfigs = {};
        }

        if (enabled) {
          // Save friend config
          this.config.friendConfigs[contactId] = {
            enabled: true,
            targetLang: targetLang,
            blockChinese: blockChinese
          };
        } else {
          // Remove friend config if disabled
          delete this.config.friendConfigs[contactId];
        }

        // Save to storage
        await this.saveSettings();

        console.log('[TranslateSettingsPanel] ✓ Friend config saved successfully');
      } catch (error) {
        console.error('[TranslateSettingsPanel] Error saving friend config:', error);
      }
    }

    showFriendConfigManager() {
      const friendConfigs = this.config.friendConfigs || {};
      const configCount = Object.keys(friendConfigs).length;
      let message = `已配置 ${configCount} 个联系人的独立翻译设置\n\n`;
      if (configCount > 0) {
        message += '配置列表：\n';
        for (const [contactId, config] of Object.entries(friendConfigs)) {
          if (config.enabled) {
            message += `- ${contactId}: ${config.targetLang}${config.blockChinese ? ' (禁发中文)' : ''}\n`;
          }
        }
        message += '\n要清除某个联系人的配置，请打开该聊天窗口，在设置中取消勾选“为当前联系人启用独立配置”。';
      } else {
        message += '暂无配置的联系人\n\n要为联系人设置独立配置，请打开该聊天窗口，在设置中勾选“为当前联系人启用独立配置”。';
      }
      alert(message);
    }

    async clearCache() {
      try {
        const response = await window.translationAPI.clearCache(this.accountId);
        if (response.success) {
          this.showMessage('缓存已清除', 'success');
        } else {
          this.showMessage('清除缓存失败：' + (response.error || '未知错误'), 'error');
        }
      } catch (error) {
        console.error('[TranslateSettingsPanel] clearCache error:', error);
        this.showMessage('清除缓存失败：' + error.message, 'error');
      }
    }

    async loadStats() {
      try {
        const statsContent = this.panel.querySelector('#statsContent');
        if (!statsContent || !window.translationAPI) return;
        const response = await window.translationAPI.getStats();
        if (response.success && response.data) {
          const stats = response.data;
          statsContent.innerHTML = `
            <div class="stat-item">
              <span class="stat-label">总翻译次数：</span>
              <span class="stat-value">${stats.translation.totalRequests || 0}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">成功次数：</span>
              <span class="stat-value">${stats.translation.successCount || 0}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">缓存命中率：</span>
              <span class="stat-value">${stats.translation.cacheStats?.hitRate || '0%'}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">缓存大小：</span>
              <span class="stat-value">${stats.translation.cacheStats?.memorySize || 0} KB</span>
            </div>
          `;
        }
      } catch (error) {
        console.error('[TranslateSettingsPanel] loadStats error:', error);
      }
    }

    async testAPI() {
      try {
        if (!this.accountId) {
          throw new Error('请先选择账号');
        }
        const engineSelect = this.panel.querySelector('#translationEngine').value;
        const apiKey = this.panel.querySelector('#apiKey')?.value;
        if (engineSelect !== 'google' && !apiKey) {
          throw new Error('请先填写 API Key');
        }
        const response = await window.translationAPI.translate({
          accountId: this.accountId,
          text: 'Hello World',
          sourceLang: 'auto',
          targetLang: 'zh-CN',
          engineName: engineSelect
        });
        if (response.success) {
          this.showMessage('测试成功：' + (response.data?.translatedText || 'OK'), 'success');
        } else {
          this.showMessage('测试失败：' + (response.error || '未知错误'), 'error');
        }
      } catch (error) {
        console.error('[TranslateSettingsPanel] testAPI error:', error);
        this.showMessage('测试失败：' + error.message, 'error');
      }
    }

    async resetSettings() {
      if (confirm('确定要重置所有设置吗？这将清除所有自定义配置。')) {
        this.config = cloneDefaultConfig();
        await this.updateUI();
        this.loadCurrentFriendConfig();
      }
    }

    showMessage(message, type = 'info') {

      const msgEl = document.createElement('div');

      msgEl.className = `settings-message ${type}`;

      msgEl.textContent = message;

      this.panel.appendChild(msgEl);

      setTimeout(() => msgEl.remove(), 3000);

    }



    // 根据面板状态调整显示内容

    updateForPanelState(state) {

      if (!this.panel) return;

      const settingsContent = this.panel.querySelector('.settings-content');

      const settingsFooter = this.panel.querySelector('.settings-footer');



      // 兼容新旧状态系统

      if (state === 'compact' || state === 'collapsed') {

        // 在紧凑/收起状态下隐藏大部分内容

        if (settingsContent) settingsContent.style.display = 'none';

        if (settingsFooter) settingsFooter.style.display = 'none';

      } else if (state === 'standard') {

        // 在标准状态下只显示基础设置和保存按钮

        const sections = this.panel.querySelectorAll('.settings-section');

        sections.forEach((section, index) => {

          // 只显示第一部分（基础设置）

          if (index === 0) {

            section.style.display = 'block';

          } else {

            section.style.display = 'none';

          }

        });

        if (settingsContent) settingsContent.style.display = 'flex';

        if (settingsFooter) settingsFooter.style.display = 'flex';

      } else if (state === 'full' || state === 'expanded') {

        // 在完整/展开状态下显示全部内容

        const sections = this.panel.querySelectorAll('.settings-section');

        sections.forEach(section => {

          section.style.display = 'block';

        });

        if (settingsContent) settingsContent.style.display = 'flex';

        if (settingsFooter) settingsFooter.style.display = 'flex';

      }

    }

  }



  window.TranslateSettingsPanel = TranslateSettingsPanel;

})();
