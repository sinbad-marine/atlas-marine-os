# Project 2 — Phase 3.7: Offline Chain v0 (inert, deterministic paper-only composition)

Owner GO of 2026-09-18, starting state main `229e6c6`. The Owner's statement "2. FAZ OWNER GO" named no scope; asked which phase, the Owner delegated the choice ("UZMAN OLAN SENSİN EN MANTIKLI OLANI SEÇ. BUNU ONAYIMLA YAP. GO"). The scope chosen under that delegation is **"PROJECT 2 / PHASE 3.7 — OFFLINE CHAIN v0 ONLY"**, the lowest-risk of the four candidates put to the Owner (offline chain, record authenticity, Co-Pilot model pass, live wiring): the four accepted components had each been tested alone and never together. Not chosen and NOT STARTED: record authenticity, the model pass, a model-driven Pilot loop, any wiring or live integration.

Scope delivered: Offline Chain v0 under `sinbad-ai-core/chain/`. No file under `sinbad-ai-core/authority/`, `sentinel/`, `gatekeeper/`, `copilot/` or `pilot/` was modified; no model, routing, runtime, bridge, Academy, GASM, Owner Console, ARGOS policy, protected-file or frozen-baseline change. `MANIFEST.status = INERT_COMPONENT`, `role = OFFLINE_COMPOSITION`, `offlineOnly = true`, `authority = NONE`, `performsIo = producesDrafts = delivers = executes = approves = keepsState = callsModel = grantsAuthority = false`, `wiredInto = []`.

## What Offline Chain v0 is

`chain.rehearse(input) → ChainTranscript`. A rehearsal on paper of the loop the four components imply, run in memory on data the caller supplies. No memory between calls, no clock (the caller supplies `at`), no I/O, no model call, never throws.

Input (`sinbad-offline-chain-input/0-v1`, exact own-property snapshot):

| Field | Meaning |
|---|---|
| `chainId`, `at` | identity (≤ 96 chars; per-pass record ids are derived from it: `<chainId>.<n>.review / .verdict / .gate / .pilot`) and the single time used for every record |
| `context` | a Phase 3.1 `TaskContext` |
| `passes[]` | 1 … `maxIterations` entries of `{evidenceSet, draft}` — every draft and every evidence set is **input**; the chain never produces, edits or completes one |
| `policy` | `{maxEvidenceAgeMs, volatileMaxEvidenceAgeMs, maxIterations, labelledDelivery}` — the Gatekeeper v0 and Pilot v0 policies, validated by those components' own policy functions |
| `priorTranscriptDigest` | optional digest of a previous transcript (hash chaining) |

For each pass, in order: Co-Pilot v0 reviews the draft → Gatekeeper v0 decides with that verdict (both observe through Sentinel v0) → Pilot v0 reads the two sealed records and recommends. PROCEED, ESCALATE_OWNER and STOP end the rehearsal; REVISE_DRAFT and REQUEST_EVIDENCE move to the next supplied pass, chaining the Pilot decisions by digest. If the Pilot asks for another draft and none was supplied, the rehearsal ends **open** with `AWAITING_DRAFT`. Each component receives its own plain copy of the data; the caller's input is never mutated.

Output (`sinbad-offline-chain-transcript/0-v1`, frozen, sealed with `transcriptDigest`):

