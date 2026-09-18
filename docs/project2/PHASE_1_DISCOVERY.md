# PROJECT 2 — SINBAD MULTI-MODEL ARCHITECTURE — PHASE 1 DISCOVERY REPORT

Date 2026-09-15. Read-only discovery of sinbad-marine/atlas-marine-os at main 91d142a (876 commits) plus read-only host probes. No file in the repository was changed; no Academy state touched.

Classification key: EXISTS (code/doc present) · WORKING (observed running or executed locally today) · TESTED (has automated tests on main) · INTEGRATED (wired into a live surface or CI) · OWNER ACCEPTED (explicit Owner acceptance recorded) · NOT PRESENT. "VERIFIED" is used only where evidence was observed today.

## A. Current architecture map

Current SINBAD is four cooperating layers, not one system:

1. Browser surfaces (GitHub Pages, static): dashboard index.html/app.js (Captain Sinbad chat, passage planner), Academy classroom academy.html/academy-classroom-window.js, Owner Console exam-review.html, store. Every AI call goes through a browser-side Core gate: SinbadCore.aiEnvelope() (sinbad-core.js over supabase/functions/sinbad-answer/core-decision.js, gate version 1.1.1) classifies intent (emergency/navigation/passage/publication/training/crew/vessel/document/general), live-data need, operational risk, and rejects unsafe answers (answerIsSafe). EXISTS · TESTED (tests/sinbad-cloud-core-gate.test.js keeps browser and edge decisions identical on golden queries) · INTEGRATED.
2. Local bridge (bridge/sinbad-bridge.ps1 v0.5.0, PowerShell, loopback 127.0.0.1:31983, autostart scripts): endpoints /status, /argos/status, /library/status, /studio/status, /opencpn/status, /ai/chat, /ai/tts, /library/ingest, /library/reindex, routes/OpenCPN. Observed today: online, ARGOS command gate ACTIVE (MONITOR_ONLY, replay protection, freshness 300 s, 10 registered actions, Owner boundary configured, SERVER_VERIFIED_SINGLE_USE), local library 1,686 documents / 90,552 chunks (built 2026-08-21), world knowledge (kiwix) endpoint UNAVAILABLE, studio runtime INCOMPLETE. WORKING · TESTED (argos-bridge-* tests execute the real PowerShell admission gate on Windows) · INTEGRATED.
3. Local models via Ollama 127.0.0.1:11434: qwen3:14b (9.3 GB, Q4_K_M) and qwen3:4b (2.5 GB). Bridge routes both tiers to qwen3:14b today (4b template exhausts its budget); deterministic tier router (bridge/qwen-tier-router.ps1) scores complexity; deterministic "instant" answers for greetings/arithmetic/one stable safety definition; RAG from the owner library plus optional kiwix snapshot; server-side thinking kept private; final-answer retry path. WORKING (Ollama reachable, models listed) · tier router EXISTS, no unit test found for it · INTEGRATED.
4. Cloud (Supabase kcvyftrvteqmabvxfebu): edge functions sinbad-answer (OpenAI gpt-5.6-terra, private RAG, CORE_GATE_BLOCKED before provider use, DECISION_SUPPORT_ONLY), founder-owner-step-up, human-review, academy-training, argos-bridge-authorize, manage-members, exam-answer-key-review, developer-review-contribution, owner-finalize-contribution, owner-review-design-plan; 24 migrations; RLS + AAL2 + single-use step-ups. EXISTS · TESTED (handler tests with substituted transport) · INTEGRATED · Owner boundary for member ops WORKING (AAL2 evidence review 2026-09-15).

Dashboard answer order (app.js): deterministic Core → local bridge (LOCAL FIRST, 120 s budget, answer must pass Core gate) → cloud sinbad-answer (session + workspace required, Core gate re-checked) → private archive search → explicit web-search permission prompt. Academy classroom: capability/foundation/social deterministic answers → local bridge with verified Academy evidence → honest "no source" refusal; never cloud.

