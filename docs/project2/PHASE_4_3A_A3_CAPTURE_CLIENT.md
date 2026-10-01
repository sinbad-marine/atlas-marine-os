# Project 2 — Phase 4.3a, step A3: capture client for `sinbad-answer`

Status: implemented and tested against a **local loopback mock only**; **not run against the cloud, not Owner-accepted**. Nothing here records an acceptance.
Base: `origin/main` `8f9148efd57b525121230fd5b1fde05957281c67`. Built as SINBAD **TASK-7** through the accepted Participation Gate (opened, preflight PASS, delegated, then implemented; the result is ingested back through the gate). Owner GO: "Phase 4.3a A3 için GO veriyorum".

## What this GO covers, and what it does not

Covered: **building and testing** the client. Not covered: **running** it. No call to `sinbad-answer` or any cloud endpoint was made, no credential was used, nothing was captured, no cost was incurred. A real run is Phase 4.3a **A5** and needs its own Owner decision: the call ceiling (the Project 2 cloud policy says no new recurring cloud-model usage; this would be a one-off of at most 30–36 calls), whose credentials, and who runs it. Nothing in the repository starts the client: no npm script, no workflow, no other tool or test (a test checks this).

## What it is

The Owner-run half of the replay shadow. It sends the fixed gold prompt set (the 30 gating items of the stage-gate subset; the 6-item maritime-reasoning slice with `--include-maritime`) **once each** to the cloud function and stores one capture record per prompt, in the format `sinbad-shadow-capture-record/0-v1` that the A2 evaluator reads, in a directory **outside the repository**. The request is the one the web app sends: `{workspaceId, question, language, coreEnvelope}`, with the envelope built by `SinbadCore.aiEnvelope` and checked by the server's own `validateCoreEnvelope` before anything is sent; no `allowWebSearch`, no visual options.

Files: `sinbad-ai-core/shadow/capture-client.js` (pure: configuration checks, request building, record building, the sequential run loop, abort rules; every effect injected), `tools/capture-sinbad-answer.js` (environment, arguments, the real HTTPS transport, the exclusive file writer), `tests/sinbad-shadow-capture-client.test.js`, this document. The A1 mapper, the A2 evaluator, the Draft Adapter and the Offline Chain are used unchanged and pinned by hash in the test.

## Usage (for A5, once the Owner authorizes it)

```
set SINBAD_SUPABASE_URL=https://<project>.supabase.co
set SINBAD_SUPABASE_PUBLISHABLE_KEY=...
set SINBAD_ACCESS_TOKEN=...            (a user JWT of an owner or developer member)
set SINBAD_WORKSPACE_ID=...

node tools/capture-sinbad-answer.js --out <dir outside the repo> --max-calls 30                     # DRY RUN, the default
node tools/capture-sinbad-answer.js --out <dir outside the repo> --max-calls 30 --execute --confirm-cloud-calls 30
node tools/evaluate-shadow-capture.js --captures <that dir> --out <report outside the repo>          # then A2
```

The dry run is the default: it validates the configuration, builds and checks every envelope, predicts which prompts the function would answer without running the model (the server's core decision), prints the plan, and makes **no network call and writes nothing**. A real run needs `--execute` and `--confirm-cloud-calls` equal to `--max-calls`.

## Guards (all in code, all tested)

- **Host allowlist.** Only `https://<project>.supabase.co` (no port, no path, no credentials in the URL), or loopback `http` with an explicit port (tests and local rehearsal). The token can never be sent to another host.
- **Ceiling.** `--max-calls` is mandatory (1–36). A ceiling smaller than the prompt list is **refused**, never silently truncated.
- **One call per prompt, strictly sequential, spaced (default 1.5 s), no retry of any kind**, no web search.
- **Stops** on HTTP 401/403, 429, a response whose `sourceAccess` is not `privileged` (the caller is not an owner or developer member, so there would be no sources), or three consecutive failures. The record that triggered the stop is written first.
- **Credentials** are read from the environment, exist only inside the transport call, and are never printed or stored. Anything stored from a failure is scrubbed of them; a response that echoes the token or key, or contains a secret-looking string, is **withheld** (the record keeps the status and an error code, not the body).
- **Output** must be outside the repository; records are created exclusively (`wx`), never overwritten; a failing write stops the run.
- **Fixed failure codes.** Transport failures are reduced to constants (`TIMEOUT`, `CONNECTION_FAILED`, ...); no raw error text can carry a header.

## Limits

- It has only ever talked to a loopback mock written for the tests. How the real function answers, how often the model writes `[S#]` markers, the real latency and cost are unmeasured until A5.
- The server's rate limits and the exact cost of ~30 calls with up to eight 2,200-character passages each are not verified.
- It captures what a **privileged** caller sees; restricted (non-privileged) responses carry no sources and stop the run.
- The prompt set is the gold prompts, not real traffic.

## What SINBAD can do after this phase that it could not do before

Before: SINBAD could evaluate captured `sinbad-answer` responses offline but had no way to take a capture: nothing wrote the capture records.
After: SINBAD has a guarded capture client that, once the Owner authorizes a run, takes one capture per gold prompt in the evaluator's format with no retries and no stored credentials, proven end to end against a local mock including the A2 evaluator reading its output. Nothing has been captured and no cloud call has been made.

## Holds

Phase 4.3a **A4–A6** (documentation/state of the replay, the real capture run, the aggregate report in the repository) and Engine Room stay on HOLD. No cloud call, no credential use, no production change, no wiring, no Owner acceptance recorded; `PROJECT2_STATE.json`, Engine Room files, `app.js`, `package.json`, the ARGOS policy and the accepted Participation Gate files are unchanged.
