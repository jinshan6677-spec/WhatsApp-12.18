;(function(){
  'use strict';
  const state = window.EnvSettingsState;

  function render(container){
    state.container = container;
    container.innerHTML = 
      '<div class="env-panel-body">\n' +
      '  <section class="env-section">\n' +
      '    <h3 class="env-section-title">\n' +
      '      <span>代理设置</span>\n' +
      '      <label class="env-toggle">\n' +
      '        <input type="checkbox" id="proxy-enabled">\n' +
      '        <span class="env-toggle-slider"></span>\n' +
      '      </label>\n' +
      '    </h3>\n' +
      '    <div class="env-section-content" id="proxy-content">\n' +
      '      <div class="env-form-group">\n' +
      '        <label>选择代理配置</label>\n' +
      '        <div class="env-input-group">\n' +
      '          <select id="proxy-select">\n' +
      '            <option value="">-- 新建代理配置 --</option>\n' +
      '          </select>\n' +
      '          <button class="env-btn-icon" id="refresh-proxy-list" title="刷新列表">🔄</button>\n' +
      '          <button class="env-btn-icon" id="delete-proxy-btn" title="删除配置" style="display: none; color: #ff4d4f;">🗑️</button>\n' +
      '        </div>\n' +
      '      </div>\n' +
      '      <div class="env-form-group">\n' +
      '        <label>协议</label>\n' +
      '        <select id="proxy-protocol">\n' +
      '          <option value="http">HTTP</option>\n' +
      '          <option value="https">HTTPS</option>\n' +
      '        </select>\n' +
      '      </div>\n' +
      '      <div class="env-form-row">\n' +
      '        <div class="env-form-group">\n' +
      '          <label>主机</label>\n' +
      '          <input type="text" id="proxy-host" placeholder="例如: 192.168.1.1">\n' +
      '        </div>\n' +
      '        <div class="env-form-group" style="width: 120px;">\n' +
      '          <label>端口</label>\n' +
      '          <input type="number" id="proxy-port" placeholder="8080" min="1" max="65535">\n' +
      '        </div>\n' +
      '      </div>\n' +
      '      <div class="env-form-row">\n' +
      '        <div class="env-form-group">\n' +
      '          <label>用户名（可选）</label>\n' +
      '          <input type="text" id="proxy-username" placeholder="用户名">\n' +
      '        </div>\n' +
      '        <div class="env-form-group">\n' +
      '          <label>密码（可选）</label>\n' +
      '          <div class="env-password-group">\n' +
      '            <input type="password" id="proxy-password" placeholder="密码">\n' +
      '            <button class="env-btn-icon" id="toggle-password" title="显示/隐藏密码">👁</button>\n' +
      '          </div>\n' +
      '        </div>\n' +
      '      </div>\n' +
      '      <div class="env-form-group">\n' +
      '        <label>智能填写（粘贴格式: IP:端口:用户名:密码）</label>\n' +
      '        <textarea id="proxy-smart-paste" rows="2" placeholder="例如: 192.168.1.1:8080:user:pass"></textarea>\n' +
      '        <button class="env-btn-secondary" id="parse-proxy-btn">解析并填充</button>\n' +
      '      </div>\n' +
      '      <div class="env-button-group">\n' +
      '        <button class="env-btn-primary" id="test-proxy-btn">检测代理服务</button>\n' +
      '        <button class="env-btn-secondary" id="detect-network-btn">检测当前网络</button>\n' +
      '        <button class="env-btn-secondary" id="save-proxy-config-btn">保存为配置</button>\n' +
      '      </div>\n' +
      '      <div class="env-result-box hidden" id="proxy-result"></div>\n' +
      '    </div>\n' +
      '  </section>\n' +
      '  <section class="env-section">\n' +
      '    <h3 class="env-section-title">\n' +
      '      <span>指纹设置</span>\n' +
      '      <label class="env-toggle">\n' +
      '        <input type="checkbox" id="fingerprint-enabled" checked>\n' +
      '        <span class="env-toggle-slider"></span>\n' +
      '      </label>\n' +
      '    </h3>\n' +
      '    <div class="env-section-content" id="fingerprint-content">\n' +
      '      <div class="env-form-group">\n' +
      '        <label>指纹模板</label>\n' +
      '        <div class="env-input-group">\n' +
      '          <select id="fingerprint-template-select">\n' +
      '            <option value="">-- 选择模板 --</option>\n' +
      '          </select>\n' +
      '          <button class="env-btn-icon" id="apply-template-btn" title="应用模板">✓</button>\n' +
      '          <button class="env-btn-icon" id="save-as-template-btn" title="保存为模板">💾</button>\n' +
      '          <button class="env-btn-icon" id="export-template-btn" title="导出模板">📤</button>\n' +
      '          <button class="env-btn-icon" id="import-template-btn" title="导入模板">📥</button>\n' +
      '        </div>\n' +
      '      </div>\n' +
      '      <div class="env-collapsible active">\n' +
      '        <div class="env-collapsible-header">\n' +
      '          <span>📱 基础设置</span>\n' +
      '          <span class="env-collapsible-icon">▼</span>\n' +
      '        </div>\n' +
      '        <div class="env-collapsible-content">\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>浏览器类型</label>\n' +
      '              <select id="fp-browser-type">\n' +
      '                <option value="chrome">Chrome</option>\n' +
      '                <option value="firefox">Firefox</option>\n' +
      '                <option value="edge">Edge</option>\n' +
      '                <option value="safari">Safari</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>浏览器版本</label>\n' +
      '              <input type="text" id="fp-browser-version" placeholder="120.0.0.0">\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>操作系统</label>\n' +
      '              <select id="fp-os-type">\n' +
      '                <option value="windows">Windows</option>\n' +
      '                <option value="macos">macOS</option>\n' +
      '                <option value="linux">Linux</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>系统版本</label>\n' +
      '              <input type="text" id="fp-os-version" placeholder="10.0">\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-group">\n' +
      '            <label>User-Agent</label>\n' +
      '            <textarea id="fp-user-agent" rows="2" placeholder="Mozilla/5.0..."></textarea>\n' +
      '          </div>\n' +
      '        </div>\n' +
      '      </div>\n' +
      '      <div class="env-collapsible">\n' +
      '        <div class="env-collapsible-header">\n' +
      '          <span>🧭 Navigator属性</span>\n' +
      '          <span class="env-collapsible-icon">▼</span>\n' +
      '        </div>\n' +
      '        <div class="env-collapsible-content">\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>平台</label>\n' +
      '              <input type="text" id="fp-platform" placeholder="Win32">\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>Vendor</label>\n' +
      '              <input type="text" id="fp-vendor" placeholder="Google Inc.">\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>语言</label>\n' +
      '              <input type="text" id="fp-language" placeholder="en-US">\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>Languages</label>\n' +
      '              <input type="text" id="fp-languages" placeholder="en-US, en">\n' +
      '            </div>\n' +
      '          </div>\n' +
      '        </div>\n' +
      '      </div>\n' +
      '      <div class="env-collapsible">\n' +
      '        <div class="env-collapsible-header">\n' +
      '          <span>🖥️ Canvas & WebGL</span>\n' +
      '          <span class="env-collapsible-icon">▼</span>\n' +
      '        </div>\n' +
      '        <div class="env-collapsible-content">\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>CPU核心数</label>\n' +
      '              <input type="number" id="fp-cpu-cores" placeholder="8" min="1" max="64">\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>内存(GB)</label>\n' +
      '              <input type="number" id="fp-device-memory" placeholder="8" min="1" max="256">\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>屏幕宽度</label>\n' +
      '              <input type="number" id="fp-screen-width" placeholder="1920" min="640" max="7680">\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>屏幕高度</label>\n' +
      '              <input type="number" id="fp-screen-height" placeholder="1080" min="480" max="4320">\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>颜色深度</label>\n' +
      '              <input type="number" id="fp-color-depth" placeholder="24" min="8" max="48">\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>设备像素比</label>\n' +
      '              <input type="number" id="fp-pixel-ratio" placeholder="1" step="0.1" min="0.5" max="5">\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>Canvas模式</label>\n' +
      '              <select id="fp-canvas-mode">\n' +
      '                <option value="noise">噪声</option>\n' +
      '                <option value="real">真实</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>Canvas噪声级别</label>\n' +
      '              <select id="fp-canvas-noise-level">\n' +
      '                <option value="low">低</option>\n' +
      '                <option value="medium" selected>中</option>\n' +
      '                <option value="high">高</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>WebGL模式</label>\n' +
      '              <select id="fp-webgl-mode">\n' +
      '                <option value="custom" selected>自定义</option>\n' +
      '                <option value="off">关闭</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>WebGL噪声级别</label>\n' +
      '              <select id="fp-webgl-noise-level">\n' +
      '                <option value="off">关闭</option>\n' +
      '                <option value="low">低</option>\n' +
      '                <option value="medium" selected>中</option>\n' +
      '                <option value="high">高</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-group">\n' +
      '            <label>WebGL供应商</label>\n' +
      '            <textarea id="fp-webgl-vendor" rows="2" placeholder="Google Inc. (Intel)"></textarea>\n' +
      '          </div>\n' +
      '          <div class="env-form-group">\n' +
      '            <label>WebGL渲染器</label>\n' +
      '            <textarea id="fp-webgl-renderer" rows="4" placeholder="ANGLE (Intel, Intel(R) UHD Graphics...)"></textarea>\n' +
      '          </div>\n' +
      '        </div>\n' +
      '      </div>\n' +
      '      <div class="env-collapsible">\n' +
      '        <div class="env-collapsible-header">\n' +
      '          <span>🔊 Audio & ClientRects</span>\n' +
      '          <span class="env-collapsible-icon">▼</span>\n' +
      '        </div>\n' +
      '        <div class="env-collapsible-content">\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>Audio模式</label>\n' +
      '              <select id="fp-audio-mode">\n' +
      '                <option value="noise" selected>噪声</option>\n' +
      '                <option value="real">真实</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>Audio噪声级别</label>\n' +
      '              <select id="fp-audio-noise-level">\n' +
      '                <option value="low">低</option>\n' +
      '                <option value="medium" selected>中</option>\n' +
      '                <option value="high">高</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>ClientRects模式</label>\n' +
      '              <select id="fp-clientrects-mode">\n' +
      '                <option value="noise" selected>噪声</option>\n' +
      '                <option value="real">真实</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>ClientRects噪声级别</label>\n' +
      '              <select id="fp-clientrects-noise-level">\n' +
      '                <option value="low" selected>低</option>\n' +
      '                <option value="medium">中</option>\n' +
      '                <option value="high">高</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '          </div>\n' +
      '        </div>\n' +
      '      </div>\n' +
      '      <div class="env-collapsible">\n' +
      '        <div class="env-collapsible-header">\n' +
      '          <span>🌍 时区与地理位置</span>\n' +
      '          <span class="env-collapsible-icon">▼</span>\n' +
      '        </div>\n' +
      '        <div class="env-collapsible-content">\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>时区模式</label>\n' +
      '              <select id="fp-timezone-mode">\n' +
      '                <option value="custom" selected>自定义</option>\n' +
      '                <option value="system">系统</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>时区名称</label>\n' +
      '              <input type="text" id="fp-timezone-name" placeholder="America/New_York">\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>地理位置模式</label>\n' +
      '              <select id="fp-geolocation-mode">\n' +
      '                <option value="custom" selected>自定义</option>\n' +
      '                <option value="deny">拒绝</option>\n' +
      '                <option value="ip">基于IP</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>纬度</label>\n' +
      '              <input type="number" id="fp-latitude" placeholder="40.7128" step="0.0001" min="-90" max="90">\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>经度</label>\n' +
      '              <input type="number" id="fp-longitude" placeholder="-74.0060" step="0.0001" min="-180" max="180">\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>精度 (米)</label>\n' +
      '              <input type="number" id="fp-geo-accuracy" placeholder="100" min="1" max="10000">\n' +
      '            </div>\n' +
      '          </div>\n' +
      '        </div>\n' +
      '      </div>\n' +
      '      <div class="env-collapsible">\n' +
      '        <div class="env-collapsible-header">\n' +
      '          <span>🔒 WebRTC与隐私</span>\n' +
      '          <span class="env-collapsible-icon">▼</span>\n' +
      '        </div>\n' +
      '        <div class="env-collapsible-content">\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>WebRTC模式</label>\n' +
      '              <select id="fp-webrtc-mode">\n' +
      '                <option value="replace" selected>替换</option>\n' +
      '                <option value="block">阻止</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>本地IP</label>\n' +
      '              <input type="text" id="fp-local-ip" placeholder="192.168.1.100">\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>Do Not Track</label>\n' +
      '              <select id="fp-dnt">\n' +
      '                <option value="null" selected>空</option>\n' +
      '                <option value="true">true</option>\n' +
      '                <option value="false">false</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>GPC</label>\n' +
      '              <select id="fp-gpc">\n' +
      '                <option value="false" selected>false</option>\n' +
      '                <option value="true">true</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '          </div>\n' +
      '        </div>\n' +
      '      </div>\n' +
      '      <div class="env-collapsible">\n' +
      '        <div class="env-collapsible-header">\n' +
      '          <span>⚙️ 高级设置</span>\n' +
      '          <span class="env-collapsible-icon">▼</span>\n' +
      '        </div>\n' +
      '        <div class="env-collapsible-content">\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>MediaDevices模式</label>\n' +
      '              <select id="fp-media-devices-mode">\n' +
      '                <option value="fake" selected>伪造</option>\n' +
      '                <option value="real">真实</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>Battery模式</label>\n' +
      '              <select id="fp-battery-mode">\n' +
      '                <option value="privacy" selected>隐私</option>\n' +
      '                <option value="real">真实</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>Sensors模式</label>\n' +
      '              <select id="fp-sensors-mode">\n' +
      '                <option value="disable" selected>禁用</option>\n' +
      '                <option value="real">真实</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>Speech API模式</label>\n' +
      '              <select id="fp-speech-mode">\n' +
      '                <option value="minimal" selected>最小化</option>\n' +
      '                <option value="system">系统</option>\n' +
      '                <option value="disable">禁用</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '          </div>\n' +
      '          <div class="env-form-row">\n' +
      '            <div class="env-form-group">\n' +
      '              <label>剪贴板模式</label>\n' +
      '              <select id="fp-clipboard-mode">\n' +
      '                <option value="ask" selected>询问</option>\n' +
      '                <option value="allow">允许</option>\n' +
      '                <option value="disable">禁用</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '            <div class="env-form-group">\n' +
      '              <label>通知模式</label>\n' +
      '              <select id="fp-notification-mode">\n' +
      '                <option value="deny" selected>拒绝</option>\n' +
      '                <option value="allow">允许</option>\n' +
      '              </select>\n' +
      '            </div>\n' +
      '          </div>\n' +
      '        </div>\n' +
      '      </div>\n' +
      '    </div>\n' +
      '  </section>\n' +
      '  <div class="env-result-wrapper hidden" id="fingerprint-result-wrapper">\n' +
      '     <div class="env-result-header">\n' +
      '       <span>执行结果</span>\n' +
      '       <button class="env-btn-icon env-result-close" id="close-result-btn">×</button>\n' +
      '     </div>\n' +
      '     <div class="env-result-content" id="fingerprint-result"></div>\n' +
      '  </div>\n' +
      '</div>\n' +
      '<div class="env-panel-footer">\n' +
      '  <div class="env-footer-left">\n' +
      '    <button class="env-btn-secondary" id="generate-fingerprint-btn" title="一键生成指纹">🎲 生成</button>\n' +
      '    <button class="env-btn-secondary" id="test-fingerprint-btn" title="测试指纹">🔍 测试</button>\n' +
      '    <button class="env-btn-secondary" id="preview-fingerprint-btn" title="预览指纹">👁 预览</button>\n' +
      '  </div>\n' +
      '  <div class="env-footer-right">\n' +
      '    <button class="env-btn-secondary" id="reset-fingerprint-btn" title="重置为默认">重置</button>\n' +
      '    <button class="env-btn-primary" id="apply-btn" title="应用并保存">应用并保存</button>\n' +
      '  </div>\n' +
      '</div>';
  }

  function setupConditionalFields(){
    const c = state.container;
    const webglMode = c.querySelector('#fp-webgl-mode');
    webglMode.addEventListener('change', (e) => {
      const isCustom = e.target.value === 'custom';
      c.querySelector('#fp-webgl-vendor').parentElement.style.display = isCustom ? 'block' : 'none';
      c.querySelector('#fp-webgl-renderer').parentElement.style.display = isCustom ? 'block' : 'none';
    });
    const timezoneMode = c.querySelector('#fp-timezone-mode');
    timezoneMode.addEventListener('change', (e) => {
      const isCustom = e.target.value === 'custom';
      c.querySelector('#fp-timezone-name').disabled = !isCustom;
    });
    const geoMode = c.querySelector('#fp-geolocation-mode');
    geoMode.addEventListener('change', (e) => {
      const isCustom = e.target.value === 'custom';
      c.querySelector('#fp-latitude').disabled = !isCustom;
      c.querySelector('#fp-longitude').disabled = !isCustom;
      c.querySelector('#fp-geo-accuracy').disabled = !isCustom;
    });
    const webrtcMode = c.querySelector('#fp-webrtc-mode');
    webrtcMode.addEventListener('change', (e) => {
      const isReplace = e.target.value === 'replace';
      c.querySelector('#fp-local-ip').disabled = !isReplace;
    });
  }

  function setupCollapsibles(){
    const c = state.container;
    c.querySelectorAll('.env-collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('active');
      });
    });
  }

  window.EnvSettingsRender = { render, setupConditionalFields, setupCollapsibles };
})();
