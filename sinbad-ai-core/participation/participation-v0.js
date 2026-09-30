'use strict';
// SINBAD Active Participation Gate v0 - the pure part. No file system, no git, no network, no model, no clock
// (callers pass `now`). It validates WorkOrders and AgentReports, decides preflight and delegation, labels what an
// agent report may and may not be believed, reduces a verified ledger into task states and renders the Owner summary.
// Persistence and observation live in tools/sinbad-participation.js; this module only sees plain data.
//
// Authority rules (same stance as the rest of Project 2): an agent's report is a CLAIM. Only what SINBAD itself
// observed (git, locally) can be VERIFIED or CONTRADICTED; everything else stays UNVERIFIED and is never promoted.
const crypto=require('node:crypto');

const VERSION='sinbad-participation/0-v1';
const PREFLIGHT_TTL_MS=60*60*1000;
const NAME=/^[A-Za-z0-9._-]{1,40}$/u;
const SHA=/^[0-9a-f]{40}$/u;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const BRANCH=/^[A-Za-z0-9._/-]{1,120}$/u;
const ORDER_KEYS=Object.freeze(['taskId','kind','title','origin','originNote','ownerStatement','agentId','baseSha','branch','expectedFiles','context','plan','decisions','rejectedAlternatives','hold','sinbadCapabilityBefore','sinbadCapabilityAfter']);
const REPORT_KEYS=Object.freeze(['taskId','agentId','baseSha','resultingSha','branch','changedFiles','actions','failures','evidence','tests','result','lessons','decisions','rejectedAlternatives','capabilityGained','reportedAt']);
const TEST_KEYS=Object.freeze(['name','command','reportedOutcome']);
const TEST_OUTCOMES=Object.freeze(['PASS','FAIL','NOT_RUN']);
const INDEPENDENT_SOURCES=Object.freeze(['SINBAD_LOCAL_RERUN','CI_RUN_VERIFIED']);
const NOT_RECORDED='NOT RECORDED';

const SECRET_PATTERNS=Object.freeze([
  ['PRIVATE_KEY',/-----BEGIN [A-Z ]*PRIVATE KEY-----/u],
  ['JWT',/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/u],
  ['OPENAI_STYLE_KEY',/\bsk-[A-Za-z0-9]{20,}/u],
  ['GITHUB_TOKEN',/\bgh[pousr]_[A-Za-z0-9]{30,}/u],
  ['SUPABASE_KEY',/\bsb_(?:publishable|secret)_[A-Za-z0-9_-]{10,}/u],
  ['AWS_KEY',/\bAKIA[0-9A-Z]{16}\b/u],
  ['BEARER',/\bBearer\s+[A-Za-z0-9._~+/-]{20,}/iu],
  ['ASSIGNED_SECRET',/\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9._/+-]{12,}/iu]
]);

// ---------- canonical form and hashes ----------
function canonical(value){
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
const sha256=text=>crypto.createHash('sha256').update(Buffer.from(String(text),'utf8')).digest('hex');
const bodyHash=body=>sha256(canonical(body));

function isPlain(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}
// exact own data properties, no extras, no missing - nothing is silently filled in
function exactKeys(v,names){
  if(!isPlain(v)||Object.getOwnPropertySymbols(v).length)return null;
  const keys=Object.getOwnPropertyNames(v);
  if(keys.length!==names.length||names.some(k=>!keys.includes(k)))return null;
  for(const k of keys){const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!Object.hasOwn(d,'value'))return null;}
  return v;
}
function secretFinding(value){
  if(typeof value==='string'){for(const [name,re] of SECRET_PATTERNS)if(re.test(value))return name;return null;}
  if(Array.isArray(value)){for(const x of value){const f=secretFinding(x);if(f)return f;}return null;}
  if(isPlain(value)){for(const x of Object.values(value)){const f=secretFinding(x);if(f)return f;}return null;}
  return null;
}
const text=(v,max,min=1)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const textList=(v,maxItems,maxLen)=>Array.isArray(v)&&v.length<=maxItems&&v.every(x=>text(x,maxLen));

