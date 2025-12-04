/**
 * Migration Dialog Renderer Script
 * Handles the UI for configuration migration from multi-window to single-window architecture
 */

// State management
const state = {
  currentScreen: 'detection',
  migrationData: null,
  progress: 0,
  logs: []
};

// DOM elements
const elements = {
  detectionScreen: null,
  progressScreen: null,
  resultsScreen: null,
  startMigrationBtn: null,
  cancelMigrationBtn: null,
  cancelProgressBtn: null,
  continueBtn: null,
  viewBackupBtn: null,
  progressFill: null,
  progressText: null,
  progressStatus: null,
  migrationLog: null,
  resultsSummary: null,
  resultsDetails: null,
  accountResultsList: null,
  resultsErrors: null,
  resultsWarnings: null,
  errorList: null,
  warningList: null,
  resultsIcon: null,
  resultsTitle: null,
  successInfo: null,
  errorInfo: null,
  backupPath: null
};

/**
 * Initialize the dialog
 */
function init() {
  console.log('Migration dialog initializing...');
  
  // Get DOM elements
  elements.detectionScreen = document.getElementById('detection-screen');
  elements.progressScreen = document.getElementById('progress-screen');
  elements.resultsScreen = document.getElementById('results-screen');
  elements.startMigrationBtn = document.getElementById('start-migration-btn');
  elements.cancelMigrationBtn = document.getElementById('cancel-migration-btn');
  elements.cancelProgressBtn = document.getElementById('cancel-progress-btn');
  elements.continueBtn = document.getElementById('continue-btn');
  elements.viewBackupBtn = document.getElementById('view-backup-btn');
  elements.progressFill = document.getElementById('progress-fill');
  elements.progressText = document.getElementById('progress-text');
  elements.progressStatus = document.getElementById('progress-status');
  elements.migrationLog = document.getElementById('migration-log');
  elements.resultsSummary = document.getElementById('results-summary');
  elements.resultsDetails = document.getElementById('results-details');
  elements.accountResultsList = document.getElementById('account-results-list');
  elements.resultsErrors = document.getElementById('results-errors');
  elements.resultsWarnings = document.getElementById('results-warnings');
  elements.errorList = document.getElementById('error-list');
  elements.warningList = document.getElementById('warning-list');
  elements.resultsIcon = document.getElementById('results-icon');
  elements.resultsTitle = document.getElementById('results-title');
  elements.successInfo = document.getElementById('success-info');
  elements.errorInfo = document.getElementById('error-info');
  elements.backupPath = document.getElementById('backup-path');
  
  // Attach event listeners
  attachEventListeners();
  
  // Show detection screen
  showScreen('detection');
  
  console.log('Migration dialog initialized');
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  // Detection screen buttons
  elements.startMigrationBtn.addEventListener('click', handleStartMigration);
  elements.cancelMigrationBtn.addEventListener('click', handleCancelMigration);
  
  // Progress screen buttons
  elements.cancelProgressBtn.addEventListener('click', handleCancelMigration);
  
  // Results screen buttons
  elements.continueBtn.addEventListener('click', handleContinue);
  elements.viewBackupBtn.addEventListener('click', handleViewBackup);
  
  // Listen for migration events from main process
  if (window.electronAPI) {
    window.electronAPI.on('migration:progress', handleMigrationProgress);
    window.electronAPI.on('migration:log', handleMigrationLog);
    window.electronAPI.on('migration:complete', handleMigrationComplete);
    window.electronAPI.on('migration:error', handleMigrationError);
  }
}

/**
 * Show a specific screen
 */
function showScreen(screenName) {
  console.log(`Switching to screen: ${screenName}`);
  
  // Hide all screens
  elements.detectionScreen.classList.remove('active');
  elements.progressScreen.classList.remove('active');
  elements.resultsScreen.classList.remove('active');
  
  // Show the requested screen
  switch (screenName) {
    case 'detection':
      elements.detectionScreen.classList.add('active');
      break;
    case 'progress':
      elements.progressScreen.classList.add('active');
      break;
    case 'results':
      elements.resultsScreen.classList.add('active');
      break;
  }
  
  state.currentScreen = screenName;
}

/**
 * Handle start migration button click
 */
