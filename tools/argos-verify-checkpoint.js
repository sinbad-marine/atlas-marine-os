'use strict';

// The caller must obtain the checkpoint from an independently trusted location.
// A checkpoint beside the writable journal is not an independent trust anchor.
function verifyCheckpoint(snapshot, checkpoint) {
  const invalid = () => ({status: 'ARGOS_CHECKPOINT_BLOCKED', reasonCode: 'CHECKPOINT_INVALID'});
  if (!snapshot || !checkpoint || checkpoint.version !== 'sinbad-argos-checkpoint/1-v1' ||
      checkpoint.shelfId !== snapshot.shelfId || !Number.isSafeInteger(checkpoint.eventCount) ||
      checkpoint.eventCount < 1 || !/^[a-f0-9]{64}$/.test(checkpoint.headHash) ||
      !Array.isArray(snapshot.entries) || snapshot.eventCount !== snapshot.entries.length) return invalid();
  if (snapshot.eventCount < checkpoint.eventCount) return {status: 'ARGOS_CHECKPOINT_BLOCKED', reasonCode: 'JOURNAL_TRUNCATED'};
  if (snapshot.entries[checkpoint.eventCount - 1].eventHash !== checkpoint.headHash) {
    return {status: 'ARGOS_CHECKPOINT_BLOCKED', reasonCode: 'JOURNAL_CHECKPOINT_MISMATCH'};
  }
  return {status: 'ARGOS_CHECKPOINT_MATCHED', reasonCode: null, anchoredEventCount: checkpoint.eventCount,
    unanchoredEventCount: snapshot.eventCount - checkpoint.eventCount};
}

module.exports = Object.freeze({verifyCheckpoint});
