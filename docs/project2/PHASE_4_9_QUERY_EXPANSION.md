# Project 2 — Phase 4.9: query expansion for retrieval — measured on a blind set, **NOT ACCEPTED**

Authority: Owner directive "REVISE" of 2026-09-19 (ten points) under the delegation of the same day. Starting state main `662fb55`. Nothing installed, no embedding model, no cloud or paid call, nothing deployed, the bridge (port 31983) not restarted and none of its files modified, GROUNDED-002 not touched.

## Result, stated first

A small local model restating the question in source wording, searched **together with** the original question, was judged once on a blind set of 36 probes against criteria written down beforehand. It gained 3 probes and lost 1. The criteria asked for more. **Query expansion does not enter the pipeline.** Nothing is wired. The embedding / semantic re-ranker option goes to the Owner as a decision (last section).

## Protocol (directive points 1, 2, 6, 7, 8)

| Set | Role | Status |
|---|---|---|
| `probes-v1.json` DEV (24) | development and tuning | in use |
| `probes-v1.json` TEST (12) | — | **USED HOLDOUT / historical benchmark** since it was read on 2026-09-19 (written into the file; the tools cannot select it on its own; it was not read for anything in this phase) |
| `probes-test2-v1.json` (36; 27 en, 9 tr; 25 strict) | one final judgement | blind until the final run, **USED HOLDOUT** since |

- TEST-2 needles were admitted by **counting** matching chunks only (44 candidates checked, all present); no retrieval was run on the questions and no document title was looked at while they were written.
- Both tools refuse TEST-2 without `--final` and an existing preregistration file (tested).
- The configuration and the acceptance criteria were committed and pushed **before** the blind set was read: `RETRIEVAL-003/PREREGISTRATION.json`, commit `ac74417` (2026-09-19 10:59 +03:00). The final run followed.

## What was built (directive points 4, 5, 6)

| File | What it is |
|---|---|
| `sinbad-ai-core/pipeline/query-expansion.js` | Pure; calls no model. The prompt; `check()`; `fuse()`. **Not wired** into the grounded pipeline (asserted by a test). |
| `tools/generate-query-expansions.js` | The only tool that calls a model: loopback Ollama, temperature 0, fixed seed, short output. Starts only above a free-memory floor (raised to 12 GB for the 14B model, never lowerable), stops mid-run below 2.5 GB, unloads only the model it used. Looks at no retrieval result. |
| `tools/evaluate-retrieval.js` | Calls no model. Baseline and candidate **side by side**: overall and strict hit rate, MRR, English / Turkish, gains, **regressions by probe id**, baseline hits kept, ranks improved / worsened. It does not trust the stored verdict of an expansion: it checks the raw model output again itself. |

**The small model is not an authority.** `check()` discards an expansion **whole** when it is not exactly the two required lines, is a question, is too short or too long, repeats itself, or states a number, a number word, a period, or a regulation / rule / chapter / section / annex reference that the question did not contain. A discarded, failed or absent expansion gives **exactly** the original lexical result.

**The original query is never replaced.** SLOTS fusion: the first `keep` passages are the untouched original result in its order; the remaining places are filled from the rewrite, skipping what is already shown; places it cannot fill go back to the original ranking.

Why the check matters — real outputs on DEV, all discarded: "internal safety audits … not exceeding **two years**" (it is twelve months), "minimum age … **eighteen** years" (it is 16), "ships of **100** gross tonnage … garbage record book" (it is 400).

## Deviation from the directive, and why (point 3)

The directive names `qwen3:4b`. Measured: the installed `qwen3:4b` is a **thinking-only** variant (context length 262 144). It ignores `/no_think` and `think:false`; at temperature 0 it produced no answer within 700 tokens (47 s) nor within 3 000 tokens (240 s); **0 of 24** DEV expansions were usable (`expansions-dev-qwen3-4b.json`). It cannot meet the directive's own conditions. The other installed local model, `qwen3:14b`, honours `think:false` (two clean lines, about 15 s per question on this CPU) and was used instead. No model was installed. The blind set was not spent on the 4B model.

