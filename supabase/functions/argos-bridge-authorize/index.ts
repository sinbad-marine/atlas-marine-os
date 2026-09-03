import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'

const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i, digest=/^[0-9a-f]{64}$/
const actions:Record<string,string>={'/library/ingest':'LIBRARY_WRITE','/library/reindex':'LIBRARY_INDEX_WRITE','/routes':'ROUTE_WRITE','/routes/open':'PHYSICAL_HANDOFF','/opencpn/start':'PHYSICAL_HANDOFF','/opencpn/input':'PHYSICAL_HANDOFF'}
const reply=(status:number,body:Record<string,unknown>)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}})
async function hash(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('')}
function canonical(value:Record<string,unknown>){return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${JSON.stringify(item)}`).join(',')}}`}

// Called directly by the registered Bridge over TLS, never by a browser proxy.
Deno.serve(async request=>{
 if(request.method!=='POST')return reply(405,{error:'POST_REQUIRED'})
 try{
  const auth=request.headers.get('Authorization')||'',jwt=/^Bearer +([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(auth)?.[1]
  const credential=request.headers.get('X-Sinbad-Bridge-Credential')||''
  if(!jwt||!digest.test(credential))return reply(401,{error:'BRIDGE_AUTH_REQUIRED'})
  const raw=await request.text();if(raw.length>8192)return reply(413,{error:'REQUEST_TOO_LARGE'})
  const body=JSON.parse(raw),command=body.command,proof=body.stepUp
  if(!command||!uuid.test(command.instanceId)||!uuid.test(command.workspaceId)||command.method!=='POST'||!Object.hasOwn(actions,command.path)||command.action!==actions[command.path]||!digest.test(command.bodySha256)||!Number.isSafeInteger(command.bodyBytes)||command.bodyBytes<0||command.bodyBytes>(command.path==='/library/ingest'?8388608:2097152)||!/^browser-[A-Za-z0-9._-]{8,112}$/.test(command.commandId)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(command.requestedAt)||!Number.isFinite(Date.parse(command.requestedAt))||Math.abs(Date.now()-Date.parse(command.requestedAt))>300000||!digest.test(body.challenge)||!uuid.test(proof?.authorizationId)||!digest.test(proof?.nonce))return reply(400,{error:'BRIDGE_BINDING_INVALID'})
  // Reconstruct the only accepted shape. Extra client fields confer no authority.
  const exact={action:command.action,bodyBytes:command.bodyBytes,bodySha256:command.bodySha256,commandId:command.commandId,instanceId:command.instanceId,method:'POST',path:command.path,requestedAt:command.requestedAt,workspaceId:command.workspaceId}
  const url=Deno.env.get('SUPABASE_URL')!,admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
  const userClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}})
  const [{data:{user},error:userError},{data:aal,error:aalError}]=await Promise.all([userClient.auth.getUser(jwt),userClient.auth.mfa.getAuthenticatorAssuranceLevel(jwt)])
  if(userError||!user)return reply(401,{error:'AUTH_REQUIRED'})
  if(aalError||aal?.currentLevel!=='aal2')return reply(403,{error:'MFA_AAL2_REQUIRED'})
  const payload=jwt.split('.')[1],claims=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(payload.length/4)*4,'='))),sessionId=String(claims.session_id||claims.jti||'')
  if(!sessionId)return reply(401,{error:'AUTH_SESSION_REQUIRED'})
  const commandHash=await hash(canonical(exact))
  // Registration lock, active membership and grant consumption share one transaction.
  const {data:consumed,error}=await admin.rpc('consume_argos_bridge_step_up',{
   p_instance_id:exact.instanceId,p_credential_hash:await hash(credential),p_authorization_id:proof.authorizationId,
   p_principal_user_id:user.id,p_workspace_id:exact.workspaceId,p_action:`core.bridge.${exact.action.toLowerCase()}`,
   p_command_hash:commandHash,p_nonce_hash:await hash(proof.nonce),p_auth_session_id:sessionId
  })
  if(error||consumed!==true)return reply(403,{error:'BRIDGE_STEP_UP_REJECTED'})
  return reply(200,{ok:true,challenge:body.challenge,commandHash,authorizationId:proof.authorizationId,instanceId:exact.instanceId,bodySha256:exact.bodySha256})
 }catch{return reply(400,{error:'BRIDGE_AUTHORIZATION_FAILED'})}
})
