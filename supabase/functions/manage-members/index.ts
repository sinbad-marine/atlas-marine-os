import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const roles=new Set(['owner','administrator','captain','chief_officer','chief_engineer','dpa','developer','visitor','crew','viewer','auditor'])
const encoder=new TextEncoder()
function hex(bytes:Uint8Array){return [...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
async function sha256(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))))}
function canonical(value:unknown):string{if(value===null||typeof value==='boolean'||typeof value==='number'||typeof value==='string')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(typeof value==='object')return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;throw new Error('Unsupported command value.')}
function sessionIdFromToken(auth:string){const payload=auth.replace(/^Bearer\s+/i,'').split('.')[1];if(!payload)throw new Error('Malformed access token.');const claims=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(payload.length/4)*4,'=')));return String(claims.session_id||claims.jti||'')}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:cors})
 try{
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const auth=request.headers.get('Authorization')||''
  const jwt=/^Bearer +([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(auth)?.[1]
  if(!jwt)throw new Error('AUTH_REQUIRED')
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{autoRefreshToken:false,persistSession:false}}),admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})
  const {data:{user},error:userError}=await userClient.auth.getUser(jwt);if(userError||!user)throw new Error('A valid signed-in session is required.')
  const body=await request.json(),action=String(body.action||''),workspaceId=String(body.workspaceId||'');if(!workspaceId)throw new Error('Workspace is required.')
  const {data:caller}=await admin.from('workspace_members').select('role,is_active').eq('workspace_id',workspaceId).eq('user_id',user.id).maybeSingle()
  if(!caller?.is_active||caller.role!=='owner')throw new Error('Only an active workspace Owner can perform this action.')
  let targetUserId=body.userId?String(body.userId):null,targetEmail=body.email?String(body.email).trim().toLowerCase():null,details:Record<string,unknown>={}
  if(action==='invite'){
   const role=String(body.role||'visitor');if(!targetEmail||!/^\S+@\S+\.\S+$/.test(targetEmail)||!roles.has(role))throw new Error('Valid email and role are required.')
   const {error:rowError}=await admin.from('workspace_invites').upsert({workspace_id:workspaceId,email:targetEmail,role,note:String(body.note||'').slice(0,500),invited_by:user.id,status:'pending'},{onConflict:'workspace_id,email'});if(rowError)throw rowError
   const {error}=await admin.auth.admin.inviteUserByEmail(targetEmail,{redirectTo:String(body.redirectTo||''),data:{sinbad_workspace_id:workspaceId,sinbad_role:role}});if(error)throw error;details={role}
  }else if(action==='set_role'){
   const role=String(body.role||'');if(!targetUserId||!roles.has(role))throw new Error('Valid member and role are required.');await requireFounderStepUp(userClient,admin,auth,user.id,body.stepUp,{action:'identity.member.set_role',resourceType:'workspace_member',resourceId:targetUserId,workspaceId,command:{workspaceId,userId:targetUserId,role}});await protectLastOwner(admin,workspaceId,targetUserId,role==='owner',true)
   const {error}=await admin.from('workspace_members').update({role}).eq('workspace_id',workspaceId).eq('user_id',targetUserId);if(error)throw error;details={role}
  }else if(action==='set_active'){
   const isActive=Boolean(body.isActive);if(!targetUserId)throw new Error('Member is required.');await requireFounderStepUp(userClient,admin,auth,user.id,body.stepUp,{action:'identity.member.set_active',resourceType:'workspace_member',resourceId:targetUserId,workspaceId,command:{workspaceId,userId:targetUserId,isActive}});await protectLastOwner(admin,workspaceId,targetUserId,true,isActive)
   const {error}=await admin.from('workspace_members').update({is_active:isActive}).eq('workspace_id',workspaceId).eq('user_id',targetUserId);if(error)throw error;details={isActive}
  }else throw new Error('Unsupported administration action.')
  await admin.from('member_admin_audit').insert({workspace_id:workspaceId,actor_user_id:user.id,action,target_user_id:targetUserId,target_email:targetEmail,details})
  return Response.json({ok:true},{headers:{...cors,'Content-Type':'application/json'}})
 }catch(error){return Response.json({error:error instanceof Error?error.message:String(error)},{status:400,headers:{...cors,'Content-Type':'application/json'}})}
})
async function requireFounderStepUp(userClient:any,admin:any,auth:string,userId:string,proof:any,descriptor:{action:string,resourceType:string,resourceId:string,workspaceId:string,command:Record<string,unknown>}){
 // The global Authorization header does not populate an SDK session.
 const jwt=auth.replace(/^Bearer +/i,'')
 const {data:aal,error:aalError}=await userClient.auth.mfa.getAuthenticatorAssuranceLevel(jwt);if(aalError||aal?.currentLevel!=='aal2')throw new Error('MFA_AAL2_REQUIRED')
 const authorizationId=String(proof?.authorizationId||''),nonce=String(proof?.nonce||'');if(!/^[0-9a-f-]{36}$/.test(authorizationId)||!/^[0-9a-f]{64}$/.test(nonce))throw new Error('FOUNDER_STEP_UP_REQUIRED')
 const sessionId=sessionIdFromToken(auth);if(!sessionId)throw new Error('AUTH_SESSION_REQUIRED')
 const {data:consumed,error}=await admin.rpc('consume_founder_step_up',{p_authorization_id:authorizationId,p_principal_user_id:userId,p_workspace_id:descriptor.workspaceId,p_action:descriptor.action,p_resource_type:descriptor.resourceType,p_resource_id:descriptor.resourceId,p_command_hash:await sha256(canonical(descriptor.command)),p_nonce_hash:await sha256(nonce),p_auth_session_id:sessionId})
 if(error||consumed!==true)throw new Error('FOUNDER_STEP_UP_REJECTED')
}
async function protectLastOwner(admin:any,workspaceId:string,targetUserId:string,willRemainOwner:boolean,willRemainActive:boolean){
 const {data:target}=await admin.from('workspace_members').select('role,is_active').eq('workspace_id',workspaceId).eq('user_id',targetUserId).maybeSingle();if(target?.role!=='owner'||!target.is_active||(willRemainOwner&&willRemainActive))return
 const {count}=await admin.from('workspace_members').select('*',{count:'exact',head:true}).eq('workspace_id',workspaceId).eq('role','owner').eq('is_active',true);if((count||0)<=1)throw new Error('The last active Owner cannot be suspended or downgraded.')
}
