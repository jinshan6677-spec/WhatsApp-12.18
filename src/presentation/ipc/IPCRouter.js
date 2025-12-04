/**
 * IPCRouter - Structured IPC communication layer
 * 
 * Provides typed IPC channels with request/response schemas,
 * timeout handling, batch processing, and structured error responses.
 * 
 * @module presentation/ipc/IPCRouter
 */

'use strict';

const IPCError = require('../../core/errors/IPCError');
const { EventSchema } = require('../../core/eventbus/EventSchema');

/**
 * @typedef {Object} IPCRequest
 * @property {string} channel - IPC channel name
 * @property {*} payload - Request payload
 * @property {string} requestId - Unique request identifier
 * @property {number} [timeout] - Request timeout in milliseconds
 */

/**
 * @typedef {Object} IPCResponse
 * @property {string} requestId - Request identifier
 * @property {boolean} success - Whether the request succeeded
 * @property {*} [data] - Response data (on success)
 * @property {Object} [error] - Error object (on failure)
 */

/**
 * @typedef {Object} ChannelInfo
 * @property {string} channel - Channel name
 * @property {string} [description] - Channel description
 * @property {Object} [requestSchema] - Request schema definition
 * @property {Object} [responseSchema] - Response schema definition
 * @property {number} [defaultTimeout] - Default timeout for this channel
 */

/**
 * @typedef {Object} IPCRouterOptions
 * @property {number} [defaultTimeout=30000] - Default request timeout in ms
 * @property {Function} [logger] - Logger function for errors
 */

/**
 * Generates a unique request ID
 * @returns {string} Unique ID
 */
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}


class IPCRouter {
  /**
   * Creates a new IPCRouter instance
   * @param {IPCRouterOptions} [options={}] - Configuration options
   */
  constructor(options = {}) {
    this._handlers = new Map(); // Map<channel, {handler, schema, description, defaultTimeout}>
    this._defaultTimeout = options.defaultTimeout ?? 30000;
    this._logger = options.logger ?? console.error.bind(console);
  }

  /**
   * Registers an IPC handler for a channel
   * @param {string} channel - Channel name
   * @param {Function} handler - Handler function (request, context) => Promise<any>
   * @param {Object} [options={}] - Registration options
   * @param {Object} [options.schema] - Request schema for validation
   * @param {string} [options.description] - Channel description
   * @param {number} [options.defaultTimeout] - Default timeout for this channel
   * @throws {Error} If channel is invalid or already registered
   */
  register(channel, handler, options = {}) {
    if (!channel || typeof channel !== 'string') {
      throw new Error('Channel name must be a non-empty string');
    }
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    if (this._handlers.has(channel)) {
      throw new Error(`Channel "${channel}" is already registered`);
    }

    // Convert schema definition to EventSchema if needed
    let schema = null;
    if (options.schema) {
      schema = options.schema instanceof EventSchema 
        ? options.schema 
        : new EventSchema(options.schema);
    }

    this._handlers.set(channel, {
      handler,
      schema,
      description: options.description || '',
      defaultTimeout: options.defaultTimeout ?? this._defaultTimeout
    });
  }

  /**
   * Unregisters an IPC handler
   * @param {string} channel - Channel name to unregister
   * @returns {boolean} True if handler was removed, false if not found
   */
  unregister(channel) {
    return this._handlers.delete(channel);
  }

  /**
   * Checks if a channel is registered
   * @param {string} channel - Channel name
   * @returns {boolean} True if channel is registered
   */
  hasChannel(channel) {
    return this._handlers.has(channel);
  }

  /**
   * Handles an IPC request
   * @param {string} channel - Channel name
   * @param {IPCRequest} request - IPC request object
   * @returns {Promise<IPCResponse>} IPC response
   */
  async handle(channel, request) {
    const requestId = request.requestId || generateRequestId();
    
    try {
      // Check if channel exists
      const registration = this._handlers.get(channel);
      if (!registration) {
        throw IPCError.handlerFailed(channel, requestId, new Error(`Channel "${channel}" not found`));
      }

      // Validate payload against schema if defined
      if (registration.schema) {
        const validationResult = registration.schema.validate(request.payload);
        if (!validationResult.valid) {
          throw IPCError.validationFailed(channel, requestId, validationResult.errors);
        }
      }

      // Determine timeout
      const timeout = request.timeout ?? registration.defaultTimeout;

      // Execute handler with timeout
      const result = await this._executeWithTimeout(
        registration.handler,
        request,
        { channel, requestId },
        timeout
      );

      return {
        requestId,
        success: true,
        data: result
      };
    } catch (error) {
      return this._createErrorResponse(requestId, channel, error);
    }
  }


