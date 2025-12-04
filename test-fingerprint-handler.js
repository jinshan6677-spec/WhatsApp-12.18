// 完整的测试处理器实现
// 这是要替换到 EnvironmentIPCHandlers.js 中的代码

ipcMain.handle('fingerprint:test:run', async (event, configData, options = {}) => {
    try {
        if (!configData) {
            return { success: false, error: 'Fingerprint configuration is required' };
        }

        // 真实测量模式:在 WhatsApp Web 窗口中测试指纹
        const realMode = options && (options.real === true || options.mode === 'real');
        if (realMode) {
            const fpConfig = configData instanceof FingerprintConfig ? configData : new FingerprintConfig(configData);

            console.log('[Test] Starting real fingerprint test...');

            // 测试脚本
            const detectionScript = `(() => {
  const data = {};
  try {
    data.navigator = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: Array.isArray(navigator.languages) ? navigator.languages.slice() : [],
      webdriver: (typeof navigator.webdriver === 'undefined' ? undefined : navigator.webdriver)
    };
  } catch (e) { data.navigator = { error: e.message }; }
  try {
    data.screen = {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth
    };
  } catch (e) { data.screen = { error: e.message }; }
  try { data.devicePixelRatio = window.devicePixelRatio; } catch (e) { data.devicePixelRatio = undefined; }
  try { data.hardwareConcurrency = navigator.hardwareConcurrency; } catch (e) { data.hardwareConcurrency = undefined; }
  try { data.deviceMemory = navigator.deviceMemory; } catch (e) { data.deviceMemory = undefined; }
  data.webgl = (() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return { error: 'no webgl' };
      const UNMASKED_VENDOR_WEBGL = 0x9245;
      const UNMASKED_RENDERER_WEBGL = 0x9246;
      const vendor = gl.getParameter(UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(UNMASKED_RENDERER_WEBGL);
      return { vendor, renderer };
    } catch (e) { return { error: e.message }; }
  })();
  return data;
})()`;

            // 获取 WhatsApp Web 的 BrowserView
            const { BrowserWindow } = require('electron');
            const allWindows = BrowserWindow.getAllWindows();
            let targetView = null;

            for (const win of allWindows) {
                const views = win.getBrowserViews();
                if (views && views.length > 0) {
                    targetView = views[0];
                    console.log('[Test] Found BrowserView, URL:', targetView.webContents.getURL());
                    break;
                }
            }

            if (!targetView) {
                console.error('[Test] No BrowserView found!');
                return {
                    success: false,
                    error: 'No WhatsApp Web window found. Please open an account first.'
                };
            }

            // 执行测试脚本
            console.log('[Test] Executing test script in BrowserView...');
            const measured = await targetView.webContents.executeJavaScript(detectionScript);
            console.log('[Test] Measured:', JSON.stringify(measured, null, 2));

            // 构建测试结果
            const results = [];
            const push = (name, category, expected, actual, passFn, details) => {
                let passed = false;
                try { passed = passFn(expected, actual); } catch (_) { passed = false; }
                results.push({ name, category, passed, expected, actual, details: details || '' });
            };

            const lc = s => (typeof s === 'string') ? s.toLowerCase() : s;
            push('Navigator User-Agent', 'navigator', fpConfig.userAgent, measured.navigator && measured.navigator.userAgent, (e, a) => typeof a === 'string' && a === e, 'UA should equal configured value');
            push('Navigator Platform', 'navigator', fpConfig.os.platform, measured.navigator && measured.navigator.platform, (e, a) => typeof a === 'string' && a === e, 'platform should equal configured value');
            push('Navigator Language', 'navigator', fpConfig.navigator.language, measured.navigator && measured.navigator.language, (e, a) => typeof a === 'string' && a === e, 'language should equal configured value');
            push('Navigator Webdriver Hidden', 'navigator', 'false or undefined', measured.navigator && measured.navigator.webdriver, (e, a) => a === false || typeof a === 'undefined', 'webdriver should be false/undefined');
            push('Hardware Concurrency', 'navigator', fpConfig.hardware.cpuCores, measured.hardwareConcurrency, (e, a) => typeof a === 'number' && a === e, 'CPU cores should match');
            push('Device Memory', 'navigator', fpConfig.hardware.deviceMemory, measured.deviceMemory, (e, a) => typeof a === 'number' && a === e, 'deviceMemory should match');
            const expectedRes = `${fpConfig.hardware.screen.width}x${fpConfig.hardware.screen.height}`;
            const actualRes = measured.screen && measured.screen.width && measured.screen.height ? `${measured.screen.width}x${measured.screen.height}` : undefined;
            push('Screen Resolution', 'screen', expectedRes, actualRes, (e, a) => typeof a === 'string' && a === e, 'screen.width x screen.height should match');
            push('Device Pixel Ratio', 'screen', fpConfig.hardware.devicePixelRatio, measured.devicePixelRatio, (e, a) => typeof a === 'number' && Number(a.toFixed ? a.toFixed(2) : a) === e, 'devicePixelRatio should match');
            push('WebGL Vendor', 'webgl', fpConfig.webgl.vendor, measured.webgl && measured.webgl.vendor, (e, a) => typeof a === 'string' && lc(a).includes(lc(e)), 'vendor should include configured vendor');
            push('WebGL Renderer', 'webgl', fpConfig.webgl.renderer, measured.webgl && measured.webgl.renderer, (e, a) => typeof a === 'string' && lc(a).includes(lc(e)), 'renderer should include configured renderer');

            const passed = results.filter(r => r.passed).length;
            const failed = results.filter(r => !r.passed).length;
            const total = results.length;
            const passRate = total > 0 ? ((passed / total) * 100).toFixed(2) + '%' : '0.00%';

            // 按类别分组
            const byCategory = {};
            for (const r of results) {
                if (!byCategory[r.category]) { byCategory[r.category] = { total: 0, passed: 0, failed: 0, results: [] }; }
                byCategory[r.category].total++;
                if (r.passed) byCategory[r.category].passed++; else byCategory[r.category].failed++;
                byCategory[r.category].results.push(r);
            }

            const report = {
                summary: { total, passed, failed, passRate },
                byCategory,
                results,
                timestamp: new Date().toISOString()
            };

            console.log('[Test] Test complete. Pass rate:', passRate);
            return { success: true, report };
        }

        // 默认:模拟测试
        const service = getFingerprintService();
        const report = await service.runTests(configData, options);
        return { success: true, report };
    } catch (error) {
        console.error('[EnvironmentIPCHandlers] fingerprint:test:run error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});
