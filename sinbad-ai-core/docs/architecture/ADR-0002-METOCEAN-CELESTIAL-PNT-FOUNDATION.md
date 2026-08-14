# ADR-0002: MetOcean, Celestial, and PNT Contract Foundation

- Status: Accepted as inert contract foundation; live capability not authorized
- Scope: Common sensor observations, MetOcean, celestial observations, and future PNT integration

## Decision

Use one vendor-neutral observation foundation with exact versioned contracts for device/channel identity, observation class (`RAW`, `CORRECTED`, `DERIVED`, `EXTERNAL`), unit, exact time and uncertainty, calibration, provenance, quality, uncertainty, and evidence references. Binary camera material remains outside core records and is linked by content-addressed evidence reference.

MetOcean observations and forecast products remain distinct. `ExternalWeatherProduct` represents forecasts, nowcasts, or official warnings; it never masquerades as an observation. Official hazards require matching immutable product and scope hashes within the product validity window and retain priority/provenance rather than being overwritten by derived data. The current binding is explicitly `UNVERIFIED`: hash/scope/time matching is not issuer authentication, and live use remains blocked until signature/certificate verification exists.

Human celestial entry and future automated image processing use the same `CelestialObservation` contract, including time uncertainty, body, raw sight, corrections, LOP/fix, covariance, ephemeris version/hash, quality, and evidence.

`PntObservation` carries source health/integrity and protection/alert limits. A `VALID` observation whose protection limit exceeds its alert limit is rejected. The current inert package cannot emit an accepted PNT solution; `PntSolution` v1 represents rejected candidates only and requires operational-envelope and authorization hashes. This preserves GNSS-independent and explicitly no-GNSS future modes without granting navigation authority.

`marine-capability-registry.js` exposes contract validation only. `marine-contract-facade.js` is the single intended internal validation/serialization choke point and enforces capability-to-contract-kind mapping. Live sensors, PNT solution production, and control remain default-off and blocked.

## Deferred to separately authorized work

- physical sensor drivers and vendor protocol adapters;
- weather forecast or nowcast algorithms;
- camera-based celestial-body recognition;
- complete sight-reduction or navigation-solution engines;
- live vessel control, actuators, or safety-critical automation.

Hardware protocols terminate at future edge adapters/plugins and do not enter core domain contracts.
