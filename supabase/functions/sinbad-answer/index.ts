import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
const words=(value:string)=>[...new Set(value.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[^a-z0-9çğıöşü\s-]/gi,' ').split(/\s+/).filter(x=>x.length>3))].slice(0,8);
const extractText=(response:any)=>response?.output_text||response?.output?.flatMap((item:any)=>item?.content||[]).filter((part:any)=>part?.type==='output_text').map((part:any)=>part.text).join('\n')||'';

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
    const authorization=req.headers.get('Authorization');
    if(!authorization)return json({error:'Authentication required'},401);
    const supabaseUrl=Deno.env.get('SUPABASE_URL');
    const publishableKey=Deno.env.get('SUPABASE_ANON_KEY');
    const openaiKey=Deno.env.get('OPENAI_API_KEY');
    if(!supabaseUrl||!publishableKey)return json({error:'Server configuration incomplete'},503);
    const db=createClient(supabaseUrl,publishableKey,{global:{headers:{Authorization:authorization}}});
    const {data:{user},error:userError}=await db.auth.getUser();
    if(userError||!user)return json({error:'Invalid session'},401);
    const body=await req.json();
    const workspaceId=String(body.workspaceId||'');
    const question=String(body.question||'').trim().slice(0,4000);
    const language=String(body.language||'tr-TR').slice(0,12);
    if(!workspaceId||!question)return json({error:'workspaceId and question are required'},400);
    const {data:membership}=await db.from('workspace_members').select('role,is_active').eq('workspace_id',workspaceId).eq('user_id',user.id).eq('is_active',true).maybeSingle();
    if(!membership)return json({error:'Workspace access denied'},403);

    const queryTerms=words(question);let rows:any[]=[];
    for(const term of queryTerms.slice(0,3)){
      const {data,error}=await db.from('document_knowledge_chunks').select('content,chunk_index,document_knowledge!inner(title,classification,workspace_id)').eq('document_knowledge.workspace_id',workspaceId).ilike('content',`%${term}%`).limit(8);
      if(!error&&data)rows.push(...data);
    }
    const unique=[...new Map(rows.map(row=>[`${row.document_knowledge.title}:${row.chunk_index}`,row])).values()].slice(0,10);
    if(!unique.length)return json({needsWebPermission:false,answer:'Onaylı özel kütüphanede bu soruyu yanıtlayacak yeterli kaynak bulunamadı.'});
    const context=unique.map((row:any,index:number)=>`[S${index+1}] ${row.document_knowledge.title} — ${row.document_knowledge.classification}\n${String(row.content).slice(0,2200)}`).join('\n\n');
    if(!openaiKey)return json({answer:`İlgili özel kütüphane pasajları:\n\n${context}\n\nKritik seyir kararlarını özgün ve güncel yayınlardan doğrulayın.`,sources:unique.map((row:any,index:number)=>({id:`S${index+1}`,title:row.document_knowledge.title,chunk:row.chunk_index})),mode:'retrieval-only'});

    const prompt=`You are Sinbad, a private marine navigation education and operations-support assistant. Answer in ${language}. Use only the supplied owner-approved library sources. Cite every material claim with [S#] and distinguish general training principles from time-sensitive operational facts. Teach step by step: state the learning objective, explain the principle, give a worked training example when the evidence supports one, ask a short check-for-understanding question, and identify the original source section the learner should review. Never claim to issue a certificate, replace an approved instructor, or declare a learner competent. Never invent coordinates, depths, regulations, weather, port availability, chart corrections, notices, vessel data, calculations or source text. If evidence is insufficient, say exactly what is missing. For collision-regulation scenarios, identify all relevant facts before applying a rule and never reduce the decision to a simplistic right-of-way slogan. Passage plans are drafts requiring captain approval and live checks against corrected official charts, MSI/NAVTEX, Notices to Mariners, weather, port and pilot instructions. Offline knowledge is educational reference only and must not be presented as current operational data.\n\nQUESTION\n${question}\n\nAPPROVED PRIVATE SOURCES\n${context}`;
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${openaiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:Deno.env.get('OPENAI_MODEL')||'gpt-5.6-terra',input:prompt,reasoning:{effort:'medium'},text:{verbosity:'medium'},store:false,max_output_tokens:2500,safety_identifier:`sinbad-${user.id}`})});
    const payload=await response.json();
    if(!response.ok)return json({error:'AI provider request failed',providerStatus:response.status},502);
    const answer=extractText(payload);
    if(!answer)return json({error:'AI provider returned no answer'},502);
    return json({answer,sources:unique.map((row:any,index:number)=>({id:`S${index+1}`,title:row.document_knowledge.title,chunk:row.chunk_index})),mode:'private-rag'});
  }catch(error){return json({error:error instanceof Error?error.message:'Unexpected error'},500);}
});
