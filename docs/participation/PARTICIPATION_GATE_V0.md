# SINBAD Active Participation Gate v0

Status: implemented, tested, **not** Owner-accepted. Nothing here records an acceptance.
Base: `origin/main` `e058d2cff12c0b4d86bf53cbaf921b542d22e908`.

## What it is

The first operational loop in which SINBAD (its deterministic core, not a model) owns a development task from the Owner's instruction to the Owner's summary:

```
OWNER -> SINBAD TASK -> PREFLIGHT -> DELEGATION RECORD -> AGENT
      -> RESULT PACKET -> SINBAD INGESTION / VERIFICATION / MEMORY -> SINBAD OWNER SUMMARY -> OWNER
```

It is a record keeper, a gate and a verifier. It does **not** start agents, plan work, write code, call a model or the cloud, write to GitHub, push, merge or open pull requests. The agent step is still carried out by a person giving the agent its assignment and handing back its report.

Files: `sinbad-ai-core/participation/{participation-v0,index}.js` (pure logic, no I/O), `tools/sinbad-participation.js` (command surface, persistence, read-only git), `tests/sinbad-participation-v0.test.js`, this document.

## Commands

| Command | What SINBAD does |
|---|---|
| `open --order order.json` | Validates and records a WorkOrder **before** any delegation. Agents do not open orders; they receive a `taskId` and a bounded assignment. |
| `preflight --task ID` | Observes the repository (local git only) and records a PASS or FAIL decision. Fail closed. |
| `delegate --task ID` | Only after a fresh PASS preflight bound to the observed head and the order's file list. Prints the bounded assignment. A refusal is recorded too. |
| `ingest --report report.json` | Validates an AgentReport against the exact schema, verifies what git can show, labels every claim. |
| `summary [--out file]` | Owner Work Summary, generated from the stored chain only. |

Options: `--root <ledger dir>`, `--repo <repository>`, `--base-ref <ref>` (default `origin/main`). Exit codes: 0 done, 2 refused or failed a check, 3 ledger invalid, 1 usage or other error.

## Storage (engineering memory)

The ledger is the existing ARGOS event shelf (`sinbad-ai-core/argos-event-shelf.js`, hash-chained, append-only, used unmodified) plus content-addressed bodies `bodies/<sha256>.json` created exclusively (`wx`). The event's `evidenceHash` is the body's hash. Default location: `%LOCALAPPDATA%\Sinbad\participation-ledger` (outside the repository). The tool refuses a root inside the repository, containing it, on a `.git` or `.argos-runtime` path, or not absolute. Secret-looking strings (keys, tokens, JWTs, `password=...`) are refused before anything is written; a rejected report is stored as its sha256 and error list only.

Every read re-walks the chain and re-hashes every body. A broken chain, a missing body, a tampered body or an event written by another actor fails closed (`LEDGER_INVALID`). The chain, not chat, is what the summary reads.

What is persisted: from the WorkOrder - context, plan, decisions, rejected alternatives, Owner statement, agent, branch, base SHA, expected files, capability before and after; from each preflight - the observed head, the file-list hash, every check; from each delegation - the bound preflight and the assignment; from each AgentReport - actions, failures, evidence, tests, result, lessons, decisions, rejected alternatives, capability gained, and the per-claim verification.

## Preflight (fail closed)

A task is refused unless all hold: valid WorkOrder (exact keys, safe relative paths, explicit expected files, capability delta present); not on HOLD; observation available; `baseSha` equals the observed head and exists; no EXACT or directory-PREFIX overlap (case-insensitive) with any task that still claims paths (not closed, not HOLD, and either opened earlier or already delegated); no dirty path of the worktree inside the expected scope. A missing observation is FAIL. The PASS is bound to the observed head SHA and the hash of the expected-file list; `delegate` re-observes, requires the same head, a preflight no older than 60 minutes, and re-evaluates every rule against the current ledger.

## Ingestion and provenance labels

