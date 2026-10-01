'use strict';
// Secure Auth Handoff P1: deterministic tests of the pure security logic. Every secret below is an obvious synthetic value.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const util = require('node:util');
const H = require('../sinbad-ai-core/auth-handoff');

const ROOT = path.resolve(__dirname, '..');
const W = '11111111-2222-4333-8444-555555555555';
const W2 = '99999999-2222-4333-8444-555555555555';
const T = seconds => new Date(Date.UTC(2026, 9, 2, 10, 0, 0) + seconds * 1000).toISOString();
const SYN_TOKEN = 'SYNTHETIC-ACCESS-TOKEN-VALUE-0000';
const SYN_NONCE = 'synthetic-one-time-nonce-0001';
const SYN_JWT = 'eyJhbGciOiJTWU5USEVUSUMifQ.eyJzdWIiOiJTWU5USEVUSUMtVEVTVCJ9.U1lOVEhFVElDLVNJR05BVFVSRQ';
const REQUEST = Object.freeze({ grantId: 'GRANT-ABCDEF123456', taskId: 'TASK-11', purpose: 'PHASE_4_3A_A5_REAL_CAPTURE', workspaceId: W, capability: 'sinbad-answer.invoke', maxCalls: 30, ttlMs: 3600000 });
const FP = H.fingerprintOf(SYN_TOKEN);
const CALL = Object.freeze({ taskId: 'TASK-11', workspaceId: W, purpose: 'PHASE_4_3A_A5_REAL_CAPTURE', capability: 'sinbad-answer.invoke', credentialFingerprint: FP });
const OK200 = Object.freeze({ status: 200, sourceAccess: 'privileged' });

// Walks the lifecycle to a given stage. Returns { grant, events }.
function walk(stage, overrides = {}) {
  const events = [];
  const take = r => { assert.ok(r.ok, `step failed: ${r.errors}`); events.push(r.event); return r.grant; };
  let g = take(H.proposeGrant({ ...REQUEST, ...overrides }, T(0)));
  if (stage === 'PROPOSED') return { grant: g, events };
  g = take(H.authorizeGrant(g, { ownerAuthorizationId: 'auth-0001-synthetic', stepUpLevel: 'aal2', decision: 'ALLOW_ONCE', nonceHash: H.sha256Hex(SYN_NONCE) }, T(1)));
  if (stage === 'AUTHORIZED') return { grant: g, events };
  g = take(H.pairGrant(g, SYN_NONCE, T(2)));
  if (stage === 'PAIRED') return { grant: g, events };
  g = take(H.bindCredential(g, { kind: 'ACCESS', expiresAt: T(3000), fingerprint: FP }, T(3)));
  return { grant: g, events };
}
const active = overrides => walk('ACTIVE', overrides);
function cycle(grant, outcome, at) {
  const r = H.reserveCall(grant, CALL, T(at));
  assert.ok(r.ok, `reserve failed: ${r.errors}`);
  return H.recordCallOutcome(r.grant, outcome, T(at + 1));
}

test('a proposed grant is bound to task, purpose, workspace, capability, ceiling and time, and is frozen', () => {
  const r = H.proposeGrant(REQUEST, T(0));
  assert.ok(r.ok);
  const g = r.grant;
  assert.equal(g.state, 'PROPOSED');
  assert.deepEqual([g.taskId, g.purpose, g.workspaceId, g.capability, g.maxCalls], ['TASK-11', 'PHASE_4_3A_A5_REAL_CAPTURE', W, 'sinbad-answer.invoke', 30]);
  assert.equal(g.issuedAt, T(0));
  assert.equal(g.expiresAt, T(3600));
  assert.equal(g.authorization, null);
  assert.equal(g.credential.bound, false);
  assert.ok(Object.isFrozen(g) && Object.isFrozen(r) && Object.isFrozen(g.credential) && Object.isFrozen(r.event));
  assert.throws(() => { g.callsUsed = 99; }, TypeError);
  assert.equal(r.event.fromState, null);
  assert.equal(r.event.toState, 'PROPOSED');
});

