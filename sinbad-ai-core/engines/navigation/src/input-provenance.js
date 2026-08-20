"use strict";

const SOURCE_TYPES = Object.freeze({
  LIVE_SENSOR: "LIVE_SENSOR",
  LIVE_SERVICE: "LIVE_SERVICE",
  MANUAL_OBSERVATION: "MANUAL_OBSERVATION",
  STATIC_PUBLICATION: "STATIC_PUBLICATION"
});

function requiredText(value, name) {
  const result = String(value || "").trim();
  if (!result) throw new TypeError(`${name} is required`);
  return result;
}

function timestamp(value, name) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date;
}

function positiveAge(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new RangeError("maxAgeSeconds must be positive");
  return number;
}

function assessInputProvenance(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("input provenance must be an object");
  }
  const sourceType = input.sourceType;
  if (!Object.values(SOURCE_TYPES).includes(sourceType)) {
    throw new RangeError("sourceType is not supported");
  }
  const source = requiredText(input.source, "source");
  const now = timestamp(options.now ?? new Date(), "now");
  const reasons = [];
  const warnings = [];
  let observedAt = null;
  let ageSeconds = null;
  let edition = null;

  if (sourceType === SOURCE_TYPES.STATIC_PUBLICATION) {
    edition = requiredText(input.edition, "edition");
    if (input.effectiveAt != null) {
      const effectiveAt = timestamp(input.effectiveAt, "effectiveAt");
      if (effectiveAt.getTime() > now.getTime()) reasons.push("publication is not yet effective");
    }
    warnings.push("Publication currency and applicable corrections must be checked before operational use");
  } else {
    observedAt = timestamp(input.observedAt, "observedAt");
    ageSeconds = (now.getTime() - observedAt.getTime()) / 1000;
    if (ageSeconds < -1) reasons.push("observation timestamp is in the future");
    const maxAgeSeconds = positiveAge(options.maxAgeSeconds ?? input.maxAgeSeconds);
    if (ageSeconds > maxAgeSeconds) reasons.push("observation exceeds maximum permitted age");
    if (input.sequence == null && sourceType === SOURCE_TYPES.LIVE_SENSOR) {
      warnings.push("Live sensor input has no sequence identifier; duplicate or missing samples cannot be detected");
    }
  }

  return {
    status: reasons.length === 0 ? "PASS" : "HOLD",
    sourceType,
    source,
    edition,
    observedAt: observedAt ? observedAt.toISOString() : null,
    ageSeconds,
    reasons,
    warnings
  };
}

function assessInputSet(inputs, policies, options = {}) {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
    throw new TypeError("inputs must be an object keyed by input name");
  }
  if (!policies || typeof policies !== "object" || Array.isArray(policies)) {
    throw new TypeError("policies must be an object keyed by input name");
  }
  const results = {};
  const reasons = [];
  for (const [name, policy] of Object.entries(policies)) {
    if (!(name in inputs)) {
      results[name] = { status: "HOLD", reasons: ["required input is missing"] };
      reasons.push(`${name}: required input is missing`);
      continue;
    }
    results[name] = assessInputProvenance(inputs[name], { ...policy, now: options.now });
    for (const reason of results[name].reasons) reasons.push(`${name}: ${reason}`);
  }
  return { status: reasons.length === 0 ? "PASS" : "HOLD", results, reasons };
}

module.exports = { SOURCE_TYPES, assessInputProvenance, assessInputSet };
