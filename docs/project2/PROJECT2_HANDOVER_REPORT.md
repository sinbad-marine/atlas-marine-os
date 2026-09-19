# Project 2 — handover report (state of 2026-09-19, main `38b4a45`)

Written by the engineer under the Owner delegation of 2026-09-19. It records what exists, what was measured, what was not, and what only the Owner can decide. It accepts nothing on the Owner's behalf. Reading rule used throughout: **SOURCE EXISTS ≠ RUNNING ≠ TESTED ≠ OWNER ACCEPTED; MERGED ≠ OWNER ACCEPTED; a document's claim ≠ runtime evidence.**

## 1. What Project 2 now is

A multi-layer answer path in which a model drafts and deterministic components decide what may reach the user:

```
question → passages with identity → model draft → Draft Adapter → citation support screen
        → Offline Chain (Co-Pilot → Gatekeeper → Pilot, over Sentinel observations)
        → PROCEED: deliver (clean or labelled) · REVISE: ask again with the findings · otherwise: withhold honestly
        → one sealed, verifiable transcript per answer (Record Attestation can sign it)
```

| Layer | Where | State |
|---|---|---|
| Authority contracts (3.1), Sentinel v0 (3.3), Gatekeeper v0 (3.4), Co-Pilot v0 (3.5), Pilot v0 (3.6), Offline Chain v0 (3.7), Record Attestation v0 (3.8) | `sinbad-ai-core/{authority,sentinel,gatekeeper,copilot,pilot,chain,attest}` | MERGED · TESTED · inert (`wiredInto = []`) · **OWNER ACCEPTED** (each pinned to its commit in `PROJECT2_STATE.json`) |
| Draft Adapter 0-v1 (4.1), Scoring v1.0.2 + stage-gate subset v1 (4.2) | `sinbad-ai-core/adapter`, `tests/benchmark/rev2` | MERGED · TESTED · **OWNER ACCEPTED** |
| Draft Adapter 0-v2 + disclaimer screen 0-v3 (4.5, 4.6, 4.7) | `sinbad-ai-core/adapter` | MERGED · TESTED · acceptance **NOT RECORDED** (the acceptance of 4.1 stays pinned to 0-v1) |
| GATE-SIM-001 / -002 (historical, hash-pinned) and -003 (rebuilt in CI) (4.4, 4.5, 4.7) | `tools/evaluate-gate-offline.js`, `tests/benchmark/results/GATE-SIM-*` | MERGED · TESTED · acceptance **NOT RECORDED** |
| Grounded pipeline 0-v2: BM25 retriever, loop, citation support screen (4.6, 4.7) | `sinbad-ai-core/pipeline` | MERGED · TESTED · verified live against the local model · **not a product surface** · acceptance **NOT RECORDED** |
| Loopback measurement service and subset runner (4.6, 4.7) | `tools/sinbad-grounded-service.js`, `tools/run-grounded-subset.js` | MERGED · TESTED · `product:false`, 127.0.0.1:31990 only |

Nothing above is wired into the app, the bridge, the cloud function or any production path. The legacy bridge (port 31983) was never restarted and none of its files was modified. No cloud or paid call was made on the Owner's account.

## 2. What was measured (reproducible from the repository)

- **BASELINE-001 / REV-1 / REV-2** — the local bridge answers, scored with v1.0.0, v1.0.1 and v1.0.2 (accepted).
- **GATE-SIM** (152 frozen answers, no passages): right answers wrongly withheld 27 of 90 (0.30) → **20 of 90 (0.222)** with the disclaimer screen; held-out TEST 8 → **5 of 13**; nothing that was delivered became withheld. Enforced in CI (`tests/project2-gate-sim.test.js`).
- **Live, on the Owner's machine**: grounded answers from the local 14B model directly through Ollama in about 2.5–3.5 minutes per question (the same model behind the bridge: 5–6 minutes).

## 3. What the real model taught (each closed without touching an accepted component)

1. The accepted gate checks a citation by identity only: "The DPA is Captain John Smith **[S1]**" (a name planted in the question; S1 names nobody) was delivered as VERIFIED. → citation support screen (lexical; can only remove trust).
2. A refusal that says nothing ("The available sources do not answer it.") → the refusal now names what it cannot confirm.
3. Temporal *still* read as a contrast connective blocked an honest refusal three times → disclaimer screen 0-v3, narrow; six contrastive evasions stay claims.
4. A refusal restating the question with *and* stays a claim (the screen is kept strict) and the model repeated it three times → the feedback gives the plain form, in the question's language.

## 4. What is NOT done — stated plainly

