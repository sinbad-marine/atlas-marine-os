# ARGOS Bridge activation preparation

Decision: REVISE. This document records read-only discovery and a proposed cutover checklist. It does not authorize or perform restart, startup changes, execution permissions or release.

## Observed runtime identity

- Listener: `127.0.0.1:31983`, PID `4744` at inspection.
- Process: `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`.
- Process creation: `2026-09-02T01:39:06.114112+03:00`.
- OS-reported `-File` target: `C:\Users\ASUS\Documents\Codex\2026-08-07\s\work\atlas-navigation-academy-publish\bridge\sinbad-bridge.ps1`.
- No arguments followed the script target in the observed command line.
- That on-disk script is 18,869 bytes; last-write UTC `2026-08-09T14:14:37.832097Z`.
- Observed on-disk SHA-256: `0993e1750c9c739968c0b83ad6f786272b13a634db2be9b421105bfe5a24a0b2`.
- Its repository HEAD is `865ea8d20446f1ad01cc293f07dccc8407a3e418`, but the script has local modifications. HEAD alone is NOT a rollback artifact.
- The inspected script contains neither `/argos/status` nor `ArgosBridgeCommandVersion`.
- A live read-only GET to `/argos/status` returned HTTP 404.

The command line establishes the launch path. The file hash establishes the bytes on disk at inspection, not a cryptographic measurement of the already loaded process. The old file's timestamp predates process creation, which is consistent with the diagnosis but is not an attestation. Revalidate PID, launch path and hashes immediately before any future cutover.

## Persistent startup mismatch

The existing shortcut was read without saving or modifying it:

- Shortcut: `C:\Users\ASUS\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Sinbad Bridge.lnk`.
- Target: `C:\Windows\System32\wscript.exe`.
- Arguments: quoted `C:\Users\ASUS\Documents\Codex\2026-08-07\s\work\atlas-navigation-academy-publish\bridge\start-sinbad-bridge-silent.vbs`.
- Working directory: the same old project's `bridge` directory.

Consequently, merely editing the current project cannot update this running service. Changing only the current process would also leave the old startup target in place for the next sign-in. No shortcut was changed during this preparation.

## Current candidate is not yet a release artifact

Current workspace Bridge path: `C:\Users\ASUS\Documents\Codex\2026-08-10\gu\sinbad-ai-core\bridge\sinbad-bridge.ps1`.

Observed candidate SHA-256: `667d668cbbb1a06eb48a3639d52231640279096460f4aeaa96aede79a6a71bfe`.

The current workspace is mixed and uncommitted. Do not start it as a reviewed release or copy just the Bridge script to the old directory. It references additional relative dependencies including `qwen-tier-router.ps1`, `xtts-worker.py`, `opencpn-rest-client.js`, the visual-library query script and the Studio acceptance manifest. Review the complete dependency set and differences before packaging.

## Required cutover checklist — not executed

1. Prepare a narrowly scoped reviewed candidate with a complete dependency manifest, exact hashes and parse checks. Preserve unrelated work and original visual baselines.
2. Preserve the exact previous script, launcher and shortcut plus launch configuration as rollback evidence; verify copies before any replacement. Do not substitute its dirty repository HEAD. No credentials or user library contents belong in the artifact.
3. Test the candidate with isolated temporary data and stubbed model/device side effects. Do not point a second candidate at live library, voice or OpenCPN state. Cover HTTP command rejection before any side effect, as well as positive read-only status checks.
4. Resolve authenticated Owner/operation approval separately. The existing public ARGOS envelope is not authentication; a status endpoint is not proof of authorization. Do not broaden permissions to make tests pass.
5. Obtain explicit approval for the identified service interruption and startup-target update. Ensure pending operations are not interrupted blindly. There is no restart approval in the current task.
6. Only then cut over to the verified candidate and update the startup shortcut to that same candidate. Verify fresh runtime identity, read-only health, request denial and existing supported functions. Do not consider HTTP 200 alone sufficient.
7. If validation fails, use the preserved prior artifact and shortcut configuration under the approved rollback plan. Do not restore databases or overwrite user files as part of rollback.

## Isolated review package — 2026-09-03

Added `tools/argos-bridge-candidate.js`. It creates a new uniquely named temporary review directory with nine explicitly allowlisted source/test files, byte lengths, SHA-256 hashes and `REVIEW-MANIFEST.json`. It does not bundle user data, credentials, models, Python environments or OpenCPN configuration, nor install or execute the Bridge. Its status is deliberately `SOURCE_SNAPSHOT_NOT_DEPLOYABLE`; no activation or execution authority is granted. The manifest is a local inventory, not a signature or release approval.

Created package: `C:\Users\ASUS\AppData\Local\Temp\argos-bridge-review-AWFjYp`. Temporary storage may be cleared by Windows; rebuild with `node tools/argos-bridge-candidate.js` when needed and review new hashes. The selected relative dependencies are included for inspection, not a certified complete runtime distribution.

Added `tests/argos-bridge-http.test.js` with `tests/fixtures/argos-http-isolation.ps1`. The fixture parses the actual Bridge source, extracts its HTTP parser, origin check, ARGOS admission and ARGOS GET-status branch, and serves only that slice on a system-assigned loopback port. It never dot-sources full Bridge startup. Model status is stubbed and admitted commands only increment an in-memory sentinel. The test stops only its own child process. PowerShell's execution-policy override is confined to that test child; no machine or user policy is changed.

Verified over actual HTTP: missing envelopes on all seven registered POST paths; unknown path; target mismatch; malformed ID/time; stale time; untrusted origin; replay rejection; positive sentinel control; read-only ARGOS status. Rejected commands never reach the sentinel. This is a real HTTP test of an extracted source slice, NOT a full live Bridge or downstream execution test, and does not establish Owner authentication. Request-size limits and resource-exhaustion behavior are not covered.