// ---------- safe relative paths ----------
// Returns the canonical form (forward slashes, no trailing slash for files, one trailing slash for a directory
// entry) or null. Anything that could escape the repository or name a git internal is refused.
function normalizePath(input){
  if(typeof input!=='string'||input.length<1||input.length>300)return null;
  if(/[\\\0\u0001-\u001f\u007f*?[\]{}~]/u.test(input))return null;
  if(input.startsWith('/')||/^[A-Za-z]:/u.test(input))return null;
  const dir=input.endsWith('/');
  const segments=(dir?input.slice(0,-1):input).split('/');
  if(segments.some(s=>s===''||s==='.'||s==='..'||s.toLowerCase()==='.git'))return null;
  return segments.join('/')+(dir?'/':'');
}
// `a` and `b` are canonical paths. Equal, or one is a directory entry that contains the other.
function overlapKind(a,b){
  const x=a.toLowerCase(),y=b.toLowerCase();
  if(x===y)return 'EXACT';
  if(x.endsWith('/')&&y.startsWith(x))return 'PREFIX';
  if(y.endsWith('/')&&x.startsWith(y))return 'PREFIX';
  return null;
}
function firstOverlap(listA,listB){
  for(const a of listA)for(const b of listB){const kind=overlapKind(a,b);if(kind)return {kind,a,b};}
  return null;
}
const covered=(file,scope)=>scope.some(entry=>overlapKind(file,entry)!==null&&(entry.endsWith('/')?file.toLowerCase().startsWith(entry.toLowerCase()):entry.toLowerCase()===file.toLowerCase()));
const expectedFilesHash=list=>sha256(canonical([...list].map(x=>String(x).toLowerCase()).sort()));

// ---------- WorkOrder ----------
function validateOrder(input){
  const errors=[];
  const v=exactKeys(input,ORDER_KEYS);
  if(!v)return {ok:false,errors:['ORDER_KEYS_NOT_EXACT'],order:null};
  if(typeof v.taskId!=='string'||!NAME.test(v.taskId))errors.push('TASK_ID_INVALID');
  if(!['phase','task'].includes(v.kind))errors.push('KIND_INVALID');
  if(!text(v.title,200))errors.push('TITLE_INVALID');
  if(!['OWNER_DIRECTED','RETROACTIVE_BOOTSTRAP'].includes(v.origin))errors.push('ORIGIN_INVALID');
  if(typeof v.originNote!=='string'||v.originNote.length>2000||(v.origin==='RETROACTIVE_BOOTSTRAP'&&v.originNote.trim().length<20))errors.push('ORIGIN_NOTE_INVALID');
  if(!text(v.ownerStatement,2000))errors.push('OWNER_STATEMENT_MISSING');
  if(typeof v.agentId!=='string'||!NAME.test(v.agentId))errors.push('AGENT_ID_INVALID');
  if(typeof v.baseSha!=='string'||!SHA.test(v.baseSha))errors.push('BASE_SHA_INVALID');
  if(typeof v.branch!=='string'||!BRANCH.test(v.branch)||v.branch.includes('..')||v.branch.startsWith('/')||v.branch.startsWith('-')||v.branch.endsWith('/')||v.branch.endsWith('.lock'))errors.push('BRANCH_INVALID');
  let files=null;
  if(!Array.isArray(v.expectedFiles)||v.expectedFiles.length<1||v.expectedFiles.length>200)errors.push('EXPECTED_FILES_INVALID');
  else{
    const norm=v.expectedFiles.map(normalizePath);
    if(norm.some(x=>x===null))errors.push('EXPECTED_FILE_UNSAFE');
    else if(new Set(norm.map(x=>x.toLowerCase())).size!==norm.length)errors.push('EXPECTED_FILES_DUPLICATE');
    else files=[...norm].sort();
  }
  if(!text(v.context,8000))errors.push('CONTEXT_MISSING');
  if(!text(v.plan,8000))errors.push('PLAN_MISSING');
  if(!textList(v.decisions,100,2000))errors.push('DECISIONS_INVALID');
  if(!textList(v.rejectedAlternatives,100,2000))errors.push('REJECTED_ALTERNATIVES_INVALID');
  if(typeof v.hold!=='boolean')errors.push('HOLD_INVALID');
  if(!text(v.sinbadCapabilityBefore,2000,10))errors.push('CAPABILITY_BEFORE_MISSING');
  if(!text(v.sinbadCapabilityAfter,2000,10))errors.push('CAPABILITY_AFTER_MISSING');
  if(text(v.sinbadCapabilityBefore,2000,10)&&v.sinbadCapabilityBefore.trim()===String(v.sinbadCapabilityAfter).trim())errors.push('CAPABILITY_DELTA_EMPTY');
  const secret=secretFinding(v);if(secret)errors.push(`SECRET_PATTERN:${secret}`);
  if(errors.length)return {ok:false,errors,order:null};
  return {ok:true,errors:[],order:Object.freeze({...v,expectedFiles:Object.freeze(files),decisions:Object.freeze([...v.decisions]),rejectedAlternatives:Object.freeze([...v.rejectedAlternatives])})};
}

