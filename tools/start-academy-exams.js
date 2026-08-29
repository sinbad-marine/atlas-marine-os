'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');

function parseArgs(argv){
  const value=(name,fallback)=>{const position=argv.indexOf(name);return position>=0&&argv[position+1]!==undefined?argv[position+1]:fallback;};
  const index=argv.indexOf('--exam-root');
  if(index<0||!argv[index+1])throw new Error('EXAM_PROJECT_ROOT_REQUIRED');
  const examRoot=path.resolve(argv[index+1]);
  const academyPort=Number(value('--academy-port',4173));
  const examPort=Number(value('--exam-port',4192));
  const reviewPort=Number(value('--review-port',4177));
  if(!Number.isInteger(academyPort)||academyPort<1024||academyPort>65535)throw new Error('ACADEMY_PORT_INVALID');
  if(!Number.isInteger(examPort)||examPort<1024||examPort>65535||examPort===academyPort)throw new Error('EXAM_PORT_INVALID');
  if(!Number.isInteger(reviewPort)||reviewPort<1024||reviewPort>65535||[academyPort,examPort].includes(reviewPort))throw new Error('REVIEW_PORT_INVALID');
  return Object.freeze({examRoot,academyPort,examPort,reviewPort});
}
function validateExamRoot(examRoot){
  if(!path.isAbsolute(examRoot))throw new Error('EXAM_PROJECT_ROOT_MUST_BE_ABSOLUTE');
  for(const relative of ['package.json','student-web/server.mjs','student-web/public/index.html'])if(!fs.statSync(path.join(examRoot,...relative.split('/'))).isFile())throw new Error(`EXAM_PROJECT_FILE_MISSING:${relative}`);
  return true;
}
function launch({examRoot,academyPort,examPort,reviewPort}){
  validateExamRoot(examRoot);
  const academy=spawn(process.execPath,['tools/serve-pages-preview.js'],{cwd:path.resolve(__dirname,'..'),stdio:'inherit',windowsHide:true,env:{...process.env,SINBAD_PREVIEW_PORT:String(academyPort)}});
  const exam=spawn(process.execPath,['student-web/server.mjs'],{cwd:examRoot,stdio:'inherit',windowsHide:true,env:{...process.env,SINBAD_STUDENT_WEB_PORT:String(examPort)}});
  const review=spawn(process.execPath,['review-console/server.mjs'],{cwd:examRoot,stdio:'inherit',windowsHide:true,env:{...process.env,SINBAD_REVIEW_PORT:String(reviewPort)}});
  const children=[academy,exam,review];let stopping=false;
  const stop=()=>{if(stopping)return;stopping=true;for(const child of children)if(!child.killed)child.kill();};
  for(const child of children)child.once('exit',code=>{if(!stopping&&code!==0){process.exitCode=code||1;stop();}});
  process.once('SIGINT',stop);process.once('SIGTERM',stop);process.once('exit',stop);
  process.stdout.write(`SINBAD Academy: http://127.0.0.1:${academyPort}/academy.html?examPort=${examPort}\nExam Intelligence: http://127.0.0.1:${examPort}/\nOwner Soru Doğrulama: http://127.0.0.1:${reviewPort}/\nLOCAL SYNTHETIC ONLY — STUDENT RELEASE REMAINS BLOCKED\n`);
  return Object.freeze({academy,exam,review,stop});
}
if(require.main===module){try{launch(parseArgs(process.argv.slice(2)));}catch(error){process.stderr.write(`${error.message}\n`);process.exitCode=1;}}
module.exports=Object.freeze({parseArgs,validateExamRoot,launch});
