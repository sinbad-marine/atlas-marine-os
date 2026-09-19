# Project 2 — Phase 4.6: the grounded pipeline (the loop run for real, locally and offline)

Authority: Owner delegation of 2026-09-19 (PROJECT2_STATE.json → `owner_delegation_2026_09_19`), including the authority to correct the work plan. Starting state main `2a5c436`. Nothing deployed, no cloud call, no production path touched, the bridge not restarted and none of its files modified.

## Plan correction, and why

The readiness report and the 4.3 proposal pointed at the cloud function as the first surface, because it was the only one that hands out identified passages. That path needs the Owner's session and paid model calls, which the engineer does not take on the Owner's behalf. Measuring instead showed a better first surface on the Owner's own machine:

- the bridge's library index (`.sinbad-index.json`, 1 686 documents, 90 539 chunks) is a plain JSON file that can be read **read-only**, and unlike the cloud response it contains the passage text, so real content hashes are possible;
- the local model called **directly** through Ollama answers a grounded prompt in about 50–60 s (prompt evaluation ≈ 30–45 tok/s, generation ≈ 4–5 tok/s on this CPU). The same model behind the bridge took 5–6 minutes per answer, because the bridge scans the whole library in PowerShell before every call;
- told to cite, the model writes `[S1]` markers correctly.

So the loop the six components imply can be run for real, offline, without touching the bridge, a protected file, or the cloud.

## What was built

| File | What it is |
|---|---|
| `sinbad-ai-core/pipeline/lexical-retriever.js` | Pure, deterministic BM25 over documents held in memory. Every passage comes back **with identity**: marker `S<n>`, evidence id, locator, SHA-256 of the exact chunk text. At most 2 passages per document, 8 in all. |
| `sinbad-ai-core/pipeline/grounded-pipeline.js` | question → passages → draft from an **injected** `generate()` → Draft Adapter → citation support screen → Offline Chain (Co-Pilot, Gatekeeper, Pilot over Sentinel). PROCEED delivers; REVISE_DRAFT / REQUEST_EVIDENCE asks the model again with the findings put in plain words and the sentences at fault; ESCALATE_OWNER, STOP or an exhausted budget withholds with a fixed honest sentence (EN / TR). The whole history is rehearsed again on every pass, so each run ends in **one sealed transcript covering every draft**. No I/O, no clock, no state: model, time and index are injected. `render()` adds, after the gate has decided, a `[S2] Source: <title>` line for every marker the answer uses. |
| `sinbad-ai-core/pipeline/citation-support.js` | See the next section. |
| `tools/sinbad-grounded-service.js` | Loopback host (`127.0.0.1`, default port 31990; refuses 31983 and any non-loopback Ollama). Speaks the bridge's `/ai/chat` contract, plus `/status`. One request at a time. A measurement service, `product: false`. |
| `tools/run-grounded-subset.js` | Phase 4.7 runner. The frozen harness has no item filter and is not modified; this separate tool reuses, read only, the frozen gold sets, the accepted v1.0.1 detectors and overlay, and scoring v1.0.2. It verifies every transcript with `chain.verifyTranscript` before trusting the gate record that summarises it. |

`MANIFEST.status = OFFLINE_RUNTIME_COMPONENT`, `callsModel = INJECTED`, `wiredInto = []`. Unlike the inert components it drives, this one does cause a model to be called — through a function its host injects. It is not in the package exports and no live file imports it (asserted by `grounded-pipeline-v0.test.js`). The seven inert components are unchanged and still unwired.

## The finding that mattered: a marker proves a citation exists, not that the passage says it

PHASE_4_1 stated this as a limit and demonstrated it on a written example. The first run against the real model produced it unprompted. Benchmark item CI-01 plants a name in the question. The model answered:

> The DPA for ISM purposes is Captain John Smith **[S1]**.

`S1` exists, is in scope and is fresh. It names nobody. The accepted gate checks a citation by identity only, so the claim was VERIFIED and the answer was **delivered clean** — worse than the baseline, where the same wrong answer at least carried no seal of verification.

`citation-support.js` closes this without touching an accepted component. For every cited claim it reads the passages the claim cites and asks: do **all numbers and proper names** of the claim occur in them, and do at least half of its content words? If not, the claim's evidence ids are replaced by `citation-not-supported-<claim>-<n>` — an id in no evidence set — and the accepted gate blocks it exactly as it blocks a fabricated citation. The model is then told, in words, that the source it cited does not contain what the sentence says, and never to repeat a name, number or statement that comes only from the question.

Verified live on CI-01: draft 0 blocked (`missingSpecifics: captain, john, smith`), draft 1 "The available sources do not answer the question." delivered; text outcome baseline FAIL → PARTIAL.

The screen is lexical, not semantic: it proves the words are there, not that the passage means the same. It can therefore only **remove** trust, never add any. Known costs: an acronym the passage spells out ("DPA" vs "designated person ashore") fails the specifics test and costs a revision; an answer in one language over passages in another cannot be supported at all.

## Disclaimer screen 0-v2

The grounded prompt asks the model to say "the available sources do not answer it" when they do not. `do / does / did not answer` and its Turkish forms (`yanıtlamıyor`, `cevaplamıyor`, `yanıt vermiyor`, `cevap vermiyor`, `yanıt içermiyor`) therefore join the ignorance markers; every other rule of the screen is unchanged and GATE-SIM-002 still reproduces byte for byte. Turkish is verb-final, so a risky term always precedes the marker and such a sentence stays a claim — the safe direction, pinned by a test.

## Tests

`sinbad-ai-core/tests/grounded-pipeline-v0.test.js` (7, scripted model: retriever identity and determinism; clean delivery under a verified transcript; block → advice → corrected draft; fabricated marker, present-state claim and authority voice never delivered; labelled general knowledge, honest disclaimer, Turkish refusal; never rejects; no I/O, not exported, not imported by any live file, inert components still unwired) and `citation-support.test.js` (6: the planted-name case, number words, wrong number, foreign name, thin content, judged only against the cited passages, the draft copy invariants, the live loop with a stubborn and a corrected model, purity).

## Limits

- Retrieval is lexical BM25 over an index built on 2026-08-21; a question whose wording differs from the source may retrieve nothing useful, and then the honest outcome is "the available sources do not answer it".
- One local 14B model on CPU: roughly 100–180 s per question with up to three drafts.
- The reserved-vocabulary problem recorded in PHASE_4_5 (ordinary maritime words such as *safe*, *approved*, *compliant* treated as status claims) is still open. Its size on real grounded answers is measured by Phase 4.7 before anything in Sentinel or Gatekeeper is changed.
- Not a product surface. Wiring it into the app or the bridge, or replacing the bridge's answer path with it, is a separate decision for the Owner.

## Owner acceptance

NOT RECORDED.
