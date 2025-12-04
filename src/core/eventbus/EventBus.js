/**
 * EventBus - Centralized publish-subscribe event system
 * 
 * Provides asynchronous event delivery, event history, and subscriber management.
 * 
 * @module core/eventbus/EventBus
 */

'use strict';

/**
 * @typedef {Object} EventRecord
 * @property {string} event - Event name
 * @property {*} payload - Event payload
 * @property {number} timestamp - Unix timestamp when event was published
 * @property {number} subscribers - Number of subscribers notified
 */

/**
 * @typedef {Object} EventBusOptions
 * @property {number} [historyRetentionMs=300000] - How long to retain event history (default: 5 minutes)
 * @property {number} [maxHistorySize=1000] - Maximum number of events to retain
 * @property {Function} [logger] - Logger function for errors
 */

class EventBus {
  /**
   * Creates a new EventBus instance
   * @param {EventBusOptions} [options={}] - Configuration options
   */
  constructor(options = {}) {
    this._subscribers = new Map(); // Map<eventName, Set<{handler, once}>>
    this._history = [];
    this._historyRetentionMs = options.historyRetentionMs ?? 300000; // 5 minutes default
    this._maxHistorySize = options.maxHistorySize ?? 1000;
    this._logger = options.logger ?? console.error.bind(console);
    this._schemas = new Map(); // Map<eventName, schema> - for typed events
  }

  /**
   * Registers a schema for typed event validation
   * @param {string} event - Event name
   * @param {Object} schema - Schema object with validate method
   */
  registerSchema(event, schema) {
    if (!event || typeof event !== 'string') {
      throw new Error('Event name must be a non-empty string');
    }
    this._schemas.set(event, schema);
  }

  /**
   * Gets the schema for an event
   * @param {string} event - Event name
   * @returns {Object|undefined} Schema if registered
   */
  getSchema(event) {
    return this._schemas.get(event);
  }


  /**
   * Publishes an event to all subscribers asynchronously
   * @param {string} event - Event name
   * @param {*} payload - Event payload
   * @returns {Promise<void>} Resolves when all subscribers have been notified
   * @throws {Error} If event name is invalid or payload validation fails
   */
  async publish(event, payload) {
    if (!event || typeof event !== 'string') {
      throw new Error('Event name must be a non-empty string');
    }

    // Validate payload against schema if registered
    const schema = this._schemas.get(event);
    if (schema) {
      const validationResult = schema.validate(payload);
      if (!validationResult.valid) {
        const error = new Error(`Event payload validation failed: ${validationResult.errors.join(', ')}`);
        error.code = 'VALIDATION_ERROR';
        error.validationErrors = validationResult.errors;
        throw error;
      }
    }

    const subscribers = this._subscribers.get(event);
    const subscriberCount = subscribers ? subscribers.size : 0;

    // Record event in history
    this._recordEvent(event, payload, subscriberCount);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    // Collect once subscribers to remove after notification
    const onceSubscribers = [];

    // Notify all subscribers asynchronously with error isolation
    const notifications = Array.from(subscribers).map(async (subscription) => {
      try {
        await Promise.resolve(subscription.handler(payload));
      } catch (error) {
        // Log error but don't propagate - error isolation
        this._logger(`EventBus: Subscriber error for event "${event}":`, error);
      }

      if (subscription.once) {
        onceSubscribers.push(subscription);
      }
    });

    await Promise.all(notifications);

    // Remove once subscribers
    for (const subscription of onceSubscribers) {
      subscribers.delete(subscription);
    }
  }

  /**
   * Subscribes to an event
   * @param {string} event - Event name
   * @param {Function} handler - Handler function to call when event is published
   * @returns {Function} Unsubscribe function
   */
  subscribe(event, handler) {
    return this._addSubscription(event, handler, false);
  }

  /**
   * Subscribes to an event for a single notification only
   * @param {string} event - Event name
   * @param {Function} handler - Handler function to call when event is published
   * @returns {Function} Unsubscribe function
   */
  subscribeOnce(event, handler) {
    return this._addSubscription(event, handler, true);
  }

  /**
   * Internal method to add a subscription
   * @private
   */
  _addSubscription(event, handler, once) {
    if (!event || typeof event !== 'string') {
      throw new Error('Event name must be a non-empty string');
    }
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    if (!this._subscribers.has(event)) {
      this._subscribers.set(event, new Set());
    }

    const subscription = { handler, once };
    this._subscribers.get(event).add(subscription);

    // Return unsubscribe function
    return () => {
      const subs = this._subscribers.get(event);
      if (subs) {
        subs.delete(subscription);
        if (subs.size === 0) {
          this._subscribers.delete(event);
        }
      }
    };
  }


  /**
   * Records an event in history
   * @private
   */
  _recordEvent(event, payload, subscriberCount) {
    const record = {
      event,
      payload,
      timestamp: Date.now(),
      subscribers: subscriberCount
    };

    this._history.push(record);

    // Trim history if exceeds max size
    if (this._history.length > this._maxHistorySize) {
      this._history = this._history.slice(-this._maxHistorySize);
    }

    // Clean up old events based on retention period
    this._cleanupHistory();
  }

  /**
   * Removes events older than retention period
   * @private
   */
  _cleanupHistory() {
    const cutoff = Date.now() - this._historyRetentionMs;
    this._history = this._history.filter(record => record.timestamp >= cutoff);
  }

  /**
   * Gets event history
   * @param {string} [event] - Optional event name to filter by
   * @param {number} [limit] - Optional limit on number of records to return
   * @returns {EventRecord[]} Array of event records
   */
  getHistory(event, limit) {
    this._cleanupHistory();

    let result = this._history;

    if (event) {
      result = result.filter(record => record.event === event);
    }

    if (typeof limit === 'number' && limit > 0) {
      result = result.slice(-limit);
    }

    // Return copies to prevent mutation
    return result.map(record => ({ ...record }));
  }

  /**
   * Clears all subscribers and history
   */
  clear() {
    this._subscribers.clear();
    this._history = [];
  }

  /**
   * Clears only the event history
   */
  clearHistory() {
    this._history = [];
  }

  /**
   * Gets the number of subscribers for an event
   * @param {string} event - Event name
   * @returns {number} Number of subscribers
   */
  getSubscriberCount(event) {
    const subs = this._subscribers.get(event);
    return subs ? subs.size : 0;
  }

  /**
   * Gets all registered event names
   * @returns {string[]} Array of event names
   */
  getEventNames() {
    return Array.from(this._subscribers.keys());
  }

  /**
   * Checks if an event has any subscribers
   * @param {string} event - Event name
   * @returns {boolean} True if event has subscribers
   */
  hasSubscribers(event) {
    return this.getSubscriberCount(event) > 0;
  }
}

module.exports = { EventBus };