test('proposal validation fails closed on every bad field', () => {
  const bad = (patch, code) => {
    const r = H.proposeGrant({ ...REQUEST, ...patch }, T(0));
    assert.equal(r.ok, false, JSON.stringify(patch));
    assert.equal(r.grant, null);
    assert.ok(r.errors.includes(code), `${JSON.stringify(patch)} -> ${r.errors}`);
  };
  bad({ grantId: 'grant-1' }, 'REQUEST_INVALID');
  bad({ taskId: 'task-11' }, 'REQUEST_INVALID');
  bad({ purpose: 'lower case' }, 'REQUEST_INVALID');
  bad({ workspaceId: 'not-a-uuid' }, 'REQUEST_INVALID');
  bad({ capability: 'sinbad-answer.admin' }, 'CAPABILITY_NOT_ALLOWED');
  bad({ capability: '*' }, 'CAPABILITY_NOT_ALLOWED');
  for (const maxCalls of [0, -1, 37, 1.5, '30', null, NaN]) bad({ maxCalls }, 'CEILING_INVALID');
  for (const ttlMs of [0, 59999, 3600001, 1.5, '60000', null]) bad({ ttlMs }, 'TTL_INVALID');
  bad({ extra: 1 }, 'UNKNOWN_FIELD');
  bad({ refreshToken: 'x' }, 'SECRET_DETECTED');
  bad({ purpose: SYN_JWT }, 'SECRET_DETECTED');
  const missing = { ...REQUEST }; delete missing.workspaceId;
  assert.ok(H.proposeGrant(missing, T(0)).errors.includes('REQUEST_INVALID'));
  assert.ok(H.proposeGrant(null, T(0)).errors.includes('REQUEST_INVALID'));
  assert.ok(H.proposeGrant(REQUEST, 'yesterday').errors.includes('REQUEST_INVALID'));
  for (const maxCalls of [1, 36]) assert.ok(H.proposeGrant({ ...REQUEST, maxCalls }, T(0)).ok);
  for (const ttlMs of [60000, 3600000]) assert.ok(H.proposeGrant({ ...REQUEST, ttlMs }, T(0)).ok);
});

test('the Owner authorization needs an aal2 step-up and a single-use id, and is not a credential', () => {
  const { grant } = walk('PROPOSED');
  const approval = { ownerAuthorizationId: 'auth-0001-synthetic', stepUpLevel: 'aal2', decision: 'ALLOW_ONCE', nonceHash: H.sha256Hex(SYN_NONCE) };
  const ok = H.authorizeGrant(grant, approval, T(1));
  assert.ok(ok.ok);
  assert.equal(ok.grant.state, 'AUTHORIZED');
  assert.equal(ok.grant.authorization.stepUp, 'aal2');
  assert.equal(ok.consumedAuthorizationId, 'auth-0001-synthetic');
  assert.equal(ok.grant.credential.bound, false, 'authorization alone binds no credential');
  for (const stepUpLevel of ['aal1', 'AAL2', '', undefined, null, 2]) {
    const r = H.authorizeGrant(grant, { ...approval, stepUpLevel }, T(1));
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e === 'STEP_UP_REQUIRED' || e === 'REQUEST_INVALID'));
    assert.equal(r.grant.state, 'PROPOSED');
  }
  const reuse = H.authorizeGrant(grant, approval, T(1), ['auth-0001-synthetic']);
  assert.deepEqual([reuse.ok, reuse.errors[0], reuse.grant.state], [false, 'AUTHORIZATION_REUSED', 'PROPOSED']);
  assert.ok(H.authorizeGrant(grant, { ...approval, nonceHash: 'abc' }, T(1)).errors.includes('REQUEST_INVALID'));
  assert.ok(H.authorizeGrant(grant, { ...approval, extra: true }, T(1)).errors.includes('UNKNOWN_FIELD'));
  assert.ok(H.authorizeGrant(grant, { ...approval, decision: 'ALLOW_ALWAYS' }, T(1)).errors.includes('REQUEST_INVALID'));
  assert.ok(H.authorizeGrant(ok.grant, approval, T(2)).errors.includes('WRONG_STATE'), 'a second authorization is refused');
});

test('an Owner DENY ends the grant as DENIED with cleanup', () => {
  const { grant } = walk('PROPOSED');
  const r = H.authorizeGrant(grant, { ownerAuthorizationId: 'auth-0002-synthetic', stepUpLevel: 'aal1', decision: 'DENY' }, T(1));
  assert.ok(r.ok);
  assert.equal(r.grant.state, 'DENIED');
  assert.deepEqual(r.cleanup, H.CLEANUP);
  assert.deepEqual(r.event.reasonCodes, ['OWNER_DENIED']);
  assert.equal(r.event.kind, 'grant.denied');
});

