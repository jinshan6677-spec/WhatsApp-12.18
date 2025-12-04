/**
 * Enhanced Dependency Injection Container
 * 
 * Provides unified dependency management and injection mechanism
 * Supports singleton, transient, and scoped service lifetimes
 * Includes circular dependency detection, lazy loading, and interface validation
 * 
 * @module core/container/DependencyContainer
 */

/**
 * Service scope enumeration
 */
const ServiceScope = {
  Singleton: 'singleton',
  Transient: 'transient',
  Scoped: 'scoped'
};

/**
 * Service registration information
 */
class ServiceRegistration {
  constructor(name, factory, scope, options = {}) {
    this.name = name;
    this.factory = factory;
    this.scope = scope;
    this.lazy = options.lazy || false;
    this.requiredInterface = options.requiredInterface || null;
    this.decorators = [];
    this.instance = null;
    this.initialized = false;
  }
}

/**
 * Scope class for scoped service lifetime management
 */
class Scope {
  constructor(container) {
    this._container = container;
    this._instances = new Map();
    this._disposed = false;
  }

  /**
   * Get a scoped instance
   * @param {string} name - Service name
   * @returns {*} Service instance
   */
  getInstance(name) {
    return this._instances.get(name);
  }

  /**
   * Set a scoped instance
   * @param {string} name - Service name
   * @param {*} instance - Service instance
   */
  setInstance(name, instance) {
    this._instances.set(name, instance);
  }

  /**
   * Check if scope has an instance
   * @param {string} name - Service name
   * @returns {boolean}
   */
  hasInstance(name) {
    return this._instances.has(name);
  }

  /**
   * Dispose the scope and clear all instances
   */
  dispose() {
    this._instances.clear();
    this._disposed = true;
  }

  /**
   * Check if scope is disposed
   * @returns {boolean}
   */
  isDisposed() {
    return this._disposed;
  }
}

/**
 * Enhanced Dependency Container class
 */
class DependencyContainer {
  constructor() {
    /** @type {Map<string, ServiceRegistration>} */
    this._registrations = new Map();
    /** @type {Set<string>} */
    this._resolving = new Set();
    /** @type {Map<string, *>} */
    this._singletonInstances = new Map();
    /** @type {Array<{name: string, decorator: Function}>} */
    this._decorators = new Map();
    this._logger = this._createLogger();
  }

  /**
   * Register a singleton service (same instance for all resolutions)
   * @param {string} name - Service name
   * @param {*} instance - Service instance or factory function
   * @param {Object} [options] - Registration options
   */
  registerSingleton(name, instance, options = {}) {
    const factory = typeof instance === 'function' && !options.isInstance
      ? instance
      : () => instance;
    
    const registration = new ServiceRegistration(name, factory, ServiceScope.Singleton, options);
    
    // If it's a direct instance (not a factory), mark as initialized
    if (typeof instance !== 'function' || options.isInstance) {
      registration.instance = instance;
      registration.initialized = true;
      this._singletonInstances.set(name, instance);
      // Only validate interface for direct instances, not factories
      // (factories are validated in registerWithInterface before calling this)
      if (!options.skipValidation) {
        this._validateInterfaceIfRequired(registration, instance);
      }
    }
    
    this._registrations.set(name, registration);
    this._logger.debug('Registered singleton service', { name });
  }

  /**
   * Register a transient service (new instance for each resolution)
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   * @param {Object} [options] - Registration options
   */
  registerTransient(name, factory, options = {}) {
    if (typeof factory !== 'function') {
      throw new Error(`Transient service '${name}' requires a factory function`);
    }
    
    const registration = new ServiceRegistration(name, factory, ServiceScope.Transient, options);
    // Skip validation for factories - they are validated in registerWithInterface
    this._registrations.set(name, registration);
    this._logger.debug('Registered transient service', { name });
  }

  /**
   * Register a scoped service (same instance within a scope)
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   * @param {Object} [options] - Registration options
   */
  registerScoped(name, factory, options = {}) {
    if (typeof factory !== 'function') {
      throw new Error(`Scoped service '${name}' requires a factory function`);
    }
    
    const registration = new ServiceRegistration(name, factory, ServiceScope.Scoped, options);
    // Skip validation for factories - they are validated in registerWithInterface
    this._registrations.set(name, registration);
    this._logger.debug('Registered scoped service', { name });
  }

  /**
   * Register a factory service
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   * @param {Object} [options] - Registration options
   */
  registerFactory(name, factory, options = {}) {
    this.registerTransient(name, factory, options);
  }

  /**
   * Register a lazy service (factory not called until first resolution)
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   * @param {string} [scope='singleton'] - Service scope
   * @param {Object} [options] - Additional options
   */
  registerLazy(name, factory, scope = ServiceScope.Singleton, options = {}) {
    if (typeof factory !== 'function') {
      throw new Error(`Lazy service '${name}' requires a factory function`);
    }
    
    const registration = new ServiceRegistration(name, factory, scope, { ...options, lazy: true });
    this._registrations.set(name, registration);
    this._logger.debug('Registered lazy service', { name, scope });
  }

