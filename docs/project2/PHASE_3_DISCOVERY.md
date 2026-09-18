# SINBAD PROJECT 2 — PHASE 3 DISCOVERY REPORT

Owner MASTER TASK DIRECTIVE 2026-09-16, TASK C. Read-only discovery and architecture analysis. NO IMPLEMENTATION AUTHORITY: no Sentinel, Gatekeeper, Pilot or Co-Pilot code exists or was written; no model activated; no routing, runtime, Owner Console, Academy, GASM, ARGOS assurance or production configuration changed. Every implementation claim below was checked against the source on `main aee0ad5` on 2026-09-17; labels: VERIFIED (read in source or observed), NOT VERIFIED, UNKNOWN, SOURCE MISSING, CONFLICT, NOT APPLICABLE.

## 1. Authoritative starting state

- `origin/main` = `aee0ad545c6517df707c5f969269900222f6f849` (PR #250 squash, parent 91d142a). VERIFIED.
- ARGOS verifier on the exact main bytes: ARGOS_INTEGRITY_VERIFIED, 105 protected files, inventoryHash 8966c16a…. VERIFIED.
- Working tree clean, 0 untracked files before this task; this task's branch `codex/project2-phase2-acceptance-freeze` adds documentation and one freeze test only. VERIFIED.
- Live Pages release-manifest sourceCommit = aee0ad5. VERIFIED (2026-09-16).
- Legacy bridge (127.0.0.1:31983) not running and not started by this task; Ollama reachable with qwen3:14b / qwen3:4b; XTTS worker (pid from 2026-09-12) still listening on 31984 without a bridge. VERIFIED (observed 2026-09-16 11:20Z).
- Academy, GASM, Owner Console, runtime, scheduled assurance: untouched. VERIFIED (no diff outside docs/project2 and tests/baseline-001-freeze.test.js).

## 2. Phase 2 Owner acceptance

Recorded in `docs/project2/PROJECT2_STATE.json` → `owner_acceptance.phase_2`: OWNER ACCEPTED against `aee0ad5`, scope = benchmark environment, gold datasets, harness and BASELINE-001 as the official comparison reference. Not an acceptance of any measured capability; not an implementation authorization. Historical evidence unchanged.

## 3. BASELINE-001 freeze evidence

`docs/project2/BASELINE-001_FREEZE.json` (31 files, sha256 from the aee0ad5 blobs, LF-normalized; run identities; combined totals 61/34/53/4; runtime identity; limitations; unresolved findings; truth labels; revision policy) + `docs/project2/BASELINE-001_FREEZE.md` + `tests/baseline-001-freeze.test.js` (3 tests, in `npm test`, fails on any drift). Verified locally: 3/3 pass against the current tree.

## 4. Current request / data / model / response flow (VERIFIED from source)

Ingress A — dashboard Captain Sinbad (`app.js` `sinbadLocalAnswer`): (1) `SinbadCore.orchestrate()` with deterministic experts (emergency text, navigation assistant over the navigation engine); (2) greeting regex; (3) non-marine questions → local bridge only; (4) marine questions → if `navigator.onLine===false` local bridge first, else cloud `sinbad-answer` first, then local bridge, then Academy offline answer, then private-library lexical search. Every AI call carries `SinbadCore.aiEnvelope(question,history)` and the returned answer must pass `answerIsSafe()` (regex boundary against execution claims) or it is discarded.

Ingress B — Academy classroom (`academy-classroom-window.js` `answerAcademyQuestion`): gesture request → deterministic capability/foundation/social answers → local bridge with verified Academy evidence (`academyLocalAiAnswer`, 120 s abort) → honest refusal text. Never cloud.

Ingress C — Owner Console (`exam-review.js`) and Academy training (`academy-owner-training.js`): no free-text AI; gated RPC/edge-function calls behind founder step-up (AAL2 + single-use grant). NOT part of the conversation path.

Local model path — `bridge/sinbad-bridge.ps1` `/ai/chat` (single-threaded `TcpListener` loop; no queue: concurrent callers wait in the TCP backlog): ARGOS command envelope admission (version, action, target, command id, 300 s freshness, replay ledger 4096) → Owner-boundary check for registered write/physical actions (not for AI_INFERENCE) → body limits (2 MB) → `Invoke-SinbadLocalAi`: deterministic instant answers (greetings, arithmetic, one stable safety definition) → history (last 10) → library scan of all 90,552 chunks (top 6 by term hits) unless "direct fast question" → Kiwix (currently throws) → system prompt (persona; "reason from excerpts, cite title, never claim absent content; dated encyclopedia; blocked volatile claims") + user content = question + evidence blocks → tier router (deterministic keyword/length scoring; both tiers routed to qwen3:14b) → Ollama `/api/chat` (`think:false`, temperature 0.35, num_ctx 8192/32768, num_predict 192 fast / 2048 deep, keep_alive 30 m, client budget 600 s) → empty-content recovery retry from the private thinking tail → response {answer, model, modelTier, routing, mode, knowledge}. No evidence set is returned. Errors inside the handler → HTTP 400 with the exception message (observed twice in BASELINE-001).

Cloud path — `supabase/functions/sinbad-answer/index.ts`: JWT + workspace membership → `validateCoreEnvelope` (CORE_GATE_BLOCKED before any provider call) → server-side `serverCoreDecision` → private RAG over `document_knowledge_chunks` (top 8, dedup, page hints, visuals) → optional web permission gate (`needsWebPermission`) → OpenAI Responses API (`gpt-5.6-terra`, max_output_tokens 3000, decision-support system prompt) → `answerIsSafe` on answer and spoken summary (502 on violation) → response includes `sources`, `visuals`, `mode` (`private-rag` / `web-assisted` / general) and `permission: DECISION_SUPPORT_ONLY, executionPerformed:false`.

Completion / delivery — browser renders text, optional XTTS clone speech via bridge `/ai/tts`, Academy board writes through a bounded browser-side queue (`queueSinbadAcademyBoardPayload`, max 4, request ids, timeouts) — the only explicit queue in the conversation path. VERIFIED.

Guardian / runtime health — no runtime guardian for the conversation path. `sinbad-ai-core/argos-supervisor.js` `supervise()` assesses health observations (APPLICATION/TEST_SUITE/RELEASE_PIPELINE critical) and quarantines repair proposals; it is invoked by tooling/CI (`tools/run-argos-health.js`), not by the bridge. The scheduled assurance run has failed at this step on every run since at least 2026-09-11 (pre-existing). VERIFIED.

Timeouts / retries — bridge: 10 s request-header/body budget, 600 s Ollama client, one final-answer retry on empty content, XTTS 150 s; browser: 120 s (Academy) / none explicit for dashboard fetch beyond browser defaults (NOT VERIFIED for dashboard); cloud: provider fetch without explicit timeout in the read lines (NOT VERIFIED). No retry on 400/502 anywhere in the chain. VERIFIED except where marked.

Memory / state access — conversation history only (browser sends last 10 turns); `sinbad-ai-core/memory` exists but is not wired into the bridge or cloud path (advisory, evidence-boundary "memory is context only"); no task memory; PROJECT_STATE.json and other authoritative state are never read by any AI path. VERIFIED.

Hallucination-risk controls present — system-prompt instructions (cite titles, never invent, dated encyclopedia, blocked volatile claims); Kiwix volatile/high-risk regex; `core-decision` intent/live-data/operational classification and `answerIsSafe` execution-claim boundary; cloud `needsWebPermission`. None of them checks factual grounding of the produced text; BASELINE-001 shows ≥6 confident inventions and 0/8 verifiable citations. VERIFIED.

Security boundaries — bridge loopback only, origin allow-list for browser origins, ARGOS envelope + replay ledger, Owner boundary (server-verified single-use, only for registered write/physical routes), body limits; cloud RLS + JWT + Core gate; Owner Console founder step-up (AAL2 VERIFIED 2026-09-15). VERIFIED.

## 5. Existing relevant components (reuse candidates)

| Component | State | Relevance |
|---|---|---|
| `core-decision.js` (`analyzeCore`, `serverCoreDecision`, `validateCoreEnvelope`, `answerIsSafe`) | WORKING, TESTED, INTEGRATED (browser + cloud) | first deterministic gate in the chain; extend, do not replace |
| bridge ARGOS admission + Owner boundary | WORKING, TESTED, INTEGRATED | Gatekeeper transport layer for the local path |
| `sinbad-ai-core/orchestrator/decision-pipeline.js` (v2, PLAN_ONLY, STOP modes) and `grounded-orchestrator.js` (seal → release gate → projection) | TESTED, inert | shape of a Pilot loop with fail-closed stages |
| `verification/claim-planner.js`, `claim-support-verifier.js`, `answer-citation-map-verifier.js`, `query-coverage-gate.js` | TESTED, inert | Co-Pilot deterministic checks (claims vs evidence, citation map) |
| `grounding/confidence-evaluator.js`, `citation-builder.js` | TESTED, inert | uncertainty labelling, citation construction |
| `truth-stop-task-contracts.js` (TruthClaim, SafeStopRecord, ExecutionStatus) | TESTED, inert | claim/safe-stop records for Gatekeeper outputs |
| `argos-agent-envelope.js` (capabilities READ/TEST/WRITE_PROPOSAL/REPAIR_PROPOSAL/RELEASE_PROPOSAL, issue/verify) | TESTED, inert | capability envelope for Pilot tool requests |
| `argos-health-contracts.js` + `argos-supervisor.js` | TESTED, used by tooling | Sentinel health vocabulary and quarantine semantics |
| `memory/evidence-boundary.js` | TESTED, inert | "memory is advisory" labelling |
| `world-brain/freshness-policy.js`, `topic-router.js` | TESTED, inert | stale-knowledge policy for Gatekeeper |
| Phase 2 harness (`tests/benchmark`, frozen) | VERIFIED | the only measurement instrument |
| `tools/roundtable-review.js` | TESTED, manual | independent remote second opinion on diffs (cloud, policy-gated) |

## 6. Protected boundaries (must not be modified for discovery or Phase 3 without their own gates)

ARGOS-protected files (105) including `bridge/sinbad-bridge.ps1`, `academy-classroom-window.js`, `package.json`, `config/*`, many tests and tools — any change needs record reconciliation and CI. Owner Console / Supabase edge functions and migrations — Owner Gate (production side effects). Academy — HOLD. GASM — out of scope. Scheduled assurance — out of scope. Bridge runtime — do not start/patch (Owner instruction). Production Supabase behaviour — no change.

## 7. Sentinel — candidate integration points

Role: observer and signal producer; never a decision-maker, never a writer of authoritative state.

- Observes: request ingress metadata (surface, workflowId, language, length), Gatekeeper decisions, Pilot inputs/outputs (hash + labels, not necessarily full text), evidence-set identity (which library documents/chunks, which cloud sources), model identity/digest/tier, latency and resource samples (already implemented in the benchmark `resources.js`), bridge/Ollama liveness (`/status`, `/api/tags`, `ollama ps`), runtime incidents (HTTP 400/502, resets, process exit), Co-Pilot verdicts, authoritative-state snapshot hashes (git head, PROJECT_STATE sha, DB reads when available).
- Must never modify: prompts, routing, evidence, answers, authoritative state, ARGOS policy, Owner grants.
- Signals: `SentinelObservation` records (content-free where possible, hash-chained like ARGOS journals), health states (reuse HEALTHY/DEGRADED/UNAVAILABLE/UNKNOWN), risk flags forwarded to Gatekeeper and Co-Pilot, incident shelf entries (reuse `argos-event-shelf`).
- Position in lifecycle: taps at (a) ingress, (b) after evidence retrieval, (c) after model output, (d) after Gatekeeper decision, (e) delivery. Candidate host: a new loopback Node service beside the bridge (not inside the PowerShell script), or, for the cloud path, an edge-function middleware. Recommendation: Node loopback service first (local-first, no cloud cost).
- Failure mode if Sentinel fails: the request continues but is labelled `SENTINEL_UNAVAILABLE`; Gatekeeper treats missing Sentinel signals as "risk unknown" and applies the stricter default only for protected actions (fail closed for actions, fail open with a label for read-only answers). This is a design proposal, NOT VERIFIED by any test yet.

## 8. Gatekeeper — candidate integration points

Deterministic admission and control, before the model (pre-gate) and before delivery (post-gate).

- Pre-gate candidates: identity/authority (reuse ARGOS envelope + Owner boundary + founder step-up); context integrity (workflowId ↔ surface ↔ evidence scope); model availability (Ollama tags/ps, bridge liveness; fail closed with an honest "local model unavailable" instead of a 400); memory/state consistency (snapshot hash age); resource availability (free RAM floor — BASELINE-001 saw 497 MB free); volatile-claim blocking (reuse Kiwix volatile regex and `core-decision` live-data class); protected actions (reuse registered-action table).
- Post-gate candidates: provenance adequacy (every cited source must exist in the evidence set; the bridge must expose the evidence set — the single most valuable change for provenance); unsupported-specificity screen (hashes, ids, dates, numbers not present in evidence → NOT VERIFIED label or block for critical classes); claim-vocabulary control (VERIFIED/PASS/MERGED/ONLINE only with evidence reference); uncertainty labelling (attach VERIFIED / NOT VERIFIED / CONFLICT / SOURCE MISSING / BLOCKED); hallucination-risk escalation (Co-Pilot verdict → block or label per policy); fail-closed conditions (missing evidence for critical classes, Sentinel/Co-Pilot unavailable for protected actions, resource floor breached).
- Deterministic vs AI: Gatekeeper rules are code with tests and fixed inputs (regexes, set membership, hashes, thresholds); Co-Pilot judgement is an input signal to Gatekeeper, never a rule; the two are logged separately (rule id vs verdict id) so a decision is always attributable to one or the other.

## 9. Pilot — candidate integration points

- Receives: the Owner/user turn with TaskContext (workflowId, surface, language), evidence blocks with identifiers (library doc + chunk, cloud source ids), authoritative-state snapshot references it is allowed to cite (git head, PROJECT_STATE excerpt, live status JSON) supplied by tools, Gatekeeper pre-gate result, the conversation history (bounded).
- May eventually request (through envelopes, never directly): retrieval (library, cloud RAG), deterministic engines (navigation via the existing adapter; passage plan via `SinbadCore.passagePlan`), read-only repo/state reads, benchmark runs. Every request is a proposal admitted by Gatekeeper; execution stays in tool adapters.
- Reads as authoritative: class B sources per ARCHITECTURE_AUTHORITY_MODEL.md, only through tool results with identifiers.
- Must never treat as authoritative: its own prior output, chat history, model memory, Owner intent statements about facts, Sentinel/Co-Pilot opinions.
- Provenance linking: every answer carries an `EvidenceMap` (claim → evidence id) built with `citation-builder` semantics; answers without a map are labelled by Gatekeeper.
- Benchmarking: the frozen harness runs against any HTTP endpoint that speaks the `/ai/chat` contract (`--base-url`), so a Pilot service can be measured with identical gold sets; additional fields (evidence set, labels) are ignored by v1.0.0 scoring and can be used by a future harness revision.
- Model: no final selection. Evidence available: qwen3:14b on CPU produces usable coding and conflict-naming behaviour but 5–6 minute answers with the current library scan and ≥6 inventions in 20 hallucination probes; qwen3:4b's Ollama template is unreliable (bridge comment, not re-verified here). Choosing a model requires a Phase 3 measurement, not an assumption. NOT VERIFIED.

## 10. Co-Pilot — candidate integration points

- Independent from Pilot: separate prompt, separate context (sees the task, the evidence identifiers and the Pilot's final text; never the Pilot's private reasoning), ideally a different model or at least a different sampling seed and instruction set; may also be partly deterministic (reuse `claim-support-verifier`, `answer-citation-map-verifier`, benchmark scorers as runtime checkers).
- Inputs: TaskContext, evidence set with ids, authoritative snapshot refs, Pilot draft, Gatekeeper pre-gate result, Sentinel flags.
- Outputs: `CoPilotVerdict` (warning classes below with confidence and pointers), never an answer of its own; escalation flag to Owner.
- Cannot: rewrite the answer, approve actions, override Gatekeeper or Owner. It can force labels (via Gatekeeper policy) and block only where policy says a warning class is blocking.
- Correlated-failure control: Pilot and Co-Pilot must not share the same evidence-free prompt path; if both are the same model, a deterministic checker layer must exist so that a shared blind spot cannot pass silently.

## 11. Hallucination early-warning architecture

Warning classes (all to be emitted as typed `CoPilotVerdict.warnings[]`): context mismatch (workflow/surface vs content); source/evidence mismatch (cited title not in evidence set — deterministic); unsupported factual assertion (specific numbers/ids/dates/quotes not in evidence — deterministic screen + AI judgement); stale authoritative state (snapshot older than policy or contradicted by a newer read); contradiction with repository/runtime truth (tool-backed compare); false certainty (assertive wording without evidence; BASELINE-001 pattern in HL-01/06/16/18); provenance gap (no EvidenceMap); instruction conflict (system vs user vs Owner directive); role confusion (Pilot speaking as Owner Console/Sentinel); unintended task expansion (actions beyond TaskContext); unsafe action request (protected action without grant); Pilot/Co-Pilot correlated failure risk (same model, same evidence gap → require deterministic fallback).

Early-warning placement: after retrieval (evidence adequacy: empty/weak evidence → warn before the model runs; the bridge currently proceeds with top-6 lexical hits regardless of relevance, which produced HL-01's "Element 19 = PMS" invention), after the draft (deterministic checks first, then AI judgement), before delivery (label/block by policy). The BASELINE-001 gold sets are the initial regression suite for these warnings (hallucination, stale-state, contradiction, isolation, citation categories).

## 12. Deterministic-vs-AI responsibility matrix

| Concern | Deterministic (Gatekeeper/Sentinel/tools) | AI (Pilot) | AI (Co-Pilot) | Authority (Owner) |
|---|---|---|---|---|
| identity, permissions, protected actions | decide | request only | flag | grant/deny |
| evidence retrieval and identity | perform, record ids | request, consume | verify ids | — |
| factual claims | screen specificity vs evidence | produce with EvidenceMap | challenge | — |
| citations | verify against evidence set | produce | verify | — |
| uncertainty labels | attach/enforce | propose | propose | — |
| conflicts (class B) | detect where tool-backed | explain | flag | resolve class A conflicts |
| volatile/current claims | block | — | flag | — |
| resources, liveness, timeouts | measure, fail closed | — | — | — |
| final delivery | apply policy | — | — | — |
| acceptance of results | — | — | — | decide |

## 13. Proposed message/data flow (proposal, not implemented)

Owner/user turn → Ingress adapter builds `TaskContext` → Sentinel tap 1 → Gatekeeper pre-gate (authority, context, availability, volatility, resources) → Retrieval tools produce `EvidenceSet{ids}` → Sentinel tap 2 + early-warning (evidence adequacy) → Pilot produces `Draft{text, EvidenceMap, proposedActions}` → deterministic checkers (citations, specificity, claim vocabulary) → Co-Pilot produces `CoPilotVerdict` → Gatekeeper post-gate applies policy (label / block / escalate) → Delivery with labels and evidence references → Sentinel tap 3 + journal (hash-chained). Actions proposed by Pilot go to tool adapters only after Gatekeeper admission and, for protected classes, Owner grant.

## 14. Proposed failure modes

Sentinel down → continue read-only answers with `SENTINEL_UNAVAILABLE` label; block protected actions. Gatekeeper down → fail closed (no answer, honest error). Retrieval down → answer only with `SOURCE MISSING` label; block critical classes. Model down → honest "unavailable" (not HTTP 400). Co-Pilot down → deterministic checkers only; label `COPILOT_UNAVAILABLE`; block protected actions. Pilot timeout → bounded budget (per tier) with a SafeStopRecord; no silent 600 s waits. Bridge process death → detectable by Sentinel liveness; restart remains an Owner/ops decision unless a watchdog is separately authorized.

## 15. Security implications

New loopback service must inherit the bridge's boundaries (loopback only, origin allow-list, ARGOS envelope, replay ledger) and must not weaken the Owner boundary; Co-Pilot/Sentinel must not receive credentials; journals must stay content-free where ARGOS requires it; any cloud model use for Co-Pilot is a policy and cost decision (Owner Gate); tool adapters for repo/state reads must be read-only and scoped; no new background service without Owner authorization (the directive forbids it in this phase).

## 16. Runtime/resource implications (from BASELINE-001)

CPU-only 14B inference (~17 s model-only, 5–6 min with the library scan); adding a Co-Pilot pass roughly doubles model time unless the checker layer is deterministic-first and the Co-Pilot model is smaller; free RAM fell to 497 MB during the baseline — a second model resident in RAM is not viable on this host without measurement; the library scan is the dominant cost and must be indexed before any multi-model loop is practical (this is an implementation change and out of scope here).

## 17. Benchmark strategy against BASELINE-001

Measurable now with the frozen harness (same gold sets, `--base-url` to the new endpoint): factual correctness (maritime anchors), hallucination rate and abstention quality (hallucination, stale-state, isolation sets), provenance (citation-vs-index; improves to citation-vs-evidence-set once the endpoint returns evidence ids — requires a harness revision, documentation-only for now), contradiction detection, context integrity, latency and resources, reliability, failure recovery (probes). Missing measurements to add later (documentation-only now): false blocking rate (benign prompts wrongly blocked), false allowing rate (harmful/unsupported claims passed), model-disagreement handling (Pilot vs Co-Pilot verdict agreement matrix), evidence-adequacy warnings precision, label correctness (VERIFIED/NOT VERIFIED assigned correctly against gold), per-stage latency breakdown. Gold v1.0.1 detector fixes should be applied as BASELINE-001-REV-1 (offline re-score) before comparisons so that scorer false negatives do not masquerade as improvements.

## 18. Identified architectural conflicts

- The bridge is a single PowerShell process with in-process library scanning and a per-request catch that turns any exception into HTTP 400; a multi-stage loop cannot be added inside it safely. Conflict with "do not refactor the bridge": resolved by placing new roles in a separate loopback service that calls the bridge (or Ollama) as a tool.
- `core-decision.js` is shared by browser and cloud and enforced by a golden-query test; Gatekeeper extensions must keep the two decisions identical.
- The classroom and dashboard expect `/ai/chat`-shaped responses; new labels/evidence fields must be additive.
- ARGOS scheduled assurance already fails at health observation; a Sentinel that emits health must not be judged by that broken step until it is fixed separately.
- Two unexplained bridge terminations: any Sentinel liveness design must assume the local model host can vanish without a log line.

## 19. Unknowns / NOT VERIFIED

Root cause of the bridge terminations (UNKNOWN); dashboard fetch timeout for the local path (NOT VERIFIED); cloud provider timeout/retry behaviour (NOT VERIFIED beyond the lines read); qwen3:4b template reliability (NOT VERIFIED here); GPU (Intel Arc) usability for Ollama on this host (NOT VERIFIED); whether the Owner Console/Supabase conversation path used by the MASTER line is `sinbad-answer` (NOT VERIFIED in this line; MASTER audit states it does not depend on 31983); Kiwix null-method error location (SOURCE read, cause not isolated); Owner boundary behaviour under a new service (NOT APPLICABLE until designed).

## 20. Recommended bounded Phase 3 implementation sequence (for Owner review; no work started)

1. **Phase 3.1 — Contracts and labels (code, inert, tested):** `TaskContext`, `EvidenceSet`, `EvidenceMap`, `CoPilotVerdict`, `GateDecision`, claim vocabulary and label rules as `sinbad-ai-core/authority/*` with unit tests; no live wiring. Owner Gate: IMPLEMENTATION GO (repo only).
2. **Phase 3.2 — BASELINE-001-REV-1:** gold v1.0.1 detector fixes + offline re-score of the frozen answers; publish both numbers. Owner Gate: IMPLEMENTATION GO (repo only, no model run).
3. **Phase 3.3 — Sentinel v0 (observe-only) as a loopback Node service** that proxies `/ai/chat` to the existing bridge unchanged, records taps and health, exposes evidence ids when derivable; benchmark through it with the frozen harness (expect identical scores, added latency measured). Owner Gate: IMPLEMENTATION GO + runtime GO (new local service, not autostart).
4. **Phase 3.4 — Gatekeeper v0 (deterministic post-gate, label-only):** citation-vs-evidence, specificity screen, claim vocabulary, volatile block; measure false blocking/allowing. Owner Gate: IMPLEMENTATION GO.
5. **Phase 3.5 — Co-Pilot v0 (deterministic checkers + one model pass) and Pilot v0 (structured loop over the same model);** compare against BASELINE-001 on all zero-regression classes; Owner-approved thresholds decide promotion. Owner Gate: IMPLEMENTATION GO + model policy GO.
6. **Later:** library indexing/retrieval redesign, watchdog, task memory (ADR-0009 activation), model selection — each with its own GO.

DISCOVERY COMPLETE. No Phase 3 implementation started. No implementation PR opened.
