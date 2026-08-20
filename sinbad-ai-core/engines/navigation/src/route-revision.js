"use strict";

const crypto = require("node:crypto");

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

function digest(value) {
  return crypto.createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function requiredText(value, name) {
  const text = String(value || "").trim();
  if (!text) throw new TypeError(`${name} is required`);
  return text;
}

function normalizeTimestamp(value) {
  const timestamp = value == null ? new Date() : new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw new TypeError("createdAt must be a valid timestamp");
  return timestamp.toISOString();
}

function createRouteRevision(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("revision options must be an object");
  }
  const payload = {
    schemaVersion: 1,
    sequence: Number(options.sequence),
    createdAt: normalizeTimestamp(options.createdAt),
    author: requiredText(options.author, "author"),
    reason: requiredText(options.reason, "reason"),
    previousRevisionHash: options.previousRevisionHash == null
      ? null
      : requiredText(options.previousRevisionHash, "previousRevisionHash"),
    routePlan: options.routePlan
  };
  if (!Number.isSafeInteger(payload.sequence) || payload.sequence < 1) {
    throw new RangeError("sequence must be a positive integer");
  }
  if (!payload.routePlan || typeof payload.routePlan !== "object" || Array.isArray(payload.routePlan)) {
    throw new TypeError("routePlan must be an object");
  }
  if (payload.sequence === 1 && payload.previousRevisionHash !== null) {
    throw new RangeError("first revision must not have a previousRevisionHash");
  }
  if (payload.sequence > 1 && payload.previousRevisionHash === null) {
    throw new RangeError("subsequent revisions require previousRevisionHash");
  }
  return Object.freeze({ ...payload, revisionHash: digest(payload) });
}

function verifyRouteRevision(revision) {
  if (!revision || typeof revision !== "object" || Array.isArray(revision)) {
    return { valid: false, reason: "revision must be an object" };
  }
  const { revisionHash, ...payload } = revision;
  if (typeof revisionHash !== "string" || !/^[a-f0-9]{64}$/.test(revisionHash)) {
    return { valid: false, reason: "revisionHash is missing or malformed" };
  }
  const expectedHash = digest(payload);
  return expectedHash === revisionHash
    ? { valid: true, expectedHash }
    : { valid: false, reason: "revision content does not match revisionHash", expectedHash };
}

function verifyRevisionChain(revisions) {
  if (!Array.isArray(revisions) || revisions.length === 0) {
    return { valid: false, reason: "revision chain must not be empty" };
  }
  for (let index = 0; index < revisions.length; index += 1) {
    const verification = verifyRouteRevision(revisions[index]);
    if (!verification.valid) return { ...verification, failedIndex: index };
    if (revisions[index].sequence !== index + 1) {
      return { valid: false, reason: "revision sequence is not contiguous", failedIndex: index };
    }
    const expectedPrevious = index === 0 ? null : revisions[index - 1].revisionHash;
    if (revisions[index].previousRevisionHash !== expectedPrevious) {
      return { valid: false, reason: "previous revision link is broken", failedIndex: index };
    }
  }
  return { valid: true, headHash: revisions.at(-1).revisionHash, revisionCount: revisions.length };
}

module.exports = { canonicalize, digest, createRouteRevision, verifyRouteRevision, verifyRevisionChain };