  /**
   * Register a service with interface validation
   * @param {string} name - Service name
   * @param {*} instanceOrFactory - Service instance or factory function
   * @param {Object} requiredInterface - Interface definition
   * @param {string} [scope='singleton'] - Service scope
   */
  registerWithInterface(name, instanceOrFactory, requiredInterface, scope = ServiceScope.Singleton) {
    const options = { requiredInterface };
    
    if (typeof instanceOrFactory === 'function') {
      // It's a factory - we need to create an instance to validate
      const testInstance = instanceOrFactory(this);
      this._validateInterface(name, testInstance, requiredInterface);
      
      switch (scope) {
        case ServiceScope.Singleton:
          this.registerSingleton(name, instanceOrFactory, options);
          break;
        case ServiceScope.Transient:
          this.registerTransient(name, instanceOrFactory, options);
          break;
        case ServiceScope.Scoped:
          this.registerScoped(name, instanceOrFactory, options);
          break;
        default:
          throw new Error(`Unknown scope: ${scope}`);
      }
    } else {
      // It's an instance - validate directly
      this._validateInterface(name, instanceOrFactory, requiredInterface);
      this.registerSingleton(name, instanceOrFactory, { ...options, isInstance: true });
    }
  }

  /**
   * Create a new scope for scoped services
   * @returns {Scope} New scope instance
   */
  createScope() {
    return new Scope(this);
  }

  /**
   * Resolve a service by name
   * @param {string} name - Service name
   * @param {Scope} [scope] - Optional scope for scoped services
   * @returns {*} Service instance
   */
  resolve(name, scope = null) {
    const registration = this._registrations.get(name);
    
    if (!registration) {
      const availableServices = this.getRegisteredServices().map(s => s.name);
      const similar = this._findSimilarServices(name, availableServices);
      const suggestion = similar.length > 0 
        ? ` Did you mean: ${similar.join(', ')}?` 
        : '';
      const available = availableServices.length > 0
        ? ` Available services: ${availableServices.join(', ')}`
        : ' No services registered.';
      throw new Error(`Service not found: '${name}'.${suggestion}${available}`);
    }

    // Check for circular dependency
    if (this._resolving.has(name)) {
      const path = Array.from(this._resolving).join(' -> ') + ' -> ' + name;
      throw new Error(`Circular dependency detected: ${path}`);
    }

    this._resolving.add(name);

    try {
      let instance;

      switch (registration.scope) {
        case ServiceScope.Singleton:
          instance = this._resolveSingleton(registration);
          break;
        case ServiceScope.Transient:
          instance = this._resolveTransient(registration);
          break;
        case ServiceScope.Scoped:
          instance = this._resolveScoped(registration, scope);
          break;
        default:
          throw new Error(`Unknown service scope: ${registration.scope}`);
      }

      // Apply decorators
      instance = this._applyDecorators(name, instance);

      this._logger.debug('Resolved service', { name, scope: registration.scope });
      return instance;

    } finally {
      this._resolving.delete(name);
    }
  }

  /**
   * Resolve a service asynchronously
   * @param {string} name - Service name
   * @param {Scope} [scope] - Optional scope
   * @returns {Promise<*>} Service instance
   */
  async resolveAsync(name, scope = null) {
    return Promise.resolve(this.resolve(name, scope));
  }

