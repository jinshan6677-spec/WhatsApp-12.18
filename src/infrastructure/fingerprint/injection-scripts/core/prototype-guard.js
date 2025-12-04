/**
 * Prototype Guard
 * 原型链保护
 * 
 * Provides protection against prototype chain traversal detection techniques.
 * This module ensures that wrapped/spoofed functions and properties maintain
 * consistent behavior when detection scripts traverse the prototype chain.
 * 
 * Key features:
 * 1. Prototype chain traversal protection
 * 2. Property descriptor consistency
 * 3. Object.getOwnPropertyNames/getOwnPropertyDescriptor protection
 * 4. Proxy-based prototype interception
 * 
 * @module infrastructure/fingerprint/injection-scripts/core/prototype-guard
 * 
 * **Validates: Requirements 28.7**
 */

'use strict';

/**
 * Error class for prototype guard operations
 */
class PrototypeGuardError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'PrototypeGuardError';
    this.code = code;
    this.details = details;
  }
}

/**
 * PrototypeGuard class
 * Provides methods to protect prototype chains from detection
 */
class PrototypeGuard {
  /**
   * Store for protected prototypes
   * @private
   */
  static _protectedPrototypes = new WeakMap();

  /**
   * Store for hidden properties
   * @private
   */
  static _hiddenProperties = new WeakMap();

  /**
   * Store for descriptor overrides
   * @private
   */
  static _descriptorOverrides = new WeakMap();

  /**
   * Native function descriptor template
   * Used to ensure wrapped functions have consistent descriptors
   * @private
   */
  static _nativeFunctionDescriptor = {
    writable: true,
    enumerable: false,
    configurable: true
  };

  /**
   * Native property descriptor template for name/length
   * @private
   */
  static _nativeNameLengthDescriptor = {
    writable: false,
    enumerable: false,
    configurable: true
  };

  /**
   * Protect a prototype from detection by ensuring all property descriptors
   * match native behavior during prototype chain traversal.
   * 
   * @param {Object} proto - The prototype object to protect
   * @param {Object} options - Configuration options
   * @param {string[]} [options.protectedMethods] - List of method names to protect
   * @param {string[]} [options.hiddenProperties] - Properties to hide from enumeration
   * @returns {Object} The protected prototype
   * @throws {PrototypeGuardError} If proto is not an object
   * 
   * Requirement 28.7: Ensure property descriptors match native during prototype chain traversal
   */
  static protectPrototype(proto, options = {}) {
    if (proto === null || typeof proto !== 'object') {
      throw new PrototypeGuardError(
        'proto must be an object',
        'INVALID_PROTOTYPE',
        { type: typeof proto }
      );
    }

    const {
      protectedMethods = [],
      hiddenProperties = []
    } = options;

    // Store protection metadata
    PrototypeGuard._protectedPrototypes.set(proto, {
      protectedMethods,
      hiddenProperties,
      protectedAt: Date.now()
    });

    // Store hidden properties
    if (hiddenProperties.length > 0) {
      PrototypeGuard._hiddenProperties.set(proto, new Set(hiddenProperties));
    }

    // Ensure all protected methods have correct descriptors
    for (const methodName of protectedMethods) {
      PrototypeGuard.ensureNativeDescriptor(proto, methodName);
    }

    return proto;
  }

