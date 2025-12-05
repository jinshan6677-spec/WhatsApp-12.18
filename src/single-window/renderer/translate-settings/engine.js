;(function(){
  'use strict';
  async function loadEngineConfig(panel, engineName){
    try {
      if (!window.translationAPI) return;
      const selectedEngine = engineName || panel.querySelector('#translationEngine').value;
      if (!['custom', 'gpt4', 'gemini', 'deepseek'].includes(selectedEngine)) return;
      const res = await window.translationAPI.getEngineConfig(selectedEngine);
      if (res.success && res.data) {
        const cfg = res.data;
        if (cfg.apiKey) panel.querySelector('#apiKey').value = cfg.apiKey;
        if (selectedEngine === 'custom') {
          if (cfg.endpoint) panel.querySelector('#apiEndpoint').value = cfg.endpoint;
          if (cfg.model) panel.querySelector('#apiModel').value = cfg.model;
        } else if (cfg.model) {
          panel.querySelector('#apiModel').value = cfg.model;
        }
      }
    } catch (_) {}
  }

  async function saveCurrentEngineConfig(panel, engineName){
    try {
      if (!window.translationAPI) return;
      if (!['custom', 'gpt4', 'gemini', 'deepseek'].includes(engineName)) return;
      const apiKey = panel.querySelector('#apiKey')?.value;
      const apiEndpoint = panel.querySelector('#apiEndpoint')?.value;
      const apiModel = panel.querySelector('#apiModel')?.value;
      if (!apiKey) {
        const existing = await window.translationAPI.getEngineConfig(engineName);
        if (existing.success && existing.data?.apiKey) return;
        return;
      }
      const engineConfig = { apiKey, enabled: true };
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
      await window.translationAPI.saveEngineConfig(engineName, engineConfig);
    } catch (_) {}
  }

  async function testAPI(inst){
    try {
      if (!inst.accountId) throw new Error('请先选择账号');
      const engineSelect = inst.panel.querySelector('#translationEngine').value;
      const apiKey = inst.panel.querySelector('#apiKey')?.value;
      if (engineSelect !== 'google' && !apiKey) throw new Error('请先填写 API Key');
      const response = await window.translationAPI.translate({
        accountId: inst.accountId,
        text: 'Hello World',
        sourceLang: 'auto',
        targetLang: 'zh-CN',
        engineName: engineSelect
      });
      if (response.success) {
        inst.showMessage('测试成功：' + (response.data?.translatedText || 'OK'), 'success');
      } else {
        inst.showMessage('测试失败：' + (response.error || '未知错误'), 'error');
      }
    } catch (error) {
      inst.showMessage('测试失败：' + error.message, 'error');
    }
  }

  window.TranslateSettingsEngine = { loadEngineConfig, saveCurrentEngineConfig, testAPI };
})();

