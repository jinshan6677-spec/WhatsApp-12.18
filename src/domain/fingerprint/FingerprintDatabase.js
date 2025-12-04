'use strict';

const fs = require('fs');
const winChromeGen = require('./database/generators/windowsChrome');
const winFirefoxGen = require('./database/generators/windowsFirefox');
const winEdgeGen = require('./database/generators/windowsEdge');
const macChromeGen = require('./database/generators/macOSChrome');
const macFirefoxGen = require('./database/generators/macOSFirefox');
const macSafariGen = require('./database/generators/macOSSafari');
const linuxChromeGen = require('./database/generators/linuxChrome');
const linuxFirefoxGen = require('./database/generators/linuxFirefox');
/**
 * FingerprintDatabase - Real Browser Fingerprint Database
 * 
 * Provides access to a database of real browser fingerprint configurations
 * for generating realistic and consistent fingerprints. Supports retrieval
 * by OS and browser type, and implements synthetic combination strategies
 * to avoid generating identical fingerprints.
 * 
 * Requirements: 26.1, 26.2, 26.3, 26.6, 26.7
 * 
 * Key Features:
 * - 100+ real browser configurations
 * - Retrieval by OS/browser type
 * - Synthetic combination strategy (avoids exact duplicates)
 * - Version management and backward compatibility
 * - Compliant data sources (public test datasets, synthetic combinations)
 */

/**
 * Supported Operating Systems
 * @readonly
 * @enum {string}
 */
const OSType = {
  Windows: 'windows',
  MacOS: 'macos',
  Linux: 'linux'
};

/**
 * Supported Browser Types
 * @readonly
 * @enum {string}
 */
const BrowserType = {
  Chrome: 'chrome',
  Firefox: 'firefox',
  Edge: 'edge',
  Safari: 'safari'
};

// Base fingerprint templates for synthetic generation
const BASE_TEMPLATES = {
  windows: {
    chrome: winChromeGen.generate(),
    firefox: winFirefoxGen.generate(),
    edge: winEdgeGen.generate()
  },
  macos: {
    chrome: macChromeGen.generate(),
    firefox: macFirefoxGen.generate(),
    safari: macSafariGen.generate()
  },
  linux: {
    chrome: linuxChromeGen.generate(),
    firefox: linuxFirefoxGen.generate()
  }
};










// ==================== FingerprintDatabase Class ====================

/**
 * FingerprintDatabase class for managing real browser fingerprint configurations
 */
class FingerprintDatabase {
  /**
   * Creates a FingerprintDatabase instance
   * @param {Object} options - Configuration options
   * @param {string} [options.dataPath] - Path to external JSON database file
   */
  constructor(options = {}) {
    this.version = '1.0.0';
    this.lastUpdated = new Date().toISOString();
    this._templates = null;
    this._externalDataPath = options.dataPath || null;
    this._usedCombinations = new Set();
  }

  /**
   * Initializes the database by loading templates
   * @returns {FingerprintDatabase} This instance for chaining
   */
  initialize() {
    if (this._templates === null) {
      this._templates = this._loadTemplates();
    }
    return this;
  }

  /**
   * Loads fingerprint templates from built-in data and optional external file
   * @private
   * @returns {Object} Loaded templates organized by OS and browser
   */
  _loadTemplates() {
    // Start with built-in templates
    const templates = JSON.parse(JSON.stringify(BASE_TEMPLATES));
    
    // Try to load external data if path is provided
    if (this._externalDataPath) {
      try {
        const externalData = JSON.parse(fs.readFileSync(this._externalDataPath, 'utf8'));
        if (externalData.fingerprints) {
          this._mergeTemplates(templates, externalData.fingerprints);
        }
      } catch (error) {
        // External file not found or invalid, continue with built-in templates
        console.warn(`Could not load external fingerprint database: ${error.message}`);
      }
    }

    const overrides = this._getWeightOverridesFromEnv();
    if (overrides) {
      this._applyWeightOverrides(templates, overrides);
    }
    
    return templates;
  }