async function handleStartMigration() {
  console.log('Starting migration...');
  
  // Disable button
  elements.startMigrationBtn.disabled = true;
  elements.cancelMigrationBtn.disabled = true;
  
  // Show progress screen
  showScreen('progress');
  
  // Reset progress
  updateProgress(0, '准备迁移...');
  clearLogs();
  
  // Start migration via IPC
  try {
    if (window.electronAPI) {
      await window.electronAPI.invoke('migration:start');
    } else {
      // Fallback for testing
      console.warn('electronAPI not available, simulating migration');
      simulateMigration();
    }
  } catch (error) {
    console.error('Failed to start migration:', error);
    handleMigrationError({ message: error.message });
  }
}

/**
 * Handle cancel migration button click
 */
function handleCancelMigration() {
  console.log('Canceling migration...');
  
  if (window.electronAPI) {
    window.electronAPI.send('migration:cancel');
  }
  
  // Close the window
  if (window.electronAPI) {
    window.electronAPI.send('close-window');
  } else {
    window.close();
  }
}

/**
 * Handle continue button click
 */
function handleContinue() {
  console.log('Continuing to app...');
  
  if (window.electronAPI) {
    window.electronAPI.send('migration:continue');
  }
  
  // Close the window
  if (window.electronAPI) {
    window.electronAPI.send('close-window');
  } else {
    window.close();
  }
}

/**
 * Handle view backup button click
 */
function handleViewBackup() {
  console.log('Opening backup location...');
  
  if (window.electronAPI && state.migrationData && state.migrationData.backupPath) {
    window.electronAPI.send('migration:open-backup', state.migrationData.backupPath);
  }
}

/**
 * Handle migration progress updates
 */
function handleMigrationProgress(data) {
  console.log('Migration progress:', data);
  
  const { progress, status, step } = data;
  
  updateProgress(progress, status);
  
  if (step) {
    updateStatus(step);
  }
}

/**
 * Handle migration log entries
 */
function handleMigrationLog(data) {
  const { level, message, timestamp } = data;
  addLogEntry(level, message, timestamp);
}

/**
 * Handle migration completion
 */
function handleMigrationComplete(data) {
  console.log('Migration complete:', data);
  
  state.migrationData = data;
  
  // Update progress to 100%
  updateProgress(100, '迁移完成！');
  
  // Wait a moment before showing results
  setTimeout(() => {
    showResults(data);
  }, 1000);
}

/**
 * Handle migration errors
 */
function handleMigrationError(data) {
  console.error('Migration error:', data);
  
  state.migrationData = data;
  
  // Show results with error state
  showResults({
    success: false,
    errors: [data.message || '发生未知错误'],
    warnings: [],
    migratedAccounts: []
  });
}

/**
 * Update progress bar and text
 */
function updateProgress(progress, statusText) {
  state.progress = progress;
  
  elements.progressFill.style.width = `${progress}%`;
  elements.progressText.textContent = `${Math.round(progress)}%`;
  
  if (statusText) {
    updateStatus(statusText);
  }
}

/**
 * Update status text
 */
function updateStatus(statusText) {
  // Determine icon based on status
  let icon = '⏳';
  let className = '';
  
  const lowerStatus = statusText.toLowerCase();
  if (lowerStatus.includes('complete') || lowerStatus.includes('完成')) {
    icon = '✅';
    className = 'completed';
  } else if (lowerStatus.includes('error') || lowerStatus.includes('fail') || lowerStatus.includes('错误') || lowerStatus.includes('失败')) {
    icon = '❌';
    className = 'error';
  } else if (lowerStatus.includes('warning') || lowerStatus.includes('警告')) {
    icon = '⚠️';
    className = 'warning';
  }
  
  // Update status display
  elements.progressStatus.innerHTML = `
    <div class="status-item ${className}">
      <span class="status-icon">${icon}</span>
      <span class="status-text">${statusText}</span>
    </div>
  `;
}

/**
 * Add log entry
 */
