'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const release = require('./verify-rollout-recovery-release.js');

const EVIDENCE_VERSION = 'sinbad-rollout-recovery-release-evidence/3Y-v1';
const COMMIT = /^[a-f0-9]{40}$/u;
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const blocked = (reasonCode) => Object.freeze({
  version: EVIDENCE_VERSION,
  status: 'RELEASE_EVIDENCE_BLOCKED',
  reasonCode,
});

function readGitState(git) {
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
  return { commit };
}

function readManifestHash(manifestPath) {
  try {
    return sha256(fs.readFileSync(manifestPath, 'utf8').replace(/\r\n/g, '\n'));
  } catch {
    return null;
  }
}

function create(options = {}) {
  const root = options.root || path.resolve(__dirname, '..');
  const verify = options.verify || (() => release.run({ root }));
  const git = options.git || ((args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }));
  const manifestPath = path.join(root, 'supabase', 'rollout-recovery-migration-manifest.json');
  const before = readGitState(git);
  if (before.error) return blocked(before.error);
  const manifestHash = readManifestHash(manifestPath);
  if (!manifestHash) return blocked('MANIFEST_UNAVAILABLE');

  let checked;
  try {
    checked = verify();
  } catch {
    return blocked('RELEASE_VERIFICATION_EXCEPTION');
  }
  if (checked?.status !== 'ROLLOUT_RECOVERY_RELEASE_VERIFIED' || checked.reasonCode !== null) {
    return blocked(String(checked?.reasonCode || 'RELEASE_NOT_VERIFIED'));
  }

  const after = readGitState(git);
  if (after.error) return blocked(after.error);
  if (after.commit !== before.commit) return blocked('COMMIT_CHANGED');
  if (readManifestHash(manifestPath) !== manifestHash) return blocked('MANIFEST_CHANGED');

  const payload = {
    version: EVIDENCE_VERSION,
    status: 'RELEASE_EVIDENCE_VERIFIED',
    reasonCode: null,
    commit: before.commit,
    manifestHash,
    databaseFingerprint: 'sinbad-rollout-recovery-db/3U-20260820-v1',
    migrationCount: checked.migrationCount,
    testCount: checked.testCount,
  };
  return Object.freeze({ ...payload, evidenceHash: sha256(JSON.stringify(payload)) });
}

if (require.main === module) {
  const output = create();
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exitCode = output.status === 'RELEASE_EVIDENCE_VERIFIED' ? 0 : 1;
}

module.exports = Object.freeze({ EVIDENCE_VERSION, create });
