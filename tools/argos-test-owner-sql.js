'use strict';
// Explicit local regression runner. No network, connection string, persisted
// database, production credentials, or automatic dependency installation.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');

async function main() {
  const root = path.join(__dirname, '..');
  const runtime = path.join(root, 'tmp/argos-pg-runtime-058');
  const packageInfo = JSON.parse(fs.readFileSync(path.join(runtime, 'node_modules/@electric-sql/pglite/package.json'), 'utf8'));
  assert.equal(packageInfo.version, '0.5.8', 'PINNED_TEST_RUNTIME_REQUIRED');
  const localRequire = createRequire(path.join(runtime, 'package.json'));
  const { PGlite } = localRequire('@electric-sql/pglite');
  const { pgcrypto } = localRequire('@electric-sql/pglite/contrib/pgcrypto');
  const fixture = 'tests/sql/founder-owner-atomic-issuance.sql';
  const migrations = [
    'supabase/migrations/20260829_founder_owner_step_up.sql',
    'supabase/migrations/20260903_founder_owner_atomic_issuance.sql',
    'supabase/migrations/20260903000100_founder_owner_consumption_lock.sql',
    'supabase/migrations/20260903000200_founder_owner_consumption_expiry.sql'
  ];
  const sources = Object.fromEntries([fixture, ...migrations].map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')]));
  const included = new Set();
  // Expand only this fixture's known psql include directives. SQL text is
  // otherwise unchanged, including its transaction, assertions and rollback.
  const sql = sources[fixture].split(/\r?\n/).map(line => {
    if (line === '\\set ON_ERROR_STOP on' || line.startsWith('\\echo ')) return '';
    if (line.startsWith('\\ir ')) {
      const name = line.slice(4).replace(/^\.\.\/\.\.\//, '');
      assert.ok(migrations.includes(name) && !included.has(name), 'UNEXPECTED_SQL_INCLUDE');
      included.add(name);
      return sources[name];
    }
    assert.ok(!line.trimStart().startsWith('\\'), 'UNSUPPORTED_PSQL_DIRECTIVE');
    return line;
  }).join('\n');
  assert.equal(included.size, migrations.length);
  const bridgeMigration='supabase/migrations/20260903000300_argos_bridge_identity.sql',bridgeFixture='tests/sql/argos-bridge-identity.sql';
  sources[bridgeMigration]=fs.readFileSync(path.join(root,bridgeMigration),'utf8');
  sources[bridgeFixture]=fs.readFileSync(path.join(root,bridgeFixture),'utf8');
  const bridgeSql=sources[bridgeFixture].replace('\\ir ../../'+bridgeMigration,()=>sources[bridgeMigration]);
  const combinedSql=sql.replace(/rollback;/i,()=>bridgeSql+'\nrollback;');
  const db = new PGlite({ extensions: { pgcrypto } });
  let engine;
  try {
    engine = (await db.query('select version() as version')).rows[0].version;
    await db.exec(combinedSql);
    const after = (await db.query("select to_regnamespace('auth') is null as rolled_back, to_regclass('public.founder_step_up_authorizations') is null as no_grants")).rows[0];
    assert.equal(after.rolled_back, true, 'FIXTURE_NOT_ROLLED_BACK');
    assert.equal(after.no_grants, true, 'FIXTURE_GRANTS_REMAIN');
  } finally {
    await db.close();
  }
  console.log(JSON.stringify({
    status: 'PASSED', runtime: 'PGlite 0.5.8', engine,
    checks: ['audit failure rollback', 'issuance binding', 'five-minute expiry', 'execute ACL', 'nonce uniqueness', 'consume and reject reuse', 'suspended principal denial', 'fixture rollback', 'Bridge credential/body/session/membership/replay denials'],
    sourceHashes: Object.fromEntries(Object.entries(sources).map(([name, text]) => [name, createHash('sha256').update(text).digest('hex')])),
    limits: ['single-connection WASM PostgreSQL', 'minimal Auth and workspace fixtures', 'not live Supabase or concurrent-client verification']
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'FAILED', code: error.code || 'OWNER_SQL_REGRESSION_FAILED', message: error.message }));
  process.exitCode = 1;
});
