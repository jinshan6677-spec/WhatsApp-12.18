/**
 * 预加载脚本
 * 在渲染进程中暴露安全的 API
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露翻译 API
contextBridge.exposeInMainWorld('translationAPI', {
  /**
   * 翻译文本
   * @param {Object} request - 翻译请求
   * @returns {Promise<Object>} 翻译结果
   */
  translate: (request) => {
    return ipcRenderer.invoke('translation:translate', request);
  },

  /**
   * 检测语言
   * @param {string} text - 待检测文本
   * @returns {Promise<Object>} 检测结果
   */
  detectLanguage: (text) => {
    return ipcRenderer.invoke('translation:detectLanguage', text);
  },

  /**
   * 获取配置 - 通过 IPC
   * @param {string} accountId - 账号ID
   * @returns {Promise<Object>} 配置对象
   */
  getConfig: (accountId) => {
    return ipcRenderer.invoke('translation:getConfig', accountId);
  },

  /**
   * 保存配置 - 通过 IPC
   * @param {string} accountId - 账号ID
   * @param {Object} config - 配置对象
   * @returns {Promise<Object>} 保存结果
   */
  saveConfig: (accountId, config) => {
    // IPCRouter expects { accountId, config } as payload
    return ipcRenderer.invoke('translation:saveConfig', { accountId, config });
  },

  /**
   * 获取统计信息
   * @returns {Promise<Object>} 统计数据
   */
  getStats: () => {
    return ipcRenderer.invoke('translation:getStats');
  },

  /**
   * 清除缓存
   * @returns {Promise<Object>} 清除结果
   */
  clearCache: () => {
    return ipcRenderer.invoke('translation:clearCache');
  },

  /**
   * 保存引擎配置
   * @param {string} engineName - 引擎名称
   * @param {Object} config - 引擎配置
   * @returns {Promise<Object>} 保存结果
   */
  saveEngineConfig: (engineName, config) => {
    // IPCRouter expects { engineName, config } as payload
    return ipcRenderer.invoke('translation:saveEngineConfig', { engineName, config });
  },

  /**
   * 获取引擎配置
   * @param {string} engineName - 引擎名称
   * @returns {Promise<Object>} 引擎配置
   */
  getEngineConfig: (engineName) => {
    return ipcRenderer.invoke('translation:getEngineConfig', engineName);
  },

  /**
   * 通知聊天切换
   * 用于更新翻译设置面板中的当前联系人信息
   */
  notifyChatSwitched: () => {
    ipcRenderer.send('translation:chat-switched');
  }
});

console.log('[Preload] Translation API exposed');