test('pairing is single use: a wrong nonce or a replay revokes the grant', () => {
  const authorized = walk('AUTHORIZED').grant;
  const wrong = H.pairGrant(authorized, 'a-different-nonce-0000000', T(2));
  assert.deepEqual([wrong.ok, wrong.errors[0], wrong.grant.state], [false, 'NONCE_MISMATCH', 'REVOKED']);
  assert.deepEqual(wrong.cleanup, H.CLEANUP);
  for (const nonce of ['', 'short', 12345, null, undefined, 'x'.repeat(300)]) {
    assert.equal(H.pairGrant(authorized, nonce, T(2)).grant.state, 'REVOKED', String(nonce));
  }
  const afterRevoke = H.pairGrant(wrong.grant, SYN_NONCE, T(3));
  assert.deepEqual([afterRevoke.ok, afterRevoke.errors[0]], [false, 'WRONG_STATE']);
  const paired = H.pairGrant(authorized, SYN_NONCE, T(2));
  assert.ok(paired.ok);
  assert.equal(paired.grant.state, 'PAIRED');
  const replay = H.pairGrant(paired.grant, SYN_NONCE, T(3));
  assert.deepEqual([replay.ok, replay.errors[0], replay.grant.state], [false, 'NONCE_REPLAY', 'REVOKED']);
  const replayActive = H.pairGrant(active().grant, SYN_NONCE, T(4));
  assert.deepEqual([replayActive.errors[0], replayActive.grant.state], ['NONCE_REPLAY', 'REVOKED']);
  assert.ok(H.pairGrant(walk('PROPOSED').grant, SYN_NONCE, T(1)).errors.includes('WRONG_STATE'));
});

test('a credential descriptor binds only as ACCESS kind, with a fingerprint, never a raw token', () => {
  const paired = walk('PAIRED').grant;
  const ok = H.bindCredential(paired, { kind: 'ACCESS', expiresAt: T(3000), fingerprint: FP }, T(3));
  assert.ok(ok.ok);
  assert.equal(ok.grant.state, 'ACTIVE');
  assert.equal(ok.grant.credential.bound, true);
  assert.equal(ok.grant.credential.kind, 'ACCESS');
  const rejectKeep = (cred, code) => { const r = H.bindCredential(paired, cred, T(3)); assert.equal(r.ok, false); assert.ok(r.errors.includes(code), `${r.errors}`); assert.equal(r.grant.state, 'PAIRED'); return r; };
  rejectKeep({ kind: 'ID', expiresAt: T(3000), fingerprint: FP }, 'CREDENTIAL_KIND_INVALID');
  rejectKeep({ kind: 'ACCESS', expiresAt: T(3000), fingerprint: SYN_TOKEN }, 'CREDENTIAL_FINGERPRINT_INVALID');
  rejectKeep({ kind: 'ACCESS', expiresAt: T(3000), fingerprint: 'zz' }, 'CREDENTIAL_FINGERPRINT_INVALID');
  rejectKeep({ kind: 'ACCESS', expiresAt: T(3), fingerprint: FP }, 'CREDENTIAL_EXPIRED');
  rejectKeep({ kind: 'ACCESS', expiresAt: 'tomorrow', fingerprint: FP }, 'CREDENTIAL_EXPIRED');
  rejectKeep({ kind: 'ACCESS', expiresAt: T(3000), fingerprint: FP, accessToken: SYN_JWT }, 'UNKNOWN_FIELD');
  rejectKeep({ kind: SYN_JWT, expiresAt: T(3000), fingerprint: FP }, 'SECRET_DETECTED');
  rejectKeep({ kind: 'ACCESS', expiresAt: T(3000) }, 'REQUEST_INVALID');
  assert.ok(H.bindCredential(walk('AUTHORIZED').grant, { kind: 'ACCESS', expiresAt: T(3000), fingerprint: FP }, T(3)).errors.includes('WRONG_STATE'));
  assert.ok(H.bindCredential(ok.grant, { kind: 'ACCESS', expiresAt: T(3000), fingerprint: FP }, T(4)).errors.includes('WRONG_STATE'), 'no rebinding');
});

test('refresh material is never transferable: any form revokes the grant', () => {
  const paired = walk('PAIRED').grant;
  const cases = [
    { kind: 'REFRESH', expiresAt: T(3000), fingerprint: FP },
    { kind: 'ACCESS', expiresAt: T(3000), fingerprint: FP, refresh_token: 'x' },
    { kind: 'ACCESS', expiresAt: T(3000), fingerprint: FP, refreshToken: 'x' },
    { kind: 'ACCESS', expiresAt: T(3000), fingerprint: FP, nested: { refresh: 1 } },
    { kind: 'ACCESS', expiresAt: T(3000), fingerprint: FP, Refresh_Token: null }
  ];
  for (const cred of cases) {
    const r = H.bindCredential(paired, cred, T(3));
    assert.deepEqual([r.ok, r.errors[0], r.grant.state], [false, 'REFRESH_TOKEN_NOT_TRANSFERABLE', 'REVOKED'], JSON.stringify(cred));
    assert.deepEqual(r.cleanup, H.CLEANUP);
  }
  assert.ok(H.scanForSecrets({ a: { refreshToken: 'x' } }).some(f => f.rule === 'REFRESH_MATERIAL'));
});

