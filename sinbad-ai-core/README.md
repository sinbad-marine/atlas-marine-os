# Sinbad AI Core — Phase 1

Sinbad AI Core is the decision and coordination layer of Atlas Marine OS. It
does not implement navigation mathematics. Existing expert engines remain
independent and are called through adapters.

## Architectural rules

1. **Core before model** — deterministic intent, safety and routing rules run
   before any local or cloud language model.
2. **Experts stay independent** — navigation, academy, documents and vessel
   services expose adapters; the core does not copy their domain logic.
3. **Safety gates cannot be bypassed** — emergency, live-data and operational
   decisions are labelled before an answer is produced.
4. **Human command remains final** — the master or responsible operator owns
   every operational decision.
5. **Offline-first contracts** — the same request envelope is used for local
   and cloud providers.
6. **Traceable answers** — every handled request records the chosen expert,
   warnings, sources and confidence.

## Phase 1 layers

```text
User / Voice / UI
        |
        v
Application adapter
        |
        v
Intent -> Safety -> Context -> Orchestrator
                              /     |      \
                         Experts  Memory  AI providers
```

## Directory map

```text
sinbad-ai-core/
  contracts.js          Stable request, result and safety contracts
  manifest.js           Version and layer registry
  adapters/             Boundaries to Atlas UI, local AI and cloud AI
  experts/              Expert registration boundary (no expert math here)
  memory/               Conversation and durable-memory boundary
  tests/                Focused Phase 1 contract tests
```

The legacy `sinbad-core.js` remains the browser-compatible facade while the
Phase 1 modules are introduced behind it.

## Phase 2A retrieval boundary

`retrieval/` adds a plan-only, offline-first Retrieval & Evidence layer. It
normalizes evidence provenance, searches injected library `sources/chunks`,
checks relevance and authority requirements, detects structured claim
conflicts, and records timing/audit details. Document text is always data and
cannot alter Core safety, owner authority, or execution policy. This phase does
not execute experts or modify the navigation mathematics engine.

## Phase 2B grounded answer boundary

`grounding/` consumes the structured Phase 2A retrieval result and produces an
immutable grounded-answer package. Material claims resolve only to selected
evidence, citations preserve available provenance without inventing metadata,
and insufficient, conflicting, or failed retrieval states stop conclusively.
Document content remains `DATA_ONLY`; this layer performs no expert execution
and contains no navigation mathematics.

## Phase 2C plan-only integration boundary

`orchestrator/grounded-orchestrator.js` composes the existing Phase 1 decision
pipeline, Phase 2A retrieval engine, and Phase 2B grounding pipeline under one
transaction identifier and unified result. It propagates upstream safe stops,
keeps expert execution disabled, and never imports or invokes the navigation
engine. Claims remain explicitly structured inputs; no free-form model claim
generation, web retrieval, live vessel data, or navigation mathematics is
introduced.

## Phase 2D trusted offline library boundary

`library/` builds and activates deterministic, content-addressed indexes from
allowlisted local `.txt` publications. Raw and canonical hashes, source,
document and edition identities, trust-policy decisions, licenses and index
integrity are validated independently before evidence can enter retrieval.
Invalid, revoked, partial or tampered indexes fail closed; a previously
validated last-known-good index may be used without weakening its policy
binding. Publication text remains `DATA_ONLY` and cannot invoke experts,
network access or navigation mathematics.

Index schema v2 adds immutable canonical occurrence positions to every chunk.
Offsets use UTF-16 code units over NFC/LF canonical text and are bound to the
index identity and artifact hash. Complete-line occurrences resolve to stable
edition-and-offset identities, so overlapping chunks deduplicate the same
source occurrence while identical text at different locations stays distinct.
Schema v1 indexes remain readable, but cannot claim occurrence-sensitive
verification capability.

## Phase 2E independent claim verification boundary

`verification/` validates externally supplied claim contracts independently of
retrieval and answer construction. Exact-span claims are bound to selected
evidence content and hashes; structured facts use strict typed registries,
scope and qualifier rules. Unsupported, contradicted, ambiguous, historical,
revoked or malformed claims cannot produce verifier approval or citations.
Approvals are immutable and claim-bound, and insertion order cannot change the
functional result.

The runtime remains `PLAN_ONLY`: it performs no claim generation, expert
execution, live/web retrieval or navigation calculation. Phase 2E and the
occurrence-position extension preserve the Phase 2A conflict rules and the
Phase 2B citation boundary.

## Phase 2F evidence-bound claim planning boundary

`verification/claim-planner.js` can derive deterministic exact-span FACT
claims only from complete canonical lines in already selected v2 offline
evidence. Every candidate is bound to immutable evidence hashes, UTF-16
offsets and a canonical occurrence identity before the independent Phase 2E
verifier sees it. Overlapping chunks deduplicate the same document occurrence;
truncated lines, legacy indexes, malformed provenance and query-unrelated text
fail closed. Caller-supplied claims retain the existing Phase 2E path.

Planning is extractive rather than free-form: publication text is copied
exactly and remains `DATA_ONLY`. The runtime stays `PLAN_ONLY`, performs no
model or expert execution, makes no network request, and activates no
navigation mathematics.
