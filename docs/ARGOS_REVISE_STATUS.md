# ARGOS REVISE preparation - 2026-09-02

## Additional evidence-validation correction

The current follow-up preserves the preceding preparation changes. Health assessment now revalidates serialized observation fields, canonical timestamps, allowed states, evidence hashes and state/reason consistency before evaluating health. Future observations, invalid expiry, excessive TTL, unexpected fields and accessor properties are rejected. Valid JSON round trips remain supported. This is structural and temporal validation, not authenticated evidence provenance or Owner authorization.

Two regression tests cover malformed/future evidence and getter rejection without executing the getter. The focused health/supervisor/recording suite passed all 16 tests. Only the two changed source/test hashes were refreshed in the integrity policy; no UI baseline was changed. Full-suite results for this follow-up are recorded below when available. Existing Bridge remains untouched; its missing ARGOS route is still reported as degraded and health exits 1.

Follow-up verification completed: `npm test` passed 1,917 tests with one skipped and zero failures (1,918 total); `npm run test:web` passed all 112 tests. Browser tests used a separate ephemeral loopback port with server reuse disabled, without stopping or reloading existing services. Logs: `tmp/argos-current-unit.log` and `tmp/argos-current-web.log`. Integrity verification passed for 56 files. No merge, commit, deployment, runtime cutover or Owner authority change was performed.

Decision: REVISE. Preparation changes do not authorize activation, execution or release.

## Implemented

- 2026-09-03 request framing correction: byte caps and unambiguous Content-Length validation now precede allocation, ARGOS POST denial precedes body reads, unsupported transfer encoding and incomplete bodies are rejected. Owner cloud authorization is still not connected to Bridge; no authority was enabled. Regenerated isolated package HTTP tests passed. Full tests: 1,920 passed, one skipped, zero failures; 112 browser tests passed; integrity passed for 60 files. Logs: `tmp/argos-framing-unit.log`, `tmp/argos-framing-web.log`. See the activation preparation document for compatibility limits and remaining gaps.

- 2026-09-03: a nine-file temporary review snapshot and isolated HTTP parser/gate test were added. The packaged test also passed. This is not a deployed or fully integrated Bridge. See `docs/ARGOS_BRIDGE_ACTIVATION_PREPARATION.md`. Latest verification: 1,920 unit/integration tests passed, one skipped; 112 browser tests passed; 60 protected files verified. Live service and startup configuration remain unchanged.

- Health CLI exits nonzero for all results except ARGOS_SYSTEM_HEALTHY, including ARGOS_RELEASE_HEALTH_BLOCKED and unrecognized statuses.
- Readable application files are inventory evidence only. APPLICATION remains UNKNOWN until functional evidence is integrated.
- HTTP health calls have a five-second deadline.
- Bridge health checks /argos/status instead of unrelated /ai/status. A 404 is ARGOS_BRIDGE_ROUTE_MISSING. A fresh, well-formed status remains UNKNOWN until running source identity is independently verified.
- Explicit `npm run health:argos -- --record` connects collected observations to supervisor, persistent per-run shelves and the operations ledger. Missing/degraded evidence opens an incident and finishes FAILED. No incident is automatically acknowledged or resolved as Owner.
- Default health is read-only. Recording creates a new run directory and refuses overwrites or linked ancestor directories. Default storage is `.argos-runtime/health-runs`; ARGOS_HEALTH_LEDGER_ROOT can select a preparation or runner-temporary root.
- Journal entries contain bounded metadata and hashes. The run-start scope hash binds the original observations. The local actor reference is unauthenticated and grants no authority. No external notification is sent.
- Assurance now runs health after tests, including after prior failure unless cancelled, without ignoring health failure. Missing functional, test and release evidence still blocks it. Raw test logs are not trusted health observations. A source-bound evidence producer remains necessary.
- `tools/argos-verify-checkpoint.js` compares an already validated shelf.inspect() result to an independently trusted checkpoint. It detects tail truncation or changed checkpoint history and reports newer unanchored events. It does not authenticate checkpoints, validate arbitrary raw snapshots or provision remote storage. A colocated editable checkpoint is not a trust anchor.
- Only hashes for revised files were refreshed in the integrity policy; new ARGOS sources/tests were added. Unrelated hashes, user assets and approved visual baselines were preserved.

