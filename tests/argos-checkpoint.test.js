'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const shelfApi = require('../sinbad-ai-core/argos-event-shelf');
const {verifyCheckpoint} = require('../tools/argos-verify-checkpoint');

test('independent checkpoint detects a truncated tail even when remaining journal hashes are valid', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'argos-checkpoint-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const shelf = shelfApi.create({root, shelfId: 'health', maxEvents: 10});
  const append = id => shelf.append({eventId: id, observedAt: '2026-09-02T20:00:00.000Z',
    actorId: 'argos', kind: 'OBSERVED', targetRef: 'component/BRIDGE', outcome: 'UNKNOWN', evidenceHash: 'a'.repeat(64)});
  append('one'); append('two');
  const snapshot = shelf.inspect();
  const checkpoint = {version: 'sinbad-argos-checkpoint/1-v1', shelfId: 'health', eventCount: 2, headHash: snapshot.headHash};
  assert.equal(verifyCheckpoint(snapshot, checkpoint).status, 'ARGOS_CHECKPOINT_MATCHED');
  append('three');
  assert.equal(verifyCheckpoint(shelf.inspect(), checkpoint).unanchoredEventCount, 1);
  for (const name of fs.readdirSync(path.join(root, 'health')).filter(x => !x.startsWith('00000001-'))) fs.unlinkSync(path.join(root, 'health', name));
  assert.equal(shelf.inspect().eventCount, 1);
  assert.equal(verifyCheckpoint(shelf.inspect(), checkpoint).reasonCode, 'JOURNAL_TRUNCATED');
  append('replacement');
  assert.equal(verifyCheckpoint(shelf.inspect(), checkpoint).reasonCode, 'JOURNAL_CHECKPOINT_MISMATCH');
});

test('empty or cross-shelf checkpoints cannot establish anchoring', () => {
  const snapshot = {shelfId: 'health', eventCount: 0, entries: []};
  assert.equal(verifyCheckpoint(snapshot, null).status, 'ARGOS_CHECKPOINT_BLOCKED');
  assert.equal(verifyCheckpoint(snapshot, {version: 'sinbad-argos-checkpoint/1-v1', shelfId: 'other', eventCount: 1, headHash: 'a'.repeat(64)}).status, 'ARGOS_CHECKPOINT_BLOCKED');
});
