/**
 * Account Configuration Dialog
 * Handles form validation, conditional field display, and save/cancel operations
 */

(function() {
  'use strict';

  // State
  let editMode = false;
  let accountId = null;
  let originalData = null;

  // DOM elements
  const form = document.getElementById('account-form');
  const dialogTitle = document.getElementById('dialog-title');
  const closeBtn = document.getElementById('close-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const saveBtn = document.getElementById('save-btn');
  const formErrors = document.getElementById('form-errors');
  const errorList = document.getElementById('error-list');

  // Form fields
  const accountName = document.getElementById('account-name');
  const accountPhoneNumber = document.getElementById('phoneNumber');
  const accountNote = document.getElementById('account-note');
  const autoStart = document.getElementById('auto-start');

  // Translation fields - removed from UI but keep references for compatibility
  // Translation is now configured only within WhatsApp Web interface
  
  

  /**
   * Initialize the dialog
   */
  function init() {
    setupEventListeners();
    loadAccountData();
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Form submission
    form.addEventListener('submit', handleSubmit);

    // Close/Cancel buttons
    closeBtn.addEventListener('click', handleCancel);
    cancelBtn.addEventListener('click', handleCancel);

    // Real-time validation
    accountName.addEventListener('input', () => validateField('name'));
    if (accountPhoneNumber) {
      accountPhoneNumber.addEventListener('input', () => validatePhoneNumberField());
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
  }

  /**
   * Load account data if in edit mode
   */
  async function loadAccountData() {
    try {
      // Check if we're in edit mode by looking at URL params
      const urlParams = new URLSearchParams(window.location.search);
      accountId = urlParams.get('accountId');

      if (accountId) {
        editMode = true;
        dialogTitle.textContent = '编辑账号';
        saveBtn.querySelector('.btn-text').textContent = '保存更改';

        // Load account data from main process
        if (window.electronAPI) {
          const account = await window.electronAPI.invoke('get-account', accountId);
          if (account) {
            originalData = account;
            populateForm(account);
          } else {
            showError('账号未找到');
          }
        }
      } else {
        editMode = false;
        dialogTitle.textContent = '添加账号';
        saveBtn.querySelector('.btn-text').textContent = '创建账号';
      }
    } catch (error) {
      console.error('Failed to load account data:', error);
      showError('加载账号数据失败');
    }
  }

  /**
   * Populate form with account data
   */
  function populateForm(account) {
    // Basic information
    accountName.value = account.name || '';
    if (accountPhoneNumber) {
      accountPhoneNumber.value = account.phoneNumber || '';
    }
    accountNote.value = account.note || '';
    autoStart.checked = account.autoStart || false;

    

    // Translation configuration - removed from UI
    // Translation is now configured only within WhatsApp Web interface
  }

  

  /**
   * Validate a single field
   */
  function validateField(fieldName) {
    clearFieldError(fieldName);

    switch (fieldName) {
      case 'name':
        if (!accountName.value.trim()) {
          setFieldError('name', '账号名称为必填项');
          return false;
        }
        if (accountName.value.trim().length > 100) {
          setFieldError('name', '账号名称不能超过 100 个字符');
          return false;
        }
        break;

      
    }

    return true;
  }

  /**
   * Validate phone number field (optional)
   */
  function validatePhoneNumberField() {
    if (!accountPhoneNumber) {
      return true;
    }

    clearFieldError('phoneNumber');

    const value = accountPhoneNumber.value.trim();
    if (!value) {
      return true;
    }

    const phonePattern = /^[0-9+\s-]+$/;
    if (value.length > 32) {
      setFieldError('phoneNumber', 'WhatsApp 号码不能超过 32 个字符');
      return false;
    }

    if (!phonePattern.test(value)) {
      setFieldError('phoneNumber', 'WhatsApp 号码格式不正确，只能包含数字、空格、+ 和 -');
      return false;
    }

    return true;
  }

  /**
   * Validate entire form
   */
  function validateForm() {
    const errors = [];

    // Validate account name
    if (!accountName.value.trim()) {
      errors.push('账号名称为必填项');
      setFieldError('name', '账号名称为必填项');
    } else if (accountName.value.trim().length > 100) {
      errors.push('账号名称不能超过 100 个字符');
      setFieldError('name', '账号名称不能超过 100 个字符');
    }

    

    // Additional phone number validation (optional)
    if (!validatePhoneNumberField()) {
      errors.push('WhatsApp 号码格式不正确');
    }

    return errors;
  }

  /**
   * Set field error
   */
  function setFieldError(fieldName, message) {
    const errorElement = document.getElementById(`${fieldName}-error`);
    const inputElement = document.getElementById(fieldName);

    if (errorElement) {
      errorElement.textContent = message;
    }

    if (inputElement) {
      inputElement.classList.add('error');
    }
  }

  /**
   * Clear field error
   */
  function clearFieldError(fieldName) {
    const errorElement = document.getElementById(`${fieldName}-error`);
    const inputElement = document.getElementById(fieldName);

    if (errorElement) {
      errorElement.textContent = '';
    }

    if (inputElement) {
      inputElement.classList.remove('error');
    }
  }



  /**
   * Clear translation validation errors
   */
  function clearTranslationValidation() {
    clearFieldError('translation-api-key');
  }

  /**
   * Show form errors
   */
  function showFormErrors(errors) {
    if (errors.length === 0) {
      formErrors.style.display = 'none';
      errorList.innerHTML = '';
      return;
    }

    errorList.innerHTML = errors.map(error => `<li>${error}</li>`).join('');
    formErrors.style.display = 'flex';

    // Scroll to errors
    formErrors.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Collect form data
   */
  function collectFormData() {
    const data = {
      name: accountName.value.trim(),
      phoneNumber: accountPhoneNumber ? accountPhoneNumber.value.trim() : '',
      note: accountNote.value.trim(),
      autoStart: autoStart.checked,
      // Translation configuration - keep existing translation settings from originalData
      // Translation is now configured only within WhatsApp Web interface
      translation: originalData?.translation || {
        enabled: true,
        engine: 'google',
        targetLanguage: 'zh-CN',
        apiKey: '',
        autoTranslate: false,
        translateInput: false,
        friendSettings: {}
      }
    };

    // If editing, include the account ID
    if (editMode && accountId) {
      data.id = accountId;
    }

    return data;
  }

  /**
   * Handle form submission
   */
  async function handleSubmit(event) {
    event.preventDefault();

    // Validate form
    const errors = validateForm();
    if (errors.length > 0) {
      showFormErrors(errors);
      return;
    }

    // Hide errors
    showFormErrors([]);

    // Disable form during submission
    setFormLoading(true);

    try {
      const formData = collectFormData();

      // Send to main process
      if (window.electronAPI) {
        let result;
        if (editMode) {
          result = await window.electronAPI.invoke('update-account', accountId, formData);
        } else {
          result = await window.electronAPI.invoke('create-account', formData);
        }

        if (result.success) {
          // Close dialog
          window.close();
        } else {
          // Show errors
          showFormErrors(result.errors || ['Failed to save account']);
          setFormLoading(false);
        }
      }
    } catch (error) {
      console.error('Failed to save account:', error);
      showFormErrors([`Failed to save account: ${error.message}`]);
      setFormLoading(false);
    }
  }

  /**
   * Handle cancel button
   */
  function handleCancel() {
    // Check if form has changes
    if (hasFormChanges()) {
      const confirmed = confirm('您有未保存的更改。您确定要取消吗？');
      if (!confirmed) {
        return;
      }
    }

    window.close();
  }

  /**
   * Check if form has changes
   */
  function hasFormChanges() {
    if (!editMode || !originalData) {
      // In create mode, check if any field has been filled
      return accountName.value.trim() !== '' ||
             (accountPhoneNumber && accountPhoneNumber.value.trim() !== '') ||
             accountNote.value.trim() !== '' ||
             autoStart.checked;
    }

    // In edit mode, compare with original data
    const currentData = collectFormData();
    return JSON.stringify(currentData) !== JSON.stringify({
      name: originalData.name,
      phoneNumber: originalData.phoneNumber || '',
      note: originalData.note,
      autoStart: originalData.autoStart,
      translation: {
        ...originalData.translation,
        friendSettings: originalData.translation?.friendSettings || {}
      }
    });
  }

  /**
   * Set form loading state
   */
  function setFormLoading(loading) {
    saveBtn.disabled = loading;
    cancelBtn.disabled = loading;
    closeBtn.disabled = loading;

    const btnText = saveBtn.querySelector('.btn-text');
    const btnSpinner = saveBtn.querySelector('.btn-spinner');

    if (loading) {
      btnText.style.display = 'none';
      btnSpinner.style.display = 'inline-block';
    } else {
      btnText.style.display = 'inline';
      btnSpinner.style.display = 'none';
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  function handleKeyDown(event) {
    // Escape key to cancel
    if (event.key === 'Escape') {
      handleCancel();
    }

    // Ctrl/Cmd + Enter to save
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      form.dispatchEvent(new Event('submit'));
    }
  }

  /**
   * Show error message
   */
  function showError(message) {
    showFormErrors([message]);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for testing
  window.accountDialog = {
    validateForm,
    collectFormData,
    populateForm,
    hasFormChanges
  };

})();
