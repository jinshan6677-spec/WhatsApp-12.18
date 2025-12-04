/**
 * 系统托盘管理器
 * 负责创建和管理系统托盘图标、菜单和通知
 * 支持多实例架构，显示所有账号的未读消息总数
 */

const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

class TrayManager {
  constructor() {
    this.tray = null;
    this.mainWindow = null;
    this.unreadCount = 0;
    this.minimizeToTray = false;
    
    // 多实例支持
    this.instanceManager = null;
    this.notificationManager = null;
    this.accountInstances = new Map(); // instanceId -> { name, window, unreadCount }
  }

  /**
   * 初始化系统托盘
   * @param {BrowserWindow} mainWindow - 主窗口实例
   * @param {Object} config - 托盘配置
   * @param {Object} [options] - 额外选项
   * @param {Object} [options.instanceManager] - 实例管理器
   * @param {Object} [options.notificationManager] - 通知管理器
   */
  initialize(mainWindow, config = {}, options = {}) {
    this.mainWindow = mainWindow;
    this.minimizeToTray = config.minimizeToTray !== false;
    
    // 设置管理器引用
    this.instanceManager = options.instanceManager || null;
    this.notificationManager = options.notificationManager || null;

    // 创建托盘图标
    this.createTray();

    // 设置窗口事件监听
    this.setupWindowEvents();

    console.log('[TrayManager] 系统托盘初始化完成');
  }

  /**
   * 创建系统托盘
   */
  createTray() {
    // 创建托盘图标
    const iconPath = this.getTrayIconPath();
    const icon = nativeImage.createFromPath(iconPath);
    
    this.tray = new Tray(icon);
    this.tray.setToolTip('WhatsApp Desktop');

    // 创建托盘菜单
    this.updateTrayMenu();

    // 托盘图标点击事件
    this.tray.on('click', () => {
      this.toggleMainWindow();
    });

    // Windows 和 Linux 上的右键点击
    this.tray.on('right-click', () => {
      this.tray.popUpContextMenu();
    });
  }

  /**
   * 获取托盘图标路径
   */
  getTrayIconPath() {
    // 根据平台选择合适的图标
    const platform = process.platform;
    let iconName = 'icon.png';

    if (platform === 'win32') {
      iconName = 'icon.ico';
    } else if (platform === 'darwin') {
      iconName = 'iconTemplate.png'; // macOS 使用 Template 图标
    }

    // 尝试从 resources 目录加载图标
    let iconPath = path.join(__dirname, '../../resources', iconName);
    
    // 如果不存在，使用默认图标
    const fs = require('fs');
    if (!fs.existsSync(iconPath)) {
      // 创建一个简单的默认图标
      iconPath = this.createDefaultIcon();
    }

    return iconPath;
  }

  /**
   * 创建默认图标（如果没有图标文件）
   */
  createDefaultIcon() {
    // 创建一个简单的 16x16 图标
    const icon = nativeImage.createEmpty();
    return icon;
  }

  /**
   * 更新托盘菜单
   */
  updateTrayMenu() {
    const menuTemplate = [
      {
        label: '显示主窗口',
        click: () => {
          this.showMainWindow();
        }
      },
      {
        label: '隐藏主窗口',
        click: () => {
          this.hideMainWindow();
        }
      },
      {
        type: 'separator'
      }
    ];
    
    // 如果有实例管理器，添加账号实例菜单
    if (this.instanceManager) {
      const runningInstances = this.instanceManager.getRunningInstances();
      
      if (runningInstances.length > 0) {
        menuTemplate.push({
          label: '账号实例',
          submenu: runningInstances.map(instance => {
            const unreadCount = this.notificationManager 
              ? this.notificationManager.getUnreadCount(instance.instanceId)
              : 0;
            
            const label = unreadCount > 0 
              ? `${instance.config.name} (${unreadCount})`
              : instance.config.name;
            
            return {
              label: label,
              click: () => {
                this.focusAccountWindow(instance.instanceId);
              }
            };
          })
        });
        
        menuTemplate.push({
          type: 'separator'
        });
      }
    }
    
    menuTemplate.push(
      {
        label: this.minimizeToTray ? '✓ 最小化到托盘' : '最小化到托盘',
        type: 'checkbox',
        checked: this.minimizeToTray,
        click: (menuItem) => {
          this.minimizeToTray = menuItem.checked;
          this.updateTrayMenu();
        }
      },
      {
        type: 'separator'
      },
      {
        label: '退出应用',
        click: () => {
          this.quitApplication();
        }
      }
    );

    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    this.tray.setContextMenu(contextMenu);
  }