function addLogEntry(level, message, timestamp) {
  const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${level}`;
  logEntry.innerHTML = `<span class="timestamp">[${time}]</span>${message}`;
  
  elements.migrationLog.appendChild(logEntry);
  
  // Auto-scroll to bottom
  elements.migrationLog.scrollTop = elements.migrationLog.scrollHeight;
  
  state.logs.push({ level, message, timestamp: time });
}

/**
 * Clear logs
 */
function clearLogs() {
  elements.migrationLog.innerHTML = '';
  state.logs = [];
}

/**
 * Show results screen
 */
function showResults(data) {
  const { success, errors = [], warnings = [], migratedAccounts = [], backupPath } = data;
  
  // Update results icon and title
  if (success) {
    elements.resultsIcon.textContent = '✅';
    elements.resultsTitle.textContent = '迁移完成';
    elements.successInfo.style.display = 'flex';
    elements.errorInfo.style.display = 'none';
  } else {
    elements.resultsIcon.textContent = '❌';
    elements.resultsTitle.textContent = '迁移失败';
    elements.successInfo.style.display = 'none';
    elements.errorInfo.style.display = 'flex';
  }
  
  // Update backup path
  if (backupPath) {
    elements.backupPath.textContent = backupPath;
  }
  
  // Build summary
  buildSummary(success, migratedAccounts.length, errors.length, warnings.length);
  
  // Build account results
  buildAccountResults(migratedAccounts);
  
  // Show errors if any
  if (errors.length > 0) {
    elements.resultsErrors.style.display = 'block';
    elements.errorList.innerHTML = errors.map(error => `<li>${error}</li>`).join('');
  } else {
    elements.resultsErrors.style.display = 'none';
  }
  
  // Show warnings if any
  if (warnings.length > 0) {
    elements.resultsWarnings.style.display = 'block';
    elements.warningList.innerHTML = warnings.map(warning => `<li>${warning}</li>`).join('');
  } else {
    elements.resultsWarnings.style.display = 'none';
  }
  
  // Show results screen
  showScreen('results');
}

/**
 * Build summary cards
 */
function buildSummary(success, accountCount, errorCount, warningCount) {
  const summaryHTML = `
    <div class="summary-card ${success ? 'success' : 'error'}">
      <div class="summary-value">${success ? '✓' : '✗'}</div>
      <div class="summary-label">状态</div>
    </div>
    <div class="summary-card ${accountCount > 0 ? 'success' : ''}">
      <div class="summary-value">${accountCount}</div>
      <div class="summary-label">已迁移账号</div>
    </div>
    <div class="summary-card ${errorCount > 0 ? 'error' : ''}">
      <div class="summary-value">${errorCount}</div>
      <div class="summary-label">错误</div>
    </div>
    <div class="summary-card ${warningCount > 0 ? 'warning' : ''}">
      <div class="summary-value">${warningCount}</div>
      <div class="summary-label">警告</div>
    </div>
  `;
  
  elements.resultsSummary.innerHTML = summaryHTML;
}

/**
 * Build account results list
 */
function buildAccountResults(accounts) {
  if (!accounts || accounts.length === 0) {
    elements.accountResultsList.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">没有账号被迁移。</p>';
    return;
  }
  
  const accountsHTML = accounts.map(account => {
    const success = !account.error;
    const icon = success ? '✅' : '❌';
    const status = success ? '迁移成功' : account.error;
    
    return `
      <div class="account-result-item ${success ? 'success' : 'error'}">
        <span class="account-result-icon">${icon}</span>
        <div class="account-result-info">
          <div class="account-result-name">${account.name || account.id}</div>
          <div class="account-result-status">${status}</div>
        </div>
      </div>
    `;
  }).join('');
  
  elements.accountResultsList.innerHTML = accountsHTML;
}

/**
 * Simulate migration for testing (when electronAPI is not available)
 */
function simulateMigration() {
  console.log('Simulating migration...');
  
  let progress = 0;
  const steps = [
    { progress: 10, status: '检测旧配置...', delay: 500 },
    { progress: 20, status: '创建备份...', delay: 800 },
    { progress: 40, status: '迁移账号配置...', delay: 1200 },
    { progress: 60, status: '迁移会话数据...', delay: 1000 },
    { progress: 80, status: '验证迁移数据...', delay: 800 },
    { progress: 100, status: '迁移完成！', delay: 500 }
  ];
  
  function runStep(index) {
    if (index >= steps.length) {
      // Simulation complete
      setTimeout(() => {
        showResults({
          success: true,
          errors: [],
          warnings: ['这是用于测试目的的模拟迁移'],
          migratedAccounts: [
            { id: 'acc_001', name: '个人 WhatsApp' },
            { id: 'acc_002', name: '工作账号' },
            { id: 'acc_003', name: '商务账号' }
          ],
          backupPath: '/path/to/backup/accounts.json.backup-2024-01-01'
        });
      }, 1000);
      return;
    }
    
    const step = steps[index];
    
    setTimeout(() => {
      updateProgress(step.progress, step.status);
      addLogEntry('info', step.status);
      runStep(index + 1);
    }, step.delay);
  }
  
  runStep(0);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

