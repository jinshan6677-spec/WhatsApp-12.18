/**
 * 模块别名配置
 * 简化导入路径，避免复杂的相对路径引用
 */

const path = require('path');

const aliases = {
  // 应用核心
  '@app': path.resolve(__dirname, '../app'),
  '@bootstrap': path.resolve(__dirname, '../app/bootstrap'),
  '@container': path.resolve(__dirname, '../app/DependencyContainer'),
  '@constants': path.resolve(__dirname, '../app/constants'),
  
  // 核心模块
  '@core': path.resolve(__dirname, '../core'),
  '@managers': path.resolve(__dirname, '../core/managers'),
  '@models': path.resolve(__dirname, '../core/models'),
  '@services': path.resolve(__dirname, '../core/services'),
  
  // UI模块
  '@ui': path.resolve(__dirname, '../ui'),
  '@main-window': path.resolve(__dirname, '../ui/main-window'),
  
  // 共享模块
  '@shared': path.resolve(__dirname, '../shared'),
  '@utils': path.resolve(__dirname, '../shared/utils'),
  '@validators': path.resolve(__dirname, '../shared/validators'),
  '@decorators': path.resolve(__dirname, '../shared/decorators'),
  
  // 功能模块
  '@features': path.resolve(__dirname, '../features'),
  '@translation': path.resolve(__dirname, '../translation'),
  '@ipc': path.resolve(__dirname, '../ipc'),
  
  // 工具
  '@utils-root': path.resolve(__dirname, '../utils'),
  '@managers-root': path.resolve(__dirname, '../managers'),
  '@services-root': path.resolve(__dirname, '../services')
};

module.exports = aliases;