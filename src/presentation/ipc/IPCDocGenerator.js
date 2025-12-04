/**
 * IPCDocGenerator - Documentation generator for IPC channels
 * 
 * Generates API documentation from IPC channel type definitions.
 * 
 * @module presentation/ipc/IPCDocGenerator
 */

'use strict';

/**
 * @typedef {Object} ChannelDefinition
 * @property {string} channel - Channel name
 * @property {string} [description] - Channel description
 * @property {Object} [requestSchema] - Request schema definition
 * @property {Object} [responseSchema] - Response schema definition
 * @property {number} [defaultTimeout] - Default timeout
 * @property {string[]} [examples] - Usage examples
 * @property {string} [since] - Version when channel was added
 * @property {boolean} [deprecated] - Whether channel is deprecated
 * @property {string} [deprecationMessage] - Deprecation message
 */

/**
 * @typedef {Object} DocGeneratorOptions
 * @property {string} [title='IPC API Documentation'] - Document title
 * @property {string} [description] - Document description
 * @property {string} [version] - API version
 */

class IPCDocGenerator {
  /**
   * Creates a new IPCDocGenerator
   * @param {DocGeneratorOptions} [options={}] - Generator options
   */
  constructor(options = {}) {
    this._title = options.title || 'IPC API Documentation';
    this._description = options.description || '';
    this._version = options.version || '1.0.0';
    this._channels = [];
  }

  /**
   * Adds a channel definition for documentation
   * @param {ChannelDefinition} definition - Channel definition
   */
  addChannel(definition) {
    if (!definition.channel) {
      throw new Error('Channel name is required');
    }
    this._channels.push({ ...definition });
  }


  /**
   * Imports channel definitions from an IPCRouter instance
   * @param {Object} router - IPCRouter instance
   */
  importFromRouter(router) {
    if (typeof router.getChannels !== 'function') {
      throw new Error('Invalid router: must have getChannels method');
    }
    const channels = router.getChannels();
    for (const channel of channels) {
      this.addChannel(channel);
    }
  }

  /**
   * Generates Markdown documentation
   * @returns {string} Markdown documentation
   */
  generateMarkdown() {
    let doc = `# ${this._title}\n\n`;
    
    if (this._version) {
      doc += `**Version:** ${this._version}\n\n`;
    }
    
    if (this._description) {
      doc += `${this._description}\n\n`;
    }

    doc += `## Table of Contents\n\n`;
    for (const channel of this._channels) {
      const anchor = channel.channel.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const deprecated = channel.deprecated ? ' ⚠️ DEPRECATED' : '';
      doc += `- [${channel.channel}](#${anchor})${deprecated}\n`;
    }
    doc += '\n---\n\n';

    doc += `## Channels\n\n`;
    doc += `Total: ${this._channels.length} channels\n\n`;

    for (const channel of this._channels) {
      doc += this._generateChannelDoc(channel);
    }

    return doc;
  }

  /**
   * Generates documentation for a single channel
   * @private
   */
  _generateChannelDoc(channel) {
    let doc = `### ${channel.channel}\n\n`;

    if (channel.deprecated) {
      doc += `> ⚠️ **DEPRECATED**`;
      if (channel.deprecationMessage) {
        doc += `: ${channel.deprecationMessage}`;
      }
      doc += '\n\n';
    }

    if (channel.description) {
      doc += `${channel.description}\n\n`;
    }

    if (channel.since) {
      doc += `**Since:** v${channel.since}\n\n`;
    }

    doc += `**Timeout:** ${channel.defaultTimeout || 30000}ms\n\n`;

    if (channel.requestSchema) {
      doc += `#### Request Schema\n\n`;
      doc += '```json\n';
      doc += JSON.stringify(channel.requestSchema, null, 2);
      doc += '\n```\n\n';
    }

    if (channel.responseSchema) {
      doc += `#### Response Schema\n\n`;
      doc += '```json\n';
      doc += JSON.stringify(channel.responseSchema, null, 2);
      doc += '\n```\n\n';
    }

    if (channel.examples && channel.examples.length > 0) {
      doc += `#### Examples\n\n`;
      for (const example of channel.examples) {
        doc += '```javascript\n';
        doc += example;
        doc += '\n```\n\n';
      }
    }

    doc += '---\n\n';
    return doc;
  }


