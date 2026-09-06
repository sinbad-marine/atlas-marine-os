'use strict';
// The shape a human_review_package_questions.question_payload must have for
// step 5 (academy-ism-promote-accepted-package.js) to promote it into
// academy_ism_source_manifest / academy_ism_questions. This is Sinbad's own
// application-level contract for the payload's free-form jsonb content, not
// part of the fixed human-review-contract wire shape (which only says
// questionPayload is an opaque object). Both a future real v4.1 Master
// Source Manifest producer and the step 4 placeholder builder should target
// this shape once they are extended to do so - promotion never invents a
// field this contract requires; a question missing one is rejected, not
// guess-filled.
//
// These enums intentionally mirror the CHECK constraints in
// supabase/migrations/20260906000100_academy_ism_flag_dimension.sql and must
// be kept in sync with that file by hand; there is no single source of truth
// shared between SQL and JS here.
const COMPETENCY_DIMENSIONS = Object.freeze([
  'ism_knowledge', 'dpa_competence', 'isps_knowledge', 'cso_competence', 'mlc_knowledge',
  'audit_competence', 'root_cause_capa', 'flag_ro_understanding', 'yacht_application', 'professional_judgement',
]);
const DIFFICULTIES = Object.freeze(['foundation', 'operational', 'management', 'expert']);
const QUESTION_KINDS = Object.freeze([
  'multiple_choice', 'multiple_response', 'true_false_justify', 'short_answer', 'long_answer',
  'document_interpretation', 'evidence_assessment', 'scenario_decision',
  'audit_finding_classification', 'root_cause_analysis', 'capa_design', 'oral',
]);
const MODULE_CODE_PATTERN = /^[a-z0-9-]{2,60}$/;
const FLAG_ADMINISTRATION_PATTERN = /^[A-Z0-9_]{2,40}$/;

class IsmPayloadValidationError extends Error {
  constructor(errors) {
    super('ACADEMY_ISM_PAYLOAD_INVALID');
    this.name = 'IsmPayloadValidationError';
    this.code = 'ACADEMY_ISM_PAYLOAD_INVALID';
    this.errors = errors;
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isBoundedString(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

// Returns {valid:true} or {valid:false, errors:[{code,detail}]}. Never
// throws; callers decide whether one invalid question should stop the whole
// promotion run or just be skipped and reported.
function checkIsmQuestionPayload(payload) {
  const errors = [];
  const fail = (code, detail) => errors.push({ code, detail });

  if (!isPlainObject(payload)) {
    return { valid: false, errors: [{ code: 'PAYLOAD_NOT_AN_OBJECT', detail: { payload } }] };
  }
  if (!isBoundedString(payload.authority, 1, 200)) fail('AUTHORITY_INVALID', { value: payload.authority });
  if (!MODULE_CODE_PATTERN.test(payload.moduleCode || '')) fail('MODULE_CODE_INVALID', { value: payload.moduleCode });
  if (payload.flagAdministration !== null && payload.flagAdministration !== undefined && !FLAG_ADMINISTRATION_PATTERN.test(payload.flagAdministration)) {
    fail('FLAG_ADMINISTRATION_INVALID', { value: payload.flagAdministration });
  }
  if (!isBoundedString(payload.sourceVersion, 1, 60)) fail('SOURCE_VERSION_INVALID', { value: payload.sourceVersion });
  if (payload.sourceSection !== null && payload.sourceSection !== undefined && typeof payload.sourceSection !== 'string') {
    fail('SOURCE_SECTION_INVALID', { value: payload.sourceSection });
  }
  if (!isBoundedString(payload.learningObjective, 1, 500)) fail('LEARNING_OBJECTIVE_INVALID', { value: payload.learningObjective });
  if (!DIFFICULTIES.includes(payload.difficulty)) fail('DIFFICULTY_INVALID', { value: payload.difficulty });
  if (!COMPETENCY_DIMENSIONS.includes(payload.competencyDimension)) fail('COMPETENCY_DIMENSION_INVALID', { value: payload.competencyDimension });
  if (!QUESTION_KINDS.includes(payload.questionKind)) fail('QUESTION_KIND_INVALID', { value: payload.questionKind });
  if (!isBoundedString(payload.prompt, 1, 5000)) fail('PROMPT_INVALID', { value: payload.prompt });
  if (payload.choices !== null && payload.choices !== undefined && !Array.isArray(payload.choices)) fail('CHOICES_INVALID', { value: payload.choices });
  if (payload.correctAnswer === undefined) fail('CORRECT_ANSWER_MISSING', {});
  if (payload.expectedReasoning !== null && payload.expectedReasoning !== undefined && typeof payload.expectedReasoning !== 'string') {
    fail('EXPECTED_REASONING_INVALID', { value: payload.expectedReasoning });
  }
  if (!isPlainObject(payload.markingRubric)) fail('MARKING_RUBRIC_INVALID', { value: payload.markingRubric });
  if (typeof payload.passThreshold !== 'number' || payload.passThreshold < 0 || payload.passThreshold > 1) {
    fail('PASS_THRESHOLD_INVALID', { value: payload.passThreshold });
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

module.exports = {
  COMPETENCY_DIMENSIONS,
  DIFFICULTIES,
  QUESTION_KINDS,
  MODULE_CODE_PATTERN,
  FLAG_ADMINISTRATION_PATTERN,
  IsmPayloadValidationError,
  checkIsmQuestionPayload,
};