  /**
   * Executes a handler with timeout
   * @private
   * @param {Function} handler - Handler function
   * @param {IPCRequest} request - Request object
   * @param {Object} context - Execution context
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<*>} Handler result
   */
  async _executeWithTimeout(handler, request, context, timeout) {
    if (timeout <= 0) {
      // No timeout, execute directly
      return handler(request, context);
    }

    return new Promise((resolve, reject) => {
      let timeoutId = null;
      let completed = false;

      // Set up timeout
      timeoutId = setTimeout(() => {
        if (!completed) {
          completed = true;
          reject(IPCError.timeout(context.channel, context.requestId, timeout));
        }
      }, timeout);

      // Execute handler
      Promise.resolve(handler(request, context))
        .then((result) => {
          if (!completed) {
            completed = true;
            clearTimeout(timeoutId);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!completed) {
            completed = true;
            clearTimeout(timeoutId);
            reject(error);
          }
        });
    });
  }

  /**
   * Creates a structured error response
   * @private
   * @param {string} requestId - Request ID
   * @param {string} channel - Channel name
   * @param {Error} error - Error object
   * @returns {IPCResponse} Error response
   */
  _createErrorResponse(requestId, channel, error) {
    // Log the error
    this._logger(`IPCRouter: Error handling request on channel "${channel}":`, error);

    // Convert to IPCError if not already
    let ipcError;
    if (error instanceof IPCError) {
      ipcError = error;
    } else {
      ipcError = IPCError.handlerFailed(channel, requestId, error);
    }

    return {
      requestId,
      success: false,
      error: {
        code: ipcError.code,
        message: ipcError.message,
        context: ipcError.context,
        recoverable: ipcError.recoverable
      }
    };
  }

  /**
   * Processes a batch of IPC requests
   * @param {IPCRequest[]} requests - Array of IPC requests
   * @returns {Promise<IPCResponse[]>} Array of responses in same order as requests
   */
  async batch(requests) {
    if (!Array.isArray(requests)) {
      throw new Error('Batch requests must be an array');
    }

    // Process all requests in parallel, maintaining order
    const responses = await Promise.all(
      requests.map(async (request) => {
        const channel = request.channel;
        if (!channel) {
          return {
            requestId: request.requestId || generateRequestId(),
            success: false,
            error: {
              code: 'IPC_ERROR',
              message: 'Request missing channel',
              context: { type: 'validation' },
              recoverable: true
            }
          };
        }
        return this.handle(channel, request);
      })
    );

    return responses;
  }


  /**
   * Gets information about all registered channels
   * @returns {ChannelInfo[]} Array of channel information
   */
  getChannels() {
    const channels = [];
    for (const [channel, registration] of this._handlers) {
      channels.push({
        channel,
        description: registration.description,
        requestSchema: registration.schema ? registration.schema.getDefinition() : null,
        defaultTimeout: registration.defaultTimeout
      });
    }
    return channels;
  }

  /**
   * Gets information about a specific channel
   * @param {string} channel - Channel name
   * @returns {ChannelInfo|null} Channel info or null if not found
   */
  getChannelInfo(channel) {
    const registration = this._handlers.get(channel);
    if (!registration) {
      return null;
    }
    return {
      channel,
      description: registration.description,
      requestSchema: registration.schema ? registration.schema.getDefinition() : null,
      defaultTimeout: registration.defaultTimeout
    };
  }

  /**
   * Gets the number of registered channels
   * @returns {number} Number of channels
   */
  getChannelCount() {
    return this._handlers.size;
  }

  /**
   * Clears all registered handlers
   */
  clear() {
    this._handlers.clear();
  }

  /**
   * Sets the default timeout for new registrations
   * @param {number} timeout - Timeout in milliseconds
   */
  setDefaultTimeout(timeout) {
    if (typeof timeout !== 'number' || timeout < 0) {
      throw new Error('Timeout must be a non-negative number');
    }
    this._defaultTimeout = timeout;
  }

  /**
   * Gets the default timeout
   * @returns {number} Default timeout in milliseconds
   */
  getDefaultTimeout() {
    return this._defaultTimeout;
  }

  /**
   * Generates documentation for all registered channels
   * @returns {string} Markdown documentation
   */
  generateDocumentation() {
    const channels = this.getChannels();
    
    if (channels.length === 0) {
      return '# IPC Channels\n\nNo channels registered.';
    }

    let doc = '# IPC Channels\n\n';
    doc += `Total channels: ${channels.length}\n\n`;

    for (const info of channels) {
      doc += `## ${info.channel}\n\n`;
      
      if (info.description) {
        doc += `${info.description}\n\n`;
      }

      doc += `**Default Timeout:** ${info.defaultTimeout}ms\n\n`;

      if (info.requestSchema) {
        doc += '**Request Schema:**\n\n```json\n';
        doc += JSON.stringify(info.requestSchema, null, 2);
        doc += '\n```\n\n';
      } else {
        doc += '**Request Schema:** None (accepts any payload)\n\n';
      }

      doc += '---\n\n';
    }

    return doc;
  }
}

module.exports = { IPCRouter, generateRequestId };
