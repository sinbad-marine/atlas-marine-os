import { createClient } from 'npm:@supabase/supabase-js@2';

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

const needsFreshData = (question: string) => /(bugün|yarın|şimdi|güncel|son notice|hava|rüzgâr|rüzgar|forecast|weather|navtex|msi|liman açık|port open|current|latest|today|tomorrow)/iu.test(question);

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
    const question = String(body.question || '').trim().slice(0, 6000);
    const language = String(body.language || 'tr-TR').slice(0, 12);
    const allowWebSearch = body.allowWebSearch === true;
    const history = Array.isArray(body.history) ? body.history.slice(-10).map((item: any) => ({
      role: item?.role === 'assistant' || item?.role === 'sinbad' ? 'assistant' : 'user',
      content: String(item?.content || item?.text || '').slice(0, 2500)
    })).filter((item: any) => item.content) : [];
    if (!workspaceId || !question) return json({ error: 'workspaceId and question are required' }, 400);

    const { data: membership } = await db.from('workspace_members')
      .select('role,is_active')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!membership) return json({ error: 'Workspace access denied' }, 403);

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
        mode: 'retrieval-only'
      });
      return json({
        answer: 'Sinbad’ın AI bağlantısı henüz etkinleştirilmemiş. Kütüphanede de bu soruyla eşleşen bir kaynak bulamadım.',
        mode: 'configuration-required'
      });
    }

    if (!allowWebSearch && needsFreshData(question) && !unique.length) {
      return json({ needsWebPermission: true, mode: 'web-permission-required' });
    }

    const system = `You are Captain Sinbad, Atlas Marine OS's capable, warm and practical marine assistant. Reply naturally in ${language}; do not answer with fragments or artificially short phrases. Use conversation history to understand follow-up questions. Be concise for simple questions and detailed when the task needs it.

You may use stable general maritime knowledge for education and planning support. When approved private library sources are supplied, prefer them and cite material claims as [S#]. Clearly label information not supported by those sources as general knowledge. Never invent source citations, coordinates, depths, chart corrections, Notices to Mariners, weather, port status, vessel data or regulations. Explain what information is missing when certainty is not possible.

For passage planning, collision avoidance, stability, weather, chart work or other safety-critical topics, provide decision support only. Remind the user that the master remains responsible and that current corrected official charts, MSI/NAVTEX, Notices to Mariners, weather, port and pilot instructions must be checked. Never claim to be certified ECDIS or replace an approved navigation system. Do not repeat this warning for casual conversation.

If web search results are available, cite them using the citations supplied by the tool. Never claim to have searched the web unless the tool was actually used.`;

    const userInput = unique.length
      ? `${question}\n\nAPPROVED PRIVATE LIBRARY SOURCES\n${context}`
      : `${question}\n\nNo matching private-library passage was found. You may answer from stable general knowledge and must say when current or vessel-specific information is required.`;
    const input = [...history, { role: 'user', content: userInput }];
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
    return json({ answer, sources, mode: allowWebSearch ? 'web-assisted' : unique.length ? 'private-rag' : 'general-ai' });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
