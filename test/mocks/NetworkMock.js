/**
 * Mock implementation for Network operations
 * Used for testing components that depend on network without actual HTTP requests
 * 
 * @module test/mocks/NetworkMock
 * Requirements: 10.1
 */

'use strict';

/**
 * Mock HTTP response
 */
class MockResponse {
  constructor(body, options = {}) {
    this._body = body;
    this.status = options.status || 200;
    this.statusText = options.statusText || 'OK';
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new MockHeaders(options.headers || {});
    this.url = options.url || '';
    this.redirected = options.redirected || false;
  }

  async json() {
    if (typeof this._body === 'string') {
      return JSON.parse(this._body);
    }
    return this._body;
  }

  async text() {
    if (typeof this._body === 'string') {
      return this._body;
    }
    return JSON.stringify(this._body);
  }

  async blob() {
    return new Blob([await this.text()]);
  }

  async arrayBuffer() {
    const text = await this.text();
    const encoder = new TextEncoder();
    return encoder.encode(text).buffer;
  }

  clone() {
    return new MockResponse(this._body, {
      status: this.status,
      statusText: this.statusText,
      headers: Object.fromEntries(this.headers.entries()),
      url: this.url,
      redirected: this.redirected
    });
  }
}

/**
 * Mock Headers implementation
 */
class MockHeaders {
  constructor(init = {}) {
    this._headers = new Map();
    
    if (init instanceof MockHeaders) {
      init.forEach((value, key) => this.set(key, value));
    } else if (Array.isArray(init)) {
      init.forEach(([key, value]) => this.set(key, value));
    } else if (typeof init === 'object') {
      Object.entries(init).forEach(([key, value]) => this.set(key, value));
    }
  }

  append(name, value) {
    const key = name.toLowerCase();
    const existing = this._headers.get(key);
    if (existing) {
      this._headers.set(key, `${existing}, ${value}`);
    } else {
      this._headers.set(key, value);
    }
  }

  delete(name) {
    this._headers.delete(name.toLowerCase());
  }

  get(name) {
    return this._headers.get(name.toLowerCase()) || null;
  }

  has(name) {
    return this._headers.has(name.toLowerCase());
  }

  set(name, value) {
    this._headers.set(name.toLowerCase(), value);
  }

  entries() {
    return this._headers.entries();
  }

  keys() {
    return this._headers.keys();
  }

  values() {
    return this._headers.values();
  }

  forEach(callback) {
    this._headers.forEach((value, key) => callback(value, key, this));
  }
}

/**
 * Network mock that intercepts and simulates HTTP requests
 */
class NetworkMock {
  constructor() {
    this._handlers = new Map();
    this._defaultHandler = null;
    this._requestLog = [];
    this._latency = 0;
    this._shouldFail = false;
    this._failureError = null;
  }

  /**
   * Register a handler for a specific URL pattern
   * @param {string|RegExp} pattern - URL pattern to match
   * @param {Function|Object} handler - Handler function or response object
   */
  on(pattern, handler) {
    this._handlers.set(pattern, handler);
  }

  /**
   * Register a handler for GET requests
   * @param {string|RegExp} pattern - URL pattern
   * @param {Function|Object} handler - Handler
   */
  onGet(pattern, handler) {
    this.on({ method: 'GET', url: pattern }, handler);
  }

  /**
   * Register a handler for POST requests
   * @param {string|RegExp} pattern - URL pattern
   * @param {Function|Object} handler - Handler
   */
  onPost(pattern, handler) {
    this.on({ method: 'POST', url: pattern }, handler);
  }

  /**
   * Register a handler for PUT requests
   * @param {string|RegExp} pattern - URL pattern
   * @param {Function|Object} handler - Handler
   */
  onPut(pattern, handler) {
    this.on({ method: 'PUT', url: pattern }, handler);
  }

  /**
   * Register a handler for DELETE requests
   * @param {string|RegExp} pattern - URL pattern
   * @param {Function|Object} handler - Handler
   */
  onDelete(pattern, handler) {
    this.on({ method: 'DELETE', url: pattern }, handler);
  }

  /**
   * Set default handler for unmatched requests
   * @param {Function|Object} handler - Default handler
   */
  setDefault(handler) {
    this._defaultHandler = handler;
  }

  /**
   * Mock fetch function
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Promise<MockResponse>}
   */
  async fetch(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const request = {
      url,
      method,
      headers: new MockHeaders(options.headers),
      body: options.body
    };

    // Log the request
    this._requestLog.push({
      ...request,
      timestamp: Date.now()
    });

    // Apply latency
    if (this._latency > 0) {
      await this._delay(this._latency);
    }

    // Check for forced failure
    if (this._shouldFail) {
      throw this._failureError || new Error('Network request failed');
    }

    // Find matching handler
    const handler = this._findHandler(url, method);
    
    if (!handler) {
      if (this._defaultHandler) {
        return this._executeHandler(this._defaultHandler, request);
      }
      throw new Error(`No handler registered for ${method} ${url}`);
    }

    return this._executeHandler(handler, request);
  }

