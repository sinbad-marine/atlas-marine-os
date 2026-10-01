# Project 2 — Phase 4.3a, the client-side replay shadow: consolidated record and A5 readiness

Status: documentation and state only (step **A4**). Nothing here is Owner-accepted, nothing here authorizes a capture.
Base: `origin/main` `699ae471ea25c9dcb61f81bc9849f24aa0e4b5b8`. Built as SINBAD **TASK-9** through the accepted Participation Gate (opened, preflight PASS, delegated, then written; the result is ingested back through the gate). Owner GO: "Phase 4.3a A4 için GO veriyorum".

**Read this first.** No call to `sinbad-answer` or any cloud endpoint has ever been made for Phase 4.3a, no credential has been used, and no capture exists. Everything below that says "works" means "proven on synthetic data and a loopback mock". How the real function answers is unmeasured.

## 1. Where Phase 4.3a stands

Design: `PHASE_4_3_SHADOW_DESIGN_PROPOSAL.md`, option A (client-side replay shadow: zero production change, the Owner's own requests, evaluation offline, only an aggregate report may later enter the repository).

| Step | What | PR / SINBAD task | Merged as | Acceptance record | Lifecycle |
|---|---|---|---|---|---|
| A1 | response mapper: one captured response to Draft Adapter v0 input | #311 / TASK-1 | `44fd1f34…` | `docs/participation/TASK_1_OWNER_ACCEPTANCE.json` | COMPLETED, RETROACTIVE |
| A2 | capture evaluator: a directory of captures to one privacy-safe aggregate report | #315 / TASK-5 | `3a2c55b7…` | `docs/participation/PHASE_4_3A_A2_OWNER_ACCEPTANCE.json` | COMPLETED, forward |
| A3 | guarded capture client for `sinbad-answer` | #317 / TASK-7 | `7119be15…` | `docs/participation/PHASE_4_3A_A3_OWNER_ACCEPTANCE.json` | COMPLETED, forward |
| A4 | this document and the Project 2 state entry | TASK-9 | (this PR) | none | not yet |
| A5 | the real capture run | not started | — | — | HOLD |
| A6 | aggregate report into the repository, state sync | not started | — | — | HOLD |

Exact commits, trees and ledger event hashes are in `docs/project2/PROJECT2_STATE.json` (`phases.phase_4_3a_replay_shadow`) and in the acceptance records.

## 2. The flow

```
Owner terminal                                              Owner's machine, outside the repository
  capture client (A3) --one call per gold prompt--> sinbad-answer (cloud)
        |  writes sinbad-shadow-capture-record/0-v1, one file per prompt
        v
  capture directory  (private-library titles and answer text: NEVER in the repository)
        |
        v   offline, no network
  evaluator (A2): A1 mapper -> Draft Adapter v0 -> Offline Chain v0 -> scoring v1.0.1 / v1.0.2 / v1.0.3
        v
  ONE aggregate report (counts, enumerations, public gold item ids)  --- Owner reads it --->  A6 (separate GO)
```

The gate runs on the captured answer offline; nothing is delivered, labelled or blocked for any user.

## 3. What A4 checked offline (evidence)

A dry run of the A3 client against a placeholder loopback address (no network call, nothing written, the output directory was not created):

- gating prompt set: **30 calls would be made**; envelopes built and accepted by the server's own validator for all 30 (**0 invalid**); the server's core decision would answer **0** of them without running the model; languages: 29 English, 1 Turkish.
- with the maritime-reasoning slice: **36 calls**, 0 invalid envelopes, 0 predicted early exits.
- item ids (gating): CI-01 CI-02 CI-03 CI-04 CI-06 CI-07 SS-01 SS-02 SS-03 SS-04 SS-05 SS-10 CT-01 CT-02 CT-03 CT-04 CT-05 CT-10 PC-01 PC-02 PC-03 PC-04 PC-05 PC-06 HL-01 HL-02 HL-06 HL-07 HL-08 HL-16.

This shows the request side is well-formed and the prompt set is complete. It says nothing about what the function answers.

## 4. A5 readiness package

A5 is the first step that touches a live system. It needs the Owner's decision on each item below; none is decided here. The recommendation is the engineer's, for the Owner to accept, change or refuse.

| # | Owner decision | Recommendation | Why |
|---|---|---|---|
| 1 | **Call ceiling** | 36 (the 30 gating prompts plus the 6 maritime-reasoning prompts) | the maritime class holds 12 of the 28 baseline failures and this is the first look at it with passages; cost grows by 20%. Choose 30 to stay on the gating set only. |
| 2 | **Approve a one-off cloud usage** | approve only with a stated ceiling | the Project 2 cloud policy says "No new recurring cloud-model usage in Phase 2"; this is a single run of at most 36 calls, not recurring. |
| 3 | **Whose credentials** | the Owner's own owner/developer member session | the function returns sources only to `owner` and `developer` members; any other role is refused by the client and stops the run. |
| 4 | **Who runs it** | the Owner, in the Owner's terminal | the client reads the credentials from the environment; they should never be pasted into a chat or handed to an agent. |
| 5 | **Where captures live and for how long** | outside the repository (for example `%LOCALAPPDATA%\Sinbad\shadow-captures\<run>`), deleted once the Owner has read the report | they hold private-library titles and answer text. |
| 6 | **What may enter the repository afterwards** | the aggregate report only, after the Owner has read it, in a separate PR (A6) | the report carries no title, answer text, document id, workspace id or capture id. |

### Runbook (once the Owner has decided)

1. Set the environment in the Owner's terminal: `SINBAD_SUPABASE_URL`, `SINBAD_SUPABASE_PUBLISHABLE_KEY`, `SINBAD_ACCESS_TOKEN` (a fresh session token), `SINBAD_WORKSPACE_ID`.
2. Dry run: `node tools/capture-sinbad-answer.js --out <dir outside the repo> --max-calls 36 --include-maritime`. Check 36 calls, 0 invalid envelopes, the target host is the intended project.
3. Run: add `--execute --confirm-cloud-calls 36`. Per-call latency is unmeasured (the function retrieves and then calls a model); the default spacing is 1.5 s and the default per-call timeout is 120 s, so a run of 36 calls can last well over an hour in the worst case; start it with a fresh session token.
4. Evaluate: `node tools/evaluate-shadow-capture.js --captures <dir> --out <report outside the repo>`.
5. The Owner reads the report. Only then, a separate GO may copy the aggregate report into the repository (A6).

### Stop conditions (built into the client; the run ends and the triggering record is kept)

HTTP 401/403 (credentials rejected), HTTP 429 (rate limit), a response whose `sourceAccess` is not `privileged` (the caller is not an owner or developer member), three consecutive failures. There is **no retry** and **no resume**: records are created exclusively and a second run needs a new `--run-id`; the evaluator keeps the first capture per prompt and counts the rest as duplicates. A session token that expires mid-run ends the run at that point (401); start with a fresh token.

### Facts that are NOT VERIFIED, and how each gets checked

| Fact | Status | How it gets checked |
|---|---|---|
| the production library holds the ISM / ISPS / MLC sources the gold sets were built from | NOT VERIFIED | the first captures: a low share of claims with markers, or many refusals, would say so; a read-only Owner query can confirm before the run |
| the deployed function equals the repository copy (`supabase/functions/sinbad-answer`) | NOT VERIFIED | compare the deployed version in the Supabase dashboard with the repository copy before the run |
| how often the production model writes `[S#]` markers | NOT VERIFIED | this is the finding A5 produces |
| real latency, cost, rate limits | NOT VERIFIED | the capture records carry `latencyMs`; check the provider usage pages before and after |
| the model behind the function (`OPENAI_MODEL`, default `gpt-5.6-terra`) | NOT VERIFIED | read the deployed function configuration |
| the evaluator on real captures | proven on synthetic captures only | the first real report |

## 5. Limits that stay true

Identity-only content hashes (the response carries no passage text); a citation proves existence, not support; the gold prompts are not real user traffic; non-privileged responses carry no sources and are never gated; the report is not a threshold, not a D6 decision and not an acceptance.

## 6. What SINBAD can do after this phase that it could not do before

Before: SINBAD had three accepted offline Phase 4.3a steps but no single record of where the replay stands, no Project 2 state entry for it, and no consolidated statement of what the Owner must decide before a real capture.
After: SINBAD holds one consolidated record, a Project 2 state entry that points at the accepted steps and their evidence, and an A5 readiness package (decisions with recommendations, runbook, stop conditions, unverified facts) so a real capture can be authorized or declined on a complete picture. It still cannot capture anything by itself and has captured nothing.

## 7. Holds

A5 and A6 and Engine Room stay on HOLD. This step changes no code and no accepted component, calls no cloud endpoint, uses no credential, records no acceptance; the only state change is the `phase_4_3a_replay_shadow` entry in `PROJECT2_STATE.json`, which points at existing acceptance records.
