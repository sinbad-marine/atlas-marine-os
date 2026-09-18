# Project 2 — Phase 4.3 shadow mode: design proposal (docs only; no implementation authority)

Owner GO of 2026-09-18: "Phase 4.3 tasarım önerisini hazırla, GO". This document is that proposal. It changes no code, deploys nothing, calls no production endpoint and takes none of the decisions it lists. Building anything described here needs a separate, explicit Owner GO — Phase 4.3 is the first step that comes near a live production path.

Repository state inspected: main `8546cf48501aa9dec3f85d9168badfb1c979f1f3`. **VERIFIED** = read from the repository in this pass, file named. **NOT VERIFIED** = not inspected or not inspectable from here.

## 1. Why the plan of the readiness report has to be sharpened

The readiness report (PHASE_4_READINESS_REPORT.md, D2/D3) recommended shadow mode on the cloud function `sinbad-answer`. Two things learned since then change how that should be done.

**1a. Measured: on a surface without passages the gate is unusable.** In-memory simulation of 2026-09-18, nothing written: the 152 frozen BASELINE-001 / 001R bridge answers → Draft Adapter v0 with `passages: []` (the bridge hands out none) → Offline Chain v0 (`labelledDelivery = PROCEED`, one pass) → scoring v1.0.2 with the accepted REV-1 text outcomes.

| | DELIVERED_CLEAN | DELIVERED_LABELLED | WITHHELD |
|---|---|---|---|
| 28 wrong answers (FAIL) | 2 | 15 | 11 |
| 90 right answers (PASS) | 12 | 51 | **27** |

`harmCaughtRate 0.393`, `harmFlaggedRate 0.536`, **`falseBlockRate 0.30`**, `overLabelRate 0.567`; on the 30-item stage-gate subset 5/10 caught and **8/13 false blocks**. 0 of 152 answers carries an `[S#]` marker. Blocking causes behind the withheld answers: FALSE_CERTAINTY 36, GATE.VOCABULARY_BOUND 22, GATE.VOLATILE_CLAIMS_LIVE 19, UNSUPPORTED_FACTUAL_ASSERTION 13, GATE.SPECIFICITY_SUPPORTED 12. Honest "I cannot know that" answers are hit hardest (repo-state 7/12 withheld) because they use words such as *verified*, *currently* and dates while nothing can be VERIFIED. Caveats: 9 rows have no stored answer text and count as ungated (the 2 "delivered" FAILs are among them); code blocks are skipped, so coding answers were not examined; a fixture measurement, not a live one. Reproducible from the frozen files with the merged components; no script was committed.

Consequences: the local bridge must not be a shadow target until it hands out passages, and **no stage may enforce anywhere before false blocks have been measured on a surface with passages.**

**1b. VERIFIED: `sinbad-answer` already returns what the adapter needs.** `supabase/functions/sinbad-answer/index.ts`:
- lines 235–242 build `sources = [{id: "S<n>", title, chunk, documentId, mimeType, page}]` from up to 8 ranked library rows; lines 252–254 put the same `[S<n>]` markers in front of the passages given to the model; line 327 returns `{answer, spokenSummary, sources, visuals, sourceAccess, mode, …}`.
- line 136: `sources` is returned only when `membership.role` is `owner` or `developer` (`sourceAccess = privileged`); everyone else gets `sources: []` and marker-free prose.
- the function performs **no database write** (`insert / update / upsert / rpc / delete`: 0 occurrences).
- request: `{workspaceId, question, language, allowWebSearch, includeSourceVisuals, suppressSourceVisuals, coreEnvelope}` with a Supabase user JWT; `coreEnvelope` is validated by `core-decision.js` (`validateCoreEnvelope`), and the web app builds it with `SinbadCore.aiEnvelope(question, history)` (`app.js:2130`).
- runtime: Deno (`npm:@supabase/supabase-js@2`), model `OPENAI_MODEL || 'gpt-5.6-terra'`. The Project 2 components are CommonJS Node modules.

So for a privileged caller the response is already a free-text answer **plus identified passages under the markers it used** — the adapter's exact input — without touching the function.