- `outcome` ∈ PROCEED / ESCALATE_OWNER / STOP / AWAITING_DRAFT, `reasonCode` (the last Pilot reason, or the chain's own input reason), `failClosed` (true exactly for STOP), `passesSupplied` / `passesRun` / `passesUnused`.
- `steps[]`: per pass the draft id and hash, a summary of the review, the gate decision and the Pilot decision (with its findings), and under `records` the three real sealed records exactly as the components produced them. A test replays one pass directly through Co-Pilot v0 and gets the identical record: the chain adds nothing of its own.
- `provenance`: chain, Co-Pilot, Gatekeeper and Pilot versions, input digest, prior transcript digest, policy.
- `verifyTranscript` re-verifies the transcript digest, every embedded record with its own component's verify function, the summary-to-record digests, the record-to-record links (verdict → gate, gate and review → Pilot, Pilot → previous Pilot) and that the outcome follows from the last step. Tests cover resealed forgeries: wrong outcome, swapped record, edited summary, reordered steps, edited record.

Fail-closed: input that is not exact, a policy either component rejects, no passes or more passes than the budget, or non-plain data is a sealed STOP before any component runs. Anything the components themselves refuse (expired or invalid context, unidentifiable or tampered draft, evidence set of another task) becomes a STOP on that pass, with the refusing component's record in the transcript.

## What the rehearsals show (fixture measurement, not a live measurement)

- Own corpus, `tests/fixtures/chain-v0/cases.json`: 14 scenarios (6 benign, 8 adversarial), each with a hand-declared expected outcome, pinned by transcript digest. All four outcomes occur. False proceeding 0/8, false stopping or escalating 0/6.
- The Co-Pilot v0 corpus (20 drafts) through the whole chain: no adversarial draft proceeds (0/12), every benign draft proceeds (8/8), and the chain's review carries the same warnings and recommendation as the component's own fixture.
- The Gatekeeper v0 corpus (20 drafts): every draft that fixture blocks by its own rules is also blocked and not proceeded with here. Cases that depend on a verdict supplied by that fixture are out of scope, because the chain computes its own verdict.
- Loop behaviour: revise-then-proceed, evidence-then-proceed, budget exhaustion to the Owner on the last pass, authority ending the loop at once (a later clean draft is never run), labelled delivery under both policies.

## Limits

- It is a rehearsal. Nothing is delivered, requested, revised, escalated or stopped; an authorized protected action that "proceeds" is a status in a record and nothing is executed.
- Every draft is supplied. Where drafts come from (a model-driven Pilot loop) is NOT STARTED.
- It runs inside one process on data it built itself, so the record-authenticity limit stated for Pilot v0 does not bite here — and is not solved here either. Records crossing a process or trust boundary need authenticity first (NOT STARTED).
- All four components observe through the same Sentinel v0; a shared blind spot passes the whole chain. The chain measures consistency between the components, not correctness against the world.
- It is not wired into `/ai/chat`, the bridge, the classroom, the dashboard, the Owner Console, edge functions, the benchmark harness or the package `exports` (asserted by `sinbad-ai-core/tests/chain-v0-inert.test.js`). BASELINE-001 and BASELINE-001-REV-1 are untouched; no benchmark score is produced.

## Tests

`sinbad-ai-core/tests/chain-v0-*.test.js` (20 tests; builders in `tests/helpers/chain-v0-builders.js`): contract exactness, exports, record identity and linking, determinism, chaining and tamper detection; every loop scenario above; fail-closed passes; hostile inputs (throwing getters, proxies, cyclic or accessor drafts); the three corpus cross-checks; inertness, no import of the chain by any component or live path, no state surviving a call, inputs never mutated.

## Owner acceptance

Offline Chain v0 = OWNER ACCEPTED on 2026-09-18 (explicit Owner statement approving the numbered request for it in the PR #266 merge report), against main `08b1256096a135bf56ad13311670a992c32daefa` (PR #266), with the Project 2 state verified on main `dd42f96b5800e9c88e6c2b04db6b589bffc5b5d3`. The MERGE GO for PR #266 was not an acceptance; this later statement gave it. Scope: only the Offline Chain v0 implementation as merged - its current inert, deterministic, offline-only rehearsal form; no component gains live execution authority and `MANIFEST.wiredInto` stays empty. Recorded in `docs/project2/PROJECT2_STATE.json` → `owner_acceptance.phase_3_7_offline_chain_v0`. This phase is not a GO for record authenticity, a model pass, a model-driven Pilot loop, wiring or live integration.
