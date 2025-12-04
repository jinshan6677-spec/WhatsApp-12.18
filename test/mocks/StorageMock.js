/**
 * Mock implementation for Storage operations
 * Used for testing components that depend on file system or storage without actual I/O
 * 
 * @module test/mocks/StorageMock
 * Requirements: 10.1
 */

'use strict';

/**
 * In-memory storage mock that simulates key-value storage
 */
class StorageMock {
  constructor() {
    this._data = new Map();
    this._writeDelay = 0;
    this._readDelay = 0;
    this._shouldFailOnWrite = false;
    this._shouldFailOnRead = false;
    this._writeError = null;
    this._readError = null;
    this._writeCount = 0;
    this._readCount = 0;
  }

  /**
   * Read a value from storage
   * @param {string} key - The key to read
   * @returns {Promise<any>} The stored value or undefined
   */
  async read(key) {
    this._readCount++;
    
    if (this._readDelay > 0) {
      await this._delay(this._readDelay);
    }
    
    if (this._shouldFailOnRead) {
      throw this._readError || new Error(`Failed to read key: ${key}`);
    }
    
    return this._data.get(key);
  }

  /**
   * Write a value to storage
   * @param {string} key - The key to write
   * @param {any} value - The value to store
   * @returns {Promise<void>}
   */
  async write(key, value) {
    this._writeCount++;
    
    if (this._writeDelay > 0) {
      await this._delay(this._writeDelay);
    }
    
    if (this._shouldFailOnWrite) {
      throw this._writeError || new Error(`Failed to write key: ${key}`);
    }
    
    this._data.set(key, value);
  }

  /**
   * Delete a value from storage
   * @param {string} key - The key to delete
   * @returns {Promise<boolean>} True if the key existed
   */
  async delete(key) {
    const existed = this._data.has(key);
    this._data.delete(key);
    return existed;
  }

  /**
   * Check if a key exists in storage
   * @param {string} key - The key to check
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    return this._data.has(key);
  }

  /**
   * Get all keys in storage
   * @returns {Promise<string[]>}
   */
  async keys() {
    return Array.from(this._data.keys());
  }

  /**
   * Get all values in storage
   * @returns {Promise<any[]>}
   */
  async values() {
    return Array.from(this._data.values());
  }

  /**
   * Get all entries in storage
   * @returns {Promise<[string, any][]>}
   */
  async entries() {
    return Array.from(this._data.entries());
  }

  /**
   * Clear all data from storage
   */
  clear() {
    this._data.clear();
  }

  /**
   * Get the number of items in storage
   * @returns {number}
   */
  get size() {
    return this._data.size;
  }

  // Testing utilities

  /**
   * Set delay for read operations (simulates slow storage)
   * @param {number} ms - Delay in milliseconds
   */
  setReadDelay(ms) {
    this._readDelay = ms;
  }

  /**
   * Set delay for write operations (simulates slow storage)
   * @param {number} ms - Delay in milliseconds
   */
  setWriteDelay(ms) {
    this._writeDelay = ms;
  }

  /**
   * Configure read operations to fail
   * @param {boolean} shouldFail - Whether reads should fail
   * @param {Error} [error] - Optional custom error
   */
  setReadFailure(shouldFail, error = null) {
    this._shouldFailOnRead = shouldFail;
    this._readError = error;
  }

  /**
   * Configure write operations to fail
   * @param {boolean} shouldFail - Whether writes should fail
   * @param {Error} [error] - Optional custom error
   */
  setWriteFailure(shouldFail, error = null) {
    this._shouldFailOnWrite = shouldFail;
    this._writeError = error;
  }

  /**
   * Get the number of read operations performed
   * @returns {number}
   */
  getReadCount() {
    return this._readCount;
  }

  /**
   * Get the number of write operations performed
   * @returns {number}
   */
  getWriteCount() {
    return this._writeCount;
  }

  /**
   * Reset all state including data and configuration
   */
  reset() {
    this._data.clear();
    this._writeDelay = 0;
    this._readDelay = 0;
    this._shouldFailOnWrite = false;
    this._shouldFailOnRead = false;
    this._writeError = null;
    this._readError = null;
    this._writeCount = 0;
    this._readCount = 0;
  }

