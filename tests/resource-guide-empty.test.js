const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('Blue Voyage guide keeps its heading but contains no unapproved records', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const data = fs.readFileSync(path.join(root, 'resource-data.js'), 'utf8');

  assert.match(html, /<h2>Blue Voyage Resource Guide<\/h2>/);
  assert.match(data, /const RESOURCE_DATA = \[\];/);
  assert.doesNotMatch(data, /"name"\s*:/);
});
