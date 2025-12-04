/**
 * StateManager - Centralized application state management
 * 
 * Provides state management with observer pattern, persistence,
 * snapshots for debugging, and serialization support.
 * 
 * @module core/state/StateManager
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * @typedef {Object} StateSnapshot
 * @property {Object} state - The state at snapshot time
 * @property {number} timestamp - Unix timestamp when snapshot was taken
 * @property {number} version - State version number
 */

/**
 * @typedef {Object} StateManagerOptions
 * @property {Object} [initialState={}] - Initial state
 * @property {string} [persistPath] - Path for state persistence
 * @property {Function} [validator] - State validation function
 * @property {Function} [logger] - Logger function for errors
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - Validation error messages
 */

class StateManager {
  /**
   * Creates a new StateManager instance
   * @param {StateManagerOptions} [options={}] - Configuration options
   */
  constructor(options = {}) {
    /** @type {Object} */
    this._state = this._deepClone(options.initialState || {});
    /** @type {number} */
    this._version = 0;
    /** @type {string|null} */
    this._persistPath = options.persistPath || null;
    /** @type {Function|null} */
    this._validator = options.validator || null;
    /** @type {Function} */
    this._logger = options.logger || console.error.bind(console);
    /** @type {Set<Function>} */
    this._globalSubscribers = new Set();
    /** @type {Map<string, Set<Function>>} */
    this._sliceSubscribers = new Map();
    /** @type {StateSnapshot[]} */
    this._snapshots = [];
    /** @type {number} */
    this._maxSnapshots = options.maxSnapshots || 50;
  }

  /**
   * Gets the entire state (deep clone)
   * @returns {Object} Current state
   */
  getState() {
    return this._deepClone(this._state);
  }

