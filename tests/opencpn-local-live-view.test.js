const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const bridge=fs.readFileSync('bridge/sinbad-bridge.ps1','utf8');

test('ENC workspace offers a local-only OpenCPN live view with web chart fallback',()=>{
  assert.match(html,/id="encOpenCpnView"/);
  assert.match(html,/id="encWebChartView"/);
  assert.match(html,/id="encOpenCpnFrame"/);
  assert.match(html,/id="encOpenCpnControlToggle"/);
  assert.match(app,/\/opencpn\/status/);
  assert.match(app,/\/opencpn\/frame\?ts=/);
  assert.match(app,/setOpenCpnPreviewMode\(false\)/);
  assert.match(app,/URL\.revokeObjectURL/);
  assert.match(app,/\/opencpn\/start/);
  assert.match(app,/\/opencpn\/input/);
});

test('Bridge captures only the visible local OpenCPN window and never reads chart files',()=>{
  assert.match(bridge,/Get-OpenCpnWindowFrame/);
  assert.match(bridge,/SinbadNativeWindow\]::PrintWindow/);
  assert.match(bridge,/\$path -eq '\/opencpn\/frame'/);
  assert.match(bridge,/\$path -eq '\/opencpn\/start'/);
  assert.match(bridge,/\$path -eq '\/opencpn\/input'/);
  assert.match(bridge,/@\('click','rightClick','middleClick','doubleClick','drag','wheel','text','key','shortcut'\)/);
  assert.match(bridge,/OPENCPN_INPUT_KEY_DENIED/);
  assert.doesNotMatch(bridge,/SendKeys|Alt\+Tab|VK_LWIN/i);
  assert.doesNotMatch(bridge,/o-charts.*ReadAllBytes|ENC.*ReadAllBytes/i);
});
