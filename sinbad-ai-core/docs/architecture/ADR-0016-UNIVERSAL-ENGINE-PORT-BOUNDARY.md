# ADR-0016: Universal Engine Port Boundary

Status: inert manifest foundation; registration, execution, and activation blocked.

Sinbad Core is product-independent. Specialized engines are external modules connected through versioned, typed ports. The first implementation must be deny-only: it may validate a manifest but cannot load, execute, register, network, write files, run processes, access credentials, or grant activation.

Contract v1 accepts only READ_ONLY declarations for every port; blocked assessments echo no allowed mode and expose non-empty machine-readable assurance gaps. Strict parsing is private; the module exports no manifest-construction success object, loader, registry, or executor. Port N requires tenant scope, vessel scope, human approval, and a safety-related or safety-critical classification; it cannot mint actuator authority. Port O is informational/advisory, requires human approval, and has no direct Core or production write permission. Policy hashes are unverified format-only references in this inert foundation; authenticity, uniqueness, sandbox allow-list, and policy binding remain activation-blocking. Stability and loading remain future maritime-engine modules behind this boundary.

Zabit Akademisi and other products consume Core; they do not define it. Existing terminal-delivery exports remain compatible legacy adapter surfaces, and existing expert routing is not a module-trust or activation boundary.
