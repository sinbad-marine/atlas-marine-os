# Project 2 — Phase 4.1: Draft Adapter v0 (inert, deterministic free text → structured draft)

Owner GO of 2026-09-18, starting state main `c22ce39`. After the Phase 4 readiness report the Owner was asked for (1) a MERGE GO for PR #271 and #272 and (2) decisions D1–D9 of the report. Owner statement: "1. gO ARDINDAN 2. GO". Item 2 names no single decision, and the report itself says every line of its recommended order is a separate Owner GO. It was therefore taken in the **narrowest** reading: the report's recommendations adopted in principle, and a GO for the **first step only** — **"PROJECT 2 / PHASE 4.1 — DRAFT ADAPTER v0 ONLY"**, preceded by the read-only look at the older verification layer (D4). NOT STARTED and not covered: scorer revision (4.2), any shadow mode or wiring (4.3+), key custody, the model pass, retiring or changing the older layer.

Scope delivered: Draft Adapter v0 under `sinbad-ai-core/adapter/`. No file under `sinbad-ai-core/authority/`, `sentinel/`, `gatekeeper/`, `copilot/`, `pilot/`, `chain/`, `attest/`, `verification/` or `orchestrator/` was modified; no model, routing, runtime, bridge, Academy, GASM, Owner Console, Supabase, ARGOS policy, protected-file or frozen-baseline change. `MANIFEST.status = INERT_COMPONENT`, `role = FREE_TEXT_TO_STRUCTURED_DRAFT`, `authority = NONE`, `performsIo = interprets = rewrites = executes = approves = keepsState = callsModel = grantsAuthority = false`, `wiredInto = []`.

## D4 finding: the older layer goes the other way (read-only, VERIFIED)

`sinbad-ai-core/verification/claim-planner.js` (`sinbad-evidence-bound-claim-planner/2F-v1`) builds claims **out of evidence**: it walks the lines of the selected evidence, keeps lines that share words with the query, binds each to its exact span, and returns at most 8 of them for a deterministic answer composer (`grounding/citation-builder.js`, `grounded-answer-pipeline.js`, `orchestrator/grounded-orchestrator.js` import it; no live file does). That is *compose an answer from evidence without a model*. Phase 4 needs the opposite: *take the answer a model wrote and find out what it claims*. The planner does not segment free text and cannot be reused for that. Whether the older stack is kept as a second architecture or retired stays the Owner's decision (D4); nothing in it was touched.

## What Draft Adapter v0 is

`adapter.adapt(input) → AdaptedDraft`. One call, one answer, no memory between calls, no clock (the caller supplies `at` and `retrievedAt`), no I/O, no model call, never throws.

Input (`sinbad-draft-adapter-input/0-v1`, exact own-property snapshot): `adaptationId`, `at`, a Phase 3.1 `TaskContext`, `answer {text, originRef}`, `passages[]` (each `{marker: "S<n>", evidenceId, sourceClass, locatorRef, contentHash, observedAt, scopeRef}` — the passage the answer was given under that marker, in the accepted `EvidenceSet` item shape), `retrievedAt`, and `proposedActions[]` (passed through unchanged for the gate to judge; the adapter neither adds nor authorizes one).

Output (`sinbad-adapted-draft/0-v1`, frozen, sealed with `adaptationDigest`):

- `chainPass = {evidenceSet, draft}` — exactly one pass of the Offline Chain input. Before handing it over, the adapter checks it with the consumers' own parsers (`evidenceSet.snapshot`, `gatekeeper.draft`) and is BLOCKED if they would refuse its shape.
- `segments[]` (claim id, offsets into the answer, markers, unknown markers), `skipped[]` (offsets and reason), `stats` (characters that became claims / were skipped, claims with and without markers, markers used, unknown markers, passages unused) and `warnings[]`.
- Unlike the other records this one **carries the answer's sentences** (the components need the claim text); it is not a record to publish.

## Segmentation rules (`sinbad-draft-segmenter/0-v1`)

1. Every claim is an **exact slice** of the answer, hashed as written, offsets in UTF-16 code units. Nothing is reworded, merged, reordered or dropped silently.
2. Lines are split into sentences at `. ! ? …` followed by white space or the end. A full stop does not end a sentence inside a decimal, after a single initial, or after a short list of abbreviations (`e.g i.e vs no reg art fig ch para mr mrs dr approx örn bkz md sy`). `etc` is deliberately **not** on the list: a wrong split only yields one more unsupported claim, a wrong merge lends one sentence's citation to another.
3. A claim is bound to the `[S<n>]` markers written inside it. **Markers written right after the end of a sentence cite that sentence, never the next one.** (A probe during development showed the first version attaching `"… shore. [S1] Masters hold…"` to the second sentence — the unsafe direction; this is now a regression test.) A marker alone on its own line cites nothing.
4. Skipped and recorded, never silently: code blocks, markdown headings, a line-final lead-in ending in `:`, questions, and pieces without words. Markers inside skipped text still count as citations of the draft. A skipped question that contains specific values raises a warning.
5. **Every claim is ASSERTED.** The adapter never decides that a sentence is merely reported speech, because that would relax the checks on it and "According to …" is a prefix anyone can write.
6. **A marker no passage carries is preserved** as a citation to the evidence id `unknown-marker-S<n>`, which does not exist in the set — so the gate sees a fabricated citation instead of the adapter hiding it.

