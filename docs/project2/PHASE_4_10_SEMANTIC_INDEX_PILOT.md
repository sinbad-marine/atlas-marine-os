# Project 2 — Phase 4.10 (part 1): semantic index — model installed, pilot complete, **full build not started**

Authority: Owner directive "EMBEDDING / SEMANTIC RETRIEVAL GO" of 2026-09-19 and the technical clarification of the same day. Starting state main `8cff777`. Installed: **one** model, `qwen3-embedding:0.6b`, through local Ollama. No cloud, no paid service, no other embedding model, nothing wired into the pipeline, no protected setting changed; the bridge (port 31983) untouched; GROUNDED-002 untouched; Phase 4.9 stays NOT ACCEPTED.

## Status, stated first

The pilot passed every check the directive lists. **One number changes the plan: the full index of 90 539 chunks needs about 4 to 6.5 days of continuous CPU on this machine, not "hours".** The engineer's earlier estimate ("hours"), on which the Owner chose the full index, was wrong by more than an order of magnitude. The full build has therefore **not** been started; the projection is put before the Owner first, as the clarification asks.

## What was installed

| | |
|---|---|
| Model | `qwen3-embedding:0.6b`, Ollama id `ac6da0dfba84`, 639 MB on disk, Q8_0, 595.78 M parameters, embedding length **1024**, context 32 768 |
| Resident size while embedding | about 2.0–2.1 GB |
| Ollama | 0.34.2, loopback `127.0.0.1:11434`, CPU only (no GPU is used on this host) |

## What was built

| File | What it is |
|---|---|
| `tools/build-semantic-index.js` | Embeds chunks with the one authorised model and writes the vectors **outside the repository** (refuses an output directory inside the repository or inside the library folder). Reads the library index read-only. Sharded, atomic, resumable, refuses a foreign directory, deletes nothing. Memory floors, a thread cap that leaves half the cores free, a time budget, and it **yields**: while any other model is resident in Ollama (the bridge answering, a grounded run) it waits instead of competing. |
| `sinbad-ai-core/pipeline/semantic-retriever.js` | Pure arithmetic: cosine ranking, reciprocal rank fusion, SLOTS fusion, the per-document cap. No model call, no I/O. **Not wired** (asserted by tests). No learned or opaque re-ranker. |
| `tests/project2-semantic-index.test.js`, `sinbad-ai-core/tests/semantic-retriever.test.js` | In `npm test` / CI: the boundaries above, shard completeness rules, the arithmetic, the fixed query instruction. |

**Documents and queries (Owner clarification).** Documents: the authoritative chunk text is embedded **exactly as it is** — no prefix, no title, no instruction, no cleaning (`INPUT_RULE` is pinned in the manifest and by a test). Queries: the model's documented format with **one fixed instruction**, never adapted to a question, containing no answer and no fact:

```
Instruct: Given a maritime regulatory or operational question, retrieve relevant passages that contain the evidence needed to answer the query.
Query: <original query>
```

Both query modes (`RAW`, `INSTRUCTED`) exist so that DEV can measure them separately; the one to be used is frozen before TEST-3 is preregistered. Corpus embeddings are not regenerated for that comparison.

## Pilot — 256 chunks, 2 shards, `%LOCALAPPDATA%\Sinbad\semantic-index\pilot-256`

| Check (directive point 3) | Result |
|---|---|
| **chunk ↔ vector identity** | Row *r* of shard *s* is chunk id *s*·128 + *r* in the order `lexical-retriever.build()` gives; every row carries the SHA-256 of the exact chunk text; a reader that finds another hash refuses the index. |
| **deterministic mapping** | 8 stored vectors, spread over the pilot, were embedded again in a **new process after a fresh model load**: minimum cosine **1.000000**. Cold embeddings are identical whether sent alone or in a batch (max abs difference 0). One caveat was measured: embedding the *same* text twice in a row differs in the last digits (max abs difference 0.0045, cosine 0.9997) — Ollama's prefix cache; it cannot occur in a build, where every chunk is different, and the rebuild check therefore compares cosines (≥ 0.999), not bytes. |
| **RAM / commit** | builder RSS peak **1.48 GB**; model resident about 2.1 GB; free physical memory stayed at 11.3–11.6 GB. |
| **index size** | 4 096 bytes per chunk (1024 × float32) → **354 MB** for 90 539 chunks, plus about 6 MB of shard metadata. |
| **throughput** | 183–199 tokens/s = **0.154–0.173 chunks/s** with 8 of 16 threads. The chunks are fixed 2 800-character windows and cost 820–1 190 tokens each. 16 threads, a larger batch, a smaller context and 3 parallel requests were measured too: 206–258 tokens/s — no setting changes the order of magnitude. |
| **resume** | Run 1 stopped by its time budget after shard 0 (exit 3). Run 2 was **killed mid-shard** (5 of 32 requests done): the directory was byte-identical afterwards, no partial file. Then a bogus `shard-00001.f32` without its `.json` and a leftover `.json.tmp` were planted. Run 3 skipped shard 0 (file hash unchanged), rebuilt shard 1 to the right size, replaced the leftovers, verified, exit 0. |
| **rebuild safety** | Pointing the builder at the pilot directory with another scope: `MANIFEST_MISMATCH … Nothing was changed`, directory digest identical before and after. An output directory inside the repository: refused. |

## Projected runtime of the full build — the decision

| Setting | Measured rate | 90 539 chunks |
|---|---|---|
| 8 threads (half the cores free) | 0.154–0.173 chunks/s | **145–163 hours** (6–7 days) |
| 16 threads (machine saturated) | 0.20–0.30 chunks/s | **84–126 hours** (3.5–5 days) |

Continuous CPU load on a working laptop for days, during which the 14B model behind the bridge answers more slowly. The build is safe to interrupt at any moment (at most one shard, about 12 minutes, is lost) and yields to other Ollama use, so it can run in the background of normal work — but it is the Owner's machine and the Owner's call. Options:

1. **Run the full build as authorised**, from the Owner's own terminal (a job of several days should not depend on an engineering session):
   `node --max-old-space-size=4096 tools/build-semantic-index.js --out-dir "%LOCALAPPDATA%\Sinbad\semantic-index\qwen3-embedding-0.6b-full" --threads 8`
   Re-running the same command resumes. `--threads` may be lowered; it cannot exceed half the cores.
2. **A smaller honest corpus first.** Embed a defined subset (for example the documents of the regulatory core: conventions, codes, flag and class documents — not the exam question banks) and measure DEV on that subset for lexical, semantic and hybrid alike. Cheaper, but it answers a narrower question and must be labelled as such.
3. **Other hardware.** The builder is not tied to this machine and the vectors are portable files, so the index could be built where a GPU is available. How much faster that would be was **NOT MEASURED**; nothing of the kind was used or assumed.

Nothing else of this phase can be measured before an index exists: DEV (lexical-only, semantic-only with RAW and INSTRUCTED queries, simple hybrid), the choice of the hybrid rule, the new blind set TEST-3 and its preregistration package all follow the build. TEST-3 will not be run without a separate Owner GO.

## Owner acceptance

NOT RECORDED.
