# ADR-0019: Universal Core Public API Publication Gate

## Status

Accepted as an unpublished, deny-only foundation.

## Context

The legacy `@sinbad-ai/core-terminal-delivery` package cannot serve as the product-independent Sinbad Core API. Publishing a replacement prematurely would freeze accidental module boundaries and imply compatibility, security, and release assurances that have not yet been independently verified.

## Decision

- Reserve `@sinbad-ai/core` as the conceptual future package identity; this is not a registry reservation or publication claim.
- Define the draft contract identifier `sinbad-universal-core-public-api/1-draft`.
- Add an internal, unexported publication assessment that is structurally strict and always deny-only.
- Candidate hashes and decision identifiers are labels only. The gate does not verify signatures, evidence custody, approval authority, package contents, or consumer compatibility.
- Even a complete candidate remains blocked until signed compatibility evidence, signed security review, an explicit release decision, and packed external-consumer fixtures are independently verified by a future release boundary.
- Do not add the gate or any universal Core contract to the current package exports.
- The current compatibility package remains `private: true`; its `main` and closed `exports` map do not expose this gate. No package artifact is authorized for publication by this ADR.

## Consequences

The future API gains a versioned fail-closed planning boundary without creating runtime, network, filesystem, package-publication, production-write, or physical-control authority. Publication needs a later ADR and an explicit user-authorized release workflow; evidence accumulation alone cannot activate it.
