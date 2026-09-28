# Project 2 — Phase 4.10 part 2: bounded regulatory-core experiment — lexical vs semantic vs simple hybrid (DEV)

Authority: Owner directive "PHASE 4.10 PART 2" of 2026-09-19, the interim decision (selection rule frozen before measurement) and the integrity check of the same day. Full-library index: **ON HOLD, not started**. TEST-3: **designed, NOT run**. Nothing wired. No cloud, no paid service, one authorised local model. **The engineer gives no PASS / REVISE / STOP verdict** (interim decision); section F is a recommendation.

## A. Starting truth (read from disk)

Branch `codex/project2-phase-4-10-part2-regulatory-core` from main `211fca8` (PR #290 merged, tree clean, Phase 4.9 NOT ACCEPTED, no acceptance recorded for 4.3–4.10). The Part 1 pilot artefacts matched the report: manifest, model digest `ac6da0dfba84…`, two shards, vector hashes. Model: `qwen3-embedding:0.6b`, Q8_0, 1024 dimensions, local Ollama. Existing tools used: `lexical-retriever.js` (0-v1), `build-semantic-index.js`, `semantic-retriever.js`, probes-v1 DEV split.

## B. Corpus — `regulatory-core-v1` (`tests/benchmark/retrieval/corpus-regulatory-core-v1.json`, sha `ceaf4006e4bfc791`)

**157 whole documents, 3 813 chunks (4.2 % of the library); 3 810 indexable.** FLAG_STATE 60 / 1 588, ILO 27 / 1 091, IMO 60 / 919, CLASS 10 / 215. Rules look at the document **title and size only** — never at a question, needle or answer: the title names an issuing authority (class, flag / port state, ILO, IMO) **and** a regulatory topic (ISM, ISPS, MLC, SOLAS, STCW, COLREG, MARPOL, BWM and their subjects). Excluded: 120 exam / course / summary titles, 780 without an authority, 514 without a topic, 5 documents over 150 chunks, later copies of 110 duplicated titles. Whole documents only; the manifest holds titles, counts, SHA-256 per document and the inclusion reason — never text; the text always comes from the library.

**3 813 → 3 810 (Owner integrity check: PASS).** The last three chunks of one AMSA document (2 800 + 2 800 + 651 characters, **0 letters, 0 digits**) are punctuation filler. The lexical retriever has never indexed a chunk without a term and the builder embeds exactly the chunks of that index. The evaluator enforces *manifest − not-indexable = lexical universe = vector rows, all documents present* (`SCOPE_DRIFT` otherwise) and records the three identities.

## C. Index / build (vectors outside the repository: `%LOCALAPPDATA%\Sinbad\semantic-index\regulatory-core-v1`)

| | |
|---|---|
| Result | 30 shards, **3 810 rows = 3 810 lexical chunks**, every row hash equal to its chunk hash (0 problems), chunk-set SHA-256 `8464685e…cca5d2` |
| Rebuild check | 16 stored vectors embedded again after a fresh model load: minimum cosine **1.000000** |
| Footprint | 16 MB on disk; builder RSS peak 0.98–1.48 GB; model about 2.1 GB resident |
| Time | about 3.7 h of embedding at 0.27–0.31 chunks/s (8 of 16 threads); wall clock about 5 h |
| Interruption 1 | another process loaded `qwen3:14b` (origin **NOT VERIFIED**; not this session): free memory 12 → 0.7 GB within one shard and the **host's guard killed the job** at 1 408 rows. 11 finished shards verified intact, no `.tmp`. The builder now checks its memory floor before **every** request and never writes a shard it gave up. Resumed when the machine was free; finished shards skipped. |
| Interruption 2 | `qwen3-vl:8b-instruct` was installed and used by someone else (origin **NOT VERIFIED**): the builder **yielded for 75 minutes**, released its own model meanwhile, and continued by itself. |
| Reporting fixes (directive point 10) | throughput was `built × SHARD_ROWS` over the whole run — now rows actually embedded over embedding time; a second flaw found on the real build (yield time counted as embedding: 0.18 reported, 0.27 real) fixed too. Regression tests for both. |
| Full build | `FULL_BUILD_IS_ON_HOLD` unless `--full-build-owner-go`; the flag is a **technical interlock, not an authorisation** (written in the code and tested). |

## D. DEV results — RETRIEVAL-004 (same 3 810 chunks for every system; 21 of 24 DEV probes answerable in the corpus, 15 strict; 6 passages, ≤ 2 per document)

| System | hits | strict | MRR | @1 | @3 | @10 | vs lexical |
|---|---|---|---|---|---|---|---|
| **LEXICAL** (BM25 built over the corpus) | 17 | **12** | 0.617 | 11 | 13 | 18 | — |
| SEMANTIC RAW | 16 | 10 | 0.704 | 13 | 16 | 17 | +RP-05 RP-22 / −RP-02 RP-26 RP-35 |
| SEMANTIC INSTRUCTED | 15 | 9 | 0.718 | 14 | 15 | 17 | +RP-05 RP-22 / −RP-02 RP-26 RP-28 RP-35 |
| HYBRID RRF k60 lex2:sem1 RAW (**selected by the frozen rule**) | 18 | **12** | 0.628 | 11 | 14 | 18 | +RP-05 / none lost |
| HYBRID RRF k10 lex1:sem2 RAW | 18 | 12 | 0.695 | 12 | 17 | 18 | +RP-05 RP-22 / −RP-35 |
| HYBRID RRF k10 lex1:sem1 INSTRUCTED | 18 | 12 | 0.698 | 13 | 15 | 18 | +RP-05 RP-22 / −RP-35 |
| HYBRID SLOTS keep4 (RAW / INSTRUCTED) | 18 | 12 | 0.622 | 11 | 13 | 18 | +RP-05 RP-22 / −RP-35 |
| best MRR: RRF k10 lex1:sem2 INSTRUCTED | 17 | 11 | 0.748 | 15 | 15 | 17 | +RP-05 RP-22 / −RP-28 RP-35 |

All 21 systems (3 + 18 declared hybrids) are in `results.json`. **No system beats lexical on strict hits.** The best hybrids equal it (12 of 15) and add one non-strict hit.

**DEV MODEL SELECTION (frozen in `8201b13` before any measurement; applied by the tool):** query mode = RAW (semantic-only strict 10 vs 9); of 9 RAW hybrids 6 are excluded for more than one regression; among the 3 eligible (all 12 strict) the tie-break *fewer regressions* selects **RRF k60, lexical 2 : semantic 1, RAW**. This is a candidate picked from 18 configurations on 21 probes — **not a verified gain and not a product truth**. Its measured advantage over lexical is one non-strict probe.

## E. Failure analysis (who finds the evidence — rank of the first matching chunk: lexical / semantic RAW / semantic INSTRUCTED)

| Category | Probes |
|---|---|
| BOTH find it (14) | semantic usually ranks it higher: RP-04 7 / 1 / 1, RP-13 6 / 1 / 1, RP-16 2 / 1 / 1 — hence the better MRR and hit@1 (13–14 vs 11) |
| **SEMANTIC only (2)** | RP-05 (non-conformity, corrective action) 10 / 1 / 1; **RP-22 (fog → "restricted visibility") not found by lexical at all / 1 / 1** — the vocabulary-mismatch case semantic retrieval is meant for |
| **LEXICAL only (3)** | RP-02 (audit interval) 1 / 7 / 10; RP-26 (SOPEP) 4 / 8 / 9; **RP-35 (Turkish question, Turkish needle) 6 / 116 / 93** |
| NONE (2) | RP-07 ("security level 1 means") 176 / 118 / 36; RP-31 (Turkish) 8 / – / – |

- **Semantic alone is not better than lexical here**: it loses three lexical hits for two gains. Its strength is ordering (top-1), its weakness exact regulatory wording and Turkish.
- **Turkish is a semantic weakness in this setup** (RP-35, RP-31): with an essentially English corpus the model ranks the Turkish source chunks far down. The instructed query does not repair it.
- **The instruction does not help**: INSTRUCTED has the best MRR but fewer hits and strict hits than RAW.
- **Hybrid regressions**: every one of the hybrids that gains RP-22 (the clearest semantic win) loses RP-35 (the Turkish lexical win); the rule-selected hybrid keeps all lexical hits but does **not** gain RP-22 (rank 73: a chunk lexical never sees gets too little RRF weight at 2 : 1).
- **The per-document cap hides hits**: RP-28 INSTRUCTED has its first match at rank 3 and still misses, because ranks 1–2 are the same document.
- RP-07 is missed by every system: a one-chunk definition among 3 810.

## F. Recommendation for the next engineering experiment (no verdict)

1. **The evidence does not show a material gain from semantic or simple hybrid retrieval on this corpus**: strict hits 12 → 12, hits 17 → 18, and that one hit is within noise for 21 probes. It does show that the two methods are **complementary** (2 semantic-only, 3 lexical-only) and that semantic ranking puts the right passage first more often.
2. It does **not** support expanding the corpus or starting the full index now.
3. If work continues, the cheapest informative next steps are deterministic and need no new model: (a) a larger DEV set for this corpus — 21 probes cannot separate these systems; (b) a fusion that lets a strong semantic-only candidate in without displacing lexical hits (for example one guaranteed slot for the top semantic passage — a SLOTS variant with semantic rank 1 — measured on that larger DEV set, declared beforehand); (c) a language-aware path, since Turkish questions are where semantic retrieval fails; (d) deterministic document-level tools (regulation / clause lookup) for definition questions such as RP-07, which no ranking method found.
4. The bounded lexical baseline (12 of 15 strict) is far better than on the full library (12 of 25 on TEST-2): **most of the retrieval problem of Phase 4.9 was corpus noise** (exam banks, duplicates, unrelated books). Curating what is searched may be worth more than changing how it is searched. This is an observation across two different universes, not a measured comparison.

## G. TEST-3 readiness — **NOT READY**

- A blind set exists as a **design**: `probes-test3-regulatory-core-v1.json`, 36 probes (24 strict), admitted by counting inside the corpus only, disjoint from the used sets, committed (`2a0d7c5`) before any DEV measurement; no tool can read it; it was **not run**.
- Not ready because: (1) DEV shows no strict gain for any candidate, so a blind run would spend the only unused holdout on a candidate without a development signal; (2) no acceptance-criteria package has been approved by the Owner — a proposal is below; (3) the execution path for TEST-3 is deliberately not implemented.
- **Proposed package, for the Owner's decision, should a candidate ever justify it:** configuration = the rule-selected hybrid, frozen by commit; same universe; criteria on TEST-3, all required: strict hits ≥ lexical + 3; regressions ≤ 1; gains − regressions ≥ 4; MRR higher; neither language lower; one run; the set becomes a USED HOLDOUT afterwards.

## Protected areas

Not touched: the seven accepted components, adapter, grounded pipeline, citation support, lexical retriever scoring, query expansion, grounded service and runner, all earlier benchmark results, package.json, workflows, bridge (port 31983), supabase, ARGOS policy, GROUNDED-002. No vector or index binary is tracked in Git. Frozen selection code and preregistration are byte-identical to `8201b13` (hashes pinned by a test).

## Owner acceptance

NOT RECORDED.
