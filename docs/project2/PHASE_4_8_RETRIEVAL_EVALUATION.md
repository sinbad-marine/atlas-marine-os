# Project 2 — Phase 4.8: retrieval evaluation (does the passage that answers reach the model?)

Authority: Owner delegation of 2026-09-19. Starting state main `2a8f86c`. No model was needed for the measurements below, nothing was deployed, no cloud call, the bridge (port 31983) was not restarted and none of its files was modified.

## Why

The gate can only be as useful as the passages in front of the model. Live, in Phase 4.7, the question "What must a ship security plan contain according to the ISPS Code?" was refused honestly — safe, but the library holds the ISPS Code. Diagnosis (read-only): the text is there (`ClassNK_ISPS_Code_Part_A`, "the plan shall address, at least …", 5 chunks in 2 documents); BM25 ranked it **53rd** behind circulars and flag notices that repeat *ISPS / ship / security / plan* more often.

One example is not a measurement. This phase builds the measurement.

## What was built

| File | What it is |
|---|---|
| `tests/benchmark/retrieval/probes-v1.json` | 36 hand-declared probes (28 English, 8 Turkish; ISM, ISPS, MLC, SOLAS, COLREG, MARPOL, STCW, BWM). Each has a question worded as a user would ask and a *needle* (regular expression) that recognises the passage that answers. Every needle was checked to exist in the library before the probe was admitted. 24 DEV probes may be used for tuning; **12 TEST probes are held out**. |
| `tools/evaluate-retrieval.js` | For every probe: HIT = one of the passages the retriever would show matches the needle; `firstRank` = position of the first matching chunk in the whole ranking (null beyond 200). *Strict* probes are those whose needle matches at most 20 chunks of the library — there a hit means the right passage, not merely the right topic. No model, no network; writes only its own result directory; results carry titles and ranks, never passage text. |
| `sinbad-ai-core/pipeline/lexical-retriever.js` | `rank()` exported (the ranking `search()` shows the top of). Same scoring: no search result changed; the version stays `0-v1`. |
| `tests/project2-retrieval-eval.test.js` | In `npm test` / CI: the arithmetic on a synthetic index, the probe set's shape, the recorded runs, the tool's boundaries. The Owner's library is private, so recorded runs are measurement records (they name the index by build time and SHA-256), not something CI rebuilds. |

## RETRIEVAL-001 — the merged retriever (0-v1), 6 passages

| | hit | |
|---|---|---|
| All probes | 29 of 36 | 0.806, MRR 0.662 |
| **Strict probes** | **9 of 14** | 0.64 |
| DEV / TEST | 20 of 24 / 9 of 12 | |
| English / Turkish | 22 of 28 / 7 of 8 | |

Misses: RP-04 (rank 12), RP-05 (11), **RP-06 the ISPS plan (53)**, RP-07 "security level 1 means" (not in the first 200), RP-20 (9), RP-27 (31), RP-36 (57). Easy topical probes are found; the probes that need *the* passage are where it fails.

## RETRIEVAL-002 — a candidate that was **rejected**

Candidate `0-v2`: a wider stop list with English plural folding, document-title terms counted for each chunk, a phrase bonus for adjacent query terms, 4 instead of 2 passages per document; weights tuned on DEV only (grid of 24 + 16 settings).

| | 0-v1 | candidate 0-v2 |
|---|---|---|
| DEV | 20 of 24 | 21 of 24 |
| **TEST (held out)** | **9 of 12** | **9 of 12 — the same three misses** |
| Strict | 9 of 14 | 10 of 14 |
| MRR | 0.662 | 0.656 |
| Turkish | 7 of 8 | 6 of 8 |

The rule was set before TEST was read: no gain on the held-out probes, no shipping. There was none, so **the ranking change is not in the repository**; `RETRIEVAL-002/NOTE.json` keeps the negative result on record. One useful observation survived: with 2 passages per document the passage that answers is sometimes dropped although its document was found (RP-13, RP-22 at rank 4) — but raising the cap alone did not generalise either.

## What the data says

The misses are **vocabulary mismatch**: the user asks "what must the plan contain", the source says "the plan shall address, at least". Counting words differently does not bridge that. Two candidates do, and both need a model:

1. **Restating the question in source wording** with the small local model (`qwen3:4b`, already installed) before the lexical search. Safe by construction: the restatement only decides which passages are fetched, never what is asserted — the gate still checks every claim against the passages' identity and content. A first attempt was stopped by the tool's own memory floor: `qwen3:14b` was resident in Ollama and free memory fell to 1.1 GB. What is verified: Ollama's log shows `/api/chat` requests from 127.0.0.1 starting at 09:16:20 and about 09:23 local time, and this session's first Ollama request that morning was at 09:26:26. **Which process sent the earlier requests: NOT VERIFIED** (the log does not name the caller; an earlier version of this document stated it as fact). The model was left untouched. The 4B model answered with its reasoning text instead of the restatement (`think:false` not honoured), so that attempt produced no usable data. Continued in Phase 4.9.
2. **A semantic re-ranker** over the first 50 lexical candidates. Needs an embedding model that is not installed; installing software on the Owner's machine is the Owner's decision.

Either is adopted only if it moves the TEST probes.

## Limits

- 36 probes are a small set; one probe is 2.8 points. The strict subset (14) is the informative part.
- Several needles are topical ("fire drill", "muster list"): a hit there proves the topic was found, not the clause. That is why strict probes are reported separately.
- TEST has now been read once, in aggregate. It stays held out for the next candidate, but it is no longer untouched.
- The probes measure retrieval only. Whether the model then answers well is the grounded run (Phase 4.7, still INCOMPLETE).

## Owner acceptance

NOT RECORDED.
