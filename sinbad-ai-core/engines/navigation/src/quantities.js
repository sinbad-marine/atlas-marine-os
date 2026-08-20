"use strict";

const DEFINITIONS = Object.freeze({
  distance: Object.freeze({ canonicalUnit: "NM", factors: Object.freeze({ NM: 1, m: 1 / 1852, km: 1 / 1.852 }) }),
  speed: Object.freeze({ canonicalUnit: "kn", factors: Object.freeze({ kn: 1, "m/s": 3600 / 1852, "km/h": 1 / 1.852 }) }),
  duration: Object.freeze({ canonicalUnit: "h", factors: Object.freeze({ h: 1, min: 1 / 60, s: 1 / 3600 }) }),
  angle: Object.freeze({ canonicalUnit: "deg", factors: Object.freeze({ deg: 1, rad: 180 / Math.PI }) })
});

function definition(kind) {
  if (!(kind in DEFINITIONS)) throw new RangeError(`unsupported quantity kind: ${kind}`);
  return DEFINITIONS[kind];
}

function quantity(input, kind, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError(`${kind} must be an object with value and unit`);
  }
  const value = Number(input.value);
  if (!Number.isFinite(value)) throw new TypeError(`${kind}.value must be a finite number`);
  const unit = String(input.unit || "").trim();
  const spec = definition(kind);
  if (!(unit in spec.factors)) {
    throw new RangeError(`${kind}.unit must be one of: ${Object.keys(spec.factors).join(", ")}`);
  }
  if (options.nonNegative && value < 0) throw new RangeError(`${kind}.value must not be negative`);
  const canonicalValue = value * spec.factors[unit];
  return Object.freeze({
    kind,
    input: Object.freeze({ value, unit }),
    value: canonicalValue,
    unit: spec.canonicalUnit
  });
}

function distance(input, options = { nonNegative: true }) {
  return quantity(input, "distance", options);
}

function speed(input, options = { nonNegative: true }) {
  return quantity(input, "speed", options);
}

function duration(input, options = { nonNegative: true }) {
  return quantity(input, "duration", options);
}

function angle(input) {
  return quantity(input, "angle");
}

function convert(input, kind, targetUnit, options = {}) {
  const canonical = quantity(input, kind, options);
  const spec = definition(kind);
  if (!(targetUnit in spec.factors)) {
    throw new RangeError(`target unit must be one of: ${Object.keys(spec.factors).join(", ")}`);
  }
  return Object.freeze({ kind, value: canonical.value / spec.factors[targetUnit], unit: targetUnit });
}

function calculateDistanceRun(speedInput, durationInput) {
  const speedKnots = speed(speedInput);
  const hours = duration(durationInput);
  return Object.freeze({
    distance: Object.freeze({ value: speedKnots.value * hours.value, unit: "NM" }),
    inputs: Object.freeze({ speed: speedKnots, duration: hours })
  });
}

module.exports = { DEFINITIONS, quantity, distance, speed, duration, angle, convert, calculateDistanceRun };
