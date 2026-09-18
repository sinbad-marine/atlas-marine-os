'use strict';
// Coding tasks: the answer must contain one JavaScript code block defining the named function.
// The block is executed in an isolated vm context (no require, no process, 2 s budget) against
// gold test cases. No model judges anything.
const vm=require('node:vm');

function extractCode(answer){
  const text=String(answer||'');
  const fenced=[...text.matchAll(/```(?:javascript|js|node)?\s*\n([\s\S]*?)```/gu)].map(m=>m[1]);
  if(fenced.length)return fenced.join('\n');
  const loose=/(?:^|\n)\s*(?:function\s+\w+\s*\(|const\s+\w+\s*=\s*(?:\([^)]*\)|\w+)\s*=>)[\s\S]*$/u.exec(text);
  return loose?loose[0]:'';
}
function approxEqual(actual,expected,tolerance){
  if(typeof expected==='number'&&typeof actual==='number')return Math.abs(actual-expected)<=(tolerance??1e-6);
  if(Array.isArray(expected)&&Array.isArray(actual))return expected.length===actual.length&&expected.every((value,i)=>approxEqual(actual[i],value,tolerance));
  return JSON.stringify(actual)===JSON.stringify(expected);
}
function runTask(answer,task){
  const code=extractCode(answer);
  if(!code.trim())return {outcome:'FAIL',observed:'NO_CODE',detail:{cases:[],error:'no code block found'}};
  const context=vm.createContext({Math,Number,String,Array,Object,JSON,parseFloat,parseInt,isNaN,isFinite});
  try{
    vm.runInContext(code,context,{timeout:2000,filename:`${task.id}.js`});
    const fn=context[task.functionName];
    if(typeof fn!=='function')return {outcome:'FAIL',observed:'FUNCTION_MISSING',detail:{cases:[],error:`function ${task.functionName} not defined`}};
    const cases=task.cases.map(testCase=>{
      try{const actual=vm.runInContext(`__fn(...__args)`,Object.assign(context,{__fn:fn,__args:testCase.args}),{timeout:2000});const pass=approxEqual(actual,testCase.expected,task.tolerance);return {args:testCase.args,expected:testCase.expected,actual,pass};}
      catch(error){return {args:testCase.args,expected:testCase.expected,actual:null,pass:false,error:String(error?.message||error)};}
    });
    const passed=cases.filter(c=>c.pass).length;
    return {outcome:passed===cases.length?'PASS':passed?'PARTIAL':'FAIL',observed:`${passed}/${cases.length}`,detail:{cases}};
  }catch(error){return {outcome:'FAIL',observed:'RUNTIME_ERROR',detail:{cases:[],error:String(error?.message||error)}};}
}
module.exports=Object.freeze({extractCode,approxEqual,runTask});
