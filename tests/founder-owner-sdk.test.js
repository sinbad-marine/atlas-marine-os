'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

// Real SDK, no stored session. Only HTTP transport is substituted; no real
// credentials, network, Auth server or database are used by this test.
const endpoints = ['founder-owner-step-up', 'manage-members'];
test('Edge imports use the same SDK version exercised by these tests', () => {
  const version = JSON.parse(fs.readFileSync(path.join(__dirname, '../node_modules/@supabase/supabase-js/package.json'), 'utf8')).version;
  for (const endpoint of endpoints) {
    const source = fs.readFileSync(path.join(__dirname, `../supabase/functions/${endpoint}/index.ts`), 'utf8');
    assert.ok(source.startsWith(`import { createClient } from 'https://esm.sh/@supabase/supabase-js@${version}'`));
  }
});
const scripts = Object.fromEntries(endpoints.map(name => [name, stripTypeScriptTypes(
  fs.readFileSync(path.join(__dirname, `../supabase/functions/${name}/index.ts`), 'utf8').replace(/^import .*\r?\n/, '')
)]));
const token = claims => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: 'founder', session_id: 'session-one', exp: Math.floor(Date.now() / 1000) + 300, ...claims })).toString('base64url'),
  Buffer.alloc(32, 1).toString('base64url')
].join('.');
const proof = { authorizationId: '11111111-1111-4111-8111-111111111111', nonce: 'ab'.repeat(32) };
const payloads = {
  'founder-owner-step-up': { action: 'identity.member.set_role', resourceType: 'workspace_member', resourceId: 'member', workspaceId: 'workspace', command: { workspaceId: 'workspace', userId: 'member', role: 'captain' } },
  'manage-members': { action: 'set_role', workspaceId: 'workspace', userId: 'member', role: 'captain', stepUp: proof }
};

async function exercise(endpoint, { aal = 'aal2', rejectAuth = false, rejectMfaRecheck = false, authHeader, issuanceFailure = false, invalidIssuance = false } = {}) {
  const jwt = token({ aal }), authCalls = [], writes = [], clients = [];
  const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const transport = async (url, init = {}) => {
    const target = new URL(url), headers = new Headers(init.headers);
    assert.equal(target.origin, 'https://isolated.invalid');
    if (target.pathname === '/auth/v1/user') {
      authCalls.push(headers.get('Authorization'));
      if (rejectAuth || (rejectMfaRecheck && authCalls.length === 2)) return response({ code: 'bad_jwt', message: 'Rejected by test Auth transport' }, 401);
      assert.equal(headers.get('Authorization'), `Bearer ${jwt}`);
      return response({ id: 'founder', factors: [{ factor_type: 'totp', status: 'verified' }] });
    }
    assert.equal(headers.get('apikey'), 'test-service-key');
    assert.equal(headers.get('Authorization'), 'Bearer test-service-key');
    if (init.method === 'GET') {
      if (target.pathname === '/rest/v1/founder_principals') return response([{ user_id: 'founder', status: 'active' }]);
      if (target.pathname === '/rest/v1/workspace_members') return response([{ role: target.searchParams.get('user_id') === 'eq.founder' ? 'owner' : 'crew', is_active: true }]);
    } else {
      writes.push({ path: target.pathname, body: init.body ? JSON.parse(init.body) : null });
      if (target.pathname === '/rest/v1/rpc/issue_founder_step_up') {
        if (issuanceFailure) return response({ code: 'P0001', message: 'private database diagnostic must not escape' }, 400);
        if (invalidIssuance) return response({ id: proof.authorizationId });
        return response({ id: proof.authorizationId, expires_at: new Date(Date.now() + 300000).toISOString() });
      }
      if (target.pathname === '/rest/v1/rpc/consume_founder_step_up') return response(true);
      if (['/rest/v1/founder_security_audit', '/rest/v1/workspace_members', '/rest/v1/member_admin_audit'].includes(target.pathname)) return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected isolated request: ${init.method} ${target.pathname}`);
  };
  let handler;
  vm.runInNewContext(scripts[endpoint], {
    TextEncoder, Response, crypto: webcrypto, atob,
    Deno: { serve: fn => { handler = fn; }, env: { get: name => ({ SUPABASE_URL: 'https://isolated.invalid', SUPABASE_ANON_KEY: 'test-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key' })[name] } },
    createClient: (url, key, options) => {
      const client = createClient(url, key, { ...options, global: { ...options.global, fetch: transport } });
      clients.push(client); return client;
    }
  });
  const result = await handler(new Request(`https://isolated.invalid/${endpoint}`, {
    method: 'POST', headers: { Authorization: authHeader === undefined ? `Bearer ${jwt}` : authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(payloads[endpoint])
  }));
  for (const client of clients) await client.auth.stopAutoRefresh();
  return { status: result.status, body: await result.json(), authCalls, writes, jwt };
}

test('issuance uses one bound RPC and returns no nonce when that transaction fails', async () => {
  const success = await exercise('founder-owner-step-up');
  assert.equal(success.status, 200);
  assert.equal(success.writes.length, 1);
  assert.equal(success.writes[0].path, '/rest/v1/rpc/issue_founder_step_up');
  const args = success.writes[0].body;
  assert.equal(args.p_principal_user_id, 'founder');
  assert.equal(args.p_auth_session_id, 'session-one');
  assert.equal(args.p_action, payloads['founder-owner-step-up'].action);
  assert.match(args.p_nonce_hash, /^[0-9a-f]{64}$/);
  assert.notEqual(args.p_nonce_hash, success.body.nonce);
  assert.equal(args.p_command_hash, success.body.commandHash);
  assert.equal('p_expires_at' in args, false);
  for (const options of [{ issuanceFailure: true }, { invalidIssuance: true }]) {
    const failure = await exercise('founder-owner-step-up', options);
    assert.equal(failure.status, 503);
    assert.deepEqual(failure.body, { error: 'STEP_UP_ISSUANCE_FAILED' });
    assert.equal(failure.writes.length, 1);
    assert.equal(failure.writes[0].path, '/rest/v1/rpc/issue_founder_step_up');
  }
});

for (const endpoint of endpoints) {
  test(`${endpoint}: real stateless SDK verifies the request JWT for identity and MFA`, async () => {
    const result = await exercise(endpoint);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.deepEqual(result.authCalls, [`Bearer ${result.jwt}`, `Bearer ${result.jwt}`]);
    assert.ok(result.writes.length > 0);
  });

  test(`${endpoint}: verified factor cannot upgrade an aal1 request; rejected aal2 never writes`, async () => {
    for (const options of [{ aal: 'aal1' }, { rejectAuth: true }, { rejectMfaRecheck: true }]) {
      const result = await exercise(endpoint, options);
      assert.notEqual(result.status, 200);
      assert.equal(result.writes.length, 0);
    }
  });

  test(`${endpoint}: missing or non-Bearer credentials never call Auth or mutate`, async () => {
    for (const authHeader of ['', 'Basic invalid', 'Bearer one two']) {
      const result = await exercise(endpoint, { authHeader });
      assert.notEqual(result.status, 200);
      assert.equal(result.authCalls.length, 0);
      assert.equal(result.writes.length, 0);
    }
  });
}
