'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const edge=fs.readFileSync('supabase/functions/human-review/index.ts','utf8');
test('review API uses exact origins bearer validation and server-derived identity',()=>{assert.match(edge,/HUMAN_REVIEW_ALLOWED_ORIGINS/);assert.match(edge,/userClient\.auth\.getUser\(jwt\)/);assert.doesNotMatch(edge,/body\.actor|body\.role/);assert.match(edge,/MEMBERSHIP_REQUIRED/)});
test('reviewer reads are assigned and bounded',()=>{assert.match(edge,/assigned_reviewer_id\.eq\.\$\{user\.id\}/);assert.match(edge,/PACKAGE_ACCESS_DENIED/);assert.match(edge,/integer\(body\.limit\?\?25,'limit',1,100\)/);assert.match(edge,/nextCursor/);assert.match(edge,/nextPosition/)});
test('all mutations use database RPCs and authenticated actor',()=>{for(const fn of ['human_review_claim_package','human_review_save_decision','human_review_submit_package','human_review_authorize_reviewer','human_review_transfer_package'])assert.match(edge,new RegExp(`rpc\\('${fn}'`));assert.match(edge,/p_actor_id:user\.id/g)});
test('Owner reviewer and transfer mutations require existing AAL2 step-up consumption',()=>{assert.match(edge,/getAuthenticatorAssuranceLevel/);assert.match(edge,/consume_founder_step_up/);assert.match(edge,/identity\.human_reviewer\.set_state/);assert.match(edge,/identity\.human_review\.package_transfer/)});
test('API maps database errors to bounded codes',()=>{assert.match(edge,/safeCodes/);assert.match(edge,/databaseCode/);assert.doesNotMatch(edge,/error\.message\}\)/)});