  /**
   * Generates JSON documentation
   * @returns {Object} JSON documentation object
   */
  generateJSON() {
    return {
      title: this._title,
      version: this._version,
      description: this._description,
      generatedAt: new Date().toISOString(),
      channels: this._channels.map(ch => ({
        ...ch,
        requestSchema: ch.requestSchema || null,
        responseSchema: ch.responseSchema || null
      }))
    };
  }

  /**
   * Generates HTML documentation
   * @returns {string} HTML documentation
   */
  generateHTML() {
    const json = this.generateJSON();
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this._escapeHtml(this._title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #2c3e50; margin-top: 30px; }
    h3 { color: #34495e; border-left: 4px solid #3498db; padding-left: 10px; }
    .deprecated { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; margin: 10px 0; }
    .schema { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
    pre { margin: 0; }
    code { font-family: 'Monaco', 'Menlo', monospace; font-size: 13px; }
    .meta { color: #666; font-size: 14px; }
    .toc { background: #f8f9fa; padding: 15px; border-radius: 4px; }
    .toc ul { list-style: none; padding-left: 0; }
    .toc li { margin: 5px 0; }
    .toc a { text-decoration: none; color: #3498db; }
    .toc a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>${this._escapeHtml(this._title)}</h1>
  <p class="meta">Version: ${this._escapeHtml(this._version)} | Generated: ${json.generatedAt}</p>
`;

    if (this._description) {
      html += `  <p>${this._escapeHtml(this._description)}</p>\n`;
    }

    // Table of contents
    html += `  <div class="toc">\n    <h2>Table of Contents</h2>\n    <ul>\n`;
    for (const ch of this._channels) {
      const anchor = ch.channel.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const deprecated = ch.deprecated ? ' ⚠️' : '';
      html += `      <li><a href="#${anchor}">${this._escapeHtml(ch.channel)}${deprecated}</a></li>\n`;
    }
    html += `    </ul>\n  </div>\n\n`;

    // Channels
    html += `  <h2>Channels (${this._channels.length})</h2>\n`;
    for (const ch of this._channels) {
      html += this._generateChannelHTML(ch);
    }

    html += `</body>\n</html>`;
    return html;
  }

  /**
   * Generates HTML for a single channel
   * @private
   */
  _generateChannelHTML(channel) {
    const anchor = channel.channel.toLowerCase().replace(/[^a-z0-9]/g, '-');
    let html = `  <h3 id="${anchor}">${this._escapeHtml(channel.channel)}</h3>\n`;

    if (channel.deprecated) {
      html += `  <div class="deprecated">⚠️ <strong>DEPRECATED</strong>`;
      if (channel.deprecationMessage) {
        html += `: ${this._escapeHtml(channel.deprecationMessage)}`;
      }
      html += `</div>\n`;
    }

    if (channel.description) {
      html += `  <p>${this._escapeHtml(channel.description)}</p>\n`;
    }

    html += `  <p class="meta">Timeout: ${channel.defaultTimeout || 30000}ms</p>\n`;

    if (channel.requestSchema) {
      html += `  <h4>Request Schema</h4>\n`;
      html += `  <div class="schema"><pre><code>${this._escapeHtml(JSON.stringify(channel.requestSchema, null, 2))}</code></pre></div>\n`;
    }

    if (channel.responseSchema) {
      html += `  <h4>Response Schema</h4>\n`;
      html += `  <div class="schema"><pre><code>${this._escapeHtml(JSON.stringify(channel.responseSchema, null, 2))}</code></pre></div>\n`;
    }

    html += `  <hr>\n`;
    return html;
  }

  /**
   * Escapes HTML special characters
   * @private
   */
  _escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Gets all channel definitions
   * @returns {ChannelDefinition[]} Channel definitions
   */
  getChannels() {
    return [...this._channels];
  }

  /**
   * Clears all channel definitions
   */
  clear() {
    this._channels = [];
  }
}

module.exports = { IPCDocGenerator };