test('a call must match task, workspace, purpose, capability and the bound credential', () => {
  const { grant } = active();
  const wrong = (patch, code) => {
    const r = H.reserveCall(grant, { ...CALL, ...patch }, T(10));
    assert.equal(r.ok, false);
    assert.ok(r.errors.includes(code), `${JSON.stringify(patch)} -> ${r.errors}`);
    assert.equal(r.grant, grant, 'a plain mismatch changes nothing');
    assert.equal(r.grant.callsUsed, 0);
  };
  wrong({ taskId: 'TASK-12' }, 'WRONG_TASK');
  wrong({ workspaceId: W2 }, 'WRONG_WORKSPACE');
  wrong({ purpose: 'SOMETHING_ELSE' }, 'WRONG_PURPOSE');
  wrong({ capability: 'sinbad-answer.admin' }, 'WRONG_CAPABILITY');
  const multi = H.reserveCall(grant, { ...CALL, taskId: 'TASK-12', workspaceId: W2 }, T(10));
  assert.deepEqual(multi.errors, ['WRONG_TASK', 'WRONG_WORKSPACE']);
  assert.ok(H.reserveCall(grant, { ...CALL, extra: 1 }, T(10)).errors.includes('UNKNOWN_FIELD'));
  const swapped = H.reserveCall(grant, { ...CALL, credentialFingerprint: H.fingerprintOf('ANOTHER-SYNTHETIC-TOKEN-1') }, T(10));
  assert.deepEqual([swapped.errors[0], swapped.grant.state], ['CREDENTIAL_SWAPPED', 'REVOKED']);
  const garbage = H.reserveCall(grant, { ...CALL, credentialFingerprint: 'nothex' }, T(10));
  assert.equal(garbage.grant.state, 'REVOKED');
  const ok = H.reserveCall(grant, CALL, T(10));
  assert.ok(ok.ok);
  assert.deepEqual([ok.grant.callsUsed, ok.grant.inFlight], [1, true]);
  assert.ok(H.reserveCall(ok.grant, CALL, T(11)).errors.includes('CALL_IN_FLIGHT'), 'one call at a time');
  assert.ok(H.reserveCall(walk('PAIRED').grant, CALL, T(10)).errors.includes('WRONG_STATE'), 'no calls before a credential is bound');
});

test('the call ceiling is never exceeded and exhaustion ends the grant', () => {
  let g = active({ maxCalls: 3 }).grant;
  let reserved = 0;
  for (let i = 0; i < 40; i += 1) {
    const r = H.reserveCall(g, CALL, T(10 + i * 2));
    if (!r.ok) { g = r.grant; continue; }
    reserved += 1;
    const o = H.recordCallOutcome(r.grant, OK200, T(11 + i * 2));
    assert.ok(o.ok);
    g = o.grant;
  }
  assert.equal(reserved, 3);
  assert.equal(g.state, 'EXHAUSTED');
  assert.equal(g.callsUsed, 3);
  assert.deepEqual(g.terminal.reason, 'CEILING_REACHED');
  const after = H.reserveCall(g, CALL, T(100));
  assert.deepEqual(after.errors, ['WRONG_STATE', 'OVER_CEILING']);
  const last = cycle(active({ maxCalls: 1 }).grant, OK200, 20);
  assert.equal(last.grant.state, 'EXHAUSTED');
  assert.deepEqual(last.cleanup, H.CLEANUP);
  assert.equal(last.event.kind, 'grant.exhausted');
});

test('the A3 STOP rules end the grant, and an unsafe outcome never keeps it alive', () => {
  const stops = [
    [{ status: 401 }, 'AUTH_REJECTED'], [{ status: 403 }, 'AUTH_REJECTED'], [{ status: 429 }, 'RATE_LIMITED'],
    [{ status: 200, sourceAccess: 'restricted' }, 'NOT_PRIVILEGED'], [{ status: 200 }, 'NOT_PRIVILEGED'], [{ status: 204 }, 'NOT_PRIVILEGED']
  ];
  for (const [outcome, reason] of stops) {
    const r = cycle(active().grant, outcome, 10);
    assert.equal(r.ok, false, JSON.stringify(outcome));
    assert.deepEqual([r.errors[0], r.grant.state, r.grant.terminal.reason], [reason, 'STOPPED', reason]);
    assert.deepEqual(r.cleanup, H.CLEANUP);
    assert.equal(r.event.kind, 'grant.stopped');
  }
  let g = active().grant;
  for (const [i, outcome] of [{ status: 500 }, { status: null }].entries()) { const r = cycle(g, outcome, 10 + i * 3); assert.ok(r.ok); g = r.grant; }
  assert.equal(g.consecutiveErrors, 2);
  const third = cycle(g, { status: 502 }, 20);
  assert.deepEqual([third.errors[0], third.grant.state], ['THREE_CONSECUTIVE_ERRORS', 'STOPPED']);
  const reset = cycle(g, OK200, 20);
  assert.equal(reset.grant.consecutiveErrors, 0);
  const again = cycle(cycle(reset.grant, { status: 500 }, 30).grant, { status: 500 }, 34);
  assert.equal(again.grant.state, 'ACTIVE', 'a success resets the error run');
  const okOutcome = cycle(active().grant, OK200, 10);
  assert.deepEqual([okOutcome.ok, okOutcome.grant.state, okOutcome.grant.inFlight, okOutcome.event.kind], [true, 'ACTIVE', false, 'grant.call-outcome']);
});

