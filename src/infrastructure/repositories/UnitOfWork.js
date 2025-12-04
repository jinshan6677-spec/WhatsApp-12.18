'use strict';

const StorageError = require('../../core/errors/StorageError');

/**
 * Unit of Work Implementation
 * 
 * Implements the Unit of Work pattern for transactional operations
 * across multiple repositories. Provides atomicity guarantees by
 * tracking changes and supporting rollback on failure.
 * 
 * @class UnitOfWork
 */
class UnitOfWork {
  /**
   * Creates a UnitOfWork instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this._repositories = new Map();
    this._pendingOperations = [];
    this._snapshots = new Map();
    this._committed = false;
    this._rolledBack = false;
  }

  /**
   * Registers a repository with the unit of work
   * @param {string} name - Repository name
   * @param {IRepository} repository - Repository instance
   */
  registerRepository(name, repository) {
    if (this._committed || this._rolledBack) {
      throw new Error('Cannot register repository after commit or rollback');
    }
    this._repositories.set(name, repository);
  }

  /**
   * Gets a registered repository
   * @param {string} name - Repository name
   * @returns {IRepository} Repository instance
   */
  getRepository(name) {
    const repo = this._repositories.get(name);
    if (!repo) {
      throw new Error(`Repository '${name}' not registered`);
    }
    return repo;
  }

  /**
   * Takes a snapshot of the current state of all repositories
   * @private
   * @returns {Promise<void>}
   */
  async _takeSnapshots() {
    for (const [name, repo] of this._repositories) {
      try {
        const entities = await repo.findAll();
        this._snapshots.set(name, entities.map(e => e.toJSON ? e.toJSON() : { ...e }));
      } catch (error) {
        // If repository is empty or fails to load, store empty array
        this._snapshots.set(name, []);
      }
    }
  }

  /**
   * Schedules a save operation
   * @param {string} repoName - Repository name
   * @param {Object} entity - Entity to save
   * @returns {UnitOfWork} This instance for chaining
   */
  scheduleSave(repoName, entity) {
    if (this._committed || this._rolledBack) {
      throw new Error('Cannot schedule operations after commit or rollback');
    }
    this._pendingOperations.push({
      type: 'save',
      repository: repoName,
      entity,
      executed: false
    });
    return this;
  }

  /**
   * Schedules an update operation
   * @param {string} repoName - Repository name
   * @param {string} id - Entity ID
   * @param {Object} data - Data to update
   * @returns {UnitOfWork} This instance for chaining
   */
  scheduleUpdate(repoName, id, data) {
    if (this._committed || this._rolledBack) {
      throw new Error('Cannot schedule operations after commit or rollback');
    }
    this._pendingOperations.push({
      type: 'update',
      repository: repoName,
      id,
      data,
      executed: false
    });
    return this;
  }

  /**
   * Schedules a delete operation
   * @param {string} repoName - Repository name
   * @param {string} id - Entity ID
   * @returns {UnitOfWork} This instance for chaining
   */
  scheduleDelete(repoName, id) {
    if (this._committed || this._rolledBack) {
      throw new Error('Cannot schedule operations after commit or rollback');
    }
    this._pendingOperations.push({
      type: 'delete',
      repository: repoName,
      id,
      executed: false
    });
    return this;
  }

  /**
   * Commits all pending operations
   * @returns {Promise<{success: boolean, results: Array}>}
   */
  async commit() {
    if (this._committed) {
      throw new Error('Unit of work already committed');
    }
    if (this._rolledBack) {
      throw new Error('Unit of work already rolled back');
    }

    // Take snapshots before making changes
    await this._takeSnapshots();

    const results = [];
    let failedIndex = -1;

    try {
      for (let i = 0; i < this._pendingOperations.length; i++) {
        const op = this._pendingOperations[i];
        const repo = this.getRepository(op.repository);

        try {
          let result;
          switch (op.type) {
            case 'save':
              result = await repo.save(op.entity);
              break;
            case 'update':
              result = await repo.update(op.id, op.data);
              break;
            case 'delete':
              result = await repo.delete(op.id);
              break;
            default:
              throw new Error(`Unknown operation type: ${op.type}`);
          }
          op.executed = true;
          results.push({ operation: op, success: true, result });
        } catch (error) {
          failedIndex = i;
          results.push({ operation: op, success: false, error });
          throw error;
        }
      }

      this._committed = true;
      return { success: true, results };
    } catch (error) {
      // Rollback on failure
      await this._rollbackToSnapshots();
      this._rolledBack = true;
      
      return {
        success: false,
        results,
        error,
        failedOperationIndex: failedIndex
      };
    }
  }

  /**
   * Rolls back to the snapshots taken before commit
   * @private
   * @returns {Promise<void>}
   */
  async _rollbackToSnapshots() {
    for (const [name, snapshot] of this._snapshots) {
      const repo = this._repositories.get(name);
      if (repo) {
        try {
          // Delete all current entities
          await repo.deleteAll();
          
          // Restore from snapshot
          for (const entityData of snapshot) {
            // Create entity from JSON if the repository has a fromJSON method
            const EntityClass = this._getEntityClass(name);
            const entity = EntityClass ? EntityClass.fromJSON(entityData) : entityData;
            await repo.save(entity);
          }
        } catch (error) {
          // Log rollback error but continue with other repositories
          console.error(`Rollback failed for repository '${name}':`, error);
        }
      }
    }
  }

  /**
   * Gets the entity class for a repository
   * @private
   * @param {string} repoName - Repository name
   * @returns {Function|null} Entity class constructor
   */
  _getEntityClass(repoName) {
    // Map repository names to entity classes
    const entityClasses = {
      accounts: require('../../domain/entities/Account'),
      translations: require('../../domain/entities/TranslationConfig')
    };
    return entityClasses[repoName] || null;
  }

  /**
   * Manually rolls back all changes
   * @returns {Promise<void>}
   */
  async rollback() {
    if (this._rolledBack) {
      throw new Error('Unit of work already rolled back');
    }
    
    if (this._snapshots.size === 0) {
      // No snapshots taken yet, just mark as rolled back
      this._rolledBack = true;
      return;
    }

    await this._rollbackToSnapshots();
    this._rolledBack = true;
  }

  /**
   * Gets the pending operations
   * @returns {Array} Pending operations
   */
  getPendingOperations() {
    return [...this._pendingOperations];
  }

  /**
   * Checks if the unit of work has been committed
   * @returns {boolean}
   */
  isCommitted() {
    return this._committed;
  }

  /**
   * Checks if the unit of work has been rolled back
   * @returns {boolean}
   */
  isRolledBack() {
    return this._rolledBack;
  }

  /**
   * Clears all pending operations (before commit)
   */
  clear() {
    if (this._committed || this._rolledBack) {
      throw new Error('Cannot clear after commit or rollback');
    }
    this._pendingOperations = [];
  }
}

module.exports = UnitOfWork;