- **The 36-item grounded measurement is INCOMPLETE. No GROUNDED result exists.** The engineering session's host memory guard stopped the background run three times; the engineer removed two real causes of memory growth (memory-mapped weights 15.4 → 9.95 GB; prompt cache, now bounded by unloading the model after every question) and then did not work around the guard. Fourteen rows exist as partial records (`GROUNDED-001`, `GROUNDED-002`); no rate is derived from them. **To finish (about 95 minutes, local, free), from the Owner's own terminal:**
  ```
  node --max-old-space-size=4096 tools/sinbad-grounded-service.js --port 31990 --min-free-gb 3
  node tools/run-grounded-subset.js --run-id GROUNDED-002 --resume
  ```
- **Retrieval quality — now measured (Phase 4.8, PR #285, main `8b7916d`; added to this report after it was first written).** 36 hand-declared probes, 12 held out. The merged retriever finds the passage that answers for 29 of 36 probes but only **9 of 14 strict probes**; the live ISPS miss reproduces (the ISPS Code passage exists and is ranked 53rd). A lexical candidate (stop list, plural folding, title terms, phrase bonus, more passages per document), tuned on DEV only, did **not** move the held-out probes (9 of 12 before and after) and was **rejected — it is not in the repository**; the negative result is on record (`RETRIEVAL-002/NOTE.json`). The misses are vocabulary mismatch between how a user asks and how the source is worded. Candidates that can bridge it need a model: restating the question in source wording with the installed `qwen3:4b` (safe by construction: it only decides which passages are fetched), or a semantic re-ranker (needs an embedding model that is not installed — the Owner's decision). Each is adopted only if it moves the held-out probes. See `docs/project2/PHASE_4_8_RETRIEVAL_EVALUATION.md`.
- **Reserved vocabulary.** Ordinary maritime words (*safe*, *approved*, *compliant*) are treated as status claims by the accepted Sentinel / Gatekeeper text screens. Fixing it changes accepted components and forces every fixture corpus to be regenerated once; it was deliberately not done without data from delivered grounded answers.
- **Everything recorded as `phase_3_remainder_and_later`**: the Co-Pilot model pass, a model-driven Pilot loop, key custody for attestation, any wiring.

## 5. Decisions that are the Owner's alone

| # | Decision | Note |
|---|---|---|
| 1 | OWNER ACCEPTED for 4.3 (design proposal), 4.4, 4.5, 4.6, 4.7 and for Draft Adapter 0-v2 / disclaimer screen 0-v3 | None is recorded. MERGED ≠ OWNER ACCEPTED. |
| 2 | D6 — the stage-gate thresholds | Thresholds are an input to scoring v1.0.2 by design; the engineer set none. |
| 3 | Whether the maritime-reasoning slice gates | Measured, non-gating today. |
| 4 | Any wiring of the grounded pipeline into the app or the bridge, or replacing the bridge's answer path with it | Not a product surface today. |
| 5 | The cloud path of the 4.3 proposal (4.3a) | Needs the Owner's session and paid calls; untouched. |
| 6 | Key custody for Record Attestation | Test keys only. |
| 7 | Changing the accepted Sentinel / Gatekeeper text screens (reserved vocabulary) | Version bump + one fixture regeneration; acceptance of the old versions stays pinned. |
| 8 | Installing an embedding model on the Owner's machine for a semantic re-ranker (Phase 4.8) | Nothing was installed. The alternative that needs no installation (question restated by the installed `qwen3:4b`) is measured first. |
| 9 | OWNER ACCEPTED for 4.8 | NOT RECORDED. |

On HOLD by Owner directive and untouched: Academy, Hat D, the Offline Autonomous Developer core gap (no implementation, no repository document, no tool installed).

## 6. Known local-only test failures (not Project 2's)

On Windows with `core.autocrlf=true`, `tests/yacht-management-owner-lock.test.js` and `tests/pages-release-artifact.test.js` fail because `assets/console-art/yacht-management-owner-lock-v1/OWNER_CANONICAL_LOCK.json` has no `eol=lf` attribute (introduced by PR #276 of another session). Both pass on Linux CI. `tests/argos-bridge-http.test.js` is timing-sensitive and can fail locally while the CPU is saturated; it passes alone. Project 2 did not touch these areas.

## 7. How to verify this report

`git log origin/main`, `docs/project2/PROJECT2_STATE.json`, `npm test` from the repository root, `node tools/evaluate-gate-offline.js --check`, and `node tools/verify-argos-integrity.js` on a `git archive` export. Every number above comes from a file in the repository or from a measurement described in `docs/project2/PHASE_4_*.md`.
