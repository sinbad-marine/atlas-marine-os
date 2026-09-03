# ARGOS — SINBAD System Governance

ARGOS is the system-wide observation, integrity, and admission-control layer for SINBAD Marine. Its purpose is to expose drift before a rarely used feature fails in production.

## Permanent boundaries

- ARGOS observes file inventories, test evidence, release evidence, agent identity references, and integration health through explicit adapters.
- Every observation is content-free audit metadata in a hash-chained journal. Secrets, source contents, prompts, credentials, and personal data do not enter the journal.
- Every command class must eventually cross an ARGOS admission adapter. Version 1 provides the contract and fail-closed decision; it does not falsely claim universal interception before adapters are installed.
- Read-only inspection and eligible tests may be admitted. Write and repair actions require owner review. Delete, release, Supabase mutation, credential change, and physical-control actions remain blocked until separately verified external authority and owner approval exist.
- ARGOS may propose a repair, create a quarantined patch, run bounded tests, and prepare a release candidate. It cannot silently rewrite source, alter data, rotate credentials, merge, push, deploy, or control vessel equipment.
- GitHub and Supabase are monitored through least-privilege adapters. A GitHub release uses the protected workflow. Supabase changes use migration, recovery, audit, and owner-approval gates. Neither service grants ARGOS unlimited administrative credentials.

## Layer model

1. **Eyes — inventory and drift:** canonical path, size, classification, and SHA-256 inventories; protected-surface drift is separately classified.
2. **Ears — events and health:** test, workflow, Bridge, model, browser, GitHub, and Supabase adapters emit bounded evidence events.
3. **Memory — append-only journal:** sequence and previous-event hash make deletion, replacement, and reordering detectable. The filesystem shelf persists content-free event envelopes and independently rejects tampering; remote durable replication remains future work.
4. **Judgment — admission gate:** commands are classified before execution. Missing or invalid evidence fails closed.
5. **Hands — quarantined response:** repair and release are proposals until the existing owner and platform gates approve them.

## Scheduled assurance

ARGOS should run three levels instead of pretending that a full byte-for-byte system test several times per day is free:

- every change: inventory drift, contract tests, dependency and secret checks;
- several times daily: unit/integration suite plus Bridge, local-model, GitHub and Supabase read-only health probes;
- nightly or before release: complete browser matrix, artifact build, migration/recovery verification, SBOM, and release attestation.

Failures open an incident shelf keyed by component, commit, evidence hash, first/last observation, and owning agent reference. Automatic repair is limited to pre-approved, reversible recipes and still produces a quarantined patch plus tests. Unknown failures stop and escalate.

The scheduled workflow opens its assurance-run ledger before integrity checks and seals a terminal `PASSED` or `FAILED` event in an `always()` step, so a failed intermediate command cannot leave a false successful record. The job uses an isolated runner-temporary shelf; its JSON summary and hash head remain visible in the workflow log. Long-term remote shelf retention requires a separately approved artifact or evidence-store integration.

## Encrypted long-term archive

Local event shelves can be sealed into an AES-256-GCM archive with HKDF-SHA256 key separation. The archive retains the validated content-free shelf chains needed for later integrity verification, while shelf names, event identifiers, actors, outcomes and target references remain inside authenticated ciphertext. The 256-bit master key is accepted only through `ARGOS_ARCHIVE_KEY`; it is never generated into, written to, or returned by the repository tools.

- `npm run argos:archive:create` reads existing `.argos-runtime` shelves, validates every hash-chain link, writes one new non-overwriting file under `.argos-archive`, flushes it to disk, and immediately verifies it.
- `npm run argos:archive:verify -- .argos-archive/<archive>.json` authenticates and validates an existing archive without restoring or writing event data.
- Missing, malformed or wrong keys; modified ciphertext, nonce, tag or metadata; fabricated shelf chains; symlinks; path escape; overwrites and empty shelf sets fail closed.
- The archive command does not upload, deploy, restore, delete or send data to GitHub or Supabase. Remote replication remains a separate owner-approved integration.

On Windows, `npm run argos:archive:key:init` creates a random 256-bit key and seals it with Windows DPAPI for the current Windows user under `%LOCALAPPDATA%\SinbadMarine\Argos`. The plaintext key is never written or printed. `npm run argos:archive:local` briefly unwraps it only in memory, passes it to the bounded child archive process, and clears both the environment value and key buffer afterward. `npm run argos:archive:task:install` installs a limited, logged-on-user task that runs every six hours, ignores overlapping runs, and performs only the local encrypted archive command. Task removal is explicit through `tools/argos-windows-archive.ps1 remove-task`; removing the task never removes the protected key or any archive.

## Honest current state

Version 1 establishes the trusted vocabulary, immutable inventory comparison, persistent content-free hash-chain shelves, command admission rules, agent envelopes, health contracts, and narrow read-only Bridge/GitHub/Supabase sensors. The supervisor records every component assessment and can create only non-applicable quarantined repair proposals for release-critical incidents.

The operations ledger records one start and one terminal result for each assurance run. Incidents progress only from `OPEN` to owner-hash-bound `ACKNOWLEDGED` and then to verification-hash-bound `RESOLVED`; they cannot be silently reopened, deleted, or marked resolved without both evidence classes. GitHub monitoring uses the workflow's read-only token, binds the exact repository and commit, validates the returned SHA and combined status, and excludes the token from evidence.

ARGOS still does not see operating-system activity outside instrumented adapters, cannot identify an agent that provides no identity evidence, cannot monitor remote services while offline, and cannot treat a health probe as release authorization. Universal interception, remote journal replication, cryptographically signed service attestations, and branch-protection enforcement remain explicit activation gaps.

## Bridge command admission

Every HTTP `POST` accepted by the local Bridge crosses the ARGOS command gate before its route handler. The browser binds a versioned command ID, requested time, exact path, and registered action to the request. Bridge independently checks the path/action binding, a five-minute clock window, a bounded replay ledger, and the browser-origin policy. Missing, stale, mismatched, replayed, unregistered, or over-capacity commands stop before AI, speech, visual, library, route, or OpenCPN handlers run. Health `GET` routes remain read-only and do not require a command envelope.

This envelope supplies admission traceability and replay resistance on the loopback boundary; it is not user authentication, owner identity proof, or release authority. Cloud mutations continue to use their existing authenticated role, RLS, migration, and owner-review gates.
