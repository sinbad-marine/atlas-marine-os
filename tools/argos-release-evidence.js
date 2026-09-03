'use strict';
const crypto = require('node:crypto');
const cp = require('node:child_process');
const {observe} = require('../sinbad-ai-core/argos-health-contracts');
const COMPONENTS = ['TEST_SUITE', 'RELEASE_PIPELINE'];
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const positive = value => Number.isSafeInteger(value) && value > 0;

function checkout(root) {
  const git = args => cp.execFileSync('git', args, {cwd: root, encoding: 'utf8', timeout: 5000, windowsHide: true});
  return {commit: git(['rev-parse', 'HEAD']).trim(), clean: git(['status', '--porcelain', '--untracked-files=normal']).trim() === ''};
}

async function probeReleaseEvidence({owner, repo, ref, token, root, fetcher = globalThis.fetch, clock = () => new Date()}) {
  function result(state, reasonCode, evidence = {}) {
    const observedAt = clock().toISOString();
    return COMPONENTS.map(component => observe({component, state, reasonCode, observedAt,
      validUntil: new Date(Date.parse(observedAt) + 60000).toISOString(),
      evidenceHash: sha({component, state, reasonCode, ...evidence})}));
  }
  const unknown = reason => result('UNKNOWN', reason);
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(owner || '') || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo || '') ||
      !/^[a-f0-9]{40}$/.test(ref || '')) return unknown('RELEASE_TARGET_INVALID');
  if (token !== undefined && (typeof token !== 'string' || !/^[\x21-\x7e]{20,500}$/.test(token))) return unknown('RELEASE_CREDENTIAL_INVALID');
  let source;
  try { source = checkout(root); } catch { return unknown('RELEASE_CHECKOUT_UNAVAILABLE'); }
  if (!source.clean || source.commit !== ref) return unknown('RELEASE_CHECKOUT_MISMATCH');
  const base = `https://api.github.com/repos/${owner}/${repo}/actions`;
  const headers = {Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10'};
  if (token) headers.Authorization = `Bearer ${token}`;
  async function get(url) {
    const response = await fetcher(url, {method: 'GET', redirect: 'error', headers, signal: AbortSignal.timeout(5000)});
    if (!response.ok || response.status !== 200) throw new Error('API_UNAVAILABLE');
    return response.json();
  }
  try {
    // Do not filter for success: a newer failed/in-progress run must supersede an old green run.
    const listing = await get(`${base}/workflows/pages-release.yml/runs?head_sha=${ref}&per_page=100`);
    if (!Number.isSafeInteger(listing.total_count) || !Array.isArray(listing.workflow_runs) ||
        listing.total_count !== listing.workflow_runs.length || listing.total_count > 100) return unknown('RELEASE_LIST_INCOMPLETE');
    if (!listing.workflow_runs.length) return unknown('RELEASE_RUN_MISSING');
    const runs = listing.workflow_runs;
    if (runs.some(run => !positive(run.id) || !positive(run.run_number) || !positive(run.run_attempt) ||
        run.head_sha !== ref || run.path !== '.github/workflows/pages-release.yml' ||
        run.repository?.full_name !== `${owner}/${repo}` || run.head_repository?.full_name !== `${owner}/${repo}`)) return unknown('RELEASE_RUN_BINDING_INVALID');
    const run = [...runs].sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0];
    // workflow_dispatch can check out release_ref != head_sha; it needs a separate manifest attestation adapter.
    if (run.event !== 'push' || run.head_branch !== 'main') return unknown('RELEASE_SOURCE_EVENT_UNVERIFIED');
    if (run.status !== 'completed' || run.conclusion !== 'success') return result('DEGRADED', 'RELEASE_RUN_NOT_SUCCESSFUL');
    const age = clock().getTime() - Date.parse(run.updated_at);
    if (!Number.isFinite(age) || age < 0 || age > 3600000) return unknown('RELEASE_EVIDENCE_STALE');
    const data = await get(`${base}/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`);
    if (!Array.isArray(data.jobs) || data.total_count !== data.jobs.length || data.jobs.length !== 2) return unknown('RELEASE_JOBS_INCOMPLETE');
    const jobs = data.jobs;
    if (jobs.some(job => job.run_id !== run.id || job.run_attempt !== run.run_attempt || job.head_sha !== ref ||
        job.status !== 'completed' || job.conclusion !== 'success')) return unknown('RELEASE_JOB_BINDING_INVALID');
    const build = jobs.filter(job => job.name === 'build'), deploy = jobs.filter(job => job.name === 'deploy');
    if (build.length !== 1 || deploy.length !== 1) return unknown('RELEASE_JOBS_INCOMPLETE');
    const required = [
      [build[0], 'ARGOS integrity gate'], [build[0], 'Run complete regression suite'],
      [build[0], 'Run desktop mobile and WCAG browser tests'], [build[0], 'Build allowlisted Pages artifact'],
      [build[0], 'Attest release manifest'], [build[0], 'Upload Pages artifact'],
      [deploy[0], 'Deploy approved artifact']
    ];
    for (const [job, name] of required) {
      const steps = Array.isArray(job.steps) ? job.steps.filter(step => step.name === name) : [];
      if (steps.length !== 1 || steps[0].status !== 'completed' || steps[0].conclusion !== 'success') return unknown('RELEASE_REQUIRED_STEP_MISSING');
    }
    const latest = await get(`${base}/runs/${run.id}`);
    if (latest.id !== run.id || latest.head_sha !== ref || latest.run_attempt !== run.run_attempt ||
        latest.status !== 'completed' || latest.conclusion !== 'success' || latest.updated_at !== run.updated_at) return unknown('RELEASE_RUN_CHANGED');
    const after = checkout(root);
    if (!after.clean || after.commit !== ref) return unknown('RELEASE_CHECKOUT_CHANGED');
    if (clock().getTime() - Date.parse(run.updated_at) > 3600000) return unknown('RELEASE_EVIDENCE_STALE');
    return result('HEALTHY', null, {repository: `${owner}/${repo}`, sourceCommit: ref, runId: run.id,
      attempt: run.run_attempt, completedAt: run.updated_at, scope: 'GITHUB_RECORDED_RELEASE_NO_NEW_AUTHORITY'});
  } catch { return unknown('RELEASE_EVIDENCE_UNAVAILABLE'); }
}

module.exports = Object.freeze({probeReleaseEvidence});
