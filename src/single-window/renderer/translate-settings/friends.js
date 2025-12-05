;(function(){
  'use strict';
  async function loadCurrentFriendConfig(inst){
    if (!inst.panel) return;
    const info = await inst.getActiveChatInfo();
    const contactId = info?.contactId;
    const contactName = info?.contactName || contactId;
    const currentContactEl = inst.panel.querySelector('#currentContactName');
    const currentFriendEnabled = inst.panel.querySelector('#currentFriendEnabled');
    if (!currentContactEl) return;
    if (!contactId) {
      currentContactEl.textContent = '当前联系人：未打开聊天窗口';
      if (currentFriendEnabled) currentFriendEnabled.disabled = true;
      updateFriendConfigOptions(inst);
      return;
    }
    if (currentContactEl) currentContactEl.textContent = `当前联系人：${contactName}`;
    if (currentFriendEnabled) currentFriendEnabled.disabled = false;
    const friendConfig = inst.config.friendConfigs && inst.config.friendConfigs[contactId];
    if (friendConfig && friendConfig.enabled) {
      currentFriendEnabled.checked = true;
      inst.panel.querySelector('#friendTargetLang').value = friendConfig.targetLang || 'en';
      inst.panel.querySelector('#friendBlockChinese').checked = friendConfig.blockChinese || false;
    } else {
      currentFriendEnabled.checked = false;
      inst.panel.querySelector('#friendTargetLang').value = 'en';
      inst.panel.querySelector('#friendBlockChinese').checked = false;
    }
    updateFriendConfigOptions(inst);
  }

  function updateFriendConfigVisibility(inst){
    const friendIndependent = inst.panel.querySelector('#friendIndependent').checked;
    const friendConfigSection = inst.panel.querySelector('#friendConfigSection');
    if (friendConfigSection) friendConfigSection.style.display = friendIndependent ? 'block' : 'none';
  }

  function updateFriendConfigOptions(inst){
    const enabled = inst.panel.querySelector('#currentFriendEnabled').checked;
    const options = inst.panel.querySelector('#friendConfigOptions');
    if (options) options.style.display = enabled ? 'block' : 'none';
  }

  async function saveCurrentFriendConfig(inst){
    const chatInfo = await inst.getActiveChatInfo();
    const contactId = chatInfo.contactId;
    if (!contactId) return;
    const enabled = inst.panel.querySelector('#currentFriendEnabled')?.checked || false;
    const targetLang = inst.panel.querySelector('#friendTargetLang')?.value || 'en';
    const blockChinese = inst.panel.querySelector('#friendBlockChinese')?.checked || false;
    if (!inst.config.friendConfigs) inst.config.friendConfigs = {};
    if (enabled) {
      inst.config.friendConfigs[contactId] = { enabled: true, targetLang, blockChinese };
    } else {
      delete inst.config.friendConfigs[contactId];
    }
    await inst.saveSettings();
  }

  function showFriendConfigManager(inst){
    const friendConfigs = inst.config.friendConfigs || {};
    const count = Object.keys(friendConfigs).length;
    let message = `已配置 ${count} 个联系人的独立翻译设置\n\n`;
    if (count > 0) {
      message += '配置列表：\n';
      for (const [contactId, config] of Object.entries(friendConfigs)) {
        if (config.enabled) {
          message += `- ${contactId}: ${config.targetLang}${config.blockChinese ? ' (禁发中文)' : ''}\n`;
        }
      }
      message += '\n要清除某个联系人的配置，请打开该聊天窗口，在设置中取消勾选“为当前联系人启用独立配置”。';
    } else {
      message += '暂无配置的联系人\n\n要为联系人设置独立配置，请打开该聊天窗口，在设置中勾选“为当前联系人启用独立配置”。';
    }
    alert(message);
  }

  window.TranslateSettingsFriends = {
    loadCurrentFriendConfig,
    updateFriendConfigVisibility,
    updateFriendConfigOptions,
    saveCurrentFriendConfig,
    showFriendConfigManager
  };
})();

