"use strict";

function requiredText(value, name) {
  const text = String(value || "").trim();
  if (!text) throw new TypeError(`${name} is required`);
  return text;
}

function validTimestamp(value, name) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return parsed.toISOString();
}

function indexEvidence(evidence) {
  if (!Array.isArray(evidence)) throw new TypeError("legEvidence must be an array");
  const indexed = new Map();
  for (const item of evidence) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new TypeError("each leg evidence item must be an object");
    }
    const sequence = Number(item.legSequence);
    if (!Number.isSafeInteger(sequence) || sequence < 1) {
      throw new RangeError("legEvidence.legSequence must be a positive integer");
    }
    if (indexed.has(sequence)) throw new RangeError(`duplicate leg evidence for sequence ${sequence}`);
    indexed.set(sequence, item);
  }
  return indexed;
}

function normalizeApproval(approval) {
  if (approval == null) return null;
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) {
    throw new TypeError("approval must be an object");
  }
  if (approval.decision !== "APPROVE") {
    throw new RangeError("approval.decision must explicitly be APPROVE");
  }
  return {
    decision: "APPROVE",
    approver: requiredText(approval.approver, "approval.approver"),
    role: requiredText(approval.role, "approval.role"),
    approvedAt: validTimestamp(approval.approvedAt, "approval.approvedAt"),
    routeRevisionHash: requiredText(approval.routeRevisionHash, "approval.routeRevisionHash")
  };
}

function assessRouteRelease(options, dependencies) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("release options must be an object");
  }
  const { calculateRoutePlan, verifyRevisionChain } = dependencies || {};
  if (typeof calculateRoutePlan !== "function" || typeof verifyRevisionChain !== "function") {
    throw new TypeError("release dependencies are required");
  }

  const reasons = [];
  const chain = verifyRevisionChain(options.revisions);
  if (!chain.valid) reasons.push(`revision chain invalid: ${chain.reason}`);
  const head = Array.isArray(options.revisions) ? options.revisions.at(-1) : null;
  let calculatedRoute = null;
  if (chain.valid) calculatedRoute = calculateRoutePlan(head.routePlan);

  const evidenceByLeg = indexEvidence(options.legEvidence || []);
  const legChecks = calculatedRoute ? calculatedRoute.legs.map((leg) => {
    const evidence = evidenceByLeg.get(leg.sequence);
    const passed = Boolean(evidence && evidence.status === "PASS" && evidence.independentReference === true);
    if (!passed) reasons.push(`leg ${leg.sequence} lacks passing independent evidence`);
    return {
      legSequence: leg.sequence,
      passed,
      reference: passed ? evidence.reference : null
    };
  }) : [];
  if (calculatedRoute && evidenceByLeg.size !== calculatedRoute.legs.length) {
    reasons.push("leg evidence count does not match route leg count");
  }

  const approval = normalizeApproval(options.approval);
  if (approval && chain.valid && approval.routeRevisionHash !== chain.headHash) {
    reasons.push("approval is for a different route revision");
  }

  const technicalReady = reasons.length === 0;
  let status = "HOLD";
  if (technicalReady && !approval) status = "READY_FOR_HUMAN_APPROVAL";
  if (technicalReady && approval) status = "RELEASED";

  return {
    status,
    technicalReady,
    routeRevisionHash: chain.valid ? chain.headHash : null,
    calculatedRoute,
    revisionChain: chain,
    legChecks,
    approval,
    reasons,
    warnings: [
      "RELEASED records an explicit human decision; it is not class, flag, ECDIS, or statutory approval",
      "Voyage execution remains subject to onboard verification and the Master's authority"
    ]
  };
}

module.exports = { assessRouteRelease };
