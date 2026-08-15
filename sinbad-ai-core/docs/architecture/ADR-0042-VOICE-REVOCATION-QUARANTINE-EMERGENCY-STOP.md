# ADR-0042: Voice Revocation, Quarantine, and Emergency Stop

## Status

Accepted as a private, inert, deny-only Voice Foundation 2.

## Decision

Represent an exact pending lifecycle request bound to tenant, person, voice profile, trusted evaluation time, evidence and an independently supplied expected revocation epoch. Requests older than five minutes, future requests and epoch mismatches are invalid and carry no trusted request identity or target state. Explicit owner emergency destruction and high-confidence prohibited or coercive use require immediate generation stop and target `EMERGENCY_REVOKED`. Ordinary revocation targets non-emergency `REVOKED`; serious uncertainty targets `QUARANTINED`. `EMERGENCY_REVOKED` is terminal for this contract version; restore, unquarantine, administrator veto and deletion-complete requests are structurally absent.

The decision is a stop requirement, not a durable transition. It advances only a candidate revocation epoch and keeps generation, synthesis, playback, restore, veto, transition, deletion and activation false. An owner or administrator therefore cannot use this module to veto or reverse emergency revocation.

## Excluded

No consent store, persistent state transition, audio lookup, provider call, filesystem/network operation, key destruction, cryptographic erasure, replica/cache/backup deletion, restore-negative verification, incident report or deletion-completion claim is introduced. These require a later inventory, manifest, custody and externally evidenced orchestration boundary. Incomplete deletion must eventually report `PARTIAL_DELETION`; this phase cannot report deletion at all.