test('outcomes must be well formed and need a reserved call', () => {
  const { grant } = active();
  assert.ok(H.recordCallOutcome(grant, OK200, T(10)).errors.includes('NO_CALL_IN_FLIGHT'));
  const reserved = H.reserveCall(grant, CALL, T(10)).grant;
  for (const bad of [{ status: 'abc' }, { status: 99 }, { status: 600 }, { status: 200.5 }, { status: 200, sourceAccess: 'admin' }, { status: 200, extra: 1 }, {}, null]) {
    const r = H.recordCallOutcome(reserved, bad, T(11));
    assert.deepEqual([r.ok, r.errors[0], r.grant.state], [false, 'OUTCOME_INVALID', 'ACTIVE'], JSON.stringify(bad));
  }
});

test('completion, stop and revocation end the grant; no use survives a terminal state', () => {
  const makers = {
    COMPLETED: () => H.completeGrant(active().grant, T(10)),
    STOPPED: () => H.stopGrant(active().grant, 'RATE_LIMITED', T(10)),
    REVOKED: () => H.revokeGrant(active().grant, T(10)),
    EXPIRED: () => H.tickGrant(active().grant, T(4000)),
    DENIED: () => H.authorizeGrant(walk('PROPOSED').grant, { ownerAuthorizationId: 'auth-0003-synthetic', stepUpLevel: 'aal2', decision: 'DENY' }, T(1)),
    EXHAUSTED: () => cycle(active({ maxCalls: 1 }).grant, OK200, 10)
  };
  for (const [state, make] of Object.entries(makers)) {
    const r = make();
    assert.equal(r.grant.state, state);
    assert.deepEqual(r.cleanup, H.CLEANUP, state);
    assert.equal(r.grant.credential.bound, false, state);
    assert.equal(r.grant.inFlight, false, state);
    assert.ok(r.grant.terminal && r.grant.terminal.at, state);
    for (const attempt of [
      H.reserveCall(r.grant, CALL, T(5000)), H.pairGrant(r.grant, SYN_NONCE, T(5000)), H.completeGrant(r.grant, T(5000)), H.revokeGrant(r.grant, T(5000)),
      H.bindCredential(r.grant, { kind: 'ACCESS', expiresAt: T(9000), fingerprint: FP }, T(5000)),
      H.authorizeGrant(r.grant, { ownerAuthorizationId: 'auth-0009-synthetic', stepUpLevel: 'aal2', decision: 'ALLOW_ONCE', nonceHash: H.sha256Hex(SYN_NONCE) }, T(5000)),
      H.recordCallOutcome(r.grant, OK200, T(5000)), H.stopGrant(r.grant, 'RATE_LIMITED', T(5000))
    ]) {
      assert.equal(attempt.ok, false, state);
      assert.ok(attempt.errors.includes('WRONG_STATE'), `${state}: ${attempt.errors}`);
    }
  }
  assert.ok(H.completeGrant(walk('PROPOSED').grant, T(1)).errors.includes('WRONG_STATE'));
  assert.ok(H.completeGrant(walk('PAIRED').grant, T(3)).ok, 'completing before use ends the grant too');
  const inFlight = H.reserveCall(active().grant, CALL, T(10)).grant;
  assert.ok(H.completeGrant(inFlight, T(11)).errors.includes('CALL_IN_FLIGHT'));
  assert.ok(H.stopGrant(inFlight, 'RATE_LIMITED', T(11)).ok, 'a stop is allowed while a call is in flight');
  assert.ok(H.stopGrant(active().grant, 'because I said so', T(10)).errors.includes('REQUEST_INVALID'));
  assert.ok(H.revokeGrant(walk('PROPOSED').grant, T(1)).ok);
});

