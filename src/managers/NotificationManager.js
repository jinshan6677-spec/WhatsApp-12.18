/**
 * NotificationManager - 通知管理器
 * 
 * 负责管理系统通知和未读消息检测
 */

const { Notification } = require('electron');

/**
 * NotificationManager 类
 */
class NotificationManager {
  /**
   * 创建通知管理器
   * @param {Object} [options] - 配置选项
   * @param {Object} [options.mainWindow] - 主窗口实例
   * @param {Object} [options.trayManager] - 托盘管理器实例
   */
  constructor(options = {}) {
    // 主窗口引用
    this.mainWindow = options.mainWindow || null;
    
    // 托盘管理器引用
    this.trayManager = options.trayManager || null;
    
    // 未读消息计数 Map: instanceId -> count
    this.unreadCounts = new Map();
    
    // 通知历史 Map: instanceId -> Array<{timestamp, message}>
    this.notificationHistory = new Map();
    
    // 日志函数
    this.log = this._createLogger();
  }

  /**
   * 创建日志记录器
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [NotificationManager] [${level.toUpperCase()}] ${message}`;
      
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
   * 设置主窗口引用
   * @param {Object} mainWindow - 主窗口实例
   */
  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * 设置托盘管理器引用
   * @param {Object} trayManager - 托盘管理器实例
   */
  setTrayManager(trayManager) {
    this.trayManager = trayManager;
  }

  /**
   * 检测实例的未读消息数
   * @param {string} instanceId - 实例 ID
   * @param {BrowserWindow} window - 浏览器窗口
   * @returns {Promise<number>}
   */
  async detectUnreadCount(instanceId, window) {
    try {
      if (!window || window.isDestroyed()) {
        return 0;
      }

      // 执行 JavaScript 代码检测未读消息数
      // WhatsApp Web 在标题中显示未读消息数，格式如 "(3) WhatsApp"
      const unreadCount = await window.webContents.executeJavaScript(`
        (function() {
          try {
            // 方法 1: 从页面标题获取
            const title = document.title;
            const match = title.match(/\\((\\d+)\\)/);
            if (match) {
              return parseInt(match[1], 10);
            }
            
            // 方法 2: 从未读消息徽章获取
            const unreadBadges = document.querySelectorAll('[data-icon="unread-count"], .unread-count, ._1pJ9J');
            let total = 0;
            unreadBadges.forEach(badge => {
              const count = parseInt(badge.textContent, 10);
              if (!isNaN(count)) {
                total += count;
              }
            });
            
            if (total > 0) {
              return total;
            }
            
            // 方法 3: 计算带有未读标记的聊天数量
            const unreadChats = document.querySelectorAll('[data-testid="cell-frame-container"] [data-testid="unread-count"]');
            return unreadChats.length;
          } catch (error) {
            console.error('Failed to detect unread count:', error);
            return 0;
          }
        })();
      `);

      // 更新未读计数
      const previousCount = this.unreadCounts.get(instanceId) || 0;
      this.unreadCounts.set(instanceId, unreadCount);

      // 如果未读数增加，触发通知
      if (unreadCount > previousCount) {
        this.log('info', `Unread count increased for instance ${instanceId}: ${previousCount} -> ${unreadCount}`);
      }

      // 更新托盘管理器的未读计数
      if (this.trayManager) {
        this.trayManager.updateAccountUnreadCount(instanceId, unreadCount);
      }

      return unreadCount;
    } catch (error) {
      this.log('error', `Failed to detect unread count for instance ${instanceId}:`, error);
      return 0;
    }
  }

  /**
   * 获取实例的未读消息数
   * @param {string} instanceId - 实例 ID
   * @returns {number}
   */
  getUnreadCount(instanceId) {
    return this.unreadCounts.get(instanceId) || 0;
  }

  /**
   * 获取所有实例的未读消息总数
   * @returns {number}
   */
  getTotalUnreadCount() {
    let total = 0;
    for (const count of this.unreadCounts.values()) {
      total += count;
    }
    return total;
  }

  /**
   * 显示系统通知
   * @param {string} instanceId - 实例 ID
   * @param {Object} options - 通知选项
   * @param {string} options.title - 通知标题
   * @param {string} options.body - 通知内容
   * @param {boolean} [options.silent] - 是否静音
   * @param {string} [options.icon] - 通知图标路径
   * @returns {Notification|null}
   */
  showSystemNotification(instanceId, options) {
    try {
      // 检查是否支持通知
      if (!Notification.isSupported()) {
        this.log('warn', 'System notifications are not supported on this platform');
        return null;
      }

      const { title, body, silent = false, icon } = options;

      // 创建通知
      const notification = new Notification({
        title: title || 'WhatsApp',
        body: body || '',
        silent: silent,
        icon: icon
      });

      // 点击通知时聚焦到对应的账号窗口
      notification.on('click', () => {
        this.log('info', `Notification clicked for instance ${instanceId}`);
        // 这里可以通过 IPC 通知主进程聚焦到对应的实例窗口
        if (this.mainWindow) {
          this.mainWindow.focus();
        }
      });

      // 显示通知
      notification.show();

      // 记录通知历史
      this._addToHistory(instanceId, { title, body, timestamp: new Date() });

      this.log('info', `System notification shown for instance ${instanceId}: ${title}`);

      return notification;
    } catch (error) {
      this.log('error', `Failed to show system notification for instance ${instanceId}:`, error);
      return null;
    }
  }

