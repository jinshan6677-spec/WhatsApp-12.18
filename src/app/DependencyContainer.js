/**
 * 依赖注入容器
 * 
 * 提供统一的依赖管理和注入机制
 * 支持单例、工厂方法和条件注入
 */

const { APP_INFO } = require('./constants');

/**
 * 依赖注入容器类
 */
class DependencyContainer {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.singletons = new Set();
    this.resolving = new Set();
    this.cached = new Map();
    this.logger = this._createLogger();
  }

  /**
   * 注册服务（单例）
   * @param {string} name - 服务名称
   * @param {*} service - 服务实例
   */
  registerSingleton(name, service) {
    this.services.set(name, service);
    this.singletons.add(name);
    this.logger.debug('Registered singleton service', { name });
  }

  /**
   * 注册服务工厂
   * @param {string} name - 服务名称
   * @param {Function} factory - 工厂函数
   */
  registerFactory(name, factory) {
    this.factories.set(name, factory);
    this.logger.debug('Registered factory service', { name });
  }

  /**
   * 注册异步服务工厂
   * @param {string} name - 服务名称
   * @param {Function} asyncFactory - 异步工厂函数
   */
  registerAsyncFactory(name, asyncFactory) {
    this.factories.set(name, asyncFactory);
    this.logger.debug('Registered async factory service', { name });
  }

  /**
   * 获取服务
   * @param {string} name - 服务名称
   * @param {Object} [options] - 选项
   * @returns {Promise<*>} 服务实例
   */
  async get(name, options = {}) {
    // 检查是否正在解析（防止循环依赖）
    if (this.resolving.has(name)) {
      throw new Error(`Circular dependency detected while resolving: ${name}`);
    }

    // 返回缓存的实例
    if (this.cached.has(name)) {
      return this.cached.get(name);
    }

    // 标记开始解析
    this.resolving.add(name);

    try {
      let service;

      // 从单例注册中获取
      if (this.services.has(name) && this.singletons.has(name)) {
        service = this.services.get(name);
        this.cached.set(name, service);
      }
      // 从工厂获取
      else if (this.factories.has(name)) {
        const factory = this.factories.get(name);
        
        if (factory.constructor.name === 'AsyncFunction') {
          service = await factory(options);
        } else {
          service = factory(options);
        }
        
        // 如果是单例，缓存结果
        if (this.singletons.has(name)) {
          this.cached.set(name, service);
        }
      }
      // 从服务注册中获取（非单例）
      else if (this.services.has(name)) {
        service = this.services.get(name);
      }
      else {
        throw new Error(`Service not found: ${name}`);
      }

      this.logger.debug('Resolved service', { name });
      return service;

    } finally {
      // 清除解析标记
      this.resolving.delete(name);
    }
  }

  /**
   * 检查服务是否存在
   * @param {string} name - 服务名称
   * @returns {boolean} 是否存在
   */
  has(name) {
    return this.services.has(name) || this.factories.has(name);
  }

  /**
   * 移除服务
   * @param {string} name - 服务名称
   */
  remove(name) {
    this.services.delete(name);
    this.factories.delete(name);
    this.singletons.delete(name);
    this.cached.delete(name);
    this.logger.debug('Removed service', { name });
  }

  /**
   * 清空容器
   */
  clear() {
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
    this.cached.clear();
    this.resolving.clear();
    this.logger.info('Container cleared');
  }

  /**
   * 获取所有服务名称
   * @returns {Array} 服务名称列表
   */
  getServiceNames() {
    return [
      ...this.services.keys(),
      ...this.factories.keys()
    ];
  }

  /**
   * 获取容器状态
   * @returns {Object} 容器状态
   */
  getStatus() {
    return {
      totalServices: this.services.size + this.factories.size,
      singletons: this.singletons.size,
      cached: this.cached.size,
      resolving: Array.from(this.resolving),
      serviceNames: this.getServiceNames()
    };
  }

  /**
   * 创建子容器
   * @returns {DependencyContainer} 子容器实例
   */
  createChild() {
    const child = new DependencyContainer();
    
    // 继承父容器的服务（但创建独立的缓存）
    for (const [name, service] of this.services) {
      if (this.singletons.has(name)) {
        child.services.set(name, service);
        child.singletons.add(name);
      }
    }
    
    for (const [name, factory] of this.factories) {
      child.factories.set(name, factory);
    }

    this.logger.debug('Created child container');
    return child;
  }

  /**
   * 批量注册服务
   * @param {Object} services - 服务映射
   * @param {boolean} [isSingleton=false] - 是否为单例
   */
  registerServices(services, isSingleton = false) {
    for (const [name, service] of Object.entries(services)) {
      if (isSingleton) {
        this.registerSingleton(name, service);
      } else {
        this.services.set(name, service);
      }
    }
    this.logger.debug('Registered batch services', { 
      count: Object.keys(services).length,
      isSingleton 
    });
  }

  /**
   * 条件注册
   * @param {Function} condition - 条件函数
   * @param {Object} services - 服务映射
   * @param {boolean} [isSingleton=false] - 是否为单例
   */
  registerIf(condition, services, isSingleton = false) {
    if (condition()) {
      this.registerServices(services, isSingleton);
      return true;
    }
    return false;
  }

  /**
   * 环境变量条件注册
   * @param {string} envVar - 环境变量名
   * @param {*} envValue - 环境变量值
   * @param {Object} services - 服务映射
   * @param {boolean} [isSingleton=false] - 是否为单例
   */
  registerIfEnv(envVar, envValue, services, isSingleton = false) {
    const condition = () => process.env[envVar] === envValue;
    return this.registerIf(condition, services, isSingleton);
  }

  /**
   * 创建日志记录器
   * @returns {Object} 日志记录器
   */
  _createLogger() {
    return {
      debug: (message, data) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[DependencyContainer] ${message}`, data || '');
        }
      },
      info: (message, data) => {
        console.info(`[DependencyContainer] ${message}`, data || '');
      },
      warn: (message, data) => {
        console.warn(`[DependencyContainer] ${message}`, data || '');
      },
      error: (message, data) => {
        console.error(`[DependencyContainer] ${message}`, data || '');
      }
    };
  }
}

// 全局容器实例
let globalContainer = null;

/**
 * 获取全局依赖容器
 * @returns {DependencyContainer} 全局容器实例
 */
function getGlobalContainer() {
  if (!globalContainer) {
    globalContainer = new DependencyContainer();
  }
  return globalContainer;
}

/**
 * 创建新的依赖容器
 * @returns {DependencyContainer} 新的容器实例
 */
function createContainer() {
  return new DependencyContainer();
}

module.exports = {
  DependencyContainer,
  getGlobalContainer,
  createContainer
};
