'use strict';

/**
 * Property-based tests for DependencyContainer
 * 
 * Tests the following properties:
 * - Property 23: Service Scope Behavior
 * - Property 24: Circular Dependency Detection
 * - Property 25: Lazy Service Initialization
 * - Property 26: Service Not Found Error
 * - Property 27: Service Decoration
 * - Property 28: Service Interface Validation
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
 */

const fc = require('fast-check');
const { DependencyContainer, ServiceScope, createContainer } = require('../DependencyContainer');

describe('DependencyContainer Property Tests', () => {
  // Arbitraries for generating test data
  const serviceNameArbitrary = fc.string({ minLength: 1, maxLength: 30 })
    .filter(s => s.trim().length > 0 && !s.includes(' '));

  const serviceValueArbitrary = fc.oneof(
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      value: fc.integer()
    }),
    fc.record({
      type: fc.constantFrom('service', 'repository', 'manager'),
      enabled: fc.boolean()
    })
  );

  /**
   * **Feature: architecture-refactoring, Property 23: Service Scope Behavior**
   * **Validates: Requirements 7.1**
   * 
   * For any service registered as singleton, all resolutions should return the same instance.
   * For transient services, each resolution should return a new instance.
   */
  describe('Property 23: Service Scope Behavior', () => {
    test('singleton services return the same instance on multiple resolutions', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          serviceValueArbitrary,
          fc.integer({ min: 2, max: 10 }),
          (serviceName, serviceValue, resolutionCount) => {
            const container = createContainer();
            
            // Register as singleton with a factory that creates new objects
            container.registerSingleton(serviceName, () => ({ ...serviceValue }));
            
            // Resolve multiple times
            const instances = [];
            for (let i = 0; i < resolutionCount; i++) {
              instances.push(container.resolve(serviceName));
            }
            
            // All instances should be the exact same reference
            const firstInstance = instances[0];
            instances.forEach(instance => {
              expect(instance).toBe(firstInstance);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('transient services return new instances on each resolution', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          serviceValueArbitrary,
          fc.integer({ min: 2, max: 10 }),
          (serviceName, serviceValue, resolutionCount) => {
            const container = createContainer();
            
            // Register as transient
            container.registerTransient(serviceName, () => ({ ...serviceValue }));
            
            // Resolve multiple times
            const instances = [];
            for (let i = 0; i < resolutionCount; i++) {
              instances.push(container.resolve(serviceName));
            }
            
            // All instances should be different references
            for (let i = 0; i < instances.length; i++) {
              for (let j = i + 1; j < instances.length; j++) {
                expect(instances[i]).not.toBe(instances[j]);
              }
            }
            
            // But they should have equivalent values
            instances.forEach(instance => {
              expect(instance).toEqual(serviceValue);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('scoped services return same instance within scope, different across scopes', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          serviceValueArbitrary,
          fc.integer({ min: 2, max: 5 }),
          fc.integer({ min: 2, max: 5 }),
          (serviceName, serviceValue, scopeCount, resolutionsPerScope) => {
            const container = createContainer();
            
            // Register as scoped
            container.registerScoped(serviceName, () => ({ ...serviceValue }));
            
            const scopeInstances = [];
            
            // Create multiple scopes
            for (let s = 0; s < scopeCount; s++) {
              const scope = container.createScope();
              const instances = [];
              
              // Resolve multiple times within the same scope
              for (let r = 0; r < resolutionsPerScope; r++) {
                instances.push(container.resolve(serviceName, scope));
              }
              
              // All instances within the scope should be the same
              const firstInScope = instances[0];
              instances.forEach(instance => {
                expect(instance).toBe(firstInScope);
              });
              
              scopeInstances.push(firstInScope);
            }
            
            // Instances from different scopes should be different
            for (let i = 0; i < scopeInstances.length; i++) {
              for (let j = i + 1; j < scopeInstances.length; j++) {
                expect(scopeInstances[i]).not.toBe(scopeInstances[j]);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: architecture-refactoring, Property 24: Circular Dependency Detection**
   * **Validates: Requirements 7.2**
   * 
   * For any service dependency graph containing a cycle, attempting to resolve
   * any service in the cycle should throw an error describing the circular dependency path.
   */
  describe('Property 24: Circular Dependency Detection', () => {
    test('direct circular dependency is detected', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          (serviceName) => {
            const container = createContainer();
            
            // Service depends on itself
            container.registerSingleton(serviceName, (c) => {
              return { dep: c.resolve(serviceName) };
            });
            
            // Should throw circular dependency error
            expect(() => container.resolve(serviceName)).toThrow(/[Cc]ircular dependency/);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('indirect circular dependency is detected', () => {
      fc.assert(
        fc.property(
          fc.array(serviceNameArbitrary, { minLength: 2, maxLength: 5 })
            .filter(arr => new Set(arr).size === arr.length), // Ensure unique names
          (serviceNames) => {
            const container = createContainer();
            
            // Create a cycle: A -> B -> C -> ... -> A
            for (let i = 0; i < serviceNames.length; i++) {
              const currentName = serviceNames[i];
              const nextName = serviceNames[(i + 1) % serviceNames.length];
              
              container.registerSingleton(currentName, (c) => {
                return { dep: c.resolve(nextName) };
              });
            }
            
            // Resolving any service in the cycle should throw
            expect(() => container.resolve(serviceNames[0])).toThrow(/[Cc]ircular dependency/);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error message contains the dependency path', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          serviceNameArbitrary.filter(s => s !== 'serviceA'),
          (serviceA, serviceB) => {
            // Ensure different names
            const actualB = serviceA === serviceB ? serviceB + '_b' : serviceB;
            const container = createContainer();
            
            // A -> B -> A
            container.registerSingleton(serviceA, (c) => ({ dep: c.resolve(actualB) }));
            container.registerSingleton(actualB, (c) => ({ dep: c.resolve(serviceA) }));
            
            // Should throw circular dependency error
            expect(() => container.resolve(serviceA)).toThrow(/[Cc]ircular dependency/);
            
            try {
              container.resolve(serviceA);
            } catch (error) {
              // Error should mention the services involved
              expect(error.message).toContain(serviceA);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: architecture-refactoring, Property 25: Lazy Service Initialization**
   * **Validates: Requirements 7.3**
   * 
   * For any service registered as lazy, the factory function should not be called
   * until the service is first resolved.
   */
  describe('Property 25: Lazy Service Initialization', () => {
    test('lazy service factory is not called until resolution', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          serviceValueArbitrary,
          (serviceName, serviceValue) => {
            const container = createContainer();
            let factoryCalled = false;
            
            // Register lazy service
            container.registerLazy(serviceName, () => {
              factoryCalled = true;
              return { ...serviceValue };
            });
            
            // Factory should not be called yet
            expect(factoryCalled).toBe(false);
            
            // Resolve the service
            const instance = container.resolve(serviceName);
            
            // Now factory should have been called
            expect(factoryCalled).toBe(true);
            expect(instance).toEqual(serviceValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('lazy singleton factory is called only once', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          serviceValueArbitrary,
          fc.integer({ min: 2, max: 10 }),
          (serviceName, serviceValue, resolutionCount) => {
            const container = createContainer();
            let factoryCallCount = 0;
            
            // Register lazy singleton
            container.registerLazy(serviceName, () => {
              factoryCallCount++;
              return { ...serviceValue };
            }, ServiceScope.Singleton);
            
            // Resolve multiple times
            for (let i = 0; i < resolutionCount; i++) {
              container.resolve(serviceName);
            }
            
            // Factory should have been called exactly once
            expect(factoryCallCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: architecture-refactoring, Property 26: Service Not Found Error**
   * **Validates: Requirements 7.4**
   * 
   * For any attempt to resolve a non-existent service, the error message should
   * include the requested service name and a list of similar available services.
   */
  describe('Property 26: Service Not Found Error', () => {
    test('error includes requested service name', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          (serviceName) => {
            const container = createContainer();
            
            // Should throw service not found error
            expect(() => container.resolve(serviceName)).toThrow(/not found/);
            
            try {
              container.resolve(serviceName);
            } catch (error) {
              expect(error.message).toContain(serviceName);
              expect(error.message).toContain('not found');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error includes available services when container is not empty', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          fc.array(serviceNameArbitrary, { minLength: 1, maxLength: 5 })
            .filter(arr => new Set(arr).size === arr.length),
          serviceValueArbitrary,
          (missingService, existingServices, value) => {
            // Ensure missing service is not in existing services
            const actualMissing = existingServices.includes(missingService) 
              ? missingService + '_missing' 
              : missingService;
            
            const container = createContainer();
            
            // Register some services
            existingServices.forEach(name => {
              container.registerSingleton(name, { ...value }, { isInstance: true });
            });
            
            // Should throw service not found error
            expect(() => container.resolve(actualMissing)).toThrow(/not found/);
            
            try {
              container.resolve(actualMissing);
            } catch (error) {
              // Error should mention available services
              expect(error.message).toContain('Available services');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error suggests similar service names', () => {
      const container = createContainer();
      
      // Register services with similar names
      container.registerSingleton('userService', { id: 1 }, { isInstance: true });
      container.registerSingleton('userRepository', { id: 2 }, { isInstance: true });
      container.registerSingleton('accountService', { id: 3 }, { isInstance: true });
      
      // Should throw service not found error
      expect(() => container.resolve('user')).toThrow(/not found/);
      
      try {
        container.resolve('user'); // Similar to userService and userRepository
      } catch (error) {
        // Should suggest similar services
        expect(error.message).toMatch(/user/i);
      }
    });
  });

  /**
   * **Feature: architecture-refactoring, Property 27: Service Decoration**
   * **Validates: Requirements 7.5**
   * 
   * For any service with registered decorators, resolving the service should
   * return an instance with all decorators applied in registration order.
   */
  describe('Property 27: Service Decoration', () => {
    test('single decorator is applied to service', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          fc.integer(),
          (serviceName, initialValue) => {
            const container = createContainer();
            
            // Register service
            container.registerSingleton(serviceName, () => ({ value: initialValue }));
            
            // Add decorator that doubles the value
            container.decorate(serviceName, (service) => ({
              ...service,
              value: service.value * 2,
              decorated: true
            }));
            
            const instance = container.resolve(serviceName);
            
            expect(instance.value).toBe(initialValue * 2);
            expect(instance.decorated).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple decorators are applied in registration order', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 2, max: 5 }),
          (serviceName, initialValue, decoratorCount) => {
            const container = createContainer();
            const appliedOrder = [];
            
            // Register service
            container.registerSingleton(serviceName, () => ({ 
              value: initialValue,
              decorations: []
            }));
            
            // Add multiple decorators
            for (let i = 0; i < decoratorCount; i++) {
              const decoratorIndex = i;
              container.decorate(serviceName, (service) => {
                appliedOrder.push(decoratorIndex);
                return {
                  ...service,
                  decorations: [...service.decorations, decoratorIndex]
                };
              });
            }
            
            const instance = container.resolve(serviceName);
            
            // Decorators should be applied in order
            expect(instance.decorations).toEqual(
              Array.from({ length: decoratorCount }, (_, i) => i)
            );
            expect(appliedOrder).toEqual(
              Array.from({ length: decoratorCount }, (_, i) => i)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('decorators work with transient services', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          fc.integer({ min: 2, max: 5 }),
          (serviceName, resolutionCount) => {
            const container = createContainer();
            let factoryCallCount = 0;
            let decoratorCallCount = 0;
            
            // Register transient service
            container.registerTransient(serviceName, () => {
              factoryCallCount++;
              return { id: factoryCallCount };
            });
            
            // Add decorator
            container.decorate(serviceName, (service) => {
              decoratorCallCount++;
              return { ...service, decorated: true };
            });
            
            // Resolve multiple times
            const instances = [];
            for (let i = 0; i < resolutionCount; i++) {
              instances.push(container.resolve(serviceName));
            }
            
            // Factory and decorator should be called for each resolution
            expect(factoryCallCount).toBe(resolutionCount);
            expect(decoratorCallCount).toBe(resolutionCount);
            
            // Each instance should be decorated
            instances.forEach(instance => {
              expect(instance.decorated).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: architecture-refactoring, Property 28: Service Interface Validation**
   * **Validates: Requirements 7.6**
   * 
   * For any service registration with a required interface, if the service does not
   * implement the interface, registration should fail with details about missing members.
   */
  describe('Property 28: Service Interface Validation', () => {
    test('valid interface implementation passes validation', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer(),
          (serviceName, methodName, value) => {
            const container = createContainer();
            
            const requiredInterface = {
              name: 'TestInterface',
              members: [methodName, 'getValue']
            };
            
            const service = {
              [methodName]: () => {},
              getValue: () => value
            };
            
            // Should not throw
            expect(() => {
              container.registerWithInterface(serviceName, service, requiredInterface);
            }).not.toThrow();
            
            const resolved = container.resolve(serviceName);
            expect(resolved.getValue()).toBe(value);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('missing interface members cause validation error', () => {
      // Built-in object properties that exist on all objects - must be excluded
      const builtInProperties = [
        'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
        'propertyIsEnumerable', 'toLocaleString', 'constructor',
        '__proto__', '__defineGetter__', '__defineSetter__',
        '__lookupGetter__', '__lookupSetter__', 'unrelatedMethod'
      ];
      
      // Custom arbitrary that excludes built-in properties
      const memberNameArbitrary = fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => s.trim().length > 0 && !builtInProperties.includes(s));
      
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          fc.array(memberNameArbitrary, { minLength: 1, maxLength: 5 })
            .filter(arr => new Set(arr).size === arr.length),
          (serviceName, requiredMembers) => {
            const container = createContainer();
            
            const requiredInterface = {
              name: 'TestInterface',
              members: requiredMembers
            };
            
            // Service missing all required members
            const service = { unrelatedMethod: () => {} };
            
            // Should throw validation error
            expect(() => {
              container.registerWithInterface(serviceName, service, requiredInterface);
            }).toThrow(/does not implement/);
            
            try {
              container.registerWithInterface(serviceName, service, requiredInterface);
            } catch (error) {
              // Error should mention missing members
              expect(error.message).toContain('does not implement');
              expect(error.message).toContain('Missing members');
              // At least one required member should be mentioned
              const hasMissingMember = requiredMembers.some(m => error.message.includes(m));
              expect(hasMissingMember).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('partial interface implementation fails with specific missing members', () => {
      // Built-in object properties that exist on all objects - must be excluded
      const builtInProperties = [
        'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
        'propertyIsEnumerable', 'toLocaleString', 'constructor',
        '__proto__', '__defineGetter__', '__defineSetter__',
        '__lookupGetter__', '__lookupSetter__'
      ];
      
      // Custom arbitrary that excludes built-in properties
      const memberNameArbitrary = fc.string({ minLength: 1, maxLength: 15 })
        .filter(s => s.trim().length > 0 && !builtInProperties.includes(s));
      
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          fc.array(memberNameArbitrary, { minLength: 2, maxLength: 5 })
            .filter(arr => new Set(arr).size === arr.length),
          fc.integer({ min: 1 }),
          (serviceName, allMembers, implementedCount) => {
            const actualImplementedCount = Math.min(implementedCount, allMembers.length - 1);
            const container = createContainer();
            
            const requiredInterface = {
              name: 'TestInterface',
              members: allMembers
            };
            
            // Implement only some members
            const service = {};
            for (let i = 0; i < actualImplementedCount; i++) {
              service[allMembers[i]] = () => {};
            }
            
            const missingMembers = allMembers.slice(actualImplementedCount);
            
            // Should throw because some members are missing
            expect(() => {
              container.registerWithInterface(serviceName, service, requiredInterface);
            }).toThrow();
            
            try {
              container.registerWithInterface(serviceName, service, requiredInterface);
            } catch (error) {
              // Error should mention the specific missing members
              missingMembers.forEach(member => {
                expect(error.message).toContain(member);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('interface validation works with factory functions', () => {
      fc.assert(
        fc.property(
          serviceNameArbitrary,
          fc.string({ minLength: 1, maxLength: 20 }),
          (serviceName, methodName) => {
            const container = createContainer();
            
            const requiredInterface = {
              name: 'TestInterface',
              members: [methodName]
            };
            
            // Factory that creates compliant service
            const factory = () => ({
              [methodName]: () => 'result'
            });
            
            // Should not throw
            expect(() => {
              container.registerWithInterface(serviceName, factory, requiredInterface);
            }).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