  /**
   * 设置窗口事件监听
   */
  setupWindowEvents() {
    if (!this.mainWindow) return;

    // 监听窗口关闭事件
    // 注意：不再拦截 minimize 事件，让窗口正常最小化到任务栏
    this.mainWindow.on('close', (event) => {
      if (this.minimizeToTray && !app.isQuitting) {
        event.preventDefault();
        this.hideMainWindow();
      }
    });
  }

  /**
   * 切换主窗口显示/隐藏
   */
  toggleMainWindow() {
    if (!this.mainWindow) return;

    if (this.mainWindow.isVisible()) {
      this.hideMainWindow();
    } else {
      this.showMainWindow();
    }
  }

  /**
   * 显示主窗口
   */
  showMainWindow() {
    if (!this.mainWindow) return;

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }

    this.mainWindow.show();
    this.mainWindow.focus();
  }

  /**
   * 隐藏主窗口
   */
  hideMainWindow() {
    if (!this.mainWindow) return;
    this.mainWindow.hide();
  }

  /**
   * 退出应用
   */
  quitApplication() {
    app.isQuitting = true;
    app.quit();
  }

  /**
   * 注册账号实例
   * @param {string} instanceId - 实例 ID
   * @param {string} name - 账号名称
   * @param {BrowserWindow} window - 浏览器窗口
   */
  registerAccountInstance(instanceId, name, window) {
    this.accountInstances.set(instanceId, {
      name,
      window,
      unreadCount: 0
    });
    
    console.log(`[TrayManager] Registered account instance: ${name} (${instanceId})`);
    this.updateTrayMenu();
  }

  /**
   * 注销账号实例
   * @param {string} instanceId - 实例 ID
   */
  unregisterAccountInstance(instanceId) {
    this.accountInstances.delete(instanceId);
    console.log(`[TrayManager] Unregistered account instance: ${instanceId}`);
    this.updateTotalUnreadCount();
    this.updateTrayMenu();
  }

  /**
   * 聚焦到指定账号窗口
   * @param {string} instanceId - 实例 ID
   */
  focusAccountWindow(instanceId) {
    const accountInfo = this.accountInstances.get(instanceId);
    if (accountInfo && accountInfo.window && !accountInfo.window.isDestroyed()) {
      if (accountInfo.window.isMinimized()) {
        accountInfo.window.restore();
      }
      accountInfo.window.show();
      accountInfo.window.focus();
      console.log(`[TrayManager] Focused account window: ${instanceId}`);
    } else if (this.instanceManager) {
      // 如果实例信息不在本地缓存，尝试从实例管理器获取
      const instance = this.instanceManager.instances.get(instanceId);
      if (instance && instance.window && !instance.window.isDestroyed()) {
        if (instance.window.isMinimized()) {
          instance.window.restore();
        }
        instance.window.show();
        instance.window.focus();
        console.log(`[TrayManager] Focused account window from InstanceManager: ${instanceId}`);
      }
    }
  }

  /**
   * 更新账号实例的未读消息计数
   * @param {string} instanceId - 实例 ID
   * @param {number} count - 未读消息数
   */
  updateAccountUnreadCount(instanceId, count) {
    const accountInfo = this.accountInstances.get(instanceId);
    if (accountInfo) {
      accountInfo.unreadCount = count;
      this.updateTotalUnreadCount();
      this.updateTrayMenu();
    }
  }

  /**
   * 更新总未读消息计数
   */
  updateTotalUnreadCount() {
    // 如果有通知管理器，使用它的总计数
    if (this.notificationManager) {
      this.unreadCount = this.notificationManager.getTotalUnreadCount();
    } else {
      // 否则从本地缓存计算
      let total = 0;
      for (const accountInfo of this.accountInstances.values()) {
        total += accountInfo.unreadCount || 0;
      }
      this.unreadCount = total;
    }
    
    this.updateTrayIcon();
    this.updateTrayTooltip();
  }

  /**
   * 更新未读消息计数（向后兼容单实例模式）
   * @param {number} count - 未读消息数
   */
  updateUnreadCount(count) {
    this.unreadCount = count;
    this.updateTrayIcon();
    this.updateTrayTooltip();
  }

  /**
   * 更新托盘图标（显示未读消息数）
   */
  updateTrayIcon() {
    if (!this.tray) return;

    // 如果有未读消息，在图标上显示徽章
    if (this.unreadCount > 0) {
      // 在 Windows 和 Linux 上，可以通过覆盖图标来显示未读数
      // 在 macOS 上，可以使用 app.dock.setBadge()
      if (process.platform === 'darwin') {
        app.dock.setBadge(this.unreadCount.toString());
      } else {
        // 为其他平台创建带徽章的图标
        const iconWithBadge = this.createIconWithBadge(this.unreadCount);
        if (iconWithBadge) {
          this.tray.setImage(iconWithBadge);
        }
      }
    } else {
      // 清除徽章
      if (process.platform === 'darwin') {
        app.dock.setBadge('');
      } else {
        // 恢复原始图标
        const iconPath = this.getTrayIconPath();
        const icon = nativeImage.createFromPath(iconPath);
        this.tray.setImage(icon);
      }
    }
  }

  /**
   * 创建带徽章的图标
   * @param {number} count - 未读消息数
   */
  createIconWithBadge(count) {
    // 这里可以使用 canvas 或其他方法创建带徽章的图标
    // 简化实现：返回 null，使用 tooltip 显示未读数
    return null;
  }

  /**
   * 更新托盘提示文本
   */
  updateTrayTooltip() {
    if (!this.tray) return;

    let tooltip = 'WhatsApp Desktop';
    if (this.unreadCount > 0) {
      tooltip += ` (${this.unreadCount} 条未读消息)`;
    }

    this.tray.setToolTip(tooltip);
  }

  /**
   * 显示托盘通知
   * @param {string} title - 通知标题
   * @param {string} body - 通知内容
   * @param {Function|string} onClick - 点击通知的回调或实例 ID
   */
  showNotification(title, body, onClick) {
    if (!this.tray) return;

    // 使用 Electron 的 Notification API
    const { Notification } = require('electron');

    if (Notification.isSupported()) {
      const notification = new Notification({
        title: title,
        body: body,
        icon: this.getTrayIconPath(),
        silent: false
      });

      // 如果 onClick 是字符串，假设它是实例 ID
      if (typeof onClick === 'string') {
        const instanceId = onClick;
        notification.on('click', () => {
          this.focusAccountWindow(instanceId);
        });
      } else if (typeof onClick === 'function') {
        notification.on('click', onClick);
      }

      notification.show();
    } else {
      // 降级到托盘气泡通知（仅 Windows）
      if (process.platform === 'win32') {
        this.tray.displayBalloon({
          title: title,
          content: body,
          icon: this.getTrayIconPath()
        });

        if (typeof onClick === 'string') {
          const instanceId = onClick;
          this.tray.once('balloon-click', () => {
            this.focusAccountWindow(instanceId);
          });
        } else if (typeof onClick === 'function') {
          this.tray.once('balloon-click', onClick);
        }
      }
    }
  }

  /**
   * 显示账号新消息通知
   * @param {string} instanceId - 实例 ID
   * @param {string} accountName - 账号名称
   * @param {number} unreadCount - 未读消息数
   */
  showAccountNotification(instanceId, accountName, unreadCount) {
    const title = `${accountName} - WhatsApp`;
    const body = unreadCount === 1 
      ? '您有 1 条新消息' 
      : `您有 ${unreadCount} 条新消息`;
    
    // 点击通知时聚焦到对应的账号窗口
    this.showNotification(title, body, instanceId);
  }

  /**
   * 销毁托盘
   */
  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }

    console.log('[TrayManager] 系统托盘已销毁');
  }
}

module.exports = TrayManager;
