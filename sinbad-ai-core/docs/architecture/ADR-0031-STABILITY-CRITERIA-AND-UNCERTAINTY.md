# ADR-0031: Stability Criteria Applicability and Uncertainty Candidates

## Status

Accepted as an inert, deny-only Stability Foundation contract.

## Decision

Represent an exact versioned `StabilityCriteriaApplicabilityCandidate` and `StabilityUncertaintyBudgetCandidate`. The criteria record binds a source authority and edition, content and applicability commitments, vessel profile, operation area and bounded test-condition class. The uncertainty record binds the exact reference result and criteria applicability to input, model, numerical, sensitivity, correlation and combined-uncertainty commitments.

The host independently supplies the expected tenant, vessel, Stability Package, test condition, reference result, criteria applicability, uncertainty record, condition class, vessel profile, operation area and trusted upper time bound. All identifiers, hashes, timestamps and source labels remain untrusted declarations. Unequal hash strings are only format and separation hygiene, not proof of domain-separated cryptographic commitments. `UNVERIFIED` records do not establish authentic rules, legal/class/flag applicability, correct uncertainty propagation, criteria satisfaction or approval; `REJECTED` and `WITHDRAWN` records stop distinctly and take precedence over time-order diagnostics.

Evaluation is permanently deny-only in this contract version. It always returns `STABILITY_CRITERIA_UNCERTAINTY_BLOCKED`; no accumulation of candidate evidence can change an output flag to true. Enabling any positive result requires a new contract version, independently authenticated assurance boundary, ADR, adversarial tests and explicit activation decision.

## Excluded

No rules engine, stability calculation, uncertainty calculation, criteria comparison, verifier, approver, official compliance decision, alarm, loading computer, persistence, package export or physical-control surface is introduced.
