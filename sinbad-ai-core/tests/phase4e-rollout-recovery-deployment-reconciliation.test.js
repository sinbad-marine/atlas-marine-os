'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const reconciliation = require('../../tools/trusted-rollout-recovery-deployment-reconciliation.js');

const hash = 'c'.repeat(64);
function journal(status = 'UNKNOWN', overrides = {}) { return { version: reconciliation.EXPECTED_JOURNAL_VERSION, durable: true, inspect: async () => ({ status: 'FOUND', state: { status } }), settle: async () => ({ status: 'SETTLED' }), ...overrides }; }
function create(overrides = {}) { return reconciliation.create({ deploymentJournal: journal(), resolve: async () => 'PENDING', reconciliationTimeoutMs: 1000, ...overrides }); }

test('requires exact bounded dependencies and exposes a frozen minimal API', () => {
  assert.throws(() => reconciliation.create(), /deploymentJournal/u);
  assert.throws(() => create({ deploymentJournal: journal('UNKNOWN', { inspect: null }) }), /deploymentJournal/u);
  assert.throws(() => create({ resolve: null }), /resolve/u);
  assert.throws(() => create({ reconciliationTimeoutMs: 999 }), /timeout/u);
  const value = create();
  assert.deepEqual(Object.keys(value), ['version', 'reconcile']);
  assert.ok(Object.isFrozen(value));
});

test('returns terminal journal states without querying provider', async () => {
  for (const [state, status] of [['APPLIED', 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_APPLIED'], ['REJECTED', 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_REJECTED']]) {
    let resolves = 0;
    const value = create({ deploymentJournal: journal(state), resolve: async () => { resolves++; return 'APPLIED'; } });
    assert.equal((await value.reconcile(hash)).status, status);
    assert.equal(resolves, 0);
  }
});

test('resolves pending and unknown with monotonic settlement only', async () => {
  for (const [current, provider, status] of [['PENDING', 'APPLIED', 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_APPLIED'], ['UNKNOWN', 'REJECTED', 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_REJECTED']]) {
    const calls = [];
    const value = create({ deploymentJournal: journal(current, { settle: async (...args) => { calls.push(args); return { status: 'SETTLED' }; } }), resolve: async input => { calls.push([input]); return provider; } });
    assert.equal((await value.reconcile(hash)).status, status);
    assert.deepEqual(calls[1], [hash, current, provider]);
    assert.ok(Object.isFrozen(calls[0][0]));
  }
});

test('absence outage invalid provider and settlement failure fail closed', async () => {
  const cases = [[journal('UNKNOWN', { inspect: async () => ({ status: 'ABSENT', state: null }) }), async () => 'APPLIED', 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_BLOCKED'], [journal('UNKNOWN', { inspect: async () => ({ status: 'UNAVAILABLE', state: null }) }), async () => 'APPLIED', 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_BLOCKED'], [journal(), async () => 'OTHER', 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_UNSETTLED'], [journal('UNKNOWN', { settle: async () => ({ status: 'CONFLICT' }) }), async () => 'APPLIED', 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_UNSETTLED']];
  for (const [deploymentJournal, resolve, status] of cases) assert.equal((await create({ deploymentJournal, resolve }).reconcile(hash)).status, status);
  assert.equal((await create().reconcile('bad')).reasonCode, 'RECONCILIATION_HASH_INVALID');
});

test('ALREADY_SETTLED requires inspection of the identical terminal state', async () => {
  for (const [terminal, status] of [['APPLIED', 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_APPLIED'], ['REJECTED', 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_UNSETTLED']]) {
    let inspections = 0;
    const value = create({ deploymentJournal: journal('UNKNOWN', { inspect: async () => ({ status: 'FOUND', state: { status: inspections++ === 0 ? 'UNKNOWN' : terminal } }), settle: async () => ({ status: 'ALREADY_SETTLED' }) }), resolve: async () => 'APPLIED' });
    assert.equal((await value.reconcile(hash)).status, status);
  }
});

test('concurrent adapters perform one provider query for the same hash', async () => {
  let finish;
  let resolves = 0;
  const wait = new Promise(resolve => { finish = resolve; });
  const resolve = async () => { resolves++; await wait; return 'APPLIED'; };
  const first = create({ resolve }).reconcile(hash);
  const second = create({ resolve }).reconcile(hash);
  finish();
  const results = await Promise.all([first, second]);
  assert.equal(resolves, 1);
  assert.equal(results.filter(value => value.status === 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_APPLIED').length, 1);
  assert.equal(results.filter(value => value.reasonCode === 'RECONCILIATION_IN_PROGRESS').length, 1);
});

test('provider timeout and exception remain unsettled without journal settlement', async () => {
  for (const resolve of [async () => { throw new Error('offline'); }, async () => new Promise(() => {})]) {
    let settlements = 0;
    const value = create({ deploymentJournal: journal('UNKNOWN', { settle: async () => { settlements++; return { status: 'SETTLED' }; } }), resolve });
    const result = await value.reconcile(hash);
    assert.equal(result.status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_UNSETTLED');
    assert.equal(result.reasonCode, 'PROVIDER_OUTCOME_UNKNOWN');
    assert.equal(settlements, 0);
  }
});
