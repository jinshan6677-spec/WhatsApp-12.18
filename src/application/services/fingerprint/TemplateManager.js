'use strict';

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const FingerprintTemplate = require('../../../domain/fingerprint/FingerprintTemplate');
const FingerprintConfig = require('../../../domain/fingerprint/FingerprintConfig');

/**
 * TemplateManager - Fingerprint Template Management Service
 * 
 * Manages fingerprint templates including creation, application, export, import,
 * deletion, and listing operations.
 * 
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6
 * 
 * Key Features:
 * - Create templates from existing fingerprint configurations
 * - Apply templates to accounts
 * - Export templates to JSON files
 * - Import templates from JSON files
 * - Delete templates
 * - List templates with summaries
 */
class TemplateManager {
  /**
   * Creates a TemplateManager instance
   * @param {Object} [options] - Manager options
   * @param {string} [options.storagePath] - Path to store templates
   * @param {Map} [options.templates] - Initial templates map (for testing)
   */
  constructor(options = {}) {
    this._storagePath = options.storagePath || null;
    this._templates = options.templates || new Map();
    this._initialized = false;
  }

  /**
   * Initializes the template manager
   * Loads templates from storage if a storage path is configured
   */
  async initialize() {
    if (this._initialized) {
      return;
    }

    if (this._storagePath) {
      await this._loadTemplatesFromStorage();
    }

    this._initialized = true;
  }

