const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');

test('routes end users to Captain Sinbad instead of duplicate library cards',()=>{
  assert.doesNotMatch(html,/class="module-card"[^>]*data-cloud-bucket="nautical-publications"/);
  assert.doesNotMatch(html,/class="module-card"[^>]*data-open="knowledge"/);
  assert.match(html,/data-open="sinbad"/);
  assert.match(html,/grounded citations/);
});

test('preserves source administration, cloud ingestion and chart access',()=>{
  assert.match(html,/id="cloudBucketSelect"/);
  assert.match(html,/option value="nautical-publications"/);
  assert.match(html,/data-open="document-submissions"/);
  assert.match(html,/data-cloud-bucket="nautical-charts"/);
  assert.doesNotMatch(html,/Approved official source catalogue/,'retired Captain Sources panel must not return');
});
