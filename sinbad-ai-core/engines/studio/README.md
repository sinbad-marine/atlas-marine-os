# Sinbad Studio Engine 0.1

Sinbad Studio Engine is an offline-first, inert planning boundary for web,
software and animation work. Version 0.1 produces deterministic project plans;
it does not write files, run commands, call a model, access a network, modify
Sinbad Core or publish a result.

The returned contract is always `PLAN_ONLY`. Requests involving production,
Core writes, destructive actions, external model/API use, secrets, personal
data, purchases or subscriptions surface an explicit approval gate. Grok and
Gemini are optional online reviewers and are never offline dependencies.

Future implementation adapters must live outside this module and must preserve
the `SANDBOX_ONLY`, `NO_CORE_WRITE`, `NO_PRODUCTION_WRITE`, `NO_NETWORK`,
`NO_SECRETS`, `NO_PUBLISH` and `HUMAN_REVIEW_REQUIRED` constraints unless a
separate, explicit and auditable authorization boundary grants one exact action.
