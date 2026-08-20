"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "package-lock.json",
  ".npmignore",
  "docs/API.md",
  "docs/SCOPE_AND_LIMITS.md",
  "docs/THREAT_MODEL.md",
  "docs/PROVENANCE.md",
  "docs/RELEASE_CHECKLIST.md",
  "docs/VALIDATION_PLAN.md",
  "validation/geographiclib-wellington-salamanca.json"
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`missing release files: ${missing.join(", ")}`);

const packageJson = require(path.join(root, "package.json"));
const lock = require(path.join(root, "package-lock.json"));
if (packageJson.private !== true) throw new Error("package must remain private until provenance is resolved");
if (packageJson.license !== "UNLICENSED") throw new Error("license must remain UNLICENSED until provenance is resolved");
if (!Array.isArray(packageJson.files) || !packageJson.files.includes("src/") || !packageJson.files.includes("docs/")) {
  throw new Error("package files allowlist is missing required runtime or documentation directories");
}
if (lock.packages[""].version !== packageJson.version) throw new Error("package and lock versions differ");
if (lock.packages[""].dependencies["geographiclib-geodesic"] !== packageJson.dependencies["geographiclib-geodesic"]) {
  throw new Error("dependency declarations differ between package and lock");
}

const api = require(root);
const requiredExports = [
  "EARTH_MODELS", "inverseRoute", "directRoute", "calculateRoutePlan",
  "createRouteRevision", "verifyRevisionChain", "verifyInverseAgainstReference",
  "assessRouteRelease", "assessInputProvenance", "assessPositionConsensus",
  "quantities", "calculateDistanceRun"
];
const missingExports = requiredExports.filter((name) => !(name in api));
if (missingExports.length) throw new Error(`missing public API exports: ${missingExports.join(", ")}`);

console.log(`Release audit PASS: ${requiredFiles.length} files and ${requiredExports.length} public exports verified.`);
