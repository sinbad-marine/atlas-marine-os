# ADR-0022: Deny-Only Engine Isolation Profile

## Status

Accepted as an inert declaration and assessment foundation.

## Decision

Engine isolation profile v1 requires `NONE` for filesystem, network, process execution, environment, and secret access; forbids dynamic module loading and native code; and requires a bounded memory declaration. Parsing is exact, non-coercive, and accessor-safe.

A structurally valid profile remains `ENGINE_ISOLATION_ACTIVATION_BLOCKED`. The declaration cannot prove OS/container enforcement, resource controls, escape resistance, or independent isolation testing. The module contains no sandbox launcher, module loader, process/network/filesystem operation, credential access, execution surface, or activation decision.

## Consequences

Future sandbox adapters gain a versioned minimum-denial contract without allowing a configuration document to masquerade as enforced isolation. Real enforcement, signed profile policy, platform attestation, adversarial escape testing, monitoring, revocation, and audit evidence remain activation blockers.
