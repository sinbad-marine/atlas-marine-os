# ADR-0043: Voice Deletion Manifest and Evidence Candidates

## Status

Accepted as a private, inert, deny-only Voice Foundation 3.

## Decision

Require one exact draft manifest covering distinct sets for source audio, voiceprints/embeddings, fine-tunes/adapters, caches, replicas, provider copies, recoverable backups and key material. Evidence candidates bind one manifest and one asset set; each asset class has one admissible candidate method, and recoverable-backup evidence also requires a restore-negative evidence reference. Tenant, person, voice profile, lifecycle request, inventory hash, revocation epoch, asset identity and time are exact trust-boundary inputs. Duplicate evidence classes, identifiers or hashes are rejected.

Even a structurally complete eight-class candidate graph is `PARTIAL_DELETION`. Missing asset classes and present-but-unverified classes are reported separately. All evidence is `UNVERIFIED`; inventory completeness does not prove erasure, provider deletion, key destruction, replica/backup coverage, restore failure or durable audit. The assessment cannot emit `COMPLETE`, `DELETED`, `ERASED`, `VERIFIED` or an incident report.

## Excluded

No inventory discovery, storage lookup, filesystem/network/provider operation, key destruction, cryptographic erasure, deletion execution, backup mutation, restore attempt, signature verification, audit append or completion authority is introduced. Actual irreversible deletion requires separate destructive-operation authorization and independent evidence.