  /**
   * Gets a slice of the state by key
   * @param {string} key - State slice key
   * @returns {*} State slice value
   */
  getSlice(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('Slice key must be a non-empty string');
    }
    return this._deepClone(this._state[key]);
  }


  /**
   * Sets the entire state using an updater function
   * @param {Function} updater - Function that receives current state and returns new state
   * @throws {Error} If validation fails
   */
  setState(updater) {
    if (typeof updater !== 'function') {
      throw new Error('Updater must be a function');
    }

    const oldState = this._state;
    const newState = updater(this._deepClone(oldState));

    // Validate new state if validator is provided
    if (this._validator) {
      const validationResult = this._validator(newState);
      if (!validationResult.valid) {
        const error = new Error(`State validation failed: ${validationResult.errors.join(', ')}`);
        error.code = 'VALIDATION_ERROR';
        error.validationErrors = validationResult.errors;
        throw error;
      }
    }

    this._state = this._deepClone(newState);
    this._version++;

    // Notify global subscribers
    this._notifyGlobalSubscribers(this._state);

    // Notify slice subscribers for changed slices
    this._notifySliceSubscribers(oldState, this._state);
  }

  /**
   * Sets a specific slice of the state
   * @param {string} key - State slice key
   * @param {*} value - New value for the slice
   * @throws {Error} If validation fails
   */
  setSlice(key, value) {
    if (!key || typeof key !== 'string') {
      throw new Error('Slice key must be a non-empty string');
    }

    const oldState = this._state;
    const oldSliceValue = oldState[key];
    const newState = { ...oldState, [key]: this._deepClone(value) };

    // Validate new state if validator is provided
    if (this._validator) {
      const validationResult = this._validator(newState);
      if (!validationResult.valid) {
        const error = new Error(`State validation failed: ${validationResult.errors.join(', ')}`);
        error.code = 'VALIDATION_ERROR';
        error.validationErrors = validationResult.errors;
        throw error;
      }
    }

    this._state = newState;
    this._version++;

    // Notify global subscribers
    this._notifyGlobalSubscribers(this._state);

    // Notify slice subscribers for this specific slice
    const sliceSubscribers = this._sliceSubscribers.get(key);
    if (sliceSubscribers) {
      for (const handler of sliceSubscribers) {
        try {
          handler(this._deepClone(value), this._deepClone(oldSliceValue));
        } catch (error) {
          this._logger(`StateManager: Slice subscriber error for key "${key}":`, error);
        }
      }
    }
  }

  /**
   * Subscribes to all state changes
   * @param {Function} listener - Handler function (state) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    this._globalSubscribers.add(listener);

    return () => {
      this._globalSubscribers.delete(listener);
    };
  }

  /**
   * Subscribes to changes in a specific state slice
   * @param {string} key - State slice key
   * @param {Function} listener - Handler function (value, oldValue) => void
   * @returns {Function} Unsubscribe function
   */
  subscribeToSlice(key, listener) {
    if (!key || typeof key !== 'string') {
      throw new Error('Slice key must be a non-empty string');
    }
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    if (!this._sliceSubscribers.has(key)) {
      this._sliceSubscribers.set(key, new Set());
    }

    this._sliceSubscribers.get(key).add(listener);

    return () => {
      const subscribers = this._sliceSubscribers.get(key);
      if (subscribers) {
        subscribers.delete(listener);
        if (subscribers.size === 0) {
          this._sliceSubscribers.delete(key);
        }
      }
    };
  }


  /**
   * Persists the current state to storage
   * @returns {Promise<void>}
   * @throws {Error} If persistence fails
   */
  async persist() {
    if (!this._persistPath) {
      throw new Error('No persist path configured. Set persistPath in options.');
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(this._persistPath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      const data = {
        state: this._state,
        version: this._version,
        timestamp: Date.now(),
        checksum: this._calculateChecksum(this._state)
      };

      const content = JSON.stringify(data, null, 2);
      await fs.promises.writeFile(this._persistPath, content, 'utf8');
    } catch (error) {
      const persistError = new Error(`Failed to persist state: ${error.message}`);
      persistError.code = 'PERSISTENCE_ERROR';
      persistError.cause = error;
      throw persistError;
    }
  }

  /**
   * Restores state from storage
   * @returns {Promise<void>}
   * @throws {Error} If restoration fails or state is corrupted
   */
  async restore() {
    if (!this._persistPath) {
      throw new Error('No persist path configured. Set persistPath in options.');
    }

    if (!fs.existsSync(this._persistPath)) {
      // No persisted state, keep current state
      return;
    }

    try {
      const content = await fs.promises.readFile(this._persistPath, 'utf8');
      const data = JSON.parse(content);

      // Validate checksum for integrity
      const expectedChecksum = this._calculateChecksum(data.state);
      if (data.checksum && data.checksum !== expectedChecksum) {
        const error = new Error('State integrity check failed: checksum mismatch');
        error.code = 'CORRUPTION_ERROR';
        error.recoverable = true;
        throw error;
      }

      // Validate state if validator is provided
      if (this._validator) {
        const validationResult = this._validator(data.state);
        if (!validationResult.valid) {
          const error = new Error(`Restored state validation failed: ${validationResult.errors.join(', ')}`);
          error.code = 'CORRUPTION_ERROR';
          error.recoverable = true;
          error.validationErrors = validationResult.errors;
          throw error;
        }
      }

      const oldState = this._state;
      this._state = data.state;
      this._version = data.version || 0;

      // Notify subscribers
      this._notifyGlobalSubscribers(this._state);
      this._notifySliceSubscribers(oldState, this._state);
    } catch (error) {
      if (error.code === 'CORRUPTION_ERROR') {
        throw error;
      }
      
      // Handle JSON parse errors or other issues as corruption
      const corruptionError = new Error(`Failed to restore state: ${error.message}`);
      corruptionError.code = 'CORRUPTION_ERROR';
      corruptionError.recoverable = true;
      corruptionError.cause = error;
      throw corruptionError;
    }
  }

  /**
   * Creates a snapshot of the current state
   * @returns {StateSnapshot} State snapshot
   */
  snapshot() {
    const snap = {
      state: this._deepClone(this._state),
      timestamp: Date.now(),
      version: this._version
    };

    this._snapshots.push(snap);

    // Trim snapshots if exceeds max
    if (this._snapshots.length > this._maxSnapshots) {
      this._snapshots = this._snapshots.slice(-this._maxSnapshots);
    }

    return { ...snap };
  }

  /**
   * Gets all snapshots
   * @returns {StateSnapshot[]} Array of snapshots
   */
  getSnapshots() {
    return this._snapshots.map(snap => ({
      state: this._deepClone(snap.state),
      timestamp: snap.timestamp,
      version: snap.version
    }));
  }

  /**
   * Restores state from a snapshot
   * @param {StateSnapshot} snapshot - Snapshot to restore from
   */
  restoreFromSnapshot(snapshot) {
    if (!snapshot || !snapshot.state) {
      throw new Error('Invalid snapshot');
    }

    const oldState = this._state;
    this._state = this._deepClone(snapshot.state);
    this._version++;

    // Notify subscribers
    this._notifyGlobalSubscribers(this._state);
    this._notifySliceSubscribers(oldState, this._state);
  }

  /**
   * Clears all snapshots
   */
  clearSnapshots() {
    this._snapshots = [];
  }


  /**
   * Serializes the state to a JSON string
   * @returns {string} JSON string representation of state
   */
  serialize() {
    return JSON.stringify({
      state: this._state,
      version: this._version,
      timestamp: Date.now()
    });
  }

  /**
   * Deserializes state from a JSON string
   * @param {string} data - JSON string to deserialize
   * @throws {Error} If deserialization fails or state is corrupted
   */
  deserialize(data) {
    if (!data || typeof data !== 'string') {
      const error = new Error('Invalid data: expected non-empty string');
      error.code = 'CORRUPTION_ERROR';
      error.recoverable = true;
      throw error;
    }

    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (parseError) {
      const error = new Error(`Failed to parse state data: ${parseError.message}`);
      error.code = 'CORRUPTION_ERROR';
      error.recoverable = true;
      error.cause = parseError;
      throw error;
    }

    if (!parsed || typeof parsed !== 'object') {
      const error = new Error('Invalid state data: expected object');
      error.code = 'CORRUPTION_ERROR';
      error.recoverable = true;
      throw error;
    }

    const stateToRestore = parsed.state !== undefined ? parsed.state : parsed;

    // Validate state if validator is provided
    if (this._validator) {
      const validationResult = this._validator(stateToRestore);
      if (!validationResult.valid) {
        const error = new Error(`State validation failed: ${validationResult.errors.join(', ')}`);
        error.code = 'CORRUPTION_ERROR';
        error.recoverable = true;
        error.validationErrors = validationResult.errors;
        throw error;
      }
    }

    const oldState = this._state;
    this._state = this._deepClone(stateToRestore);
    this._version = parsed.version !== undefined ? parsed.version : this._version + 1;

    // Notify subscribers
    this._notifyGlobalSubscribers(this._state);
    this._notifySliceSubscribers(oldState, this._state);
  }

  /**
   * Gets the current state version
   * @returns {number} State version
   */
  getVersion() {
    return this._version;
  }

  /**
   * Resets state to initial value
   * @param {Object} [initialState={}] - New initial state
   */
  reset(initialState = {}) {
    const oldState = this._state;
    this._state = this._deepClone(initialState);
    this._version = 0;
    this._snapshots = [];

    // Notify subscribers
    this._notifyGlobalSubscribers(this._state);
    this._notifySliceSubscribers(oldState, this._state);
  }

  /**
   * Clears all subscribers
   */
  clearSubscribers() {
    this._globalSubscribers.clear();
    this._sliceSubscribers.clear();
  }

  /**
   * Gets the number of global subscribers
   * @returns {number}
   */
  getSubscriberCount() {
    return this._globalSubscribers.size;
  }

  /**
   * Gets the number of slice subscribers for a key
   * @param {string} key - Slice key
   * @returns {number}
   */
  getSliceSubscriberCount(key) {
    const subscribers = this._sliceSubscribers.get(key);
    return subscribers ? subscribers.size : 0;
  }

  /**
   * Sets the persist path
   * @param {string} persistPath - Path for state persistence
   */
  setPersistPath(persistPath) {
    this._persistPath = persistPath;
  }

  /**
   * Gets the persist path
   * @returns {string|null}
   */
  getPersistPath() {
    return this._persistPath;
  }

  // Private methods

  /**
   * Deep clones an object
   * @private
   */
  _deepClone(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (typeof obj !== 'object') {
      return obj;
    }
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this._deepClone(item));
    }
    
    const cloned = {};
    for (const key of Object.keys(obj)) {
      cloned[key] = this._deepClone(obj[key]);
    }
    return cloned;
  }

  /**
   * Notifies all global subscribers
   * @private
   */
  _notifyGlobalSubscribers(state) {
    for (const handler of this._globalSubscribers) {
      try {
        handler(this._deepClone(state));
      } catch (error) {
        this._logger('StateManager: Global subscriber error:', error);
      }
    }
  }

  /**
   * Notifies slice subscribers for changed slices
   * @private
   */
  _notifySliceSubscribers(oldState, newState) {
    // Get all keys from both states
    const allKeys = new Set([
      ...Object.keys(oldState || {}),
      ...Object.keys(newState || {})
    ]);

    for (const key of allKeys) {
      const oldValue = oldState ? oldState[key] : undefined;
      const newValue = newState ? newState[key] : undefined;

      // Check if value changed (simple comparison)
      if (!this._deepEqual(oldValue, newValue)) {
        const subscribers = this._sliceSubscribers.get(key);
        if (subscribers) {
          for (const handler of subscribers) {
            try {
              handler(this._deepClone(newValue), this._deepClone(oldValue));
            } catch (error) {
              this._logger(`StateManager: Slice subscriber error for key "${key}":`, error);
            }
          }
        }
      }
    }
  }

  /**
   * Deep equality check
   * @private
   */
  _deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a === undefined || b === undefined) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a !== 'object') return a === b;
    
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this._deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this._deepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }

  /**
   * Calculates a checksum for state integrity verification
   * @private
   */
  _calculateChecksum(state) {
    const content = JSON.stringify(state);
    return crypto.createHash('md5').update(content).digest('hex');
  }
}

// Factory functions

/**
 * Creates a new StateManager instance
 * @param {StateManagerOptions} [options] - Configuration options
 * @returns {StateManager}
 */
function createStateManager(options) {
  return new StateManager(options);
}

// Global instance
let globalStateManager = null;

/**
 * Gets the global StateManager instance
 * @param {StateManagerOptions} [options] - Configuration options (only used on first call)
 * @returns {StateManager}
 */
function getGlobalStateManager(options) {
  if (!globalStateManager) {
    globalStateManager = new StateManager(options);
  }
  return globalStateManager;
}

module.exports = {
  StateManager,
  createStateManager,
  getGlobalStateManager
};
