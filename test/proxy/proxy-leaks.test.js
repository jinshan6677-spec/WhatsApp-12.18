'use strict';

const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

function pick(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

async function getDirectIP(timeout = 10000) {
  const providers = [
    'https://ipapi.co/json/',
    'https://ipwho.is/',
    'http://ip-api.com/json/'
  ];
  let lastErr;
  for (const url of providers) {
    try {
      const res = await axios.get(url, { timeout });
      const data = res.data;
      if (data.ip) return { ip: data.ip };
      if (data.query) return { ip: data.query };
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr || new Error('Failed to fetch direct IP');
}

async function getProxyIpAndHeaders(proxyUrl, timeout = 10000) {
  const agent = new HttpsProxyAgent(proxyUrl);
  const ipUrls = ['https://httpbin.org/ip', 'https://ipapi.co/json/', 'https://ipwho.is/'];
  let ipInfo = null;
  let lastErr;
  for (const url of ipUrls) {
    try {
      const res = await axios.get(url, {
        httpsAgent: agent,
        httpAgent: agent,
        timeout
      });
      const data = res.data;
      if (data.origin) ipInfo = { ip: String(data.origin).split(',')[0].trim() };
      else if (data.ip) ipInfo = { ip: data.ip };
      else if (data.query) ipInfo = { ip: data.query };
      if (ipInfo) break;
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  if (!ipInfo) throw lastErr || new Error('Failed to fetch proxy IP');

  let headers = {};
  try {
    const res = await axios.get('https://httpbin.org/headers', {
      httpsAgent: agent,
      httpAgent: agent,
      timeout
    });
    headers = res.data && res.data.headers ? res.data.headers : {};
  } catch (_) {}

  return { ip: ipInfo.ip, headers };
}

function assessHeaderLeak(headers, directIp) {
  const keys = ['X-Forwarded-For', 'X-Real-Ip', 'Forwarded'];
  const vals = keys.map(k => headers[k]).filter(Boolean);
  const containsDirect = vals.some(v => String(v).includes(directIp));
  if (containsDirect) return { level: 'high', reason: 'Headers include real IP' };
  if (vals.length > 0) return { level: 'medium', reason: 'Proxy-specific headers present' };
  return { level: 'low', reason: 'No proxy leak headers detected' };
}

function assessIpLeak(proxyIp, directIp) {
  if (!proxyIp || !directIp) return { level: 'unknown', reason: 'Unable to compare IPs' };
  if (proxyIp === directIp) return { level: 'high', reason: 'Proxy reports same IP as direct' };
  return { level: 'low', reason: 'Proxy IP differs from direct IP' };
}

describe('代理系统IP泄露检测', () => {
  const proxyUrl = process.env.TEST_PROXY_URL;

  test('环境准备: 显示提示', () => {
    expect(true).toBe(true);
  });

  (proxyUrl ? test : test.skip)('通过代理请求不应暴露真实IP', async () => {
    const direct = await getDirectIP(12000);
    const viaProxy = await getProxyIpAndHeaders(proxyUrl, 15000);

    const ipLeak = assessIpLeak(viaProxy.ip, direct.ip);
    const headerLeak = assessHeaderLeak(viaProxy.headers, direct.ip);

    const report = {
      directIp: direct.ip,
      proxyIp: viaProxy.ip,
      headerSample: pick(viaProxy.headers, ['X-Forwarded-For', 'X-Real-Ip', 'Forwarded']),
      risks: {
        ipLeak: ipLeak.level,
        headerLeak: headerLeak.level
      },
      notes: [ipLeak.reason, headerLeak.reason]
    };

    // 控制台输出报告，便于审阅
    // eslint-disable-next-line no-console
    console.log('IP泄露检测报告:', JSON.stringify(report));

    expect(ipLeak.level).not.toBe('high');
    expect(headerLeak.level).not.toBe('high');
  }, 30000);
});

