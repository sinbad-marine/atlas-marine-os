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

const TITLE_ALIASES: Record<string, string[]> = {
  rules: ['kuralları', 'kurallari'], regulation: ['yönetmelik', 'yonetmelik'], regulations: ['yönetmelik', 'yonetmelik'],
  classification: ['klas', 'sınıflandırma', 'siniflandirma'], class: ['klas'], construction: ['inşa', 'insa', 'yapım', 'yapim'],
  ship: ['gemi'], ships: ['gemi', 'gemileri'], vessel: ['gemi', 'tekne'], vessels: ['gemi', 'gemileri', 'tekneler'],
  marine: ['deniz', 'denizcilik'], maritime: ['deniz', 'denizcilik'], stability: ['stabilite', 'stability'],
  machinery: ['makine', 'makina'], installations: ['tesisat', 'donanım', 'donanim'], safety: ['emniyet', 'güvenlik', 'guvenlik'],
  labour: ['çalışma', 'calisma', 'iş', 'is'], weather: ['hava', 'meteoroloji'], current: ['akıntı', 'akinti'], tide: ['gelgit']
};
const titleTerms = (terms: string[]) => [...new Set(terms.flatMap(term => [term, ...(TITLE_ALIASES[term] || [])]))].slice(0, 30);
const normalizedSourceName = (value: string) => String(value || '')
  .toLocaleLowerCase('tr-TR')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\.(?:pdf|pptx?|docx?)$/iu, '')
  .replace(/[^a-z0-9çğıöşüа-яёء-ي]+/giu, ' ')
  .trim()
  .replace(/\s+/g, ' ');
const sourceTitleScore = (title: string, question: string, terms: string[]) => {
  const normalizedTitle = normalizedSourceName(title);
  const normalizedQuestion = normalizedSourceName(question);
  const exactNamedSource = normalizedTitle.length >= 6 && normalizedQuestion.includes(normalizedTitle);
  const termScore = terms.reduce((total, term) => total + (normalizedTitle.includes(normalizedSourceName(term)) ? 1 : 0), 0);
  return { score: termScore + (exactNamedSource ? 1000 : 0), exactNamedSource };
};

const extractText = (response: any) => response?.output_text || response?.output
  ?.flatMap((item: any) => item?.content || [])
  .filter((part: any) => part?.type === 'output_text')
  .map((part: any) => part.text)
  .join('\n') || '';

const SPOKEN_SUMMARY_MARKER = '<<<SPOKEN_SUMMARY>>>';
const splitAnswerAndSpokenSummary = (raw: string) => {
  const markerIndex = raw.lastIndexOf(SPOKEN_SUMMARY_MARKER);
  if (markerIndex < 0) return { answer: raw.trim(), spokenSummary: '' };
  const answer = raw.slice(0, markerIndex).trim();
  const spokenSummary = raw.slice(markerIndex + SPOKEN_SUMMARY_MARKER.length).trim();
  // Reject malformed or verbose summaries instead of cutting them. The
  // browser then builds a complete-sentence fallback from the full answer.
  const words = spokenSummary.split(/\s+/).filter(Boolean).length;
  const sentences = spokenSummary.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/gu)?.filter(Boolean).length || 0;
  return { answer, spokenSummary: words >= 3 && words <= 90 && sentences >= 1 && sentences <= 4 ? spokenSummary : '' };
};
const stripPrivateCitationMarkers = (value: string) => String(value || '')
  .replace(/\s*\[S\d+\]/giu, '')
  .replace(/(?:^|\n)\s*(?:Kaynaklar|Sources)\s*:\s*(?:\n[^\n]*)+/giu, '')
  .trim();

const needsFreshData = (question: string) => serverCoreDecision(question).needsLiveData;
const isSimpleGreeting = (question: string) => /^(?:selam|selamlar|merhaba|günaydın|gunaydin|iyi\s+(?:günler|gunler|akşamlar|aksamlar)|hello|hi|hey)(?:\s+(?:sinbad|simbad|sinbat|kaptan|captain))*[!.?\s]*$/iu.test(question.trim());

