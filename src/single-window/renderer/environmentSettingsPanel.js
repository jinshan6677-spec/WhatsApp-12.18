/**
 * 环境设置面板 - 代理配置和指纹设置
 * 
 * 为每个账号提供独立的代理配置和指纹设置界面
 * 
 * Requirements: 22.1-22.8 - 指纹配置UI面板
 */

(function () {
  'use strict';

  // 当前活动账号ID
  let currentAccountId = null;

  // 当前配置
  let currentConfig = null;

  // 当前指纹配置
  let currentFingerprintConfig = null;

  // 已保存的代理配置
  let savedProxyConfigs = {};

  // 已保存的指纹模板
  let savedFingerprintTemplates = [];

  // DOM元素
  let container = null;

  /**
   * 初始化环境设置面板
   */
  function init() {
    container = document.getElementById('environment-settings-host');
    if (!container) {
      console.error('[EnvironmentPanel] 找不到容器元素 #environment-settings-host');
      return;
    }

    renderPanelContent();
    setupEventListeners();
    console.log('[EnvironmentPanel] 环境设置面板已初始化');
  }

  /**
   * 渲染面板内容
   */
  function renderPanelContent() {
    container.innerHTML = `
      <div class="env-panel-body">
        <!-- 代理设置区域 -->
        <section class="env-section">
          <h3 class="env-section-title">
            <span>代理设置</span>
            <label class="env-toggle">
              <input type="checkbox" id="proxy-enabled">
              <span class="env-toggle-slider"></span>
            </label>
          </h3>

          <div class="env-section-content" id="proxy-content">
            <!-- 选择已保存的代理 -->
            <div class="env-form-group">
              <label>选择代理配置</label>
              <div class="env-input-group">
                <select id="proxy-select">
                  <option value="">-- 新建代理配置 --</option>
                </select>
                <button class="env-btn-icon" id="refresh-proxy-list" title="刷新列表">🔄</button>
                <button class="env-btn-icon" id="delete-proxy-btn" title="删除配置" style="display: none; color: #ff4d4f;">🗑️</button>
              </div>
            </div>

            <!-- 代理协议 -->
            <div class="env-form-group">
              <label>协议</label>
              <select id="proxy-protocol">
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>

            <!-- 主机和端口 -->
            <div class="env-form-row">
              <div class="env-form-group">
                <label>主机</label>
                <input type="text" id="proxy-host" placeholder="例如: 192.168.1.1">
              </div>
              <div class="env-form-group" style="width: 120px;">
                <label>端口</label>
                <input type="number" id="proxy-port" placeholder="8080" min="1" max="65535">
              </div>
            </div>

            <!-- 用户名和密码 -->
            <div class="env-form-row">
              <div class="env-form-group">
                <label>用户名（可选）</label>
                <input type="text" id="proxy-username" placeholder="用户名">
              </div>
              <div class="env-form-group">
                <label>密码（可选）</label>
                <div class="env-password-group">
                  <input type="password" id="proxy-password" placeholder="密码">
                  <button class="env-btn-icon" id="toggle-password" title="显示/隐藏密码">👁</button>
                </div>
              </div>
            </div>

            <!-- 智能填写 -->
            <div class="env-form-group">
              <label>智能填写（粘贴格式: IP:端口:用户名:密码）</label>
              <textarea id="proxy-smart-paste" rows="2" placeholder="例如: 192.168.1.1:8080:user:pass"></textarea>
              <button class="env-btn-secondary" id="parse-proxy-btn">解析并填充</button>
            </div>

            <!-- 操作按钮 -->
            <div class="env-button-group">
              <button class="env-btn-primary" id="test-proxy-btn">检测代理服务</button>
              <button class="env-btn-secondary" id="detect-network-btn">检测当前网络</button>
              <button class="env-btn-secondary" id="save-proxy-config-btn">保存为配置</button>
            </div>

            <!-- 检测结果 -->
            <div class="env-result-box hidden" id="proxy-result"></div>
          </div>
        </section>

        <!-- 指纹设置区域 -->
        <section class="env-section">
          <h3 class="env-section-title">
            <span>指纹设置</span>
            <label class="env-toggle">
              <input type="checkbox" id="fingerprint-enabled" checked>
              <span class="env-toggle-slider"></span>
            </label>
          </h3>

          <div class="env-section-content" id="fingerprint-content">
            <!-- 快捷操作按钮 -->
            <div class="env-button-group" style="margin-bottom: 15px;">
              <button class="env-btn-primary" id="generate-fingerprint-btn">🎲 一键生成指纹</button>
              <button class="env-btn-secondary" id="test-fingerprint-btn">🔍 测试指纹</button>
              <button class="env-btn-secondary" id="preview-fingerprint-btn">👁 预览指纹</button>
            </div>

            <!-- 模板管理 -->
            <div class="env-form-group">
              <label>指纹模板</label>
              <div class="env-input-group">
                <select id="fingerprint-template-select">
                  <option value="">-- 选择模板 --</option>
                </select>
                <button class="env-btn-icon" id="apply-template-btn" title="应用模板">✓</button>
                <button class="env-btn-icon" id="save-as-template-btn" title="保存为模板">💾</button>
                <button class="env-btn-icon" id="export-template-btn" title="导出模板">📤</button>
                <button class="env-btn-icon" id="import-template-btn" title="导入模板">📥</button>
              </div>
            </div>

            <!-- 基础设置 -->
            <div class="env-collapsible active">
              <div class="env-collapsible-header">
                <span>📱 基础设置</span>
                <span class="env-collapsible-icon">▼</span>
              </div>
              <div class="env-collapsible-content">
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>浏览器类型</label>
                    <select id="fp-browser-type">
                      <option value="chrome">Chrome</option>
                      <option value="firefox">Firefox</option>
                      <option value="edge">Edge</option>
                      <option value="safari">Safari</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>浏览器版本</label>
                    <input type="text" id="fp-browser-version" placeholder="120.0.0.0">
                  </div>
                </div>
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>操作系统</label>
                    <select id="fp-os-type">
                      <option value="windows">Windows</option>
                      <option value="macos">macOS</option>
                      <option value="linux">Linux</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>系统版本</label>
                    <input type="text" id="fp-os-version" placeholder="10.0">
                  </div>
                </div>
                <div class="env-form-group">
                  <label>User-Agent</label>
                  <textarea id="fp-user-agent" rows="2" placeholder="Mozilla/5.0..."></textarea>
                </div>
              </div>
            </div>

            <!-- Navigator属性 -->
            <div class="env-collapsible">
              <div class="env-collapsible-header">
                <span>🧭 Navigator属性</span>
                <span class="env-collapsible-icon">▼</span>
              </div>
              <div class="env-collapsible-content">
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>平台</label>
                    <select id="fp-platform">
                      <option value="Win32">Win32</option>
                      <option value="MacIntel">MacIntel</option>
                      <option value="Linux x86_64">Linux x86_64</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>供应商</label>
                    <input type="text" id="fp-vendor" placeholder="Google Inc.">
                  </div>
                </div>
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>主要语言</label>
                    <input type="text" id="fp-language" placeholder="en-US">
                  </div>
                  <div class="env-form-group">
                    <label>语言列表</label>
                    <input type="text" id="fp-languages" placeholder="en-US, en">
                  </div>
                </div>
              </div>
            </div>

            <!-- 硬件信息 -->
            <div class="env-collapsible">
              <div class="env-collapsible-header">
                <span>💻 硬件信息</span>
                <span class="env-collapsible-icon">▼</span>
              </div>
              <div class="env-collapsible-content">
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>CPU核心数</label>
                    <select id="fp-cpu-cores">
                      <option value="2">2</option>
                      <option value="4">4</option>
                      <option value="6">6</option>
                      <option value="8" selected>8</option>
                      <option value="12">12</option>
                      <option value="16">16</option>
                      <option value="24">24</option>
                      <option value="32">32</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>设备内存 (GB)</label>
                    <select id="fp-device-memory">
                      <option value="2">2</option>
                      <option value="4">4</option>
                      <option value="8" selected>8</option>
                      <option value="16">16</option>
                      <option value="32">32</option>
                    </select>
                  </div>
                </div>
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>屏幕宽度</label>
                    <input type="number" id="fp-screen-width" placeholder="1920" min="320" max="7680">
                  </div>
                  <div class="env-form-group">
                    <label>屏幕高度</label>
                    <input type="number" id="fp-screen-height" placeholder="1080" min="240" max="4320">
                  </div>
                </div>
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>颜色深度</label>
                    <select id="fp-color-depth">
                      <option value="24" selected>24</option>
                      <option value="32">32</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>设备像素比</label>
                    <select id="fp-pixel-ratio">
                      <option value="1" selected>1</option>
                      <option value="1.5">1.5</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- Canvas & WebGL设置 -->
            <div class="env-collapsible">
              <div class="env-collapsible-header">
                <span>🎨 Canvas & WebGL</span>
                <span class="env-collapsible-icon">▼</span>
              </div>
              <div class="env-collapsible-content">
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>Canvas模式</label>
                    <select id="fp-canvas-mode">
                      <option value="noise" selected>噪声</option>
                      <option value="real">真实</option>
                      <option value="off">关闭</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>Canvas噪声级别</label>
                    <select id="fp-canvas-noise-level">
                      <option value="off">关闭</option>
                      <option value="low">低</option>
                      <option value="medium" selected>中</option>
                      <option value="high">高</option>
                    </select>
                  </div>
                </div>
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>WebGL模式</label>
                    <select id="fp-webgl-mode">
                      <option value="custom" selected>自定义</option>
                      <option value="real">真实</option>
                      <option value="off">关闭</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>WebGL噪声级别</label>
                    <select id="fp-webgl-noise-level">
                      <option value="off">关闭</option>
                      <option value="low">低</option>
                      <option value="medium" selected>中</option>
                      <option value="high">高</option>
                    </select>
                  </div>
                </div>
                <div class="env-form-group">
                  <label>WebGL供应商</label>
                  <input type="text" id="fp-webgl-vendor" placeholder="Google Inc. (Intel)">
                </div>
                <div class="env-form-group">
                  <label>WebGL渲染器</label>
                  <input type="text" id="fp-webgl-renderer" placeholder="ANGLE (Intel, Intel(R) UHD Graphics...)">
                </div>
              </div>
            </div>

            <!-- Audio & ClientRects设置 -->
            <div class="env-collapsible">
              <div class="env-collapsible-header">
                <span>🔊 Audio & ClientRects</span>
                <span class="env-collapsible-icon">▼</span>
              </div>
              <div class="env-collapsible-content">
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>Audio模式</label>
                    <select id="fp-audio-mode">
                      <option value="noise" selected>噪声</option>
                      <option value="real">真实</option>
                      <option value="off">关闭</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>Audio噪声级别</label>
                    <select id="fp-audio-noise-level">
                      <option value="off">关闭</option>
                      <option value="low">低</option>
                      <option value="medium" selected>中</option>
                      <option value="high">高</option>
                    </select>
                  </div>
                </div>
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>ClientRects模式</label>
                    <select id="fp-clientrects-mode">
                      <option value="noise" selected>噪声</option>
                      <option value="off">关闭</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>ClientRects噪声级别</label>
                    <select id="fp-clientrects-noise-level">
                      <option value="off">关闭</option>
                      <option value="low" selected>低</option>
                      <option value="medium">中</option>
                      <option value="high">高</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- 时区与地理位置 -->
            <div class="env-collapsible">
              <div class="env-collapsible-header">
                <span>🌍 时区与地理位置</span>
                <span class="env-collapsible-icon">▼</span>
              </div>
              <div class="env-collapsible-content">
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>时区模式</label>
                    <select id="fp-timezone-mode">
                      <option value="custom" selected>自定义</option>
                      <option value="auto">自动（基于IP）</option>
                      <option value="real">真实</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>时区名称</label>
                    <input type="text" id="fp-timezone-name" placeholder="America/New_York">
                  </div>
                </div>
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>地理位置模式</label>
                    <select id="fp-geolocation-mode">
                      <option value="custom" selected>自定义</option>
                      <option value="deny">拒绝</option>
                      <option value="ip">基于IP</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>纬度</label>
                    <input type="number" id="fp-latitude" placeholder="40.7128" step="0.0001" min="-90" max="90">
                  </div>
                </div>
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>经度</label>
                    <input type="number" id="fp-longitude" placeholder="-74.0060" step="0.0001" min="-180" max="180">
                  </div>
                  <div class="env-form-group">
                    <label>精度 (米)</label>
                    <input type="number" id="fp-geo-accuracy" placeholder="100" min="1" max="10000">
                  </div>
                </div>
              </div>
            </div>

            <!-- WebRTC与隐私设置 -->
            <div class="env-collapsible">
              <div class="env-collapsible-header">
                <span>🔒 WebRTC与隐私</span>
                <span class="env-collapsible-icon">▼</span>
              </div>
              <div class="env-collapsible-content">
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>WebRTC模式</label>
                    <select id="fp-webrtc-mode">
                      <option value="disable">禁用</option>
                      <option value="replace" selected>替换IP</option>
                      <option value="real">真实</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>本地IP</label>
                    <input type="text" id="fp-local-ip" placeholder="192.168.1.100">
                  </div>
                </div>
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>Do Not Track</label>
                    <select id="fp-dnt">
                      <option value="null" selected>未设置</option>
                      <option value="1">启用 (1)</option>
                      <option value="0">禁用 (0)</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>全局隐私控制</label>
                    <select id="fp-gpc">
                      <option value="false" selected>禁用</option>
                      <option value="true">启用</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- 高级设置 -->
            <div class="env-collapsible">
              <div class="env-collapsible-header">
                <span>⚙️ 高级设置</span>
                <span class="env-collapsible-icon">▼</span>
              </div>
              <div class="env-collapsible-content">
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>媒体设备模式</label>
                    <select id="fp-media-devices-mode">
                      <option value="fake" selected>伪装</option>
                      <option value="hide">隐藏</option>
                      <option value="real">真实</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>电池API模式</label>
                    <select id="fp-battery-mode">
                      <option value="privacy" selected>隐私</option>
                      <option value="disable">禁用</option>
                      <option value="real">真实</option>
                    </select>
                  </div>
                </div>
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>传感器模式</label>
                    <select id="fp-sensors-mode">
                      <option value="disable" selected>禁用</option>
                      <option value="noise">噪声</option>
                      <option value="real">真实</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>Speech API模式</label>
                    <select id="fp-speech-mode">
                      <option value="minimal" selected>最小化</option>
                      <option value="system">系统</option>
                      <option value="disable">禁用</option>
                    </select>
                  </div>
                </div>
                <div class="env-form-row">
                  <div class="env-form-group">
                    <label>剪贴板模式</label>
                    <select id="fp-clipboard-mode">
                      <option value="ask" selected>询问</option>
                      <option value="allow">允许</option>
                      <option value="disable">禁用</option>
                    </select>
                  </div>
                  <div class="env-form-group">
                    <label>通知模式</label>
                    <select id="fp-notification-mode">
                      <option value="deny" selected>拒绝</option>
                      <option value="allow">允许</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- 指纹结果显示 -->
            <div class="env-result-box hidden" id="fingerprint-result"></div>
          </div>
        </section>
      </div>

      <div class="env-panel-footer">
        <button class="env-btn-secondary" id="reset-fingerprint-btn">重置为默认</button>
        <button class="env-btn-primary" id="apply-btn">应用并保存</button>
      </div>
    `;
  }


  /**
   * 设置事件监听器
   */
  function setupEventListeners() {
    // 代理启用开关
    const proxyEnabled = container.querySelector('#proxy-enabled');
    const proxyContent = container.querySelector('#proxy-content');
    proxyEnabled.addEventListener('change', (e) => {
      proxyContent.classList.toggle('disabled', !e.target.checked);
    });

    // 指纹启用开关
    const fingerprintEnabled = container.querySelector('#fingerprint-enabled');
    const fingerprintContent = container.querySelector('#fingerprint-content');
    fingerprintEnabled.addEventListener('change', (e) => {
      fingerprintContent.classList.toggle('disabled', !e.target.checked);
    });

    // 代理选择
    container.querySelector('#proxy-select').addEventListener('change', handleProxySelect);
    container.querySelector('#refresh-proxy-list').addEventListener('click', loadProxyConfigs);
    container.querySelector('#delete-proxy-btn').addEventListener('click', deleteProxyConfig);

    // 密码显示/隐藏
    container.querySelector('#toggle-password').addEventListener('click', togglePasswordVisibility);

    // 智能解析代理
    container.querySelector('#parse-proxy-btn').addEventListener('click', parseProxyString);

    // 代理操作按钮
    container.querySelector('#test-proxy-btn').addEventListener('click', testProxy);
    container.querySelector('#detect-network-btn').addEventListener('click', detectNetwork);

    // 结果展示关闭按钮
    const closeResultBtn = container.querySelector('#close-result-btn');
    if (closeResultBtn) {
      closeResultBtn.addEventListener('click', () => {
        const wrapper = container.querySelector('#fingerprint-result-wrapper');
        if (wrapper) {
          wrapper.classList.remove('visible');
          wrapper.classList.add('hidden');
        }
      });
    }
    container.querySelector('#save-proxy-config-btn').addEventListener('click', saveProxyConfig);

    // 指纹操作按钮
    container.querySelector('#generate-fingerprint-btn').addEventListener('click', generateFingerprint);
    container.querySelector('#test-fingerprint-btn').addEventListener('click', testFingerprint);
    container.querySelector('#preview-fingerprint-btn').addEventListener('click', previewFingerprint);
    container.querySelector('#reset-fingerprint-btn').addEventListener('click', resetFingerprint);

    // 模板操作按钮
    container.querySelector('#apply-template-btn').addEventListener('click', applyTemplate);
    container.querySelector('#save-as-template-btn').addEventListener('click', saveAsTemplate);
    container.querySelector('#export-template-btn').addEventListener('click', exportTemplate);
    container.querySelector('#import-template-btn').addEventListener('click', importTemplate);

    // 折叠面板
    container.querySelectorAll('.env-collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('active');
      });
    });

    // 条件显示字段
    setupConditionalFields();

    // 应用按钮
    container.querySelector('#apply-btn').addEventListener('click', applyConfig);
  }

  /**
   * 设置条件显示的字段
   */
  function setupConditionalFields() {
    // WebGL模式变化时显示/隐藏WebGL详细设置
    const webglMode = container.querySelector('#fp-webgl-mode');
    webglMode.addEventListener('change', (e) => {
      const isCustom = e.target.value === 'custom';
      container.querySelector('#fp-webgl-vendor').parentElement.style.display = isCustom ? 'block' : 'none';
      container.querySelector('#fp-webgl-renderer').parentElement.style.display = isCustom ? 'block' : 'none';
    });

    // 时区模式变化
    const timezoneMode = container.querySelector('#fp-timezone-mode');
    timezoneMode.addEventListener('change', (e) => {
      const isCustom = e.target.value === 'custom';
      container.querySelector('#fp-timezone-name').disabled = !isCustom;
    });

    // 地理位置模式变化
    const geoMode = container.querySelector('#fp-geolocation-mode');
    geoMode.addEventListener('change', (e) => {
      const isCustom = e.target.value === 'custom';
      container.querySelector('#fp-latitude').disabled = !isCustom;
      container.querySelector('#fp-longitude').disabled = !isCustom;
      container.querySelector('#fp-geo-accuracy').disabled = !isCustom;
    });

    // WebRTC模式变化
    const webrtcMode = container.querySelector('#fp-webrtc-mode');
    webrtcMode.addEventListener('change', (e) => {
      const isReplace = e.target.value === 'replace';
      container.querySelector('#fp-local-ip').disabled = !isReplace;
    });
  }

  /**
   * 设置当前账号
   */
  async function setAccount(accountId) {
    if (!accountId) {
      currentAccountId = null;
      currentConfig = null;
      currentFingerprintConfig = null;
      return;
    }

    currentAccountId = accountId;

    // 加载账号配置
    await loadAccountConfig(accountId);

    // 加载代理配置列表
    await loadProxyConfigs();

    // 加载指纹配置
    await loadFingerprintConfig(accountId);

    // 加载指纹模板列表
    await loadFingerprintTemplates();

    console.log(`[EnvironmentPanel] 已加载账号 ${accountId} 的环境设置`);
  }

  // 兼容旧的 open 接口
  async function open(accountId) {
    await setAccount(accountId);
  }

  /**
   * 加载账号配置
   */
  async function loadAccountConfig(accountId) {
    if (!window.electronAPI) return;

    try {
      const result = await window.electronAPI.getEnvironmentConfig(accountId);

      if (result.success && result.config) {
        currentConfig = result.config;
        populateProxyForm(result.config);
        console.log('[EnvironmentPanel] 已加载代理配置:', result.config);
      } else {
        console.warn('[EnvironmentPanel] 加载配置失败:', result.error);
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 加载配置错误:', error);
    }
  }

  /**
   * 加载指纹配置
   */
  async function loadFingerprintConfig(accountId) {
    if (!window.electronAPI) return;

    try {
      const result = await window.electronAPI.getFingerprint(accountId);

      if (result.success && result.config) {
        currentFingerprintConfig = result.config;
        populateFingerprintForm(result.config);
        console.log('[EnvironmentPanel] 已加载指纹配置');
      } else {
        // 没有指纹配置，使用默认值
        console.log('[EnvironmentPanel] 未找到指纹配置，使用默认值');
        currentFingerprintConfig = null;
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 加载指纹配置错误:', error);
    }
  }

  /**
   * 加载指纹模板列表
   */
  async function loadFingerprintTemplates() {
    if (!window.electronAPI) return;

    try {
      const result = await window.electronAPI.listFingerprintTemplates();

      if (result.success && result.templates) {
        savedFingerprintTemplates = result.templates;
        const select = container.querySelector('#fingerprint-template-select');
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

  /**
   * 填充代理表单
   */
  function populateProxyForm(config) {
    if (config.proxy) {
      container.querySelector('#proxy-enabled').checked = config.proxy.enabled || false;
      container.querySelector('#proxy-content').classList.toggle('disabled', !config.proxy.enabled);
      container.querySelector('#proxy-protocol').value = config.proxy.protocol || 'http';
      container.querySelector('#proxy-host').value = config.proxy.host || '';
      container.querySelector('#proxy-port').value = config.proxy.port || '';
      container.querySelector('#proxy-username').value = config.proxy.username || '';
      container.querySelector('#proxy-password').value = config.proxy.password || '';
    }
  }

  /**
   * 填充指纹表单
   */
  function populateFingerprintForm(config) {
    if (!config) return;

    // 基础设置
    container.querySelector('#fp-browser-type').value = config.browser?.type || 'chrome';
    container.querySelector('#fp-browser-version').value = config.browser?.version || '120.0.0.0';
    container.querySelector('#fp-os-type').value = config.os?.type || 'windows';
    container.querySelector('#fp-os-version').value = config.os?.version || '10.0';
    container.querySelector('#fp-user-agent').value = config.userAgent || '';

    // Navigator属性
    container.querySelector('#fp-platform').value = config.os?.platform || 'Win32';
    container.querySelector('#fp-vendor').value = config.navigator?.vendor || 'Google Inc.';
    container.querySelector('#fp-language').value = config.navigator?.language || 'en-US';
    container.querySelector('#fp-languages').value = (config.navigator?.languages || ['en-US', 'en']).join(', ');

    // 硬件信息
    container.querySelector('#fp-cpu-cores').value = config.hardware?.cpuCores || 8;
    container.querySelector('#fp-device-memory').value = config.hardware?.deviceMemory || 8;
    container.querySelector('#fp-screen-width').value = config.hardware?.screen?.width || 1920;
    container.querySelector('#fp-screen-height').value = config.hardware?.screen?.height || 1080;
    container.querySelector('#fp-color-depth').value = config.hardware?.screen?.colorDepth || 24;
    container.querySelector('#fp-pixel-ratio').value = config.hardware?.devicePixelRatio || 1;

    // Canvas & WebGL
    container.querySelector('#fp-canvas-mode').value = config.canvas?.mode || 'noise';
    container.querySelector('#fp-canvas-noise-level').value = config.canvas?.noiseLevel || 'medium';
    container.querySelector('#fp-webgl-mode').value = config.webgl?.mode || 'custom';
    container.querySelector('#fp-webgl-noise-level').value = config.webgl?.noiseLevel || 'medium';
    container.querySelector('#fp-webgl-vendor').value = config.webgl?.vendor || '';
    container.querySelector('#fp-webgl-renderer').value = config.webgl?.renderer || '';

    // Audio & ClientRects
    container.querySelector('#fp-audio-mode').value = config.audio?.mode || 'noise';
    container.querySelector('#fp-audio-noise-level').value = config.audio?.noiseLevel || 'medium';
    container.querySelector('#fp-clientrects-mode').value = config.clientRects?.mode || 'noise';
    container.querySelector('#fp-clientrects-noise-level').value = config.clientRects?.noiseLevel || 'low';

    // 时区与地理位置
    container.querySelector('#fp-timezone-mode').value = config.timezone?.mode || 'custom';
    container.querySelector('#fp-timezone-name').value = config.timezone?.name || 'America/New_York';
    container.querySelector('#fp-geolocation-mode').value = config.geolocation?.mode || 'custom';
    container.querySelector('#fp-latitude').value = config.geolocation?.latitude || 40.7128;
    container.querySelector('#fp-longitude').value = config.geolocation?.longitude || -74.0060;
    container.querySelector('#fp-geo-accuracy').value = config.geolocation?.accuracy || 100;

    // WebRTC与隐私
    container.querySelector('#fp-webrtc-mode').value = config.webrtc?.mode || 'replace';
    container.querySelector('#fp-local-ip').value = config.webrtc?.localIP || '192.168.1.100';
    container.querySelector('#fp-dnt').value = config.privacy?.doNotTrack === null ? 'null' : String(config.privacy?.doNotTrack);
    container.querySelector('#fp-gpc').value = String(config.privacy?.globalPrivacyControl || false);

    // 高级设置
    container.querySelector('#fp-media-devices-mode').value = config.mediaDevices?.mode || 'fake';
    container.querySelector('#fp-battery-mode').value = config.battery?.mode || 'privacy';
    container.querySelector('#fp-sensors-mode').value = config.sensors?.mode || 'disable';
    container.querySelector('#fp-speech-mode').value = config.speech?.mode || 'minimal';
    container.querySelector('#fp-clipboard-mode').value = config.advancedApis?.clipboard?.mode || 'ask';
    container.querySelector('#fp-notification-mode').value = config.advancedApis?.notification?.mode || 'deny';

    // 触发条件字段更新
    container.querySelector('#fp-webgl-mode').dispatchEvent(new Event('change'));
    container.querySelector('#fp-timezone-mode').dispatchEvent(new Event('change'));
    container.querySelector('#fp-geolocation-mode').dispatchEvent(new Event('change'));
    container.querySelector('#fp-webrtc-mode').dispatchEvent(new Event('change'));
  }

  /**
   * 从表单收集指纹配置
   */
  function collectFingerprintFormData() {
    const languagesStr = container.querySelector('#fp-languages').value;
    const languages = languagesStr.split(',').map(l => l.trim()).filter(l => l);

    return {
      browser: {
        type: container.querySelector('#fp-browser-type').value,
        version: container.querySelector('#fp-browser-version').value,
        majorVersion: parseInt(container.querySelector('#fp-browser-version').value.split('.')[0]) || 120
      },
      os: {
        type: container.querySelector('#fp-os-type').value,
        version: container.querySelector('#fp-os-version').value,
        platform: container.querySelector('#fp-platform').value
      },
      userAgent: container.querySelector('#fp-user-agent').value,
      navigator: {
        vendor: container.querySelector('#fp-vendor').value,
        language: container.querySelector('#fp-language').value,
        languages: languages
      },
      hardware: {
        cpuCores: parseInt(container.querySelector('#fp-cpu-cores').value) || 8,
        deviceMemory: parseInt(container.querySelector('#fp-device-memory').value) || 8,
        screen: (function() {
          const width = parseInt(container.querySelector('#fp-screen-width').value) || 1920;
          const height = parseInt(container.querySelector('#fp-screen-height').value) || 1080;
          return {
            width: width,
            height: height,
            availWidth: width,  // 可用宽度通常等于屏幕宽度
            availHeight: height - 40,  // 可用高度减去任务栏高度（约40像素）
            colorDepth: parseInt(container.querySelector('#fp-color-depth').value) || 24,
            pixelDepth: parseInt(container.querySelector('#fp-color-depth').value) || 24
          };
        })(),
        devicePixelRatio: parseFloat(container.querySelector('#fp-pixel-ratio').value) || 1
      },
      canvas: {
        mode: container.querySelector('#fp-canvas-mode').value,
        noiseLevel: container.querySelector('#fp-canvas-noise-level').value
      },
      webgl: {
        mode: container.querySelector('#fp-webgl-mode').value,
        noiseLevel: container.querySelector('#fp-webgl-noise-level').value,
        vendor: container.querySelector('#fp-webgl-vendor').value,
        renderer: container.querySelector('#fp-webgl-renderer').value
      },
      audio: {
        mode: container.querySelector('#fp-audio-mode').value,
        noiseLevel: container.querySelector('#fp-audio-noise-level').value
      },
      clientRects: {
        mode: container.querySelector('#fp-clientrects-mode').value,
        noiseLevel: container.querySelector('#fp-clientrects-noise-level').value
      },
      timezone: {
        mode: container.querySelector('#fp-timezone-mode').value,
        name: container.querySelector('#fp-timezone-name').value
      },
      geolocation: {
        mode: container.querySelector('#fp-geolocation-mode').value,
        latitude: parseFloat(container.querySelector('#fp-latitude').value) || 40.7128,
        longitude: parseFloat(container.querySelector('#fp-longitude').value) || -74.0060,
        accuracy: parseInt(container.querySelector('#fp-geo-accuracy').value) || 100
      },
      webrtc: {
        mode: container.querySelector('#fp-webrtc-mode').value,
        localIP: container.querySelector('#fp-local-ip').value
      },
      privacy: {
        doNotTrack: container.querySelector('#fp-dnt').value === 'null' ? null : container.querySelector('#fp-dnt').value,
        globalPrivacyControl: container.querySelector('#fp-gpc').value === 'true'
      },
      mediaDevices: {
        mode: container.querySelector('#fp-media-devices-mode').value
      },
      battery: {
        mode: container.querySelector('#fp-battery-mode').value
      },
      sensors: {
        mode: container.querySelector('#fp-sensors-mode').value
      },
      speech: {
        mode: container.querySelector('#fp-speech-mode').value
      },
      advancedApis: {
        clipboard: { mode: container.querySelector('#fp-clipboard-mode').value },
        notification: { mode: container.querySelector('#fp-notification-mode').value }
      }
    };
  }

  /**
   * 从表单收集配置
   */
  function collectFormData() {
    const config = {
      proxy: {
        enabled: container.querySelector('#proxy-enabled').checked,
        protocol: container.querySelector('#proxy-protocol').value,
        host: container.querySelector('#proxy-host').value,
        port: container.querySelector('#proxy-port').value,
        username: container.querySelector('#proxy-username').value,
        password: container.querySelector('#proxy-password').value
      }
    };

    return config;
  }


  /**
   * 应用配置
   */
  async function applyConfig() {
    console.log('[EnvironmentPanel] applyConfig called');
    if (!window.electronAPI) {
      console.error('[EnvironmentPanel] electronAPI not available');
      return;
    }

    if (!currentAccountId) {
      console.error('[EnvironmentPanel] No account selected');
      showFingerprintError('请先选择一个账号');
      return;
    }

    // 保存代理配置
    const proxyConfig = collectFormData();
    try {
      const proxyResult = await window.electronAPI.saveEnvironmentConfig(currentAccountId, proxyConfig);
      if (!proxyResult.success) {
        showFingerprintError('保存代理配置失败: ' + (proxyResult.error || '未知错误'));
        return;
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 保存代理配置错误:', error);
      showFingerprintError('保存代理配置失败: ' + error.message);
      return;
    }

    // 保存指纹配置
    if (container.querySelector('#fingerprint-enabled').checked) {
      const fingerprintConfig = collectFingerprintFormData();
      
      // 先验证
      try {
        const validateResult = await window.electronAPI.validateFingerprint(fingerprintConfig);
        if (!validateResult.valid) {
          const errorMessages = validateResult.errors.map(e => `${e.field}: ${e.reason}`).join('\n');
          showFingerprintError('指纹配置验证失败:\n' + errorMessages);
          return;
        }
      } catch (error) {
        console.error('[EnvironmentPanel] 验证指纹配置错误:', error);
      }

      // 保存指纹
      try {
        const fpResult = await window.electronAPI.saveFingerprint(currentAccountId, fingerprintConfig);
        if (!fpResult.success) {
          showFingerprintError('保存指纹配置失败: ' + (fpResult.error || '未知错误'));
          return;
        }
        currentFingerprintConfig = fpResult.config;

        // 指纹保存成功，统一在末尾重建视图以应用最新网络与指纹
      } catch (error) {
        console.error('[EnvironmentPanel] 保存指纹配置错误:', error);
        showFingerprintError('保存指纹配置失败: ' + error.message);
        return;
      }
    }

    try {
      const recreateResult = await window.electronAPI.recreateView(currentAccountId);
      if (!recreateResult.success) {
        console.warn('[EnvironmentPanel] 应用并保存后销毁并重建视图失败:', recreateResult.error);
      }
    } catch (e) {
      console.warn('[EnvironmentPanel] 应用并保存后销毁并重建视图错误:', e);
    }

    showFingerprintSuccess('配置已保存成功！已重建视图并应用新的环境设置。');
  }

  /**
   * 一键生成指纹
   */
  async function generateFingerprint() {
    if (!window.electronAPI) return;

    showFingerprintLoading('正在生成指纹配置...');

    try {
      const options = {
        os: container.querySelector('#fp-os-type').value,
        browser: container.querySelector('#fp-browser-type').value
      };

      const result = await window.electronAPI.generateFingerprint(options);

      if (result.success && result.config) {
        currentFingerprintConfig = result.config;
        populateFingerprintForm(result.config);
        showFingerprintSuccess('指纹配置已生成！请点击"应用并保存"保存配置。');
      } else {
        showFingerprintError('生成指纹失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 生成指纹失败:', error);
      showFingerprintError('生成指纹失败: ' + error.message);
    }
  }

  /**
   * 测试指纹
   */
  async function testFingerprint() {
    if (!window.electronAPI) return;

    showFingerprintLoading('正在测试指纹配置...');

    try {
      const config = collectFingerprintFormData();
      const result = await window.electronAPI.runFingerprintTests(config);

      if (result.success && result.report) {
        const report = result.report;
        const html = `
          <div class="env-result-success">
            <h4>指纹测试报告</h4>
            <p><strong>通过率:</strong> ${report.summary.passRate}</p>
            <p><strong>通过:</strong> ${report.summary.passed} / ${report.summary.total}</p>
            <p><strong>失败:</strong> ${report.summary.failed}</p>
            ${report.results.filter(r => !r.passed).map(r => `
              <p style="color: #ff4d4f;">❌ ${r.name}: ${r.error || '测试失败'}</p>
            `).join('')}
          </div>
        `;
        showFingerprintResult(html);
      } else {
        showFingerprintError('测试失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 测试指纹失败:', error);
      showFingerprintError('测试失败: ' + error.message);
    }
  }

  /**
   * 预览指纹
   */
  async function previewFingerprint() {
    if (!window.electronAPI) return;

    showFingerprintLoading('正在生成预览...');

    try {
      const config = collectFingerprintFormData();
      const result = await window.electronAPI.previewFingerprint(config);

      if (result.success && result.preview) {
        const preview = result.preview;
        // 正确提取对象属性
        const browserStr = preview.browser?.type ? `${preview.browser.type} ${preview.browser.version || ''}` : config.browser?.type;
        const osStr = preview.os?.type ? `${preview.os.type} (${preview.os.platform || ''})` : config.os?.type;
        const userAgentStr = preview.browser?.userAgent || config.userAgent;
        const screenStr = preview.hardware?.screen || `${config.hardware?.screen?.width}x${config.hardware?.screen?.height}`;
        const cpuStr = preview.hardware?.cpuCores || config.hardware?.cpuCores;
        const memoryStr = preview.hardware?.deviceMemory || config.hardware?.deviceMemory;
        const timezoneStr = preview.timezone?.name || config.timezone?.name;
        const languageStr = config.navigator?.language || 'en-US';
        
        const html = `
          <div class="env-result-success">
            <h4>指纹预览</h4>
            <p><strong>浏览器:</strong> ${browserStr}</p>
            <p><strong>操作系统:</strong> ${osStr}</p>
            <p><strong>User-Agent:</strong> <small>${userAgentStr}</small></p>
            <p><strong>屏幕:</strong> ${screenStr}</p>
            <p><strong>CPU核心:</strong> ${cpuStr}</p>
            <p><strong>内存:</strong> ${memoryStr} GB</p>
            <p><strong>时区:</strong> ${timezoneStr}</p>
            <p><strong>语言:</strong> ${languageStr}</p>
            <p><strong>Canvas模式:</strong> ${preview.canvas?.mode || config.canvas?.mode}</p>
            <p><strong>WebGL供应商:</strong> ${preview.webgl?.vendor || config.webgl?.vendor || '未设置'}</p>
            <p><strong>WebRTC模式:</strong> ${preview.webrtc?.mode || config.webrtc?.mode}</p>
          </div>
        `;
        showFingerprintResult(html);
      } else {
        // 如果没有预览API，显示本地数据
        const html = `
          <div class="env-result-success">
            <h4>指纹预览</h4>
            <p><strong>浏览器:</strong> ${config.browser?.type} ${config.browser?.version}</p>
            <p><strong>操作系统:</strong> ${config.os?.type} ${config.os?.version}</p>
            <p><strong>平台:</strong> ${config.os?.platform}</p>
            <p><strong>屏幕:</strong> ${config.hardware?.screen?.width}x${config.hardware?.screen?.height}</p>
            <p><strong>CPU核心:</strong> ${config.hardware?.cpuCores}</p>
            <p><strong>内存:</strong> ${config.hardware?.deviceMemory} GB</p>
            <p><strong>时区:</strong> ${config.timezone?.name}</p>
            <p><strong>语言:</strong> ${config.navigator?.language}</p>
            <p><strong>Canvas模式:</strong> ${config.canvas?.mode}</p>
            <p><strong>WebGL模式:</strong> ${config.webgl?.mode}</p>
            <p><strong>WebRTC模式:</strong> ${config.webrtc?.mode}</p>
          </div>
        `;
        showFingerprintResult(html);
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 预览指纹失败:', error);
      showFingerprintError('预览失败: ' + error.message);
    }
  }

  /**
   * 重置指纹为默认值
   */
  function resetFingerprint() {
    const defaultConfig = {
      browser: { type: 'chrome', version: '120.0.0.0', majorVersion: 120 },
      os: { type: 'windows', version: '10.0', platform: 'Win32' },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      navigator: { vendor: 'Google Inc.', language: 'en-US', languages: ['en-US', 'en'] },
      hardware: {
        cpuCores: 8,
        deviceMemory: 8,
        screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24 },
        devicePixelRatio: 1
      },
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

  /**
   * 应用模板
   */
  async function applyTemplate() {
    if (!window.electronAPI) return;

    const templateId = container.querySelector('#fingerprint-template-select').value;
    if (!templateId) {
      showFingerprintError('请先选择一个模板');
      return;
    }

    if (!currentAccountId) {
      showFingerprintError('请先选择一个账号');
      return;
    }

    showFingerprintLoading('正在应用模板...');

    try {
      const result = await window.electronAPI.applyFingerprintTemplate(templateId, currentAccountId);

      if (result.success && result.config) {
        currentFingerprintConfig = result.config;
        populateFingerprintForm(result.config);
        showFingerprintSuccess('模板已应用！');

        try {
          const recreateResult = await window.electronAPI.recreateView(currentAccountId);
          if (!recreateResult.success) {
            console.warn('[EnvironmentPanel] 模板应用后销毁并重建视图失败:', recreateResult.error);
          }
        } catch (e) {
          console.warn('[EnvironmentPanel] 模板应用后销毁并重建视图错误:', e);
        }
      } else {
        showFingerprintError('应用模板失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 应用模板失败:', error);
      showFingerprintError('应用模板失败: ' + error.message);
    }
  }

  /**
   * 保存为模板
   */
  async function saveAsTemplate() {
    if (!window.electronAPI) return;

    showInlineInput('请输入模板名称:', async (name) => {
      if (!name || name.trim() === '') return;

      const config = collectFingerprintFormData();

      try {
        const result = await window.electronAPI.createFingerprintTemplate({
          name: name.trim(),
          config: config
        });

        if (result.success) {
          showFingerprintSuccess(`模板 "${name}" 已保存！`);
          await loadFingerprintTemplates();
        } else {
          showFingerprintError('保存模板失败: ' + (result.error || '未知错误'));
        }
      } catch (error) {
        console.error('[EnvironmentPanel] 保存模板失败:', error);
        showFingerprintError('保存模板失败: ' + error.message);
      }
    });
  }

  /**
   * 导出模板
   */
  async function exportTemplate() {
    if (!window.electronAPI) return;

    const templateId = container.querySelector('#fingerprint-template-select').value;
    if (!templateId) {
      // 导出当前配置
      const config = collectFingerprintFormData();
      const jsonStr = JSON.stringify(config, null, 2);
      downloadJSON(jsonStr, 'fingerprint-config.json');
      showFingerprintSuccess('配置已导出！');
      return;
    }

    try {
      const result = await window.electronAPI.exportFingerprintTemplate(templateId);

      if (result.success && result.data) {
        downloadJSON(result.data, `fingerprint-template-${templateId}.json`);
        showFingerprintSuccess('模板已导出！');
      } else {
        showFingerprintError('导出模板失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 导出模板失败:', error);
      showFingerprintError('导出模板失败: ' + error.message);
    }
  }

  /**
   * 导入模板
   */
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

        if (result.success) {
          showFingerprintSuccess('模板已导入！');
          await loadFingerprintTemplates();
        } else {
          showFingerprintError('导入模板失败: ' + (result.error || '未知错误'));
        }
      } catch (error) {
        console.error('[EnvironmentPanel] 导入模板失败:', error);
        showFingerprintError('导入模板失败: ' + error.message);
      }
    };
    input.click();
  }

  /**
   * 下载JSON文件
   */
  function downloadJSON(jsonStr, filename) {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }


  // ==================== 代理相关函数 ====================

  /**
   * 加载代理配置列表
   */
  async function loadProxyConfigs() {
    if (!window.electronAPI) return;

    try {
      const result = await window.electronAPI.getProxyConfigs();

      if (result.success && result.configs) {
        savedProxyConfigs = result.configs;
        const select = container.querySelector('#proxy-select');
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

  /**
   * 处理代理选择
   */
  function handleProxySelect(e) {
    const name = e.target.value;
    const deleteBtn = container.querySelector('#delete-proxy-btn');

    if (!name) {
      container.querySelector('#proxy-protocol').value = 'http';
      container.querySelector('#proxy-host').value = '';
      container.querySelector('#proxy-port').value = '';
      container.querySelector('#proxy-username').value = '';
      container.querySelector('#proxy-password').value = '';
      deleteBtn.style.display = 'none';
      return;
    }

    const config = savedProxyConfigs[name];
    if (config) {
      container.querySelector('#proxy-protocol').value = config.protocol || 'http';
      container.querySelector('#proxy-host').value = config.host || '';
      container.querySelector('#proxy-port').value = config.port || '';
      container.querySelector('#proxy-username').value = config.username || '';
      container.querySelector('#proxy-password').value = config.password || '';
      deleteBtn.style.display = 'inline-block';
      showProxySuccess(`已加载配置: ${name}`);
    }
  }

  /**
   * 删除当前选中的代理配置
   */
  async function deleteProxyConfig() {
    const select = container.querySelector('#proxy-select');
    const name = select.value;

    if (!name) return;

    showInlineConfirm(`确定要删除代理配置 "${name}" 吗？`, async (confirmed) => {
      if (!confirmed) return;

      try {
        const result = await window.electronAPI.deleteNamedProxy(name);

        if (result.success) {
          showProxySuccess(`配置 "${name}" 已删除`);
          select.value = "";
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

  /**
   * 切换密码可见性
   */
  function togglePasswordVisibility() {
    const input = container.querySelector('#proxy-password');
    const btn = container.querySelector('#toggle-password');

    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁';
    }
  }

  /**
   * 解析代理字符串
   */
  async function parseProxyString() {
    if (!window.electronAPI) return;

    const proxyString = container.querySelector('#proxy-smart-paste').value.trim();
    if (!proxyString) {
      showProxyError('请输入代理字符串');
      return;
    }

    try {
      const result = await window.electronAPI.parseProxyString(proxyString);

      if (result.success && result.config) {
        const config = result.config;
        container.querySelector('#proxy-protocol').value = config.protocol || 'http';
        container.querySelector('#proxy-host').value = config.host || '';
        container.querySelector('#proxy-port').value = config.port || '';
        container.querySelector('#proxy-username').value = config.username || '';
        container.querySelector('#proxy-password').value = config.password || '';

        showProxySuccess('代理信息已自动填充！');
      } else {
        showProxyError('解析失败: ' + (result.error || '格式不正确'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 解析代理字符串失败:', error);
      showProxyError('解析失败: ' + error.message);
    }
  }

  /**
   * 测试代理
   */
  async function testProxy() {
    if (!window.electronAPI) return;

    const proxyConfig = {
      protocol: container.querySelector('#proxy-protocol').value,
      host: container.querySelector('#proxy-host').value,
      port: container.querySelector('#proxy-port').value,
      username: container.querySelector('#proxy-username').value,
      password: container.querySelector('#proxy-password').value
    };

    if (!proxyConfig.host || !proxyConfig.port) {
      showProxyError('请先填写代理主机和端口');
      return;
    }

    showProxyLoading('正在测试代理连接...');

    try {
      const result = await window.electronAPI.testProxy(proxyConfig);

      if (result.success) {
        const html = `
          <div class="env-result-success">
            <h4>✓ 代理连接成功</h4>
            <p><strong>IP地址:</strong> ${result.ip}</p>
            <p><strong>位置:</strong> ${result.location.city}, ${result.location.country}</p>
            <p><strong>时区:</strong> ${result.timezone}</p>
            <p><strong>语言:</strong> ${result.language}</p>
            <p><strong>延迟:</strong> ${result.latency}ms</p>
            <p><strong>ISP:</strong> ${result.isp}</p>
          </div>
        `;
        showProxyResult(html);
      } else {
        showProxyError('代理连接失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 测试代理失败:', error);
      showProxyError('测试失败: ' + error.message);
    }
  }

  /**
   * 检测当前网络
   */
  async function detectNetwork() {
    if (!window.electronAPI) return;

    showProxyLoading('正在检测当前网络...');

    try {
      const result = await window.electronAPI.detectNetwork();

      if (result.success) {
        const html = `
          <div class="env-result-success">
            <h4>当前网络信息</h4>
            <p><strong>IP地址:</strong> ${result.ip}</p>
            <p><strong>位置:</strong> ${result.location.city}, ${result.location.country}</p>
            <p><strong>时区:</strong> ${result.timezone}</p>
            <p><strong>语言:</strong> ${result.language}</p>
            <p><strong>ISP:</strong> ${result.isp}</p>
          </div>
        `;
        showProxyResult(html);
      } else {
        showProxyError('检测失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[EnvironmentPanel] 检测网络失败:', error);
      showProxyError('检测失败: ' + error.message);
    }
  }

  /**
   * 保存代理配置
   */
  async function saveProxyConfig() {
    if (!window.electronAPI) {
      showProxyError('系统错误: electronAPI 不可用');
      return;
    }

    showInlineInput('请输入代理配置名称:', async (name) => {
      if (!name || name.trim() === '') return;

      const proxyConfig = {
        protocol: container.querySelector('#proxy-protocol').value,
        host: container.querySelector('#proxy-host').value,
        port: container.querySelector('#proxy-port').value,
        username: container.querySelector('#proxy-username').value,
        password: container.querySelector('#proxy-password').value
      };

      try {
        const result = await window.electronAPI.saveProxyConfig(name.trim(), proxyConfig);

        if (result.success) {
          showProxySuccess(`代理配置 "${name}" 已保存！`);
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

  // ==================== UI辅助函数 ====================

  /**
   * 显示内嵌输入框
   */
  function showInlineInput(message, callback) {
    const buttonsGroup = container.querySelector('.env-panel-footer');
    const originalDisplay = buttonsGroup.style.display;
    buttonsGroup.style.display = 'none';

    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
      padding: 15px;
      background: #f0f8ff;
      border: 2px solid #1890ff;
      border-radius: 8px;
      margin: 15px;
    `;

    inputContainer.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold; color: #1890ff;">${message}</div>
      <input type="text" id="inline-input" 
             style="width: 100%; padding: 8px; border: 1px solid #1890ff; border-radius: 4px; font-size: 14px; box-sizing: border-box; margin-bottom: 10px;">
      <div style="text-align: right;">
        <button id="inline-cancel" style="padding: 6px 16px; margin-right: 8px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>
        <button id="inline-ok" style="padding: 6px 16px; border: none; background: #1890ff; color: white; border-radius: 4px; cursor: pointer;">确定</button>
      </div>
    `;

    container.appendChild(inputContainer);

    const input = inputContainer.querySelector('#inline-input');
    const okBtn = inputContainer.querySelector('#inline-ok');
    const cancelBtn = inputContainer.querySelector('#inline-cancel');

    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);

    const cleanup = () => {
      inputContainer.remove();
      buttonsGroup.style.display = originalDisplay;
    };

    const handleOk = () => {
      const value = input.value;
      cleanup();
      callback(value);
    };

    const handleCancel = () => {
      cleanup();
    };

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleOk();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') handleCancel();
    });
  }

  /**
   * 显示内嵌确认框
   */
  function showInlineConfirm(message, callback) {
    const buttonsGroup = container.querySelector('.env-panel-footer');
    const originalDisplay = buttonsGroup.style.display;
    buttonsGroup.style.display = 'none';

    const confirmContainer = document.createElement('div');
    confirmContainer.style.cssText = `
      padding: 15px;
      background: #fff3e0;
      border: 2px solid #ff9800;
      border-radius: 8px;
      margin: 15px;
    `;

    confirmContainer.innerHTML = `
      <div style="margin-bottom: 15px; font-weight: bold; color: #ff6f00;">⚠️ ${message}</div>
      <div style="text-align: right;">
        <button id="confirm-no" style="padding: 6px 16px; margin-right: 8px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>
        <button id="confirm-yes" style="padding: 6px 16px; border: none; background: #ff4d4f; color: white; border-radius: 4px; cursor: pointer;">删除</button>
      </div>
    `;

    container.appendChild(confirmContainer);

    const yesBtn = confirmContainer.querySelector('#confirm-yes');
    const noBtn = confirmContainer.querySelector('#confirm-no');

    const cleanup = () => {
      confirmContainer.remove();
      buttonsGroup.style.display = originalDisplay;
    };

    yesBtn.addEventListener('click', () => { cleanup(); callback(true); });
    noBtn.addEventListener('click', () => { cleanup(); callback(false); });

    setTimeout(() => noBtn.focus(), 100);
  }

  // ==================== 代理结果显示函数 ====================

  function showProxyResult(html) {
    const resultBox = container.querySelector('#proxy-result');
    resultBox.innerHTML = html;
    resultBox.classList.remove('hidden');
  }

  function showProxyLoading(message) {
    showProxyResult(`<div class="env-result-loading">${message}</div>`);
  }

  function showProxySuccess(message) {
    showProxyResult(`<div class="env-result-success">${message}</div>`);
    setTimeout(() => {
      container.querySelector('#proxy-result').classList.add('hidden');
    }, 3000);
  }

  function showProxyError(message) {
    showProxyResult(`<div class="env-result-error">❌ ${message}</div>`);
  }

  // ==================== 指纹结果显示函数 ====================

  function showFingerprintResult(html) {
    const resultBox = container.querySelector('#fingerprint-result');
    resultBox.innerHTML = html;
    resultBox.classList.remove('hidden');
  }

  function showFingerprintLoading(message) {
    showFingerprintResult(`<div class="env-result-loading">${message}</div>`);
  }

  function showFingerprintSuccess(message) {
    showFingerprintResult(`<div class="env-result-success">${message}</div>`);
    setTimeout(() => {
      container.querySelector('#fingerprint-result').classList.add('hidden');
    }, 3000);
  }

  function showFingerprintError(message) {
    showFingerprintResult(`<div class="env-result-error">❌ ${message}</div>`);
  }

  // Export to window
  window.EnvironmentSettingsPanel = {
    init,
    setAccount,
    open
  };

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
