/**
 * InstanceLifecycle - Instance lifecycle management
 * Handles instance creation, destruction, and restart
 */

const { BrowserWindow } = require('electron');

class InstanceLifecycle {
  constructor(storage, logger, options = {}) {
    this.storage = storage;
    this.log = logger;
    this.userDataPath = options.userDataPath;
    this.maxInstances = options.maxInstances || 30;
    this.sessionManager = options.sessionManager;
    this.translationIntegration = options.translationIntegration;
  }

  /**
   * Create instance
   * @param {string} instanceId - Instance ID
   * @param {Object} config - Instance configuration
   * @returns {Promise<{success: boolean, window?: BrowserWindow, error?: string}>}
   */
  async createInstance(instanceId, config) {
    try {
      this.log('info', `Creating instance ${instanceId}`);

      // Check if instance already exists
      if (this.storage.instanceExists(instanceId)) {
        throw new Error(`Instance ${instanceId} already exists`);
      }

      // Check max instances limit
      if (this.storage.getInstanceCount() >= this.maxInstances) {
        throw new Error(`Maximum instance limit (${this.maxInstances}) reached`);
      }

      // Initialize status
      const status = this.storage.initializeStatus(instanceId);
      status.status = 'starting';

      // Create browser window
      const window = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: `persist:account_${instanceId}`
        }
      });

      // Store instance
      const instanceInfo = {
        instanceId,
        window,
        config,
        status
      };

      this.storage.storeInstance(instanceId, instanceInfo);

      // Update status
      this.storage.updateStatus(instanceId, {
        status: 'running',
        startTime: new Date()
      });

      this.log('info', `Instance ${instanceId} created successfully`);

      return {
        success: true,
        window
      };
    } catch (error) {
      this.log('error', `Failed to create instance ${instanceId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Destroy instance
   * @param {string} instanceId - Instance ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async destroyInstance(instanceId) {
    try {
      this.log('info', `Destroying instance ${instanceId}`);

      const instance = this.storage.getInstance(instanceId);
      if (!instance) {
        throw new Error(`Instance ${instanceId} not found`);
      }

      // Close window
      if (instance.window && !instance.window.isDestroyed()) {
        instance.window.close();
      }

      // Remove from storage
      this.storage.removeInstance(instanceId);

      this.log('info', `Instance ${instanceId} destroyed successfully`);

      return { success: true };
    } catch (error) {
      this.log('error', `Failed to destroy instance ${instanceId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restart instance
   * @param {string} instanceId - Instance ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async restartInstance(instanceId) {
    try {
      this.log('info', `Restarting instance ${instanceId}`);

      const instance = this.storage.getInstance(instanceId);
      if (!instance) {
        throw new Error(`Instance ${instanceId} not found`);
      }

      const config = instance.config;

      // Destroy old instance
      await this.destroyInstance(instanceId);

      // Create new instance
      const result = await this.createInstance(instanceId, config);

      if (!result.success) {
        throw new Error(result.error);
      }

      this.log('info', `Instance ${instanceId} restarted successfully`);

      return { success: true };
    } catch (error) {
      this.log('error', `Failed to restart instance ${instanceId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = InstanceLifecycle;
