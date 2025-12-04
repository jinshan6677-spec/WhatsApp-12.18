/**
 * EventSchema - Schema definition and validation for typed events
 * 
 * Provides a simple schema validation system for event payloads.
 * 
 * @module core/eventbus/EventSchema
 */

'use strict';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - Array of error messages
 */

/**
 * @typedef {Object} PropertySchema
 * @property {string} type - Expected type ('string', 'number', 'boolean', 'object', 'array', 'any')
 * @property {boolean} [required] - Whether the property is required
 * @property {PropertySchema} [items] - Schema for array items
 * @property {Object<string, PropertySchema>} [properties] - Schema for object properties
 * @property {Function} [validate] - Custom validation function
 * @property {*} [enum] - Array of allowed values
 * @property {number} [min] - Minimum value for numbers or minimum length for strings/arrays
 * @property {number} [max] - Maximum value for numbers or maximum length for strings/arrays
 */

/**
 * EventSchema class for defining and validating event payloads
 */
class EventSchema {
  /**
   * Creates a new EventSchema
   * @param {Object} definition - Schema definition
   * @param {string} [definition.type] - Root type
   * @param {Object<string, PropertySchema>} [definition.properties] - Property schemas
   * @param {string[]} [definition.required] - Required property names
   */
  constructor(definition = {}) {
    this._definition = definition;
  }

  /**
   * Validates a payload against this schema
   * @param {*} payload - Payload to validate
   * @returns {ValidationResult} Validation result
   */
  validate(payload) {
    const errors = [];
    this._validateValue(payload, this._definition, '', errors);
    return {
      valid: errors.length === 0,
      errors
    };
  }


  /**
   * Internal validation method
   * @private
   */
  _validateValue(value, schema, path, errors) {
    if (!schema) {
      return;
    }

    const pathPrefix = path ? `${path}: ` : '';

    // Handle null/undefined
    if (value === null || value === undefined) {
      if (schema.required !== false && schema.type !== 'any') {
        errors.push(`${pathPrefix}Value is required`);
      }
      return;
    }

    // Type validation
    if (schema.type && schema.type !== 'any') {
      const actualType = this._getType(value);
      if (actualType !== schema.type) {
        errors.push(`${pathPrefix}Expected type "${schema.type}" but got "${actualType}"`);
        return;
      }
    }

    // Enum validation
    if (schema.enum && Array.isArray(schema.enum)) {
      if (!schema.enum.includes(value)) {
        errors.push(`${pathPrefix}Value must be one of: ${schema.enum.join(', ')}`);
      }
    }

    // Min/Max validation for numbers
    if (schema.type === 'number') {
      if (typeof schema.min === 'number' && value < schema.min) {
        errors.push(`${pathPrefix}Value must be at least ${schema.min}`);
      }
      if (typeof schema.max === 'number' && value > schema.max) {
        errors.push(`${pathPrefix}Value must be at most ${schema.max}`);
      }
    }

    // Min/Max validation for strings
    if (schema.type === 'string') {
      if (typeof schema.min === 'number' && value.length < schema.min) {
        errors.push(`${pathPrefix}String length must be at least ${schema.min}`);
      }
      if (typeof schema.max === 'number' && value.length > schema.max) {
        errors.push(`${pathPrefix}String length must be at most ${schema.max}`);
      }
    }

    // Array validation
    if (schema.type === 'array' && Array.isArray(value)) {
      if (typeof schema.min === 'number' && value.length < schema.min) {
        errors.push(`${pathPrefix}Array length must be at least ${schema.min}`);
      }
      if (typeof schema.max === 'number' && value.length > schema.max) {
        errors.push(`${pathPrefix}Array length must be at most ${schema.max}`);
      }
      if (schema.items) {
        value.forEach((item, index) => {
          this._validateValue(item, schema.items, `${path}[${index}]`, errors);
        });
      }
    }

    // Object property validation
    if (schema.type === 'object' && schema.properties && typeof value === 'object') {
      // Check required properties
      if (schema.required && Array.isArray(schema.required)) {
        for (const requiredProp of schema.required) {
          if (!(requiredProp in value)) {
            errors.push(`${pathPrefix}Missing required property "${requiredProp}"`);
          }
        }
      }

      // Validate each property
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const propPath = path ? `${path}.${propName}` : propName;
        if (propName in value) {
          this._validateValue(value[propName], propSchema, propPath, errors);
        } else if (propSchema.required) {
          errors.push(`${propPath}: Property is required`);
        }
      }
    }

    // Custom validation function
    if (typeof schema.validate === 'function') {
      const customResult = schema.validate(value);
      if (customResult !== true) {
        const message = typeof customResult === 'string' ? customResult : 'Custom validation failed';
        errors.push(`${pathPrefix}${message}`);
      }
    }
  }


  /**
   * Gets the type of a value
   * @private
   */
  _getType(value) {
    if (Array.isArray(value)) {
      return 'array';
    }
    if (value === null) {
      return 'null';
    }
    return typeof value;
  }

  /**
   * Gets the schema definition
   * @returns {Object} Schema definition
   */
  getDefinition() {
    return { ...this._definition };
  }

  /**
   * Creates a schema for a simple type
   * @param {string} type - Type name
   * @param {Object} [options] - Additional options
   * @returns {EventSchema} New schema
   */
  static type(type, options = {}) {
    return new EventSchema({ type, ...options });
  }

  /**
   * Creates a schema for an object with properties
   * @param {Object<string, PropertySchema>} properties - Property schemas
   * @param {string[]} [required] - Required property names
   * @returns {EventSchema} New schema
   */
  static object(properties, required = []) {
    return new EventSchema({
      type: 'object',
      properties,
      required
    });
  }

  /**
   * Creates a schema for an array
   * @param {PropertySchema} items - Schema for array items
   * @param {Object} [options] - Additional options (min, max)
   * @returns {EventSchema} New schema
   */
  static array(items, options = {}) {
    return new EventSchema({
      type: 'array',
      items,
      ...options
    });
  }

  /**
   * Creates a schema that accepts any value
   * @returns {EventSchema} New schema
   */
  static any() {
    return new EventSchema({ type: 'any' });
  }

  /**
   * Creates a schema with enum values
   * @param {Array} values - Allowed values
   * @returns {EventSchema} New schema
   */
  static enum(values) {
    return new EventSchema({ enum: values });
  }
}

module.exports = { EventSchema };