  /**
   * Creates a new template from a fingerprint configuration
   * 
   * Requirement 21.1: When user creates template, system saves complete
   * fingerprint config with user-defined name
   * 
   * @param {Object} options - Template creation options
   * @param {string} options.name - User-defined template name
   * @param {string} [options.description] - Template description
   * @param {FingerprintConfig|Object} options.config - Source fingerprint configuration
   * @param {string[]} [options.tags] - Optional tags for categorization
   * @returns {FingerprintTemplate} Created template
   * @throws {Error} If name is missing or config is invalid
   */
  createTemplate(options) {
    if (!options || !options.name || typeof options.name !== 'string' || options.name.trim().length === 0) {
      throw new Error('Template name is required and must be a non-empty string');
    }

    if (!options.config) {
      throw new Error('Fingerprint configuration is required');
    }

    // Create the template
    const template = new FingerprintTemplate({
      name: options.name.trim(),
      description: options.description || '',
      config: options.config,
      tags: options.tags || []
    });

    // Validate the template
    const validation = template.validate();
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.reason}`).join('; ');
      throw new Error(`Invalid template: ${errorMessages}`);
    }

    // Store the template
    this._templates.set(template.id, template);

    // Persist if storage is configured
    if (this._storagePath) {
      this._saveTemplateToStorage(template);
    }

    return template;
  }

  /**
   * Applies a template to create a new fingerprint configuration for an account
   * 
   * Requirement 21.2: When user applies template to account, system copies
   * all template settings to account's fingerprint configuration
   * 
   * @param {string} templateId - ID of the template to apply
   * @param {string} accountId - Account ID to apply the template to
   * @returns {FingerprintConfig} New fingerprint configuration for the account
   * @throws {Error} If template is not found
   */
  applyTemplate(templateId, accountId) {
    if (!templateId || typeof templateId !== 'string') {
      throw new Error('Template ID is required');
    }

    if (!accountId || typeof accountId !== 'string') {
      throw new Error('Account ID is required');
    }

    const template = this._templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Create a new config for the account from the template
    return template.createConfigForAccount(accountId);
  }

  /**
   * Exports a template to a JSON object
   * 
   * Requirement 21.3: When user exports template, system generates
   * valid JSON file containing complete configuration
   * 
   * @param {string} templateId - ID of the template to export
   * @param {Object} [options] - Export options
   * @param {boolean} [options.includeNoiseSeed=true] - Whether to include noise seed
   * @returns {Object} JSON-serializable template object
   * @throws {Error} If template is not found
   */
  exportTemplate(templateId, options = {}) {
    if (!templateId || typeof templateId !== 'string') {
      throw new Error('Template ID is required');
    }

    const template = this._templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const { includeNoiseSeed = true } = options;

    // Convert to JSON with export metadata
    const exported = template.toJSON({ includeNoiseSeed });
    
    // Add export metadata
    exported._exportMetadata = {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0.0',
      source: 'TemplateManager'
    };

    return exported;
  }

  /**
   * Exports a template to a JSON file
   * 
   * @param {string} templateId - ID of the template to export
   * @param {string} filePath - Path to save the JSON file
   * @param {Object} [options] - Export options
   * @param {boolean} [options.includeNoiseSeed=true] - Whether to include noise seed
   * @returns {Promise<void>}
   * @throws {Error} If template is not found or file write fails
   */
  async exportTemplateToFile(templateId, filePath, options = {}) {
    const exported = this.exportTemplate(templateId, options);
    
    const jsonString = JSON.stringify(exported, null, 2);
    await fs.promises.writeFile(filePath, jsonString, 'utf8');
  }

  /**
   * Imports a template from a JSON object
   * 
   * Requirement 21.4: When user imports template, system validates
   * and loads configuration from JSON file
   * 
   * @param {Object} json - JSON object representing the template
   * @param {Object} [options] - Import options
   * @param {boolean} [options.generateNewId=true] - Whether to generate a new ID
   * @param {string} [options.newName] - Optional new name for the imported template
   * @returns {FingerprintTemplate} Imported template
   * @throws {Error} If JSON is invalid
   */
  importTemplate(json, options = {}) {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON: expected an object');
    }

    const { generateNewId = true, newName } = options;

    // Remove export metadata if present
    const templateData = { ...json };
    delete templateData._exportMetadata;

    // Create template from JSON
    let template;
    try {
      template = FingerprintTemplate.fromJSON(templateData);
    } catch (error) {
      throw new Error(`Failed to parse template: ${error.message}`);
    }

    // Generate new ID if requested
    if (generateNewId) {
      template.id = crypto.randomUUID();
    }

    // Apply new name if provided
    if (newName && typeof newName === 'string' && newName.trim().length > 0) {
      template.name = newName.trim();
    }

    // Update timestamps
    template.updatedAt = new Date();

    // Validate the imported template
    const validation = template.validate();
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.reason}`).join('; ');
      throw new Error(`Invalid template: ${errorMessages}`);
    }

    // Store the template
    this._templates.set(template.id, template);

    // Persist if storage is configured
    if (this._storagePath) {
      this._saveTemplateToStorage(template);
    }

    return template;
  }

  /**
   * Imports a template from a JSON file
   * 
   * @param {string} filePath - Path to the JSON file
   * @param {Object} [options] - Import options
   * @returns {Promise<FingerprintTemplate>} Imported template
   * @throws {Error} If file read fails or JSON is invalid
   */
  async importTemplateFromFile(filePath, options = {}) {
    const jsonString = await fs.promises.readFile(filePath, 'utf8');
    const json = JSON.parse(jsonString);
    return this.importTemplate(json, options);
  }

  /**
   * Deletes a template
   * 
   * Requirement 21.5: When deleting template, system removes template
   * but does not affect accounts that have already copied settings
   * 
   * @param {string} templateId - ID of the template to delete
   * @returns {boolean} True if template was deleted, false if not found
   */
  deleteTemplate(templateId) {
    if (!templateId || typeof templateId !== 'string') {
      return false;
    }

    const existed = this._templates.has(templateId);
    this._templates.delete(templateId);

    // Remove from storage if configured
    if (existed && this._storagePath) {
      this._deleteTemplateFromStorage(templateId);
    }

    return existed;
  }

  /**
   * Lists all templates with summaries
   * 
   * Requirement 21.6: When listing templates, system displays template name,
   * creation date, and key settings summary
   * 
   * @param {Object} [options] - List options
   * @param {string} [options.sortBy='createdAt'] - Sort field (name, createdAt, updatedAt)
   * @param {string} [options.sortOrder='desc'] - Sort order (asc, desc)
   * @param {string[]} [options.tags] - Filter by tags
   * @returns {Array<Object>} Array of template summaries
   */
  listTemplates(options = {}) {
    const { sortBy = 'createdAt', sortOrder = 'desc', tags } = options;

    let templates = Array.from(this._templates.values());

    // Filter by tags if specified
    if (tags && Array.isArray(tags) && tags.length > 0) {
      templates = templates.filter(template => 
        tags.some(tag => template.tags.includes(tag))
      );
    }

    // Get summaries
    const summaries = templates.map(template => template.getSummary());

    // Sort
    summaries.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'updatedAt':
          aVal = new Date(a.updatedAt || a.createdAt).getTime();
          bVal = new Date(b.updatedAt || b.createdAt).getTime();
          break;
        case 'createdAt':
        default:
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return summaries;
  }

  /**
   * Gets a template by ID
   * 
   * @param {string} templateId - Template ID
   * @returns {FingerprintTemplate|null} Template or null if not found
   */
  getTemplate(templateId) {
    return this._templates.get(templateId) || null;
  }

  /**
   * Gets the total number of templates
   * 
   * @returns {number} Number of templates
   */
  getTemplateCount() {
    return this._templates.size;
  }

  /**
   * Checks if a template exists
   * 
   * @param {string} templateId - Template ID
   * @returns {boolean} True if template exists
   */
  hasTemplate(templateId) {
    return this._templates.has(templateId);
  }

  /**
   * Updates an existing template
   * 
   * @param {string} templateId - Template ID
   * @param {Object} updates - Updates to apply
   * @param {string} [updates.name] - New name
   * @param {string} [updates.description] - New description
   * @param {string[]} [updates.tags] - New tags
   * @param {Object} [updates.config] - Config updates
   * @returns {FingerprintTemplate} Updated template
   * @throws {Error} If template is not found
   */
  updateTemplate(templateId, updates) {
    const template = this._templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Update metadata
    if (updates.name !== undefined || updates.description !== undefined || updates.tags !== undefined) {
      template.updateMetadata({
        name: updates.name,
        description: updates.description,
        tags: updates.tags
      });
    }

    // Update config
    if (updates.config) {
      template.updateConfig(updates.config);
    }

    // Validate after updates
    const validation = template.validate();
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.reason}`).join('; ');
      throw new Error(`Invalid template after update: ${errorMessages}`);
    }

    // Persist if storage is configured
    if (this._storagePath) {
      this._saveTemplateToStorage(template);
    }

    return template;
  }

  // ==================== Private Storage Methods ====================

  /**
   * Loads templates from storage
   * @private
   */
  async _loadTemplatesFromStorage() {
    try {
      const templatesDir = this._storagePath;
      
      // Ensure directory exists
      await fs.promises.mkdir(templatesDir, { recursive: true });
      
      const files = await fs.promises.readdir(templatesDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(templatesDir, file);
          const content = await fs.promises.readFile(filePath, 'utf8');
          const json = JSON.parse(content);
          const template = FingerprintTemplate.fromJSON(json);
          this._templates.set(template.id, template);
        } catch (error) {
          console.error(`Failed to load template from ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Failed to load templates from storage:', error.message);
    }
  }

  /**
   * Saves a template to storage
   * @private
   */
  _saveTemplateToStorage(template) {
    if (!this._storagePath) return;

    try {
      const filePath = path.join(this._storagePath, `${template.id}.json`);
      const json = JSON.stringify(template.toJSON(), null, 2);
      fs.writeFileSync(filePath, json, 'utf8');
    } catch (error) {
      console.error(`Failed to save template ${template.id}:`, error.message);
    }
  }

  /**
   * Deletes a template from storage
   * @private
   */
  _deleteTemplateFromStorage(templateId) {
    if (!this._storagePath) return;

    try {
      const filePath = path.join(this._storagePath, `${templateId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Failed to delete template ${templateId} from storage:`, error.message);
    }
  }
}

module.exports = TemplateManager;
