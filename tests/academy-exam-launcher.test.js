const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const launcher=require('../tools/start-academy-exams.js');

test('local launcher requires an explicit exam project and separate bounded ports',()=>{
  assert.throws(()=>launcher.parseArgs([]),/EXAM_PROJECT_ROOT_REQUIRED/);
  const result=launcher.parseArgs(['--exam-root','exam','--academy-port','4173','--exam-port','4192']);
  assert.equal(result.examRoot,path.resolve('exam'));assert.equal(result.academyPort,4173);assert.equal(result.examPort,4192);
  assert.equal(result.reviewPort,4177);
  const defaults=launcher.parseArgs(['--exam-root','exam']);assert.equal(defaults.academyPort,4173);assert.equal(defaults.examPort,4192);assert.equal(defaults.reviewPort,4177);
  assert.throws(()=>launcher.parseArgs(['--exam-root','exam','--academy-port','4192','--exam-port','4192']),/EXAM_PORT_INVALID/);
  assert.throws(()=>launcher.parseArgs(['--exam-root','exam','--review-port','4192']),/REVIEW_PORT_INVALID/);
});

test('local launcher passes the selected Academy port through the preview server environment',()=>{
  const source=require('node:fs').readFileSync(require.resolve('../tools/start-academy-exams.js'),'utf8');
  assert.match(source,/SINBAD_PREVIEW_PORT:String\(academyPort\)/);
  assert.match(source,/academy\.html\?examPort=\$\{examPort\}/);
  assert.doesNotMatch(source,/serve-pages-preview\.js','--port'/);
});
