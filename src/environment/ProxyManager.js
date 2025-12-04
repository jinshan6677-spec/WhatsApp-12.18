/**
 * Proxy Manager
 * 
 * Handles proxy configuration and application to Electron sessions.
 * Supports HTTP and HTTPS proxies with authentication.
 * 
 * @module environment/ProxyManager
 */

'use strict';

/**
 * Proxy Manager
 */
class ProxyManager {
    /**
     * Apply proxy configuration to an Electron session
     * @param {Electron.Session} session - Electron session
     * @param {Object} proxyConfig - Proxy configuration
     * @param {boolean} proxyConfig.enabled - Whether proxy is enabled
     * @param {string} proxyConfig.protocol - Proxy protocol (http, https)
     * @param {string} proxyConfig.host - Proxy host
     * @param {string} proxyConfig.port - Proxy port
     * @param {string} [proxyConfig.username] - Proxy username (optional)
     * @param {string} [proxyConfig.password] - Proxy password (optional)
     * @returns {Promise<boolean>} Success status
     */
    static async applyProxyToSession(session, proxyConfig) {
        if (!session) {
            throw new Error('Session is required');
        }

        if (!proxyConfig || !proxyConfig.enabled) {
            // Disable proxy
            try {
                await session.setProxy({ mode: 'direct' });
                console.log('[ProxyManager] Proxy disabled for session');
                return true;
            } catch (error) {
                console.error('[ProxyManager] Failed to disable proxy:', error);
                return false;
            }
        }

        try {
            const { protocol, host, port, username, password } = proxyConfig;

            if (!host || !port) {
                throw new Error('Proxy host and port are required');
            }

            // Build proxy URL
            const proxyUrl = `${protocol || 'http'}://${host}:${port}`;

            // Set proxy rules
            const proxyRules = proxyUrl;

            await session.setProxy({
                mode: 'fixed_servers',
                proxyRules: proxyRules,
                proxyBypassRules: '<-loopback>' // Bypass proxy for localhost
            });

            console.log(`[ProxyManager] Proxy set to: ${proxyRules}`);

            // Handle authentication if provided
            if (username && password) {
                // Remove any existing auth handlers
                session.removeAllListeners('login');

                // Add authentication handler
                session.on('login', (event, webContents, authenticationResponseDetails, authInfo, callback) => {
                    if (authInfo.isProxy) {
                        event.preventDefault();
                        callback(username, password);
                        console.log('[ProxyManager] Proxy authentication provided');
                    }
                });
            }

            return true;
        } catch (error) {
            console.error('[ProxyManager] Failed to apply proxy:', error);
            throw error;
        }
    }

    /**
     * Parse proxy string in format: IP:PORT:USER:PASS or IP:PORT
     * @param {string} proxyString - Proxy string to parse
     * @returns {Object|null} Parsed proxy configuration or null if invalid
     */
    static parseProxyString(proxyString) {
        if (!proxyString || typeof proxyString !== 'string') {
            return null;
        }

        const trimmed = proxyString.trim();
        if (!trimmed) {
            return null;
        }

        try {
            const urlMatch = trimmed.match(/^([a-z0-9]+):\/\/(?:([^:@]+)(?::([^@]*))?@)?([^:\/\s]+):(\d+)$/i);
            if (urlMatch) {
                const protocol = urlMatch[1].toLowerCase();
                const username = urlMatch[2] ? urlMatch[2].trim() : '';
                const password = urlMatch[3] ? urlMatch[3].trim() : '';
                const host = urlMatch[4].trim();
                const port = urlMatch[5].trim();

                const portNum = parseInt(port, 10);
                if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                    return null;
                }

                if (!['http', 'https'].includes(protocol)) {
                    return null;
                }

                return {
                    protocol,
                    host,
                    port,
                    username,
                    password
                };
            }

            const authMatch = trimmed.match(/^([^:@]+):([^@]*)@([^:\/\s]+):(\d+)$/);
            if (authMatch) {
                const host = authMatch[3].trim();
                const port = authMatch[4].trim();
                const portNum = parseInt(port, 10);
                if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                    return null;
                }

                return {
                    protocol: 'http',
                    host,
                    port,
                    username: authMatch[1].trim(),
                    password: authMatch[2].trim()
                };
            }

            const parts = trimmed.split(':');
            if (parts.length < 2) {
                return null;
            }

            const host = parts[0].trim();
            const port = parts[1].trim();
            if (!host || !port) {
                return null;
            }

            const portNum = parseInt(port, 10);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                return null;
            }

            const config = {
                protocol: 'http',
                host,
                port,
                username: '',
                password: ''
            };

            if (parts.length >= 3) {
                config.username = parts[2].trim();
            }

            if (parts.length >= 4) {
                config.password = parts.slice(3).join(':').trim();
            }

            return config;
        } catch (error) {
            console.error('[ProxyManager] Failed to parse proxy string:', error);
            return null;
        }
    }

    /**
     * Validate proxy configuration
     * @param {Object} proxyConfig - Proxy configuration to validate
     * @returns {Object} Validation result {valid: boolean, errors: string[]}
     */
    static validateProxyConfig(proxyConfig) {
        const errors = [];

        if (!proxyConfig || typeof proxyConfig !== 'object') {
            errors.push('Proxy configuration must be an object');
            return { valid: false, errors };
        }

        if (proxyConfig.enabled) {
            // Validate protocol
            if (proxyConfig.protocol && !['http', 'https'].includes(proxyConfig.protocol)) {
                errors.push('Invalid proxy protocol. Must be http or https');
            }

            // Validate host
            if (!proxyConfig.host || typeof proxyConfig.host !== 'string' || !proxyConfig.host.trim()) {
                errors.push('Proxy host is required');
            }

            // Validate port
            if (!proxyConfig.port) {
                errors.push('Proxy port is required');
            } else {
                const port = parseInt(proxyConfig.port, 10);
                if (isNaN(port) || port < 1 || port > 65535) {
                    errors.push('Proxy port must be a number between 1 and 65535');
                }
            }

            // Validate authentication (if username is provided, password should be too)
            if (proxyConfig.username && !proxyConfig.password) {
                errors.push('Proxy password is required when username is provided');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Build proxy URL from configuration
     * @param {Object} proxyConfig - Proxy configuration
     * @returns {string} Proxy URL
     */
    static buildProxyUrl(proxyConfig) {
        if (!proxyConfig || !proxyConfig.host || !proxyConfig.port) {
            return '';
        }

        const { protocol, host, port, username, password } = proxyConfig;

        let url = `${protocol || 'http'}://`;

        // Add authentication if provided
        if (username && password) {
            url += `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`;
        }

        url += `${host}:${port}`;

        return url;
    }

    /**
     * Clear proxy from session
     * @param {Electron.Session} session - Electron session
     * @returns {Promise<boolean>} Success status
     */
    static async clearProxy(session) {
        if (!session) {
            return false;
        }

        try {
            await session.setProxy({ mode: 'direct' });
            session.removeAllListeners('login');
            console.log('[ProxyManager] Proxy cleared from session');
            return true;
        } catch (error) {
            console.error('[ProxyManager] Failed to clear proxy:', error);
            return false;
        }
    }
}

module.exports = ProxyManager;