test('expiry applies on every operation and is the minimum of the grant and credential lifetimes', () => {
  const short = active({ ttlMs: 60000 }).grant;
  const atEdge = H.reserveCall(short, CALL, T(60));
  assert.deepEqual([atEdge.ok, atEdge.errors[0], atEdge.grant.state, atEdge.event.kind], [false, 'EXPIRED', 'EXPIRED', 'grant.expired'], 'expiry is inclusive');
  assert.deepEqual(atEdge.cleanup, H.CLEANUP);
  assert.ok(H.reserveCall(short, CALL, T(59)).ok);
  const { grant: credShort } = (() => { const p = walk('PAIRED').grant; const r = H.bindCredential(p, { kind: 'ACCESS', expiresAt: T(300), fingerprint: FP }, T(3)); return { grant: r.grant }; })();
  assert.ok(H.reserveCall(credShort, CALL, T(299)).ok);
  assert.equal(H.reserveCall(credShort, CALL, T(300)).grant.state, 'EXPIRED', 'a short credential expires the grant early');
  assert.equal(H.authorizeGrant(walk('PROPOSED').grant, { ownerAuthorizationId: 'auth-0004-synthetic', stepUpLevel: 'aal2', decision: 'ALLOW_ONCE', nonceHash: H.sha256Hex(SYN_NONCE) }, T(3601)).grant.state, 'EXPIRED');
  const pairingLate = H.pairGrant(walk('AUTHORIZED').grant, SYN_NONCE, T(1 + 121));
  assert.deepEqual([pairingLate.ok, pairingLate.errors[0], pairingLate.grant.state], [false, 'PAIRING_WINDOW_ELAPSED', 'EXPIRED']);
  assert.ok(H.pairGrant(walk('AUTHORIZED').grant, SYN_NONCE, T(1 + 119)).ok);
  const live = active().grant;
  assert.equal(H.tickGrant(live, T(100)).grant, live, 'a live grant is returned unchanged');
  const expired = H.tickGrant(live, T(3600));
  assert.deepEqual([expired.ok, expired.grant.state, expired.event.kind], [true, 'EXPIRED', 'grant.expired']);
  const again = H.tickGrant(expired.grant, T(3700));
  assert.deepEqual([again.ok, again.event], [true, null]);
  assert.equal(H.tickGrant({ ...live }, T(1)).ok, false);
});

test('a look-alike object is never accepted as a grant', () => {
  const { grant } = active();
  const copies = [{ ...grant }, JSON.parse(JSON.stringify(grant)), Object.create(grant), null, undefined, 'GRANT', 42];
  for (const copy of copies) {
    assert.equal(H.reserveCall(copy, CALL, T(10)).ok, false);
    assert.equal(H.completeGrant(copy, T(10)).ok, false);
    assert.equal(H.pairGrant(copy, SYN_NONCE, T(10)).ok, false);
    assert.equal(H.revokeGrant(copy, T(10)).ok, false);
  }
  assert.equal(H.reserveCall(grant, CALL, 'later').ok, false);
  assert.throws(() => H.toRecord({ ...grant }), /NOT_A_GRANT/);
});

test('the grant carries no secret: not in JSON, inspect, the record or any event', () => {
  const { grant, events } = active();
  assert.ok(!Object.keys(grant).includes('_internal'));
  const everything = [JSON.stringify(grant), util.inspect(grant, { depth: 10 }), JSON.stringify(H.toRecord(grant)), JSON.stringify(events)].join('\n');
  assert.equal(H.scanForLiterals(everything, [SYN_TOKEN, SYN_NONCE, H.sha256Hex(SYN_NONCE), FP]).leaked, false, 'neither the token, the nonce, their hashes nor the fingerprint');
  assert.deepEqual(H.scanForSecrets(JSON.parse(JSON.stringify(grant))), []);
  const results = [H.proposeGrant({ ...REQUEST, purpose: SYN_JWT }, T(0)), H.bindCredential(walk('PAIRED').grant, { kind: 'ACCESS', expiresAt: T(3000), fingerprint: SYN_TOKEN }, T(3)), H.pairGrant(walk('AUTHORIZED').grant, SYN_JWT + '0000', T(2))];
  assert.equal(H.scanForLiterals(JSON.stringify(results), [SYN_TOKEN, SYN_JWT]).leaked, false, 'a rejected input is never echoed back');
});