  /**
   * Try to resolve a service, returning undefined if not found
   * @param {string} name - Service name
   * @param {Scope} [scope] - Optional scope
   * @returns {*|undefined} Service instance or undefined
   */
  tryResolve(name, scope = null) {
    try {
      return this.resolve(name, scope);
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Add a decorator to a service
   * @param {string} name - Service name
   * @param {Function} decorator - Decorator function (service) => decoratedService
   */
  decorate(name, decorator) {
    if (typeof decorator !== 'function') {
      throw new Error(`Decorator for '${name}' must be a function`);
    }
    
    if (!this._decorators.has(name)) {
      this._decorators.set(name, []);
    }
    this._decorators.get(name).push(decorator);
    this._logger.debug('Added decorator to service', { name });
  }

  /**
   * Check if a service is registered
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this._registrations.has(name);
  }

  /**
   * Remove a service registration
   * @param {string} name - Service name
   */
  remove(name) {
    this._registrations.delete(name);
    this._singletonInstances.delete(name);
    this._decorators.delete(name);
    this._logger.debug('Removed service', { name });
  }

  /**
   * Clear all registrations
   */
  clear() {
    this._registrations.clear();
    this._singletonInstances.clear();
    this._decorators.clear();
    this._resolving.clear();
    this._logger.info('Container cleared');
  }

  /**
   * Get information about all registered services
   * @returns {Array<{name: string, scope: string, lazy: boolean, initialized: boolean}>}
   */
  getRegisteredServices() {
    const services = [];
    for (const [name, reg] of this._registrations) {
      services.push({
        name,
        scope: reg.scope,
        lazy: reg.lazy,
        initialized: reg.initialized,
        hasDecorators: this._decorators.has(name) && this._decorators.get(name).length > 0
      });
    }
    return services;
  }

  /**
   * Validate all registrations
   * @returns {{valid: boolean, errors: Array<string>}}
   */
  validateRegistrations() {
    const errors = [];
    
    for (const [name, registration] of this._registrations) {
      // Check factory is valid
      if (typeof registration.factory !== 'function') {
        errors.push(`Service '${name}' has invalid factory`);
      }
      
      // Check for potential circular dependencies (static analysis)
      // This is a basic check - full detection happens at resolve time
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get container status
   * @returns {Object}
   */
  getStatus() {
    return {
      totalServices: this._registrations.size,
      singletons: Array.from(this._registrations.values())
        .filter(r => r.scope === ServiceScope.Singleton).length,
      transients: Array.from(this._registrations.values())
        .filter(r => r.scope === ServiceScope.Transient).length,
      scoped: Array.from(this._registrations.values())
        .filter(r => r.scope === ServiceScope.Scoped).length,
      cached: this._singletonInstances.size,
      resolving: Array.from(this._resolving),
      serviceNames: Array.from(this._registrations.keys())
    };
  }

  // Private methods

  _resolveSingleton(registration) {
    if (registration.initialized && this._singletonInstances.has(registration.name)) {
      return this._singletonInstances.get(registration.name);
    }

    const instance = registration.factory(this);
    registration.instance = instance;
    registration.initialized = true;
    this._singletonInstances.set(registration.name, instance);
    return instance;
  }

  _resolveTransient(registration) {
    return registration.factory(this);
  }

  _resolveScoped(registration, scope) {
    if (!scope) {
      throw new Error(`Scoped service '${registration.name}' requires a scope. Use createScope() to create one.`);
    }

    if (scope.isDisposed()) {
      throw new Error(`Cannot resolve scoped service '${registration.name}' from a disposed scope`);
    }

    if (scope.hasInstance(registration.name)) {
      return scope.getInstance(registration.name);
    }

    const instance = registration.factory(this);
    scope.setInstance(registration.name, instance);
    return instance;
  }

  _applyDecorators(name, instance) {
    const decorators = this._decorators.get(name);
    if (!decorators || decorators.length === 0) {
      return instance;
    }

    let decorated = instance;
    for (const decorator of decorators) {
      decorated = decorator(decorated);
    }
    return decorated;
  }

  _validateInterfaceIfRequired(registration, instance) {
    if (!registration.requiredInterface) {
      return;
    }

    const iface = registration.requiredInterface;
    
    // If we have an instance, validate it now
    if (instance) {
      this._validateInterface(registration.name, instance, iface);
    }
    // Otherwise, validation will happen at first resolution
  }

  /**
   * Validate that an instance implements a required interface
   * @param {string} serviceName - Service name
   * @param {*} instance - Service instance
   * @param {Object} requiredInterface - Interface definition with required members
   */
  _validateInterface(serviceName, instance, requiredInterface) {
    if (!requiredInterface || !requiredInterface.members) {
      return;
    }

    const missingMembers = [];
    
    for (const member of requiredInterface.members) {
      if (typeof member === 'string') {
        if (!(member in instance)) {
          missingMembers.push(member);
        }
      } else if (typeof member === 'object') {
        const { name, type } = member;
        if (!(name in instance)) {
          missingMembers.push(name);
        } else if (type === 'function' && typeof instance[name] !== 'function') {
          missingMembers.push(`${name} (expected function)`);
        }
      }
    }

    if (missingMembers.length > 0) {
      throw new Error(
        `Service '${serviceName}' does not implement required interface '${requiredInterface.name || 'unknown'}'. ` +
        `Missing members: ${missingMembers.join(', ')}`
      );
    }
  }

  _findSimilarServices(name, availableServices) {
    const similar = [];
    const nameLower = name.toLowerCase();
    
    for (const service of availableServices) {
      const serviceLower = service.toLowerCase();
      // Simple similarity check: contains or starts with
      if (serviceLower.includes(nameLower) || nameLower.includes(serviceLower)) {
        similar.push(service);
      }
    }
    
    return similar.slice(0, 3); // Return max 3 suggestions
  }

  _createLogger() {
    return {
      debug: (message, data) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[DependencyContainer] ${message}`, data || '');
        }
      },
      info: (message, data) => {
        console.info(`[DependencyContainer] ${message}`, data || '');
      },
      warn: (message, data) => {
        console.warn(`[DependencyContainer] ${message}`, data || '');
      },
      error: (message, data) => {
        console.error(`[DependencyContainer] ${message}`, data || '');
      }
    };
  }
}

// Global container instance
let globalContainer = null;

/**
 * Get the global dependency container
 * @returns {DependencyContainer}
 */
function getGlobalContainer() {
  if (!globalContainer) {
    globalContainer = new DependencyContainer();
  }
  return globalContainer;
}

/**
 * Create a new dependency container
 * @returns {DependencyContainer}
 */
function createContainer() {
  return new DependencyContainer();
}

module.exports = {
  DependencyContainer,
  ServiceScope,
  Scope,
  ServiceRegistration,
  getGlobalContainer,
  createContainer
};