  /**
   * Ensure a property has native-like descriptor attributes
   * 
   * @param {Object} obj - The object containing the property
   * @param {string} propertyName - The name of the property
   * @param {Object} [overrides] - Optional descriptor overrides
   * @throws {PrototypeGuardError} If obj is not an object
   * 
   * Requirement 28.7: Ensure property descriptors match native
   */
  static ensureNativeDescriptor(obj, propertyName, overrides = {}) {
    if (obj === null || typeof obj !== 'object') {
      throw new PrototypeGuardError(
        'obj must be an object',
        'INVALID_OBJECT',
        { type: typeof obj }
      );
    }

    const currentDescriptor = Object.getOwnPropertyDescriptor(obj, propertyName);
    if (!currentDescriptor) {
      return; // Property doesn't exist, nothing to protect
    }

    // Determine the appropriate descriptor based on property type
    let targetDescriptor;
    
    if (typeof currentDescriptor.value === 'function') {
      // Function property - use native function descriptor
      targetDescriptor = {
        ...PrototypeGuard._nativeFunctionDescriptor,
        value: currentDescriptor.value,
        ...overrides
      };
    } else if (currentDescriptor.get || currentDescriptor.set) {
      // Accessor property - preserve get/set
      targetDescriptor = {
        enumerable: false,
        configurable: true,
        get: currentDescriptor.get,
        set: currentDescriptor.set,
        ...overrides
      };
    } else {
      // Data property
      targetDescriptor = {
        writable: currentDescriptor.writable !== undefined ? currentDescriptor.writable : true,
        enumerable: false,
        configurable: true,
        value: currentDescriptor.value,
        ...overrides
      };
    }

    try {
      Object.defineProperty(obj, propertyName, targetDescriptor);
    } catch (e) {
      // Property may not be configurable
      throw new PrototypeGuardError(
        `Failed to set descriptor for ${propertyName}`,
        'DESCRIPTOR_SET_FAILED',
        { propertyName, error: e.message }
      );
    }
  }

  /**
   * Protect function properties (name, length) to match native characteristics
   * 
   * @param {Function} fn - The function to protect
   * @param {string} expectedName - The expected function name
   * @param {number} expectedLength - The expected function length
   * @throws {PrototypeGuardError} If fn is not a function
   * 
   * Requirement 28.7, 28.8: Ensure name, length properties match native function
   */
  static protectFunctionProperties(fn, expectedName, expectedLength) {
    if (typeof fn !== 'function') {
      throw new PrototypeGuardError(
        'fn must be a function',
        'INVALID_FUNCTION',
        { type: typeof fn }
      );
    }

    // Protect 'name' property
    try {
      Object.defineProperty(fn, 'name', {
        value: expectedName,
        ...PrototypeGuard._nativeNameLengthDescriptor
      });
    } catch (e) {
      // Ignore if not configurable
    }

    // Protect 'length' property
    try {
      Object.defineProperty(fn, 'length', {
        value: expectedLength,
        ...PrototypeGuard._nativeNameLengthDescriptor
      });
    } catch (e) {
      // Ignore if not configurable
    }
  }

  /**
   * Create a proxy that intercepts prototype chain traversal operations
   * This provides deep protection against detection scripts
   * 
   * @param {Object} target - The target object to proxy
   * @param {Object} options - Configuration options
   * @param {string[]} [options.hiddenProperties] - Properties to hide
   * @param {Object} [options.descriptorOverrides] - Custom descriptor overrides
   * @returns {Proxy} A proxy that protects the prototype chain
   * 
   * Requirement 28.7: Ensure property descriptors match native during prototype chain traversal
   */
  static createPrototypeProxy(target, options = {}) {
    if (target === null || typeof target !== 'object') {
      throw new PrototypeGuardError(
        'target must be an object',
        'INVALID_TARGET',
        { type: typeof target }
      );
    }

    const {
      hiddenProperties = [],
      descriptorOverrides = {}
    } = options;

    const hiddenSet = new Set(hiddenProperties);

    // Store descriptor overrides
    PrototypeGuard._descriptorOverrides.set(target, descriptorOverrides);

    return new Proxy(target, {
      /**
       * Intercept getOwnPropertyDescriptor to return native-like descriptors
       */
      getOwnPropertyDescriptor(target, prop) {
        // Hide specified properties
        if (hiddenSet.has(prop)) {
          return undefined;
        }

        const descriptor = Object.getOwnPropertyDescriptor(target, prop);
        if (!descriptor) {
          return undefined;
        }

        // Apply overrides if specified
        if (descriptorOverrides[prop]) {
          return { ...descriptor, ...descriptorOverrides[prop] };
        }

        // Ensure function descriptors look native
        if (typeof descriptor.value === 'function') {
          return {
            ...descriptor,
            writable: true,
            enumerable: false,
            configurable: true
          };
        }

        return descriptor;
      },

      /**
       * Intercept ownKeys to filter out hidden properties
       */
      ownKeys(target) {
        const keys = Reflect.ownKeys(target);
        return keys.filter(key => !hiddenSet.has(key));
      },

      /**
       * Intercept getOwnPropertyNames (via ownKeys)
       */
      has(target, prop) {
        if (hiddenSet.has(prop)) {
          return false;
        }
        return Reflect.has(target, prop);
      },

      /**
       * Intercept property access
       */
      get(target, prop, receiver) {
        // Special handling for internal properties
        if (prop === '__proto__') {
          return Object.getPrototypeOf(target);
        }
        return Reflect.get(target, prop, receiver);
      }
    });
  }

