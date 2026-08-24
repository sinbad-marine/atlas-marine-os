# ADR-0018: Legacy Package Surface Separation

## Status

Accepted as an inert, backward-compatible boundary.

## Context

The package name `@sinbad-ai/core-terminal-delivery` and its root entry point predate the universal Sinbad Core boundary. Existing recovery and rollout consumers still depend on that adapter surface. Renaming or removing it now would create an unrelated compatibility break, while treating it as the universal Core API would incorrectly couple future product-independent contracts to a delivery adapter.

## Decision

- The existing root export remains unchanged for compatibility.
- An explicit `./legacy-terminal-delivery` alias identifies the same adapter surface.
- Machine-readable `sinbadSurface` metadata classifies the package as `LEGACY_DELIVERY_ADAPTER`, marks it unsuitable for new universal Core consumers, and states that no replacement public API has yet been published.
- Universal Core layers may not statically import either the package name, the explicit legacy subpath, or the trusted terminal-delivery adapter. A repository test fails closed when a required Core tree is missing and acts as a CI tripwire for literal CommonJS/ESM module references.
- Universal Core contracts remain unexported. This ADR creates no new public API, activation authority, production write path, or migration claim.

## Consequences

Existing consumers continue to work. New Core work has an explicit architectural stop against depending on the legacy delivery surface. A future universal package/API requires a separate ADR, compatibility plan, contract tests, security review, and explicit release decision before publication.

The repository test is a static CI heuristic, not a runtime security boundary or semantic proof. Computed module names, indirect re-exports, external consumer behavior, and packed-package resolution require stronger lint/import-graph and package-fixture checks before a universal public API is released. The metadata is descriptive and does not grant or revoke runtime authority.