// ---------- AgentReport ----------
function validateReport(input){
  const errors=[];
  const v=exactKeys(input,REPORT_KEYS);
  if(!v)return {ok:false,errors:['REPORT_KEYS_NOT_EXACT'],report:null};
  if(typeof v.taskId!=='string'||!NAME.test(v.taskId))errors.push('TASK_ID_INVALID');
  if(typeof v.agentId!=='string'||!NAME.test(v.agentId))errors.push('AGENT_ID_INVALID');
  if(typeof v.baseSha!=='string'||!SHA.test(v.baseSha))errors.push('BASE_SHA_INVALID');
  if(typeof v.resultingSha!=='string'||!SHA.test(v.resultingSha))errors.push('RESULTING_SHA_INVALID');
  if(typeof v.branch!=='string'||!BRANCH.test(v.branch))errors.push('BRANCH_INVALID');
  let files=null;
  if(!Array.isArray(v.changedFiles)||v.changedFiles.length>500)errors.push('CHANGED_FILES_INVALID');
  else{
    const norm=v.changedFiles.map(normalizePath);
    if(norm.some(x=>x===null||x.endsWith('/')))errors.push('CHANGED_FILE_UNSAFE');
    else files=[...new Set(norm)].sort();
  }
  for(const key of ['actions','failures','evidence','lessons','decisions','rejectedAlternatives'])if(!textList(v[key],100,2000))errors.push(`${key.toUpperCase()}_INVALID`);
  if(!Array.isArray(v.tests)||v.tests.length>100)errors.push('TESTS_INVALID');
  else for(const t of v.tests){
    const tt=exactKeys(t,TEST_KEYS);
    if(!tt||!text(tt.name,200)||!text(tt.command,500)||!TEST_OUTCOMES.includes(tt.reportedOutcome)){errors.push('TEST_ENTRY_INVALID');break;}
  }
  if(!text(v.result,4000))errors.push('RESULT_MISSING');
  if(!text(v.capabilityGained,2000,10))errors.push('CAPABILITY_GAINED_MISSING');
  if(typeof v.reportedAt!=='string'||!ISO.test(v.reportedAt))errors.push('REPORTED_AT_INVALID');
  const secret=secretFinding(v);if(secret)errors.push(`SECRET_PATTERN:${secret}`);
  if(errors.length)return {ok:false,errors,report:null};
  return {ok:true,errors:[],report:Object.freeze({...v,changedFiles:Object.freeze(files)})};
}

// ---------- preflight ----------
const nowMs=now=>typeof now==='string'&&ISO.test(now)?Date.parse(now):NaN;
// `others`: [{taskId, seq, delegated, expectedFiles}] - only tasks that still claim paths (caller filters).
// `observation`: {available, headSha, baseShaExists, dirtyPaths} - missing or unavailable = FAIL, never PASS.
function decidePreflight({order,now,observation,others}){
  const checks=[],reasons=[];
  const add=(id,pass,detail)=>{checks.push(Object.freeze({id,pass,detail}));if(!pass)reasons.push(`${id}${detail?`:${detail}`:''}`);};
  const valid=validateOrder(order);
  add('TASK_VALID',valid.ok,valid.ok?'':valid.errors.join(','));
  const o=valid.ok?valid.order:null;
  add('NOT_ON_HOLD',o?!o.hold:false,o&&o.hold?'task is on HOLD':'');
  add('CLOCK_VALID',Number.isFinite(nowMs(now)),'');
  const obs=observation&&typeof observation==='object'?observation:null;
  const available=Boolean(obs)&&obs.available===true&&typeof obs.headSha==='string'&&SHA.test(obs.headSha)&&Array.isArray(obs.dirtyPaths);
  add('OBSERVATION_AVAILABLE',available,available?'':String((obs&&obs.error)||'no observation'));
  add('BASE_SHA_EXISTS',available&&obs.baseShaExists===true,'');
  add('BASE_SHA_FRESH',Boolean(o)&&available&&o.baseSha===obs.headSha,o&&available&&o.baseSha!==obs.headSha?`order base ${o.baseSha.slice(0,12)} != observed head ${obs.headSha.slice(0,12)}`:'');
  const files=o?o.expectedFiles:[];
  add('PATHS_SAFE',Boolean(o)&&files.length>0&&files.every(f=>normalizePath(f)===f),'');
  let overlap=null;
  if(o&&Array.isArray(others))for(const other of others){const hit=firstOverlap(files,other.expectedFiles);if(hit){overlap={other:other.taskId,...hit};break;}}
  add('NO_OPEN_TASK_OVERLAP',Boolean(o)&&Array.isArray(others)&&overlap===null,overlap?`${overlap.kind}_OVERLAP with ${overlap.other}: ${overlap.a} ~ ${overlap.b}`:(Array.isArray(others)?'':'open tasks not supplied'));
  const dirtyHit=o&&available?firstOverlap(files,obs.dirtyPaths.map(normalizePath).filter(Boolean)):null;
  add('WORKTREE_CLEAN_IN_SCOPE',Boolean(o)&&available&&dirtyHit===null,dirtyHit?`dirty path ${dirtyHit.b} overlaps ${dirtyHit.a}`:'');
  const decision=checks.every(c=>c.pass)?'PASS':'FAIL';
  return Object.freeze({
    schema:'sinbad-preflight-decision/0-v1',taskId:o?o.taskId:null,decidedAt:nowMs(now)>=0?now:null,decision,
    observedHeadSha:available?obs.headSha:null,baseSha:o?o.baseSha:null,expectedFilesHash:o?expectedFilesHash(o.expectedFiles):null,
    dirtyPaths:available?Object.freeze([...obs.dirtyPaths].map(String).sort()):Object.freeze([]),checks:Object.freeze(checks),reasons:Object.freeze(reasons)
  });
}