  /**
   * Merges external templates into the main template collection
   * @private
   * @param {Object} target - Target template collection
   * @param {Object} source - Source templates to merge
   */
  _mergeTemplates(target, source) {
    for (const os of Object.keys(source)) {
      if (!target[os]) {
        target[os] = {};
      }
      for (const browser of Object.keys(source[os])) {
        if (!target[os][browser]) {
          target[os][browser] = [];
        }
        target[os][browser].push(...source[os][browser]);
      }
    }
  }

  _getWeightOverridesFromEnv() {
    try {
      const jsonStr = process.env.FP_WEIGHTS_JSON;
      if (jsonStr) {
        return JSON.parse(jsonStr);
      }
      const filePath = process.env.FP_WEIGHTS_PATH;
      if (filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      }
    } catch (e) {
      console.warn(`[FingerprintDatabase] Failed to load weight overrides: ${e.message}`);
    }
    return null;
  }

  _applyWeightOverrides(templates, overrides) {
    const applyForOsBrowser = (os, browser, spec) => {
      const list = templates[os]?.[browser];
      if (!list || !spec) return;

      const majors = spec.majors || {};
      const versions = spec.versions || {};
      const majorRanges = Array.isArray(spec.majorRanges) ? spec.majorRanges : [];
      const versionPrefixes = Array.isArray(spec.versionPrefixes) ? spec.versionPrefixes : [];
      const defaultWeight = typeof spec.default === 'number' ? spec.default : null;
      const scale = typeof spec.scale === 'number' ? spec.scale : null;

      for (const item of list) {
        let w = item.weight || 1;
        const mKey = String(item.majorVersion);
        const vKey = item.browserVersion;

        const legacyMajor = spec[mKey];
        const legacyVersion = spec[vKey];

        if (typeof legacyMajor === 'number' && legacyMajor > 0) {
          w = legacyMajor;
        } else if (typeof legacyVersion === 'number' && legacyVersion > 0) {
          w = legacyVersion;
        } else if (typeof majors[mKey] === 'number' && majors[mKey] > 0) {
          w = majors[mKey];
        } else if (typeof versions[vKey] === 'number' && versions[vKey] > 0) {
          w = versions[vKey];
        } else {
          let applied = false;
          for (const r of majorRanges) {
            if (typeof r === 'object' && r && typeof r.range === 'string' && typeof r.weight === 'number') {
              if (this._matchMajorRange(item.majorVersion, r.range)) {
                w = r.weight;
                applied = true;
                break;
              }
            }
          }
          if (!applied) {
            for (const p of versionPrefixes) {
              if (typeof p === 'object' && p && typeof p.prefix === 'string' && typeof p.weight === 'number') {
                if (vKey.startsWith(p.prefix)) {
                  w = p.weight;
                  applied = true;
                  break;
                }
              }
            }
          }
          if (!applied && defaultWeight && defaultWeight > 0) {
            w = defaultWeight;
          }
        }

        if (scale && scale > 0) {
          w = Math.max(1, Math.round(w * scale));
        }

        item.weight = w;
      }
    };

    for (const os of Object.keys(overrides || {})) {
      const browsers = overrides[os];
      if (!browsers) continue;
      for (const browser of Object.keys(browsers)) {
        applyForOsBrowser(os, browser, browsers[browser]);
      }
    }
  }

  _matchMajorRange(major, expr) {
    if (typeof major !== 'number') return false;
    if (typeof expr !== 'string') return false;
    const t = expr.trim();
    if (/^\d+$/.test(t)) return major === Number(t);
    if (/^\d+\-\d+$/.test(t)) {
      const [a, b] = t.split('-').map(n => Number(n));
      return major >= a && major <= b;
    }
    if (/^>=\d+$/.test(t)) return major >= Number(t.slice(2));
    if (/^>\d+$/.test(t)) return major > Number(t.slice(1));
    if (/^<=\d+$/.test(t)) return major <= Number(t.slice(2));
    if (/^<\d+$/.test(t)) return major < Number(t.slice(1));
    if (/^==\d+$/.test(t)) return major === Number(t.slice(2));
    return false;
  }

 
 /**
   * Gets all fingerprint templates
   * @returns {Object} All templates organized by OS and browser
   */
  getAllTemplates() {
    this.initialize();
    return this._templates;
  }

