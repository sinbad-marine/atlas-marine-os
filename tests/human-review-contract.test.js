'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const contract=JSON.parse(fs.readFileSync('config/human-review-contract.json','utf8'));

test('human review authority stays separate and least privilege',()=>{
  assert.equal(contract.schemaVersion,'sinbad-human-review/1');
  assert.equal(contract.roleSeparation.workspaceDeveloperIsHumanReviewer,false);
  assert.equal(contract.roleSeparation.humanReviewerIsOwner,false);
  assert.equal(contract.roleSeparation.humanReviewerCanControlGasm,false);
  assert.equal(contract.roleSeparation.humanReviewerCanAdministerSystem,false);
  assert.ok(contract.authority.owner.includes('owner.finalize'));
  for(const forbidden of ['reviewer.authorize','reviewer.revoke','package.transfer','owner.finalize'])assert.equal(contract.authority.humanReviewer.includes(forbidden),false);
});

test('technical human and Owner states cannot imply each other',()=>{
  const rules=contract.invariants;
  assert.equal(rules.technicalVerificationDoesNotSetHumanDecision,true);
  assert.equal(rules.deliveryDoesNotSetHumanDecision,true);
  assert.equal(rules.humanDecisionDoesNotSetOwnerDecision,true);
  assert.deepEqual(contract.question.humanDecisions,['PENDING','APPROVED','CORRECTION_REQUIRED','SOURCE_HOLD']);
  assert.deepEqual(contract.question.ownerDecisions,['PENDING','ACCEPTED','RETURNED']);
});

test('package completeness and scale are authoritative and bounded',()=>{
  assert.deepEqual(contract.package.allowedSizes,[25,50,100,250]);
  assert.equal(contract.invariants.completeFormula,'expectedCount == presentCount && missingCount == 0 && deferredCount == 0');
  assert.equal(contract.invariants.submittedIncompleteMayNotAppearComplete,true);
  assert.equal(contract.scale.targetQuestionCount,30000);
  assert.equal(contract.scale.pagination,'KEYSET');
  assert.equal(contract.scale.maximumPageSize,100);
  assert.equal(contract.scale.loadEntireBankInBrowser,false);
});

test('stale and duplicate writes have mandatory database bindings',()=>{
  assert.equal(contract.concurrency.authoritativeBoundary,'DATABASE_TRANSACTION');
  assert.equal(contract.concurrency.packageRowLock,'FOR_UPDATE');
  assert.equal(contract.concurrency.conflictBehavior,'REJECT_AND_RELOAD');
  assert.equal(contract.concurrency.silentMergeAllowed,false);
  assert.deepEqual(contract.concurrency.writeBinding,['workspaceId','packageId','actorUserId','assignmentGeneration','expectedLockVersion','idempotencyKey']);
});

test('GASM boundary is immutable and cannot auto-approve',()=>{
  assert.equal(contract.sourceBoundary.producer,'GASM_INDEPENDENT_TEAM');
  assert.equal(contract.sourceBoundary.transport,'VERSIONED_IMMUTABLE_MANIFEST');
  assert.equal(contract.sourceBoundary.humanReviewMayMutateSource,false);
  assert.equal(contract.sourceBoundary.importMayApproveQuestions,false);
  for(const field of ['sourceBatchId','sourceRevision','contentSha256','expectedCount','presentCount','missingCount','deferredCount','questions'])assert.ok(contract.sourceBoundary.requiredManifestFields.includes(field));
});
