# ARGOS Owner boundary review — 2026-09-03

Decision: REVISE. Selected cloud member operations have an Owner boundary in source; Bridge execution does not. This review did not verify live deployment.

## Verified scope

`founder-owner-step-up` checks Supabase user identity, AAL2 and active Founder registration before issuing a session-bound five-minute grant. Issuance does not execute an operation. `manage-members` independently reconstructs the command for `identity.member.set_role` and `identity.member.set_active`, checks workspace Owner membership and AAL2, and consumes the exact grant through a service-role-only RPC before mutation. Invitations retain ordinary workspace Owner RBAC.

`tests/founder-owner-boundary.test.js` executes the actual TypeScript member handler using Node type stripping and substituted Supabase transport. It checks missing identity, inactive/nonowner callers, MFA failure, missing/malformed proof, missing session, changed command/action/target/workspace/nonce/session, consumption refusal, transport failure and reuse. A positive test checks server reconstruction of the actor and command hash.

The mock supplies identity responses and models consumption. These tests do not prove live JWT verification, database atomicity, expiry or principal suspension. Existing migration assertions inspect source only. Ten focused tests passed, including the five existing MFA tests. No complete regression or browser run was repeated for this tests/documentation-only change; no merge is proposed.

Bridge currently checks public command fields, freshness and process-local replay state. Headers, CORS, Owner hashes and browser-supplied approval booleans do not authenticate Owner. Bridge has no consumer of Founder grants.

## Connection contract to implement

1. Preserve Chief Phase 1 advisory-only. Grants cannot independently enable repair, release, deletion, credential changes or physical control. Each executor needs an approved operation policy.
2. Establish an independently provisioned Bridge identity and reviewed artifact. Browser-provided host names and hashes are not identity evidence.
3. The trusted service must authenticate user, current AAL2 and active Founder, and bind the independently reconstructed method, normalized route, complete command digest, resource/workspace, Bridge audience, command ID and session. Executor and verifier must share canonicalization and reject ambiguous framing/duplicate JSON keys.
4. Bridge must contact the trusted service directly over an authenticated channel, with a fresh challenge binding the reply to its request. Browser-forwarded success JSON cannot authorize execution. Service-role credentials remain exclusively server-side.
5. Consume the approval atomically; recheck the immutable command immediately before the sole side-effect boundary. Missing configuration, changed command, timeout or unverifiable reply deny execution.
6. A crash after consumption leaves an uncertain outcome. Do not automatically retry the side effect. Record the uncertainty and reconcile it; remote consumption and local execution are not a single transaction.
7. Define route policy before changing existing user flows. Library writes, route creation and physical handoff require separate decisions from inference, search and speech. A blanket Owner gate would change unrelated functionality.

## Acceptance evidence still required

- Actual isolated HTTP executor tests: forged/missing/expired/wrong-session/wrong-audience approval and changed body produce no side effect.
- Real database concurrency, expiry and suspension tests; approval reuse must fail across restarts.
- Actual signed-token verification, including invalid signatures, expired/revoked sessions and inadequate AAL. Decoded claims alone are insufficient.
- Service outage, delayed reply, interrupted execution and retry tests, with explicit reconciliation behavior.
- Complete reviewed Bridge artifact, trusted service deployment, instance provisioning and verified rollback before cutover.

This change adds behavioral tests and an implementation contract. The Bridge connection remains unfinished. No authorization endpoint was activated, real grant consumed, credential provisioned, migration applied, Bridge restarted or Chief execution enabled.

## Stateless SDK correction — 2026-09-03

The earlier substituted-client tests missed a concrete integration defect: configuring a global Authorization header does not populate the SDK session used by parameterless `getAuthenticatorAssuranceLevel()`. Both endpoints could therefore reject a valid AAL2 request with `MFA_AAL2_REQUIRED`.

The correction validates Bearer syntax and explicitly supplies the same request JWT to `getUser(jwt)` and `getAuthenticatorAssuranceLevel(jwt)`. It retains Auth server verification and requires current AAL2; a verified factor or nextLevel of AAL2 cannot upgrade an AAL1 request. The member handler also disables session persistence and automatic refresh. Both Edge imports now pin Supabase JS 2.112.3, matching the installed test dependency.

