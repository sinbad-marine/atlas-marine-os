import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'

const encoder=new TextEncoder()

function corsFor(request:Request){
  const origin=request.headers.get('Origin')||'',configured=(Deno.env.get('SINBAD_ALLOWED_ORIGINS')||'https://sinbad-marine.github.io,http://127.0.0.1:4173').split(',').map(item=>item.trim())
  const allowed=configured.some(item=>origin===item||origin.startsWith(`${item}/`))?origin:configured[0]
  return {'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}
}
function reply(request:Request,status:number,body:Record<string,unknown>){return new Response(JSON.stringify(body),{status,headers:{...corsFor(request),'Content-Type':'application/json','Cache-Control':'no-store'}})}
function hex(bytes:Uint8Array){return [...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
async function sha256(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))))}
function canonical(value:unknown):string{
  if(value===null||typeof value==='boolean'||typeof value==='number'||typeof value==='string')return JSON.stringify(value)
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`
  if(typeof value==='object')return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  throw new Error('Command contains an unsupported value.')
}
function tokenClaims(authHeader:string){
  const token=authHeader.replace(/^Bearer\s+/i,'')
  const payload=token.split('.')[1];if(!payload)throw new Error('Malformed access token.')
  return JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(payload.length/4)*4,'='))) as Record<string,unknown>
}
function validatedDescriptor(body:Record<string,unknown>){
  const action=String(body.action||''),resourceType=String(body.resourceType||''),resourceId=String(body.resourceId||''),workspaceId=body.workspaceId?String(body.workspaceId):null
  if(!/^[a-z][a-z0-9_.:-]{2,127}$/.test(action))throw new Error('A canonical high-risk action is required.')
  if(!/^(security|identity|core|release|delete)\./.test(action))throw new Error('Only classified high-risk actions may request step-up authorization.')
  if(!/^[a-z][a-z0-9_.:-]{1,63}$/.test(resourceType))throw new Error('A canonical resource type is required.')
  if(!resourceId||resourceId.length>512)throw new Error('A bounded exact resource id is required.')
  const command=canonical(body.command);if(command.length>32768)throw new Error('Command is too large.')
  return {action,resourceType,resourceId,workspaceId,command}
}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsFor(request)})
  if(request.method!=='POST')return reply(request,405,{error:'POST_REQUIRED'})
  try{
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const auth=request.headers.get('Authorization')||''
    const jwt=/^Bearer +([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(auth)?.[1]
    if(!jwt)return reply(request,401,{error:'AUTH_REQUIRED'})
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}})
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
    const [{data:{user},error:userError},{data:aal,error:aalError}]=await Promise.all([
      userClient.auth.getUser(jwt),userClient.auth.mfa.getAuthenticatorAssuranceLevel(jwt)
    ])
    if(userError||!user)return reply(request,401,{error:'AUTH_REQUIRED'})
    if(aalError||aal?.currentLevel!=='aal2')return reply(request,403,{error:'MFA_AAL2_REQUIRED',nextLevel:aal?.nextLevel||'aal2'})
    const claims=tokenClaims(auth),sessionId=String(claims.session_id||claims.jti||'')
    if(!sessionId)return reply(request,401,{error:'AUTH_SESSION_REQUIRED'})
    const {data:founder}=await admin.from('founder_principals').select('user_id,status,roles').eq('user_id',user.id).eq('status','active').maybeSingle()
    if(!founder)return reply(request,403,{error:'ACTIVE_FOUNDER_REQUIRED'})

    const body=await request.json() as Record<string,unknown>,descriptor=validatedDescriptor(body)
    const commandHash=await sha256(descriptor.command)
    const nonceBytes=crypto.getRandomValues(new Uint8Array(32)),nonce=hex(nonceBytes),nonceHash=await sha256(nonce)
    // Never fall back to separate inserts: an audit failure must undo issuance.
    const {data:authorization,error}=await admin.rpc('issue_founder_step_up',{
      p_principal_user_id:user.id,p_workspace_id:descriptor.workspaceId,p_action:descriptor.action,
      p_resource_type:descriptor.resourceType,p_resource_id:descriptor.resourceId,p_command_hash:commandHash,
      p_nonce_hash:nonceHash,p_auth_session_id:sessionId
    }).single()
    if(error||!authorization||typeof authorization.id!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(authorization.id)||typeof authorization.expires_at!=='string'||!Number.isFinite(Date.parse(authorization.expires_at)))return reply(request,503,{error:'STEP_UP_ISSUANCE_FAILED'})
    return reply(request,200,{ok:true,authorizationId:authorization.id,nonce,commandHash,expiresAt:authorization.expires_at,singleUse:true})
  }catch(error){return reply(request,400,{error:error instanceof Error?error.message:String(error)})}
})
