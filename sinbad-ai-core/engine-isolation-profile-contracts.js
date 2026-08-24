'use strict';

const VERSION = 'sinbad-engine-isolation-profile/1-v1';
const KEYS = Object.freeze(['version', 'profileId', 'engineId', 'filesystemAccess', 'networkAccess', 'processExecution', 'environmentAccess', 'secretAccess', 'dynamicModuleLoad', 'nativeCode', 'memoryLimitMiB']);
const ID = /^[a-z][a-z0-9-]{2,63}$/u;

function blocked(reasonCode, profileId = null, engineId = null, gaps = ['ISOLATION_PROFILE_VALIDATION_REQUIRED']) {
  return Object.freeze({
    version: VERSION,
    status: 'ENGINE_ISOLATION_ACTIVATION_BLOCKED',
    reasonCode,
    profileId,
    engineId,
    isolationVerified: false,
    loadAllowed: false,
    executeAllowed: false,
    activationAllowed: false,
    assuranceGaps: Object.freeze([...gaps])
  });
}

function exactSnapshot(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype || Object.getOwnPropertySymbols(input).length) return null;
  const names = Object.getOwnPropertyNames(input);
  if (names.length !== KEYS.length || KEYS.some(key => !names.includes(key))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (KEYS.some(key => !descriptors[key] || !Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(KEYS.map(key => [key, descriptors[key].value]));
}

function assessProfile(input) {
  try {
    const value = exactSnapshot(input);
    if (!value || value.version !== VERSION || !ID.test(value.profileId) || !ID.test(value.engineId)) return blocked('ENGINE_ISOLATION_PROFILE_INVALID');
    for (const field of ['filesystemAccess', 'networkAccess', 'processExecution', 'environmentAccess', 'secretAccess']) {
      if (value[field] !== 'NONE') return blocked('ENGINE_ISOLATION_PROFILE_UNSAFE', value.profileId, value.engineId, [`${field.toUpperCase()}_MUST_BE_NONE`]);
    }
    if (value.dynamicModuleLoad !== false || value.nativeCode !== false || !Number.isInteger(value.memoryLimitMiB) || value.memoryLimitMiB < 16 || value.memoryLimitMiB > 4096) {
      return blocked('ENGINE_ISOLATION_PROFILE_UNSAFE', value.profileId, value.engineId, ['BOUNDED_INERT_RUNTIME_REQUIRED']);
    }
    return blocked('ENGINE_ISOLATION_ENFORCEMENT_UNVERIFIED', value.profileId, value.engineId, [
      'OS_CONTAINER_ENFORCEMENT_UNVERIFIED',
      'RESOURCE_LIMIT_ENFORCEMENT_UNVERIFIED',
      'ESCAPE_RESISTANCE_UNVERIFIED',
      'INDEPENDENT_ISOLATION_TEST_REQUIRED'
    ]);
  } catch (_error) {
    return blocked('ENGINE_ISOLATION_ASSESSOR_FAULT');
  }
}

module.exports = Object.freeze({ VERSION, assessProfile });
