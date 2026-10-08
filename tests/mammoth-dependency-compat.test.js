'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const JSZip=require('jszip');
const mammoth=require('mammoth');
const browserMammoth=require('mammoth/mammoth.browser.min.js');
const cli=require.resolve('mammoth/bin/mammoth');
const sample='SINBAD synthetic document — human review';
const run=(args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:10000});

async function documentBuffer(){
  const zip=new JSZip();
  zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml',`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${sample}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({type:'nodebuffer'});
}

test('Mammoth CLI retains help and rejects invalid arguments',()=>{
  const help=run(['--help']);assert.ifError(help.error);assert.equal(help.status,0,help.stderr);
  for(const option of ['--output-format','--output-dir','--style-map'])assert.ok(help.stdout.includes(option));
  const invalid=run(['--not-a-mammoth-option']);assert.ifError(invalid.error);assert.equal(invalid.status,2);assert.match(invalid.stderr,/usage:/i);
});

test('Mammoth CLI converts a synthetic DOCX with compatible positional and option arguments',async t=>{
  const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'sinbad-mammoth-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const input=path.join(dir,'synthetic.docx'),output=path.join(dir,'output.html');
  fs.writeFileSync(input,await documentBuffer());
  const stdout=run([input,'--output-format','html']);assert.ifError(stdout.error);assert.equal(stdout.status,0,stdout.stderr);assert.match(stdout.stdout,/<p>SINBAD synthetic document — human review<\/p>/);
  const file=run([input,output]);assert.ifError(file.error);assert.equal(file.status,0,file.stderr);assert.equal(fs.readFileSync(output,'utf8'),stdout.stdout);
});

test('Node and shipped browser Mammoth extract the same synthetic DOCX text',async()=>{
  const buffer=await documentBuffer();
  const server=await mammoth.extractRawText({buffer});
  const browser=await browserMammoth.extractRawText({arrayBuffer:buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)});
  assert.equal(server.value,sample+'\n\n');assert.equal(browser.value,server.value);
});

test('Node and shipped browser Mammoth reject malformed DOCX without an extracted result',async()=>{
  const buffer=Buffer.from('Not a ZIP or DOCX file');
  await assert.rejects(()=>mammoth.extractRawText({buffer}));
  await assert.rejects(()=>browserMammoth.extractRawText({arrayBuffer:buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)}));
});

test('CLI dependency remediation keeps the shipped Mammoth browser asset unchanged',()=>{
  const bytes=fs.readFileSync(require.resolve('mammoth/mammoth.browser.min.js'));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'0180991546a6dab1e03e387e8273cd7e8a74957dfb6b3eae7c66a7d8de7f5926');
});
