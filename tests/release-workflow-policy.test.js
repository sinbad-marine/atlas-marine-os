'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const quality=fs.readFileSync('.github/workflows/release-quality.yml','utf8');
const release=fs.readFileSync('.github/workflows/pages-release.yml','utf8');

test('quality workflow runs regression artifact build and SBOM with read-only permission',()=>{
  assert.match(quality,/permissions:\s*\n\s*contents: read/u);
  assert.match(quality,/node-version: 24\.19\.0/u);
  assert.match(quality,/npm ci --prefix sinbad-ai-core\/engines\/navigation/u);
  assert.match(quality,/npm audit --prefix sinbad-ai-core\/engines\/navigation --audit-level=moderate/u);
  assert.match(quality,/node --test sinbad-ai-core\/tests\/\*\.test\.js tests\/\*\.test\.js/u);
  assert.match(quality,/build-pages-artifact\.js \.release\/pages/u);
  assert.match(quality,/npm sbom --package-lock-only --sbom-format cyclonedx/u);
  assert.ok(quality.indexOf('run: npm ci')<quality.indexOf('Run complete regression suite'));
});

test('Pages release is manual gated least-privilege and SHA pinned',()=>{
  assert.match(release,/on:\s*\n\s*workflow_dispatch:/u);
  assert.doesNotMatch(release,/\bpush:/u);
  assert.match(release,/environment:\s*\n\s*name: github-pages/u);
  assert.match(release,/attestations: write/u);
  assert.match(release,/artifact-metadata: write/u);
  assert.match(release,/node-version: 24\.19\.0/u);
  assert.match(release,/npm ci --prefix sinbad-ai-core\/engines\/navigation/u);
  assert.match(release,/npm audit --prefix sinbad-ai-core\/engines\/navigation --audit-level=moderate/u);
  const uses=[...release.matchAll(/uses:\s*([^\s#]+)/gu)].map(match=>match[1]);
  assert.ok(uses.length>=4);
  for(const action of uses)assert.match(action,/@[a-f0-9]{40}$/u,action);
});
