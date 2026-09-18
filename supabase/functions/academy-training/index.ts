import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'

// Owner-private Academy training promotion. One action only. Mirrors the human-review
// function's security shape (exact origin, bearer JWT, server-derived identity, active
// Owner membership, AAL2 + consumed founder step-up, database RPC) but never touches
// Human Review state: the RPC reads human_review_* and writes academy_ism_* only.
const jsonHeaders={'Content-Type':'application/json','Cache-Control':'no-store'}
const allowedOrigins=new Set((Deno.env.get('ACADEMY_TRAINING_ALLOWED_ORIGINS')||Deno.env.get('HUMAN_REVIEW_ALLOWED_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean))
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HASH=/^[0-9a-f]{64}$/
const encoder=new TextEncoder()
const safeCodes=new Set(['ACADEMY_TRAINING_INPUT_INVALID','ACADEMY_TRAINING_OWNER_REQUIRED','ACADEMY_TRAINING_PACKAGE_NOT_FOUND','ACADEMY_TRAINING_QUESTION_NOT_FOUND','ACADEMY_TRAINING_NOT_TECHNICALLY_VERIFIED','ACADEMY_TRAINING_QUESTION_EXISTS'])

function respond(origin:string,status:number,body:unknown){return new Response(JSON.stringify(body),{status,headers:{...jsonHeaders,'Access-Control-Allow-Origin':origin,'Vary':'Origin'}})}
function originFor(request:Request){const value=request.headers.get('Origin')||'';return allowedOrigins.has(value)?value:null}
function uuid(value:unknown,name:string){const out=String(value||'');if(!UUID.test(out))throw coded('INPUT_INVALID',`Invalid ${name}`);return out}
function coded(code:string,message=code){return Object.assign(new Error(message),{code})}
function canonical(value:unknown):string{if(value===null||typeof value==='boolean'||typeof value==='number'||typeof value==='string')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(typeof value==='object')return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;throw coded('INPUT_INVALID')}
async function sha256(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
function sessionId(auth:string){try{const payload=auth.replace(/^Bearer\s+/i,'').split('.')[1];const json=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(payload.length/4)*4,'=')));return String(json.session_id||json.jti||'')}catch{return ''}}
function databaseCode(error:any){const match=String(error?.message||'').match(/ACADEMY_TRAINING_[A-Z_]+/);return match&&safeCodes.has(match[0])?match[0]:'CONFLICT'}

async function requireOwnerStepUp(userClient:any,admin:any,auth:string,userId:string,proof:any,descriptor:{action:string,resourceType:string,resourceId:string,workspaceId:string,command:Record<string,unknown>}){
 const jwt=auth.replace(/^Bearer\s+/i,'')
 const {data:aal,error:aalError}=await userClient.auth.mfa.getAuthenticatorAssuranceLevel(jwt)
 if(aalError||aal?.currentLevel!=='aal2')throw coded('MFA_AAL2_REQUIRED')
 const authorizationId=String(proof?.authorizationId||''),nonce=String(proof?.nonce||''),sid=sessionId(auth)
 if(!UUID.test(authorizationId)||!HASH.test(nonce)||!sid)throw coded('FOUNDER_STEP_UP_REQUIRED')
 const {data,error}=await admin.rpc('consume_founder_step_up',{p_authorization_id:authorizationId,p_principal_user_id:userId,p_workspace_id:descriptor.workspaceId,p_action:descriptor.action,p_resource_type:descriptor.resourceType,p_resource_id:descriptor.resourceId,p_command_hash:await sha256(canonical(descriptor.command)),p_nonce_hash:await sha256(nonce),p_auth_session_id:sid})
 if(error||data!==true)throw coded('FOUNDER_STEP_UP_REJECTED')
}

Deno.serve(async request=>{
 const origin=originFor(request)
 if(!origin)return new Response(JSON.stringify({error:'ORIGIN_DENIED'}),{status:403,headers:jsonHeaders})
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}})
 if(request.method!=='POST')return respond(origin,405,{error:'METHOD_NOT_ALLOWED'})
 try{
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!anon||!service)return respond(origin,503,{error:'SERVICE_UNAVAILABLE'})
  const auth=request.headers.get('Authorization')||'',jwt=/^Bearer +([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(auth)?.[1]
  if(!jwt)return respond(origin,401,{error:'AUTH_REQUIRED'})
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}}),admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:{user},error:userError}=await userClient.auth.getUser(jwt)
  if(userError||!user)return respond(origin,401,{error:'AUTH_REQUIRED'})
  const body=await request.json(),action=String(body.action||''),workspaceId=uuid(body.workspaceId,'workspace')
  const {data:member}=await admin.from('workspace_members').select('role,is_active').eq('workspace_id',workspaceId).eq('user_id',user.id).maybeSingle()
  if(!member?.is_active)return respond(origin,403,{error:'MEMBERSHIP_REQUIRED'})
  if(member.role!=='owner')return respond(origin,403,{error:'OWNER_REQUIRED'})

  if(action==='promote_owner_training'){
   const packageId=uuid(body.packageId,'package'),questionId=String(body.questionId||'').trim(),requestId=uuid(body.requestId,'request')
   if(questionId.length<1||questionId.length>200)throw coded('INPUT_INVALID')
   const command={workspaceId,packageId,questionId}
   await requireOwnerStepUp(userClient,admin,auth,user.id,body.stepUp,{action:'identity.academy.training_promote',resourceType:'academy_question',resourceId:questionId,workspaceId,command})
   const {data,error}=await admin.rpc('academy_ism_owner_promote_training',{p_workspace_id:workspaceId,p_actor_id:user.id,p_package_id:packageId,p_question_id:questionId,p_request_id:requestId})
   if(error)return respond(origin,409,{error:databaseCode(error)})
   return respond(origin,200,{result:data})
  }
  return respond(origin,400,{error:'ACTION_UNSUPPORTED'})
 }catch(error){const code=String((error as any)?.code||'REQUEST_INVALID');return respond(origin,code==='INPUT_INVALID'?400:code==='MFA_AAL2_REQUIRED'||code==='FOUNDER_STEP_UP_REQUIRED'||code==='FOUNDER_STEP_UP_REJECTED'?403:400,{error:code})}
})