// Delegation needs a PASS preflight bound to THIS order's file list and to the head that is still observed, inside
// the freshness window, and the rules must still pass when re-evaluated now against the current ledger.
function evaluateDelegation({order,state,latestPreflight,now,observation,others}){
  const reasons=[];
  const valid=validateOrder(order);
  if(!valid.ok)return {ok:false,reasons:['TASK_INVALID']};
  const o=valid.order;
  if(o.hold)reasons.push('TASK_ON_HOLD');
  if(!['OPEN','PREFLIGHT_PASSED','PREFLIGHT_FAILED'].includes(state))reasons.push(`TASK_STATE_NOT_DELEGABLE:${state}`);
  const p=latestPreflight;
  if(!p||!isPlain(p))reasons.push('NO_PREFLIGHT');
  else{
    if(p.decision!=='PASS')reasons.push('PREFLIGHT_NOT_PASS');
    if(p.taskId!==o.taskId||p.expectedFilesHash!==expectedFilesHash(o.expectedFiles)||p.baseSha!==o.baseSha)reasons.push('PREFLIGHT_NOT_BOUND_TO_ORDER');
    const age=nowMs(now)-nowMs(p.decidedAt);
    if(!Number.isFinite(age)||age<0||age>PREFLIGHT_TTL_MS)reasons.push('PREFLIGHT_STALE_TIME');
    const available=observation&&observation.available===true&&typeof observation.headSha==='string'&&SHA.test(observation.headSha);
    if(!available)reasons.push('OBSERVATION_UNAVAILABLE');
    else if(observation.headSha!==p.observedHeadSha)reasons.push('PREFLIGHT_STALE_HEAD');
  }
  const again=decidePreflight({order:o,now,observation,others});
  if(again.decision!=='PASS')reasons.push(...again.reasons.map(r=>`RECHECK_${r}`));
  return {ok:reasons.length===0,reasons};
}

