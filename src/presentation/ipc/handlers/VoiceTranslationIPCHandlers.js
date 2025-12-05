'use strict';

let _logger = () => {};

function registerWithRouter(router) {
  const { ipcMain } = require('electron');
  _logger = (msg, ...args) => console.log('[IPC:VoiceTranslation]', msg, ...args);

  const fetch = require('node-fetch');
  const AbortController = global.AbortController || require('abort-controller');

  const fetchWithRetry = async (url, options, cfg = {}) => {
    const retries = cfg.retries ?? 3;
    const timeoutMs = cfg.timeoutMs ?? 20000;
    const backoffBaseMs = cfg.backoffBaseMs ?? 800;
    const retryOn = cfg.retryOn ?? [429, 502, 503, 504];
    let attempt = 0;
    let lastError = null;
    while (attempt <= retries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeout);
        if (!resp.ok && retryOn.includes(resp.status) && attempt < retries) {
          const delay = backoffBaseMs * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          attempt++;
          continue;
        }
        return resp;
      } catch (err) {
        clearTimeout(timeout);
        lastError = err;
        if (attempt < retries) {
          const delay = backoffBaseMs * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          attempt++;
          continue;
        }
        throw err;
      }
    }
    if (lastError) throw lastError;
    throw new Error('Unknown fetch error');
  };

  const sttHandler = async (request) => {
    try {
      const { audioBlob, apiKey, model } = request.payload || {};
      if (!apiKey || !String(apiKey).trim().length) {
        return { success: false, error: '未设置 Groq API Key', retryable: false };
      }

      const FormData = require('form-data');

      const audioBuffer = Buffer.from(audioBlob || []);
      const formData = new FormData();
      formData.append('file', audioBuffer, { filename: 'audio.mp4', contentType: 'audio/mp4' });
      formData.append('model', model || 'whisper-large-v3');
      formData.append('response_format', 'json');

      const response = await fetchWithRetry('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, ...formData.getHeaders() },
        body: formData
      }, { retries: 3, timeoutMs: 20000, backoffBaseMs: 800, retryOn: [429, 502, 503, 504] });

      if (!response.ok) {
        const errorText = await response.text();
        _logger('stt:groq API error', response.status, errorText);
        if (response.status === 503) return { success: false, error: '模型正在加载，请稍后重试', retryable: true };
        if (response.status === 429) return { success: false, error: '请求过多，请稍后重试', retryable: true };
        return { success: false, error: `HTTP ${response.status}: ${errorText}`, retryable: false };
      }

      const result = await response.json();
      _logger('stt:groq ✓', result.text);
      return { success: true, text: result.text || '' };
    } catch (error) {
      const msg = /abort/i.test(String(error && error.message)) ? '请求超时' : error.message;
      return { success: false, error: msg, retryable: true };
    }
  };

  const llmHandler = async (request) => {
    try {
      const { apiKey, model, prompt } = request.payload || {};
      if (!apiKey || !String(apiKey).trim().length) {
        return { success: false, error: '未设置 Groq API Key' };
      }

      const retryCfg = { retries: 3, timeoutMs: 20000, backoffBaseMs: 800, retryOn: [429, 502, 503, 504] };
      const body = {
        model: model || 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a professional translator. Output only translated text.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.3
      };

      const response = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }, retryCfg);

      if (!response.ok) {
        const errorText = await response.text();
        const retryable = [429, 502, 503, 504].includes(response.status);
        if (retryable) return { success: false, error: `HTTP ${response.status}: ${errorText}`, retryable: true };
        return { success: false, error: `HTTP ${response.status}: ${errorText}`, retryable: false };
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content || '';
      return { success: true, text };
    } catch (error) {
      const msg = /abort/i.test(String(error && error.message)) ? '请求超时' : error.message;
      return { success: false, error: msg, retryable: true };
    }
  };

  router.register('stt:groq', sttHandler, { defaultTimeout: 20000 });
  router.register('llm:groq-translate', llmHandler, { defaultTimeout: 20000 });

  try { ipcMain.removeHandler('stt:groq'); } catch (_) {}
  try { ipcMain.removeHandler('llm:groq-translate'); } catch (_) {}

  ipcMain.handle('stt:groq', async (_event, payload) => {
    const request = { payload, requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
    const response = await router.handle('stt:groq', request);
    return response.success ? response.data : { success: false, error: response.error?.message || 'Unknown error' };
  });

  ipcMain.handle('llm:groq-translate', async (_event, payload) => {
    const request = { payload, requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
    const response = await router.handle('llm:groq-translate', request);
    return response.success ? response.data : { success: false, error: response.error?.message || 'Unknown error' };
  });

  _logger('Voice translation handlers registered with IPCRouter and ipcMain');
}

function unregisterFromRouter(router) {
  const { ipcMain } = require('electron');
  router.unregister('stt:groq');
  router.unregister('llm:groq-translate');
  try { ipcMain.removeHandler('stt:groq'); } catch (_) {}
  try { ipcMain.removeHandler('llm:groq-translate'); } catch (_) {}
  _logger('Voice translation handlers unregistered');
}

module.exports = {
  registerWithRouter,
  unregisterFromRouter
};
