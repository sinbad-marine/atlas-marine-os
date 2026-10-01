# SINBAD Secure Auth Handoff, phase P1: the pure security core

Status: implemented and tested; **nothing is wired, no credential has ever been handled, not Owner-accepted**. Nothing here records an acceptance.
Base: `origin/main` `bb4e6837f8b4a2626784e757bedaff06397e4cd1`. Built as SINBAD **TASK-12** through the accepted Participation Gate (opened, preflight PASS, delegated, then implemented; the result is ingested back through the gate). Owner GO: "SINBAD SECURE AUTH HANDOFF - P1 IMPLEMENTATION GO", following the Owner decision to accept the hybrid direction (local broker, Owner Console ALLOW ONCE card, later a server-side one-time grant).

## What P1 covers, and what it does not

Covered: the **pure, deterministic logic** that decides what the Owner authorized and when it may be used: a bounded grant, its state machine, single-use and replay protection, expiry, STOP and cleanup semantics, secret scanning and redaction, and a participation-safe event schema.

Not covered, and not done: no real JWT or credential, no browser session, no clipboard, no environment credential, no cloud call, no Supabase connection, no local broker, no Owner Console or `app.js` change, no change to the accepted A3 capture client, no change to `sinbad-answer`, no migration. P2 (local broker), P3 (Owner Console card) and P4 (server-side grant, still on HOLD) are not started. Nothing in the repository calls this module (a test checks that).

## Files

`sinbad-ai-core/auth-handoff/handoff-v0.js` (the logic), `sinbad-ai-core/auth-handoff/index.js`, `tests/sinbad-auth-handoff-v0.test.js`, this document. The module requires only `node:crypto`; time is injected; there is no randomness, environment, file, network or child process (a test checks the source).

## The key design choice: the module never holds a credential

A raw token is never an argument. The caller passes an **access-kind descriptor**: `{kind: 'ACCESS', expiresAt, fingerprint}`, where the fingerprint is the first 16 hex characters of the sha256 of the token, computed by the caller (`fingerprintOf`). The logic therefore cannot leak what it never receives, and it can still notice a **credential swap** (a refreshed or different token) mid-grant. A descriptor containing refresh material in any form is refused and revokes the grant.

**Authorization and credential possession are separate records.** `AUTHORIZED` and `PAIRED` say the Owner approved and the channel was proven; only `ACTIVE` says a credential descriptor is bound. Approval never implies possession.

## The grant

Bound to: task id, purpose, workspace (uuid), one capability (allowlist: `sinbad-answer.invoke`), a call ceiling, and a lifetime. Hard limits: ceiling 1 to 36, lifetime 60 seconds to 60 minutes, pairing window 120 seconds. The effective expiry is the **minimum** of the grant lifetime and the bound credential's own expiry. Any field outside the closed shape, or anything that looks like a secret, is refused.

A grant is created only by `proposeGrant`; a spread copy, a JSON round trip or a look-alike object is not a grant and is refused (a registry of minted objects). Grants are frozen. Two internal values, the nonce hash and the credential fingerprint, live in a **non-enumerable** property: they never appear in `JSON.stringify`, `util.inspect`, the record view or any event, and every terminal state wipes them.

## State machine

```
PROPOSED --Owner ALLOW_ONCE (aal2 step-up, single-use id)--> AUTHORIZED --one-time nonce--> PAIRED --bind ACCESS descriptor--> ACTIVE
   |                                                              |                            |                      |
   +--Owner DENY--> DENIED          wrong nonce / replay --> REVOKED        refresh material --> REVOKED     reserve call / record outcome
                                                                                                             credential swapped --> REVOKED
ACTIVE ends as: COMPLETED (task done) | EXHAUSTED (ceiling reached) | STOPPED (AUTH_REJECTED, RATE_LIMITED, NOT_PRIVILEGED,
                THREE_CONSECUTIVE_ERRORS) | EXPIRED | REVOKED (Owner)
```

Terminal states: COMPLETED, EXHAUSTED, STOPPED, EXPIRED, REVOKED, DENIED. Every terminal transition returns the cleanup directive `{wipeCredential, closeBroker, invalidateNonce}`, drops the bound credential marker and the in-flight marker, and wipes the internal values. Every later operation is refused (`WRONG_STATE`).

## Security rules, as implemented

