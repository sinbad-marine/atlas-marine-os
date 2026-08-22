const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');

test('Academy is a separate Windows-style classroom with complete window controls',()=>{
  assert.match(html,/id="openSinbadAcademyClassroom"/);
  assert.match(html,/id="sinbadAcademyWindow"[^>]*role="dialog"/);
  assert.match(html,/id="academyWindowTitlebar"/);
  assert.match(html,/id="minimizeSinbadAcademy"/);
  assert.match(html,/id="maximizeSinbadAcademy"/);
  assert.match(html,/id="closeSinbadAcademy"/);
  assert.match(html,/id="academyModule"/);
  assert.match(html,/id="academyOutput"/);
});

test('classroom can move, resize, maximize, minimize, close and restore its saved bounds',()=>{
  assert.match(css,/\.academy-window\{[^}]*position:fixed[^}]*resize:both/s);
  assert.match(css,/\.academy-window\.maximized\{/);
  assert.match(css,/\.academy-window\.minimized\{/);
  assert.match(app,/function openSinbadAcademyWindow\(\)/);
  assert.match(app,/function closeSinbadAcademyWindow\(\)/);
  assert.match(app,/function minimizeSinbadAcademyWindow\(\)/);
  assert.match(app,/function maximizeSinbadAcademyWindow\(\)/);
  assert.match(app,/function beginSinbadAcademyDrag\(event\)/);
  assert.match(app,/function moveSinbadAcademyWindow\(event\)/);
  assert.match(app,/atlas_sinbad_academy_window/);
});

test('Academy course and quiz handlers remain bound after moving into the classroom',()=>{
  assert.match(app,/\$\('startAcademyLesson'\)\?\.addEventListener\('click',renderAcademyLesson\)/);
  assert.match(app,/\$\('startAcademyQuiz'\)\?\.addEventListener\('click',renderAcademyQuiz\)/);
  assert.match(app,/\$\('academyModule'\)\?\.value/);
});