## Runtime evidence

Follow-up discovery established the OS-reported launch path and persistent startup mismatch. The live process runs the separate `2026-08-07/s/work/atlas-navigation-academy-publish/bridge/sinbad-bridge.ps1`, and the Windows Startup shortcut still targets that old project. Its on-disk script lacks ARGOS and is locally modified relative to its own repository HEAD. See `docs/ARGOS_BRIDGE_ACTIVATION_PREPARATION.md` for exact hashes, evidence limits and a non-executed cutover checklist. This supersedes the earlier unknown launch-path finding below, but does not claim measurement of loaded in-memory bytes. No service or shortcut was changed.

A direct no-proxy GET to http://127.0.0.1:31983/argos/status returned HTTP 404. TCP port 31983 was owned by PID 4744, Windows PowerShell, started at local 01:39:06 on 2 September 2026. Its executable was visible, but the loaded script path and source revision were not established. This does not prove which old or alternate commit is running.

A real CLI recording check used tmp/argos-revise2-health, returned exit code 1, and persisted seven health observations, an OPEN incident and a FAILED terminal run. The report is tmp/argos-revise2-health.json. No live Bridge handler, restart, Owner message, credential change, database restore or deployment was invoked.

## Remaining activation gates

1. Establish running Bridge artifact identity and checkpoint its exact source and launch configuration.
2. Bind genuine functional, test and release evidence to the exact source and expiry; do not accept browser claims or hash-shaped strings as authority.
3. Integrate authenticated Owner identity and operation-bound approvals with the execution boundary. The existing Chief Phase 1 contract deliberately disables execution and approval. This revision does not bypass that boundary. A full isolated HTTP side-effect denial harness remains required.
4. Connect authenticated Owner notifications. Sensors, supervisor and the persistent local incident ledger are now connected only in explicit recording mode.
5. Provision independently trusted checkpoints, remote retention and recovery. Verify archive recovery and new-host secret reprovision without plaintext export or live-data overwrite.

## Controlled activation preparation

Do not restart the current mixed, uncommitted checkout as a release. First establish the actual running script and launch configuration, then prepare a narrowly scoped reviewed artifact and its hash. Retain the exact previous artifact and configuration, protect pending operations and obtain the existing required live-service approval before cutover. Verify status and negative HTTP admission cases; roll back to the checkpointed prior artifact if checks fail. Do not restore databases or copy credentials as rollback. The previous loaded artifact is not yet identified, so there is no safely specified restart command.

Release remains restricted to the protected pages-release workflow after required checks. No Phase 2 authority was enabled. Runner-temporary health data is not durable remote retention.

## Verification

First revision: 1,904 npm tests passed, one skipped, zero failed; 112 browser tests passed. Its added isolated Windows gate test passed separately.

Second revision targeted tests passed: CLI exit behavior, actual isolated PowerShell gate, recording persistence, missing/invalid evidence, no overwrite, ARGOS status validation, checkpoint truncation/rewrite detection and workflow ordering. Integrity verification passed for 56 protected files. Synthetic fully healthy observations in tests grant no production authority.

Second revision full results: npm test had 1,915 passed, zero failed and one skipped (1,916 total); npm run test:web had 112 passed, including the approved desktop/mobile visual baselines. These local results are not deployment identity or release approval. Logs: tmp/argos-revise2-unit.log and tmp/argos-revise2-web.log.


## Third revision: historical release evidence - 2026-09-03

`tools/argos-release-evidence.js` is connected to the health CLI when ARGOS_GITHUB_OWNER, ARGOS_GITHUB_REPO and a full ARGOS_GITHUB_REF are configured. It reads GitHub Actions through fixed HTTPS GET endpoints with deadlines and redirect refusal. The assurance workflow adds only actions:read permission; no workflow is dispatched or deployment triggered.

