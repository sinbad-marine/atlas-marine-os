# ADR-0032: Stability Foundation Integrity Composition

## Status

Accepted as an inert, deny-only composition boundary.

## Decision

Compose the existing Stability Data Package, typed source records, test/loading conditions, reference/independent-check records, and criteria/uncertainty records using their real internal evaluators. Callers cannot inject substitute evaluators or positive stage decisions. Only each versioned module's structurally bound terminal denial is eligible to advance to the next integrity check.

The composition additionally binds package artifact references to exact typed sources, vessel profile across package/sources/criteria, unit and coordinate frame across every source and the reference result, and every package/condition/result/check/criteria/uncertainty foreign key. The complete package/source → criteria applicability → condition/loading → reference result → independent check → uncertainty timeline is ordered under a host-supplied bounded time. A child stage advances only when its status, terminal denial reason and every required deny flag exactly match the expected versioned fail-closed surface.

Even a fully coherent foundation returns `STABILITY_FOUNDATION_INTEGRITY_BLOCKED`. Every assurance and authority flag remains false. This composition proves neither source authenticity nor correct stability calculations, independent reproduction, criteria satisfaction, class/flag acceptance, loading-computer approval or operational authorization.

## Excluded

No solver, rules engine, verifier, approver, storage, network, alarm, loading computer, public package export or physical-control capability is added.
