'use strict';

const { WebRTCProtection, WebRTCMode } = require('../../src/infrastructure/fingerprint/injection-scripts/webrtc');

function sampleSDP() {
  return [
    'v=0',
    'o=- 4611738163108544392 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=msid-semantic: WMS',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111',
    'c=IN IP4 10.0.0.5',
    'a=rtcp:9 IN IP4 0.0.0.0',
    'a=candidate:12345 1 udp 2122260223 192.168.1.10 54321 typ host generation 0',
    'a=candidate:67890 1 udp 2122260222 8.8.8.8 3478 typ srflx raddr 192.168.1.10 rport 54321 generation 0'
  ].join('\r\n');
}

describe('WebRTC保护: SDP与ICE替换', () => {
  test('替换模式应替换私有IP并在公共IP时替换为配置', () => {
    const cfg = { mode: WebRTCMode.REPLACE, localIP: '192.168.1.100', publicIP: '203.0.113.5' };
    const sdp = sampleSDP();
    const filtered = WebRTCProtection._filterSDP(sdp, cfg);
    expect(filtered).toContain('c=IN IP4 192.168.1.100');
    expect(filtered).toContain('a=candidate:12345 1 udp 2122260223 192.168.1.100 54321');
    expect(filtered).toContain('a=candidate:67890 1 udp 2122260222 203.0.113.5 3478');
  });

  test('ICE候选的私有IP应被替换', () => {
    const cfg = { mode: WebRTCMode.REPLACE, localIP: '192.168.1.100', publicIP: 'auto' };
    const cand = {
      candidate: 'candidate:1 1 udp 2122260223 192.168.0.10 12345 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0
    };
    const res = WebRTCProtection._filterICECandidate(cand, cfg);
    expect(res.candidate).toContain('192.168.1.100');
  });
});
