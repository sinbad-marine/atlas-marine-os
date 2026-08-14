'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const packageRoot = path.resolve(__dirname, '..');
const manifest = require('../package.json');

test('classifies the package root as a legacy adapter without breaking compatibility', () => {
  assert.deepEqual(manifest.sinbadSurface, {
    classification: 'LEGACY_DELIVERY_ADAPTER',
    universalCorePublicApi: false,
    deprecatedForNewCoreConsumers: true,
    replacement: 'NOT_YET_PUBLISHED'
  });
  assert.equal(
    require('@sinbad-ai/core-terminal-delivery'),
    require('@sinbad-ai/core-terminal-delivery/legacy-terminal-delivery')
  );
});

test('does not publish universal Core contracts through the legacy package surface', () => {
  for (const subpath of ['./experts', './orchestrator', './memory', './retrieval', './grounding', './library']) {
    assert.equal(Object.hasOwn(manifest.exports, subpath), false, `${subpath} must remain unpublished`);
  }
});

test('universal Core layers do not import the legacy terminal-delivery surface', () => {
  const universalDirectories = ['experts', 'orchestrator', 'memory', 'retrieval', 'grounding', 'library'];
  const forbiddenSpecifier = /(?:core-terminal-delivery|legacy-terminal-delivery|adapters[\\/]trusted-terminal-delivery-adapter)/u;
  const staticModuleReference = /(?:require\s*\(\s*|import\s*\(\s*|from\s+|import\s+)["']([^"']+)["']/gu;
  const violations = [];
  const visit = currentPath => {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (/\.(?:c?js|mjs)$/u.test(entry.name)) {
        const content = fs.readFileSync(entryPath, 'utf8');
        for (const match of content.matchAll(staticModuleReference)) {
          if (forbiddenSpecifier.test(match[1])) violations.push(path.relative(packageRoot, entryPath));
        }
      }
    }
  };
  for (const directory of universalDirectories) {
    const directoryPath = path.join(packageRoot, directory);
    assert.equal(fs.existsSync(directoryPath), true, `required universal Core directory is missing: ${directory}`);
    assert.equal(fs.statSync(directoryPath).isDirectory(), true, `universal Core path is not a directory: ${directory}`);
    visit(directoryPath);
  }
  assert.deepEqual(violations.sort(), []);
});