## Development — DEV only

Tuned on the 24 DEV probes: the prompt (one revision: "a query is a fragment of the source sentence, not a question"), `keep` ∈ {2…6}, one or two rewrites, 6 or 8 passages. The second rewrite (other language) did not help and is not used.

| DEV, 6 passages | baseline | keep 4, 1 rewrite |
|---|---|---|
| hits | 20 of 24 | **24 of 24** |
| strict | 7 of 9 | **9 of 9** |
| MRR | 0.765 | 0.785 |
| gains / regressions | | 4 / 0 |
| expansions valid | | 19 of 24 (5 discarded, all for invented numbers) |

## Final run — BLIND TEST-2, one run, preregistered configuration

| | baseline | candidate |
|---|---|---|
| hits (36) | 22 (0.611) | 24 (0.667) |
| **strict (25)** | **12** | **14** |
| MRR | 0.447 | 0.458 |
| English / Turkish | 15 of 27 / 7 of 9 | 17 of 27 / 7 of 9 |
| gains | | T2-03, T2-05, T2-08 (all strict, all from the rewrite slot; two were not within the first 200 lexical ranks) |
| **regressions** | | **T2-19** (answer was 5th in the original result, lost its place to the rewrite slot) |
| baseline hits kept | | 21 of 22 |
| ranks improved / worsened | | 4 / 6 |
| expansions valid | | 26 of 36 (9 discarded for invented numbers, 1 duplicate) |

| Criterion (preregistered) | Measured | Met |
|---|---|---|
| A. strict: ≥ +3 | +2 | **no** |
| B. gains − regressions ≥ +4 | +2 | **no** |
| C. regressions ≤ 1 | 1 | yes |
| D. MRR higher | 0.458 > 0.447 | yes |
| E. neither language lower | EN +2, TR 0 | yes |
| F. ≥ 60 % expansions valid | 72 % | yes |

**Verdict: NOT ACCEPTED** (`RETRIEVAL-003/VERDICT.json`). With 3 gains and 1 regression a one-sided sign test gives p = 0.31.

## What the data says

1. The mechanism works as designed and is safe — but it does not help often enough. DEV (+4 / 0) overstated it; that is what a blind set is for.
2. Of the 11 probes missed by both, 8 **had** a valid rewrite. The limit is not the strict check.
3. On "how often / how long / how much" questions the model answers instead of rewriting; the check rightly discards that. The mechanism is weakest exactly where a precise passage matters most.
4. **The more important number is the baseline: 12 of 25 strict probes (48 %) on unseen questions.** `probes-v1` had suggested 9 of 14. Roughly every second question that needs *the* passage does not get it. No amount of gating downstream repairs that; the honest outcome is then a refusal, as seen live.

## Decision for the Owner (point 8)

Lexical retrieval, with or without a rewrite, is the weak link. The remaining candidate is **semantic**:

| Option | What it needs | Cost / risk |
|---|---|---|
| Semantic re-ranker over the first ~50 lexical candidates | an **embedding model installed in Ollama** (for example a multilingual one of a few hundred MB) — **Owner GO required**, nothing was installed | about 50 short embeddings per question at query time; no index to build; reversible |
| Full semantic index of the library | the same model, plus embedding 90 539 chunks once (hours on this CPU) and storing the vectors outside the repository | best recall, including passages lexical search never surfaces (3 of the strict probes are not within the first 200 lexical ranks); heavier |

Either would be judged the same way: DEV for development, a **new** blind set for the verdict, criteria written beforehand. Both existing held-out sets are now used.

## Limits

- 36 probes; one probe is 2.8 points; the criteria are practical thresholds, not significance claims.
- A deviation from the directive (14B instead of 4B) was necessary and is recorded above.
- Generating a rewrite costs about 15 s per question on this CPU with the 14B model; that was not part of the verdict and would have mattered had it passed.

## Owner acceptance

NOT RECORDED.
