# ADR-0014: Engineering Calculation Chain and V&V Foundation

- Phase: Post-6H / Architecture Gate 0 / Engineering Foundation 2
- Status: Inert V&V evidence contracts accepted; verification, validation, execution, and approval blocked

## Decision

Represent a calculation-chain candidate, independent-check candidate, verification-record candidate, and validation-record candidate with exact versioned contracts. Bind tenant, vessel, artifact, chain, independent check, solver/version, input/output hashes, units, coordinate frame, benchmark, convergence, sensitivity, uncertainty, comparison criteria, evidence, and total time order.

The calculation remains `DRAFT`; independent check and positive-looking V&V records remain `UNVERIFIED`; explicit failure may be `REJECTED`. No contract can mint `EXECUTED`, `PASSED`, `VERIFIED`, `VALIDATED`, `ACCEPTED`, `APPROVED`, or official authority. A structurally complete chain remains blocked until independently authenticated reproduction, benchmark, mesh/numerical convergence, sensitivity/uncertainty evaluation, V&V policy, physical/model/sea-trial evidence, qualified human review, and vessel-specific acceptance gates exist.

This module contains no solver, CFD/FEA, Monte Carlo, calculation executor, comparison engine, verifier, validator, approver, physical-test controller, storage, or network capability and remains outside package exports.