`tests/founder-owner-sdk.test.js` executes both real handlers with the actual SDK and a substituted HTTP transport. Before the correction, the AAL2 positive case failed in both handlers. Afterward it succeeds without any stored session. Tests also check exact request-token forwarding, provider rejection during identity or MFA recheck, AAL1 with a verified factor, malformed/missing credentials, absence of writes on denial, and separation of user credentials from service-role database requests. An import-version check prevents silently testing a different SDK version from the Edge source.

The transport supplies synthetic Auth responses and database results; it makes no network calls. This establishes SDK/handler integration, not actual Supabase signature validation, revocation, database atomicity or deployment. Those acceptance gates and the missing Bridge adapter remain open.

API references: [explicit JWT MFA lookup](https://supabase.com/docs/reference/javascript/auth-mfa-getauthenticatorassurancelevel) and [server-verified user lookup](https://supabase.com/docs/reference/javascript/auth-getuser).


Verification after the stateless SDK correction: npm test passed 1,945 tests, with one skipped and zero failures (1,946 total). All 17 focused Owner/MFA tests passed within that run. Integrity verification passed for 69 protected files. Log: tmp/argos-owner-sdk-unit.log. Browser tests were not rerun for this server-only change; no merge or release is proposed.

## Atomic issuance preparation — 2026-09-03

The issuer previously performed two independent inserts and ignored the audit insert error. An approval could therefore be returned without its issuance audit. The candidate now calls only `issue_founder_step_up`, defined in the new `20260903_founder_owner_atomic_issuance.sql` migration. Existing migration history is unchanged.

The function rechecks and locks the active Founder row with FOR SHARE, inserts the grant with a database-clock five-minute lifetime, inserts its audit, and returns only after both statements succeed. An uncaught audit failure aborts the RPC transaction. Execution privileges are revoked from PUBLIC, anon and authenticated and granted only to service_role. This is not an independent Auth verifier: the trusted Edge function must still verify the request JWT and current AAL2 first. It does not make the later member mutation atomic with grant consumption.

The Edge candidate returns a stable 503 error without nonce or database diagnostics when the RPC fails or returns malformed output. It has no fallback to separate inserts. SDK tests verify the sole RPC, operation/session binding, hashed nonce, server-provided expiry, failure handling and absence of returned approval on error.

`tests/sql/founder-owner-atomic-issuance.sql` is a separate psql regression script for an empty disposable PostgreSQL database. It creates minimal Auth/workspace fixtures, loads both migrations in a transaction, injects an audit trigger failure, and checks rollback of the grant. It also checks issuance/audit binding, five-minute lifetime, execute privileges, nonce uniqueness, consumption/reuse and suspended-principal denial. All fixture changes roll back. It rejects databases that already contain an auth schema and must never target production. This script is not part of npm test.

Database verification remains pending: psql/Supabase CLI were unavailable and the Docker engine was not running in this environment. The SQL script has not been executed; concurrent transactions and real Supabase schema/permissions also remain separate acceptance gates.

Deployment dependency: review and validate the migration in isolation, then apply it through the authorized Supabase migration process before deploying the updated Edge function. An absent RPC deliberately blocks issuance with 503. Do not restore the two-insert path as an automatic fallback. No migration or function deployment occurred in this revision, and the Bridge Owner adapter remains unfinished.


Atomic issuance candidate verification: npm test passed 1,946 tests, with one skipped and zero failures (1,947 total), including all 18 focused Owner/MFA tests. Integrity passed for 72 files. Log: tmp/argos-owner-issuance-unit.log. The PostgreSQL installation directory was also checked: psql, initdb and pg_ctl executables were absent. SQL regression execution remains pending. Browser tests were not rerun for this server-only candidate; no merge or deployment is proposed.

## PostgreSQL WASM regression executed — 2026-09-03

The previously unexecuted SQL regression now passes on PostgreSQL 18.3 through PGlite 0.5.8. This is PostgreSQL executing the actual SQL and PL/pgSQL functions, not an HTTP/JavaScript mock. The two migration files and the SQL assertions were unchanged for this run.

`tools/argos-test-owner-sql.js` expands only the two known psql include directives, removes the client-only set/echo directives, and executes the fixture in a fresh in-memory engine with pgcrypto. It verifies audit-failure rollback, grant/audit binding, five-minute lifetime, execute privileges, nonce uniqueness, successful consumption followed by reuse denial, and suspended-principal denial. After the fixture ROLLBACK, it checks that the Auth fixture schema and grant table no longer exist, then closes the engine. The JSON report includes engine version and exact source hashes.

The dependency was installed only into `tmp/argos-pg-runtime-058`, with install scripts disabled. Root package files, global services and existing database directories were untouched. There is no connection URL or production credential in the runner, and it does not install packages or make network requests itself.

Reproduction from the repository root:

```powershell
npm install --prefix tmp/argos-pg-runtime-058 --cache tmp/argos-pg-npm-cache --ignore-scripts --no-audit --no-fund --save-exact @electric-sql/pglite@0.5.8
node tools/argos-test-owner-sql.js
```

Report: `tmp/argos-owner-postgres-report.json`. Registry archive integrity recorded by npm: `sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==`.

This closes the local SQL execution gap for these assertions. PGlite has a single connection and this fixture uses minimal Auth/workspace tables. Concurrent sessions, lock races, complete Supabase schema/RLS, real signed-token Auth and deployment remain unverified. No production migration, live approval or Bridge activation occurred. The runner is separate from npm test and does not turn the existing full-suite results into a production approval.

Runtime references: [PGlite PostgreSQL WASM runtime](https://pglite.dev/docs/about) and [bundled pgcrypto extension](https://pglite.dev/extensions/).

## Native concurrent-session verification and correction — 2026-09-03

Native PostgreSQL 18.4 was run in a fresh temporary cluster with separate service-role connections. The initial test confirmed exactly-once consumption under contention, but found that consumption returned true while a principal suspension transaction already held the Owner row lock. Issuance correctly waited for that transaction; consumption did not. The before-fix report records `CONSUMPTION_DID_NOT_WAIT_FOR_SUSPENSION: accepted=true` in `tmp/argos-owner-native-before-fix.json`.

The new migration `20260903000100_founder_owner_consumption_lock.sql` replaces the consumer without editing migration history. It first locks the active principal FOR SHARE, then updates the grant and appends its audit. This matches issuance's principal-before-grant lock order. It preserves every original command/session/nonce/resource/expiry/reuse check and service-role-only execute privilege. A committed suspension seen after the lock wait returns false without consuming the grant.

The final native report `tmp/argos-owner-native-report.json` passes five groups:

- Existing SQL regression and fixture rollback on native PostgreSQL.
- Two competing service-role sessions: one successful consumption and exactly one consumption audit.
- Issuance waits behind suspension and rejects after suspension commits.
- Consumption waits behind suspension and returns false, leaving the grant unconsumed and no consumption audit.
- In the reverse order, suspension waits until the transaction that already consumed the approval commits.

The last case is intentional serialization: a later suspension does not undo an earlier committed consumption. Approval consumption and the subsequent member mutation are still separate transactions; this migration does not make external/local side effects atomic with approval.

The native runner `tools/argos-test-owner-concurrency.js` uses an ephemeral port bound to 127.0.0.1, a random test-only SCRAM password, a new data directory each time, explicit database-directory verification before fixtures, bounded queries, and shutdown in finally. It never installs a service or accepts an external connection string. Initial password files are removed immediately after initialization. Each report confirms `serverStopped: true`. Synthetic database files/logs remain in the reported tmp directory for inspection.

Runtime packages are pinned under `tmp/argos-native-pg-runtime`:

```powershell
npm install --prefix tmp/argos-native-pg-runtime --cache tmp/argos-pg-npm-cache --ignore-scripts --no-audit --no-fund --save-exact @embedded-postgres/windows-x64@18.4.0-beta.17 pg@8.23.0
node tools/argos-test-owner-concurrency.js
```

The package suffix is the wrapper package version; the server identifies itself as PostgreSQL 18.4. The [binary package](https://github.com/leinelissen/embedded-postgres) was used after the EDB archive servers closed download connections. These are temporary test dependencies, not production runtime or installed system services. The Windows sandbox initially prevented initdb's restricted-token setup; the approved test command ran outside that restriction and shut down its own cluster.

The updated SQL fixture also passes again on PGlite. This closes the tested concurrent-session gaps locally. Full Supabase schema/RLS, actual signed-token Auth, Bridge's Owner adapter, deployment and release/rollback gates remain open. No production database or live service was changed.


Final concurrency revision verification: five native PostgreSQL test groups passed; all eight PGlite SQL groups passed; npm test passed 1,946 tests with one skipped and zero failures (1,947 total). Integrity passed for 75 files. Full unit log: tmp/argos-owner-concurrency-unit.log. Native test servers were stopped. Browser tests were not repeated for this SQL/test-only revision. No merge, production migration, deployment or live Bridge restart occurred.

## Expiry after lock wait — 2026-09-03

The next native regression reproduced a second race: an approval valid when UPDATE began could expire while waiting for the grant row, yet still be consumed. A time-dependent UPDATE predicate alone did not provide the required post-wait check. `tmp/argos-owner-expiry-before-fix.json` records the failing assertion `EXPIRED_GRANT_CONSUMED_AFTER_LOCK_WAIT`.

The new `20260903000200_founder_owner_consumption_expiry.sql` migration retains principal-first locking, then explicitly locks the exact unconsumed grant with all original approval bindings. Only after both locks are acquired does it capture `consumption_time`. The final update requires expiry later than that instant and records the same instant in consumed_at. Audit insertion stays in the same transaction. Existing migrations remain unchanged.

The test shortens only a synthetic grant's lifetime to two seconds, holds its row in another transaction, starts consumption, and verifies both a real database lock wait and an initially valid expiry. It waits until the database clock confirms expiry before releasing the holder. After the fix the consumer returns false, the grant remains unconsumed, and no consumption audit exists.

All six native PostgreSQL groups passed, including the five earlier concurrency/serialization groups. All eight PGlite SQL groups passed as well. Reports: `tmp/argos-owner-expiry-native-report.json` and `tmp/argos-owner-expiry-pglite-report.json`. The native report confirms the test server stopped.

Expiry is evaluated at the consumption decision after lock acquisition. This does not make transaction commit or a later external side effect occur before expiry; the existing separation between approval consumption and the eventual member/Bridge operation remains an integration constraint. No production migration, live approval or deployment occurred. Full npm/browser suites were not repeated for this migration-only behavior change; the actual SQL regressions were run instead, and the previous full-unit results remain historical evidence.

## Actual database-role and RLS checks — 2026-09-03

The native runner now also executes `tests/sql/founder-owner-access.sql` on its disposable fixture. It switches to actual PostgreSQL anon/authenticated roles, rather than merely inspecting privilege metadata. All seven native test groups passed, including the earlier concurrency and expiry tests. Report: `tmp/argos-owner-access-native-report.json`; the server was stopped afterward.

The authenticated role cannot invoke either service-only approval RPC, seed a principal, reset consumed grants, forge/update/delete audit rows or truncate the audit table. The anon role cannot read any of the three Owner tables or invoke the approval RPCs. These statements are required to fail with insufficient_privilege; an unrelated validation failure does not count as a pass.

RLS checks confirm that the authenticated Founder sees populated own records, while another subject or a missing subject sees no records in the three tables. The audit update/delete trigger also rejects changes when exercised as the fixture's table owner. This does not claim resistance to a database administrator changing schema or removing triggers.

For this test only, auth.uid reads a transaction-local subject setting. It models identity already supplied by a trusted gateway; it does not authenticate a JWT or prove how a live Supabase gateway sets claims. The test-only function change, schema usage grants and role/subject settings are rolled back, and the runner verifies the original Auth stub is restored.

No production source behavior or migration changed in this revision. The change adds a SQL access regression and connects it to the native runner. Live Auth, complete Supabase schema/configuration and the Bridge Owner adapter remain open gates. Full npm/browser suites were not repeated for this standalone test addition.
