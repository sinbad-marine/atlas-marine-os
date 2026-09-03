'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function assertUnlinked(target) {
  let current = path.resolve(target);
  while (true) {
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error('ARGOS_ARCHIVE_LINK_BLOCKED');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function loadArchiveShelves(root) {
  assertUnlinked(root);
  const shelves = [], ids = new Set();
  let totalBytes = 0, totalFiles = 0, totalDirectories = 0;
  function visit(directory, segments) {
    const stat = fs.lstatSync(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('ARGOS_ARCHIVE_DIRECTORY_INVALID');
    if (segments.length > 4 || ++totalDirectories > 400) throw new Error('ARGOS_ARCHIVE_TREE_LIMIT');
    const names = fs.readdirSync(directory).sort(), files = [], directories = [];
    for (const name of names) {
      const target = path.join(directory, name), item = fs.lstatSync(target);
      if (item.isSymbolicLink()) throw new Error('ARGOS_ARCHIVE_LINK_BLOCKED');
      if (item.isDirectory() && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(name)) directories.push(name);
      else if (item.isFile() && /^\d{8}-[A-Za-z0-9._-]+\.json$/.test(name)) {
        if (++totalFiles > 100000 || item.size > 1048576 || (totalBytes += item.size) > 67108864) throw new Error('ARGOS_ARCHIVE_SIZE_LIMIT');
        files.push(name);
      } else throw new Error('ARGOS_ARCHIVE_UNEXPECTED_ENTRY');
    }
    if (files.length && directories.length) throw new Error('ARGOS_ARCHIVE_MIXED_LAYOUT');
    if (files.length) {
      const shelfId = segments.join('__');
      if (!/^[A-Za-z0-9._-]{1,120}$/.test(shelfId) || ids.has(shelfId) || shelves.length >= 100) throw new Error('ARGOS_ARCHIVE_SHELF_LIMIT');
      ids.add(shelfId);
      const entries = files.map((name, index) => {
        const entry = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
        if (name !== `${String(index + 1).padStart(8, '0')}-${entry.eventId}.json`) throw new Error('ARGOS_ARCHIVE_SEQUENCE_INVALID');
        return entry;
      });
      shelves.push({version: 'sinbad-argos-event-shelf/1-v1', shelfId, eventCount: entries.length,
        headHash: entries[entries.length - 1].eventHash, entries});
    }
    for (const name of directories) visit(path.join(directory, name), [...segments, name]);
    if (JSON.stringify(names) !== JSON.stringify(fs.readdirSync(directory).sort())) throw new Error('ARGOS_ARCHIVE_SOURCE_CHANGED');
  }
  visit(path.resolve(root), []);
  if (!shelves.length) throw new Error('ARGOS_ARCHIVE_NO_EVENTS');
  return shelves.sort((a, b) => a.shelfId.localeCompare(b.shelfId, 'en'));
}

function inventoryHash(shelves) {
  return crypto.createHash('sha256').update(JSON.stringify(shelves)).digest('hex');
}

module.exports = Object.freeze({loadArchiveShelves, inventoryHash, assertUnlinked});
