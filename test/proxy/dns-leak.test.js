'use strict';

const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const url = require('url');
const dns = require('dns');
const net = require('net');

describe('代理系统DNS泄露检测', () => {
  const proxyUrl = process.env.TEST_PROXY_URL;
  (proxyUrl ? test : test.skip)('通过HTTP(S)代理时不应解析目标域名', async () => {
    const parsed = url.parse(proxyUrl);
    const proxyHost = parsed.hostname;

    const originalLookup = dns.lookup;
    const lookups = [];
    dns.lookup = function(hostname, opts, cb) {
      lookups.push(hostname);
      return originalLookup.call(dns, hostname, opts, cb);
    };

    try {
      const agent = new HttpsProxyAgent(proxyUrl);
      await axios.get('https://httpbin.org/ip', { httpsAgent: agent, httpAgent: agent, timeout: 12000 });
    } finally {
      dns.lookup = originalLookup;
    }

    const resolvedTargets = lookups.filter(h => h && typeof h === 'string');
    const targetResolved = resolvedTargets.some(h => /httpbin\.org$/i.test(h));
    const proxyHostIsIP = net.isIP(proxyHost) !== 0;
    const proxyResolved = resolvedTargets.includes(proxyHost);

    // 如果代理主机是IP，不需要解析；仅验证未解析目标域名
    if (proxyHostIsIP) {
      expect(targetResolved).toBe(false);
    } else {
      expect(proxyResolved).toBe(true);
      expect(targetResolved).toBe(false);
    }
  }, 30000);
});
