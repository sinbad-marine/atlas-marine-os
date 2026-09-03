# Founder/Owner MFA and high-risk authorization

Sinbad has one active Founder principal. The principal is an existing Supabase
Auth **user UUID**; no email, password, service-role key, TOTP seed or recovery
code belongs in this repository.

## Production seed (controlled operation)

After the migration is applied, an authorized database operator obtains the
existing founder's UUID from the Supabase Auth dashboard and executes the
following once in a protected SQL session. Replace the placeholder at run time;
do not commit the resulting UUID.

```sql
begin;
insert into public.founder_principals(user_id, activated_at)
values ('00000000-0000-0000-0000-000000000000'::uuid, now());
insert into public.founder_security_audit(principal_user_id,event_type,details)
values ('00000000-0000-0000-0000-000000000000'::uuid,'principal_seeded',
        jsonb_build_object('method','controlled-production-seed'));
commit;
```

The unique partial index rejects a second active founder. Suspension and
replacement require a separate break-glass runbook and an append-only audit
event; they are deliberately not client operations.

## Owner enrollment

1. Sign in with the founder's existing Supabase account.
2. In **Account & Password**, choose **Set up authenticator**.
3. Scan the QR code with a TOTP authenticator and store recovery material in the
   Owner's offline password vault. Never paste the TOTP secret into chat or code.
4. Enter the current six-digit code. Supabase `challengeAndVerify` upgrades the
   session to `aal2`.
5. Reauthenticate when Supabase reports the current session below `aal2`.

The browser helper `founder-owner-mfa.js` uses only the official Supabase MFA
methods: `enroll`, `challengeAndVerify`, `listFactors`,
`getAuthenticatorAssuranceLevel`, and `unenroll`.

## High-risk action protocol

Security, identity/role, core, release and destructive operations must:

1. require an authenticated active Founder;
2. require the current Auth session to be `aal2`;
3. call `founder-owner-step-up` with the exact action, resource and canonical
   command;
4. receive a five-minute, session-bound authorization and a nonce shown only
   once;
5. have the trusted action Edge Function atomically consume that proof using
   `consume_founder_step_up` immediately before executing the exact command;
6. fail closed if the action/resource/command hash differs, the nonce was used,
   the session changed, the grant expired, or the Founder is suspended.

Consuming a proof by itself is not permission to execute arbitrary code. Branch
protection, CI checks, security review, legal constraints and release policies
remain mandatory. A grant must never authorize a wildcard action or resource.

## Integration boundary

The step-up function is the shared foundation. Each high-risk Edge Function
must consume the proof itself; a client-side “MFA passed” flag is not a security
control. Ordinary non-destructive Owner operations continue to use workspace
RBAC without a step-up grant.

The existing `manage-members` function applies this boundary concretely:
member invitations remain an ordinary auditable Owner operation, while role
changes and activation/suspension require an exact `identity.member.set_role`
or `identity.member.set_active` grant and consume it server-side.
