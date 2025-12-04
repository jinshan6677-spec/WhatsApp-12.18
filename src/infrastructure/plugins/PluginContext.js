/**
 * PluginContext - Context object provided to plugins during initialization
 * 
 * Provides access to core services (EventBus, DependencyContainer, ConfigProvider)
 * and hooks for plugins to register services and IPC handlers.
 * 
 * @module infrastructure/plugins/PluginContext
 */

'use strict';

/**
 * PluginContext class
 * 
 * Provides a sandboxed context for plugins to interact with the application.
 */
class PluginContext {
  /**
   * Creates a new PluginContext instance
   * @param {Object} options - Context options
   * @param {Object} options.eventBus - EventBus instance
   * @param {Object} options.container - DependencyContainer instance
   * @param {Object} options.config - ConfigProvider instance
   * @param {string} [options.pluginName] - Name of the plugin this context is for
   */
  constructor(options = {}) {
    if (!options.eventBus) {
      throw new Error('PluginContext requires an eventBus');
    }
    if (!options.container) {
      throw new Error('PluginContext requires a container');
    }
    if (!options.config) {
      throw new Error('PluginContext requires a config');
    }

    /** @type {Object} */
    this._eventBus = options.eventBus;
    /** @type {Object} */
    this._container = options.container;
    /** @type {Object} */
    this._config = options.config;
    /** @type {string|null} */
    this._pluginName = options.pluginName || null;
    
    /** @type {Map<string, Object>} */
    this._registeredServices = new Map();
    /** @type {Map<string, Function>} */
    this._registeredIPCHandlers = new Map();
    /** @type {Array<Function>} */
    this._cleanupCallbacks = [];
    /** @type {Array<Function>} */
    this._eventUnsubscribers = [];
  }

  /**
   * Gets the EventBus instance
   * @returns {Object} EventBus
   */
  get eventBus() {
    return this._eventBus;
  }

  /**
   * Gets the DependencyContainer instance
   * @returns {Object} DependencyContainer
   */
  get container() {
    return this._container;
  }

  /**
   * Gets the ConfigProvider instance
   * @returns {Object} ConfigProvider
   */
  get config() {
    return this._config;
  }

  /**
   * Gets the plugin name this context is associated with
   * @returns {string|null}
   */
  get pluginName() {
    return this._pluginName;
  }

  /**
   * Registers a service in the dependency container
   * @param {string} name - Service name
   * @param {*} service - Service instance or factory
   * @param {Object} [options={}] - Registration options
   * @param {string} [options.scope='singleton'] - Service scope
   */
  registerService(name, service, options = {}) {
    const prefixedName = this._pluginName ? `${this._pluginName}:${name}` : name;
    const scope = options.scope || 'singleton';

    switch (scope) {
      case 'singleton':
        if (typeof service === 'function' && !options.isInstance) {
          this._container.registerSingleton(prefixedName, service);
        } else {
          this._container.registerSingleton(prefixedName, service, { isInstance: true });
        }
        break;
      case 'transient':
        this._container.registerTransient(prefixedName, service);
        break;
      case 'scoped':
        this._container.registerScoped(prefixedName, service);
        break;
      default:
        throw new Error(`Unknown service scope: ${scope}`);
    }

    this._registeredServices.set(prefixedName, { service, options });
    
    // Track for cleanup
    this._cleanupCallbacks.push(() => {
      if (this._container.has(prefixedName)) {
        this._container.remove(prefixedName);
      }
    });
  }

  /**
   * Resolves a service from the dependency container
   * @param {string} name - Service name
   * @returns {*} Service instance
   */
  resolveService(name) {
    // Try prefixed name first
    const prefixedName = this._pluginName ? `${this._pluginName}:${name}` : name;
    if (this._container.has(prefixedName)) {
      return this._container.resolve(prefixedName);
    }
    // Fall back to unprefixed name
    return this._container.resolve(name);
  }

  /**
   * Registers an IPC handler
   * @param {string} channel - IPC channel name
   * @param {Function} handler - Handler function
   */
  registerIPCHandler(channel, handler) {
    if (typeof handler !== 'function') {
      throw new Error('IPC handler must be a function');
    }

    const prefixedChannel = this._pluginName ? `plugin:${this._pluginName}:${channel}` : channel;
    
    this._registeredIPCHandlers.set(prefixedChannel, handler);
    
    // If there's an IPC router in the container, register with it
    if (this._container.has('ipcRouter')) {
      const ipcRouter = this._container.resolve('ipcRouter');
      if (ipcRouter && typeof ipcRouter.register === 'function') {
        ipcRouter.register(prefixedChannel, handler);
        
        // Track for cleanup
        this._cleanupCallbacks.push(() => {
          if (typeof ipcRouter.unregister === 'function') {
            ipcRouter.unregister(prefixedChannel);
          }
        });
      }
    }
  }

  /**
   * Subscribes to an event on the EventBus
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  subscribe(event, handler) {
    const unsubscribe = this._eventBus.subscribe(event, handler);
    this._eventUnsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Publishes an event on the EventBus
   * @param {string} event - Event name
   * @param {*} payload - Event payload
   * @returns {Promise<void>}
   */
  async publish(event, payload) {
    return this._eventBus.publish(event, payload);
  }

  /**
   * Gets a configuration value
   * @param {string} key - Configuration key
   * @param {*} [defaultValue] - Default value
   * @returns {*} Configuration value
   */
  getConfig(key, defaultValue) {
    // Try plugin-specific config first
    const pluginKey = this._pluginName ? `plugins.${this._pluginName}.${key}` : key;
    if (this._config.has(pluginKey)) {
      return this._config.get(pluginKey);
    }
    return this._config.get(key, defaultValue);
  }

  /**
   * Sets a configuration value
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   */
  setConfig(key, value) {
    const pluginKey = this._pluginName ? `plugins.${this._pluginName}.${key}` : key;
    this._config.set(pluginKey, value);
  }

  /**
   * Registers a cleanup callback to be called when the plugin is destroyed
   * @param {Function} callback - Cleanup callback
   */
  onCleanup(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Cleanup callback must be a function');
    }
    this._cleanupCallbacks.push(callback);
  }

  /**
   * Gets all registered services by this plugin
   * @returns {Map<string, Object>}
   */
  getRegisteredServices() {
    return new Map(this._registeredServices);
  }

  /**
   * Gets all registered IPC handlers by this plugin
   * @returns {Map<string, Function>}
   */
  getRegisteredIPCHandlers() {
    return new Map(this._registeredIPCHandlers);
  }

  /**
   * Performs cleanup - unsubscribes from events and removes registered services
   * Called when the plugin is destroyed
   */
  cleanup() {
    // Unsubscribe from all events
    for (const unsubscribe of this._eventUnsubscribers) {
      try {
        unsubscribe();
      } catch (error) {
        console.error('[PluginContext] Error during event unsubscribe:', error);
      }
    }
    this._eventUnsubscribers = [];

    // Run cleanup callbacks in reverse order
    const callbacks = [...this._cleanupCallbacks].reverse();
    for (const callback of callbacks) {
      try {
        callback();
      } catch (error) {
        console.error('[PluginContext] Error during cleanup callback:', error);
      }
    }
    this._cleanupCallbacks = [];

    // Clear registered items
    this._registeredServices.clear();
    this._registeredIPCHandlers.clear();
  }
}

/**
 * Creates a new PluginContext
 * @param {Object} options - Context options
 * @returns {PluginContext}
 */
function createPluginContext(options) {
  return new PluginContext(options);
}

module.exports = {
  PluginContext,
  createPluginContext
};
