/**
 * Cookie Manager
 * 
 * Manages custom cookies for accounts.
 * Parses Cookie JSON and applies cookies to Electron sessions.
 * 
 * @module environment/CookieManager
 */

'use strict';

/**
 * Cookie Manager
 */
class CookieManager {
    /**
     * Parse cookies from JSON string
     * @param {string} cookieJson - JSON string containing cookie array
     * @returns {Array<Object>} Array of cookie objects
     */
    static parseCookies(cookieJson) {
        if (!cookieJson || typeof cookieJson !== 'string') {
            return [];
        }

        try {
            const cookies = JSON.parse(cookieJson);

            if (!Array.isArray(cookies)) {
                throw new Error('Cookies must be an array');
            }

            return cookies.map(cookie => this._normalizeCookie(cookie));
        } catch (error) {
            console.error('[CookieManager] Failed to parse cookies:', error);
            throw new Error(`Invalid cookie JSON: ${error.message}`);
        }
    }

    /**
     * Apply cookies to an Electron session
     * @param {Electron.Session} session - Electron session
     * @param {Array<Object>} cookies - Array of cookie objects
     * @returns {Promise<Object>} Result with success count and errors
     */
    static async applyCookiesToSession(session, cookies) {
        if (!session) {
            throw new Error('Session is required');
        }

        if (!cookies || !Array.isArray(cookies)) {
            return { success: true, count: 0, errors: [] };
        }

        const results = {
            success: true,
            count: 0,
            errors: []
        };

        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i];

            try {
                // Validate cookie
                const validation = this.validateCookie(cookie);
                if (!validation.valid) {
                    results.errors.push({
                        index: i,
                        cookie: cookie,
                        error: validation.errors.join(', ')
                    });
                    continue;
                }

                // Prepare cookie for Electron
                const electronCookie = {
                    url: this._buildCookieUrl(cookie),
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: cookie.path || '/',
                    secure: cookie.secure !== false,
                    httpOnly: cookie.httpOnly !== false,
                    expirationDate: cookie.expirationDate || undefined,
                    sameSite: cookie.sameSite || 'no_restriction'
                };

                // Set cookie
                await session.cookies.set(electronCookie);
                results.count++;

                console.log(`[CookieManager] Set cookie: ${cookie.name} for ${cookie.domain}`);
            } catch (error) {
                console.error(`[CookieManager] Failed to set cookie ${i}:`, error);
                results.errors.push({
                    index: i,
                    cookie: cookie,
                    error: error.message
                });
            }
        }

        if (results.errors.length > 0) {
            results.success = false;
        }

        console.log(`[CookieManager] Applied ${results.count}/${cookies.length} cookies`);

        return results;
    }

    /**
     * Validate cookie structure
     * @param {Object} cookie - Cookie object to validate
     * @returns {Object} Validation result {valid: boolean, errors: string[]}
     */
    static validateCookie(cookie) {
        const errors = [];

        if (!cookie || typeof cookie !== 'object') {
            errors.push('Cookie must be an object');
            return { valid: false, errors };
        }

        if (!cookie.name || typeof cookie.name !== 'string') {
            errors.push('Cookie name is required');
        }

        if (!cookie.value || typeof cookie.value !== 'string') {
            errors.push('Cookie value is required');
        }

        if (!cookie.domain || typeof cookie.domain !== 'string') {
            errors.push('Cookie domain is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate array of cookies
     * @param {Array<Object>} cookies - Array of cookies
     * @returns {Object} Validation result
     */
    static validateCookies(cookies) {
        if (!Array.isArray(cookies)) {
            return {
                valid: false,
                errors: ['Cookies must be an array']
            };
        }

        const errors = [];

        cookies.forEach((cookie, index) => {
            const validation = this.validateCookie(cookie);
            if (!validation.valid) {
                errors.push(`Cookie ${index}: ${validation.errors.join(', ')}`);
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Clear all cookies from a session
     * @param {Electron.Session} session - Electron session
     * @returns {Promise<boolean>} Success status
     */
    static async clearAllCookies(session) {
        if (!session) {
            return false;
        }

        try {
            const cookies = await session.cookies.get({});

            for (const cookie of cookies) {
                const url = this._buildCookieUrl(cookie);
                await session.cookies.remove(url, cookie.name);
            }

            console.log(`[CookieManager] Cleared ${cookies.length} cookies`);
            return true;
        } catch (error) {
            console.error('[CookieManager] Failed to clear cookies:', error);
            return false;
        }
    }

    /**
     * Get all cookies from a session
     * @param {Electron.Session} session - Electron session
     * @param {string} [domain] - Optional domain filter
     * @returns {Promise<Array<Object>>} Array of cookies
     */
    static async getCookies(session, domain = null) {
        if (!session) {
            return [];
        }

        try {
            const filter = domain ? { domain } : {};
            const cookies = await session.cookies.get(filter);
            return cookies;
        } catch (error) {
            console.error('[CookieManager] Failed to get cookies:', error);
            return [];
        }
    }

    /**
     * Export cookies to JSON string
     * @param {Array<Object>} cookies - Array of cookie objects
     * @returns {string} JSON string
     */
    static exportCookies(cookies) {
        if (!Array.isArray(cookies)) {
            return '[]';
        }

        try {
            const exportData = cookies.map(cookie => ({
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path || '/',
                secure: cookie.secure || false,
                httpOnly: cookie.httpOnly || false,
                expirationDate: cookie.expirationDate || undefined,
                sameSite: cookie.sameSite || 'no_restriction'
            }));

            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            console.error('[CookieManager] Failed to export cookies:', error);
            return '[]';
        }
    }

    /**
     * Normalize cookie object
     * @param {Object} cookie - Cookie object
     * @returns {Object} Normalized cookie
     * @private
     */
    static _normalizeCookie(cookie) {
        return {
            name: cookie.name || '',
            value: cookie.value || '',
            domain: cookie.domain || '',
            path: cookie.path || '/',
            secure: cookie.secure !== false,
            httpOnly: cookie.httpOnly !== false,
            expirationDate: cookie.expirationDate || cookie.expires || undefined,
            sameSite: cookie.sameSite || 'no_restriction'
        };
    }

    /**
     * Build URL for cookie
     * @param {Object} cookie - Cookie object
     * @returns {string} URL
     * @private
     */
    static _buildCookieUrl(cookie) {
        const protocol = cookie.secure ? 'https' : 'http';
        const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
        const path = cookie.path || '/';
        return `${protocol}://${domain}${path}`;
    }
}

module.exports = CookieManager;