  /**
   * Verify that a prototype chain is properly protected
   * 
   * @param {Object} obj - The object to verify
   * @param {Object} options - Verification options
   * @param {string[]} [options.expectedMethods] - Methods that should exist
   * @param {string[]} [options.hiddenProperties] - Properties that should be hidden
   * @returns {Object} Verification result
   */
  static verifyProtection(obj, options = {}) {
    const {
      expectedMethods = [],
      hiddenProperties = []
    } = options;

    const result = {
      valid: true,
      checks: {}
    };

    // Check that expected methods exist and have correct descriptors
    for (const methodName of expectedMethods) {
      const descriptor = Object.getOwnPropertyDescriptor(obj, methodName);
      
      result.checks[`method_${methodName}`] = {
        exists: !!descriptor,
        hasCorrectDescriptor: descriptor ? (
          descriptor.enumerable === false &&
          descriptor.configurable === true
        ) : false
      };

      if (!descriptor || descriptor.enumerable !== false) {
        result.valid = false;
      }
    }

    // Check that hidden properties are not visible
    for (const propName of hiddenProperties) {
      const isHidden = !Object.getOwnPropertyNames(obj).includes(propName);
      result.checks[`hidden_${propName}`] = { isHidden };
      
      if (!isHidden) {
        result.valid = false;
      }
    }

    // Check prototype chain integrity
    result.checks.prototypeChain = {
      hasValidPrototype: Object.getPrototypeOf(obj) !== null || obj === Object.prototype
    };

    return result;
  }

  /**
   * Protect Object.getOwnPropertyDescriptor from revealing wrapped function internals
   * This intercepts calls to getOwnPropertyDescriptor and returns native-like descriptors
   * 
   * @param {Object} scope - The scope object (usually window or global)
   * @param {Map} wrappedFunctions - Map of wrapped functions to their metadata
   * 
   * Requirement 28.7: Ensure property descriptors match native during prototype chain traversal
   */
  static protectGetOwnPropertyDescriptor(scope, wrappedFunctions = new Map()) {
    const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

    Object.getOwnPropertyDescriptor = function(obj, prop) {
      const descriptor = originalGetOwnPropertyDescriptor.call(Object, obj, prop);
      
      if (!descriptor) {
        return descriptor;
      }

      // If this is a wrapped function, ensure descriptor looks native
      if (typeof descriptor.value === 'function' && wrappedFunctions.has(descriptor.value)) {
        return {
          ...descriptor,
          writable: true,
          enumerable: false,
          configurable: true
        };
      }

      return descriptor;
    };

    // Make the replacement look native
    Object.defineProperty(Object.getOwnPropertyDescriptor, 'name', {
      value: 'getOwnPropertyDescriptor',
      writable: false,
      enumerable: false,
      configurable: true
    });

    Object.defineProperty(Object.getOwnPropertyDescriptor, 'length', {
      value: 2,
      writable: false,
      enumerable: false,
      configurable: true
    });

    // Store original for potential restoration
    Object.getOwnPropertyDescriptor.__original__ = originalGetOwnPropertyDescriptor;

    return originalGetOwnPropertyDescriptor;
  }

  /**
   * Protect Object.getOwnPropertyNames from revealing internal properties
   * 
   * @param {Object} scope - The scope object
   * @param {Set} hiddenPropertyNames - Set of property names to hide
   * 
   * Requirement 28.7: Ensure property descriptors match native during prototype chain traversal
   */
  static protectGetOwnPropertyNames(scope, hiddenPropertyNames = new Set()) {
    const originalGetOwnPropertyNames = Object.getOwnPropertyNames;

    Object.getOwnPropertyNames = function(obj) {
      const names = originalGetOwnPropertyNames.call(Object, obj);
      return names.filter(name => !hiddenPropertyNames.has(name));
    };

    // Make the replacement look native
    Object.defineProperty(Object.getOwnPropertyNames, 'name', {
      value: 'getOwnPropertyNames',
      writable: false,
      enumerable: false,
      configurable: true
    });

    Object.defineProperty(Object.getOwnPropertyNames, 'length', {
      value: 1,
      writable: false,
      enumerable: false,
      configurable: true
    });

    Object.getOwnPropertyNames.__original__ = originalGetOwnPropertyNames;

    return originalGetOwnPropertyNames;
  }

