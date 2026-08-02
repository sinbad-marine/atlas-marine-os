import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const roles=new Set(['owner','administrator','captain','chief_officer','chief_engineer','dpa','developer','visitor','crew','viewer','auditor'])
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:cors})
 try{
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const auth=request.headers.get('Authorization')||'',userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}}),admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})
  const {data:{user},error:userError}=await userClient.auth.getUser();if(userError||!user)throw new Error('A valid signed-in session is required.')
  const body=await request.json(),action=String(body.action||''),workspaceId=String(body.workspaceId||'');if(!workspaceId)throw new Error('Workspace is required.')
  const {data:caller}=await admin.from('workspace_members').select('role,is_active').eq('workspace_id',workspaceId).eq('user_id',user.id).maybeSingle()
  if(!caller?.is_active||caller.role!=='owner')throw new Error('Only an active workspace Owner can perform this action.')
  let targetUserId=body.userId?String(body.userId):null,targetEmail=body.email?String(body.email).trim().toLowerCase():null,details:Record<string,unknown>={}
  if(action==='invite'){
   const role=String(body.role||'visitor');if(!targetEmail||!/^\S+@\S+\.\S+$/.test(targetEmail)||!roles.has(role))throw new Error('Valid email and role are required.')
   const {error:rowError}=await admin.from('workspace_invites').upsert({workspace_id:workspaceId,email:targetEmail,role,note:String(body.note||'').slice(0,500),invited_by:user.id,status:'pending'},{onConflict:'workspace_id,email'});if(rowError)throw rowError
   const {error}=await admin.auth.admin.inviteUserByEmail(targetEmail,{redirectTo:String(body.redirectTo||''),data:{sinbad_workspace_id:workspaceId,sinbad_role:role}});if(error)throw error;details={role}
  }else if(action==='set_role'){
   const role=String(body.role||'');if(!targetUserId||!roles.has(role))throw new Error('Valid member and role are required.');await protectLastOwner(admin,workspaceId,targetUserId,role==='owner',true)
   const {error}=await admin.from('workspace_members').update({role}).eq('workspace_id',workspaceId).eq('user_id',targetUserId);if(error)throw error;details={role}
  }else if(action==='set_active'){
   const isActive=Boolean(body.isActive);if(!targetUserId)throw new Error('Member is required.');await protectLastOwner(admin,workspaceId,targetUserId,true,isActive)
   const {error}=await admin.from('workspace_members').update({is_active:isActive}).eq('workspace_id',workspaceId).eq('user_id',targetUserId);if(error)throw error;details={isActive}
  }else throw new Error('Unsupported administration action.')
  await admin.from('member_admin_audit').insert({workspace_id:workspaceId,actor_user_id:user.id,action,target_user_id:targetUserId,target_email:targetEmail,details})
  return Response.json({ok:true},{headers:{...cors,'Content-Type':'application/json'}})
 }catch(error){return Response.json({error:error instanceof Error?error.message:String(error)},{status:400,headers:{...cors,'Content-Type':'application/json'}})}
})
async function protectLastOwner(admin:any,workspaceId:string,targetUserId:string,willRemainOwner:boolean,willRemainActive:boolean){
 const {data:target}=await admin.from('workspace_members').select('role,is_active').eq('workspace_id',workspaceId).eq('user_id',targetUserId).maybeSingle();if(target?.role!=='owner'||!target.is_active||(willRemainOwner&&willRemainActive))return
 const {count}=await admin.from('workspace_members').select('*',{count:'exact',head:true}).eq('workspace_id',workspaceId).eq('role','owner').eq('is_active',true);if((count||0)<=1)throw new Error('The last active Owner cannot be suspended or downgraded.')
}
