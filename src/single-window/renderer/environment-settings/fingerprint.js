; (function () {
  'use strict';
  const state = window.EnvSettingsState;
  function container() { return state.container; }

  async function loadFingerprintConfig(accountId) {
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.getFingerprint(accountId);
      const fingerprintToggle = container().querySelector('#fingerprint-enabled');
      const fingerprintContent = container().querySelector('#fingerprint-content');

      if (result.success && result.config) {
        state.currentFingerprintConfig = result.config;
        state.fingerprintEnabled = true;
        populateFingerprintForm(result.config);

        // 设置开关状态和内容可见性
        if (fingerprintToggle) {
          fingerprintToggle.checked = true;
        }
        if (fingerprintContent) {
          fingerprintContent.classList.remove('disabled');
        }
      } else {
        state.currentFingerprintConfig = null;
        state.fingerprintEnabled = false;

        // 新账号或没有指纹配置时，默认禁用
        if (fingerprintToggle) {
          fingerprintToggle.checked = false;
        }
        if (fingerprintContent) {
          fingerprintContent.classList.add('disabled');
        }
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 加载指纹配置错误:', error);
    }
  }

  async function loadFingerprintTemplates() {
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.listFingerprintTemplates();
      if (result.success && result.templates) {
        state.savedFingerprintTemplates = result.templates;
        const select = container().querySelector('#fingerprint-template-select');
        select.innerHTML = '<option value="">-- 选择模板 --</option>';
        result.templates.forEach(template => {
          const option = document.createElement('option');
          option.value = template.id;
          option.textContent = template.name;
          select.appendChild(option);
        });
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 加载指纹模板列表失败:', error);
    }
  }

  function populateFingerprintForm(config) {
    if (!config) return;
    container().querySelector('#fp-browser-type').value = config.browser?.type || 'chrome';
    container().querySelector('#fp-browser-version').value = config.browser?.version || '120.0.0.0';
    container().querySelector('#fp-os-type').value = config.os?.type || 'windows';
    container().querySelector('#fp-os-version').value = config.os?.version || '10.0';
    container().querySelector('#fp-user-agent').value = config.userAgent || '';
    container().querySelector('#fp-platform').value = config.os?.platform || 'Win32';
    container().querySelector('#fp-vendor').value = config.navigator?.vendor || 'Google Inc.';
    container().querySelector('#fp-language').value = config.navigator?.language || 'en-US';
    container().querySelector('#fp-languages').value = (config.navigator?.languages || ['en-US', 'en']).join(', ');
    container().querySelector('#fp-cpu-cores').value = config.hardware?.cpuCores || 8;
    container().querySelector('#fp-device-memory').value = config.hardware?.deviceMemory || 8;
    container().querySelector('#fp-screen-width').value = config.hardware?.screen?.width || 1920;
    container().querySelector('#fp-screen-height').value = config.hardware?.screen?.height || 1080;
    container().querySelector('#fp-color-depth').value = config.hardware?.screen?.colorDepth || 24;
    container().querySelector('#fp-pixel-ratio').value = config.hardware?.devicePixelRatio || 1;
    container().querySelector('#fp-canvas-mode').value = config.canvas?.mode || 'noise';
    container().querySelector('#fp-canvas-noise-level').value = config.canvas?.noiseLevel || 'medium';
    container().querySelector('#fp-webgl-mode').value = config.webgl?.mode || 'custom';
    container().querySelector('#fp-webgl-noise-level').value = config.webgl?.noiseLevel || 'medium';
    container().querySelector('#fp-webgl-vendor').value = config.webgl?.vendor || '';
    container().querySelector('#fp-webgl-renderer').value = config.webgl?.renderer || '';
    container().querySelector('#fp-audio-mode').value = config.audio?.mode || 'noise';
    container().querySelector('#fp-audio-noise-level').value = config.audio?.noiseLevel || 'medium';
    container().querySelector('#fp-clientrects-mode').value = config.clientRects?.mode || 'noise';
    container().querySelector('#fp-clientrects-noise-level').value = config.clientRects?.noiseLevel || 'low';
    container().querySelector('#fp-timezone-mode').value = config.timezone?.mode || 'custom';
    container().querySelector('#fp-timezone-name').value = config.timezone?.name || 'America/New_York';
    container().querySelector('#fp-geolocation-mode').value = config.geolocation?.mode || 'custom';
    container().querySelector('#fp-latitude').value = config.geolocation?.latitude || 40.7128;
    container().querySelector('#fp-longitude').value = config.geolocation?.longitude || -74.0060;
    container().querySelector('#fp-geo-accuracy').value = config.geolocation?.accuracy || 100;
    container().querySelector('#fp-webrtc-mode').value = config.webrtc?.mode || 'replace';
    container().querySelector('#fp-local-ip').value = config.webrtc?.localIP || '192.168.1.100';
    container().querySelector('#fp-dnt').value = config.privacy?.doNotTrack === null ? 'null' : String(config.privacy?.doNotTrack);
    container().querySelector('#fp-gpc').value = String(config.privacy?.globalPrivacyControl || false);
    container().querySelector('#fp-media-devices-mode').value = config.mediaDevices?.mode || 'fake';
    container().querySelector('#fp-battery-mode').value = config.battery?.mode || 'privacy';
    container().querySelector('#fp-sensors-mode').value = config.sensors?.mode || 'disable';
    container().querySelector('#fp-speech-mode').value = config.speech?.mode || 'minimal';
    container().querySelector('#fp-clipboard-mode').value = config.advancedApis?.clipboard?.mode || 'ask';
    container().querySelector('#fp-notification-mode').value = config.advancedApis?.notification?.mode || 'deny';
    container().querySelector('#fp-webgl-mode').dispatchEvent(new Event('change'));
    container().querySelector('#fp-timezone-mode').dispatchEvent(new Event('change'));
    container().querySelector('#fp-geolocation-mode').dispatchEvent(new Event('change'));
    container().querySelector('#fp-webrtc-mode').dispatchEvent(new Event('change'));
  }

  function collectFingerprintFormData() {
    const languagesStr = container().querySelector('#fp-languages').value;
    const languages = languagesStr.split(',').map(l => l.trim()).filter(l => l);
    return {
      browser: {
        type: container().querySelector('#fp-browser-type').value,
        version: container().querySelector('#fp-browser-version').value,
        majorVersion: parseInt(container().querySelector('#fp-browser-version').value.split('.')[0]) || 120
      },
      os: {
        type: container().querySelector('#fp-os-type').value,
        version: container().querySelector('#fp-os-version').value,
        platform: container().querySelector('#fp-platform').value
      },
      userAgent: container().querySelector('#fp-user-agent').value,
      navigator: {
        vendor: container().querySelector('#fp-vendor').value,
        language: container().querySelector('#fp-language').value,
        languages: languages
      },
      hardware: {
        cpuCores: parseInt(container().querySelector('#fp-cpu-cores').value) || 8,
        deviceMemory: parseInt(container().querySelector('#fp-device-memory').value) || 8,
        screen: (function () {
          const width = parseInt(container().querySelector('#fp-screen-width').value) || 1920;
          const height = parseInt(container().querySelector('#fp-screen-height').value) || 1080;
          return { width: width, height: height, availWidth: width, availHeight: height - 40, colorDepth: parseInt(container().querySelector('#fp-color-depth').value) || 24, pixelDepth: parseInt(container().querySelector('#fp-color-depth').value) || 24 };
        })(),
        devicePixelRatio: parseFloat(container().querySelector('#fp-pixel-ratio').value) || 1
      },
      canvas: { mode: container().querySelector('#fp-canvas-mode').value, noiseLevel: container().querySelector('#fp-canvas-noise-level').value },
      webgl: { mode: container().querySelector('#fp-webgl-mode').value, noiseLevel: container().querySelector('#fp-webgl-noise-level').value, vendor: container().querySelector('#fp-webgl-vendor').value, renderer: container().querySelector('#fp-webgl-renderer').value },
      audio: { mode: container().querySelector('#fp-audio-mode').value, noiseLevel: container().querySelector('#fp-audio-noise-level').value },
      clientRects: { mode: container().querySelector('#fp-clientrects-mode').value, noiseLevel: container().querySelector('#fp-clientrects-noise-level').value },
      timezone: { mode: container().querySelector('#fp-timezone-mode').value, name: container().querySelector('#fp-timezone-name').value },
      geolocation: { mode: container().querySelector('#fp-geolocation-mode').value, latitude: parseFloat(container().querySelector('#fp-latitude').value) || 40.7128, longitude: parseFloat(container().querySelector('#fp-longitude').value) || -74.0060, accuracy: parseInt(container().querySelector('#fp-geo-accuracy').value) || 100 },
      webrtc: { mode: container().querySelector('#fp-webrtc-mode').value, localIP: container().querySelector('#fp-local-ip').value },
      privacy: { doNotTrack: container().querySelector('#fp-dnt').value === 'null' ? null : container().querySelector('#fp-dnt').value, globalPrivacyControl: container().querySelector('#fp-gpc').value === 'true' },
      mediaDevices: { mode: container().querySelector('#fp-media-devices-mode').value },
      battery: { mode: container().querySelector('#fp-battery-mode').value },
      sensors: { mode: container().querySelector('#fp-sensors-mode').value },
      speech: { mode: container().querySelector('#fp-speech-mode').value },
      advancedApis: { clipboard: { mode: container().querySelector('#fp-clipboard-mode').value }, notification: { mode: container().querySelector('#fp-notification-mode').value } }
    };
  }

  async function generateFingerprint() {
    if (!window.electronAPI) return;
    showFingerprintLoading('正在生成指纹配置...');
    try {
      const options = { os: container().querySelector('#fp-os-type').value, browser: container().querySelector('#fp-browser-type').value };
      const result = await window.electronAPI.generateFingerprint(options);
      if (result.success && result.config) {
        state.currentFingerprintConfig = result.config;
        populateFingerprintForm(result.config);
        showFingerprintSuccess('指纹配置已生成！请点击"应用并保存"保存配置。');
      } else { showFingerprintError('生成指纹失败: ' + (result.error || '未知错误')); }
    } catch (error) {
      console.error('[EnvironmentPanel] 生成指纹失败:', error);
      showFingerprintError('生成指纹失败: ' + error.message);
    }
  }

  async function testFingerprint() {
    if (!window.electronAPI) return;
    showFingerprintLoading('正在测试指纹配置...');
    try {
      const config = collectFingerprintFormData();
      const result = await window.electronAPI.runFingerprintTests(config, { real: true });
      if (result.success && result.report) {
        const report = result.report;
        const failedDetails = report.results.filter(r => !r.passed).map(r => {
          const exp = (r.expected !== undefined && r.expected !== null) ? String(r.expected) : '未设定';
          const act = (r.actual !== undefined && r.actual !== null) ? String(r.actual) : '未测得';
          return '<p style="color: #ff4d4f;">❌ ' + r.name + '：期望 ' + exp + '，实际 ' + act + '</p>';
        }).join('');
        const html = '<div class="env-result-success">' +
          '<h4>指纹测试报告（真实测量）</h4>' +
          '<p><strong>通过率:</strong> ' + report.summary.passRate + '</p>' +
          '<p><strong>通过:</strong> ' + report.summary.passed + ' / ' + report.summary.total + '</p>' +
          '<p><strong>失败:</strong> ' + report.summary.failed + '</p>' +
          failedDetails +
          '</div>';
        showFingerprintResult(html);
      } else { showFingerprintError('测试失败: ' + (result.error || '未知错误')); }
    } catch (error) {
      console.error('[EnvironmentPanel] 测试指纹失败:', error);
      showFingerprintError('测试失败: ' + error.message);
    }
  }

  async function previewFingerprint() {
    if (!window.electronAPI) return;
    showFingerprintLoading('正在生成预览...');
    try {
      const config = collectFingerprintFormData();
      const result = await window.electronAPI.previewFingerprint(config);
      if (result.success && result.preview) {
        const preview = result.preview;
        const browserStr = preview.browser?.type ? (preview.browser.type + ' ' + (preview.browser.version || '')) : config.browser?.type;
        const osStr = preview.os?.type ? (preview.os.type + ' (' + (preview.os.platform || '') + ')') : config.os?.type;
        const userAgentStr = preview.browser?.userAgent || config.userAgent;
        const screenStr = preview.hardware?.screen || (config.hardware?.screen?.width + 'x' + config.hardware?.screen?.height);
        const cpuStr = preview.hardware?.cpuCores || config.hardware?.cpuCores;
        const memoryStr = preview.hardware?.deviceMemory || config.hardware?.deviceMemory;
        const timezoneStr = preview.timezone?.name || config.timezone?.name;
        const languageStr = config.navigator?.language || 'en-US';
        const html = '<div class="env-result-success">' +
          '<h4>指纹预览</h4>' +
          '<p><strong>浏览器:</strong> ' + browserStr + '</p>' +
          '<p><strong>操作系统:</strong> ' + osStr + '</p>' +
          '<p><strong>User-Agent:</strong> <small>' + userAgentStr + '</small></p>' +
          '<p><strong>屏幕:</strong> ' + screenStr + '</p>' +
          '<p><strong>CPU核心:</strong> ' + cpuStr + '</p>' +
          '<p><strong>内存:</strong> ' + memoryStr + ' GB</p>' +
          '<p><strong>时区:</strong> ' + timezoneStr + '</p>' +
          '<p><strong>语言:</strong> ' + languageStr + '</p>' +
          '<p><strong>Canvas模式:</strong> ' + (preview.canvas?.mode || config.canvas?.mode) + '</p>' +
          '<p><strong>WebGL供应商:</strong> ' + (preview.webgl?.vendor || config.webgl?.vendor || '未设置') + '</p>' +
          '<p><strong>WebRTC模式:</strong> ' + (preview.webrtc?.mode || config.webrtc?.mode) + '</p>' +
          '</div>';
        showFingerprintResult(html);
      } else {
        const html = '<div class="env-result-success">' +
          '<h4>指纹预览</h4>' +
          '<p><strong>浏览器:</strong> ' + (config.browser?.type) + ' ' + (config.browser?.version) + '</p>' +
          '<p><strong>操作系统:</strong> ' + (config.os?.type) + ' ' + (config.os?.version) + '</p>' +
          '<p><strong>平台:</strong> ' + (config.os?.platform) + '</p>' +
          '<p><strong>屏幕:</strong> ' + (config.hardware?.screen?.width) + 'x' + (config.hardware?.screen?.height) + '</p>' +
          '<p><strong>CPU核心:</strong> ' + (config.hardware?.cpuCores) + '</p>' +
          '<p><strong>内存:</strong> ' + (config.hardware?.deviceMemory) + ' GB</p>' +
          '<p><strong>时区:</strong> ' + (config.timezone?.name) + '</p>' +
          '<p><strong>语言:</strong> ' + (config.navigator?.language) + '</p>' +
          '<p><strong>Canvas模式:</strong> ' + (config.canvas?.mode) + '</p>' +
          '<p><strong>WebGL模式:</strong> ' + (config.webgl?.mode) + '</p>' +
          '<p><strong>WebRTC模式:</strong> ' + (config.webrtc?.mode) + '</p>' +
          '</div>';
        showFingerprintResult(html);
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 预览指纹失败:', error);
      showFingerprintError('预览失败: ' + error.message);
    }
  }

  function resetFingerprint() {
    const defaultConfig = {
      browser: { type: 'chrome', version: '120.0.0.0', majorVersion: 120 },
      os: { type: 'windows', version: '10.0', platform: 'Win32' },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      navigator: { vendor: 'Google Inc.', language: 'en-US', languages: ['en-US', 'en'] },
      hardware: { cpuCores: 8, deviceMemory: 8, screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24 }, devicePixelRatio: 1 },
      canvas: { mode: 'noise', noiseLevel: 'medium' },
      webgl: { mode: 'custom', noiseLevel: 'medium', vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)' },
      audio: { mode: 'noise', noiseLevel: 'medium' },
      clientRects: { mode: 'noise', noiseLevel: 'low' },
      timezone: { mode: 'custom', name: 'America/New_York' },
      geolocation: { mode: 'custom', latitude: 40.7128, longitude: -74.0060, accuracy: 100 },
      webrtc: { mode: 'replace', localIP: '192.168.1.100' },
      privacy: { doNotTrack: null, globalPrivacyControl: false },
      mediaDevices: { mode: 'fake' },
      battery: { mode: 'privacy' },
      sensors: { mode: 'disable' },
      speech: { mode: 'minimal' },
      advancedApis: { clipboard: { mode: 'ask' }, notification: { mode: 'deny' } }
    };
    populateFingerprintForm(defaultConfig);
    showFingerprintSuccess('已重置为默认配置');
  }

  async function applyTemplate() {
    if (!window.electronAPI) return;
    const templateId = container().querySelector('#fingerprint-template-select').value;
    if (!templateId) { showFingerprintError('请先选择一个模板'); return; }
    if (!state.currentAccountId) { showFingerprintError('请先选择一个账号'); return; }
    showFingerprintLoading('正在应用模板...');
    try {
      const result = await window.electronAPI.applyFingerprintTemplate(templateId, state.currentAccountId);
      if (result.success && result.config) {
        state.currentFingerprintConfig = result.config;
        populateFingerprintForm(result.config);
        showFingerprintSuccess('模板已应用！');
        try {
          const recreateResult = await window.electronAPI.recreateView(state.currentAccountId);
          if (!recreateResult.success) { }
        } catch (e) { }
      } else { showFingerprintError('应用模板失败: ' + (result.error || '未知错误')); }
    } catch (error) {
      console.error('[EnvironmentPanel] 应用模板失败:', error);
      showFingerprintError('应用模板失败: ' + error.message);
    }
  }

  async function saveAsTemplate() {
    if (!window.electronAPI) return;
    showInlineInput('请输入模板名称:', async (name) => {
      if (!name || name.trim() === '') return;
      const config = collectFingerprintFormData();
      try {
        const result = await window.electronAPI.createFingerprintTemplate({ name: name.trim(), config });
        if (result.success) { showFingerprintSuccess('模板 "' + name + '" 已保存！'); await loadFingerprintTemplates(); }
        else { showFingerprintError('保存模板失败: ' + (result.error || '未知错误')); }
      } catch (error) { console.error('[EnvironmentPanel] 保存模板失败:', error); showFingerprintError('保存模板失败: ' + error.message); }
    });
  }

  async function exportTemplate() {
    if (!window.electronAPI) return;
    const templateId = container().querySelector('#fingerprint-template-select').value;
    if (!templateId) {
      const config = collectFingerprintFormData();
      const jsonStr = JSON.stringify(config, null, 2);
      downloadJSON(jsonStr, 'fingerprint-config.json');
      showFingerprintSuccess('配置已导出！');
      return;
    }
    try {
      const result = await window.electronAPI.exportFingerprintTemplate(templateId);
      if (result.success && result.data) { downloadJSON(result.data, 'fingerprint-template-' + templateId + '.json'); showFingerprintSuccess('模板已导出！'); }
      else { showFingerprintError('导出模板失败: ' + (result.error || '未知错误')); }
    } catch (error) { console.error('[EnvironmentPanel] 导出模板失败:', error); showFingerprintError('导出模板失败: ' + error.message); }
  }

  function importTemplate() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const result = await window.electronAPI.importFingerprintTemplate(text);
        if (result.success) { showFingerprintSuccess('模板已导入！'); await loadFingerprintTemplates(); }
        else { showFingerprintError('导入模板失败: ' + (result.error || '未知错误')); }
      } catch (error) { console.error('[EnvironmentPanel] 导入模板失败:', error); showFingerprintError('导入模板失败: ' + error.message); }
    };
    input.click();
  }

  function downloadJSON(jsonStr, filename) {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function showInlineInput(message, callback) {
    const buttonsGroup = container().querySelector('.env-panel-footer');
    const originalDisplay = buttonsGroup.style.display;
    buttonsGroup.style.display = 'none';
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = 'padding: 15px; background: #f0f8ff; border: 2px solid #1890ff; border-radius: 8px; margin: 15px;';
    inputContainer.innerHTML =
      '<div style="margin-bottom: 10px; font-weight: bold; color: #1890ff;">' + message + '</div>' +
      '<input type="text" id="inline-input" style="width: 100%; padding: 8px; border: 1px solid #1890ff; border-radius: 4px; font-size: 14px; box-sizing: border-box; margin-bottom: 10px;">' +
      '<div style="text-align: right;">' +
      '  <button id="inline-cancel" style="padding: 6px 16px; margin-right: 8px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>' +
      '  <button id="inline-ok" style="padding: 6px 16px; border: none; background: #1890ff; color: white; border-radius: 4px; cursor: pointer;">确定</button>' +
      '</div>';
    container().appendChild(inputContainer);
    const input = inputContainer.querySelector('#inline-input');
    const okBtn = inputContainer.querySelector('#inline-ok');
    const cancelBtn = inputContainer.querySelector('#inline-cancel');
    setTimeout(() => { input.focus(); input.select(); }, 100);
    const cleanup = () => { inputContainer.remove(); buttonsGroup.style.display = originalDisplay; };
    const handleOk = () => { const value = input.value; cleanup(); callback(value); };
    const handleCancel = () => { cleanup(); };
    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleOk(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') handleCancel(); });
  }

  function showFingerprintResult(html) {
    const resultBox = container().querySelector('#fingerprint-result');
    const resultWrapper = container().querySelector('#fingerprint-result-wrapper');

    if (resultBox) {
      resultBox.innerHTML = html;
      resultBox.classList.remove('hidden');
    }

    if (resultWrapper) {
      resultWrapper.classList.remove('hidden');
      resultWrapper.classList.add('visible');
    }
  }

  function showFingerprintLoading(message) {
    showFingerprintResult(`<div class="env-result-loading">${message}</div>`);
  }

  function showFingerprintError(message) {
    showFingerprintResult(`<div class="env-result-error">❌ ${message}</div>`);
  }

  function showFingerprintSuccess(message) {
    showFingerprintResult(`<div class="env-result-success">${message}</div>`);
    // Auto-hide success messages after 3 seconds if it's not a preview (simple text)
    // But here we don't know if it's preview or not easily, but usually preview is long HTML.
    // Let's keep it simple.
  }

  window.FingerprintSettings = {
    loadFingerprintConfig,
    loadFingerprintTemplates,
    populateFingerprintForm,
    collectFingerprintFormData,
    generateFingerprint,
    testFingerprint,
    previewFingerprint,
    resetFingerprint,
    applyTemplate,
    saveAsTemplate,
    exportTemplate,
    importTemplate,
    downloadJSON,
    showFingerprintResult,
    showFingerprintLoading,
    showFingerprintSuccess,
    showFingerprintError
  };
})();
