# ARGOS REVISE completion plan

The Owner has given standing approval in this task to continue all steps needed to finish the existing project scope without requesting routine confirmation. Proceed with implementation, isolated verification, reviewable packaging and the existing protected release process. This supersedes earlier statements that no service cutover approval had been given. It does not create a verified login, MFA session, production credential, passing test result or permission to bypass platform protections.

The scope remains the audit-driven ARGOS system assurance and command authorization revision. Chief stays advisory; vision, autonomous repair execution and new physical-control capabilities are outside this revision.

## Completion criteria

1. Correct, evidence-bound health and persistent assurance records, with honest UNKNOWN states. Implemented and tested locally.
2. Authenticated Owner approval usable from the application: MFA enrollment/challenge and exact per-operation step-up integrated with protected operations. Server foundation is tested; browser wiring is being completed.
3. Bridge verifies approval at its write boundary using its own trusted service connection and exact body/operation/instance/session binding. Public ARGOS headers remain traceability only. Adapter and full boundary tests are required.
4. A complete reproducible Bridge artifact and exact rollback snapshot preserve current data/configuration and supported functions. Cutover uses that artifact, not the mixed working tree.
5. Supabase migrations/functions and registered Bridge identity are deployed through verified authorized access; real signed-in Owner/MFA behavior is checked. Never synthesize user credentials or substitute test claims.
6. Required repository/browser checks pass, unrelated work is preserved, and any web release follows `.github/workflows/pages-release.yml` on the coordinated release path. No direct push to main or unapproved golden changes.
7. Live Bridge identity, health, denial behavior, current user operations and retained/recoverable audit evidence are verified. Report residual limits explicitly.

GitHub repository access was confirmed with admin/push permissions. Supabase project reference from the existing local link is `kcvyftrvteqmabvxfebu`; deployment access and live MFA are still being checked. Do not claim completion merely because all local tests pass. If a non-substitutable identity/access step remains, complete all other useful work and report the exact remaining dependency rather than repeatedly requesting general approval.

## Completion execution, 2026-09-03

Standing approval is being used for the protected completion path. The additive Owner/Bridge SQL package was installed in `kcvyftrvteqmabvxfebu` in one guarded transaction. Existing active workspace Owner/Auth identity was rechecked before the Founder binding was inserted. `founder-owner-step-up` and `argos-bridge-authorize` are deployed and reject unauthenticated HTTPS requests with 401. No existing Auth password or MFA factor was synthesized or replaced. The Bridge credential is a dedicated random credential stored only as a cloud SHA-256 and Windows-user DPAPI ciphertext. The project has no Supabase CLI migration-history table; use the recorded guarded SQL package, not an indiscriminate `db push`.

Release integration starts from current main `49c6ff3b6822b49ad5c915952e23ecc3887fd7a8` in the isolated `codex/argos-completion` worktree. Current Store, chart console and existing OpenCPN controls are preserved. Unreleased Navigation, Stability and Ship Construction changes in the original working tree are not included. Existing OpenCPN start/input operations receive the same exact Owner boundary; route reads keep the public envelope. ARGOS has no new vision or autonomous execution authority.

All protected source files use explicit LF attributes so exact-byte hashes have the same meaning on Windows and CI. Golden screenshots are unchanged. Local full-process Bridge testing uses a separate ephemeral port and temporary user-data directory; it denies all six protected write paths without an Owner proof. It does not perform physical input or claim a real MFA-positive transaction.

Live Bridge cutover and Pages release follow the committed package and required checks. `tools/argos-install-bridge.ps1` checks the old PID and listener, waits for no active connection, preserves the prior source/configuration/shortcut, installs the immutable source package and checks the new listener identity. User libraries, routes, models and installed runtimes stay in place. A real Owner MFA-positive operation remains a distinct final validation; unit/transport mocks do not establish it.
