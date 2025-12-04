/**
 * PluginManager - Plugin lifecycle and registration management
 * 
 * Provides plugin registration, initialization, lifecycle management,
 * dependency ordering, error isolation, and resource cleanup.
 * 
 * @module infrastructure/plugins/PluginManager
 */

'use strict';

/**
 * Required plugin interface members
 */
const REQUIRED_PLUGIN_INTERFACE = {
  name: 'IPlugin',
  members: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'initialize', type: 'function' },
    { name: 'destroy', type: 'function' }
  ]
};

/**
 * Plugin state enumeration
 */
const PluginState = {
  Registered: 'registered',
  Initializing: 'initializing',
  Active: 'active',
  Disabling: 'disabling',
  Disabled: 'disabled',
  Error: 'error'
};

/**
 * Plugin registration information
 */
class PluginRegistration {
  constructor(plugin) {
    this.plugin = plugin;
    this.state = PluginState.Registered;
    this.error = null;
    this.initializationOrder = -1;
    this.registeredAt = Date.now();
    this.initializedAt = null;
    this.disabledAt = null;
  }
}

/**
 * PluginManager class
 */
class PluginManager {
  /**
   * Creates a new PluginManager instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function for errors
   */
  constructor(options = {}) {
    /** @type {Map<string, PluginRegistration>} */
    this._plugins = new Map();
    /** @type {Function} */
    this._logger = options.logger || console.error.bind(console);
    /** @type {Object|null} */
    this._context = null;
    /** @type {boolean} */
    this._initialized = false;
  }


  /**
   * Sets the plugin context that will be passed to plugins during initialization
   * @param {Object} context - Plugin context
   */
  setContext(context) {
    this._context = context;
  }

  /**
   * Gets the plugin context
   * @returns {Object|null}
   */
  getContext() {
    return this._context;
  }

  /**
   * Validates that an object implements the required plugin interface
   * @param {Object} plugin - Plugin object to validate
   * @returns {{valid: boolean, missingMembers: string[]}}
   */
  validatePluginInterface(plugin) {
    const missingMembers = [];

    if (!plugin || typeof plugin !== 'object') {
      return {
        valid: false,
        missingMembers: REQUIRED_PLUGIN_INTERFACE.members.map(m => m.name)
      };
    }

    for (const member of REQUIRED_PLUGIN_INTERFACE.members) {
      const { name, type } = member;
      
      if (!(name in plugin)) {
        missingMembers.push(name);
      } else if (type === 'function' && typeof plugin[name] !== 'function') {
        missingMembers.push(`${name} (expected function, got ${typeof plugin[name]})`);
      } else if (type === 'string' && typeof plugin[name] !== 'string') {
        missingMembers.push(`${name} (expected string, got ${typeof plugin[name]})`);
      }
    }

    return {
      valid: missingMembers.length === 0,
      missingMembers
    };
  }

  /**
   * Registers a plugin
   * @param {Object} plugin - Plugin object implementing IPlugin interface
   * @throws {Error} If plugin interface validation fails
   */
  register(plugin) {
    // Validate plugin interface
    const validation = this.validatePluginInterface(plugin);
    if (!validation.valid) {
      const error = new Error(
        `Plugin interface validation failed. Missing members: ${validation.missingMembers.join(', ')}`
      );
      error.code = 'PLUGIN_INTERFACE_ERROR';
      error.missingMembers = validation.missingMembers;
      throw error;
    }

    // Check for duplicate registration
    if (this._plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }

    // Register the plugin
    const registration = new PluginRegistration(plugin);
    this._plugins.set(plugin.name, registration);
    
    this._log('info', `Plugin '${plugin.name}' v${plugin.version} registered`);
  }

  /**
   * Unregisters a plugin
   * @param {string} pluginName - Name of the plugin to unregister
   * @throws {Error} If plugin is not found or is currently active
   */
  unregister(pluginName) {
    const registration = this._plugins.get(pluginName);
    
    if (!registration) {
      throw new Error(`Plugin '${pluginName}' is not registered`);
    }

    if (registration.state === PluginState.Active) {
      throw new Error(`Cannot unregister active plugin '${pluginName}'. Disable it first.`);
    }

    this._plugins.delete(pluginName);
    this._log('info', `Plugin '${pluginName}' unregistered`);
  }

