/**
 * InstanceStorage - Instance storage and state management
 * Handles instance data storage and retrieval
 */

class InstanceStorage {
  constructor(logger) {
    this.log = logger;
    this.instances = new Map();
    this.instanceStatuses = new Map();
  }

  /**
   * Store instance
   * @param {string} instanceId - Instance ID
   * @param {Object} instanceInfo - Instance information
   */
  storeInstance(instanceId, instanceInfo) {
    this.instances.set(instanceId, instanceInfo);
  }

  /**
   * Get instance
   * @param {string} instanceId - Instance ID
   * @returns {Object|null}
   */
  getInstance(instanceId) {
    return this.instances.get(instanceId) || null;
  }

  /**
   * Remove instance
   * @param {string} instanceId - Instance ID
   * @returns {boolean}
   */
  removeInstance(instanceId) {
    return this.instances.delete(instanceId);
  }

  /**
   * Check if instance exists
   * @param {string} instanceId - Instance ID
   * @returns {boolean}
   */
  instanceExists(instanceId) {
    return this.instances.has(instanceId);
  }

  /**
   * Get all instances
   * @returns {Array}
   */
  getAllInstances() {
    return Array.from(this.instances.values());
  }

  /**
   * Get instance count
   * @returns {number}
   */
  getInstanceCount() {
    return this.instances.size;
  }

  /**
   * Get running instances
   * @returns {Array}
   */
  getRunningInstances() {
    const runningInstances = [];
    
    for (const [instanceId, instance] of this.instances.entries()) {
      const status = this.instanceStatuses.get(instanceId);
      if (status && status.status === 'running') {
        runningInstances.push(instance);
      }
    }
    
    return runningInstances;
  }

  /**
   * Get running instance count
   * @returns {number}
   */
  getRunningInstanceCount() {
    return this.getRunningInstances().length;
  }

  /**
   * Store instance status
   * @param {string} instanceId - Instance ID
   * @param {Object} status - Status object
   */
  storeStatus(instanceId, status) {
    this.instanceStatuses.set(instanceId, status);
  }

  /**
   * Get instance status
   * @param {string} instanceId - Instance ID
   * @returns {Object|null}
   */
  getInstanceStatus(instanceId) {
    return this.instanceStatuses.get(instanceId) || null;
  }

  /**
   * Update instance status
   * @param {string} instanceId - Instance ID
   * @param {Object} updates - Status updates
   */
  updateStatus(instanceId, updates) {
    const status = this.instanceStatuses.get(instanceId);
    if (status) {
      Object.assign(status, updates);
      status.lastHeartbeat = new Date();
    }
  }

  /**
   * Initialize status for instance
   * @param {string} instanceId - Instance ID
   * @returns {Object}
   */
  initializeStatus(instanceId) {
    const status = {
      instanceId,
      status: 'stopped',
      memoryUsage: 0,
      cpuUsage: 0,
      lastHeartbeat: new Date(),
      crashCount: 0,
      isLoggedIn: false,
      unreadCount: 0
    };
    
    this.storeStatus(instanceId, status);
    return status;
  }

  /**
   * Clear all data
   */
  clear() {
    this.instances.clear();
    this.instanceStatuses.clear();
  }
}

module.exports = InstanceStorage;
