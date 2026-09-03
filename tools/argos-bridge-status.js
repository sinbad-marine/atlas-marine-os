'use strict';
const crypto = require('node:crypto');
const {observe} = require('../sinbad-ai-core/argos-health-contracts');

async function probeArgosBridge({fetcher, clock = () => new Date()}) {
  let state = 'UNAVAILABLE', reasonCode = 'ARGOS_BRIDGE_UNAVAILABLE', httpStatus = 0;
  try {
    const response = await fetcher('http://127.0.0.1:31983/argos/status', {
      method: 'GET', redirect: 'error', headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(5000)
    });
    httpStatus = Number.isInteger(response.status) ? response.status : 0;
    state = 'DEGRADED';
    reasonCode = httpStatus === 404 ? 'ARGOS_BRIDGE_ROUTE_MISSING' : 'ARGOS_BRIDGE_HTTP_ERROR';
    if (response.ok === true && httpStatus === 200) {
      reasonCode = 'ARGOS_BRIDGE_PROTOCOL_INVALID';
      const body = await response.json();
      const observed = typeof body?.observedAt === 'string' ? Date.parse(body.observedAt) : NaN;
      if (body?.version === 'sinbad-argos-live-status/1-v1' && body.mode === 'MONITOR_ONLY' &&
          body.state === 'ACTIVE' && body.bridge?.online === true && body.commandGate?.active === true &&
          body.commandGate?.replayProtection === true && Number.isFinite(observed) &&
          Math.abs(clock().getTime() - observed) <= 60000) {
        state = 'UNKNOWN';
        reasonCode = 'ARGOS_BRIDGE_RUNTIME_IDENTITY_UNVERIFIED';
      }
    }
  } catch {
    if (httpStatus === 200) { state = 'DEGRADED'; reasonCode = 'ARGOS_BRIDGE_PROTOCOL_INVALID'; }
  }
  const observedAt = clock().toISOString();
  // Only bounded classification enters evidence; response contents never enter the journal.
  const evidenceHash = crypto.createHash('sha256').update(JSON.stringify({httpStatus, state, reasonCode})).digest('hex');
  return observe({component: 'BRIDGE', state, reasonCode, observedAt,
    validUntil: new Date(Date.parse(observedAt) + 60000).toISOString(), evidenceHash});
}

module.exports = Object.freeze({probeArgosBridge});
