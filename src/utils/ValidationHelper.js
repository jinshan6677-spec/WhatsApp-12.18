/**
 * ValidationHelper - Comprehensive validation utilities
 * 
 * Provides validation functions for account configurations,
 * network operations, and other edge cases in the single-window architecture.
 */

/**
 * Validate account configuration before saving
 * @param {Object} config - Account configuration object
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateAccountConfig(config) {
  const errors = [];

  // Validate account ID
  if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
    errors.push('Account ID is required and must be a non-empty string');
  }

  // Validate account name
  if (!config.name || typeof config.name !== 'string' || config.name.trim() === '') {
    errors.push('Account name is required and must be a non-empty string');
  } else if (config.name.trim().length > 100) {
    errors.push('Account name must not exceed 100 characters');
  }

  // Validate note (optional)
  if (config.note !== undefined && config.note !== null) {
    if (typeof config.note !== 'string') {
      errors.push('Account note must be a string');
    } else if (config.note.length > 500) {
      errors.push('Account note must not exceed 500 characters');
    }
  }

  // Validate order
  if (config.order !== undefined && config.order !== null) {
    if (typeof config.order !== 'number' || config.order < 0 || !Number.isInteger(config.order)) {
      errors.push('Account order must be a non-negative integer');
    }
  }

  

  // Validate translation configuration
  if (config.translation) {
    const translationErrors = validateTranslationConfig(config.translation);
    if (!translationErrors.valid) {
      errors.push(...translationErrors.errors.map(e => `Translation: ${e}`));
    }
  }

  // Validate sessionDir
  if (config.sessionDir) {
    if (typeof config.sessionDir !== 'string' || config.sessionDir.trim() === '') {
      errors.push('Session directory must be a non-empty string');
    }
  }

  // Validate dates
  if (config.createdAt !== undefined && config.createdAt !== null) {
    if (!(config.createdAt instanceof Date) && isNaN(Date.parse(config.createdAt))) {
      errors.push('createdAt must be a valid date');
    }
  }

  if (config.lastActiveAt !== undefined && config.lastActiveAt !== null) {
    if (!(config.lastActiveAt instanceof Date) && isNaN(Date.parse(config.lastActiveAt))) {
      errors.push('lastActiveAt must be a valid date');
    }
  }

  // Validate autoStart
  if (config.autoStart !== undefined && config.autoStart !== null) {
    if (typeof config.autoStart !== 'boolean') {
      errors.push('autoStart must be a boolean');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

 

/**
 * Validate translation configuration
 * @param {Object} translationConfig - Translation configuration object
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateTranslationConfig(translationConfig) {
  const errors = [];

  if (!translationConfig || typeof translationConfig !== 'object') {
    return {
      valid: false,
      errors: ['Translation configuration must be an object']
    };
  }

  // Validate enabled flag
  if (translationConfig.enabled !== undefined && typeof translationConfig.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  // Only validate other fields if translation is enabled
  if (translationConfig.enabled) {
    // Validate target language
    if (!translationConfig.targetLanguage || typeof translationConfig.targetLanguage !== 'string') {
      errors.push('targetLanguage is required and must be a string');
    } else {
      // Basic language code validation (e.g., 'en', 'zh-CN', 'en-US')
      const langPattern = /^[a-z]{2}(-[A-Z]{2})?$/;
      if (!langPattern.test(translationConfig.targetLanguage)) {
        errors.push('targetLanguage must be a valid language code (e.g., en, zh-CN)');
      }
    }

    // Validate engine
    const validEngines = ['google', 'gpt4', 'gemini', 'deepseek'];
    if (!translationConfig.engine) {
      errors.push('engine is required when translation is enabled');
    } else if (!validEngines.includes(translationConfig.engine.toLowerCase())) {
      errors.push(`engine must be one of: ${validEngines.join(', ')}`);
    }

    // Validate autoTranslate (optional)
    if (translationConfig.autoTranslate !== undefined && typeof translationConfig.autoTranslate !== 'boolean') {
      errors.push('autoTranslate must be a boolean');
    }

    // Validate translateInput (optional)
    if (translationConfig.translateInput !== undefined && typeof translationConfig.translateInput !== 'boolean') {
      errors.push('translateInput must be a boolean');
    }

    // Validate friendSettings (optional)
    if (translationConfig.friendSettings !== undefined) {
      if (typeof translationConfig.friendSettings !== 'object' || translationConfig.friendSettings === null) {
        errors.push('friendSettings must be an object');
      }
    }

    // Validate API key for paid engines (optional)
    if (translationConfig.apiKey !== undefined && translationConfig.apiKey !== null) {
      if (typeof translationConfig.apiKey !== 'string') {
        errors.push('apiKey must be a string');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check for duplicate account names
 * @param {string} name - Account name to check
 * @param {Array<Object>} existingAccounts - Array of existing accounts
 * @param {string} [excludeId] - Account ID to exclude from check (for updates)
 * @returns {{isDuplicate: boolean, conflictingAccount?: Object}}
 */
