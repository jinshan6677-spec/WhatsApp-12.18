'use strict';

const crypto = require('crypto');
const FingerprintConfig = require('./FingerprintConfig');

/**
 * Generate a UUID v4
 * @returns {string}
 */
function uuidv4() {
  return crypto.randomUUID();
}

/**
 * FingerprintTemplate Domain Entity
 * 
 * Represents a reusable fingerprint template that can be applied to multiple accounts.
 * Templates contain complete fingerprint configurations with metadata for management.
 * 
 * Requirements: 21.1, 21.6
 * - 21.1: When user creates template, system saves complete fingerprint config with user-defined name
 * - 21.6: When listing templates, system displays template name, creation date, and key settings summary
 */
class FingerprintTemplate {
  /**
   * Creates a FingerprintTemplate instance
   * @param {Object} options - Template options
   * @param {string} [options.id] - Unique template identifier
   * @param {string} options.name - User-defined template name
   * @param {string} [options.description] - Template description
   * @param {Date|string} [options.createdAt] - Creation timestamp
   * @param {Date|string} [options.updatedAt] - Last update timestamp
   * @param {string} [options.version] - Template version
   * @param {Object|FingerprintConfig} [options.config] - Fingerprint configuration
   * @param {Object} [options.tags] - Optional tags for categorization
   */
  constructor(options = {}) {
    // Metadata
    this.id = options.id || uuidv4();
    this.name = options.name || 'Unnamed Template';
    this.description = options.description || '';
    this.createdAt = options.createdAt ? new Date(options.createdAt) : new Date();
    this.updatedAt = options.updatedAt ? new Date(options.updatedAt) : new Date();
    this.version = options.version || '1.0.0';
    
    // Optional tags for categorization
    this.tags = Array.isArray(options.tags) ? [...options.tags] : [];
    
    // Fingerprint configuration
    // If config is already a FingerprintConfig instance, clone it
    // Otherwise, create a new FingerprintConfig from the provided object
    if (options.config instanceof FingerprintConfig) {
      this.config = options.config.clone();
      // Clear account-specific data from template
      this.config.accountId = null;
    } else if (options.config && typeof options.config === 'object') {
      this.config = new FingerprintConfig({
        ...options.config,
        accountId: null // Templates should not have account IDs
      });
    } else {
      this.config = new FingerprintConfig({ accountId: null });
    }
  }

  // ==================== Validation ====================

