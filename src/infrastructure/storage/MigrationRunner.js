'use strict';

const fs = require('fs').promises;
const path = require('path');
const StorageError = require('../../core/errors/StorageError');

/**
 * Migration Runner Implementation
 * 
 * Implements a data migration framework with version management
 * and rollback capability. Supports schema migrations between versions.
 * 
 * @class MigrationRunner
 */
class MigrationRunner {
  /**
   * Creates a MigrationRunner instance
   * @param {Object} options - Configuration options
   * @param {string} [options.storagePath] - Path to storage directory
   * @param {string} [options.versionFile] - Name of the version tracking file
   */
  constructor(options = {}) {
    this.storagePath = options.storagePath || 'session-data';
    this.versionFile = options.versionFile || 'migration-version.json';
    this.versionFilePath = path.join(this.storagePath, this.versionFile);
    
    /** @type {Map<string, Migration>} */
    this._migrations = new Map();
    
    /** @type {Array<{version: string, timestamp: number, direction: string}>} */
    this._history = [];
    
    /** @type {Map<string, any>} */
    this._snapshots = new Map();
  }

  /**
   * Registers a migration
   * @param {Migration} migration - Migration object
   * @throws {Error} If migration is invalid or version already registered
   */
  register(migration) {
    this._validateMigration(migration);
    
    if (this._migrations.has(migration.version)) {
      throw new Error(`Migration version '${migration.version}' already registered`);
    }
    
    this._migrations.set(migration.version, migration);
  }

  /**
   * Validates a migration object
   * @private
   * @param {Migration} migration
   * @throws {Error} If migration is invalid
   */
  _validateMigration(migration) {
    if (!migration) {
      throw new Error('Migration cannot be null or undefined');
    }
    if (!migration.version || typeof migration.version !== 'string') {
      throw new Error('Migration must have a valid version string');
    }
    if (typeof migration.up !== 'function') {
      throw new Error('Migration must have an up() function');
    }
    if (typeof migration.down !== 'function') {
      throw new Error('Migration must have a down() function');
    }
  }


  /**
   * Gets all registered migrations sorted by version
   * @returns {Migration[]} Sorted migrations
   */
  getMigrations() {
    return Array.from(this._migrations.values())
      .sort((a, b) => this._compareVersions(a.version, b.version));
  }