Governance and evidence layer:
- ARGOS (sinbad-ai-core/argos-*.js, tools/argos-*, config/argos-integrity-policy.json 105 protected files): inventory drift (verify-argos-integrity), repository observer, health contracts (APPLICATION/BRIDGE/LOCAL_MODEL/GITHUB/SUPABASE/TEST_SUITE/RELEASE_PIPELINE × HEALTHY/DEGRADED/UNAVAILABLE/UNKNOWN), supervisor + repair proposal (always quarantined, mayApply:false), agent envelope (capabilities READ/TEST/WRITE_PROPOSAL/REPAIR_PROPOSAL/RELEASE_PROPOSAL), hash-chained journal, encrypted archive, independent recovery workflow. EXISTS · WORKING (verifier run today on committed bytes: ARGOS_INTEGRITY_VERIFIED) · TESTED · INTEGRATED in CI (release-quality, pages-release, scheduled assurance 4×/day cron, recovery check).
- sinbad-ai-core (Core): contracts, intent-engine, safety-engine, orchestrator (decision-pipeline v2, grounded-orchestrator with seal → release gate → public projection), retrieval (offline library, evidence evaluator), grounding (citation builder, confidence evaluator, verified answer composer), verification (claim planner, claim support verifier, query coverage gate, release gate), library (deterministic chunker, provenance, trust policy, index integrity), memory (advisory-only, evidence boundary "memory is context only"), experts (registry/router: executionAllowed:false always, ENGINE_PORT_GATE_REQUIRED), engine-port contracts (ports A–O, READ_ONLY), truth-stop-task contracts (TruthClaim, SafeStopRecord, ExecutionStatus, TaskProfile, GoldenTemplate; ADR-0009), core-activation-gate (BLOCKED by default), world-brain (persona, taxonomy, freshness policy, knowledge packs, topic router, kiwix provider), studio engine (PLAN_ONLY, local-model-protocol: loopback-only requests, responses are LOCAL_MODEL_DRAFT_UNTRUSTED / DATA_ONLY), navigation engine (separate package with its own verify gate). EXISTS · TESTED (221 core test files) · mostly INERT by design (contracts, deny-only gates); INTEGRATED only for the browser Core gate and navigation adapter.
- Evidence/state: docs/academy/PROJECT_STATE.json (authoritative Academy state), Human Review system (packages/questions/audit, hash-bound manifests), founder_security_audit + founder_step_up_authorizations, human_review_audit, ARGOS journals/archives, release-manifest.json on Pages, merge evidence. EXISTS · WORKING · INTEGRATED.
- Multi-model coordination: tools/roundtable-review.js sends the uncommitted diff to Claude/Gemini/Grok as read-only remote reviewers (explicit ROUNDTABLE_REVIEWERS, secret scanning, no tools); two reports exist under .roundtable/ (2026-08-21). EXISTS · TESTED (tests/roundtable-review.test.js) · used at least once · not INTEGRATED in CI.
- Quality gates: 80 root unit test files + 221 core + 11 navigation; 9 Playwright specs (desktop + mobile, axe WCAG); golden screenshots; design contract; branch protection (verify, linear, up-to-date); allowlisted Pages artifact with attested manifest; SBOM; npm audit.

Host: Intel Core Ultra 9 285H (16 cores), 31.4 GB RAM (13.8 free at probe), Intel Arc 140T iGPU (16 GB shared per vendor label; Windows reports 2 GB adapter RAM; no NVIDIA). qwen3:14b runs CPU/iGPU; latency not benchmarked in repo.

## B. Existing components that can be reused

