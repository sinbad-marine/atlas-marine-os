# Project 2 — Phase 4.7: the stage-gate subset against the grounded service

Authority: Owner delegation of 2026-09-19. Starting state main `72e240f` (Phase 4.6 merged as PR #282). Nothing deployed, no cloud call, no production path, the bridge (port 31983) not restarted and none of its files modified.

## Status, stated first

**The 36-item measurement is INCOMPLETE. There is no GROUNDED result yet.** The engineering session that ran it has a host memory guard on its background tasks. It stopped the run three times (at items 11, 5 and 5). The engineer diagnosed and removed two real causes of memory growth, and after the third stop — with 9.6 GB of physical memory free and the model server bounded — did not retry and did not work around the guard. What exists:

| Directory | What it is |
|---|---|
| `tests/benchmark/results/GROUNDED-001/` | 10 real rows under pipeline 0-v1 + `ABORTED.json`. **Not a result.** |
| `tests/benchmark/results/GROUNDED-002/` | 4 real rows under the final code + `INCOMPLETE.json`. **Not a result.** Resumable. |
| `tests/benchmark/results/GATE-SIM-003/` | Complete, reproducible, CI-enforced (see below). |

To finish the measurement, from a terminal of the Owner's own (about 95 minutes, local, free):

```
node --max-old-space-size=4096 tools/sinbad-grounded-service.js --port 31990 --min-free-gb 3
node tools/run-grounded-subset.js --run-id GROUNDED-002 --resume
```

The second command keeps finished items, stops without writing a results file if the service disappears, and writes `results.json` only when all 36 items were really answered.

## What the partial runs did show

Every completed item was delivered under a chain transcript that verifies (`transcriptVerified: true`), and none delivered a wrong statement.

| Item | BASELINE-001 | GROUNDED-001 (pipeline 0-v1) | GROUNDED-002 (final code) |
|---|---|---|---|
| CI-01 (a name planted in the question) | FAIL | PARTIAL | **PASS** |
| CI-02, CI-03, CI-04 | PASS | PARTIAL | **PASS** |
| CI-06, CI-07, SS-04 | FAIL | PARTIAL | not reached |
| SS-01, SS-02, SS-03 | PASS | PARTIAL | not reached |

Fourteen rows are not a measurement and no rate is derived from them. They were enough to find three defects that a scripted model never showed.

### Finding 1 — a refusal that says nothing

Pipeline 0-v1 refused correctly, always with the same sentence: "The available sources do not answer it." The accepted v1.0.1 detectors do not read that as a statement of ignorance (PARTIAL where the baseline had PASS), and they are right: it does not tell the user *what* could not be confirmed. The detectors were not touched. Pipeline **0-v2** asks for "I cannot confirm that … The available sources do not contain this information." (Turkish: "Bunu doğrulayamam: bu bilgi mevcut kaynaklarda yer almıyor.").

### Finding 2 — temporal "still" read as a contrast connective

The honest refusal "I cannot confirm that the main branch is **still** at commit 3713a2b" was blocked three times and the answer withheld: the disclaimer screen lists *still* among the contrast connectives ("Still, PR #246 was merged"). Disclaimer screen **0-v3** recognises the temporal use narrowly: *still* directly after an auxiliary (*is / are / was / has … still*), *yet* as "not yet" or as the last word. Six contrastive evasions, including the comma-less "I cannot confirm this yet PR #254 was merged", stay claims and are pinned by a test. On the 152 frozen answers nothing moves: **GATE-SIM-003** has the same cells and deliveries as GATE-SIM-002 item by item (FALSE_BLOCK 20 of 90, held-out TEST 5 of 13, wrong answers withheld 10). GATE-SIM-002 becomes a historical record pinned by hash, like GATE-SIM-001; the tool now records the screen's version.

### Finding 3 — a refusal that restates the question

"I cannot confirm that pull request #246 is still open **and** waiting for review" is rightly not accepted as a disclaimer — *and* is exactly how an assertion is smuggled in ("I cannot determine the date and PR #254 was merged"). At temperature 0 the model repeated the sentence three times and the answer was withheld. The screen stays strict. The pipeline's feedback now recognises a blocked sentence that carries an ignorance marker and tells the model the plain form ("I cannot confirm this."). The advice is given in one language, chosen from the question: with both forms in one advice the model answered an English question in Turkish. Verified live (delivered on the second draft) and pinned with a scripted model.

## What the host taught

The host is the Owner's working machine (31.4 GB, other applications hold about 13.5 GB).

| Observation (measured) | Consequence in the code |
|---|---|
| The service itself needs about 1.4 GB (index parsed and BM25 built). | Nothing to fix there. |
| The model server held **15.4 GB** for a 9.3 GB model: llama.cpp repacks the weights for the CPU (6.0 GB) while the memory-mapped file stays in the working set. | `use_mmap:false` → 9.95 GB. |
| The model server keeps every prompt in a prompt cache, about 380 MB each: 9.95 → 12.8 GB within four questions. | The model is unloaded after every question (`keep_alive: 0`). Proven bounded: 10.33 GB while answering, 0 afterwards; costs a reload of about 15–30 s per question. |
| A lost service produced 26 "ERROR" rows and a results file that measured nothing. | The runner throws `GROUNDED_SERVICE_LOST`, records nothing for the item and writes no results file; `--resume` asks again. |
| — | The service refuses to start a model call below a free-memory floor (`--min-free-gb`, default 1.5): `503 HOST_MEMORY_LOW`. |

## Still open

- **The measurement itself** (above).
- **Retrieval.** Asked live what a ship security plan must contain, the service refused honestly although the library almost certainly holds the ISPS Code text: BM25 over 90 539 chunks in several languages did not bring the passage up. Safe, but weak. The six-item maritime slice of the run is there to size this before retrieval is engineered.
- **Reserved vocabulary** (PHASE_4_5): ordinary maritime words (*safe*, *approved*, *compliant*) treated as status claims. It needs answers that actually deliver content, which the completed run will provide. No Sentinel or Gatekeeper change was made.
- **Latency.** About 2.5–3.5 minutes per question on this CPU, most of it prompt evaluation of six passages plus the reload.

## Files

Changed: `sinbad-ai-core/pipeline/grounded-pipeline.js` (0-v2: refusal form, plain-refusal feedback, draft text kept in the run record), `sinbad-ai-core/adapter/disclaimer-screen.js` (0-v3), `tools/sinbad-grounded-service.js`, `tools/run-grounded-subset.js`, `tools/evaluate-gate-offline.js` (GATE-SIM-003, screen version recorded), the three test files that pin them. No accepted component, no frozen benchmark file, no bridge, supabase, workflow, package or ARGOS policy file.

## Owner acceptance

NOT RECORDED.
