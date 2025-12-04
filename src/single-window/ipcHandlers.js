/**
 * IPC Handlers for Single-Window Architecture
 * 
 * This file serves as a compatibility layer that delegates to the new
 * modular IPC handlers in src/presentation/ipc/handlers/.
 * 
 * The handlers have been split into domain-specific modules:
 * - AccountIPCHandlers: Account CRUD, switching, status
 * - ViewIPCHandlers: View management, session, monitoring
 * - SystemIPCHandlers: Sidebar, window resize, layout
 * - TranslationIPCHandlers: Translation panel, chat info
 * - EnvironmentIPCHandlers: Proxy settings (fingerprint已移除，将在新系统中实现)
 * 
 * @module single-window/ipcHandlers
 */

'use strict';

const AccountIPCHandlers = require('../presentation/ipc/handlers/AccountIPCHandlers');
const ViewIPCHandlers = require('../presentation/ipc/handlers/ViewIPCHandlers');
const SystemIPCHandlers = require('../presentation/ipc/handlers/SystemIPCHandlers');
const EnvironmentIPCHandlers = require('../presentation/ipc/handlers/EnvironmentIPCHandlers');
const { ipcMain } = require('electron');

/**
 * Register IPC handlers for single-window architecture
 * @param {AccountConfigManager} accountManager - Account configuration manager
 * @param {ViewManager} viewManager - View manager for BrowserViews
 * @param {MainWindow} mainWindow - Main window instance
 * @param {TranslationIntegration} [translationIntegration] - Translation integration instance (optional)
 */
