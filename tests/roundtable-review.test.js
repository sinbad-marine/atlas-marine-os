const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const tool=fs.readFileSync(path.resolve(__dirname,'../tools/roundtable-review.js'),'utf8');

test('round table requires explicit reviewers and supports a bounded base ref',()=>{
  assert.match(tool,/ROUNDTABLE_REVIEWERS must explicitly select/);
  assert.match(tool,/ROUNDTABLE_BASE_REF is invalid/);
  assert.match(tool,/base\?`\$\{base\}\.\.\.HEAD`:'HEAD'/);
});

test('round table supports Claude and Grok while keeping Gemini opt-in',()=>{
  assert.match(tool,/https:\/\/api\.anthropic\.com\/v1\/messages/);
  assert.match(tool,/https:\/\/api\.x\.ai\/v1\/responses/);
  assert.match(tool,/const factories=\{claude,grok,gemini\}/);
  assert.doesNotMatch(tool,/if\(process\.env\.GEMINI_API_KEY\)reviewers\.gemini/);
});

test('round table fails rather than truncating an oversized review diff',()=>{
  assert.match(tool,/Review diff exceeds/);
  assert.doesNotMatch(tool,/DIFF TRUNCATED/);
});
