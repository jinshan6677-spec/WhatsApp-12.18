/**
 * Instance Module Entry Point
 * Integrates all instance management components
 */

const InstanceStorage = require('./InstanceStorage');
const InstanceLifecycle = require('./InstanceLifecycle');
const InstanceMonitor = require('./InstanceMonitor');
const { app } = require('electron');

/**
 * InstanceManager - Integrated instance management
 * Maintains backward compatibility with original InstanceManager
 */
class InstanceManager {
  /**
   * Create instance manager
   * @param {Object} [options] - Configuration options
   */
  constructor(options = {}) {
    // Create logger
    this.log = this._createLogger();

    // Initialize storage
    this.storage = new InstanceStorage(this.log);

    // Initialize lifecycle manager
    this.lifecycle = new InstanceLifecycle(this.storage, this.log, {
      userDataPath: options.userDataPath || app.getPath('userData'),
      maxInstances: options.maxInstances || 30,
      sessionManager: options.sessionManager,
      translationIntegration: options.translationIntegration
    });

    // Initialize monitor
    this.monitor = new InstanceMonitor(this.storage, this.log);

    // Expose properties for backward compatibility
    this.instances = this.storage.instances;
    this.instanceStatuses = this.storage.instanceStatuses;
    this.unreadMonitoringIntervals = this.monitor.unreadMonitoringIntervals;
    this.monitoringInterval = null;

    // Store options
    this.userDataPath = options.userDataPath || app.getPath('userData');
    this.maxInstances = options.maxInstances || 30;
    this.translationIntegration = options.translationIntegration || null;
    this.errorHandler = options.errorHandler || null;
    this.sessionManager = options.sessionManager || null;
    this.notificationManager = options.notificationManager || null;
    this.resourceManager = options.resourceManager || null;
  }

  /**
   * Create logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [InstanceManager] [${level.toUpperCase()}] ${message}`;

      if (level === 'error') {
        console.error(logMessage, ...args);
      } else if (level === 'warn') {
        console.warn(logMessage, ...args);
      } else {
        console.log(logMessage, ...args);
      }
    };
  }

  /**
   * Create instance
   * @param {string} instanceId - Instance ID
   * @param {Object} config - Instance configuration
   * @returns {Promise<{success: boolean, window?: BrowserWindow, error?: string}>}
   */
  async createInstance(instanceId, config) {
    return this.lifecycle.createInstance(instanceId, config);
  }

  /**
   * Destroy instance
   * @param {string} instanceId - Instance ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async destroyInstance(instanceId) {
    // Stop monitoring first
    this.monitor.stopUnreadMonitoring(instanceId);
    return this.lifecycle.destroyInstance(instanceId);
  }

  /**
   * Restart instance
   * @param {string} instanceId - Instance ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async restartInstance(instanceId) {
    return this.lifecycle.restartInstance(instanceId);
  }

  /**
   * Get instance status
   * @param {string} instanceId - Instance ID
   * @returns {Object|null}
   */
  getInstanceStatus(instanceId) {
    return this.storage.getInstanceStatus(instanceId);
  }

  /**
   * Get running instances
   * @returns {Array}
   */
  getRunningInstances() {
    return this.storage.getRunningInstances();
  }

  /**
   * Get all instances
   * @returns {Array}
   */
  getAllInstances() {
    return this.storage.getAllInstances();
  }

  /**
   * Get instance count
   * @returns {number}
   */
  getInstanceCount() {
    return this.storage.getInstanceCount();
  }

  /**
   * Get running instance count
   * @returns {number}
   */
  getRunningInstanceCount() {
    return this.storage.getRunningInstanceCount();
  }

  /**
   * Check if instance exists
   * @param {string} instanceId - Instance ID
   * @returns {boolean}
   */
  instanceExists(instanceId) {
    return this.storage.instanceExists(instanceId);
  }

  /**
   * Setup instance monitoring
   * @param {string} instanceId - Instance ID
   * @param {BrowserWindow} window - Browser window
   */
  setupInstanceMonitoring(instanceId, window) {
    this.monitor.setupInstanceMonitoring(instanceId, window);
  }

  /**
   * Start global monitoring
   */
  startGlobalMonitoring() {
    this.monitor.startGlobalMonitoring();
    this.monitoringInterval = this.monitor.monitoringInterval;
  }

  /**
   * Stop global monitoring
   */
  stopGlobalMonitoring() {
    this.monitor.stopGlobalMonitoring();
    this.monitoringInterval = null;
  }

  /**
   * Start unread monitoring
   * @param {string} instanceId - Instance ID
   * @param {BrowserWindow} window - Browser window
   */
  startUnreadMonitoring(instanceId, window) {
    this.monitor.startUnreadMonitoring(instanceId, window);
  }

  /**
   * Stop unread monitoring
   * @param {string} instanceId - Instance ID
   */
  stopUnreadMonitoring(instanceId) {
    this.monitor.stopUnreadMonitoring(instanceId);
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    this.monitor.cleanup();
    this.storage.clear();
  }
}

module.exports = InstanceManager;
