'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const verifier = require('../adapters/supabase-rollout-recovery-deployment-reconciliation-audit-verifier.js');

function row(id, overrides = {}) { const value = { id, actor_hash: 'a'.repeat(64), authorization_hash: 'b'.repeat(64), purpose_hash: 'c'.repeat(64), decision: 'AUTHORIZED', decided_at_ms: 1000 + id, ...overrides }; value.event_hash = createHash('sha256').update([verifier.EVENT_VERSION, value.actor_hash, value.authorization_hash, value.purpose_hash, value.decision, value.decided_at_ms].join('\n')).digest('hex'); return value; }
function create(pages, overrides = {}) { let page = 0; return verifier.create({ serviceRole: true, client: { async rpc(name) { if (name.startsWith('verify_')) return { data: overrides.capability ?? true, error: null }; if (overrides.error) return { data: null, error: {} }; return { data: pages[page++] ?? [], error: null }; } } }); }

test('scans verified descending pages into a content-free summary', async () => {
  const result = await create([[row(3), row(2)], [row(1)], []]).scan({ pageSize: 2, maxEvents: 10 });
  assert.deepEqual(result, { version: verifier.VERIFIER_VERSION, status: 'AUDIT_SCAN_COMPLETE', reasonCode: null, eventCount: 3, pageCount: 3, watermarkId: 3 });
  assert.equal('events' in result, false);
  assert.ok(Object.isFrozen(result));
});

test('tampering ordering capability outage and bounds fail closed', async () => {
  const tampered = row(1); tampered.event_hash = 'd'.repeat(64);
  assert.equal((await create([[tampered]]).scan({ pageSize: 1, maxEvents: 2 })).status, 'AUDIT_SCAN_INTEGRITY_FAILED');
  assert.equal((await create([[row(2), row(3)]]).scan({ pageSize: 2, maxEvents: 4 })).reasonCode, 'AUDIT_ORDER_INVALID');
  assert.equal((await create([], { capability: false }).scan()).reasonCode, 'AUDIT_CAPABILITY_DENIED');
  assert.equal((await create([], { error: true }).scan()).reasonCode, 'AUDIT_STORE_UNAVAILABLE');
  assert.equal((await create([]).scan({ pageSize: 0, maxEvents: 1 })).reasonCode, 'AUDIT_INVALID_SCAN_ARGS');
  assert.equal((await create([[row(2), row(1)]]).scan({ pageSize: 2, maxEvents: 2 })).status, 'AUDIT_SCAN_INCOMPLETE');
});

test('migration exposes only service-role verification and descending pages', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20260823_rollout_recovery_deployment_reconciliation_audit_verification.sql'), 'utf8');
  for (const pattern of [/^begin;/iu, /auth\.role\(\)<>'service_role'/iu, /order by a\.id desc/iu, /limit least\(greatest/iu, /revoke all on function public\.list_rollout_recovery_deployment_reconciliation_audit/iu, /grant execute on function public\.verify_rollout_recovery_deployment_reconciliation_audit_access\(\) to service_role/iu, /commit;/iu]) assert.match(sql, pattern);
});