test('every event follows the closed participation-safe schema', () => {
  const { events } = active();
  const more = [H.completeGrant(active().grant, T(10)), H.stopGrant(active().grant, 'AUTH_REJECTED', T(10)), H.revokeGrant(active().grant, T(10)), H.tickGrant(active().grant, T(4000)), cycle(active({ maxCalls: 1 }).grant, OK200, 10), cycle(active().grant, { status: 429 }, 10), H.reserveCall(active().grant, { ...CALL, taskId: 'TASK-12' }, T(10))];
  for (const e of [...events, ...more.map(r => r.event)]) {
    const v = H.validateEvent(e);
    assert.ok(v.ok, `${e.kind}: ${v.errors}`);
    assert.deepEqual(Object.keys(e).sort(), ['at', 'callsUsed', 'capability', 'credentialBound', 'fromState', 'grantId', 'kind', 'maxCalls', 'ownerAuthorizationId', 'purpose', 'reasonCodes', 'schema', 'taskId', 'toState', 'workspaceId']);
    assert.ok(e.reasonCodes.every(code => H.REASONS.includes(code)));
  }
  const base = events[0];
  const bad = patch => assert.equal(H.validateEvent({ ...base, ...patch }).ok, false, JSON.stringify(patch));
  bad({ extra: 1 }); bad({ kind: 'grant.hacked' }); bad({ toState: 'GREAT' }); bad({ reasonCodes: ['the token is eyJhbGciOiJTWU5USEVUSUMifQ.eyJzdWIiOiJTWU5USEVUSUMtVEVTVCJ9.U1lOVEhFVElDLVNJR05BVFVSRQ'] });
  bad({ reasonCodes: ['free text reason'] }); bad({ callsUsed: 31 }); bad({ workspaceId: 'x' }); bad({ at: 'now' }); bad({ credentialBound: 'yes' }); bad({ ownerAuthorizationId: SYN_JWT });
  const noKey = { ...base }; delete noKey.at;
  assert.equal(H.validateEvent(noKey).ok, false);
  assert.equal(H.validateEvent(null).ok, false);
});

test('events record the lifecycle faithfully', () => {
  const { events } = active();
  assert.deepEqual(events.map(e => [e.kind, e.fromState, e.toState]), [
    ['grant.proposed', null, 'PROPOSED'], ['grant.authorized', 'PROPOSED', 'AUTHORIZED'], ['grant.paired', 'AUTHORIZED', 'PAIRED'], ['grant.credential-bound', 'PAIRED', 'ACTIVE']
  ]);
  assert.equal(events[1].ownerAuthorizationId, 'auth-0001-synthetic');
  assert.equal(events[3].credentialBound, true);
  const rejected = H.reserveCall(active().grant, { ...CALL, purpose: 'OTHER_PURPOSE' }, T(10));
  assert.deepEqual([rejected.event.kind, rejected.event.fromState, rejected.event.toState, rejected.event.reasonCodes], ['grant.rejected', 'ACTIVE', 'ACTIVE', ['WRONG_PURPOSE']]);
});

test('secret scanning finds the usual shapes and reports paths and rules, never values', () => {
  const samples = {
    JWT: { x: SYN_JWT }, BEARER: { header: 'Bearer SYNTHETICBEARERVALUE0123456789' }, SUPABASE_SECRET_KEY: ['sb_secret_SYNTHETICSECRET0123456'],
    PRIVATE_KEY: { pem: '-----BEGIN PRIVATE KEY-----' }, SECRET_KEY_NAME: { password: 'hunter2' }, REFRESH_MATERIAL: { refresh_token: 'x' }
  };
  for (const [rule, sample] of Object.entries(samples)) {
    const found = H.scanForSecrets(sample);
    assert.ok(found.some(f => f.rule === rule), `${rule} -> ${JSON.stringify(found)}`);
    assert.equal(H.scanForLiterals(JSON.stringify(found), [SYN_JWT, 'hunter2', 'SYNTHETICBEARERVALUE0123456789', 'sb_secret_SYNTHETICSECRET0123456']).leaked, false, 'findings never echo values');
  }
  for (const key of ['accessToken', 'access_token', 'Authorization', 'apiKey', 'client_secret', 'jwt', 'serviceRoleKey']) assert.ok(H.scanForSecrets({ [key]: 'value' }).some(f => f.rule === 'SECRET_KEY_NAME'), key);
  const nested = H.scanForSecrets({ a: [{ b: SYN_JWT }] });
  assert.equal(nested[0].path, 'a[0].b');
  assert.equal(H.scanForSecrets({ [SYN_JWT]: 1 })[0].path, '<key-redacted>');
  assert.deepEqual(H.scanForSecrets({ token: '' }), [], 'an empty value is not a secret');
  const cyclic = { a: 1 }; cyclic.self = cyclic;
  assert.deepEqual(H.scanForSecrets(cyclic), []);
  assert.ok(H.scanForSecrets('plain ' + SYN_JWT).some(f => f.rule === 'JWT'));
});

test('secret scanning does not flag normal records, hashes, ids or fingerprints', () => {
  const clean = { grantId: 'GRANT-ABCDEF123456', workspaceId: W, hash: H.sha256Hex('x'), fingerprint: FP, ownerAuthorizationId: 'auth-0001-synthetic', purpose: 'PHASE_4_3A_A5_REAL_CAPTURE', credentialBound: true, tokenBound: false, kind: 'ACCESS' };
  assert.deepEqual(H.scanForSecrets(clean), []);
  assert.deepEqual(H.scanForSecrets(active().grant), []);
  assert.ok(H.assertNoSecrets(clean));
});

