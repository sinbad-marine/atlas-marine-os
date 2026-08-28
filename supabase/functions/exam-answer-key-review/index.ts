import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const jsonHeaders={'Content-Type':'application/json','Cache-Control':'no-store'}
const allowedOrigins=new Set((Deno.env.get('EXAM_REVIEW_ALLOWED_ORIGINS')||'').split(',').map(value=>value.trim()).filter(Boolean))
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function respond(origin:string,status:number,body:unknown){return new Response(JSON.stringify(body),{status,headers:{...jsonHeaders,'Access-Control-Allow-Origin':origin,'Vary':'Origin'}})}
function allowedOrigin(request:Request){const origin=request.headers.get('Origin')||'';return allowedOrigins.has(origin)?origin:null}

Deno.serve(async request=>{
  const origin=allowedOrigin(request)
  if(!origin)return new Response(JSON.stringify({error:'Origin not allowed'}),{status:403,headers:jsonHeaders})
  if(request.method==='OPTIONS')return new Response('ok',{headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}})
  if(request.method!=='POST')return respond(origin,405,{error:'Method not allowed'})
  try{
    const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if(!url||!anon||!service)return respond(origin,503,{error:'Server configuration incomplete'})
    const authorization=request.headers.get('Authorization')||''
    if(!authorization.startsWith('Bearer '))return respond(origin,401,{error:'Signed-in session required'})
    const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}}})
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:{user},error:userError}=await userClient.auth.getUser()
    if(userError||!user)return respond(origin,401,{error:'Signed-in session required'})
    const body=await request.json(),action=String(body.action||''),workspaceId=String(body.workspaceId||''),reviewId=String(body.reviewId||'')
    if(!uuid.test(workspaceId))return respond(origin,400,{error:'Valid workspace is required'})
    const {data:member,error:memberError}=await admin.from('workspace_members').select('role,is_active').eq('workspace_id',workspaceId).eq('user_id',user.id).maybeSingle()
    if(memberError||!member?.is_active||!['owner','developer'].includes(member.role))return respond(origin,403,{error:'Active Owner or Developer role required'})
    const role=member.role as 'owner'|'developer'

    if(action==='list'){
      const {data,error}=await admin.from('exam_answer_key_reviews').select('id,question_ref,answer_key_hash,developer_decision,developer_note,developer_reviewed_at,owner_final_decision,owner_final_note,owner_final_at,created_at').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(200)
      if(error)throw error
      return respond(origin,200,{role,reviews:data||[]})
    }
    if(!uuid.test(reviewId))return respond(origin,400,{error:'Valid review is required'})
    const {data:review,error:reviewError}=await admin.from('exam_answer_key_reviews').select('id,question_ref,answer_key_hash,developer_decision,developer_note,developer_reviewed_at,owner_final_decision,owner_final_note,owner_final_at,created_at').eq('workspace_id',workspaceId).eq('id',reviewId).maybeSingle()
    if(reviewError||!review)return respond(origin,404,{error:'Review not found'})
    if(action==='detail'){
      const {data:material,error}=await admin.from('exam_answer_key_materials').select('answer_key').eq('review_id',reviewId).maybeSingle()
      if(error||!material)return respond(origin,404,{error:'Answer material unavailable'})
      return respond(origin,200,{role,review,answerKey:material.answer_key})
    }
    const decision=String(body.decision||''),note=String(body.note||'').trim().slice(0,2000)
    if(action==='developer_decision'){
      if(role!=='developer')return respond(origin,403,{error:'Developer role required for answer-key review'})
      if(!['approved','changes_requested'].includes(decision))return respond(origin,400,{error:'Invalid Developer decision'})
      const {data:nextGate,error}=await admin.rpc('exam_developer_decide',{p_workspace_id:workspaceId,p_review_id:reviewId,p_actor_id:user.id,p_decision:decision,p_note:note})
      if(error)return respond(origin,409,{error:error.message})
      return respond(origin,200,{ok:true,published:false,nextGate})
    }
    if(action==='owner_finalize'){
      if(role!=='owner')return respond(origin,403,{error:'Owner role required for final approval'})
      if(!['approved','rejected'].includes(decision))return respond(origin,400,{error:'Invalid Owner decision'})
      if(decision==='approved'&&review.developer_decision!=='approved')return respond(origin,409,{error:'Developer approval is required before Owner final approval'})
      const {data:nextGate,error}=await admin.rpc('exam_owner_finalize',{p_workspace_id:workspaceId,p_review_id:reviewId,p_actor_id:user.id,p_decision:decision,p_note:note})
      if(error)return respond(origin,409,{error:error.message})
      return respond(origin,200,{ok:true,published:false,nextGate})
    }
    return respond(origin,400,{error:'Unsupported action'})
  }catch(error){return respond(origin,400,{error:error instanceof Error?error.message:String(error)})}
})