Before and after collection, Git HEAD must match the requested SHA and the checkout must be clean, including untracked files. The current mixed workspace correctly returns RELEASE_CHECKOUT_MISMATCH before network access; it cannot borrow a historical green result for changed local files.

The adapter checks the latest run for the exact SHA and `.github/workflows/pages-release.yml`, same source repository, push event on main, completed success, and freshness within one hour. It deliberately does not filter out failed/newer runs. Incomplete pagination, stale evidence, another repository, wrong SHA, changed attempt and skipped/missing required steps all fail closed. Jobs are fetched for the exact attempt and the run is re-read to detect a concurrent rerun.

Required evidence includes successful build and deploy jobs, integrity, regression, browser, artifact build, manifest attestation, upload and deployment steps. This is GitHub-reported historical execution evidence, not independent cryptographic verification of the attestation or current live artifact. Manual workflow_dispatch releases may use release_ref different from run head_sha, so they remain UNKNOWN until a separate attested-manifest adapter establishes that binding.

Only TEST_SUITE and RELEASE_PIPELINE observations are produced. APPLICATION remains UNKNOWN: historical browser tests do not establish current live application health. Owner authentication, new release authorization, live deployment verification, external retention and host cutover are still outside this adapter. Evidence observations expire after one minute and source executions older than one hour are rejected.

Validation uses real temporary Git repositories and mock GitHub responses, including dirty/ref-mismatched source, wrong repository, stale/manual runs, skipped steps, failed newer runs, incomplete lists, concurrent source changes and reruns, API failures and secret-safe error reporting. The live GitHub integration is not claimed verified in this dirty checkout.