function registerIPCHandlers(accountManager, viewManager, mainWindow, translationIntegration = null) {
  if (!accountManager) {
    throw new Error('AccountManager is required');
  }
  if (!viewManager) {
    throw new Error('ViewManager is required');
  }
  if (!mainWindow) {
    throw new Error('MainWindow is required');
  }

  const dependencies = {
    accountManager,
    viewManager,
    mainWindow,
    translationIntegration
  };

  // Register all domain handlers
  AccountIPCHandlers.register(dependencies);
  ViewIPCHandlers.register(dependencies);
  SystemIPCHandlers.register(dependencies);
  EnvironmentIPCHandlers.register(dependencies);

  ipcMain.handle('fingerprint:update', async (event, accountId) => {
    try {
      if (!accountId) {
        return { success: false, error: 'Account ID is required' };
      }

      const view = viewManager.getView(accountId);
      if (!view || !view.webContents) {
        return { success: false, error: 'View not found for account' };
      }

      const { FingerprintRepository } = require('../infrastructure/fingerprint/FingerprintRepository');
      const repo = new FingerprintRepository();
      const fpConfig = await repo.loadByAccountId(accountId);
      if (!fpConfig) {
        return { success: false, error: 'Fingerprint configuration not found' };
      }

      try {
        if (fpConfig.userAgent) {
          view.webContents.setUserAgent(fpConfig.userAgent);
        }
      } catch (_) { }

      const result = await viewManager.viewFactory.updateFingerprint(
        view,
        accountId,
        fpConfig.toJSON()
      );

      return result;
    } catch (error) {
      console.error('[IPC] fingerprint:update error:', error);
      return { success: false, error: error.message };
    }
  });

  // Register translation:apply-config handler
  ipcMain.handle('translation:apply-config', async (event, accountId, config) => {
    try {
      console.log('[IPC] translation:apply-config called for account:', accountId);

      if (!accountId) {
        console.error('[IPC] translation:apply-config: Account ID is required');
        return { success: false, error: 'Account ID is required' };
      }

      // Get the view for this account
      const view = viewManager.getView(accountId);
      if (!view || !view.webContents) {
        console.error('[IPC] translation:apply-config: View not found for account:', accountId);
        return { success: false, error: 'View not found for account' };
      }

      console.log('[IPC] translation:apply-config: Applying config to view:', {
        accountId,
        autoTranslate: config?.global?.autoTranslate,
        groupTranslation: config?.global?.groupTranslation,
        inputBoxEnabled: config?.inputBox?.enabled
      });

      // Inject translation config into the view's webContents
      const result = await view.webContents.executeJavaScript(`
        (function() {
          if (window.WhatsAppTranslation) {
            console.log('[WhatsAppTranslation] Updating config from IPC:', ${JSON.stringify(config)});
            window.WhatsAppTranslation.updateConfig(${JSON.stringify(config)});
            console.log('[WhatsAppTranslation] Config updated successfully');
            return { success: true, hasTranslation: true };
          } else {
            console.warn('[WhatsAppTranslation] WhatsAppTranslation not available yet');
            return { success: false, hasTranslation: false, error: 'WhatsAppTranslation not initialized' };
          }
        })()
      `);

      if (result && result.success) {
        console.log('[IPC] translation:apply-config: Config applied successfully to view');
        return { success: true };
      } else {
        console.warn('[IPC] translation:apply-config: Failed to apply config:', result);
        return result || { success: false, error: 'Unknown error' };
      }
    } catch (error) {
      console.error('[IPC] translation:apply-config error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stt:groq', async (event, { audioBlob, apiKey, model }) => {
    try {
      console.log('[IPC] stt:groq: 收到 STT 请求');
      console.log('[IPC] stt:groq: 模型:', model);
      console.log('[IPC] stt:groq: 音频大小:', audioBlob.length, 'bytes');

      const apiUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';

      // 动态导入 node-fetch 和 form-data
      const fetch = require('node-fetch');
      const FormData = require('form-data');

      // 将数组转换回 Buffer
      const audioBuffer = Buffer.from(audioBlob);

      // 创建 FormData（Groq API 要求 multipart/form-data）
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'audio.mp4',
        contentType: 'audio/mp4'
      });
      formData.append('model', model || 'whisper-large-v3');
      formData.append('response_format', 'json');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[IPC] stt:groq: API 错误:', response.status, errorText);

        // 如果是 503，模型正在加载
        if (response.status === 503) {
          return {
            success: false,
            error: '模型正在加载，请稍后重试',
            retryable: true
          };
        }

        throw new Error(`API 请求失败: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('[IPC] stt:groq: ✓ 转录成功:', result.text);

      return {
        success: true,
        text: result.text || ''
      };
    } catch (error) {
      console.error('[IPC] stt:groq: 转录失败:', error);
      return {
        success: false,
        error: error.message,
        retryable: false
      };
    }
  });

  ipcMain.handle('llm:groq-translate', async (event, { apiKey, model, prompt }) => {
    try {
      const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      const fetch = require('node-fetch');

      const body = {
        model: model || 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a professional translator. Output only translated text.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.3
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content || '';

      return { success: true, text };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Register get-translation-panel-layout handler
  ipcMain.handle('get-translation-panel-layout', async (event) => {
    try {
      const layout = mainWindow.getTranslationPanelLayout();
      return {
        success: true,
        layout: layout
      };
    } catch (error) {
      console.error('[IPC] get-translation-panel-layout error:', error);
      return { success: false, error: error.message };
    }
  });

  // Handle translation panel resize (expand/collapse)
  ipcMain.on('translation-panel-resized', (event, payload) => {
    try {
      if (!payload || typeof payload !== 'object') {
        console.warn('[IPC] Invalid translation panel resize payload:', payload);
        return;
      }

      const { state, width, widths } = payload;

      // Update the main window's translation panel layout
      if (state && widths) {
        mainWindow.setTranslationPanelLayout({ state, widths });
        console.log(`[IPC] Translation panel layout updated: state=${state}, width=${width}`);

        // Invalidate bounds cache to force recalculation with new panel width
        if (viewManager.boundsManager && typeof viewManager.boundsManager.invalidateCache === 'function') {
          viewManager.boundsManager.invalidateCache();
          console.log('[IPC] View bounds cache invalidated due to translation panel resize');
        }

        // Trigger view resize to apply new bounds
        const currentSidebarWidth = mainWindow.getSidebarWidth();
        viewManager.resizeViews(currentSidebarWidth, { immediate: true });
        console.log(`[IPC] Views resized after translation panel change (sidebar: ${currentSidebarWidth}px)`);

      } else {
        console.warn('[IPC] Missing required payload fields for translation panel resize:', payload);
      }
    } catch (error) {
      console.error('[IPC] Failed to handle translation panel resize:', error);
    }
  });

  // Register translation:get-active-chat handler
  // Register translation:get-active-chat handler
  ipcMain.handle('translation:get-active-chat', async (event) => {
    // Get the active account's view
    const activeAccountId = viewManager.getActiveAccountId();
    if (!activeAccountId) {
      return { success: false, error: 'No active account' };
    }

    const view = viewManager.getView(activeAccountId);
    if (!view || !view.webContents) {
      return { success: false, error: 'View not found for active account' };
    }

    // Get active chat info from the WhatsApp page (���վɰ汾b108fe28�ļ򵥷�ʽ)
    const chatInfo = await view.webContents.executeJavaScript(`
      (function() {
        const contactId = window.WhatsAppTranslation?.getCurrentContactId?.() || null;
        return { contactId, contactName: contactId };
      })()
    `);

  return {
    success: true,
    data: chatInfo
  };
  });

  console.log('[IPC] Single-window handlers registered');
}

/**
 * Unregister IPC handlers
 */
function unregisterIPCHandlers() {
  AccountIPCHandlers.unregister();
  ViewIPCHandlers.unregister();
  SystemIPCHandlers.unregister();
  EnvironmentIPCHandlers.unregister();

  // Unregister translation handlers
  ipcMain.removeHandler('translation:apply-config');
  ipcMain.removeHandler('translation:get-active-chat');
  ipcMain.removeHandler('get-translation-panel-layout');
  ipcMain.removeHandler('fingerprint:update');
  ipcMain.removeHandler('stt:groq');
  ipcMain.removeHandler('llm:groq-translate');

  // Remove translation panel resize listener
  ipcMain.removeAllListeners('translation-panel-resized');

  console.log('[IPC] Single-window handlers unregistered');
}

module.exports = {
  registerIPCHandlers,
  unregisterIPCHandlers,

  // Export individual handler modules for selective use
  AccountIPCHandlers,
  ViewIPCHandlers,
  SystemIPCHandlers,
  EnvironmentIPCHandlers
};