| Target role | Reusable today | Class |
|---|---|---|
| Sentinel: authority/permissions | founder-owner-step-up + consume_founder_step_up (AAL2, session/command/nonce-bound single-use grants); argos-bridge-authorize; workspace_members role checks; RLS | EXISTS · TESTED · INTEGRATED · Owner boundary WORKING (AAL2 VERIFIED 2026-09-15) |
| Sentinel: stale/contradictory state | ARGOS inventory drift + repository observer + hash-chained journal; PROJECT_STATE state_semantics; library index integrity; world-brain freshness policy | EXISTS · TESTED · INTEGRATED (repo scope only; not applied to conversational claims) |
| Sentinel: unsupported safety/deployment claims | core-decision UNSAFE_ANSWER_CLAIM regex (executionPerformed/authorised/command sent); decision-pipeline STOP modes; CHANGELOG rule "Sinbad does not say an Academy action completed before it is verified" | EXISTS · TESTED · INTEGRATED (narrow patterns) |
| Sentinel: fail closed on missing evidence | decision-pipeline SOURCE_INSUFFICIENT; grounded-orchestrator seal/release/projection failure → PIPELINE_ERROR; truth-stop criticalClaimGate | EXISTS · TESTED · orchestrator NOT INTEGRATED into live answer path |
| Pilot: intent + plan | intent-engine, safety-engine, decision-pipeline (PLAN_ONLY_READY), expert-router (planning only) | EXISTS · TESTED · partially INTEGRATED (browser gate uses core-decision, not the pipeline) |
| Pilot: evidence retrieval | bridge Get-LocalLibraryContext (90k chunks), sinbad-answer private RAG, core retrieval/library modules, world-brain packs | WORKING (bridge, cloud) · core modules TESTED but NOT INTEGRATED |
| Pilot: local execution | bridge command gate + studio sandbox contracts (PLAN_ONLY, sandbox-writer single-use), ARGOS agent envelope | EXISTS · TESTED · studio runtime INCOMPLETE |
| Co-Pilot: independent checker | roundtable-review (remote second opinions); verification/claim-support-verifier + answer-citation-map-verifier; grounding/confidence-evaluator | EXISTS · TESTED · NOT INTEGRATED into any live loop |
| Authoritative state | PROJECT_STATE.json, Human Review DB, founder audit tables, ARGOS journals, release-manifest, git/gh | WORKING · INTEGRATED |
| Context isolation | Supabase workspace/RLS; separate windows per workspace; bridge library folders; sensitive-data + access-control contracts (ADR-0007/0012, deny-only) | partial: data isolation WORKING; conversational/project isolation NOT PRESENT |
| Benchmark harness pieces | node --test runner, Playwright, PGlite DB tests, argos health probes with hashes, golden safety queries in sinbad-cloud-core-gate test, ARGOS assurance ledger (immutable run records) | EXISTS · WORKING |
| Recovery | RELEASE_RECOVERY (exact-commit redeploy), ARGOS independent recovery workflow, encrypted archive restore (restored artifact 9883190777 on 2026-09-03), rollout-recovery lifecycle (server-only) | EXISTS · TESTED · partly WORKING (journal restore proven; DB recovery not) |

## C. Missing components (versus target)

1. Sentinel/Gatekeeper as one control layer over every AI turn: NOT PRESENT. Pieces exist for repo files and cloud member operations, but no component validates task/project identity or workflow context for a conversation, and nothing blocks a model from asserting PASS/MERGED/ONLINE.
2. Pilot as a defined role with a required loop: NOT PRESENT. The bridge answer path is retrieve → prompt → generate; no explicit IDENTIFY CONTEXT / LOCATE AUTHORITY / CHECK CONFLICT / VERIFY RESULT / CITE stages, no machine-readable uncertainty state on outputs (states like VERIFIED / NOT VERIFIED / CONFLICT / SOURCE MISSING / BLOCKED exist only in Core contracts and in Owner conversation discipline).
3. Co-Pilot monitor: NOT PRESENT. No runtime component watches an answer stream for context mismatch, fabricated citations, stale state or premature claims. Roundtable is offline, diff-only, remote, manual.
4. Authoritative-state resolver: NOT PRESENT as code. Source classes (OWNER DIRECTIVE, REPO, DATABASE, LIVE SYSTEM, DOCUMENT, TEST/CI, EXTERNAL, MEMORY, INFERENCE) are practiced in PROJECT_STATE and Human Review docs but not encoded; memory evidence-boundary covers only memory.
5. Context isolation for workflows (Academy / GASM / Owner Console / Yacht / AI Core / commercial): NOT PRESENT at the reasoning layer. The bridge has one library index and one persona; no per-workflow evidence scope, no leakage guard.
6. Benchmark/baseline harness: NOT PRESENT. No latency, resource, hallucination, stale-state or contradiction measurement exists; no fixed question sets with expected evidence; no local-model regression suite (tier router untested).
7. Specialist engines as callable local tools: mostly NOT PRESENT. Navigation engine is real and adapter-reachable (TESTED, executionAllowed false in router); stability, studio, world-brain are inert contracts or planning-only.
8. Heartbeat/recovery for the local runtime: NOT PRESENT beyond Ollama keep_alive 30 m and Windows autostart; no watchdog, no resumable task memory (task-memory contracts are inert), no interruption-recovery protocol for a multi-step Pilot task.
9. Multi-agent coordination runtime: NOT PRESENT (agent envelope contract exists, no executor).
10. Local specialist models beyond qwen3: NOT PRESENT (no coder, embedding, reranker or judge model installed; studio test references qwen2.5-coder:7b as an example only).