function checkDuplicateAccountName(name, existingAccounts, excludeId = null) {
  if (!name || typeof name !== 'string') {
    return { isDuplicate: false };
  }

  const normalizedName = name.trim().toLowerCase();

  for (const account of existingAccounts) {
    // Skip the account being updated
    if (excludeId && account.id === excludeId) {
      continue;
    }

    const existingName = (account.name || '').trim().toLowerCase();
    if (existingName === normalizedName) {
      return {
        isDuplicate: true,
        conflictingAccount: account
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Validate account ID format
 * @param {string} accountId - Account ID to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateAccountId(accountId) {
  if (!accountId) {
    return {
      valid: false,
      error: 'Account ID is required'
    };
  }

  if (typeof accountId !== 'string') {
    return {
      valid: false,
      error: 'Account ID must be a string'
    };
  }

  const trimmedId = accountId.trim();
  if (trimmedId === '') {
    return {
      valid: false,
      error: 'Account ID cannot be empty'
    };
  }

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
  if (invalidChars.test(trimmedId)) {
    return {
      valid: false,
      error: 'Account ID contains invalid characters'
    };
  }

  return { valid: true };
}

/**
 * Validate network connectivity
 * @param {string} url - URL to test
 * @param {Object} [options] - Options
 * @param {number} [options.timeout] - Timeout in milliseconds
 * @returns {Promise<{connected: boolean, error?: string, latency?: number}>}
 */
async function validateNetworkConnectivity(url = 'https://www.google.com', options = {}) {
  const timeout = options.timeout || 5000;

  try {
    const startTime = Date.now();
    
    // Use Electron's net module for network requests
    const { net } = require('electron');
    
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          connected: false,
          error: 'Connection timeout'
        });
      }, timeout);

      const request = net.request({
        url,
        method: 'HEAD'
      });

      request.on('response', (response) => {
        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;
        
        if (response.statusCode >= 200 && response.statusCode < 500) {
          resolve({
            connected: true,
            latency
          });
        } else {
          resolve({
            connected: false,
            error: `HTTP ${response.statusCode}`
          });
        }
      });

      request.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          connected: false,
          error: error.message
        });
      });

      request.end();
    });
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
}

/**
 * Sanitize account name
 * @param {string} name - Account name to sanitize
 * @returns {string} Sanitized name
 */
function sanitizeAccountName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // Trim whitespace
  let sanitized = name.trim();

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Limit length
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }

  return sanitized;
}

/**
 * Sanitize account note
 * @param {string} note - Account note to sanitize
 * @returns {string} Sanitized note
 */
function sanitizeAccountNote(note) {
  if (!note || typeof note !== 'string') {
    return '';
  }

  // Trim whitespace
  let sanitized = note.trim();

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Limit length
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500);
  }

  return sanitized;
}

/**
 * Validate BrowserView creation parameters
 * @param {string} accountId - Account ID
 * @param {Object} config - View configuration
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateViewCreationParams(accountId, config = {}) {
  const errors = [];

  // Validate account ID
  const idValidation = validateAccountId(accountId);
  if (!idValidation.valid) {
    errors.push(idValidation.error);
  }

  // Validate URL if provided
  if (config.url) {
    if (typeof config.url !== 'string') {
      errors.push('URL must be a string');
    } else {
      try {
        new URL(config.url);
      } catch (e) {
        errors.push('URL must be a valid URL');
      }
    }
  }

  // Validate user agent if provided
  if (config.userAgent !== undefined && config.userAgent !== null) {
    if (typeof config.userAgent !== 'string') {
      errors.push('userAgent must be a string');
    }
  }

  

  // Validate translation if provided
  if (config.translation) {
    const translationValidation = validateTranslationConfig(config.translation);
    if (!translationValidation.valid) {
      errors.push(...translationValidation.errors.map(e => `Translation: ${e}`));
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate account switch operation
 * @param {string} accountId - Account ID to switch to
 * @param {Array<string>} availableAccountIds - List of available account IDs
 * @returns {{valid: boolean, error?: string}}
 */
