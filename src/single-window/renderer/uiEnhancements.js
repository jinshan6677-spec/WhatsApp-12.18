/**
 * UI/UX Enhancements
 * Provides tooltips, drag-to-reorder, loading spinners, and keyboard shortcuts help
 */

(function() {
  'use strict';

  // State
  let draggedElement = null;
  let draggedAccountId = null;
  let tooltipElement = null;
  let tooltipTimeout = null;
  let shortcutsHelpVisible = false;

  /**
   * Initialize UI enhancements
   */
  function init() {
    initTooltips();
    initDragAndDrop();
    initKeyboardShortcutsHelp();
    initLoadingStates();
  }

  /**
   * Initialize tooltip system
   */
  function initTooltips() {
    // Create tooltip element
    tooltipElement = document.createElement('div');
    tooltipElement.className = 'tooltip';
    document.body.appendChild(tooltipElement);

    // Add tooltip listeners to elements with title attribute
    document.addEventListener('mouseover', handleTooltipShow);
    document.addEventListener('mouseout', handleTooltipHide);
    document.addEventListener('mousemove', handleTooltipMove);
  }

  /**
   * Show tooltip on hover
   */
  function handleTooltipShow(e) {
    const target = e.target.closest('[title]');
    if (!target || !target.title) return;

    // Clear any existing timeout
    clearTimeout(tooltipTimeout);

    // Store original title and clear it (to prevent browser tooltip)
    if (!target.dataset.originalTitle) {
      target.dataset.originalTitle = target.title;
      target.title = '';
    }

    // Show tooltip after delay
    tooltipTimeout = setTimeout(() => {
      showTooltip(target, target.dataset.originalTitle);
    }, 500);
  }

  /**
   * Hide tooltip
   */
  function handleTooltipHide(e) {
    const target = e.target.closest('[title], [data-original-title]');
    if (!target) return;

    clearTimeout(tooltipTimeout);
    hideTooltip();
  }

  /**
   * Update tooltip position on mouse move
   */
  function handleTooltipMove(e) {
    if (tooltipElement.classList.contains('show')) {
      positionTooltip(e.clientX, e.clientY);
    }
  }

  /**
   * Show tooltip at position
   */
  function showTooltip(element, text) {
    if (!text) return;

    tooltipElement.textContent = text;
    tooltipElement.classList.add('show');

    // Position tooltip
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();

    // Determine best position (prefer top, then bottom)
    let position = 'top';
    let x = rect.left + rect.width / 2;
    let y = rect.top - tooltipRect.height - 10;

    if (y < 10) {
      // Not enough space on top, show below
      position = 'bottom';
      y = rect.bottom + 10;
    }

    // Adjust horizontal position if tooltip goes off screen
    if (x + tooltipRect.width / 2 > window.innerWidth - 10) {
      x = window.innerWidth - tooltipRect.width / 2 - 10;
    } else if (x - tooltipRect.width / 2 < 10) {
      x = tooltipRect.width / 2 + 10;
    }

    tooltipElement.className = `tooltip ${position} show`;
    positionTooltip(x, y);
  }

  /**
   * Position tooltip at coordinates
   */
  function positionTooltip(x, y) {
    const rect = tooltipElement.getBoundingClientRect();
    tooltipElement.style.left = `${x - rect.width / 2}px`;
    tooltipElement.style.top = `${y}px`;
  }

  /**
   * Hide tooltip
   */
  function hideTooltip() {
    tooltipElement.classList.remove('show');
  }

  /**
   * Initialize drag and drop for account reordering
   */
  function initDragAndDrop() {
    // Use event delegation for dynamically created account items
    const accountList = document.getElementById('account-list');
    if (!accountList) return;

    accountList.addEventListener('dragstart', handleDragStart);
    accountList.addEventListener('dragend', handleDragEnd);
    accountList.addEventListener('dragover', handleDragOver);
    accountList.addEventListener('drop', handleDrop);
    accountList.addEventListener('dragleave', handleDragLeave);

    // Make account items draggable when they're created
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.classList && node.classList.contains('account-item')) {
            node.setAttribute('draggable', 'true');
          }
        });
      });
    });

    observer.observe(accountList, { childList: true });

    // Make existing items draggable
    accountList.querySelectorAll('.account-item').forEach(item => {
      item.setAttribute('draggable', 'true');
    });
  }

  /**
   * Handle drag start
   */
  function handleDragStart(e) {
    const item = e.target.closest('.account-item');
    if (!item) return;

    draggedElement = item;
    draggedAccountId = item.dataset.accountId;

    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', item.innerHTML);

    // Hide tooltip during drag
    hideTooltip();

    // Add visual feedback
    showDragTooltip(item, '拖拽到目标位置释放');
  }

  /**
   * Show reorder feedback
   */
  function showReorderFeedback(element, message, isError = false) {
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: ${isError ? '#f44336' : '#4caf50'};
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s ease;
    `;
    
    element.style.position = 'relative';
    element.appendChild(feedback);

    // Show feedback
    setTimeout(() => {
      feedback.style.opacity = '1';
      feedback.style.transform = 'translateY(-50%) translateX(-4px)';
    }, 10);

    // Hide and remove feedback
    setTimeout(() => {
      feedback.style.opacity = '0';
      feedback.style.transform = 'translateY(-50%) translateX(10px)';
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.remove();
        }
      }, 300);
    }, 2000);
  }

  /**
   * Show drag tooltip
   */
  function showDragTooltip(element, text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'drag-tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;
    document.body.appendChild(tooltip);

    // Position tooltip
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 40}px`;
    tooltip.style.transform = 'translateX(-50%)';

    // Show tooltip
    setTimeout(() => {
      tooltip.style.opacity = '1';
    }, 100);

    // Store reference for cleanup
    element._dragTooltip = tooltip;
  }

  /**
   * Handle drag end
   */
  function handleDragEnd(e) {
    const item = e.target.closest('.account-item');
    if (!item) return;

    item.classList.remove('dragging');

    // Remove drag-over class from all items
    document.querySelectorAll('.account-item').forEach(el => {
      el.classList.remove('drag-over');
    });

    // Remove drag tooltip
    if (item._dragTooltip) {
      item._dragTooltip.remove();
      delete item._dragTooltip;
    }

    draggedElement = null;
    draggedAccountId = null;
  }

  /**
   * Handle drag over
   */
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const item = e.target.closest('.account-item');
    if (!item || item === draggedElement) return;

    // Remove drag-over from all items
    document.querySelectorAll('.account-item').forEach(el => {
      el.classList.remove('drag-over');
    });

    // Add drag-over to current item
    item.classList.add('drag-over');
  }

  /**
   * Handle drag leave
   */
  function handleDragLeave(e) {
    const item = e.target.closest('.account-item');
    if (!item) return;

    item.classList.remove('drag-over');
  }

  /**
   * Handle drop
   */
  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const targetItem = e.target.closest('.account-item');
    if (!targetItem || !draggedElement || targetItem === draggedElement) {
      return;
    }

    const targetAccountId = targetItem.dataset.accountId;

    // Remove drag-over class
    targetItem.classList.remove('drag-over');

    // Get all account items
    const accountList = document.getElementById('account-list');
    const items = Array.from(accountList.querySelectorAll('.account-item'));

    // Calculate new order
    const draggedIndex = items.indexOf(draggedElement);
    const targetIndex = items.indexOf(targetItem);

    if (draggedIndex === targetIndex) return;

    // Reorder in DOM for immediate visual feedback
    if (draggedIndex < targetIndex) {
      targetItem.parentNode.insertBefore(draggedElement, targetItem.nextSibling);
    } else {
      targetItem.parentNode.insertBefore(draggedElement, targetItem);
    }

    // Get new order of account IDs
    const reorderedItems = Array.from(accountList.querySelectorAll('.account-item'));
    const newAccountIds = reorderedItems.map(item => item.dataset.accountId);

    // Send reorder request to main process
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.reorderAccounts(newAccountIds);

        if (!result.success) {
          const errorMessage = result.errors ? result.errors.join(', ') : (result.error || 'Unknown error');
          throw new Error(errorMessage);
        }

        // Show success feedback
        showReorderFeedback(targetItem, '已重新排序');
        
        // 确保排序后状态正确恢复
        setTimeout(() => {
          // 先重新加载账号数据，确保DOM是最新的
          if (window.sidebar && window.sidebar.loadAccounts) {
            window.sidebar.loadAccounts().then(() => {
              // DOM更新完成后，再同步状态和按钮
              setTimeout(() => {
                // 手动同步所有账号的运行状态
                if (window.sidebar && window.sidebar.getAccounts) {
                  const accounts = window.sidebar.getAccounts();
                  accounts.forEach(account => {
                    // 确保已登录账号的运行状态正确
                    if (account.loginStatus === true && (account.runningStatus === 'loading' || account.runningStatus === 'not_started')) {
                      account.runningStatus = 'connected';
                      account.isRunning = true;
                      
                      // 更新该账号的按钮显示
                      const item = document.querySelector(`[data-account-id="${account.id}"]`);
                      if (item) {
                        const actions = item.querySelector('.account-actions');
                        if (actions && window.sidebar.renderQuickActions) {
                          window.sidebar.renderQuickActions(account, actions);
                        }
                      }
                    }
                  });
                  console.log('[UIEnhancements] Status and button recovery after reordering completed');
                }
              }, 100);
            });
          }
        }, 100);
      }
    } catch (error) {
      console.error('Failed to reorder accounts:', error);
      
      // Show error feedback
      showReorderFeedback(targetItem, '排序失败', true);
      
      // Reload accounts to restore correct order
      setTimeout(() => {
        if (window.sidebar && window.sidebar.loadAccounts) {
          window.sidebar.loadAccounts();
        }
      }, 1500);
    }
  }

  /**
   * Initialize keyboard shortcuts help
   */
  function initKeyboardShortcutsHelp() {
    // Create help button
    const helpButton = document.createElement('button');
    helpButton.className = 'help-button';
    helpButton.innerHTML = '?';
    helpButton.title = '键盘快捷键（按 ? 切换）';
    helpButton.addEventListener('click', toggleShortcutsHelp);
    document.body.appendChild(helpButton);

    // Create shortcuts help panel
    const helpPanel = document.createElement('div');
    helpPanel.className = 'shortcuts-help hidden';
    helpPanel.innerHTML = `
      <div class="shortcuts-help-header">
        <h3>键盘快捷键</h3>
        <button class="shortcuts-help-close" aria-label="关闭">×</button>
      </div>
      <div class="shortcuts-list">
        <div class="shortcut-item">
          <div class="shortcut-keys">
            <span class="shortcut-key">Ctrl</span>
            <span class="shortcut-key">1-9</span>
          </div>
          <div class="shortcut-description">切换到账号 1-9</div>
        </div>
        <div class="shortcut-item">
          <div class="shortcut-keys">
            <span class="shortcut-key">Ctrl</span>
            <span class="shortcut-key">Tab</span>
          </div>
          <div class="shortcut-description">切换到下一个账号</div>
        </div>
        <div class="shortcut-item">
          <div class="shortcut-keys">
            <span class="shortcut-key">Ctrl</span>
            <span class="shortcut-key">Shift</span>
            <span class="shortcut-key">Tab</span>
          </div>
          <div class="shortcut-description">切换到上一个账号</div>
        </div>
        <div class="shortcut-item">
          <div class="shortcut-keys">
            <span class="shortcut-key">?</span>
          </div>
          <div class="shortcut-description">显示/隐藏此帮助面板</div>
        </div>
        <div class="shortcut-item">
          <div class="shortcut-keys">
            <span class="shortcut-key">Esc</span>
          </div>
          <div class="shortcut-description">关闭此帮助面板</div>
        </div>
      </div>
    `;
    document.body.appendChild(helpPanel);

    // Add close button handler
    const closeButton = helpPanel.querySelector('.shortcuts-help-close');
    closeButton.addEventListener('click', hideShortcutsHelp);

    // Add keyboard listener for ? key
    document.addEventListener('keydown', (e) => {
      // Toggle help with ? key (Shift + /)
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        toggleShortcutsHelp();
      }
      // Close help with Escape key
      else if (e.key === 'Escape' && shortcutsHelpVisible) {
        e.preventDefault();
        hideShortcutsHelp();
      }
    });
  }

  /**
   * Toggle shortcuts help panel
   */
  function toggleShortcutsHelp() {
    if (shortcutsHelpVisible) {
      hideShortcutsHelp();
    } else {
      showShortcutsHelp();
    }
  }

  /**
   * Show shortcuts help panel
   */
  function showShortcutsHelp() {
    const helpPanel = document.querySelector('.shortcuts-help');
    const helpButton = document.querySelector('.help-button');
    
    if (helpPanel) {
      helpPanel.classList.remove('hidden');
      shortcutsHelpVisible = true;
    }
    
    if (helpButton) {
      helpButton.classList.add('hidden');
    }
  }

  /**
   * Hide shortcuts help panel
   */
  function hideShortcutsHelp() {
    const helpPanel = document.querySelector('.shortcuts-help');
    const helpButton = document.querySelector('.help-button');
    
    if (helpPanel) {
      helpPanel.classList.add('hidden');
      shortcutsHelpVisible = false;
    }
    
    if (helpButton) {
      helpButton.classList.remove('hidden');
    }
  }

  /**
   * Initialize loading states for buttons
   */
  function initLoadingStates() {
    // Listen for account operations
    if (window.electronAPI) {
      window.electronAPI.on('account:operation-start', handleOperationStart);
      window.electronAPI.on('account:operation-complete', handleOperationComplete);
      window.electronAPI.on('account:operation-error', handleOperationError);
    }
  }

  /**
   * Handle operation start
   */
  function handleOperationStart(data) {
    const { operation, accountId } = data;
    
    // Show loading spinner on relevant button
    if (operation === 'create') {
      const addButton = document.getElementById('add-account');
      if (addButton) {
        addButton.classList.add('loading');
        addButton.disabled = true;
      }
    } else if (operation === 'delete' && accountId) {
      const item = document.querySelector(`[data-account-id="${accountId}"]`);
      if (item) {
        const deleteBtn = item.querySelector('.delete-btn');
        if (deleteBtn) {
          deleteBtn.innerHTML = '<span class="spinner small"></span>';
          deleteBtn.disabled = true;
        }
      }
    }
  }

  /**
   * Handle operation complete
   */
  function handleOperationComplete(data) {
    const { operation, accountId } = data;
    
    // Remove loading state
    if (operation === 'create') {
      const addButton = document.getElementById('add-account');
      if (addButton) {
        addButton.classList.remove('loading');
        addButton.disabled = false;
      }
    } else if (operation === 'delete' && accountId) {
      // Item will be removed from DOM, no need to update
    }
  }

  /**
   * Handle operation error
   */
  function handleOperationError(data) {
    const { operation, accountId, error } = data;
    
    // Remove loading state and show error
    if (operation === 'create') {
      const addButton = document.getElementById('add-account');
      if (addButton) {
        addButton.classList.remove('loading');
        addButton.disabled = false;
      }
    } else if (operation === 'delete' && accountId) {
      const item = document.querySelector(`[data-account-id="${accountId}"]`);
      if (item) {
        const deleteBtn = item.querySelector('.delete-btn');
        if (deleteBtn) {
          deleteBtn.innerHTML = '🗑️';
          deleteBtn.disabled = false;
        }
      }
    }
    
    console.error(`Operation ${operation} failed:`, error);
  }

  /**
   * Show loading spinner
   */
  function showLoadingSpinner(element, size = 'small') {
    const spinner = document.createElement('span');
    spinner.className = `spinner ${size}`;
    element.appendChild(spinner);
    return spinner;
  }

  /**
   * Remove loading spinner
   */
  function removeLoadingSpinner(element) {
    const spinner = element.querySelector('.spinner');
    if (spinner) {
      spinner.remove();
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for external access
  window.uiEnhancements = {
    showTooltip,
    hideTooltip,
    showShortcutsHelp,
    hideShortcutsHelp,
    toggleShortcutsHelp,
    showLoadingSpinner,
    removeLoadingSpinner
  };

})();