  /**
   * Get a snapshot of current data (for debugging)
   * @returns {Object}
   */
  snapshot() {
    const obj = {};
    this._data.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


/**
 * File system mock that simulates file operations
 */
class FileSystemMock {
  constructor() {
    this._files = new Map();
    this._directories = new Set(['/']);
    this._shouldFailOnRead = false;
    this._shouldFailOnWrite = false;
  }

  /**
   * Read a file
   * @param {string} path - File path
   * @param {string} [encoding='utf8'] - File encoding
   * @returns {Promise<string|Buffer>}
   */
  async readFile(path, encoding = 'utf8') {
    if (this._shouldFailOnRead) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    
    if (!this._files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    
    const content = this._files.get(path);
    return encoding ? content : Buffer.from(content);
  }

  /**
   * Write a file
   * @param {string} path - File path
   * @param {string|Buffer} data - File content
   * @returns {Promise<void>}
   */
  async writeFile(path, data) {
    if (this._shouldFailOnWrite) {
      throw new Error(`EACCES: permission denied, open '${path}'`);
    }
    
    // Ensure parent directory exists
    const dir = this._dirname(path);
    if (!this._directories.has(dir)) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    
    this._files.set(path, data.toString());
  }

  /**
   * Delete a file
   * @param {string} path - File path
   * @returns {Promise<void>}
   */
  async unlink(path) {
    if (!this._files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, unlink '${path}'`);
    }
    this._files.delete(path);
  }

  /**
   * Check if a file or directory exists
   * @param {string} path - Path to check
   * @returns {Promise<boolean>}
   */
  async exists(path) {
    return this._files.has(path) || this._directories.has(path);
  }

  /**
   * Create a directory
   * @param {string} path - Directory path
   * @param {Object} [options] - Options
   * @returns {Promise<void>}
   */
  async mkdir(path, options = {}) {
    if (options.recursive) {
      const parts = path.split('/').filter(Boolean);
      let current = '';
      for (const part of parts) {
        current += '/' + part;
        this._directories.add(current);
      }
    } else {
      const parent = this._dirname(path);
      if (!this._directories.has(parent)) {
        throw new Error(`ENOENT: no such file or directory, mkdir '${path}'`);
      }
      this._directories.add(path);
    }
  }

  /**
   * Remove a directory
   * @param {string} path - Directory path
   * @returns {Promise<void>}
   */
  async rmdir(path) {
    if (!this._directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, rmdir '${path}'`);
    }
    
    // Check if directory is empty
    for (const file of this._files.keys()) {
      if (file.startsWith(path + '/')) {
        throw new Error(`ENOTEMPTY: directory not empty, rmdir '${path}'`);
      }
    }
    
    this._directories.delete(path);
  }

  /**
   * List directory contents
   * @param {string} path - Directory path
   * @returns {Promise<string[]>}
   */
  async readdir(path) {
    if (!this._directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    }
    
    const entries = new Set();
    const prefix = path === '/' ? '/' : path + '/';
    
    // Add files
    for (const file of this._files.keys()) {
      if (file.startsWith(prefix)) {
        const relative = file.slice(prefix.length);
        const firstPart = relative.split('/')[0];
        entries.add(firstPart);
      }
    }
    
    // Add subdirectories
    for (const dir of this._directories) {
      if (dir.startsWith(prefix) && dir !== path) {
        const relative = dir.slice(prefix.length);
        const firstPart = relative.split('/')[0];
        entries.add(firstPart);
      }
    }
    
    return Array.from(entries);
  }

  /**
   * Get file stats
   * @param {string} path - Path to stat
   * @returns {Promise<Object>}
   */
  async stat(path) {
    const isFile = this._files.has(path);
    const isDir = this._directories.has(path);
    
    if (!isFile && !isDir) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
    
    return {
      isFile: () => isFile,
      isDirectory: () => isDir,
      size: isFile ? this._files.get(path).length : 0,
      mtime: new Date(),
      ctime: new Date()
    };
  }

  // Testing utilities

  /**
   * Set up a file with content
   * @param {string} path - File path
   * @param {string} content - File content
   */
  setFile(path, content) {
    // Ensure parent directories exist
    const parts = this._dirname(path).split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current += '/' + part;
      this._directories.add(current);
    }
    this._files.set(path, content);
  }

  /**
   * Configure read operations to fail
   * @param {boolean} shouldFail
   */
  setReadFailure(shouldFail) {
    this._shouldFailOnRead = shouldFail;
  }

  /**
   * Configure write operations to fail
   * @param {boolean} shouldFail
   */
  setWriteFailure(shouldFail) {
    this._shouldFailOnWrite = shouldFail;
  }

  /**
   * Reset all state
   */
  reset() {
    this._files.clear();
    this._directories.clear();
    this._directories.add('/');
    this._shouldFailOnRead = false;
    this._shouldFailOnWrite = false;
  }

  _dirname(path) {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }
}

/**
 * JSON file storage mock (simulates electron-store behavior)
 */
class JsonStoreMock {
  constructor(options = {}) {
    this._name = options.name || 'config';
    this._data = options.defaults ? { ...options.defaults } : {};
    this._schema = options.schema || null;
  }

  get(key, defaultValue) {
    if (key === undefined) {
      return { ...this._data };
    }
    
    const keys = key.split('.');
    let value = this._data;
    
    for (const k of keys) {
      if (value === undefined || value === null) {
        return defaultValue;
      }
      value = value[k];
    }
    
    return value !== undefined ? value : defaultValue;
  }

  set(key, value) {
    if (typeof key === 'object') {
      Object.assign(this._data, key);
      return;
    }
    
    const keys = key.split('.');
    let obj = this._data;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in obj)) {
        obj[k] = {};
      }
      obj = obj[k];
    }
    
    obj[keys[keys.length - 1]] = value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    const keys = key.split('.');
    let obj = this._data;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in obj)) {
        return;
      }
      obj = obj[k];
    }
    
    delete obj[keys[keys.length - 1]];
  }

  clear() {
    this._data = {};
  }

  get size() {
    return Object.keys(this._data).length;
  }

  get store() {
    return { ...this._data };
  }

  set store(value) {
    this._data = { ...value };
  }

  get path() {
    return `/mock/path/${this._name}.json`;
  }

  reset() {
    this._data = {};
  }
}

module.exports = {
  StorageMock,
  FileSystemMock,
  JsonStoreMock
};
