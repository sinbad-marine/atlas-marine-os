# SINBAD Offline World Brain

This layer defines how Captain Sinbad can become a broad offline knowledge guide
without pretending that an offline snapshot is omniscient or current.

## Architecture

1. `persona.js` keeps Captain Sinbad's identity, teaching style and honesty rules
   independent from any model or document collection.
2. `knowledge-taxonomy.js` routes questions across stable, fast-changing and live
   knowledge domains.
3. `freshness-policy.js` prevents old politics, law, finance, news and similar
   snapshots from being presented as current facts.
4. `knowledge-pack.js` requires source, license, edition, language, snapshot date
   and a SHA-256 content identity before a pack can enter the library.
5. `topic-router.js` selects the relevant knowledge domains before retrieval, so a
   large offline corpus does not become an unranked document dump.
6. `knowledge-catalog.js` installs content-hash-bound packs without overwrite,
   creates deterministic snapshots and excludes stale packs from an answer plan.
7. The existing library ingestion, provenance, retrieval, verification and citation
   pipeline remains the factual boundary. Model memory is not treated as a source.

## Knowledge packs

Future knowledge packs must be openly licensed, public-domain, owner-supplied or
otherwise authorized. Every pack must retain source, license, language, edition,
snapshot date and content hashes. Stable encyclopedic packs may work for years;
current-affairs packs are dated snapshots and require online refresh before claims
about the present are made.

Personal learner memory is stored separately from world knowledge. This prevents a
student preference or a model-generated sentence from silently becoming a fact.
