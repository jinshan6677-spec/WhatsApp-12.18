
(function() {
  console.log('[Test] Starting injection test...');
  
  // 简化版的 WhatsAppTranslation
  window.WhatsAppTranslation = {
    initialized: false,
    config: null,
    accountId: 'test',
    
    init: async function() {
      console.log('[Test] WhatsAppTranslation.init() called');
      this.initialized = true;
      return true;
    },
    
    test: function() {
      console.log('[Test] WhatsAppTranslation.test() called');
      return 'Translation system is working!';
    }
  };
  
  console.log('[Test] window.WhatsAppTranslation created');
  console.log('[Test] Type:', typeof window.WhatsAppTranslation);
  console.log('[Test] Has init:', typeof window.WhatsAppTranslation.init);
})();
