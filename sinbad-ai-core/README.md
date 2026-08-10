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