  /**
   * Compares two version strings
   * @private
   * @param {string} v1 - First version
   * @param {string} v2 - Second version
   * @returns {number} -1, 0, or 1
   */
  _compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    return 0;
  }

  /**
   * Gets the current schema version
   * @returns {Promise<string|null>} Current version or null if not initialized
   */
  async getCurrentVersion() {
    try {
      const data = await fs.readFile(this.versionFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.version || null;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw StorageError.readFailed(this.versionFilePath, error);
    }
  }

  /**
   * Sets the current schema version
   * @private
   * @param {string|null} version - Version to set
   * @returns {Promise<void>}
   */
  async _setCurrentVersion(version) {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      const data = {
        version,
        updatedAt: new Date().toISOString(),
        history: this._history
      };
      await fs.writeFile(this.versionFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      throw StorageError.writeFailed(this.versionFilePath, error);
    }
  }

  /**
   * Gets pending migrations that need to be applied
   * @returns {Promise<Migration[]>} Pending migrations
   */
  async getPendingMigrations() {
    const currentVersion = await this.getCurrentVersion();
    const migrations = this.getMigrations();
    
    if (!currentVersion) {
      return migrations;
    }
    
    return migrations.filter(m => 
      this._compareVersions(m.version, currentVersion) > 0
    );
  }

  /**
   * Takes a snapshot of data before migration
   * @param {Object} context - Migration context with data
   * @returns {Object} Snapshot of the data
   */
  takeSnapshot(context) {
    const snapshot = {};
    
    if (context && typeof context === 'object') {
      for (const [key, value] of Object.entries(context)) {
        if (value !== undefined && value !== null) {
          // Deep clone the data
          snapshot[key] = JSON.parse(JSON.stringify(value));
        }
      }
    }
    
    return snapshot;
  }

  /**
   * Restores data from a snapshot
   * @param {Object} snapshot - Snapshot to restore
   * @returns {Object} Restored data
   */
  restoreFromSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      return {};
    }
    return JSON.parse(JSON.stringify(snapshot));
  }


  /**
   * Runs a single migration up
   * @param {Migration} migration - Migration to run
   * @param {Object} context - Migration context with data
   * @returns {Promise<{success: boolean, snapshot: Object, result: any}>}
   */
  async runMigrationUp(migration, context = {}) {
    const snapshot = this.takeSnapshot(context);
    
    try {
      const result = await migration.up(context);
      
      this._history.push({
        version: migration.version,
        timestamp: Date.now(),
        direction: 'up'
      });
      
      this._snapshots.set(migration.version, snapshot);
      
      return { success: true, snapshot, result };
    } catch (error) {
      throw StorageError.migrationFailed(migration.version, error);
    }
  }

  /**
   * Runs a single migration down (rollback)
   * @param {Migration} migration - Migration to rollback
   * @param {Object} context - Migration context with data
   * @returns {Promise<{success: boolean, result: any}>}
   */
  async runMigrationDown(migration, context = {}) {
    try {
      const result = await migration.down(context);
      
      this._history.push({
        version: migration.version,
        timestamp: Date.now(),
        direction: 'down'
      });
      
      this._snapshots.delete(migration.version);
      
      return { success: true, result };
    } catch (error) {
      throw StorageError.migrationFailed(migration.version, error);
    }
  }

  /**
   * Migrates to a specific version
   * @param {string} targetVersion - Target version to migrate to
   * @param {Object} context - Migration context with data
   * @returns {Promise<MigrationResult>}
   */
  async migrateTo(targetVersion, context = {}) {
    const currentVersion = await this.getCurrentVersion();
    const migrations = this.getMigrations();
    
    // Validate target version exists
    if (!this._migrations.has(targetVersion)) {
      throw new Error(`Target version '${targetVersion}' not found`);
    }
    
    const results = [];
    let finalContext = { ...context };
    
    // Determine direction
    const direction = !currentVersion || 
      this._compareVersions(targetVersion, currentVersion) > 0 
        ? 'up' 
        : 'down';
    
    if (direction === 'up') {
      // Get migrations to apply
      const toApply = migrations.filter(m => {
        if (!currentVersion) {
          return this._compareVersions(m.version, targetVersion) <= 0;
        }
        return this._compareVersions(m.version, currentVersion) > 0 &&
               this._compareVersions(m.version, targetVersion) <= 0;
      });
      
      for (const migration of toApply) {
        const result = await this.runMigrationUp(migration, finalContext);
        results.push({ version: migration.version, direction: 'up', ...result });
        if (result.result && typeof result.result === 'object') {
          finalContext = { ...finalContext, ...result.result };
        }
      }
    } else {
      // Get migrations to rollback (in reverse order)
      const toRollback = migrations
        .filter(m => {
          return this._compareVersions(m.version, currentVersion) <= 0 &&
                 this._compareVersions(m.version, targetVersion) > 0;
        })
        .reverse();
      
      for (const migration of toRollback) {
        const result = await this.runMigrationDown(migration, finalContext);
        results.push({ version: migration.version, direction: 'down', ...result });
        if (result.result && typeof result.result === 'object') {
          // For rollback, replace context entirely with the result
          // since down() returns the restored state
          finalContext = result.result;
        }
      }
    }
    
    await this._setCurrentVersion(targetVersion);
    
    return {
      success: true,
      fromVersion: currentVersion,
      toVersion: targetVersion,
      migrationsRun: results.length,
      results,
      context: finalContext
    };
  }


  /**
   * Runs all pending migrations
   * @param {Object} context - Migration context with data
   * @returns {Promise<MigrationResult>}
   */
  async migrateUp(context = {}) {
    const pending = await this.getPendingMigrations();
    
    if (pending.length === 0) {
      return {
        success: true,
        fromVersion: await this.getCurrentVersion(),
        toVersion: await this.getCurrentVersion(),
        migrationsRun: 0,
        results: [],
        context
      };
    }
    
    const lastMigration = pending[pending.length - 1];
    return this.migrateTo(lastMigration.version, context);
  }

  /**
   * Rolls back the last migration
   * @param {Object} context - Migration context with data
   * @returns {Promise<MigrationResult>}
   */
  async rollbackLast(context = {}) {
    const currentVersion = await this.getCurrentVersion();
    
    if (!currentVersion) {
      return {
        success: true,
        fromVersion: null,
        toVersion: null,
        migrationsRun: 0,
        results: [],
        context
      };
    }
    
    const migrations = this.getMigrations();
    const currentIndex = migrations.findIndex(m => m.version === currentVersion);
    
    if (currentIndex <= 0) {
      // Rollback to initial state (no version)
      const migration = this._migrations.get(currentVersion);
      const result = await this.runMigrationDown(migration, context);
      await this._setCurrentVersion(null);
      
      return {
        success: true,
        fromVersion: currentVersion,
        toVersion: null,
        migrationsRun: 1,
        results: [{ version: currentVersion, direction: 'down', ...result }],
        context: result.result || context
      };
    }
    
    const previousVersion = migrations[currentIndex - 1].version;
    return this.migrateTo(previousVersion, context);
  }

  /**
   * Rolls back all migrations
   * @param {Object} context - Migration context with data
   * @returns {Promise<MigrationResult>}
   */
  async rollbackAll(context = {}) {
    const currentVersion = await this.getCurrentVersion();
    
    if (!currentVersion) {
      return {
        success: true,
        fromVersion: null,
        toVersion: null,
        migrationsRun: 0,
        results: [],
        context
      };
    }
    
    const migrations = this.getMigrations();
    const toRollback = migrations
      .filter(m => this._compareVersions(m.version, currentVersion) <= 0)
      .reverse();
    
    const results = [];
    let finalContext = { ...context };
    
    for (const migration of toRollback) {
      const result = await this.runMigrationDown(migration, finalContext);
      results.push({ version: migration.version, direction: 'down', ...result });
      if (result.result && typeof result.result === 'object') {
        // For rollback, replace context entirely with the result
        // since down() returns the restored state
        finalContext = result.result;
      }
    }
    
    await this._setCurrentVersion(null);
    
    return {
      success: true,
      fromVersion: currentVersion,
      toVersion: null,
      migrationsRun: results.length,
      results,
      context: finalContext
    };
  }

  /**
   * Gets the migration history
   * @returns {Array<{version: string, timestamp: number, direction: string}>}
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * Gets a snapshot for a specific version
   * @param {string} version - Migration version
   * @returns {Object|null} Snapshot or null if not found
   */
  getSnapshot(version) {
    return this._snapshots.get(version) || null;
  }

  /**
   * Clears all registered migrations and history
   */
  clear() {
    this._migrations.clear();
    this._history = [];
    this._snapshots.clear();
  }

  /**
   * Serializes the migration state
   * @returns {string} JSON string
   */
  serialize() {
    return JSON.stringify({
      history: this._history,
      snapshots: Object.fromEntries(this._snapshots)
    }, null, 2);
  }

  /**
   * Deserializes migration state
   * @param {string} data - JSON string
   */
  deserialize(data) {
    const parsed = JSON.parse(data);
    this._history = parsed.history || [];
    this._snapshots = new Map(Object.entries(parsed.snapshots || {}));
  }

  /**
   * Pretty prints the migration status
   * @returns {string} Formatted status string
   */
  async prettyPrint() {
    const currentVersion = await this.getCurrentVersion();
    const migrations = this.getMigrations();
    const pending = await this.getPendingMigrations();
    
    const lines = [
      '=== Migration Status ===',
      `Current Version: ${currentVersion || '(none)'}`,
      `Total Migrations: ${migrations.length}`,
      `Pending Migrations: ${pending.length}`,
      '',
      'Registered Migrations:'
    ];
    
    for (const m of migrations) {
      const status = !currentVersion 
        ? '[ ]' 
        : this._compareVersions(m.version, currentVersion) <= 0 
          ? '[x]' 
          : '[ ]';
      lines.push(`  ${status} ${m.version}${m.description ? ` - ${m.description}` : ''}`);
    }
    
    if (this._history.length > 0) {
      lines.push('', 'Recent History:');
      for (const h of this._history.slice(-5)) {
        const date = new Date(h.timestamp).toISOString();
        lines.push(`  ${date} - ${h.version} (${h.direction})`);
      }
    }
    
    return lines.join('\n');
  }
}

/**
 * @typedef {Object} Migration
 * @property {string} version - Semantic version string
 * @property {string} [description] - Human-readable description
 * @property {function(Object): Promise<Object>} up - Migration up function
 * @property {function(Object): Promise<Object>} down - Migration down function
 */

/**
 * @typedef {Object} MigrationResult
 * @property {boolean} success - Whether migration succeeded
 * @property {string|null} fromVersion - Starting version
 * @property {string|null} toVersion - Ending version
 * @property {number} migrationsRun - Number of migrations executed
 * @property {Array} results - Individual migration results
 * @property {Object} context - Final context after migrations
 */

module.exports = MigrationRunner;
