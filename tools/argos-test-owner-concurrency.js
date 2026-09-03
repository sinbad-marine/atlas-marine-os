'use strict';
// Windows-only, disposable local cluster. Never accepts an external connection
// string, reuses a database directory, or installs a Windows service.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { createRequire } = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
const { randomBytes, createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const root = path.join(__dirname, '..');
const runtime = path.join(root, 'tmp/argos-native-pg-runtime');
const binaryPackage = path.join(runtime, 'node_modules/@embedded-postgres/windows-x64');
const bin = path.join(binaryPackage, 'native/bin');
const sourceHashes = {};
function read(name) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  sourceHashes[name] = createHash('sha256').update(source).digest('hex');
  return source;
}
function fixtureSQL() {
  const allowed = new Set(['supabase/migrations/20260829_founder_owner_step_up.sql', 'supabase/migrations/20260903_founder_owner_atomic_issuance.sql', 'supabase/migrations/20260903000100_founder_owner_consumption_lock.sql', 'supabase/migrations/20260903000200_founder_owner_consumption_expiry.sql']);
  return read('tests/sql/founder-owner-atomic-issuance.sql').split(/\r?\n/).map(line => {
    if (line === '\\set ON_ERROR_STOP on' || line.startsWith('\\echo ')) return '';
    if (line.startsWith('\\ir ')) {
      const name = line.slice(4).replace(/^\.\.\/\.\.\//, '');
      assert.ok(allowed.delete(name), 'UNEXPECTED_SQL_INCLUDE');
      return read(name);
    }
    assert.ok(!line.trimStart().startsWith('\\'), 'UNSUPPORTED_PSQL_DIRECTIVE');
    return line;
  }).join('\n');
}
async function reservePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}
async function main() {
  assert.equal(process.platform, 'win32');
  assert.equal(JSON.parse(fs.readFileSync(path.join(binaryPackage, 'package.json'), 'utf8')).version, '18.4.0-beta.17');
  const localRequire = createRequire(path.join(runtime, 'package.json'));
  const { Client } = localRequire('pg');
  const dir = fs.mkdtempSync(path.join(root, 'tmp/argos-native-owner-'));
  const data = path.join(dir, 'data');
  const passwordFile = path.join(dir, 'initial-test-password');
  const password = randomBytes(32).toString('hex');
  const port = await reservePort();
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)));
  const log = fs.openSync(path.join(dir, 'server.log'), 'wx');
  let server, admin, report;
  const clients = [];
  const checks = [];
  const command = (name, args) => execFileSync(path.join(bin, `${name}.exe`), args, { env, windowsHide: true, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
  const connect = async () => {
    const client = new Client({ host: '127.0.0.1', port, user: 'argos_test', password, database: 'postgres', ssl: false, connectionTimeoutMillis: 1000, statement_timeout: 10000, query_timeout: 12000 });
    client.on('error', () => {});
    try { await client.connect(); } catch (error) { await client.end().catch(() => {}); throw error; }
    clients.push(client);
    return client;
  };
  try {
    fs.writeFileSync(passwordFile, password + '\n', { flag: 'wx', mode: 0o600 });
    try { command('initdb', ['-D', data, '-U', 'argos_test', '--auth=scram-sha-256', '--pwfile=' + passwordFile, '--encoding=UTF8', '--no-locale']); }
    finally { fs.unlinkSync(passwordFile); }
    server = spawn(path.join(bin, 'postgres.exe'), ['-D', data, '-h', '127.0.0.1', '-p', String(port), '-c', 'max_connections=12'], { env, windowsHide: true, stdio: ['ignore', log, log] });
    let startupError;
    server.on('error', error => { startupError = error; });
    for (let i = 0; i < 40; i++) {
      if (startupError) throw startupError;
      if (server.exitCode !== null) throw new Error('TEST_SERVER_EXITED');
      try { admin = await connect(); break; } catch { await delay(100); }
    }
    assert.ok(admin, 'TEST_SERVER_START_TIMEOUT');
    const identity = (await admin.query("select current_setting('data_directory') as dir, version() as version")).rows[0];
    assert.equal(path.resolve(identity.dir).toLowerCase(), path.resolve(data).toLowerCase(), 'UNEXPECTED_DATABASE');
    const sql = fixtureSQL();
    await admin.query(sql);
    assert.equal((await admin.query("select to_regnamespace('auth') is null as clean")).rows[0].clean, true);
    checks.push('native PostgreSQL SQL regression and fixture rollback');
    // Recreate only the same minimal fixture, now committed for multiple sessions.
    await admin.query(sql.slice(0, sql.indexOf('-- Inject a database audit failure')) + '\ncommit;');

    const first = await connect(), second = await connect(), suspender = await connect();
    await first.query('set role service_role');
    await second.query('set role service_role');
    const principal = '11111111-1111-4111-8111-111111111111';
    const base = [principal, null, 'identity.member.set_role', 'workspace_member', 'fixture', 'a'.repeat(64)];
    const issue = async nonce => (await admin.query('select * from public.issue_founder_step_up($1,$2,$3,$4,$5,$6,$7,$8)', [...base, nonce, 'test-session'])).rows[0].id;
    const consume = (client, id, nonce) => client.query('select public.consume_founder_step_up($1,$2,$3,$4,$5,$6,$7,$8,$9) as accepted', [id, ...base, nonce, 'test-session']);
    const waiting = async client => {
      for (let i = 0; i < 60; i++) {
        const state = (await admin.query('select wait_event_type from pg_stat_activity where pid=$1', [client.processID])).rows[0];
        if (state?.wait_event_type === 'Lock') return;
        await delay(25);
      }
      throw new Error('EXPECTED_DATABASE_LOCK_WAIT');
    };
    const pending = promise => { promise.catch(() => {}); return promise; };

    const nonce = 'b'.repeat(64), id = await issue(nonce);
    await first.query('begin');
    assert.equal((await consume(first, id, nonce)).rows[0].accepted, true);
    const contender = pending(consume(second, id, nonce));
    await waiting(second);
    await first.query('commit');
    assert.equal((await contender).rows[0].accepted, false);
    assert.equal(Number((await admin.query("select count(*) as n from public.founder_security_audit where authorization_id=$1 and event_type='step_up_consumed'", [id])).rows[0].n), 1);
    checks.push('two competing service-role sessions consume exactly once');

    await suspender.query('begin');
    await suspender.query("update public.founder_principals set status='suspended'");
    const issuing = pending(first.query('select * from public.issue_founder_step_up($1,$2,$3,$4,$5,$6,$7,$8)', [...base, 'c'.repeat(64), 'test-session']));
    await waiting(first);
    await suspender.query('commit');
    await assert.rejects(issuing, /ACTIVE_FOUNDER_REQUIRED/);
    checks.push('issuance waits for suspension and rejects after it commits');
    await admin.query("update public.founder_principals set status='active'");

    const otherNonce = 'd'.repeat(64), otherId = await issue(otherNonce);
    await suspender.query('begin');
    await suspender.query("update public.founder_principals set status='suspended'");
    const consuming = pending(consume(second, otherId, otherNonce));
    try { await waiting(second); }
    catch { throw new Error('CONSUMPTION_DID_NOT_WAIT_FOR_SUSPENSION: accepted=' + (await consuming).rows[0].accepted); }
    await suspender.query('commit');
    assert.equal((await consuming).rows[0].accepted, false);
    assert.equal((await admin.query('select consumed_at is null as untouched from public.founder_step_up_authorizations where id=$1', [otherId])).rows[0].untouched, true);
    assert.equal(Number((await admin.query("select count(*) as n from public.founder_security_audit where authorization_id=$1 and event_type='step_up_consumed'", [otherId])).rows[0].n), 0);
    checks.push('consumption waits for suspension and rejects after it commits');
    await admin.query("update public.founder_principals set status='active'");
    await first.query('begin');
    assert.equal((await consume(first, otherId, otherNonce)).rows[0].accepted, true);
    const suspending = pending(suspender.query("update public.founder_principals set status='suspended'"));
    await waiting(suspender);
    await first.query('commit');
    await suspending;
    assert.equal(Number((await admin.query("select count(*) as n from public.founder_security_audit where authorization_id=$1 and event_type='step_up_consumed'", [otherId])).rows[0].n), 1);
    checks.push('suspension waits when consumption already holds the principal lock');
    await admin.query("update public.founder_principals set status='active'");
    const expiringNonce = 'e'.repeat(64), expiringId = await issue(expiringNonce);
    await admin.query("update public.founder_step_up_authorizations set expires_at=clock_timestamp()+interval '2 seconds' where id=$1", [expiringId]);
    await suspender.query('begin');
    await suspender.query('select id from public.founder_step_up_authorizations where id=$1 for update', [expiringId]);
    const expiring = pending(consume(second, expiringId, expiringNonce));
    await waiting(second);
    assert.equal((await admin.query('select expires_at>clock_timestamp() as valid from public.founder_step_up_authorizations where id=$1', [expiringId])).rows[0].valid, true, 'EXPIRY_TEST_DID_NOT_START_WHILE_VALID');
    let expired = false;
    for (let i = 0; i < 100; i++) {
      expired = (await admin.query('select expires_at<=clock_timestamp() as expired from public.founder_step_up_authorizations where id=$1', [expiringId])).rows[0].expired;
      if (expired) break;
      await delay(50);
    }
    assert.equal(expired, true, 'EXPIRY_TEST_CLOCK_TIMEOUT');
    await suspender.query('commit');
    assert.equal((await expiring).rows[0].accepted, false, 'EXPIRED_GRANT_CONSUMED_AFTER_LOCK_WAIT');
    assert.equal((await admin.query('select consumed_at is null as untouched from public.founder_step_up_authorizations where id=$1', [expiringId])).rows[0].untouched, true);
    assert.equal(Number((await admin.query("select count(*) as n from public.founder_security_audit where authorization_id=$1 and event_type='step_up_consumed'", [expiringId])).rows[0].n), 0);
    checks.push('approval expiring during grant-row lock wait is not consumed');
    await admin.query(read('tests/sql/founder-owner-access.sql'));
    assert.equal((await admin.query('select auth.uid() is null as restored')).rows[0].restored, true);
    checks.push('actual anon/authenticated role denial, Owner-only RLS and audit immutability');
    report = { status: 'PASSED', engine: identity.version, checks, sourceHashes, limits: ['minimal Auth/workspace fixture', 'no live Supabase Auth or Bridge activation'] };
  } catch (error) {
    report = { status: 'FAILED', code: error.code || 'OWNER_CONCURRENCY_FAILED', message: error.message, checks, sourceHashes };
    process.exitCode = 1;
  } finally {
    if (admin) {
      await admin.query('rollback').catch(() => {});
      for (const client of clients.filter(client => client !== admin)) await admin.query('select pg_cancel_backend($1)', [client.processID]).catch(() => {});
    }
    for (const client of clients.filter(client => client !== admin).concat(admin ? [admin] : [])) {
      await client.query('rollback').catch(() => {});
      await client.end().catch(() => {});
    }
    if (server && server.exitCode === null) command('pg_ctl', ['-D', data, '-m', 'fast', '-w', '-t', '10', 'stop']);
    fs.closeSync(log);
    if (report) {
      report.testDirectory = path.relative(root, dir).replace(/\\/g, '/');
      report.serverStopped = !fs.existsSync(path.join(data, 'postmaster.pid'));
      assert.equal(report.serverStopped, true, 'TEST_SERVER_NOT_STOPPED');
      console.log(JSON.stringify(report, null, 2));
    }
  }
}
main().catch(error => { console.error(JSON.stringify({ status: 'FAILED', code: error.code || 'OWNER_TEST_SETUP_FAILED', message: error.message })); process.exitCode = 1; });
