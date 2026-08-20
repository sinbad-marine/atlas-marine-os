# Experts

Expert engines register a name, supported intent and handler. The existing
navigation mathematics engine is consumed through an adapter and remains
unchanged. A null answer means "not handled" and allows safe fall-through.

The installed navigation implementation lives at `../engines/navigation` and
is reachable only through `../adapters/navigation-engine-adapter.js`. Merely
registering, describing or planning an expert must never activate that engine;
execution requires a separate explicit application-layer authorization.

