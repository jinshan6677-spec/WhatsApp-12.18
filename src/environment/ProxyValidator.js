/**
 * Proxy Validator
 * 
 * Validates proxy connectivity and detects IP information with geolocation.
 * Provides network detection and IP-based timezone/language detection.
 * 
 * @module environment/ProxyValidator
 */

'use strict';

const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

/**
 * Proxy Validator
 */
class ProxyValidator {
    /**
     * Test proxy connectivity and get IP information
     * @param {Object} proxyConfig - Proxy configuration
     * @param {string} proxyConfig.protocol - Proxy protocol
     * @param {string} proxyConfig.host - Proxy host
     * @param {string} proxyConfig.port - Proxy port
     * @param {string} [proxyConfig.username] - Proxy username
     * @param {string} [proxyConfig.password] - Proxy password
     * @param {number} [timeout=10000] - Request timeout in milliseconds
     * @returns {Promise<Object>} Test result with IP info
     */
    static async testProxy(proxyConfig, timeout = 10000) {
        if (!proxyConfig || !proxyConfig.host || !proxyConfig.port) {
            throw new Error('Invalid proxy configuration');
        }

        const startTime = Date.now();

        try {
            // Build proxy URL
            const { protocol, host, port, username, password } = proxyConfig;

            let proxyUrl;
            if (username && password) {
                proxyUrl = `${protocol || 'http'}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
            } else {
                proxyUrl = `${protocol || 'http'}://${host}:${port}`;
            }

            // Create proxy agent
            const agent = new HttpsProxyAgent(proxyUrl);

            // Try multiple providers
            const providers = [
                {
                    url: 'https://ipapi.co/json/',
                    adapter: (data) => ({
                        ip: data.ip,
                        location: {
                            country: data.country_name,
                            countryCode: data.country_code,
                            city: data.city,
                            region: data.region,
                            latitude: data.latitude,
                            longitude: data.longitude
                        },
                        timezone: data.timezone,
                        isp: data.org
                    })
                },
                {
                    url: 'https://ipwho.is/',
                    adapter: (data) => ({
                        ip: data.ip,
                        location: {
                            country: data.country,
                            countryCode: data.country_code,
                            city: data.city,
                            region: data.region,
                            latitude: data.latitude,
                            longitude: data.longitude
                        },
                        timezone: data.timezone?.id,
                        isp: data.connection?.isp
                    })
                },
                
            ];

            let lastError;
            for (const provider of providers) {
                try {
                    const response = await axios.get(provider.url, {
                        httpsAgent: agent,
                        httpAgent: agent,
                        timeout: timeout,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });

                    const data = provider.adapter(response.data);
                    const latency = Date.now() - startTime;

                    return {
                        success: true,
                        ip: data.ip || 'Unknown',
                        location: {
                            country: data.location.country || 'Unknown',
                            countryCode: data.location.countryCode || '',
                            city: data.location.city || 'Unknown',
                            region: data.location.region || '',
                            latitude: data.location.latitude || null,
                            longitude: data.location.longitude || null
                        },
                        timezone: data.timezone || 'UTC',
                        language: this._getLanguageFromCountry(data.location.countryCode),
                        isp: data.isp || 'Unknown',
                        latency: latency,
                        proxyUrl: proxyUrl.replace(/:[^:]*@/, ':****@')
                    };
                } catch (err) {
                    console.warn(`[ProxyValidator] Provider ${provider.url} failed:`, err.message);
                    lastError = err;
                    continue;
                }
            }

            throw lastError || new Error('All providers failed');

        } catch (error) {
            const latency = Date.now() - startTime;
            console.error('[ProxyValidator] Proxy test failed:', error.message);

            return {
                success: false,
                error: error.message || 'Proxy connection failed',
                latency: latency,
                details: {
                    code: error.code,
                    message: error.message
                }
            };
        }
    }

