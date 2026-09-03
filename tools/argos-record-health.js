'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const shelfApi = require('../sinbad-ai-core/argos-event-shelf');
const ledgerApi = require('../sinbad-ai-core/argos-operations-ledger');
const {supervise} = require('../sinbad-ai-core/argos-supervisor');
const {assess} = require('../sinbad-ai-core/argos-health-contracts');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

// This records local observations, not authenticated Owner approval or release authority.
function recordHealth({root, observations, now, runId = `health-${crypto.randomUUID()}`}) {
  if (!path.isAbsolute(root) || !/^[a-z0-9](?:[a-z0-9._-]{0,68}[a-z0-9])?$/.test(runId)) throw new Error('ARGOS_RECORD_INPUT_INVALID');
  const assessment = assess(observations, now);
  if (assessment.status === 'ARGOS_HEALTH_BLOCKED') throw new Error('ARGOS_RECORD_OBSERVATIONS_INVALID');
  // Reject linked ancestors and refuse to reuse a run directory.
  let ancestor = path.resolve(root);
  while (true) {
    if (fs.existsSync(ancestor) && fs.lstatSync(ancestor).isSymbolicLink()) throw new Error('ARGOS_RECORD_LINK_BLOCKED');
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  fs.mkdirSync(root, {recursive: true});
  const runRoot = path.join(root, runId);
  fs.mkdirSync(runRoot);
  const shelf = shelfApi.create({root: runRoot, shelfId: 'health', maxEvents: 100});
  const ledger = ledgerApi.create({shelf});
  const started = ledger.startRun({runId, startedAt: now, scopeHash: hash(observations)});
  if (started.status === 'ARGOS_OPERATION_BLOCKED') throw new Error(started.reasonCode);
  try {
    const result = supervise({runId, now, observations, shelf,
      agentEnvelopeHash: hash({actor: 'argos-health-cli', trust: 'LOCAL_UNAUTHENTICATED_OBSERVER'})});
    if (result.status === 'ARGOS_SUPERVISION_BLOCKED') throw new Error(result.reasonCode);
    if (assessment.status !== 'ARGOS_SYSTEM_HEALTHY') {
      const incident = ledger.openIncident({incidentId: `${runId}-incident`, openedAt: now, evidenceHash: hash(assessment)});
      if (incident.status === 'ARGOS_OPERATION_BLOCKED') throw new Error(incident.reasonCode);
    }
    const terminal = ledger.finishRun({runId, finishedAt: now,
      outcome: assessment.status === 'ARGOS_SYSTEM_HEALTHY' ? 'PASSED' : 'FAILED', evidenceHash: hash(assessment)});
    if (terminal.status === 'ARGOS_OPERATION_BLOCKED') throw new Error(terminal.reasonCode);
    return {runId, assessment: assessment.status, notification: 'LOCAL_REVIEW_REQUIRED_NO_MESSAGE_SENT',
      authority: 'NONE', snapshot: ledger.snapshot()};
  } catch (error) {
    ledger.finishRun({runId, finishedAt: now, outcome: 'FAILED', evidenceHash: hash('RECORDING_FAILED')});
    throw error;
  }
}

module.exports = Object.freeze({recordHealth});
