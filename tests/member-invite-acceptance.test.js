'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const migration=fs.readFileSync(path.join(__dirname,'..','supabase','migrations','20260904000100_member_invite_acceptance_guard.sql'),'utf8');

test('workspace invite access waits for email confirmation',()=>{
  assert.match(migration,/if new\.email_confirmed_at is null then\s+return new;/u);
  assert.match(migration,/after insert or update of email_confirmed_at on auth\.users/u);
  assert.match(migration,/and i\.status='pending'/u);
  assert.match(migration,/i\.role::public\.workspace_role/u);
  assert.match(migration,/set status='accepted',accepted_at=clock_timestamp\(\)/u);
});

test('migration suspends memberships created before invitation confirmation',()=>{
  assert.match(migration,/u\.email_confirmed_at is null/u);
  assert.match(migration,/set status='pending',accepted_at=null/u);
  assert.match(migration,/update public\.workspace_members m\s+set is_active=false/u);
});