Fail-closed BLOCKED (no `chainPass`): input not exact, invalid context, answer missing / not a string / over 200 000 characters, invalid or duplicate passages, retrieval later than `at`, more than 256 claims, a sentence over 8 192 characters, or an adapted draft the consumers would refuse (for example a WRITE declared unprotected).

## First contact on paper: free text → adapter → Offline Chain

`draft-adapter-v0-chain.test.js`, on sample answers **written for the tests** in the shape the cloud answer function produces (not recorded production answers): fully cited → ADMIT / PROCEED VERIFIED; cited plus general-knowledge sentences → LABEL / PROCEED with `SOURCE_MISSING` on exactly the uncited sentence; fabricated marker → BLOCK (`GATE.CITATIONS_IN_EVIDENCE`, `GATE.CLAIM_EVIDENCE_RESOLVABLE`) / REVISE_DRAFT; confident invention without markers → BLOCK, and the same specifics with a real marker → PROCEED; authority voice, fully cited → REVISE_DRAFT (`ROLE_CONFUSION`); stale passage → LABEL; present-state claim cited to a document → REQUEST_EVIDENCE; unsafe action → ESCALATE_OWNER. Fixtures: `tests/fixtures/draft-adapter-v0/cases.json`, 14 cases (7 benign, 7 adversarial), hand-declared status and chain outcome, pinned by adaptation digest: false proceeding 0/7, false stopping 0/7. A fixture measurement, not a measurement of any live system.

## Limits — read these before trusting a green result

- **Over-crediting inside a sentence.** A sentence with two facts and one marker gets that marker for both. v0 works at sentence granularity; nothing smaller is attempted.
- **A marker proves a citation exists, not that the passage says it.** "PR #254 was merged as c506f21 and is VERIFIED [S1]" is admitted if `S1` is a fresh in-scope passage — whatever that passage contains. This is the ceiling the readiness report named: identity and pattern, never content. It is now demonstrated on free text by a test.
- **The identity-restricted mode of `sinbad-answer` writes no markers at all**, so every such answer can at best be labelled `SOURCE_MISSING`; nothing in it can ever be VERIFIED. That is a property of that mode, not a defect of the answer.
- **The adapter needs the passages with their identity.** Today neither live surface hands them out in this shape (readiness report B1): the cloud function has them internally, the bridge does not expose them at all. Getting them is wiring and NOT STARTED.
- Segmentation is rule-based and knows English and Turkish abbreviations only; tables, nested lists and quotations spanning sentences are split naively. Skipped text is reported so the loss is visible (`stats`, `skipped`).
- An answer with no claims at all (only questions or headings) is admitted with the warning `NO_CLAIMS_FOUND`: nothing was asserted, so nothing was checked.
- It is not wired into `/ai/chat`, the bridge, the cloud function, the classroom, the dashboard, the Owner Console, the benchmark harness or the package `exports` (asserted by `sinbad-ai-core/tests/draft-adapter-v0-inert.test.js`). BASELINE-001 and BASELINE-001-REV-1 are untouched; the frozen baseline answers still cannot be replayed, because they have no passages.

## Tests

`sinbad-ai-core/tests/draft-adapter-v0-*.test.js` (24 tests; builders in `tests/helpers/draft-adapter-v0-builders.js`): segmentation rules including the marker-attribution regression, abbreviations in both languages, skipped structure, look-alike markers, exact slices and hashes; contract exactness, determinism, tamper detection, every BLOCKED reason, hostile inputs, action pass-through; the chain results above and the fixtures; inertness, the exact members of Sentinel and Gatekeeper it touches (`sentinel.MAX_CLAIMS`, `sentinel.SPECIFIC_VALUE`, `gatekeeper.draft`), no `REPORTED` anywhere in the source, no import by any component or live path, no state, input never mutated.

## Owner acceptance

NOT RECORDED. Merged as PR #273 on 2026-09-18 (main `003f855657769b31e237e740b75de09dcec6bd95`) under an Owner MERGE GO; MERGED is not an acceptance, and Draft Adapter v0 stays OWNER ACCEPTED = NOT RECORDED until the Owner states otherwise. This phase is not a GO for the scorer revision, shadow mode, wiring, key custody, the model pass, or any change to the older verification layer.
