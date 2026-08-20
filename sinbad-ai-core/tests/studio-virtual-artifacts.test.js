const test=require('node:test');
const assert=require('node:assert/strict');
const compiler=require('../engines/studio/virtual-artifact-compiler.js');

const request={instruction:'Responsive web sayfası, Node programı ve SVG animasyon hazırla',projectName:'Sinbad Studio Demo',audience:'owner',acceptanceCriteria:'preview and tests'};

test('compiles deterministic web software and animation artifacts in memory only',()=>{
  const first=compiler.compile(request),second=compiler.compile(request);
  assert.deepEqual(first,second);
  assert.equal(first.status,'VIRTUAL_ARTIFACTS_READY');
  assert.deepEqual(first.io,{filesystem:false,network:false,commands:false});
  assert.deepEqual(first.artifacts.map(x=>x.path),[
    'web/index.html','web/styles.css','web/app.js','software/README.md','software/src/index.js','software/tests/index.test.js','animation/storyboard.json','animation/preview.svg'
  ]);
  assert.ok(first.totalBytes>0&&first.totalBytes<=compiler.MAX_TOTAL_BYTES);
  assert.ok(Object.isFrozen(first.artifacts));
});

test('virtual content cannot inject executable markup through the brief',()=>{
  const result=compiler.compile({...request,instruction:'Web sayfası ve SVG animasyon hazırla </script><img src=x onerror=alert(1)>',projectName:'../../escape'});
  assert.equal(result.status,'VIRTUAL_ARTIFACTS_READY');
  assert.ok(result.artifacts.every(item=>!item.path.includes('..')&&!item.path.startsWith('/')&&!item.path.includes('\\')));
  const page=result.artifacts.find(item=>item.path==='web/index.html').content;
  const svg=result.artifacts.find(item=>item.path==='animation/preview.svg').content;
  assert.doesNotMatch(page,/<img src=x/);
  assert.doesNotMatch(svg,/<img src=x/);
  assert.match(page,/&lt;\/script&gt;/);
});

test('approval and clarification requests produce no artifacts',()=>{
  for(const instruction of ['Bir şey hazırla','Web sitesini canlıya deploy et ve API key kullan']){
    const result=compiler.compile({instruction});
    assert.equal(result.status,'VIRTUAL_ARTIFACTS_BLOCKED');
    assert.deepEqual(result.artifacts,[]);
    assert.deepEqual(result.io,{filesystem:false,network:false,commands:false});
  }
});

test('compiler exports no writer runner publisher or network adapter',()=>{
  assert.deepEqual(Object.keys(compiler).sort(),['MAX_ARTIFACTS','MAX_TOTAL_BYTES','MODE','VERSION','compile','isAuthenticBundle']);
  for(const field of ['write','run','execute','publish','deploy','fetch'])assert.equal(field in compiler,false);
});

test('bundle authenticity is process-local and cannot be copied',()=>{
  const bundle=compiler.compile(request);
  assert.equal(compiler.isAuthenticBundle(bundle),true);
  assert.equal(compiler.isAuthenticBundle({...bundle}),false);
  assert.equal(compiler.isAuthenticBundle(JSON.parse(JSON.stringify(bundle))),false);
});