The three targeted packaging/HTTP tests passed. The HTTP test also passed when run from the generated package, and packaged PowerShell files parsed without errors. Integrity verification passed for 60 protected files. Full verification: `npm test` reported 1,920 passed, one skipped and zero failures (1,921 total); `npm run test:web` reported 112 passed. Logs: `tmp/argos-package-unit.log` and `tmp/argos-package-web.log`. Approved visual baselines were unchanged. No existing service, startup shortcut or user data was modified.

## Request framing hardening and Owner boundary — 2026-09-03

The candidate Bridge now validates Content-Length (one numeric, representable header), rejects unsupported Transfer-Encoding, applies byte limits before allocating buffers, and performs ARGOS admission before waiting for a POST body. Incomplete bodies are rejected rather than passed to handlers. Limits are 8 KiB for `/ai/tts`, 8 MiB for `/library/ingest`, and 2 MiB for other paths. These are new candidate compatibility limits; callers exceeding them receive 413 and must split or reduce their request. No live service was activated with these limits.

The isolated HTTP test covers invalid/overflow/negative lengths, oversized requests, duplicate Content-Length, unsupported chunked encoding and incomplete bodies, with a subsequent positive sentinel proving continued operation. One intermediate package test reported ECONNRESET; the unsupported-transfer case was changed to a raw HTTP request so Node does not automatically send chunked body bytes while the server rejects framing. The regenerated package test passed. Current review package: `C:\Users\ASUS\AppData\Local\Temp\argos-bridge-review-cTaq4z`. Earlier snapshots remain historical and must not be treated as current candidates.

Owner authorization analysis: `founder-owner-mfa.js` and `supabase/functions/founder-owner-step-up/index.ts` provide a separate cloud MFA/step-up path. Bridge currently neither verifies that principal nor consumes an operation-bound grant. ARGOS request headers remain public framing/replay metadata. Connecting these systems requires an authenticated, revocable, operation/body/session-bound verification and consumption path; neither a browser boolean nor a copied grant/hash is sufficient. This revision does not change Owner roles, add cloud credentials to Bridge, enable Chief execution, or claim that the authentication gap is fixed.

Remaining parser limitations include slow-client/total request deadline handling and complete HTTP protocol hardening. This targeted change is not a comprehensive firewall, penetration test or complete runtime certification.

Final framing verification: `npm test` passed 1,920 tests with one skipped and zero failures; `npm run test:web` passed all 112 tests. Integrity passed for 60 files. Logs: `tmp/argos-framing-unit.log` and `tmp/argos-framing-web.log`. Existing services were not restarted. The latest candidate Bridge hash is `a0ab4de78992170bc60486fe8384e037e4aa2a05c3996e03280dd58f41c31d90`; the earlier candidate hash in the runtime-discovery section is historical.

## Scope and evidence limits

No existing service was stopped, restarted or reloaded. No startup configuration, runtime permissions, database, secrets, Git remote or live website was changed. Runtime discovery used OS process/shortcut metadata, file reads/hashes and an HTTP GET. New tests used isolated child processes and temporary files. This narrows the earlier unknown launch-path question; live loaded-byte attestation, full downstream HTTP denial testing, authenticated approvals and release readiness remain unresolved.


## Total request-read deadline - 2026-09-03

The candidate now starts one monotonic Stopwatch per accepted connection and uses a 10,000 ms budget across header and body reads. Before each blocking read, the remaining budget becomes the stream timeout. Continued trickle traffic cannot renew the budget. Deadline/read-timeout rejection returns HTTP 408 with BRIDGE_REQUEST_DEADLINE_EXCEEDED and closes that connection before downstream dispatch.

Header parsing now requires the complete CRLF terminator before accepting a request. Incomplete headers return 400; the existing 64 KiB header limit returns 431 when reached before the deadline. Invalid request lines return a stable 400 code instead of leaking a parser exception. These are candidate compatibility changes: slow uploads must finish request transfer within ten seconds. This is not a timeout for AI generation or an overall bound on downstream handlers or response writes.

The isolated test sends header bytes and body bytes every 200 ms, below the old per-read idle timeout. Both connections are rejected within the absolute deadline, and a following valid request increments only the expected sentinel. Rejected slow requests never reach the sentinel. The fixture still extracts only the real parser/gate/status slice, not the entire Bridge runtime, and uses its own temporary loopback listener. No existing service or startup shortcut was changed.

New review snapshot: `C:/Users/ASUS/AppData/Local/Temp/argos-bridge-review-BwDKMc`. Status remains SOURCE_SNAPSHOT_NOT_DEPLOYABLE. Candidate SHA-256: `2e6cbb776d3b7bdbc1e7675ec11ed14b6e864ee877406b46f9038e65c58828d2`. Previous candidate hashes and package paths above are historical. Owner authorization, full downstream certification and live activation remain unresolved.

Deadline verification note: the first complete unit run reported two failures in older source-text admission tests because they assumed LF while the PowerShell file used CRLF. The test input now normalizes CRLF to LF; the same gate-order and status-redaction assertions remain. All eight related tests passed afterward. The new HTTP test also passed from the generated package. The browser suite passed all 114 tests; the complete unit suite is being rerun after normalization.

Final deadline verification: npm test passed 1,933 tests with one skipped and zero failures (1,934 total); npm run test:web passed all 114 tests. Integrity verification passed for 64 protected files. Final logs: tmp/argos-deadline-unit-final.log and tmp/argos-deadline-web.log. The source package HTTP test passed independently. No live Bridge restart, startup edit, Owner authorization activation or deployment occurred.
