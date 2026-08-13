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

## Phase 2G query-claim coverage boundary

`verification/query-coverage-gate.js` requires the complete set of principal
query tokens to be substantially represented by the authentic Phase 2F claim
plan. Coverage results are immutable and bound to the transaction and normalized
query hash. Partial or incidental line matches stop as source insufficiency;
forged, copied or replayed coverage artifacts are invalid claims.

## Phase 2H verified answer composition boundary

`grounding/verified-answer-composer.js` assembles answer text only from claims
that passed independent verification and received at least one resolved
citation. Claims are ordered deterministically by identity and repeated exact
statements are emitted once. The composition keeps every contributing claim ID,
so repeated statements intentionally have a many-claims-to-one-text mapping.
Invalid composition stops before answer, citation or evidence output. The layer
remains extractive and `PLAN_ONLY`.

Phase 2H intentionally advances the grounded-answer and grounded-orchestrator
contract version strings to `2H`; exact-version consumers must upgrade with
this boundary.

## Phase 2I answer-citation map boundary

The verified composer emits an immutable citation map for the final extractive
answer. Every unique answer segment carries exact UTF-16 code-unit offsets, a
SHA-256 statement hash, all contributing claim identities and their resolved
citation identities. Per-claim bindings preserve which citations support each
claim even when identical visible text is deduplicated. The complete answer is
hash-bound, runtime offset/hash invariants fail closed, claim cardinality is
bounded, and invalid composition exposes no segments. Phase 2I advances the
grounded-answer and orchestrator contract versions to `2I`.

## Phase 2J independent citation-map verification boundary

`verification/answer-citation-map-verifier.js` independently reconstructs the
trust checks for the Phase 2I manifest without importing the composer. It
verifies the complete answer hash, contiguous UTF-16 segment coverage, segment
hashes, unique claim coverage, exact per-claim citation bindings and the absence
of unused citations. Copied verifier results are unauthentic, and any mismatch
removes answer, citations, evidence use and composition output. The grounded
answer and orchestrator contract versions advance to `2J`.

Verifier authenticity is checked only inside the synchronous pipeline trust
boundary. The serialized `mapVerification` field in the final answer is an
observational report, not a portable authentication token; downstream systems
must trust the grounded-answer producer rather than attempting to re-authenticate
the copied report object. Unknown shared audit stages are labeled `UNKNOWN`
instead of being silently attributed to an established phase.

## Phase 2K transaction-bound grounded-answer seal

`verification/grounded-answer-seal.js` binds every successfully grounded plan
to its transaction identifier, normalized query hash, verified answer hash,
map-verifier version and canonical selected-evidence set. The seal is immutable,
deterministic and authentic only inside the producing process. Replay across any
bound field fails, and missing or invalid sealing suppresses the grounded answer
and returns a pipeline error. The orchestrator contract advances to `2K`.

## Phase 2L grounded-answer release gate

`verification/grounded-answer-release-gate.js` permits a grounded answer to
leave the Core boundary only when its authentic Phase 2K seal remains bound to
the transaction, query, answer and selected evidence. The immutable release
manifest additionally binds the exact citation identity set. Copied, forged,
replayed, incomplete or mutated inputs fail closed; release failure suppresses
answer, seal, citations, provenance and confidence. The runtime remains
`PLAN_ONLY`, and the orchestrator contract advances to `2L`.

Release authenticity is deliberately process-local: the serialized manifest
and `releaseHash` are observational transport data, not portable credentials.
Only the producing process may call `isBound` to authorize delivery. Consumers
pinned to the exact `2K` orchestrator version must migrate explicitly to `2L`.

## Phase 2M public grounded-response projection

`delivery/public-grounded-response.js` projects an authentic Phase 2L release
into the only package intended for user-facing adapters. It exposes the exact
verified answer and a deterministic set of presentation-safe citation fields,
while excluding claims, evidence identifiers, evidence content, policy/index
hashes and internal provenance. The projection is bound to the transaction,
answer and release hashes; copied, replayed, altered, duplicate-citation or
unverified-citation inputs fail closed and suppress every delivery surface.
Projection authenticity remains process-local, the runtime stays `PLAN_ONLY`,
and the grounded orchestrator contract advances to `2M`. Public adapters must
honor the bound `TEXT_ONLY_NO_HTML` rendering policy; citation links are exposed
only when they use an absolute `https:` URI. The package declares
`text/plain; charset=utf-8`, rejects unsafe control characters and treats every
remaining string as opaque text. Exact-version consumers pinned to `2L` must
migrate explicitly before accepting the `2M` public-response contract.

## Phase 2N public delivery adapter boundary

