# ADR-0017: Expert Execution Lock

Status: callback insertion and expert execution blocked; planning metadata only.

Core expert records are inert declarations. Plain data objects are descriptor-snapshotted before validation; accessors, non-plain roots, `execute` callbacks, and `canHandle` predicates are rejected before registry insertion. Normalized records are frozen. The registry retains the historical `candidates(intent, request)` call shape but ignores request-side executable predicates.

Router plans use `sinbad-expert-route-plan/2-v1`, carry same-process nominal provenance, and decision results use `sinbad-decision-pipeline/2`. Legacy `routable` is always false; `planningRoutable` indicates only that planning metadata is complete. Plans always return `executionAllowed: false`, and the decision pipeline rejects malformed, unknown, mutable, unbranded, or execution-capable plan contracts. Rejected routing is not echoed to consumers. Successful planning ends at `PLAN_ONLY_READY`, never `READY_FOR_EXPERT_EXECUTION`. Denial reasons preserve safety first, expertise gaps or otherwise empty routes next, and the mandatory engine-port gate last. Evidence accumulation cannot change this contract into an allow path; enabling execution requires a new versioned contract, ADR, authenticated engine-port composition, tests, independent review, and an explicit activation decision.

The direct product-identity test is a coarse CI regression guard across runtime JavaScript and JSON assets. It does not prove absence of semantic product assumptions; manual architecture review remains mandatory before any product-boundary compliance claim.
