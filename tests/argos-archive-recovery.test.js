'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const shelfApi = require('../sinbad-ai-core/argos-event-shelf');
const {recordHealth} = require('../tools/argos-record-health');
const {loadArchiveShelves} = require('../tools/argos-load-archive-shelves');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'argos-recovery-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const runtime = path.join(root, 'runtime'), archive = path.join(root, 'archive');
  const shelf = shelfApi.create({root: runtime, shelfId: 'assurance-runs', maxEvents: 10});
  shelf.append({eventId: 'assurance-start', observedAt: '2026-09-03T00:00:00.000Z', actorId: 'argos',
    kind: 'RUN_STARTED', targetRef: 'operation/assurance', outcome: 'RECORDED', evidenceHash: 'a'.repeat(64)});
  recordHealth({root: path.join(runtime, 'health-runs'), observations: [], now: '2026-09-03T00:00:00.000Z', runId: 'health-recovery'});
  const key = crypto.randomBytes(32).toString('base64');
  function cli(args, overrides = {}) {
    const env = {...process.env};
    for (const name of Object.keys(env)) if (name.startsWith('ARGOS_')) delete env[name];
    Object.assign(env, {ARGOS_LEDGER_ROOT: runtime, ARGOS_ARCHIVE_ROOT: archive, ARGOS_ARCHIVE_KEY: key}, overrides);
    const result = spawnSync(process.execPath, [path.resolve('tools/argos-encrypted-archive.js'), ...args],
      {env, encoding: 'utf8', timeout: 10000});
    assert.ifError(result.error);
    assert.ok(!(result.stdout + result.stderr).includes(key));
    return result;
  }
  return {root, runtime, archive, cli};
}

test('real archive includes nested health records and verifies after source removal and relocation', t => {
  const f = fixture(t), result = f.cli(['create']);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.deepEqual(summary.shelves.map(s => [s.shelfId, s.eventCount]), [
    ['assurance-runs', 1], ['health-runs__health-recovery__health', 10]
  ]);
  const archiveFile = path.join(f.archive, fs.readdirSync(f.archive)[0]);
  const bytes = fs.readFileSync(archiveFile);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), summary.archiveSha256);
  assert.ok(!bytes.toString().includes('health-recovery'));
  const relocated = path.join(f.root, 'new-host');
  fs.mkdirSync(relocated);
  const destination = path.join(relocated, 'saved.json');
  fs.copyFileSync(archiveFile, destination, fs.constants.COPYFILE_EXCL);
  assert.ok(f.runtime.startsWith(f.root + path.sep));
  fs.rmSync(f.runtime, {recursive: true});
  const verified = f.cli(['verify', destination], {ARGOS_ARCHIVE_ROOT: relocated});
  assert.equal(verified.status, 0, verified.stderr);
  assert.deepEqual(JSON.parse(verified.stdout).shelves, summary.shelves);
  assert.equal(fs.existsSync(f.runtime), false);
  assert.deepEqual(fs.readFileSync(destination), bytes);
});

test('missing/wrong key and tampered ciphertext fail without changing archives', t => {
  const f = fixture(t);
  assert.equal(f.cli(['create'], {ARGOS_ARCHIVE_KEY: ''}).status, 1);
  assert.equal(f.cli(['create']).status, 0);
  const target = path.join(f.archive, fs.readdirSync(f.archive)[0]);
  const original = fs.readFileSync(target);
  assert.equal(f.cli(['verify', target], {ARGOS_ARCHIVE_KEY: crypto.randomBytes(32).toString('base64')}).status, 1);
  assert.deepEqual(fs.readFileSync(target), original);
  const changed = JSON.parse(original); changed.ciphertext = (changed.ciphertext[0] === 'A' ? 'B' : 'A') + changed.ciphertext.slice(1);
  fs.writeFileSync(target, JSON.stringify(changed));
  assert.equal(f.cli(['verify', target]).status, 1);
});

test('nested corruption cannot be silently omitted and malformed contents are not printed', t => {
  const f = fixture(t), directory = path.join(f.runtime, 'health-runs', 'health-recovery', 'health');
  const event = path.join(directory, fs.readdirSync(directory)[0]);
  fs.writeFileSync(event, '{ private-sentinel-content');
  const result = f.cli(['create']);
  assert.equal(result.status, 1);
  assert.ok(!result.stderr.includes('private-sentinel-content'));
  assert.equal(fs.existsSync(f.archive), false);
});

test('empty trees and unexpected files cannot become an apparently complete archive', t => {
  const f = fixture(t), empty = path.join(f.root, 'empty');
  fs.mkdirSync(empty);
  assert.throws(() => loadArchiveShelves(empty), /NO_EVENTS/);
  fs.writeFileSync(path.join(f.runtime, 'private.txt'), 'not audit metadata');
  assert.throws(() => loadArchiveShelves(f.runtime), /UNEXPECTED_ENTRY/);
});

test('linked archive ancestors are rejected before creating directories outside the chosen root', t => {
  const f = fixture(t), outside = path.join(f.root, 'outside'), link = path.join(f.root, 'link');
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(f.cli(['create'], {ARGOS_ARCHIVE_ROOT: path.join(link, 'child')}).status, 1);
  assert.equal(fs.existsSync(path.join(outside, 'child')), false);
  assert.throws(() => loadArchiveShelves(link), /LINK_BLOCKED/);
});
