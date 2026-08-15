# ADR-0004: Core Asset Identity and Vessel Profile Foundation

- Status: Accepted as inert Architecture Gate 0 contract foundation; activation not authorized

## Decision

Use exact, versioned, canonical contracts for the company → fleet → vessel → department → system → equipment hierarchy and vessel applicability profiles. Every asset node carries tenant and immutable identity context. Descendants carry their fleet and vessel boundary explicitly so later persistence and authorization layers can fail closed on isolation mismatches.

`VesselProfile` records flag state, class society, vessel type, gross tonnage, construction dates, operation-area scope, exemptions, revision, supersession, and effective-time bounds. It is a data input to future rule applicability; it is not proof of flag/class approval or regulatory compliance.

This foundation can emit only `CANDIDATE`/`RETIRED` asset records and `DRAFT`/`SUPERSEDED` profiles. It cannot emit `ACTIVE`, `APPROVED`, or `VERIFIED` authority. Persistence uniqueness, authenticated tenancy, cross-record parent existence, signed profile approval, rule evaluation, migration, and isolation evidence remain activation-blocking.

All `*Ref` fields are opaque references, not payload-bound or authenticated integrity claims. Single asset nodes are deliberately inadmissible: only a complete company-to-equipment chain can be snapshotted, so leaf identity context is never accepted without its ancestors. Within that chain, node and identity references are unique and child creation time cannot precede its parent. A future store must calculate canonical domain-separated hashes, enforce unique `(tenantId, vesselId, revision)` values, require every supersession reference to resolve to the immediately prior immutable profile, reject cycles, and verify an authorized signature before any profile can influence an active rule decision.

The module stays outside the package export surface and grants no network, sensor, navigation, control, or actuator capability.
