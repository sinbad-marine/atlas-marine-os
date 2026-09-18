# Project 2 — Phase 4 readiness report (read-only; no implementation authority)

Owner GO of 2026-09-18: the PR #269 merge report asked, as numbered request 3, for a GO for a **read-only** Phase 4 readiness report instead of new code; Owner statement "YUKARIDAKİ 1. 2. VE 3. MADDELERİ ONAYLIYORUM. GO". This document is that report. It changes no code, wires nothing, decides nothing. Every item under "Decisions" is the Owner's; the recommendations are recommendations.

Repository state inspected: main `79b715782a5b77cf9244de3a07246ee3fb168fd0`. Labels used: **VERIFIED** = read from the repository in this pass, with the file named; **NOT VERIFIED** = not inspected or not inspectable from here.

## A. Where Project 2 stands

Six inert components are on main, each MERGED / TESTED / NOT INTEGRATED with `wiredInto = []`: Sentinel v0, Gatekeeper v0, Co-Pilot v0, Pilot v0, Offline Chain v0 (all OWNER ACCEPTED) and Record Attestation v0 (acceptance recorded by PR #271, not merged at the time of writing). 231 unit tests cover them. They have been proven consistent **with each other on supplied, structured data**. Nothing has shown what they do on a real SINBAD answer, because no real answer has ever been put into them. Section B explains why that is not a formality.

## B. Verified facts that shape Phase 4

**B1. Live answers are free text; nothing produces claims or evidence identifiers. — VERIFIED**
- `bridge/sinbad-bridge.ps1` `/ai/chat` returns `{answer, model, modelTier, routing, mode, knowledge:{state, results, reason}}` (lines 762, 823). `knowledge` is a count and a state; no document, chunk or source identifier leaves the bridge.
- `supabase/functions/sinbad-answer/index.ts` builds an answer with inline `[S#]` markers from up to 8 ranked library rows (lines 233–234, 287, 298); the markers live inside the prose.
- `tests/benchmark/results/BASELINE-001/results.json`: 152 items, each with `answer` and `response:{model, modelTier, mode, knowledge, routing}`. No item carries an evidence set; the only `citations` fields are in the scorer's `detail` of the 8 provenance-citation items.
- The components' input is the opposite shape: claim units with content hashes and evidence ids, an identified `EvidenceSet`, a draft hash, proposed actions.
- Consequence: **the missing piece is not wiring, it is an adapter** — something that turns (question, retrieved passages, answer text) into (`TaskContext`, `EvidenceSet`, claims, citations). Sentinel v0 and Gatekeeper v0 both state that they do not segment text. Whoever segments decides what gets checked; a poor segmenter makes every downstream PASS meaningless.

**B2. The candidate wiring points are ARGOS-protected. — VERIFIED** (`config/argos-integrity-policy.json`, 105 protected files)
- Protected: `app.js`, `bridge/sinbad-bridge.ps1`, `package.json`, `.github/workflows/*`.
- Not protected: `sinbad-core.js`, `supabase/functions/sinbad-answer/index.ts`, `tools/run-sinbad-benchmark.js`, `sinbad-ai-core/index.js`, `sinbad-ai-core/package.json`.
- Consequence: wiring the bridge or the web app needs an Owner-authorized ARGOS policy commit per changed file (precedents named in earlier project notes: PR #211, #212, #248 — NOT re-verified in this pass). The cloud function is unprotected by ARGOS but is production.

**B3. The bridge that runs is an installed release, not the repository file. — PARTLY VERIFIED**
- VERIFIED: an installed tree exists under `%LOCALAPPDATA%\Sinbad\` (`argos`, `connection-guardian-v1`, …); PROJECT2_STATE.json records BASELINE-001R as run against installed release `13cd522d…`.
- NOT VERIFIED: whether the currently installed bridge equals the repository copy today. Observed earlier on 2026-09-18 and left untouched: a process listening on 31983 that this work did not start.
- Standing Owner instruction: do not restart the legacy bridge.
- Consequence: a change to `sinbad-bridge.ps1` reaches users only through package → install → restart, each an Owner gate.

**B4. The bridge is PowerShell; the components are Node. — VERIFIED**
- `sinbad-bridge.ps1` is a single-threaded PowerShell HTTP listener (1065 lines); the components are CommonJS modules. Calling them from the bridge means spawning Node per request or running a second local service. Neither exists.

**B5. There is no signing-key infrastructure. — VERIFIED**
- The only key-protection primitive in the repository is Windows DPAPI, `DataProtectionScope::CurrentUser`, in `tools/argos-windows-archive.ps1` (lines 39–56), used for the ARGOS archive key. No Ed25519 / signing key generation, storage, rotation or trust store exists. Record Attestation v0 takes the seed as input and says so.

**B6. An older inert verification layer already exists and overlaps. — VERIFIED**
- `sinbad-ai-core/verification/{claim-planner, claim-support-verifier, answer-citation-map-verifier, query-coverage-gate}.js` and `sinbad-ai-core/orchestrator/{decision-pipeline, grounded-orchestrator}.js` exist and are imported by no live file. PHASE_3_DISCOVERY.md listed them as reuse candidates; Phases 3.3–3.8 did not reuse them.
- NOT VERIFIED: how far `claim-planner.js` already does the segmentation B1 needs. That is the first thing a Phase 4.1 discovery should read.

**B7. Measurement. — VERIFIED**
- `tools/run-sinbad-benchmark.js` measures any HTTP endpoint that speaks the `/ai/chat` contract. Scoring v1.0.1 reads the answer text only; labels, blocks and evidence fields are ignored.
- The frozen baseline answers cannot be replayed through the chain offline: they have no evidence sets (B1).
- A full run costs 11 h 20 min + 2 h 11 min on this host (CPU-only qwen3:14b; the 90,552-chunk PowerShell scan dominates).
- Consequence: today a gated path can only be measured by a fresh full run, and the scorer would not see what the gate did.

**B8. CI and local test reality. — VERIFIED**
- `.github/workflows/argos-assurance.yml` runs `npm test` on Linux. `tests/argos-bridge-http.test.js` is Windows-only, timing-sensitive, and failed in 2 of 4 full local runs on 2026-09-18 under parallel load while passing alone and being skipped on CI. It is pre-existing (PR #208) and was not touched. As the suite grows this will get worse locally.
- "ARGOS scheduled assurance" has failed at its health step on every scheduled run since at least 2026-09-11 (recorded in earlier Project 2 notes; NOT re-verified in this pass).

## C. What the six components can and cannot carry into Phase 4

| Can | Cannot (today) |
|---|---|
| Decide ADMIT / LABEL / ESCALATE / BLOCK for a structured draft, with rule-id or verdict-id attribution | Read a free-text answer |
| Recommend PROCEED / REQUEST_EVIDENCE / REVISE_DRAFT / ESCALATE_OWNER / STOP from sealed records | Produce, revise or request anything; there is no loop driver and no model |
| Prove a record's origin against a supplied trust store | Hold a key, own a trust store, or make any consumer require AUTHENTIC |
| Rehearse the whole loop offline on supplied drafts | Tell whether a claim is *true*: all of them observe through Sentinel v0, by identity and pattern, never by content |

The last row is the honest ceiling of this architecture as built: it can stop an answer from **claiming more than its evidence identifiers support**; it cannot check that the evidence says what the claim says. BASELINE-001's worst classes (hallucination 4/20, provenance 0/8, context isolation 1/12) are partly of the first kind and partly of the second. How much of each is NOT MEASURED.

## D. Decisions the Owner must make before any wiring

**D1. Build the adapter first, inert? (recommended: yes)** A Phase 4.1 "Draft Adapter v0": pure function from (question, passages with ids, answer text) to the chain's input; deterministic segmentation (sentences / `[S#]` markers), no model. Start with a read-only look at `verification/claim-planner.js` (B6). Without this, nothing else in Phase 4 has an input.

**D2. Which surface first?** Options: (a) the cloud function `sinbad-answer` — already has passages with identity and `[S#]` markers, TypeScript, unprotected by ARGOS, but production and OpenAI-backed; (b) the local bridge — PowerShell/Node gap (B4), protected file (B2), installed-release gate (B3), no identifiers leave retrieval (B1), standing do-not-restart instruction. Recommendation: **(a) first, in shadow mode only**; the bridge needs four prior decisions and is the worse first target.

**D3. Shadow before effect? (recommended: mandatory)** Stage 1 SHADOW: run the chain beside the live answer, store the transcript, change nothing the user sees. Stage 2 LABEL: attach labels only. Stage 3 ENFORCE: BLOCK / ESCALATE take effect. Each stage its own Owner GO and its own measured exit criteria (D6). A rehearsal that was never compared with reality should not be allowed to block reality.

**D4. Reuse or retire the older verification layer (B6)?** Two inert checking stacks is one too many. Decide after the D1 discovery whether `claim-planner` feeds the adapter, and whether the rest is retired.

**D5. Key custody and trust store (only when records cross a process or trust boundary).** Who generates signing keys, where seeds live (DPAPI CurrentUser as ARGOS does; Supabase secrets for the cloud path), rotation and revocation, who owns the trust store. Within one process (D3 stage 1 in a single function) attestation adds nothing and can wait. Recommendation: defer until a second process or store is involved; then a separate phase.

**D6. What counts as better — thresholds against BASELINE-001-REV-1.** The zero-regression classes are named in PROJECT2_STATE.json but no pass thresholds exist. Needed before Stage 2: per class, the minimum improvement and the maximum tolerated false-block rate on benign items. Also needed: a scorer revision that can see labels and blocks (v1.0.2, offline, like REV-1), otherwise a gate's effect is invisible (B7).

**D7. Measurement cost.** A full run is ~13.5 h on this host. Options: accept it per stage; define a fixed ~30-item subset of the zero-regression classes for stage gates and keep full runs for promotion; or fix the 90k-chunk scan first (an implementation change to the bridge, outside Project 2 so far).

**D8. The Co-Pilot model pass.** Still behind its own "model policy GO". Recommendation: not before D3 Stage 1 has produced real transcripts; they will show which warning classes the deterministic layer actually misses, which is the only good reason to add a model.

**D9. Housekeeping that will bite during Phase 4:** the Windows-only flaky test (B8) — serialise it or relax its timeouts, as its own small GO; the failing scheduled ARGOS assurance — decide whether it is expected or to be fixed; the unexplained listener on 31983.

## E. Recommended order (each line a separate Owner GO; none is given by this report)

1. **4.1 Draft Adapter v0** — inert, deterministic, tested on stored `sinbad-answer`-shaped samples. Preceded by a short read-only look at `verification/` (D4).
2. **4.2 Scorer v1.0.2 + stage-gate subset** — offline; makes labels and blocks visible to measurement (D6, D7).
3. **4.3 Shadow on one surface** (recommended: `sinbad-answer`) — transcripts stored, user-visible behaviour unchanged. First contact with real answers.
4. **4.4 Read the shadow transcripts** — report false-block and miss rates; only then set D6 thresholds with data.
5. **4.5 Label stage**, then **4.6 Enforce stage**, each gated on D6.
6. Key custody / attestation in anger (D5) and the Co-Pilot model pass (D8) enter when 4.3–4.4 show they are needed.

## F. Risks stated plainly

- **False confidence.** Six components and 231 green tests look like a safety system. On real answers their effect is NOT MEASURED, and their ceiling (section C) is identity and pattern, not truth.
- **Segmentation is the new single point of failure** (B1, D1).
- **Shared blind spot.** Every component observes through Sentinel v0.
- **False blocks on benign answers** are as damaging to a training product as misses; BASELINE-001 has no benign-block measurement at all.
- **Latency.** Negligible for the deterministic chain; large if D8 adds a model pass on CPU.
- **Two stacks** (D4) will drift.

## G. What this report does not do

It authorizes nothing. No wiring, no adapter, no scorer change, no key, no model, no change to any accepted component, the bridge, Academy, Supabase, ARGOS policy or the frozen baselines. Academy HOLD and Hat D HOLD are unchanged.
