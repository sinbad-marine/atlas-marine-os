'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { createHash, webcrypto } = require('node:crypto');

// Execute the real handler; only the Supabase transport is substituted.
// These tests do not establish deployed JWT validation or PostgreSQL atomicity.
const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/manage-members/index.ts'), 'utf8');
const script = stripTypeScriptTypes(source.replace(/^import .*\r?\n/, ''));
const hash = text => createHash('sha256').update(text).digest('hex');
const grantId = '11111111-1111-4111-8111-111111111111';
const nonce = 'ab'.repeat(32);
const body = () => ({ action: 'set_role', workspaceId: 'workspace', userId: 'member', role: 'captain', stepUp: { authorizationId: grantId, nonce } });

function harness(options = {}) {
  const calls = [], updates = [];
  const userClient = { auth: {
    getUser: async () => ({ data: { user: options.noUser ? null : { id: 'founder' } }, error: options.authError || null }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: options.aal || 'aal2' }, error: options.aalError || null }) }
  } };
  const expected = {
    p_authorization_id: grantId, p_principal_user_id: 'founder', p_workspace_id: 'workspace',
    p_action: 'identity.member.set_role', p_resource_type: 'workspace_member', p_resource_id: 'member',
    p_command_hash: hash('{"role":"captain","userId":"member","workspaceId":"workspace"}'),
    p_nonce_hash: hash(nonce), p_auth_session_id: 'session-one', ...options.expected
  };
  let consumed = Boolean(options.consumed);
  const admin = {
    from(table) {
      const filters = {};
      const query = {
        select() { return this; }, eq(key, value) { filters[key] = value; return this; },
        async maybeSingle() { return { data: { role: filters.user_id === 'founder' ? (options.callerRole || 'owner') : 'crew', is_active: options.active !== false } }; },
        update(value) { updates.push({ table, value }); return this; },
        async insert() { return { error: null }; }
      };
      return query;
    },
    async rpc(name, args) {
      calls.push({ name, args });
      if (options.rpcError) return { data: null, error: new Error('unavailable') };
      const accepted = !consumed && JSON.stringify(args) === JSON.stringify(expected);
      if (accepted) consumed = true;
      return { data: accepted, error: null };
    }
  };
  let handler;
  const clients = [];
  vm.runInNewContext(script, {
    TextEncoder, Response, crypto: webcrypto, atob,
    Deno: { env: { get: name => name }, serve: fn => { handler = fn; } },
    createClient: (_url, key, config) => {
      clients.push({ key, config });
      return key === 'SUPABASE_SERVICE_ROLE_KEY' ? admin : userClient;
    }
  });
  return {
    calls, updates, clients,
    async request(value = body(), claims = { session_id: 'session-one' }) {
      const token = `test.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.test`;
      const response = await handler(new Request('https://isolated.invalid/manage-members', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(value)
      }));
      return { status: response.status, data: await response.json() };
    }
  };
}

test('real member handler denies invalid identity, inactive/nonowner callers and insufficient MFA before consuming', async () => {
  for (const options of [{ noUser: true }, { authError: 'rejected' }, { active: false }, { callerRole: 'captain' }, { aal: 'aal1' }, { aalError: 'rejected' }]) {
    const h = harness(options), result = await h.request();
    assert.equal(result.status, 400);
    assert.equal(h.calls.length, 0);
    assert.equal(h.updates.length, 0);
  }
});

test('missing or malformed proof and missing authenticated session cannot reach a mutation', async () => {
  for (const proof of [undefined, {}, { authorizationId: grantId, nonce: 'wrong' }]) {
    const h = harness();
    assert.equal((await h.request({ ...body(), stepUp: proof })).status, 400);
    assert.equal(h.calls.length, 0); assert.equal(h.updates.length, 0);
  }
  const h = harness();
  assert.equal((await h.request(body(), {})).status, 400);
  assert.equal(h.calls.length, 0); assert.equal(h.updates.length, 0);
});

test('real handler constructs exact operation binding and never trusts client supplied hashes or actor', async () => {
  const h = harness();
  const result = await h.request({ ...body(), principalUserId: 'attacker', commandHash: 'client-value' });
  assert.equal(result.status, 200);
  assert.equal(h.calls[0].name, 'consume_founder_step_up');
  assert.equal(h.calls[0].args.p_principal_user_id, 'founder');
  assert.equal(h.calls[0].args.p_command_hash, hash('{"role":"captain","userId":"member","workspaceId":"workspace"}'));
  assert.equal(h.updates.length, 1);
  assert.equal(h.clients[0].config.global.headers.Authorization.startsWith('Bearer test.'), true);
});

test('changed command, target, workspace, action, nonce and session are denied without mutation', async () => {
  for (const change of [{ role: 'viewer' }, { userId: 'another' }, { workspaceId: 'other' }, { action: 'set_active', isActive: false }, { stepUp: { authorizationId: grantId, nonce: 'cd'.repeat(32) } }]) {
    const h = harness();
    assert.equal((await h.request({ ...body(), ...change })).status, 400);
    assert.equal(h.updates.length, 0);
  }
  const h = harness();
  assert.equal((await h.request(body(), { session_id: 'session-two' })).status, 400);
  assert.equal(h.updates.length, 0);
});

test('consumption refusal, transport failure and reused approval never execute member changes', async () => {
  for (const options of [{ consumed: true }, { rpcError: true }]) {
    const h = harness(options);
    const result = await h.request();
    assert.equal(result.status, 400, JSON.stringify({ options, result, calls: h.calls })); assert.equal(h.updates.length, 0);
  }
  const h = harness();
  assert.equal((await h.request()).status, 200);
  assert.equal((await h.request()).status, 400);
  assert.equal(h.updates.length, 1);
});
