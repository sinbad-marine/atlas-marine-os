'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {recordHealth} = require('../tools/argos-record-health');
const shelfApi = require('../sinbad-ai-core/argos-event-shelf');
const health = require('../sinbad-ai-core/argos-health-contracts');
const NOW = '2026-09-02T20:00:00.000Z';
function workspace(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'argos-record-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  return root;
}

test('missing evidence reaches supervisor, persistent open incident and failed terminal result', t => {
  const root = workspace(t);
  const result = recordHealth({root, observations: [], now: NOW, runId: 'missing-evidence'});
  assert.equal(result.assessment, 'ARGOS_RELEASE_HEALTH_BLOCKED');
  assert.equal(result.snapshot.runs[0].state, 'FAILED');
  assert.equal(result.snapshot.incidents[0].state, 'OPEN');
  assert.equal(result.authority, 'NONE');
  const disk = shelfApi.create({root: path.join(root, result.runId), shelfId: 'health', maxEvents: 100}).inspect();
  assert.equal(disk.entries.filter(x => x.kind === 'HEALTH_OBSERVED').length, 7);
  assert.equal(disk.headHash, result.snapshot.headHash);
  assert.throws(() => recordHealth({root, observations: [], now: NOW, runId: result.runId}), /EEXIST/);
});

test('fully healthy synthetic observations finish without an incident but grant no authority', t => {
  const observations = health.COMPONENTS.map(component => health.observe({component, state: 'HEALTHY',
    observedAt: NOW, validUntil: '2026-09-02T20:05:00.000Z', reasonCode: null, evidenceHash: 'a'.repeat(64)}));
  const result = recordHealth({root: workspace(t), observations, now: NOW, runId: 'synthetic-healthy'});
  assert.equal(result.snapshot.runs[0].state, 'PASSED');
  assert.equal(result.snapshot.incidents.length, 0);
  assert.equal(result.authority, 'NONE');
});

test('invalid observations and escaping run IDs cannot create a run', t => {
  const root = workspace(t);
  assert.throws(() => recordHealth({root, observations: [{}], now: NOW, runId: 'invalid'}), /OBSERVATIONS_INVALID/);
  assert.throws(() => recordHealth({root, observations: [], now: NOW, runId: '..'}));
  assert.throws(() => recordHealth({root, observations: [], now: NOW, runId: '../escape'}), /INPUT_INVALID/);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('CLI record mode persists a failed run while retaining nonzero exit status', t => {
  const root = workspace(t);
  const env = {...process.env};
  for (const key of Object.keys(env)) if (key.startsWith('ARGOS_')) delete env[key];
  env.ARGOS_HEALTH_LEDGER_ROOT = root;
  const script = path.resolve(__dirname, '../tools/run-argos-health.js');
  const result = spawnSync(process.execPath, ['-e',
    `process.argv.push('--record');globalThis.fetch=async()=>({ok:true,status:200});require(${JSON.stringify(script)})`],
    {env, encoding: 'utf8', timeout: 10000});
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.recording.snapshot.runs[0].state, 'FAILED');
  assert.equal(output.recording.snapshot.incidents[0].state, 'OPEN');
});