  /**
   * Protect Object.keys from revealing internal properties
   * 
   * @param {Object} scope - The scope object
   * @param {Set} hiddenPropertyNames - Set of property names to hide
   */
  static protectObjectKeys(scope, hiddenPropertyNames = new Set()) {
    const originalKeys = Object.keys;

    Object.keys = function(obj) {
      const keys = originalKeys.call(Object, obj);
      return keys.filter(key => !hiddenPropertyNames.has(key));
    };

    // Make the replacement look native
    Object.defineProperty(Object.keys, 'name', {
      value: 'keys',
      writable: false,
      enumerable: false,
      configurable: true
    });

    Object.defineProperty(Object.keys, 'length', {
      value: 1,
      writable: false,
      enumerable: false,
      configurable: true
    });

    Object.keys.__original__ = originalKeys;

    return originalKeys;
  }

  /**
   * Check if a prototype is protected
   * 
   * @param {Object} proto - The prototype to check
   * @returns {boolean} True if the prototype is protected
   */
  static isProtected(proto) {
    return PrototypeGuard._protectedPrototypes.has(proto);
  }

  /**
   * Get protection metadata for a prototype
   * 
   * @param {Object} proto - The prototype to get metadata for
   * @returns {Object|null} Protection metadata or null if not protected
   */
  static getProtectionMetadata(proto) {
    return PrototypeGuard._protectedPrototypes.get(proto) || null;
  }

  /**
   * Traverse the prototype chain and apply protection to all levels
   * 
   * @param {Object} obj - The object whose prototype chain to protect
   * @param {Object} options - Protection options
   * @param {number} [options.maxDepth=10] - Maximum depth to traverse
   * @param {Function} [options.filter] - Filter function to determine which prototypes to protect
   * @returns {number} Number of prototypes protected
   */
  static protectPrototypeChain(obj, options = {}) {
    const {
      maxDepth = 10,
      filter = () => true
    } = options;

    let current = obj;
    let depth = 0;
    let protectedCount = 0;

    while (current !== null && depth < maxDepth) {
      const proto = Object.getPrototypeOf(current);
      
      if (proto !== null && filter(proto, depth)) {
        if (!PrototypeGuard.isProtected(proto)) {
          PrototypeGuard.protectPrototype(proto, options);
          protectedCount++;
        }
      }

      current = proto;
      depth++;
    }

    return protectedCount;
  }

  /**
   * Freeze descriptor attributes to prevent modification
   * This provides additional protection against detection scripts that try to
   * modify descriptors to reveal wrapped functions
   * 
   * @param {Object} obj - The object to freeze descriptors on
   * @param {string[]} propertyNames - Names of properties to freeze
   */
  static freezeDescriptors(obj, propertyNames) {
    for (const propName of propertyNames) {
      const descriptor = Object.getOwnPropertyDescriptor(obj, propName);
      if (descriptor && descriptor.configurable) {
        // Make the property non-configurable to prevent descriptor changes
        Object.defineProperty(obj, propName, {
          ...descriptor,
          configurable: false
        });
      }
    }
  }

  /**
   * Create a native-like toString for Object methods
   * 
   * @param {string} methodName - The method name
   * @returns {Function} A toString function that returns native code string
   */
  static createNativeToString(methodName) {
    const nativeString = `function ${methodName}() { [native code] }`;
    const toString = function() {
      return nativeString;
    };

    Object.defineProperty(toString, 'name', {
      value: 'toString',
      writable: false,
      enumerable: false,
      configurable: true
    });

    return toString;
  }
}

module.exports = {
  PrototypeGuard,
  PrototypeGuardError
};