`adapters/public-response-adapter.js` independently verifies the serialized
Phase 2M public-response hash and exact contract/policy versions before creating
the minimal view consumed by Atlas UI adapters. It never copies internal claims,
evidence, provenance, seals or orchestration diagnostics. Wrong versions,
pipeline stops, transaction mismatch, altered content, duplicate sources,
unsafe links and invalid hashes return `DELIVERY_BLOCKED` with no answer or
sources. This adapter adds its own `2N` delivery contract without changing the
grounded orchestrator's `2M` version. Delivery authorization is process-local:
copied or serialized orchestration results are rejected even when an attacker
recomputes every observable hash. The orchestrator and adapter must use one
loaded contract-module instance; duplicate bundles and Proxy wrappers fail
closed. Present-but-blank citation URIs are rejected rather than normalized.

## Phase 2O single-use delivery authorization boundary

`delivery/single-use-delivery-authorizer.js` prevents an authentic Phase 2N
delivery from being presented more than once or replayed into another session
or UI channel. Authorization requires a caller-supplied nonce and binds the
delivery hash, transaction, session and channel into an immutable authorization
hash. Delivery-object identity and each session/channel nonce tuple are consumed
once inside the process. Replay, copying, Proxy wrapping, retargeting, malformed
context and changed hashes fail closed without answer or sources. The runtime
remains offline and `PLAN_ONLY`; Phase 2O adds a delivery-authorization contract
without changing the Phase 2M orchestrator version. Replay state is TTL-bounded
and capacity-bounded, identifiers use a strict normalized ASCII grammar, hash
verification shares the Phase 2N delivery schema, and all public denials expose
one uniform reason code.

## Phase 2P terminal delivery receipt boundary

`delivery/terminal-delivery-receipt.js` records exactly one terminal
`DELIVERED` or `FAILED` outcome for an authentic Phase 2O authorization. The
receipt must match the authorized session and channel and carries a strict
attempt identifier. It contains only transaction and binding hashes, outcome
and source count—never answer or source content. Copied, Proxy-wrapped,
retargeted, malformed or repeated receipts fail closed with a uniform denial.
Phase 2P adds an offline receipt contract without changing earlier versions.
Single-use receipt enforcement is process-local. Deployments that require
cross-restart deduplication must persist a receipt or authorization identifier
inside their delivery storage boundary.

## Phase 2Q independent terminal-receipt verification boundary

`verification/terminal-delivery-receipt-verifier.js` independently recomputes
the Phase 2P receipt hash and binds an authentic same-process receipt to the
expected transaction, session, channel, attempt and terminal outcome. Copied,
Proxy-wrapped, altered, retargeted or malformed receipts fail closed with one
response-free denial contract. Successful verification exposes only the
terminal outcome, receipt hash and source count; authorization, delivery, transaction, target and
attempt identifiers remain inside the verification-hash manifest. It never
carries answer or source content. Phase 2Q remains
offline and `PLAN_ONLY` and does not change earlier contract versions. Each
authentic receipt can mint exactly one verification inside the process.

## Phase 2R single-use terminal-closure boundary

`delivery/single-use-terminal-closure.js` consumes an authentic Phase 2Q
verification exactly once after rechecking its hidden transaction, session,
channel, attempt and outcome bindings. The immutable success contract exposes
only outcome, source count, verification hash and a closure hash; target and
closure identifiers remain inside the hash manifest. Copies, clones, Proxy
wrappers, replay and retargeting fail closed uniformly. Phase 2R is same-process,
offline and `PLAN_ONLY`; durable closure storage remains an adapter concern.

## Phase 2S independent terminal-closure verification boundary

`verification/terminal-closure-verifier.js` independently accepts an authentic
same-process Phase 2R closure only once, recomputes its hidden closure manifest
binding and emits a minimal immutable verification result. Copies, clones,
Proxy wrappers, retargeting, malformed closures and repeated verification fail
closed uniformly. Answer, source, transaction, target, attempt, closure and
upstream verification identifiers never cross the 2S output boundary.

## Phase 2T terminal delivery audit-record boundary

`audit/terminal-delivery-audit-record.js` consumes an authentic bound Phase 2S
result once and projects a content-minimized terminal audit record. The record
contains only outcome, source count and closure-chain hashes; audit, closure,
transaction, target and response identifiers remain inside its audit hash.
Copies, clones, Proxy wrappers, replay and retargeting fail closed uniformly.

## Phase 2U independent terminal-audit verification boundary

`verification/terminal-delivery-audit-verifier.js` accepts an authentic Phase
2T audit record once, verifies its hidden audit and closure identifiers, and
emits a minimal immutable terminal verification. Copies, clones, Proxy wrappers,
replay and retargeting fail closed without exposing response or target data.

## Phase 2V mandatory terminal-completion gate

