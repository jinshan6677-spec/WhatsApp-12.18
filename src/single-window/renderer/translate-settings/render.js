;(function(){
  'use strict';
  function render(host){
    const panel = document.createElement('div');
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.flex = '1';
    panel.style.minHeight = '0';
    panel.style.overflow = 'hidden';
    panel.innerHTML = `
      <div class="env-panel-body">
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
      </div>
      <div class="env-panel-footer">
        <div class="env-footer-left"></div>
        <div class="env-footer-right">
          <button id="resetBtn" class="env-btn-secondary">重置</button>
        </div>
      </div>
    `;
    host.innerHTML = '';
    host.appendChild(panel);
    window.TranslateSettingsState.panel = panel;
    return panel;
  }

  function bindEvents(panel, inst){
    panel.querySelectorAll('.env-collapsible-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const collapsible = header.closest('.env-collapsible');
        if (collapsible) {
          collapsible.classList.toggle('active');
        }
        e.stopPropagation();
      });
    });
    const autoSaveInputs = [
      '#autoTranslate', '#groupTranslation', '#translationEngine', '#targetLanguage',
      '#inputBoxEnabled', '#inputBoxEngine', '#inputBoxTargetLang', '#translationStyle',
      '#blockChinese', '#friendIndependent', '#realtimeTranslation', '#reverseTranslation',
      '#voiceTranslation',
      '#groqApiKey', '#groqSttModel', '#groqTextModel', '#groqTextModelFallback',
      '#apiKey', '#apiEndpoint', '#apiModel'
    ];
    autoSaveInputs.forEach(selector => {
      const el = panel.querySelector(selector);
      if (el) {
        const eventType = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(eventType, () => {
          if (eventType === 'input') {
            if (inst.saveTimeout) clearTimeout(inst.saveTimeout);
            inst.saveTimeout = setTimeout(() => inst.autoSave(), 1000);
          } else {
            inst.autoSave();
          }
        });
      }
    });
    const friendInputs = ['#currentFriendEnabled', '#friendTargetLang', '#friendBlockChinese'];
    friendInputs.forEach(selector => {
      const el = panel.querySelector(selector);
      if (el) {
        el.addEventListener('change', () => {
          if (selector === '#currentFriendEnabled') {
            window.TranslateSettingsFriends.updateFriendConfigOptions(inst);
          }
          window.TranslateSettingsFriends.saveCurrentFriendConfig(inst);
        });
      }
    });
    const engineSelect = panel.querySelector('#translationEngine');
    engineSelect && engineSelect.addEventListener('change', async (e) => {
      const prev = inst.currentEngine || inst.config?.global?.engine;
      const next = e.target.value;
      if (prev && prev !== 'google') {
        await window.TranslateSettingsEngine.saveCurrentEngineConfig(panel, prev);
      }
      inst.currentEngine = next;
      await window.TranslateSettingsEngine.loadEngineConfig(panel);
      await inst.updateAPIConfigVisibility();
      inst.updateTranslationStyleVisibility();
    });
    const inputBoxEngineSelect = panel.querySelector('#inputBoxEngine');
    inputBoxEngineSelect && inputBoxEngineSelect.addEventListener('change', async (e) => {
      const inputBoxEngine = e.target.value;
      if (['custom', 'gpt4', 'gemini', 'deepseek'].includes(inputBoxEngine)) {
        await window.TranslateSettingsEngine.loadEngineConfig(panel, inputBoxEngine);
      }
      await inst.updateAPIConfigVisibility();
      inst.updateTranslationStyleVisibility();
    });
    panel.querySelector('#testApiBtn') && panel.querySelector('#testApiBtn').addEventListener('click', () => {
      window.TranslateSettingsEngine.testAPI(inst);
    });
    panel.querySelector('#resetBtn') && panel.querySelector('#resetBtn').addEventListener('click', () => {
      inst.resetSettings();
    });
    panel.querySelector('#clearCacheBtn') && panel.querySelector('#clearCacheBtn').addEventListener('click', () => {
      inst.clearCache();
    });
    panel.querySelector('#friendIndependent') && panel.querySelector('#friendIndependent').addEventListener('change', () => {
      window.TranslateSettingsFriends.updateFriendConfigVisibility(inst);
      if (panel.querySelector('#friendIndependent').checked) {
        window.TranslateSettingsFriends.loadCurrentFriendConfig(inst);
      }
    });
    panel.querySelector('#manageFriendsBtn') && panel.querySelector('#manageFriendsBtn').addEventListener('click', () => {
      window.TranslateSettingsFriends.showFriendConfigManager(inst);
    });
  }

  window.TranslateSettingsRender = { render, bindEvents };
})();