Labels: `VERIFIED`, `UNVERIFIED`, `CONTRADICTED`. Nothing is promoted.

- VERIFIED or CONTRADICTED only for what SINBAD observed in git: the resulting commit exists, the base is its ancestor, the changed files equal the observed diff, the branch tip equals the result, and every observed file is inside the expected scope.
- An out-of-scope observed change is a `SCOPE_BREACH` (task state BREACHED, fail closed), whether or not the agent reported it.
- Identity fields (task, agent, base, branch) are labelled UNVERIFIED even when they match: a match shows the report repeats SINBAD's record, not who wrote it. v0 has no agent authentication.
- Test claims are `AGENT_REPORTED_PASS` / `_FAIL` / `_NOT_RUN` and stay UNVERIFIED. A test becomes a VERIFIED PASS only with independent evidence bound to the resulting commit from an allowed source; v0 tooling supplies none, so in practice no test is ever VERIFIED.
- Every other assertion (actions, failures, evidence, lessons, result, capability gained) is UNVERIFIED.
- Missing fields are never filled in: an incomplete report is rejected and recorded as rejected.
- If git cannot be observed the report is not accepted and the task stays DELEGATED.

## Owner summary

Deterministic (same ledger, same bytes), no model, no clock. Sections: VERIFIED FACTS, UNVERIFIED AGENT CLAIMS, CONTRADICTED CLAIMS, SCOPE / PREFLIGHT ISSUES, DECISIONS, REJECTED ALTERNATIVES, FAILURES, LESSONS, OPEN RISKS, SINBAD CAPABILITY DELTA. Each line names the event it came from; every pointer-backed line equals the stored body value at that pointer; derived lines (for example a task's state) are marked as derived. Anything not stored is rendered `NOT RECORDED`.

## Capability delta

Every WorkOrder (phase or task) must state `sinbadCapabilityBefore` and `sinbadCapabilityAfter` (different, non-trivial); every AgentReport must state `capabilityGained`. A report without it is rejected, so a task cannot close cleanly without recording what SINBAD itself gained.

## Bootstrap honesty

The construction of this mechanism is **BOOTSTRAP TASK #0**. Claude implemented the mechanism before it existed; it was not work performed by SINBAD. It is recorded afterwards with origin `RETROACTIVE_BOOTSTRAP` and that limitation written into the order. A retroactive order skips preflight and delegation because they did not happen, and the summary shows both as `NOT RECORDED`. This is not a dogfood claim.

## Known limits

- The shelf detects edits, reordering and deletion in the middle of the chain, but **not deletion of the newest events** (there is no later record to contradict it). Anchoring the head hash outside the ledger is a later step.
- Agent identity is asserted, not authenticated (no attestation keys in use). Opening an order is procedurally the Owner's act through SINBAD; a process that can run the command can still run it.
- Report transport is manual. There is no agent execution, no scheduling, no retry.
- Overlap is checked against registered tasks and the local worktree only. A branch that was never registered as a task is invisible to it.
- Tests are not independently verified in v0 (no rerun, no CI ingestion).
- Observation needs `git` and a resolvable `--base-ref`; run `git fetch` first if a fresh remote head matters. The tool never fetches.
- The new files are not on the ARGOS protected list; the ledger's integrity is its own chain, not ARGOS.

## What SINBAD can do after this phase that it could not do before

Before: SINBAD kept no record of development work; task ownership, engineering memory, overlap checks and agent results lived in chat and in GitHub.
After: SINBAD records a task before delegation, refuses unsafe parallel work, keeps decisions, rejected alternatives, failures, evidence and lessons in a tamper-evident chain, ingests an agent's result against git with explicit provenance, and gives the Owner a summary in which every line resolves to stored evidence.

## Holds

Engine Room and Phase 4.3a stay on HOLD. This gate touches neither; no Engine Room file, `PROJECT2_STATE.json`, `app.js`, `package.json`, ARGOS policy or accepted Project 2 component was changed.
