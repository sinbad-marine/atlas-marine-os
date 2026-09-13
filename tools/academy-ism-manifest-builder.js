'use strict';
// Structure only. No ISM/ISPS/MLC regulatory content, real or fabricated, is
// ever produced here, including for demonstration purposes. Every content
// field below is the literal placeholder marker until a verified v4.1 Master
// Source Manifest (Grok candidate -> Gemini independent verification -> Owner)
// is supplied separately; only that manifest may ever replace the marker.
const crypto = require('node:crypto');

const CONTENT_PENDING_MARKER = 'CONTENT_PENDING_GROK_GEMINI_VERIFICATION';
const MANIFEST_SCHEMA_VERSION = 'sinbad-human-review-manifest/1';
const ALLOWED_PACKAGE_SIZES = Object.freeze([25, 50, 100, 250]);
const MAX_QUESTIONS_PER_MANIFEST = 250;
const HEX64 = /^[a-f0-9]{64}$/;

class ManifestValidationError extends Error {
  constructor(code, details) {
    super(`ACADEMY_ISM_MANIFEST_${code}`);
    this.name = 'ManifestValidationError';
    this.code = `ACADEMY_ISM_MANIFEST_${code}`;
    this.details = details;
  }
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input), 'utf8').digest('hex');
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedString(value, max) {
  return typeof value === 'string' && value.length >= 1 && value.length <= max;
}

// This payload shape (moduleCode/flagAdministration/status) is Sinbad's own
// convention for the free-form questionPayload field, not part of the fixed
// human-review-contract wire shape. flagAdministration is intentionally
// nullable: null means universal IMO/ILO content, a code means a specific
// flag administration's national material (see the flag_administration
// dimension added in supabase/migrations/20260906000100).
function buildPlaceholderQuestion({ questionId, moduleCode, flagAdministration = null, sourceRevision }) {
  if (!isBoundedString(questionId, 200)) throw new ManifestValidationError('QUESTION_ID_INVALID', { questionId });
  if (!isBoundedString(moduleCode, 60)) throw new ManifestValidationError('MODULE_CODE_INVALID', { questionId, moduleCode });
  if (flagAdministration !== null && !isBoundedString(flagAdministration, 40)) {
    throw new ManifestValidationError('FLAG_ADMINISTRATION_INVALID', { questionId, flagAdministration });
  }
  return {
    questionId,
    sourceRevision,
    contentSha256: sha256Hex(`${CONTENT_PENDING_MARKER}:${questionId}`),
    technicalStatus: CONTENT_PENDING_MARKER,
    questionPayload: { status: CONTENT_PENDING_MARKER, moduleCode, flagAdministration },
    evidencePayload: { status: CONTENT_PENDING_MARKER },
  };
}

function buildManifest({
  sourceBatchId,
  sourceRevision,
  title,
  packageSize,
  expectedCount,
  missingCount = 0,
  deferredCount = 0,
  questionIds,
  moduleCode,
  flagAdministration = null,
}) {
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    throw new ManifestValidationError('QUESTION_IDS_REQUIRED', { questionIds });
  }
  const questions = questionIds.map((questionId) =>
    buildPlaceholderQuestion({ questionId, moduleCode, flagAdministration, sourceRevision }),
  );
  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    sourceBatchId,
    sourceRevision,
    title,
    packageSize,
    expectedCount,
    presentCount: questions.length,
    missingCount,
    deferredCount,
    questions,
  };
  manifest.contentSha256 = sha256Hex(questions.map((q) => q.contentSha256).join(':'));
  return manifest;
}

