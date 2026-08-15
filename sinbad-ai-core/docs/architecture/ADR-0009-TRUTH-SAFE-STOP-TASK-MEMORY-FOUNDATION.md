# ADR-0009: Truth, Safe-Stop, Execution, and Task-Memory Foundation

- Phase: Post-6H / Architecture Gate 0 / `PROTO-TRUTH-STOP-MEMORY` Runtime Foundation 1
- Status: Inert contracts accepted; verification, completion, and durable-profile activation blocked

## Decision

Create exact versioned contracts for truth claims, four-field safe-stop records, honest execution states, consent-referenced task profiles, and golden templates. Critical-use claims always stop until source currency, applicability, and independent-check services exist. Task profiles always remain blocked until consent validation, isolated durable storage, conflict handling, regression evidence, user controls, and audit exist.

This foundation cannot emit `VERIFIED_COMPLETE`, activate/supersede a profile, verify a template, write durable memory, or turn memory into authoritative evidence. Existing memory policy remains advisory and continues to reject sensitive, temporary, operational, and safety-critical durable notes.

All `*Ref` fields are opaque identifiers, never filesystem paths, database keys, integrity proofs, or authority. A profile/template pair must match owner-approved source instruction, schema, validation rules, sensitivity, retention, and access-policy scope. A critical claim may be joined only to the host-selected task and stop identities, with `claim.observedAt <= execution.updatedAt <= stop.stoppedAt <= expectedNow`; the joint result explicitly carries no completion authority.

Next closure work: consent lifecycle; task-profile conflict/one-time exception state machine; schema/golden regression verifier; user list/export/revoke/delete contracts; safe-stop orchestration integration; and append-only evidence. `PROTO-TRUTH-STOP-MEMORY` remains activation-blocking.
