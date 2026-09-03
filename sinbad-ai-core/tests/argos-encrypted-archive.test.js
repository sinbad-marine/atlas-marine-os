'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const shelfApi=require('../argos-event-shelf');
const archive=require('../argos-encrypted-archive');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

const KEY=Buffer.alloc(32,7).toString('base64');
const OTHER_KEY=Buffer.alloc(32,8).toString('base64');
const H='a'.repeat(64),NOW='2026-09-01T12:00:00.000Z';
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'argos-archive-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const shelf=shelfApi.create({root,shelfId:'assurance-runs',maxEvents:10});shelf.append({eventId:'run-1-started',observedAt:NOW,actorId:'argos',kind:'RUN_STARTED',targetRef:'operation/run-1',outcome:'RUNNING',evidenceHash:H});return {archiveId:'archive-test-1',createdAt:NOW,sourceInventoryHash:'b'.repeat(64),shelves:[shelf.inspect()]};}

test('encrypts a complete shelf and exposes no event metadata in the container',t=>{const input=fixture(t),sealed=archive.createArchive(input,KEY),wire=JSON.stringify(sealed);assert.equal(sealed.version,archive.VERSION);assert.equal(sealed.algorithm,'AES-256-GCM+HKDF-SHA256');for(const secret of ['run-1-started','RUN_STARTED','operation/run-1','assurance-runs'])assert.doesNotMatch(wire,new RegExp(secret));const result=archive.verifyArchive(sealed,KEY);assert.equal(result.status,'ARGOS_ARCHIVE_VERIFIED');assert.deepEqual(result.shelves,[{shelfId:'assurance-runs',eventCount:1,headHash:input.shelves[0].headHash}]);});
test('wrong key and ciphertext tag metadata tampering fail closed',t=>{const sealed=archive.createArchive(fixture(t),KEY);assert.throws(()=>archive.verifyArchive(sealed,OTHER_KEY),/ARGOS_ARCHIVE_AUTHENTICATION_FAILED/);for(const field of ['ciphertext','tag','nonce','salt','plaintextHash']){const changed={...sealed,[field]:field==='plaintextHash'?'c'.repeat(64):`${sealed[field].slice(0,-2)}AA`};assert.throws(()=>archive.verifyArchive(changed,KEY),/ARGOS_ARCHIVE_(?:AUTHENTICATION_FAILED|CONTAINER_INVALID)/,field);}});
test('requires a canonical 256-bit key and exact hostile-safe input shapes',t=>{const input=fixture(t);for(const key of ['',Buffer.alloc(31).toString('base64'),'not-a-key'])assert.throws(()=>archive.createArchive(input,key),/ARGOS_ARCHIVE_KEY_INVALID/);assert.throws(()=>archive.createArchive({...input,extra:true},KEY),/ARGOS_ARCHIVE_INPUT_INVALID/);const hostile={...input};Object.defineProperty(hostile,'archiveId',{get(){throw new Error('getter invoked');}});assert.throws(()=>archive.createArchive(hostile,KEY),/ARGOS_ARCHIVE_INPUT_INVALID/);});
test('rejects fabricated shelf chains before encryption',t=>{const input=fixture(t),entry={...input.shelves[0].entries[0],outcome:'PASSED'},shelf={...input.shelves[0],entries:[entry]};assert.throws(()=>archive.createArchive({...input,shelves:[shelf]},KEY),/ARGOS_ARCHIVE_SHELF_INVALID/);});
test('module exports encryption and summary verification only',()=>{assert.deepEqual(Object.keys(archive).sort(),['ALGORITHM','VERSION','createArchive','verifyArchive']);for(const name of Object.keys(archive))assert.doesNotMatch(name,/upload|network|deploy|restore|delete|credential/iu);});
