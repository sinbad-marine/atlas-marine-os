'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { EVIDENCE_VERSION } = require('./create-rollout-recovery-release-evidence.js');

const VERIFIER_VERSION = 'sinbad-rollout-recovery-release-evidence-verifier/3Z-v1';
const DATABASE_FINGERPRINT = 'sinbad-rollout-recovery-db/3U-20260820-v1';
const COMMIT = /^[a-f0-9]{40}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const KEYS = Object.freeze([
  'commit', 'databaseFingerprint', 'evidenceHash', 'manifestHash',
  'migrationCount', 'reasonCode', 'status', 'testCount', 'version',
]);
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const result = (status, reasonCode, commit = null) => Object.freeze({
  version: VERIFIER_VERSION,
  status,
  reasonCode,
  commit,
});
const blocked = (reasonCode) => result('RELEASE_EVIDENCE_INVALID', reasonCode);

function localState(root, git) {
  let status;
  let head;
  try {
    status = git(['status', '--porcelain']);
    head = git(['rev-parse', 'HEAD']);
  } catch {
    return { error: 'GIT_UNAVAILABLE' };
  }
  if (status?.status !== 0 || head?.status !== 0) return { error: 'GIT_UNAVAILABLE' };
  if (String(status.stdout || '') !== '') return { error: 'WORKTREE_DIRTY' };
  const commit = String(head.stdout || '').trim();
  if (!COMMIT.test(commit)) return { error: 'COMMIT_INVALID' };
  let manifestHash;
  try {
    const manifest = fs.readFileSync(
      path.join(root, 'supabase', 'rollout-recovery-migration-manifest.json'),
      'utf8',
    ).replace(/\r\n/g, '\n');
    manifestHash = sha256(manifest);
  } catch {
    return { error: 'MANIFEST_UNAVAILABLE' };
  }
  return { commit, manifestHash };
}

function verify(evidence, options = {}) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return blocked('EVIDENCE_INVALID');
  if (Object.keys(evidence).sort().join('|') !== [...KEYS].sort().join('|')) return blocked('EVIDENCE_SCHEMA_INVALID');
  if (evidence.version !== EVIDENCE_VERSION || evidence.status !== 'RELEASE_EVIDENCE_VERIFIED' || evidence.reasonCode !== null) return blocked('EVIDENCE_CONTRACT_INVALID');
  if (!COMMIT.test(evidence.commit) || !HASH.test(evidence.manifestHash) || !HASH.test(evidence.evidenceHash)) return blocked('EVIDENCE_FORMAT_INVALID');
  if (evidence.databaseFingerprint !== DATABASE_FINGERPRINT) return blocked('DATABASE_FINGERPRINT_MISMATCH');
  if (!Number.isSafeInteger(evidence.migrationCount) || evidence.migrationCount < 1 || !Number.isSafeInteger(evidence.testCount) || evidence.testCount < 1) return blocked('EVIDENCE_COUNTS_INVALID');

  const payload = {
    version: evidence.version,
    status: evidence.status,
    reasonCode: evidence.reasonCode,
    commit: evidence.commit,
    manifestHash: evidence.manifestHash,
    databaseFingerprint: evidence.databaseFingerprint,
    migrationCount: evidence.migrationCount,
    testCount: evidence.testCount,
  };
  if (sha256(JSON.stringify(payload)) !== evidence.evidenceHash) return blocked('EVIDENCE_HASH_MISMATCH');

  const root = options.root || path.resolve(__dirname, '..');
  const git = options.git || ((args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }));
  const local = localState(root, git);
  if (local.error) return blocked(local.error);
  if (local.commit !== evidence.commit) return blocked('COMMIT_MISMATCH');
  if (local.manifestHash !== evidence.manifestHash) return blocked('MANIFEST_MISMATCH');
  const after = localState(root, git);
  if (after.error) return blocked(after.error);
  if (after.commit !== local.commit || after.manifestHash !== local.manifestHash) return blocked('LOCAL_STATE_CHANGED');
  return result('RELEASE_EVIDENCE_VALID', null, evidence.commit);
}

function readEvidence(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

if (require.main === module) {
  const filePath = process.argv[2];
  const output = filePath ? verify(readEvidence(path.resolve(filePath))) : blocked('EVIDENCE_FILE_REQUIRED');
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exitCode = output.status === 'RELEASE_EVIDENCE_VALID' ? 0 : 1;
}

module.exports = Object.freeze({ VERIFIER_VERSION, verify });
