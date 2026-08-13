'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const producer = require('../../tools/create-rollout-recovery-release-evidence.js');
const verifier = require('../../tools/verify-rollout-recovery-release-evidence.js');

const root = path.resolve(__dirname, '../..');
const commit = 'a'.repeat(40);
const git = (args) => ({ status: 0, stdout: args[0] === 'status' ? '' : `${commit}\n` });
const evidence = () => producer.create({
  root,
  git,
  verify: () => ({ status: 'ROLLOUT_RECOVERY_RELEASE_VERIFIED', reasonCode: null, migrationCount: 8, testCount: 63 }),
});

test('accepts exact evidence bound to the current clean commit and manifest', () => {
  const value = verifier.verify(evidence(), { root, git });
  assert.deepEqual(value, {
    version: verifier.VERIFIER_VERSION,
    status: 'RELEASE_EVIDENCE_VALID',
    reasonCode: null,
    commit,
  });
  assert.ok(Object.isFrozen(value));
});

test('tampered fields and additional fields fail closed', () => {
  const valid = evidence();
  for (const changed of [
    { ...valid, testCount: valid.testCount + 1 },
    { ...valid, databaseFingerprint: 'stale' },
    { ...valid, unexpected: true },
  ]) assert.equal(verifier.verify(changed, { root, git }).status, 'RELEASE_EVIDENCE_INVALID');
});

test('commit mismatch dirty worktree and unavailable Git fail closed', () => {
  const valid = evidence();
  const cases = [
    [args => ({ status: 0, stdout: args[0] === 'status' ? '' : `${'b'.repeat(40)}\n` }), 'COMMIT_MISMATCH'],
    [args => ({ status: 0, stdout: args[0] === 'status' ? ' M file' : `${commit}\n` }), 'WORKTREE_DIRTY'],
    [() => ({ status: 1, stdout: '' }), 'GIT_UNAVAILABLE'],
  ];
  for (const [mock, reason] of cases) assert.equal(verifier.verify(valid, { root, git: mock }).reasonCode, reason);
});

test('malformed and blocked producer records are rejected without Git access', () => {
  for (const value of [null, [], {}, { version: producer.EVIDENCE_VERSION, status: 'RELEASE_EVIDENCE_BLOCKED' }]) {
    let calls = 0;
    const checked = verifier.verify(value, { git: () => { calls += 1; return { status: 0, stdout: '' }; } });
    assert.equal(checked.status, 'RELEASE_EVIDENCE_INVALID');
    assert.equal(calls, 0);
  }
});

test('local commit changes during verification fail closed', () => {
  let heads = 0;
  const changingGit = (args) => ({
    status: 0,
    stdout: args[0] === 'status' ? '' : `${heads++ === 0 ? commit : 'b'.repeat(40)}\n`,
  });
  assert.equal(verifier.verify(evidence(), { root, git: changingGit }).reasonCode, 'LOCAL_STATE_CHANGED');
});
