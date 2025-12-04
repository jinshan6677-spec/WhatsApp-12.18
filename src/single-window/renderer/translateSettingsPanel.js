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
      imageTranslation: false,
      groqApiKey: '',
      groqModel: 'whisper-large-v3',
      groqTextModel: 'llama-3.1-70b-versatile'
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
      // Styles are now loaded from environmentSettingsPanel.css via app.html
    }

    createPanel() {
      if (this.panel) return this.panel;
      this.panel = document.createElement('div');
      // Create a flex container for the fixed layout
      this.panel.style.display = 'flex';
      this.panel.style.flexDirection = 'column';
      this.panel.style.flex = '1';
      this.panel.style.minHeight = '0';
      this.panel.style.overflow = 'hidden';
      
      this.panel.innerHTML = `
        <div class="env-panel-body">
          <!-- 消息翻译 (Message Translation) Section -->
          <section class="env-section">
            <h3 class="env-section-title">
              <span>消息翻译</span>
              <label class="env-toggle">
                <input type="checkbox" id="autoTranslate">
                <span class="env-toggle-slider"></span>
              </label>
            </h3>
            <div class="env-section-content">
              <div class="env-form-group">
                <label class="env-section-title" style="padding: 0; background: none; border: none; margin-bottom: 6px;">
                  <span>群组消息翻译</span>
                  <label class="env-toggle">
                    <input type="checkbox" id="groupTranslation">
                    <span class="env-toggle-slider"></span>
                  </label>
                </label>
              </div>
              
              <div class="env-form-group">
                <label>翻译引擎</label>
                <div class="env-input-group">
                    <select id="translationEngine">
                      <option value="google">Google 翻译（免费，推荐）</option>
                      <option value="gpt4">GPT-4</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="deepseek">DeepSeek</option>
                      <option value="custom">自定义 API</option>
                    </select>
                </div>
              </div>
              
              <div class="env-form-group">
                <label>目标语言</label>
                <div class="env-input-group">
                    <select id="targetLanguage">
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
                </div>
              </div>
            </div>
          </section>

          <!-- 输入框翻译 (Input Box Translation) Section -->
          <section class="env-section">
            <h3 class="env-section-title">
              <span>输入框翻译</span>
              <label class="env-toggle">
                <input type="checkbox" id="inputBoxEnabled">
                <span class="env-toggle-slider"></span>
              </label>
            </h3>
            <div class="env-section-content">
              <div class="env-form-group">
                <label>翻译引擎</label>
                <div class="env-input-group">
                    <select id="inputBoxEngine">
                      <option value="google">Google 翻译（免费）</option>
                      <option value="gpt4">GPT-4（支持风格）</option>
                      <option value="gemini">Google Gemini（支持风格）</option>
                      <option value="deepseek">DeepSeek（支持风格）</option>
                      <option value="custom">自定义 API（支持风格）</option>
                    </select>
                </div>
              </div>
              
              <div class="env-form-group">
                <label>目标语言</label>
                <div class="env-input-group">
                    <select id="inputBoxTargetLang">
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
                </div>
              </div>
              
              <div class="env-form-group">
                <label>翻译风格</label>
                <div class="env-input-group">
                    <select id="translationStyle">
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
            </div>
          </section>

          <!-- 高级设置 (Advanced Settings) Section -->
          <section class="env-section">
             <h3 class="env-section-title">
              <span>高级设置</span>
            </h3>
            <div class="env-section-content">
               <div class="env-form-group">
                  <label class="env-section-title" style="padding: 0; background: none; border: none; margin-bottom: 6px;">
                    <span>禁发中文</span>
                    <label class="env-toggle">
                      <input type="checkbox" id="blockChinese">
                      <span class="env-toggle-slider"></span>
                    </label>
                  </label>
                </div>
                
                <div class="env-form-group">
                  <label class="env-section-title" style="padding: 0; background: none; border: none; margin-bottom: 6px;">
                    <span>好友独立配置</span>
                    <label class="env-toggle">
                      <input type="checkbox" id="friendIndependent">
                      <span class="env-toggle-slider"></span>
                    </label>
                  </label>
                </div>
                
                <div class="env-form-group">
                  <label class="env-section-title" style="padding: 0; background: none; border: none; margin-bottom: 6px;">
                    <span>实时翻译预览</span>
                    <label class="env-toggle">
                      <input type="checkbox" id="realtimeTranslation">
                      <span class="env-toggle-slider"></span>
                    </label>
                  </label>
                </div>
                
                <div class="env-form-group">
                  <label class="env-section-title" style="padding: 0; background: none; border: none; margin-bottom: 6px;">
                    <span>反向翻译验证</span>
                    <label class="env-toggle">
                      <input type="checkbox" id="reverseTranslation">
                      <span class="env-toggle-slider"></span>
                    </label>
                  </label>
                </div>
                
                <div class="env-form-group">
                  <label class="env-section-title" style="padding: 0; background: none; border: none; margin-bottom: 6px;">
                    <span>语音翻译</span>
                    <label class="env-toggle">
                      <input type="checkbox" id="voiceTranslation">
                      <span class="env-toggle-slider"></span>
                    </label>
                  </label>
                  <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">启用后可翻译语音消息（使用 Groq API）</p>
                </div>

                <!-- Groq Settings inside Advanced -->
                <div class="env-collapsible">
                  <div class="env-collapsible-header">
                    <span>Groq API 配置</span>
                    <span class="env-collapsible-icon">▼</span>
                  </div>
                  <div class="env-collapsible-content">
                    <div class="env-form-group">
                      <label>Groq API 密钥</label>
                      <input type="password" id="groqApiKey" placeholder="输入 Groq API Key">
                    </div>

                    <div class="env-form-group">
                      <label>Groq STT 模型</label>
                      <input type="text" id="groqSttModel" placeholder="whisper-large-v3">
                    </div>

                    <div class="env-form-group">
                      <label>Groq 文本模型</label>
                      <input type="text" id="groqTextModel" placeholder="llama-3.1-70b-versatile">
                    </div>
                    
                    <div class="env-form-group">
                      <label>Groq 文本模型（备用）</label>
                      <input type="text" id="groqTextModelFallback" placeholder="llama-3.1-8b-instant">
                    </div>
                  </div>
                </div>
                
                <!-- API Configuration Section (Moved inside Advanced or kept separate? Keep separate if it's big, or inside if related to advanced. The original had it separate. Let's put it in a collapsible inside Advanced to reduce clutter) -->
                 <div class="env-collapsible" id="apiConfigSection" style="display: none;">
                  <div class="env-collapsible-header">
                    <span>自定义 API 配置</span>
                    <span class="env-collapsible-icon">▼</span>
                  </div>
                  <div class="env-collapsible-content">
                    <div class="env-form-group">
                      <label>API 密钥</label>
                      <input type="password" id="apiKey" placeholder="输入 API 密钥">
                    </div>
                    
                    <div class="env-form-group" id="customEndpointItem" style="display: none;">
                      <label>API 端点</label>
                      <input type="text" id="apiEndpoint" placeholder="https://api.example.com/v1/chat/completions">
                    </div>
                    
                    <div class="env-form-group" id="customModelItem" style="display: none;">
                      <label>模型名称</label>
                      <input type="text" id="apiModel" placeholder="gpt-4">
                    </div>
                    
                    <button id="testApiBtn" class="env-btn-primary">测试连接</button>
                  </div>
                </div>
            </div>
          </section>

          <!-- Friend Config Section -->
          <section class="env-section" id="friendConfigSection" style="display: none;">
             <h3 class="env-section-title">
              <span>当前联系人配置</span>
              <label class="env-toggle">
                <input type="checkbox" id="currentFriendEnabled">
                <span class="env-toggle-slider"></span>
              </label>
            </h3>
            <div class="env-section-content">
               <p id="currentContactName" style="font-size: 12px; color: #6b7280; margin-bottom: 12px;">当前联系人：未知</p>
               
               <div id="friendConfigOptions" style="display: none;">
                  <div class="env-form-group">
                    <label>目标语言</label>
                    <div class="env-input-group">
                        <select id="friendTargetLang">
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
                    </div>
                  </div>
                  
                  <div class="env-form-group">
                    <label class="env-section-title" style="padding: 0; background: none; border: none; margin-bottom: 6px;">
                      <span>对该联系人禁发中文</span>
                      <label class="env-toggle">
                        <input type="checkbox" id="friendBlockChinese">
                        <span class="env-toggle-slider"></span>
                      </label>
                    </label>
                  </div>
               </div>
               
               <div class="env-form-group" style="margin-top: 12px;">
                  <button id="manageFriendsBtn" class="env-btn-secondary">管理所有联系人配置</button>
               </div>
            </div>
          </section>
          
          <!-- Stats Section -->
          <section class="env-section">
             <h3 class="env-section-title">
              <span>使用统计</span>
            </h3>
            <div class="env-section-content">
               <div id="statsContent" style="background: #f9fafb; border: 1px dashed #e5e7eb; padding: 12px; border-radius: 8px; font-size: 13px; color: #374151;">
                  <p>加载中...</p>
                </div>
                <div class="env-form-group" style="margin-top: 12px;">
                   <button id="clearCacheBtn" class="env-btn-secondary">清除缓存</button>
                </div>
            </div>
          </section>
          
          <!-- Spacer removed as flex layout handles it -->
        </div>
        
        <div class="env-panel-footer">
          <div class="env-footer-left"></div>
          <div class="env-footer-right">
            <button id="resetBtn" class="env-btn-secondary">重置</button>
          </div>
        </div>
      `;
      
      this.host.innerHTML = '';
      this.host.appendChild(this.panel);
      return this.panel;
    }

    bindEvents() {
      // 折叠面板点击事件
      this.panel.querySelectorAll('.env-collapsible-header').forEach(header => {
        header.addEventListener('click', (e) => {
          const collapsible = header.closest('.env-collapsible');
          if (collapsible) {
            collapsible.classList.toggle('active');
            if (this.onCollapse) {
              this.onCollapse();
            }
          }
        });
      });

      // 自动保存监听器
      const autoSaveInputs = [
        '#autoTranslate', '#groupTranslation', '#translationEngine', '#targetLanguage',
        '#inputBoxEnabled', '#inputBoxEngine', '#inputBoxTargetLang', '#translationStyle',
        '#blockChinese', '#friendIndependent', '#realtimeTranslation', '#reverseTranslation',
        '#voiceTranslation',
        '#groqApiKey', '#groqSttModel', '#groqTextModel', '#groqTextModelFallback',
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
        this.host.style.display = visible ? 'none' : 'flex';
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
      const groqApiKeyEl = this.panel.querySelector('#groqApiKey');
      const groqSttModelEl = this.panel.querySelector('#groqSttModel');
      const groqTextModelEl = this.panel.querySelector('#groqTextModel');
      const groqTextModelFallbackEl = this.panel.querySelector('#groqTextModelFallback');
      if (groqApiKeyEl) groqApiKeyEl.value = this.config.advanced.groqApiKey || '';
      if (groqSttModelEl) groqSttModelEl.value = this.config.advanced.groqModel || 'whisper-large-v3';
      if (groqTextModelEl) groqTextModelEl.value = this.config.advanced.groqTextModel || 'llama-3.1-70b-versatile';
      if (groqTextModelFallbackEl) groqTextModelFallbackEl.value = this.config.advanced.groqTextModelFallback || 'llama-3.1-8b-instant';

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
            imageTranslation: false,
            groqApiKey: this.panel.querySelector('#groqApiKey').value,
            groqModel: this.panel.querySelector('#groqSttModel').value || 'whisper-large-v3',
            groqTextModel: this.panel.querySelector('#groqTextModel').value || 'llama-3.1-70b-versatile',
            groqTextModelFallback: this.panel.querySelector('#groqTextModelFallback').value || 'llama-3.1-8b-instant'
          },
          friendConfigs: this.config.friendConfigs || {}
        };

        if (!newConfig.advanced.groqApiKey || !String(newConfig.advanced.groqApiKey).trim().length) {
          newConfig.advanced.voiceTranslation = false;
        }

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

          // 保存 Groq STT 配置为全局引擎，以便账号切换时可复用
          try {
            const gKey = (newConfig.advanced.groqApiKey || '').trim();
            const gModel = (newConfig.advanced.groqModel || 'whisper-large-v3').trim();
            if (gKey && window.translationAPI && typeof window.translationAPI.saveEngineConfig === 'function') {
              await window.translationAPI.saveEngineConfig('groqSTT', {
                apiKey: gKey,
                model: gModel,
                enabled: true
              });
              console.log('[TranslateSettingsPanel] 全局保存 Groq STT 引擎配置');
            } else if (window.translationAPI && typeof window.translationAPI.saveEngineConfig === 'function') {
              await window.translationAPI.saveEngineConfig('groqSTT', {
                enabled: false
              });
              console.log('[TranslateSettingsPanel] 已清除全局 Groq STT 引擎配置');
            }
          } catch (e) {
            console.warn('[TranslateSettingsPanel] 保存 Groq STT 全局配置失败:', e.message);
          }

          try {
            const gKeySync = (newConfig.advanced.groqApiKey || '').trim();
            if (window.electronAPI && typeof window.electronAPI.invoke === 'function' && window.translationAPI) {
              const accResp = await window.electronAPI.invoke('get-accounts');
              const accounts = Array.isArray(accResp) ? accResp : (accResp?.accounts || accResp?.data || []);
              for (const acc of accounts) {
                const accId = acc && acc.id ? acc.id : acc;
                if (!accId || accId === this.accountId) continue;
                const cfgResp = await window.translationAPI.getConfig(accId);
                const cfg = (cfgResp && cfgResp.success) ? (cfgResp.config || cfgResp.data || {}) : {};
                const hasKey = cfg && cfg.advanced && cfg.advanced.groqApiKey && String(cfg.advanced.groqApiKey).trim().length > 0;
                if (!cfg.global || typeof cfg.global !== 'object') cfg.global = this.config.global || {};
                if (!cfg.inputBox || typeof cfg.inputBox !== 'object') cfg.inputBox = this.config.inputBox || {};
                if (!cfg.advanced || typeof cfg.advanced !== 'object') cfg.advanced = {};
                if (!cfg.friendConfigs || typeof cfg.friendConfigs !== 'object') cfg.friendConfigs = cfg.friendConfigs || {};
                if (gKeySync) {
                  if (hasKey) continue;
                  cfg.advanced.groqApiKey = gKeySync;
                  cfg.advanced.groqModel = newConfig.advanced.groqModel || cfg.advanced.groqModel || 'whisper-large-v3';
                  cfg.advanced.groqTextModel = newConfig.advanced.groqTextModel || cfg.advanced.groqTextModel || 'llama-3.1-70b-versatile';
                  cfg.advanced.groqTextModelFallback = newConfig.advanced.groqTextModelFallback || cfg.advanced.groqTextModelFallback || 'llama-3.1-8b-instant';
                } else {
                  cfg.advanced.groqApiKey = '';
                  cfg.advanced.voiceTranslation = false;
                }
                await window.translationAPI.saveConfig(accId, cfg);
              }
              console.log('[TranslateSettingsPanel] 已同步 Groq 语音翻译配置到其他账号');
            }
          } catch (e) {
            console.warn('[TranslateSettingsPanel] 同步 Groq 配置到其他账号失败:', e.message);
          }

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
            this.showMessage('配置已自动保存', 'success');
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
      msgEl.className = `env-message-toast ${type}`;
      msgEl.textContent = message;
      this.panel.appendChild(msgEl);

      setTimeout(() => {
        msgEl.style.opacity = '0';
        msgEl.style.transition = 'opacity 0.3s ease';
        setTimeout(() => msgEl.remove(), 300);
      }, 3000);
    }



    // 根据面板状态调整显示内容

    updateForPanelState(state) {
      if (!this.panel) return;

      const content = this.panel.querySelector('.env-section-content');
      const footer = this.panel.querySelector('.env-panel-footer');
      const header = this.panel.querySelector('.env-panel-header');

      if (state === 'compact' || state === 'collapsed') {
        if (content) content.style.display = 'none';
        if (footer) footer.style.display = 'none';
        if (header) header.style.borderBottom = 'none';
      } else {
        if (content) content.style.display = 'block'; // env-section-content is block by default, flex in css? No, block.
        if (footer) footer.style.display = 'flex';
        if (header) header.style.borderBottom = '';

        // In standard mode, we might want to ensure at least the first section is open
        // But let's respect user's manual toggling for now, just ensure visibility.
        
        // If switching from compact to standard, we might want to reset some display properties
      }
    }

  }



  window.TranslateSettingsPanel = TranslateSettingsPanel;

})();