  /**
   * Gets the total count of fingerprint templates
   * @returns {number} Total number of templates
   */
  getTemplateCount() {
    this.initialize();
    let count = 0;
    for (const os of Object.keys(this._templates)) {
      for (const browser of Object.keys(this._templates[os])) {
        count += this._templates[os][browser].length;
      }
    }
    return count;
  }

  /**
   * Gets fingerprint templates by OS type
   * @param {string} osType - Operating system type (windows, macos, linux)
   * @returns {Object} Templates for the specified OS, organized by browser
   */
  getByOS(osType) {
    this.initialize();
    const normalizedOS = osType.toLowerCase();
    if (!this._templates[normalizedOS]) {
      return {};
    }
    return this._templates[normalizedOS];
  }

  /**
   * Gets fingerprint templates by browser type
   * @param {string} browserType - Browser type (chrome, firefox, edge, safari)
   * @returns {Array<Object>} All templates for the specified browser across all OSes
   */
  getByBrowser(browserType) {
    this.initialize();
    const normalizedBrowser = browserType.toLowerCase();
    const results = [];
    
    for (const os of Object.keys(this._templates)) {
      if (this._templates[os][normalizedBrowser]) {
        results.push(...this._templates[os][normalizedBrowser]);
      }
    }
    
    return results;
  }

  /**
   * Gets fingerprint templates by OS and browser type
   * @param {string} osType - Operating system type
   * @param {string} browserType - Browser type
   * @returns {Array<Object>} Templates matching both criteria
   */
  getByOSAndBrowser(osType, browserType) {
    this.initialize();
    const normalizedOS = osType.toLowerCase();
    const normalizedBrowser = browserType.toLowerCase();
    
    if (!this._templates[normalizedOS] || !this._templates[normalizedOS][normalizedBrowser]) {
      return [];
    }
    
    return this._templates[normalizedOS][normalizedBrowser];
  }

