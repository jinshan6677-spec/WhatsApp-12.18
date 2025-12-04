/**
 * Container module exports
 * @module core/container
 */

const {
  DependencyContainer,
  ServiceScope,
  Scope,
  ServiceRegistration,
  getGlobalContainer,
  createContainer
} = require('./DependencyContainer');

module.exports = {
  DependencyContainer,
  ServiceScope,
  Scope,
  ServiceRegistration,
  getGlobalContainer,
  createContainer
};
