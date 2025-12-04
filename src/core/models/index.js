/**
 * 数据模型统一导出
 * 
 * 提供所有数据模型的统一导入接口
 * 避免使用复杂的相对路径引用
 */

// 引入数据模型
const AccountConfig = require('../../models/AccountConfig');

// 导出统一接口
module.exports = {
  // 数据模型类
  AccountConfig,
  
  // 便捷创建方法
  createAccountConfig: (data) => new AccountConfig(data),
  
  // 验证方法
  validateAccountConfig: (config) => AccountConfig.validate(config),
};
