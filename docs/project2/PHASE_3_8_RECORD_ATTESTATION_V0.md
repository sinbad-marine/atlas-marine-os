# Project 2 — Phase 3.8: Record Attestation v0 (inert, deterministic origin envelope for sealed records)

Owner GO of 2026-09-18, starting state main `dd42f96`. The PR #266 merge report put three numbered requests to the Owner; the third asked for an Owner GO for the next phase and recommended the record-authenticity envelope. Owner statement: "1. 2. 3. İÇİN YUKARIDAKİ TALEP VE İSTEKLERİNİ UYGUN BULUYOR VE ONAYLIYORUM. SIRAYI SEN BELİRLE". Scope: **"PROJECT 2 / PHASE 3.8 — RECORD ATTESTATION v0 ONLY"**. NOT STARTED and not covered by this GO: the Co-Pilot model pass, a model-driven Pilot loop, any wiring or live integration, and making any existing component *require* attestations.

Scope delivered: Record Attestation v0 under `sinbad-ai-core/attest/`. No file under `sinbad-ai-core/authority/`, `sentinel/`, `gatekeeper/`, `copilot/`, `pilot/` or `chain/` was modified; no model, routing, runtime, bridge, Academy, GASM, Owner Console, ARGOS policy, protected-file or frozen-baseline change. `MANIFEST.status = INERT_COMPONENT`, `role = RECORD_ORIGIN_ATTESTATION`, `originOnly = true`, `authority = NONE`, `performsIo = generatesKeys = storesKeys = executes = approves = keepsState = callsModel = grantsAuthority = false`, `wiredInto = []`.

## The gap it closes

Every sealed record of Project 2 carries a self-digest. That proves integrity and says nothing about origin: anyone can edit a record and recompute the digest. PHASE_3_6_PILOT_V0.md stated this as a limit — a gate decision rewritten consistently and supplied without a review is not detectable by Pilot v0. `attest-v0-origin.test.js` first **demonstrates** that limit (a BLOCK decision rewritten to a clean ADMIT and resealed passes `verifyDecision`, and Pilot v0 recommends PROCEED on it) and then shows the same forgery REJECTED on every path an attacker has.

## What Record Attestation v0 is

Two pure functions. No memory between calls, no clock (the caller supplies times), no I/O, no model call, never throw.

`attest(input) → AttestResult` (ATTESTED with an envelope, or REFUSED with a reason). Input: `attestationId`, `issuedAt`, `recordKind`, the `record`, and `signer {keyId, seedHex}` (a 32-byte Ed25519 seed). It refuses to sign anything that is not plain data, is not of the declared kind, or does not pass the producing component's own verify function. The seed never appears in the result.

The envelope (`sinbad-attestation/0-v1`) is small (well under 1 KB) and carries no record content: `attestationId`, `algorithm = ED25519`, `keyId`, `recordKind`, `recordVersion`, `recordDigest` (the record's self-digest), `payloadDigest` (SHA-256 of the canonical whole record), `taskRef`, `issuedAt`, `authority = NONE`, `signature` over the canonical form of all the other fields. Ed25519 signatures are deterministic, so the same input gives the same envelope.

Record kinds: SENTINEL_REPORT, COPILOT_REVIEW, GATEKEEPER_DECISION, PILOT_DECISION, CHAIN_TRANSCRIPT. For each, the component reads the format version, the digest field and the verify function of the producing component; it never runs `observe`, `review`, `decide` or `rehearse` (asserted by the inert test).

`check(input) → AttestationCheck` (sealed with `checkDigest`; `status` AUTHENTIC or REJECTED). Input: `checkId`, `at`, the `envelope`, the `record` the caller holds, a `trustStore`, `expected {recordKind, taskRef}` (either may be null) and `policy {maxAgeMs}`. A trust-store entry is `{keyId, publicKeyHex, kinds[], notBefore, notAfter, revoked}`: **every key is bound to the record kinds it may attest**, so a genuine Pilot key cannot speak for the gate.

Order of the check, first failure decides: input / policy / expectation / trust store / envelope shape → key known → **signature valid** (before anything the envelope says is believed) → key not revoked → key valid at `issuedAt` → key bound to the kind → not from the future → not older than `maxAgeMs` → expected kind → expected task → the held record is plain data, of that kind and intact → the held record is the attested one (self-digest, payload digest and task all match).

## What AUTHENTIC means, and does not

AUTHENTIC means: this exact record was attested, for this task, at that time, by a key the caller's trust store binds to that kind. It is about origin only (`originOnly = true`). An authentic BLOCK is still a BLOCK and an authentic fail-closed STOP is still a STOP (both tested). Nothing is approved, executed or granted; `authority = NONE` throughout.

## Limits

- **Key custody is out of scope.** v0 generates no keys, stores no keys and knows nothing about where a seed lives; the seed is an input of `attest` and whoever holds it can attest. Generating, protecting, rotating and distributing keys, and who owns the trust store, are decisions for a wiring phase and need their own Owner GO. The test keys are derived at test time from public labels (`tests/helpers/attest-v0-builders.js`); no seed, PEM or private key is stored in the repository, and the fixtures hold check inputs only (asserted by a test).
- **A compromised or misused trusted key defeats it**, within the kinds that key is bound to and until it is revoked in the caller's trust store. Revocation is only as current as the store the caller supplies.
- **Nothing requires attestations yet.** Pilot v0 and Offline Chain v0 are unchanged and still accept unattested records. Making a consumer demand `AUTHENTIC` before reading a record is a change to an accepted component and is NOT STARTED.
- It attests records, not truth: a genuine component can still be wrong, and all components share the Sentinel v0 observation engine.
- The only platform module used is the signature primitive (`createPrivateKey`, `createPublicKey`, `sign`, `verify` from `node:crypto`), pinned by the inert test; no key generation, randomness, encryption, I/O, clock or state.
- It is not wired into `/ai/chat`, the bridge, the classroom, the dashboard, the Owner Console, edge functions, the benchmark harness or the package `exports` (asserted by `sinbad-ai-core/tests/attest-v0-inert.test.js`). BASELINE-001 and BASELINE-001-REV-1 are untouched.

## Tests

`sinbad-ai-core/tests/attest-v0-*.test.js` (35 tests; builders in `tests/helpers/attest-v0-builders.js`, where real records of every kind come from one offline rehearsal): every kind attested and checked; envelope size and content; determinism; every refusal of `attest` and every rejection of `check`, including hostile inputs (throwing getters, proxies, cycles); the Pilot v0 limit demonstrated and then closed on five attack paths (real envelope reused, untrusted key, unknown key id, genuine key of another role, any envelope field edited); one envelope for one record; key revocation, validity window, kind binding; time and expectation; AUTHENTIC is not approval; inertness, no import by any component or live path, no key material in the repository, no state, inputs never mutated. Deterministic fixtures: `sinbad-ai-core/tests/fixtures/attest-v0/cases.json` (16 checks: 6 GENUINE covering all five kinds, 10 FORGED, each with a hand-declared expected status and reason; the stored signatures re-verify). On this corpus false acceptance = 0/10 and false rejection = 0/6; this is a fixture measurement, not a measurement of any live system.

## Owner acceptance

NOT RECORDED. Merge requires a separate Owner MERGE GO. This phase is not a GO for key custody decisions, for making any component require attestations, for a model pass, wiring or live integration.
