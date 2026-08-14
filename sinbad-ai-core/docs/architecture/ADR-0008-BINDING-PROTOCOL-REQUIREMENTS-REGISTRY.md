# ADR-0008: Binding Protocol Requirements Registry

- Status: Accepted requirements record; runtime implementation blocked
- Revision: 1, 2026-08-14

## Decision

Record the four reviewed user protocols in `core-protocol-requirements.json` as non-executable, non-authorizing, activation-blocking requirements. The SHA-256 values were measured directly from external user-owned source files during this integration. The sources are not vendored in this repository, so CI proves registry consistency and hash syntax, not continuing custody of external bytes.

This distinction is mandatory: the integration tests prove that requirements, blockers, and safety language remain recorded. They do not prove runtime enforcement, source-file availability, engineering validation, voice deletion, or any activation gate. Every blocker remains `MISSING` until a separate inert contract/state-machine phase and its adversarial evidence close it.

Future edits require a new registry version, revision entry, source re-review/hash measurement, round-table review, and explicit statement of whether runtime behavior changed. Documentation must never be cited as operational gate evidence.
