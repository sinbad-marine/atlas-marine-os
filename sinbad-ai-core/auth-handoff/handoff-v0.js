'use strict';
// SINBAD Secure Auth Handoff v0, phase P1: pure, deterministic security logic. Nothing here reads or holds a credential.
//
// This module models WHAT the Owner authorized and WHEN it may be used. It never receives a raw token: the caller passes an
// access-kind descriptor (expiry plus a short fingerprint), so the logic cannot leak what it never holds. Time is injected,
// there is no randomness, no environment, no file, no network and no child process. Only node:crypto (sha256, timingSafeEqual).
// A grant is created by this module only; a plain object that merely looks like a grant is refused (fail closed).
//
// Authorization and credential possession are separate records: AUTHORIZED/PAIRED say the Owner approved and the channel was
// proven; ACTIVE says a credential descriptor is bound. A refresh token is never a transferable credential.
const crypto = require('node:crypto');

const VERSION = 'sinbad-auth-handoff/0-v1';
const GRANT_SCHEMA = 'sinbad-auth-handoff-grant/0-v1';
const EVENT_SCHEMA = 'sinbad-auth-handoff-event/0-v1';
const LIMITS = Object.freeze({ maxCallCeiling: 36, minTtlMs: 60000, maxTtlMs: 3600000, pairingWindowMs: 120000, maxConsecutiveErrors: 3 });
const CAPABILITIES = Object.freeze(['sinbad-answer.invoke']);
const STATES = Object.freeze(['PROPOSED', 'AUTHORIZED', 'PAIRED', 'ACTIVE', 'COMPLETED', 'EXHAUSTED', 'STOPPED', 'EXPIRED', 'REVOKED', 'DENIED']);
const TERMINAL = new Set(['COMPLETED', 'EXHAUSTED', 'STOPPED', 'EXPIRED', 'REVOKED', 'DENIED']);
const STOP_REASONS = Object.freeze(['AUTH_REJECTED', 'RATE_LIMITED', 'NOT_PRIVILEGED', 'THREE_CONSECUTIVE_ERRORS']);
const REASONS = Object.freeze([
  'REQUEST_INVALID', 'UNKNOWN_FIELD', 'SECRET_DETECTED', 'CAPABILITY_NOT_ALLOWED', 'CEILING_INVALID', 'TTL_INVALID', 'STEP_UP_REQUIRED',
  'AUTHORIZATION_REUSED', 'WRONG_STATE', 'EXPIRED', 'PAIRING_WINDOW_ELAPSED', 'NONCE_MISMATCH', 'NONCE_REPLAY', 'REFRESH_TOKEN_NOT_TRANSFERABLE',
  'CREDENTIAL_KIND_INVALID', 'CREDENTIAL_EXPIRED', 'CREDENTIAL_FINGERPRINT_INVALID', 'CREDENTIAL_SWAPPED', 'WRONG_TASK', 'WRONG_WORKSPACE',
  'WRONG_PURPOSE', 'WRONG_CAPABILITY', 'OVER_CEILING', 'CALL_IN_FLIGHT', 'NO_CALL_IN_FLIGHT', 'AUTH_REJECTED', 'RATE_LIMITED', 'NOT_PRIVILEGED',
  'THREE_CONSECUTIVE_ERRORS', 'OWNER_DENIED', 'OWNER_REVOKED', 'TASK_COMPLETED', 'CEILING_REACHED', 'OUTCOME_INVALID'
]);
const EVENT_KINDS = Object.freeze([
  'grant.proposed', 'grant.authorized', 'grant.denied', 'grant.paired', 'grant.credential-bound', 'grant.call-reserved', 'grant.call-outcome',
  'grant.completed', 'grant.exhausted', 'grant.stopped', 'grant.expired', 'grant.revoked', 'grant.rejected'
]);
const CLEANUP = Object.freeze({ wipeCredential: true, closeBroker: true, invalidateNonce: true });

const RE = Object.freeze({
  grantId: /^GRANT-[A-Za-z0-9]{8,48}$/u, taskId: /^[A-Z][A-Z0-9]*-\d{1,6}$/u, purpose: /^[A-Z][A-Z0-9_]{2,63}$/u,
  uuid: /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu, authId: /^[A-Za-z0-9-]{8,64}$/u, hex64: /^[0-9a-f]{64}$/u, fingerprint: /^[0-9a-f]{16}$/u,
  iso: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/u
});

