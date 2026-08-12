# Phase 2Q–2W terminal delivery migration

## Supported production path

Production adapters must use exactly these two entry points:

1. `delivery/terminal-completion-gate.js` → `complete(authorization, context)`
2. `adapters/terminal-state-transition.js` → `transition(completion, context)`

The completion gate internally enforces Phase 2P through Phase 2U. Receipt,
verification, closure and audit modules remain exported for isolated contract
tests and internal composition; they are not independent terminal-state APIs.
This restriction is currently an integration boundary, not a JavaScript module
visibility boundary. Production import linting or adapter package exports must
expose only the two entry points above. Directly calling an intermediate module
can consume an authorization and deliberately makes later completion fail closed.

## Required trusted context

The adapter must generate `attemptId`, `closureId`, `auditId` and `transitionId`
inside its trusted boundary. It must bind them to the authorization's exact
`transactionId`, `sessionId` and `channelId`. Values received directly from a
browser, model response, document or other untrusted input must not be used.

The `outcome` must come from the trusted presentation operation and must be
exactly `DELIVERED` or `FAILED`. It must not be inferred from model text or
supplied by an untrusted client.

## Breaking changes

- An authorization already consumed through standalone Phase 2P cannot enter
  Phase 2V and is deliberately non-retriable.
- Intermediate Phase 2P–2U values cannot update terminal state.
- Phase 2V completions update terminal state once through Phase 2W.
- Authenticity and replay state are process-local. Persisted hashes are audit
  observations, not portable credentials. Durable idempotency remains the
  responsibility of the trusted persistence adapter.
- Phase 2P–2W is one version-coupled unit and must be deployed atomically. A
  partial module upgrade is expected to fail at startup rather than degrade.
- A failure after any single-use stage is non-retriable with the same
  authorization. Record a metric, create a fresh authorized attempt through the
  trusted workflow, and never resume from an intermediate object.

## Rollout checklist

- Remove production calls to standalone terminal Phase 2P–2U APIs.
- Restrict production package exports/import rules to `complete()` and
  `transition()`; keep intermediate imports test/internal-only.
- Generate all binding identifiers inside the trusted adapter.
- Call `complete()` immediately after the trusted presentation result exists.
- Call `transition()` once with the same bound context plus `transitionId`.
- Persist only the minimal terminal transition/audit fields required by policy.
- Treat blocked results uniformly and never fall back to an earlier phase.
- Run the complete SINBAD Core test suite before deployment.