test('redaction removes what scanning finds and is idempotent', () => {
  const dirty = { note: `see ${SYN_JWT} and Bearer SYNTHETICBEARERVALUE0123456789`, password: 'hunter2', refreshToken: 'abc', list: ['sb_secret_SYNTHETICSECRET0123456'], safe: 'kept', [SYN_JWT]: 'value' };
  const clean = H.redactSecrets(dirty);
  assert.deepEqual(H.scanForSecrets(clean), []);
  assert.equal(clean.safe, 'kept');
  assert.equal(H.scanForLiterals(JSON.stringify(clean), [SYN_JWT, 'hunter2', 'SYNTHETICBEARERVALUE0123456789', 'sb_secret_SYNTHETICSECRET0123456']).leaked, false);
  assert.deepEqual(H.redactSecrets(clean), clean);
  assert.equal(dirty.password, 'hunter2', 'the input is not modified');
  const cyclic = { a: 1 }; cyclic.self = cyclic;
  assert.equal(H.redactSecrets(cyclic).a, 1);
});

test('literal leak detection sees raw, escaped, encoded, base64 and hex forms and ignores short values', () => {
  const secret = 'syn/secret+value"with=chars&0001';
  const forms = [secret, JSON.stringify(secret).slice(1, -1), encodeURIComponent(secret), Buffer.from(secret).toString('base64'), Buffer.from(secret).toString('hex')];
  for (const form of forms) assert.deepEqual(H.scanForLiterals(`before ${form} after`, [secret]), { leaked: true, hits: 1, checked: 1 });
  assert.equal(H.scanForLiterals('nothing here', [secret]).leaked, false);
  assert.deepEqual(H.scanForLiterals('abc', ['abc', 5, null]), { leaked: false, hits: 0, checked: 0 });
  assert.equal(H.scanForLiterals({ nested: secret }, [secret]).leaked, true);
  assert.equal(H.scanForLiterals('x', 'not-an-array').checked, 0);
});

test('assertNoSecrets throws without echoing the secret', () => {
  assert.throws(() => H.assertNoSecrets({ x: SYN_JWT }), error => error.code === 'SECRET_DETECTED' && !error.message.includes(SYN_JWT) && /JWT@x/.test(error.message));
  assert.throws(() => H.assertNoSecrets({ note: 'contains SYNTHETIC-LITERAL-9999' }, ['SYNTHETIC-LITERAL-9999']), error => error.code === 'SECRET_DETECTED' && !error.message.includes('SYNTHETIC-LITERAL-9999'));
});

test('the logic is deterministic: the same inputs give the same results', () => {
  const run = () => { const a = active(); const r = cycle(a.grant, OK200, 10); return { events: a.events, grant: JSON.parse(JSON.stringify(r.grant)), event: r.event }; };
  assert.deepEqual(run(), run());
});

test('the module is pure: only node:crypto, no clock, randomness, environment, files or network', () => {
  const source = fs.readFileSync(path.join(ROOT, 'sinbad-ai-core/auth-handoff/handoff-v0.js'), 'utf8');
  const requires = [...source.matchAll(/require\(([^)]*)\)/gu)].map(m => m[1]);
  assert.deepEqual(requires, ["'node:crypto'"]);
  for (const forbidden of ['process.env', 'process.argv', 'Date.now', 'Math.random', 'new Date()', 'randomBytes', 'randomUUID', 'fetch(', 'XMLHttpRequest', 'child_process', 'localStorage', 'clipboard', 'writeFile', 'readFile', 'console.', 'process.stdout', 'process.stderr', 'setTimeout', 'eval(', 'new Function']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test('nothing wires the handoff yet and the accepted A3 files are unchanged', () => {
  const lf = file => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/gu, '\n');
  const hash = file => crypto.createHash('sha256').update(lf(file)).digest('hex');
  assert.equal(hash('sinbad-ai-core/shadow/capture-client.js'), 'a080ffafdf0bd1e28f2f8ec233ee29bd9e5cb6e15347a04a10b19a2c8a33a0a2');
  assert.equal(hash('tools/capture-sinbad-answer.js'), '82f18436e767cf192b550b61e0af5656f4e3ae2cdb37262840c7f382fb7bfc6d');
  const files = [];
  const collect = dir => { for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { const rel = `${dir}/${entry.name}`; if (entry.isDirectory()) { if (!['node_modules', 'auth-handoff', 'tests'].includes(entry.name)) collect(rel); } else if (/\.(js|ts|json|html)$/u.test(entry.name)) files.push(rel); } };
  for (const dir of ['tools', 'sinbad-ai-core', 'supabase/functions']) collect(dir);
  files.push('app.js', 'package.json');
  for (const file of files) assert.equal(/auth-handoff|handoff-v0/u.test(lf(file)), false, `${file} must not reference the handoff yet`);
});