// ---------------------------------------------------------------- secret scanning (reports paths and rules, never values)
const PATTERNS = Object.freeze([
  ['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/gu],
  ['BEARER', /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/giu],
  ['SUPABASE_SECRET_KEY', /\bsb_secret_[A-Za-z0-9_-]{8,}/gu],
  ['PRIVATE_KEY', /-----BEGIN [A-Z ]*PRIVATE KEY-----/gu]
]);
const SECRET_KEY = /^(access_?token|refresh_?token|id_?token|token|secret|client_?secret|password|passwd|api_?key|authorization|bearer|jwt|service_?role_?key)$/iu;
const REFRESH_KEY = /refresh/iu;
// A value that is already a redaction marker carries no secret, so a redacted record scans clean again.
const isMarker = value => typeof value === 'string' && /^\[REDACTED:[A-Z_]+\]$/u.test(value);
const patternHit = text => { for (const [rule, re] of PATTERNS) { re.lastIndex = 0; if (re.test(text)) { re.lastIndex = 0; return rule; } } return null; };

function walk(value, visit, path = '', seen = new Set(), depth = 0) {
  if (depth > 20) return;
  if (value && typeof value === 'object') {
    if (seen.has(value)) return;
    seen.add(value);
    const isArray = Array.isArray(value);
    for (const key of Object.keys(value)) {
      const seg = isArray ? `[${key}]` : (patternHit(key) ? '<key-redacted>' : key);
      const here = isArray ? `${path}${seg}` : (path ? `${path}.${seg}` : seg);
      if (!isArray) visit({ kind: 'key', key, path: here, value: value[key] });
      if (typeof value[key] === 'string') visit({ kind: 'string', key: isArray ? null : key, path: here, value: value[key] });
      else walk(value[key], visit, here, seen, depth + 1);
    }
  } else if (typeof value === 'string') visit({ kind: 'string', key: null, path: path || '$', value });
}

function scanForSecrets(value) {
  const findings = [], keep = new Set();
  const add = (path, rule) => { const id = `${path}|${rule}`; if (!keep.has(id)) { keep.add(id); findings.push(Object.freeze({ path, rule })); } };
  walk(value, hit => {
    if (hit.kind === 'key') {
      if (REFRESH_KEY.test(hit.key) && !isMarker(hit.value)) add(hit.path, 'REFRESH_MATERIAL');
      const rule = patternHit(hit.key); if (rule) add(hit.path, `KEY_NAME_${rule}`);
    } else {
      const rule = patternHit(hit.value); if (rule) add(hit.path, rule);
      if (hit.key && SECRET_KEY.test(hit.key) && hit.value.length > 0 && !isMarker(hit.value)) add(hit.path, 'SECRET_KEY_NAME');
    }
  });
  return Object.freeze(findings);
}

function redactSecrets(value) {
  const seen = new Map();
  const cleanText = text => { let out = text; for (const [rule, re] of PATTERNS) { re.lastIndex = 0; out = out.replace(re, `[REDACTED:${rule}]`); } return out; };
  const go = (v, depth) => {
    if (typeof v === 'string') return cleanText(v);
    if (!v || typeof v !== 'object' || depth > 20) return v;
    if (seen.has(v)) return seen.get(v);
    const out = Array.isArray(v) ? [] : {};
    seen.set(v, out);
    let n = 0;
    for (const key of Object.keys(v)) {
      if (Array.isArray(v)) { out[key] = go(v[key], depth + 1); continue; }
      const name = patternHit(key) ? `<redacted-key-${n++}>` : key;
      if (REFRESH_KEY.test(key)) out[name] = '[REDACTED:REFRESH_MATERIAL]';
      else if (typeof v[key] === 'string' && SECRET_KEY.test(key) && v[key].length > 0) out[name] = '[REDACTED:SECRET_KEY_NAME]';
      else out[name] = go(v[key], depth + 1);
    }
    return out;
  };
  return go(value, 0);
}

// Checks serialized output for specific known literals (raw, JSON-escaped, URL-encoded, base64, hex). Returns counts only.
function scanForLiterals(text, literals) {
  let haystack;
  try { haystack = typeof text === 'string' ? text : JSON.stringify(text); } catch { haystack = ''; }
  haystack = haystack || '';
  let hits = 0, checked = 0;
  for (const literal of Array.isArray(literals) ? literals : []) {
    if (typeof literal !== 'string' || literal.length < 8) continue;
    checked += 1;
    const forms = [literal, JSON.stringify(literal).slice(1, -1), encodeURIComponent(literal), Buffer.from(literal, 'utf8').toString('base64'), Buffer.from(literal, 'utf8').toString('hex')];
    if (forms.some(form => form.length > 0 && haystack.includes(form))) hits += 1;
  }
  return Object.freeze({ leaked: hits > 0, hits, checked });
}

function assertNoSecrets(value, literals = []) {
  const findings = scanForSecrets(value);
  const lit = scanForLiterals(value, literals);
  if (findings.length || lit.leaked) {
    const error = new Error(`SECRET_DETECTED:${findings.map(f => `${f.rule}@${f.path}`).join(',')}${lit.leaked ? `,LITERAL_LEAK(${lit.hits})` : ''}`);
    error.code = 'SECRET_DETECTED';
    throw error;
  }
  return true;
}

// ---------------------------------------------------------------- helpers
const isIso = v => typeof v === 'string' && RE.iso.test(v) && Number.isFinite(Date.parse(v));
const toIso = ms => new Date(ms).toISOString();
const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
function keysOk(obj, required, optional = []) {
  if (!isPlain(obj)) return { ok: false, unknown: false };
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(obj).some(k => !allowed.has(k));
  const missing = required.some(k => !Object.hasOwn(obj, k));
  return { ok: !unknown && !missing, unknown };
}
const sha256Hex = text => crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
const safeEqualHex = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && a.length > 0
  && crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
const fingerprintOf = secret => sha256Hex(secret).slice(0, 16);

const MINTED = new WeakSet();
function build(pub, internal = {}) {
  const grant = { ...pub, authorization: pub.authorization ? Object.freeze({ ...pub.authorization }) : null, credential: Object.freeze({ ...pub.credential }), terminal: pub.terminal ? Object.freeze({ ...pub.terminal }) : null };
  Object.defineProperty(grant, '_internal', { value: Object.freeze({ nonceHash: internal.nonceHash || null, credentialFingerprint: internal.credentialFingerprint || null }), enumerable: false });
  MINTED.add(grant);
  return Object.freeze(grant);
}
// Only objects minted by build() are grants: a spread copy, a JSON round trip or a hand-made look-alike is refused.
const isGrantObject = g => g !== null && typeof g === 'object' && MINTED.has(g);

function makeEvent(prev, next, kind, now, reasons) {
  return Object.freeze({
    schema: EVENT_SCHEMA, grantId: next.grantId, taskId: next.taskId, workspaceId: next.workspaceId, purpose: next.purpose, capability: next.capability,
    kind, fromState: prev ? prev.state : null, toState: next.state, at: now, reasonCodes: Object.freeze([...reasons]),
    callsUsed: next.callsUsed, maxCalls: next.maxCalls, ownerAuthorizationId: next.authorization ? next.authorization.ownerAuthorizationId : null, credentialBound: next.credential.bound
  });
}
function done(prev, next, kind, now, reasons = [], extra = {}) {
  const event = makeEvent(prev, next, kind, now, reasons);
  return Object.freeze({ ok: true, errors: Object.freeze([]), grant: next, event, cleanup: TERMINAL.has(next.state) ? CLEANUP : null, ...extra });
}
// A rejection never changes state, unless `to` is given (fail-closed transitions such as revocation or expiry).
function rejected(grant, errors, now, to = null) {
  if (!to) return Object.freeze({ ok: false, errors: Object.freeze([...errors]), grant, event: makeEvent(grant, grant, 'grant.rejected', now, errors), cleanup: null });
  const next = terminate(grant, to.state, now, to.reason);
  return Object.freeze({ ok: false, errors: Object.freeze([...errors]), grant: next, event: makeEvent(grant, next, to.kind, now, errors), cleanup: CLEANUP });
}
const TERMINAL_KIND = Object.freeze({ COMPLETED: 'grant.completed', EXHAUSTED: 'grant.exhausted', STOPPED: 'grant.stopped', EXPIRED: 'grant.expired', REVOKED: 'grant.revoked', DENIED: 'grant.denied' });
// Every terminal state wipes the internal secrets and the in-flight marker, so a terminal grant cannot be used even by a missed check.
function terminate(grant, state, now, reason) {
  return build({ ...grant, state, inFlight: false, credential: { ...grant.credential, bound: false }, terminal: { reason, at: now } }, {});
}
const nowOk = now => isIso(now);
const effectiveExpiryMs = g => Math.min(Date.parse(g.expiresAt), g.credential.bound ? Date.parse(g.credential.expiresAt) : Infinity);

// Applies expiry before anything else. Returns a rejection result when the grant is unusable, null when it may proceed.
function gate(grant, now, op) {
  if (!isGrantObject(grant)) return Object.freeze({ ok: false, errors: Object.freeze(['REQUEST_INVALID']), grant: null, event: null, cleanup: null });
  if (!nowOk(now)) return Object.freeze({ ok: false, errors: Object.freeze(['REQUEST_INVALID']), grant, event: null, cleanup: null });
  if (TERMINAL.has(grant.state)) return rejected(grant, grant.state === 'EXHAUSTED' && op === 'reserve' ? ['WRONG_STATE', 'OVER_CEILING'] : ['WRONG_STATE'], now);
  const expiry = expiryReason(grant, now);
  if (expiry) return rejected(grant, [expiry], now, { state: 'EXPIRED', kind: 'grant.expired', reason: expiry });
  return null;
}
function expiryReason(grant, now) {
  const t = Date.parse(now);
  if (t >= effectiveExpiryMs(grant)) return 'EXPIRED';
  if (grant.state === 'AUTHORIZED' && t >= Date.parse(grant.authorization.authorizedAt) + LIMITS.pairingWindowMs) return 'PAIRING_WINDOW_ELAPSED';
  return null;
}

// ---------------------------------------------------------------- lifecycle
function proposeGrant(request, now) {
  const errors = [];
  if (!nowOk(now)) return Object.freeze({ ok: false, errors: Object.freeze(['REQUEST_INVALID']), grant: null, event: null, cleanup: null });
  const shape = keysOk(request, ['grantId', 'taskId', 'purpose', 'workspaceId', 'capability', 'maxCalls', 'ttlMs']);
  if (!shape.ok) errors.push(shape.unknown ? 'UNKNOWN_FIELD' : 'REQUEST_INVALID');
  if (isPlain(request)) {
    if (!RE.grantId.test(String(request.grantId)) || !RE.taskId.test(String(request.taskId)) || !RE.purpose.test(String(request.purpose)) || !RE.uuid.test(String(request.workspaceId))) errors.push('REQUEST_INVALID');
    if (!CAPABILITIES.includes(request.capability)) errors.push('CAPABILITY_NOT_ALLOWED');
    if (!isInt(request.maxCalls, 1, LIMITS.maxCallCeiling)) errors.push('CEILING_INVALID');
    if (!isInt(request.ttlMs, LIMITS.minTtlMs, LIMITS.maxTtlMs)) errors.push('TTL_INVALID');
    if (scanForSecrets(request).length) errors.push('SECRET_DETECTED');
  }
  if (errors.length) return Object.freeze({ ok: false, errors: Object.freeze([...new Set(errors)]), grant: null, event: null, cleanup: null });
  const grant = build({
    schema: GRANT_SCHEMA, grantId: request.grantId, taskId: request.taskId, purpose: request.purpose, workspaceId: request.workspaceId, capability: request.capability,
    maxCalls: request.maxCalls, issuedAt: now, expiresAt: toIso(Date.parse(now) + request.ttlMs), state: 'PROPOSED', authorization: null, pairedAt: null,
    credential: { bound: false, kind: null, expiresAt: null, boundAt: null }, callsUsed: 0, consecutiveErrors: 0, inFlight: false, terminal: null
  });
  return done(null, grant, 'grant.proposed', now);
}

// The Owner decision. ALLOW_ONCE needs a step-up at assurance level aal2 and a single-use authorization id; the caller keeps
// `usedAuthorizationIds` and records the returned `consumedAuthorizationId`. The Owner authorization is NOT a credential.
function authorizeGrant(grant, approval, now, usedAuthorizationIds = []) {
  const blocked = gate(grant, now, 'authorize'); if (blocked) return blocked;
  if (grant.state !== 'PROPOSED') return rejected(grant, ['WRONG_STATE'], now);
  const shape = keysOk(approval, ['ownerAuthorizationId', 'stepUpLevel', 'decision'], ['nonceHash']);
  if (!shape.ok || !RE.authId.test(String(approval.ownerAuthorizationId)) || !['ALLOW_ONCE', 'DENY'].includes(approval.decision)) return rejected(grant, [shape.unknown ? 'UNKNOWN_FIELD' : 'REQUEST_INVALID'], now);
  if (scanForSecrets(approval).length) return rejected(grant, ['SECRET_DETECTED'], now);
  if (approval.decision === 'DENY') {
    const next = terminate(build({ ...grant, authorization: { ownerAuthorizationId: approval.ownerAuthorizationId, stepUp: 'none', authorizedAt: now } }, {}), 'DENIED', now, 'OWNER_DENIED');
    return done(grant, next, 'grant.denied', now, ['OWNER_DENIED']);
  }
  if (approval.stepUpLevel !== 'aal2') return rejected(grant, ['STEP_UP_REQUIRED'], now);
  if (Array.isArray(usedAuthorizationIds) && usedAuthorizationIds.includes(approval.ownerAuthorizationId)) return rejected(grant, ['AUTHORIZATION_REUSED'], now);
  if (!RE.hex64.test(String(approval.nonceHash))) return rejected(grant, ['REQUEST_INVALID'], now);
  const next = build({ ...grant, state: 'AUTHORIZED', authorization: { ownerAuthorizationId: approval.ownerAuthorizationId, stepUp: 'aal2', authorizedAt: now } }, { nonceHash: approval.nonceHash });
  return done(grant, next, 'grant.authorized', now, [], { consumedAuthorizationId: approval.ownerAuthorizationId });
}

// Proves the channel: the presented one-time nonce must hash to the value the Owner approved. Single use: any mismatch or replay
// revokes the grant, because it points at a spoofed or duplicated listener.
function pairGrant(grant, presentedNonce, now) {
  const blocked = gate(grant, now, 'pair'); if (blocked) return blocked;
  if (grant.state === 'PAIRED' || grant.state === 'ACTIVE') return rejected(grant, ['NONCE_REPLAY'], now, { state: 'REVOKED', kind: 'grant.revoked', reason: 'NONCE_REPLAY' });
  if (grant.state !== 'AUTHORIZED') return rejected(grant, ['WRONG_STATE'], now);
  const stored = grant._internal.nonceHash;
  const good = typeof presentedNonce === 'string' && presentedNonce.length >= 16 && presentedNonce.length <= 256 && safeEqualHex(sha256Hex(presentedNonce), stored);
  if (!good) return rejected(grant, ['NONCE_MISMATCH'], now, { state: 'REVOKED', kind: 'grant.revoked', reason: 'NONCE_MISMATCH' });
  return done(grant, build({ ...grant, state: 'PAIRED', pairedAt: now }, {}), 'grant.paired', now);
}

// Binds a credential DESCRIPTOR (never the credential): kind ACCESS, its expiry and a fingerprint computed by the caller.
// Refresh material in any form is refused and revokes the grant.
function bindCredential(grant, credential, now) {
  const blocked = gate(grant, now, 'bind'); if (blocked) return blocked;
  if (grant.state !== 'PAIRED') return rejected(grant, ['WRONG_STATE'], now);
  const refresh = isPlain(credential) && (credential.kind === 'REFRESH' || scanForSecrets(credential).some(f => f.rule === 'REFRESH_MATERIAL'));
  if (refresh) return rejected(grant, ['REFRESH_TOKEN_NOT_TRANSFERABLE'], now, { state: 'REVOKED', kind: 'grant.revoked', reason: 'REFRESH_TOKEN_NOT_TRANSFERABLE' });
  const shape = keysOk(credential, ['kind', 'expiresAt', 'fingerprint']);
  if (!shape.ok) return rejected(grant, [shape.unknown ? 'UNKNOWN_FIELD' : 'REQUEST_INVALID'], now);
  if (scanForSecrets(credential).length) return rejected(grant, ['SECRET_DETECTED'], now);
  const errors = [];
  if (credential.kind !== 'ACCESS') errors.push('CREDENTIAL_KIND_INVALID');
  if (!RE.fingerprint.test(String(credential.fingerprint))) errors.push('CREDENTIAL_FINGERPRINT_INVALID');
  if (!isIso(credential.expiresAt) || Date.parse(credential.expiresAt) <= Date.parse(now)) errors.push('CREDENTIAL_EXPIRED');
  if (errors.length) return rejected(grant, errors, now);
  const next = build({ ...grant, state: 'ACTIVE', credential: { bound: true, kind: 'ACCESS', expiresAt: credential.expiresAt, boundAt: now } }, { credentialFingerprint: credential.fingerprint });
  return done(grant, next, 'grant.credential-bound', now);
}

// Reserves one call. The call must match the grant on task, workspace, purpose and capability, carry the bound credential
// fingerprint, and fit under the ceiling. One call in flight at a time (the capture client is sequential).
function reserveCall(grant, call, now) {
  const blocked = gate(grant, now, 'reserve'); if (blocked) return blocked;
  if (grant.state !== 'ACTIVE') return rejected(grant, ['WRONG_STATE'], now);
  const shape = keysOk(call, ['taskId', 'workspaceId', 'purpose', 'capability', 'credentialFingerprint']);
  if (!shape.ok) return rejected(grant, [shape.unknown ? 'UNKNOWN_FIELD' : 'REQUEST_INVALID'], now);
  if (!safeEqualHex(call.credentialFingerprint, grant._internal.credentialFingerprint)) return rejected(grant, ['CREDENTIAL_SWAPPED'], now, { state: 'REVOKED', kind: 'grant.revoked', reason: 'CREDENTIAL_SWAPPED' });
  const errors = [];
  if (call.taskId !== grant.taskId) errors.push('WRONG_TASK');
  if (call.workspaceId !== grant.workspaceId) errors.push('WRONG_WORKSPACE');
  if (call.purpose !== grant.purpose) errors.push('WRONG_PURPOSE');
  if (call.capability !== grant.capability) errors.push('WRONG_CAPABILITY');
  if (grant.inFlight) errors.push('CALL_IN_FLIGHT');
  if (grant.callsUsed >= grant.maxCalls) errors.push('OVER_CEILING');
  if (errors.length) return rejected(grant, errors, now);
  const next = build({ ...grant, callsUsed: grant.callsUsed + 1, inFlight: true }, grant._internal);
  return done(grant, next, 'grant.call-reserved', now);
}

// Records what the reserved call returned and applies the A3 STOP rules: 401/403, 429, a non-privileged caller (a missing
// sourceAccess counts as non-privileged), three consecutive errors. Reaching the ceiling ends the grant as EXHAUSTED.
function recordCallOutcome(grant, outcome, now) {
  const blocked = gate(grant, now, 'outcome'); if (blocked) return blocked;
  if (grant.state !== 'ACTIVE') return rejected(grant, ['WRONG_STATE'], now);
  if (!grant.inFlight) return rejected(grant, ['NO_CALL_IN_FLIGHT'], now);
  const shape = keysOk(outcome, ['status'], ['sourceAccess']);
  const statusOk = shape.ok && (outcome.status === null || isInt(outcome.status, 100, 599));
  const accessOk = shape.ok && (outcome.sourceAccess === undefined || ['privileged', 'restricted'].includes(outcome.sourceAccess));
  if (!statusOk || !accessOk) return rejected(grant, ['OUTCOME_INVALID'], now);
  const stop = reason => rejected(grant, [reason], now, { state: 'STOPPED', kind: 'grant.stopped', reason });
  const status = outcome.status;
  if (status === 401 || status === 403) return stop('AUTH_REJECTED');
  if (status === 429) return stop('RATE_LIMITED');
  const success = status !== null && status >= 200 && status < 300;
  if (success && outcome.sourceAccess !== 'privileged') return stop('NOT_PRIVILEGED');
  const consecutive = success ? 0 : grant.consecutiveErrors + 1;
  if (consecutive >= LIMITS.maxConsecutiveErrors) return stop('THREE_CONSECUTIVE_ERRORS');
  if (grant.callsUsed >= grant.maxCalls) {
    const ended = terminate(build({ ...grant, consecutiveErrors: consecutive }, {}), 'EXHAUSTED', now, 'CEILING_REACHED');
    return done(grant, ended, 'grant.exhausted', now, ['CEILING_REACHED']);
  }
  return done(grant, build({ ...grant, consecutiveErrors: consecutive, inFlight: false }, grant._internal), 'grant.call-outcome', now);
}

function completeGrant(grant, now) {
  const blocked = gate(grant, now, 'complete'); if (blocked) return blocked;
  if (grant.state === 'PROPOSED') return rejected(grant, ['WRONG_STATE'], now);
  if (grant.inFlight) return rejected(grant, ['CALL_IN_FLIGHT'], now);
  return done(grant, terminate(grant, 'COMPLETED', now, 'TASK_COMPLETED'), 'grant.completed', now, ['TASK_COMPLETED']);
}
function stopGrant(grant, reason, now) {
  const blocked = gate(grant, now, 'stop'); if (blocked) return blocked;
  if (!STOP_REASONS.includes(reason)) return rejected(grant, ['REQUEST_INVALID'], now);
  return done(grant, terminate(grant, 'STOPPED', now, reason), 'grant.stopped', now, [reason]);
}
function revokeGrant(grant, now) {
  const blocked = gate(grant, now, 'revoke'); if (blocked) return blocked;
  return done(grant, terminate(grant, 'REVOKED', now, 'OWNER_REVOKED'), 'grant.revoked', now, ['OWNER_REVOKED']);
}
// Time passing: an expired grant becomes EXPIRED (success), a live one is returned unchanged.
function tickGrant(grant, now) {
  if (!isGrantObject(grant) || !nowOk(now)) return Object.freeze({ ok: false, errors: Object.freeze(['REQUEST_INVALID']), grant: grant || null, event: null, cleanup: null });
  if (TERMINAL.has(grant.state)) return Object.freeze({ ok: true, errors: Object.freeze([]), grant, event: null, cleanup: null });
  const expiry = expiryReason(grant, now);
  if (!expiry) return Object.freeze({ ok: true, errors: Object.freeze([]), grant, event: null, cleanup: null });
  return done(grant, terminate(grant, 'EXPIRED', now, expiry), 'grant.expired', now, [expiry]);
}

// ---------------------------------------------------------------- safe views and the participation-safe event schema
function toRecord(grant) {
  if (!isGrantObject(grant)) throw new Error('NOT_A_GRANT');
  const record = JSON.parse(JSON.stringify(grant));
  assertNoSecrets(record);
  return Object.freeze(record);
}
const EVENT_KEYS = Object.freeze(['schema', 'grantId', 'taskId', 'workspaceId', 'purpose', 'capability', 'kind', 'fromState', 'toState', 'at', 'reasonCodes', 'callsUsed', 'maxCalls', 'ownerAuthorizationId', 'credentialBound']);
function validateEvent(event) {
  const errors = [];
  const shape = keysOk(event, EVENT_KEYS);
  if (!shape.ok) return Object.freeze({ ok: false, errors: Object.freeze([shape.unknown ? 'UNKNOWN_FIELD' : 'REQUEST_INVALID']) });
  if (event.schema !== EVENT_SCHEMA || !EVENT_KINDS.includes(event.kind)) errors.push('REQUEST_INVALID');
  if (!RE.grantId.test(event.grantId) || !RE.taskId.test(event.taskId) || !RE.purpose.test(event.purpose) || !RE.uuid.test(event.workspaceId) || !CAPABILITIES.includes(event.capability)) errors.push('REQUEST_INVALID');
  if (!(event.fromState === null || STATES.includes(event.fromState)) || !STATES.includes(event.toState) || !isIso(event.at)) errors.push('REQUEST_INVALID');
  if (!Array.isArray(event.reasonCodes) || event.reasonCodes.some(code => !REASONS.includes(code))) errors.push('REQUEST_INVALID');
  if (!isInt(event.callsUsed, 0, LIMITS.maxCallCeiling) || !isInt(event.maxCalls, 1, LIMITS.maxCallCeiling) || event.callsUsed > event.maxCalls) errors.push('REQUEST_INVALID');
  if (!(event.ownerAuthorizationId === null || RE.authId.test(String(event.ownerAuthorizationId))) || typeof event.credentialBound !== 'boolean') errors.push('REQUEST_INVALID');
  if (scanForSecrets(event).length) errors.push('SECRET_DETECTED');
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze([...new Set(errors)]) });
}

module.exports = Object.freeze({
  VERSION, GRANT_SCHEMA, EVENT_SCHEMA, LIMITS, CAPABILITIES, STATES, TERMINAL_STATES: Object.freeze([...TERMINAL]), STOP_REASONS, REASONS, EVENT_KINDS, CLEANUP,
  proposeGrant, authorizeGrant, pairGrant, bindCredential, reserveCall, recordCallOutcome, completeGrant, stopGrant, revokeGrant, tickGrant,
  toRecord, validateEvent, scanForSecrets, redactSecrets, scanForLiterals, assertNoSecrets, fingerprintOf, sha256Hex
});