## D. Sentinel / Gatekeeper — proposed responsibilities

- Input: every Owner/user turn and every Pilot action request carries a TaskContext {workflowId, projectId, ownerDirectiveRef, authorityLevel, evidenceScope, stateSnapshotHash}.
- Validate task/project identity against a registry of workflows (Academy, GASM, Owner Console, Yacht, AI Core, commercial=DISABLED); reject or escalate on mismatch.
- Validate authority: reuse founder step-up for any side effect class (import, promote, merge, deploy, delete, credential, physical handoff); read-only needs none.
- Detect stale/contradictory state: compare stateSnapshotHash with authoritative sources (git head, PROJECT_STATE hash, DB read) before Pilot acts; ARGOS observer reused.
- Block unsupported claims: a claim vocabulary (VERIFIED, PASS, MERGED, DEPLOYED, ONLINE, SAFE, COMPLIANT, AAL2) may appear in an answer only when bound to an evidence reference; otherwise rewrite to NOT VERIFIED or block.
- Require provenance where the claim class is critical (regulatory, safety, deployment, security): reuse truth-stop criticalClaimGate semantics.
- Fail closed: insufficient evidence → BLOCKED with a SafeStopRecord (reasonCode, lastReliableStateRef, completedSetRef, requiredInputOrApprovalRef); escalate to Owner instead of guessing.
- Never alters Owner authority: Sentinel can only deny or escalate; it cannot grant, widen, or consume authority on its own.

## E. Pilot — proposed responsibilities

- Understand intent (reuse intent/safety engines), produce a plan (reuse decision-pipeline PLAN_ONLY), delegate to local specialist engines/tools (navigation engine, library retriever, DB read-only queries, gh/git read, Playwright), retrieve evidence with citations, execute only Sentinel-admitted actions, verify results with tests/reads, and emit answers with an explicit state field and uncertainty.
- Must never use model memory or a prior AI output as evidence: every factual claim links to a source class from section G; memory items carry authority 'advisory' (existing evidence-boundary).
- Loop (mandatory): IDENTIFY CONTEXT → LOCATE AUTHORITY → RETRIEVE EVIDENCE → CHECK CONFLICT → PLAN/ACT → VERIFY RESULT → CITE/PROVE → otherwise STOP/ESCALATE. Each stage writes an audit entry (reuse orchestrator/audit-log).
- Model use: qwen3:14b local for reasoning/drafting; deterministic core for stable answers; external models only via explicit escalation policy (section I/J) and never for authority.

## F. Co-Pilot — proposed responsibilities

- Independent process (separate prompt/model instance or a smaller judge model) that receives the Pilot's TaskContext, evidence set and draft output, never the Pilot's private reasoning.
- Checks: context mismatch (workflow/project ids vs. content), source conflict (two evidence items disagree), missing authority (side effect without grant), stale state (snapshot hash older than authoritative), unsupported specificity (numbers, ids, hashes, dates without evidence), fabricated citations (citation not in evidence set: reuse answer-citation-map-verifier), inconsistency with earlier answers in the same task, tool/retrieval failure masked as success, confidence without evidence, unsafe assumption, premature PASS/VERIFIED/MERGED/ONLINE claims.
- Actions: interrupt/alert Pilot, request evidence, surface conflicts, force one of VERIFIED / NOT VERIFIED / CONFLICT / SOURCE MISSING / BLOCKED on the output, escalate to Owner when the Pilot cannot satisfy the demand. Cannot approve, cannot override Owner, cannot execute.
- Output: a CoPilotVerdict record attached to the answer and journaled (ARGOS event kind).

## G. Authoritative-state model

