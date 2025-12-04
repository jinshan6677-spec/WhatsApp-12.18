'use strict';

/**
 * Base Repository Interface
 * 
 * Defines the standard CRUD operations for data access.
 * All repository implementations should extend this interface.
 * 
 * @template T - Entity type
 * @template ID - Entity identifier type
 */
class IRepository {
  /**
   * Finds an entity by its unique identifier
   * @param {ID} id - Entity identifier
   * @returns {Promise<T|null>} The entity or null if not found
   */
  async findById(id) {
    throw new Error('Method not implemented: findById');
  }

  /**
   * Retrieves all entities
   * @returns {Promise<T[]>} Array of all entities
   */
  async findAll() {
    throw new Error('Method not implemented: findAll');
  }

  /**
   * Finds entities matching the given criteria
   * @param {Partial<T>} criteria - Search criteria
   * @returns {Promise<T[]>} Array of matching entities
   */
  async findBy(criteria) {
    throw new Error('Method not implemented: findBy');
  }

  /**
   * Saves a new entity or updates an existing one
   * @param {T} entity - Entity to save
   * @returns {Promise<T>} The saved entity
   */
  async save(entity) {
    throw new Error('Method not implemented: save');
  }

  /**
   * Updates an existing entity
   * @param {ID} id - Entity identifier
   * @param {Partial<T>} data - Data to update
   * @returns {Promise<T>} The updated entity
   */
  async update(id, data) {
    throw new Error('Method not implemented: update');
  }

  /**
   * Deletes an entity by its identifier
   * @param {ID} id - Entity identifier
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(id) {
    throw new Error('Method not implemented: delete');
  }

  /**
   * Checks if an entity exists
   * @param {ID} id - Entity identifier
   * @returns {Promise<boolean>} True if exists
   */
  async exists(id) {
    throw new Error('Method not implemented: exists');
  }

  /**
   * Counts all entities
   * @returns {Promise<number>} Total count
   */
  async count() {
    throw new Error('Method not implemented: count');
  }

  /**
   * Deletes all entities
   * @returns {Promise<void>}
   */
  async deleteAll() {
    throw new Error('Method not implemented: deleteAll');
  }
}

module.exports = IRepository;
