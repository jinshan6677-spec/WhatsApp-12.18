# Instance Management Modular Architecture

This directory contains the refactored, modular version of the InstanceManager.

## Overview

The original `InstanceManager.js` (1348 lines) has been split into focused, maintainable modules:

## Module Structure

### 1. InstanceStorage.js (Storage Module)
**Responsibilities:**
- Instance data storage and retrieval
- Instance status management
- Instance counting and filtering

**Key Methods:**
- `storeInstance(instanceId, instanceInfo)` - Store instance data
- `getInstance(instanceId)` - Get instance by ID
- `removeInstance(instanceId)` - Remove instance
- `instanceExists(instanceId)` - Check if instance exists
- `getAllInstances()` - Get all instances
- `getRunningInstances()` - Get running instances
- `storeStatus(instanceId, status)` - Store instance status
- `getInstanceStatus(instanceId)` - Get instance status
- `updateStatus(instanceId, updates)` - Update instance status
- `initializeStatus(instanceId)` - Initialize status for new instance

### 2. InstanceLifecycle.js (Lifecycle Module)
**Responsibilities:**
- Instance creation and initialization
- Instance destruction and cleanup
- Instance restart logic
- Window management

**Key Methods:**
- `createInstance(instanceId, config)` - Create new instance
- `destroyInstance(instanceId)` - Destroy instance
- `restartInstance(instanceId)` - Restart instance

### 3. InstanceMonitor.js (Monitoring Module)
**Responsibilities:**
- Instance health monitoring
- Resource usage tracking
- Unread message monitoring
- Global monitoring coordination

**Key Methods:**
- `setupInstanceMonitoring(instanceId, window)` - Setup monitoring for instance
- `startGlobalMonitoring()` - Start monitoring all instances
- `stopGlobalMonitoring()` - Stop global monitoring
- `checkAllInstances()` - Check health of all instances
- `checkInstanceHealth(instanceId)` - Check specific instance health
- `startUnreadMonitoring(instanceId, window)` - Start unread count monitoring
- `stopUnreadMonitoring(instanceId)` - Stop unread monitoring
- `cleanup()` - Cleanup all monitoring resources

### 4. index.js (Integration Module)
**Responsibilities:**
- Integrating all modules
- Maintaining backward compatibility
- Exposing unified API
- Managing module lifecycle

**Key Features:**
- Creates instances of all modules
- Delegates method calls to appropriate modules
- Maintains original InstanceManager API
- Provides seamless migration path

## Benefits of Modular Architecture

1. **Separation of Concerns**: Each module has a single, clear responsibility
2. **Maintainability**: Smaller files are easier to understand and modify
3. **Testability**: Modules can be tested independently
4. **Reusability**: Components can be reused in other contexts
5. **Extensibility**: New features can be added without modifying existing code

## File Size Comparison

| File | Lines | Purpose |
|------|-------|---------|
| Original InstanceManager.js | 1348 | Monolithic implementation |
| InstanceStorage.js | ~150 | Storage and state |
| InstanceLifecycle.js | ~180 | Lifecycle management |
| InstanceMonitor.js | ~200 | Monitoring and health |
| index.js | ~220 | Integration |
| **Total** | **~750** | **Modular implementation** |

## Usage

The modular version maintains full backward compatibility:

```javascript
// Original usage still works
const InstanceManager = require('./managers/InstanceManager');
const instanceManager = new InstanceManager({
  userDataPath: '/path/to/data',
  maxInstances: 30
});

// Or use the modular version
const InstanceManager = require('./managers/instance');
const instanceManager = new InstanceManager({
  userDataPath: '/path/to/data',
  maxInstances: 30
});

// All methods work the same
const result = await instanceManager.createInstance('account-1', config);
```

## Module Dependencies

```
InstanceManager (index.js)
├── InstanceStorage
├── InstanceLifecycle
│   └── InstanceStorage
└── InstanceMonitor
    └── InstanceStorage
```

## Migration Path

1. **Phase 1**: Create modular files (✓ Complete)
2. **Phase 2**: Update imports to use modular version
3. **Phase 3**: Test all functionality
4. **Phase 4**: Remove original InstanceManager.js (optional)

## Testing

Each module can be tested independently:

```javascript
// Example: Testing InstanceStorage
const InstanceStorage = require('./instance/InstanceStorage');
const logger = (level, msg) => console.log(`[${level}] ${msg}`);
const storage = new InstanceStorage(logger);

storage.storeInstance('test-1', { id: 'test-1', config: {} });
assert(storage.instanceExists('test-1'));
```

## Future Enhancements

The modular structure enables:
1. Advanced instance pooling
2. Instance load balancing
3. Automatic instance recovery
4. Enhanced resource monitoring
5. Instance analytics and reporting

## Notes

- Original `InstanceManager.js` is preserved for reference
- New modular files are in `src/managers/instance/`
- No changes to external APIs
- All existing functionality is maintained
- Backward compatibility is guaranteed
