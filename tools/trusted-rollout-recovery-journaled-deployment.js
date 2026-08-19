'use strict';

const authorizationModule = require('./trusted-rollout-recovery-deployment-authorization.js');

const JOURNAL_VERSION = 'sinbad-rollout-recovery-deployment-journal/4C-v1';
const RUNTIME_VERSION = 'sinbad-rollout-recovery-journaled-deployment/4C-v1';
const HASH = /^[a-f0-9]{64}$/u;

function create(options = {}) {
  const rawJournal = options.deploymentJournal;
  if (!rawJournal || rawJournal.version !== JOURNAL_VERSION || rawJournal.durable !== true || typeof rawJournal.begin !== 'function' || typeof rawJournal.settle !== 'function') throw new TypeError('An exact durable deployment journal is required');
  if (typeof options.deploy !== 'function') throw new TypeError('A trusted deployment function is required');
  const journal = Object.freeze({
    async begin(hash) {
      try { return await rawJournal.begin(hash); } catch { return null; }
    },
    async settle(hash, expected, state) {
      try { return await rawJournal.settle(hash, expected, state); } catch { return null; }
    },
  });

  const authorization = authorizationModule.create({
    ...options,
    async deploy(request) {
      if (!HASH.test(request?.authorizationHash || '')) return 'INVALID';
      const begun = await journal.begin(request.authorizationHash);
      if (begun?.status !== 'BEGUN') return 'INVALID';

      let providerState;
      try {
        providerState = await options.deploy(request);
      } catch {
        await journal.settle(request.authorizationHash, 'PENDING', 'UNKNOWN');
        return 'INVALID';
      }
      if (!['APPLIED', 'REJECTED'].includes(providerState)) {
        await journal.settle(request.authorizationHash, 'PENDING', 'UNKNOWN');
        return 'INVALID';
      }
      const settled = await journal.settle(request.authorizationHash, 'PENDING', providerState);
      return settled?.status === 'SETTLED' ? providerState : 'INVALID';
    },
  });
  return Object.freeze({ version: RUNTIME_VERSION, issue: authorization.issue, execute: authorization.execute });
}

module.exports = Object.freeze({ JOURNAL_VERSION, RUNTIME_VERSION, create });
