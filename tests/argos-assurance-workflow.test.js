'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const assurance=fs.readFileSync('.github/workflows/argos-assurance.yml','utf8'),pages=fs.readFileSync('.github/workflows/pages-release.yml','utf8'),quality=fs.readFileSync('.github/workflows/release-quality.yml','utf8');
test('ARGOS assurance runs four times daily with read-only repository permission',()=>{assert.match(assurance,/cron: '17 1,7,13,19 \* \* \*'/);assert.match(assurance,/permissions:\s+contents: read/su);assert.doesNotMatch(assurance,/contents: write|id-token: write|deployments: write/);});
test('assurance opens and always seals one hash-ledger run around all gates',()=>{const start=assurance.indexOf('npm run argos:run:start'),integrity=assurance.indexOf('npm run verify:argos'),tests=assurance.indexOf('npm test'),browser=assurance.indexOf('npm run test:web'),finish=assurance.indexOf('npm run argos:run:finish');assert.ok(start>0&&start<integrity&&integrity<tests&&tests<browser&&browser<finish);assert.match(assurance,/if: always\(\)[\s\S]+ARGOS_RUN_OUTCOME: \$\{\{ job\.status \}\}/u);});
test('GitHub health uses only the workflow read token and exact commit binding',()=>{assert.match(assurance,/ARGOS_GITHUB_TOKEN: \$\{\{ github\.token \}\}/);assert.match(assurance,/ARGOS_GITHUB_REF: \$\{\{ github\.sha \}\}/);});
test('both owner-approved release paths retain the ARGOS integrity gate',()=>{for(const workflow of [pages,quality]){assert.match(workflow,/name: ARGOS integrity gate/);assert.match(workflow,/run: npm run verify:argos/);}});
test('workflow has no commit push deploy or Supabase mutation command',()=>{assert.doesNotMatch(assurance,/git\s+(?:commit|push)|supabase\s+(?:db|functions|deploy)|gh\s+(?:release|pr merge)|npm\s+publish/iu);});

test('health cannot prevent test collection and records failures without ignoring their exit status',()=>{
  const browser=assurance.indexOf('npm run test:web'),health=assurance.indexOf('npm run health:argos -- --record'),finish=assurance.indexOf('npm run argos:run:finish');
  assert.ok(browser<health&&health<finish);
  assert.match(assurance,/name: Observe ARGOS application and service health\s+if: \$\{\{ !cancelled\(\) \}\}/u);
  assert.match(assurance,/ARGOS_HEALTH_LEDGER_ROOT: \$\{\{ runner.temp \}\}\/sinbad-argos-ledger\/health-runs/u);
  assert.doesNotMatch(assurance,/continue-on-error|\|\| true/u);
});

test('retention is opt-in, encrypted, non-overwriting and only follows verified archive creation',()=>{
  const seal=assurance.indexOf('id: seal_argos'),create=assurance.indexOf('run: npm run argos:archive:create'),upload=assurance.indexOf('uses: actions/upload-artifact@');
  assert.ok(seal<create&&create<upload);
  assert.match(assurance,/vars\.ARGOS_ARCHIVE_RETENTION_ENABLED == 'true' && steps\.seal_argos\.outcome == 'success'/u);
  assert.match(assurance,/vars\.ARGOS_ARCHIVE_RETENTION_ENABLED == 'true' && steps\.archive_argos\.outcome == 'success'/u);
  assert.match(assurance,/ARGOS_ARCHIVE_KEY: \$\{\{ secrets\.ARGOS_ARCHIVE_KEY \}\}/u);
  assert.match(assurance,/path: \$\{\{ runner.temp \}\}\/sinbad-argos-retention\/\*\.json/u);
  assert.match(assurance,/retention-days: 30/u);
  assert.match(assurance,/if-no-files-found: error/u);
  assert.match(assurance,/overwrite: false/u);
});