  /**
   * Gets a random fingerprint template
   * @param {Object} [filters] - Optional filters
   * @param {string} [filters.os] - Filter by OS type
   * @param {string} [filters.browser] - Filter by browser type
   * @returns {Object|null} A random template or null if none match
   */
  getRandomTemplate(filters = {}) {
    this.initialize();
    let candidates = [];

    if (filters.os && filters.browser) {
      candidates = this.getByOSAndBrowser(filters.os, filters.browser);
    } else if (filters.os) {
      const osBrowsers = this.getByOS(filters.os);
      for (const browser of Object.keys(osBrowsers)) {
        candidates.push(...osBrowsers[browser]);
      }
    } else if (filters.browser) {
      candidates = this.getByBrowser(filters.browser);
    } else {
      // Get all templates
      for (const os of Object.keys(this._templates)) {
        for (const browser of Object.keys(this._templates[os])) {
          candidates.push(...this._templates[os][browser]);
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    const random = filters.seed !== undefined
      ? this._seededRandom(filters.seed)
      : Math.random;

    const picked = this._weightedRandomChoice(candidates, random);
    return picked ? { ...picked } : null;
  }

  /**
   * Generates a synthetic fingerprint combination
   * This avoids generating fingerprints identical to those in the database
   * by mixing components from different templates
   * 
   * @param {Object} [options] - Generation options
   * @param {string} [options.os] - Target OS type
   * @param {string} [options.browser] - Target browser type
   * @param {number} [options.seed] - Random seed for deterministic generation
   * @returns {Object} A synthetic fingerprint configuration
   */
  generateSyntheticFingerprint(options = {}) {
    this.initialize();
    
    const os = options.os || this._getRandomOS();
    const browser = options.browser || this._getRandomBrowserForOS(os);
    
    // Get templates for the target OS/browser combination
    const templates = this.getByOSAndBrowser(os, browser);
    if (templates.length === 0) {
      throw new Error(`No templates available for ${os}/${browser}`);
    }
    
    // Use seed for deterministic random if provided
    const random = options.seed !== undefined 
      ? this._seededRandom(options.seed)
      : Math.random;
    
    // Select base template
    const baseTemplate = this._weightedRandomChoice(templates, random);
    
    // Get all templates for the same OS to mix components
    const osTemplates = [];
    const osBrowsers = this.getByOS(os);
    for (const b of Object.keys(osBrowsers)) {
      osTemplates.push(...osBrowsers[b]);
    }
    
    // Mix components from different templates to create synthetic combination
    const screenTemplate = this._weightedRandomChoice(osTemplates, random);
    const hardwareTemplate = this._weightedRandomChoice(osTemplates, random);
    
    // Create synthetic fingerprint
    const synthetic = {
      id: `synthetic-${Date.now()}-${Math.floor(random() * 10000)}`,
      userAgent: baseTemplate.userAgent,
      platform: baseTemplate.platform,
      vendor: baseTemplate.vendor,
      browserVersion: baseTemplate.browserVersion,
      majorVersion: baseTemplate.majorVersion,
      osVersion: baseTemplate.osVersion,
      webgl: { ...baseTemplate.webgl },
      screen: { ...screenTemplate.screen },
      hardware: { ...hardwareTemplate.hardware },
      fonts: [...baseTemplate.fonts],
      synthetic: true,
      sourceTemplates: [baseTemplate.id, screenTemplate.id, hardwareTemplate.id]
    };
    
    // Track used combinations to avoid duplicates
    const combinationKey = `${baseTemplate.id}-${screenTemplate.id}-${hardwareTemplate.id}`;
    if (this._usedCombinations.has(combinationKey)) {
      // Recursively try again with different seed
      return this.generateSyntheticFingerprint({
        ...options,
        seed: (options.seed || 0) + 1
      });
    }
    this._usedCombinations.add(combinationKey);
    
    return synthetic;
  }

  /**
   * Gets a random OS type
   * @private
   * @returns {string} Random OS type
   */
  _getRandomOS() {
    const osTypes = Object.keys(this._templates);
    return osTypes[Math.floor(Math.random() * osTypes.length)];
  }

  /**
   * Gets a random browser type for a given OS
   * @private
   * @param {string} os - OS type
   * @returns {string} Random browser type
   */
  _getRandomBrowserForOS(os) {
    const browsers = Object.keys(this._templates[os] || {});
    if (browsers.length === 0) {
      throw new Error(`No browsers available for OS: ${os}`);
    }
    return browsers[Math.floor(Math.random() * browsers.length)];
  }

  /**
   * Creates a seeded random number generator
   * @private
   * @param {number} seed - Seed value
   * @returns {Function} Random number generator function
   */
  _seededRandom(seed) {
    let state = seed >>> 0;
    return function() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  _weightedRandomChoice(list, randomFn) {
    if (!Array.isArray(list) || list.length === 0) return null;
    const weights = list.map(item => typeof item.weight === 'number' && item.weight > 0 ? item.weight : 1);
    const total = weights.reduce((a, b) => a + b, 0);
    let threshold = (typeof randomFn === 'function' ? randomFn() : Math.random) * total;
    for (let i = 0; i < list.length; i++) {
      if (threshold < weights[i]) {
        return list[i];
      }
      threshold -= weights[i];
    }
    return list[list.length - 1];
  }

  /**
   * Clears the used combinations cache
   * Call this to allow previously generated combinations to be reused
   */
  clearUsedCombinations() {
    this._usedCombinations.clear();
  }

  /**
   * Gets available OS types
   * @returns {Array<string>} List of available OS types
   */
  getAvailableOSTypes() {
    this.initialize();
    return Object.keys(this._templates);
  }

  /**
   * Gets available browser types for a given OS
   * @param {string} osType - OS type
   * @returns {Array<string>} List of available browser types
   */
  getAvailableBrowsersForOS(osType) {
    this.initialize();
    const normalizedOS = osType.toLowerCase();
    if (!this._templates[normalizedOS]) {
      return [];
    }
    return Object.keys(this._templates[normalizedOS]);
  }

  /**
   * Searches templates by criteria
   * @param {Object} criteria - Search criteria
   * @param {string} [criteria.os] - OS type filter
   * @param {string} [criteria.browser] - Browser type filter
   * @param {number} [criteria.minMajorVersion] - Minimum browser major version
   * @param {number} [criteria.maxMajorVersion] - Maximum browser major version
   * @param {string} [criteria.gpuVendor] - GPU vendor filter (partial match)
   * @returns {Array<Object>} Matching templates
   */
  search(criteria = {}) {
    this.initialize();
    let results = [];
    
    // Start with all templates or filtered by OS/browser
    if (criteria.os && criteria.browser) {
      results = this.getByOSAndBrowser(criteria.os, criteria.browser);
    } else if (criteria.os) {
      const osBrowsers = this.getByOS(criteria.os);
      for (const browser of Object.keys(osBrowsers)) {
        results.push(...osBrowsers[browser]);
      }
    } else if (criteria.browser) {
      results = this.getByBrowser(criteria.browser);
    } else {
      for (const os of Object.keys(this._templates)) {
        for (const browser of Object.keys(this._templates[os])) {
          results.push(...this._templates[os][browser]);
        }
      }
    }
    
    // Apply additional filters
    if (criteria.minMajorVersion !== undefined) {
      results = results.filter(t => t.majorVersion >= criteria.minMajorVersion);
    }
    
    if (criteria.maxMajorVersion !== undefined) {
      results = results.filter(t => t.majorVersion <= criteria.maxMajorVersion);
    }
    
    if (criteria.gpuVendor) {
      const vendorLower = criteria.gpuVendor.toLowerCase();
      results = results.filter(t => 
        t.webgl.vendor.toLowerCase().includes(vendorLower) ||
        t.webgl.unmaskedVendor.toLowerCase().includes(vendorLower)
      );
    }
    
    return results;
  }

  /**
   * Imports fingerprint data from an external source
   * @param {Object} data - Fingerprint data to import
   * @param {Object} data.fingerprints - Fingerprints organized by OS and browser
   * @returns {number} Number of fingerprints imported
   */
  importData(data) {
    this.initialize();
    
    if (!data || !data.fingerprints) {
      throw new Error('Invalid import data: missing fingerprints property');
    }
    
    let importCount = 0;
    
    for (const os of Object.keys(data.fingerprints)) {
      if (!this._templates[os]) {
        this._templates[os] = {};
      }
      
      for (const browser of Object.keys(data.fingerprints[os])) {
        if (!this._templates[os][browser]) {
          this._templates[os][browser] = [];
        }
        
        const newTemplates = data.fingerprints[os][browser];
        if (Array.isArray(newTemplates)) {
          // Avoid duplicates by checking IDs
          const existingIds = new Set(this._templates[os][browser].map(t => t.id));
          for (const template of newTemplates) {
            if (!existingIds.has(template.id)) {
              this._templates[os][browser].push(template);
              importCount++;
            }
          }
        }
      }
    }
    
    return importCount;
  }

  /**
   * Exports the database to a JSON-serializable object
   * @returns {Object} Exportable database object
   */
  exportData() {
    this.initialize();
    return {
      version: this.version,
      lastUpdated: this.lastUpdated,
      description: 'Real browser fingerprint database for professional fingerprint spoofing',
      sources: ['public-test-datasets', 'synthetic-combinations'],
      fingerprints: JSON.parse(JSON.stringify(this._templates))
    };
  }

  /**
   * Gets database statistics
   * @returns {Object} Statistics about the database
   */
  getStatistics() {
    this.initialize();
    const stats = {
      version: this.version,
      lastUpdated: this.lastUpdated,
      totalTemplates: 0,
      byOS: {},
      byBrowser: {}
    };
    
    for (const os of Object.keys(this._templates)) {
      stats.byOS[os] = 0;
      for (const browser of Object.keys(this._templates[os])) {
        const count = this._templates[os][browser].length;
        stats.byOS[os] += count;
        stats.totalTemplates += count;
        
        if (!stats.byBrowser[browser]) {
          stats.byBrowser[browser] = 0;
        }
        stats.byBrowser[browser] += count;
      }
    }
    
    return stats;
  }
}

// Attach enums to the class
FingerprintDatabase.OSType = OSType;
FingerprintDatabase.BrowserType = BrowserType;

module.exports = FingerprintDatabase;