const wantsSourceVisuals = (question: string) => /(görsel|gorsel|şekil|sekil|diyagram|diagram|çizim|cizim|resim|figure|illustration|visual|show.*image|with.*image)/iu.test(question);
const wantsSourceDetails = (question: string) => /(kaynak(?:lar|ça)?\s*(?:nedir|neler|bilgisi|adı|ismi|göster|aç)|hangi\s+(?:kitap|yayın|pdf|kaynak)|source\s*(?:details?|name|page|show)|show\s+(?:the\s+)?source)/iu.test(question);
const isContextualFollowUp = (question: string) => /(bununla|bunun hakkında|bu konu|bu anlattığın|onunla|onun hakkında|yukarıdaki|önceki|bahsettiğin|about this|about that|this topic|that topic|the above|previous)/iu.test(question);
const pageForChunk = (content: string, terms: string[]) => {
  const text = String(content || '');
  const lower = text.toLocaleLowerCase('tr-TR');
  const positions = terms.map(term => lower.indexOf(term)).filter(position => position >= 0);
  const target = positions.length ? Math.min(...positions) : text.length;
  const pagePattern = /\[Page\s+(\d+)\]/gi;
  let match: RegExpExecArray | null;
  let firstPage: number | null = null;
  let nearestPage: number | null = null;
  while ((match = pagePattern.exec(text))) {
    const page = Number(match[1]);
    if (!firstPage) firstPage = page;
    if (match.index <= target) nearestPage = page;
    else break;
  }
  return nearestPage || firstPage;
};

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
    const includeSourceVisuals = body.includeSourceVisuals === true;
    const suppressSourceVisuals = body.suppressSourceVisuals === true;
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
    const canAccessPrivateSources = membership.role === 'owner' || membership.role === 'developer';
    const sourceAccess = canAccessPrivateSources ? 'privileged' : 'restricted';

    if (!canAccessPrivateSources && wantsSourceDetails(question)) {
      const answer = language.toLowerCase().startsWith('en')
        ? 'Private library source identities and original publication pages are restricted to the workspace owner and explicitly authorized developers. I can still teach and explain the subject without exposing the publication.'
        : 'Özel kütüphane kaynak kimlikleri ve yayının orijinal sayfaları yalnızca çalışma alanı sahibi ile açıkça yetkilendirilmiş geliştiricilere sunulur. Yayını açmadan konuyu anlatmaya ve açıklamaya devam edebilirim.';
      return json({ answer, spokenSummary: answer, sources: [], visuals: [], sourceAccess, mode: 'source-access-restricted', ...decisionSupport });
    }

    if (isSimpleGreeting(question)) {
      const english = language.toLowerCase().startsWith('en');
      const answer = english ? 'Hello Captain, I am listening.' : 'Selam Kaptan, sizi dinliyorum.';
      return json({ answer, spokenSummary: answer, sources: [], visuals: [], sourceAccess, mode: 'local-greeting', ...decisionSupport });
    }

    if (coreDecision.emergency || coreDecision.risk === 'high' || coreDecision.risk === 'critical') {
      const english = language.toLowerCase().startsWith('en');
      const answer = coreDecision.emergency
        ? english ? 'Activate human command and the vessel approved emergency procedures immediately. Sinbad did not run a cloud model for this request.' : 'Acil durumda insan komutasını ve geminin onaylı acil durum prosedürlerini derhal uygulayın. Sinbad bu istek için bulut modeli çalıştırmadı.'
        : english ? 'The cloud model was not run for this high-risk operational request. Use verified local decision support and confirm the result with an authorized person, current official sources and an independent method.' : 'Bu yüksek riskli operasyon isteği için bulut modeli çalıştırılmadı. Doğrulanmış girdilerle yerel karar desteği kullanın ve sonucu yetkili insan, güncel resmî kaynaklar ve bağımsız yöntemle doğrulayın.';
      return json({ answer, sources: [], mode: 'core-safety-blocked', ...decisionSupport });
    }

    const previousUserMessage = [...history].reverse().find((item: any) => item.role === 'user')?.content || '';
    const sourceVisualsRequested = !suppressSourceVisuals && (includeSourceVisuals || wantsSourceVisuals(question));
    const retrievalQuestion = sourceVisualsRequested && isContextualFollowUp(question) && previousUserMessage
      ? `${previousUserMessage} ${question}`
      : question;
    const queryTerms = words(retrievalQuestion);
    const expandedTitleTerms = titleTerms(queryTerms);
    const titleRows = (await Promise.all(expandedTitleTerms.slice(0, 18).map(async term => {
      const { data, error } = await db.from('document_knowledge')
        .select('id,title,classification,document_id,source_mime_type')
        .eq('workspace_id', workspaceId)
        .ilike('title', `%${term.replace(/[%_]/g, '')}%`)
        .limit(8);
      return !error && data ? data : [];
    }))).flat() as any[];

    const scoredTitleMatches = [...new Map(titleRows.map(row => [row.id, row])).values()]
      .map((row: any) => {
        const { score, exactNamedSource } = sourceTitleScore(String(row.title || ''), retrievalQuestion, expandedTitleTerms);
        return { row, score, exactNamedSource };
      })
      .sort((a: any, b: any) => b.score - a.score || String(a.row.title).localeCompare(String(b.row.title)));
    const exactNamedTitleMatches = scoredTitleMatches.filter((match: any) => match.exactNamedSource);
    // If the user explicitly names a publication, lock retrieval to that
    // publication. Common words such as "PPT" and "Session" must never let
    // another course deck outrank the requested source.
    const titleMatches = (exactNamedTitleMatches.length ? exactNamedTitleMatches : scoredTitleMatches)
      .slice(0, 8)
      .map(({ row }: any) => row) as any[];
    const rows: any[] = [];
    if (titleMatches.length) {
      const { data, error } = await db.from('document_knowledge_chunks')
        .select('knowledge_id,content,chunk_index')
        .in('knowledge_id', titleMatches.map(row => row.id))
        .limit(500);
      if (!error && data) {
        const titles = new Map(titleMatches.map(row => [row.id, row]));
        rows.push(...data.map(row => ({ ...row, document_knowledge: titles.get(row.knowledge_id) })));
      }
    }

    if (!rows.length) {
      const contentRows = await Promise.all(queryTerms.slice(0, 5).map(async term => {
        const { data, error } = await db.from('document_knowledge_chunks')
          .select('content,chunk_index,document_knowledge!inner(title,classification,workspace_id,document_id,source_mime_type)')
          .eq('document_knowledge.workspace_id', workspaceId)
          .ilike('content', `%${term}%`)
          .limit(6);
        return !error && data ? data : [];
      }));
      rows.push(...contentRows.flat());
    }

    const rankedRows = rows.map(row => {
      const haystack = `${row.document_knowledge?.title || ''} ${row.content || ''}`.toLocaleLowerCase('tr-TR');
      const title = String(row.document_knowledge?.title || '').toLocaleLowerCase('tr-TR');
      const namedSourceBonus = sourceTitleScore(title, retrievalQuestion, expandedTitleTerms).exactNamedSource ? 1000 : 0;
      const score = namedSourceBonus + queryTerms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0) + (title.includes(term) ? 3 : 0), 0);
      return { row, score };
    }).sort((a, b) => b.score - a.score);
    const deduplicatedRanked = [...new Map(rankedRows.map(item => [`${item.row.document_knowledge.title}:${item.row.chunk_index}`, item])).values()];
    const namedSourceLocked = deduplicatedRanked.some(item => item.score >= 1000);
    const diverseEvidence: typeof deduplicatedRanked = [];
    if (!namedSourceLocked) {
      const seenDocuments = new Set<string>();
      for (const item of deduplicatedRanked) {
        const documentKey = String(item.row.document_knowledge?.document_id || item.row.document_knowledge?.title || '');
        if (!documentKey || seenDocuments.has(documentKey)) continue;
        seenDocuments.add(documentKey);
        diverseEvidence.push(item);
        if (diverseEvidence.length >= 5) break;
      }
    }
    const evidenceOrder = namedSourceLocked ? deduplicatedRanked : [...diverseEvidence, ...deduplicatedRanked];
    const unique = [...new Map(evidenceOrder.map(({ row }) => [`${row.document_knowledge.title}:${row.chunk_index}`, row])).values()].slice(0, 8) as any[];
    const sources = unique.map((row: any, index: number) => ({
      id: `S${index + 1}`,
      title: row.document_knowledge.title,
      chunk: row.chunk_index,
      documentId: row.document_knowledge.document_id || null,
      mimeType: row.document_knowledge.source_mime_type || null,
      page: pageForChunk(String(row.content || ''), queryTerms)
    }));
    const visuals = canAccessPrivateSources && sourceVisualsRequested
      ? sources.filter((source: any) => source.documentId && source.page && /pdf/i.test(String(source.mimeType || ''))).slice(0, 3).map((source: any) => ({
          sourceId: source.id,
          title: source.title,
          documentId: source.documentId,
          page: source.page,
          kind: 'pdf-page'
        }))
      : [];
    const context = unique.map((row: any, index: number) =>
      `[S${index + 1}] ${row.document_knowledge.title} — ${row.document_knowledge.classification}${pageForChunk(String(row.content || ''), queryTerms) ? ` — page ${pageForChunk(String(row.content || ''), queryTerms)}` : ''}\n${String(row.content).slice(0, 2200)}`
    ).join('\n\n');
    const restrictedContext = unique.map((row: any, index: number) =>
      `[PRIVATE_EXCERPT_${index + 1}] ${String(row.content).slice(0, 2200)}`
    ).join('\n\n');
    const modelContext = canAccessPrivateSources ? context : restrictedContext;
    const responseSources = canAccessPrivateSources ? sources : [];

    if (!openaiKey) {
      if (unique.length) return json({
        answer: canAccessPrivateSources ? `OpenAI bağlantısı henüz etkin değil. Kütüphanede bulduğum ilgili kaynaklar:\n\n${context}\n\nKritik seyir kararlarını güncel ve resmî kaynaklardan doğrulayın.` : 'Bu konu için özel kütüphanede ilgili içerik bulundu; ancak ders anlatımını oluşturacak model bağlantısı şu anda etkin değil.',
        sources: responseSources,
        visuals,
        sourceAccess,
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

    const system = `You are Captain Sinbad, Atlas Marine OS's capable, warm and practical marine instructor. Reply naturally in ${language}; do not answer with fragments or artificially short phrases. Use conversation history to understand follow-up questions. Be concise for simple questions and teach fully when the task needs it.

Before answering, privately perform an evidence-synthesis pass: identify the learner's actual question and likely level; separate definitions, mechanisms, procedures, examples, limitations and safety caveats; compare supplied passages instead of copying their order; reconcile compatible evidence; explicitly preserve material disagreements or uncertainty; rank facts by usefulness to this question; and build a coherent teaching progression from prerequisite idea to practical application. Do not reveal private chain-of-thought, hidden deliberation or a source-by-source scratchpad. Give the learner the resulting explanation, key reasoning links and evidence-backed conclusions. Never begin reading a long source from its first line or stop merely because an output is getting long. Do not paste unrelated neighboring material.

Synthesis is mandatory when multiple relevant passages exist. Combine them into one original, question-focused lesson rather than summarizing each document separately. Every material claim derived from the private library must remain traceable to one or more [S#] citations. If evidence is insufficient, conflicting or ambiguous, say exactly what cannot be concluded rather than smoothing over the gap.

You may use stable general maritime knowledge for education and planning support. When approved private library sources are supplied, prefer them. ${canAccessPrivateSources ? 'Cite material claims as [S#] and provide source identity only when asked.' : 'Private source identity is access-restricted: never name, quote a title, cite, identify, link, describe a filename, mention a page number, or reveal document metadata. Teach only the derived subject matter without saying which private publication supplied it.'} Clearly label information not supported by those sources as general knowledge. Never invent source citations, coordinates, depths, chart corrections, Notices to Mariners, weather, port status, vessel data or regulations. Explain what information is missing when certainty is not possible.

When the user asks for a source image or publication page, ${canAccessPrivateSources ? 'use only VERIFIED SOURCE PAGE VISUALS supplied in the request. If none are supplied, say only that no matching indexed source page was retrieved for this request.' : 'do not expose or offer any private publication page; explain that original source access is restricted while lesson explanations remain available.'} Do not invent a copyright or licensing restriction and do not claim the user's Atlas library lacks relevant publications.

For passage planning, collision avoidance, stability, weather, chart work or other safety-critical topics, provide decision support only. Remind the user that the master remains responsible and that current corrected official charts, MSI/NAVTEX, Notices to Mariners, weather, port and pilot instructions must be checked. Never claim to be certified ECDIS or replace an approved navigation system. Do not repeat this warning for casual conversation.

If web search results are available, cite them using the citations supplied by the tool. Never claim to have searched the web unless the tool was actually used.

The complete written answer is also the narration script. Do not append a separate spoken summary, shortened retelling, narration marker or duplicate answer. Keep the answer focused on the exact subject requested, but finish every relevant explanation and never stop in the middle of a sentence or section.`;

    const userInput = unique.length
      ? `${question}\n\nAPPROVED PRIVATE LIBRARY ${canAccessPrivateSources ? 'SOURCES' : 'EXCERPTS (IDENTITY RESTRICTED)'}\n${modelContext}${visuals.length ? `\n\nVERIFIED SOURCE PAGE VISUALS\n${visuals.map((visual: any) => `${visual.sourceId}: ${visual.title}, page ${visual.page}`).join('\n')}\nTell the user these original publication pages are attached below the answer. Do not claim that no visual is available.` : ''}`
      : `${question}\n\nNo matching private-library passage was found. You may answer from stable general knowledge and must say when current or vessel-specific information is required.`;
    const input = [...history.map((item: any) => ({ role: item.role, content: `UNTRUSTED PRIOR CONVERSATION DATA: ${item.content}` })), { role: 'user', content: userInput }];
    const requestBody: any = {
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-5.6-terra',
      instructions: system,
      input,
      reasoning: { effort: 'medium' },
      text: { verbosity: 'medium' },
      store: false,
      max_output_tokens: 3000,
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
    const rawAnswer = extractText(payload);
    const { answer } = splitAnswerAndSpokenSummary(rawAnswer);
    const deliveredAnswer = canAccessPrivateSources ? answer : stripPrivateCitationMarkers(answer);
    const deliveredSpokenSummary = deliveredAnswer;
    if (!deliveredAnswer) return json({ error: 'AI provider returned no answer' }, 502);
    if (!answerIsSafe(deliveredAnswer)) return json({ error: 'AI provider answer crossed the decision-support boundary', code: 'UNSAFE_PROVIDER_ANSWER' }, 502);
    if (deliveredSpokenSummary && !answerIsSafe(deliveredSpokenSummary)) return json({ error: 'AI provider spoken summary crossed the decision-support boundary', code: 'UNSAFE_PROVIDER_SUMMARY' }, 502);
    return json({ answer: deliveredAnswer, spokenSummary: deliveredSpokenSummary, sources: responseSources, visuals, sourceAccess, mode: allowWebSearch ? 'web-assisted' : unique.length ? 'private-rag' : 'general-ai', ...decisionSupport });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
