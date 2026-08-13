'use strict';

const journalModule = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-journal.js');

const RECONCILIATION_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation/4E-v1';
const EXPECTED_JOURNAL_VERSION = 'sinbad-rollout-recovery-deployment-journal/4C-v1';
const HASH = /^[a-f0-9]{64}$/u;
const reconciling = new Set();

if (journalModule.JOURNAL_VERSION !== EXPECTED_JOURNAL_VERSION) throw new Error(`Unsupported journal version: ${journalModule.JOURNAL_VERSION}`);

const result = (status, reasonCode, authorizationHash = null) => Object.freeze({
  version: RECONCILIATION_VERSION,
  status,
  reasonCode,
  authorizationHash: HASH.test(authorizationHash || '') ? authorizationHash : null,
});

function create(options = {}) {
  const journal = options.deploymentJournal;
  if (!journal || journal.version !== EXPECTED_JOURNAL_VERSION || journal.durable !== true || typeof journal.inspect !== 'function' || typeof journal.settle !== 'function') throw new TypeError('A trusted durable deploymentJournal is required');
  if (typeof options.resolve !== 'function') throw new TypeError('A trusted side-effect-free resolve function is required');
  if (options.diagnose !== undefined && typeof options.diagnose !== 'function') throw new TypeError('diagnose must be a function');
  const timeoutMs = Number(options.reconciliationTimeoutMs);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new TypeError('A bounded reconciliation timeout is required');
  const diagnose = typeof options.diagnose === 'function' ? options.diagnose : () => {};

  function diagnostic(code) { try { diagnose(Object.freeze({ version: RECONCILIATION_VERSION, code })); } catch {} }
  async function inspect(hash) { try { return await journal.inspect(hash); } catch { return { status: 'UNAVAILABLE', state: null }; } }
  async function bounded(hash) {
    let timer;
    try {
      const timeout = Symbol('timeout');
      const value = await Promise.race([
        Promise.resolve().then(() => options.resolve(Object.freeze({ authorizationHash: hash }))),
        new Promise(resolve => { timer = setTimeout(() => resolve(timeout), timeoutMs); }),
      ]);
      return value === timeout ? { status: 'TIMEOUT' } : { status: 'VALUE', value };
    } catch { return { status: 'ERROR' }; }
    finally { if (timer !== undefined) clearTimeout(timer); }
  }
  async function settle(hash, expected, state) {
    let value;
    try { value = await journal.settle(hash, expected, state); } catch { return 'UNAVAILABLE'; }
    if (value?.status === 'SETTLED') return 'SETTLED';
    if (value?.status === 'CONFLICT') return 'CONFLICT';
    if (value?.status !== 'ALREADY_SETTLED') return 'UNAVAILABLE';
    const observed = await inspect(hash);
    return observed?.status === 'FOUND' && observed.state?.status === state ? 'SETTLED' : 'CONFLICT';
  }

  return Object.freeze({
    version: RECONCILIATION_VERSION,
    async reconcile(authorizationHash) {
      if (!HASH.test(authorizationHash || '')) return result('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_BLOCKED', 'RECONCILIATION_HASH_INVALID');
      if (reconciling.has(authorizationHash)) return result('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_BLOCKED', 'RECONCILIATION_IN_PROGRESS', authorizationHash);
      reconciling.add(authorizationHash);
      try {
        const observed = await inspect(authorizationHash);
        if (observed?.status !== 'FOUND') return result('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_BLOCKED', observed?.status === 'ABSENT' ? 'DEPLOYMENT_NOT_FOUND' : 'DEPLOYMENT_JOURNAL_UNAVAILABLE', authorizationHash);
        const current = observed.state?.status;
        if (current === 'APPLIED') return result('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_APPLIED', null, authorizationHash);
        if (current === 'REJECTED') return result('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_REJECTED', null, authorizationHash);
        if (!['PENDING', 'UNKNOWN'].includes(current)) return result('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_BLOCKED', 'DEPLOYMENT_JOURNAL_INVALID', authorizationHash);

        const provider = await bounded(authorizationHash);
        if (provider.status !== 'VALUE') {
          diagnostic(provider.status === 'TIMEOUT' ? 'RECONCILIATION_TIMEOUT' : 'RECONCILIATION_EXCEPTION');
          return result('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_UNSETTLED', 'PROVIDER_OUTCOME_UNKNOWN', authorizationHash);
        }
        if (provider.value === 'PENDING') return result('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_UNSETTLED', 'PROVIDER_PENDING', authorizationHash);
        if (!['APPLIED', 'REJECTED'].includes(provider.value)) {
          diagnostic('RECONCILIATION_INVALID');
          return result('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_UNSETTLED', 'PROVIDER_OUTCOME_INVALID', authorizationHash);
        }
        const settlement = await settle(authorizationHash, current, provider.value);
        if (settlement !== 'SETTLED') {
          const conflict = settlement === 'CONFLICT';
          diagnostic(conflict ? 'RECONCILIATION_JOURNAL_CONFLICT' : 'RECONCILIATION_SETTLEMENT_FAILED');
          return result('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_UNSETTLED', conflict ? 'DEPLOYMENT_JOURNAL_CONFLICT' : 'DEPLOYMENT_JOURNAL_SETTLEMENT_REQUIRED', authorizationHash);
        }
        return result(provider.value === 'APPLIED' ? 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_APPLIED' : 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_REJECTED', null, authorizationHash);
      } finally { reconciling.delete(authorizationHash); }
    },
  });
}

module.exports = Object.freeze({ RECONCILIATION_VERSION, EXPECTED_JOURNAL_VERSION, create });