Ordered source classes with binding rules (highest first inside its scope):
1. OWNER DIRECTIVE (explicit Owner message; supersedes all for scope/authority; must be quoted by reference).
2. LIVE SYSTEM (production DB read, live Pages bytes, bridge/ollama status; current truth of runtime).
3. DATABASE (Supabase rows, audit tables; authoritative for state of records).
4. REPO (git objects on origin/main; authoritative for code/config/state files; local worktree is not).
5. TEST / CI (run records with ids; authoritative for "passes tests", never for "works in production").
6. DOCUMENT (PROJECT_STATE.json, ADRs, runbooks; authoritative only for what they explicitly claim, with their own dates).
7. EXTERNAL AUTHORITATIVE SOURCE (IMO/ILO/flag texts with hash + fetch provenance).
8. MODEL MEMORY (advisory; never evidence).
9. MODEL INFERENCE (a claim; needs evidence to become VERIFIED).
Rules: a claim's state = VERIFIED only if bound to class 1–7 evidence with identifiers; conflicts between classes → CONFLICT, resolved by the higher class inside the same scope, or escalated; MERGED ≠ OWNER ACCEPTED ≠ HUMAN REVIEW VERIFIED ≠ AUTHORIZED remains encoded as distinct labels.

## H. Context-isolation model

- Workflow registry with hard ids: academy, gasm, owner-console, yacht-management, ai-core, commercial (disabled). Each has its own evidence scope (library folders/indexes, DB schemas, docs paths), authority map, and claim vocabulary.
- Retrieval is scoped by workflowId; cross-workflow evidence requires an explicit retrieval with provenance and is labelled as foreign.
- Conversation/task memory is per workflow and per task; Co-Pilot flags any claim whose evidence scope ≠ task workflow.
- Physical separation reuse: Supabase workspace RLS, bridge library folders (split per workflow), separate browser windows already exist.
- Enforcement point: Sentinel (pre-action) + Co-Pilot (post-draft).

## I. Baseline benchmark design (CURRENT SINBAD)

Reproducible, local, versioned under tests/benchmark/ (new), executed with node --test plus a runner that calls the live bridge; results stored as JSON with commit, model digests, host profile, timestamps.
Categories and minimum items:
1. maritime reasoning — 40 questions from the verified ISM/ISPS/MLC manifests and Bowditch/NGA visual library, each with expected source ids; scored on correctness + citation validity.
2. coding — 20 tasks (small JS functions with tests, PowerShell snippets) scored by executing tests in sandbox.
3. repository/state reasoning — 20 questions answered only from PROJECT_STATE/git/gh (e.g. "what is the merge commit of PR #248"); scored against live values.
4. context isolation — 20 cross-workflow traps (Academy question carrying GASM data); expected: refusal or explicit foreign-evidence label.
5. stale-state detection — 15 prompts asserting outdated facts (e.g. "main is 3713a2b"); expected: correction with evidence.
6. contradiction detection — 15 evidence pairs that conflict; expected: CONFLICT state.
7. provenance/citation accuracy — every cited title must exist in the evidence set; fabricated-citation rate.
8. hallucination resistance — 30 unanswerable questions; expected: "SOURCE MISSING" without invention.
9. tool/retrieval failure handling — bridge library disabled / kiwix unavailable / DB unreachable; expected: honest degraded state.
10. multi-agent coordination — 10 tasks requiring Pilot + specialist (navigation engine) with verified handoff.
11. recovery after interruption — kill the runtime mid-task; expected: resumable SafeStopRecord.
12. local execution reliability — 100 sequential /ai/chat calls; success rate, timeout rate, empty-answer/retry rate.
13. latency — p50/p95 per tier (instant/fast/deep) and per category.
14. resources — RAM/CPU/GPU sampled during runs (Get-Counter / ollama ps).
Current SINBAD scoring: run categories 1, 3, 5, 6, 7, 8, 9, 12, 13, 14 against the bridge as-is; categories 2, 4, 10, 11 will mostly score NOT SUPPORTED, which is itself the baseline. Acceptance: the future system must improve every scored category or hold it within an agreed tolerance, with zero regression in 5–9.

## J. Proposed implementation phases