// Mirrors, field for field, the checks supabase/functions/human-review/index.ts
// and human_review_import_package() apply server-side. This never replaces
// that server-side enforcement (per the contract's clientCountsTrusted:false /
// clientCompletionTrusted:false) - it exists so a malformed manifest fails
// fast and locally, before ever reaching the network.
function validateManifest(manifest) {
  const errors = [];
  const fail = (code, details) => errors.push({ code: `ACADEMY_ISM_MANIFEST_${code}`, details });

  if (!isPlainObject(manifest)) {
    throw new ManifestValidationError('NOT_AN_OBJECT', { manifest });
  }
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    fail('SCHEMA_VERSION_MISMATCH', { expected: MANIFEST_SCHEMA_VERSION, actual: manifest.schemaVersion });
  }
  if (!isBoundedString(manifest.sourceBatchId, 200)) fail('SOURCE_BATCH_ID_INVALID', { value: manifest.sourceBatchId });
  if (!isBoundedString(manifest.sourceRevision, 200)) fail('SOURCE_REVISION_INVALID', { value: manifest.sourceRevision });
  // title and packageSize are an ISM-specific requirement enforced only here, not
  // in the shared config/human-review-contract.json's requiredManifestFields.
  // Owner decision, 2026-09-06: adding them to the shared contract could affect
  // GASM's existing import manifests (not independently verified either way),
  // while keeping this ISM-only is zero-risk and keeps the two concerns separate.
  if (!isBoundedString(manifest.title, 200)) fail('TITLE_INVALID', { value: manifest.title });
  if (!HEX64.test(manifest.contentSha256 || '')) fail('CONTENT_SHA256_INVALID', { value: manifest.contentSha256 });
  if (!ALLOWED_PACKAGE_SIZES.includes(manifest.packageSize)) {
    fail('PACKAGE_SIZE_INVALID', { allowed: ALLOWED_PACKAGE_SIZES, value: manifest.packageSize });
  }
  const expected = manifest.expectedCount;
  if (!Number.isInteger(expected) || expected < 1 || expected > (manifest.packageSize || MAX_QUESTIONS_PER_MANIFEST)) {
    fail('EXPECTED_COUNT_INVALID', { value: expected });
  }
  if (!Number.isInteger(manifest.missingCount) || manifest.missingCount < 0) fail('MISSING_COUNT_INVALID', { value: manifest.missingCount });
  if (!Number.isInteger(manifest.deferredCount) || manifest.deferredCount < 0) fail('DEFERRED_COUNT_INVALID', { value: manifest.deferredCount });
  if (!Array.isArray(manifest.questions) || manifest.questions.length > MAX_QUESTIONS_PER_MANIFEST) {
    fail('QUESTIONS_ARRAY_INVALID', { length: Array.isArray(manifest.questions) ? manifest.questions.length : null });
  }
  const present = Array.isArray(manifest.questions) ? manifest.questions.length : -1;
  if (typeof manifest.presentCount === 'number' && manifest.presentCount !== present) {
    fail('PRESENT_COUNT_MISMATCH', { declared: manifest.presentCount, actual: present });
  }
  if (Number.isInteger(expected) && Number.isInteger(manifest.missingCount) && Number.isInteger(manifest.deferredCount) && present >= 0) {
    if (present + manifest.missingCount + manifest.deferredCount !== expected) {
      fail('COUNT_INVARIANT_VIOLATED', { present, missing: manifest.missingCount, deferred: manifest.deferredCount, expected });
    }
  }
  if (Array.isArray(manifest.questions)) {
    const seenIds = new Set();
    manifest.questions.forEach((q, index) => {
      const at = { index };
      if (!isPlainObject(q)) return fail('QUESTION_NOT_AN_OBJECT', at);
      if (!isBoundedString(q.questionId, 200)) fail('QUESTION_ID_INVALID', { ...at, value: q.questionId });
      else if (seenIds.has(q.questionId)) fail('QUESTION_ID_DUPLICATE', { ...at, value: q.questionId });
      else seenIds.add(q.questionId);
      if (!HEX64.test(q.contentSha256 || '')) fail('QUESTION_CONTENT_SHA256_INVALID', { ...at, value: q.contentSha256 });
      if (!isBoundedString(q.technicalStatus, 100)) fail('QUESTION_TECHNICAL_STATUS_INVALID', { ...at, value: q.technicalStatus });
      if (!isPlainObject(q.questionPayload)) fail('QUESTION_PAYLOAD_INVALID', { ...at, value: q.questionPayload });
      if (q.evidencePayload !== undefined && !isPlainObject(q.evidencePayload)) fail('QUESTION_EVIDENCE_PAYLOAD_INVALID', { ...at, value: q.evidencePayload });
    });
  }
  if (errors.length > 0) throw new ManifestValidationError('INVALID', errors);
  return true;
}

// The exact request body shape supabase/functions/human-review/index.ts reads
// for action:'import_package'. stepUp is the MFA step-up authorization token;
// this module never produces one, since issuing it requires an authenticated
// Owner session this offline builder does not have.
function toImportPackageRequestBody(manifest, { requestId, stepUp } = {}) {
  validateManifest(manifest);
  return {
    action: 'import_package',
    requestId: requestId || crypto.randomUUID(),
    stepUp: stepUp ?? null,
    manifest,
  };
}

module.exports = {
  CONTENT_PENDING_MARKER,
  MANIFEST_SCHEMA_VERSION,
  ALLOWED_PACKAGE_SIZES,
  MAX_QUESTIONS_PER_MANIFEST,
  ManifestValidationError,
  sha256Hex,
  buildPlaceholderQuestion,
  buildManifest,
  validateManifest,
  toImportPackageRequestBody,
};

if (require.main === module) {
  const manifest = buildManifest({
    sourceBatchId: 'ISM-M1-CORE-DRAFT',
    sourceRevision: 'draft-0',
    title: 'ISM Code foundations - structure only, no content yet',
    packageSize: 25,
    expectedCount: 3,
    questionIds: ['ISM-M1-001', 'ISM-M1-002', 'ISM-M1-003'],
    moduleCode: 'ism-code-foundations',
  });
  validateManifest(manifest);
  console.log(JSON.stringify(toImportPackageRequestBody(manifest), null, 2));
}
