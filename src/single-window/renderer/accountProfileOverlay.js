(function () {
  'use strict';

  if (!window.electronAPI) {
    console.warn('[AccountProfileOverlay] electronAPI not available');
    return;
  }

  /**
   * Apply profile data (avatar / name / phone) to a sidebar account item DOM node.
   * This is intentionally independent of the existing sidebar.js state to avoid
   * tight coupling and encoding issues.
   *
   * @param {string} accountId
   * @param {Object} profile
   */
  function applyProfileToDom(accountId, profile) {
    const { phoneNumber, profileName, avatarUrl } = profile || {};

    const accountList = document.getElementById('account-list');
    if (!accountList) return;

    const item = accountList.querySelector(`.account-item[data-account-id="${accountId}"]`);
    if (!item) return;

    // Name
    const nameEl = item.querySelector('.account-name');
    if (nameEl && profileName) {
      nameEl.textContent = profileName;
      nameEl.title = profileName;
    }

    // Avatar
    const avatarEl = item.querySelector('.account-avatar');
    if (avatarEl) {
      // Clear existing content
      avatarEl.textContent = '';
      const existingImg = avatarEl.querySelector('img');
      if (existingImg) {
        existingImg.remove();
      }
      avatarEl.style.background = '';

      if (avatarUrl) {
        const img = document.createElement('img');
        img.src = avatarUrl;
        img.alt = profileName || nameEl?.textContent || '';
        img.className = 'account-avatar-image';
        avatarEl.appendChild(img);
      }
    }

    // Phone number
    let phoneEl = item.querySelector('.account-phone');
    if (!phoneEl && phoneNumber) {
      phoneEl = document.createElement('div');
      phoneEl.className = 'account-phone';

      const infoEl = item.querySelector('.account-info');
      const statusEl = infoEl ? infoEl.querySelector('.account-status') : null;
      if (infoEl && statusEl) {
        infoEl.insertBefore(phoneEl, statusEl);
      } else if (infoEl) {
        infoEl.appendChild(phoneEl);
      }
    }

    if (phoneEl) {
      if (phoneNumber) {
        phoneEl.textContent = phoneNumber;
        phoneEl.title = phoneNumber;
      } else {
        phoneEl.remove();
      }
    }
  }

  /**
   * Listen to profile updates coming from ViewManager.
   */
  function setupProfileListeners() {
    console.log('[AccountProfileOverlay] overlay script loaded');

    window.electronAPI.on('view-manager:account-profile-updated', (data) => {
      const { accountId, phoneNumber, profileName, avatarUrl } = data || {};
      if (!accountId) return;

      console.log('[AccountProfileOverlay] profile-updated', {
        accountId,
        hasAvatar: !!avatarUrl,
        phoneNumber,
        profileName
      });

      applyProfileToDom(accountId, { phoneNumber, profileName, avatarUrl });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupProfileListeners);
  } else {
    setupProfileListeners();
  }
})();
