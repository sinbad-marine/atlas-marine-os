'use strict';

const GATE_VERSION = 'sinbad-core-activation-gate/1-v1';
const BLOCKERS = Object.freeze([
  'ARCHITECTURE_GATE_0_EVIDENCE_REQUIRED',
  'CORE_RELEASE_GATE_EVIDENCE_REQUIRED',
  'VCASK_IMPLEMENTATION_NOT_AUTHORIZED',
  'INDEPENDENT_SAFETY_ASSURANCE_REQUIRED',
  'CLASS_FLAG_VESSEL_APPROVAL_REQUIRED',
]);
const INVALID_BLOCKERS = Object.freeze(['ACTIVATION_REQUEST_INVALID']);
const LEVELS = new Set([1, 2, 3, 4, 5, 6]);
function evaluate(request = {}) {
  let levelDescriptor, environmentDescriptor;
  try {
    if (!request || typeof request !== 'object' || Array.isArray(request) || Object.getPrototypeOf(request) !== Object.prototype || Object.getOwnPropertySymbols(request).length) throw new Error();
    const names = Object.getOwnPropertyNames(request);
    if (names.length !== 2 || !names.includes('level') || !names.includes('environment')) throw new Error();
    levelDescriptor = Object.getOwnPropertyDescriptor(request, 'level');
    environmentDescriptor = Object.getOwnPropertyDescriptor(request, 'environment');
  } catch { levelDescriptor = null; environmentDescriptor = null; }
  const level = levelDescriptor && Object.hasOwn(levelDescriptor, 'value') ? levelDescriptor.value : null;
  const environment = environmentDescriptor && Object.hasOwn(environmentDescriptor, 'value') ? environmentDescriptor.value : null;
  if (!LEVELS.has(level) || !['SIMULATION', 'HIL', 'SHORE_CONTROL', 'REAL_VESSEL'].includes(environment)) return Object.freeze({ version: GATE_VERSION, status: 'CORE_ACTIVATION_BLOCKED', reasonCode: 'ACTIVATION_REQUEST_INVALID', requestedLevel: null, environment: null, blockers: INVALID_BLOCKERS });
  return Object.freeze({ version: GATE_VERSION, status: 'CORE_ACTIVATION_BLOCKED', reasonCode: level <= 2 && environment !== 'REAL_VESSEL' ? 'NON_CONTROL_SCOPE_REQUIRES_GATE_EVIDENCE' : 'PHYSICAL_CONTROL_NOT_AUTHORIZED', requestedLevel: level, environment, blockers: BLOCKERS });
}

module.exports = Object.freeze({ GATE_VERSION, BLOCKERS, evaluate });
