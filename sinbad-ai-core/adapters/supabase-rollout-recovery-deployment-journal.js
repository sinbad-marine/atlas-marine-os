'use strict';

const JOURNAL_VERSION = 'sinbad-rollout-recovery-deployment-journal/4C-v1';
const HASH = /^[a-f0-9]{64}$/u;
const STATES = new Set(['PENDING', 'APPLIED', 'REJECTED', 'UNKNOWN']);
const output = (status, state = null) => Object.freeze({ status, state });

function create(options = {}) {
  if (!options.client || typeof options.client.rpc !== 'function' || options.serviceRole !== true) throw new TypeError('A trusted Supabase service-role client is required');
  const rpc = options.client.rpc.bind(options.client);
  return Object.freeze({
    version: JOURNAL_VERSION,
    durable: true,
    async begin(hash) {
      if (!HASH.test(hash || '')) return output('INVALID');
      try {
        const { data, error } = await rpc('begin_rollout_recovery_deployment', { p_authorization_hash: hash });
        return !error && ['BEGUN', 'EXISTS', 'DENIED'].includes(data) ? output(data) : output('UNAVAILABLE');
      } catch { return output('UNAVAILABLE'); }
    },
    async settle(hash, expected, state) {
      if (!HASH.test(hash || '') || !['PENDING', 'UNKNOWN'].includes(expected) || !['APPLIED', 'REJECTED', 'UNKNOWN'].includes(state) || (expected === 'UNKNOWN' && state === 'UNKNOWN')) return output('INVALID');
      try {
        const { data, error } = await rpc('settle_rollout_recovery_deployment', { p_authorization_hash: hash, p_expected_status: expected, p_status: state });
        return !error && ['SETTLED', 'ALREADY_SETTLED', 'CONFLICT', 'DENIED'].includes(data) ? output(data) : output('UNAVAILABLE');
      } catch { return output('UNAVAILABLE'); }
    },
    async inspect(hash) {
      if (!HASH.test(hash || '')) return output('INVALID');
      try {
        const { data, error } = await rpc('inspect_rollout_recovery_deployment', { p_authorization_hash: hash });
        if (error || !Array.isArray(data)) return output('UNAVAILABLE');
        if (data.length === 0) return output('ABSENT');
        if (data.length !== 1) return output('UNAVAILABLE');
        const row = data[0];
        const status = String(row?.status || '');
        const startedAt = String(row?.started_at || '');
        const updatedAt = String(row?.updated_at || '');
        if (!STATES.has(status) || !Number.isFinite(Date.parse(startedAt)) || !Number.isFinite(Date.parse(updatedAt)) || Date.parse(updatedAt) < Date.parse(startedAt)) return output('UNAVAILABLE');
        return output('FOUND', Object.freeze({ status, startedAt, updatedAt }));
      } catch { return output('UNAVAILABLE'); }
    },
  });
}

module.exports = Object.freeze({ JOURNAL_VERSION, create });
