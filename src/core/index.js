/**
 * 核心模块统一导出
 * 
 * 提供所有核心模块的统一导入接口
 */

const managers = require('./managers');
const models = require('./models');
const services = require('./services');
const eventbus = require('./eventbus');
const container = require('./container');
const config = require('./config');
const errors = require('./errors');
const state = require('./state');

module.exports = {
  managers,
  models,
  services,
  eventbus,
  container,
  config,
  errors,
  state
};
