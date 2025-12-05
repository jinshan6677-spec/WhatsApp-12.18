; (function () {
  'use strict';
  const state = window.EnvSettingsState || (window.EnvSettingsState = { currentAccountId: null, currentConfig: null, currentFingerprintConfig: null, savedProxyConfigs: {}, savedFingerprintTemplates: [], container: null });

  async function init() {
    const host = document.getElementById('environment-settings-host');
    if (!host) return;
    state.container = host;
    window.EnvSettingsRender.render(host);
    setupEventListeners();

    try {
      const res = await window.electronAPI?.getActiveAccount?.();
      const activeAccountId = res?.accountId || null;
      if (activeAccountId) {
        await setAccount(activeAccountId);
      } else {
        await setAccount(null);
      }
    } catch (_) { }
  }

  function setupEventListeners() {
    const c = state.container;
    const proxyEnabled = c.querySelector('#proxy-enabled');
    const proxyContent = c.querySelector('#proxy-content');
    proxyEnabled.addEventListener('change', (e) => { proxyContent.classList.toggle('disabled', !e.target.checked); });
    const fingerprintEnabled = c.querySelector('#fingerprint-enabled');
    const fingerprintContent = c.querySelector('#fingerprint-content');
    fingerprintEnabled.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      fingerprintContent.classList.toggle('disabled', !enabled);

      // 当禁用时，清除所有指纹数据
      if (!enabled && state.currentAccountId) {
        try {
          const result = await window.electronAPI.disableFingerprint(state.currentAccountId);
          if (result.success) {
            console.log('[EnvironmentPanel] Fingerprint disabled and data cleared:', result);
            // 清除当前的指纹配置状态
            state.currentFingerprintConfig = null;
            window.FingerprintSettings.showFingerprintSuccess('指纹认证已禁用，所有指纹数据已清除');
          } else {
            console.error('[EnvironmentPanel] Failed to disable fingerprint:', result.error);
            window.FingerprintSettings.showFingerprintError('禁用指纹失败: ' + result.error);
          }
        } catch (error) {
          console.error('[EnvironmentPanel] Error disabling fingerprint:', error);
          window.FingerprintSettings.showFingerprintError('禁用指纹失败: ' + error.message);
        }
      }
    });
    c.querySelector('#proxy-select').addEventListener('change', window.ProxySettings.handleProxySelect);
    c.querySelector('#refresh-proxy-list').addEventListener('click', window.ProxySettings.loadProxyConfigs);
    c.querySelector('#delete-proxy-btn').addEventListener('click', window.ProxySettings.deleteProxyConfig);
    c.querySelector('#toggle-password').addEventListener('click', window.ProxySettings.togglePasswordVisibility);
    c.querySelector('#parse-proxy-btn').addEventListener('click', window.ProxySettings.parseProxyString);
    c.querySelector('#test-proxy-btn').addEventListener('click', window.ProxySettings.testProxy);
    c.querySelector('#detect-network-btn').addEventListener('click', window.ProxySettings.detectNetwork);
    c.querySelector('#save-proxy-config-btn').addEventListener('click', window.ProxySettings.saveProxyConfig);
    c.querySelector('#generate-fingerprint-btn').addEventListener('click', window.FingerprintSettings.generateFingerprint);
    c.querySelector('#test-fingerprint-btn').addEventListener('click', window.FingerprintSettings.testFingerprint);
    c.querySelector('#preview-fingerprint-btn').addEventListener('click', window.FingerprintSettings.previewFingerprint);
    c.querySelector('#reset-fingerprint-btn').addEventListener('click', window.FingerprintSettings.resetFingerprint);
    c.querySelector('#apply-template-btn').addEventListener('click', window.FingerprintSettings.applyTemplate);
    c.querySelector('#save-as-template-btn').addEventListener('click', window.FingerprintSettings.saveAsTemplate);
    c.querySelector('#export-template-btn').addEventListener('click', window.FingerprintSettings.exportTemplate);
    c.querySelector('#import-template-btn').addEventListener('click', window.FingerprintSettings.importTemplate);
    window.EnvSettingsRender.setupCollapsibles();
    window.EnvSettingsRender.setupConditionalFields();
    c.querySelector('#apply-btn').addEventListener('click', applyConfig);

    // 结果展示关闭按钮 - 使用事件委托以确保动态内容也能响应
    c.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('#close-result-btn');
      if (closeBtn) {
        const wrapper = c.querySelector('#fingerprint-result-wrapper');
        if (wrapper) {
          wrapper.classList.remove('visible');
          wrapper.classList.add('hidden');
        }
      }
    });
  }

  async function setAccount(accountId) {
    state.currentAccountId = accountId || null;
    if (!accountId) return;
    await window.ProxySettings.loadAccountConfig(accountId);
    await window.ProxySettings.loadProxyConfigs();
    await window.FingerprintSettings.loadFingerprintConfig(accountId);
    await window.FingerprintSettings.loadFingerprintTemplates();
  }

  async function applyConfig() {
    if (!window.electronAPI) {
      window.FingerprintSettings.showFingerprintError('系统错误: electronAPI 不可用');
      return;
    }
    const applyBtn = state.container.querySelector('#apply-btn');
    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.textContent = '保存中...';
    }
    if (!state.currentAccountId) {
      window.FingerprintSettings.showFingerprintError('请先选择一个账号');
      if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = '应用并保存'; }
      return;
    }
    const proxyConfig = window.ProxySettings.collectProxyFormData();
    try {
      const proxyResult = await window.electronAPI.saveEnvironmentConfig(state.currentAccountId, proxyConfig);
      if (!proxyResult.success) {
        window.FingerprintSettings.showFingerprintError('保存代理配置失败: ' + (proxyResult.error || '未知错误'));
        if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = '应用并保存'; }
        return;
      }
    } catch (error) {
      window.FingerprintSettings.showFingerprintError('保存代理配置失败: ' + error.message);
      if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = '应用并保存'; }
      return;
    }

    if (state.container.querySelector('#fingerprint-enabled').checked) {
      const fingerprintConfig = window.FingerprintSettings.collectFingerprintFormData();
      try {
        const validateResult = await window.electronAPI.validateFingerprint(fingerprintConfig);
        if (!validateResult.valid) {
          const errorMessages = validateResult.errors.map(e => (e.field + ': ' + e.reason)).join('\n');
          window.FingerprintSettings.showFingerprintError('指纹配置验证失败:\n' + errorMessages);
          if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = '应用并保存'; }
          return;
        }
      } catch (error) { }
      try {
        const fpResult = await window.electronAPI.saveFingerprint(state.currentAccountId, fingerprintConfig);
        if (!fpResult.success) {
          window.FingerprintSettings.showFingerprintError('保存指纹配置失败: ' + (fpResult.error || '未知错误'));
          if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = '应用并保存'; }
          return;
        }
        state.currentFingerprintConfig = fpResult.config;
      } catch (error) {
        window.FingerprintSettings.showFingerprintError('保存指纹配置失败: ' + error.message);
        if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = '应用并保存'; }
        return;
      }
    }
    try {
      const recreateResult = await window.electronAPI.recreateView(state.currentAccountId);
      if (!recreateResult.success) { }
    } catch (e) { }
    window.FingerprintSettings.showFingerprintSuccess('配置已保存成功！已重建视图并应用新的环境设置。');
    if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = '应用并保存'; }
  }

  window.EnvironmentSettingsPanel = { init, setAccount, open: setAccount };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