- Phase 2 — Baseline benchmark harness + first measured baseline (no architecture change): tests/benchmark/*, runner, question sets from verified manifests, report format. Owner GO required.
- Phase 3 — Authoritative-state and claim vocabulary as code (sinbad-ai-core/authority/*): source classes, claim states, evidence references, conflict rule; unit tests; no live wiring.
- Phase 4 — Sentinel v1 (local, in bridge or a new Node service on loopback): TaskContext, workflow registry, claim gate, fail-closed SafeStop; wired first in MONITOR_ONLY mode (observe, journal, do not block), then blocking after Owner GO.
- Phase 5 — Pilot loop v1 on the bridge answer path: stages, audit entries, state field on every answer; Co-Pilot v1 as a second model pass (qwen3:14b judge prompt or smaller local judge) with CoPilotVerdict; measured against the Phase 2 baseline.
- Phase 6 — Context isolation: per-workflow library indexes/evidence scopes; retrieval scoping; isolation benchmark must pass.
- Phase 7 — Specialist engines/tools behind ARGOS agent envelopes: navigation engine, DB read-only tool, repo/gh read tool, test runner; multi-agent benchmark.
- Phase 8 — Recovery/heartbeat: task memory (activate ADR-0009/0010 contracts), watchdog, resumable tasks; recovery benchmark.
- Phase 9 — Promotion decision: full benchmark comparison, regression PASS, provenance integrity, recovery PASS, security/authority checks, Owner GO; only then does the new runtime take the bridge's role.
Each phase: draft PR, ARGOS records reconciled, CI green, Owner MERGE GO; Academy untouched.

## K. Risks / unresolved decisions

1. Hardware: qwen3:14b on CPU/Arc iGPU; a separate Co-Pilot pass doubles latency. Decision: same model second pass vs. smaller judge (qwen3:4b, currently unreliable template) vs. deterministic checkers only. Needs measurement (Phase 2).
2. External escalation policy: which task classes may call cloud models (OpenAI via sinbad-answer, Claude/Gemini/Grok via roundtable) and under what budget; no recurring cost increase without Owner authorization. Decision pending.
3. Bridge is PowerShell (69 KB single script); Sentinel/Pilot/Co-Pilot in PowerShell vs. a new Node loopback service beside it. Recommendation: Node service reusing sinbad-ai-core modules; bridge stays the ARGOS-gated front door.
4. Owner Console bridge identity: ARGOS_OWNER_BOUNDARY lists acceptance evidence still required for the Bridge executor path (live signed-token tests, concurrency, outage). Project 2 must not assume that boundary is complete.
5. Local library index is 2026-08-21; world knowledge (kiwix) UNAVAILABLE; freshness of evidence will affect benchmark scores; decide whether to re-index before baseline.
6. Golden question sets need human validation to avoid a benchmark that rewards the current model's habits; Owner or a real human reviewer should sign the expected answers.
7. Task memory / recovery: ADR-0009–0011 contracts are inert and activation-blocked by design; activating them for Pilot task memory requires an ADR and Owner decision.
8. Windows CRLF drift on OWNER_GOVERNANCE.md still makes local ARGOS runs need a git-archive export; unrelated but affects local benchmark automation.
9. Academy HOLD must be enforced by scope: no benchmark may write to production Academy tables; use the rehearsal project for any DB-writing scenario.

## L. Exact files likely to change in the next phase (Phase 2 benchmark harness)

New: tests/benchmark/README.md, tests/benchmark/benchmark-runner.js, tests/benchmark/questions/maritime-reasoning.json, .../repo-state.json, .../stale-state.json, .../contradiction.json, .../hallucination.json, .../isolation.json, tests/benchmark/results/ (gitignored or committed JSON baselines), tools/run-sinbad-benchmark.js, docs/project2/PHASE_1_DISCOVERY.md (this report), docs/project2/BENCHMARK_BASELINE.md, docs/project2/PROJECT2_STATE.json.
Possibly changed (each is ARGOS-protected or contract-bound and would need record reconciliation): package.json (new script), config/argos-integrity-policy.json (records), .github/workflows/argos-assurance.yml (optional benchmark step), bridge/sinbad-bridge.ps1 only if a read-only /ai/status or timing field is needed (prefer not in Phase 2).
Not changed in Phase 2: academy*, exam-review*, supabase/*, sinbad-core.js, core-decision.js, docs/academy/*.

DISCOVERY COMPLETE. No implementation started. Phase 2 requires a separate Owner GO.