// ---------- ingestion / provenance labels ----------
const LABELS=Object.freeze({VERIFIED:'VERIFIED',UNVERIFIED:'UNVERIFIED',CONTRADICTED:'CONTRADICTED'});
// observation: {available, resultingShaExists, baseIsAncestor, observedChangedFiles, branchTip}
// independentTestEvidence: [{name, resultingSha, outcome:'PASS', source}] - v0 tooling never supplies any.
function verifyReport({order,report,observation,independentTestEvidence}){
  const claims=[];let n=0;
  const claim=(kind,statement,label,basis)=>{n+=1;claims.push(Object.freeze({id:`c${String(n).padStart(3,'0')}`,kind,statement,label,basis}));};
  const scopeBreach=[];
  const obs=observation&&typeof observation==='object'?observation:null;
  const available=Boolean(obs)&&obs.available===true;
  // identity fields: a match only shows the report repeats SINBAD's record; it does not authenticate the author
  for(const [field,expected] of [['taskId',order.taskId],['agentId',order.agentId],['baseSha',order.baseSha],['branch',order.branch]]){
    if(report[field]===expected)claim(`report.${field}`,`report ${field} = ${expected}`,LABELS.UNVERIFIED,'asserted by the agent and equal to the order; v0 has no agent authentication');
    else claim(`report.${field}`,`report ${field} = ${report[field]} but the order says ${expected}`,LABELS.CONTRADICTED,'differs from the WorkOrder');
  }
  if(!available){
    claim('git.observation','local git observation unavailable',LABELS.UNVERIFIED,String((obs&&obs.error)||'no observation'));
    return finish('OBSERVATION_UNAVAILABLE');
  }
  claim('git.resulting_sha_exists',`resulting commit ${report.resultingSha.slice(0,12)} exists locally`,obs.resultingShaExists===true?LABELS.VERIFIED:LABELS.CONTRADICTED,'git cat-file');
  if(obs.resultingShaExists===true){
    claim('git.base_is_ancestor',`base ${order.baseSha.slice(0,12)} is an ancestor of the result`,obs.baseIsAncestor===true?LABELS.VERIFIED:LABELS.CONTRADICTED,'git merge-base --is-ancestor');
    const observed=Array.isArray(obs.observedChangedFiles)?[...obs.observedChangedFiles].map(normalizePath).filter(Boolean).sort():null;
    if(observed===null)claim('git.changed_files','changed files could not be observed',LABELS.UNVERIFIED,'git diff unavailable');
    else{
      const reported=[...report.changedFiles];
      const same=reported.length===observed.length&&reported.every((f,i)=>f===observed[i]);
      claim('git.changed_files',same?`changed files match the observed diff (${observed.length})`:`reported ${reported.length} changed files, observed ${observed.length}`,same?LABELS.VERIFIED:LABELS.CONTRADICTED,'git diff --name-only base result');
      for(const file of observed)if(!covered(file,order.expectedFiles))scopeBreach.push(file);
      if(scopeBreach.length)claim('scope.expected_files',`changed outside expected files: ${scopeBreach.join(', ')}`,LABELS.CONTRADICTED,'observed diff versus WorkOrder.expectedFiles');
      else claim('scope.expected_files','every observed changed file is inside the expected files',LABELS.VERIFIED,'observed diff versus WorkOrder.expectedFiles');
    }
    if(obs.branchTip===null||obs.branchTip===undefined)claim('git.branch_tip',`branch ${order.branch} not found locally`,LABELS.UNVERIFIED,'no local or remote-tracking ref');
    else claim('git.branch_tip',obs.branchTip===report.resultingSha?`branch ${order.branch} points at the result`:`branch ${order.branch} points at ${String(obs.branchTip).slice(0,12)}, not the result`,obs.branchTip===report.resultingSha?LABELS.VERIFIED:LABELS.CONTRADICTED,'git rev-parse');
  }
  // tests: an agent-reported PASS is AGENT_REPORTED_PASS and stays UNVERIFIED unless independent evidence matches
  const independent=Array.isArray(independentTestEvidence)?independentTestEvidence:[];
  for(const t of report.tests){
    const proven=t.reportedOutcome==='PASS'&&independent.some(e=>isPlain(e)&&e.name===t.name&&e.resultingSha===report.resultingSha&&e.outcome==='PASS'&&INDEPENDENT_SOURCES.includes(e.source));
    if(proven)claim('test',`${t.name}: PASS`,LABELS.VERIFIED,'independent evidence bound to the resulting commit');
    else claim('test',`${t.name}: AGENT_REPORTED_${t.reportedOutcome}`,LABELS.UNVERIFIED,'agent-reported only; no independent evidence in v0');
  }
  for(const key of ['actions','failures','evidence','lessons','decisions','rejectedAlternatives'])report[key].forEach((s,i)=>claim(`agent.${key}`,s,LABELS.UNVERIFIED,`agent assertion (${key}[${i}])`));
  claim('agent.result',report.result,LABELS.UNVERIFIED,'agent assertion');
  claim('agent.capabilityGained',report.capabilityGained,LABELS.UNVERIFIED,'agent assertion');
  const contradicted=claims.some(c=>c.label===LABELS.CONTRADICTED);
  return finish(scopeBreach.length?'SCOPE_BREACH':contradicted?'CONTRADICTED':'INGESTED');
  function finish(outcome){
    const count=l=>claims.filter(c=>c.label===l).length;
    return Object.freeze({schema:'sinbad-report-verification/0-v1',outcome,scopeBreach:Object.freeze([...scopeBreach]),counts:Object.freeze({VERIFIED:count('VERIFIED'),UNVERIFIED:count('UNVERIFIED'),CONTRADICTED:count('CONTRADICTED')}),claims:Object.freeze(claims)});
  }
}

