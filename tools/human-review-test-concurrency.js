'use strict';
// Windows-only disposable PostgreSQL cluster. It accepts no external connection
// string, never installs a service and never connects to production.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict');
const {createRequire}=require('node:module'),{spawn,execFileSync}=require('node:child_process'),{randomBytes}=require('node:crypto');
const delay=ms=>new Promise(r=>setTimeout(r,ms)),root=path.join(__dirname,'..'),runtime=path.resolve(root,'../../tmp/argos-native-pg-runtime');
const binaryPackage=path.join(runtime,'node_modules/@embedded-postgres/windows-x64'),bin=path.join(binaryPackage,'native/bin');
const ids={workspace:'11111111-1111-4111-8111-111111111111',owner:'22222222-2222-4222-8222-222222222222',a:'33333333-3333-4333-8333-333333333333',b:'44444444-4444-4444-8444-444444444444',pkg:'55555555-5555-4555-8555-555555555555'};
const req=n=>`77777777-7777-4777-8777-${String(n).padStart(12,'0')}`;
async function reservePort(){const s=net.createServer();await new Promise((ok,no)=>{s.once('error',no);s.listen(0,'127.0.0.1',ok)});const p=s.address().port;await new Promise(ok=>s.close(ok));return p}
async function main(){
 assert.equal(process.platform,'win32');const localRequire=createRequire(path.join(runtime,'package.json')),{Client}=localRequire('pg');
 const dir=fs.mkdtempSync(path.resolve(root,'../../tmp/human-review-native-')),data=path.join(dir,'data'),passwordFile=path.join(dir,'initial-password'),password=randomBytes(32).toString('hex'),port=await reservePort();
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^PG/i.test(k))),log=fs.openSync(path.join(dir,'server.log'),'wx'),clients=[],checks=[];let server,admin,report;
 const command=(name,args)=>execFileSync(path.join(bin,`${name}.exe`),args,{env,windowsHide:true,timeout:30000,stdio:['ignore','pipe','pipe']});
 const connect=async()=>{const c=new Client({host:'127.0.0.1',port,user:'human_review_test',password,database:'postgres',ssl:false,connectionTimeoutMillis:1000,statement_timeout:20000,query_timeout:25000});c.on('error',()=>{});await c.connect();clients.push(c);return c};
 try{
  fs.writeFileSync(passwordFile,password+'\n',{flag:'wx',mode:0o600});try{command('initdb',['-D',data,'-U','human_review_test','--auth=scram-sha-256','--pwfile='+passwordFile,'--encoding=UTF8','--no-locale'])}finally{fs.unlinkSync(passwordFile)}
  server=spawn(path.join(bin,'postgres.exe'),['-D',data,'-h','127.0.0.1','-p',String(port),'-c','max_connections=12'],{env,windowsHide:true,stdio:['ignore',log,log]});
  for(let i=0;i<50;i++){try{admin=await connect();break}catch{await delay(100)}}assert.ok(admin,'TEST_SERVER_START_TIMEOUT');
  const identity=(await admin.query("select current_setting('data_directory') dir,version() version")).rows[0];assert.equal(path.resolve(identity.dir).toLowerCase(),path.resolve(data).toLowerCase());
  await admin.query(`create schema auth;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key);create table public.workspaces(id uuid primary key);create type public.workspace_role as enum('owner','developer','visitor');create table public.workspace_members(workspace_id uuid references public.workspaces,user_id uuid references auth.users,role public.workspace_role,is_active boolean,primary key(workspace_id,user_id));insert into auth.users values('${ids.owner}'),('${ids.a}'),('${ids.b}');insert into public.workspaces values('${ids.workspace}');insert into public.workspace_members values('${ids.workspace}','${ids.owner}','owner',true),('${ids.workspace}','${ids.a}','visitor',true),('${ids.workspace}','${ids.b}','visitor',true);`);
  await admin.query(fs.readFileSync(path.join(root,'supabase/migrations/20260903000400_human_reviewer_system.sql'),'utf8'));
  for(const [u,n] of [[ids.a,1],[ids.b,2]])await admin.query('select public.human_review_authorize_reviewer($1,$2,$3,$4,$5,$6)',[ids.workspace,ids.owner,u,'active',req(n),'test']);
  await admin.query("insert into public.human_review_packages(id,workspace_id,source_batch_id,source_revision,content_sha256,title,package_size,expected_count,present_count,missing_count,deferred_count,created_by) values($1,$2,'race','r1',$3,'Race',25,1,1,0,0,$4)",[ids.pkg,ids.workspace,'a'.repeat(64),ids.owner]);
  await admin.query("insert into public.human_review_package_questions values($1,'q1',1,'r1',$2,'VERIFIED','{}','{}')",[ids.pkg,'b'.repeat(64)]);
  const a=await connect(),b=await connect();const claims=await Promise.allSettled([a.query('select public.human_review_claim_package($1,$2,$3,$4,$5) result',[ids.workspace,ids.pkg,ids.a,0,req(3)]),b.query('select public.human_review_claim_package($1,$2,$3,$4,$5) result',[ids.workspace,ids.pkg,ids.b,0,req(4)])]);assert.equal(claims.filter(x=>x.status==='fulfilled').length,1);checks.push('simultaneous package claim has exactly one winner');
  const winner=claims[0].status==='fulfilled'?ids.a:ids.b,former=winner,next=winner===ids.a?ids.b:ids.a;
  await admin.query('select public.human_review_save_decision($1,$2,$3,$4,$5,$6,$7,$8,$9)',[ids.workspace,ids.pkg,'q1',winner,'APPROVED','preserve',1,1,req(5)]);
  await admin.query('select public.human_review_transfer_package($1,$2,$3,$4,$5,$6,$7)',[ids.workspace,ids.pkg,ids.owner,next,2,req(6),'reassign']);
  await assert.rejects(admin.query('select public.human_review_save_decision($1,$2,$3,$4,$5,$6,$7,$8,$9)',[ids.workspace,ids.pkg,'q1',former,'CORRECTION_REQUIRED','late',1,2,req(7)]),/NOT_ASSIGNED|STALE_WRITE/);assert.equal((await admin.query('select note from public.human_question_reviews where package_id=$1',[ids.pkg])).rows[0].note,'preserve');checks.push('transfer preserves work and rejects former reviewer reconnect');
  await admin.query(`insert into public.human_review_packages(workspace_id,source_batch_id,source_revision,content_sha256,title,package_size,expected_count,present_count,missing_count,deferred_count,created_by) select '${ids.workspace}','scale-'||g,'r1',md5(g::text)||md5(g::text),'Scale '||g,250,250,250,0,0,'${ids.owner}' from generate_series(1,120) g;insert into public.human_review_package_questions(package_id,question_id,position,source_revision,content_sha256,technical_status,question_payload,evidence_payload) select p.id,'q-'||q,q,'r1',md5((p.id::text||q))||md5((p.id::text||q)),'VERIFIED',jsonb_build_object('stem','Question '||q),jsonb_build_object('page',q) from public.human_review_packages p cross join generate_series(1,250) q where p.source_batch_id like 'scale-%';analyze public.human_review_packages;analyze public.human_review_package_questions;`);
  assert.equal(Number((await admin.query("select count(*) n from public.human_review_package_questions q join public.human_review_packages p on p.id=q.package_id where p.source_batch_id like 'scale-%'")).rows[0].n),30000);
  const plan=JSON.stringify((await admin.query('explain (format json) select * from public.human_review_package_questions where package_id=$1 and position>100 order by position limit 26',[ids.pkg])).rows[0]['QUERY PLAN']);assert.match(plan,/human_review_questions_package_position|Index Scan/);checks.push('30,000-question fixture uses bounded indexed package paging');
  report={status:'PASSED',engine:identity.version,checks,serverStopped:false};
 }catch(error){report={status:'FAILED',code:error.code||'HUMAN_REVIEW_NATIVE_FAILED',message:error.message,checks};process.exitCode=1}finally{
  for(const c of clients){await c.query('rollback').catch(()=>{});await c.end().catch(()=>{})}if(server&&server.exitCode===null)command('pg_ctl',['-D',data,'-m','fast','-w','-t','10','stop']);fs.closeSync(log);if(report){report.testDirectory=path.relative(root,dir).replace(/\\/g,'/');report.serverStopped=!fs.existsSync(path.join(data,'postmaster.pid'));assert.equal(report.serverStopped,true);console.log(JSON.stringify(report,null,2))}
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