`delivery/terminal-completion-gate.js` is the only Core path that may declare a
delivery terminally complete. It synchronously enforces the full authentic
2P→2Q→2R→2S→2T→2U chain and returns one minimal hash-bound completion. Any
missing, copied, replayed, retargeted or malformed stage fails closed; no
intermediate receipt, closure or audit result is a completion credential.
Phase 2V is intentionally incompatible with callers that pre-consume the same
authorization through standalone Phase 2P–2U APIs: such inputs remain blocked
and cannot be re-entered. Closure and audit identifiers must be generated by a
trusted adapter boundary, never accepted directly from an untrusted client.

## Phase 2W single-use terminal-state transition

`adapters/terminal-state-transition.js` consumes an authentic bound Phase 2V
completion once and maps only `DELIVERED` to `DELIVERY_SUCCEEDED` and `FAILED`
to `DELIVERY_FAILED`. Copies, clones, Proxy wrappers, replay and target mismatch
fail closed. No earlier phase object may update terminal adapter state.

## Phase 2X trusted terminal-delivery adapter

`adapters/trusted-terminal-delivery-adapter.js` is the sole package export and
production entry point for terminal delivery. It is configured once with a
trusted `present` function and accepts only an authentic Phase 2O authorization
through `deliver(authorization)`. Transaction bindings come from that authentic
authorization; attempt, closure, audit and transition identifiers are generated
internally. Only an exact boolean `true` presentation result becomes
`DELIVERED`; false values and exceptions complete as verified `FAILED` states.
Callers cannot supply an outcome or terminal identifiers. Package subpath
exports are closed; production build/lint policy must also reject repository-
relative imports of Phase 2P–2W internals. An in-process identity lock is taken
before presentation, so concurrent replay cannot invoke the presenter twice.
Post-claim chain denial returns `BLOCKED` only after its minimal failure stage
is durably settled. Settlement failure after presentation or state application
returns `TRUSTED_TERMINAL_DELIVERY_UNSETTLED`, preserving known terminal fields
for operator reconciliation. Both paths may emit only fixed content-free
diagnostic codes through the optional trusted `diagnose` hook.
Because an external presentation and a process-local Core record cannot form a
single distributed transaction, a post-presentation `UNSETTLED` result is
non-retriable for that authorization. Durable transport idempotency and any
operator-approved recovery authorization belong to the trusted adapter.

## Phase 2Y durable terminal idempotency

Phase 2Y requires a trusted durable idempotency store validated by
`adapters/durable-idempotency-store.js`. Before any presentation side effect,
the adapter derives a content-free SHA-256 key from the authentic transaction,
session, channel and delivery hash, then awaits an atomic `claim(key)`. Only an
exact boolean `true` permits presentation. A denial, exception or ambiguous
claim result fails closed before presentation and the same authorization is not
retried. After Core applies terminal state, `settle(key, summary)` persists only
status, terminal state, outcome and transition hash. Store implementations must
provide durable uniqueness across all application instances; an in-memory Set
is valid only as a test double. Stores must declare the exact Phase 2Y store
version, `durable: true` and a positive `claimLeaseMs`. The lease policy must
make ambiguous claim timeouts recoverable without permitting two live winners.

## Phase 2Z Supabase fenced idempotency store

`@sinbad-ai/core-terminal-delivery/supabase-idempotency-store` implements the
Phase 2Y contract over two service-role-only Postgres RPCs. Claim is one atomic
insert-or-expired-lease-takeover and returns a database-generated UUID fencing
token. The token stays inside the store instance and is mandatory for settle;
stale or expired holders cannot overwrite a newer claim. The table has RLS,
grants no access to public/anon/authenticated roles, validates 64-character
claim keys and caps settlement JSON at 4096 bytes. Configure `claimLeaseMs`
longer than the maximum bounded presentation operation. Since lease recovery
can repeat an external side effect after a crashed holder, the trusted presenter
must also use its transport's native idempotency facility where available.

## Phase 3A settle-only reconciliation

The trusted adapter now exposes `reconcile(unsettled)` for an applied terminal
state whose durable settlement response is ambiguous. It accepts only the exact
same-process, full-terminal-field `UNSETTLED` object created by that adapter
instance and retries only the original fenced
`settle(key, summary)` operation. It never calls `present`, never generates a
new terminal chain and never exposes the claim key or lease token. A successful
retry returns `TRUSTED_TERMINAL_DELIVERY_RECONCILED` with the already-known
terminal fields and consumes the reconciliation credential. Copies, clones,
Proxy wrappers, fabricated values and replay fail closed. Process restart loses
this capability; cross-restart operator recovery requires a separate audited
database workflow and must never repeat presentation blindly.
Chain-block settlement failures do not receive this reconciliation capability
and remain routed to audited operator handling.