function validateAccountSwitch(accountId, availableAccountIds) {
  // Validate account ID format
  const idValidation = validateAccountId(accountId);
  if (!idValidation.valid) {
    return idValidation;
  }

  // Check if account exists
  if (!availableAccountIds.includes(accountId)) {
    return {
      valid: false,
      error: `Account ${accountId} does not exist`
    };
  }

  return { valid: true };
}

/**
 * Handle network failure gracefully
 * @param {Error} error - Network error
 * @param {Object} [context] - Error context
 * @returns {{handled: boolean, userMessage: string, technicalDetails: string, retryable: boolean}}
 */
function handleNetworkFailure(error, context = {}) {
  const errorCode = error.code || error.errno || 'UNKNOWN';
  const errorMessage = error.message || 'Unknown network error';

  // Categorize error types
  const retryableErrors = [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'ENETUNREACH',
    'EHOSTUNREACH',
    'ENOTFOUND'
  ];

  const isRetryable = retryableErrors.includes(errorCode);

  // Generate user-friendly message
  let userMessage = 'Network connection failed. ';
  
  switch (errorCode) {
    case 'ETIMEDOUT':
      userMessage += 'The connection timed out. Please check your internet connection and try again.';
      break;
    case 'ECONNREFUSED':
      userMessage += 'Connection was refused. The server may be down or unreachable.';
      break;
    case 'ENOTFOUND':
      userMessage += 'Could not resolve the hostname. Please check your DNS settings.';
      break;
    case 'ENETUNREACH':
    case 'EHOSTUNREACH':
      userMessage += 'Network is unreachable. Please check your internet connection.';
      break;
    case 'ECONNRESET':
      userMessage += 'Connection was reset. Please try again.';
      break;
    default:
      userMessage += 'Please check your internet connection and try again.';
  }

  return {
    handled: true,
    userMessage,
    technicalDetails: `${errorCode}: ${errorMessage}`,
    retryable: isRetryable,
    context
  };
}

/**
 * Handle BrowserView creation failure
 * @param {Error} error - Creation error
 * @param {string} accountId - Account ID
 * @returns {{handled: boolean, userMessage: string, technicalDetails: string, suggestedAction: string}}
 */
function handleViewCreationFailure(error, accountId) {
  const errorMessage = error.message || 'Unknown error';

  let userMessage = `Failed to create view for account ${accountId}. `;
  let suggestedAction = 'Please try again.';

  // Categorize error types
  if (errorMessage.includes('session') || errorMessage.includes('Session')) {
    userMessage += 'There was a problem with the account session.';
    suggestedAction = 'Try clearing the account session data and logging in again.';
  } else if (errorMessage.includes('memory') || errorMessage.includes('Memory')) {
    userMessage += 'Insufficient memory to create the view.';
    suggestedAction = 'Close some accounts or restart the application.';
  } else if (errorMessage.includes('destroyed')) {
    userMessage += 'The view was destroyed unexpectedly.';
    suggestedAction = 'Restart the application.';
  } else {
    userMessage += 'An unexpected error occurred.';
  }

  return {
    handled: true,
    userMessage,
    technicalDetails: errorMessage,
    suggestedAction
  };
}

/**
 * Validate operation safety
 * @param {string} operation - Operation name
 * @param {Object} state - Current state
 * @returns {{safe: boolean, warnings: string[], blockers: string[]}}
 */
function validateOperationSafety(operation, state = {}) {
  const warnings = [];
  const blockers = [];

  switch (operation) {
    case 'delete-account':
      if (state.isActive) {
        warnings.push('This is the currently active account');
      }
      if (state.hasUnsavedData) {
        warnings.push('Account may have unsaved data');
      }
      break;

    case 'switch-account':
      if (state.accountExists === false) {
        blockers.push('Target account does not exist');
      }
      if (state.viewCount >= 10) {
        warnings.push('Many accounts are open, performance may be affected');
      }
      break;

    case 'create-view':
      if (state.viewCount >= 20) {
        warnings.push('Maximum recommended account limit reached');
      }
      if (state.lowMemory) {
        warnings.push('System memory is low');
      }
      break;

    case 'clear-session':
      if (state.isLoggedIn) {
        warnings.push('This will log out the account');
      }
      break;

    default:
      break;
  }

  return {
    safe: blockers.length === 0,
    warnings,
    blockers
  };
}

module.exports = {
  validateAccountConfig,
  
  validateTranslationConfig,
  checkDuplicateAccountName,
  validateAccountId,
  validateNetworkConnectivity,
  sanitizeAccountName,
  sanitizeAccountNote,
  validateViewCreationParams,
  validateAccountSwitch,
  handleNetworkFailure,
  handleViewCreationFailure,
  validateOperationSafety
};