// ---------- ledger reduction ----------
const CLAIMING_DONE=new Set(['CLOSED']);
// entries: [{sequence,eventHash,event,bodyHash,body}] in chain order, already integrity-checked by the store.
function reduceLedger(entries){
  const tasks=new Map(),order=[],rejectedReports=[];
  const ref=e=>Object.freeze({sequence:e.sequence,eventHash:e.eventHash,bodyHash:e.bodyHash,observedAt:e.event.observedAt});
  for(const e of entries){
    const {kind,targetRef}=e.event;const body=e.body;
    if(kind==='report.rejected'){rejectedReports.push({ref:ref(e),body});continue;}
    const id=targetRef.startsWith('task/')?targetRef.slice(5):null;
    if(kind==='task.opened'){
      const valid=validateOrder(body&&body.order);
      if(!valid.ok||body.schema!=='sinbad-work-order/0-v1'||valid.order.taskId!==id||tasks.has(id))throw new Error('LEDGER_INVALID:TASK_OPENED_BODY');
      const t={seq:tasks.size+1,taskId:id,order:valid.order,openedRef:ref(e),preflights:[],refusals:[],delegation:null,reports:[],state:valid.order.hold?'HOLD':'OPEN'};
      tasks.set(id,t);order.push(t);continue;
    }
    const t=tasks.get(id);
    if(!t)throw new Error(`LEDGER_INVALID:EVENT_FOR_UNKNOWN_TASK:${kind}`);
    if(kind==='preflight.decided'){
      t.preflights.push({ref:ref(e),body});
      if(['OPEN','PREFLIGHT_PASSED','PREFLIGHT_FAILED'].includes(t.state))t.state=body.decision==='PASS'?'PREFLIGHT_PASSED':'PREFLIGHT_FAILED';
    }else if(kind==='delegation.refused')t.refusals.push({ref:ref(e),body});
    else if(kind==='task.delegated'){t.delegation={ref:ref(e),body};t.state='DELEGATED';}
    else if(kind==='report.ingested'){
      t.reports.push({ref:ref(e),body});
      const outcome=body.verification&&body.verification.outcome;
      if(outcome==='INGESTED')t.state='CLOSED';else if(outcome==='SCOPE_BREACH')t.state='BREACHED';else if(outcome==='CONTRADICTED')t.state='REPORT_CONTRADICTED';
    }else throw new Error(`LEDGER_INVALID:UNKNOWN_KIND:${kind}`);
  }
  return Object.freeze({tasks:order,rejectedReports});
}
// Tasks that still claim paths for `self`: not closed, not on HOLD, and either opened earlier or already delegated.
function claimingOthers(tasks,self){
  return tasks.filter(t=>t.taskId!==self.taskId&&!CLAIMING_DONE.has(t.state)&&t.state!=='HOLD'&&(t.seq<self.seq||t.delegation!==null))
    .map(t=>({taskId:t.taskId,seq:t.seq,delegated:t.delegation!==null,expectedFiles:t.order.expectedFiles}));
}

