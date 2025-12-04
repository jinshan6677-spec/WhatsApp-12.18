/**
 * ConfigProvider - Centralized configuration management
 * 
 * Provides unified configuration management with schema validation,
 * environment-specific overrides, change notifications, and sensitive value encryption.
 * 
 * @module core/config/ConfigProvider
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

/**
 * @typedef {Object} PropertySchema
 * @property {string} type - Property type ('string', 'number', 'boolean', 'object', 'array')
 * @property {boolean} [required] - Whether the property is required
 * @property {*} [default] - Default value
 * @property {boolean} [sensitive] - Whether the value should be encrypted
 * @property {Object} [properties] - Nested properties for object types
 * @property {Object} [items] - Item schema for array types
 * @property {number} [minimum] - Minimum value for numbers
 * @property {number} [maximum] - Maximum value for numbers
 * @property {number} [minLength] - Minimum length for strings
 * @property {number} [maxLength] - Maximum length for strings
 * @property {string} [pattern] - Regex pattern for strings
 * @property {Array} [enum] - Allowed values
 */

/**
 * @typedef {Object} ConfigSchema
 * @property {Record<string, PropertySchema>} properties - Schema properties
 * @property {string[]} [required] - Required property names
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {Array<{field: string, message: string}>} errors - Validation errors
 */

/**
 * @typedef {Object} ConfigProviderOptions
 * @property {ConfigSchema} [schema] - Configuration schema
 * @property {string} [environment] - Current environment (development, production, test)
 * @property {string} [encryptionKey] - Custom encryption key
 */

class ConfigProvider {
  /**
   * Creates a new ConfigProvider instance
   * @param {ConfigProviderOptions} [options={}] - Configuration options
   */
  constructor(options = {}) {
    /** @type {Object} */
    this._config = {};
    /** @type {ConfigSchema|null} */
    this._schema = options.schema || null;
    /** @type {string} */
    this._environment = options.environment || process.env.NODE_ENV || 'development';
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    /** @type {Map<string, Object>} */
    this._environmentOverrides = new Map();
    /** @type {string|null} */
    this._filePath = null;
    /** @type {Buffer} */
    this._encryptionKey = options.encryptionKey 
      ? Buffer.from(options.encryptionKey, 'utf8').slice(0, 32)
      : this._generateEncryptionKey();
  }

  /**
   * Gets a configuration value by key path
   * @param {string} key - Dot-notation key path (e.g., 'database.host')
   * @param {*} [defaultValue] - Default value if key not found
   * @returns {*} Configuration value
   */
  get(key, defaultValue) {
    const value = this._getNestedValue(this._config, key);
    if (value === undefined) {
      // Check schema for default
      if (this._schema && defaultValue === undefined) {
        const schemaDefault = this._getSchemaDefault(key);
        if (schemaDefault !== undefined) {
          return schemaDefault;
        }
      }
      return defaultValue;
    }
    
    // Decrypt if sensitive
    if (this._isSensitiveKey(key) && typeof value === 'string' && this._isEncrypted(value)) {
      return this._decrypt(value);
    }
    
    return value;
  }

