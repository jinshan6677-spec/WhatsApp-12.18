/**
 * Configuration Management Module
 * 
 * @module core/config
 */

'use strict';

const { 
  ConfigProvider, 
  createConfigProvider, 
  getGlobalConfigProvider 
} = require('./ConfigProvider');

module.exports = {
  ConfigProvider,
  createConfigProvider,
  getGlobalConfigProvider
};