// ---------- Owner summary ----------
const SECTIONS=Object.freeze(['VERIFIED FACTS','UNVERIFIED AGENT CLAIMS','CONTRADICTED CLAIMS','SCOPE / PREFLIGHT ISSUES','DECISIONS','REJECTED ALTERNATIVES','FAILURES','LESSONS','OPEN RISKS','SINBAD CAPABILITY DELTA']);
// Every fact carries {eventHash, bodyHash, pointer, value}. With a pointer, `value` is exactly what the body holds
// there; without one (`derived`) the value is computed from the named events and says so.
function buildSummary({reduced,head}){
  const facts=[];const per={};for(const s of SECTIONS)per[s]=[];
  const add=(section,taskId,label,value,r,pointer)=>{const f=Object.freeze({section,taskId,label,value:String(value),eventHash:r.eventHash,bodyHash:r.bodyHash,pointer:pointer===undefined?null:pointer,derived:pointer===undefined});facts.push(f);per[section].push(f);};
  const latest=arr=>arr.length?arr[arr.length-1]:null;
  for(const t of reduced.tasks){
    const o=t.order,oref=t.openedRef;
    add('VERIFIED FACTS',t.taskId,'task',o.title,oref,'/order/title');
    add('VERIFIED FACTS',t.taskId,'kind',o.kind,oref,'/order/kind');
    add('VERIFIED FACTS',t.taskId,'origin',o.origin==='RETROACTIVE_BOOTSTRAP'?`RETROACTIVE_BOOTSTRAP - ${o.originNote}`:o.origin,oref,o.origin==='RETROACTIVE_BOOTSTRAP'?undefined:'/order/origin');
    add('VERIFIED FACTS',t.taskId,'owner statement (as recorded)',o.ownerStatement,oref,'/order/ownerStatement');
    add('VERIFIED FACTS',t.taskId,'assigned agent / branch / base',`${o.agentId} / ${o.branch} / ${o.baseSha}`,oref);
    add('VERIFIED FACTS',t.taskId,'expected files',o.expectedFiles.join(', '),oref);
    const progress=[...t.reports,...(t.delegation?[t.delegation]:[]),...t.preflights].sort((a,b)=>a.ref.sequence-b.ref.sequence);
    add('VERIFIED FACTS',t.taskId,'state',t.state,progress.length?progress[progress.length-1].ref:oref);
    const pf=latest(t.preflights);
    if(pf){
      add('VERIFIED FACTS',t.taskId,'latest preflight',`${pf.body.decision} at ${pf.body.decidedAt} (head ${String(pf.body.observedHeadSha)})`,pf.ref);
      for(const r of pf.body.reasons)add('SCOPE / PREFLIGHT ISSUES',t.taskId,'preflight reason',r,pf.ref);
    }else add('VERIFIED FACTS',t.taskId,'preflight',NOT_RECORDED,oref);
    for(const rf of t.refusals)for(const r of rf.body.reasons)add('SCOPE / PREFLIGHT ISSUES',t.taskId,'delegation refused',r,rf.ref);
    if(t.delegation)add('VERIFIED FACTS',t.taskId,'delegation',`delegated to ${t.delegation.body.agentId} at ${t.delegation.body.delegatedAt}`,t.delegation.ref);
    else add('VERIFIED FACTS',t.taskId,'delegation',NOT_RECORDED,oref);
    // memory recorded by the Owner side when the task was opened
    add('VERIFIED FACTS',t.taskId,'context (as recorded)',o.context,oref,'/order/context');
    add('VERIFIED FACTS',t.taskId,'plan (as recorded)',o.plan,oref,'/order/plan');
    o.decisions.forEach((d,i)=>add('DECISIONS',t.taskId,'decision (order)',d,oref,`/order/decisions/${i}`));
    if(!o.decisions.length)add('DECISIONS',t.taskId,'decisions (order)',NOT_RECORDED,oref);
    o.rejectedAlternatives.forEach((d,i)=>add('REJECTED ALTERNATIVES',t.taskId,'rejected alternative (order)',d,oref,`/order/rejectedAlternatives/${i}`));
    if(!o.rejectedAlternatives.length)add('REJECTED ALTERNATIVES',t.taskId,'rejected alternatives (order)',NOT_RECORDED,oref);
    add('SINBAD CAPABILITY DELTA',t.taskId,'before (recorded at open)',o.sinbadCapabilityBefore,oref,'/order/sinbadCapabilityBefore');
    add('SINBAD CAPABILITY DELTA',t.taskId,'after (planned at open)',o.sinbadCapabilityAfter,oref,'/order/sinbadCapabilityAfter');
    if(!t.reports.length){
      add('UNVERIFIED AGENT CLAIMS',t.taskId,'agent report',NOT_RECORDED,oref);
      add('FAILURES',t.taskId,'failures',NOT_RECORDED,oref);add('LESSONS',t.taskId,'lessons',NOT_RECORDED,oref);
      add('SINBAD CAPABILITY DELTA',t.taskId,'gained (agent report)',NOT_RECORDED,oref);
      add('OPEN RISKS',t.taskId,'no result ingested',`state ${t.state}`,oref);
    }
    for(const r of t.reports){
      const v=r.body.verification,rep=r.body.report;
      add('VERIFIED FACTS',t.taskId,`report outcome (${r.ref.sequence})`,`${v.outcome}; claims VERIFIED ${v.counts.VERIFIED} / UNVERIFIED ${v.counts.UNVERIFIED} / CONTRADICTED ${v.counts.CONTRADICTED}`,r.ref);
      v.claims.forEach((c,i)=>{
        const p=`/verification/claims/${i}/statement`;
        if(c.label==='VERIFIED')add('VERIFIED FACTS',t.taskId,`${c.kind} (verified by ${c.basis})`,c.statement,r.ref,p);
        else if(c.label==='CONTRADICTED')add('CONTRADICTED CLAIMS',t.taskId,c.kind,c.statement,r.ref,p);
        else if(c.kind==='test')add('UNVERIFIED AGENT CLAIMS',t.taskId,'test',c.statement,r.ref,p);
        else if(c.kind.startsWith('agent.')&&!['agent.failures','agent.lessons','agent.decisions','agent.rejectedAlternatives'].includes(c.kind))add('UNVERIFIED AGENT CLAIMS',t.taskId,c.kind,c.statement,r.ref,p);
        else if(c.kind==='agent.decisions')add('DECISIONS',t.taskId,'decision (agent-reported, UNVERIFIED)',c.statement,r.ref,p);
        else if(c.kind==='agent.rejectedAlternatives')add('REJECTED ALTERNATIVES',t.taskId,'rejected alternative (agent-reported, UNVERIFIED)',c.statement,r.ref,p);
        else if(c.kind==='agent.failures')add('FAILURES',t.taskId,'failure (agent-reported, UNVERIFIED)',c.statement,r.ref,p);
        else if(c.kind==='agent.lessons')add('LESSONS',t.taskId,'lesson (agent-reported, UNVERIFIED)',c.statement,r.ref,p);
        else add('UNVERIFIED AGENT CLAIMS',t.taskId,c.kind,c.statement,r.ref,p);
      });
      if(!rep.failures.length)add('FAILURES',t.taskId,'failures (agent report)',NOT_RECORDED,r.ref);
      if(!rep.lessons.length)add('LESSONS',t.taskId,'lessons (agent report)',NOT_RECORDED,r.ref);
      for(const f of v.scopeBreach)add('SCOPE / PREFLIGHT ISSUES',t.taskId,'SCOPE_BREACH',f,r.ref);
      add('SINBAD CAPABILITY DELTA',t.taskId,'gained (agent report, UNVERIFIED)',rep.capabilityGained,r.ref,'/report/capabilityGained');
      if(v.outcome!=='INGESTED')add('OPEN RISKS',t.taskId,'report not accepted',`outcome ${v.outcome}`,r.ref);
      if(v.counts.UNVERIFIED>0)add('OPEN RISKS',t.taskId,'unverified claims remain',String(v.counts.UNVERIFIED),r.ref);
    }
    if(t.state==='BREACHED'||t.state==='REPORT_CONTRADICTED')add('OPEN RISKS',t.taskId,'task still claims its paths',t.state,latest(t.reports).ref);
  }
  for(const r of reduced.rejectedReports)add('SCOPE / PREFLIGHT ISSUES','-','report rejected before ingestion',`${r.body.errors.join(', ')} (report sha256 ${r.body.reportSha256})`,r.ref);
  const lines=[`# SINBAD Owner Work Summary`,'',`Ledger: ${head.eventCount} events, head ${head.headHash}`,`Produced from stored records only; chat was not consulted. Missing information is shown as ${NOT_RECORDED}.`,`VERIFIED FACTS are what SINBAD recorded from the Owner side or observed itself (git, locally); every agent assertion sits under UNVERIFIED AGENT CLAIMS and is never promoted.`,''];
  for(const s of SECTIONS){
    lines.push(`## ${s}`,'');
    if(!per[s].length)lines.push(NOT_RECORDED);
    for(const f of per[s])lines.push(`- [${f.taskId}] ${f.label}: ${f.value}  {ev ${f.eventHash.slice(0,12)}}`);
    lines.push('');
  }
  return Object.freeze({text:`${lines.join('\n')}\n`,facts:Object.freeze(facts)});
}

module.exports=Object.freeze({VERSION,PREFLIGHT_TTL_MS,NOT_RECORDED,ORDER_KEYS,REPORT_KEYS,SECTIONS,LABELS,INDEPENDENT_SOURCES,canonical,sha256,bodyHash,secretFinding,normalizePath,overlapKind,expectedFilesHash,validateOrder,validateReport,decidePreflight,evaluateDelegation,verifyReport,reduceLedger,claimingOthers,buildSummary});
