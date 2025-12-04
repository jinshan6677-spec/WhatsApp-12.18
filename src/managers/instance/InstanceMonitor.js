/**
 * InstanceMonitor - Instance monitoring and health checks
 * Handles instance health monitoring and resource tracking
 */

class InstanceMonitor {
  constructor(storage, logger) {
    this.storage = storage;
    this.log = logger;
    this.monitoringInterval = null;
    this.unreadMonitoringIntervals = new Map();
  }

  /**
   * Setup instance monitoring
   * @param {string} instanceId - Instance ID
   * @param {BrowserWindow} window - Browser window
   */
  setupInstanceMonitoring(instanceId, window) {
    this.log('info', `Setting up monitoring for instance ${instanceId}`);

    // Monitor window events
    window.on('unresponsive', () => {
      this.log('warn', `Instance ${instanceId} became unresponsive`);
      this.storage.updateStatus(instanceId, { status: 'error' });
    });

    window.on('responsive', () => {
      this.log('info', `Instance ${instanceId} became responsive again`);
      this.storage.updateStatus(instanceId, { status: 'running' });
    });

    window.webContents.on('crashed', () => {
      this.log('error', `Instance ${instanceId} crashed`);
      const status = this.storage.getInstanceStatus(instanceId);
      if (status) {
        this.storage.updateStatus(instanceId, {
          status: 'crashed',
          crashCount: status.crashCount + 1
        });
      }
    });
  }

  /**
   * Start global monitoring
   */
  startGlobalMonitoring() {
    if (this.monitoringInterval) {
      this.log('warn', 'Global monitoring is already running');
      return;
    }

    this.log('info', 'Starting global instance monitoring');

    this.monitoringInterval = setInterval(() => {
      this.checkAllInstances();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop global monitoring
   */
  stopGlobalMonitoring() {
    if (this.monitoringInterval) {
      this.log('info', 'Stopping global instance monitoring');
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Check all instances
   */
  async checkAllInstances() {
    const instances = this.storage.getAllInstances();

    for (const instance of instances) {
      await this.checkInstanceHealth(instance.instanceId);
    }
  }

  /**
   * Check instance health
   * @param {string} instanceId - Instance ID
   */
  async checkInstanceHealth(instanceId) {
    try {
      const instance = this.storage.getInstance(instanceId);
      if (!instance || !instance.window) {
        return;
      }

      const window = instance.window;

      // Check if window is destroyed
      if (window.isDestroyed()) {
        this.storage.updateStatus(instanceId, { status: 'stopped' });
        return;
      }

      // Get memory usage
      const memoryInfo = await window.webContents.getProcessMemoryInfo();
      const memoryUsage = Math.round(memoryInfo.private / 1024); // Convert to MB

      // Update status
      this.storage.updateStatus(instanceId, {
        memoryUsage,
        lastHeartbeat: new Date()
      });

    } catch (error) {
      this.log('error', `Failed to check health for instance ${instanceId}:`, error);
    }
  }

  /**
   * Start unread monitoring for instance
   * @param {string} instanceId - Instance ID
   * @param {BrowserWindow} window - Browser window
   */
  startUnreadMonitoring(instanceId, window) {
    // Clear existing interval if any
    this.stopUnreadMonitoring(instanceId);

    const interval = setInterval(async () => {
      try {
        if (window.isDestroyed()) {
          this.stopUnreadMonitoring(instanceId);
          return;
        }

        // Execute script to get unread count
        const unreadCount = await window.webContents.executeJavaScript(`
          (function() {
            const unreadElements = document.querySelectorAll('[data-testid="cell-frame-container"] span[aria-label*="unread"]');
            return unreadElements.length;
          })();
        `);

        this.storage.updateStatus(instanceId, { unreadCount });

      } catch (error) {
        // Silently fail - window might be loading
      }
    }, 5000); // Check every 5 seconds

    this.unreadMonitoringIntervals.set(instanceId, interval);
  }

  /**
   * Stop unread monitoring for instance
   * @param {string} instanceId - Instance ID
   */
  stopUnreadMonitoring(instanceId) {
    const interval = this.unreadMonitoringIntervals.get(instanceId);
    if (interval) {
      clearInterval(interval);
      this.unreadMonitoringIntervals.delete(instanceId);
    }
  }

  /**
   * Cleanup all monitoring
   */
  cleanup() {
    this.stopGlobalMonitoring();

    // Stop all unread monitoring
    for (const [instanceId] of this.unreadMonitoringIntervals) {
      this.stopUnreadMonitoring(instanceId);
    }
  }
}

module.exports = InstanceMonitor;
