const test=require('node:test');
const assert=require('node:assert/strict');
const compiler=require('../engines/studio/virtual-artifact-compiler.js');
const verifier=require('../engines/studio/static-artifact-verifier.js');

const request={instruction:'Responsive web sayfası, Node programı ve SVG animasyon hazırla',projectName:'Verified Demo',audience:'owner',acceptanceCriteria:'static verification'};

test('creates a deterministic hash-bound static preview report without I/O',()=>{
  const bundle=compiler.compile(request),first=verifier.verify(bundle),second=verifier.verify(bundle);
  assert.deepEqual(first,second);
  assert.equal(first.status,'STATIC_PREVIEW_READY');
  assert.match(first.manifestHash,/^[a-f0-9]{64}$/);
  assert.deepEqual(first.entrypoints,['web/index.html','software/README.md','animation/preview.svg']);
  assert.deepEqual(first.io,{filesystem:false,network:false,commands:false,render:false});
  assert.equal(verifier.isAuthenticReport(first),true);
  assert.equal(verifier.isAuthenticReport({...first}),false);
});

test('rejects copied and serialized bundles before inspection',()=>{
  const bundle=compiler.compile(request);
  for(const copy of [{...bundle},JSON.parse(JSON.stringify(bundle))]){
    const result=verifier.verify(copy);
    assert.equal(result.status,'STATIC_PREVIEW_BLOCKED');
    assert.equal(result.reason,'AUTHENTIC_BUNDLE_REQUIRED');
    assert.deepEqual(result.manifest,[]);
  }
});

test('blocks network command runtime and nonlocal module capabilities',()=>{
  const samples=[
    {path:'web/app.js',mediaType:'text/javascript; charset=utf-8',content:"fetch('https://evil.test')",bytes:26},
    {path:'software/src/run.js',mediaType:'text/javascript; charset=utf-8',content:"require('node:child_process').exec('x')",bytes:38},
    {path:'software/src/eval.js',mediaType:'text/javascript; charset=utf-8',content:"eval('2+2')",bytes:11}
  ];
  for(const sample of samples){
    const codes=verifier.inspectArtifact(sample).map(x=>x.code);
    assert.ok(codes.includes('ACTIVE_CODE_CAPABILITY_FORBIDDEN'));
  }
});

test('blocks active HTML SVG CSS and malformed JSON content',()=>{
  const samples=[
    [{path:'web/index.html',mediaType:'text/html; charset=utf-8',content:'<iframe src="x"></iframe>'},'HTML_ACTIVE_CONTENT_FORBIDDEN'],
    [{path:'animation/preview.svg',mediaType:'image/svg+xml; charset=utf-8',content:'<svg><script>alert(1)</script></svg>'},'SVG_ACTIVE_CONTENT_FORBIDDEN'],
    [{path:'web/styles.css',mediaType:'text/css; charset=utf-8',content:'@import "theme.css";'},'CSS_EXTERNAL_CONTENT_FORBIDDEN'],
    [{path:'animation/storyboard.json',mediaType:'application/json; charset=utf-8',content:'{"broken":'},'JSON_SYNTAX_INVALID']
  ];
  for(const [sample,expected] of samples)assert.ok(verifier.inspectArtifact({...sample,bytes:Buffer.byteLength(sample.content)}).some(x=>x.code===expected),expected);
});

test('blocks an authentic brief that asks generated content to reference the network',()=>{
  const bundle=compiler.compile({...request,instruction:'Web sayfası hazırla ve https://evil.example kaynağını kullan'}),result=verifier.verify(bundle);
  assert.equal(result.status,'STATIC_PREVIEW_BLOCKED');
  assert.equal(result.reason,'STATIC_POLICY_VIOLATION');
  assert.ok(result.issues.some(x=>x.code==='EXTERNAL_REFERENCE_FORBIDDEN'));
  assert.deepEqual(result.manifest,[]);
});

test('detects media mismatches controls and syntax without executing code',()=>{
  assert.ok(verifier.inspectArtifact({path:'web/app.js',mediaType:'text/html; charset=utf-8',content:'const x=1;',bytes:10}).some(x=>x.code==='MEDIA_TYPE_MISMATCH'));
  assert.ok(verifier.inspectArtifact({path:'web/app.js',mediaType:'text/javascript; charset=utf-8',content:'const =\u0000;',bytes:9}).some(x=>x.code==='UNSAFE_CONTROL_CHARACTER'));
  assert.ok(verifier.inspectArtifact({path:'web/app.js',mediaType:'text/javascript; charset=utf-8',content:'const =;',bytes:8}).some(x=>x.code==='JAVASCRIPT_SYNTAX_INVALID'));
});
