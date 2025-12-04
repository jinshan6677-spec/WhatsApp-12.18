/**
 * Environment IPC Handlers
 * 
 * Handles IPC communication for environment settings (proxy and fingerprint).
 * Provides handlers for configuration management, proxy testing, and fingerprint operations.
 * 
 * @module presentation/ipc/handlers/EnvironmentIPCHandlers
 * 
 * Requirements:
 * - 32.4: Reuse existing IPC communication mechanism for fingerprint operations
 */

'use strict';

const { ipcMain } = require('electron');
const {
    EnvironmentConfigManager,
    ProxyManager,
    ProxyConfigStore,
    ProxyValidator
} = require('../../../environment');

// Import fingerprint services
const {
    FingerprintService
} = require('../../../application/services/fingerprint');

const {
    FingerprintRepository,
    FingerprintInjector
} = require('../../../infrastructure/fingerprint');

const FingerprintConfig = require('../../../domain/fingerprint/FingerprintConfig');

// Singleton instances
let envConfigManager = null;
let proxyConfigStore = null;
let fingerprintService = null;
let fingerprintRepository = null;

/**
 * Get or create EnvironmentConfigManager instance
 * @returns {EnvironmentConfigManager}
 */
function getEnvConfigManager() {
    if (!envConfigManager) {
        envConfigManager = new EnvironmentConfigManager();
    }
    return envConfigManager;
}

/**
 * Get or create ProxyConfigStore instance
 * @returns {ProxyConfigStore}
 */
function getProxyConfigStore() {
    if (!proxyConfigStore) {
        proxyConfigStore = new ProxyConfigStore();
    }
    return proxyConfigStore;
}

/**
 * Get or create FingerprintService instance
 * @returns {FingerprintService}
 */
function getFingerprintService() {
    if (!fingerprintService) {
        fingerprintService = new FingerprintService();
    }
    return fingerprintService;
}

/**
 * Get or create FingerprintRepository instance
 * @returns {FingerprintRepository}
 */
function getFingerprintRepository() {
    if (!fingerprintRepository) {
        fingerprintRepository = new FingerprintRepository();
    }
    return fingerprintRepository;
}

/**
 * Register environment IPC handlers
 * @param {Object} dependencies - Dependencies
 */
