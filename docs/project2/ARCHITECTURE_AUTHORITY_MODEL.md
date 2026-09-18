# Project 2 — Authority model (Owner correction, 2026-09-15)

Status: binding design record for Project 2 (SINBAD multi-model architecture). Documentation only; nothing here activates a component.

## Correction to the Phase 1 proposal

The Phase 1 discovery report proposed a single linear precedence list of truth sources. The Owner rejected that model. Project 2 must keep two different kinds of truth apart, because they answer different questions and neither can substitute for the other.

### A. NORMATIVE / AUTHORITY TRUTH — "what is authorized or intended"

Sources: OWNER DIRECTIVE; approved governance policy (OWNER_GOVERNANCE.md, AGENTS.md, ARGOS system governance, activation gates); authorization and permissions (founder step-up grants, workspace roles, RLS); release decisions (MERGE GO, deployment approval).

These sources decide what may be done, by whom, and what a result is allowed to be called (for example OWNER ACCEPTED). They do not establish facts about the world.

### B. OBSERVED / FACTUAL TRUTH — "what is factually the case"

Sources: LIVE SYSTEM (production reads, bridge and model status, Pages bytes); DATABASE (Supabase rows and audit tables); REPO (git objects on origin/main); TEST / CI (run records with identifiers); DOCUMENT (PROJECT_STATE.json, ADRs, runbooks, each only for what it explicitly claims and dates); EXTERNAL AUTHORITATIVE SOURCE (IMO/ILO/flag texts with hash and fetch provenance).

These sources decide whether a claim is VERIFIED, NOT VERIFIED, CONFLICT or SOURCE MISSING. They do not grant authority.

### Core principle

- The OWNER determines what is authorized or intended. Evidence determines what is factually true.
- An Owner statement that a server is ONLINE is not evidence that it is ONLINE; it is an intent or an expectation until a LIVE SYSTEM observation confirms it.
- A live system observation cannot override an Owner governance prohibition; a thing being possible or observed does not make it permitted.
- MODEL MEMORY and MODEL INFERENCE remain non-authoritative in both dimensions: they can neither authorize nor verify. They may only propose claims that must then be bound to class A (for permission) or class B (for fact).

### Consequences for Sentinel, Pilot and Co-Pilot (future phases; not implemented)

- Sentinel checks class A before any action (authority, scope, prohibition) and class B before any factual claim leaves the system (evidence binding). A missing class A answer is BLOCKED; a missing class B answer is NOT VERIFIED or SOURCE MISSING.
- Pilot must carry both bindings on every action or answer: an authority reference and an evidence reference.
- Co-Pilot must flag any answer that uses a class A source as if it were evidence, or a class B observation as if it were permission.
- Conflicts inside class B are CONFLICT until resolved by a higher-quality observation of the same fact; conflicts between class A sources are escalated to the Owner. A conflict between a class A intent and a class B fact is not a conflict at all: both are recorded (intended X, observed Y) and the gap is reported.

### Labels that stay distinct

MERGED (class B, git) ≠ OWNER ACCEPTED (class A) ≠ HUMAN REVIEW VERIFIED (class B, review records) ≠ AUTHORIZED (class A) ≠ ONLINE (class B, live observation).

## Applied to the Phase 2 benchmark

Repo/state, stale-state and contradiction gold items record which class each expected value belongs to. A benchmark PASS is a class B fact about the current system; it grants no authority and is not an acceptance.
