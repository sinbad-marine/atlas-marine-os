# ARGOS final acceptance operations

The Owner has authorized completion. Sinbad Denizci is the current active Founder; the former Founder binding is suspended. MFA enrollment and actual member-operation approval/consumption passed; a consumed real grant was rejected on a database-layer replay.

## Local Bridge acceptance

Settings now offers **Check local Bridge protection**. It creates a unique empty GPX diagnostic named `ARGOS-TEST-NOT-FOR-NAVIGATION-<uuid>.gpx` using the current real MFA session, then resends exactly the same HTTP command. Success requires a 201 write response followed by 403 `ARGOS_COMMAND_REPLAYED`. It invokes no OpenCPN operation and includes no route or waypoint. Failure of the first request stops the test. No token or nonce is placed in the visible result. The result includes the approval ID, filename and time for comparison with the server audit and local file. A matching, verified diagnostic file can then be moved out of Routes into the audit evidence directory.

## Independent Windows health observation

Run `node tools/run-argos-host-health.js <exact-main-commit> <independently-recorded-bridge-package-id> <new-output-file>` from a clean checkout of that exact release. The host needs Windows PowerShell, GitHub CLI authentication and the existing local services. The collector makes a bounded structured inference request to the installed qwen3:14b model; it never pretends a deterministic Bridge arithmetic answer is a model inference.

It compares live application bytes against the exact Git commit, independently checks the OS listener and every installed runtime file against a pinned Bridge package, checks six missing-Owner-proof denials, exercises actual model generation, probes Supabase Auth/Owner denial, and reads GitHub main/release evidence. TEST_SUITE and RELEASE_PIPELINE retain the existing strict release-evidence checks, including checkout binding and freshness. The report is a five-minute operational observation of these named probes, not certification of every application feature, model answer quality, voice capability, physical command, or uninterrupted uptime. The cloud scheduled workflow cannot observe this host's local services and continues to report missing evidence honestly.

The installer starts Bridge through Windows process management with a hidden window, as does its rollback path. This makes the process independent of the shell launching the installer. It does not install a restart watchdog or guarantee uptime. The earlier process termination cause was not established.

## Isolated journal restoration

`powershell.exe -NoProfile -File tools/argos-ci-retention.ps1 -Command restore -ArchiveFile <ciphertext-json> -RestoreDirectory <new-directory>` opens the existing Windows-user DPAPI key in memory and authenticates the archive before writing. The destination must not exist. Traversal names, Windows device aliases, case collisions, linked ancestors, wrong keys and corrupt chains are rejected. Restored journals keep archive shelf IDs in a flat directory layout and original authenticated events; all reconstructed chains are validated again. Existing journals and live databases are not overwritten. A failed partial restore must be investigated and retried into a new directory, not reused.

Actual retained artifact 9883190777 was restored on 2026-09-03 into `LOCALAPPDATA/Sinbad/argos/audit-evidence/restored-20260903T110821Z`: two assurance events plus ten health events; both heads matched the earlier verified checkpoint.

The restored information is ARGOS event journals, not a Supabase database backup. The DPAPI key still depends on the current Windows profile. No independent off-device key custodian, new-machine key recovery, or complete live-database restore is claimed. Those require a separately available recovery credential/custodian and are not created by inventing a secret on behalf of the Owner.
