'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {probeArgosBridge} = require('../tools/argos-bridge-status');
const now = new Date('2026-09-02T20:00:00.000Z');
const body = {version: 'sinbad-argos-live-status/1-v1', mode: 'MONITOR_ONLY', state: 'ACTIVE',
  observedAt: now.toISOString(), bridge: {online: true}, commandGate: {active: true, replayProtection: true}};

test('Bridge route absence is degraded even if unrelated AI health is available', async () => {
  const result = await probeArgosBridge({clock: () => now, fetcher: async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:31983/argos/status');
    assert.equal(options.method, 'GET');
    assert.ok(options.signal instanceof AbortSignal);
    return {status: 404, ok: false};
  }});
  assert.equal(result.state, 'DEGRADED');
  assert.equal(result.reasonCode, 'ARGOS_BRIDGE_ROUTE_MISSING');
});

test('well formed status is only self-reported capability, never verified runtime identity', async () => {
  const result = await probeArgosBridge({clock: () => now, fetcher: async () => ({status: 200, ok: true, json: async () => body})});
  assert.equal(result.state, 'UNKNOWN');
  assert.equal(result.reasonCode, 'ARGOS_BRIDGE_RUNTIME_IDENTITY_UNVERIFIED');
});

test('stale malformed and inactive responses cannot appear healthy or leak their contents', async () => {
  for (const payload of [{}, {...body, observedAt: '2000-01-01T00:00:00Z'}, {...body, commandGate: {active: false}}, null]) {
    const result = await probeArgosBridge({clock: () => now, fetcher: async () => ({status: 200, ok: true, json: async () => payload})});
    assert.equal(result.state, 'DEGRADED');
  }
  const result = await probeArgosBridge({clock: () => now, fetcher: async () => {throw Error('secret-value');}});
  assert.equal(result.state, 'UNAVAILABLE');
  assert.ok(!JSON.stringify(result).includes('secret-value'));
});