API references: [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs) and [jobs for a run attempt](https://docs.github.com/en/rest/actions/workflow-jobs).

Third revision verification: npm test passed 1,927 tests with one skipped and zero failures (1,928 total). npm run test:web passed all 114 tests. Integrity verification passed for 62 protected files. Logs: tmp/argos-revise3-unit.log and tmp/argos-revise3-web.log. Existing unrelated work was preserved; no service restart, remote workflow run or deployment was performed.


## Fourth revision: nested archive and opt-in retention - 2026-09-03

The archive loader now covers nested health-run shelves instead of omitting them. It rejects malformed/unexpected content, linked paths, empty sources and capacity overflow, rechecks the source snapshot, then reads and authenticates the new archive from disk. CLI errors no longer echo malformed JSON contents.

CI health data now shares the assurance ledger root. An opt-in encrypted retention path is prepared after ledger sealing: it requires the explicit ARGOS_ARCHIVE_RETENTION_ENABLED repository variable and a separately provisioned ARGOS_ARCHIVE_KEY secret. Only verified ciphertext JSON is selected for the pinned upload action, with 30-day retention and overwrite disabled. Neither setting was changed and no upload or secret provisioning occurred.

Actual CLI recovery tests verified all nested records after removal of synthetic source journals and relocation to another temporary directory, with the same memory-generated test key. Wrong/missing keys, tampered ciphertext and unsafe paths failed. This is verification-only recovery, not live journal/database restoration or a host migration.

See docs/ARGOS_RETENTION_RECOVERY.md for the reviewable activation conditions, limits and recovery verification procedure. Independent checkpoints, long-term retention, production key recovery and Owner authorization remain activation gates.

Retention revision verification: npm test passed 1,933 tests with one skipped and zero failures (1,934 total); npm run test:web passed 114 tests. Integrity verification passed for 64 protected files. Logs: tmp/argos-retention-unit.log and tmp/argos-retention-web.log. No golden updates, remote retention activation, key provisioning or live-service changes were performed.


## Fifth revision: Bridge request-read deadline - 2026-09-03

The Bridge candidate now bounds header and body reads with one ten-second monotonic budget, rejects incomplete headers and malformed request lines, and continues serving after slow clients are rejected. Actual isolated HTTP tests drip data every 200 ms and verify a subsequent valid sentinel request. This closes the documented unbounded per-read renewal gap; it does not authenticate Owner, activate the candidate, or bound downstream AI execution/response writes.

See docs/ARGOS_BRIDGE_ACTIVATION_PREPARATION.md for the new review package, candidate hash and compatibility limits. Existing services and startup configuration were not changed.

Deadline verification note: the first complete unit run reported two failures in older source-text admission tests because they assumed LF while the PowerShell file used CRLF. The test input now normalizes CRLF to LF; the same gate-order and status-redaction assertions remain. All eight related tests passed afterward. The new HTTP test also passed from the generated package. The browser suite passed all 114 tests; the complete unit suite is being rerun after normalization.

Final deadline verification: npm test passed 1,933 tests with one skipped and zero failures (1,934 total); npm run test:web passed all 114 tests. Integrity verification passed for 64 protected files. Final logs: tmp/argos-deadline-unit-final.log and tmp/argos-deadline-web.log. The source package HTTP test passed independently. No live Bridge restart, startup edit, Owner authorization activation or deployment occurred.


## Sixth revision: Owner boundary evidence - 2026-09-03

Added executable tests of the real manage-members handler with substituted Supabase transport. Ten focused tests passed, including the existing MFA suite. Identity/MFA failure, changed approval bindings, consumption refusal and reuse stop before member mutation. These tests do not prove deployed Auth or PostgreSQL enforcement. See docs/ARGOS_OWNER_BOUNDARY.md for the connection contract and remaining acceptance evidence. Bridge integration remains unfinished; no live activation occurred. Only tests, documentation and the new test integrity entry changed in this revision. No merge is proposed.


## Seventh revision: explicit request-token MFA - 2026-09-03

Real Supabase SDK tests exposed a defect hidden by the earlier substituted-client tests: parameterless MFA lookup used an empty stored session, rejecting valid AAL2 requests. Both Founder grant issuance and member management now validate Bearer syntax and pass the exact request JWT to user and MFA verification. Edge imports pin the tested Supabase JS 2.112.3 version. The member client disables persistence and automatic refresh. Provider verification remains mandatory.

The new SDK tests substitute only HTTP transport, exercise both real handlers, and cover valid AAL2, AAL1 with a verified factor, Auth rejection including the MFA recheck, malformed credentials and credential separation. No production token, Auth service or database is used. The prior behavior failed both AAL2 positive cases; the corrected behavior passes. Live identity/database verification and the Bridge execution adapter remain open. No deployment, migration, live grant consumption or service restart occurred.


Verification after the stateless SDK correction: npm test passed 1,945 tests, with one skipped and zero failures (1,946 total). All 17 focused Owner/MFA tests passed within that run. Integrity verification passed for 69 protected files. Log: tmp/argos-owner-sdk-unit.log. Browser tests were not rerun for this server-only change; no merge or release is proposed.


## Eighth revision: atomic approval issuance preparation - 2026-09-03

Replaced independent grant/audit inserts with one service-only issue_founder_step_up RPC in a new migration. The database rechecks and locks the active principal, sets the five-minute expiry, and writes grant plus audit in one transaction. The Edge candidate returns a stable error without an approval when issuance fails; no split-insert fallback exists. Eighteen focused Owner/MFA tests passed using actual SDK code and substituted HTTP transport.

A standalone PostgreSQL regression script exercises injected audit failure rollback, binding, expiry, privileges, nonce uniqueness, consumption/reuse and suspended-principal denial. It is prepared but unexecuted: no psql/Supabase CLI or running Docker engine was available. This is a remaining verification gate, not a passed database test. See docs/ARGOS_OWNER_BOUNDARY.md for deployment ordering and limits. No migration, service restart, remote deployment or real grant consumption occurred.


Atomic issuance candidate verification: npm test passed 1,946 tests, with one skipped and zero failures (1,947 total), including all 18 focused Owner/MFA tests. Integrity passed for 72 files. Log: tmp/argos-owner-issuance-unit.log. The PostgreSQL installation directory was also checked: psql, initdb and pg_ctl executables were absent. SQL regression execution remains pending. Browser tests were not rerun for this server-only candidate; no merge or deployment is proposed.


## Ninth revision: local PostgreSQL regression executed - 2026-09-03

The actual issuance/consumption SQL regression passed on PostgreSQL 18.3 via PGlite 0.5.8, installed only in a temporary test prefix with install scripts disabled. The new explicit runner executes the unchanged migration and SQL fixture sources in memory and checks full fixture rollback. Audit-failure rollback, binding, five-minute lifetime, execute privileges, nonce uniqueness, consumption/reuse and suspension assertions passed. Report: tmp/argos-owner-postgres-report.json.

This resolves the earlier unexecuted local SQL test; it does not verify concurrent connections, real Supabase Auth/schema/RLS or deployment. No production database, credential, service startup or Bridge activation changed. The full npm/browser suites were not repeated for the added standalone test runner; the previous full unit results remain historical evidence. Integrity covers 73 files. See docs/ARGOS_OWNER_BOUNDARY.md for reproduction and runtime limits.


## Tenth revision: native concurrency and suspension serialization - 2026-09-03

Native PostgreSQL 18.4 testing with separate service-role connections confirmed exactly-once consumption but reproduced a missing principal lock: the old consumer accepted while suspension already held the Owner row. A new uniquely versioned consumption-lock migration serializes the active-principal check before grant mutation, matching issuance. Original migrations are preserved.

Five native test groups now pass, including both suspension/consumption orderings and absence of mutation/audit on denied consumption. The updated PGlite regression passes too. Reports: tmp/argos-owner-native-before-fix.json, tmp/argos-owner-native-report.json and tmp/argos-owner-postgres-report.json. All test clusters report serverStopped=true. Native packages were installed only in a temporary prefix; no Windows service, real credential, live database, Supabase migration or Bridge activation changed.

See docs/ARGOS_OWNER_BOUNDARY.md for the reproduced behavior, transaction limits, test setup and remaining live integration gates.


Final concurrency revision verification: five native PostgreSQL test groups passed; all eight PGlite SQL groups passed; npm test passed 1,946 tests with one skipped and zero failures (1,947 total). Integrity passed for 75 files. Full unit log: tmp/argos-owner-concurrency-unit.log. Native test servers were stopped. Browser tests were not repeated for this SQL/test-only revision. No merge, production migration, deployment or live Bridge restart occurred.


## Eleventh revision: expiry after grant lock wait - 2026-09-03

Native PostgreSQL testing reproduced acceptance of an approval that expired while UPDATE waited on its row lock. A new migration explicitly locks the fully bound grant before capturing the consumption time, then checks expiry and records consumption against that same instant. Existing principal suspension serialization and atomic audit remain intact.

Six native PostgreSQL groups and eight PGlite SQL groups passed after the fix. Before/after evidence: tmp/argos-owner-expiry-before-fix.json, tmp/argos-owner-expiry-native-report.json and tmp/argos-owner-expiry-pglite-report.json. The temporary server was stopped. Integrity covers 76 files. Full npm/browser suites were not repeated for this SQL-only behavior change; actual SQL regression covered the changed path. No production migration, deployment or Bridge activation occurred. REVISE remains the decision; live identity/operation integration and release gates are still open.


## Twelfth revision: actual database-role access checks - 2026-09-03

Added a transactional SQL regression using actual anon/authenticated roles on the native fixture. Ordinary clients cannot call approval RPCs, seed principals, reset grants or forge/update/delete/truncate audit records. Owner-only RLS read behavior and privileged audit update/delete rejection also passed. Identity is supplied by a test-only subject setting; this is not live JWT/gateway verification. All test-only Auth/role changes roll back.

All seven native PostgreSQL groups passed; the test server stopped. Report: tmp/argos-owner-access-native-report.json. Integrity covers 77 files. No production source behavior or migration changed; only test coverage and documentation were added. Full npm/browser suites were not repeated for this standalone regression. REVISE remains in effect until live identity, Bridge execution binding and release gates are fulfilled.
