;(function(){
  'use strict';
  const state = window.EnvSettingsState;
  function container(){ return state.container; }

  async function loadProxyConfigs(){
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.getProxyConfigs();
      if (result.success && result.configs) {
        state.savedProxyConfigs = result.configs;
        const select = container().querySelector('#proxy-select');
        select.innerHTML = '<option value="">-- 新建代理配置 --</option>';
        Object.keys(result.configs).forEach(name => {
          const option = document.createElement('option');
          option.value = name;
          option.textContent = name;
          select.appendChild(option);
        });
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 加载代理配置列表失败:', error);
    }
  }

  function populateProxyForm(config){
    if (config && config.proxy) {
      container().querySelector('#proxy-enabled').checked = config.proxy.enabled || false;
      container().querySelector('#proxy-content').classList.toggle('disabled', !config.proxy.enabled);
      container().querySelector('#proxy-protocol').value = config.proxy.protocol || 'http';
      container().querySelector('#proxy-host').value = config.proxy.host || '';
      container().querySelector('#proxy-port').value = config.proxy.port || '';
      container().querySelector('#proxy-username').value = config.proxy.username || '';
      container().querySelector('#proxy-password').value = config.proxy.password || '';
    }
  }

  async function loadAccountConfig(accountId){
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.getEnvironmentConfig(accountId);
      if (result.success && result.config) {
        state.currentConfig = result.config;
        populateProxyForm(result.config);
      } else {
        console.warn('[EnvironmentPanel] 加载配置失败:', result.error);
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 加载配置错误:', error);
    }
  }

  function handleProxySelect(e){
    const name = e.target.value;
    const deleteBtn = container().querySelector('#delete-proxy-btn');
    if (!name) {
      container().querySelector('#proxy-protocol').value = 'http';
      container().querySelector('#proxy-host').value = '';
      container().querySelector('#proxy-port').value = '';
      container().querySelector('#proxy-username').value = '';
      container().querySelector('#proxy-password').value = '';
      deleteBtn.style.display = 'none';
      return;
    }
    const config = state.savedProxyConfigs[name];
    if (config) {
      container().querySelector('#proxy-protocol').value = config.protocol || 'http';
      container().querySelector('#proxy-host').value = config.host || '';
      container().querySelector('#proxy-port').value = config.port || '';
      container().querySelector('#proxy-username').value = config.username || '';
      container().querySelector('#proxy-password').value = config.password || '';
      deleteBtn.style.display = 'inline-block';
      showProxySuccess('已加载配置: ' + name);
    }
  }

  async function deleteProxyConfig(){
    const select = container().querySelector('#proxy-select');
    const name = select.value;
    if (!name) return;
    showInlineConfirm('确定要删除代理配置 "' + name + '" 吗？', async (confirmed) => {
      if (!confirmed) return;
      try {
        const result = await window.electronAPI.deleteNamedProxy(name);
        if (result.success) {
          showProxySuccess('配置 "' + name + '" 已删除');
          select.value = '';
          handleProxySelect({ target: select });
          await loadProxyConfigs();
        } else {
          showProxyError('删除失败: ' + (result.error || '未知错误'));
        }
      } catch (error) {
        console.error('[EnvironmentPanel] 删除配置失败:', error);
        showProxyError('删除失败: ' + error.message);
      }
    });
  }

  function togglePasswordVisibility(){
    const input = container().querySelector('#proxy-password');
    const btn = container().querySelector('#toggle-password');
    if (input.type === 'password') { input.type = 'text'; btn.textContent = '🙈'; }
    else { input.type = 'password'; btn.textContent = '👁'; }
  }

  async function parseProxyString(){
    if (!window.electronAPI) return;
    const proxyString = container().querySelector('#proxy-smart-paste').value.trim();
    if (!proxyString) { showProxyError('请输入代理字符串'); return; }
    try {
      const result = await window.electronAPI.parseProxyString(proxyString);
      if (result.success && result.config) {
        const config = result.config;
        container().querySelector('#proxy-protocol').value = config.protocol || 'http';
        container().querySelector('#proxy-host').value = config.host || '';
        container().querySelector('#proxy-port').value = config.port || '';
        container().querySelector('#proxy-username').value = config.username || '';
        container().querySelector('#proxy-password').value = config.password || '';
        showProxySuccess('代理信息已自动填充！');
      } else {
        showProxyError('解析失败: ' + (result.error || '格式不正确'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 解析代理字符串失败:', error);
      showProxyError('解析失败: ' + error.message);
    }
  }

  async function testProxy(){
    if (!window.electronAPI) return;
    const proxyConfig = collectProxyFormData().proxy;
    if (!proxyConfig.host || !proxyConfig.port) { showProxyError('请先填写代理主机和端口'); return; }
    showProxyLoading('正在测试代理连接...');
    try {
      const result = await window.electronAPI.testProxy(proxyConfig);
      if (result.success) {
        const html = 
          '<div class="env-result-success">' +
          '  <h4>✓ 代理连接成功</h4>' +
          '  <p><strong>IP地址:</strong> ' + result.ip + '</p>' +
          '  <p><strong>位置:</strong> ' + result.location.city + ', ' + result.location.country + '</p>' +
          '  <p><strong>时区:</strong> ' + result.timezone + '</p>' +
          '  <p><strong>语言:</strong> ' + result.language + '</p>' +
          '  <p><strong>延迟:</strong> ' + result.latency + 'ms</p>' +
          '  <p><strong>ISP:</strong> ' + result.isp + '</p>' +
          '</div>';
        showProxyResult(html);
      } else {
        showProxyError('代理连接失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 测试代理失败:', error);
      showProxyError('测试失败: ' + error.message);
    }
  }

  async function detectNetwork(){
    if (!window.electronAPI) return;
    showProxyLoading('正在检测当前网络...');
    try {
      const result = await window.electronAPI.detectNetwork();
      if (result.success) {
        const html = 
          '<div class="env-result-success">' +
          '  <h4>当前网络信息</h4>' +
          '  <p><strong>IP地址:</strong> ' + result.ip + '</p>' +
          '  <p><strong>位置:</strong> ' + result.location.city + ', ' + result.location.country + '</p>' +
          '  <p><strong>时区:</strong> ' + result.timezone + '</p>' +
          '  <p><strong>语言:</strong> ' + result.language + '</p>' +
          '  <p><strong>ISP:</strong> ' + result.isp + '</p>' +
          '</div>';
        showProxyResult(html);
      } else {
        showProxyError('检测失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 检测网络失败:', error);
      showProxyError('检测失败: ' + error.message);
    }
  }

  async function saveProxyConfig(){
    if (!window.electronAPI) { showProxyError('系统错误: electronAPI 不可用'); return; }
    showInlineInput('请输入代理配置名称:', async (name) => {
      if (!name || name.trim() === '') return;
      const proxyConfig = collectProxyFormData().proxy;
      try {
        const result = await window.electronAPI.saveProxyConfig(name.trim(), proxyConfig);
        if (result.success) {
          showProxySuccess('代理配置 "' + name + '" 已保存！');
          await loadProxyConfigs();
        } else {
          showProxyError('保存失败: ' + (result.error || '未知错误'));
        }
      } catch (error) {
        console.error('[EnvironmentPanel] 保存代理配置失败:', error);
        showProxyError('保存失败: ' + error.message);
      }
    });
  }

  function collectProxyFormData(){
    const c = container();
    return {
      proxy: {
        enabled: c.querySelector('#proxy-enabled').checked,
        protocol: c.querySelector('#proxy-protocol').value,
        host: c.querySelector('#proxy-host').value,
        port: c.querySelector('#proxy-port').value,
        username: c.querySelector('#proxy-username').value,
        password: c.querySelector('#proxy-password').value
      }
    };
  }

  function showInlineInput(message, callback){
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

  function showInlineConfirm(message, callback){
    const buttonsGroup = container().querySelector('.env-panel-footer');
    const originalDisplay = buttonsGroup.style.display;
    buttonsGroup.style.display = 'none';
    const confirmContainer = document.createElement('div');
    confirmContainer.style.cssText = 'padding: 15px; background: #fff3e0; border: 2px solid #ff9800; border-radius: 8px; margin: 15px;';
    confirmContainer.innerHTML = 
      '<div style="margin-bottom: 15px; font-weight: bold; color: #ff6f00;">⚠️ ' + message + '</div>' +
      '<div style="text-align: right;">' +
      '  <button id="confirm-no" style="padding: 6px 16px; margin-right: 8px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>' +
      '  <button id="confirm-yes" style="padding: 6px 16px; border: none; background: #ff4d4f; color: white; border-radius: 4px; cursor: pointer;">删除</button>' +
      '</div>';
    container().appendChild(confirmContainer);
    const yesBtn = confirmContainer.querySelector('#confirm-yes');
    const noBtn = confirmContainer.querySelector('#confirm-no');
    const cleanup = () => { confirmContainer.remove(); buttonsGroup.style.display = originalDisplay; };
    yesBtn.addEventListener('click', () => { cleanup(); callback(true); });
    noBtn.addEventListener('click', () => { cleanup(); callback(false); });
    setTimeout(() => noBtn.focus(), 100);
  }

  function showProxyResult(html){
    const resultBox = container().querySelector('#proxy-result');
    resultBox.innerHTML = html;
    resultBox.classList.remove('hidden');
  }
  function showProxyLoading(message){ showProxyResult('<div class="env-result-loading">' + message + '</div>'); }
  function showProxySuccess(message){ showProxyResult('<div class="env-result-success">' + message + '</div>'); setTimeout(() => { container().querySelector('#proxy-result').classList.add('hidden'); }, 3000); }
  function showProxyError(message){ showProxyResult('<div class="env-result-error">❌ ' + message + '</div>'); }

  window.ProxySettings = {
    loadProxyConfigs,
    populateProxyForm,
    loadAccountConfig,
    handleProxySelect,
    deleteProxyConfig,
    togglePasswordVisibility,
    parseProxyString,
    testProxy,
    detectNetwork,
    saveProxyConfig,
    collectProxyFormData,
    showProxyResult,
    showProxyLoading,
    showProxySuccess,
    showProxyError
  };
})();