| Rule | How |
|---|---|
| Owner approval is explicit | `ALLOW_ONCE` needs an `aal2` step-up flag and a single-use authorization id (the caller passes the used ids and records `consumedAuthorizationId`) |
| Single-use pairing | the nonce is stored only as a hash; any wrong nonce or replay **revokes** the grant (it points at a spoofed or duplicated listener); comparison is constant-time |
| Wrong task / workspace / purpose / capability | each is its own refusal code; the grant is unchanged |
| Over the ceiling | at most `maxCalls` reservations; reaching the ceiling ends the grant as EXHAUSTED; one call in flight at a time |
| STOP rules | the A3 rules: 401/403, 429, a non-privileged caller (a missing `sourceAccess` counts as non-privileged), three consecutive errors; a success resets the error run |
| Expiry | checked first on every operation, inclusive at the edge; `tickGrant` turns time passing into EXPIRED |
| Stale pairing | AUTHORIZED but unpaired for 120 seconds expires |
| Credential swap | a call carrying a different fingerprint revokes the grant |
| Refresh token | never a transferable credential: any refresh material in a descriptor, in any key spelling, revokes the grant |
| Fail closed | invalid input, bad time, forged grants and unknown states are refused; a rejection never changes state unless it is itself a fail-closed transition (revoke, expire) |

## Events and leak detection

Events follow a **closed schema**: fixed keys, enumerated kinds and states, and enumerated reason codes only, no free text, so a reason cannot carry a secret. They contain no nonce, hash of a nonce, fingerprint or token. `validateEvent` checks the shape and rescans for secrets.

`scanForSecrets` finds JWTs, bearer headers, `sb_secret_` keys, private-key headers, secret-looking key names and refresh material, and reports **paths and rules, never values**. `redactSecrets` removes what scanning finds (and a redacted record scans clean again). `scanForLiterals` checks serialized output for specific known literals in raw, JSON-escaped, URL-encoded, base64 and hex form and returns counts only. `assertNoSecrets` throws without echoing the secret.

## Tests and mutation results

`tests/sinbad-auth-handoff-v0.test.js`: 25 tests. They use only obviously synthetic values. They cover proposal validation, authorization and step-up, DENY, nonce single use and replay, the credential descriptor, refresh material, call matching, the ceiling, the STOP rules, expiry and the pairing window, terminal states and cleanup, look-alike objects, secret absence in JSON/inspect/record/events, the event schema, scanning, false positives, redaction, literal detection, determinism, module purity, and that nothing wires the module and the accepted A3 files are unchanged (pinned by hash).

Security mutation testing: 38 deliberate mutants, each breaking one rule (for example no aal2 check, nonce comparison always true, refresh material accepted, credential swap not detected, ceiling constants raised, terminal states without cleanup, secrets enumerable, the module reading the clock or importing the filesystem). **All 38 are killed by a failing test; none survives; the source was restored byte for byte.** One check is an intentional defense in depth that cannot fail through the public API: the `OVER_CEILING` check inside `reserveCall` is unreachable because exhaustion ends the grant first (the code is also reported in the terminal-state refusal, which is tested).

## Limits (stated, not hidden)

- **P1 proves the rules, not the transport.** The loopback listener, the handoff to a child process and the browser side do not exist yet; their security is not established here.
- **The step-up is a flag.** The pure logic cannot verify the Owner's proof; P3 must supply `aal2` only from the existing `founder-owner-step-up` result. A caller that lies about it cannot be caught here.
- **The ceiling is enforced on the client side only.** `sinbad-answer` has no per-caller call budget (checked in the code); a process that holds a JWT can call the function directly. A server-enforced ceiling is P4.
- **Memory wiping is a directive.** JavaScript cannot guarantee that a token is erased from memory; P1 holds none, and later phases must say what they can and cannot guarantee.
- **The fingerprint is a value derived from a token** (16 hex characters of a sha256). It stays internal and is never recorded; for a high-entropy token it is not practical to invert, but it is not nothing.
- **Nonces are not generated here** (no randomness). P2 must generate them with a cryptographically secure source of at least 128 bits; the module only checks the length range and compares hashes. Used authorization ids are kept by the caller, so replay protection across process restarts needs P2 to persist them.
- **Constant-time comparison** is used but cannot be proven by a behavioural test.

## What SINBAD can do after this phase that it could not do before

Before: SINBAD had no model of a bounded, single-use, expiring authorization for cloud access; handing over a credential depended on the Owner moving a token by hand.
After: SINBAD has a tested, deterministic security core for the handoff (grant, state machine, replay and expiry protection, leak detection) that a later local broker and Owner Console card can rely on. Nothing is wired and no credential has been handled.

## P2 readiness

P2 (local auth broker and runner wrapper) can start once the Owner decides: where the broker code lives; whether the handoff events go to a new participation ledger shelf; how the Owner step-up evidence reaches the broker; the pairing and port policy; and that the wrapper may call the exported `main(argv, env, deps)` of the accepted A3 client with an in-memory env, so A3 stays unchanged. Verified facts P2 can rely on: the A3 client exports `main(argv, env, deps)`; its credentials come only from that env object; its STOP rules match this module. Not yet verified and to be checked in P2: the browser's behaviour when a page calls a loopback address, and the lifetime of a session token.

## Holds

TASK-11 and A5, A6, Engine Room, Grok, P2, P3 and P4 stay on HOLD. This phase changes no existing file: A3, `app.js`, `sinbad-answer`, migrations, workflows, ARGOS policy and every accepted component are untouched.
