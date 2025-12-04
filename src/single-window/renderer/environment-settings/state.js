;(function(){
  'use strict';
  if (!window.EnvSettingsState) {
    window.EnvSettingsState = {
      currentAccountId: null,
      currentConfig: null,
      currentFingerprintConfig: null,
      savedProxyConfigs: {},
      savedFingerprintTemplates: [],
      container: null
    };
  }
})();