    /**
     * Detect current network information (without proxy)
     * @param {number} [timeout=10000] - Request timeout in milliseconds
     * @returns {Promise<Object>} Network information
     */
    static async getCurrentNetwork(timeout = 10000) {
        try {
            // Try multiple providers
            const providers = [
                {
                    url: 'https://ipapi.co/json/',
                    adapter: (data) => ({
                        ip: data.ip,
                        location: {
                            country: data.country_name,
                            countryCode: data.country_code,
                            city: data.city,
                            region: data.region,
                            latitude: data.latitude,
                            longitude: data.longitude
                        },
                        timezone: data.timezone,
                        isp: data.org
                    })
                },
                {
                    url: 'https://ipwho.is/',
                    adapter: (data) => ({
                        ip: data.ip,
                        location: {
                            country: data.country,
                            countryCode: data.country_code,
                            city: data.city,
                            region: data.region,
                            latitude: data.latitude,
                            longitude: data.longitude
                        },
                        timezone: data.timezone?.id,
                        isp: data.connection?.isp
                    })
                },
                {
                    url: 'http://ip-api.com/json/',
                    adapter: (data) => ({
                        ip: data.query,
                        location: {
                            country: data.country,
                            countryCode: data.countryCode,
                            city: data.city,
                            region: data.regionName,
                            latitude: data.lat,
                            longitude: data.lon
                        },
                        timezone: data.timezone,
                        isp: data.isp
                    })
                }
            ];

            let lastError;
            for (const provider of providers) {
                try {
                    const response = await axios.get(provider.url, {
                        timeout: timeout,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });

                    const data = provider.adapter(response.data);

                    return {
                        success: true,
                        ip: data.ip || 'Unknown',
                        location: {
                            country: data.location.country || 'Unknown',
                            countryCode: data.location.countryCode || '',
                            city: data.location.city || 'Unknown',
                            region: data.location.region || '',
                            latitude: data.location.latitude || null,
                            longitude: data.location.longitude || null
                        },
                        timezone: data.timezone || 'UTC',
                        language: this._getLanguageFromCountry(data.location.countryCode),
                        isp: data.isp || 'Unknown'
                    };
                } catch (err) {
                    console.warn(`[ProxyValidator] Provider ${provider.url} failed:`, err.message);
                    lastError = err;
                    continue;
                }
            }

            throw lastError || new Error('All providers failed');

        } catch (error) {
            console.error('[ProxyValidator] Failed to get current network:', error.message);

            return {
                success: false,
                error: error.message || 'Failed to detect network',
                details: {
                    code: error.code,
                    message: error.message
                }
            };
        }
    }

    /**
     * Get geolocation data for an IP address
     * @param {string} ip - IP address
     * @param {number} [timeout=10000] - Request timeout in milliseconds
     * @returns {Promise<Object>} Geolocation data
     */
    static async getIPGeolocation(ip, timeout = 10000) {
        if (!ip || typeof ip !== 'string') {
            throw new Error('IP address is required');
        }

        try {
            // Try multiple providers
            const providers = [
                {
                    url: `https://ipapi.co/${ip}/json/`,
                    adapter: (data) => ({
                        ip: data.ip,
                        location: {
                            country: data.country_name,
                            countryCode: data.country_code,
                            city: data.city,
                            region: data.region,
                            latitude: data.latitude,
                            longitude: data.longitude
                        },
                        timezone: data.timezone,
                        isp: data.org
                    })
                },
                {
                    url: `https://ipwho.is/${ip}`,
                    adapter: (data) => ({
                        ip: data.ip,
                        location: {
                            country: data.country,
                            countryCode: data.country_code,
                            city: data.city,
                            region: data.region,
                            latitude: data.latitude,
                            longitude: data.longitude
                        },
                        timezone: data.timezone?.id,
                        isp: data.connection?.isp
                    })
                },
                {
                    url: `http://ip-api.com/json/${ip}`,
                    adapter: (data) => ({
                        ip: data.query,
                        location: {
                            country: data.country,
                            countryCode: data.countryCode,
                            city: data.city,
                            region: data.regionName,
                            latitude: data.lat,
                            longitude: data.lon
                        },
                        timezone: data.timezone,
                        isp: data.isp
                    })
                }
            ];

            let lastError;
            for (const provider of providers) {
                try {
                    const response = await axios.get(provider.url, {
                        timeout: timeout,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });

                    const data = provider.adapter(response.data);

                    return {
                        success: true,
                        ip: data.ip || ip,
                        country: data.location.country || 'Unknown',
                        countryCode: data.location.countryCode || '',
                        city: data.location.city || 'Unknown',
                        region: data.location.region || '',
                        timezone: data.timezone || 'UTC',
                        language: this._getLanguageFromCountry(data.location.countryCode),
                        latitude: data.location.latitude || null,
                        longitude: data.location.longitude || null,
                        isp: data.isp || 'Unknown'
                    };
                } catch (err) {
                    console.warn(`[ProxyValidator] Provider ${provider.url} failed:`, err.message);
                    lastError = err;
                    continue;
                }
            }

            throw lastError || new Error('All providers failed');

        } catch (error) {
            console.error(`[ProxyValidator] Failed to get geolocation for IP ${ip}:`, error.message);

            return {
                success: false,
                error: error.message || 'Failed to get geolocation',
                ip: ip
            };
        }
    }

