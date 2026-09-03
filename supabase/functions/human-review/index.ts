import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'

const jsonHeaders={'Content-Type':'application/json','Cache-Control':'no-store'}
const allowedOrigins=new Set((Deno.env.get('HUMAN_REVIEW_ALLOWED_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean))
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HASH=/^[0-9a-f]{64}$/
const encoder=new TextEncoder()
const safeCodes=new Set(['HUMAN_REVIEW_INPUT_INVALID','HUMAN_REVIEW_OWNER_REQUIRED','HUMAN_REVIEW_ACTIVE_MEMBER_REQUIRED','HUMAN_REVIEW_PACKAGE_NOT_FOUND','HUMAN_REVIEW_REVIEWER_REQUIRED','HUMAN_REVIEW_PACKAGE_ALREADY_CLAIMED','HUMAN_REVIEW_STALE_WRITE','HUMAN_REVIEW_TARGET_REVIEWER_INVALID','HUMAN_REVIEW_NOT_ASSIGNED','HUMAN_REVIEW_QUESTION_NOT_FOUND','HUMAN_REVIEW_QUESTIONS_PENDING'])

function respond(origin:string,status:number,body:unknown){return new Response(JSON.stringify(body),{status,headers:{...jsonHeaders,'Access-Control-Allow-Origin':origin,'Vary':'Origin'}})}
function originFor(request:Request){const value=request.headers.get('Origin')||'';return allowedOrigins.has(value)?value:null}
function uuid(value:unknown,name:string){const out=String(value||'');if(!UUID.test(out))throw coded('INPUT_INVALID',`Invalid ${name}`);return out}
function integer(value:unknown,name:string,min=0,max=Number.MAX_SAFE_INTEGER){const out=Number(value);if(!Number.isSafeInteger(out)||out<min||out>max)throw coded('INPUT_INVALID',`Invalid ${name}`);return out}
function coded(code:string,message=code){return Object.assign(new Error(message),{code})}
function canonical(value:unknown):string{if(value===null||typeof value==='boolean'||typeof value==='number'||typeof value==='string')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(typeof value==='object')return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;throw coded('INPUT_INVALID')}
async function sha256(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
function sessionId(auth:string){try{const payload=auth.replace(/^Bearer\s+/i,'').split('.')[1];const json=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(payload.length/4)*4,'=')));return String(json.session_id||json.jti||'')}catch{return ''}}
function databaseCode(error:any){const match=String(error?.message||'').match(/HUMAN_REVIEW_[A-Z_]+/);return match&&safeCodes.has(match[0])?match[0]:'CONFLICT'}

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
  const isOwner=member.role==='owner'
  const {data:reviewer}=isOwner?{data:null}:await admin.from('human_reviewer_authorizations').select('state').eq('workspace_id',workspaceId).eq('user_id',user.id).maybeSingle()
  const isReviewer=reviewer?.state==='active'
  if(!isOwner&&!isReviewer)return respond(origin,403,{error:'REVIEW_ACCESS_DENIED'})

  if(action==='list_packages'){
   const limit=integer(body.limit??25,'limit',1,100),cursor=body.cursor?uuid(body.cursor,'cursor'):null
   let query=admin.from('human_review_packages').select('id,title,status,package_size,expected_count,present_count,missing_count,deferred_count,package_complete,assigned_reviewer_id,assignment_generation,lock_version,reviewed_count,last_activity_at,submitted_at').eq('workspace_id',workspaceId).order('id',{ascending:true}).limit(limit+1)
   if(!isOwner)query=query.or(`status.eq.AVAILABLE,assigned_reviewer_id.eq.${user.id}`)
   if(cursor)query=query.gt('id',cursor)
   const {data,error}=await query;if(error)throw error
   const rows=data||[],hasMore=rows.length>limit,items=rows.slice(0,limit)
   return respond(origin,200,{role:isOwner?'OWNER':'HUMAN_REVIEWER',items,nextCursor:hasMore?items.at(-1)?.id:null})
  }
  if(action==='package_detail'){
   const packageId=uuid(body.packageId,'package'),after=integer(body.afterPosition??0,'position',0,250),limit=integer(body.limit??25,'limit',1,100)
   const {data:pkg,error}=await admin.from('human_review_packages').select('*').eq('workspace_id',workspaceId).eq('id',packageId).maybeSingle();if(error||!pkg)return respond(origin,404,{error:'PACKAGE_NOT_FOUND'})
   if(!isOwner&&pkg.assigned_reviewer_id!==user.id)return respond(origin,403,{error:'PACKAGE_ACCESS_DENIED'})
   const {data:questions,error:qError}=await admin.from('human_review_package_questions').select('question_id,position,source_revision,content_sha256,technical_status,question_payload,evidence_payload,human_question_reviews(reviewer_id,human_decision,note,assignment_generation,revision,reviewed_at,owner_decision,owner_reviewed_at)').eq('package_id',packageId).gt('position',after).order('position').limit(limit+1);if(qError)throw qError
   const rows=questions||[],hasMore=rows.length>limit,items=rows.slice(0,limit)
   return respond(origin,200,{role:isOwner?'OWNER':'HUMAN_REVIEWER',package:pkg,items,nextPosition:hasMore?items.at(-1)?.position:null})
  }
  if(action==='list_reviewers'){
   if(!isOwner)return respond(origin,403,{error:'OWNER_REQUIRED'})
   const {data,error}=await admin.from('human_reviewer_authorizations').select('user_id,state,authorized_by,authorized_at,updated_at').eq('workspace_id',workspaceId).order('updated_at',{ascending:false}).limit(100);if(error)throw error
   return respond(origin,200,{items:data||[]})
  }
  if(action==='list_audit'){
   if(!isOwner)return respond(origin,403,{error:'OWNER_REQUIRED'})
   const packageId=body.packageId?uuid(body.packageId,'package'):null,limit=integer(body.limit??50,'limit',1,100)
   let query=admin.from('human_review_audit').select('id,request_id,package_id,question_id,actor_id,actor_kind,action,previous_state,new_state,note,created_at').eq('workspace_id',workspaceId).order('id',{ascending:false}).limit(limit)
   if(packageId)query=query.eq('package_id',packageId)
   const {data,error}=await query;if(error)throw error;return respond(origin,200,{items:data||[]})
  }

  const requestId=uuid(body.requestId,'request')
  if(action==='claim_package'){
   const packageId=uuid(body.packageId,'package'),lockVersion=integer(body.expectedLockVersion,'lock version')
   const {data,error}=await admin.rpc('human_review_claim_package',{p_workspace_id:workspaceId,p_package_id:packageId,p_actor_id:user.id,p_expected_lock_version:lockVersion,p_request_id:requestId});if(error)return respond(origin,409,{error:databaseCode(error)});return respond(origin,200,{result:data})
  }
  if(action==='save_decision'){
   const packageId=uuid(body.packageId,'package'),questionId=String(body.questionId||''),decision=String(body.decision||''),note=String(body.note||'').trim()
   if(!questionId||questionId.length>200||!['APPROVED','CORRECTION_REQUIRED','SOURCE_HOLD'].includes(decision)||note.length>2000)throw coded('INPUT_INVALID')
   const {data,error}=await admin.rpc('human_review_save_decision',{p_workspace_id:workspaceId,p_package_id:packageId,p_question_id:questionId,p_actor_id:user.id,p_decision:decision,p_note:note,p_assignment_generation:integer(body.assignmentGeneration,'generation'),p_expected_lock_version:integer(body.expectedLockVersion,'lock version'),p_request_id:requestId});if(error)return respond(origin,409,{error:databaseCode(error)});return respond(origin,200,{result:data})
  }
  if(action==='submit_package'){
   const {data,error}=await admin.rpc('human_review_submit_package',{p_workspace_id:workspaceId,p_package_id:uuid(body.packageId,'package'),p_actor_id:user.id,p_assignment_generation:integer(body.assignmentGeneration,'generation'),p_expected_lock_version:integer(body.expectedLockVersion,'lock version'),p_request_id:requestId});if(error)return respond(origin,409,{error:databaseCode(error)});return respond(origin,200,{result:data})
  }
  if(action==='set_reviewer_state'){
   if(!isOwner)return respond(origin,403,{error:'OWNER_REQUIRED'})
   const targetUserId=uuid(body.userId,'reviewer'),state=String(body.state||''),note=String(body.note||'').trim();if(!['active','suspended','revoked'].includes(state)||note.length>2000)throw coded('INPUT_INVALID')
   const command={workspaceId,userId:targetUserId,state,note};await requireOwnerStepUp(userClient,admin,auth,user.id,body.stepUp,{action:'identity.human_reviewer.set_state',resourceType:'workspace_member',resourceId:targetUserId,workspaceId,command})
   const {data,error}=await admin.rpc('human_review_authorize_reviewer',{p_workspace_id:workspaceId,p_actor_id:user.id,p_user_id:targetUserId,p_state:state,p_request_id:requestId,p_note:note});if(error)return respond(origin,409,{error:databaseCode(error)});return respond(origin,200,{result:data})
  }
  if(action==='transfer_package'){
   if(!isOwner)return respond(origin,403,{error:'OWNER_REQUIRED'})
   const packageId=uuid(body.packageId,'package'),targetUserId=body.targetUserId===null?null:uuid(body.targetUserId,'target reviewer'),lockVersion=integer(body.expectedLockVersion,'lock version'),note=String(body.note||'').trim();if(note.length>2000)throw coded('INPUT_INVALID')
   const command={workspaceId,packageId,targetUserId,expectedLockVersion:lockVersion,note};await requireOwnerStepUp(userClient,admin,auth,user.id,body.stepUp,{action:'identity.human_review.package_transfer',resourceType:'review_package',resourceId:packageId,workspaceId,command})
   const {data,error}=await admin.rpc('human_review_transfer_package',{p_workspace_id:workspaceId,p_package_id:packageId,p_actor_id:user.id,p_target_user_id:targetUserId,p_expected_lock_version:lockVersion,p_request_id:requestId,p_note:note});if(error)return respond(origin,409,{error:databaseCode(error)});return respond(origin,200,{result:data})
  }
  return respond(origin,400,{error:'ACTION_UNSUPPORTED'})
 }catch(error){const code=String((error as any)?.code||'REQUEST_INVALID');return respond(origin,code==='INPUT_INVALID'?400:code==='MFA_AAL2_REQUIRED'||code==='FOUNDER_STEP_UP_REQUIRED'||code==='FOUNDER_STEP_UP_REJECTED'?403:400,{error:code})}
})