  /**
   * Enables and initializes a plugin
   * @param {string} pluginName - Name of the plugin to enable
   * @returns {Promise<void>}
   * @throws {Error} If plugin is not found or initialization fails
   */
  async enable(pluginName) {
    const registration = this._plugins.get(pluginName);
    
    if (!registration) {
      throw new Error(`Plugin '${pluginName}' is not registered`);
    }

    if (registration.state === PluginState.Active) {
      return; // Already active
    }

    registration.state = PluginState.Initializing;

    try {
      await registration.plugin.initialize(this._context);
      registration.state = PluginState.Active;
      registration.initializedAt = Date.now();
      registration.error = null;
      this._log('info', `Plugin '${pluginName}' enabled`);
    } catch (error) {
      registration.state = PluginState.Error;
      registration.error = error;
      this._log('error', `Plugin '${pluginName}' initialization failed:`, error);
      throw error;
    }
  }

  /**
   * Disables a plugin and releases its resources
   * @param {string} pluginName - Name of the plugin to disable
   * @returns {Promise<void>}
   * @throws {Error} If plugin is not found
   */
  async disable(pluginName) {
    const registration = this._plugins.get(pluginName);
    
    if (!registration) {
      throw new Error(`Plugin '${pluginName}' is not registered`);
    }

    if (registration.state !== PluginState.Active) {
      return; // Not active, nothing to disable
    }

    registration.state = PluginState.Disabling;

    try {
      await registration.plugin.destroy();
      registration.state = PluginState.Disabled;
      registration.disabledAt = Date.now();
      this._log('info', `Plugin '${pluginName}' disabled`);
    } catch (error) {
      registration.state = PluginState.Error;
      registration.error = error;
      this._log('error', `Plugin '${pluginName}' disable failed:`, error);
      throw error;
    }
  }

  /**
   * Gets a plugin by name
   * @param {string} name - Plugin name
   * @returns {Object|undefined} Plugin object or undefined
   */
  getPlugin(name) {
    const registration = this._plugins.get(name);
    return registration ? registration.plugin : undefined;
  }

  /**
   * Gets all registered plugins
   * @returns {Object[]} Array of plugin objects
   */
  getAllPlugins() {
    return Array.from(this._plugins.values()).map(reg => reg.plugin);
  }

  /**
   * Gets all active plugins
   * @returns {Object[]} Array of active plugin objects
   */
  getActivePlugins() {
    return Array.from(this._plugins.values())
      .filter(reg => reg.state === PluginState.Active)
      .map(reg => reg.plugin);
  }

  /**
   * Gets plugin state
   * @param {string} pluginName - Plugin name
   * @returns {string|undefined} Plugin state or undefined
   */
  getPluginState(pluginName) {
    const registration = this._plugins.get(pluginName);
    return registration ? registration.state : undefined;
  }

  /**
   * Checks if a plugin is registered
   * @param {string} pluginName - Plugin name
   * @returns {boolean}
   */
  isRegistered(pluginName) {
    return this._plugins.has(pluginName);
  }

  /**
   * Checks if a plugin is active
   * @param {string} pluginName - Plugin name
   * @returns {boolean}
   */
  isActive(pluginName) {
    const registration = this._plugins.get(pluginName);
    return registration ? registration.state === PluginState.Active : false;
  }


