;(function(){
  'use strict';
  async function loadStats(panel){
    try {
      const statsContent = panel.querySelector('#statsContent');
      if (!statsContent || !window.translationAPI) return;
      const response = await window.translationAPI.getStats();
      if (response.success && response.data) {
        const stats = response.data;
        statsContent.innerHTML = `
          <div class="stat-item">
            <span class="stat-label">总翻译次数：</span>
            <span class="stat-value">${stats.translation.totalRequests || 0}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">成功次数：</span>
            <span class="stat-value">${stats.translation.successCount || 0}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">缓存命中率：</span>
            <span class="stat-value">${stats.translation.cacheStats?.hitRate || '0%'}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">缓存大小：</span>
            <span class="stat-value">${stats.translation.cacheStats?.memorySize || 0} KB</span>
          </div>
        `;
      }
    } catch (_) {}
  }

  window.TranslateSettingsStats = { loadStats };
})();