    /**
     * Get language code from country code
     * @param {string} countryCode - ISO country code
     * @returns {string} Language code
     * @private
     */
    static _getLanguageFromCountry(countryCode) {
        if (!countryCode) {
            return 'en-US';
        }

        // Map of country codes to primary languages
        const languageMap = {
            'US': 'en-US',
            'GB': 'en-GB',
            'CN': 'zh-CN',
            'TW': 'zh-TW',
            'HK': 'zh-HK',
            'JP': 'ja-JP',
            'KR': 'ko-KR',
            'DE': 'de-DE',
            'FR': 'fr-FR',
            'ES': 'es-ES',
            'IT': 'it-IT',
            'RU': 'ru-RU',
            'BR': 'pt-BR',
            'PT': 'pt-PT',
            'IN': 'hi-IN',
            'SA': 'ar-SA',
            'TR': 'tr-TR',
            'NL': 'nl-NL',
            'PL': 'pl-PL',
            'SE': 'sv-SE',
            'NO': 'no-NO',
            'DK': 'da-DK',
            'FI': 'fi-FI',
            'GR': 'el-GR',
            'IL': 'he-IL',
            'TH': 'th-TH',
            'VN': 'vi-VN',
            'ID': 'id-ID',
            'MY': 'ms-MY',
            'PH': 'fil-PH',
            'AU': 'en-AU',
            'CA': 'en-CA',
            'MX': 'es-MX',
            'AR': 'es-AR',
            'CL': 'es-CL',
            'CO': 'es-CO',
            'PE': 'es-PE',
            'VE': 'es-VE',
            'EG': 'ar-EG',
            'ZA': 'en-ZA',
            'NG': 'en-NG',
            'KE': 'sw-KE',
            'UA': 'uk-UA',
            'CZ': 'cs-CZ',
            'HU': 'hu-HU',
            'RO': 'ro-RO',
            'BG': 'bg-BG',
            'HR': 'hr-HR',
            'RS': 'sr-RS',
            'SK': 'sk-SK',
            'SI': 'sl-SI',
            'LT': 'lt-LT',
            'LV': 'lv-LV',
            'EE': 'et-EE'
        };

        return languageMap[countryCode.toUpperCase()] || 'en-US';
    }

    /**
     * Validate proxy configuration format
     * @param {Object} proxyConfig - Proxy configuration
     * @returns {Object} Validation result
     */
    static validateProxyConfig(proxyConfig) {
        const errors = [];

        if (!proxyConfig || typeof proxyConfig !== 'object') {
            errors.push('Proxy configuration must be an object');
            return { valid: false, errors };
        }

        if (!proxyConfig.host || typeof proxyConfig.host !== 'string') {
            errors.push('Proxy host is required');
        }

        if (!proxyConfig.port) {
            errors.push('Proxy port is required');
        } else {
            const port = parseInt(proxyConfig.port, 10);
            if (isNaN(port) || port < 1 || port > 65535) {
                errors.push('Proxy port must be between 1 and 65535');
            }
        }

        if (proxyConfig.protocol && !['http', 'https'].includes(proxyConfig.protocol)) {
            errors.push('Invalid proxy protocol. Must be http or https');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = ProxyValidator;