  /**
   * Computes the topological sort order for plugin initialization based on dependencies
   * @returns {{order: string[], hasCycle: boolean, cycleInfo: string|null}}
   */
  computeDependencyOrder() {
    const plugins = Array.from(this._plugins.values()).map(reg => reg.plugin);
    const graph = new Map(); // plugin name -> dependencies
    const inDegree = new Map(); // plugin name -> number of unresolved dependencies
    
    // Build dependency graph
    for (const plugin of plugins) {
      const deps = plugin.dependencies || [];
      graph.set(plugin.name, deps);
      inDegree.set(plugin.name, 0);
    }
    
    // Calculate in-degrees
    for (const [name, deps] of graph) {
      for (const dep of deps) {
        if (inDegree.has(dep)) {
          // Only count dependencies that are registered plugins
          inDegree.set(name, inDegree.get(name) + 1);
        }
      }
    }
    
    // Kahn's algorithm for topological sort
    const queue = [];
    const order = [];
    
    // Start with plugins that have no dependencies
    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name);
      }
    }
    
    while (queue.length > 0) {
      const current = queue.shift();
      order.push(current);
      
      // Reduce in-degree for plugins that depend on current
      for (const [name, deps] of graph) {
        if (deps.includes(current)) {
          const newDegree = inDegree.get(name) - 1;
          inDegree.set(name, newDegree);
          if (newDegree === 0) {
            queue.push(name);
          }
        }
      }
    }
    
    // Check for cycles
    if (order.length !== plugins.length) {
      const remaining = plugins
        .filter(p => !order.includes(p.name))
        .map(p => p.name);
      return {
        order: [],
        hasCycle: true,
        cycleInfo: `Circular dependency detected involving: ${remaining.join(', ')}`
      };
    }
    
    return {
      order,
      hasCycle: false,
      cycleInfo: null
    };
  }

  /**
   * Initializes all registered plugins in dependency order
   * @returns {Promise<{successful: string[], failed: Array<{name: string, error: Error}>}>}
   */
  async initializeAll() {
    const { order, hasCycle, cycleInfo } = this.computeDependencyOrder();
    
    if (hasCycle) {
      throw new Error(cycleInfo);
    }
    
    const successful = [];
    const failed = [];
    
    for (let i = 0; i < order.length; i++) {
      const pluginName = order[i];
      const registration = this._plugins.get(pluginName);
      
      if (!registration) continue;
      
      // Check if dependencies are satisfied
      const deps = registration.plugin.dependencies || [];
      const unsatisfiedDeps = deps.filter(dep => {
        const depReg = this._plugins.get(dep);
        return depReg && depReg.state !== PluginState.Active;
      });
      
      if (unsatisfiedDeps.length > 0) {
        const error = new Error(
          `Plugin '${pluginName}' has unsatisfied dependencies: ${unsatisfiedDeps.join(', ')}`
        );
        registration.state = PluginState.Error;
        registration.error = error;
        failed.push({ name: pluginName, error });
        this._log('error', `Plugin '${pluginName}' skipped due to unsatisfied dependencies`);
        continue;
      }
      
      registration.initializationOrder = i;
      
      try {
        await this.enable(pluginName);
        successful.push(pluginName);
      } catch (error) {
        // Error isolation - continue with other plugins
        failed.push({ name: pluginName, error });
        this._log('error', `Plugin '${pluginName}' failed to initialize, continuing with others`);
      }
    }
    
    this._initialized = true;
    return { successful, failed };
  }

  /**
   * Destroys all active plugins in reverse initialization order
   * @returns {Promise<{successful: string[], failed: Array<{name: string, error: Error}>}>}
   */
  async destroyAll() {
    const activePlugins = Array.from(this._plugins.entries())
      .filter(([_, reg]) => reg.state === PluginState.Active)
      .sort((a, b) => b[1].initializationOrder - a[1].initializationOrder);
    
    const successful = [];
    const failed = [];
    
    for (const [pluginName, _] of activePlugins) {
      try {
        await this.disable(pluginName);
        successful.push(pluginName);
      } catch (error) {
        failed.push({ name: pluginName, error });
      }
    }
    
    this._initialized = false;
    return { successful, failed };
  }

  /**
   * Gets plugin manager status
   * @returns {Object}
   */
  getStatus() {
    const plugins = Array.from(this._plugins.values());
    return {
      totalPlugins: plugins.length,
      activePlugins: plugins.filter(p => p.state === PluginState.Active).length,
      errorPlugins: plugins.filter(p => p.state === PluginState.Error).length,
      initialized: this._initialized,
      plugins: plugins.map(reg => ({
        name: reg.plugin.name,
        version: reg.plugin.version,
        state: reg.state,
        error: reg.error ? reg.error.message : null,
        initializationOrder: reg.initializationOrder
      }))
    };
  }

  /**
   * Clears all plugins
   */
  clear() {
    this._plugins.clear();
    this._initialized = false;
  }

  /**
   * Internal logging helper
   * @private
   */
  _log(level, message, error = null) {
    const logMessage = `[PluginManager] ${message}`;
    if (level === 'error' && error) {
      this._logger(logMessage, error);
    } else if (typeof console[level] === 'function') {
      console[level](logMessage);
    }
  }
}

module.exports = {
  PluginManager,
  PluginState,
  PluginRegistration,
  REQUIRED_PLUGIN_INTERFACE
};
