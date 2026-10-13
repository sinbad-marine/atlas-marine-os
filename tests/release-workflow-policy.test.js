'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const quality=fs.readFileSync('.github/workflows/release-quality.yml','utf8');
const release=fs.readFileSync('.github/workflows/pages-release.yml','utf8');

test('both browser projects must pass before artifact verification or Pages build',()=>{
  for(const workflow of [quality,release]){
    assert.match(workflow,/project: \[desktop-chromium, mobile-chromium\]/u);
    assert.match(workflow,/fail-fast: false/u);
    assert.match(workflow,/npm run test:web -- --project=\$\{\{ matrix\.project \}\} --workers=1 --fail-on-flaky-tests/u);
    assert.doesNotMatch(workflow,/continue-on-error: true/u);
  }
  // A skipped dependency must never look like a successful required verify check.
  assert.match(quality,/verify:\s*\n\s*needs: browser-checks\s*\n\s*if: \$\{\{ always\(\) \}\}/u);
  assert.match(quality,/BROWSER_RESULT: \$\{\{ needs\.browser-checks\.result \}\}/u);
  assert.match(quality,/run: test "\$BROWSER_RESULT" = success/u);
  assert.match(release,/build:\s*\n\s*needs: browser-checks/u);
  assert.match(release,/deploy:\s*\n\s*needs: build/u);
});

test('quality workflow runs regression artifact build and SBOM with read-only permission',()=>{
  assert.match(quality,/permissions:\s*\n\s*contents: read/u);
  assert.match(quality,/FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true/u);
  assert.match(quality,/actions\/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd/u);
  assert.match(quality,/actions\/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e/u);
  assert.match(quality,/package-manager-cache: false/u);
  assert.match(quality,/node-version: 24\.19\.0/u);
  assert.match(quality,/npm ci --prefix sinbad-ai-core\/engines\/navigation/u);
  assert.match(quality,/npm audit --prefix sinbad-ai-core\/engines\/navigation --audit-level=moderate/u);
  assert.match(quality,/npm run verify --prefix sinbad-ai-core\/engines\/navigation/u);
  assert.match(quality,/node --test sinbad-ai-core\/tests\/\*\.test\.js tests\/\*\.test\.js/u);
  assert.match(quality,/build-pages-artifact\.js \.release\/pages/u);
  assert.match(quality,/name: Record protected release source\s*\n\s*run: git rev-parse HEAD/u);
  assert.match(quality,/SINBAD_CHECKED_OUT_COMMIT: \$\{\{ steps\.release_source\.outputs\.sha \}\}/u);
  assert.ok(quality.indexOf('run: git rev-parse HEAD')<quality.indexOf('SINBAD_CHECKED_OUT_COMMIT:'));
  assert.match(quality,/npm sbom --package-lock-only --sbom-format cyclonedx/u);
  assert.ok(quality.indexOf('run: npm ci')<quality.indexOf('Run complete regression suite'));
});

test('Pages release runs for main pushes and manual recovery with least privilege and SHA pins',()=>{
  assert.match(release,/on:\s*\n\s*push:\s*\n\s*branches:\s*\n\s*- main\s*\n\s*workflow_dispatch:/u);
  assert.match(release,/environment:\s*\n\s*name: github-pages/u);
  assert.match(release,/release_ref:\s*\n\s*description: Exact known-good commit SHA or ref to rebuild and redeploy/u);
  assert.match(release,/ref: \$\{\{ inputs\.release_ref \|\| github\.sha \}\}/u);
  assert.match(release,/name: Record protected release source\s*\n\s*run: git rev-parse HEAD/u);
  assert.match(release,/SINBAD_CHECKED_OUT_COMMIT: \$\{\{ steps\.release_source\.outputs\.sha \}\}/u);
  assert.ok(release.indexOf('run: git rev-parse HEAD')<release.indexOf('id: release_source'));
  assert.ok(release.indexOf('id: release_source')<release.indexOf('SINBAD_CHECKED_OUT_COMMIT:'));
  assert.match(release,/attestations: write/u);
  assert.match(release,/artifact-metadata: write/u);
  assert.match(release,/FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true/u);
  assert.match(release,/actions\/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd/u);
  assert.match(release,/actions\/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd[^]*?fetch-depth: 0/u);
  assert.match(release,/actions\/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e/u);
  assert.match(release,/actions\/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9/u);
  assert.match(release,/actions\/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128/u);
  assert.match(release,/package-manager-cache: false/u);
  assert.match(release,/node-version: 24\.19\.0/u);
  assert.match(release,/npm ci --prefix sinbad-ai-core\/engines\/navigation/u);
  assert.match(release,/npm audit --prefix sinbad-ai-core\/engines\/navigation --audit-level=moderate/u);
  assert.match(release,/npm run verify --prefix sinbad-ai-core\/engines\/navigation/u);
  const uses=[...release.matchAll(/uses:\s*([^\s#]+)/gu)].map(match=>match[1]);
  assert.ok(uses.length>=4);
  for(const action of uses)assert.match(action,/@[a-f0-9]{40}$/u,action);
});
