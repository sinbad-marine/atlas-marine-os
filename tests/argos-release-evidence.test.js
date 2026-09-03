'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const {probeReleaseEvidence} = require('../tools/argos-release-evidence');
const NOW = new Date('2026-09-03T00:00:00.000Z');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'argos-release-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const git = args => cp.execFileSync('git', args, {cwd: root, encoding: 'utf8', windowsHide: true});
  git(['init', '-q']);
  fs.writeFileSync(path.join(root, 'source'), 'original');
  git(['add', 'source']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
  const ref = git(['rev-parse', 'HEAD']).trim();
  const run = {id: 10, run_number: 2, run_attempt: 1, head_sha: ref, path: '.github/workflows/pages-release.yml',
    repository: {full_name: 'owner/repo'}, head_repository: {full_name: 'owner/repo'},
    event: 'push', head_branch: 'main', status: 'completed', conclusion: 'success', updated_at: '2026-09-02T23:59:00Z'};
  const names = ['ARGOS integrity gate', 'Run complete regression suite', 'Run desktop mobile and WCAG browser tests',
    'Build allowlisted Pages artifact', 'Attest release manifest', 'Upload Pages artifact'];
  const step = name => ({name, status: 'completed', conclusion: 'success'});
  const job = (name, steps) => ({name, run_id: 10, run_attempt: 1, head_sha: ref, status: 'completed', conclusion: 'success', steps});
  const data = {total_count: 2, jobs: [job('build', names.map(step)), job('deploy', [step('Deploy approved artifact')])]};
  let calls = 0;
  const input = {owner: 'owner', repo: 'repo', ref, root, clock: () => NOW,
    fetcher: async (url, options) => {
      calls++;
      assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      assert.ok(url.startsWith('https://api.github.com/repos/owner/repo/actions/'));
      const payload = url.includes('/workflows/') ? {total_count: 1, workflow_runs: [run]} : url.includes('/jobs?') ? data : run;
      return {ok: true, status: 200, json: async () => structuredClone(payload)};
    }};
  return {root, ref, run, data, input, calls: () => calls};
}

test('exact clean source and completed protected workflow produce bounded historical evidence', async t => {
  const f = fixture(t);
  const result = await probeReleaseEvidence(f.input);
  assert.deepEqual(result.map(x => [x.component, x.state]), [['TEST_SUITE', 'HEALTHY'], ['RELEASE_PIPELINE', 'HEALTHY']]);
  assert.equal(f.calls(), 3);
  assert.ok(result.every(x => x.evidenceHash.length === 64));
});

test('dirty source and ref mismatch are rejected before any network call', async t => {
  const f = fixture(t);
  assert.equal((await probeReleaseEvidence({...f.input, ref: 'f'.repeat(40)}))[0].reasonCode, 'RELEASE_CHECKOUT_MISMATCH');
  fs.writeFileSync(path.join(f.root, 'source'), 'changed');
  assert.equal((await probeReleaseEvidence(f.input))[0].reasonCode, 'RELEASE_CHECKOUT_MISMATCH');
  assert.equal(f.calls(), 0);
});

test('wrong repository, wrong source, dispatch and stale evidence remain unknown', async t => {
  const f = fixture(t), original = structuredClone(f.run);
  for (const change of [{head_sha: 'a'.repeat(40)}, {head_repository: {full_name: 'fork/repo'}},
    {path: '.github/workflows/other.yml'}, {event: 'workflow_dispatch'}, {updated_at: '2026-09-01T00:00:00Z'}]) {
    Object.assign(f.run, original, change);
    assert.equal((await probeReleaseEvidence(f.input))[0].state, 'UNKNOWN');
  }
});

test('failed run and skipped or missing required jobs never become healthy', async t => {
  const f = fixture(t);
  f.run.conclusion = 'failure';
  assert.equal((await probeReleaseEvidence(f.input))[0].state, 'DEGRADED');
  f.run.conclusion = 'success';
  f.data.jobs[0].steps[1].conclusion = 'skipped';
  assert.equal((await probeReleaseEvidence(f.input))[0].reasonCode, 'RELEASE_REQUIRED_STEP_MISSING');
  f.data.jobs[0].steps[1].conclusion = 'success';
  f.data.jobs[1].run_attempt = 2;
  assert.equal((await probeReleaseEvidence(f.input))[0].reasonCode, 'RELEASE_JOB_BINDING_INVALID');
});

test('concurrent source edit and rerun invalidate already collected evidence', async t => {
  const f = fixture(t), fetcher = f.input.fetcher;
  f.input.fetcher = async (url, options) => {
    if (url.includes('/jobs?')) fs.writeFileSync(path.join(f.root, 'source'), 'changed');
    return fetcher(url, options);
  };
  assert.equal((await probeReleaseEvidence(f.input))[0].reasonCode, 'RELEASE_CHECKOUT_CHANGED');
  fs.writeFileSync(path.join(f.root, 'source'), 'original');
  f.input.fetcher = async (url, options) => {
    if (url.endsWith('/runs/10')) f.run.run_attempt = 2;
    return fetcher(url, options);
  };
  assert.equal((await probeReleaseEvidence(f.input))[0].reasonCode, 'RELEASE_RUN_CHANGED');
});

test('API failures and invalid credentials do not leak response details', async t => {
  const f = fixture(t);
  assert.equal((await probeReleaseEvidence({...f.input, token: 'bad\nsecret'}))[0].reasonCode, 'RELEASE_CREDENTIAL_INVALID');
  const result = await probeReleaseEvidence({...f.input, fetcher: async () => {throw Error('secret-value');}});
  assert.equal(result[0].state, 'UNKNOWN');
  assert.ok(!JSON.stringify(result).includes('secret-value'));
});

test('newer failed run supersedes older success and incomplete listing cannot select a winner', async t => {
  const f = fixture(t), fetcher = f.input.fetcher;
  f.input.fetcher = async (url, options) => url.includes('/workflows/') ? {
    ok: true, status: 200, json: async () => ({total_count: 2, workflow_runs: [f.run,
      {...f.run, id: 11, run_number: 3, conclusion: 'failure'}]})
  } : fetcher(url, options);
  assert.equal((await probeReleaseEvidence(f.input))[0].state, 'DEGRADED');
  f.input.fetcher = async () => ({ok: true, status: 200, json: async () => ({total_count: 101, workflow_runs: [f.run]})});
  assert.equal((await probeReleaseEvidence(f.input))[0].reasonCode, 'RELEASE_LIST_INCOMPLETE');
});
