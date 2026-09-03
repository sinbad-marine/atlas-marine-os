# ARGOS encrypted retention and recovery verification

Status: PREPARED, NOT ACTIVATED. No remote upload, key provisioning, live restore or host migration was performed.

## What changed

The archive loader now includes both direct shelves and nested health runs. Previously the direct-child loader could miss records under `health-runs/<run-id>/health`. Nested shelf identifiers join path segments with `__`; ambiguous or overlong identifiers are rejected. A valid archive preserves the complete event chains, counts and heads inside authenticated ciphertext.

The loader rejects linked paths, unexpected files, mixed event/directory layouts, invalid sequences and empty trees. Limits are four directory levels, 400 directories, 100 shelves, 100,000 event files, 1 MiB per event file and 64 MiB total event bytes. Exceeding a limit fails the archive; it never silently drops older records. Long-running local installations need an explicitly designed partition/retention policy before exceeding those bounds. No event deletion or pruning was added.

Sources are read again before writing, to detect changes during collection. The new archive is created exclusively, flushed, read back from disk and authenticated. The output includes the ciphertext file's SHA-256. Existing archives are never overwritten. This is snapshot verification, not a filesystem transaction or protection against a fully privileged concurrent attacker.

## Prepared CI retention

The assurance workflow places health runs inside the same runner-temporary ledger root as the assurance result. After sealing the result, the optional archive step encrypts and verifies that tree. Upload runs only if archive creation succeeded, including when the underlying assurance run failed.

The upload uses the pinned official `actions/upload-artifact` v4.6.2 commit. It selects only `sinbad-argos-retention/*.json`, refuses missing files and overwrite, and requests 30-day retention. It never selects raw journals, working-tree files, logs, credentials or the broader runner temporary directory.

Two settings are required before this preparation can activate:

- Repository variable `ARGOS_ARCHIVE_RETENTION_ENABLED` must be exactly `true`.
- Repository secret `ARGOS_ARCHIVE_KEY` must contain a securely provisioned canonical base64 256-bit key. It is exposed only to the archive process step.

Neither setting was changed. The existing governance policy requires separate Owner approval for remote retention. Review repository access and the key recovery custodian before enabling it. Do not extract or copy the current Windows DPAPI key automatically; do not place a key in source, a command argument, a chat or a normal backup. Provision/recover keys through an approved secret-management process.

Thirty-day workflow artifacts are bounded retention, not permanent or independently immutable storage. Repository administrators and retention expiry can remove artifacts. A separately protected artifact/checkpoint inventory and longer-term retention policy remain necessary for durable audit guarantees. Upload failure is visible in the workflow; a successful earlier ledger seal does not prove that remote retention succeeded.

## Recovery verification procedure

1. Identify the intended workflow run, attempt and source SHA from the trusted GitHub run record. Obtain its archive through the authenticated artifact interface. Keep the downloaded file in a new isolated directory.
2. Verify the download against independently retained artifact identity/digest. Distinguish the GitHub artifact package digest from the individual ciphertext JSON file hash printed as `archiveSha256`; they are different objects.
3. Provision the corresponding key into the verifier's protected process environment. Set `ARGOS_ARCHIVE_ROOT` to the isolated archive directory. Run `node tools/argos-encrypted-archive.js verify <absolute-archive-file>` from the repository.
4. Require `ARGOS_ARCHIVE_VERIFIED`. Compare returned source inventory hash, shelf identifiers, event counts and hash heads with independently trusted checkpoints. Successful decryption alone does not establish that a newer archive or journal tail was not omitted.
5. Retain the verified ciphertext and its independent reference under the approved storage policy. Remove the temporary environment reference according to the secret-management process. Never log the key.

Verification decrypts in memory to authenticate structure and chains, and returns only a summary. It does not recreate journals, replace a live database, overwrite source history, acknowledge an incident or enable execution. A live restore/import mechanism and key reprovision on another machine are not implemented by this change. Losing the key prevents archive recovery.

## Tests and limits

Automated tests generate a synthetic key in memory, create real assurance and nested health records, encrypt using the actual CLI, remove only the temporary source records, relocate ciphertext to another temporary root and verify it through a fresh process. They compare every returned shelf count/head and the file hash. Wrong/missing keys, ciphertext tampering, malformed nested events, unexpected files and linked output ancestors fail without exposing fixture content or changing existing archives.

This proves portable archive verification with a supplied key and synthetic data. It does not prove real Windows-to-workstation migration, DPAPI portability, actual remote upload/download or a production key recovery procedure.

Reference: [official upload-artifact documentation](https://github.com/actions/upload-artifact/tree/ea165f8d65b6e75b540449e92b4886f43607fa02).

Retention revision verification: npm test passed 1,933 tests with one skipped and zero failures (1,934 total); npm run test:web passed 114 tests. Integrity verification passed for 64 protected files. Logs: tmp/argos-retention-unit.log and tmp/argos-retention-web.log. No golden updates, remote retention activation, key provisioning or live-service changes were performed.

## Standing-approval activation preparation, 2026-09-03

The Owner's standing completion approval supersedes the earlier no-provisioning statement. A dedicated CI archive key has now been provisioned into repository secret `ARGOS_ARCHIVE_KEY`, with `ARGOS_ARCHIVE_RETENTION_ENABLED=true`. Its recovery copy is Windows-user DPAPI ciphertext at `LOCALAPPDATA/SinbadMarine/Argos/ci-archive-key.dpapi`; it is distinct from the Bridge instance credential. The plaintext key was not written to source, command arguments or chat. The new workflow still requires the coordinated merge before it can run. Validate the first real upload by downloading its exact GitHub artifact and calling `tools/argos-ci-retention.ps1 verify` on the ciphertext. This recovery mechanism depends on the current Windows user's DPAPI profile; independent off-device key custody is not claimed.