  /**
   * 显示新消息通知
   * @param {string} instanceId - 实例 ID
   * @param {string} accountName - 账号名称
   * @param {number} unreadCount - 未读消息数
   * @param {Object} notificationConfig - 通知配置
   * @returns {Notification|null}
   */
  showNewMessageNotification(instanceId, accountName, unreadCount, notificationConfig) {
    // 检查是否启用通知
    if (!notificationConfig || !notificationConfig.enabled) {
      return null;
    }

    const title = `${accountName} - WhatsApp`;
    const body = unreadCount === 1 
      ? '您有 1 条新消息' 
      : `您有 ${unreadCount} 条新消息`;

    // 如果有托盘管理器，使用它来显示通知（支持点击聚焦）
    if (this.trayManager) {
      this.trayManager.showAccountNotification(instanceId, accountName, unreadCount);
      return null;
    }

    // 否则使用系统通知
    return this.showSystemNotification(instanceId, {
      title,
      body,
      silent: !notificationConfig.sound
    });
  }

  /**
   * 添加到通知历史
   * @private
   * @param {string} instanceId - 实例 ID
   * @param {Object} notification - 通知对象
   */
  _addToHistory(instanceId, notification) {
    if (!this.notificationHistory.has(instanceId)) {
      this.notificationHistory.set(instanceId, []);
    }

    const history = this.notificationHistory.get(instanceId);
    history.push(notification);

    // 只保留最近 50 条通知
    if (history.length > 50) {
      history.shift();
    }
  }

  /**
   * 获取实例的通知历史
   * @param {string} instanceId - 实例 ID
   * @param {number} [limit] - 限制数量
   * @returns {Array}
   */
  getNotificationHistory(instanceId, limit = 10) {
    const history = this.notificationHistory.get(instanceId) || [];
    return history.slice(-limit);
  }

  /**
   * 清除实例的未读计数
   * @param {string} instanceId - 实例 ID
   */
  clearUnreadCount(instanceId) {
    this.unreadCounts.delete(instanceId);
    this.log('info', `Cleared unread count for instance ${instanceId}`);
    
    // 更新托盘管理器
    if (this.trayManager) {
      this.trayManager.updateAccountUnreadCount(instanceId, 0);
    }
  }

  /**
   * 清除实例的通知历史
   * @param {string} instanceId - 实例 ID
   */
  clearNotificationHistory(instanceId) {
    this.notificationHistory.delete(instanceId);
    this.log('info', `Cleared notification history for instance ${instanceId}`);
  }

  /**
   * 清除所有数据
   */
  clearAll() {
    this.unreadCounts.clear();
    this.notificationHistory.clear();
    this.log('info', 'Cleared all notification data');
  }

  /**
   * 启动未读消息监控
   * @param {string} instanceId - 实例 ID
   * @param {BrowserWindow} window - 浏览器窗口
   * @param {Object} accountConfig - 账号配置
   * @param {number} [interval] - 检查间隔（毫秒）
   * @returns {NodeJS.Timeout}
   */
  startUnreadMonitoring(instanceId, window, accountConfig, interval = 5000) {
    this.log('info', `Starting unread monitoring for instance ${instanceId}`);

    const monitoringInterval = setInterval(async () => {
      try {
        // 检测未读消息数
        const previousCount = this.getUnreadCount(instanceId);
        const currentCount = await this.detectUnreadCount(instanceId, window);

        // 如果未读数增加且启用了通知，显示通知
        if (currentCount > previousCount && accountConfig.notifications?.enabled) {
          this.showNewMessageNotification(
            instanceId,
            accountConfig.name,
            currentCount,
            accountConfig.notifications
          );
        }

        // 更新主窗口的未读徽章显示
        if (this.mainWindow) {
          this.mainWindow.updateAccountStatus(instanceId, {
            unreadCount: currentCount
          });
        }
      } catch (error) {
        this.log('error', `Unread monitoring error for instance ${instanceId}:`, error);
      }
    }, interval);

    return monitoringInterval;
  }

  /**
   * 停止未读消息监控
   * @param {NodeJS.Timeout} monitoringInterval - 监控定时器
   */
  stopUnreadMonitoring(monitoringInterval) {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      this.log('info', 'Stopped unread monitoring');
    }
  }
}

module.exports = NotificationManager;