function register(dependencies) {
    console.log('[EnvironmentIPCHandlers] Registering handlers');

    // Get environment configuration for an account
    ipcMain.handle('env:get-config', async (event, accountId) => {
        try {
            if (!accountId) {
                return { success: false, error: 'Account ID is required' };
            }

            const manager = getEnvConfigManager();
            const config = manager.getConfig(accountId);

            return {
                success: true,
                config: config
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:get-config error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Save environment configuration for an account
    ipcMain.handle('env:save-config', async (event, accountId, config) => {
        try {
            if (!accountId) {
                return { success: false, error: 'Account ID is required' };
            }

            if (!config) {
                return { success: false, error: 'Configuration is required' };
            }

            const manager = getEnvConfigManager();
            manager.saveConfig(accountId, config);

            return {
                success: true,
                message: 'Configuration saved successfully'
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:save-config error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Test proxy connectivity
    ipcMain.handle('env:test-proxy', async (event, proxyConfig) => {
        try {
            if (!proxyConfig) {
                return { success: false, error: 'Proxy configuration is required' };
            }

            const result = await ProxyValidator.testProxy(proxyConfig, 15000);

            return result;
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:test-proxy error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Detect current network information
    ipcMain.handle('env:detect-network', async (event) => {
        try {
            const result = await ProxyValidator.getCurrentNetwork(15000);

            return result;
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:detect-network error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // ==================== Fingerprint Handlers ====================

    // Generate a new fingerprint configuration
    ipcMain.handle('fingerprint:generate', async (event, options = {}) => {
        try {
            const service = getFingerprintService();
            const config = service.generateFingerprint(options);

            return {
                success: true,
                config: config.toJSON ? config.toJSON() : config
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:generate error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Save a fingerprint configuration
    ipcMain.handle('fingerprint:save', async (event, accountId, configData) => {
        try {
            if (!accountId) {
                return { success: false, error: 'Account ID is required' };
            }

            if (!configData) {
                return { success: false, error: 'Fingerprint configuration is required' };
            }

            const repository = getFingerprintRepository();
            const service = getFingerprintService();

            // Create FingerprintConfig from data
            const config = configData instanceof FingerprintConfig
                ? configData
                : FingerprintConfig.fromJSON({ ...configData, accountId });

            // Validate before saving
            const validation = service.validateFingerprint(config);
            if (!validation.valid) {
                return {
                    success: false,
                    error: 'Validation failed',
                    errors: validation.errors
                };
            }

            // Save to repository
            await repository.save(config);

            // Update service cache
            service.setFingerprint(accountId, config);

            return {
                success: true,
                message: 'Fingerprint configuration saved successfully',
                config: config.toJSON()
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:save error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get a fingerprint configuration for an account
    ipcMain.handle('fingerprint:get', async (event, accountId) => {
        try {
            if (!accountId) {
                return { success: false, error: 'Account ID is required' };
            }

            const repository = getFingerprintRepository();
            const service = getFingerprintService();

            // Try cache first
            let config = service.getFingerprint(accountId);

            // If not in cache, load from repository
            if (!config) {
                config = await repository.loadByAccountId(accountId);
                if (config) {
                    service.setFingerprint(accountId, config);
                }
            }

            if (!config) {
                return {
                    success: false,
                    error: 'Fingerprint configuration not found'
                };
            }

            return {
                success: true,
                config: config.toJSON ? config.toJSON() : config
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:get error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Validate a fingerprint configuration
    ipcMain.handle('fingerprint:validate', async (event, configData) => {
        try {
            if (!configData) {
                return { success: false, error: 'Fingerprint configuration is required' };
            }

            const service = getFingerprintService();
            const result = service.validateWithSuggestions(configData);

            return {
                success: true,
                valid: result.valid,
                errors: result.errors,
                warnings: result.warnings,
                suggestions: result.suggestions
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:validate error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Apply a fingerprint configuration to an account (generate injection script)
    ipcMain.handle('fingerprint:apply', async (event, accountId, options = {}) => {
        try {
            if (!accountId) {
                return { success: false, error: 'Account ID is required' };
            }

            const repository = getFingerprintRepository();
            const service = getFingerprintService();

            // Get the fingerprint config
            let config = service.getFingerprint(accountId);
            if (!config) {
                config = await repository.loadByAccountId(accountId);
            }

            if (!config) {
                return {
                    success: false,
                    error: 'Fingerprint configuration not found for account'
                };
            }

            // Create injector and generate scripts
            const configData = config.toJSON ? config.toJSON() : config;
            const injector = new FingerprintInjector(configData, options);

            const scripts = {
                injection: injector.getInjectionScript(),
                preload: injector.getPreloadScript(),
                iframe: injector.getIframeScript(),
                worker: injector.getWorkerScript()
            };

            return {
                success: true,
                scripts,
                generationTime: injector.getGenerationTime()
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:apply error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Delete a fingerprint configuration
    ipcMain.handle('fingerprint:delete', async (event, accountId) => {
        try {
            if (!accountId) {
                return { success: false, error: 'Account ID is required' };
            }

            const repository = getFingerprintRepository();
            const service = getFingerprintService();

            // Delete from repository
            const deleted = await repository.deleteByAccountId(accountId);

            // Remove from cache
            service.removeFingerprint(accountId);

            return {
                success: true,
                deleted,
                message: deleted ? 'Fingerprint configuration deleted' : 'No configuration found to delete'
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:delete error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // ==================== Template Handlers ====================

    // Create a fingerprint template
    ipcMain.handle('fingerprint:template:create', async (event, options) => {
        try {
            if (!options || !options.name) {
                return { success: false, error: 'Template name is required' };
            }

            if (!options.config) {
                return { success: false, error: 'Template configuration is required' };
            }

            const service = getFingerprintService();
            const template = service.createTemplate(options);

            return {
                success: true,
                template
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:template:create error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Apply a template to an account
    ipcMain.handle('fingerprint:template:apply', async (event, templateId, accountId) => {
        try {
            if (!templateId) {
                return { success: false, error: 'Template ID is required' };
            }

            if (!accountId) {
                return { success: false, error: 'Account ID is required' };
            }

            const service = getFingerprintService();
            const repository = getFingerprintRepository();

            const config = service.applyTemplate(templateId, accountId);

            // Save to repository
            await repository.save(config);

            return {
                success: true,
                config: config.toJSON ? config.toJSON() : config
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:template:apply error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Export a template
    ipcMain.handle('fingerprint:template:export', async (event, templateId, options = {}) => {
        try {
            if (!templateId) {
                return { success: false, error: 'Template ID is required' };
            }

            const service = getFingerprintService();
            const exported = service.exportTemplate(templateId, options);

            return {
                success: true,
                data: exported
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:template:export error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Import a template
    ipcMain.handle('fingerprint:template:import', async (event, jsonData, options = {}) => {
        try {
            if (!jsonData) {
                return { success: false, error: 'Template JSON data is required' };
            }

            const service = getFingerprintService();
            const template = service.importTemplate(jsonData, options);

            return {
                success: true,
                template
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:template:import error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Delete a template
    ipcMain.handle('fingerprint:template:delete', async (event, templateId) => {
        try {
            if (!templateId) {
                return { success: false, error: 'Template ID is required' };
            }

            const service = getFingerprintService();
            const deleted = service.deleteTemplate(templateId);

            return {
                success: true,
                deleted
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:template:delete error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // List all templates
    ipcMain.handle('fingerprint:template:list', async (event, options = {}) => {
        try {
            const service = getFingerprintService();
            const templates = service.listTemplates(options);

            return {
                success: true,
                templates
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:template:list error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get a specific template
    ipcMain.handle('fingerprint:template:get', async (event, templateId) => {
        try {
            if (!templateId) {
                return { success: false, error: 'Template ID is required' };
            }

            const service = getFingerprintService();
            const template = service.getTemplate(templateId);

            if (!template) {
                return {
                    success: false,
                    error: 'Template not found'
                };
            }

            return {
                success: true,
                template
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:template:get error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // ==================== Test Handlers ====================

    // Run fingerprint tests
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
      // 使用 gl.VENDOR 和 gl.RENDERER 而不是常量值
      const vendor = gl.getParameter(gl.VENDOR);
      const renderer = gl.getParameter(gl.RENDERER);
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

                // 等待 WebGL 伪装生效
                console.log('[Test] Waiting 2 seconds for WebGL spoofing to take effect...');
                await new Promise(resolve => setTimeout(resolve, 2000));

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

    // Get fingerprint preview
    ipcMain.handle('fingerprint:preview', async (event, configData) => {
        try {
            if (!configData) {
                return { success: false, error: 'Fingerprint configuration is required' };
            }

            const service = getFingerprintService();
            const preview = service.getPreview(configData);

            return {
                success: true,
                preview
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:preview error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get injection script for a configuration (without saving)
    ipcMain.handle('fingerprint:getScript', async (event, configData, options = {}) => {
        try {
            if (!configData) {
                return { success: false, error: 'Fingerprint configuration is required' };
            }

            const injector = new FingerprintInjector(configData, options);

            return {
                success: true,
                script: injector.getInjectionScript(),
                generationTime: injector.getGenerationTime()
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:getScript error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Load all fingerprints (for app startup)
    ipcMain.handle('fingerprint:loadAll', async (event) => {
        try {
            const repository = getFingerprintRepository();
            const service = getFingerprintService();

            const configs = await repository.loadAll();

            // Cache all loaded configs
            for (const config of configs) {
                if (config.accountId) {
                    service.setFingerprint(config.accountId, config);
                }
            }

            return {
                success: true,
                count: configs.length,
                configs: configs.map(c => c.toJSON ? c.toJSON() : c)
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] fingerprint:loadAll error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // ==================== Proxy Handlers ====================

    // Get list of saved proxy configurations
    ipcMain.handle('env:get-proxy-configs', async (event) => {
        try {
            const store = getProxyConfigStore();
            const configs = store.getProxyConfigs();

            return {
                success: true,
                configs: configs
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:get-proxy-configs error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Save a named proxy configuration
    ipcMain.handle('env:save-proxy-config', async (event, name, config) => {
        try {
            if (!name) {
                return { success: false, error: 'Configuration name is required' };
            }

            if (!config) {
                return { success: false, error: 'Proxy configuration is required' };
            }

            const store = getProxyConfigStore();
            store.saveProxyConfig(name, config);

            return {
                success: true,
                message: 'Proxy configuration saved successfully'
            };
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:save-proxy-config error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Delete a saved proxy configuration
    ipcMain.handle('env:delete-proxy-config', async (event, name) => {
        try {
            if (!name) {
                return { success: false, error: 'Configuration name is required' };
            }

            const store = getProxyConfigStore();
            const deleted = store.deleteProxyConfig(name);

            if (deleted) {
                return {
                    success: true,
                    message: 'Proxy configuration deleted successfully'
                };
            } else {
                return {
                    success: false,
                    error: 'Failed to delete proxy configuration'
                };
            }
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:delete-proxy-config error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get IP geolocation data
    ipcMain.handle('env:get-ip-geolocation', async (event, ip) => {
        try {
            if (!ip) {
                return { success: false, error: 'IP address is required' };
            }

            const result = await ProxyValidator.getIPGeolocation(ip, 15000);

            return result;
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:get-ip-geolocation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Parse proxy string (smart paste)
    ipcMain.handle('env:parse-proxy-string', async (event, proxyString) => {
        try {
            if (!proxyString) {
                return { success: false, error: 'Proxy string is required' };
            }

            const config = ProxyManager.parseProxyString(proxyString);

            if (config) {
                return {
                    success: true,
                    config: config
                };
            } else {
                return {
                    success: false,
                    error: 'Invalid proxy string format'
                };
            }
        } catch (error) {
            console.error('[EnvironmentIPCHandlers] env:parse-proxy-string error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    console.log('[EnvironmentIPCHandlers] Handlers registered successfully');
}

/**
 * Unregister environment IPC handlers
 */
function unregister() {
    console.log('[EnvironmentIPCHandlers] Unregistering handlers');

    // Environment handlers
    ipcMain.removeHandler('env:get-config');
    ipcMain.removeHandler('env:save-config');
    ipcMain.removeHandler('env:test-proxy');
    ipcMain.removeHandler('env:detect-network');
    ipcMain.removeHandler('env:get-proxy-configs');
    ipcMain.removeHandler('env:save-proxy-config');
    ipcMain.removeHandler('env:delete-proxy-config');
    ipcMain.removeHandler('env:get-ip-geolocation');
    ipcMain.removeHandler('env:parse-proxy-string');

    // Fingerprint handlers
    ipcMain.removeHandler('fingerprint:generate');
    ipcMain.removeHandler('fingerprint:save');
    ipcMain.removeHandler('fingerprint:get');
    ipcMain.removeHandler('fingerprint:validate');
    ipcMain.removeHandler('fingerprint:apply');
    ipcMain.removeHandler('fingerprint:delete');

    // Template handlers
    ipcMain.removeHandler('fingerprint:template:create');
    ipcMain.removeHandler('fingerprint:template:apply');
    ipcMain.removeHandler('fingerprint:template:export');
    ipcMain.removeHandler('fingerprint:template:import');
    ipcMain.removeHandler('fingerprint:template:delete');
    ipcMain.removeHandler('fingerprint:template:list');
    ipcMain.removeHandler('fingerprint:template:get');

    // Test handlers
    ipcMain.removeHandler('fingerprint:test:run');
    ipcMain.removeHandler('fingerprint:preview');
    ipcMain.removeHandler('fingerprint:getScript');
    ipcMain.removeHandler('fingerprint:loadAll');

    console.log('[EnvironmentIPCHandlers] Handlers unregistered successfully');
}

module.exports = {
    register,
    unregister
};
