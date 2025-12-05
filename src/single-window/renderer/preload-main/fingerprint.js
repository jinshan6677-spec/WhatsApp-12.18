const createFingerprintAPI = (ipcRenderer) => ({
  generateFingerprint: (options = {}) => ipcRenderer.invoke('fingerprint:generate', options),
  saveFingerprint: (accountId, config) => ipcRenderer.invoke('fingerprint:save', accountId, config),
  getFingerprint: (accountId) => ipcRenderer.invoke('fingerprint:get', accountId),
  validateFingerprint: (config) => ipcRenderer.invoke('fingerprint:validate', config),
  applyFingerprint: (accountId, options = {}) => ipcRenderer.invoke('fingerprint:apply', accountId, options),
  deleteFingerprint: (accountId) => ipcRenderer.invoke('fingerprint:delete', accountId),
  disableFingerprint: (accountId) => ipcRenderer.invoke('fingerprint:disable', accountId),
  updateFingerprint: (accountId) => ipcRenderer.invoke('fingerprint:update', accountId),
  previewFingerprint: (config) => ipcRenderer.invoke('fingerprint:preview', config),
  getFingerprintScript: (config, options = {}) => ipcRenderer.invoke('fingerprint:getScript', config, options),
  loadAllFingerprints: () => ipcRenderer.invoke('fingerprint:loadAll'),
  createFingerprintTemplate: (options) => ipcRenderer.invoke('fingerprint:template:create', options),
  applyFingerprintTemplate: (templateId, accountId) => ipcRenderer.invoke('fingerprint:template:apply', templateId, accountId),
  exportFingerprintTemplate: (templateId, options = {}) => ipcRenderer.invoke('fingerprint:template:export', templateId, options),
  importFingerprintTemplate: (jsonData, options = {}) => ipcRenderer.invoke('fingerprint:template:import', jsonData, options),
  deleteFingerprintTemplate: (templateId) => ipcRenderer.invoke('fingerprint:template:delete', templateId),
  listFingerprintTemplates: (options = {}) => ipcRenderer.invoke('fingerprint:template:list', options),
  getFingerprintTemplate: (templateId) => ipcRenderer.invoke('fingerprint:template:get', templateId),
  runFingerprintTests: (config, options = {}) => ipcRenderer.invoke('fingerprint:test:run', config, options)
});

module.exports = createFingerprintAPI;