  /**
   * Sets a configuration value by key path
   * @param {string} key - Dot-notation key path
   * @param {*} value - Value to set
   * @throws {Error} If validation fails
   */
  set(key, value) {
    const oldValue = this.get(key);
    
    // Encrypt if sensitive
    let valueToStore = value;
    if (this._isSensitiveKey(key) && value !== null && value !== undefined) {
      valueToStore = this._encrypt(String(value));
    }
    
    // Validate against schema if present
    if (this._schema) {
      const validationResult = this._validateValue(key, value);
      if (!validationResult.valid) {
        const error = new Error(`Configuration validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
        error.code = 'VALIDATION_ERROR';
        error.validationErrors = validationResult.errors;
        throw error;
      }
    }
    
    this._setNestedValue(this._config, key, valueToStore);
    
    // Notify listeners
    this._notifyListeners(key, value, oldValue);
  }

  /**
   * Checks if a configuration key exists
   * @param {string} key - Dot-notation key path
   * @returns {boolean} True if key exists
   */
  has(key) {
    return this._getNestedValue(this._config, key) !== undefined;
  }

  /**
   * Loads configuration from a file
   * @param {string} source - File path
   * @returns {Promise<void>}
   * @throws {Error} If file cannot be read or validation fails
   */
  async load(source) {
    this._filePath = source;
    
    if (!fs.existsSync(source)) {
      // Initialize with defaults from schema
      if (this._schema) {
        this._config = this._getDefaultsFromSchema();
      }
      return;
    }
    
    const content = await fs.promises.readFile(source, 'utf8');
    const parsed = JSON.parse(content);
    
    // Apply environment overrides
    const merged = this._applyEnvironmentOverrides(parsed);
    
    // Validate against schema
    if (this._schema) {
      const validationResult = this.validateConfig(merged);
      if (!validationResult.valid) {
        const error = new Error(`Configuration validation failed: ${validationResult.errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
        error.code = 'VALIDATION_ERROR';
        error.validationErrors = validationResult.errors;
        throw error;
      }
    }
    
    this._config = merged;
  }

  /**
   * Saves configuration to file
   * @returns {Promise<void>}
   * @throws {Error} If file cannot be written
   */
  async save() {
    if (!this._filePath) {
      throw new Error('No file path set. Call load() first or set filePath.');
    }
    
    // Ensure directory exists
    const dir = path.dirname(this._filePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    
    const content = JSON.stringify(this._config, null, 2);
    await fs.promises.writeFile(this._filePath, content, 'utf8');
  }

  /**
   * Validates configuration against schema
   * @param {Object} [config] - Configuration to validate (defaults to current config)
   * @returns {ValidationResult} Validation result
   */
  validateConfig(config = this._config) {
    if (!this._schema) {
      return { valid: true, errors: [] };
    }
    
    return this._validateObject(config, this._schema, '');
  }

  /**
   * Alias for validateConfig
   * @returns {ValidationResult}
   */
  validate() {
    return this.validateConfig();
  }

  /**
   * Gets the configuration schema
   * @returns {ConfigSchema|null}
   */
  getSchema() {
    return this._schema;
  }

  /**
   * Sets the configuration schema
   * @param {ConfigSchema} schema - New schema
   */
  setSchema(schema) {
    this._schema = schema;
  }


  /**
   * Registers a listener for configuration changes
   * @param {string} key - Key path to watch (use '*' for all changes)
   * @param {Function} handler - Handler function (newValue, oldValue) => void
   * @returns {Function} Unsubscribe function
   */
  onChange(key, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    
    this._listeners.get(key).add(handler);
    
    return () => {
      const listeners = this._listeners.get(key);
      if (listeners) {
        listeners.delete(handler);
        if (listeners.size === 0) {
          this._listeners.delete(key);
        }
      }
    };
  }

  /**
   * Sets environment-specific configuration overrides
   * @param {string} environment - Environment name
   * @param {Object} overrides - Override configuration
   */
  setEnvironmentOverrides(environment, overrides) {
    this._environmentOverrides.set(environment, overrides);
  }

  /**
   * Gets the current environment
   * @returns {string}
   */
  getEnvironment() {
    return this._environment;
  }

  /**
   * Sets the current environment
   * @param {string} environment - Environment name
   */
  setEnvironment(environment) {
    this._environment = environment;
    // Re-apply overrides
    this._config = this._applyEnvironmentOverrides(this._config);
  }

  /**
   * Serializes configuration to JSON string
   * @returns {string} JSON string
   */
  serialize() {
    return JSON.stringify(this._config, null, 2);
  }

  /**
   * Deserializes configuration from JSON string
   * @param {string} data - JSON string
   * @throws {Error} If parsing or validation fails
   */
  deserialize(data) {
    const parsed = JSON.parse(data);
    
    if (this._schema) {
      const validationResult = this.validateConfig(parsed);
      if (!validationResult.valid) {
        const error = new Error(`Configuration validation failed: ${validationResult.errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
        error.code = 'VALIDATION_ERROR';
        error.validationErrors = validationResult.errors;
        throw error;
      }
    }
    
    this._config = parsed;
  }

  /**
   * Creates a pretty-printed string representation for debugging
   * @param {Object} [config] - Configuration to print (defaults to current config)
   * @returns {string} Pretty-printed configuration
   */
  prettyPrint(config = this._config) {
    const lines = [];
    this._prettyPrintObject(config, '', lines);
    return lines.join('\n');
  }

  /**
   * Gets the entire configuration object (shallow copy)
   * @returns {Object}
   */
  getAll() {
    return { ...this._config };
  }

  /**
   * Sets the entire configuration object
   * @param {Object} config - New configuration
   * @throws {Error} If validation fails
   */
  setAll(config) {
    if (this._schema) {
      const validationResult = this.validateConfig(config);
      if (!validationResult.valid) {
        const error = new Error(`Configuration validation failed: ${validationResult.errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
        error.code = 'VALIDATION_ERROR';
        error.validationErrors = validationResult.errors;
        throw error;
      }
    }
    
    const oldConfig = this._config;
    this._config = { ...config };
    
    // Notify all listeners
    this._notifyListeners('*', this._config, oldConfig);
  }

  /**
   * Clears all configuration
   */
  clear() {
    this._config = {};
    this._listeners.clear();
  }

  // Private methods

  /**
   * Gets a nested value from an object using dot notation
   * @private
   */
  _getNestedValue(obj, key) {
    if (!key) return obj;
    
    const parts = key.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  /**
   * Sets a nested value in an object using dot notation
   * @private
   */
  _setNestedValue(obj, key, value) {
    const parts = key.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  /**
   * Gets the default value from schema for a key
   * @private
   */
  _getSchemaDefault(key) {
    if (!this._schema || !this._schema.properties) {
      return undefined;
    }
    
    const parts = key.split('.');
    let schema = this._schema;
    
    for (const part of parts) {
      if (!schema.properties || !schema.properties[part]) {
        return undefined;
      }
      schema = schema.properties[part];
    }
    
    return schema.default;
  }

  /**
   * Gets all defaults from schema
   * @private
   */
  _getDefaultsFromSchema() {
    if (!this._schema || !this._schema.properties) {
      return {};
    }
    
    return this._extractDefaults(this._schema);
  }

  /**
   * Recursively extracts defaults from schema
   * @private
   */
  _extractDefaults(schema) {
    const defaults = {};
    
    if (!schema.properties) {
      return defaults;
    }
    
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (propSchema.default !== undefined) {
        defaults[key] = propSchema.default;
      } else if (propSchema.type === 'object' && propSchema.properties) {
        const nested = this._extractDefaults(propSchema);
        if (Object.keys(nested).length > 0) {
          defaults[key] = nested;
        }
      }
    }
    
    return defaults;
  }


  /**
   * Validates an object against a schema
   * @private
   */
  _validateObject(obj, schema, prefix) {
    const errors = [];
    
    if (!schema.properties) {
      return { valid: true, errors: [] };
    }
    
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (obj === null || obj === undefined || !(field in obj)) {
          errors.push({
            field: prefix ? `${prefix}.${field}` : field,
            message: `Required field '${field}' is missing`
          });
        }
      }
    }
    
    // Validate each property
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      const value = obj ? obj[key] : undefined;
      
      // Skip undefined optional fields
      if (value === undefined) {
        continue;
      }
      
      const propErrors = this._validateProperty(value, propSchema, fieldPath);
      errors.push(...propErrors);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates a single property against its schema
   * @private
   */
  _validateProperty(value, schema, fieldPath) {
    const errors = [];
    
    // Type validation
    if (schema.type) {
      const actualType = this._getType(value);
      if (actualType !== schema.type) {
        errors.push({
          field: fieldPath,
          message: `Expected type '${schema.type}' but got '${actualType}'`
        });
        return errors; // Skip further validation if type is wrong
      }
    }
    
    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        field: fieldPath,
        message: `Value must be one of: ${schema.enum.join(', ')}`
      });
    }
    
    // String validations
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({
          field: fieldPath,
          message: `String length must be at least ${schema.minLength}`
        });
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push({
          field: fieldPath,
          message: `String length must be at most ${schema.maxLength}`
        });
      }
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          errors.push({
            field: fieldPath,
            message: `String does not match pattern: ${schema.pattern}`
          });
        }
      }
    }
    
    // Number validations
    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
          field: fieldPath,
          message: `Value must be at least ${schema.minimum}`
        });
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
          field: fieldPath,
          message: `Value must be at most ${schema.maximum}`
        });
      }
    }
    
    // Object validation (nested)
    if (schema.type === 'object' && schema.properties && typeof value === 'object' && value !== null) {
      const nestedResult = this._validateObject(value, schema, fieldPath);
      errors.push(...nestedResult.errors);
    }
    
    // Array validation
    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.items) {
        value.forEach((item, index) => {
          const itemErrors = this._validateProperty(item, schema.items, `${fieldPath}[${index}]`);
          errors.push(...itemErrors);
        });
      }
    }
    
    return errors;
  }

  /**
   * Validates a single value for a key
   * @private
   */
  _validateValue(key, value) {
    if (!this._schema || !this._schema.properties) {
      return { valid: true, errors: [] };
    }
    
    const parts = key.split('.');
    let schema = this._schema;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!schema.properties || !schema.properties[part]) {
        // Key not in schema - allow it
        return { valid: true, errors: [] };
      }
      schema = schema.properties[part];
    }
    
    return {
      valid: true,
      errors: this._validateProperty(value, schema, key)
    };
  }

  /**
   * Gets the type of a value
   * @private
   */
  _getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Checks if a key is marked as sensitive in the schema
   * @private
   */
  _isSensitiveKey(key) {
    if (!this._schema || !this._schema.properties) {
      return false;
    }
    
    const parts = key.split('.');
    let schema = this._schema;
    
    for (const part of parts) {
      if (!schema.properties || !schema.properties[part]) {
        return false;
      }
      schema = schema.properties[part];
    }
    
    return schema.sensitive === true;
  }

  /**
   * Applies environment-specific overrides
   * @private
   */
  _applyEnvironmentOverrides(config) {
    const overrides = this._environmentOverrides.get(this._environment);
    if (!overrides) {
      return config;
    }
    
    return this._deepMerge(config, overrides);
  }

  /**
   * Deep merges two objects
   * @private
   */
  _deepMerge(target, source) {
    const result = { ...target };
    
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Notifies listeners of a configuration change
   * @private
   */
  _notifyListeners(key, newValue, oldValue) {
    // Notify specific key listeners
    const keyListeners = this._listeners.get(key);
    if (keyListeners) {
      for (const handler of keyListeners) {
        try {
          handler(newValue, oldValue);
        } catch (error) {
          console.error(`ConfigProvider: Listener error for key "${key}":`, error);
        }
      }
    }
    
    // Notify wildcard listeners (but not if key is already '*' to avoid double notification)
    if (key !== '*') {
      const wildcardListeners = this._listeners.get('*');
      if (wildcardListeners) {
        for (const handler of wildcardListeners) {
          try {
            handler(newValue, oldValue);
          } catch (error) {
            console.error('ConfigProvider: Wildcard listener error:', error);
          }
        }
      }
    }
    
    // Notify parent key listeners
    const parts = key.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
      const parentKey = parts.slice(0, i).join('.');
      const parentListeners = this._listeners.get(parentKey);
      if (parentListeners) {
        const parentValue = this.get(parentKey);
        for (const handler of parentListeners) {
          try {
            handler(parentValue, undefined);
          } catch (error) {
            console.error(`ConfigProvider: Parent listener error for key "${parentKey}":`, error);
          }
        }
      }
    }
  }


  /**
   * Generates an encryption key based on machine-specific information
   * @private
   */
  _generateEncryptionKey() {
    const machineId = os.hostname() + os.platform() + os.arch();
    const hash = crypto.createHash('sha256');
    hash.update(machineId);
    hash.update('config-provider-encryption-key-v1');
    return hash.digest();
  }

  /**
   * Encrypts a value
   * @private
   */
  _encrypt(value) {
    if (!value || typeof value !== 'string') {
      return value;
    }
    
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', this._encryptionKey, iv);
      
      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return `enc:${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('ConfigProvider: Encryption failed:', error);
      throw new Error('Failed to encrypt sensitive value');
    }
  }

  /**
   * Decrypts a value
   * @private
   */
  _decrypt(value) {
    if (!value || typeof value !== 'string' || !this._isEncrypted(value)) {
      return value;
    }
    
    try {
      const parts = value.split(':');
      if (parts.length !== 3 || parts[0] !== 'enc') {
        return value;
      }
      
      const iv = Buffer.from(parts[1], 'hex');
      const encryptedText = parts[2];
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', this._encryptionKey, iv);
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('ConfigProvider: Decryption failed:', error);
      return ''; // Return empty string on decryption failure
    }
  }

  /**
   * Checks if a value is encrypted
   * @private
   */
  _isEncrypted(value) {
    if (!value || typeof value !== 'string') {
      return false;
    }
    
    const parts = value.split(':');
    if (parts.length !== 3 || parts[0] !== 'enc') {
      return false;
    }
    
    // Check IV is 32 hex chars (16 bytes)
    if (parts[1].length !== 32 || !/^[0-9a-f]+$/i.test(parts[1])) {
      return false;
    }
    
    // Check encrypted data is hex
    if (!/^[0-9a-f]+$/i.test(parts[2])) {
      return false;
    }
    
    return true;
  }

  /**
   * Pretty prints an object recursively
   * @private
   */
  _prettyPrintObject(obj, indent, lines) {
    if (obj === null || obj === undefined) {
      lines.push(`${indent}(empty)`);
      return;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        lines.push(`${indent}${key}: (null)`);
      } else if (Array.isArray(value)) {
        lines.push(`${indent}${key}: [`);
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            lines.push(`${indent}  [${index}]:`);
            this._prettyPrintObject(item, indent + '    ', lines);
          } else {
            lines.push(`${indent}  [${index}]: ${this._formatValue(item, key)}`);
          }
        });
        lines.push(`${indent}]`);
      } else if (typeof value === 'object') {
        lines.push(`${indent}${key}:`);
        this._prettyPrintObject(value, indent + '  ', lines);
      } else {
        lines.push(`${indent}${key}: ${this._formatValue(value, key)}`);
      }
    }
  }

  /**
   * Formats a value for pretty printing
   * @private
   */
  _formatValue(value, key) {
    // Mask sensitive values
    if (this._isSensitiveKey(key) || 
        key.toLowerCase().includes('password') || 
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('apikey') ||
        key.toLowerCase().includes('api_key')) {
      return '********';
    }
    
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    
    return String(value);
  }
}

// Factory functions

/**
 * Creates a new ConfigProvider instance
 * @param {ConfigProviderOptions} [options] - Configuration options
 * @returns {ConfigProvider}
 */
function createConfigProvider(options) {
  return new ConfigProvider(options);
}

// Global instance
let globalConfigProvider = null;

/**
 * Gets the global ConfigProvider instance
 * @returns {ConfigProvider}
 */
function getGlobalConfigProvider() {
  if (!globalConfigProvider) {
    globalConfigProvider = new ConfigProvider();
  }
  return globalConfigProvider;
}

module.exports = {
  ConfigProvider,
  createConfigProvider,
  getGlobalConfigProvider
};
