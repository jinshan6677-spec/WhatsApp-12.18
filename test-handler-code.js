// 这是要替换到 EnvironmentIPCHandlers.js 中 fingerprint:test:run 处理器的完整代码
// 从第 573 行开始,到第 593 行结束

ipcMain.handle('fingerprint:test:run', async (event, configData, options = {}) => {
    try {
        if (!configData) {
            return { success: false, error: 'Fingerprint configuration is required' };
        }

        const service = getFingerprintService();

        // 真实测量模式:创建隐藏窗口并直接注入指纹
        const realMode = options && (options.real === true || options.mode === 'real');
        if (realMode) {
            const fpConfig = configData instanceof FingerprintConfig ? configData : new FingerprintConfig(configData);
            const baseConfig = fpConfig.toJSON();

            // 构建测试配置
            const mergedWebGL = {
                ...(baseConfig.webgl || {}),
                mode: 'custom',
                unmaskedVendor: (baseConfig.webgl && baseConfig.webgl.unmaskedVendor !== undefined)
                    ? baseConfig.webgl.unmaskedVendor
                    : (baseConfig.webgl && baseConfig.webgl.vendor !== undefined ? baseConfig.webgl.vendor : undefined),
                unmaskedRenderer: (baseConfig.webgl && baseConfig.webgl.unmaskedRenderer !== undefined)
                    ? baseConfig.webgl.unmaskedRenderer
                    : (baseConfig.webgl && baseConfig.webgl.renderer !== undefined ? baseConfig.webgl.renderer : undefined)
            };
            const testConfig = { ...baseConfig, webgl: mergedWebGL };

            console.log('[Test] Creating injector with config:', {
                vendor: testConfig.webgl.vendor,
                renderer: testConfig.webgl.renderer,
                unmaskedVendor: testConfig.webgl.unmaskedVendor,
                unmaskedRenderer: testConfig.webgl.unmaskedRenderer
            });

            const injector = new FingerprintInjector(testConfig);

            // 创建测试窗口(不使用 preload)
            const win = new BrowserWindow({
                show: false,  // 隐藏窗口
                width: testConfig.hardware?.screen?.width || 1920,
                height: testConfig.hardware?.screen?.height || 1080,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: false,
                    sandbox: false
                }
            });

            try {
                // 设置 User-Agent
                const ua = baseConfig.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
                win.webContents.setUserAgent(ua);

                // 设置语言
                const langs = (baseConfig.navigator && baseConfig.navigator.languages) || ['en-US'];
                const primary = (baseConfig.navigator && baseConfig.navigator.language) || langs[0] || 'en-US';
                const uniq = [];
                for (const l of [primary, ...langs]) { if (l && !uniq.includes(l)) uniq.push(l); }
                const parts = uniq.map((l, i) => i === 0 ? l : `${l};q=${Math.max(0.1, (0.9 - i * 0.1)).toFixed(1)}`);
                const acceptLanguage = parts.join(', ');

                win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
                    const headers = details.requestHeaders || {};
                    headers['User-Agent'] = ua;
                    headers['Accept-Language'] = acceptLanguage;
                    callback({ requestHeaders: headers });
                });
            } catch (_) { }

            // 加载空白页
            await win.loadURL('about:blank');
            console.log('[Test] Page loaded');

            // 直接注入指纹脚本(不使用 preload)
            try {
                console.log('[Test] Generating injection script...');
                const injectionScript = injector.getInjectionScript({
                    minify: false,
                    includeWorkerInterceptor: false,
                    include: ['navigator', 'browserBehavior', 'webgl', 'screen']
                });
                console.log('[Test] Script generated, length:', injectionScript.length);

                // 测试语法
                try {
                    new Function(injectionScript);
                    console.log('[Test] ✓ Script syntax is valid');
                } catch (syntaxErr) {
                    console.error('[Test] ✗ Script has syntax error:', syntaxErr.message);
                    try { win.destroy(); } catch (_) { }
                    return { success: false, error: 'Injection script has syntax error: ' + syntaxErr.message };
                }

                await win.webContents.executeJavaScript(injectionScript, true);
                console.log('[Test] ✓ Script injected');
            } catch (injectError) {
                console.error('[Test] ✗ Injection failed:', injectError.message);
                try { win.destroy(); } catch (_) { }
                return { success: false, error: 'Fingerprint injection failed: ' + injectError.message };
            }

            // 等待注入生效
            await new Promise(resolve => setTimeout(resolve, 500));

            // 测量实际值
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
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      return { vendor, renderer };
    } catch (e) { return { error: e.message }; }
  })();
  return data;
})()`;

            const measured = await win.webContents.executeJavaScript(detectionScript, true);
            console.log('[Test] Measured:', JSON.stringify(measured, null, 2));

            // 关闭窗口
            try { win.destroy(); } catch (_) { }

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

            return { success: true, report };
        }

        // 默认:模拟测试
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
