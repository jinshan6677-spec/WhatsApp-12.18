'use strict';

/**
 * All available migrations in order
 * @type {Array<Object>}
 */
const migrations = [];

/**
 * Registers all migrations with a MigrationRunner
 * @param {MigrationRunner} runner - The migration runner instance
 */
function registerAllMigrations(runner) {
  for (const migration of migrations) {
    runner.register(migration);
  }
}

module.exports = {
  migrations,
  registerAllMigrations,
  
};
