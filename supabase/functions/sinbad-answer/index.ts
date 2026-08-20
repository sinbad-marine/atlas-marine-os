import { createClient } from 'npm:@supabase/supabase-js@2';
import './core-decision.js';

const { CORE_GATE_VERSION, normalizeCoreQuestion, normalizeCoreHistory, serverCoreDecision, validateCoreEnvelope, answerIsSafe } = (globalThis as any).SinbadCoreDecision;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
});

const STOP = new Set(['ve','veya','ile','için','ama','bir','bu','şu','the','and','for','that','this','what','how','can','you']);
const words = (value: string) => [...new Set(
  value.toLocaleLowerCase('tr-TR')
    .normalize('NFKC')
    .replace(/[^a-z0-9çğıöşüа-яёء-ي\s-]/gi, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP.has(word))
)].slice(0, 12);

const extractText = (response: any) => response?.output_text || response?.output
  ?.flatMap((item: any) => item?.content || [])
  .filter((part: any) => part?.type === 'output_text')
  .map((part: any) => part.text)
  .join('\n') || '';

const needsFreshData = (question: string) => serverCoreDecision(question).needsLiveData;

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication required' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!supabaseUrl || !publishableKey) return json({ error: 'Server configuration incomplete' }, 503);

    const db = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await db.auth.getUser();
    if (userError || !user) return json({ error: 'Invalid session' }, 401);

    const body = await req.json();
    const workspaceId = String(body.workspaceId || '');
    const question = normalizeCoreQuestion(body.question);
    const language = String(body.language || 'tr-TR').slice(0, 12);
    const allowWebSearch = body.allowWebSearch === true;
    const coreEnvelope = body.coreEnvelope;
    const history = normalizeCoreHistory(coreEnvelope?.history, 10);
    if (!workspaceId || !question) return json({ error: 'workspaceId and question are required' }, 400);
    if (!validateCoreEnvelope(coreEnvelope, question)) return json({ error: 'Core safety envelope missing or inconsistent', code: 'CORE_GATE_BLOCKED' }, 400);
    const coreDecision = serverCoreDecision(question);
    const decisionSupport = { coreGateVersion: CORE_GATE_VERSION, coreDecision, permission: 'DECISION_SUPPORT_ONLY', executionPerformed: false };

    const { data: membership } = await db.from('workspace_members')
      .select('role,is_active')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!membership) return json({ error: 'Workspace access denied' }, 403);

    if (coreDecision.emergency || coreDecision.risk === 'high' || coreDecision.risk === 'critical') {
      const english = language.toLowerCase().startsWith('en');
      const answer = coreDecision.emergency
        ? english ? 'Activate human command and the vessel approved emergency procedures immediately. Sinbad did not run a cloud model for this request.' : 'Acil durumda insan komutasını ve geminin onaylı acil durum prosedürlerini derhal uygulayın. Sinbad bu istek için bulut modeli çalıştırmadı.'
        : english ? 'The cloud model was not run for this high-risk operational request. Use verified local decision support and confirm the result with an authorized person, current official sources and an independent method.' : 'Bu yüksek riskli operasyon isteği için bulut modeli çalıştırılmadı. Doğrulanmış girdilerle yerel karar desteği kullanın ve sonucu yetkili insan, güncel resmî kaynaklar ve bağımsız yöntemle doğrulayın.';
      return json({ answer, sources: [], mode: 'core-safety-blocked', ...decisionSupport });
    }

    const rows: any[] = [];
    for (const term of words(question).slice(0, 5)) {
      const { data, error } = await db.from('document_knowledge_chunks')
        .select('content,chunk_index,document_knowledge!inner(title,classification,workspace_id)')
        .eq('document_knowledge.workspace_id', workspaceId)
        .ilike('content', `%${term}%`)
        .limit(6);
      if (!error && data) rows.push(...data);
    }

    const unique = [...new Map(rows.map(row => [`${row.document_knowledge.title}:${row.chunk_index}`, row])).values()].slice(0, 10) as any[];
    const sources = unique.map((row: any, index: number) => ({ id: `S${index + 1}`, title: row.document_knowledge.title, chunk: row.chunk_index }));
    const context = unique.map((row: any, index: number) =>
      `[S${index + 1}] ${row.document_knowledge.title} — ${row.document_knowledge.classification}\n${String(row.content).slice(0, 2200)}`
    ).join('\n\n');

    if (!openaiKey) {
      if (unique.length) return json({
        answer: `OpenAI bağlantısı henüz etkin değil. Kütüphanede bulduğum ilgili kaynaklar:\n\n${context}\n\nKritik seyir kararlarını güncel ve resmî kaynaklardan doğrulayın.`,
        sources,
        mode: 'retrieval-only',
        ...decisionSupport
      });
      return json({
        answer: 'Sinbad’ın AI bağlantısı henüz etkinleştirilmemiş. Kütüphanede de bu soruyla eşleşen bir kaynak bulamadım.',
        mode: 'configuration-required',
        ...decisionSupport
      });
    }

    if (!allowWebSearch && needsFreshData(question) && !unique.length) {
      return json({ needsWebPermission: true, mode: 'web-permission-required', ...decisionSupport });
    }

    const system = `You are Captain Sinbad, Atlas Marine OS's capable, warm and practical marine assistant. Reply naturally in ${language}; do not answer with fragments or artificially short phrases. Use conversation history to understand follow-up questions. Be concise for simple questions and detailed when the task needs it.

You may use stable general maritime knowledge for education and planning support. When approved private library sources are supplied, prefer them and cite material claims as [S#]. Clearly label information not supported by those sources as general knowledge. Never invent source citations, coordinates, depths, chart corrections, Notices to Mariners, weather, port status, vessel data or regulations. Explain what information is missing when certainty is not possible.

For passage planning, collision avoidance, stability, weather, chart work or other safety-critical topics, provide decision support only. Remind the user that the master remains responsible and that current corrected official charts, MSI/NAVTEX, Notices to Mariners, weather, port and pilot instructions must be checked. Never claim to be certified ECDIS or replace an approved navigation system. Do not repeat this warning for casual conversation.

If web search results are available, cite them using the citations supplied by the tool. Never claim to have searched the web unless the tool was actually used.`;

    const userInput = unique.length
      ? `${question}\n\nAPPROVED PRIVATE LIBRARY SOURCES\n${context}`
      : `${question}\n\nNo matching private-library passage was found. You may answer from stable general knowledge and must say when current or vessel-specific information is required.`;
    const input = [...history.map((item: any) => ({ role: 'user', content: `UNTRUSTED PRIOR CONVERSATION DATA: ${item.content}` })), { role: 'user', content: userInput }];
    const requestBody: any = {
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-5.6-terra',
      instructions: system,
      input,
      reasoning: { effort: 'low' },
      text: { verbosity: 'medium' },
      store: false,
      max_output_tokens: 2200,
      safety_identifier: `sinbad-${user.id}`
    };
    if (allowWebSearch) requestBody.tools = [{ type: 'web_search' }];

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    const payload = await response.json();
    if (!response.ok) return json({ error: 'AI provider request failed', providerStatus: response.status, providerCode: payload?.error?.code || null }, 502);
    const answer = extractText(payload);
    if (!answer) return json({ error: 'AI provider returned no answer' }, 502);
    if (!answerIsSafe(answer)) return json({ error: 'AI provider answer crossed the decision-support boundary', code: 'UNSAFE_PROVIDER_ANSWER' }, 502);
    return json({ answer, sources, mode: allowWebSearch ? 'web-assisted' : unique.length ? 'private-rag' : 'general-ai', ...decisionSupport });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