## 2. Non-negotiables for any shadow stage

1. **Zero user-visible effect.** No answer, label, latency or error path of any user changes.
2. **No enforcement, no labelling.** The chain's outcome is recorded and read later; it reaches nobody.
3. **Fail-open isolation.** If any shadow part fails, the product behaves exactly as today.
4. **No accepted component is modified.** Rule-precision findings are reported, not patched (that is a separate GO).
5. **Private-library identity stays private.** Titles, document ids and answers derived from the private library do not enter the repository.
6. **Every step reversible** by deleting local files or switching a flag off.

## 3. Options

| | A. Client-side replay shadow | B. Server-side capture | C. Chain inside the function |
|---|---|---|---|
| Production function changed | **no** | yes (one guarded insert per request) | yes (runs the chain in the request path) |
| Deploy / migration | none | new table + RLS migration + function deploy | function deploy, port or bundle of CommonJS components to Deno |
| Data | answers to prompts the Owner sends | real user questions and answers | real user traffic |
| User impact risk | none (the Owner's own requests) | low but non-zero (extra write in the request path; must be fail-open and flagged off by default) | highest (latency and failure inside the answer path) |
| Privacy | captures stay on the Owner's machine | user questions stored in production: retention, RLS, consent | same as B |
| Cost | N OpenAI-backed calls made by the Owner | none extra | none extra |
| Answers D6? | yes, for the gold-scored prompt set | better (real distribution), but no gold truth: text outcome unknown → `falseBlockRate` not computable without human rating | same as B |

**Recommendation: A first, as Phase 4.3a.** It is the only option that satisfies non-negotiable 1 by construction, it needs no deploy, and it is the only one whose answers can be scored against gold, which is what D6 needs. B becomes interesting only after A has shown that the rates are worth measuring on real traffic; C belongs to the enforce stage and should not be considered before D6 thresholds exist and are met.

## 4. Phase 4.3a — client-side replay shadow (proposed; NOT STARTED)

**Flow.** prompt set → *capture client* (a new offline Node tool; signs in as the Owner, builds the `coreEnvelope` exactly as the web app does, posts to `sinbad-answer`, stores request, response and time locally) → per capture: Draft Adapter v0 → Offline Chain v0 → transcript → scoring v1.0.1 detectors on the captured answer (text outcome) → scoring v1.0.2 with and without the gate record → report.

**Mapping a response to the adapter input** (all deterministic):
- `passages[n].marker = sources[n].id`; `evidenceId = "doc." + documentId + ".c" + chunk` (fits the accepted id grammar); `sourceClass = DOCUMENT`; `locatorRef = "library:" + documentId + ":chunk-" + chunk`; `observedAt = retrievedAt =` capture time; `scopeRef = "workspace:" + workspaceId`.
- `contentHash`: the response does not carry passage content, so only an **identity hash** (SHA-256 of `documentId:chunk`) is available. Consequence, stated as a limit: `GATE.EVIDENCE_CONSISTENT` (same locator, two contents) is blind in 4.3a. A true content hash needs either a read-only Owner query of the chunk or a function change (that would be option B territory).
- `TaskContext`: one task per capture; `evidenceScopeRef = "workspace:" + workspaceId`; `authorityRefs = []`; expiry inside the 24 h contract limit. `proposedActions = []` (an answer proposes none).

**Prompt set.** Stage-gate subset v1 (30 items). Whether to add a 6-item maritime-reasoning slice (+≈0.5 h on the local baseline host; irrelevant for the cloud path's speed) is the Owner's pending decision; the proposal works with either.

**The comparison is inside one capture, not against BASELINE-001.** BASELINE-001 measured the local bridge with qwen3:14b; `sinbad-answer` is a different system (cloud retrieval, OpenAI model). The "before" column is the captured answers scored ungated; the "after" column is the same answers with their gate records. REV-2 stays the reference for the local surface only.

**Where things live.** Captures (requests, responses, transcripts) on the Owner's machine outside the repository — they contain private-library titles and derived text. Only an aggregate report (cells, rates, blocking causes by rule id, counts of markers, no titles, no answer text) is proposed for the repository, after the Owner has read it.

**What the capture client must not do.** No retries that multiply cost, no `allowWebSearch`, no parallel burst, no request as a non-Owner user, no write to any Supabase table, no change to the frozen harness (`tools/run-sinbad-benchmark.js` speaks the bridge's `/ai/chat` contract and stays untouched — the capture client is a separate tool; this is how the harness gap named in the evaluation is closed).

**Exit criteria of 4.3a (data sufficiency, not pass/fail).** All prompts captured once; every capture adapted or its BLOCKED reason recorded; the five v1.0.2 rates reported overall and per class with their denominators; blocking causes ranked by rule id; share of claims with markers; list of `GATE_RECORD_INVALID` (expected 0). Only with this report can D6 numbers be argued from data.

**What 4.3a cannot show.** The distribution of real user questions; the restricted (non-privileged) mode, where there are no markers at all and nothing can ever be VERIFIED; in-path latency; whether a cited passage supports the claim (the architecture's ceiling: identity and pattern, never content).

## 5. NOT VERIFIED — to be checked before a 4.3a implementation GO means anything

- Whether the production library behind `sinbad-answer` contains the ISM / ISPS / MLC sources the gold sets were built from. If it does not, the text outcomes of those prompts say little. (Needs a read-only Owner query; not run here.)
- Whether `SinbadCore.aiEnvelope` / `core-decision.js` run unchanged under Node, so that the capture client can build a valid envelope. (`core-decision.js` attaches itself to `globalThis`; not executed here.)
- Whether the deployed function equals the repository copy.
- Rate limits and the token cost of ~30–36 calls with up to 8 × 2 200 characters of context each.
- How often the production model actually writes `[S<n>]` markers when `sources` is non-empty. If rarely, 4.3a will mostly reproduce the passage-less picture of 1a — which would itself be the finding.

## 6. Decisions that are the Owner's

1. **Go / no-go for building 4.3a** (capture client + offline evaluation tool, both new files, no production change).
2. **Cloud usage.** PROJECT2_STATE.json `policies.cloud` records "no new recurring cloud-model usage" for Phase 2. 4.3a is a one-off of ~30–36 OpenAI-backed calls from the Owner's account. Allowed, and with what ceiling?
3. **Who runs the capture.** It needs the Owner's Supabase session (AAL2). Recommended: the Owner runs it; the tool never stores the token.
4. **maritime-reasoning in the prompt set**, as a measured, non-gating class (recommended) or not at all.
5. **What may enter the repository** from the results: aggregate report only (recommended), or also redacted per-item rows.
6. **D6 thresholds.** Recommended: none now; decide after the 4.3a report. Draft numbers on the table for later discussion only: label stage `maxOverLabelRate ≤ 0.25` on answers that carry markers; enforce stage, full set, `maxFalseBlockRate ≤ 0.05`, `minHarmCaughtRate ≥ 0.50`, `maxHarmDeliveredRate ≤ 0.25`. With 0.30 measured on the passage-less surface, enforce is far away.
7. **Rule precision.** If 4.3a confirms that GATE.VOCABULARY_BOUND and GATE.VOLATILE_CLAIMS_LIVE fire on honest answers, changing them means changing OWNER ACCEPTED components: a separate phase with its own GO and its own acceptance.

## 7. Risks

- **False comfort from a gold-scored prompt set.** 30 prompts are not the product's traffic.
- **The model may not cite.** Then the gate has nothing to verify on this surface either (5, last item).
- **Identity-only hashes** hide content drift (4).
- **Privacy slip**: a capture committed by mistake would leak private-library titles. Mitigation: captures live outside the repository tree and the evaluation tool refuses an output path inside it.
- **Scope creep toward option B/C** before A has reported.

## 8. What this document does not do

It authorizes nothing: no capture client, no call to production, no deploy, no migration, no threshold, no change to any accepted component, the bridge, Academy, Supabase, ARGOS policy or the frozen baselines. The Offline Autonomous Developer core gap stays on HOLD and is not part of Project 2. Academy HOLD and Hat D HOLD are unchanged.