  /**
   * Validates the template
   * @returns {{valid: boolean, errors: Array<{field: string, reason: string, value: any}>}}
   */
  validate() {
    const errors = [];

    // Validate ID
    if (!this.id || typeof this.id !== 'string' || this.id.trim().length === 0) {
      errors.push({ 
        field: 'id', 
        reason: 'Template ID is required and must be a non-empty string', 
        value: this.id 
      });
    }

    // Validate name
    if (!this.name || typeof this.name !== 'string' || this.name.trim().length === 0) {
      errors.push({ 
        field: 'name', 
        reason: 'Template name is required and must be a non-empty string', 
        value: this.name 
      });
    }

    // Validate name length
    if (this.name && this.name.length > 100) {
      errors.push({ 
        field: 'name', 
        reason: 'Template name must not exceed 100 characters', 
        value: this.name 
      });
    }

    // Validate description length
    if (this.description && this.description.length > 500) {
      errors.push({ 
        field: 'description', 
        reason: 'Template description must not exceed 500 characters', 
        value: this.description 
      });
    }

    // Validate version
    if (!this.version || typeof this.version !== 'string') {
      errors.push({ 
        field: 'version', 
        reason: 'Version is required and must be a string', 
        value: this.version 
      });
    }

    // Validate createdAt
    if (!(this.createdAt instanceof Date) || isNaN(this.createdAt.getTime())) {
      errors.push({ 
        field: 'createdAt', 
        reason: 'createdAt must be a valid Date', 
        value: this.createdAt 
      });
    }

    // Validate updatedAt
    if (!(this.updatedAt instanceof Date) || isNaN(this.updatedAt.getTime())) {
      errors.push({ 
        field: 'updatedAt', 
        reason: 'updatedAt must be a valid Date', 
        value: this.updatedAt 
      });
    }

    // Validate tags
    if (!Array.isArray(this.tags)) {
      errors.push({ 
        field: 'tags', 
        reason: 'Tags must be an array', 
        value: this.tags 
      });
    } else {
      for (let i = 0; i < this.tags.length; i++) {
        if (typeof this.tags[i] !== 'string') {
          errors.push({ 
            field: `tags[${i}]`, 
            reason: 'Each tag must be a string', 
            value: this.tags[i] 
          });
        }
      }
    }

    // Validate config
    if (!this.config || !(this.config instanceof FingerprintConfig)) {
      errors.push({ 
        field: 'config', 
        reason: 'Config must be a valid FingerprintConfig instance', 
        value: this.config 
      });
    } else {
      // Validate the embedded config
      const configValidation = this.config.validate();
      if (!configValidation.valid) {
        for (const error of configValidation.errors) {
          errors.push({
            field: `config.${error.field}`,
            reason: error.reason,
            value: error.value
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ==================== Serialization ====================

  /**
   * Converts the template to a JSON-serializable object
   * @param {Object} [options] - Serialization options
   * @param {boolean} [options.includeNoiseSeed=true] - Whether to include noise seed in export
   * @returns {Object}
   */
  toJSON(options = {}) {
    const { includeNoiseSeed = true } = options;
    
    const configJson = this.config.toJSON();
    
    // Optionally exclude noise seed for security (Req 51.3)
    if (!includeNoiseSeed) {
      delete configJson.noiseSeed;
      delete configJson.seedVersion;
      delete configJson.seedRotatedAt;
    }
    
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : this.createdAt,
      updatedAt: this.updatedAt instanceof Date ? this.updatedAt.toISOString() : this.updatedAt,
      version: this.version,
      tags: [...this.tags],
      config: configJson
    };
  }

  /**
   * Creates a FingerprintTemplate instance from a JSON object
   * @param {Object} json - JSON representation
   * @returns {FingerprintTemplate}
   * @throws {Error} If JSON is invalid
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON: expected an object');
    }
    
    return new FingerprintTemplate({
      id: json.id,
      name: json.name,
      description: json.description,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
      version: json.version,
      tags: json.tags,
      config: json.config
    });
  }

  /**
   * Creates a deep clone of this template
   * @returns {FingerprintTemplate}
   */
  clone() {
    return FingerprintTemplate.fromJSON(this.toJSON());
  }

  // ==================== Template Operations ====================

  /**
   * Updates the template metadata
   * @param {Object} updates - Partial metadata updates
   */
  updateMetadata(updates) {
    if (updates.name !== undefined) {
      this.name = updates.name;
    }
    if (updates.description !== undefined) {
      this.description = updates.description;
    }
    if (updates.tags !== undefined) {
      this.tags = Array.isArray(updates.tags) ? [...updates.tags] : [];
    }
    this.updatedAt = new Date();
  }

  /**
   * Updates the fingerprint configuration
   * @param {Object} configUpdates - Partial configuration updates
   */
  updateConfig(configUpdates) {
    this.config.update(configUpdates);
    this.updatedAt = new Date();
  }

  /**
   * Creates a new FingerprintConfig from this template for a specific account
   * @param {string} accountId - The account ID to assign
   * @returns {FingerprintConfig}
   */
  createConfigForAccount(accountId) {
    const config = this.config.clone();
    config.accountId = accountId;
    config.id = uuidv4(); // Generate new ID for the account's config
    config.createdAt = new Date();
    config.updatedAt = new Date();
    return config;
  }

  /**
   * Gets a summary of key settings for display (Req 21.6)
   * @returns {Object}
   */
  getSummary() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      createdAt: this.createdAt,
      tags: [...this.tags],
      keySettings: {
        browser: `${this.config.browser.type} ${this.config.browser.version}`,
        os: `${this.config.os.type} ${this.config.os.version}`,
        platform: this.config.os.platform,
        screen: `${this.config.hardware.screen.width}x${this.config.hardware.screen.height}`,
        language: this.config.language.primary,
        timezone: this.config.timezone.name,
        canvasMode: this.config.canvas.mode,
        webglMode: this.config.webgl.mode,
        webrtcMode: this.config.webrtc.mode
      }
    };
  }

  /**
   * Checks if two templates are equal
   * @param {FingerprintTemplate} other - Other template to compare
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof FingerprintTemplate)) {
      return false;
    }
    return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON());
  }

  /**
   * Returns a human-readable string representation for debugging
   * @param {FingerprintTemplate} template - FingerprintTemplate instance
   * @returns {string}
   */
  static prettyPrint(template) {
    const summary = template.getSummary();
    const lines = [
      '┌─────────────────────────────────────────────────────────────┐',
      '│                   FINGERPRINT TEMPLATE                     │',
      '├─────────────────────────────────────────────────────────────┤',
      `│ ID:           ${(template.id || 'N/A').substring(0, 44).padEnd(44)} │`,
      `│ Name:         ${(template.name || 'N/A').substring(0, 44).padEnd(44)} │`,
      `│ Description:  ${(template.description || 'N/A').substring(0, 44).padEnd(44)} │`,
      `│ Version:      ${(template.version || 'N/A').padEnd(44)} │`,
      `│ Tags:         ${(template.tags.join(', ') || 'None').substring(0, 44).padEnd(44)} │`,
      '├─────────────────────────────────────────────────────────────┤',
      '│ Key Settings:                                              │',
      `│   Browser:    ${summary.keySettings.browser.substring(0, 44).padEnd(44)} │`,
      `│   OS:         ${summary.keySettings.os.substring(0, 44).padEnd(44)} │`,
      `│   Platform:   ${summary.keySettings.platform.padEnd(44)} │`,
      `│   Screen:     ${summary.keySettings.screen.padEnd(44)} │`,
      `│   Language:   ${summary.keySettings.language.padEnd(44)} │`,
      `│   Timezone:   ${summary.keySettings.timezone.substring(0, 44).padEnd(44)} │`,
      `│   Canvas:     ${summary.keySettings.canvasMode.padEnd(44)} │`,
      `│   WebGL:      ${summary.keySettings.webglMode.padEnd(44)} │`,
      `│   WebRTC:     ${summary.keySettings.webrtcMode.padEnd(44)} │`,
      '├─────────────────────────────────────────────────────────────┤',
      `│ Created:      ${(template.createdAt instanceof Date ? template.createdAt.toISOString() : String(template.createdAt)).substring(0, 44).padEnd(44)} │`,
      `│ Updated:      ${(template.updatedAt instanceof Date ? template.updatedAt.toISOString() : String(template.updatedAt)).substring(0, 44).padEnd(44)} │`,
      '└─────────────────────────────────────────────────────────────┘'
    ];
    return lines.join('\n');
  }

  // ==================== Static Factory Methods ====================

  /**
   * Creates a template from an existing FingerprintConfig
   * @param {FingerprintConfig} config - Source configuration
   * @param {string} name - Template name
   * @param {string} [description] - Template description
   * @returns {FingerprintTemplate}
   */
  static fromConfig(config, name, description = '') {
    if (!(config instanceof FingerprintConfig)) {
      throw new Error('Config must be a FingerprintConfig instance');
    }
    
    return new FingerprintTemplate({
      name,
      description,
      config: config.clone()
    });
  }

  /**
   * Creates a default template with standard settings
   * @param {string} name - Template name
   * @returns {FingerprintTemplate}
   */
  static createDefault(name) {
    return new FingerprintTemplate({
      name,
      description: 'Default fingerprint template with standard settings',
      config: new FingerprintConfig()
    });
  }
}

module.exports = FingerprintTemplate;