  _findHandler(url, method) {
    for (const [pattern, handler] of this._handlers) {
      if (typeof pattern === 'string') {
        if (url === pattern || url.includes(pattern)) {
          return handler;
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(url)) {
          return handler;
        }
      } else if (typeof pattern === 'object') {
        const methodMatch = !pattern.method || pattern.method === method;
        let urlMatch = false;
        
        if (typeof pattern.url === 'string') {
          urlMatch = url === pattern.url || url.includes(pattern.url);
        } else if (pattern.url instanceof RegExp) {
          urlMatch = pattern.url.test(url);
        }
        
        if (methodMatch && urlMatch) {
          return handler;
        }
      }
    }
    return null;
  }

  async _executeHandler(handler, request) {
    if (typeof handler === 'function') {
      const result = await handler(request);
      if (result instanceof MockResponse) {
        return result;
      }
      return new MockResponse(result);
    }
    
    if (handler instanceof MockResponse) {
      return handler;
    }
    
    // Handler is a plain object - treat as response body
    return new MockResponse(handler);
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Testing utilities

  /**
   * Set network latency for all requests
   * @param {number} ms - Latency in milliseconds
   */
  setLatency(ms) {
    this._latency = ms;
  }

  /**
   * Configure all requests to fail
   * @param {boolean} shouldFail
   * @param {Error} [error] - Custom error
   */
  setFailure(shouldFail, error = null) {
    this._shouldFail = shouldFail;
    this._failureError = error;
  }

  /**
   * Get all logged requests
   * @returns {Array}
   */
  getRequestLog() {
    return [...this._requestLog];
  }

  /**
   * Get the last request made
   * @returns {Object|null}
   */
  getLastRequest() {
    return this._requestLog[this._requestLog.length - 1] || null;
  }

  /**
   * Clear request log
   */
  clearLog() {
    this._requestLog = [];
  }

  /**
   * Reset all state
   */
  reset() {
    this._handlers.clear();
    this._defaultHandler = null;
    this._requestLog = [];
    this._latency = 0;
    this._shouldFail = false;
    this._failureError = null;
  }
}


/**
 * WebSocket mock for testing real-time communication
 */
class WebSocketMock {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = WebSocketMock.CONNECTING;
    this.bufferedAmount = 0;
    this.extensions = '';
    this.protocol = '';
    this.binaryType = 'blob';

    this._listeners = {
      open: [],
      message: [],
      error: [],
      close: []
    };

    this._messageQueue = [];
    this._autoConnect = true;

    // Auto-connect after a tick
    if (this._autoConnect) {
      setTimeout(() => this._connect(), 0);
    }
  }

  _connect() {
    this.readyState = WebSocketMock.OPEN;
    this._emit('open', { type: 'open' });
  }

  send(data) {
    if (this.readyState !== WebSocketMock.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this._messageQueue.push(data);
  }

  close(code = 1000, reason = '') {
    if (this.readyState === WebSocketMock.CLOSED) {
      return;
    }
    
    this.readyState = WebSocketMock.CLOSING;
    
    setTimeout(() => {
      this.readyState = WebSocketMock.CLOSED;
      this._emit('close', {
        type: 'close',
        code,
        reason,
        wasClean: true
      });
    }, 0);
  }

  addEventListener(type, listener) {
    if (this._listeners[type]) {
      this._listeners[type].push(listener);
    }
  }

  removeEventListener(type, listener) {
    if (this._listeners[type]) {
      const index = this._listeners[type].indexOf(listener);
      if (index !== -1) {
        this._listeners[type].splice(index, 1);
      }
    }
  }

  _emit(type, event) {
    // Call property handler
    const handler = this[`on${type}`];
    if (typeof handler === 'function') {
      handler.call(this, event);
    }

    // Call registered listeners
    if (this._listeners[type]) {
      this._listeners[type].forEach(listener => listener(event));
    }
  }

  // Testing utilities

  /**
   * Simulate receiving a message from server
   * @param {any} data - Message data
   */
  _receiveMessage(data) {
    if (this.readyState !== WebSocketMock.OPEN) {
      return;
    }
    
    this._emit('message', {
      type: 'message',
      data
    });
  }

  /**
   * Simulate a connection error
   * @param {Error} error - Error object
   */
  _simulateError(error) {
    this._emit('error', {
      type: 'error',
      error
    });
  }

  /**
   * Get sent messages
   * @returns {Array}
   */
  _getSentMessages() {
    return [...this._messageQueue];
  }

  /**
   * Clear sent messages
   */
  _clearMessages() {
    this._messageQueue = [];
  }
}


module.exports = {
  NetworkMock,
  MockResponse,
  MockHeaders,
  WebSocketMock
};
